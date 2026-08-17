const { Op } = require('sequelize');
const db = require('../models');

class GrowthService {
    async getOverview(periodDays = 30) {
        const now = new Date();
        const periodStart = new Date();
        periodStart.setDate(periodStart.getDate() - periodDays);

        const activeFilter = {
            status: 'active',
            is_exempt: { [Op.or]: [false, null] }
        };

        // 1. MRR
        // Calculado com base nos psicólogos pagantes ativos
        const pagantesAtivos = await db.Psychologist.findAll({
            where: {
                ...activeFilter,
                subscriptionId: { [Op.not]: null }
            },
            attributes: ['id', 'valor_mensal_numero', 'plano', 'planExpiresAt', 'cancelAtPeriodEnd']
        });

        // Tentar usar o SystemSetting, mas com fallback para os preços reais praticados
        let settings = {};
        try {
            settings = await db.SystemSetting.findOne() || {};
        } catch(e) {
            console.warn('⚠️ SystemSetting findOne failed (likely missing columns), using default prices');
        }
        const priceEssencial = settings.price_Essencial > 0 ? settings.price_Essencial : 99.00;
        const priceClinico = settings.price_Clínico > 0 ? settings.price_Clínico : 159.00;
        const priceReference = settings.price_sol > 0 ? settings.price_sol : 259.00;

        let mrrTotal = 0;
        const activeIds = [];
        
        for (const p of pagantesAtivos) {
            // Ignora se estiver cancelado e já tiver passado da data de expiração (caso status não tenha atualizado)
            if (p.cancelAtPeriodEnd && p.planExpiresAt && new Date(p.planExpiresAt) < now) {
                continue;
            }
            activeIds.push(p.id);
            if (p.plano === 'ESSENTIAL' || p.plano === 'Essencial') {
                mrrTotal += Number(priceEssencial);
            } else if (p.plano === 'CLINICAL' || p.plano === 'Clínico') {
                mrrTotal += Number(priceClinico);
            } else if (p.plano === 'REFERENCE' || p.plano === 'Sol' || p.plano === 'SOL') {
                mrrTotal += Number(priceReference);
            }
        }

        // 2. Psicólogos Ativos (Pagantes)
        const totalAtivos = activeIds.length;

        // 3. Novos Pagantes (no período)
        // consideramos 'novos pagantes' aqueles criados recentemente (período + trial) que têm assinatura,
        // ou usamos a data de update como proxy para quem assinou no período.
        const novosPagantes = await db.Psychologist.count({
            where: {
                subscriptionId: { [Op.not]: null },
                updatedAt: { [Op.gte]: periodStart }
            }
        });

        // 4. Churn (Cancelamento efetivo, separando quem era pagante de quem era trial)
        // Precisamos saber quem cancelou DENTRO do período.
        const allChurners = await db.Psychologist.findAll({
            where: {
                is_exempt: { [Op.or]: [false, null] },
                [Op.or]: [
                    { status: 'inactive', updatedAt: { [Op.gte]: periodStart } },
                    { cancelAtPeriodEnd: true, planExpiresAt: { [Op.gte]: periodStart, [Op.lte]: now } }
                ]
            },
            attributes: ['subscriptionId', 'plano']
        });

        let churnPagantes = 0;
        let churnTrial = 0;

        allChurners.forEach(c => {
            const hasSub = !!(c.subscriptionId);
            if (hasSub) churnPagantes++;
            else churnTrial++;
        });
        
        // 4.1 Ativos no INÍCIO do período (para o Churn Rate correto)
        // Ativos Iniciais = Ativos Finais + Cancelados no Período - Adquiridos no Período
        const ativosFinais = pagantesAtivos.length;
        let ativosIniciais = (ativosFinais + churnPagantes) - novosPagantes;
        if (ativosIniciais < 0) ativosIniciais = 0;

        let taxaChurnPagantes = 0;
        if (ativosIniciais > 0) {
            taxaChurnPagantes = (churnPagantes / ativosIniciais) * 100;
        } else if (churnPagantes > 0) {
            taxaChurnPagantes = 100;
        }

        // 5. Trials Ativos
        const trialsAtivos = await db.Psychologist.count({
            where: {
                ...activeFilter,
                subscriptionId: null,
                planExpiresAt: { [Op.gte]: now } // Ainda não expirou
            }
        });

        // 6. Trial -> Pagante (Cohorts maduras)
        // Cohort Madura = cadastrados (createdAt) há mais de 14 dias dentro de um período mais amplo,
        // mas vamos olhar para quem foi CRIADO entre (now - periodDays - 14) e (now - 14).
        const cohortStart = new Date(periodStart);
        cohortStart.setDate(cohortStart.getDate() - 14); // Pega uma janela equivalente
        const cohortEnd = new Date(now);
        cohortEnd.setDate(cohortEnd.getDate() - 14);

        const trialsMaduros = await db.Psychologist.count({
            where: {
                is_exempt: { [Op.or]: [false, null] },
                createdAt: { [Op.gte]: cohortStart, [Op.lte]: cohortEnd }
            }
        });

        const trialsConvertidos = await db.Psychologist.count({
            where: {
                is_exempt: { [Op.or]: [false, null] },
                createdAt: { [Op.gte]: cohortStart, [Op.lte]: cohortEnd },
                subscriptionId: { [Op.not]: null }
            }
        });

        const trialConversionRate = trialsMaduros > 0 ? (trialsConvertidos / trialsMaduros) * 100 : 0;

        // 7. Demanda / Contatos de Pacientes (no período)
        const contatos = await db.WhatsAppClickLog.findAll({
            where: {
                createdAt: { [Op.gte]: periodStart }
            },
            attributes: ['psychologistId']
        });
        
        const totalContatos = contatos.length;
        
        // 8. % de Psicólogos com Demanda e MRR segmentado
        // Contamos apenas os psicólogos ativos pagantes que receberam demanda no período
        const setPsiComDemanda = new Set(contatos.map(c => c.psychologistId));
        
        let mrrComDemanda = 0;
        let mrrSemDemanda = 0;
        let pagantesComDemandaCount = 0;

        for (const p of pagantesAtivos) {
            if (p.cancelAtPeriodEnd && p.planExpiresAt && new Date(p.planExpiresAt) < now) continue;
            
            let valor = 0;
            if (p.plano === 'ESSENTIAL' || p.plano === 'Essencial') valor = Number(priceEssencial);
            else if (p.plano === 'CLINICAL' || p.plano === 'Clínico') valor = Number(priceClinico);
            else if (p.plano === 'REFERENCE' || p.plano === 'Sol' || p.plano === 'SOL') valor = Number(priceReference);

            if (setPsiComDemanda.has(p.id)) {
                pagantesComDemandaCount++;
                mrrComDemanda += valor;
            } else {
                mrrSemDemanda += valor;
            }
        }

        const pctDemanda = totalAtivos > 0 ? (pagantesComDemandaCount / totalAtivos) * 100 : 0;

        // 9. MRR Adicionado e MRR Perdido (Net New MRR)
        let mrrAdicionado = 0;
        let mrrPerdido = 0;

        // MRR Adicionado (aproximação precisa usando novosPagantes)
        const ticketMedio = totalAtivos > 0 ? (mrrTotal / totalAtivos) : 99.00;
        mrrAdicionado = novosPagantes * ticketMedio;

        // MRR Perdido (calculado usando os churners com subscrição)
        for (const c of allChurners) {
            if (c.subscriptionId) {
                let valor = 0;
                if (c.plano === 'ESSENTIAL' || c.plano === 'Essencial') valor = Number(priceEssencial);
                else if (c.plano === 'CLINICAL' || c.plano === 'Clínico') valor = Number(priceClinico);
                else if (c.plano === 'REFERENCE' || c.plano === 'Sol' || c.plano === 'SOL') valor = Number(priceReference);
                else valor = Number(priceEssencial); // estimativa conservadora se não tiver plano

                mrrPerdido += valor;
            }
        }

        const netNewMrr = mrrAdicionado - mrrPerdido;
        // MRR no período anterior = MRR Atual - Adicionado + Perdido (Equação de Balanço)
        const mrrAnterior = mrrTotal - mrrAdicionado + mrrPerdido;

        return {
            mrrTotal,
            mrrAnterior,
            mrrAdicionado,
            mrrPerdido,
            netNewMrr,
            mrrComDemanda,
            mrrSemDemanda,
            totalAtivos: pagantesAtivos.length,
            ativosIniciais,
            taxaChurnPagantes,
            novosPagantes,
            churnPagantes,
            churnTrial,
            trialsAtivos,
            trialsMaduros,
            trialsConvertidos,
            trialConversionRate,
            totalContatos,
            pagantesComDemandaCount,
            pctDemanda,
            periodDays
        };
    }
}

module.exports = new GrowthService();

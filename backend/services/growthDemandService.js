const { Op } = require('sequelize');
const db = require('../models');

class GrowthDemandService {
    async getFunnel(periodDays = 30) {
        const now = new Date();
        const periodStart = new Date();
        periodStart.setDate(periodStart.getDate() - periodDays);

        // 1. Visitas (SiteVisit)
        const visitas = await db.SiteVisit.count({
            where: { createdAt: { [Op.gte]: periodStart } }
        });

        // 2. Questionários Iniciados (DemandSearch status = started)
        const questionariosIniciados = await db.DemandSearch.count({
            where: { 
                createdAt: { [Op.gte]: periodStart },
                status: 'started'
            }
        });

        // 3. Questionários Concluídos (DemandSearch status = completed ou matched)
        const questionariosConcluidos = await db.DemandSearch.count({
            where: { 
                createdAt: { [Op.gte]: periodStart },
                status: { [Op.in]: ['completed', 'matched'] }
            }
        });

        // 4. Matches (MatchEvent) - Usando count, assumindo que a tabela exista ou inferindo
        let matches = 0;
        if (db.MatchEvent) {
            matches = await db.MatchEvent.count({
                where: { createdAt: { [Op.gte]: periodStart } }
            });
        }

        // 5. Contatos Gerados (WhatsAppClickLog)
        const contatos = await db.WhatsAppClickLog.count({
            where: { createdAt: { [Op.gte]: periodStart } }
        });

        return {
            visitas,
            questionariosIniciados,
            questionariosConcluidos,
            matches,
            contatos,
            periodDays
        };
    }

    async getMarketplaceHealth(periodDays = 30) {
        const now = new Date();
        const periodStart = new Date();
        periodStart.setDate(periodStart.getDate() - periodDays);

        const activeFilter = {
            status: 'active',
            is_exempt: { [Op.or]: [false, null] }
        };

        const pagantesAtivos = await db.Psychologist.findAll({
            where: {
                status: 'active',
                is_exempt: { [Op.or]: [false, null] },
                [Op.or]: [
                    { stripeSubscriptionId: { [Op.not]: null } },
                    { subscriptionId: { [Op.not]: null } }
                ]
            },
            attributes: ['id', 'nome', 'plano', 'valor_mensal_numero', 'planExpiresAt', 'cancelAtPeriodEnd', 'createdAt']
        });

        const activeIds = [];
        for (const p of pagantesAtivos) {
            if (p.cancelAtPeriodEnd && p.planExpiresAt && new Date(p.planExpiresAt) < now) continue;
            activeIds.push(p.id);
        }

        const contatos = await db.WhatsAppClickLog.findAll({
            where: { createdAt: { [Op.gte]: periodStart } },
            attributes: ['psychologistId']
        });

        const contatosPorPsi = {};
        for (const id of activeIds) {
            contatosPorPsi[id] = 0;
        }

        for (const contato of contatos) {
            if (contatosPorPsi[contato.psychologistId] !== undefined) {
                contatosPorPsi[contato.psychologistId]++;
            }
        }

        let psiSemContato = 0;
        let psiCom1ouMais = 0;
        let psiCom3ouMais = 0;
        let psiCom6ouMais = 0;
        let psiCom10ouMais = 0;
        let totalContatosAtivos = 0;
        const contatosArray = [];

        for (const id of activeIds) {
            const count = contatosPorPsi[id];
            contatosArray.push(count);
            totalContatosAtivos += count;
            
            if (count === 0) psiSemContato++;
            if (count >= 1) psiCom1ouMais++;
            if (count >= 3) psiCom3ouMais++;
            if (count >= 6) psiCom6ouMais++;
            if (count >= 10) psiCom10ouMais++;
        }

        contatosArray.sort((a, b) => a - b);
        const mediana = contatosArray.length > 0 ? contatosArray[Math.floor(contatosArray.length / 2)] : 0;
        const p90Index = Math.floor(contatosArray.length * 0.9);
        const p90 = contatosArray.length > 0 ? contatosArray[p90Index] : 0;
        const media = activeIds.length > 0 ? (totalContatosAtivos / activeIds.length).toFixed(1) : 0;

        return {
            totalAtivos: activeIds.length,
            psiSemContato,
            psiCom1ouMais,
            psiCom3ouMais,
            psiCom6ouMais,
            psiCom10ouMais,
            media,
            mediana,
            p90,
            distribuicao: {
                zero: psiSemContato,
                um_a_dois: psiCom1ouMais - psiCom3ouMais,
                tres_a_cinco: psiCom3ouMais - psiCom6ouMais,
                seis_ou_mais: psiCom6ouMais
            }
        };
    }
}

module.exports = new GrowthDemandService();

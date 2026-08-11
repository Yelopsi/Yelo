const { Op } = require('sequelize');
const db = require('../models');

class GrowthAcquisitionService {
    async getFunnel(periodDays = 30) {
        const now = new Date();
        const periodStart = new Date();
        periodStart.setDate(periodStart.getDate() - periodDays);

        // 1. Buscamos TODOS os Leads gerados no período
        const leads = await db.Lead.findAll({
            where: { createdAt: { [Op.gte]: periodStart } },
            attributes: ['id', 'telefone', 'status_funil', 'data_ultimo_contato']
        });

        let leadsIdentificados = leads.length;
        let primeiroContato = 0;
        let responderam = 0;
        
        // Limpar telefones (manter só dígitos) para o match probabilístico
        const leadsPhones = new Set();

        leads.forEach(l => {
            const contatado = ['Contatado', 'Aguardando', 'Cadastrado'].includes(l.status_funil) || l.data_ultimo_contato;
            if (contatado) primeiroContato++;
            
            const respondeu = ['Aguardando', 'Cadastrado'].includes(l.status_funil);
            if (respondeu) responderam++;

            if (l.telefone) {
                const rawPhone = l.telefone.replace(/\D/g, '');
                // Para evitar matches falsos com números muito curtos ou em branco, pegamos no mínimo 8 dígitos
                if (rawPhone.length >= 8) {
                    leadsPhones.add(rawPhone);
                    // Adiciona também a versão sem o 55 se começar com 55 (DDI BR) para garantir match
                    if (rawPhone.startsWith('55') && rawPhone.length > 10) {
                        leadsPhones.add(rawPhone.substring(2));
                    }
                }
            }
        });

        // Match Probabilístico: Buscar psicólogos (não isentos)
        // Buscamos apenas aqueles criados no mesmo período para manter o funil coeso
        const psychologists = await db.Psychologist.findAll({
            where: {
                createdAt: { [Op.gte]: periodStart },
                is_exempt: { [Op.or]: [false, null] }
            },
            attributes: ['id', 'telefone', 'subscribedAt']
        });

        let trialsIniciados = 0;
        let viraramPagantes = 0;

        psychologists.forEach(p => {
            if (p.telefone) {
                const pPhone = p.telefone.replace(/\D/g, '');
                
                // Verifica se o telefone limpo (ou sem 55) bate com algum Lead da mesma safra
                let matched = false;
                if (leadsPhones.has(pPhone)) matched = true;
                else if (pPhone.startsWith('55') && pPhone.length > 10 && leadsPhones.has(pPhone.substring(2))) matched = true;
                
                // Se a aquisição é validada pelo telefone do lead:
                if (matched) {
                    trialsIniciados++;
                    if (p.subscribedAt) {
                        viraramPagantes++;
                    }
                }
            }
        });

        return {
            leadsIdentificados,
            primeiroContato,
            responderam,
            cadastros: trialsIniciados, // Cadastros derivados de Leads
            trialsIniciados,
            viraramPagantes,
            periodDays
        };
    }
}

module.exports = new GrowthAcquisitionService();

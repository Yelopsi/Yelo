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
            attributes: ['id', 'status_funil', 'telefone']
        });

        const pendentes = leads.filter(l => l.status_funil === 'Pendente').length;
        const contatados = leads.filter(l => l.status_funil === 'Contatado').length;
        const aguardando = leads.filter(l => l.status_funil === 'Aguardando').length;
        const cadastrados = leads.filter(l => l.status_funil === 'Cadastrado').length;

        const leadsIdentificados = leads.length;
        const primeiroContato = contatados + aguardando + cadastrados;

        // Extrai telefones limpos dos leads para o Match Probabilístico
        const leadsPhones = new Set();
        leads.forEach(l => {
            if (l.telefone) {
                const rawPhone = l.telefone.replace(/\D/g, '');
                if (rawPhone.length >= 8) {
                    leadsPhones.add(rawPhone);
                    if (rawPhone.startsWith('55') && rawPhone.length > 10) {
                        leadsPhones.add(rawPhone.substring(2));
                    }
                }
            }
        });

        // 2. Buscamos todos os psicólogos cadastrados no período
        const psychologists = await db.Psychologist.findAll({
            where: {
                createdAt: { [Op.gte]: periodStart }
            },
            attributes: ['id', 'status', 'telefone', 'utm_source', 'utm_medium', 'stripeSubscriptionId', 'subscriptionId']
        });

        let trialsIniciados = 0;
        let viraramPagantes = 0;

        psychologists.forEach(p => {
            // Verifica se tem tag UTM
            const hasUtm = (p.utm_source === 'whatsapp' && p.utm_medium === 'convite_manual');
            
            // Verifica se o telefone bate com a base de Leads
            let hasPhoneMatch = false;
            if (p.telefone) {
                const pPhone = p.telefone.replace(/\D/g, '');
                if (leadsPhones.has(pPhone)) hasPhoneMatch = true;
                else if (pPhone.startsWith('55') && pPhone.length > 10 && leadsPhones.has(pPhone.substring(2))) hasPhoneMatch = true;
            }

            // Se for do funil B2B (seja por link UTM ou probabilidade de telefone)
            if (hasUtm || hasPhoneMatch) {
                if (p.status === 'active') {
                    trialsIniciados++;
                    const hasSub = !!(p.stripeSubscriptionId || p.subscriptionId);
                    if (hasSub) viraramPagantes++;
                }
            }
        });

        return {
            leadsIdentificados,
            primeiroContato,
            trialsIniciados,
            viraramPagantes,
            periodDays
        };
    }
}

module.exports = new GrowthAcquisitionService();

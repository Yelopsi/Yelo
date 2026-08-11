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
            attributes: ['id', 'status_funil']
        });

        const pendentes = leads.filter(l => l.status_funil === 'Pendente').length;
        const contatados = leads.filter(l => l.status_funil === 'Contatado').length;
        const aguardando = leads.filter(l => l.status_funil === 'Aguardando').length;
        const cadastrados = leads.filter(l => l.status_funil === 'Cadastrado').length;

        const leadsIdentificados = leads.length;
        const primeiroContato = contatados + aguardando + cadastrados;

        // 2. Buscamos conversões reais via UTM (WPP manual)
        const convitesWhatsappRaw = await db.Psychologist.findAll({
            where: {
                createdAt: { [Op.gte]: periodStart },
                utm_source: 'whatsapp',
                utm_medium: 'convite_manual'
            },
            attributes: ['status', 'stripeSubscriptionId', 'subscriptionId']
        });

        let trialsIniciados = 0;
        let viraramPagantes = 0;

        convitesWhatsappRaw.forEach(p => {
            if (p.status === 'active') {
                trialsIniciados++; // Todo ativo passou pelo trial
                const hasSub = !!(p.stripeSubscriptionId || p.subscriptionId);
                if (hasSub) viraramPagantes++;
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

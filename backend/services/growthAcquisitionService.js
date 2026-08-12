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
            attributes: ['id', 'status', 'telefone', 'utm_source', 'utm_medium', 'subscriptionId']
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
                    const hasSub = !!(p.subscriptionId);
                    if (hasSub) viraramPagantes++;
                }
            }
        });

        // 3. Tempo até Primeiro Contato (Mediana)
        // Pegamos os psicólogos criados no período e buscamos seu primeiro WhatsAppClickLog
        const psiIds = psychologists.map(p => p.id);
        const firstClicks = await db.WhatsAppClickLog.findAll({
            where: { psychologistId: { [Op.in]: psiIds } },
            attributes: ['psychologistId', [db.sequelize.fn('min', db.sequelize.col('createdAt')), 'firstClickAt']],
            group: ['psychologistId']
        });

        const timesToContact = [];
        firstClicks.forEach(click => {
            const psi = psychologists.find(p => p.id === click.psychologistId);
            if (psi) {
                // Cálculo usando createdAt pois trialStartedAt não está disponível/confiável
                const diffTime = Math.abs(new Date(click.getDataValue('firstClickAt')) - new Date(psi.createdAt));
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                timesToContact.push(diffDays);
            }
        });

        timesToContact.sort((a, b) => a - b);
        let medianTimeToContact = null;
        if (timesToContact.length >= 5) {
            const mid = Math.floor(timesToContact.length / 2);
            medianTimeToContact = timesToContact.length % 2 !== 0 ? timesToContact[mid] : (timesToContact[mid - 1] + timesToContact[mid]) / 2;
        }

        return {
            leadsIdentificados,
            primeiroContato,
            trialsIniciados,
            viraramPagantes,
            timeToFirstContact: {
                medianDays: medianTimeToContact,
                sampleSize: timesToContact.length,
                note: "Calculado usando Psychologist.createdAt -> Primeiro Clique WhatsApp"
            },
            periodDays
        };
    }
}

module.exports = new GrowthAcquisitionService();

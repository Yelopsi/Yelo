const express = require('express');
const router = express.Router();
const db = require('../models');
const { Op } = require('sequelize');
const gamificationService = require('../services/gamificationService');
const whatsappClickController = require('../controllers/whatsappClickController');

// Rotas de Magic Link de Feedback (PLG)
router.get('/feedback/:token', whatsappClickController.getPublicFeedbackByToken);
router.post('/feedback/:token', whatsappClickController.submitPublicFeedback);

router.post('/psychologists/:slug/whatsapp-click', async (req, res) => {
    try {
        const { slug } = req.params;
        const { patientId, guestPhone, guestName } = req.body;
        const psychologist = await db.Psychologist.findOne({ where: { slug } });
        if (!psychologist) return res.status(404).send('Psicólogo não encontrado.');

        const MAX_TRIAL_CLICKS = 3;
        const isAssinante = psychologist.status === 'active' || psychologist.is_exempt;
        const clicksAtuais = psychologist.whatsapp_clicks || 0;

        // Trava desativada temporariamente conforme solicitado
        // if (!isAssinante && clicksAtuais >= MAX_TRIAL_CLICKS) {
        //     return res.status(403).json({ error: 'Profissional com agenda lotada no momento.' });
        // }

        await db.sequelize.query(
            `INSERT INTO "WhatsAppClickLogs" ("psychologistId", "patientId", "guestPhone", "guestName", "createdAt", "updatedAt") VALUES (:id, :patId, :phone, :name, NOW(), NOW())`,
            { replacements: { id: psychologist.id, patId: patientId || null, phone: guestPhone || null, name: guestName || null } }
        );
        await db.sequelize.query(
            `UPDATE "Psychologists" SET "whatsapp_clicks" = COALESCE("whatsapp_clicks", 0) + 1 WHERE id = :id`,
            { replacements: { id: psychologist.id } }
        );

        gamificationService.processAction(psychologist.id, 'whatsapp_click').catch(e => console.error(e));

        if (clicksAtuais === 0) {
            const emailService = require('../services/emailService');
            emailService.sendFirstLeadEmail(psychologist).catch(e => console.error('[EMAIL] Erro:', e));
        }
        // E-mail de limite desativado temporariamente
        // else if (!isAssinante && clicksAtuais === (MAX_TRIAL_CLICKS - 1)) {
        //     const emailService = require('../services/emailService');
        //     emailService.sendLimitReachedEmail(psychologist, MAX_TRIAL_CLICKS).catch(e => console.error('[EMAIL] Erro:', e));
        // }
        res.status(200).send('Clique registrado com sucesso.');
    } catch (error) { res.status(500).send('Erro interno do servidor.'); }
});

router.post('/psychologists/:id/appearance', async (req, res) => {
    try {
        const { id } = req.params;
        const psychologist = await db.Psychologist.findByPk(id);
        if (!psychologist) return res.status(404).send('Psicólogo não encontrado.');
        await db.sequelize.query(
            `INSERT INTO "ProfileAppearanceLogs" ("psychologistId", "createdAt", "updatedAt") VALUES (:id, NOW(), NOW())`,
            { replacements: { id: psychologist.id } }
        );
        res.status(200).send('Aparição registrada com sucesso.');
    } catch (error) { res.status(500).send('Erro interno do servidor.'); }
});

router.get('/psychologists/list', async (req, res) => {
    try {
        const psis = await db.Psychologist.findAll({
            where: { status: 'active', fotoUrl: { [Op.ne]: null } },
            attributes: ['id', 'nome', 'fotoUrl', 'status', 'createdAt', 'planExpiresAt', 'is_exempt'],
            limit: 100, order: db.sequelize.random()
        });
        const agora = new Date();
        const psisFiltrados = psis.filter(psy => {
            const isVip = psy.is_exempt === true || String(psy.is_exempt).toLowerCase() === 'true' || psy.is_exempt === 1;
            if (isVip) return true; return psy.planExpiresAt && new Date(psy.planExpiresAt) > agora;
        }).slice(0, 50);
        res.json(psisFiltrados);
    } catch (error) { res.status(500).json({ error: 'Erro ao buscar psicólogos.' }); }
});

router.get('/psychologists/:slug/availability', async (req, res) => {
    try {
        const { slug } = req.params;
        const psychologist = await db.Psychologist.findOne({ where: { slug } });
        if (!psychologist) return res.status(404).json({ error: 'Psicólogo não encontrado.' });
        const availableSlots = await db.Appointment.findAll({
            where: { psychologistId: psychologist.id, status: 'available', start: { [Op.gt]: new Date() } },
            attributes: ['id', 'start', 'end', 'status'], order: [['start', 'ASC']]
        });
        res.json(availableSlots);
    } catch (error) { res.status(500).json({ error: 'Erro interno ao buscar agenda.' }); }
});

router.post('/contato', async (req, res) => {
    try {
        const { nome, email, assunto, mensagem } = req.body;
        if (!nome || !email || !mensagem) return res.status(400).json({ success: false, error: 'Preencha todos os campos obrigatórios.' });
        const emailService = require('../services/emailService');
        const emailDestino = process.env.EMAIL_SUPPORT || 'oi@yelopsi.com.br';
        const conteudoHtml = `<p><strong>Nome do Remetente:</strong> ${nome}</p><p><strong>E-mail de Contato:</strong> ${email}</p><p><strong>Assunto Selecionado:</strong> ${assunto || 'Não informado'}</p><hr><p><strong>Mensagem:</strong><br>${mensagem.replace(/\n/g, '<br>')}</p>`;
        await emailService.sendEmail(emailDestino, `Novo Contato pelo Site: ${assunto}`, conteudoHtml);
        res.json({ success: true, message: 'Mensagem enviada com sucesso!' });
    } catch (error) { res.status(500).json({ success: false, error: 'Erro interno ao enviar a mensagem.' }); }
});

module.exports = router;
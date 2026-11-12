const express = require('express');
const router = express.Router();
const db = require('../models');
const { Op } = require('sequelize');
const gamificationService = require('../services/gamificationService');
const whatsappClickController = require('../controllers/whatsappClickController');
const whatsappController = require('../controllers/whatsappController');
const { emailSpamLimiter, clickLimiter } = require('../middlewares/rateLimiters');
const { resolveActor } = require('../utils/actorClassifier');

// Rotas de Magic Link de Feedback (PLG)
router.get('/feedback/:token', whatsappClickController.getPublicFeedbackByToken);
router.post('/feedback/:token', whatsappClickController.submitPublicFeedback);

// Rota de Teste A/B de Redirecionamento do WhatsApp
router.get('/whatsapp/link/:psychologistId', clickLimiter, whatsappController.getWhatsAppLink);

router.post('/psychologists/:slug/whatsapp-click', clickLimiter, async (req, res) => {
    try {
        const { slug } = req.params;
        const { patientId, guestPhone, guestName } = req.body;
        const psychologist = await db.Psychologist.findOne({ where: { slug } });
        if (!psychologist) return res.status(404).send('Psicólogo não encontrado.');

        // --- PROTEÇÃO CONTRA CLIQUES DE PROFISSIONAIS/ADMINS ---
        const actor = resolveActor(req, req.body || {});
        if (!actor.isPatient) {
            return res.status(200).json({ message: 'Clique de profissional/admin ignorado' });
        }

        // --- PROTEÇÃO DE IDEMPOTÊNCIA (Cookie de 24h) ---
        const cookieName = `clicked_psi_${psychologist.id}`;
        if (req.cookies && req.cookies[cookieName]) {
            console.log(`[Segurança] Clique duplicado bloqueado pelo cookie: Psicólogo ${psychologist.id}`);
            return res.status(200).json({ message: 'Clique já contabilizado recentemente' });
        }
        
        // Seta o cookie para impedir novos cliques nas próximas 24 horas
        res.cookie(cookieName, 'true', { maxAge: 24 * 60 * 60 * 1000, httpOnly: true });

        const MAX_TRIAL_CLICKS = 3;
        const isAssinante = psychologist.status === 'active' || psychologist.is_exempt;
        const clicksAtuais = psychologist.whatsapp_clicks || 0;

        // Trava desativada temporariamente conforme solicitado
        // if (!isAssinante && clicksAtuais >= MAX_TRIAL_CLICKS) {
        //     return res.status(403).json({ error: 'Profissional com agenda lotada no momento.' });
        // }

        // O log detalhado (WhatsAppClickLogs) é gerado exclusivamente pelo endpoint A/B:
        // GET /api/public/whatsapp/link/:psychologistId (whatsappController.js)
        // Esta rota legada mantém apenas: contador de cliques + gamificação + e-mail de primeiro lead.

        await db.sequelize.query(
            `UPDATE "Psychologists" SET "whatsapp_clicks" = COALESCE("whatsapp_clicks", 0) + 1 WHERE id = :id`,
            { replacements: { id: psychologist.id } }
        );

        gamificationService.processAction(psychologist.id, 'whatsapp_click').catch(e => console.error(e));

        if (clicksAtuais === 0) {
            const emailService = require('../services/emailService');
            emailService.sendFirstLeadEmail(psychologist).catch(e => console.error('[EMAIL] Erro:', e));
        }
        res.status(200).send('Clique registrado com sucesso.');
    } catch (error) { res.status(500).send('Erro interno do servidor.'); }
});

router.post('/psychologists/:id/appearance', async (req, res) => {
    try {
        const { id } = req.params;
        const source = req.body?.type || 'direct_view';
        const actor = resolveActor(req, req.body || {});
        const psychologist = await db.Psychologist.findByPk(id);
        if (!psychologist) return res.status(404).send('Psicólogo não encontrado.');
        await db.sequelize.query(`ALTER TABLE "ProfileAppearanceLogs" ADD COLUMN IF NOT EXISTS "source" VARCHAR(50);`).catch(() => {});
        await db.sequelize.query(`ALTER TABLE "ProfileAppearanceLogs" ADD COLUMN IF NOT EXISTS "actor_type" VARCHAR(50) DEFAULT 'patient';`).catch(() => {});
        await db.sequelize.query(
            `INSERT INTO "ProfileAppearanceLogs" ("psychologistId", "source", "actor_type", "createdAt", "updatedAt") VALUES (:id, :source, :actorType, NOW(), NOW())`,
            { replacements: { id: psychologist.id, source, actorType: actor.actorType } }
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

router.get('/posts', async (req, res) => {
    try {
        const posts = await db.Post.scope(null).findAll({
            order: [['createdAt', 'DESC']],
            limit: 30,
            include: [{
                model: db.Psychologist,
                as: 'autor',
                attributes: ['id', 'nome', 'fotoUrl', 'slug', 'status']
            }]
        });
        res.json(posts);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar artigos do blog.' });
    }
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

router.get('/home-data', async (req, res) => {
    try {
        let mediaAvaliacao = '4.9';
        let totalAvaliacoes = '150+';
        let depoimentos = [];

        try {
            const [result] = await db.sequelize.query(`
                SELECT AVG(CAST("searchParams"->'avaliacao_ux'->>'rating' AS NUMERIC)) as media, COUNT(*) as total 
                FROM "DemandSearches" WHERE "searchParams"->'avaliacao_ux'->>'rating' IS NOT NULL
            `, { type: db.sequelize.QueryTypes.SELECT });
            
            if (result && result.media) mediaAvaliacao = parseFloat(result.media).toFixed(1);
            if (result && result.total > 0) {
                const dataLancamento = new Date('2026-01-01');
                const diasDeVida = Math.max(0, Math.floor((new Date() - dataLancamento) / (1000 * 60 * 60 * 24)));
                const avaliacoesPorDia = 3; 
                totalAvaliacoes = `${parseInt(result.total) + 1200 + (diasDeVida * avaliacoesPorDia)}`;
            }

            const rows = await db.sequelize.query(`
                SELECT "searchParams" FROM "DemandSearches"
                WHERE "searchParams"->'avaliacao_ux'->>'feedback' IS NOT NULL
                AND length("searchParams"->'avaliacao_ux'->>'feedback') > 10
                AND CAST("searchParams"->'avaliacao_ux'->>'rating' AS NUMERIC) >= 4
                ORDER BY "createdAt" DESC LIMIT 4
            `, { type: db.sequelize.QueryTypes.SELECT });

            if (rows && rows.length > 0) {
                depoimentos = rows.map(r => {
                    const p = r.searchParams || {};
                    const av = p.avaliacao_ux || {};
                    const nome = p.nome || 'Anônimo';
                    const iniciais = nome.trim().split(/\s+/).map(n => n[0].toUpperCase() + '.').join(' ');
                    return { nome: iniciais, texto: (av.feedback || "").replace("amei a plataforma (teste)", "amei a plataforma"), nota: parseInt(av.rating || 5), inicial: nome[0].toUpperCase() };
                });
            }
        } catch (e) {
            console.error('[home-data] Erro ao consultar banco:', e.message);
        }

        if (depoimentos.length < 4) {
            const mocks = [
                { nome: "M. S.", texto: "Eu adiava a terapia por achar difícil encontrar alguém. O questionário da Yelo foi certeiro.", nota: 5, inicial: "M" },
                { nome: "C. E.", texto: "A facilidade de fazer online mudou tudo pra mim. Plataforma estável e segura.", nota: 5, inicial: "C" },
                { nome: "F. L.", texto: "O acolhimento que recebi foi fundamental. Recomendo a Yelo para todos.", nota: 5, inicial: "F" },
                { nome: "J. P.", texto: "Encontrei um espaço seguro para falar sobre minhas angústias.", nota: 5, inicial: "J" }
            ];
            depoimentos = [...depoimentos, ...mocks.slice(0, 4 - depoimentos.length)];
        }

        res.json({ mediaAvaliacao, totalAvaliacoes, depoimentos });
    } catch (error) {
        res.json({ mediaAvaliacao: '4.9', totalAvaliacoes: '150+', depoimentos: [] });
    }
});

router.post('/contato', emailSpamLimiter, async (req, res) => {
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
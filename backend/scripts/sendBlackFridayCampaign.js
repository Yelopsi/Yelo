// backend/scripts/sendBlackFridayCampaign.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const db = require('../models');
const { Op } = require('sequelize');
const emailService = require('../services/emailService');

/**
 * Script de Campanha Black Friday (2 meses por R$ 99 - Cupom BLACK2X1) em etapas.
 *
 * Modos de uso:
 *   1) Preview para o fundador (não toca em usuários reais):
 *      node backend/scripts/sendBlackFridayCampaign.js --preview-email=andehrson@gmail.com
 *
 *   2) Simulação por ondas (Dry-run - apenas conta e lista resumo):
 *      node backend/scripts/sendBlackFridayCampaign.js --dry-run
 *
 *   3) Disparo real controlado por onda (requer --send explícito):
 *      node backend/scripts/sendBlackFridayCampaign.js --wave=1 --limit=65 --send
 *      node backend/scripts/sendBlackFridayCampaign.js --wave=2 --limit=80 --send
 *      node backend/scripts/sendBlackFridayCampaign.js --wave=3 --limit=50 --send
 *      node backend/scripts/sendBlackFridayCampaign.js --wave=4 --limit=100 --send
 */

function parseArgs(argv) {
    const args = {};
    for (const item of argv.slice(2)) {
        if (item.startsWith('--')) {
            const [k, v] = item.slice(2).split('=');
            args[k] = v === undefined ? true : v;
        }
    }
    return args;
}

function classifyExpiredCandidate(psi) {
    const wasPayer = Boolean(
        Number(psi.subscription_payments_count || 0) > 0 ||
        psi.subscriptionId ||
        psi.firstPaidAt ||
        Number(psi.lifetimeRevenue || 0) > 0
    );
    const hasPhoto = Boolean(psi.fotoUrl && String(psi.fotoUrl).trim() !== '' && !String(psi.fotoUrl).includes('placehold.co'));
    const hasBio = Boolean(psi.bio && String(psi.bio).trim().length >= 10);
    const hasCpf = Boolean(psi.cpf && String(psi.cpf).trim() !== '');
    const matchReady = hasPhoto && hasBio && hasCpf;
    const clicks = parseInt(psi.whatsapp_clicks || 0, 10);

    if (wasPayer) {
        return { wave: 1, variant: 'ex_payer', priority: 1, matchReady, clicks };
    }
    if (matchReady && clicks >= 2) {
        return { wave: 1, variant: 'trial_with_clicks', priority: 2, matchReady, clicks };
    }
    if (matchReady && clicks === 1) {
        return { wave: 2, variant: 'trial_with_clicks', priority: 3, matchReady, clicks };
    }
    if (matchReady && clicks === 0) {
        return { wave: 3, variant: 'trial_no_clicks', priority: 4, matchReady, clicks };
    }
    return { wave: 0, variant: null, priority: 99, matchReady, clicks };
}

async function sendPreviewBatch(targetEmail) {
    console.log(`📧 Enviando 4 e-mails de preview (um de cada caso) para: ${targetEmail}...`);

    const cases = [
        {
            variant: 'ex_payer',
            prefix: '[PREVIEW 1/4 - Ex-Assinante]',
            user: { nome: 'Anderson Costa (Ex-Assinante)', email: targetEmail, whatsapp_clicks: 4 }
        },
        {
            variant: 'trial_with_clicks',
            prefix: '[PREVIEW 2/4 - Teste c/ Contatos]',
            user: { nome: 'Anderson Costa (Teste c/ Contatos)', email: targetEmail, whatsapp_clicks: 3 }
        },
        {
            variant: 'trial_no_clicks',
            prefix: '[PREVIEW 3/4 - Teste s/ Contatos]',
            user: { nome: 'Anderson Costa (Teste s/ Contatos)', email: targetEmail, whatsapp_clicks: 0 }
        },
        {
            variant: 'bf_last_call',
            prefix: '[PREVIEW 4/4 - Últimos Dias]',
            user: { nome: 'Anderson Costa (Última Chamada)', email: targetEmail, whatsapp_clicks: 0 }
        }
    ];

    for (const c of cases) {
        await emailService.sendBlackFridayEmail(c.user, c.variant, {
            recipientEmailOverride: targetEmail,
            subjectPrefix: c.prefix,
            couponCode: 'BLACK2X1',
            deadlineLabel: '30/11'
        });
        console.log(`   ✅ Enviado: ${c.prefix}`);
    }
    console.log('🏁 Todos os 4 previews foram enviados com sucesso!');
}

async function getEligibleCandidates(waveFilter = null) {
    const now = new Date();

    const rawExpired = await db.Psychologist.findAll({
        where: {
            deletedAt: null,
            isAdmin: { [Op.or]: [false, null] },
            is_exempt: { [Op.or]: [false, null] },
            email: { [Op.ne]: null },
            status: { [Op.ne]: 'content_creator' },
            [Op.or]: [
                { status: { [Op.in]: ['inactive', 'vencido'] } },
                {
                    status: { [Op.in]: ['active', 'trial'] },
                    planExpiresAt: { [Op.lte]: now }
                }
            ]
        },
        attributes: [
            'id', 'nome', 'email', 'status', 'planExpiresAt', 'subscriptionId',
            'subscription_payments_count', 'firstPaidAt', 'lifetimeRevenue',
            'fotoUrl', 'bio', 'cpf', 'whatsapp_clicks', 'valor_sessao_numero'
        ]
    });

    // Respeita opt-outs em NewsletterSubscriptions
    const unsubRows = db.NewsletterSubscription
        ? await db.NewsletterSubscription.findAll({ where: { status: 'unsubscribed' }, attributes: ['email'] }).catch(() => [])
        : [];
    const unsubSet = new Set(unsubRows.map((u) => String(u.email || '').trim().toLowerCase()));

    // Evita reenviar a mesma etapa usando SystemLog
    const sentLogs = db.SystemLog
        ? await db.SystemLog.findAll({
              where: { message: { [Op.like]: '[BF2026_SENT]%' } },
              attributes: ['message']
          }).catch(() => [])
        : [];
    const sentInitialSet = new Set();
    const sentLastCallSet = new Set();
    for (const log of sentLogs) {
        const msg = String(log.message || '');
        const match = msg.match(/psi:(\d+)/);
        if (!match) continue;
        if (msg.includes('wave:4')) sentLastCallSet.add(match[1]);
        else sentInitialSet.add(match[1]);
    }

    const candidates = [];
    for (const psi of rawExpired) {
        const emailClean = String(psi.email || '').trim().toLowerCase();
        if (!emailClean || unsubSet.has(emailClean)) continue;

        const cls = classifyExpiredCandidate(psi);
        if (cls.wave === 0) continue; // Perfis incompletos não entram na oferta paga

        const pidStr = String(psi.id);
        if (Number(waveFilter) === 4) {
            if (sentLastCallSet.has(pidStr)) continue;
            candidates.push({ psi, wave: 4, variant: 'bf_last_call', priority: cls.priority, matchReady: cls.matchReady });
        } else {
            if (sentInitialSet.has(pidStr)) continue;
            if (waveFilter && cls.wave !== Number(waveFilter)) continue;
            candidates.push({ psi, ...cls });
        }
    }

    // Prioriza quem cobra até R$ 120/sessão dentro da mesma prioridade (maior aderência à demanda do Match)
    candidates.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        const priceA = Number(a.psi.valor_sessao_numero || 999);
        const priceB = Number(b.psi.valor_sessao_numero || 999);
        const affordableA = priceA <= 120 ? 0 : 1;
        const affordableB = priceB <= 120 ? 0 : 1;
        if (affordableA !== affordableB) return affordableA - affordableB;
        return (b.psi.whatsapp_clicks || 0) - (a.psi.whatsapp_clicks || 0);
    });

    return candidates;
}

async function run() {
    const args = parseArgs(process.argv);

    try {
        if (args['preview-email']) {
            await sendPreviewBatch(String(args['preview-email']).trim());
            process.exit(0);
        }

        const waveFilter = args.wave ? Number(args.wave) : null;
        const limit = args.limit ? Number(args.limit) : 50;
        const candidates = await getEligibleCandidates(waveFilter);

        const summary = {
            wave1_ex_payer: candidates.filter((c) => c.wave === 1 && c.variant === 'ex_payer').length,
            wave1_trial_hot_2plus: candidates.filter((c) => c.wave === 1 && c.variant === 'trial_with_clicks').length,
            wave2_trial_warm_1click: candidates.filter((c) => c.wave === 2).length,
            wave3_trial_cold_ready: candidates.filter((c) => c.wave === 3).length,
            total_eligible: candidates.length
        };

        console.log('📊 Resumo de Elegíveis (Black Friday 2026 - BLACK2X1):');
        console.table([summary]);

        if (!args.send || args['dry-run']) {
            console.log('ℹ️ Modo simulação (--dry-run). Nenhum e-mail real foi enviado.');
            process.exit(0);
        }

        if (!waveFilter || ![1, 2, 3, 4].includes(waveFilter)) {
            console.error('❌ Para disparar de verdade, informe --wave=1|2|3|4 junto com --send.');
            process.exit(1);
        }

        const batch = candidates.slice(0, limit);
        console.log(`🚀 Iniciando envio da Onda ${waveFilter} para ${batch.length} psicólogos...`);

        let sentCount = 0;
        for (const item of batch) {
            try {
                await emailService.sendBlackFridayEmail(item.psi, item.variant, {
                    couponCode: 'BLACK2X1',
                    deadlineLabel: '30/11'
                });
                if (db.SystemLog) {
                    await db.SystemLog.create({
                        level: 'info',
                        message: `[BF2026_SENT] wave:${item.wave} | variant:${item.variant} | psi:${item.psi.id}`,
                        meta: { psychologistId: item.psi.id, email: item.psi.email, wave: item.wave, variant: item.variant }
                    }).catch(() => {});
                }
                sentCount++;
                // Pequeno intervalo para preservar reputação SMTP
                await new Promise((r) => setTimeout(r, 350));
            } catch (err) {
                console.error(`❌ Falha ao enviar para psi ${item.psi.id} (${item.psi.email}):`, err.message);
            }
        }

        console.log(`✅ Onda ${waveFilter} finalizada: ${sentCount}/${batch.length} e-mails enviados.`);
        process.exit(0);
    } catch (error) {
        console.error('🔥 Erro no script de Black Friday:', error);
        process.exit(1);
    }
}

run();

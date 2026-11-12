// backend/scripts/sendBlackFridayCampaign.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const db = require('../models');
const emailService = require('../services/emailService');
const promoCouponService = require('../services/promoCouponService');
const blackFridayGrowthService = require('../services/blackFridayGrowthService');

/**
 * Script de Campanha Black Friday (2 meses por R$ 99 vinculados ao e-mail, sem cupom) + Escala Inteligente de Tráfego.
 *
 * Modos de uso:
 *   1) Preview atualizado (sem cupom) para o fundador:
 *      node backend/scripts/sendBlackFridayCampaign.js --preview-email=andehrson@gmail.com
 *
 *   2) Simulação do motor adaptativo (lê base + Google Ads, calcula tamanho de lote & teto R$ 200 sem mutar nada):
 *      node backend/scripts/sendBlackFridayCampaign.js --auto-step --dry-run
 *
 *   3) Simulação da fila completa segmentada:
 *      node backend/scripts/sendBlackFridayCampaign.js --dry-run
 *
 *   4) Execução real do motor adaptativo (libera convites por e-mail + envia micro-lote + ajusta Google Ads se justificável):
 *      node backend/scripts/sendBlackFridayCampaign.js --auto-step --send --apply-ads-budget --pause-meta
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

async function sendPreviewBatch(targetEmail) {
    console.log(`📧 Enviando 4 e-mails de preview (sem cupom — vinculados ao e-mail) para: ${targetEmail}...`);

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
            deadlineLabel: '30/11'
        });
        console.log(`   ✅ Enviado: ${c.prefix}`);
    }
    console.log('🏁 Todos os 4 previews atualizados (sem cupom) foram enviados com sucesso!');
}

async function run() {
    const args = parseArgs(process.argv);

    try {
        if (args['preview-email']) {
            await sendPreviewBatch(String(args['preview-email']).trim());
            process.exit(0);
        }

        if (args['auto-step']) {
            const isLiveRun = Boolean(args.send && !args['dry-run']);
            const res = await blackFridayGrowthService.runAdaptiveStep({
                dryRun: !isLiveRun,
                applyGoogleBudget: Boolean(args['apply-ads-budget']),
                sendEmails: Boolean(args.send || args['dry-run']),
                pauseMetaAds: Boolean(args['pause-meta']),
                limit: args.limit ? Number(args.limit) : null
            });

            console.log('\n📊 Snapshot de Demanda & Capacidade (Orgânico + Google Ads):');
            console.table([res.snapshot]);
            console.log('\n🧠 Métricas Calculadas:');
            console.table([res.decision.metrics]);
            console.log('\n📈 Decisão Google Ads (Máx R$ 200/dia se justificável):');
            console.log(JSON.stringify(res.decision.googleAdsDecision, null, 2));
            console.log('\n📬 Decisão Disparo Adaptativo de E-mails:');
            console.log(JSON.stringify(res.decision.emailDecision, null, 2));
            console.log(`\n👥 Lote planejado (${res.plannedBatchPreview.length} perfis):`);
            if (res.plannedBatchPreview.length > 0) {
                console.table(res.plannedBatchPreview.slice(0, 15));
            }
            console.log('\n⚙️ Actions Log:');
            console.log(JSON.stringify(res.actionsLog, null, 2));
            process.exit(0);
        }

        const waveFilter = args.wave ? Number(args.wave) : null;
        const limit = args.limit ? Number(args.limit) : 20;
        const { queue: candidates } = await blackFridayGrowthService.getOrderedEligibleRecipients(db, { waveFilter });

        const summary = {
            wave1_ex_payer: candidates.filter((c) => c.waveKey === 'wave1_ex_payer').length,
            wave1_trial_hot_2plus: candidates.filter((c) => c.waveKey === 'wave1_trial_hot_2plus').length,
            wave2_trial_warm_1click: candidates.filter((c) => c.waveKey === 'wave2_trial_warm_1click').length,
            wave3_trial_cold_ready: candidates.filter((c) => c.waveKey === 'wave3_trial_cold_ready').length,
            total_eligible: candidates.length
        };

        console.log('📊 Resumo de Elegíveis (Black Friday 2026 - Vinculado ao E-mail, Sem Cupom):');
        console.table([summary]);

        if (!args.send || args['dry-run']) {
            console.log('ℹ️ Modo simulação (--dry-run). Nenhum e-mail real foi enviado nem oferta liberada.');
            process.exit(0);
        }

        if (!waveFilter || ![1, 2, 3, 4].includes(waveFilter)) {
            console.error('❌ Para disparar por onda manual, informe --wave=1|2|3|4 junto com --send (ou use --auto-step).');
            process.exit(1);
        }

        const batch = candidates.slice(0, limit);
        console.log(`🚀 Iniciando envio da Onda ${waveFilter} para ${batch.length} psicólogos...`);

        let sentCount = 0;
        for (const item of batch) {
            try {
                await promoCouponService.grantBlackFridayOffer(item.psi, {
                    db,
                    wave: `wave:${item.wave}`
                });
                await emailService.sendBlackFridayEmail(item.psi, item.variant, {
                    deadlineLabel: '30/11'
                });
                if (db.SystemLog) {
                    const emailLower = promoCouponService.normalizeEmail(item.psi.email);
                    await db.SystemLog.create({
                        level: 'info',
                        message: `[BF2026_SENT] wave:${item.wave} | variant:${item.variant} | psi:${item.psi.id} | email:${emailLower}`,
                        meta: { psychologistId: item.psi.id, email: emailLower, wave: item.wave, variant: item.variant }
                    }).catch(() => {});
                }
                sentCount++;
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

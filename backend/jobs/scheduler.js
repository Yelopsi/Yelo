// backend/cron/scheduler.js

const cron = require('node-cron');
const { findDemandGaps } = require('./demandMonitor');
const { manageExpiredInvitations } = require('./invitationManager');
const { sendPendingSubscriptionEmails } = require('./remarketingCron.js');
const { checkAndSendEvaluationEmails } = require('./evaluationMonitor');
const { simulateBlogLikes } = require('./blogLikesMonitor');
const { executeAutoWithdrawal } = require('./asaasWithdrawalJob'); // ADICIONADO: Saque automático Asaas
const { exec } = require('child_process');
const path = require('path');

console.log('Scheduler iniciado. Aguardando tarefas agendadas...');

/**
 * Tarefa 1: Gerenciar convites expirados.
 * Roda todos os dias à 1h da manhã.
 * A expressão '0 1 * * *' significa: minuto 0, hora 1, todo dia, todo mês, todo dia da semana.
 */
cron.schedule('0 1 * * *', () => {
    console.log('Executando tarefa agendada: manageExpiredInvitations');
    manageExpiredInvitations();
}, {
    scheduled: true,
    timezone: "America/Sao_Paulo"
});

/**
 * Tarefa 2: Verificar gaps de demanda e enviar convites.
 * Roda todos os dias às 2h da manhã.
 */
cron.schedule('0 2 * * *', () => {
    console.log('Executando tarefa agendada: findDemandGaps');
    findDemandGaps();
}, {
    scheduled: true,
    timezone: "America/Sao_Paulo"
});

/**
 * Tarefa 3: Disparar e-mails de remarketing para psicólogos que não assinaram.
 * Roda todos os dias às 10h da manhã.
 */
cron.schedule('0 10 * * *', () => {
    console.log('Executando tarefa agendada: sendPendingSubscriptionEmails');
    sendPendingSubscriptionEmails();
}, {
    scheduled: true,
    timezone: "America/Sao_Paulo"
});

/**
 * Tarefa 4: Realizar Saque Automático Pix via Asaas
 * Roda todos os dias às 08h da manhã.
 */
cron.schedule('0 8 * * *', () => {
    console.log('Executando tarefa agendada: executeAutoWithdrawal (Asaas Pix)');
    executeAutoWithdrawal();
}, {
    scheduled: true,
    timezone: "America/Sao_Paulo"
});

/**
 * Tarefa 5: Enviar e-mail de avaliação para psicólogos com trial ou plano expirado
 * Roda todos os dias às 11h da manhã.
 */
cron.schedule('0 11 * * *', () => {
    // Tarefa 5 desativada: não enviar mais e-mail de avaliação pós-expiração
    console.log('Tarefa agendada checkAndSendEvaluationEmails desativada.');
}, {
    scheduled: false,
    timezone: "America/Sao_Paulo"
});

/**
 * Tarefa 6: Simular curtidas orgânicas nos posts do blog.
 * Roda todos os dias às 03h da manhã.
 */
cron.schedule('0 3 * * *', () => {
    console.log('Executando tarefa agendada: simulateBlogLikes');
    simulateBlogLikes();
}, {
    scheduled: true,
    timezone: "America/Sao_Paulo"
});

/**
 * Tarefa 4: Bot de Prospecção Ativa (Scraper)
 * Roda todos os dias às 4h da manhã.
 */
cron.schedule('0 4 * * *', () => {
    console.log('Executando tarefa agendada: Bot de Scraping (Outbound)');
    const scriptPath = path.join(__dirname, '../scripts', 'scraper.js');
    
    // Executa o script em um processo isolado para não afetar o banco principal
    const { spawn } = require('child_process');
    const child = spawn('node', [scriptPath]);

    child.stdout.on('data', (data) => {
        console.log(`[CRON SCRAPER] ${data}`);
    });

    child.stderr.on('data', (data) => {
        console.error(`[CRON SCRAPER ERROR] ${data}`);
    });

    child.on('close', (code) => {
        console.log(`[CRON SCRAPER] Processo finalizado com código ${code}`);
    });
}, {
    scheduled: true,
    timezone: "America/Sao_Paulo"
});

/**
 * Tarefa 8: Gestão Inteligente de Tráfego Pago & Campanha Black Friday
 * - Pausa a escala automática antiga do Meta Ads B2B (substituída por recuperação orgânica + Google Ads proporcional)
 * - Executa o balanceador adaptativo (Google Ads até R$ 200/dia se justificável + micro-lotes de e-mails por adesão/capacidade)
 *   quando ENABLE_BLACK_FRIDAY_AUTO=true.
 * - Mantém alerta de Reavaliação Estratégica em 24/11/2026.
 */
async function checkAndExecuteTrafficScalingJobs() {
    try {
        const db = require('../models');
        const metaAdsService = require('../services/metaAdsService');
        const blackFridayGrowthService = require('../services/blackFridayGrowthService');
        const now = new Date();
        const brtDateStr = now.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }); // YYYY-MM-DD

        console.log(`[CRON TRAFFIC] Verificando rotinas de tráfego pago para data: ${brtDateStr}...`);

        const isProdRuntime = process.env.NODE_ENV === 'production';
        const isMetaPauseEnabled = process.env.AUTO_PAUSE_META_ADS === 'true' || (isProdRuntime && process.env.AUTO_PAUSE_META_ADS !== 'false');
        const isBlackFridayAutoEnabled = process.env.ENABLE_BLACK_FRIDAY_AUTO === 'true' || (isProdRuntime && process.env.ENABLE_BLACK_FRIDAY_AUTO !== 'false');

        // 1. Pausa da campanha Meta Ads B2B (Degraus 2 e 3 desativados permanentemente)
        const existingMetaPause = await db.AdminAdjustment.findOne({
            where: { title: { [db.Sequelize.Op.like]: '%[Meta Ads] Campanha B2B Pausada%' } }
        }).catch(() => null);

        if (!existingMetaPause && isMetaPauseEnabled) {
            const pauseRes = await metaAdsService.pauseCampaign(null, { dryRun: false });
            if (pauseRes.success) {
                await db.AdminAdjustment.create({
                    title: '[Meta Ads] Campanha B2B Pausada (Foco Black Friday + Google Ads)',
                    target_page: 'admin_cmo_metrics.html',
                    file_path: 'backend/services/metaAdsService.js',
                    category: 'Marketing & Growth',
                    environment: 'admin',
                    device: 'todos',
                    priority: 'media',
                    status: 'concluído',
                    completedAt: new Date(),
                    notes: `Campanha Meta Ads B2B pausada automaticamente via API em ${brtDateStr} conforme estratégia de priorização de Google Ads + recuperação de base.`
                }).catch(() => {});
                console.log('⏸️ [CRON TRAFFIC] Campanha Meta Ads B2B pausada via API.');
            } else {
                await db.AdminAdjustment.create({
                    title: '[Meta Ads] Campanha B2B Pausada (Ação Manual Pendente)',
                    target_page: 'admin_cmo_metrics.html',
                    file_path: 'admin/admin_cmo_metrics.html',
                    category: 'Marketing & Growth',
                    environment: 'admin',
                    device: 'todos',
                    priority: 'alta',
                    status: 'pendente',
                    notes: `Pausar manualmente a campanha B2B no Gerenciador Meta Ads enquanto rodamos Black Friday + Google Ads. (Motivo automático: ${pauseRes.error || pauseRes.message || 'Sem token de escrita'}).`
                }).catch(() => {});
                console.log('⚠️ [CRON TRAFFIC] Meta Ads pause registrado como ação pendente no admin.');
            }
        }

        // 2. Balanceamento Adaptativo Black Friday + Google Ads (em produção fica ativo por padrão; use ENABLE_BLACK_FRIDAY_AUTO=false para desligar)
        if (isBlackFridayAutoEnabled) {
            const bfRunTag = `[BF2026_AUTO_RUN] ${brtDateStr}`;
            const alreadyRanToday = db.SystemLog
                ? await db.SystemLog.findOne({ where: { message: bfRunTag } }).catch(() => null)
                : null;

            if (alreadyRanToday) {
                console.log(`ℹ️ [CRON BF-GROWTH] Ciclo automático de ${brtDateStr} já executado hoje; aguardando próximo dia.`);
            } else {
                const stepResult = await blackFridayGrowthService.runAdaptiveStep({
                    dryRun: false,
                    applyGoogleBudget: true,
                    sendEmails: true,
                    pauseMetaAds: false
                });
                if (db.SystemLog) {
                    await db.SystemLog.create({
                        level: 'info',
                        message: bfRunTag,
                        meta: {
                            date: brtDateStr,
                            googleAdsAction: stepResult.decision.googleAdsDecision.action,
                            recommendedBudgetReais: stepResult.decision.googleAdsDecision.recommendedBudgetReais,
                            emailsDispatchedCount: stepResult.actionsLog.emailsDispatched.length
                        }
                    }).catch(() => {});
                }
                console.log(
                    `🤖 [CRON BF-GROWTH] Google Ads: ${stepResult.decision.googleAdsDecision.action} (R$ ${stepResult.decision.googleAdsDecision.recommendedBudgetReais}/dia) | E-mails enviados: ${stepResult.actionsLog.emailsDispatched.length}`
                );
            }
        }

        // 3. Reavaliação Estratégica: 24/11/2026 (Janela de 14 dias)
        if (brtDateStr >= '2026-11-24') {
            const existingReview = await db.AdminAdjustment.findOne({
                where: { title: { [db.Sequelize.Op.like]: '%Reavaliação Estratégica: Tráfego Pago & Motor V6.1%' } }
            });

            if (!existingReview) {
                await db.AdminAdjustment.create({
                    title: '🎯 Reavaliação Estratégica: Tráfego Pago & Motor V6.1 (14 dias)',
                    target_page: 'admin_cmo_metrics.html',
                    file_path: 'admin/admin_cmo_metrics.html',
                    category: 'Marketing & Growth',
                    environment: 'admin',
                    device: 'todos',
                    priority: 'alta',
                    status: 'pendente',
                    notes: `Janela de 14 dias concluída em ${brtDateStr}. Realizar reavaliação completa no Painel do CMO: 1) Adesão da Black Friday; 2) CPL e eficiência da escala Google Ads (teto R$ 200/dia); 3) Retenção dos assinantes ativos no Motor V6.1 e decisão sobre reativação do Meta Ads.`
                });
                console.log('🎯 [CRON TRAFFIC] Alerta de Reavaliação Estratégica criado no painel admin.');
            }
        }
    } catch (err) {
        console.error('❌ [CRON TRAFFIC] Erro na verificação de tráfego e Black Friday:', err.message);
    }
}

function getBrtTimeHHMM(now = new Date()) {
    return now.toLocaleTimeString('en-GB', {
        timeZone: 'America/Sao_Paulo',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
    });
}

cron.schedule('30 8 * * *', () => {
    console.log('Executando tarefa agendada: checkAndExecuteTrafficScalingJobs');
    checkAndExecuteTrafficScalingJobs();
}, {
    scheduled: true,
    timezone: "America/Sao_Paulo"
});

// Executa verificação inicial após boot apenas na janela diurna (>= 08:30 BRT) para não disparar e-mails de madrugada
setTimeout(() => {
    const brtHHMM = getBrtTimeHHMM();
    if (brtHHMM < '08:30') {
        console.log(`⏸️ [CRON TRAFFIC] Boot às ${brtHHMM} BRT (< 08:30); disparo diário aguardará o cron das 08:30 BRT.`);
        return;
    }
    checkAndExecuteTrafficScalingJobs().catch(e => console.error("Erro no check inicial de tráfego:", e));
}, 10000);

/**
 * Tarefa 9: Mediador IA do Fórum (Assíncrono / Zero Impacto na Latência)
 * Roda a cada 15 minutos revisando novos posts em background (ativo por padrão em produção; use ENABLE_FORUM_MEDIATOR=false para pausar).
 */
cron.schedule('*/15 * * * *', async () => {
    const forumMediatorService = require('../services/forumMediatorService');
    if (!forumMediatorService.isForumMediatorEnabled()) return;
    try {
        const res = await forumMediatorService.runMediatorBatch({ dryRun: false, limit: 10 });
        if (res.evaluatedCount > 0) {
            const acted = res.results.filter(r => r.applied).length;
            console.log(`🛡️ [CRON FORUM-MEDIATOR] Avaliados: ${res.evaluatedCount} | Ações aplicadas: ${acted}`);
        }
    } catch (err) {
        console.error('❌ [CRON FORUM-MEDIATOR] Erro:', err.message);
    }
}, {
    scheduled: true,
    timezone: "America/Sao_Paulo"
});

/**
 * Tarefa 10: Curadoria Automática das Novidades para Psicólogos (psi_novidades.html + Mobile novidades.tsx)
 * Roda toda segunda-feira às 07h30 BRT para publicar o compilado semanal automaticamente.
 */
cron.schedule('30 7 * * 1', async () => {
    try {
        const { autoCuratePsiChangelog } = require('../services/changelogSyncService');
        const res = await autoCuratePsiChangelog({ dryRun: false, maxNewItems: 10 });
        if (res.curatedCount > 0) {
            console.log(`🚀 [CRON NOVIDADES] +${res.curatedCount} melhorias semanais publicadas para psicólogos.`);
        }
    } catch (err) {
        console.error('❌ [CRON NOVIDADES] Erro na curadoria semanal:', err.message);
    }
}, {
    scheduled: true,
    timezone: "America/Sao_Paulo"
});


// --- LÓGICA PARA TESTE MANUAL (EXECUTAR SOB DEMANDA) ---

// Esta função anônima auto-executável permite usar async/await
(async () => {
    // Pega os argumentos passados na linha de comando (ex: --run=demand-monitor)
    const arg = process.argv.find(a => a.startsWith('--run='));

    if (!arg) {
        // Se nenhum argumento for passado, o script apenas agenda as tarefas e encerra.
        return;
    }

    const taskToRun = arg.split('=')[1];

    if (taskToRun === 'demand-monitor') {
        console.log('Executando manualmente: findDemandGaps');
        await findDemandGaps();
    } else if (taskToRun === 'invitation-manager') {
        console.log('Executando manualmente: manageExpiredInvitations');
        await manageExpiredInvitations();
    } else if (taskToRun === 'remarketing') {
        console.log('Executando manualmente: sendPendingSubscriptionEmails');
        await sendPendingSubscriptionEmails();
    } else if (taskToRun === 'evaluation') {
        console.log('Executando manualmente: checkAndSendEvaluationEmails');
        await checkAndSendEvaluationEmails();
    } else if (taskToRun === 'simulate-likes') {
        console.log('Executando manualmente: simulateBlogLikes');
        await simulateBlogLikes();
    }

    process.exit(0); // Encerra o processo após a execução da tarefa manual
})();
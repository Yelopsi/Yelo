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
 * Tarefa 8: Gestão Inteligente de Tráfego Pago & Reavaliação Estratégica (Ciclos de 14 dias)
 * - Revisão de 24/11/2026 concluída: Google Ads fixado no teto disciplinado de R$ 90,00/dia e Motor V6.1 100% blindado para pagantes.
 * - Balanceador da Black Friday desativado por padrão pós-24/11 (só roda se ENABLE_BLACK_FRIDAY_AUTO='true' explícito).
 * - Próxima Reavaliação Estratégica agendada para 08/12/2026 (nova janela de 14 dias).
 */
async function checkAndExecuteTrafficScalingJobs() {
    try {
        const db = require('../models');
        const metaAdsService = require('../services/metaAdsService');
        const googleAdsService = require('../services/googleAdsService');
        const blackFridayGrowthService = require('../services/blackFridayGrowthService');
        const now = new Date();
        const brtDateStr = now.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }); // YYYY-MM-DD

        console.log(`[CRON TRAFFIC] Verificando rotinas de tráfego pago para data: ${brtDateStr}...`);

        // Meta Ads B2B mantido ativo em R$ 24/dia por decisão estratégica (só pausa se AUTO_PAUSE_META_ADS='true' explícito)
        const isMetaPauseEnabled = process.env.AUTO_PAUSE_META_ADS === 'true';
        // Ciclo automático de Black Friday encerrado na revisão de 24/11; só executa se explicitamente forçado via ENABLE_BLACK_FRIDAY_AUTO='true'
        const isBlackFridayAutoEnabled = process.env.ENABLE_BLACK_FRIDAY_AUTO === 'true';

        // 1. Pausa da campanha Meta Ads B2B (somente se flag explícita)
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

        // 2. Trava Pós-Revisão 24/11: Retorno do Google Ads ao teto disciplinado de R$ 90,00/dia
        if (brtDateStr >= '2026-11-24' && !isBlackFridayAutoEnabled) {
            const existingGoogleReset = await db.AdminAdjustment.findOne({
                where: { title: { [db.Sequelize.Op.like]: '%[Google Ads] Teto Reajustado Pós-Revisão 24/11%' } }
            }).catch(() => null);

            if (!existingGoogleReset) {
                const resetRes = await googleAdsService.updateCampaignDailyBudget(90, { minBudgetReais: 90, maxBudgetReais: 200 });
                if (resetRes.success) {
                    await db.AdminAdjustment.create({
                        title: '[Google Ads] Teto Reajustado Pós-Revisão 24/11: R$ 90,00/dia',
                        target_page: 'admin_cmo_metrics.html',
                        file_path: 'backend/services/googleAdsService.js',
                        category: 'Marketing & Growth',
                        environment: 'admin',
                        device: 'todos',
                        priority: 'media',
                        status: 'concluído',
                        completedAt: new Date(),
                        notes: `Orçamento diário do Google Ads retornado de R$ ${resetRes.previousBudgetReais || 115.73}/dia para R$ 90,00/dia em ${brtDateStr} após conclusão da janela de 14 dias e blindagem 100% do Motor V6.1.`
                    }).catch(() => {});
                    console.log('✅ [CRON TRAFFIC] Orçamento Google Ads ajustado para R$ 90,00/dia.');
                }
            }
        }

        // 3. Balanceamento Adaptativo Black Friday + Google Ads (apenas se ENABLE_BLACK_FRIDAY_AUTO=true)
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

        // 4. Próxima Reavaliação Estratégica: 08/12/2026 (Janela de 14 dias pós-24/11)
        if (brtDateStr >= '2026-12-08') {
            const existingReviewDec = await db.AdminAdjustment.findOne({
                where: { title: { [db.Sequelize.Op.like]: '%Reavaliação Estratégica: Tráfego Pago & Motor V6.1 (Ciclo 08/12)%' } }
            });

            if (!existingReviewDec) {
                await db.AdminAdjustment.create({
                    title: '🎯 Reavaliação Estratégica: Tráfego Pago & Motor V6.1 (Ciclo 08/12)',
                    target_page: 'admin_cmo_metrics.html',
                    file_path: 'admin/admin_cmo_metrics.html',
                    category: 'Marketing & Growth',
                    environment: 'admin',
                    device: 'todos',
                    priority: 'alta',
                    status: 'pendente',
                    notes: `Janela de 14 dias (24/11 a 08/12) concluída em ${brtDateStr}. Realizar reavaliação completa no Painel do CMO e no Funil B2C: 1) Impacto do Teto de CPC R$ 5,00 e CPA R$ 22,00 no Google Ads (meta: cair CPC de R$ 7,76 para <= R$ 5,00 e subir volume de cliques/dia com R$ 90/dia); 2) Impacto do botão direto "Chamar no WhatsApp" em /resultados na taxa de Conexão Final (meta: subir de 30,8% para 35-40%); 3) Confirmar 0% de vazamento de cliques pagos para trials no Motor V6.1; 4) Retenção da base pagante e eficiência do Meta Ads (R$ 24/dia).`
                });
                console.log('🎯 [CRON TRAFFIC] Alerta de Reavaliação Estratégica (08/12) criado no painel admin.');
            }
        }

        // 5. Validação da Virada Jan/2027 (Comunidade, 1x/Parcelado & D+7 Cartão): a partir de 02/01/2027
        if (brtDateStr >= '2027-01-02') {
            const existingJan27Verify = await db.AdminAdjustment.findOne({
                where: { title: { [db.Sequelize.Op.like]: '%Validação Virada Jan/2027%' } }
            });

            if (!existingJan27Verify) {
                await db.AdminAdjustment.create({
                    title: '🛡️ Validação Virada Jan/2027: Comunidade, 1x/Parcelado & D+7 Cartão (02/01 a 08/01)',
                    target_page: 'admin_dre.html',
                    file_path: 'backend/jobs/cronScheduler.js',
                    category: 'Financeiro & Produto',
                    environment: 'admin',
                    device: 'todos',
                    priority: 'alta',
                    status: 'pendente',
                    notes: `Virada automática de 01/01/2027 ativada. Conferir entre 02/01 e 08/01 no Asaas de produção e em Payments/DRE: 1) Novos cadastros entrando corretamente no Plano Comunidade (Grátis) sem vazamento no Match; 2) Primeira contratação real 1x ou parcelada (Trimestral/Semestral) tokenizando sem cobrar no D+0 do trial; 3) Primeira conversão automática D+7 via processTokenizedTrials (~08/01) e emissão de NFS-e CNPJ.`
                });
                console.log('🛡️ [CRON TRAFFIC] Alerta de Validação Virada Jan/2027 criado no painel admin.');
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
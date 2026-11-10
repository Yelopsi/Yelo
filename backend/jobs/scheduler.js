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
 * Tarefa 8: Automação da Escala Meta Ads e Reavaliação Estratégica do Tráfego Pago & Motor V6.1
 * - Degrau 2 Meta Ads: 13/11/2026 (R$ 29/dia)
 * - Degrau 3 Meta Ads: 17/11/2026 (R$ 35/dia)
 * - Reavaliação Estratégica: 24/11/2026 (Fim do ciclo de 14 dias)
 * Roda diariamente às 08h30 BRT e no boot.
 */
async function checkAndExecuteTrafficScalingJobs() {
    try {
        const db = require('../models');
        const metaAdsService = require('../services/metaAdsService');
        const now = new Date();
        const brtDateStr = now.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }); // YYYY-MM-DD

        console.log(`[CRON TRAFFIC] Verificando marcos de tráfego pago para data: ${brtDateStr}...`);

        // Degrau 2: 13/11/2026 (R$ 29/dia)
        if (brtDateStr >= '2026-11-13') {
            const existingStep2 = await db.AdminAdjustment.findOne({
                where: { title: { [db.Sequelize.Op.like]: '%[Meta Ads] Degrau 2%' } }
            });

            if (!existingStep2) {
                console.log('[CRON TRAFFIC] Executando Degrau 2 Meta Ads (R$ 29/dia)...');
                const updateRes = await metaAdsService.updateCampaignDailyBudget(29);

                if (updateRes.success) {
                    await db.AdminAdjustment.create({
                        title: '[Meta Ads] Degrau 2 Aplicado: Orçamento R$ 29,00/dia',
                        target_page: 'admin_cmo_metrics.html',
                        file_path: 'backend/services/metaAdsService.js',
                        category: 'Marketing & Growth',
                        environment: 'admin',
                        device: 'todos',
                        priority: 'media',
                        status: 'concluído',
                        completedAt: new Date(),
                        notes: `Orçamento escalado automaticamente para R$ 29,00/dia via API Graph Meta no dia ${brtDateStr}. Degrau 2 de 3 concluído.`
                    });
                    console.log('✅ [CRON TRAFFIC] Degrau 2 Meta Ads aplicado automaticamente com sucesso.');
                } else {
                    await db.AdminAdjustment.create({
                        title: '[Meta Ads] Degrau 2: Ajustar orçamento para R$ 29,00/dia',
                        target_page: 'admin_cmo_metrics.html',
                        file_path: 'admin/admin_cmo_metrics.html',
                        category: 'Marketing & Growth',
                        environment: 'admin',
                        device: 'todos',
                        priority: 'alta',
                        status: 'pendente',
                        notes: `Ajuste manual necessário: Suba o orçamento diário da campanha Meta Ads para R$ 29,00/dia no Gerenciador de Anúncios. (Motivo automático: ${updateRes.error || updateRes.message || 'Sem token de escrita'}).`
                    });
                    console.log('⚠️ [CRON TRAFFIC] Degrau 2 registrado como ação pendente no painel admin.');
                }
            }
        }

        // Degrau 3: 17/11/2026 (R$ 35/dia - Meta Final)
        if (brtDateStr >= '2026-11-17') {
            const existingStep3 = await db.AdminAdjustment.findOne({
                where: { title: { [db.Sequelize.Op.like]: '%[Meta Ads] Degrau 3%' } }
            });

            if (!existingStep3) {
                console.log('[CRON TRAFFIC] Executando Degrau 3 Meta Ads (R$ 35/dia)...');
                const updateRes = await metaAdsService.updateCampaignDailyBudget(35);

                if (updateRes.success) {
                    await db.AdminAdjustment.create({
                        title: '[Meta Ads] Degrau 3 Aplicado: Orçamento R$ 35,00/dia (Meta Final)',
                        target_page: 'admin_cmo_metrics.html',
                        file_path: 'backend/services/metaAdsService.js',
                        category: 'Marketing & Growth',
                        environment: 'admin',
                        device: 'todos',
                        priority: 'media',
                        status: 'concluído',
                        completedAt: new Date(),
                        notes: `Orçamento escalado automaticamente para R$ 35,00/dia via API Graph Meta no dia ${brtDateStr}. Degrau final de escala Meta Ads atingido.`
                    });
                    console.log('✅ [CRON TRAFFIC] Degrau 3 Meta Ads aplicado automaticamente com sucesso.');
                } else {
                    await db.AdminAdjustment.create({
                        title: '[Meta Ads] Degrau 3: Ajustar orçamento para R$ 35,00/dia (Meta Final)',
                        target_page: 'admin_cmo_metrics.html',
                        file_path: 'admin/admin_cmo_metrics.html',
                        category: 'Marketing & Growth',
                        environment: 'admin',
                        device: 'todos',
                        priority: 'alta',
                        status: 'pendente',
                        notes: `Ajuste manual necessário: Suba o orçamento diário da campanha Meta Ads para R$ 35,00/dia no Gerenciador de Anúncios. (Motivo automático: ${updateRes.error || updateRes.message || 'Sem token de escrita'}).`
                    });
                    console.log('⚠️ [CRON TRAFFIC] Degrau 3 registrado como ação pendente no painel admin.');
                }
            }
        }

        // Reavaliação Estratégica: 24/11/2026 (Janela de 14 dias)
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
                    notes: `Janela de 14 dias concluída em ${brtDateStr}. Realizar reavaliação completa no Painel do CMO: 1) CAC B2B e conversão de psicólogos no Meta Ads (R$ 35/dia); 2) CPL e conversões do Google Ads (R$ 90/dia); 3) Retenção e satisfação dos assinantes pagantes que receberam 100% dos cliques do Google Ads via Motor V6.1.`
                });
                console.log('🎯 [CRON TRAFFIC] Alerta de Reavaliação Estratégica criado no painel admin.');
            }
        }
    } catch (err) {
        console.error('❌ [CRON TRAFFIC] Erro na verificação de escala de tráfego:', err.message);
    }
}

cron.schedule('30 8 * * *', () => {
    console.log('Executando tarefa agendada: checkAndExecuteTrafficScalingJobs');
    checkAndExecuteTrafficScalingJobs();
}, {
    scheduled: true,
    timezone: "America/Sao_Paulo"
});

// Executa verificação inicial após boot
setTimeout(() => {
    checkAndExecuteTrafficScalingJobs().catch(e => console.error("Erro no check inicial de tráfego:", e));
}, 10000);


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
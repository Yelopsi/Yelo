// backend/cron/scheduler.js

const cron = require('node-cron');
const { findDemandGaps } = require('./demandMonitor');
const { manageExpiredInvitations } = require('./invitationManager');
const { sendPendingSubscriptionEmails } = require('./remarketingCron.js');
const { checkAndSendEvaluationEmails } = require('./evaluationMonitor');
const { simulateBlogLikes } = require('./blogLikesMonitor');
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
 * Tarefa 5: Enviar e-mail de avaliação para psicólogos com trial ou plano expirado
 * Roda todos os dias às 11h da manhã.
 */
cron.schedule('0 11 * * *', () => {
    console.log('Executando tarefa agendada: checkAndSendEvaluationEmails');
    checkAndSendEvaluationEmails();
}, {
    scheduled: true,
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
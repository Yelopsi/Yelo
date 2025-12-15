// backend/cron/scheduler.js

const cron = require('node-cron');
const { findDemandGaps } = require('../demandMonitor');
const { manageExpiredInvitations } = require('../invitationManager');

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
    }

    process.exit(0); // Encerra o processo após a execução da tarefa manual
})();
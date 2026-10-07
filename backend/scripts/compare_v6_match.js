const db = require('../models');

(async () => {
    console.log("===========================================");
    console.log("📊 ANÁLISE DE IMPACTO: MOTOR DE MATCH V6");
    console.log("===========================================\n");

    try {
        // A data de deploy do V6
        const v6DeployDate = new Date('2026-10-06T21:40:00.000Z');
        
        // Período 1: X dias ANTES do deploy
        // Período 2: X dias DEPOIS do deploy
        const now = new Date();
        const daysSinceDeploy = Math.max(1, Math.floor((now - v6DeployDate) / (1000 * 60 * 60 * 24)));
        
        const beforeStartDate = new Date(v6DeployDate);
        beforeStartDate.setDate(beforeStartDate.getDate() - daysSinceDeploy);

        console.log(`Comparando os últimos ${daysSinceDeploy} dias (Após V6) vs ${daysSinceDeploy} dias iguais (Antes do V6).`);
        console.log(`- Antes do V6: ${beforeStartDate.toISOString().split('T')[0]} até ${v6DeployDate.toISOString().split('T')[0]}`);
        console.log(`- Depois do V6: ${v6DeployDate.toISOString().split('T')[0]} até Hoje\n`);

        // Busca psicólogos que estavam ativos nos dois períodos (simplificação: ativos e trial atuais)
        const psys = await db.Psychologist.findAll({
            where: {
                status: ['active', 'trial'],
                deletedAt: null
            },
            attributes: ['id', 'nome', 'status']
        });

        const stats = {
            before: { totalLeads: 0, starvingCount: 0, leadsPerPsy: [] },
            after: { totalLeads: 0, starvingCount: 0, leadsPerPsy: [] }
        };

        // Query genérica para contar leads por psicólogo em um período
        const getLeadsInPeriod = async (startDate, endDate) => {
            const logs = await db.sequelize.query(`
                SELECT 
                    "psychologistId", 
                    COUNT(*) as total_clicks,
                    SUM(CASE WHEN "contactReceived" = false OR "dealClosed" IN ('no_contact', 'ghosted', 'wpp_issue') THEN 1 ELSE 0 END) as invalid_clicks
                FROM "WhatsAppClickLogs" 
                WHERE "createdAt" >= :startDate AND "createdAt" < :endDate
                GROUP BY "psychologistId"
            `, { replacements: { startDate, endDate }, type: db.sequelize.QueryTypes.SELECT });

            const map = {};
            logs.forEach(l => {
                map[l.psychologistId] = parseInt(l.total_clicks) - parseInt(l.invalid_clicks || 0);
            });
            return map;
        };

        const leadsBefore = await getLeadsInPeriod(beforeStartDate, v6DeployDate);
        const leadsAfter = await getLeadsInPeriod(v6DeployDate, now);

        let tableData = [];

        psys.forEach(p => {
            const lb = leadsBefore[p.id] || 0;
            const la = leadsAfter[p.id] || 0;

            stats.before.totalLeads += lb;
            stats.after.totalLeads += la;

            if (lb === 0) stats.before.starvingCount++;
            if (la === 0) stats.after.starvingCount++;

            stats.before.leadsPerPsy.push({ name: p.nome, leads: lb });
            stats.after.leadsPerPsy.push({ name: p.nome, leads: la });

            if (lb > 0 || la > 0) {
                tableData.push({
                    ID: p.id,
                    Nome: p.nome.substring(0, 20),
                    'Leads ANTES': lb,
                    'Leads DEPOIS': la,
                    'Variação': la - lb
                });
            }
        });

        // Ordena para mostrar quem mais ganhou e quem mais perdeu
        tableData.sort((a, b) => b['Leads DEPOIS'] - a['Leads DEPOIS']);

        console.table(tableData);

        console.log("\n--- RESUMO DA DISTRIBUIÇÃO ---");
        console.log(`Total de Leads Válidos: ${stats.before.totalLeads} (Antes) -> ${stats.after.totalLeads} (Depois)`);
        console.log(`Psicólogos "Esfomeados" (0 leads no período): ${stats.before.starvingCount} (Antes) -> ${stats.after.starvingCount} (Depois)`);

        // Calcula a concentração de leads nos Top 5 profissionais
        const top5Before = stats.before.leadsPerPsy.sort((a, b) => b.leads - a.leads).slice(0, 5).reduce((acc, curr) => acc + curr.leads, 0);
        const top5After = stats.after.leadsPerPsy.sort((a, b) => b.leads - a.leads).slice(0, 5).reduce((acc, curr) => acc + curr.leads, 0);

        const beforeConcentration = stats.before.totalLeads > 0 ? ((top5Before / stats.before.totalLeads) * 100).toFixed(1) : 0;
        const afterConcentration = stats.after.totalLeads > 0 ? ((top5After / stats.after.totalLeads) * 100).toFixed(1) : 0;

        console.log(`Concentração de leads nos Top 5: ${beforeConcentration}% (Antes) -> ${afterConcentration}% (Depois)`);
        
        if (parseFloat(afterConcentration) < parseFloat(beforeConcentration)) {
            console.log("✅ SUCESSO: A distribuição está mais justa. A concentração no topo diminuiu.");
        } else {
            console.log("⚠️ ATENÇÃO: A concentração de leads ainda parece alta. O Capping pode precisar de ajuste.");
        }

    } catch (e) {
        console.error("Erro ao rodar análise:", e);
    } finally {
        await db.sequelize.close();
        process.exit(0);
    }
})();

const { Op } = require('sequelize');
const db = require('./backend/models');

async function testCRM() {
    const totalVisitantes = await db.SiteVisit.sum('visitCount');
    const totalBuscas = await db.DemandSearch.count();
    const totalMatches = await db.MatchEvent.count();
    const totalLeads = await db.WhatsAppClickLog.count();
    const totalAssinaturas = await db.Subscription.count();

    console.log("=== CRM Analytics (getFunnelAnalytics) ===");
    console.log("Visitantes:", totalVisitantes);
    console.log("Buscas:", totalBuscas);
    console.log("Matches:", totalMatches);
    console.log("Leads (Cliques Wpp):", totalLeads);
    console.log("Assinaturas:", totalAssinaturas);
}

async function testGrowth() {
    const mrrAntResult = await db.sequelize.query(`
        SELECT COALESCE(SUM(s.amount), 0) AS mrr
        FROM "Subscriptions" s
        JOIN "Psychologists" p ON s."psychologistId" = p.id
        WHERE s.status = 'active' AND p."is_exempt" != true
    `);
    
    // Funil B2C
    const uniqueVisitors = await db.SiteVisit.count({ distinct: true, col: 'ipAddress' });
    const totalDemandSearches = await db.DemandSearch.count();
    const matchesCount = await db.MatchEvent.count({ where: { status: 'indicated' } });
    const clicksToPsi = await db.WhatsAppClickLog.count();

    console.log("\n=== Growth Dashboard ===");
    console.log("Visitantes Únicos:", uniqueVisitors);
    console.log("Buscas de Demanda:", totalDemandSearches);
    console.log("Matches (Indicados):", matchesCount);
    console.log("Leads (Cliques Wpp):", clicksToPsi);
}

async function run() {
    await testCRM();
    await testGrowth();
    process.exit();
}
run();

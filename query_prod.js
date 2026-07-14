const { Client } = require('pg');

async function run() {
    const client = new Client({
        connectionString: 'postgresql://yelo_db_user:***REMOVED_DB_PASS***@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db',
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        console.log("--- REGINA ---");
        const reginaRes = await client.query("SELECT * FROM \"Psychologists\" WHERE nome ILIKE '%Regina%'");
        if (reginaRes.rows.length > 0) {
            const r = reginaRes.rows[0];
            console.log(`Nome: ${r.nome}`);
            console.log(`Status: ${r.status}`);
            console.log(`Criado: ${r.createdAt}`);
            console.log(`FotoUrl: ${r.fotoUrl ? 'YES' : 'NULL'}`);
            console.log(`Bio: ${r.bio ? (r.bio.length > 0 ? 'YES' : 'EMPTY') : 'NULL'}`);
            console.log(`Telefone: ${r.telefone}`);
            console.log(`StripeSubId: ${r.stripeSubscriptionId}`);
            console.log(`SubId: ${r.subscriptionId}`);
            console.log(`MsgAnalysis: ${r.msg_analysis_sent_at}`);
            console.log(`DeletedAt: ${r.deletedAt}`);
        } else {
            console.log("Regina não encontrada em Psychologists.");
        }

        console.log("\n--- PAULO ---");
        const pauloRes = await client.query("SELECT * FROM \"Psychologists\" WHERE nome ILIKE '%Paulo Cesar%'");
        if (pauloRes.rows.length > 0) {
            const p = pauloRes.rows[0];
            console.log(`Nome: ${p.nome}`);
            console.log(`Status: ${p.status}`);
            console.log(`Criado: ${p.createdAt}`);
            console.log(`FotoUrl: ${p.fotoUrl ? 'YES' : 'NULL'}`);
            console.log(`Bio: ${p.bio ? (p.bio.length > 0 ? 'YES' : 'EMPTY') : 'NULL'}`);
            console.log(`Telefone: ${p.telefone}`);
            console.log(`MsgIncomplete: ${p.msg_incomplete_profile_sent_at}`);
            console.log(`DeletedAt: ${p.deletedAt}`);
        } else {
            console.log("Paulo não encontrado em Psychologists.");
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
run();

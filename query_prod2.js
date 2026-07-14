const { Client } = require('pg');

async function run() {
    const client = new Client({
        connectionString: 'postgresql://yelo_db_user:***REMOVED_DB_PASS***@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db',
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        console.log("--- WAITING LIST REGINA ---");
        const reginaRes = await client.query("SELECT * FROM \"WaitingLists\" WHERE nome ILIKE '%Regina Glaucia%'");
        if (reginaRes.rows.length > 0) {
            console.log(reginaRes.rows);
        } else {
            console.log("Regina não encontrada na lista de espera.");
        }
        
        console.log("\n--- BUSCANDO REGINA EXATA EM PSYCHOLOGISTS ---");
        const reginaRes2 = await client.query("SELECT * FROM \"Psychologists\" WHERE nome ILIKE '%Regina Glaucia%'");
        if (reginaRes2.rows.length > 0) {
            console.log(reginaRes2.rows);
        } else {
            console.log("Regina não encontrada em Psychologists.");
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
run();

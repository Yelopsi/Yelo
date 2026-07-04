const { Client } = require('pg');

async function checkGeovan() {
    const client = new Client({
        connectionString: 'postgresql://yelo_db_user:***REMOVED_DB_PASS***@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db?sslmode=require'
    });

    try {
        await client.connect();
        const res = await client.query(`
            SELECT id, nome, email, "planExpiresAt", "updatedAt", "stripeSubscriptionId"
            FROM "Psychologists"
            WHERE nome ILIKE '%Geovan%'
        `);
        console.log(res.rows);
    } catch(err) {
        console.error("Erro:", err);
    } finally {
        await client.end();
    }
}
checkGeovan();

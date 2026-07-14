const { Client } = require('pg');

async function run() {
    const client = new Client({
        connectionString: 'postgresql://yelo_db_user:***REMOVED_DB_PASS***@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db',
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        const res1 = await client.query("SELECT COUNT(*) FROM \"Psychologists\" WHERE bio NOT IN (NULL, '')");
        console.log(`Count with NOT IN (NULL, ''): ${res1.rows[0].count}`);

        const res2 = await client.query("SELECT COUNT(*) FROM \"Psychologists\" WHERE bio IS NOT NULL AND bio != ''");
        console.log(`Count with IS NOT NULL AND != '': ${res2.rows[0].count}`);

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
run();

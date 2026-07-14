const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://yelo_db_user:***REMOVED_DB_PASS***@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db',
  ssl: { rejectUnauthorized: false }
});
client.connect()
  .then(() => client.query('SELECT id, nome, "subscription_payments_count", "stripeSubscriptionId", "subscriptionId" FROM "Psychologists" WHERE nome IN (\'Natalia Fiuza\', \'Carina De Oliveira Nelis\')'))
  .then(res => { console.log(res.rows); client.end(); })
  .catch(e => { console.error(e); client.end(); });

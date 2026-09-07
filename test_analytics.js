const db = require('./backend/models');
async function run() {
    try {
        await db.sequelize.query(`SELECT AVG(xp) as avgEngagement, (SELECT AVG(rating) FROM "Reviews") as avgRating, (SELECT CAST(COUNT(*) AS FLOAT) / (SELECT COUNT(*) FROM "Psychologists" WHERE status='active') FROM posts) as avgPosts FROM "Psychologists" WHERE status = 'active'`);
        console.log("platformStrength query success");
    } catch(e) {
        console.error("platformStrength query failed:", e.message);
    }
    
    try {
        await db.sequelize.query(`SELECT value as topic, COUNT(*) as count FROM "DemandSearches", jsonb_array_elements_text("searchParams"->'temas') as value WHERE "createdAt" >= NOW() - INTERVAL '30 days' AND jsonb_typeof("searchParams"->'temas') = 'array' GROUP BY value ORDER BY count DESC LIMIT 5;`);
        console.log("topTopics query success");
    } catch(e) {
        console.error("topTopics query failed:", e.message);
    }
}
run().then(() => process.exit(0));

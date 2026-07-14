const db = require('./backend/models');

async function test() {
    try {
        const expIds = [245]; // Karim

        const lowercaseQuery = await db.sequelize.query(`
            SELECT "psychologistId", COUNT(*) as count 
            FROM "MatchEvents" 
            WHERE "psychologistId" IN (:expIds) 
            GROUP BY "psychologistId"
        `, { replacements: { expIds }, type: db.sequelize.QueryTypes.SELECT }).catch(e => {
            console.error("Lowercase failed:", e.message);
            return [];
        });

        const uppercaseQuery = await db.sequelize.query(`
            SELECT "PsychologistId" as "psychologistId", COUNT(*) as count 
            FROM "MatchEvents" 
            WHERE "PsychologistId" IN (:expIds) 
            GROUP BY "PsychologistId"
        `, { replacements: { expIds }, type: db.sequelize.QueryTypes.SELECT }).catch(e => {
            console.error("Uppercase failed:", e.message);
            return [];
        });

        console.log("Lowercase Result:", lowercaseQuery);
        console.log("Uppercase Result:", uppercaseQuery);

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

test();

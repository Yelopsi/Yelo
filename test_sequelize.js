const { Sequelize, QueryTypes } = require('sequelize');

const sequelize = new Sequelize('postgresql://yelo_db_user:***REMOVED_DB_PASS***@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db', {
    dialect: 'postgres',
    dialectOptions: {
        ssl: { require: true, rejectUnauthorized: false }
    },
    logging: console.log
});

async function test() {
    try {
        const churnIds = [246];
        const matchEventsCount = await sequelize.query(`
            SELECT "psychologistId", COUNT(*) as count 
            FROM "MatchEvents" 
            WHERE "psychologistId" IN (:churnIds) 
            GROUP BY "psychologistId"
        `, { replacements: { churnIds }, type: QueryTypes.SELECT }).catch(e => {
            console.error("Lowercase query failed:", e.message);
            return [];
        });
        
        console.log("Lowercase result:", matchEventsCount);

        const uppercaseCount = await sequelize.query(`
            SELECT "PsychologistId", COUNT(*) as count 
            FROM "MatchEvents" 
            WHERE "PsychologistId" IN (:churnIds) 
            GROUP BY "PsychologistId"
        `, { replacements: { churnIds }, type: QueryTypes.SELECT }).catch(e => {
            console.error("Uppercase query failed:", e.message);
            return [];
        });

        console.log("Uppercase result:", uppercaseCount);
    } catch (e) {
        console.error(e);
    } finally {
        await sequelize.close();
        process.exit();
    }
}

test();

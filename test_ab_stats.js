const db = require('./backend/models');
async function run() {
    const stats = await db.WhatsAppClickLog.findAll({
        attributes: [
            'ab_variant',
            'feedbackGiven',
            'contactReceived',
            'dealClosed',
            [db.Sequelize.fn('COUNT', db.Sequelize.col('id')), 'count']
        ],
        group: ['ab_variant', 'feedbackGiven', 'contactReceived', 'dealClosed'],
        raw: true
    });
    console.log(stats);
    process.exit();
}
run();

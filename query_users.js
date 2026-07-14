const { Sequelize, Op } = require('sequelize');
const db = require('./backend/models');

async function run() {
    try {
        console.log("--- REGINA GLAUCIA ---");
        const regina = await db.Psychologist.findOne({
            where: { nome: { [Op.iLike]: '%Regina Glaucia%' } },
            raw: true
        });
        if (regina) {
            console.log(regina);
            console.log(`\nCheck analysis conditions:
            - createdAt (<= 6h ago): ${regina.createdAt}
            - fotoUrl: ${regina.fotoUrl ? 'YES' : 'NULL'}
            - bio: ${regina.bio ? 'YES' : 'NULL'}
            - status: ${regina.status}
            - stripeSubscriptionId: ${regina.stripeSubscriptionId}
            - subscriptionId: ${regina.subscriptionId}
            - msg_analysis_sent_at: ${regina.msg_analysis_sent_at}
            - deletedAt: ${regina.deletedAt}
            - telefone: ${regina.telefone}
            `);
        } else {
            console.log("Regina não encontrada.");
        }

        console.log("--- PAULO CESAR ---");
        const paulo = await db.Psychologist.findOne({
            where: { nome: { [Op.iLike]: '%Paulo Cesar%' } },
            raw: true
        });
        if (paulo) {
            console.log(paulo);
            console.log(`\nCheck incomplete conditions:
            - createdAt (<= 24h ago): ${paulo.createdAt}
            - status: ${paulo.status}
            - fotoUrl: ${paulo.fotoUrl ? 'YES' : 'NULL'}
            - bio: ${paulo.bio ? 'YES' : 'NULL'}
            - msg_incomplete_profile_sent_at: ${paulo.msg_incomplete_profile_sent_at}
            - deletedAt: ${paulo.deletedAt}
            - telefone: ${paulo.telefone}
            `);
        } else {
            console.log("Paulo não encontrado.");
        }
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();

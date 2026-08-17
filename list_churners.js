const { Sequelize, DataTypes, Op } = require('sequelize');

const sequelize = new Sequelize('postgresql://yelopsi_db_user:y0HIi5A7onT11TSfSrpSTaLvsp3lEdl3@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db?ssl=true', {
  logging: false,
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
});

const Psychologist = sequelize.define('Psychologist', {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    nome: DataTypes.STRING,
    email: DataTypes.STRING,
    status: DataTypes.STRING,
    is_exempt: DataTypes.BOOLEAN,
    plano: DataTypes.STRING,
    subscriptionId: DataTypes.STRING,
    subscription_payments_count: DataTypes.INTEGER,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
    deletedAt: DataTypes.DATE
}, { tableName: 'Psychologists', timestamps: true, paranoid: false });

async function run() {
    try {
        const churners = await Psychologist.findAll({
            where: {
                is_exempt: { [Op.or]: [false, null] },
                [Op.or]: [
                    { subscriptionId: { [Op.not]: null } },
                    { subscription_payments_count: { [Op.gt]: 0 } }
                ],
                status: 'inactive'
                // Not filtering by date so we see ALL historical churners
            },
            raw: true,
            order: [['updatedAt', 'DESC']]
        });
        
        console.log(`Encontrados ${churners.length} cancelamentos históricos de pagantes:`);
        churners.forEach((c, idx) => {
            const dataChurn = c.deletedAt ? c.deletedAt.toISOString().split('T')[0] : c.updatedAt.toISOString().split('T')[0];
            const hasSub = c.subscriptionId ? 'Sim' : 'Não';
            console.log(`${idx+1}. ID: ${c.id} | Nome: ${c.nome} | Data de Churn: ${dataChurn} | Deletou a conta? ${c.deletedAt ? 'Sim' : 'Não'} | Tinha Sub ID? ${hasSub} | Pagamentos: ${c.subscription_payments_count || 0}`);
        });
        
    } catch (e) {
        console.error(e);
    } finally {
        await sequelize.close();
    }
}
run();

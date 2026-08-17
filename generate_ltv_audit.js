const { Sequelize, DataTypes, Op } = require('sequelize');

const sequelize = new Sequelize('postgresql://yelopsi_db_user:y0HIi5A7onT11TSfSrpSTaLvsp3lEdl3@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db?ssl=true', { logging: false, dialectOptions: { ssl: { require: true, rejectUnauthorized: false } } });

const Psychologist = sequelize.define('Psychologist', {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    nome: DataTypes.STRING,
    status: DataTypes.STRING,
    is_exempt: DataTypes.BOOLEAN,
    plano: DataTypes.STRING,
    subscriptionId: DataTypes.STRING,
    subscription_payments_count: DataTypes.INTEGER,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
    planExpiresAt: DataTypes.DATE
}, { tableName: 'Psychologists', timestamps: false, paranoid: false });

async function run() {
    try {
        // PERÍODO DA AUDITORIA: "Histórico Completo" (Desde a fundação) para garantir que tudo seja pego
        const periodStart = new Date('2024-01-01T00:00:00Z');
        const periodEnd = new Date('2026-12-31T23:59:59Z');
        
        console.log("=== INICIO AUDITORIA ===");
        
        // 1. ATIVOS PAGANTES
        const activeUsers = await Psychologist.findAll({
            where: {
                status: 'active',
                is_exempt: { [Op.or]: [false, null] },
                plano: { [Op.ne]: null },
                [Op.or]: [
                    { subscriptionId: { [Op.not]: null } },
                    { subscription_payments_count: { [Op.gt]: 0 } }
                ]
            },
            raw: true
        });
        
        // 2. NOVOS PAGANTES (no período)
        const novosPagantes = await Psychologist.findAll({
            where: {
                is_exempt: { [Op.or]: [false, null] },
                status: 'active',
                [Op.or]: [
                    { subscriptionId: { [Op.not]: null } },
                    { subscription_payments_count: { [Op.gt]: 0 } }
                ],
                createdAt: { [Op.between]: [periodStart, periodEnd] }
            },
            raw: true
        });

        // 3. CHURN PAGANTE (no período)
        const churnedUsers = await Psychologist.findAll({
            where: {
                is_exempt: { [Op.or]: [false, null] },
                status: 'inactive',
                [Op.or]: [
                    { subscriptionId: { [Op.not]: null } },
                    { subscription_payments_count: { [Op.gt]: 0 } }
                ],
                updatedAt: { [Op.between]: [periodStart, periodEnd] }
            },
            raw: true
        });

        // 4. PREÇOS (Hardcoded conforme o código do backend)
        const planPrices = { 'essencial': 99.00, 'essential': 99.00, 'clínico': 159.00, 'clinical': 159.00, 'sol': 259.00, 'reference': 259.00 };

        let mrrTotal = 0;
        const activeList = activeUsers.map(u => {
            const pk = (u.plano || '').toLowerCase();
            const price = planPrices[pk] || 0;
            mrrTotal += price;
            return { id: u.id, nome: u.nome, plano: u.plano, valor: price };
        });

        const churnList = churnedUsers.map(u => {
            return { id: u.id, nome: u.nome, churnDate: new Date(u.updatedAt).toISOString().split('T')[0] };
        });

        const activeCount = activeUsers.length;
        const novosCount = novosPagantes.length;
        const churnCount = churnedUsers.length;
        
        let c_inicio = activeCount + churnCount - novosCount;
        if (c_inicio < 0) c_inicio = 0;
        
        const churnRateReal = c_inicio > 0 ? (churnCount / c_inicio) : (churnCount > 0 ? 1 : 0);
        
        const arpu = activeCount > 0 ? (mrrTotal / activeCount) : 0;
        const ticketMedio = arpu > 0 ? arpu : 99.00;
        
        const lifetime = churnRateReal > 0 ? (1 / churnRateReal) : 60;
        const ltv = ticketMedio * lifetime;
        
        const report = {
            period: "2024-01-01 a Hoje",
            activeCount,
            novosCount,
            churnCount,
            mrrTotal,
            c_inicio,
            churnRateReal,
            arpu,
            ticketMedio,
            lifetime,
            ltv,
            activeList,
            churnList
        };
        
        console.log(JSON.stringify(report, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await sequelize.close();
    }
}
run();

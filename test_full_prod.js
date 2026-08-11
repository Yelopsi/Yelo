const { Sequelize, DataTypes, Op } = require('sequelize');

const sequelize = new Sequelize('postgresql://yelo_db_user:***REMOVED_DB_PASS***@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db', {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false
        }
    }
});

const db = {
    sequelize,
    Sequelize,
    Psychologist: sequelize.define('Psychologist', {
        status: DataTypes.STRING,
        is_exempt: DataTypes.BOOLEAN,
        valor_mensal_numero: DataTypes.FLOAT,
        plano: DataTypes.STRING,
        planExpiresAt: DataTypes.DATE,
        cancelAtPeriodEnd: DataTypes.BOOLEAN,
        stripeSubscriptionId: DataTypes.STRING,
        subscriptionId: DataTypes.STRING,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
        deletedAt: DataTypes.DATE
    }, { paranoid: true, timestamps: true }),
    WhatsAppClickLog: sequelize.define('WhatsAppClickLog', {
        psychologistId: DataTypes.INTEGER,
        createdAt: DataTypes.DATE
    }),
    YeloExpense: sequelize.define('YeloExpense', {
        name: DataTypes.STRING,
        amount: DataTypes.DECIMAL,
        monthYear: DataTypes.STRING,
        category: DataTypes.STRING,
        createdAt: DataTypes.DATE
    }),
    SystemSetting: sequelize.define('SystemSetting', {
        price_Essencial: DataTypes.DECIMAL,
        price_Clínico: DataTypes.DECIMAL,
        price_sol: DataTypes.DECIMAL
    })
};

// Mock require cache to inject our prod DB object
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
    if (id.endsWith('../models') || id.endsWith('./models') || id === '../../models') {
        return db;
    }
    return originalRequire.apply(this, arguments);
};

const growthService = require('./backend/services/growthService');
const growthMarketingService = require('./backend/services/growthMarketingService');
const growthDemandService = require('./backend/services/growthDemandService');
const growthAcquisitionService = require('./backend/services/growthAcquisitionService');

async function testFull() {
    try {
        await sequelize.authenticate();
        console.log('Connected to PROD DB!');

        console.log('Running growthService.getOverview(30)...');
        const overview = await growthService.getOverview(30);
        console.log('Overview success:', overview);

        console.log('Running growthMarketingService.getUnitEconomics(30)...');
        const marketing = await growthMarketingService.getUnitEconomics(30);
        console.log('Marketing success:', marketing);

        console.log('Running growthDemandService.getDemandMetrics(30)...');
        const demand = await growthDemandService.getDemandMetrics(30);
        console.log('Demand success:', demand);
        
        console.log('Running growthAcquisitionService.getFunnel(30)...');
        const funnel = await growthAcquisitionService.getFunnel(30);
        console.log('Funnel success:', funnel);

    } catch (e) {
        console.error('ERROR:', e.stack);
    } finally {
        process.exit(0);
    }
}

testFull();

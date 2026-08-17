require('dotenv').config({ path: '/Users/andehrson/Yelo/.env' });
const { Sequelize, DataTypes, Op } = require('sequelize');

const ASAAS_API_URL = (process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/v3').trim().replace(/\/+$/, '');
const ASAAS_API_KEY = process.env.ASAAS_API_KEY ? process.env.ASAAS_API_KEY.trim() : '';

const sequelize = new Sequelize('postgresql://yelopsi_db_user:y0HIi5A7onT11TSfSrpSTaLvsp3lEdl3@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db?ssl=true', {
  logging: false,
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
});

const Psychologist = sequelize.define('Psychologist', {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    nome: DataTypes.STRING,
    status: DataTypes.STRING,
    is_exempt: DataTypes.BOOLEAN,
    plano: DataTypes.STRING,
    subscriptionId: DataTypes.STRING,
    createdAt: DataTypes.DATE,
    deletedAt: DataTypes.DATE,
    customerId: DataTypes.STRING
}, { tableName: 'Psychologists', timestamps: true, paranoid: false });

async function getAsaasPayments() {
    let hasMore = true;
    let offset = 0;
    let limit = 100;
    let payments = [];
    
    while(hasMore) {
        let url = `${ASAAS_API_URL}/payments?limit=${limit}&offset=${offset}`;
        const res = await fetch(url, { headers: { 'access_token': ASAAS_API_KEY } });
        if (!res.ok) break;
        const data = await res.json();
        payments = payments.concat(data.data);
        hasMore = data.hasMore;
        offset += limit;
    }
    return payments;
}

async function run() {
    try {
        console.log("Fetching local DB users since March 2024...");
        const users = await Psychologist.findAll({
            where: { createdAt: { [Op.gte]: new Date('2024-03-01') } },
            raw: true
        });
        
        console.log("Fetching Asaas payments...");
        const payments = await getAsaasPayments();
        console.log(`Found ${payments.length} total payments in Asaas.`);
        
        const paidCustomers = new Set();
        payments.forEach(p => {
            if (p.status === 'RECEIVED' || p.status === 'CONFIRMED') {
                paidCustomers.add(p.customer); // customerId
            }
        });
        
        console.log(`Found ${paidCustomers.size} distinct customers who actually paid in Asaas.`);
        
        console.log("\n--- Analyzing Users who PAID at least once ---");
        const usersWhoPaid = users.filter(u => u.customerId && paidCustomers.has(u.customerId));
        
        let foundAny = false;
        usersWhoPaid.forEach(u => {
            if (u.status !== 'active' || u.deletedAt !== null) {
                console.log(`ID: ${u.id} | Nome: ${u.nome} | Status: ${u.status} | Deletado: ${u.deletedAt ? 'SIM' : 'NAO'} | SubId: ${u.subscriptionId || 'NENHUM'}`);
                foundAny = true;
            }
        });
        
        if (!foundAny) {
            console.log("Nenhum usuário que pagou (segundo o Asaas) está inativo/deletado no banco de dados.");
        }
        
    } catch (e) {
        console.error(e);
    } finally {
        await sequelize.close();
    }
}

run();

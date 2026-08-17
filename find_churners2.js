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
    email: DataTypes.STRING,
    status: DataTypes.STRING,
    is_exempt: DataTypes.BOOLEAN,
    plano: DataTypes.STRING,
    subscriptionId: DataTypes.STRING,
    createdAt: DataTypes.DATE,
    deletedAt: DataTypes.DATE
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

async function getAsaasCustomers() {
    let hasMore = true;
    let offset = 0;
    let limit = 100;
    let customers = [];
    
    while(hasMore) {
        let url = `${ASAAS_API_URL}/customers?limit=${limit}&offset=${offset}`;
        const res = await fetch(url, { headers: { 'access_token': ASAAS_API_KEY } });
        if (!res.ok) break;
        const data = await res.json();
        customers = customers.concat(data.data);
        hasMore = data.hasMore;
        offset += limit;
    }
    return customers;
}

async function run() {
    try {
        console.log("Fetching local DB users since March 2024...");
        const users = await Psychologist.findAll({
            where: { createdAt: { [Op.gte]: new Date('2024-03-01') } },
            raw: true
        });
        
        const payments = await getAsaasPayments();
        console.log(`Found ${payments.length} total payments in Asaas.`);
        
        const paidCustomerIds = new Set();
        payments.forEach(p => {
            if (p.status === 'RECEIVED' || p.status === 'CONFIRMED' || p.status === 'RECEIVED_IN_CASH') {
                paidCustomerIds.add(p.customer);
            }
        });
        
        const asaasCustomers = await getAsaasCustomers();
        const asaasCustomerEmailMap = {}; // email -> id
        const asaasCustomerIdMap = {}; // id -> email
        asaasCustomers.forEach(c => {
            if (c.email) asaasCustomerEmailMap[c.email.toLowerCase()] = c.id;
            asaasCustomerIdMap[c.id] = c.email ? c.email.toLowerCase() : null;
        });
        
        const paidEmails = new Set();
        paidCustomerIds.forEach(id => {
            if (asaasCustomerIdMap[id]) paidEmails.add(asaasCustomerIdMap[id]);
        });
        
        console.log(`Found ${paidEmails.size} distinct customer emails who actually paid in Asaas.`);
        
        console.log("\n--- Analyzing Users who PAID at least once ---");
        const usersWhoPaid = users.filter(u => u.email && paidEmails.has(u.email.toLowerCase()));
        
        let foundAny = false;
        usersWhoPaid.forEach(u => {
            if (u.status !== 'active' || u.deletedAt !== null) {
                console.log(`ID: ${u.id} | Nome: ${u.nome} | Status: ${u.status} | Deletado: ${u.deletedAt ? 'SIM' : 'NAO'} | SubId: ${u.subscriptionId || 'NENHUM'}`);
                foundAny = true;
            }
        });
        
        if (!foundAny) {
            console.log("Nenhum usuário que pagou (segundo o Asaas) está inativo/deletado no banco de dados local.");
        }
        
    } catch (e) {
        console.error(e);
    } finally {
        await sequelize.close();
    }
}

run();

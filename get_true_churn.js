require('dotenv').config({ path: '/Users/andehrson/Yelo/.env' });
const { Sequelize, DataTypes } = require('sequelize');

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
    updatedAt: DataTypes.DATE,
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
        const churners = await Psychologist.findAll({ 
            where: { id: [195, 74, 218, 72, 75, 119] }, 
            raw: true 
        });
        
        const payments = await getAsaasPayments();
        const customers = await getAsaasCustomers();
        
        const emailToCustomerId = {};
        customers.forEach(c => {
            if (c.email) emailToCustomerId[c.email.toLowerCase()] = c.id;
        });
        
        for (const user of churners) {
            const customerId = emailToCustomerId[user.email ? user.email.toLowerCase() : ''];
            if (!customerId) {
                console.log(`ID: ${user.id} | ${user.nome} -> Não encontrado no Asaas pelo email`);
                continue;
            }
            
            // Find payments for this customer
            const userPayments = payments.filter(p => p.customer === customerId && (p.status === 'RECEIVED' || p.status === 'CONFIRMED' || p.status === 'RECEIVED_IN_CASH'));
            
            if (userPayments.length === 0) {
                console.log(`ID: ${user.id} | ${user.nome} -> Zero pagamentos confirmados encontrados`);
                continue;
            }
            
            // Sort by payment date descending
            userPayments.sort((a, b) => new Date(b.paymentDate || b.clientPaymentDate) - new Date(a.paymentDate || a.clientPaymentDate));
            const lastPayment = userPayments[0];
            const lastDate = new Date(lastPayment.paymentDate || lastPayment.clientPaymentDate);
            
            // Add 1 month for expected next payment (churn date)
            const churnDate = new Date(lastDate);
            churnDate.setMonth(churnDate.getMonth() + 1);
            
            console.log(`ID: ${user.id} | ${user.nome}`);
            console.log(`  Último Pagamento Real: ${lastDate.toISOString().split('T')[0]}`);
            console.log(`  Data de Churn Calculada (Pagamento + 1 mês): ${churnDate.toISOString().split('T')[0]}`);
            console.log(`  Data de Churn no BD (updatedAt): ${new Date(user.updatedAt).toISOString().split('T')[0]}`);
            console.log('---');
        }
    } catch (e) {
        console.error(e);
    } finally {
        await sequelize.close();
    }
}

run();

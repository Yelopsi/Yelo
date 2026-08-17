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
    email: DataTypes.STRING,
    subscribedAt: DataTypes.DATE,
    firstPaidAt: DataTypes.DATE,
    canceledAt: DataTypes.DATE,
    lifetimeRevenue: DataTypes.FLOAT,
    status: DataTypes.STRING,
    is_exempt: DataTypes.BOOLEAN
}, { tableName: 'Psychologists', timestamps: false, paranoid: false });

async function getAsaasPayments() {
    let hasMore = true;
    let offset = 0;
    let limit = 100;
    let payments = [];
    while(hasMore) {
        const url = `${ASAAS_API_URL}/payments?limit=${limit}&offset=${offset}`;
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
        const url = `${ASAAS_API_URL}/customers?limit=${limit}&offset=${offset}`;
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
        console.log("Baixando dados do Asaas...");
        const payments = await getAsaasPayments();
        const customers = await getAsaasCustomers();
        
        const emailToCustomerId = {};
        customers.forEach(c => {
            if (c.email) emailToCustomerId[c.email.toLowerCase()] = c.id;
        });

        const users = await Psychologist.findAll();
        
        console.log("Processando usuários...");
        for (const user of users) {
            let updates = {};
            
            // 1. CanceledAt para casos hardcoded
            if (user.id === 74) updates.canceledAt = new Date('2026-04-10T12:00:00Z');
            if (user.id === 72) updates.canceledAt = new Date('2026-04-10T12:00:00Z');
            if (user.id === 75) updates.canceledAt = new Date('2026-04-10T12:00:00Z');
            if (user.id === 119) updates.canceledAt = new Date('2026-05-06T12:00:00Z');
            if (user.id === 195) updates.canceledAt = new Date('2026-06-25T12:00:00Z');
            
            // Thais (218) não recebe canceledAt porque a data é futura. 
            // Se ela está inativa no sistema, deveríamos marcá-la? O usuário disse que NÃO.
            
            // 2. Lifetime Revenue e FirstPaidAt
            const customerId = emailToCustomerId[user.email ? user.email.toLowerCase() : ''];
            
            if (customerId) {
                const userPayments = payments.filter(p => p.customer === customerId && (p.status === 'RECEIVED' || p.status === 'CONFIRMED' || p.status === 'RECEIVED_IN_CASH'));
                
                if (userPayments.length > 0) {
                    // Sum total revenue
                    const totalRevenue = userPayments.reduce((acc, curr) => acc + (curr.value || 0), 0);
                    updates.lifetimeRevenue = totalRevenue;
                    
                    // Find first payment
                    userPayments.sort((a, b) => new Date(a.paymentDate || a.clientPaymentDate) - new Date(b.paymentDate || b.clientPaymentDate));
                    const firstPayment = userPayments[0];
                    updates.firstPaidAt = new Date(firstPayment.paymentDate || firstPayment.clientPaymentDate);
                }
            }
            
            // Se não encontramos primeiro pagamento no asaas, tentamos o subscribedAt
            if (!updates.firstPaidAt && user.subscribedAt) {
                updates.firstPaidAt = user.subscribedAt;
            }
            
            if (Object.keys(updates).length > 0) {
                await user.update(updates);
            }
        }
        console.log("Migração de dados históricos concluída com sucesso!");
    } catch(e) {
        console.error(e);
    } finally {
        await sequelize.close();
    }
}
run();

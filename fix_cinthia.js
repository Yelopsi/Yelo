require('dotenv').config({ path: '/Users/andehrson/Yelo/.env' });
const { Sequelize, DataTypes } = require('sequelize');

const ASAAS_API_URL = (process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/v3').trim().replace(/\/+$/, '');
const ASAAS_API_KEY = process.env.ASAAS_API_KEY ? process.env.ASAAS_API_KEY.trim() : '';

const sequelize = new Sequelize('postgresql://yelopsi_db_user:y0HIi5A7onT11TSfSrpSTaLvsp3lEdl3@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db?ssl=true', { logging: false, dialectOptions: { ssl: { require: true, rejectUnauthorized: false } } });
const Psychologist = sequelize.define('Psychologist', { id: { type: DataTypes.INTEGER, primaryKey: true }, updatedAt: DataTypes.DATE }, { tableName: 'Psychologists', timestamps: false, paranoid: false });

async function run() {
    try {
        const url = `${ASAAS_API_URL}/payments?subscription=sub_n3hgu1a0emafj55k`;
        const res = await fetch(url, { headers: { 'access_token': ASAAS_API_KEY } });
        const data = await res.json();
        
        const payments = data.data.filter(p => p.status === 'RECEIVED' || p.status === 'CONFIRMED');
        if (payments.length > 0) {
            payments.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
            const lastDate = new Date(payments[0].paymentDate);
            const churnDate = new Date(lastDate);
            churnDate.setMonth(churnDate.getMonth() + 1);
            console.log(`Cinthia (119) pagou por último em ${lastDate.toISOString().split('T')[0]}, logo o churn é ${churnDate.toISOString().split('T')[0]}`);
            await Psychologist.update({ updatedAt: churnDate }, { where: { id: 119 } });
            console.log("Banco corrigido para Cinthia!");
        } else {
            console.log("Cinthia (119) nunca pagou a assinatura sub_n3hgu1a0emafj55k (provavelmente cartão recusou). Logo o churn date do BD (06/05) já é a melhor referência.");
        }
    } catch (e) {
        console.error(e);
    } finally {
        await sequelize.close();
    }
}
run();

require('dotenv').config();
const db = require('../backend/models');
const { Op } = require('sequelize');

async function fixLucasExpiration() {
    try {
        console.log("🔍 Buscando psicólogo Lucas Neves Pellegrini...");
        const psi = await db.Psychologist.findOne({ 
            where: { 
                nome: { [Op.iLike]: '%Lucas Neves Pellegrini%' } 
            } 
        });

        if (!psi) {
            console.log("❌ Psicólogo não encontrado. Verifique o nome exato no banco de dados.");
            process.exit(0);
        }

        console.log(`✅ Encontrado: ${psi.nome} (ID: ${psi.id})`);
        console.log(`📅 Data de Vencimento Atual: ${psi.planExpiresAt}`);

        // Alterando para 09/09/2026 
        // Lembre-se que o mês no JS (Date) é 0-indexed, então Setembro é 8.
        // Formato local para 09 de Setembro de 2026 ao meio-dia
        const novaData = new Date(2026, 8, 9, 12, 0, 0); 

        await psi.update({ planExpiresAt: novaData });

        console.log(`🎉 Sucesso! A data de vencimento foi alterada para: ${novaData.toLocaleString('pt-BR')}`);
        process.exit(0);
    } catch (error) {
        console.error("❌ Erro ao atualizar o banco:", error);
        process.exit(1);
    }
}

fixLucasExpiration();

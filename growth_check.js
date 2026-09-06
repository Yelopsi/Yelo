const { Psychologist, Patient, DemandSearch, Lead, Appointment } = require('./backend/models');
const { Op } = require('sequelize');

async function run() {
  try {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    // B2B: Novos Psicólogos
    const novosPsis = await Psychologist.count({
      where: {
        createdAt: { [Op.gte]: thirtyDaysAgo }
      }
    });

    // B2B: Ativos
    const ativos = await Psychologist.count({
      where: {
        status: 'active'
      }
    });

    // B2C: Novos Pacientes (Leads/DemandSearch) nos últimos 30 dias
    const novasDemandas = await DemandSearch.count({
      where: {
        createdAt: { [Op.gte]: thirtyDaysAgo }
      }
    });

    console.log(`Novos Psicólogos (30d): ${novosPsis}`);
    console.log(`Psicólogos Ativos Total: ${ativos}`);
    console.log(`Buscas de Pacientes (30d): ${novasDemandas}`);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();

const db = require('./backend/models');

async function run() {
  try {
    console.log("🔌 Conectando ao banco de dados...");
    const queryInterface = db.sequelize.getQueryInterface();
    const table = 'Psychologists';

    // 1. Adicionar coluna whatsapp_clicks
    try {
      console.log("➕ Criando coluna 'whatsapp_clicks'...");
      await queryInterface.addColumn(table, 'whatsapp_clicks', {
        type: db.Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false
      });
      console.log("✅ Sucesso!");
    } catch (error) {
      console.log("ℹ️ Coluna 'whatsapp_clicks' já existe ou erro:", error.message);
    }

    // 2. Adicionar coluna profile_appearances
    try {
      console.log("➕ Criando coluna 'profile_appearances'...");
      await queryInterface.addColumn(table, 'profile_appearances', {
        type: db.Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false
      });
      console.log("✅ Sucesso!");
    } catch (error) {
      console.log("ℹ️ Coluna 'profile_appearances' já existe ou erro:", error.message);
    }

  } catch (error) {
    console.error("❌ Erro fatal:", error);
  } finally {
    await db.sequelize.close();
  }
}

run();
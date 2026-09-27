'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Alterar a coluna amount para DECIMAL(12,2) para evitar imprecisões do tipo FLOAT
    await queryInterface.sequelize.query(
      'ALTER TABLE "YeloExpenses" ALTER COLUMN "amount" TYPE DECIMAL(12, 2) USING "amount"::numeric;'
    );

    // 2. Adicionar as novas colunas
    await queryInterface.addColumn('YeloExpenses', 'nature', {
      type: Sequelize.ENUM('FIXED', 'VARIABLE', 'UNCLASSIFIED'),
      allowNull: false,
      defaultValue: 'UNCLASSIFIED'
    });

    await queryInterface.addColumn('YeloExpenses', 'purpose', {
      type: Sequelize.ENUM('OPERATION', 'GROWTH', 'UNCLASSIFIED'),
      allowNull: false,
      defaultValue: 'UNCLASSIFIED'
    });

    await queryInterface.addColumn('YeloExpenses', 'provider', {
      type: Sequelize.ENUM('GOOGLE', 'META', 'ASAAS', 'RENDER', 'OPENAI', 'WHATSAPP', 'ACCOUNTING', 'OTHER'),
      allowNull: false,
      defaultValue: 'OTHER'
    });

    await queryInterface.addColumn('YeloExpenses', 'entryMethod', {
      type: Sequelize.ENUM('MANUAL', 'API', 'IMPORT', 'SYSTEM'),
      allowNull: false,
      defaultValue: 'MANUAL'
    });

    // 3. Executar o Backfill Histórico Imutável
    
    // Google Ads
    await queryInterface.sequelize.query(`
      UPDATE "YeloExpenses"
      SET 
        "nature" = 'VARIABLE',
        "purpose" = 'GROWTH',
        "provider" = 'GOOGLE',
        "entryMethod" = 'MANUAL'
      WHERE "category" = 'Google Ads';
    `);

    // Meta Ads
    await queryInterface.sequelize.query(`
      UPDATE "YeloExpenses"
      SET 
        "nature" = 'VARIABLE',
        "purpose" = 'GROWTH',
        "provider" = 'META',
        "entryMethod" = 'MANUAL'
      WHERE "category" = 'Meta Ads';
    `);

    // Nota: Qualquer outro registro automaticamente recebeu 
    // nature=UNCLASSIFIED, purpose=UNCLASSIFIED, provider=OTHER, entryMethod=MANUAL 
    // no ato do addColumn através do defaultValue, preservando o legado sem falsa precisão.
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('YeloExpenses', 'nature');
    await queryInterface.removeColumn('YeloExpenses', 'purpose');
    await queryInterface.removeColumn('YeloExpenses', 'provider');
    await queryInterface.removeColumn('YeloExpenses', 'entryMethod');

    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_YeloExpenses_nature";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_YeloExpenses_purpose";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_YeloExpenses_provider";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_YeloExpenses_entryMethod";');

    await queryInterface.sequelize.query(
      'ALTER TABLE "YeloExpenses" ALTER COLUMN "amount" TYPE FLOAT USING "amount"::double precision;'
    );
  }
};

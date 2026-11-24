'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(`
        UPDATE "Psychologists"
        SET "fotoUrl" = REGEXP_REPLACE("fotoUrl", '=s\\d+(-c)?$', '=s800-c')
        WHERE "fotoUrl" ILIKE '%googleusercontent.com%' AND "fotoUrl" ~ '=s\\d+(-c)?$';
      `);
    } else {
      // Fallback para SQLite / outros dialetos (testes)
      const [psis] = await queryInterface.sequelize.query(`
        SELECT id, "fotoUrl" FROM "Psychologists" WHERE "fotoUrl" LIKE '%googleusercontent.com%'
      `);
      for (const p of psis) {
        if (p.fotoUrl && /=s\d+(-c)?$/.test(p.fotoUrl)) {
          const newUrl = p.fotoUrl.replace(/=s\d+(-c)?$/, '=s800-c');
          await queryInterface.sequelize.query(`
            UPDATE "Psychologists" SET "fotoUrl" = :newUrl WHERE id = :id
          `, { replacements: { newUrl, id: p.id } });
        }
      }
    }
  },

  async down(queryInterface, Sequelize) {
    // Não é necessário reverter resolução de foto
  }
};

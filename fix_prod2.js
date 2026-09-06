const { Psychologist } = require('./backend/models');
const { Op } = require('sequelize');

async function run() {
  try {
    const startOfToday = new Date('2026-09-06T00:00:00.000Z');
    
    // Find psychologists created today that we just set to 'meta'
    const psys = await Psychologist.findAll({
      where: {
        createdAt: {
          [Op.gte]: startOfToday
        },
        utm_source: 'meta'
      }
    });

    if (psys.length > 0) {
      const ids = psys.map(p => p.id);
      const result = await Psychologist.update({
        utm_source: 'meta_ads',
        first_utm_source: 'meta_ads'
      }, {
        where: { id: { [Op.in]: ids } }
      });
      console.log(`Atualizados ${result[0]} psicólogos para 'meta_ads'`);
    } else {
      console.log('Nenhum psicólogo com utm_source="meta" para atualizar.');
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();

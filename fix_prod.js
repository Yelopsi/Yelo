const { Psychologist } = require('./backend/models');
const { Op } = require('sequelize');

async function run() {
  try {
    const startOfToday = new Date('2026-09-06T00:00:00.000Z');
    
    // Check how many were created today and have null tags
    const psys = await Psychologist.findAll({
      where: {
        createdAt: {
          [Op.gte]: startOfToday
        },
        utm_source: null
      },
      attributes: ['id', 'nome', 'email', 'createdAt', 'utm_source']
    });

    console.log(`Encontrados ${psys.length} psicólogos cadastrados hoje sem utm_source:`);
    console.log(JSON.stringify(psys, null, 2));

    // Update them
    if (psys.length > 0) {
      const ids = psys.map(p => p.id);
      const result = await Psychologist.update({
        utm_source: 'meta',
        first_utm_source: 'meta'
      }, {
        where: { id: { [Op.in]: ids } }
      });
      console.log(`Atualizados ${result[0]} psicólogos com a tag utm_source='meta'`);
    } else {
      console.log('Nenhum psicólogo para atualizar.');
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();

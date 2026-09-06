const { Psychologist } = require('./backend/models');
async function run() {
  const psy = await Psychologist.findOne({ where: { status: 'active', deletedAt: null } });
  console.log(psy.slug);
  process.exit(0);
}
run();

const { sequelize } = require('./backend/models');
async function test() {
  const models = Object.keys(sequelize.models);
  console.log("MODELS:", models);
  process.exit();
}
test();

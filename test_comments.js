require('dotenv').config();
const db = require('./backend/models');

async function test() {
  const comments = await db.ForumComment.findAll({
    order: [['createdAt', 'DESC']],
    limit: 5,
    raw: true
  });
  console.log(comments);
  process.exit(0);
}
test();

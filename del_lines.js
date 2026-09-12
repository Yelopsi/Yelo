const fs = require('fs');
const file = '/Users/andehrson/SITES/Yelo/backend/controllers/adminController.js';
let lines = fs.readFileSync(file, 'utf8').split('\n');
lines.splice(1539, 410); // 1949 - 1539 = 410 lines
fs.writeFileSync(file, lines.join('\n'));
console.log('done');

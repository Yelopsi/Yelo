const fs = require('fs');
const path = '/Users/andehrson/SITES/Yelo/backend/models/psychologist.js';
let content = fs.readFileSync(path, 'utf8');

const hookRegex = /hooks:\s*\{\s*beforeUpdate:[\s\S]*?\},/g;
content = content.replace(hookRegex, '');
fs.writeFileSync(path, content);

const fs = require('fs');
const path = '/Users/andehrson/SITES/Yelo/backend/routes/cmoRoutes.js';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/let simMetaCac = 150;/g, "let simMetaCac = null;");
content = content.replace(/let simTrialConv = 0\.15;/g, "let simTrialConv = null;");
content = content.replace(/let simChurn = 0\.05;/g, "let simChurn = null;");

content = content.replace(/simChurn = 0\.05;\s*simChurnType = 'ASSUMED';/g, "simChurn = null;\n            simChurnType = 'PROXY';");

fs.writeFileSync(path, content);

const fs = require('fs');
const path = '/Users/andehrson/SITES/Yelo/admin/admin_cmo_metrics.js';
let content = fs.readFileSync(path, 'utf8');

// Declare variable outside loop
if (!content.includes('let actionCACPenalized = 0;')) {
    content = content.replace(/let actionUnspentCash = 0;/g, "let actionUnspentCash = 0;\n        let actionCACPenalized = 0;");
}

// Assign inside loop
content = content.replace(/actionUnspentCash = rolloverCash;/g, "actionUnspentCash = rolloverCash;\n                actionCACPenalized = metaCACPenalized;");

// Update payload
content = content.replace(/cacPenalizado: formatBRL\(cacMeta\),/g, "cacPenalizado: formatBRL(actionCACPenalized),");

fs.writeFileSync(path, content);

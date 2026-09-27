const fs = require('fs');
const path = '/Users/andehrson/SITES/Yelo/admin/admin_cmo_metrics.js';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/mrrAt12 = mrr;/g, "mrrAt12 = currentBase * arpu; // MRR no fechamento exato do mês");

fs.writeFileSync(path, content);

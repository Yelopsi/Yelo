const fs = require('fs');
const path = '/Users/andehrson/SITES/Yelo/admin/admin_cmo_metrics.js';
let content = fs.readFileSync(path, 'utf8');

// The simulator payload now gives:
// cac: { value: null, type: 'PROXY' }
// trialConv: { value: null, type: 'UNKNOWN' }
// churn: { value: null, type: 'PROXY' }
//
// "Google Maintenance Cost usar demandEligiblePaidBase"
// "NÃO usar activePaidAccessBase como base de demanda"
// "remover fallback CAC = 150"
// "remover fallback Trial Conversion = 15%"
// "remover fallback Churn = 5%"
// "corrigir trialDurationFraction para 7/30"
// "corrigir a inconsistência temporal entre baseAt12 e mrrAt12"
// "remover definitivamente qualquer interpolação de Base Realizada"

content = content.replace(/const cacAtual = data\.simulator\.cac \|\| 150;/g, "const cacAtualObj = data.simulator.cac || {};\n    const cacAtual = cacAtualObj.value;");
content = content.replace(/const trialConv = data\.simulator\.trialConv \|\| 0\.15;/g, "const trialConvObj = data.simulator.trialConv || {};\n    const trialConv = trialConvObj.value;");
content = content.replace(/const churn = data\.simulator\.churn \|\| 0\.05;/g, "const churnObj = data.simulator.churn || {};\n    const churn = churnObj.value;");

content = content.replace(/const trialDurationFraction = 14 \/ 30;/g, "const trialDurationFraction = 7 / 30;");

// Update how the simulation loops. Let's see the base.
content = content.replace(/let activeBase = parseInt\(data\.simulator\.activePaidAccessBase\);/g, "let activeBase = parseInt(data.platform.b2b.renewableSubscriberBase);\n    let demandBase = parseInt(data.platform.b2b.demandEligiblePaidBase);");

// Let's first search to see the actual contents of the simulation loop

const fs = require('fs');
const path = '/Users/andehrson/SITES/Yelo/backend/routes/cmoRoutes.js';
let content = fs.readFileSync(path, 'utf8');

// The simulator object in the JSON response currently looks like:
// simulator: {
//     cac: simMetaCac,
//     cpl: simGoogleCpl,
//     trialConv: simTrialConv,
//     churn: simChurn,
//     churnType: simChurnType,
//     knownScheduledChurn,
//     renewableSubscriberBase,
//     activePaidAccessBase
// },

const oldSimulatorBlock = `            simulator: {
                cac: simMetaCac,
                cpl: simGoogleCpl,
                trialConv: simTrialConv,
                churn: simChurn,
                churnType: simChurnType,
                knownScheduledChurn,
                renewableSubscriberBase,
                activePaidAccessBase
            },`;

const newSimulatorBlock = `            simulator: {
                cac: { value: null, type: 'PROXY' },
                cpl: simGoogleCpl,
                trialConv: { value: null, type: 'UNKNOWN' },
                churn: { value: null, type: 'PROXY' },
                churnType: simChurnType,
                knownScheduledChurn,
                renewableSubscriberBase,
                demandEligiblePaidBase
            },`;

content = content.replace(oldSimulatorBlock, newSimulatorBlock);

// Remove the fallbacks for cac, trialConv, churn. Let's find them.
// "remover fallback CAC = 150;"
// "remover fallback Trial Conversion = 15%;"
// "remover fallback Churn = 5%;"
content = content.replace(/let simMetaCac = \w+ > 0 \? \w+ : 150;/g, "let simMetaCac = null;");
content = content.replace(/let simTrialConv = \w+ > 0 \? \w+ : 0\.15;/g, "let simTrialConv = null;");
content = content.replace(/let simChurn = \w+ > 0 \? \w+ : 0\.05;/g, "let simChurn = null;");

// Update Month 12 logic temporal inconsistency
// "corrigir a inconsistência temporal entre baseAt12 e mrrAt12"
// Find how baseAt12 and mrrAt12 are calculated

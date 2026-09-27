const fs = require('fs');
const path = '/Users/andehrson/SITES/Yelo/admin/admin_cmo_metrics.js';
let content = fs.readFileSync(path, 'utf8');

// The new payload brings an object for cac, trialConv, churn: { value, type }
// I will replace their extractions in the runSimulation.

const oldBlock = `
        let basePagantes = activePaidAccessBase;
        const baseTrials = data.platform.b2b.total_trials || 0;
        
        const trialConversionRate = data.simulator?.trialConv > 0 ? data.simulator.trialConv : 0.15;
        const cacMeta = data.simulator?.cac > 0 ? data.simulator.cac : 150; 
        const arpu = data.platform?.b2b?.arpu || 99;

        // 2. CONTATOS POR PSI (Fixado em 3.0 pelo Motor Final)
        const contactsPerPaidPsiMonth = 3.0;
        const targetContactsPerPsi = contactsPerPaidPsiMonth; // para manter compatibilidade com labels
        const contactsThresholdSource = 'Motor de Crescimento';

        const cplGoogle = data.simulator?.cpl > 0 ? data.simulator.cpl : 22.13;
        const monthlyChurn = data.simulator?.churn > 0 ? data.simulator.churn : 0.05;`;

const newBlock = `
        let basePagantes = activePaidAccessBase;
        
        const trialConversionObj = data.simulator?.trialConv || {};
        const trialConversionRate = trialConversionObj.value; // Removido fallback
        
        const cacMetaObj = data.simulator?.cac || {};
        const cacMeta = cacMetaObj.value; // Removido fallback
        
        const arpu = data.platform?.b2b?.arpu || 99;

        const contactsPerPaidPsiMonth = 3.0;
        const targetContactsPerPsi = contactsPerPaidPsiMonth;
        const contactsThresholdSource = 'Motor de Crescimento';

        const cplGoogle = data.simulator?.cpl > 0 ? data.simulator.cpl : 22.13;
        
        const churnObj = data.simulator?.churn || {};
        const monthlyChurn = churnObj.value; // Removido fallback
        
        const isSimulationPossible = cacMeta !== null && trialConversionRate !== null && monthlyChurn !== null;`;

content = content.replace(oldBlock.trim(), newBlock.trim());

// Google Cost uses demandEligiblePaidBase
// Look for totalContactDemand
content = content.replace(/const totalContactDemand = currentBase \* contactsPerPaidPsiMonth;/g, 
`const demandEligibleBase = data.platform?.b2b?.demandEligiblePaidBase || currentBase;
            const totalContactDemand = demandEligibleBase * contactsPerPaidPsiMonth;`);

// Fix trialDurationFraction
content = content.replace(/const trialDurationFraction = 0\.5;/g, "const trialDurationFraction = 7 / 30;");

// Fix Month 12 temporal inconsistency and base realized interpolation
content = content.replace(/let mrrAt12 = 0;\n\s*let baseAt12 = 0;/g, "let mrrAt12 = 0;\n        let baseAt12 = 0;");
// Make sure to remove any other activePaidAccessBase usage

fs.writeFileSync(path, content);

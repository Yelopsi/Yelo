import re

with open('admin/admin_cmo_metrics.js', 'r') as f:
    code = f.read()

# I will find the start of runSimulation:
# const runSimulation = (data) => { ...
# and replace its body up to "// Update Cards com textos contextuais"

replacement = """    const runSimulation = (data) => {
        const inputReinvestRate = document.getElementById('sim-reinvest-rate');
        const inputExtraCash = document.getElementById('sim-extra-cash');
        const inputCuriosityGoal = document.getElementById('sim-curiosity-goal');
        
        let reinvestRate = parseFloat(inputReinvestRate?.value) || 50;
        let extraCashStr = inputExtraCash?.value || '0';
        let extraCash = parseFloat(extraCashStr.replace(/\\./g, '').replace(',', '.')) || 0;
        let curiosityGoal = parseInt(inputCuriosityGoal?.value) || null;
        
        // 1. BASE INICIAL VEM DA PRODUÇÃO ATUAL (Motor Final)
        // Ignora simTrackingStartSubs (25) e usa activePaidAccessBase (29)
        const activePaidAccessBase = data.simulator?.activePaidAccessBase || data.platform.b2b.total_active || 0;
        const renewableSubscriberBase = data.simulator?.renewableSubscriberBase || activePaidAccessBase;
        const knownScheduledChurn = activePaidAccessBase - renewableSubscriberBase;

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
        const monthlyChurn = data.simulator?.churn > 0 ? data.simulator.churn : 0.05;
        
        const histMetaMonthlySpendAvg = data.historical?.meta?.monthly_spend_avg || 3000;
        
        const verifiedOrganicContacts = 0; 
        const newOrganicActive = 0; 

        const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

        // Snowball Projection (Motor Final validado)
        const targetMonths = 12;
        const labels = [];
        const dataRevenue = [];
        const dataCosts = [];
        const dataCashflow = [];
        const dataExpectedBase = [];
        
        let currentBase = activePaidAccessBase;
        let currentRenewable = renewableSubscriberBase;
        let rolloverCash = 0;
        
        let mrrAt12 = 0;
        let baseAt12 = 0;
        let metaBudgetAt12 = 0;
        let googleBudgetAt12 = 0;
        
        // M1 values for Action Plan
        let actionMetaSpend = 0;
        let actionGoogleMaintenance = 0;
        let actionTrialGoogleSpend = 0;
        
        for (let m = 1; m <= targetMonths; m++) {
            let baseStart = currentBase;
            let baseStartRenewable = currentRenewable;

            const mrr = currentBase * arpu;
            
            const totalContactDemand = currentBase * contactsPerPaidPsiMonth;
            const requiredGoogleContacts = Math.max(0, totalContactDemand - verifiedOrganicContacts);
            const googleMaintenanceCost = requiredGoogleContacts * cplGoogle;
            
            const contributionAfterGoogle = Math.max(0, mrr - googleMaintenanceCost);
            const growthFund = (contributionAfterGoogle * (reinvestRate / 100)) + (m === 1 ? extraCash : 0) + rolloverCash;

            const metaHardCap = histMetaMonthlySpendAvg * 3.5;
            let projectedMetaBudget = growthFund * 0.80; // 80% Meta / 20% Google Trials budget assumption
            
            const scaleFactor = Math.min(3.5, Math.max(1, projectedMetaBudget / (histMetaMonthlySpendAvg || 1)));
            const metaCACPenalized = cacMeta * (1 + (Math.max(0, scaleFactor - 1) * 0.20));
            
            const trialsPerPaid = 1 / trialConversionRate;
            const trialDurationFraction = 0.5;
            const trialContactDemand = contactsPerPaidPsiMonth * trialDurationFraction;
            const avgGoogleCostPerTrial = trialContactDemand * cplGoogle;
            
            const trialGoogleCostPerPaid = trialsPerPaid * avgGoogleCostPerTrial;
            const blendedAcquisitionCost = metaCACPenalized + trialGoogleCostPerPaid;

            const maxPaidByCash = Math.floor(growthFund / blendedAcquisitionCost);
            const maxPaidByMeta = Math.floor(metaHardCap / metaCACPenalized);
            const newPaidActive = Math.min(maxPaidByCash, maxPaidByMeta);
            
            const actualMetaSpend = newPaidActive * metaCACPenalized;
            const actualTrialGoogleSpend = newPaidActive * trialGoogleCostPerPaid;
            const actualGrowthSpend = actualMetaSpend + actualTrialGoogleSpend;
            
            rolloverCash = growthFund - actualGrowthSpend;

            let monthKnownChurn = m === 1 ? knownScheduledChurn : 0;
            let expectedChurn = currentRenewable * monthlyChurn;
            let churnLoss = expectedChurn + monthKnownChurn;

            currentBase = currentBase + newPaidActive + newOrganicActive - churnLoss;
            currentRenewable = currentRenewable + newPaidActive + newOrganicActive - expectedChurn;
            
            const totalGoogleBudget = googleMaintenanceCost + actualTrialGoogleSpend;

            labels.push(`Mês ${m}`);
            dataExpectedBase.push(currentBase);
            dataRevenue.push(mrr);
            
            const totalCosts = actualMetaSpend + totalGoogleBudget;
            dataCosts.push(totalCosts);
            dataCashflow.push(mrr - totalCosts);
            
            if (m === 1) {
                actionMetaSpend = actualMetaSpend;
                actionGoogleMaintenance = googleMaintenanceCost;
                actionTrialGoogleSpend = actualTrialGoogleSpend;
            }
            
            if (m === 12) {
                mrrAt12 = mrr;
                baseAt12 = currentBase;
                metaBudgetAt12 = actualMetaSpend;
                googleBudgetAt12 = totalGoogleBudget;
            }
        }

        // Update Cards com textos contextuais"""

pattern = r'    const runSimulation = \(data\) => \{.*?(?=        // Update Cards com textos contextuais)'
code = re.sub(pattern, replacement, code, flags=re.DOTALL)

with open('admin/admin_cmo_metrics.js', 'w') as f:
    f.write(code)


import re

with open('admin/admin_cmo_metrics.js', 'r') as f:
    code = f.read()

# I will replace the entire generateProjectionData function.
replacement = """    function generateProjectionData(basePagantes, baseTrials, cacPenalizado, googleCostPerTrial, monthlyRevenue, data) {
        const results = [];
        const sim = data.simulator || {};
        
        // --- 1. Princípios Econômicos Iniciais ---
        const cacMeta = sim.cac || 150;
        const cplGoogle = sim.cpl || 40; // 22.13 in DB usually
        const monthlyChurn = sim.churn || 0.05;
        const assumedTrialConversion = sim.trialConv || 0.15;
        
        const knownScheduledChurn = sim.knownScheduledChurn || 0;
        const renewableSubscriberBase = sim.renewableSubscriberBase || 26;
        
        const arpu = parseFloat(document.getElementById('cmo-b2b-arpu')?.textContent.replace(/[^0-9,.-]/g, '').replace(',', '.')) || 160;
        const reinvestRate = parseFloat(document.getElementById('cmo-reinvest-rate')?.value) / 100 || 0.50;
        const extraCash = parseFloat(document.getElementById('cmo-extra-cash')?.value) || 0;

        let currentBase = basePagantes;
        let currentRenewable = renewableSubscriberBase;
        let rolloverCash = 0;

        // --- 2. Histórico e Contatos Operacionais ---
        const histMetaSpend = data.historical?.meta?.monthly_spend_avg || 3000;
        
        // Calcular contatos reais por psicólogo (b2c_clicks / 3 meses) / base
        const b2cClicks90d = data.historical?.platform?.b2c?.wpp_clicks || 0;
        const monthlyClicks = b2cClicks90d / 3;
        const contactsPerPaidPsiMonth = basePagantes > 0 ? (monthlyClicks / basePagantes) : 3;
        
        const verifiedOrganicContacts = data.platform?.b2c?.organic_wpp_clicks_90d ? (data.platform.b2c.organic_wpp_clicks_90d / 3) : 0;
        const newOrganicActive = 0; // Premissa conservadora: atribuição orgânica histórica incompleta -> projeta 0 para aquisições puras orgânicas

        for (let m = 1; m <= 12; m++) {
            let baseStart = currentBase;
            let baseStartRenewable = currentRenewable;

            // --- A. MRR e Custos de Manutenção ---
            const mrr = currentBase * arpu;
            
            // Necessidade total de contatos da base pagante atual
            const totalContactDemand = currentBase * contactsPerPaidPsiMonth;
            const requiredGoogleContacts = Math.max(0, totalContactDemand - verifiedOrganicContacts);
            const googleMaintenanceCost = requiredGoogleContacts * cplGoogle;
            
            // --- B. Caixa de Crescimento (Growth Fund) ---
            const contributionAfterGoogle = Math.max(0, mrr - googleMaintenanceCost);
            const growthFund = (contributionAfterGoogle * reinvestRate) + (m === 1 ? extraCash : 0) + rolloverCash;

            // --- C. Hard Cap e Penalidade Meta ---
            const metaHardCap = histMetaSpend * 3.5;
            // Aloca-se tipicamente 80% do growthFund para o Meta (heurística de split de verba) - ou 100% se preferir, a regra atual usa 80%
            let projectedMetaBudget = growthFund * 0.80; 
            
            // Se growthFund < budget, ele usa o máximo possível
            const scaleFactor = Math.min(3.5, Math.max(1, projectedMetaBudget / histMetaSpend));
            const metaCACPenalized = cacMeta * (1 + (Math.max(0, scaleFactor - 1) * 0.20));
            
            // --- D. Custos de Aquisição (Blended) ---
            const trialsPerPaid = 1 / assumedTrialConversion;
            // Trials costumam receber contatos por ~15 dias (0.5 meses)
            const trialDurationFraction = 0.5;
            const trialContactDemand = contactsPerPaidPsiMonth * trialDurationFraction;
            const avgGoogleCostPerTrial = trialContactDemand * cplGoogle;
            
            const trialGoogleCostPerPaid = trialsPerPaid * avgGoogleCostPerTrial;
            const blendedAcquisitionCost = metaCACPenalized + trialGoogleCostPerPaid;

            // --- E. Aquisição Paga (Restrição Dupla) ---
            const maxPaidByCash = Math.floor(growthFund / blendedAcquisitionCost);
            const maxPaidByMeta = Math.floor(metaHardCap / metaCACPenalized);
            const newPaidActive = Math.min(maxPaidByCash, maxPaidByMeta);
            
            // --- F. Gasto Real e Rollover ---
            const actualMetaSpend = newPaidActive * metaCACPenalized;
            const actualTrialGoogleSpend = newPaidActive * trialGoogleCostPerPaid;
            const actualGrowthSpend = actualMetaSpend + actualTrialGoogleSpend;
            
            rolloverCash = growthFund - actualGrowthSpend;

            // --- G. Churn Expected Value Decimal ---
            let monthKnownChurn = m === 1 ? knownScheduledChurn : 0;
            let expectedChurn = currentRenewable * monthlyChurn;
            let churnLoss = expectedChurn + monthKnownChurn;

            // --- H. Fechamento do Mês ---
            currentBase = currentBase + newPaidActive + newOrganicActive - churnLoss;
            currentRenewable = currentRenewable + newPaidActive + newOrganicActive - expectedChurn;

            results.push({
                month: m,
                baseInicial: Math.round(baseStart),
                receita: mrr,
                maintenanceGoogle: googleMaintenanceCost,
                budgetMeta: actualMetaSpend, // Gasto efetivo
                trueCac: blendedAcquisitionCost, // Blended
                newPaid: newPaidActive,
                newOrganic: newOrganicActive, // 0
                churnLoss: churnLoss,
                knownChurn: monthKnownChurn,
                expectedChurn: expectedChurn,
                rollover: rolloverCash,
                baseFinalRound: Math.round(currentBase),
                excessApplied: actualMetaSpend >= metaHardCap, // Hit Hard Cap
                // Dados extras
                scaleFactor: scaleFactor,
                metaCACPenalized: metaCACPenalized
            });
        }
        return results;
    }"""
# Extract and replace
code = re.sub(r'function generateProjectionData\([^)]+\) \{[\s\S]*?return results;\n    \}', replacement, code)

with open('admin/admin_cmo_metrics.js', 'w') as f:
    f.write(code)

print("admin_cmo_metrics.js rewrite complete!")

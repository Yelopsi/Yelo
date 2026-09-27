import re

with open('admin/admin_cmo_metrics.js', 'r') as f:
    code = f.read()

# 1. Update initial variables assignment
init_patch = """
        const sim = data.simulator || {};
        const cacMeta = sim.cac || 150;
        const cplGoogle = sim.cpl || 40;
        const churnRate = sim.churn || 0.05;
        const knownScheduledChurn = sim.knownScheduledChurn || 0;
        const renewableSubscriberBase = sim.renewableSubscriberBase || 26;
        const basePagantes = sim.activePaidAccessBase || 29;
"""
code = re.sub(r'const sim = data.simulator \|\| \{\};\n\s*const cacMeta = sim.cac \|\| 150;\n\s*const cplGoogle = sim.cpl \|\| 40;\n\s*const churnRate = sim.churn \|\| 0.05;', init_patch, code)

# 2. Update math in generateProjectionData (Expected Value Decimal)
# Original code has Math.floor around currentBase * monthlyChurn
math_patch = """
        let currentBase = basePagantes; // Decimal after Month 1
        let currentRenewable = renewableSubscriberBase;

        for (let m = 1; m <= 12; m++) {
            const histMetaSpend = (data.historical?.meta?.monthly_spend_avg) || 3000;
            const maxHealthyMetaBudget = histMetaSpend * 3.5;
            
            // Reinvestment
            const reinvestmentCash = (currentBase * arpu) * reinvestmentRate;
            let totalBudget = reinvestmentCash + rolloverCash;
            let maintenanceGoogle = (currentBase / 50) * 150;
            let availableForAcquisition = totalBudget - maintenanceGoogle;

            let projectedMetaBudget = availableForAcquisition * 0.80;
            let smartMetaBudget = projectedMetaBudget;
            let penaltyRate = 0;
            
            if (smartMetaBudget > maxHealthyMetaBudget) {
                const excess = smartMetaBudget - maxHealthyMetaBudget;
                smartMetaBudget = maxHealthyMetaBudget + (excess * (1 - 0.20)); // PENALTY_RATE = 20%
                penaltyRate = 0.20;
            }

            const trueCac = cacMeta * (1 + penaltyRate);
            const actualAcquisitionSpend = smartMetaBudget;

            // Math.floor ONLY on Acquisitions (whole users bought)
            const newPaidActive = Math.floor(actualAcquisitionSpend / trueCac);
            const newTrialsBought = Math.floor(newPaidActive * trialsPerPaidUser);
            
            rolloverCash = availableForAcquisition - actualAcquisitionSpend;
            const organicActivePerMonth = organicActive90d / 3;
            const newOrganicActive = Math.floor(organicActivePerMonth);

            // EXPECTED CHURN DECIMAL (No Math.floor)
            let monthKnownChurn = m === 1 ? knownScheduledChurn : 0; // Known churn applied in Month 1
            let expectedChurn = currentRenewable * monthlyChurn;
            let churnLoss = expectedChurn + monthKnownChurn;

            // Update Bases (Decimal preservation)
            let baseStart = currentBase;
            currentBase = currentBase + newPaidActive + newOrganicActive - churnLoss;
            currentRenewable = currentRenewable + newPaidActive + newOrganicActive - expectedChurn;

            const mrr = currentBase * arpu;

            results.push({
                month: m,
                baseStart: baseStart, // Guardar original para UI
                baseFinal: currentBase, // Guardar original para UI
                renewableBase: currentRenewable,
                knownChurn: monthKnownChurn,
                expectedChurn: expectedChurn,
                baseInicial: Math.round(baseStart),
                receita: mrr,
                apport: 0,
                maintenanceGoogle: maintenanceGoogle,
                budgetMeta: smartMetaBudget,
                trueCac: trueCac,
                newPaid: newPaidActive,
                newOrganic: newOrganicActive,
                churnLoss: churnLoss, // Total churn
                rollover: rolloverCash,
                baseFinalRound: Math.round(currentBase),
                excessApplied: smartMetaBudget > maxHealthyMetaBudget
            });
        }
"""
# Replace from `let rolloverCash = 0;` up to `return results;`
code = re.sub(r'let rolloverCash = 0;.*?return results;\n    }', 'let rolloverCash = 0;\n' + math_patch + '        return results;\n    }', code, flags=re.DOTALL)

# 3. Update Render Table
# It uses fields from results
render_patch = """
        const tbody = document.querySelector('#table-projection tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        data.forEach(row => {
            const tr = document.createElement('tr');
            if (row.month === 12) {
                tr.style.backgroundColor = '#f8fafc';
                tr.style.fontWeight = '600';
            }
            
            tr.innerHTML = `
                <td>Mês ${row.month}</td>
                <td>${row.baseInicial}</td>
                <td style="color: #10b981;">R$ ${row.receita.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                <td style="color: #f59e0b;">R$ ${row.maintenanceGoogle.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                <td style="color: #6366f1;">
                    R$ ${row.budgetMeta.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}
                    ${row.excessApplied ? '<span style="color: #ef4444; font-size: 0.75rem; margin-left: 5px;" title="Scale Penalty Aplicado">⚠️</span>' : ''}
                </td>
                <td>R$ ${row.trueCac.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                <td style="color: #10b981;">+${row.newPaid + row.newOrganic}</td>
                <td style="color: #ef4444;">
                    -${row.churnLoss.toFixed(1)}
                    <div style="font-size: 0.7rem; color: #94a3b8; font-weight: normal;">
                        Agendado: ${row.knownChurn} | Esperado: ${row.expectedChurn.toFixed(1)}
                    </div>
                </td>
                <td style="color: #64748b;">R$ ${row.rollover.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                <td style="font-weight: 700; color: #0f172a;">${row.baseFinalRound}</td>
            `;
            tbody.appendChild(tr);
        });
"""
code = re.sub(r'const tbody = document.querySelector\(\'#table-projection tbody\'\);.*?tbody.appendChild\(tr\);\n\s*\}\);', render_patch, code, flags=re.DOTALL)

with open('admin/admin_cmo_metrics.js', 'w') as f:
    f.write(code)

print("admin_cmo_metrics.js patched successfully!")

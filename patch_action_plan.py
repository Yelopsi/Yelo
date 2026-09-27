import re

with open('admin/admin_cmo_metrics.js', 'r') as f:
    code = f.read()

# 1. Capture unspentCash for M1 during the loop
loop_pattern = r'(actionTrialGoogleSpend = actualTrialGoogleSpend;)'
code = re.sub(loop_pattern, r'\1\n                actionUnspentCash = rolloverCash;', code)

# Declare actionUnspentCash at the top of the variables
var_pattern = r'(let actionTrialGoogleSpend = 0;)'
code = re.sub(var_pattern, r'\1\n        let actionUnspentCash = 0;', code)

# 2. Replace the duplicate Action Plan calculation
# We want to replace from "// Calculate M1 exact budgets using the TrueCAC logic" 
# to "const targetMetaDaily = metaBudgetM1 / 30;"
action_pattern = r'// Calculate M1 exact budgets using the TrueCAC logic.*?const unspentCash = Math.max\(0, availableForAcquisition1 - actualSpend1\);\s*const targetMetaDaily = metaBudgetM1 / 30;\s*const targetGoogleDaily = googleBudgetM1 / 30;'

action_replacement = """            // Usa exatamente os valores gerados pelo Motor de Crescimento para o Mês 1
            const unspentCash = actionUnspentCash;
            const targetMetaDaily = actionMetaSpend / 30;
            
            const googleBudgetM1 = actionGoogleMaintenance + actionTrialGoogleSpend;
            const targetGoogleDaily = googleBudgetM1 / 30;
            
            const baseDaily = actionGoogleMaintenance / 30;
            const trialsDaily = actionTrialGoogleSpend / 30;
            
            const availableForAcquisition1 = actionMetaSpend + actionTrialGoogleSpend + actionUnspentCash;
"""
code = re.sub(action_pattern, action_replacement, code, flags=re.DOTALL)

with open('admin/admin_cmo_metrics.js', 'w') as f:
    f.write(code)


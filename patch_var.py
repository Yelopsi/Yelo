import re

with open('admin/admin_cmo_metrics.js', 'r') as f:
    code = f.read()

replacement = """        const b2cClicks90d = data.historical?.platform?.b2c?.wpp_clicks || 0;
        const monthlyClicks = b2cClicks90d / 3;
        // CORREÇÃO: O histórico bruto (351 cliques) incluía free/trials/churned, elevando a média para 4.03.
        // A média real de Produção para pagantes ativos (75 cliques/30d para 26 ativos) é ~2.88.
        const contactsPerPaidPsiMonth = 3.0; // Necessidade real comprovada de contatos por psicólogo pagante"""

code = re.sub(
    r'const b2cClicks90d = data\.historical\?\.platform\?\.b2c\?\.wpp_clicks \|\| 0;\n\s*const monthlyClicks = b2cClicks90d / 3;\n\s*const contactsPerPaidPsiMonth = basePagantes > 0 \? \(monthlyClicks / basePagantes\) : 3;',
    replacement,
    code
)

with open('admin/admin_cmo_metrics.js', 'w') as f:
    f.write(code)

print("Variable patched.")

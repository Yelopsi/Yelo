import re

with open('admin/admin_cmo_metrics.html', 'r') as f:
    code = f.read()

# Card 3 title
code = code.replace(
    '<p style="font-size: 0.8rem; color: #64748b; margin: 0; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Caixa Meta Ads (12M)</p>',
    '<p style="font-size: 0.8rem; color: #64748b; margin: 0; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Meta Recomendado (M1)</p>'
)
# Card 3 subtext
code = code.replace(
    '<p style="font-size: 0.8rem; color: #64748b; margin: 15px 0 0 0; line-height: 1.4;">Orçamento livre p/ escalar aquisição.</p>',
    '<p style="font-size: 0.8rem; color: #64748b; margin: 15px 0 0 0; line-height: 1.4;">Meta Ads recomendado — Mês 1.</p>'
)

# Card 4 subtext
code = code.replace(
    '<p style="font-size: 0.8rem; color: #64748b; margin: 15px 0 0 0; line-height: 1.4;">Custo vitalício de retenção da base.</p>',
    '<p style="font-size: 0.8rem; color: #64748b; margin: 15px 0 0 0; line-height: 1.4;">Custo projetado de sustentação da base.</p>'
)

with open('admin/admin_cmo_metrics.html', 'w') as f:
    f.write(code)


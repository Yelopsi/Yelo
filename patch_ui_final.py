import re

with open('admin/admin_cmo_metrics.js', 'r') as f:
    code = f.read()

# 1. extraCash (m===1 to always)
code = code.replace(
    'const growthFund = (contributionAfterGoogle * (reinvestRate / 100)) + (m === 1 ? extraCash : 0) + rolloverCash;',
    'const growthFund = (contributionAfterGoogle * (reinvestRate / 100)) + extraCash + rolloverCash;'
)

# 2. Card 2
code = code.replace(
    '`+${newSubs} novos psis. Juntos atenderão ~${totalPatientsServed.toLocaleString(\'pt-BR\')} pacientes/mês.`;',
    '`+${newSubs} assinantes líquidos na base em 12 meses. Juntos receberão ~${totalPatientsServed.toLocaleString(\'pt-BR\')} contatos de pacientes/mês.`;'
)

# 3. Card 3 (Meta)
code = code.replace(
    'document.getElementById(\'sim-res-meta-budget-12m\').textContent = formatBRL(metaBudgetAt12);',
    'document.getElementById(\'sim-res-meta-budget-12m\').textContent = formatBRL(actionMetaSpend);'
)
code = code.replace(
    'const metaDailyAt12 = metaBudgetAt12 / 30;',
    'const metaDailyM1 = actionMetaSpend / 30;'
)
code = code.replace(
    '`≈ ${formatBRL(metaDailyAt12)}/dia disponíveis para comprar novos trials.`;',
    '`≈ ${formatBRL(metaDailyM1)}/dia recomendados para Mês 1.`;'
)
code = code.replace(
    'document.querySelector(\'#sim-card-3 p:last-child\')',
    'document.querySelector(\'#sim-card-3 p:last-child\')'
)

# 4. Card 4 (Google)
code = code.replace(
    'const googleDailyAt12 = googleBudgetAt12 / 30;',
    'const googleDailyAt12 = googleBudgetAt12 / 30;'
)
code = code.replace(
    '`≈ ${formatBRL(googleDailyAt12)}/dia · limiar: ${targetContactsPerPsi} cliques/psi (${contactsThresholdSource}).`;',
    '`Custo mensal projetado p/ Mês 12 (≈ ${formatBRL(googleDailyAt12)}/dia).`;'
)

# 5. Fix HTML text elements in code
code = code.replace(
    'let metaAction = \'\';',
    'let metaAction = \'\';'
)
old_meta1 = 'metaAction = `<br>🔍 <strong>Diagnóstico:</strong> O seu Fundo de Aquisição atual (após separar o custo de Retenção no Google) é de <strong>${formatBRL(availableForAcquisition1)}</strong>. Tentar despejar todo esse valor de uma vez no Meta Ads forçaria a máquina e faria seu Custo de Aquisição (CAC) explodir.<br><br>💡 <strong>Ação Recomendada (Escala Segura):</strong> Aumente o Meta Ads para no máximo <strong>${formatBRL(targetMetaDaily)}/dia</strong> para não corromper o algoritmo. Com isso, após pagar a captação de pacientes para os novos trials no Google, você ainda preservará <strong>${formatBRL(unspentCash)}/mês</strong> em caixa limpo. Use essa sobra para testar canais alternativos (Parcerias, Growth, SEO) em vez de inflacionar o Meta.`;'
new_meta1 = 'metaAction = `<br>🔍 <strong>Fato Calculado:</strong> O Fundo de Aquisição atual (após separar a Retenção no Google) é de <strong>${formatBRL(availableForAcquisition1)}</strong>. Devido ao teto de escala saudável do Meta Ads, o motor limitou o orçamento diário.<br><br>💡 <strong>Sugestão Estratégica:</strong> Ajuste o Meta Ads para <strong>${formatBRL(targetMetaDaily)}/dia</strong>. O caixa excedente de <strong>${formatBRL(unspentCash)}/mês</strong> (Rollover) será preservado.`;'
code = code.replace(old_meta1, new_meta1)

old_meta2 = 'metaAction = `<br>🔍 <strong>Diagnóstico:</strong> O seu orçamento diário configurado no Meta hoje é de <strong>${formatBRL(currentMetaDailyBudget)}</strong>. Pela sua política de reinvestimento, o teto financeiro para este mês é de apenas <strong>${formatBRL(targetMetaDaily)}/dia</strong>.<br><br>💡 <strong>Ação Recomendada:</strong> <strong>DIMINUA</strong> sua configuração diária no Meta agora mesmo para estancar a sangria e respeitar o seu fluxo de caixa.`;'
new_meta2 = 'metaAction = `<br>🔍 <strong>Fato Calculado:</strong> O orçamento configurado no Meta (<strong>${formatBRL(currentMetaDailyBudget)}/dia</strong>) é maior que o teto matemático do reinvestimento (<strong>${formatBRL(targetMetaDaily)}/dia</strong>).<br><br>💡 <strong>Sugestão Estratégica:</strong> <strong>Reduza</strong> sua configuração diária no Meta para alinhar com o fluxo de caixa gerado.`;'
code = code.replace(old_meta2, new_meta2)

old_meta3 = 'metaAction = `<br>🔍 <strong>Diagnóstico:</strong> O seu orçamento diário configurado no Meta hoje é de <strong>${formatBRL(currentMetaDailyBudget)}</strong>. Pela sua política de reinvestimento, você tem caixa para subir com segurança até <strong>${formatBRL(targetMetaDaily)}/dia</strong> este mês.<br><br>💡 <strong>Ação Recomendada:</strong> <strong>AUMENTE</strong> a configuração diária no Meta Ads até bater este teto.`;'
new_meta3 = 'metaAction = `<br>🔍 <strong>Fato Calculado:</strong> O orçamento configurado no Meta (<strong>${formatBRL(currentMetaDailyBudget)}/dia</strong>) está abaixo do teto matemático do reinvestimento.<br><br>💡 <strong>Sugestão Estratégica:</strong> Você tem caixa para <strong>aumentar</strong> o Meta Ads até <strong>${formatBRL(targetMetaDaily)}/dia</strong> neste mês.`;'
code = code.replace(old_meta3, new_meta3)

old_google1 = 'googleAction = `<br>🔍 <strong>Diagnóstico:</strong> O tráfego orgânico (SEO) já atende a demanda histórica média (${targetContactsPerPsi} cliques/psi) para toda a sua base atual de assinantes.<br><br>💡 <strong>Ação Recomendada:</strong> Você pode pausar o Google Ads temporariamente.`;'
new_google1 = 'googleAction = `<br>🔍 <strong>Fato Calculado:</strong> O tráfego orgânico (SEO) já atende a demanda histórica média (${targetContactsPerPsi} contatos/psi) para toda a sua base atual de assinantes.<br><br>💡 <strong>Sugestão Estratégica:</strong> Você pode pausar o Google Ads temporariamente.`;'
code = code.replace(old_google1, new_google1)

old_google2 = 'googleAction = `<br>🔍 <strong>Diagnóstico:</strong> O Google Ads na Yelo sustenta tanto a <strong>Retenção</strong> dos assinantes atuais quanto a captação de pacientes para os <strong>Novos Trials</strong>.<br><br>💡 <strong>Ação Recomendada:</strong> Ajuste o orçamento do Google para <strong>${formatBRL(targetGoogleDaily)}/dia</strong>. Sendo aprox. <strong>${formatBRL(baseDaily)}/dia</strong> apenas para manter a base atual recebendo pacientes (reduzindo churn), e <strong>${formatBRL(trialsDaily)}/dia</strong> para esquentar os novos profissionais em período de testes.`;'
new_google2 = 'googleAction = `<br>🔍 <strong>Fato Calculado:</strong> O Google Ads na Yelo sustenta tanto a <strong>Retenção</strong> dos assinantes atuais quanto a captação de contatos para os <strong>Novos Trials</strong>.<br><br>💡 <strong>Sugestão Estratégica:</strong> Ajuste o orçamento do Google para <strong>${formatBRL(targetGoogleDaily)}/dia</strong>. Sendo aprox. <strong>${formatBRL(baseDaily)}/dia</strong> apenas para reter a base atual, e <strong>${formatBRL(trialsDaily)}/dia</strong> para os novos profissionais em período de testes.`;'
code = code.replace(old_google2, new_google2)

with open('admin/admin_cmo_metrics.js', 'w') as f:
    f.write(code)

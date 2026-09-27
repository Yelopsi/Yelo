import re

with open('backend/routes/cmoRoutes.js', 'r') as f:
    code = f.read()

old_prompt = """INSTRUÇÕES RESTRITAS:
Avalie se a estratégia de travar o Meta Ads no Teto Saudável e poupar o "Caixa Excedente" foi inteligente financeiramente, ou se a empresa está poupando dinheiro mas crescendo devagar demais.
Retorne APENAS um bloco HTML com a seguinte estrutura (SEM MARKDOWN DE CÓDIGO NO INÍCIO OU FIM):
<br>🔍 <strong>Diagnóstico:</strong> [Seu diagnóstico afiado de 2 frases sobre os dados e a sobra de caixa (cite os valores)]<br><br>💡 <strong>Ação Recomendada:</strong> [Sua recomendação executiva: o que fazer com a sobra de caixa ou aprovação da proteção de capital]`;"""

new_prompt = """INSTRUÇÕES RESTRITAS:
Avalie a saúde financeira da estratégia, baseando-se ESTRITAMENTE na matemática provada.
NÃO use opiniões subjetivas como "ineficiência de escala", "perdendo momentum de mercado" ou "validar PMF".
Separe rigidamente: FATO CALCULADO (matemático real) e SUGESTÃO ESTRATÉGICA (apenas se óbvia baseada nos números).
Retorne APENAS um bloco HTML com a seguinte estrutura (SEM MARKDOWN DE CÓDIGO NO INÍCIO OU FIM):
<br>🔍 <strong>Fato Calculado:</strong> [Leitura objetiva da sobra de caixa (cite os valores)]<br><br>💡 <strong>Sugestão Estratégica:</strong> [Alocação lógica do caixa excedente sem extrapolar contexto]`;"""

code = code.replace(old_prompt, new_prompt)

with open('backend/routes/cmoRoutes.js', 'w') as f:
    f.write(code)


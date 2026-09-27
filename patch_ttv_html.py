import re

with open('admin/admin_cmo_metrics.html', 'r') as f:
    code = f.read()

# Replace the single TTV card with two cards
old_html = """        <div class="kpi-card" style="border-top-color: #f59e0b;" title="Tempo médio em dias desde o cadastro do psicólogo até o fechamento do seu primeiro paciente.">
            <div style="font-size: 0.75rem; color: #64748b; font-weight: bold; text-transform: uppercase; margin-bottom: 10px;">Time to Value (TTV)</div>
            <h4 id="cmo-ttv" style="font-size: 1.8rem; color: #1e293b; margin: 0; font-weight: 800;">0</h4>
            <div style="font-size: 0.8rem; color: #64748b; margin-top: 5px;">dias até o 1º paciente</div>
        </div>"""

new_html = """        <div class="kpi-card" style="border-top-color: #8b5cf6;" title="Tempo em dias desde o cadastro do psicólogo até o recebimento do seu primeiro contato.">
            <div style="font-size: 0.75rem; color: #64748b; font-weight: bold; text-transform: uppercase; margin-bottom: 10px;">Tempo até o 1º contato</div>
            <h4 id="cmo-ttfc-median" style="font-size: 1.8rem; color: #1e293b; margin: 0; font-weight: 800;">N/A</h4>
            <div id="cmo-ttfc-sub" style="font-size: 0.75rem; color: #64748b; margin-top: 5px;">Média: N/A · amostra: 0 profissionais</div>
        </div>

        <div class="kpi-card" style="border-top-color: #f59e0b;" title="Tempo em dias desde o cadastro do psicólogo até o fechamento do seu primeiro paciente (Proxy usando o timestamp de criação do contato que converteu).">
            <div style="font-size: 0.75rem; color: #64748b; font-weight: bold; text-transform: uppercase; margin-bottom: 10px;">TTV (1º paciente iniciado)</div>
            <h4 id="cmo-ttv-median" style="font-size: 1.8rem; color: #1e293b; margin: 0; font-weight: 800;">N/A</h4>
            <div id="cmo-ttv-sub" style="font-size: 0.75rem; color: #64748b; margin-top: 5px;">Média: N/A · amostra: 0 profissionais (PROXY)</div>
        </div>"""

code = code.replace(old_html, new_html)

with open('admin/admin_cmo_metrics.html', 'w') as f:
    f.write(code)


import re

with open('admin/admin_cmo_metrics.js', 'r') as f:
    code = f.read()

old_js = "document.getElementById('cmo-ttv').textContent = data.efficiency.ttvAvg || 'N/A';"

new_js = """if (data.efficiency.ttfcData) {
                document.getElementById('cmo-ttfc-median').textContent = data.efficiency.ttfcData.median !== 'N/A' ? `${data.efficiency.ttfcData.median} d` : 'N/A';
                document.getElementById('cmo-ttfc-sub').textContent = `Média: ${data.efficiency.ttfcData.mean} dias · amostra: ${data.efficiency.ttfcData.sample} profissionais`;
            }
            if (data.efficiency.ttvData) {
                document.getElementById('cmo-ttv-median').textContent = data.efficiency.ttvData.median !== 'N/A' ? `${data.efficiency.ttvData.median} d` : 'N/A';
                document.getElementById('cmo-ttv-sub').textContent = `Média: ${data.efficiency.ttvData.mean} dias · amostra: ${data.efficiency.ttvData.sample} profissionais (PROXY)`;
            }"""

code = code.replace(old_js, new_js)

with open('admin/admin_cmo_metrics.js', 'w') as f:
    f.write(code)


import re

with open('admin/admin_growth_dashboard.js', 'r') as f:
    code = f.read()

# Replace line 64
old_64 = "            const semDemandaCount = data.totalAtivos - data.pagantesComDemandaCount;"
new_64 = "            const semDemandaCount = data.pagantesSemDemandaCount || 0;"
code = code.replace(old_64, new_64)

# Replace line 392
old_392 = "    const semDem = o.totalAtivos - o.pagantesComDemandaCount;"
new_392 = "    const semDem = o.pagantesSemDemandaCount || 0;"
code = code.replace(old_392, new_392)

with open('admin/admin_growth_dashboard.js', 'w') as f:
    f.write(code)


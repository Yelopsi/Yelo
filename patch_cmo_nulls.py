import re

with open('admin/admin_cmo_metrics.js', 'r') as f:
    code = f.read()

# Add a check at the top of loadTrafficMetrics
old_load = "async function loadTrafficMetrics(dateStart, dateEnd, token) {"
new_load = "async function loadTrafficMetrics(dateStart, dateEnd, token) {\n    if (!document.getElementById('cmo-ga4-sessions')) return;"
code = code.replace(old_load, new_load)

with open('admin/admin_cmo_metrics.js', 'w') as f:
    f.write(code)


import re

with open('admin/admin_cmo_metrics.js', 'r') as f:
    code = f.read()

# Pattern to remove switchCMOTab to the end of loadWeeklyMetrics
pattern1 = r'// --- TAB & WEEKLY LOGIC ---.*?(?=\n\nfunction renderCMOWeeklyChart)'
code = re.sub(pattern1, '', code, flags=re.DOTALL)

# Pattern to remove renderCMOWeeklyChart
pattern2 = r'function renderCMOWeeklyChart\(data\) \{.*?\}\n'
code = re.sub(pattern2, '', code, flags=re.DOTALL)

with open('admin/admin_cmo_metrics.js', 'w') as f:
    f.write(code)

print("Weekly logic stripped.")

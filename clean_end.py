import re

with open('admin/admin_cmo_metrics.js', 'r') as f:
    code = f.read()

# Pattern to capture everything after "Erro ao carregar Traffic & SEO:', e);\n    }\n}"
pattern = r'(Erro ao carregar Traffic & SEO:\', e\);\n    \}\n\}).*'
code = re.sub(pattern, r'\1\n', code, flags=re.DOTALL)

with open('admin/admin_cmo_metrics.js', 'w') as f:
    f.write(code)

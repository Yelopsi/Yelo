import re

with open('admin/admin_cmo_metrics.js', 'r') as f:
    code = f.read()

# We need to remove the broken trailing chart JS.
# Let's just find the end of the last valid function.
# The previous valid function was probably something related to rendering other charts.

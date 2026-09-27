import re

with open('backend/controllers/whatsappClickController.js', 'r') as f:
    code = f.read()

old_click = "clickLog.feedbackGiven = true;"
new_click = "clickLog.feedbackGiven = true;\n        if (dealClosed === 'started' && !clickLog.therapyStartedReportedAt) {\n            clickLog.therapyStartedReportedAt = new Date();\n        }"
code = code.replace(old_click, new_click)

with open('backend/controllers/whatsappClickController.js', 'w') as f:
    f.write(code)

with open('backend/controllers/adminDashboardController.js', 'r') as f:
    code = f.read()

old_dash = "log.feedbackGiven = true;"
new_dash = "log.feedbackGiven = true;\n        if (dealClosed === 'started' && !log.therapyStartedReportedAt) {\n            log.therapyStartedReportedAt = new Date();\n        }"
code = code.replace(old_dash, new_dash)

with open('backend/controllers/adminDashboardController.js', 'w') as f:
    f.write(code)


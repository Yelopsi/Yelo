import re

# paymentStateService.js
with open('backend/services/paymentStateService.js', 'r') as f:
    code = f.read()

old_code = "updatePayload.subscribedAt = new Date();\n            }"
new_code = "updatePayload.subscribedAt = new Date();\n            }\n            if (!lockedPsi.profileActivatedAt) {\n                updatePayload.profileActivatedAt = new Date();\n            }"
code = code.replace(old_code, new_code)
with open('backend/services/paymentStateService.js', 'w') as f:
    f.write(code)

# paymentController.js
with open('backend/controllers/paymentController.js', 'r') as f:
    code = f.read()

# For VIP coupon
old_vip = "await localPsychologist.update({ \n                  status: 'active',\n                  plano: 'VIP',\n                  planExpiresAt: new Date('2099-12-31T23:59:59Z'),\n                  is_exempt: true\n            });"
new_vip = "const payload = { \n                  status: 'active',\n                  plano: 'VIP',\n                  planExpiresAt: new Date('2099-12-31T23:59:59Z'),\n                  is_exempt: true\n            };\n            if (!localPsychologist.profileActivatedAt) payload.profileActivatedAt = new Date();\n            await localPsychologist.update(payload);"
code = code.replace(old_vip, new_vip)

# For Trial creation
old_trial = "await localPsychologist.update({ planExpiresAt: trialEndDate, status: 'active' });"
new_trial = "const payload = { planExpiresAt: trialEndDate, status: 'active' };\n            if (!localPsychologist.profileActivatedAt) payload.profileActivatedAt = new Date();\n            await localPsychologist.update(payload);"
code = code.replace(old_trial, new_trial)

with open('backend/controllers/paymentController.js', 'w') as f:
    f.write(code)

# adminUsersController.js
with open('backend/controllers/adminUsersController.js', 'r') as f:
    code = f.read()

old_admin = "await psychologist.update({ \n            planExpiresAt: baseDate,\n            status: 'active'\n        });"
new_admin = "const payload = { planExpiresAt: baseDate, status: 'active' };\n        if (!psychologist.profileActivatedAt) payload.profileActivatedAt = new Date();\n        await psychologist.update(payload);"
code = code.replace(old_admin, new_admin)

with open('backend/controllers/adminUsersController.js', 'w') as f:
    f.write(code)


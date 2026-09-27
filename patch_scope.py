import re

with open('backend/routes/cmoRoutes.js', 'r') as f:
    code = f.read()

# Replace the block where they are declared
code = code.replace(
"""        let simMetaCac = 150;
        let simGoogleCpl = 40;
        let simTrialConv = 0.15;
        let simChurn = 0.05;

        try {""",
"""        let simMetaCac = 150;
        let simGoogleCpl = 40;
        let simTrialConv = 0.15;
        let simChurn = 0.05;
        let simChurnType = 'ASSUMED';
        let renewableSubscriberBase = 0;
        let activePaidAccessBase = 0;
        let knownScheduledChurn = 0;

        try {""")

# Remove the 'const ' from the assignments inside the try block
code = code.replace("const renewableSubscriberBase =", "renewableSubscriberBase =")
code = code.replace("const activePaidAccessBase =", "activePaidAccessBase =")
code = code.replace("const knownScheduledChurn =", "knownScheduledChurn =")
code = code.replace("const simChurnType = 'ASSUMED';", "simChurnType = 'ASSUMED';")

with open('backend/routes/cmoRoutes.js', 'w') as f:
    f.write(code)

print("Scope fixed.")

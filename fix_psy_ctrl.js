const fs = require('fs');
const path = '/Users/andehrson/SITES/Yelo/backend/controllers/psychologistController.js';
let content = fs.readFileSync(path, 'utf8');

const oldLogic = `        await psychologist.update(updatePayload);

        // --- TRANSIÇÃO DE ELEGIBILIDADE (PROFILE ACTIVATED AT) ---
        if (!psychologist.profileActivatedAt) {
            const isEligible = matchService.isEligibleForMatch(psychologist);
            if (isEligible) {
                await psychologist.update({ profileActivatedAt: new Date() });
            }
        }`;

const newLogic = `        // Captura o estado antes do update
        const wasEligible = matchService.isEligibleForMatch(psychologist);

        await psychologist.update(updatePayload);

        // --- TRANSIÇÃO DE ELEGIBILIDADE (PROFILE ACTIVATED AT) ---
        const isEligible = matchService.isEligibleForMatch(psychologist);
        if (!psychologist.profileActivatedAt && !wasEligible && isEligible) {
            await psychologist.update({ profileActivatedAt: new Date() });
        }`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync(path, content);

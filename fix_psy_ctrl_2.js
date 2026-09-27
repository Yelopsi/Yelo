const fs = require('fs');
const path = '/Users/andehrson/SITES/Yelo/backend/controllers/psychologistController.js';
let content = fs.readFileSync(path, 'utf8');

// The logic needs to be moved AFTER the trial activation block.
const trialBlock = `        // --- ATIVAÇÃO DO TRIAL PÓS-CADASTRO (ANTI-ABUSO) ---
        // Se o perfil estava pendente e o profissional preencheu um CPF válido agora, ativa os 7 dias
        if (psychologist.status === 'pending' && cpf && cpf.replace(/\\D/g, '').length >= 11) {
            const trialEndDate = new Date();
            trialEndDate.setDate(trialEndDate.getDate() + 7);
            await psychologist.update({
                status: 'active',
                plano: 'Essencial',
                planExpiresAt: trialEndDate
            });
        }`;

const beforeUpdateBlock = `        // Captura o estado antes do update
        const wasEligible = matchService.isEligibleForMatch(psychologist);

        await psychologist.update(updatePayload);

        // --- TRANSIÇÃO DE ELEGIBILIDADE (PROFILE ACTIVATED AT) ---
        const isEligible = matchService.isEligibleForMatch(psychologist);
        if (!psychologist.profileActivatedAt && !wasEligible && isEligible) {
            await psychologist.update({ profileActivatedAt: new Date() });
        }`;

// 1. Revert what I just did
content = content.replace(beforeUpdateBlock, `        // Captura o estado antes do update
        const wasEligible = matchService.isEligibleForMatch(psychologist);

        await psychologist.update(updatePayload);`);

// 2. Put the transistion logic AFTER the trial block
content = content.replace(trialBlock, trialBlock + `\n\n        // --- TRANSIÇÃO DE ELEGIBILIDADE (PROFILE ACTIVATED AT) ---
        const isEligible = matchService.isEligibleForMatch(psychologist);
        if (!psychologist.profileActivatedAt && !wasEligible && isEligible) {
            await psychologist.update({ profileActivatedAt: new Date() });
        }`);

fs.writeFileSync(path, content);

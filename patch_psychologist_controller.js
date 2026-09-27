const fs = require('fs');
const path = '/Users/andehrson/SITES/Yelo/backend/controllers/psychologistController.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Import matchService
if (!content.includes('const matchService = require(')) {
    content = content.replace("const db = require('../models');", "const db = require('../models');\nconst matchService = require('../services/matchService');");
}

// 2. Insert logic after the update
const targetBlock = `        // --- ATIVAÇÃO DO TRIAL PÓS-CADASTRO (ANTI-ABUSO) ---`;
const replacementBlock = `        // --- TRANSIÇÃO DE ELEGIBILIDADE (PROFILE ACTIVATED AT) ---
        if (!psychologist.profileActivatedAt) {
            const isEligible = matchService.isEligibleForMatch(psychologist);
            if (isEligible) {
                await psychologist.update({ profileActivatedAt: new Date() });
            }
        }

        // --- ATIVAÇÃO DO TRIAL PÓS-CADASTRO (ANTI-ABUSO) ---`;

if (!content.includes('profileActivatedAt: new Date()')) {
    content = content.replace(targetBlock, replacementBlock);
    fs.writeFileSync(path, content);
}

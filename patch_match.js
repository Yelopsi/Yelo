const fs = require('fs');
const path = '/Users/andehrson/SITES/Yelo/backend/services/matchService.js';
let content = fs.readFileSync(path, 'utf8');

const exportStr = `
exports.isEligibleForMatch = (psy) => {
    if (!psy) return false;
    const isVip = psy.is_exempt === true || String(psy.is_exempt).toLowerCase() === 'true';
    const hasActivePlan = isVip || (psy.planExpiresAt && new Date(psy.planExpiresAt) > new Date());
    const validStatus = psy.status === 'active' || psy.status === 'trial';
    const hasMinBio = psy.bio && psy.bio.trim().length >= 10;
    const hasPhoto = psy.fotoUrl && psy.fotoUrl.trim() !== '' && !psy.fotoUrl.includes('placehold.co');
    const hasCpf = psy.cpf && psy.cpf.trim() !== '';

    return validStatus && hasActivePlan && hasMinBio && hasPhoto && hasCpf;
};
`;

if (!content.includes('exports.isEligibleForMatch')) {
    content += exportStr;
    fs.writeFileSync(path, content);
}

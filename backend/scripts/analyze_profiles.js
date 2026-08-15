const db = require('../models');
const { Op } = require('sequelize');

async function analyze() {
    try {
        const names = ["Suzana", "Lucas Neves"];
        
        for (const name of names) {
            console.log(`\n===========================================`);
            console.log(`Buscando: ${name}`);
            console.log(`===========================================`);
            
            const psys = await db.Psychologist.findAll({ 
                where: { nome: { [Op.iLike]: `%${name}%` } } 
            });
            
            if (psys.length === 0) {
                console.log(`❌ Perfil não encontrado no banco de dados.`);
                continue;
            }
            
            for (const psy of psys) {
                console.log(`\nID: ${psy.id} | Nome: ${psy.nome}`);
                console.log(`Status: ${psy.status}`);
                console.log(`Is Exempt: ${psy.is_exempt}`);
                console.log(`Plan Expires At: ${psy.planExpiresAt}`);
                
                const hasPhoto = psy.fotoUrl && psy.fotoUrl.trim() !== '' && !psy.fotoUrl.includes('placehold.co');
                console.log(`Foto válida? ${hasPhoto ? '✅ Sim' : '❌ Não'} (${psy.fotoUrl})`);
                
                const bioLen = psy.bio ? psy.bio.length : 0;
                const hasMinBio = bioLen >= 10;
                console.log(`Bio válida? ${hasMinBio ? '✅ Sim' : '❌ Não'} (${bioLen} caracteres)`);
                
                const isVip = psy.is_exempt === true || String(psy.is_exempt).toLowerCase() === 'true';
                const hasActivePlan = isVip || (psy.planExpiresAt && new Date(psy.planExpiresAt) > new Date());
                console.log(`Plano Ativo válido? ${hasActivePlan ? '✅ Sim' : '❌ Não'}`);
                
                if (!hasActivePlan || !hasPhoto || !hasMinBio) {
                    console.log(`🚨 PENALIZADO PELO MATCH ENGINE 🚨`);
                } else {
                    console.log(`✅ ATENDE AOS REQUISITOS MÍNIMOS`);
                }
            }
        }
        
        process.exit(0);
    } catch (e) {
        console.error("Erro:", e);
        process.exit(1);
    }
}

analyze();

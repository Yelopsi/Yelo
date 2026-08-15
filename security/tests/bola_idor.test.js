const fs = require('fs');
const path = require('path');

console.log('  🔍 Iniciando Scanner Global de BOLA/IDOR & Mass Assignment...');

let hasFailed = false;

const checkControllerLogic = () => {
    const controllerDir = path.join(__dirname, '../../backend/controllers');
    const files = fs.readdirSync(controllerDir).filter(f => f.endsWith('.js'));
    
    for (const file of files) {
        const fullPath = path.join(controllerDir, file);
        const content = fs.readFileSync(fullPath, 'utf-8');
        
        // Ignora meta_test_runner gerando redteam_fixture_controller se for o caso
        if (file.includes('meta_test')) continue;

        let lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // 1. Mass Assignment Direto
            if (line.match(/\.update\(\s*req\.body\s*\)/) || line.match(/\.create\(\s*req\.body\s*\)/)) {
                console.error(`    ❌ FALHA: Mass Assignment detectado em ${file}:${i+1} -> ${line.trim()}`);
                hasFailed = true;
            }
            
            // 2. Potential BOLA/IDOR (findByPk com req.params.id)
            if ((line.match(/\.findByPk\(\s*req\.params\.id\s*\)/) || line.match(/\.findOne\(\s*\{\s*where\s*:\s*\{\s*id\s*:\s*req\.params\.id/)) && !line.includes('BOLA-Safe')) {
                // Heurística fraca para ver se nas próximas 10 linhas existe um check de ownership (ex: req.user.id)
                let ownershipChecked = false;
                for (let j = i; j < Math.min(i + 15, lines.length); j++) {
                    const checkLine = lines[j].trim();
                    if (checkLine.startsWith('//') || checkLine.startsWith('/*') || checkLine.startsWith('*')) continue; // ignora comentários

                    if (checkLine.includes('req.user.id') || checkLine.includes('req.psychologist.id') || checkLine.includes('req.patient.id')) {
                        ownershipChecked = true;
                        break;
                    }
                }
                
                if (!ownershipChecked) {
                    console.error(`    ❌ FALHA: Potencial BOLA/IDOR detectado em ${file}:${i+1}. Falta ownership check nas linhas subsequentes -> ${line.trim()}`);
                    hasFailed = true;
                } else {
                    console.log(`    ⚠️ POTENTIAL BOLA/IDOR (Mas Ownership Check detectado) em ${file}:${i+1}`);
                }
            }
        }
    }
};

checkControllerLogic();

if (hasFailed) {
    process.exit(1);
} else {
    process.exit(0);
}

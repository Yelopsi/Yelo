const fs = require('fs');
const path = require('path');

console.log('  🔍 Iniciando SAST Heurístico (Coverage: Partial)...');

// Este não é um SAST completo, apenas regex para encontrar chamadas perigosas óbvias
const targetDirs = ['backend/controllers', 'backend/routes']; 
let foundSastIssues = false;

const sastPatterns = [
    { name: 'Potential SQL Injection (raw queries without replacements)', regex: /sequelize\.query\s*\(\s*[`'"][^`'"]*\$\{.*?\}[^`'"]*[`'"]\s*\)/i }, // interpolação direta no SQL
    { name: 'Insecure Eval', regex: /eval\s*\(/i },
    { name: 'Command Injection (exec/spawn)', regex: /(exec|spawn|execSync)\s*\(\s*req\.body/i }, // Pega do user input
    { name: 'XSS Risk (innerHTML no backend?)', regex: /\.innerHTML\s*=/i },
    { name: 'Potential SSRF (fetch com user input na url)', regex: /fetch\s*\(\s*(req\.body|req\.query)/i }
];

const scanDir = (dir) => {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            scanDir(fullPath);
        } else if (fullPath.endsWith('.js')) {
            try {
                const content = fs.readFileSync(fullPath, 'utf-8');
                let lineNumber = 1;
                
                for (const line of content.split('\n')) {
                    for (const pattern of sastPatterns) {
                        if (pattern.regex.test(line)) {
                            console.log(`  🚨 [SAST] Vulnerabilidade potencial (${pattern.name}) em ${fullPath}:${lineNumber}`);
                            foundSastIssues = true;
                        }
                    }
                    lineNumber++;
                }
            } catch (e) { }
        }
    }
};

for (const dir of targetDirs) {
    const absDir = path.join(process.cwd(), dir);
    if (fs.existsSync(absDir)) {
        scanDir(absDir);
    }
}

if (foundSastIssues) {
    process.exit(1);
} else {
    process.exit(0);
}

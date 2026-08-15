const fs = require('fs');
const path = require('path');

console.log('  🔍 Iniciando Privacy Scanner (LGPD/Data Minimization)...');

const targetDirs = ['backend/controllers', 'backend/routes', 'backend/models'];
let hasCriticalOrHigh = false;

// Classificação: CRITICAL, HIGH, MEDIUM, LOW, REVIEW
const privacyPatterns = [
    { name: 'Logging Sensitive Request Body', regex: /console\.log\([^)]*req\.body/i, severity: 'HIGH' },
    { name: 'Logging Specific PII', regex: /console\.log\([^)]*(cpf|password|senha|creditCard|telefone)\b/i, severity: 'HIGH' },
    { name: 'Overfetching sem attributes.exclude', regex: /findAll\(\s*\{[^\}]*\}[^\}]*\)/i, severity: 'REVIEW' }, 
    { name: 'Return whole user object', regex: /res\.json\(\s*(user|patient|psychologist)\s*\)/i, severity: 'MEDIUM' }
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
                    if (line.trim().startsWith('//')) { lineNumber++; continue; }
                    
                    for (const pattern of privacyPatterns) {
                        if (pattern.regex.test(line)) {
                            if (pattern.name === 'Overfetching sem attributes.exclude' && line.includes('exclude')) continue;
                            if (pattern.name === 'Return whole user object' && line.includes('toJSON')) continue;

                            console.log(`  [${pattern.severity}] [PRIVACY] Risco LGPD (${pattern.name}) em ${fullPath}:${lineNumber}`);
                            if (pattern.severity === 'CRITICAL' || pattern.severity === 'HIGH') {
                                hasCriticalOrHigh = true;
                            }
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
    if (fs.existsSync(absDir)) { scanDir(absDir); }
}

if (hasCriticalOrHigh) {
    console.log('  🚨 [PRIVACY] Bloqueado devido a violações CRÍTICAS/HIGH de privacidade.');
    process.exit(1);
} else {
    console.log('  ✅ [PRIVACY] Passou (Mas verifique os alertas de REVIEW/MEDIUM).');
    process.exit(0);
}

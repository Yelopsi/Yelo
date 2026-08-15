const fs = require('fs');
const path = require('path');

console.log('  🔍 Iniciando varredura de segredos (Heuristic/Regex)...');

const targetDirs = ['backend', 'scripts']; // Diretorios para checar
const ignoredDirs = ['node_modules', 'dist', 'build', '.git'];

const secretPatterns = [
    { name: 'Generic Secret', regex: /(secret|password|pass|token|apikey|api_key|pwd|pw)['"\s:=]+(['"][a-zA-Z0-9_\-\.]{20,}['"])/i },
    { name: 'Database Connection String', regex: /(postgresql|mysql|mongodb)(\+srv)?:\/\/[^:\/\n]+:[^@\n]+@[^:\/\n]+/i },
    { name: 'JWT Secret', regex: /JWT_SECRET\s*=\s*['"][a-zA-Z0-9_\-\.]+['"]/i },
    { name: 'Asaas API Key', regex: /\$aact_[a-zA-Z0-9]+/i }, // Formato das chaves Asaas
    { name: 'Google OAuth Secret', regex: /GOCSPX-[a-zA-Z0-9\-_]{20,}/i }
];

let foundSecrets = false;

const scanDir = (dir) => {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            if (!ignoredDirs.includes(file)) {
                scanDir(fullPath);
            }
        } else if (fullPath.endsWith('.js') || fullPath.endsWith('.json') || fullPath.endsWith('.env')) {
            // Ignora arquivos do filter-repo se sobrarem
            if (fullPath.includes('git-filter-repo')) continue;
            if (fullPath.endsWith('.env') && process.env.NODE_ENV !== 'production') {
                // Em ambiente dev, podemos ignorar o .env, mas em CI/CD o .env não deveria existir no repo.
                // Se existe no repositório sendo scaneado, é um risco.
            }

            try {
                const content = fs.readFileSync(fullPath, 'utf-8');
                let lineNumber = 1;
                
                for (const line of content.split('\n')) {
                    // Ignora linhas de imports/requires e mocks
                    if (line.includes('require(') || line.includes('import ') || line.includes('mock') || line.includes('test')) {
                         lineNumber++;
                         continue; 
                    }
                    
                    for (const pattern of secretPatterns) {
                        const match = line.match(pattern.regex);
                        if (match) {
                            // Verifica se é uma env var (process.env.XXX) e não a string literal
                            if (!line.includes('process.env.')) {
                                console.log(`  🚨 [SECRET SCAN] Segredo detectado (${pattern.name}) em ${fullPath}:${lineNumber}`);
                                foundSecrets = true;
                            }
                        }
                    }
                    lineNumber++;
                }
            } catch (e) {
                // Ignore arquivos binarios ou inlegiveis
            }
        }
    }
};

for (const dir of targetDirs) {
    if (fs.existsSync(path.join(__dirname, '../../', dir))) {
        scanDir(path.join(__dirname, '../../', dir));
    } else if (fs.existsSync(path.join(process.cwd(), dir))) {
        scanDir(path.join(process.cwd(), dir));
    }
}

if (foundSecrets) {
    process.exit(1);
} else {
    process.exit(0);
}

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('  🔍 Iniciando varredura de segredos (Heuristic/Regex/Signatures)...');

const ignoredDirs = new Set([
    'node_modules',
    'dist',
    'build',
    '.git',
    '.cache',
    '.vscode',
    '.wwebjs_cache',
    'uploads',
    'scratch'
]);

const ignoredFilePatterns = [
    /package-lock\.json$/,
    /\.test\.js$/,
    /secret_scanner\.js$/,
    /gate_report\.json$/,
    /npm_audit\.json/,
    /system_changelog\.json$/,
    /^\.env(\.|$)/, // Arquivos locais de env protegidos por .gitignore
    /^check_.*\.js$/, // Scripts temporários locais em .gitignore
    /^query_.*\.js$/  // Scripts temporários locais em .gitignore
];

const secretPatterns = [
    {
        name: 'Google Places / Cloud API Key',
        regex: /\bAIza[0-9A-Za-z\-_]{35}\b/
    },
    {
        name: 'Google OAuth Client Secret',
        regex: /\bGOCSPX-[a-zA-Z0-9\-_]{20,}\b/
    },
    {
        name: 'Asaas API Key / Token',
        regex: /\$aact_[0-9a-zA-Z_\-=\/]{20,}/i
    },
    {
        name: 'Stripe Secret Key',
        regex: /\b[sr]k_(live|test)_[0-9a-zA-Z]{24,}\b/
    },
    {
        name: 'Database Connection String with Credentials',
        regex: /(postgresql|postgres|mysql|mongodb)(\+srv)?:\/\/[^:\/\s"']+:[^@\/\s"']+@[^:\/\s"']+/i
    },
    {
        name: 'JWT Secret Literal Assignment',
        regex: /JWT_SECRET\s*[:=]\s*['"][a-zA-Z0-9_\-\.]{10,}['"]/i
    },
    {
        name: 'AWS Access Key ID',
        regex: /\b(AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/
    },
    {
        name: 'GitHub Personal Access Token',
        regex: /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{82}\b/
    },
    {
        name: 'Private Key Block',
        regex: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/
    },
    {
        name: 'Hardcoded Secret in Env Fallback',
        regex: /process\.env\.[A-Za-z0-9_]*(KEY|SECRET|PASSWORD|PASS|TOKEN)[A-Za-z0-9_]*\s*\|\|\s*['"][a-zA-Z0-9_\-]{16,}['"]/i
    },
    {
        name: 'Hardcoded Secret Assignment',
        regex: /(['"]?(?:api_?key|api_?secret|client_?secret|jwt_?secret|auth_?token|app_?secret)['"]?\s*[:=]\s*)['"][a-zA-Z0-9_\-]{24,}['"]/i
    }
];

let foundSecrets = false;

// Obter lista de arquivos para analisar
function getFilesToScan() {
    const candidateFiles = new Set();
    const rootDir = path.resolve(__dirname, '../../');

    // Tenta usar git para listar arquivos rastreados e modificados/staged
    try {
        const tracked = execSync('git ls-files', { cwd: rootDir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] })
            .split('\n')
            .map(f => f.trim())
            .filter(Boolean);

        for (const file of tracked) {
            candidateFiles.add(path.resolve(rootDir, file));
        }

        const statusOutput = execSync('git status --porcelain', { cwd: rootDir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] })
            .split('\n');

        for (const line of statusOutput) {
            if (!line) continue;
            const status = line.substring(0, 2);
            if (status.includes('!')) continue; // Ignorados
            const relPath = line.substring(3).trim();
            if (relPath && !status.includes('D')) {
                candidateFiles.add(path.resolve(rootDir, relPath));
            }
        }
    } catch (e) {
        // Fallback: varredura direta se git não estiver presente
        const scanFallback = (dir) => {
            const entries = fs.readdirSync(dir);
            for (const entry of entries) {
                if (ignoredDirs.has(entry)) continue;
                const full = path.join(dir, entry);
                const stat = fs.statSync(full);
                if (stat.isDirectory()) {
                    scanFallback(full);
                } else {
                    candidateFiles.add(full);
                }
            }
        };
        scanFallback(rootDir);
    }

    return Array.from(candidateFiles);
}

const files = getFilesToScan();
const scannableExtensions = new Set(['.js', '.json', '.env', '.ejs', '.html', '.cjs', '.mjs']);

for (const fullPath of files) {
    const fileName = path.basename(fullPath);
    const ext = path.extname(fullPath);

    if (!scannableExtensions.has(ext)) continue;
    if (ignoredFilePatterns.some(pattern => pattern.test(fullPath) || pattern.test(fileName))) continue;
    if (!fs.existsSync(fullPath)) continue;

    try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        let lineNumber = 1;

        for (const line of content.split('\n')) {
            // Ignora require e import para evitar falsos positivos em pacotes
            if (line.includes('require(') || line.includes('import ') || line.includes('// mock')) {
                lineNumber++;
                continue;
            }

            for (const pattern of secretPatterns) {
                if (pattern.regex.test(line)) {
                    console.log(`  🚨 [SECRET SCAN] Segredo detectado (${pattern.name}) em ${fullPath}:${lineNumber}`);
                    foundSecrets = true;
                }
            }
            lineNumber++;
        }
    } catch (e) {
        // Ignora arquivos ilegíveis
    }
}

if (foundSecrets) {
    console.log('\n  ❌ Falha no scanner de segredos: remova os segredos ou credenciais expostas antes do deploy.');
    process.exit(1);
} else {
    console.log('  ✅ Nenhum segredo exposto detectado.');
    process.exit(0);
}

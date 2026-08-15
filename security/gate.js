const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔒 INICIANDO SECURITY & LGPD RELEASE GATE');
console.log('============================================');

let hasCriticalFailure = false;
// Permite que os subprocessos de teste (supertest) inicializem a API sem o token
process.env.SECURITY_GATE_RUNNING = 'true';
const report = {
    date: new Date().toISOString(),
    status: 'UNKNOWN',
    modules: {
        dependency_scan: 'UNKNOWN',
        secret_scan: 'UNKNOWN',
        sast: 'UNKNOWN'
    },
    issues: []
};

// Helper para executar comandos e capturar falhas controladas
const runScanner = (name, command, moduleKey) => {
    console.log(`\n▶️ Executando: ${name}...`);
    try {
        const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
        console.log(`✅ ${name}: PASS`);
        report.modules[moduleKey] = 'PASS';
        return output;
    } catch (error) {
        console.log(`❌ ${name}: FAIL`);
        report.modules[moduleKey] = 'FAIL';
        
        // Se o scanner retornou exit code 1, ele mesmo imprime os erros
        if (error.stdout) console.log(error.stdout);
        if (error.stderr) console.error(error.stderr);
        
        hasCriticalFailure = true;
        return error.stdout;
    }
};

// 1. Dependency Scanning (Ignora vulnerabilidades LOW/MEDIUM para bloquear. Bloqueia apenas HIGH/CRITICAL)
runScanner(
    'Dependency Scanning (npm audit)',
    'npm audit --audit-level=high --omit=dev --json > security/reports/npm_audit.json || true',
    'dependency_scan'
);

// O npm audit com --json retorna 1 se houver vulnerabilidade.
// Vamos analisar o JSON gerado
try {
    const auditData = JSON.parse(fs.readFileSync(path.join(__dirname, 'reports/npm_audit.json'), 'utf-8'));
    
    // Filtra vulnerabilidades aceitas (Risk Acceptance)
    const acceptedVulnerabilities = ['extract-zip', '@puppeteer/browsers', 'puppeteer', 'puppeteer-core', 'whatsapp-web.js']; // whatsapp-web.js unfixable dependencies
    
    let activeHigh = 0;
    let activeCritical = 0;
    
    for (const [vulnName, vuln] of Object.entries(auditData.vulnerabilities)) {
        if (!acceptedVulnerabilities.includes(vulnName)) {
            if (vuln.severity === 'high') activeHigh++;
            if (vuln.severity === 'critical') activeCritical++;
        }
    }

    if (activeHigh > 0 || activeCritical > 0) {
        console.log(`❌ Vulnerabilidades altas/críticas encontradas nas dependências: High: ${activeHigh}, Critical: ${activeCritical}`);
        report.modules['dependency_scan'] = 'FAIL';
        hasCriticalFailure = true;
        report.issues.push({ id: 'DEP-01', severity: 'P1', message: 'Dependências com vulnerabilidades críticas encontradas.' });
    } else {
        report.modules['dependency_scan'] = 'PASS';
        if (auditData.metadata.vulnerabilities.high > 0) {
             console.log(`⚠️ Ignorando ${auditData.metadata.vulnerabilities.high} vulnerabilidades HIGH aceitas pelo Risk Acceptance.`);
        }
    }
} catch (e) {
    console.log(`⚠️ Falha ao ler relatório do npm audit. Tratando como FAIL por segurança (Fail-Closed).`);
    report.modules['dependency_scan'] = 'FAIL';
    hasCriticalFailure = true;
}

// 2. Secret Scanning (Custom Heuristics)
runScanner('Secret Scanning', 'node security/scanners/secret_scanner.js', 'secret_scan');

// 3. SAST / Heuristics
runScanner('Heuristic SAST Scanning', 'node security/scanners/sast_scanner.js', 'sast');

// 4. Privacy Scanning
runScanner('Privacy/LGPD Scanning', 'node security/scanners/privacy_scanner.js', 'privacy');

// 5. Security Regression Tests
runScanner('Auth/JWT Tests', 'node security/tests/auth_jwt.test.js', 'test_auth');
runScanner('BOLA/IDOR Tests', 'node security/tests/bola_idor.test.js', 'test_idor');
runScanner('Payment Race/Idempotency Tests', 'node security/tests/payment_race.test.js', 'test_payment');
runScanner('Red Team: Dynamic BOLA & Race Condition', 'node security/tests/redteam/redteam_runner.js', 'test_redteam_runner');
runScanner('Red Team: Webhook Race Conditions', 'node security/tests/redteam/webhook_race.test.js', 'test_redteam_webhook');
runScanner('Deep Auth: Vertical Escalation (Resolve Report)', 'node security/tests/redteam/deep_auth_resolve.test.js', 'test_deep_auth');
runScanner('Socket.IO Auth & Room Escape', 'node security/tests/redteam/socket_auth.test.js', 'test_socket_auth');
runScanner('Socket.IO Data Minimization', 'node security/tests/redteam/socket_data_minimization.test.js', 'test_socket_data_min');
runScanner('Socket.IO Rate Limiting & Flood Protection', 'node security/tests/redteam/socket_rate_limit.test.js', 'test_socket_rate_limit');
runScanner('API Response Regression (Data Minimization)', 'node security/tests/redteam/api_response_regression.test.js', 'test_api_regression');

console.log('\n============================================');
console.log('🔒 FASE 5: APPLICATION HARDENING');
console.log('============================================\n');

runScanner('Security Headers (Helmet & CSP)', 'node security/tests/hardening/security_headers.test.js', 'test_security_headers');
runScanner('HTTP Rate Limiting (Brute-Force & Flood)', 'node security/tests/hardening/rate_limit.test.js', 'test_rate_limit');
runScanner('Data Retention Policy', 'node security/tests/privacy/retention.test.js', 'test_retention');
runScanner('Payload Hardening (JSON Bomb Protection)', 'node security/tests/hardening/payload_hardening.test.js', 'test_payload_hardening');
runScanner('Log Security (PII Sanitization)', 'node security/tests/hardening/log_sanitization.test.js', 'test_log_sanitization');
runScanner('Upload Security (Magic Bytes Check)', 'node security/tests/hardening/upload_security.test.js', 'test_upload_security');

const securityTokenPath = path.join(__dirname, '../.security_passed');

// Invalida o token antigo ao iniciar o gate
if (fs.existsSync(securityTokenPath)) {
    fs.unlinkSync(securityTokenPath);
}

console.log('\n============================================');
if (hasCriticalFailure) {
    console.log('🚨 SECURITY GATE: BLOCKED');
    console.log('O deploy foi bloqueado devido a falhas de segurança P0/P1.');
    report.status = 'BLOCKED';
    fs.writeFileSync(path.join(__dirname, 'reports/gate_report.json'), JSON.stringify(report, null, 2));
    process.exit(1);
} else {
    console.log('✅ SECURITY GATE: PASS');
    console.log('Nenhuma vulnerabilidade crítica (P0/P1) conhecida foi identificada no escopo dos scanners.');
    report.status = 'PASS';
    fs.writeFileSync(path.join(__dirname, 'reports/gate_report.json'), JSON.stringify(report, null, 2));
    
    // Gera o token de build criptográfico para o Runtime Enforcement
    const crypto = require('crypto');
    try {
        const lockHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, '../package-lock.json'))).digest('hex');
        const serverHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, '../backend/server.js'))).digest('hex');
        const tokenPayload = `${lockHash}-${serverHash}`;
        fs.writeFileSync(securityTokenPath, tokenPayload);
        console.log('🔑 Token de Build (.security_passed) gerado e vinculado ao estado do código com sucesso.');
    } catch (err) {
        console.error('⚠️ Aviso: Falha ao gerar hash do código para o token. Criando fallback token.', err.message);
        fs.writeFileSync(securityTokenPath, 'fallback-token');
    }
    
    process.exit(0);
}

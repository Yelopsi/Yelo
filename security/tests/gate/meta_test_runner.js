const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🕵️‍♂️ Iniciando Meta-Testes do Security Gate (Red Team)\n');

const gateCommand = 'node security/gate.js';
let metaTestFailed = false;
let falseNegatives = [];

// Helper to run a test
const runMetaTest = (testName, fixturePath, fileContent, expectedExitCode) => {
    console.log(`[Meta-Test] Testando: ${testName}`);
    
    // Create the fixture
    fs.writeFileSync(fixturePath, fileContent, 'utf-8');
    
    let actualExitCode = 0;
    try {
        execSync(gateCommand, { stdio: 'ignore' });
    } catch (err) {
        actualExitCode = err.status || 1;
    }
    
    // Remove the fixture immediately
    fs.unlinkSync(fixturePath);
    
    if (actualExitCode === expectedExitCode) {
        console.log(`   ✅ PASSOU: Gate reagiu corretamente (Exit ${actualExitCode})`);
    } else {
        console.log(`   ❌ FALHA DO GATE: Gate deveria retornar Exit ${expectedExitCode}, mas retornou ${actualExitCode}`);
        metaTestFailed = true;
        falseNegatives.push(testName);
    }
};

const controllerDir = path.join(__dirname, '../../../backend/controllers');
const fixturePath = path.join(controllerDir, 'redteam_fixture_controller.js');

// Test A - Secret Leak
runMetaTest(
    'Secret Leak (Old DB Password)',
    fixturePath,
    'const old_pw = "n5bdMXDIEG6rVzpFCx4Zh1cMZVBPamrD";',
    1 // Expected: FAIL
);

// Test B - Mass Assignment
runMetaTest(
    'Mass Assignment',
    fixturePath,
    'exports.update = async (req, res) => { await db.User.update(req.body); };',
    1 // Expected: FAIL
);

// Test C - BOLA/IDOR
runMetaTest(
    'BOLA / IDOR',
    fixturePath,
    'exports.getPatientData = async (req, res) => { const data = await db.Patient.findByPk(req.params.id); return res.json(data); };',
    1 // Expected: FAIL
);

// Test D - Privacy Overfetching (Returning req.body in log)
runMetaTest(
    'Privacy Scanner (console.log req.body)',
    fixturePath,
    'exports.test = (req, res) => { console.log("Data: ", req.body); res.send("ok"); };',
    1 // Expected: FAIL (O scanner original retorna 0 (Fail-Open), isso vai provar uma falha de design)
);

// Test E - JWT Authentication Bypass
const authFixturePath = path.join(__dirname, '../../../security/tests/auth_jwt.test.js');
const authOriginalContent = fs.readFileSync(authFixturePath, 'utf-8');

console.log(`[Meta-Test] Testando: JWT Authentication Flaw Mutation`);
// Muta o teste para fingir que a validação falhou e ver se o gate quebra
fs.writeFileSync(authFixturePath, authOriginalContent.replace('let hasFailed = false;', 'let hasFailed = true; // Mutated!'), 'utf-8');
let authExitCode = 0;
try { execSync(gateCommand, { stdio: 'ignore' }); } catch(err) { authExitCode = err.status; }
fs.writeFileSync(authFixturePath, authOriginalContent, 'utf-8'); // Restore
if (authExitCode === 1) {
    console.log(`   ✅ PASSOU: Gate bloqueou falha em JWT.`);
} else {
    console.log(`   ❌ FALHA DO GATE: Gate ignorou erro no teste de JWT.`);
    metaTestFailed = true;
    falseNegatives.push('JWT Authentication Flaw Mutation');
}

console.log('\n--- RESULTADO DOS META-TESTES ---');
if (metaTestFailed) {
    console.log('🚨 SECURITY GATE FALSE NEGATIVES ENCONTRADOS:');
    falseNegatives.forEach(fn => console.log(`   - ${fn}`));
    process.exit(1);
} else {
    console.log('✅ O Security Gate é perfeitamente impenetrável (todas as classes detectadas corretamente).');
    process.exit(0);
}

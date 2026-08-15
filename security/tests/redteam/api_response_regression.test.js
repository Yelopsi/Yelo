const assert = require('assert');
const request = require('supertest');
const express = require('express');

console.log('🔴 INICIANDO DEEP RED TEAM: API RESPONSE REGRESSION (DATA MINIMIZATION) 🔴\n');

const app = express();
app.use(express.json());

// Monkey-patch do middleware de autenticação ANTES de requerer as rotas
const authModule = require('../../../backend/middlewares/localAuth');
authModule.verifyTokenLocal = (req, res, next) => {
    req.userDecoded = { id: 1, type: 'psychologist' };
    next();
};

const myPatientsRoutes = require('../../../backend/routes/myPatientsRoutes');

// Mock User e bypass do Middleware de autenticação real
let mockUser = { id: 1, type: 'psychologist' };
app.use((req, res, next) => {
    req.userDecoded = mockUser;
    
    // Mock DB localmente
    const db = require('../../../backend/models');
    db.Patient = { 
        findAll: async (opts) => {
            // Simula o comportamento do Sequelize. 
            // Se o controller pedir campos proibidos (ex: sem attributes/allowlist), a gente devolve. 
            // A responsabilidade de limitar é da chamada do Sequelize, mas como mockamos, 
            // validaremos se a opção `attributes` foi passada corretamente.
            if (!opts.attributes || !Array.isArray(opts.attributes)) {
                return [{ id: 10, nome: 'Paciente A', senha: 'hash_vazado', is_ghost_profile: true }];
            }
            // Se passou a AllowList, filtramos
            const patient = { id: 10, nome: 'Paciente A', senha: 'hash_vazado', is_ghost_profile: true };
            const filtered = {};
            opts.attributes.forEach(attr => { if (patient[attr] !== undefined) filtered[attr] = patient[attr]; });
            return [filtered];
        }
    };
    next();
});

app.use('/api/my-patients', myPatientsRoutes);

const runTests = async () => {
    try {
        console.log('[RED TEAM] Teste A: Requisição GET /api/my-patients (Verificando vazamento de senha)');
        
        const res = await request(app).get('/api/my-patients');
        
        assert.strictEqual(res.statusCode, 200, `FALHA: Status inesperado ${res.statusCode}`);
        
        const patientData = res.body[0];
        
        // Regressão: O campo senha NUNCA pode existir na resposta
        if (patientData.hasOwnProperty('senha')) {
            throw new Error('Vazamento de PII Detectado: O campo "senha" foi retornado pela API.');
        }

        // Regressão: O campo interno is_ghost_profile também não faz parte da AllowList
        if (patientData.hasOwnProperty('is_ghost_profile')) {
            throw new Error('Vazamento de Dados Internos Detectado: O campo "is_ghost_profile" vazou.');
        }

        console.log('   ✅ PASSOU: PII e campos internos omitidos com sucesso (Allowlist Ativa).');

        console.log('\n✅ DATA MINIMIZATION VERIFICADO E BLINDADO.');
        process.exit(0);

    } catch (err) {
        console.error('\n❌ SECURITY FAILURE: ' + err.message);
        process.exit(1);
    }
};

runTests();

const assert = require('assert');
const request = require('supertest');
const express = require('express');

// Precisamos mockar as dependências para não rodar o server completo, 
// queremos testar só o router e os middlewares puros.
const forumRoutes = require('../../../backend/routes/forumRoutes');
const { protect, admin } = require('../../../backend/middlewares/authMiddleware');

console.log('🔴 INICIANDO DEEP RED TEAM: RESOLVE REPORT AUTORIZAÇÃO VERTICAL 🔴\n');

// 1. Criamos um mini-app Express puro focado apenas em testar a esteira de Middlewares
const app = express();
app.use(express.json());

// Injetamos um middleware fake que simula os diferentes tipos de tokens decodificados
let mockUser = null;
const jwt = require('jsonwebtoken');
const MOCK_SECRET = 'deep_red_team_secret';
process.env.JWT_SECRET = MOCK_SECRET;

app.use((req, res, next) => {
    req.cookies = {}; // mock do cookie-parser
    
    // O mockUser define quem somos nesta requisição
    if (mockUser) {
        req.cookies.token = jwt.sign(mockUser, MOCK_SECRET);
        req.user = mockUser; 
        
        // Mock do banco de dados invocado no protect()
        const db = require('../../../backend/models');
        db.Patient = { findByPk: async () => (mockUser.type === 'patient' ? mockUser : null) };
        db.Psychologist = { findByPk: async () => ((mockUser.type === 'psychologist' || mockUser.type === 'admin') ? mockUser : null) };
        db.sequelize = { query: async () => [[mockUser]] }; 
    }
    next();
});

// Mock da função do controller para não bater no DB
const forumController = require('../../../backend/controllers/forumController');
forumController.resolveReport = (req, res) => res.status(200).json({ success: true, msg: 'Report resolvido' });

app.use('/api/forum', forumRoutes);

const runTests = async () => {
    try {
        console.log('[RED TEAM] Teste A: Usuário Anônimo (Sem Token) acessando /resolve');
        mockUser = null;
        let res = await request(app).post('/api/forum/admin/reports/1/resolve').set('Origin', 'https://www.yelopsi.com.br').send({ action: 'dismiss' });
        assert.strictEqual(res.statusCode, 401, `FALHA: Anônimo obteve status ${res.statusCode}`);
        console.log('   ✅ PASSOU: Anônimo bloqueado (401).');

        console.log('[RED TEAM] Teste B: Paciente acessando /resolve');
        mockUser = { id: 1, type: 'patient' };
        res = await request(app).post('/api/forum/admin/reports/1/resolve').set('Origin', 'https://www.yelopsi.com.br').send({ action: 'dismiss' });
        assert.strictEqual(res.statusCode, 403, `FALHA: Paciente obteve status ${res.statusCode}`);
        console.log('   ✅ PASSOU: Paciente bloqueado (403).');

        console.log('[RED TEAM] Teste C: Psicólogo Comum acessando /resolve');
        mockUser = { id: 2, type: 'psychologist', isAdmin: false };
        res = await request(app).post('/api/forum/admin/reports/1/resolve').set('Origin', 'https://www.yelopsi.com.br').send({ action: 'dismiss' });
        assert.strictEqual(res.statusCode, 403, `FALHA: Psicólogo obteve status ${res.statusCode}`);
        console.log('   ✅ PASSOU: Psicólogo bloqueado (403).');

        console.log('[RED TEAM] Teste D: Psicólogo ADMIN acessando /resolve');
        mockUser = { id: 3, type: 'admin', isAdmin: true };
        res = await request(app).post('/api/forum/admin/reports/1/resolve').set('Origin', 'https://www.yelopsi.com.br').send({ action: 'dismiss' });
        assert.ok([200, 404].includes(res.statusCode), `FALHA: Admin obteve status ${res.statusCode} invés de 200 ou 404`);
        console.log('   ✅ PASSOU: Admin obteve acesso (Status ' + res.statusCode + ' - Acesso Permitido ao DB).');

        console.log('\n✅ MATRIZ DE AUTORIZAÇÃO "RESOLVE REPORT" VERIFICADA E INQUEBRÁVEL.');
        process.exit(0);

    } catch (err) {
        console.error('\n❌ SECURITY FAILURE: Rota admin exposta a escalada de privilégio.');
        console.error(err.message);
        process.exit(1);
    }
};

runTests();

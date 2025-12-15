// backend/server.js (VERSÃO PRIORITÁRIA)

require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { initSocket } = require('./config/socket');
const cors = require('cors');

// Banco de Dados
const db = require('./models');

// Importação de Rotas
const patientRoutes = require('./routes/patientRoutes');
const psychologistRoutes = require('./routes/psychologistRoutes');
const messagingRoutes = require('./routes/messagingRoutes');
const messageRoutes = require('./routes/messageRoutes');
const demandRoutes = require('./routes/demandRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const adminRoutes = require('./routes/adminRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const qnaRoutes = require('./routes/qnaRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const supportRoutes = require('./routes/supportRoutes');
const adminSupportRoutes = require('./routes/adminSupportRoutes');

// Controllers
const demandController = require('./controllers/demandController');
const seedTestData = require('./controllers/seed_test_data');

const app = express();

// --- ADICIONE ISTO ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
// ---------------------

console.log('[DEPLOY_SYNC] Versão Final Prioritária - v3.1');
const server = http.createServer(app);

initSocket(server);

// --- MIDDLEWARES ---
app.use(cors());

// Isso permite que a gente pegue o 'rawBody' apenas na rota do webhook
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));
app.use(express.text({ type: 'application/json' }));
app.use(express.urlencoded({ extended: true }));

// =============================================================
// 🚨 ROTAS DE EMERGÊNCIA (DESATIVADAS PARA PRODUÇÃO) 🚨
// =============================================================

 // COMENTE TUDO ISTO AQUI PARA NINGUÉM ACESSAR:

app.get('/api/fix-activate-psis', async (req, res) => { /* ... */ });

app.get('/fix-db-columns', async (req, res) => { /* ... */ });

app.get('/api/fix-vip-all', async (req, res) => { /* ... */ });

app.get('/api/fix-reset-payment', async (req, res) => { /* ... */ });

// Rota para criar a coluna CNPJ se ela não existir
app.get('/api/fix-add-cnpj-column', async (req, res) => {
    try {
        await db.sequelize.query('ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "cnpj" VARCHAR(255) UNIQUE;');
        res.send("Sucesso! Coluna CNPJ criada no banco de dados.");
    } catch (error) {
        res.status(500).send("Erro ao criar coluna: " + error.message);
    }
});

// Rota para criar a coluna MODALIDADE (Online/Presencial)
app.get('/api/fix-add-modalidade-column', async (req, res) => {
    try {
        // Cria coluna do tipo JSONB para aceitar arrays como ["Online", "Presencial"]
        await db.sequelize.query('ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "modalidade" JSONB DEFAULT \'[]\';');
        res.send("Sucesso! Coluna 'modalidade' criada no banco de dados.");
    } catch (error) {
        res.status(500).send("Erro ao criar coluna: " + error.message);
    }
});

// ROTA DE CORREÇÃO: Conserta o histórico (started -> completed)
app.get('/api/fix-status-completed', async (req, res) => {
    try {
        // Assume que tudo que está travado como 'started' antigo, na verdade foi concluído
        await db.DemandSearch.update(
            { status: 'completed' },
            { where: { status: 'started' } }
        );
        res.send("Histórico corrigido! Atualize o dashboard.");
    } catch (error) {
        res.status(500).send("Erro: " + error.message);
    }
});


// =============================================================
// ROTAS DA APLICAÇÃO
// =============================================================

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/patients', patientRoutes);
app.use('/api/psychologists', psychologistRoutes);
app.use('/api/messaging', messagingRoutes);
app.use('/api/demand', demandRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/support', adminSupportRoutes); 
app.use('/api/reviews', reviewRoutes);
app.use('/api/qna', qnaRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/support', supportRoutes);

// Rotas Específicas do Admin
app.get('/api/admin/feedbacks', demandController.getRatings);
app.get('/api/admin/exit-surveys', async (req, res) => {
    try {
        try { await db.sequelize.query('SELECT 1 FROM "ExitSurveys" LIMIT 1'); } 
        catch (e) { return res.json({ stats: {}, list: [] }); }

        const [stats] = await db.sequelize.query(`SELECT COUNT(*) as total, AVG(avaliacao)::numeric(10,1) as media FROM "ExitSurveys"`);
        const [list] = await db.sequelize.query(`SELECT * FROM "ExitSurveys" ORDER BY "createdAt" DESC LIMIT 50`);
        res.json({ stats: stats[0], list });
    } catch (error) { res.status(500).json({ error: "Erro interno" }); }
});

// =============================================================
// FRONTEND E CATCH-ALL (DEVE SER O ÚLTIMO)
// =============================================================
app.use(express.static(path.join(__dirname, '..')));

// NOVA ROTA PRINCIPAL (Renderiza o EJS com Header/Footer unificados)
app.get('/', (req, res) => {
    res.render('index');
});

// Mantém a lógica de perfil (não remova isso se ainda estiver usando)
app.get('/:slug', (req, res, next) => {
    const reserved = ['api', 'assets', 'css', 'js', 'patient', 'psi', 'fix-db', 'uploads'];
    if (reserved.some(p => req.params.slug.startsWith(p)) || req.params.slug.includes('.')) return next();
    res.sendFile(path.join(__dirname, '..', 'perfil_psicologo.html'));
});

// Fallback para qualquer outra coisa (envia para a home nova)
app.get(/(.*)/, (req, res) => {
  res.render('index');
});

// Inicialização
const PORT = process.env.PORT || 3001;
const startServer = async () => {
    if (process.env.NODE_ENV !== 'production') {
        console.log('Banco de dados sincronizado (DEV).');
        // O "alter: true" mantém seus dados e só ajusta as colunas se necessário
        await db.sequelize.sync({ alter: true });
        // --- COMENTE A LINHA ABAIXO PARA PARAR DE RESETAR SEUS DADOS ---
        // await seedTestData(); 
    } else {
        await db.sequelize.sync();
        console.log('Banco de dados sincronizado (PROD).');
    }
    server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}.`));
};

startServer().catch(err => console.error('Falha ao iniciar o servidor:', err));
// backend/server.js (VERSÃO PRIORITÁRIA)

require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { initSocket } = require('./config/socket');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');

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

// EM VEZ DE MOVER AS PASTAS, LIBERE O ACESSO ONDE ELAS JÁ ESTÃO:
// 1. Libera a pasta 'assets' (para imagens, logos, fontes)
app.use('/assets', express.static(path.join(__dirname, '../assets')));
// 2. Libera a pasta 'css' (para seus estilos)
app.use('/css', express.static(path.join(__dirname, '../css')));

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
// ROTA DE EMERGÊNCIA (Cria o Admin no Banco de Dados)
// =============================================================
app.get('/admin-setup-secreto', async (req, res) => {
    try {
        await seedTestData(); // Roda a função que cria o Admin e os testes
        res.send('<h1>Sucesso!</h1><p>O usuário Admin foi criado/atualizado.</p><p>Login: admin@Yelo.com</p><p>Senha: admin123</p><br><a href="/login">Ir para Login</a>');
    } catch (error) {
        res.status(500).send('Erro ao criar admin: ' + error.message);
    }
});

// --- ROTA TEMPORÁRIA PARA CRIAR O ADMIN ---
app.get('/instalar-admin', async (req, res) => {
    try {
        // 1. Define a senha que você quer usar
        const senhaAberta = 'admin123'; 
        
        // 2. Criptografa a senha (Obrigatório para o login funcionar)
        const senhaCriptografada = await bcrypt.hash(senhaAberta, 10);

        // 3. Cria o usuário no banco
        // IMPORTANTE: Verifique se sua tabela se chama 'Usuario' ou 'User' no models/index.js
        const novoAdmin = await db.Usuario.create({
            nome: 'Administrador Geral',
            email: 'admin@yelo.com',
            senha: senhaCriptografada, // Salva o hash, não a senha texto puro
            tipo: 'admin'
        });

        return res.send(`
            <h1>Sucesso!</h1>
            <p>Admin criado no banco de dados.</p>
            <p><strong>Login:</strong> admin@yelo.com</p>
            <p><strong>Senha:</strong> admin123</p>
            <br>
            <a href="/login">Ir para Login</a>
        `);

    } catch (error) {
        console.error(error);
        // Se der erro de "Validation error", provavelmente o email já existe.
        return res.status(500).send('Erro ao criar admin (talvez o email já exista?): ' + error.message);
    }
});

// --- ROTA DE LOGIN DO ADMIN (VIA BANCO DE DADOS) ---
app.post('/api/login-admin-check', async (req, res) => {
    try {
        const { email, senha } = req.body;

        // 1. Busca o usuário no banco (ajuste 'Usuario' se sua tabela tiver outro nome, ex: User, Admin)
        // Estamos buscando alguém com esse email E que seja do tipo 'admin'
        const usuario = await db.Usuario.findOne({ 
            where: { 
                email: email,
                tipo: 'admin' // Garante que só admin entra aqui
            } 
        });

        // 2. Se não achou ninguém
        if (!usuario) {
            return res.status(401).json({ success: false, message: 'Admin não encontrado.' });
        }

        // 3. Verifica a senha (compara a digitada com a hash do banco)
        const senhaValida = await bcrypt.compare(senha, usuario.senha);

        if (!senhaValida) {
            return res.status(401).json({ success: false, message: 'Senha incorreta.' });
        }

        // 4. Sucesso! Retorna os dados para o frontend redirecionar
        return res.json({ 
            success: true, 
            redirect: '/admin', // Sua rota de dashboard
            type: 'admin',
            user: { nome: usuario.nome, email: usuario.email },
            token: 'admin-token-simulado' // Em produção, gere um JWT aqui
        });

    } catch (error) {
        console.error('Erro no login de admin:', error);
        return res.status(500).json({ success: false, error: 'Erro interno do servidor.' });
    }
});

// =============================================================
// FRONTEND DINÂMICO (EJS) - ORDEM CORRIGIDA
// =============================================================

// 1º: PRIMEIRO defina a rota da Home.
// Isso garante que o servidor renderize o index.ejs ao acessar a raiz '/'
app.get('/', (req, res) => {
    res.render('index');
});

// 2º: DEPOIS configure os arquivos estáticos.
// Se não for a Home, ele procura CSS, JS ou imagens na pasta raiz.
app.use(express.static(path.join(__dirname, '..')));

// ATUALIZAÇÃO PARA DEBUG (MOSTRAR ERRO NA TELA)
app.get('/:pagina', (req, res, next) => {
    const pagina = req.params.pagina.replace('.html', '');
    
    // Proteção de arquivos reservados
    const reservado = ['api', 'assets', 'css', 'js', 'uploads', 'favicon.ico'];
    if (reservado.some(p => pagina.startsWith(p))) return next();

    // Tenta renderizar
    res.render(pagina, (err, html) => {
        if (err) {
            // --- AQUI ESTÁ A MUDANÇA ---
            console.error(`Erro ao abrir ${pagina}:`, err); // Mostra no terminal (Logs da Render)
            return res.status(500).send(`
                <h1>ERRO DETALHADO (Debug)</h1>
                <p>O servidor tentou abrir o arquivo: <strong>views/${pagina}.ejs</strong></p>
                <p>O erro foi: <strong>${err.message}</strong></p>
                <pre style="background:#eee; padding:10px;">${err.stack}</pre>
            `);
        }
        res.send(html);
    });
});

// 4º: Catch-All (Se nada acima funcionar)
app.use((req, res) => {
    res.redirect('/');
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
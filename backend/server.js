// backend/server.js (VERSÃO PRIORITÁRIA)

require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { initSocket } = require('./config/socket');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
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
const blogRoutes = require('./routes/blogRoutes');

// Controllers
const demandController = require('./controllers/demandController');
const blogController = require('./controllers/blogController');
const seedTestData = require('./controllers/seed_test_data');

const app = express();

// EM VEZ DE MOVER AS PASTAS, LIBERE O ACESSO ONDE ELAS JÁ ESTÃO:
// 1. Libera a pasta 'assets' (para imagens, logos, fontes)
app.use('/assets', express.static(path.join(__dirname, '../assets')));

// 2. Libera a pasta 'css' (para seus estilos)
app.use('/css', express.static(path.join(__dirname, '../css')));

// 3. [NOVO] Libera a pasta 'js' (CRUCIAL PARA O PERFIL FUNCIONAR)
app.use('/js', express.static(path.join(__dirname, '../js')));

// 1. LIBERA A PASTA ADMIN PARA O NAVEGADOR ACESSAR OS ARQUIVOS (CSS, JS, Imagens do Admin)
app.use('/admin', express.static(path.join(__dirname, '../admin')));

// 2. ROTA DA PÁGINA INICIAL DO ADMIN
// Quando acessar yelo.onrender.com/admin, entrega o arquivo HTML principal
app.get('/admin', (req, res) => {
    // IMPORTANTE: Verifique se o nome do seu arquivo principal na pasta admin é 'index.html' ou 'admin.html'
    // Estou assumindo que seja 'index.html' ou 'admin.html'. 
    // Se o seu arquivo principal se chamar "admin.html", use a linha abaixo:
    
    res.sendFile(path.join(__dirname, '../admin/admin.html'));
    
    // Se der erro de arquivo não encontrado, troque 'admin.html' por 'index.html' acima.
});

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

// Rota para criar a coluna CURTIDAS na tabela posts
app.get('/api/fix-add-likes-column', async (req, res) => {
    try {
        await db.sequelize.query('ALTER TABLE posts ADD COLUMN IF NOT EXISTS curtidas INTEGER DEFAULT 0;');
        res.send("Sucesso! Coluna 'curtidas' criada no banco de dados.");
    } catch (error) {
        res.status(500).send("Erro ao criar coluna: " + error.message);
    }
});

// =============================================================
// ROTAS DA APLICAÇÃO
// =============================================================

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- COLAR AQUI (BEM NO TOPO, ANTES DAS OUTRAS) ---
app.get('/api/admin/me', (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Token ausente' });

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secreto_yelo_dev');
        
        res.json({ id: decoded.id, nome: decoded.nome, role: decoded.role });
    } catch (error) {
        console.error("Erro auth admin:", error.message);
        return res.status(401).json({ error: 'Token inválido' });
    }
});
// ---------------------------------------------------

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

// ADICIONE ESTA LINHA:
// Nota: O frontend chama '/api/psychologists/me/posts', então montamos assim:
app.use('/api/psychologists/me/posts', blogRoutes);

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

// =============================================================
// ÁREA DO ADMINISTRADOR (ROBUSTA)
// =============================================================

// 1. ROTA DE INSTALAÇÃO (CRIA TABELA E USUÁRIO NA FORÇA BRUTA)
app.get('/instalar-admin', async (req, res) => {
    try {
        // A) Cria a tabela 'Admins' se ela não existir (SQL Puro para garantir)
        await db.sequelize.query(`
            CREATE TABLE IF NOT EXISTS "Admins" (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                senha VARCHAR(255) NOT NULL,
                nome VARCHAR(255),
                "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // B) Criptografa a senha
        const senhaHash = await bcrypt.hash('admin123', 10);

        // C) Tenta inserir o Admin (Se já existir, não faz nada graças ao ON CONFLICT)
        // Nota: O 'ON CONFLICT' evita erro se você recarregar a página
        await db.sequelize.query(`
            INSERT INTO "Admins" (email, senha, nome, "createdAt", "updatedAt")
            VALUES (:email, :senha, 'Administrador Geral', NOW(), NOW())
            ON CONFLICT (email) DO UPDATE 
            SET senha = :senha; -- Atualiza a senha se o admin já existir
        `, {
            replacements: { email: 'admin@yelo.com', senha: senhaHash }
        });

        res.send(`
            <div style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: #1B4332;">Admin Configurado com Sucesso!</h1>
                <p>A tabela foi criada e o usuário registrado.</p>
                <hr>
                <p><strong>Login:</strong> admin@yelo.com</p>
                <p><strong>Senha:</strong> admin123</p>
                <br>
                <a href="/login" style="background: #1B4332; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ir para Login</a>
            </div>
        `);

    } catch (error) {
        console.error('Erro ao instalar admin:', error);
        res.status(500).send('Erro fatal ao criar admin: ' + error.message);
    }
});

// 2. ROTA DE LOGIN DO ADMIN (VERIFICA NA TABELA 'Admins')
app.post('/api/login-admin-check', async (req, res) => {
    try {
        const { email, senha } = req.body;

        // A) Busca o usuário
        const [results] = await db.sequelize.query(
            `SELECT * FROM "Admins" WHERE email = :email LIMIT 1`,
            { replacements: { email: email } }
        );

        const adminUser = results[0];

        // B) Se não achou ninguém
        if (!adminUser) {
            return res.status(401).json({ success: false }); 
        }

        // C) Verifica a senha
        const senhaValida = await bcrypt.compare(senha, adminUser.senha);

        if (!senhaValida) {
            return res.status(401).json({ success: false, message: 'Senha de Admin incorreta' });
        }

        // D) GERA O TOKEN (A Correção Principal)
        const token = jwt.sign(
            { id: adminUser.id, role: 'admin', nome: adminUser.nome },
            process.env.JWT_SECRET || 'secreto_yelo_dev', // Usa sua chave secreta
            { expiresIn: '24h' }
        );

        // E) Sucesso! Envia o token junto
        return res.json({ 
            success: true, 
            redirect: '/admin', 
            type: 'admin',
            token: token, // <--- O Frontend precisa disso para não deslogar
            user: { nome: adminUser.nome }
        });

    } catch (error) {
        console.error('Erro no login de admin:', error);
        return res.status(401).json({ success: false }); 
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

// Rotas Públicas do Blog
app.get('/blog', blogController.exibirBlogPublico);
app.get('/blog/post/:id', blogController.exibirPostUnico);
// Rota para dar Like (Incrementa +1)
app.post('/blog/post/:id/like', blogController.curtirPost);

// 2º: DEPOIS configure os arquivos estáticos.
// Se não for a Home, ele procura CSS, JS ou imagens na pasta raiz.
app.use(express.static(path.join(__dirname, '..')));

// =============================================================
// ROTEAMENTO INTELIGENTE (PÁGINAS ESTÁTICAS vs PERFIL PÚBLICO)
// =============================================================

app.get('/:slug', (req, res, next) => {
    const slug = req.params.slug; // Removemos o replace aqui para verificar a extensão primeiro
    
    // 1. PROTEÇÃO DE ARQUIVOS (NOVO): 
    // Se o link tiver um ponto (ex: script.js, estilo.css, imagem.png), 
    // o servidor entende que NÃO é um perfil de usuário e deixa passar para o download.
    if (slug.includes('.')) return next();

    // 2. Lista de palavras reservadas
    const reservado = ['api', 'assets', 'css', 'js', 'uploads', 'favicon.ico', 'admin', 'login', 'cadastro', 'dashboard'];
    
    if (reservado.some(p => slug.startsWith(p))) return next();

    // 3. Tenta renderizar
    const paginaLimpa = slug.replace('.html', ''); // Limpa apenas para renderizar
    
    res.render(paginaLimpa, (err, html) => {
        if (err) {
            // Se não achar o arquivo físico, assume que é o SLUG DO PSICÓLOGO
            if (err.message.includes('Failed to lookup view')) {
                return res.render('perfil_psicologo');
            }

            console.error(`Erro ao abrir ${slug}:`, err);
            return res.status(500).send('Erro interno no servidor');
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
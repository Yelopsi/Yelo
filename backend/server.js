require('dotenv').config();

process.env.TZ = 'America/Sao_Paulo';
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Módulos e Configurações Internas
const { initSocket } = require('./config/socket');
const db = require('./models');
const applyDatabaseFixes = require('./config/dbFixes');
const { startCronJobs } = require('./jobs/cronScheduler');

// Middlewares
const seoRedirect = require('./middlewares/seoMiddleware');
const { corsConfig, cspMiddleware } = require('./middlewares/securityMiddleware');
const { sessionMiddleware, visitMiddleware } = require('./middlewares/trackingMiddleware');
const errorHandler = require('./middlewares/errorHandler');

// Gerenciador Central de Rotas
const setupRoutes = require('./routes');

const app = express();
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', [path.join(__dirname, '../views'), path.join(__dirname, '..')]);

let isDbSynced = false;
app.use((req, res, next) => {
    if (isDbSynced) return next();
    if (!req.path.startsWith('/assets') && !req.path.startsWith('/css') && !req.path.startsWith('/js')) {
        return res.status(503).send(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Serviço Indisponível</title><meta http-equiv="refresh" content="5"><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:#f0f2f5;color:#333;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;}.container{max-width:400px;padding:20px;}h1{color:#1B4332;}</style></head><body><div class="container"><h1>Iniciando Sistema...</h1><p>Estamos finalizando a sincronização do banco de dados.</p><p style="color:#666;font-size:0.9rem;">A página atualizará automaticamente em 5 segundos.</p></div></body></html>`);
    
    }
    next();
});

// --- SEGURANÇA DE PRODUÇÃO ---
// Proteção de Cabeçalhos HTTP (Ignora CSP para usar a sua regra customizada)
app.use(helmet({ 
  contentSecurityPolicy: false,
  crossOriginOpenerPolicy: false, // Desativado para evitar bloqueios do Google Sign-In
  originAgentCluster: false // Remove o aviso de origin-keyed agent cluster
}));

// Proteção contra Ataques de Força Bruta e DDoS Básico
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 300, // Limite de 300 requisições por IP na mesma janela
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas requisições realizadas deste IP. Por favor, tente novamente mais tarde.' }
});
app.use('/api/', apiLimiter);

// Limite específico para a criação de perguntas na Comunidade (2 por IP a cada 24h)
const qnaAskLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 horas em milissegundos
    max: 2, // Limite de 2 requisições por IP na mesma janela
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Você atingiu o limite de 2 perguntas por dia. Tente novamente amanhã.' }
});
app.use('/api/qna/ask', qnaAskLimiter);

// Middlewares de Aplicação
app.use(seoRedirect);
app.use(corsConfig);
app.use(cspMiddleware);
app.use(cookieParser());
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(sessionMiddleware);
app.use(visitMiddleware);

// --- ROTAS DINÂMICAS PRIORITÁRIAS ---
// Trazidas para cima para evitar conflito com cache de arquivos estáticos
app.get('/questionario', (req, res) => res.render('questionario'));
app.get('/psi_questionario', (req, res) => res.render('psi_questionario'));
// Intercepta botões perdidos pelo site apontando para o arquivo antigo
app.get('/questionario.html', (req, res) => res.redirect(301, '/questionario'));
app.get('/psi_questionario.html', (req, res) => res.redirect(301, '/psi_questionario'));

// Servir TODOS os arquivos da pasta public automaticamente.
// A propriedade 'extensions' faz com que urls limpas como "/ajuda" e "/questionario" abram automaticamente os arquivos .html se existirem.
const rootPublic = path.join(__dirname, '../public');
const backendPublic = path.join(__dirname, 'public');

app.use(express.static(rootPublic, { extensions: ['html'] }));

// Trava de segurança: Impede que a pasta backend/public sirva arquivos HTML antigos acidentalmente
const backendStatic = express.static(backendPublic);
app.use((req, res, next) => {
    if (req.path.endsWith('.html') || req.path.endsWith('.htm')) return next();
    backendStatic(req, res, next);
});

// Permite servir os arquivos soltos na raiz do projeto (como psi_questionario.html e script.js) sem precisar movê-los
app.use(express.static(path.join(__dirname, '..'), { extensions: ['html'] }));

// Permite servir scripts ou arquivos específicos de jobs da pasta backend/jobs
app.use('/jobs', express.static(path.join(__dirname, 'jobs')));

// Rota para a página de bloqueio (Menor de Idade) renderizando o EJS
app.get('/menor_de_idade', (req, res) => res.render('menor_de_idade'));

// Rota para a página de contato renderizando o EJS
app.get('/contato', (req, res) => res.render('contato'));

// Rota para a página de ajuda renderizando o EJS
app.get('/ajuda', (req, res) => res.render('ajuda'));

// Silencia erro 404 do favicon.ico na raiz 
app.get('/favicon.ico', (req, res) => res.status(204).end());

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Inicialização HTTP & Socket.IO
const server = http.createServer(app);
const io = initSocket(server);

app.use((req, res, next) => {
    req.io = io;
    next();
});

// Inicia Configurações e Rotas
setupRoutes(app);

app.use((req, res, next) => {
    res.status(404);
    if (req.accepts('html')) return res.render('404', { url: req.url });
    if (req.accepts('json')) return res.json({ error: 'Recurso não encontrado' });
    
    res.type('txt').send('Página não encontrada');
});

app.use(errorHandler);

const PORT = process.env.PORT || 3001;
const startServer = async () => {
    if (!server.listening) {
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 [FAST BOOT] Servidor ouvindo na porta ${PORT} (Inicializando conexões...)`);
        });
    }

    let dbReady = false;
    const maxRetries = 20;
    for (let i = 1; i <= maxRetries; i++) {
        try {
            await db.sequelize.authenticate();        
            await db.sequelize.query('CREATE TEMP TABLE IF NOT EXISTS _startup_check (id serial);');
            await db.sequelize.query('DROP TABLE IF EXISTS _startup_check;');
            
            console.log('✅ [DB CONNECTION] Conexão de escrita estabelecida com sucesso.');
            dbReady = true;
            break;
        } catch (error) {
            console.warn(`⏳ [DB WAIT] Tentativa ${i}/${maxRetries}: ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    if (!dbReady) {
        console.error('❌ [DB CRITICAL] O banco de dados não conectou a tempo.');
    }

    try {
        // Sincroniza o banco e cria as colunas faltantes nas tabelas (COMENTADO PARA NÃO TRAVAR O BOOT)
        // await db.sequelize.sync({ alter: true });
        
        // --- FIX MANUAL DE COLUNAS FALTANTES PARA EVITAR LOCK DO ALTER:TRUE ---
        try {
            console.log('🛠️ [DB FIX] Injetando colunas faltantes na tabela Patients...');
            await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "modalidade_preferida" VARCHAR(255);');
            await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "psychologistId" INTEGER;');
            await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "recebe_mensagens" BOOLEAN DEFAULT true;');
            await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP WITH TIME ZONE;');
            await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "faixa_etaria" VARCHAR(255);');
            await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "idade" VARCHAR(255);');
            await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "identidade_genero" VARCHAR(255);');
        } catch(e) {
            console.warn('⚠️ Aviso ao tentar criar colunas manualmente (podem já existir ou banco travado):', e.message);
        }

        await applyDatabaseFixes(db, db.sequelize);
        
        isDbSynced = true;
        console.log('✅ [SERVER] Sistema totalmente operacional.');
        if(typeof startCronJobs === 'function') startCronJobs();    
    } catch (e) {
        console.error('❌ [DB SYNC] Erro crítico durante a aplicação de correções de schema:', e.message);
    }
};

startServer().catch(err => console.error('Falha ao iniciar o servidor:', err));
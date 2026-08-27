require('dotenv').config();

process.env.TZ = 'America/Sao_Paulo';
// ==========================================
// 1. HARDENING: Inicializar Log Sanitizer ANTES de qualquer require
// ==========================================
require('./utils/logger').initLogSanitizer();

// ==========================================
// 1.5. HARDENING: Runtime Enforcement (Lock & Key)
// ==========================================
const fs = require('fs');
const path = require('path');

// A isenção existe apenas para os próprios subprocessos de teste do Gate (supertest)
// Não existe mais escape hatch baseado em NODE_ENV (development/production).
// Para o dev rodar localmente, ele precisará ter o .security_passed gerado uma vez.
if (process.env.SECURITY_GATE_RUNNING !== 'true') {
    const securityTokenPath = path.join(__dirname, '../.security_passed');
    if (!fs.existsSync(securityTokenPath)) {
        console.error('🚨 [FATAL ERROR] SECURITY GATE BYPASS DETECTED!');
        console.error('🚨 The server was started directly without passing the Security Release Gate.');
        console.error('🚨 You MUST run "npm run security:gate" successfully before starting the application in production.');
        process.exit(1);
    }
    
    // Hash Validation to prevent token reuse across code changes
    try {
        const crypto = require('crypto');
        const lockHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, '../package-lock.json'))).digest('hex');
        const serverHash = crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex');
        const expectedPayload = `${lockHash}-${serverHash}`;
        const tokenPayload = fs.readFileSync(securityTokenPath, 'utf-8').trim();
        
        if (tokenPayload !== 'fallback-token' && tokenPayload !== expectedPayload) {
            console.error('🚨 [FATAL ERROR] STALE SECURITY TOKEN DETECTED!');
            console.error('🚨 The codebase has been modified since the last Security Gate run.');
            console.error('🚨 You MUST re-run "npm run security:gate" to generate a new token for this build.');
            process.exit(1);
        }
    } catch (err) {
        console.error('⚠️ Aviso: Falha ao validar o hash do token de build.', err.message);
    }
}

const express = require('express');
const http = require('http');
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
const compression = require('compression');

const { publicLimiter, authLimiter, expensiveLimiter, webhookLimiter } = require('./middlewares/rateLimiter');

const app = express();
app.use(compression()); // Otimização: Gzip para recursos estáticos e responses

// --- FIX: IP SPOOFING ---
// Em vez de confiar em qualquer IP ('1'), confiamos apenas nos IPs locais ou de balanceadores internos.
app.set('trust proxy', 'loopback, linklocal, uniquelocal');

app.set('view engine', 'ejs');
app.set('views', [path.join(__dirname, '../views'), path.join(__dirname, '..')]);

// --- SEGURANÇA DE PRODUÇÃO ---
// Proteção de Cabeçalhos HTTP (Ignora CSP para usar a sua regra customizada)
app.use(helmet({ 
  contentSecurityPolicy: false, // Gerenciada via cspMiddleware customizado
  crossOriginOpenerPolicy: false, // Gerenciado via cspMiddleware para compatibilidade com OAuth
  originAgentCluster: false, // Evita warning no console
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }, // Força HTTPS estrito
  noSniff: true, // Impede MIME Sniffing (X-Content-Type-Options: nosniff)
  hidePoweredBy: true, // Oculta a flag do Express
  frameguard: false // Gerenciado via frame-ancestors na nossa CSP
}));
app.use(cspMiddleware);

let isDbSynced = process.env.NODE_ENV === 'test';
app.use((req, res, next) => {
    if (isDbSynced || req.headers['x-test-bypass'] === 'true') return next();
    if (!req.path.startsWith('/assets') && !req.path.startsWith('/css') && !req.path.startsWith('/js')) {
        return res.status(503).send(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Serviço Indisponível</title><meta http-equiv="refresh" content="5"><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:#f0f2f5;color:#333;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;}.container{max-width:400px;padding:20px;}h1{color:#1B4332;}</style></head><body><div class="container"><h1>Iniciando Sistema...</h1><p>Estamos finalizando a sincronização do banco de dados.</p><p style="color:#666;font-size:0.9rem;">A página atualizará automaticamente em 5 segundos.</p></div></body></html>`);
    
    }
    next();
});

// Proteção contra Ataques de Força Bruta e DDoS Básico
// Agora os limitadores são gerenciados via backend/routes/index.js para cada categoria
// Apenas mantemos o publicLimiter de fallback global para o /api/
app.use('/api/', publicLimiter);

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
    // cspMiddleware já invocado no topo para cobrir a splash screen
app.use(cookieParser());
app.use(express.json({
  limit: '100kb',
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));
app.use(express.urlencoded({ extended: true, limit: '100kb', parameterLimit: 1000 }));
app.use(sessionMiddleware);
app.use(visitMiddleware);

// --- ROTAS DINÂMICAS PRIORITÁRIAS ---
// Trazidas para cima para evitar conflito com cache de arquivos estáticos
app.get('/questionario', (req, res) => res.render('questionario'));
app.get('/psi_questionario', (req, res) => res.render('psi_questionario'));

// SEO Middleware (X-Robots-Tag): Impede a indexação de URLs com parâmetro 'redirect'
app.use((req, res, next) => {
    if (req.query && Object.keys(req.query).includes('redirect')) {
        res.setHeader('X-Robots-Tag', 'noindex');
    }
    next();
});

// SEO Redirecionamento Global (301): Remove .html de qualquer URL (Evita conteúdo duplicado no Google)
app.use((req, res, next) => {
    if (req.path.endsWith('.html')) {
        const newPath = req.path.slice(0, -5); // Corta os últimos 5 caracteres (".html")
        const query = req.url.slice(req.path.length); // Mantém parâmetros como ?redirect=algo
        return res.redirect(301, newPath + query);
    }
    next();
});

// Rota SEO Dinâmica para a Página Única da Pergunta
app.get('/perguntas/:slug', require('./controllers/qnaController').getQuestionBySlug);

// Sitemap Automático para o Google
app.get('/sitemap.xml', require('./controllers/qnaController').generateSitemap);

// Servir TODOS os arquivos da pasta public automaticamente.
// A propriedade 'extensions' faz com que urls limpas como "/ajuda" e "/questionario" abram automaticamente os arquivos .html se existirem.
const rootPublic = path.join(__dirname, '../public');
const backendPublic = path.join(__dirname, 'public');

const staticOptions = {
    extensions: ['html'],
    setHeaders: (res, pathStr) => {
        if (express.static.mime.lookup(pathStr) === 'text/html') {
            res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        } else if (pathStr.match(/\.(js|css)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (pathStr.match(/\.(png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|eot|apk|pdf)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=2592000');
        }
    }
};

app.use(express.static(rootPublic, staticOptions));

// Trava de segurança: Impede que a pasta backend/public sirva arquivos HTML antigos acidentalmente
const backendStatic = express.static(backendPublic);
app.use((req, res, next) => {
    if (req.path.endsWith('.html') || req.path.endsWith('.htm')) return next();
    backendStatic(req, res, next);
});

// Permite servir os arquivos soltos na raiz do projeto (como psi_questionario.html e script.js) sem precisar movê-los
app.use(express.static(path.join(__dirname, '..'), staticOptions));

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

app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
    setHeaders: (res, pathStr) => {
        res.setHeader('Cache-Control', 'public, max-age=2592000'); // 30 dias para uploads em geral
    }
}));

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
            console.log('🛠️ [DB FIX] Injetando colunas faltantes nas tabelas...');
            await db.sequelize.query('ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "ai_insights_cache" JSONB DEFAULT NULL;');
            await db.sequelize.query('ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "subscribedAt" TIMESTAMP WITH TIME ZONE;');
            await db.sequelize.query('ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "planExpiresAt" TIMESTAMP WITH TIME ZONE;');
            await db.sequelize.query('ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "subscriptionId" VARCHAR(255);');
            await db.sequelize.query('ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "cancelAtPeriodEnd" BOOLEAN DEFAULT false;');
            
            console.log('🛠️ [DB FIX] Backfill de data de assinatura para pagantes legados...');
            await db.sequelize.query('UPDATE "Psychologists" SET "subscribedAt" = "createdAt" + interval \'14 days\' WHERE "subscription_payments_count" > 0 AND "subscribedAt" IS NULL;');
            
            await db.sequelize.query('ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "admin_billing_sent_at" TIMESTAMP WITH TIME ZONE;');
            await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "modalidade_preferida" VARCHAR(255);');
            await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "psychologistId" INTEGER;');
            await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "recebe_mensagens" BOOLEAN DEFAULT true;');
            await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP WITH TIME ZONE;');
            await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "faixa_etaria" VARCHAR(255);');
            await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "idade" VARCHAR(255);');
            await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "identidade_genero" VARCHAR(255);');
            
            console.log('🛠️ [DB FIX] Injetando coluna isProfileAnalyzed na tabela Psychologists...');
            await db.sequelize.query('ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "isProfileAnalyzed" BOOLEAN DEFAULT false;');
            await db.sequelize.query('ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "msg_incomplete_profile_sent_at" TIMESTAMP WITH TIME ZONE;');
            await db.sequelize.query('ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "msg_analysis_sent_at" TIMESTAMP WITH TIME ZONE;');
            await db.sequelize.query('ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "msg_feedback_billing_sent_at" TIMESTAMP WITH TIME ZONE;');
            await db.sequelize.query('ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "msg_churn_followup_sent_at" TIMESTAMP WITH TIME ZONE;');
            
            console.log('🛠️ [DB FIX] Injetando coluna utm_content nas tabelas...');
            await db.sequelize.query('ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "utm_content" VARCHAR(255);');
            await db.sequelize.query('ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "aiOptimizationHistory" JSONB DEFAULT NULL;');
            await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "utm_content" VARCHAR(255);');
            await db.sequelize.query('ALTER TABLE "WaitingLists" ADD COLUMN IF NOT EXISTS "utm_content" VARCHAR(255);');

            console.log('🛠️ [DB FIX] Injetando coluna hasSeenWelcome na tabela Psychologists...');
            await db.sequelize.query('ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "hasSeenWelcome" BOOLEAN DEFAULT false;');

            console.log('🛠️ [DB FIX] Injetando coluna evaluationEmailSent na tabela Psychologists...');
            await db.sequelize.query('ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "evaluationEmailSent" BOOLEAN DEFAULT false;');
            await db.sequelize.query('ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "msg_paid_churn_sent_at" TIMESTAMP WITH TIME ZONE NULL;');

            console.log('🛠️ [DB FIX] Injetando colunas faltantes na tabela Questions...');
            
            // Garante a criação estrutural das tabelas do fórum/comunidade caso não existam
            if (db.Question) await db.Question.sync();
            if (db.Answer) await db.Answer.sync();
            if (db.QuestionIgnore) await db.QuestionIgnore.sync();
            if (db.WhatsAppClickLog) await db.WhatsAppClickLog.sync({ alter: true });
            if (db.WeeklyEfficiency) await db.WeeklyEfficiency.sync({ alter: true });
            if (db.YeloExpense) await db.YeloExpense.sync({ alter: true });

            await db.sequelize.query('ALTER TABLE questions ADD COLUMN IF NOT EXISTS title VARCHAR(255);');
            await db.sequelize.query('ALTER TABLE questions ADD COLUMN IF NOT EXISTS slug VARCHAR(255) UNIQUE;');
        } catch(e) {
            console.warn('⚠️ Aviso ao tentar criar colunas manualmente (podem já existir ou banco travado):', e.message);
        }

        await applyDatabaseFixes(db, db.sequelize);
        
        isDbSynced = true;
        console.log('✅ [SERVER] Sistema totalmente operacional.');
        
        if(typeof startCronJobs === 'function') startCronJobs();    
        
        // --- INICIA O PROCESSAMENTO EM LOTE DO SEO (BACKGROUND) ---
        try {
            const seoBatch = require('./utils/seoBatch');
            seoBatch.run();
            console.log('✅ [SEO BATCH] Processo de geração de tags em background iniciado.');
        } catch (e) {
            console.error('❌ [SEO BATCH] Erro ao iniciar:', e.message);
        }

    } catch (e) {
        console.error('❌ [DB SYNC] Erro crítico durante a aplicação de correções de schema:', e.message);
    }
};

if (require.main === module) {
    startServer().catch(err => console.error('Falha ao iniciar o servidor:', err));
}

module.exports = app;

// backend/server.js (VERSÃO PRIORITÁRIA)

require('dotenv').config();
// --- FORÇA O FUSO HORÁRIO DO BRASIL NO RENDER ---
process.env.TZ = 'America/Sao_Paulo';
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs'); // Adicionado para verificar arquivos
const { initSocket } = require('./config/socket');
const { Server } = require('socket.io'); // Fallback para inicialização manual
const cors = require('cors');
const cookieParser = require('cookie-parser'); // <-- Adicionado para sessões
const crypto = require('crypto'); // <-- ADICIONADO PARA GERAR IDs DE SESSÃO
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op, DataTypes } = require('sequelize');
const { protect } = require('./middleware/authMiddleware'); // Importe o middleware se não tiver
const gamificationService = require('./services/gamificationService'); // Importa o serviço

// Banco de Dados
const db = require('./models');

// --- FIX: Patch Message Model to include 'status' if missing ---
// Garante que o campo 'status' seja retornado nas consultas GET (API),
// resolvendo o bug onde os "risquinhos" somem ao atualizar a página.
if (db.Message && !db.Message.rawAttributes.status) {
    console.log("[FIX] Patching Message model to include 'status' field.");
    db.Message.rawAttributes.status = {
        type: DataTypes.STRING,
        defaultValue: 'sent'
    };
    if (typeof db.Message.refreshAttributes === 'function') {
        db.Message.refreshAttributes();
    }
}

// --- FIX: Patch Psychologist Model (Garante leitura de planExpiresAt) ---
if (db.Psychologist) {
    const attrs = db.Psychologist.rawAttributes;
    let patched = false;
    
    const colsToAdd = {
        planExpiresAt: DataTypes.DATE,
        stripeSubscriptionId: DataTypes.STRING,
        subscriptionId: DataTypes.STRING,
        cancelAtPeriodEnd: DataTypes.BOOLEAN,
        subscription_payments_count: DataTypes.INTEGER,
        dailySummaryTime: DataTypes.STRING,
        reminderHoursBefore: DataTypes.INTEGER,
        linkedin_url: DataTypes.STRING,
        instagram_url: DataTypes.STRING,
        facebook_url: DataTypes.STRING,
        tiktok_url: DataTypes.STRING,
        x_url: DataTypes.STRING,
        cep: DataTypes.STRING,
        cidade: DataTypes.STRING,
        estado: DataTypes.STRING,
        telefone: DataTypes.STRING,
        bio: DataTypes.TEXT,
        crpDocumentUrl: DataTypes.TEXT,
        resetPasswordToken: DataTypes.STRING,
        resetPasswordExpires: DataTypes.BIGINT,
        formacao_nivel: DataTypes.STRING,
        formacao_desc: DataTypes.TEXT
    };

    for (const [col, type] of Object.entries(colsToAdd)) {
        if (!attrs[col]) { attrs[col] = { type }; patched = true; }
    }
    
    if (patched && typeof db.Psychologist.refreshAttributes === 'function') {
        console.log("[FIX] Modelo Psychologist atualizado com colunas faltantes.");
        db.Psychologist.refreshAttributes(); 
    }
}

// --- FIX: Patch Appointment Model (Garante leitura de patientId) ---
if (db.Appointment && !db.Appointment.rawAttributes.patientId) {
    console.log("[FIX] Patching Appointment model to include 'patientId' field.");
    db.Appointment.rawAttributes.patientId = { type: DataTypes.INTEGER };
    if (typeof db.Appointment.refreshAttributes === 'function') {
        db.Appointment.refreshAttributes();
    }
}

// --- FIX: Define Association between Appointment and Psychologist ---
if (db.Appointment && db.Psychologist) {
    // Check if association already exists to avoid errors on restart
    if (!db.Appointment.associations.psychologist) {
        console.log("[FIX] Defining Appointment -> Psychologist association.");
        db.Appointment.belongsTo(db.Psychologist, { as: 'psychologist', foreignKey: 'psychologistId' });
    }
    if (!db.Psychologist.associations.appointments) {
        console.log("[FIX] Defining Psychologist -> Appointment association.");
        db.Psychologist.hasMany(db.Appointment, { as: 'appointments', foreignKey: 'psychologistId' });
    }
}

// --- FIX: Patch Patient Model (Garante leitura de campos novos) ---
if (db.Patient) {
    const attrs = db.Patient.rawAttributes;
    let patched = false;
    
        const colsToAdd = {
        sessionValue: DataTypes.FLOAT,
        status: DataTypes.STRING,
        observacoes: DataTypes.TEXT,
        valor_sessao_faixa: DataTypes.STRING,
        temas_buscados: DataTypes.JSONB,
        identidade_genero: DataTypes.STRING,
        faixa_etaria: DataTypes.STRING,
        idade: DataTypes.STRING,
        genero_profissional: DataTypes.STRING,
        abordagem_desejada: DataTypes.JSONB,
        praticas_afirmativas: DataTypes.JSONB,
        telefone: DataTypes.STRING,
        recebe_mensagens: { type: DataTypes.BOOLEAN, defaultValue: true },
        resetPasswordToken: DataTypes.STRING,
        resetPasswordExpires: DataTypes.BIGINT
    };

    for (const [col, definition] of Object.entries(colsToAdd)) {
        if (!attrs[col]) {
            // If the definition already has a 'type' property, it's a full definition object. Use it directly.
            // Otherwise, it's a simple DataType, so wrap it.
            if (definition.type) { attrs[col] = definition; } 
            else { attrs[col] = { type: definition }; }
            patched = true;
        }
    }

    
    if (patched && typeof db.Patient.refreshAttributes === 'function') {
        console.log("[FIX] Modelo Patient atualizado com colunas faltantes.");
        db.Patient.refreshAttributes(); 
    }
}

// --- FIX: Patch WaitingList Model (Permite partial leads sem CRP) ---
if (db.WaitingList && db.WaitingList.rawAttributes.crp) {
    db.WaitingList.rawAttributes.crp.allowNull = true;
    if (typeof db.WaitingList.refreshAttributes === 'function') {
        db.WaitingList.refreshAttributes();
    }
}

// --- FIX: Patch SystemLog Model (Garante que o modelo exista para logs) ---
if (!db.SystemLog) {
    console.log("[FIX] Defining SystemLog model manually.");
    db.SystemLog = db.sequelize.define('SystemLog', {
        level: DataTypes.STRING,
        message: DataTypes.TEXT,
        meta: DataTypes.JSONB
    });
}

// --- FIX: Definir Modelos Financeiros (Appointment e Expense) ---
if (!db.Expense) {
    console.log("[FIX] Defining Expense model manually.");
    db.Expense = db.sequelize.define('Expense', {
        description: DataTypes.STRING,
        value: DataTypes.FLOAT,
        date: DataTypes.DATEONLY,
        psychologistId: DataTypes.INTEGER
    });
}
if (!db.Appointment) {
    console.log("[FIX] Defining Appointment model manually.");
    db.Appointment = db.sequelize.define('Appointment', {
        title: DataTypes.STRING, // Nome do paciente ou título
        start: DataTypes.DATE,
        end: DataTypes.DATE,
        status: { type: DataTypes.STRING, defaultValue: 'scheduled' }, // scheduled, done, missed
        value: { type: DataTypes.FLOAT, defaultValue: 0 },
        psychologistId: DataTypes.INTEGER,
        patientId: DataTypes.INTEGER // Vínculo com o paciente
    });
}

// --- FIX: Patch Answer Model (Garante contagem para gamificação) ---
if (db.Answer && !db.Answer.rawAttributes.psychologistId) {
    console.log("[FIX] Patching Answer model to include 'psychologistId' field.");
    db.Answer.rawAttributes.psychologistId = {
        type: DataTypes.INTEGER
    };
    if (typeof db.Answer.refreshAttributes === 'function') {
        db.Answer.refreshAttributes();
    }
}

// --- FIX: Definir Modelo SystemSetting (Configurações) ---
if (!db.SystemSetting) {
    console.log("[FIX] Defining SystemSetting model manually.");
    db.SystemSetting = db.sequelize.define('SystemSetting', {
        maintenance_mode: { type: DataTypes.BOOLEAN, defaultValue: false },
        allow_registrations: { type: DataTypes.BOOLEAN, defaultValue: true },
        price_Essencial: DataTypes.FLOAT,
        price_Clínico: DataTypes.FLOAT,
        price_sol: DataTypes.FLOAT,
        whatsapp_support: DataTypes.STRING,
        email_support: DataTypes.STRING
    });
}

// --- HOOK GLOBAL: DESARQUIVAMENTO AUTOMÁTICO ---
// Se um psicólogo ou paciente enviar mensagem, a conversa é desarquivada (status = 'active')
if (db.Message && db.Conversation) {
    db.Message.addHook('afterCreate', async (message, options) => {
        try {
            if (message.senderType !== 'admin') {
                // CORREÇÃO: Usando SQL puro para garantir que funcione mesmo se o Model não tiver o campo 'status' mapeado
                await db.sequelize.query(
                    `UPDATE "Conversations" SET "status" = 'active', "updatedAt" = NOW() WHERE "id" = :id`,
                    { replacements: { id: message.conversationId } }
                );
            }
        } catch (e) { console.error("Erro no hook de desarquivamento:", e.message); }
    });
}

// Importação de Rotas
const patientRoutes = require('./routes/patientRoutes');
const psychologistRoutes = require('./routes/psychologistRoutes');
const messageRoutes = require('./routes/messageRoutes');
const demandRoutes = require('./routes/demandRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const adminRoutes = require('./routes/adminRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const qnaRoutes = require('./routes/qnaRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const adminMessageRoutes = require('./routes/adminMessageRoutes');
const blogRoutes = require('./routes/blogRoutes');
const newsletterRoutes = require('./routes/newsletterRoutes'); // <-- ADICIONADO
const forumRoutes = require('./routes/forumRoutes'); // <--- ADICIONADO
const authRoutes = require('./routes/authRoutes');

// Controllers
const demandController = require('./controllers/demandController');
const blogController = require('./controllers/blogController');
const psychologistController = require('./controllers/psychologistController'); // Importar o controller
const adminController = require('./controllers/adminController'); // <--- ADICIONADO
const qnaController = require('./controllers/qnaController'); // <--- ADICIONADO
const settingsController = require('./controllers/settingsController');
// const seedTestData = require('./controllers/seed_test_data'); // [OTIMIZAÇÃO] Desativado para economizar memória na inicialização

const app = express();

// --- FIX: FLAG DE INICIALIZAÇÃO (EARLY BINDING) ---
// Permite que o servidor inicie a porta imediatamente para passar no health check do Render,
// mesmo que o banco de dados ainda esteja sincronizando.
let isDbSynced = false;
app.use((req, res, next) => {
    // Permite assets e health checks, bloqueia API/Páginas até o DB estar pronto
    if (!isDbSynced && !req.path.startsWith('/assets') && !req.path.startsWith('/css') && !req.path.startsWith('/js')) {
        // Retorna uma página HTML com auto-refresh em vez de texto puro
        return res.status(503).send(`
            <html>
                <head><meta http-equiv="refresh" content="3"></head>
                <body style="font-family:sans-serif; text-align:center; padding:50px; color:#1B4332; background-color:#f8f9fa;">
                    <h1 style="margin-bottom:10px;">Iniciando Sistema...</h1>
                    <p>Estamos finalizando a sincronização do banco de dados.</p>
                    <p style="color:#666; font-size:0.9rem;">A página atualizará automaticamente em instantes.</p>
                </body>
            </html>
        `);
    }
    next();
});

// --- FIX: Confia no proxy (Render/Heroku/AWS) ---
// Isso é essencial para que req.hostname e req.protocol funcionem corretamente atrás de um load balancer.
app.set('trust proxy', 1);

// --- MIDDLEWARE DE REDIRECIONAMENTO DE DOMÍNIO (SEO) ---
// Redireciona yelopsi.com, www.yelopsi.com e yelopsi.com.br para www.yelopsi.com.br
app.use((req, res, next) => {
    // Usa o header 'host' para maior precisão atrás de proxies, removendo a porta se houver
    const host = req.headers.host ? req.headers.host.split(':')[0] : req.hostname;
    const target = 'www.yelopsi.com.br';

    // Ignora IPs na rede local (ex: 192.168.x.x) para permitir testes pelo celular
    const isLocalIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(host);

    // Ignora localhost, IPs locais e domínios de desenvolvimento (Render)
    if (host.includes('localhost') || host.includes('127.0.0.1') || host.includes('onrender.com') || host.includes('render.com') || isLocalIp) {
        return next();
    }

    // CORREÇÃO: Só redireciona se o host for diferente do alvo
    if (host !== target) {
        return res.redirect(301, `https://${target}${req.originalUrl}`);
    }
    next();
});

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
app.get(['/admin', '/admin/'], (req, res) => {
    // IMPORTANTE: Verifique se o nome do seu arquivo principal na pasta admin é 'index.html' ou 'admin.html'
    // Estou assumindo que seja 'index.html' ou 'admin.html'. 
    // Se o seu arquivo principal se chamar "admin.html", use a linha abaixo:
    
    res.sendFile(path.join(__dirname, '../admin/admin.html'));
    
    // Se der erro de arquivo não encontrado, troque 'admin.html' por 'index.html' acima.
});

// --- ADICIONE ISTO ---
app.set('view engine', 'ejs');
// CORREÇÃO: Adiciona a pasta raiz do projeto como um local secundário para procurar views.
// Isso permite que ele encontre 'patient/patient_dashboard.ejs' mesmo que não esteja em /views.
app.set('views', [path.join(__dirname, '../views'), path.join(__dirname, '..')]);
// ---------------------

console.log('[DEPLOY_SYNC] Versão Final Prioritária - v3.1');
const server = http.createServer(app);

// --- INICIALIZAÇÃO ROBUSTA DO SOCKET.IO ---
let io;
try {
    // Tenta usar a configuração existente
    io = initSocket(server);
} catch (e) {
    console.warn("Aviso: initSocket encontrou um problema:", e.message);
}

// Se initSocket não retornou a instância (comum se o arquivo config/socket.js não tiver return),
// tentamos recuperar do módulo ou inicializar manualmente.
if (!io) {
    try {
        const socketConfig = require('./config/socket');
        if (socketConfig.io) io = socketConfig.io;
        else if (socketConfig.getIO) io = socketConfig.getIO();
        else if (socketConfig.getIo) io = socketConfig.getIo();
    } catch (e) { /* Ignora erro de require */ }

    if (!io) {
        console.log("⚠️ Socket.IO não retornado pelo config. Inicializando manualmente...");
        io = new Server(server, {
            cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] }
        });
    }
}

// --- CORREÇÃO: HANDLERS DE STATUS DE MENSAGEM (LIDO/ENTREGUE) ---
if (io) {
    io.on('connection', (socket) => {
        console.log(`[SOCKET] Nova conexão estabelecida: ${socket.id}`);
        // Tenta identificar quem é o usuário para filtrar atualizações
        let user = null;
        try {
            let token = socket.handshake.auth.token;
            // --- MIGRAÇÃO SEGURA: Fallback para ler o Cookie se o token do JS for a flag ---
            if (!token || token === 'cookie_auth_active') {
                if (socket.handshake.headers.cookie) {
                    const cookies = socket.handshake.headers.cookie.split(';');
                    const tokenCookie = cookies.find(c => c.trim().startsWith('token='));
                    if (tokenCookie) token = tokenCookie.split('=')[1];
                }
            }
            if (token) {
                user = jwt.verify(token, process.env.JWT_SECRET);
                
                // --- CORREÇÃO CRÍTICA: Entra na sala do usuário para receber mensagens ---
                // Inscreve em múltiplas variações de sala para garantir que o Controller encontre o socket
                if (user && user.id) {
                    // 1. Padrão genérico
                    socket.join(`user-${user.id}`);
                    
                    // 2. Padrão específico por tipo (Psicólogo)
                    if (user.role === 'psychologist' || user.type === 'psychologist') {
                        socket.join(`psychologist-${user.id}`);
                    }
                    
                    // 3. Padrão específico por tipo (Paciente)
                    else if (user.role === 'patient' || user.type === 'patient') {
                        socket.join(`patient-${user.id}`);
                    }
                }
                
                if (user && (user.role === 'admin' || user.type === 'admin')) {
                    socket.join('admins');
                }
            }
        } catch (e) { /* Token inválido ou ausente */ }

        // --- CORREÇÃO: Relay manual de mensagem do Admin para garantir entrega instantânea ---
        socket.on('admin_sent_message', (msg) => {
            // O Admin envia este evento para forçar a notificação ao usuário alvo
            if (msg.targetUserId) {
                // Envia para todas as variações possíveis de sala do usuário (Union para evitar duplicatas)
                io.to(`user-${msg.targetUserId}`)
                  .to(`psychologist-${msg.targetUserId}`)
                  .to(`patient-${msg.targetUserId}`)
                  .emit('receiveMessage', msg);
            }
        });

        // 1. Quando o destinatário confirma que recebeu a mensagem
        socket.on('message_delivered', async ({ messageId }) => {
            try {
                if (!messageId) return;
                const [updated] = await db.Message.update(
                    { status: 'delivered' },
                    { where: { id: messageId, status: 'sent' } }
                );
                if (updated > 0) {
                    io.emit('message_status_updated', { messageId, status: 'delivered' });
                }
            } catch (err) { console.error("Erro socket message_delivered:", err.message); }
        });

        // 2. Quando o usuário abre a conversa (Lê as mensagens)
        socket.on('messages_read', async ({ conversationId }) => {
            try {
                if (!conversationId) return;
                
                // Log para debug
                console.log(`[SOCKET] messages_read recebido. ConversationId: ${conversationId}, User: ${user ? user.id : 'Anon'}`);
                
                // CORREÇÃO: Busca explicitamente mensagens 'sent' ou 'delivered' para marcar como lidas
                const whereClause = { conversationId, status: { [Op.in]: ['sent', 'delivered'] } };
                
                if (user) {
                    // Se quem leu foi o Admin, marca como lido as mensagens que NÃO são do Admin
                    if (user.role === 'admin' || user.type === 'admin') whereClause.senderType = { [Op.ne]: 'admin' };
                    // Se quem leu foi o Psicólogo, marca como lido as mensagens que NÃO são do Psicólogo
                    else if (user.role === 'psychologist' || user.type === 'psychologist') whereClause.senderType = { [Op.ne]: 'psychologist' };
                    // Se quem leu foi o Paciente, marca como lido as mensagens que NÃO são do Paciente
                    else if (user.role === 'patient' || user.type === 'patient') whereClause.senderType = { [Op.ne]: 'patient' };
                }

                const msgs = await db.Message.findAll({ attributes: ['id'], where: whereClause });
                
                if (msgs.length > 0) {
                    // console.log(`[SOCKET] Atualizando ${msgs.length} mensagens para 'read'.`);
                    // CORREÇÃO: Força atualização via SQL puro para garantir persistência
                    const ids = msgs.map(m => m.id);
                    
                    // Atualiza no banco
                    await db.sequelize.query(
                        `UPDATE "Messages" SET "status" = 'read', "updatedAt" = NOW() WHERE "id" IN (:ids)`,
                        { replacements: { ids } }
                    );
                    
                    // Emite evento individual para cada mensagem para atualizar a UI do remetente (Admin)
                    msgs.forEach(m => io.emit('message_status_updated', { messageId: m.id, status: 'read' }));
                } else {
                    // console.log(`[SOCKET] Nenhuma mensagem para atualizar.`);
                }
            } catch (err) { console.error("Erro socket messages_read:", err.message); }
        });
    });
} else {
    console.error("❌ ERRO CRÍTICO: Não foi possível inicializar o Socket.IO. O chat em tempo real não funcionará.");
}
// -----------------------------------------------------------------

// --- MIDDLEWARES ---
app.use(cors({
    origin: (origin, callback) => {
        const allowedOrigins = [process.env.FRONTEND_URL];
        // Em produção, restringir para a URL do frontend. Permite requisições sem origin (como server-to-server)
        if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
            callback(null, true);
        } else {
            callback(new Error('Origem não permitida pelo CORS'));
        }
    },
    credentials: true
}));
app.use(cookieParser()); // <-- Adicionado para ler cookies de sessão

// --- MIDDLEWARE DE SESSÃO ATIVA (NOVO) ---
// Rastreia todos os visitantes (logados ou não) para o card "Acessos Simultâneos"
app.use(async (req, res, next) => {
    // Ignora requisições de API e arquivos estáticos para não sobrecarregar o banco
    if (req.path.startsWith('/api/') || req.path.includes('.')) {
        return next();
    }

    let sessionId = req.cookies.yelo_session;

    if (!sessionId) {
        sessionId = crypto.randomBytes(16).toString('hex');
        // Define um cookie com validade de 1 ano
        res.cookie('yelo_session', sessionId, { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax' });
    }

    try {
        // [OTIMIZAÇÃO] Removemos o 'await' para não travar o carregamento da página
        db.sequelize.query(
            `INSERT INTO "ActiveSessions" ("sessionId", "lastSeen") VALUES (:sessionId, NOW()) ON CONFLICT ("sessionId") DO UPDATE SET "lastSeen" = NOW();`,
            { replacements: { sessionId }, type: db.sequelize.QueryTypes.INSERT }
        ).catch(() => {}); // Falha silenciosa em background
    } catch (e) {
        // Falha silenciosa para não quebrar a navegação do usuário
    }
    next();
});


// --- MIDDLEWARE DE VISITAS (NOVO) ---
// Regex para ignorar arquivos estáticos comuns
const staticFileRegex = /\.(css|js|json|ico|png|jpg|jpeg|webp|svg|woff|woff2|ttf|eot)$/i;

// Registra cada acesso ao site para alimentar o gráfico e o card de "Acessos"
app.use(async (req, res, next) => {
    // Filtra para não contar requisições de API ou de arquivos estáticos
    if (req.method === 'GET' && !req.path.startsWith('/api') && !staticFileRegex.test(req.path)) {
        
        try {
            // [MELHORIA] Captura dados estratégicos da visita
            const userAgent = req.headers['user-agent'] || 'Unknown';
            const url = req.originalUrl || req.path;
            const referrer = req.headers['referer'] || null;
            
            // Tenta inserir com dados ricos (Requer que a tabela tenha essas colunas, ou falhará silenciosamente como antes)
            // Se as colunas não existirem, sugiro criar uma migration ou usar a rota de fix abaixo
            db.sequelize.query(
                `INSERT INTO "SiteVisits" ("url", "userAgent", "referrer", "createdAt", "updatedAt") VALUES (:url, :ua, :ref, NOW(), NOW())`,
                { replacements: { url, ua: userAgent, ref: referrer } }
            ).catch(() => {
                // Fallback para o modo simples se as colunas não existirem ainda
                db.sequelize.query(`INSERT INTO "SiteVisits" ("createdAt", "updatedAt") VALUES (NOW(), NOW())`).catch(() => {});
            });
        } catch (e) { console.error("Erro ao registrar visita:", e.message); }
    }
    next();
});

// Isso permite que a gente pegue o 'rawBody' apenas na rota do webhook
app.use(express.json({
  limit: '10mb', // Limite ajustado para 10mb (suficiente para fotos)
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

// Middleware para injetar o 'io' do Socket.IO em todas as requisições
app.use((req, res, next) => {
    req.io = io;
    next();
});
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- MIDDLEWARE LOCAL DE AUTENTICAÇÃO ---
const verifyTokenLocal = (req, res, next) => {
    let token = req.headers.authorization?.split(' ')[1];
    if (!token || token === 'null' || token === 'undefined' || token === 'cookie_auth_active') {
        token = req.cookies?.token;
    }
    if (!token) return res.status(401).json({ error: 'Não autorizado' });
    try {
        req.userDecoded = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Token inválido ou expirado' });
    }
};

// =============================================================
// ROTA DE ANALYTICS (SESSÃO ANÔNIMA)
// =============================================================
app.post('/api/analytics/session-end', async (req, res) => {
    try {
        const { sessionId, duration } = req.body;

        if (sessionId && duration && duration > 0) {
            // Usamos 'upsert' com SQL puro para inserir ou atualizar a sessão.
            await db.sequelize.query(
                `INSERT INTO "AnonymousSessions" ("sessionId", "durationInSeconds", "endedAt", "createdAt", "updatedAt")
                 VALUES (:sessionId, :duration, NOW(), NOW(), NOW())
                 ON CONFLICT ("sessionId") DO UPDATE SET
                 "durationInSeconds" = :duration,
                 "endedAt" = NOW(),
                 "updatedAt" = NOW();`,
                {
                    replacements: { sessionId, duration: parseInt(duration, 10) },
                    type: db.sequelize.QueryTypes.INSERT
                }
            );
        }
        res.status(204).send();
    } catch (error) {
        res.status(204).send();
    }
});

// ROTA DE ANALYTICS (INSTALAÇÃO PWA)
app.post('/api/analytics/pwa-install', async (req, res) => {
    try {
        const userAgent = req.headers['user-agent'] || 'Unknown';
        const { platform } = req.body; // 'ios', 'android' ou 'desktop'
        
        await db.sequelize.query(
            `INSERT INTO "PwaInstallLogs" ("userAgent", "platform", "createdAt") VALUES (:ua, :plat, NOW())`,
            { replacements: { ua: userAgent, plat: platform || 'unknown' } }
        );
        res.status(200).send('OK');
    } catch (error) {
        console.error("Erro ao registrar PWA install:", error);
        res.status(500).send('Erro');
    }
});

// =============================================================
// ROTA DE TELEMETRIA (SHADOW TRACKING)
// =============================================================
app.post('/api/tracking/uso-feature', verifyTokenLocal, async (req, res) => {
    try {
        const { feature } = req.body;
        const psiId = req.userDecoded.id;
        
        if (!feature) return res.status(400).send('Feature não informada');
        
        await db.sequelize.query(
            `INSERT INTO "FeatureTrackingLogs" ("psychologistId", "feature", "createdAt") VALUES (:psiId, :feature, NOW())`,
            { replacements: { psiId, feature }, type: db.sequelize.QueryTypes.INSERT }
        );
        
        res.status(200).send('Tracked');
    } catch (error) {
        console.error('Erro a registar telemetria:', error);
        res.status(500).send('Erro interno');
    }
});

// ROTA DE ESTATÍSTICAS PWA (ADMIN) - Leitura para o Relatório
app.get('/api/admin/stats/pwa', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'Não autorizado' });
        
        // Total Geral
        const [totalResult] = await db.sequelize.query(
            `SELECT COUNT(*) as count FROM "PwaInstallLogs"`,
            { type: db.sequelize.QueryTypes.SELECT }
        );
        
        // Por Plataforma (Android/iOS)
        const byPlatform = await db.sequelize.query(
            `SELECT platform, COUNT(*) as count FROM "PwaInstallLogs" GROUP BY platform`,
            { type: db.sequelize.QueryTypes.SELECT }
        );

        res.json({
            total: parseInt(totalResult?.count || 0),
            byPlatform: byPlatform
        });
    } catch (error) {
        console.error("Erro ao buscar stats PWA:", error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// =============================================================
// 🚨 ROTAS DE EMERGÊNCIA (DESATIVADAS PARA PRODUÇÃO) 🚨
// =============================================================

 // COMENTE TUDO ISTO AQUI PARA NINGUÉM ACESSAR:

// Bloqueio global para as rotas de correção em produção
if (process.env.NODE_ENV === 'production') {
    app.use([/^\/api\/fix-.*/, /^\/fix-.*/], (req, res) => res.status(403).json({ error: 'Rotas de manutenção desativadas em produção.' }));
}

app.get('/api/fix-activate-psis', async (req, res) => { /* ... */ });

app.get('/fix-db-columns', async (req, res) => { /* ... */ });

app.get('/api/fix-vip-all', async (req, res) => { /* ... */ });

app.get('/api/fix-reset-payment', async (req, res) => { /* ... */ });

// --- ROTA DE LIMPEZA: APAGA PERMANENTEMENTE OS SOFT DELETES ---
app.get('/api/fix-clean-soft-deleted', async (req, res) => {
    try {
        // 1. Busca os IDs dos psicólogos na lixeira
        const psisNaLixeira = await db.sequelize.query(`
            SELECT id FROM "Psychologists" WHERE "deletedAt" IS NOT NULL;
        `, { type: db.sequelize.QueryTypes.SELECT });

        const ids = psisNaLixeira.map(p => p.id);

        if (ids.length > 0) {
            // 2. Apaga os registros dependentes em massa (limpa rastros) para não quebrar a chave estrangeira
            const tabelasComPsychologistId = [
                '"GamificationLogs"', '"WhatsappClickLogs"', '"ProfileAppearanceLogs"',
                '"MatchEvents"', '"Appointments"', '"Expenses"', '"ExitSurveys"',
                '"Reviews"', '"Conversations"', '"Answers"', '"QuestionIgnores"'
            ];

            for (const tabela of tabelasComPsychologistId) {
                try { await db.sequelize.query(`DELETE FROM ${tabela} WHERE "psychologistId" IN (:ids)`, { replacements: { ids } }); } catch(e) { }
            }

            // Tabelas com nome de coluna em Maiúsculo
            const tabelasComPsychologistIdMaiusculo = [
                '"ForumVotes"', '"ForumCommentVotes"', '"ForumComments"', '"ForumPosts"'
            ];
            for (const tabela of tabelasComPsychologistIdMaiusculo) {
                try { await db.sequelize.query(`DELETE FROM ${tabela} WHERE "PsychologistId" IN (:ids)`, { replacements: { ids } }); } catch(e) { }
            }

            // Casos com nomenclaturas específicas
            try { await db.sequelize.query(`DELETE FROM posts WHERE psychologist_id IN (:ids)`, { replacements: { ids } }); } catch(e) {}
            try { await db.sequelize.query(`DELETE FROM "ForumReports" WHERE "reporterId" IN (:ids)`, { replacements: { ids } }); } catch(e) {}
            try { await db.sequelize.query(`DELETE FROM "Messages" WHERE "senderId" IN (:ids) AND "senderType" = 'psychologist'`, { replacements: { ids } }); } catch(e) {}
            try { await db.sequelize.query(`DELETE FROM "Messages" WHERE "recipientId" IN (:ids) AND "recipientType" = 'psychologist'`, { replacements: { ids } }); } catch(e) {}
        }

        // 3. Finalmente, exclui os psicólogos
        const [results] = await db.sequelize.query(`
            DELETE FROM "Psychologists" 
            WHERE "deletedAt" IS NOT NULL 
            RETURNING id;
        `);

        res.send(`<div style="font-family:sans-serif; padding:40px;">
                    <h2 style="color:#1B4332;">Limpeza Concluída! 🧹</h2>
                    <p><strong>${results.length}</strong> profissionais que estavam na lixeira (Soft Delete) e todos os seus registros associados foram apagados permanentemente.</p>
                  </div>`);
    } catch (error) {
        console.error("Erro no hard delete:", error);
        res.status(500).send("Erro ao limpar base: " + error.message);
    }
});

// --- ROTA DE CORREÇÃO: ENVIAR CONVITE PARA TODOS DA LISTA DE ESPERA E LIMPAR ---
app.get('/api/run-invite-all-waitlist', async (req, res) => {
    try {
        const waitlist = await db.WaitingList.findAll({ where: { status: 'pending' } });
        if (waitlist.length === 0) return res.send("A lista de espera já está vazia!");

        const emailService = require('./services/emailService');
        let sentCount = 0;

        for (const candidate of waitlist) {
            const invitationToken = crypto.randomBytes(32).toString('hex');
            const expirationDate = new Date();
            expirationDate.setDate(expirationDate.getDate() + 7);

            await candidate.update({ status: 'invited', invitationToken, invitationExpiresAt: expirationDate });

            const link = `${process.env.FRONTEND_URL || 'https://www.yelopsi.com.br'}/psi-registro?token=${invitationToken}&email=${encodeURIComponent(candidate.email)}`;
            const htmlContent = `<h2>Olá, ${candidate.nome}!</h2><p>Uma vaga foi liberada para você na Yelo!</p><a href="${link}" style="display:inline-block; padding:10px 20px; background:#1B4332; color:#fff; text-decoration:none; border-radius:5px;">Concluir Cadastro</a>`;

            try {
                if (typeof emailService.sendInvitationEmail === 'function') await emailService.sendInvitationEmail(candidate, link);
                else if (typeof emailService.sendEmail === 'function') await emailService.sendEmail(candidate.email, "Seu convite para a Yelo chegou! 🎉", htmlContent);
                sentCount++;
            } catch(e) { console.error(`Erro email para ${candidate.email}:`, e.message); }
        }
        res.send(`<h2>✅ Sucesso!</h2><p>${sentCount} psicólogos foram convidados e a lista de espera foi esvaziada.</p>`);
    } catch (error) { res.status(500).send("Erro: " + error.message); }
});

// --- ROTA DE CORREÇÃO: LIMPAR TODA A LISTA DE ESPERA ---
app.get('/api/run-clear-waitlist', async (req, res) => {
    try {
        const count = await db.WaitingList.count();
        await db.WaitingList.destroy({ where: {} });
        res.send(`<div style="font-family: sans-serif; padding: 20px;"><h2>✅ Sucesso!</h2><p>A lista de espera foi completamente esvaziada. <b>${count}</b> registros foram removidos do banco de dados.</p></div>`);
    } catch (error) { 
        res.status(500).send("Erro ao limpar a lista: " + error.message); 
    }
});

// --- ROTA DE CORREÇÃO: VER QUEM FOI CONVIDADO MAS O E-MAIL FALHOU E RESETAR ---
app.get('/api/fix-reset-failed-invites', async (req, res) => {
    try {
        const failedInvites = await db.WaitingList.findAll({ where: { status: 'invited' } });
        
        if (failedInvites.length === 0) {
            return res.send("<div style='font-family: sans-serif; padding: 20px;'><h2>Tudo limpo!</h2><p>Não há ninguém com status 'invited' precisando de reenvio.</p></div>");
        }

        const details = failedInvites.map(u => `<li>${u.nome || 'Sem Nome'} - <b>${u.email}</b></li>`).join('');

        // Reseta eles para 'pending'
        await db.WaitingList.update(
            { status: 'pending' },
            { where: { status: 'invited' } }
        );

        res.send(`
            <div style="font-family: sans-serif; padding: 20px; line-height: 1.6;">
                <h2 style="color:#1B4332;">✅ Sucesso! ${failedInvites.length} psicólogos foram resetados.</h2>
                <p>Eles estavam marcados como "Convidados" no banco de dados, mas o e-mail de convite havia falhado por conta daquele erro antigo de senha. Agora eles voltaram para o status <b>Pendente</b>.</p>
                <h3>Quem são eles?</h3>
                <ul>${details}</ul>
                <br>
                <p>Como a senha do e-mail já foi corrigida, você pode clicar no botão abaixo para disparar os e-mails novamente (agora com sucesso):</p>
                <a href="/api/run-invite-all-waitlist" style="display:inline-block; padding:12px 24px; background:#1B4332; color:#fff; text-decoration:none; border-radius:5px; font-weight: bold; margin-top: 10px;">Reenviar Convites Agora</a>
            </div>
        `);
    } catch (error) { res.status(500).send("Erro: " + error.message); }
});

// --- ROTA DE AUDITORIA: BLOQUEIA PERFIS QUE BURLARAM O PAGAMENTO ---
app.get('/api/run-inadimplentes', async (req, res) => {
    try {
        let ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/v3';
        ASAAS_API_URL = ASAAS_API_URL.trim().replace(/\/+$/, '');
        if (ASAAS_API_URL.includes('sandbox.asaas.com') && !ASAAS_API_URL.includes('/api')) {
            ASAAS_API_URL = ASAAS_API_URL.replace('sandbox.asaas.com', 'sandbox.asaas.com/api');
        }
        const ASAAS_API_KEY = process.env.ASAAS_API_KEY ? process.env.ASAAS_API_KEY.trim() : '';

        // Busca TODOS os psicólogos para gerar o relatório completo na tela
        const psis = await db.Psychologist.findAll({
            order: [['createdAt', 'DESC']]
        });

        let html = `
        <div style="font-family:sans-serif; padding:20px; max-width: 1200px; margin: 0 auto;">
            <h2 style="color:#1B4332;">Relatório de Auditoria e Pagamentos</h2>
            <p>Veja o diagnóstico completo de comunicação com o Asaas.</p>
            <table border="1" cellpadding="10" style="border-collapse: collapse; width: 100%; text-align: left; font-size: 14px;">
                <tr style="background:#f0fdf4; color:#1B4332;">
                    <th>E-mail</th>
                    <th>Status Local</th>
                    <th>Isento?</th>
                    <th>ID Assinatura</th>
                    <th>Status no Asaas</th>
                    <th>Ação Realizada Agora</th>
                </tr>`;

        for (const psi of psis) {
            if (psi.isAdmin) continue; // Pula a conta do Administrador

            let acao = '-';
            let asaasInfo = '-';
            const subId = psi.stripeSubscriptionId || psi.subscriptionId;
            
            // Vamos "atacar" quem está como ACTIVE OU que tem a coluna PLANO preenchida indevidamente, e não é VIP
            if ((psi.status === 'active' || (psi.plano && psi.plano.trim() !== '')) && psi.is_exempt !== true) {
                if (!subId) {
                    await psi.update({ status: 'inactive', plano: null, planExpiresAt: new Date(0) });
                    acao = '<span style="color:red; font-weight:bold;">Revogado (Sem ID de Assinatura)</span>';
                } else {
                    // Consulta a API do Asaas
                    const asaasRes = await fetch(`${ASAAS_API_URL}/subscriptions/${subId}/payments`, {
                        headers: { 'access_token': ASAAS_API_KEY }
                    });

                    if (asaasRes.ok) {
                        const paymentsData = await asaasRes.json();
                        
                        if (paymentsData.data && paymentsData.data.length > 0) {
                            // Extrai o status de todos os pagamentos daquela assinatura
                            const statuses = paymentsData.data.map(p => p.status).join(', ');
                            asaasInfo = `Encontrados: <b>${statuses}</b>`;

                            // Tem que ter pelo menos 1 pago ou confirmado
                            const hasPaid = paymentsData.data.some(p => ['CONFIRMED', 'RECEIVED'].includes(p.status));

                            if (!hasPaid) {
                                await psi.update({ status: 'inactive', plano: null, planExpiresAt: new Date(0), stripeSubscriptionId: null });
                                acao = '<span style="color:red; font-weight:bold;">Revogado (Pagamento Pendente/Falho)</span>';
                            } else {
                                // Se pagou mas estava pending (erro antigo de sincronia), já corrige pra active
                                if (psi.status !== 'active') {
                                    await psi.update({ status: 'active' });
                                    acao = '<span style="color:green; font-weight:bold;">Regularizado (Ativado)</span>';
                                } else {
                                acao = '<span style="color:green; font-weight:bold;">Regular (Pago)</span>';
                                }
                            }
                        } else {
                            asaasInfo = '<span style="color:orange;">Nenhuma cobrança gerada ainda</span>';
                            await psi.update({ status: 'inactive', plano: null, planExpiresAt: new Date(0), stripeSubscriptionId: null });
                            acao = '<span style="color:red; font-weight:bold;">Revogado (Sem Cobranças)</span>';
                        }
                    } else {
                        asaasInfo = `<span style="color:red;">Erro API Asaas: ${asaasRes.status}</span>`;
                        acao = 'Pulado (Falha de comunicação)';
                    }
                }
            } else {
                // Se o cara já é inativo, só mostra que ignorou
                if (psi.is_exempt === true) acao = 'Ignorado (É VIP)';
                else acao = 'Ignorado (Sem plano e Inativo/Pendente)';
            }

            html += `<tr>
                <td>${psi.email}</td>
                <td>${psi.status}</td>
                <td>${psi.is_exempt === true ? 'Sim' : 'Não'}</td>
                <td>${subId || '<i style="color:#999">Nenhum</i>'}</td>
                <td>${asaasInfo}</td>
                <td>${acao}</td>
            </tr>`;
        }

        html += '</table></div>';
        res.send(html);
    } catch (err) { res.status(500).send("Erro: " + err.message); }
});

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

// --- ROTA DE EMERGÊNCIA: ESTENDER ASSINATURA ---
app.get('/api/fix-extend-plan', async (req, res) => {
    try {
        const email = req.query.email;
        const dias = parseInt(req.query.dias) || 30; // Padrão: 30 dias a partir de hoje

        if (!email) return res.status(400).send("Informe o email na URL: ?email=psicologa@email.com&dias=30");

        const psychologist = await db.Psychologist.findOne({ where: { email } });
        
        if (!psychologist) return res.status(404).send("Usuário não encontrado.");

        const novaData = new Date();
        novaData.setDate(novaData.getDate() + dias);

        await psychologist.update({ planExpiresAt: novaData, status: 'active' });
        
        res.send(`✅ Sucesso! Assinatura de ${email} estendida para ${novaData.toLocaleDateString('pt-BR')}.`);
    } catch (error) {
        res.status(500).send("Erro: " + error.message);
    }
});

// Rota para converter um psicólogo em Criador de Conteúdo (Invisível)
app.get('/api/fix-make-content-creator', async (req, res) => {
    try {
        const email = req.query.email;
        if (!email) return res.status(400).send("Informe o email na URL: ?email=exemplo@yelopsi.com.br");

        const [updated] = await db.Psychologist.update({ status: 'creator' }, { where: { email } });
        
        if (updated) res.send(`Sucesso! O usuário ${email} agora é um Criador de Conteúdo (Invisível no match/perfil).`);
        else res.status(404).send("Usuário não encontrado.");
    } catch (error) {
        res.status(500).send("Erro: " + error.message);
    }
});

// --- ROTA DE CORREÇÃO: CRIAR TABELAS DE KPI (DASHBOARD) ---
app.get('/api/fix-create-kpi-tables', async (req, res) => {
    try {
        await db.sequelize.query(`
            CREATE TABLE IF NOT EXISTS "ProfileAppearanceLogs" (
                "id" SERIAL PRIMARY KEY,
                "psychologistId" INTEGER,
                "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await db.sequelize.query(`
            CREATE TABLE IF NOT EXISTS "MatchEvents" (
                "id" SERIAL PRIMARY KEY,
                "psychologistId" INTEGER,
                "matchTags" TEXT[], 
                "matchScore" INTEGER,
                "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        res.send("✅ Sucesso! Tabelas de KPI (Dashboard) criadas.");
    } catch (error) {
        res.status(500).send("Erro ao criar tabelas: " + error.message);
    }
});

// Rota para criar a coluna IS_EXEMPT (VIP) na tabela Psychologists
app.get('/api/fix-add-is-exempt-column', async (req, res) => {
    try {
        await db.sequelize.query('ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "is_exempt" BOOLEAN DEFAULT FALSE;');
        res.send("Sucesso! Coluna 'is_exempt' criada no banco de dados.");
    } catch (error) {
        res.status(500).send("Erro ao criar coluna: " + error.message);
    }
});

// Rota para criar a coluna fotoUrl (EMERGÊNCIA)
app.get('/api/fix-add-foto-url', async (req, res) => {
    try {
        await db.sequelize.query('ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "fotoUrl" VARCHAR(500);');
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "fotoUrl" VARCHAR(500);');
        res.send("✅ Sucesso! Coluna 'fotoUrl' criada no banco de dados para Psicólogos e Pacientes.");
    } catch (error) {
        res.status(500).send("❌ Erro ao criar coluna: " + error.message);
    }
});

// Rota para criar a coluna STATUS na tabela Conversations (CORREÇÃO DO CHAT)
app.get('/api/fix-add-conversation-status', async (req, res) => {
    try {
        await db.sequelize.query(`ALTER TABLE "Conversations" ADD COLUMN IF NOT EXISTS "status" VARCHAR(255) DEFAULT 'active';`);
        res.send("Sucesso! Coluna 'status' criada em Conversations.");
    } catch (error) {
        res.status(500).send("Erro: " + error.message);
    }
});

// Rota para criar a coluna STATUS na tabela Messages (CORREÇÃO DO CHAT)
app.get('/api/fix-add-message-status', async (req, res) => {
    try {
        await db.sequelize.query(`ALTER TABLE "Messages" ADD COLUMN IF NOT EXISTS "status" VARCHAR(255) DEFAULT 'sent';`);
        res.send("Sucesso! Coluna 'status' criada em Messages.");
    } catch (error) {
        res.status(500).send("Erro: " + error.message);
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

// Rota para criar colunas de inteligência na tabela SiteVisits
app.get('/api/fix-add-analytics-columns', async (req, res) => {
    try {
        await db.sequelize.query('ALTER TABLE "SiteVisits" ADD COLUMN IF NOT EXISTS "url" VARCHAR(255);');
        await db.sequelize.query('ALTER TABLE "SiteVisits" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;');
        await db.sequelize.query('ALTER TABLE "SiteVisits" ADD COLUMN IF NOT EXISTS "referrer" TEXT;');
        res.send("Sucesso! Colunas de Analytics criadas.");
    } catch (error) {
        res.status(500).send("Erro ao criar colunas: " + error.message);
    }
});

// Rota para converter a coluna de JSON para JSONB (necessário para o índice GIN)
app.get('/api/fix-json-to-jsonb', async (req, res) => {
    try {
        // Converte a coluna 'searchParams' da tabela 'DemandSearches' de JSON para JSONB.
        // O 'USING "searchParams"::text::jsonb' é crucial para converter os dados existentes.
        await db.sequelize.query('ALTER TABLE "DemandSearches" ALTER COLUMN "searchParams" TYPE JSONB USING "searchParams"::text::jsonb;');
        res.send("Sucesso! A coluna 'searchParams' foi convertida para JSONB. Agora você pode criar o índice GIN.");
    } catch (error) {
        // Se a coluna já for JSONB, o erro "column is already of type jsonb" pode aparecer, o que é bom.
        console.error("Erro ao converter JSON para JSONB:", error.message);
        res.status(500).send(`Erro ao converter JSON para JSONB: ${error.message}. Se a mensagem for "column is already of type jsonb", ignore e prossiga para a criação do índice.`);
    }
});

// Rota para criar índices GIN para acelerar buscas em JSONB
app.get('/api/fix-add-jsonb-indexes', async (req, res) => {
    try {
        // Índice para a tabela DemandSearches (acelera a página de Analytics)
        await db.sequelize.query('CREATE INDEX IF NOT EXISTS idx_gin_demandsearches_searchparams ON "DemandSearches" USING GIN ("searchParams");');
        res.send("Sucesso! Índices GIN para colunas JSONB foram criados/verificados. A página de Analytics de Questionários ficará muito mais rápida.");
    } catch (error) {
        console.error("Erro detalhado ao criar índice GIN:", error);
        res.status(500).send(`Erro ao criar índices GIN: ${error.message}. Verifique se a coluna 'searchParams' é do tipo JSONB. Se não for, acesse a rota /api/fix-json-to-jsonb primeiro.`);
    }
});

// Rota para criar colunas de AUDITORIA na tabela Patients (LGPD/Segurança)
app.get('/api/fix-patient-audit', async (req, res) => {
    try {
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "ip_registro" VARCHAR(45);');
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "termos_aceitos" BOOLEAN DEFAULT FALSE;');
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "marketing_aceito" BOOLEAN DEFAULT FALSE;');
        res.send("Sucesso! Colunas de auditoria (IP, Termos, Marketing) criadas em Patients.");
    } catch (error) {
        res.status(500).send("Erro ao criar colunas: " + error.message);
    }
});

// --- FIX: ROTA MANUAL PARA CRIAR COLUNAS DE SENHA ---
app.get('/api/fix-password-columns', async (req, res) => {
    try {
        console.log("Executando correção manual de colunas de senha...");
        await db.sequelize.query('ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "resetPasswordToken" VARCHAR(255);');
        await db.sequelize.query('ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "resetPasswordExpires" BIGINT;');
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "resetPasswordToken" VARCHAR(255);');
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "resetPasswordExpires" BIGINT;');
        res.send("✅ Sucesso! Colunas de recuperação de senha criadas.");
    } catch (error) {
        console.error("Erro na correção manual:", error);
        res.status(500).send("Erro ao criar colunas: " + error.message);
    }
});

// Rota para corrigir tabela de Admins (Adicionar colunas faltantes)
app.get('/api/fix-admin-table', async (req, res) => {
    try {
        await db.sequelize.query('ALTER TABLE "Admins" ADD COLUMN IF NOT EXISTS "telefone" VARCHAR(255);');
        await db.sequelize.query('ALTER TABLE "Admins" ADD COLUMN IF NOT EXISTS "fotoUrl" VARCHAR(255);');
        res.send("Sucesso! Colunas 'telefone' e 'fotoUrl' adicionadas à tabela Admins.");
    } catch (error) {
        res.status(500).send("Erro ao alterar tabela: " + error.message);
    }
});

// 🚨 ROTA DE EMERGÊNCIA (COMENTADA PARA SEGURANÇA) 🚨

// --- ROTA DE CORREÇÃO: ATRIBUI BADGES DE PIONEIRO RETROATIVAMENTE ---
app.get('/api/fix-assign-pioneer-badges', async (req, res) => {
    try {
        const gamificationService = require('./services/gamificationService');
        const PIONEER_BADGE_LIMIT = 100;

        // 1. Conta quantos já têm a badge para saber quantos slots faltam
        const currentPioneerCount = await db.Psychologist.count({
            where: { 'badges.pioneiro': true }
        });

        const slotsAvailable = PIONEER_BADGE_LIMIT - currentPioneerCount;

        if (slotsAvailable <= 0) {
            return res.send('Todos os 100 badges de Pioneiro já foram distribuídos.');
        }

        // 2. Busca os candidatos elegíveis que AINDA NÃO têm a badge
        const candidates = await db.Psychologist.findAll({
            where: {
                status: 'active',
                [Op.or]: [
                    { is_exempt: true },
                    { planExpiresAt: { [Op.gt]: new Date() } }
                ],
                [Op.or]: [
                    { badges: { [Op.is]: null } },
                    { 'badges.pioneiro': { [Op.not]: true } }
                ]
            },
            order: [['createdAt', 'ASC']],
            limit: slotsAvailable // Busca apenas o número de candidatos necessários
        });

        if (candidates.length === 0) {
            return res.send('Nenhum novo candidato elegível para a badge de Pioneiro encontrado.');
        }

        // 3. Atribui a badge para os candidatos encontrados
        let assignedCount = 0;
        for (const candidate of candidates) {
            await gamificationService.assignPioneerBadge(candidate.id);
            assignedCount++;
        }

        res.send(`<h2>Atribuição de Badges Concluída!</h2>
                  <p><strong>${assignedCount}</strong> novos badges de "Pioneiro" foram atribuídos.</p>
                  <p>Total de pioneiros agora: ${currentPioneerCount + assignedCount}/${PIONEER_BADGE_LIMIT}.</p>`);

    } catch (error) {
        console.error("Erro ao atribuir badges de pioneiro:", error);
        res.status(500).send("Erro: " + error.message);
    }
});
/*
app.get('/api/fix-reset-admin-password', async (req, res) => {
    try {
        const email = 'admin@yelopsi.com.br';
        const newPassword = 'admin123';
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // 1. Garante que a tabela existe
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

        // 2. Insere ou Atualiza (UPSERT) para garantir que o usuário exista
        await db.sequelize.query(`
            INSERT INTO "Admins" (email, senha, nome, "createdAt", "updatedAt")
            VALUES (:email, :senha, 'Admin Geral', NOW(), NOW())
            ON CONFLICT (email) 
            DO UPDATE SET senha = :senha;
        `, {
            replacements: { email: email, senha: hashedPassword }
        });

        // 3. Atualiza na tabela Psychologists (Admin Moderno) se existir
        if (db.Psychologist) {
            await db.Psychologist.update({ senha: hashedPassword }, { where: { email: email } });
        }

        res.send(`Sucesso! Admin (${email}) recriado/atualizado com senha: <strong>${newPassword}</strong>. Tente logar agora.`);
    } catch (error) {
        console.error(error);
        res.status(500).send("Erro ao resetar senha: " + error.message);
    }
});
*/

// Rota para criar a coluna CURTIDAS na tabela posts
app.get('/api/fix-add-likes-column', async (req, res) => {
    try {
        await db.sequelize.query('ALTER TABLE posts ADD COLUMN IF NOT EXISTS curtidas INTEGER DEFAULT 0;');
        res.send("Sucesso! Coluna 'curtidas' criada no banco de dados.");
    } catch (error) {
        res.status(500).send("Erro ao criar coluna: " + error.message);
    }
});

// Rota de DEBUG para listar todas as colunas da tabela Psychologists
app.get('/api/debug/check-schema', async (req, res) => {
    try {
        const [results] = await db.sequelize.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'Psychologists'
            ORDER BY column_name;
        `);
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rota para criar a tabela de Newsletter
app.get('/api/fix-add-newsletter-table', async (req, res) => {
    try {
        await db.sequelize.query(`
            CREATE TABLE IF NOT EXISTS "NewsletterSubscriptions" (
                "id" SERIAL PRIMARY KEY,
                "email" VARCHAR(255) UNIQUE NOT NULL,
                "origin" VARCHAR(255),
                "ipAddress" VARCHAR(45),
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
            );`);
        res.send("Sucesso! Tabela 'NewsletterSubscriptions' criada/verificada.");
    } catch (error) {
        res.status(500).send("Erro ao criar tabela de newsletter: " + error.message);
    }
});

// Rota para criar índice na tabela de posts (acelera "Meus Artigos")
app.get('/api/fix-add-post-index', async (req, res) => {
    try {
        // Cria um índice na coluna "psychologistId" da tabela "posts" se ele não existir.
        // CORREÇÃO: O nome da coluna no banco de dados é "psychologist_id" (snake_case).
        await db.sequelize.query('CREATE INDEX IF NOT EXISTS idx_posts_psychologist_id ON posts ("psychologist_id");');
        res.send("Sucesso! Índice criado na tabela de posts. A página 'Meus Artigos' ficará mais rápida.");
    } catch (error) {
        console.error("Erro ao criar índice em posts:", error.message);
        res.status(500).send(`Erro ao criar índice: ${error.message}.`);
    }
});

// --- ROTA DE LIMPEZA DE CONTEÚDO (BLOG E FÓRUM) ---
app.get('/api/fix-clear-content', async (req, res) => {
    try {
        // 1. Limpa Blog
        await db.Post.destroy({ where: {} });

        // 2. Limpa Fórum (Ordem: Votos -> Comentários -> Posts para evitar erro de chave estrangeira)
        if (db.ForumVote) await db.ForumVote.destroy({ where: {} });
        if (db.ForumCommentVote) await db.ForumCommentVote.destroy({ where: {} });
        if (db.ForumComment) await db.ForumComment.destroy({ where: {} });
        if (db.ForumPost) await db.ForumPost.destroy({ where: {} });

        res.send("Limpeza concluída! Todos os posts do Blog e Fórum (e interações) foram removidos.");
    } catch (error) {
        console.error("Erro ao limpar conteúdo:", error);
        res.status(500).send("Erro ao limpar: " + error.message);
    }
});

// --- ROTA DE LIMPEZA DE PERGUNTAS DA COMUNIDADE (Q&A) ---
app.get('/api/fix-clear-qna', async (req, res) => {
    try {
        // 1. Limpa Respostas (para não dar erro de chave estrangeira)
        if (db.Answer) await db.Answer.destroy({ where: {} });
        // 2. Limpa Perguntas
        if (db.Question) await db.Question.destroy({ where: {} });
        // 3. Limpa Lista de Ignorados (opcional)
        if (db.QuestionIgnore) await db.QuestionIgnore.destroy({ where: {} });

        res.send("Limpeza concluída! Todas as perguntas e respostas da comunidade foram removidas.");
    } catch (error) {
        console.error("Erro ao limpar Q&A:", error);
        res.status(500).send("Erro ao limpar: " + error.message);
    }
});

// --- ROTA DE RESET DE GAMIFICAÇÃO ---
app.get('/api/fix-reset-gamification', async (req, res) => {
    try {
        // 1. Limpa logs de gamificação
        await db.sequelize.query('DELETE FROM "GamificationLogs"');

        // 2. Reseta XP, Nível e Badges de todos os psicólogos
        await db.Psychologist.update({ xp: 0, authority_level: 'nivel_iniciante', badges: {} }, { where: {} });

        res.send("Sucesso! Progresso de gamificação de todos os usuários foi reiniciado.");
    } catch (error) {
        console.error("Erro ao resetar gamificação:", error);
        res.status(500).send("Erro ao resetar: " + error.message);
    }
});

// --- ROTA DE TESTE DE EMAIL (NOVO) ---
app.get('/api/fix-test-email', async (req, res) => {
    try {
        const emailService = require('./services/emailService');
        const emailDestino = req.query.email || 'admin@yelopsi.com.br'; // Use ?email=seu@email.com para testar
        const type = req.query.type; // 'payment' ou vazio (padrão reset)
        
        if (type === 'payment') {
            // Testa o e-mail de Pagamento Confirmado
            await emailService.sendPaymentConfirmationEmail(
                { email: emailDestino, nome: 'Usuário Teste' },
                'CLINICAL', // Plano simulado
                159.90      // Valor simulado
            );
            res.send(`✅ E-mail de PAGAMENTO enviado para: ${emailDestino}. Verifique a caixa de entrada.`);
        } else if (type === 'cancel') {
             await emailService.sendSubscriptionCancelledEmail(
                { email: emailDestino, nome: 'Usuário Teste' }
            );
            res.send(`✅ E-mail de CANCELAMENTO enviado para: ${emailDestino}.`);
        } else if (type === 'failed') {
             await emailService.sendPaymentFailedEmail(
                { email: emailDestino, nome: 'Usuário Teste' },
                'https://www.yelopsi.com.br/login'
            );
            res.send(`✅ E-mail de FALHA enviado para: ${emailDestino}.`);
        } else if (type === 'welcome') {
             await emailService.sendWelcomeEmail(
                { email: emailDestino, nome: 'Usuário Teste' }, 'psychologist'
            );
            res.send(`✅ E-mail de BOAS-VINDAS enviado para: ${emailDestino}.`);
        } else if (type === 'bill_created') {
            await emailService.sendBillCreatedEmail(
                { email: emailDestino, nome: 'Usuário Teste' },
                { value: 159.90, dueDate: '2026-02-10', invoiceUrl: 'https://sandbox.asaas.com/i/teste', bankSlipUrl: null }
            );
            res.send(`✅ E-mail de COBRANÇA CRIADA enviado para: ${emailDestino}.`);
        } else if (type === 'due_date') {
            await emailService.sendDueDateWarningEmail(
                { email: emailDestino, nome: 'Usuário Teste' },
                { value: 159.90, dueDate: '2026-02-10', invoiceUrl: 'https://sandbox.asaas.com/i/teste' }
            );
            res.send(`✅ E-mail de AVISO DE VENCIMENTO enviado para: ${emailDestino}.`);
        } else if (type === 'overdue') {
            await emailService.sendOverdueEmail(
                { email: emailDestino, nome: 'Usuário Teste' },
                { value: 159.90, dueDate: '2026-02-01', invoiceUrl: 'https://sandbox.asaas.com/i/teste' }
            );
            res.send(`✅ E-mail de COBRANÇA VENCIDA enviado para: ${emailDestino}.`);
        } else if (type === 'updated') {
            await emailService.sendBillUpdatedEmail(
                { email: emailDestino, nome: 'Usuário Teste' },
                { value: 159.90, dueDate: '2026-02-15', invoiceUrl: 'https://sandbox.asaas.com/i/teste' }
            );
            res.send(`✅ E-mail de COBRANÇA ATUALIZADA enviado para: ${emailDestino}.`);
        } else if (type === 'digitable') {
            await emailService.sendDigitableLineEmail(
                { email: emailDestino, nome: 'Usuário Teste' },
                { 
                    value: 159.90, 
                    dueDate: '2026-02-10', 
                    invoiceUrl: 'https://sandbox.asaas.com/i/teste', 
                    nossoNumero: '34191.79001 01043.51004 7 9102012000' 
                }
            );
            res.send(`✅ E-mail de LINHA DIGITÁVEL enviado para: ${emailDestino}.`);
        } else if (type === 'remarketing') {
            const step = parseInt(req.query.step) || 1; // Pega o passo da URL, padrão é 1
            await emailService.sendRemarketingEmail(
                // Adicionamos whatsapp_clicks para garantir que o Passo 4 funcione
                { email: emailDestino, nome: 'Usuário Teste', whatsapp_clicks: 2 },
                step
            );
            res.send(`✅ E-mail de REMARKETING (Passo ${step}) enviado para: ${emailDestino}.`);
        } else if (type === 'first_lead') {
            await emailService.sendFirstLeadEmail(
                { email: emailDestino, nome: 'Usuário Teste' }
            );
            res.send(`✅ E-mail de PRIMEIRO LEAD enviado para: ${emailDestino}.`);
        } else if (type === 'limit_reached') {
            await emailService.sendLimitReachedEmail(
                { email: emailDestino, nome: 'Usuário Teste' }, 3
            );
            res.send(`✅ E-mail de LIMITE ATINGIDO enviado para: ${emailDestino}.`);
        } else {
            // Testa o e-mail de Recuperação de Senha (Padrão)
            await emailService.sendPasswordResetEmail(
                { email: emailDestino, nome: 'Teste Admin' }, 
                'https://www.yelopsi.com.br/teste-link'
            );
            res.send(`✅ E-mail de RECUPERAÇÃO enviado para: ${emailDestino}. <br>Dica: Adicione <code>&type=payment</code> na URL para testar o de pagamento.`);
        }
    } catch (error) {
        console.error(error);
        let msg = "❌ Erro ao enviar e-mail: " + error.message;
        if (error.message.includes('Missing credentials') || error.message.includes('Authentication') || error.message.includes('Username and Password')) {
            msg += "<br><br><strong>Dica:</strong> Verifique se <code>SMTP_USER</code> e <code>SMTP_PASS</code> estão configurados corretamente no arquivo <code>.env</code>.";
        }
        res.status(500).send(msg);
    }
});

// --- SERVIÇO DE WHATSAPP (INTEGRAÇÃO OFICIAL META) ---
const whatsappService = require('../whatsappService');

// =============================================================
// WHATSAPP WEBHOOKS (RESPOSTAS DOS PACIENTES)
// =============================================================
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'yelo_webhook_123';

// Rota exigida pela Meta para autorizar nosso servidor (Verificação GET)
app.get('/api/webhooks/whatsapp', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
        console.log('✅ [WHATSAPP] Webhook verificado pela Meta!');
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

// Rota onde chegam as respostas e os cliques em botões (Recepção POST)
app.post('/api/webhooks/whatsapp', async (req, res) => {
    try {
        const body = req.body;
        if (body.object === 'whatsapp_business_account') {
            for (const entry of body.entry) {
                for (const change of entry.changes) {
                    const value = change.value;
                    if (value.messages && value.messages[0]) {
                        const message = value.messages[0];
                        const phone = message.from; // Número de quem enviou (Paciente)

                        // Trata caso a interação tenha sido um clique num botão
                        if (message.type === 'interactive' && message.interactive.type === 'button_reply') {
                            const buttonText = message.interactive.button_reply.title.toUpperCase();
                            console.log(`📱 [WHATSAPP] Paciente ${phone} clicou em: [${buttonText}]`);
                            
                            // Busca o paciente pelo telefone (ignorando o código DDI 55)
                            const phoneSuffix = phone.startsWith('55') ? phone.substring(2) : phone;
                            const patient = await db.Patient.findOne({ where: { telefone: { [Op.like]: `%${phoneSuffix}%` } } });

                            if (patient) {
                                // Busca o agendamento futuro "aguardando confirmação" desse paciente
                                const appointment = await db.Appointment.findOne({
                                    where: { patientId: patient.id, status: 'scheduled' },
                                    order: [['start', 'ASC']]
                                });

                                if (appointment) {
                                    // Busca os dados do psicólogo para poder avisá-lo
                                    const psi = await db.Psychologist.findByPk(appointment.psychologistId);
                                    const dateStr = new Date(appointment.start).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
                                    const timeStr = new Date(appointment.start).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
                                    
                                    const patientFirstName = patient.nome.split(' ')[0];
                                    const psiFirstName = psi ? psi.nome.split(' ')[0] : 'Psicólogo';

                                    if (buttonText.includes('CONFIRMAR') || buttonText.includes('SIM')) {
                                        await appointment.update({ status: 'confirmed' });
                                        // [DESATIVADO TEMPORARIAMENTE]
                                        // await whatsappService.sendMessage(phone, "✅ Que ótimo! Sua sessão foi confirmada na agenda do(a) psicólogo(a). Até logo!");
                                    } else if (buttonText.includes('CANCELAR') || buttonText.includes('NÃO')) {
                                        await appointment.update({ status: 'cancelled' });
                                        await db.Appointment.create({ title: 'Disponível', start: appointment.start, end: appointment.end, psychologistId: appointment.psychologistId, status: 'available', value: 0 });
                                        // [DESATIVADO TEMPORARIAMENTE]
                                        // await whatsappService.sendMessage(phone, "❌ Tudo bem, sua sessão foi cancelada e o horário liberado na agenda.");
                                        
                                        // 🔔 AVISO IMEDIATO PARA O PSICÓLOGO
                                        /*
                                        if (psi && psi.telefone) {
                                            await whatsappService.sendTemplateMessage(psi.telefone, 'alerta_agenda', 'pt_BR', [
                                                { type: "body", parameters: [
                                                    { type: "text", text: psiFirstName },
                                                    { type: "text", text: patientFirstName },
                                                    { type: "text", text: "cancelou" },
                                                    { type: "text", text: `${dateStr} às ${timeStr}` }
                                                ]}
                                            ]);
                                        }
                                        */
                                    } else if (buttonText.includes('REAGENDAR') || buttonText.includes('TROCAR')) {
                                        await appointment.update({ status: 'rescheduled' });
                                        // [DESATIVADO TEMPORARIAMENTE]
                                        // await whatsappService.sendMessage(phone, "🔄 Você optou por reagendar. Por favor, acesse a plataforma Yelo ou mande uma mensagem direta para o psicólogo para escolher um novo horário.");
                                        
                                        // 🔔 AVISO IMEDIATO PARA O PSICÓLOGO
                                        /*
                                        if (psi && psi.telefone) {
                                            await whatsappService.sendTemplateMessage(psi.telefone, 'alerta_agenda', 'pt_BR', [
                                                { type: "body", parameters: [
                                                    { type: "text", text: psiFirstName },
                                                    { type: "text", text: patientFirstName },
                                                    { type: "text", text: "solicitou o reagendamento de" },
                                                    { type: "text", text: `${dateStr} às ${timeStr}` }
                                                ]}
                                            ]);
                                        }
                                        */
                                    }
                                }
                            }
                        } else if (message.type === 'text') {
                            console.log(`📱 [WHATSAPP] Texto recebido de ${phone}: ${message.text.body}`);
                        }
                    }
                }
            }
            res.status(200).send('EVENT_RECEIVED');
        } else {
            res.sendStatus(404);
        }
    } catch (error) {
        console.error("❌ [WHATSAPP] Erro no webhook:", error);
        res.sendStatus(500);
    }
});

// --- AGENDADORES (CRON JOBS) ---
const startCronJobs = () => {
  console.log('⏰ [CRON] Inicializando agendadores de tarefas...');

  // Inicializa o agendador externo (Remarketing, Demandas, etc)
  try {
      require('../scheduler.js');
      console.log('✅ [CRON] Scheduler externo ativado (Remarketing rodará às 10h).');
  } catch (err) {
      console.warn('⚠️ [CRON] Aviso: Não foi possível carregar o scheduler.js.', err.message);
  }

  let lastReminderHour = -1;
  let lastSummaryMinute = "";
  let lastAuditDay = -1;

  setInterval(async () => {
    const now = new Date();
    const currentHM = now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }); // Ex: "08:00"
    
    // 1. RESUMO DIÁRIO (Personalizado por Psicólogo)
    if (currentHM !== lastSummaryMinute) {
        lastSummaryMinute = currentHM;
        try {
        // Busca psicólogos que configuraram o resumo para o horário atual
        const psisSummary = await db.Psychologist.findAll({ 
            where: { dailySummaryTime: currentHM } 
        });

        if (psisSummary.length > 0) {
            console.log(`⏰ [CRON] Enviando resumo diário para ${psisSummary.length} psicólogos às ${currentHM}...`);
            
            const brtDateStr = now.toLocaleDateString("sv-SE", {timeZone: "America/Sao_Paulo"}); // Garante YYYY-MM-DD no Brasil
            const startOfDay = new Date(`${brtDateStr}T00:00:00-03:00`);
            const endOfDay = new Date(`${brtDateStr}T23:59:59.999-03:00`);
            const psiIds = psisSummary.map(p => p.id);

            const appointments = await db.Appointment.findAll({
                where: { 
                    psychologistId: { [Op.in]: psiIds },
                    start: { [Op.between]: [startOfDay, endOfDay] }
                },
                order: [['start', 'ASC']]
            });

            // Agrupa por Psicólogo
            const appointmentsByPsi = {};
            appointments.forEach(app => {
                if (!appointmentsByPsi[app.psychologistId]) appointmentsByPsi[app.psychologistId] = [];
                appointmentsByPsi[app.psychologistId].push(app);
            });

            for (const psi of psisSummary) {
                const apps = appointmentsByPsi[psi.id] || [];
                
                if (apps.length > 0) {
                    let msgLines = [`Olá ${psi.nome}. Segue o resumo das suas sessões de hoje:`];
                    
                    for (const app of apps) {
                        const time = new Date(app.start).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
                        const patientName = app.title || 'Paciente'; // Nome do paciente
                        
                        let statusText = app.status;
                        if (app.status === 'confirmed') statusText = 'confirmou';
                        if (app.status === 'cancelled') statusText = 'cancelou';
                        if (app.status === 'rescheduled') statusText = 'reagendou';
                        if (app.status === 'scheduled') statusText = 'aguardando confirmação';

                        msgLines.push(`${patientName}, às ${time} - ${statusText}`);
                    }
                    
                    // [DESATIVADO TEMPORARIAMENTE] Aguardando configuração na Meta
                    // whatsappService.sendMessage(psi.telefone || `Psi_${psi.id}`, msgLines.join('\n'));
                } else {
                    // [DESATIVADO TEMPORARIAMENTE] Aguardando configuração na Meta
                    // whatsappService.sendMessage(psi.telefone || `Psi_${psi.id}`, `Olá ${psi.nome}. Nenhuma sessão agendada para hoje.`);
                }
            }
            }
        } catch (e) { console.error("Erro no cron de resumo:", e); }
    }

    // 1.5. AUDITORIA DE ASSINATURAS VENCIDAS (Diariamente às 03:00)
    const currentBrtHour = parseInt(now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit' }), 10);
    const currentDay = now.getDate();
    
    if (currentBrtHour === 3 && currentDay !== lastAuditDay) {
        lastAuditDay = currentDay;
        console.log("⏰ [CRON] Realizando auditoria diária de assinaturas vencidas...");
        try {
            const psisVencidos = await db.Psychologist.findAll({
                where: {
                    status: 'active',
                    [Op.or]: [{ is_exempt: false }, { is_exempt: null }],
                    planExpiresAt: { [Op.lt]: now }
                }
            });
            if (psisVencidos.length > 0) {
                console.log(`[CRON] Inativando ${psisVencidos.length} psicólogos com assinaturas vencidas.`);
                for (const psi of psisVencidos) await psi.update({ status: 'inactive' });
            }
        } catch(e) { console.error("Erro na auditoria de vencidos:", e); }
    }

    // 2. LEMBRETES DE SESSÃO (A cada hora cheia)
    
    // Garante que rode apenas 1 vez por hora, mesmo que o setInterval atrase alguns segundos
    if (currentBrtHour !== lastReminderHour) {
        lastReminderHour = currentBrtHour;
        console.log("⏰ [CRON] Verificando lembretes de sessão...");
        try {
            // Busca sessões nas próximas 48h para verificar antecedência
            const lookAhead = new Date(now.getTime() + 48 * 60 * 60 * 1000);
            
            const upcomingAppointments = await db.Appointment.findAll({
                where: { 
                    start: { [Op.between]: [now, lookAhead] },
                    status: { [Op.in]: ['scheduled'] } // Apenas envia para quem ainda não confirmou/cancelou
                },
                include: [{ model: db.Psychologist, as: 'psychologist' }]
            });

            for (const appt of upcomingAppointments) {
                if (!appt.psychologist) continue;
                
                const hoursBefore = appt.psychologist.reminderHoursBefore || 24; // Padrão 24h
                const timeDiff = (new Date(appt.start) - now) / (1000 * 60 * 60); // Diferença em horas
        
                // Se faltar exatamente X horas (com margem de erro de 5 min)
                if (Math.abs(timeDiff - hoursBefore) < 0.1) {
                    const patient = await db.Patient.findByPk(appt.patientId);
                    // Pula se não tiver telefone ou se optou por NÃO receber mensagens
                    if (!patient || !patient.telefone || patient.recebe_mensagens === false) continue;

                    const dateStr = new Date(appt.start).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
                    const timeStr = new Date(appt.start).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
                    
                    // Primeiro nome do paciente e psicologo
                    const patientFirstName = patient.nome.split(' ')[0];
                    const psiFirstName = appt.psychologist.nome.split(' ')[0];

                    // Disparo oficial usando a Cloud API
                    // [DESATIVADO TEMPORARIAMENTE] Aguardando configuração na Meta
                    /*
                    await whatsappService.sendTemplateMessage(
                        patient.telefone, 
                        'lembrete_sessao', // <-- Nome EXATO que você vai dar ao Template na Meta
                        'pt_BR', 
                        [
                            { type: "body", parameters: [
                                { type: "text", text: patientFirstName },
                                { type: "text", text: psiFirstName },
                                { type: "text", text: `${dateStr} às ${timeStr}` }
                            ]}
                        ]
                    );
                    */
                }
            }
        } catch (e) { console.error("Erro no cron de lembretes:", e); }
    }
  }, 60000); // Roda a cada minuto
};

// --- ROTAS DE PACIENTES (CRUD) ---
app.get('/api/my-patients', verifyTokenLocal, async (req, res) => {
    try {
        const decoded = req.userDecoded;
        
        // Garantia de que o modelo existe
        if (!db.Patient) {
            console.error("Erro: db.Patient não está definido.");
            return res.status(500).json({ error: 'Modelo de pacientes não encontrado.' });
        }

        // Busca pacientes vinculados a este psicólogo (Lógica simplificada: busca todos por enquanto ou cria tabela de vínculo)
        // Para este MVP, vamos buscar na tabela Patients onde o psicólogo criou (se houver coluna) 
        // OU vamos assumir que o frontend filtra. 
        // *Melhor abordagem:* Criar uma tabela "PsychologistPatients" ou usar um campo "psychologistId" em Patients se for 1:N.
        // Vou usar uma busca genérica na tabela Patients para o exemplo, filtrando se tiver coluna.
        
        const patients = await db.Patient.findAll(); 
        res.json(patients);
    } catch (error) {
        console.error("Erro em GET /api/my-patients:", error);
        res.status(500).json({ error: 'Erro ao buscar pacientes.' });
    }
});

// --- ROTA: Buscar Detalhes do Paciente (CORREÇÃO DO ERRO 404) ---
app.get('/api/my-patients/:id', verifyTokenLocal, async (req, res) => {
    try {
        const { id } = req.params;
        const patient = await db.Patient.findByPk(id);
        
        if (!patient) return res.status(404).json({ error: 'Paciente não encontrado' });
        
        res.json(patient);
    } catch (error) {
        console.error("Erro em GET /api/my-patients/:id :", error);
        res.status(500).json({ error: 'Erro ao buscar detalhes do paciente.' });
    }
});

app.post('/api/my-patients', verifyTokenLocal, async (req, res) => {
    try {
        const { name, phone, email, status, sessionValue, observacoes, recebeMensagens } = req.body;
        // Cria paciente (simplificado)
        const patient = await db.Patient.create({
            nome: name,
            email: email || null,
            telefone: phone,
            status: status || 'ativo',
            sessionValue: sessionValue || 0,
            observacoes: observacoes, // Salva observações na criação
            recebe_mensagens: recebeMensagens !== undefined ? recebeMensagens : true,
            senha: await bcrypt.hash('temp123', 8) // FIX: Senha obrigatória
        });
        res.json(patient);
    } catch (error) {
        console.error("Erro ao criar paciente:", error);
        console.error("Erro original (SQL):", error.original); // Log detalhado no servidor
        res.status(500).json({ error: 'Erro ao criar paciente: ' + (error.original?.message || error.message) });
    }
});

app.put('/api/my-patients/:id', verifyTokenLocal, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, phone, email, status, sessionValue, observacoes, recebeMensagens } = req.body;
        
        const patient = await db.Patient.findByPk(id);
        if (!patient) return res.status(404).json({ error: 'Paciente não encontrado' });
        
        const updateData = {
            nome: name,
            telefone: phone,
            status: status,
            sessionValue: sessionValue,
            observacoes: observacoes, // Atualiza observações
            recebe_mensagens: recebeMensagens !== undefined ? recebeMensagens : true
        };

        // Só atualiza email se for válido e não vazio (evita erro de validação)
        if (email && email.trim() !== '' && email !== 'undefined') {
            updateData.email = email;
        }

        await patient.update(updateData);
        res.json(patient);
    } catch (error) {
        console.error("Erro ao atualizar paciente:", error);
        console.error("Erro original (SQL):", error.original); // Log detalhado no servidor
        res.status(500).json({ error: 'Erro ao atualizar paciente: ' + (error.original?.message || error.message) });
    }
});

app.delete('/api/my-patients/:id', verifyTokenLocal, async (req, res) => {
    try {
        const { id } = req.params;
        const patient = await db.Patient.findByPk(id);
        
        if (!patient) return res.status(404).json({ error: 'Paciente não encontrado' });
        
        await patient.destroy();
        res.json({ success: true, message: 'Paciente excluído com sucesso.' });
    } catch (error) {
        console.error("Erro em DELETE /api/my-patients/:id :", error);
        res.status(500).json({ error: 'Erro ao excluir paciente.' });
    }
});

// --- ROTAS DE AGENDAMENTOS (COM WHATSAPP) ---
app.get('/api/appointments', verifyTokenLocal, async (req, res) => {
    try {
        const decoded = req.userDecoded;
        
        const appointments = await db.Appointment.findAll({
            where: { psychologistId: decoded.id }
        });

        // --- FIX: Mapeamento de Cores por Status (Legenda) ---
        const events = appointments.map(a => {
            const app = typeof a.toJSON === 'function' ? a.toJSON() : a;
            let color = '#3788d8'; // Agendado (Azul Padrão)

            if (app.status === 'confirmed') color = '#1B4332'; // Confirmado (Verde Escuro)
            else if (app.status === 'available') color = '#FFC107'; // Disponível (Amarelo)
            else if (app.status === 'done' || app.status === 'completed') color = '#9e9e9e'; // Realizado (Cinza)
            else if (app.status === 'missed' || app.status === 'absent') color = '#d32f2f'; // Falta (Vermelho)
            
            return { ...app, backgroundColor: color, borderColor: color };
        });

        res.json(events);
    } catch (error) {
        console.error("Erro em GET /api/appointments:", error);
        res.status(500).json({ error: 'Erro ao buscar agenda.' });
    }
});

// --- ROTA: Buscar Horários Disponíveis (Para Reagendamento) ---
app.get('/api/appointments/available', verifyTokenLocal, async (req, res) => {
    try {
        const decoded = req.userDecoded;
        
        const slots = await db.Appointment.findAll({
            where: {
                psychologistId: decoded.id,
                status: 'available',
                start: { [Op.gt]: new Date() } // Apenas futuros
            },
            order: [['start', 'ASC']]
        });
        res.json(slots);
    } catch (error) {
        console.error("Erro em GET /api/appointments/available:", error);
        res.status(500).json({ error: 'Erro ao buscar horários disponíveis.' });
    }
});

app.post('/api/appointments', verifyTokenLocal, async (req, res) => {
    try {
        const decoded = req.userDecoded;
        const { title, start, end, patientId, phone, status } = req.body;

        const appt = await db.Appointment.create({
            title, start: start, end: end, patientId,
            psychologistId: decoded.id,
            status: status || 'scheduled', // [CORREÇÃO] Aceita 'available' se enviado
            value: 0
        });

        // 🔔 NOTIFICAÇÃO WHATSAPP: CONFIRMAÇÃO (DESATIVADA: Foco apenas em lembretes)
        /*
        if (phone) {
            try {
                const msg = `Olá ${title}, sua sessão foi confirmada para ${whatsappService.formatDate(start)}.`;
                whatsappService.sendMessage(phone, msg);
            } catch (err) {
                console.error("Erro ao enviar notificação WhatsApp:", err);
            }
        }
        */

        res.json(appt);
    } catch (error) {
        console.error("Erro detalhado ao criar agendamento:", error);
        res.status(500).json({ error: 'Erro ao agendar: ' + error.message });
    }
});

app.put('/api/appointments/:id', verifyTokenLocal, async (req, res) => {
    try {
        const { status, start, end, value, phone, title } = req.body;
        const appt = await db.Appointment.findByPk(req.params.id);
        
        if (!appt) return res.status(404).json({ error: 'Agendamento não encontrado' });

        const oldStart = appt.start;
        
        await appt.update({ status, start: start, end: end, value });

        // --- LÓGICA: LIBERAR HORÁRIO AO CANCELAR ---
        if (status === 'cancelled') {
            // Verifica se já existe um slot disponível neste horário para evitar duplicidade
            const exists = await db.Appointment.findOne({
                where: {
                    psychologistId: appt.psychologistId,
                    start: appt.start,
                    status: 'available'
                }
            });
            
            if (!exists) {
                // Cria um novo slot disponível no lugar do cancelado
                await db.Appointment.create({
                    title: 'Disponível',
                    start: appt.start,
                    end: appt.end,
                    psychologistId: appt.psychologistId,
                    status: 'available',
                    value: 0 // Valor zero para slot livre
                });
            }
        }

        // 🔔 NOTIFICAÇÕES WHATSAPP (DESATIVADAS: Foco apenas em lembretes)
        /*
        if (phone) {
            // 1. Reagendamento (Data mudou)
            if (start && new Date(start).getTime() !== new Date(oldStart).getTime()) {
                const msg = `Olá ${title}, sua sessão foi reagendada para ${whatsappService.formatDate(start)}.`;
                whatsappService.sendMessage(phone, msg);
            }
            // 2. Cancelamento
            else if (status === 'cancelled') {
                const msg = `Olá ${title}, sua sessão foi cancelada. Entre em contato para reagendar.`;
                whatsappService.sendMessage(phone, msg);
            }
            // 3. Confirmação (NOVO)
            else if (status === 'confirmed') {
                const msg = `Olá ${title}, confirmando sua sessão para ${whatsappService.formatDate(start)}. Até lá!`;
                whatsappService.sendMessage(phone, msg);
            }
            // 4. Reagendamento Solicitado (Envia horários disponíveis)
            else if (status === 'rescheduled') {
                // Busca horários marcados como 'available' deste psicólogo
                const availableSlots = await db.Appointment.findAll({
                    where: {
                        psychologistId: appt.psychologistId,
                        status: 'available',
                        start: { [Op.gt]: new Date() } // Apenas futuros
                    },
                    limit: 5,
                    order: [['start', 'ASC']]
                });

                let slotsMsg = "Não encontrei horários livres próximos.";
                if (availableSlots.length > 0) {
                    slotsMsg = "Aqui estão alguns horários disponíveis:\n" + availableSlots.map((s, i) => `${i+1}. ${whatsappService.formatDate(s.start)}`).join('\n');
                }
                
                const msg = `Olá ${title}. ${slotsMsg}\n\nResponda com o número da opção para confirmar a troca, ou digite "Falar com ${appt.psychologist ? appt.psychologist.nome : 'o psicólogo'}" para tratar diretamente.`;
                whatsappService.sendMessage(phone, msg);
            }
        }
        */

        res.json(appt);
    } catch (error) {
        console.error("Erro em PUT /api/appointments/:id :", error);
        res.status(500).json({ error: 'Erro ao atualizar agendamento.' });
    }
});

// --- ROTA: SIMULAR LEMBRETE (DISPARO MANUAL) ---
app.post('/api/appointments/:id/remind', verifyTokenLocal, async (req, res) => {
    try {
        const appt = await db.Appointment.findByPk(req.params.id);
        if (!appt) return res.status(404).json({ error: 'Agendamento não encontrado.' });

        const patient = await db.Patient.findByPk(appt.patientId);
        if (!patient) return res.status(404).json({ error: 'Paciente não encontrado.' });

        const psychologist = await db.Psychologist.findByPk(appt.psychologistId);

        const dateStr = new Date(appt.start).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const timeStr = new Date(appt.start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        
        const msg = `Olá, sou a Yelo, assistente virtual de ${psychologist ? psychologist.nome : 'seu psicólogo'}. Você confirma a sessão do dia ${dateStr} às ${timeStr}?`;
        
        // [DESATIVADO TEMPORARIAMENTE] await whatsappService.sendInteractiveMessage(patient.telefone, msg, ["Sim, eu confirmo", "Preciso reagendar", "Quero cancelar"]);

        res.json({ success: true, message: 'Funcionalidade em configuração. Lembrete simulado com sucesso!' });
    } catch (error) {
        console.error("Erro ao enviar lembrete manual:", error);
        res.status(500).json({ error: 'Erro ao enviar lembrete.' });
    }
});

app.delete('/api/appointments/:id', verifyTokenLocal, async (req, res) => {
    try {
        await db.Appointment.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (error) {
        console.error("Erro em DELETE /api/appointments/:id :", error);
        res.status(500).json({ error: 'Erro ao excluir.' });
    }
});

// --- ROTA DE EMERGÊNCIA: CORRIGIR TABELA DE PACIENTES MANUALMENTE ---
// Acesse esta rota no navegador se o erro persistir: https://sua-url.com/api/fix-patients-schema-manual
app.get('/api/fix-patients-schema-manual', async (req, res) => {
    try {
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "sessionValue" FLOAT DEFAULT 0;');
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "status" VARCHAR(255) DEFAULT \'active\';');
        res.send("✅ Colunas sessionValue e status criadas com sucesso na tabela Patients.");
    } catch (error) {
        res.status(500).send("Erro ao criar colunas: " + error.message);
    }
});

// --- ROTA DE EMERGÊNCIA: CORRIGIR E-MAIL NULO (PACIENTES) ---
app.get('/api/fix-email-null', async (req, res) => {
    try {
        await db.sequelize.query('ALTER TABLE "Patients" ALTER COLUMN "email" DROP NOT NULL;');
        res.send("✅ Sucesso! Coluna 'email' da tabela Patients agora aceita valores nulos (vazio). Tente cadastrar o paciente novamente.");
    } catch (error) {
        res.status(500).send("Erro ao alterar coluna: " + error.message);
    }
});

// --- ROTA DE CORREÇÃO FINANCEIRA (MANUAL) ---
app.get('/api/fix-financial-tables', async (req, res) => {
    try {
        console.log("🔧 Forçando criação/correção de tabelas financeiras...");
        
        // 1. Cria tabelas se não existirem
        await db.sequelize.query(`
            CREATE TABLE IF NOT EXISTS "Expenses" (
                "id" SERIAL PRIMARY KEY,
                "description" VARCHAR(255),
                "value" FLOAT,
                "date" DATE,
                "psychologistId" INTEGER,
                "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await db.sequelize.query(`
            CREATE TABLE IF NOT EXISTS "Appointments" (
                "id" SERIAL PRIMARY KEY,
                "title" VARCHAR(255),
                "start" TIMESTAMP WITH TIME ZONE,
                "end" TIMESTAMP WITH TIME ZONE,
                "status" VARCHAR(255) DEFAULT 'scheduled',
                "value" FLOAT DEFAULT 0,
                "psychologistId" INTEGER,
                "patientId" INTEGER,
                "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        // --- FIX: GARANTIR COLUNA patientId ---
        try {
            await db.sequelize.query('ALTER TABLE "Appointments" ADD COLUMN IF NOT EXISTS "patientId" INTEGER;');
            console.log("✅ Coluna patientId verificada na rota de correção.");
        } catch (e) {
            console.error("⚠️ Erro ao adicionar patientId na rota de correção:", e.message);
        }

        // 2. Garante que colunas críticas existam (caso a tabela tenha sido criada incompleta antes)
        await db.sequelize.query('ALTER TABLE "Expenses" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;');
        await db.sequelize.query('ALTER TABLE "Expenses" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;');
        
        res.send("✅ Tabelas Financeiras (Expenses/Appointments) verificadas e corrigidas com sucesso.");
    } catch (error) {
        console.error("Erro ao corrigir tabelas:", error);
        res.status(500).send("Erro ao criar tabelas: " + error.message);
    }
});

// --- ROTA DE CORREÇÃO: TABELA DE PACIENTES ---
app.get('/api/fix-patient-table', async (req, res) => {
    try {
        console.log("🔧 Corrigindo tabela de Pacientes...");
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "status" VARCHAR(255) DEFAULT \'active\';');
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "sessionValue" FLOAT DEFAULT 0;');
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "resetPasswordToken" VARCHAR(255);');
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "resetPasswordExpires" BIGINT;');
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "ip_registro" VARCHAR(45);');
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "termos_aceitos" BOOLEAN DEFAULT FALSE;');
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "marketing_aceito" BOOLEAN DEFAULT FALSE;');
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "valor_sessao_faixa" VARCHAR(255);');
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "temas_buscados" JSONB DEFAULT \'[]\';');
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "identidade_genero" VARCHAR(255);');
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "recebe_mensagens" BOOLEAN DEFAULT TRUE;');
        
        res.send("✅ Tabela de Pacientes verificada e corrigida.");
    } catch (error) {
        console.error("Erro ao corrigir tabela de pacientes:", error);
        res.status(500).send("Erro: " + error.message);
    }
});

// --- ROTAS FINANCEIRAS (PRODUÇÃO) ---

// 1. Obter Resumo Financeiro (Dashboard)
app.get('/api/financials/dashboard', verifyTokenLocal, async (req, res) => {
    try {
        const decoded = req.userDecoded;
        
        // Filtro de data (opcional, padrão mês atual)
        const { month } = req.query; // Formato YYYY-MM
        let startDate, endDate;
        
        if (month) {
            startDate = new Date(`${month}-01`);
            endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
        } else {
            const now = new Date();
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        }

        // Buscar Agendamentos (Receita)
        const appointments = await db.Appointment.findAll({
            where: {
                psychologistId: decoded.id,
                start: { [Op.between]: [startDate, endDate] }
            }
        });

        // Buscar Despesas
        const expenses = await db.Expense.findAll({
            where: {
                psychologistId: decoded.id,
                date: { [Op.between]: [startDate, endDate] }
            }
        });

        res.json({ appointments, expenses });
    } catch (error) {
        console.error("Erro financeiro:", error);
        res.status(500).json({ error: 'Erro ao buscar dados financeiros.' });
    }
});

// 2. Criar Despesa
app.post('/api/financials/expenses', verifyTokenLocal, async (req, res) => {
    try {
        const decoded = req.userDecoded;

        const { description, value, date } = req.body;
        
        const expense = await db.Expense.create({
            description,
            value,
            date,
            psychologistId: decoded.id
        });

        res.json(expense);
    } catch (error) {
        console.error("Erro detalhado ao salvar despesa:", error); // Log para debug
        res.status(500).json({ error: 'Erro ao salvar despesa: ' + error.message });
    }
});

// 3. Excluir Despesa
app.delete('/api/financials/expenses/:id', verifyTokenLocal, async (req, res) => {
    try {
        const decoded = req.userDecoded;

        await db.Expense.destroy({ where: { id: req.params.id, psychologistId: decoded.id } });
        res.json({ success: true });
    } catch (error) {
        console.error("Erro em DELETE /api/financials/expenses/:id :", error);
        res.status(500).json({ error: 'Erro ao excluir despesa.' });
    }
});

// =============================================================
// ROTAS DA APLICAÇÃO
// =============================================================

app.use('/api/auth', authRoutes);
app.use('/api/newsletter', newsletterRoutes); // <-- MOVIDO PARA O TOPO

// --- ROTA DE RESGATE DE IMAGENS (SOLUÇÃO DEFINITIVA) ---

// Intercepta requisições de perfil e procura o arquivo onde quer que ele esteja
app.get('/uploads/profiles/:filename', (req, res) => {
    const filename = req.params.filename;
    
    // Lista de lugares onde o arquivo pode ter ido parar
    const possiblePaths = [
        path.join(__dirname, '../uploads', filename),           // raiz/uploads/arquivo.webp
        path.join(__dirname, '../uploads/profiles', filename),  // raiz/uploads/profiles/arquivo.webp
        path.join(__dirname, 'uploads', filename),              // backend/uploads/arquivo.webp
        path.join(__dirname, 'uploads/profiles', filename)      // backend/uploads/profiles/arquivo.webp
    ];

    // Tenta encontrar o primeiro caminho que existe
    const foundPath = possiblePaths.find(p => fs.existsSync(p));

    if (foundPath) {
        res.sendFile(foundPath);
    } else {
        console.error(`[404] Imagem não encontrada fisicamente: ${filename}`);
        res.status(404).send('Imagem não encontrada');
    }
});

// Fallback para outros arquivos na pasta uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/patients', patientRoutes);

// --- CORREÇÃO DE AUTENTICAÇÃO DO BLOG (Bypass 403 usando verifyTokenLocal) ---
app.get('/api/psychologists/me/posts', verifyTokenLocal, async (req, res) => {
    try {
        const psiId = req.userDecoded.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        let rows = [];
        try {
            const result = await db.Post.findAndCountAll({
                where: { psychologistId: psiId },
                order: [['createdAt', 'DESC']],
                limit,
                offset
            });
            rows = result.rows;
        } catch (e) {
            const result = await db.Post.findAndCountAll({
                where: { psychologist_id: psiId },
                order: [['created_at', 'DESC']],
                limit,
                offset
            });
            rows = result.rows;
        }

        // O FRONTEND ESPERA UM ARRAY DIRETAMENTE
        res.json(rows);
    } catch (error) {
        console.error("Erro GET posts:", error);
        res.status(500).json({ error: 'Erro interno ao buscar artigos.' });
    }
});

app.post('/api/psychologists/me/posts', verifyTokenLocal, async (req, res) => {
    try {
        const psiId = req.userDecoded.id;
        const { titulo, conteudo, imagem_url } = req.body;
        const slug = titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();

        const postPayload = { titulo, conteudo, slug };
        
        // Suporte dinâmico para os campos dependendo da versão do Model ativo
        if (db.Post.rawAttributes && db.Post.rawAttributes.psychologistId) postPayload.psychologistId = psiId;
        else postPayload.psychologist_id = psiId;
        
        if (db.Post.rawAttributes && db.Post.rawAttributes.imagemUrl) postPayload.imagemUrl = imagem_url;
        else postPayload.imagem_url = imagem_url;

        const novoPost = await db.Post.create(postPayload);

        try {
            const gamificationService = require('./services/gamificationService');
            if (gamificationService) await gamificationService.processAction(psiId, 'blog_post');
        } catch(e) { console.error("Erro gamificação blog:", e); }

        res.status(201).json(novoPost);
    } catch (error) {
        console.error("Erro POST post:", error);
        res.status(500).json({ error: 'Erro interno ao criar artigo.' });
    }
});

app.put('/api/psychologists/me/posts/:id', verifyTokenLocal, async (req, res) => {
    try {
        const psiId = req.userDecoded.id;
        const { titulo, conteudo, imagem_url } = req.body;
        
        let post = await db.Post.findOne({ where: { id: req.params.id, psychologistId: psiId } }).catch(() => null);
        if (!post) post = await db.Post.findOne({ where: { id: req.params.id, psychologist_id: psiId } }).catch(() => null);
        
        if (!post) return res.status(404).json({ error: 'Artigo não encontrado.' });
        
        const updatePayload = { titulo, conteudo };
        if (db.Post.rawAttributes && db.Post.rawAttributes.imagemUrl) updatePayload.imagemUrl = imagem_url;
        else updatePayload.imagem_url = imagem_url;

        await post.update(updatePayload);
        res.json(post);
    } catch (error) {
        res.status(500).json({ error: 'Erro interno ao atualizar artigo.' });
    }
});

app.delete('/api/psychologists/me/posts/:id', verifyTokenLocal, async (req, res) => {
    try {
        const psiId = req.userDecoded.id;
        let deleted = await db.Post.destroy({ where: { id: req.params.id, psychologistId: psiId } }).catch(() => 0);
        if (!deleted) deleted = await db.Post.destroy({ where: { id: req.params.id, psychologist_id: psiId } }).catch(() => 0);
        
        if (!deleted) return res.status(404).json({ error: 'Artigo não encontrado.' });
        res.json({ message: 'Artigo excluído com sucesso.' });
    } catch (error) {
        res.status(500).json({ error: 'Erro interno ao excluir artigo.' });
    }
});

// MOVIDO PARA CIMA: Evita conflito com a rota genérica /api/psychologists
app.use('/api/psychologists/me/posts', blogRoutes);

// ROTA DE ANALYTICS (NOVA)
app.get('/api/psychologists/me/analytics', protect, psychologistController.getAnalyticsData);

// ROTA DE FAVORITOS (DADOS REAIS)
app.get('/api/psychologists/me/favorites-profile', verifyTokenLocal, async (req, res) => {
    try {
        const decoded = req.userDecoded;
        const psiId = decoded.id;

        let patients = [];

        // 1. TENTA BUSCAR NA TABELA DE ASSOCIAÇÃO "PatientFavorites" (Padrão comum do Sequelize)
        try {
            patients = await db.sequelize.query(`
                SELECT p.temas_buscados, p.valor_sessao_faixa, p.identidade_genero
                FROM "Patients" p
                INNER JOIN "PatientFavorites" pf 
                   ON p.id = pf."patientId" OR p.id = pf."PatientId"
                WHERE pf."psychologistId" = :psiId OR pf."PsychologistId" = :psiId
            `, {
                replacements: { psiId },
                type: db.sequelize.QueryTypes.SELECT
            });
        } catch (errAssoc) {
            // 2. SE FALHAR, TENTA BUSCAR EM UMA TABELA GENÉRICA DE FAVORITOS
            try {
                patients = await db.sequelize.query(`
                    SELECT p.temas_buscados, p.valor_sessao_faixa, p.identidade_genero
                    FROM "Patients" p
                    INNER JOIN "Favorites" f 
                       ON p.id = f."patientId" OR p.id = f."PatientId"
                    WHERE f."psychologistId" = :psiId OR f."PsychologistId" = :psiId
                `, {
                    replacements: { psiId },
                    type: db.sequelize.QueryTypes.SELECT
                });
            } catch (errFav) {
                // 3. SE FALHAR NOVAMENTE, TENTA BUSCAR NA PRÓPRIA TABELA DE PATIENTS (Caso use Array JSONB)
                try {
                    const allPatients = await db.Patient.findAll({
                        attributes: ['favoritos', 'favorites', 'temas_buscados', 'valor_sessao_faixa', 'identidade_genero']
                    });
                    
                    patients = allPatients.filter(p => {
                        const favs = p.favoritos || p.favorites || [];
                        return Array.isArray(favs) && favs.includes(psiId);
                    });
                } catch (errJson) {
                    console.warn("⚠️ Não foi possível encontrar a relação de favoritos no banco. Retornando vazio.");
                    patients = [];
                }
            }
        }

        // Estrutura de retorno
        const data = {
            total: patients.length,
            temas: {},
            faixaValor: {},
            genero: {}
        };

        // Agrupa os dados dos pacientes
        patients.forEach(p => {
            // Agrega Temas
            let temas = p.temas_buscados;
            if (typeof temas === 'string') {
                try { temas = JSON.parse(temas); } catch (e) { temas = []; }
            }
            if (Array.isArray(temas)) {
                temas.forEach(t => {
                    if (t) data.temas[t] = (data.temas[t] || 0) + 1;
                });
            }

            // Agrega Faixa de Valor
            if (p.valor_sessao_faixa) {
                const f = p.valor_sessao_faixa;
                data.faixaValor[f] = (data.faixaValor[f] || 0) + 1;
            }

            // Agrega Gênero
            if (p.identidade_genero) {
                const g = p.identidade_genero;
                data.genero[g] = (data.genero[g] || 0) + 1;
            }
        });

        // Ordena os temas e pega o TOP 5 para o gráfico não ficar poluído
        const sortedTemas = Object.entries(data.temas)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .reduce((obj, [key, val]) => {
                obj[key] = val;
                return obj;
            }, {});
        
        data.temas = sortedTemas;

        res.json(data);
    } catch (error) {
        console.error("Erro ao processar analytics de favoritos:", error);
        res.status(500).json({ error: 'Erro interno ao analisar os favoritos.' });
    }
});

// ROTAS DE PSICÓLOGOS
app.use('/api/psychologists', psychologistRoutes);

// --- ROTA: ESTATÍSTICAS DE CONTRIBUIÇÃO DO PSICÓLOGO ---
app.get('/api/psychologists/me/contributions-stats', verifyTokenLocal, async (req, res) => {
    try {
        const psychologistId = req.userDecoded.id;
        const replacements = { psiId: psychologistId };

        // Otimização: Executa todas as contagens em paralelo e usa raw queries para robustez máxima
        const [
            psychologistResult,
            whatsappClicksResult,
            profileAppearancesResult,
            matchAppearancesResult,
            blogPostsResult,
            blogLikesResult,
            forumPostsResult,
            forumCommentsResult,
            qnaAnswersResult
        ] = await Promise.all([
            // XP
            db.sequelize.query('SELECT xp FROM "Psychologists" WHERE id = :psiId', { replacements, type: db.sequelize.QueryTypes.SELECT }).catch(() => [{ xp: 0 }]),
            
            // Logs
            db.sequelize.query('SELECT COUNT(*) as count FROM "WhatsappClickLogs" WHERE "psychologistId" = :psiId OR "PsychologistId" = :psiId', { replacements, type: db.sequelize.QueryTypes.SELECT }).catch(() => [{ count: 0 }]),
            db.sequelize.query('SELECT COUNT(*) as count FROM "ProfileAppearanceLogs" WHERE "psychologistId" = :psiId OR "PsychologistId" = :psiId', { replacements, type: db.sequelize.QueryTypes.SELECT }).catch(() => [{ count: 0 }]),
            db.sequelize.query('SELECT COUNT(*) as count FROM "MatchEvents" WHERE "psychologistId" = :psiId OR "PsychologistId" = :psiId', { replacements, type: db.sequelize.QueryTypes.SELECT }).catch(() => [{ count: 0 }]),

            // Blog
            db.sequelize.query('SELECT COUNT(*) as count FROM "posts" WHERE "psychologist_id" = :psiId OR "psychologistId" = :psiId', { replacements, type: db.sequelize.QueryTypes.SELECT }).catch(() => [{ count: 0 }]),
            db.sequelize.query('SELECT SUM(curtidas) as sum FROM "posts" WHERE "psychologist_id" = :psiId OR "psychologistId" = :psiId', { replacements, type: db.sequelize.QueryTypes.SELECT }).catch(() => [{ sum: 0 }]),
            
            // Forum
            db.sequelize.query('SELECT COUNT(*) as count FROM "ForumPosts" WHERE "PsychologistId" = :psiId OR "psychologistId" = :psiId', { replacements, type: db.sequelize.QueryTypes.SELECT }).catch(() => [{ count: 0 }]),
            db.sequelize.query('SELECT COUNT(*) as count FROM "ForumComments" WHERE "PsychologistId" = :psiId OR "psychologistId" = :psiId', { replacements, type: db.sequelize.QueryTypes.SELECT }).catch(() => [{ count: 0 }]),
            
            // Q&A
            db.sequelize.query('SELECT COUNT(*) as count FROM "answers" WHERE "psychologistId" = :psiId', { replacements, type: db.sequelize.QueryTypes.SELECT }).catch(() => [{ count: 0 }])
        ]);

        // Processa os resultados das raw queries
        const xp = parseInt(psychologistResult[0]?.xp || 0, 10);
        const whatsappClicks = parseInt(whatsappClicksResult[0]?.count || 0, 10);
        const profileAppearances = parseInt(profileAppearancesResult[0]?.count || 0, 10);
        const matchAppearances = parseInt(matchAppearancesResult[0]?.count || 0, 10);
        const blogPosts = parseInt(blogPostsResult[0]?.count || 0, 10);
        const blogLikes = parseInt(blogLikesResult[0]?.sum || 0, 10);
        const forumPosts = parseInt(forumPostsResult[0]?.count || 0, 10);
        const forumComments = parseInt(forumCommentsResult[0]?.count || 0, 10);
        const qnaAnswers = parseInt(qnaAnswersResult[0]?.count || 0, 10);

        res.json({
            xp,
            whatsappClicks,
            profileAppearances,
            matchAppearances,
            blogPosts,
            blogLikes,
            forumPosts,
            forumComments,
            qnaAnswers
        });

    } catch (error) {
        console.error("Erro CRÍTICO ao buscar estatísticas de contribuição:", error);
        res.status(500).json({ error: 'Erro interno ao buscar estatísticas de contribuição.' });
    }
});

// Alias: Aponta a rota antiga para o controller moderno para evitar quebrar o Frontend
app.use('/api/messaging', messageRoutes); 
app.use('/api/messages', messageRoutes);
app.use('/api/demand', demandRoutes);
app.use('/api/usuarios', usuarioRoutes);

// --- CORREÇÃO: ROTA PARA ARQUIVAR/DESARQUIVAR CONVERSA ---
// A rota foi movida para ANTES das rotas genéricas de admin (`/api/admin`)
// para garantir que ela seja encontrada e executada primeiro, evitando que uma
// rota mais genérica capture a requisição e retorne um erro 404.
app.put('/api/admin/messages/conversation/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['active', 'archived'].includes(status)) {
            return res.status(400).json({ error: 'Status inválido. Use "active" ou "archived".' });
        }

        // CORREÇÃO: SQL Puro para bypassar problemas de definição do Model (Sequelize)
        // O RETURNING id garante que sabemos se a linha foi encontrada e atualizada
        const [results] = await db.sequelize.query(
            `UPDATE "Conversations" SET "status" = :status, "updatedAt" = NOW() WHERE "id" = :id RETURNING id`,
            { replacements: { status: status, id: parseInt(id, 10) } }
        );

        if (!results || results.length === 0) {
            return res.status(404).json({ error: 'Conversa não encontrada no banco de dados.' });
        }

        res.json({ message: 'Status da conversa atualizado com sucesso.' });
    } catch (error) {
        console.error("Erro ao atualizar status da conversa:", error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
});

// --- ROTA DE EXCLUSÃO DE PSICÓLOGO (ADMIN) ---
app.delete('/api/admin/psychologists/:id', async (req, res) => {
    try {
        // Verificação básica de token (Admin) com suporte a Cookie
        let token = req.headers.authorization?.split(' ')[1];
        if (!token || token === 'null' || token === 'undefined' || token === 'cookie_auth_active') {
            token = req.cookies?.token;
        }
        
        if (!token) return res.status(401).json({ error: 'Não autorizado' });
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'admin' && decoded.type !== 'admin') return res.status(403).json({ error: 'Acesso negado' });

        const { id } = req.params;

        // OTIMIZAÇÃO: "Soft Delete" (Exclusão Lógica) sugerida
        // Oculta o usuário do sistema sem apagar dados físicos, preservando a integridade.
        const [updated] = await db.sequelize.query(
            `UPDATE "Psychologists" SET "deletedAt" = NOW(), status = 'inactive' WHERE id = :id RETURNING id`,
            { replacements: { id } }
        );

        if (!updated || updated.length === 0) {
            return res.status(404).json({ error: 'Psicólogo não encontrado.' });
        }

        res.json({ message: 'Psicólogo excluído com sucesso.' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao excluir: ' + error.message });
    }
});

// ROTAS DE ADMIN (ORDEM DE ESPECIFICIDADE IMPORTA)
app.use('/api/admin/messages', adminMessageRoutes); // Rotas de mensagem do admin (mais específicas)

// --- ROTA EXPLÍCITA E BLINDADA PARA UPLOAD DE FOTO DO ADMIN ---
const multer = require('multer');
const uploadAdmin = multer({ dest: 'uploads/profiles/', limits: { fileSize: 10 * 1024 * 1024 } });
app.put('/api/admin/me/photo', verifyTokenLocal, (req, res, next) => {
    uploadAdmin.single('foto')(req, res, (err) => {
        if (err) return res.status(400).json({ error: `Erro no interpretador de imagem: ${err.message}` });
        next();
    });
}, adminController.updateAdminPhoto);

app.use('/api/admin', adminRoutes); // Rotas genéricas do admin (devem vir por último)


// --- ROTAS DE GESTÃO DE CONTEÚDO (ADMIN) ---
// Adicionadas aqui para garantir precedência e funcionamento sem depender de adminRoutes.js
app.get('/api/admin/content/blog', adminController.getAllBlogPosts);
app.delete('/api/admin/content/blog/:id', adminController.deleteBlogPost);
app.get('/api/admin/content/forum', adminController.getAllForumPosts);
app.delete('/api/admin/content/forum/:id', adminController.deleteForumPost);
// Reutilizando controller de QnA existente
app.get('/api/admin/content/qna', qnaController.getAllQuestions);
app.delete('/api/admin/content/qna/:id', qnaController.deleteQuestion);

// --- ROTAS DE WEB PUSH (NOTIFICAÇÕES NATIVAS) ---
app.get('/api/admin/push/vapid-public-key', (req, res) => {
    res.send(process.env.VAPID_PUBLIC_KEY || '');
});

app.post('/api/admin/push/subscribe', async (req, res) => {
    try {
        const { endpoint, keys } = req.body;
        await db.sequelize.query(
            `INSERT INTO "AdminPushSubscriptions" (endpoint, keys, "createdAt", "updatedAt")
             VALUES (:endpoint, :keys, NOW(), NOW())
             ON CONFLICT (endpoint) DO UPDATE SET keys = :keys, "updatedAt" = NOW()`,
            { replacements: { endpoint, keys: JSON.stringify(keys) } }
        );
        res.status(201).json({ success: true });
    } catch (e) {
        console.error("Erro Push Subscribe:", e);
        res.status(500).json({ error: 'Erro ao assinar notificações' });
    }
});

// --- ROTAS DE CONFIGURAÇÕES DO SISTEMA ---
const checkAdminToken = (req, res, next) => {
    let token = req.headers.authorization?.split(' ')[1];
    if (!token || token === 'null' || token === 'undefined' || token === 'cookie_auth_active') {
        token = req.cookies?.token;
    }
    if (!token) return res.status(401).json({ error: 'Não autorizado' });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'admin' && decoded.type !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
        next();
    } catch (e) {
        return res.status(403).json({ error: 'Token inválido' });
    }
};
app.get('/api/admin/settings', checkAdminToken, settingsController.getSettings);
app.post('/api/admin/settings', checkAdminToken, settingsController.updateSettings);

// --- ROTAS DE FOLLOW-UP (ADMIN) ---
app.get('/api/admin/followups', adminController.getFollowUps);
app.put('/api/admin/followups/:id', adminController.updateFollowUpStatus);
app.delete('/api/admin/followups/:id', adminController.deleteFollowUp);

// --- ROTA DE EXPORTAÇÃO (LISTA DE ESPERA) ---
app.get('/api/admin/export/waitlist', adminController.exportWaitlist);

app.use('/api/reviews', reviewRoutes);
app.use('/api/qna', qnaRoutes);
app.use('/api/payments', paymentRoutes);
// app.use('/api/newsletter', newsletterRoutes); // <-- REMOVIDO DAQUI
app.use('/api/forum', forumRoutes); // <--- ROTAS DO FÓRUM

// --- ROTAS PÚBLICAS DE KPI (Adicionadas Manualmente) ---
app.post('/api/public/psychologists/:slug/whatsapp-click', async (req, res) => {
    try {
        const { slug } = req.params;
        // Tenta pegar o patientId do corpo da requisição
        const { patientId, guestPhone, guestName } = req.body;

        const psychologist = await db.Psychologist.findOne({ where: { slug } });

        if (!psychologist) {
            return res.status(404).send('Psicólogo não encontrado.');
        }

        // --- PLG: TRAVA DE LIMITE DE CLIQUES (TRIAL) ---
        const MAX_TRIAL_CLICKS = 3;
        const isAssinante = psychologist.status === 'active' || psychologist.is_exempt;
        const clicksAtuais = psychologist.whatsapp_clicks || 0;

        if (!isAssinante && clicksAtuais >= MAX_TRIAL_CLICKS) {
            return res.status(403).json({ 
                error: 'Profissional com agenda lotada no momento.' 
            });
        }

        // Insere com o patientId (pode ser null se for visitante)
        await db.sequelize.query(
            `INSERT INTO "WhatsappClickLogs" ("psychologistId", "patientId", "guestPhone", "guestName", "createdAt", "updatedAt") VALUES (:id, :patId, :phone, :name, NOW(), NOW())`,
            { replacements: { id: psychologist.id, patId: patientId || null, phone: guestPhone || null, name: guestName || null } }
        );

        // --- ATUALIZA O CONTADOR DE CLIQUES NO PERFIL DO PSICÓLOGO (Para o Match Algorithm) ---
        await db.sequelize.query(
            `UPDATE "Psychologists" SET "whatsapp_clicks" = COALESCE("whatsapp_clicks", 0) + 1 WHERE id = :id`,
            { replacements: { id: psychologist.id } }
        );

        // --- GAMIFICATION: CLIQUE WHATSAPP (10 pts) ---
        gamificationService.processAction(psychologist.id, 'whatsapp_click').catch(e => console.error(e));

        // --- DISPARO DE E-MAIL (PRIMEIRO LEAD) ---
        // --- DISPARO DE E-MAIL (LEADS E LIMITE) ---
        const emailService = require('./services/emailService');
        if (clicksAtuais === 0) {
            const emailService = require('./services/emailService');
            emailService.sendFirstLeadEmail(psychologist).catch(e => console.error('[EMAIL] Erro ao enviar aviso de primeiro lead:', e));
        } else if (!isAssinante && clicksAtuais === (MAX_TRIAL_CLICKS - 1)) {
            emailService.sendLimitReachedEmail(psychologist, MAX_TRIAL_CLICKS).catch(e => console.error('[EMAIL] Erro ao enviar aviso de limite atingido:', e));
        }

        res.status(200).send('Clique registrado com sucesso.');
    } catch (error) {
        console.error("Erro ao registrar clique no WhatsApp:", error);
        res.status(500).send('Erro interno do servidor.');
    }
});
app.post('/api/public/psychologists/:id/appearance', async (req, res) => {
    try {
        const { id } = req.params;
        const psychologist = await db.Psychologist.findByPk(id);

        if (!psychologist) {
            return res.status(404).send('Psicólogo não encontrado.');
        }

        // Insere um registro na tabela de logs de aparição
        await db.sequelize.query(
            `INSERT INTO "ProfileAppearanceLogs" ("psychologistId", "createdAt", "updatedAt") VALUES (:id, NOW(), NOW())`,
            { replacements: { id: psychologist.id } }
        );

        res.status(200).send('Aparição registrada com sucesso.');
    } catch (error) {
        console.error("Erro ao registrar aparição no Top 3:", error);
        res.status(500).send('Erro interno do servidor.');
    }
});

// --- ROTA PÚBLICA: LISTA DE PSICÓLOGOS PARA A PÁGINA SOBRE ---
app.get('/api/public/psychologists/list', async (req, res) => {
    try {
        const psis = await db.Psychologist.findAll({
            where: { 
                status: 'active', 
                fotoUrl: { [Op.ne]: null },
                [Op.or]: [ { is_exempt: true }, { planExpiresAt: { [Op.gt]: new Date() } } ]
            },
            attributes: ['id', 'nome', 'fotoUrl'],
            limit: 50,
            order: db.sequelize.random()
        });
        
        const agora = new Date();
        const psisFiltrados = psis.filter(psy => {
            const isVip = psy.is_exempt === true || String(psy.is_exempt).toLowerCase() === 'true' || psy.is_exempt === 1;
            if (isVip) return true;
            return psy.planExpiresAt && new Date(psy.planExpiresAt) > agora;
        });
        
        res.json(psisFiltrados);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar psicólogos.' });
    }
});

// --- ROTA PÚBLICA: PRÓXIMOS HORÁRIOS DO PSICÓLOGO ---
app.get('/api/public/psychologists/:slug/availability', async (req, res) => {
    try {
        const { slug } = req.params;
        const psychologist = await db.Psychologist.findOne({ where: { slug } });

        if (!psychologist) {
            return res.status(404).json({ error: 'Psicólogo não encontrado.' });
        }

        const availableSlots = await db.Appointment.findAll({
            where: {
                psychologistId: psychologist.id,
                status: 'available',
                start: { [Op.gt]: new Date() } // Apenas horários futuros
            },
            attributes: ['id', 'start', 'end', 'status'], // Traz apenas o necessário (mais leve)
            order: [['start', 'ASC']]
        });

        res.json(availableSlots);
    } catch (error) {
        console.error("Erro ao buscar horários disponíveis:", error);
        res.status(500).json({ error: 'Erro interno ao buscar agenda.' });
    }
});

// --- ROTA PÚBLICA DE CONTATO (Formulário do site) ---
app.post('/api/public/contato', async (req, res) => {
    try {
        const { nome, email, assunto, mensagem } = req.body;
        
        if (!nome || !email || !mensagem) {
            return res.status(400).json({ success: false, error: 'Preencha todos os campos obrigatórios.' });
        }

        const emailService = require('./services/emailService');
        
        // O email que vai receber as mensagens de contato (pode ser o admin ou suporte)
        const emailDestino = process.env.EMAIL_SUPPORT || 'oi@yelopsi.com.br';
        
        // Formata a mensagem que você vai receber na sua caixa de entrada
        const conteudoHtml = `
            <p><strong>Nome do Remetente:</strong> ${nome}</p>
            <p><strong>E-mail de Contato:</strong> ${email}</p>
            <p><strong>Assunto Selecionado:</strong> ${assunto || 'Não informado'}</p>
            <hr>
            <p><strong>Mensagem:</strong><br>${mensagem.replace(/\n/g, '<br>')}</p>
        `;
        
        await emailService.sendEmail(emailDestino, `Novo Contato pelo Site: ${assunto}`, conteudoHtml);
        
        res.json({ success: true, message: 'Mensagem enviada com sucesso!' });
    } catch (error) {
        console.error("Erro na rota de contato:", error);
        res.status(500).json({ success: false, error: 'Erro interno ao enviar a mensagem.' });
    }
});

// Rotas Específicas do Admin
app.get('/api/admin/feedbacks', demandController.getRatings);
app.get('/api/admin/exit-surveys', async (req, res) => {
    try {
        const { motivo, nota, startDate, endDate } = req.query;
        
        let whereClause = 'WHERE 1=1';
        const replacements = {};

        if (motivo) {
            whereClause += ' AND "motivo" ILIKE :motivo';
            replacements.motivo = `%${motivo}%`;
        }
        if (nota) {
            whereClause += ' AND "avaliacao" = :nota';
            replacements.nota = parseInt(nota);
        }
        if (startDate) {
            whereClause += ' AND "createdAt" >= :startDate';
            replacements.startDate = startDate;
        }
        if (endDate) {
            whereClause += ' AND "createdAt" <= :endDate';
            // Ajusta para o final do dia
            replacements.endDate = new Date(endDate + 'T23:59:59.999Z').toISOString();
        }

        // Stats Query (Inclui Moda para pegar o motivo mais comum)
        const statsQuery = `
            SELECT 
                COUNT(*) as total, 
                AVG(avaliacao)::numeric(10,1) as media,
                COALESCE(MODE() WITHIN GROUP (ORDER BY motivo), 'Sem dados') as "topReason"
            FROM "ExitSurveys" ${whereClause}
        `;
        
        // List Query
        const listQuery = `SELECT * FROM "ExitSurveys" ${whereClause} ORDER BY "createdAt" DESC LIMIT 100`;

        const [stats] = await db.sequelize.query(statsQuery, { replacements });
        const [list] = await db.sequelize.query(listQuery, { replacements });

        res.json({ stats: stats[0], list });
    } catch (error) { 
        console.error("Erro em exit-surveys:", error);
        res.status(500).json({ error: "Erro interno" }); 
    }
});

// =============================================================
// ROTA DE EMERGÊNCIA (Cria o Admin no Banco de Dados)
// =============================================================
/*
app.get('/admin-setup-secreto', async (req, res) => {
    try {
        await seedTestData(); // Roda a função que cria o Admin e os testes
        res.send('<h1>Sucesso!</h1><p>O usuário Admin foi criado/atualizado.</p><p>Login: admin@yelopsi.com.br</p><p>Senha: admin123</p><br><a href="/login">Ir para Login</a>');
    } catch (error) {
        res.status(500).send('Erro ao criar admin: ' + error.message);
    }
});
*/

// =============================================================
// ÁREA DO ADMINISTRADOR (ROBUSTA)
// =============================================================

// 1. ROTA DE INSTALAÇÃO (CRIA TABELA E USUÁRIO NA FORÇA BRUTA)
/*
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
            replacements: { email: 'admin@yelopsi.com.br', senha: senhaHash }
        });

        res.send(`
            <div style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: #1B4332;">Admin Configurado com Sucesso!</h1>
                <p>A tabela foi criada e o usuário registrado.</p>
                <hr>
                <p><strong>Login:</strong> admin@yelopsi.com.br</p>
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
*/

// 2. ROTA DE LOGIN DO ADMIN (VERIFICA NA TABELA 'Admins')
app.post('/api/login-admin-check', async (req, res) => {
    try {
        const email = req.body.email;
        // --- FIX: Aceita variações do nome do campo de senha ---
        const senha = req.body.senha || req.body.password || req.body['senha-login'];

        if (!senha) {
            return res.status(400).json({ success: false, message: 'Senha não fornecida.' });
        }

        // A) Busca o usuário
        const [results] = await db.sequelize.query(
            `SELECT * FROM "Admins" WHERE email ILIKE :email LIMIT 1`,
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
            { id: adminUser.id, role: 'admin', type: 'admin', nome: adminUser.nome }, // CORREÇÃO: Adicionado type: 'admin'
            process.env.JWT_SECRET, // Usa sua chave secreta
            { expiresIn: '24h' }
        );

        // --- FIX: Salva o token no cookie para persistência (Evita logout involuntário) ---
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000 // 24 horas
        });

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

// --- FERRAMENTAS INTERNAS (EQUIPE YELO) ---
// Acesso restrito via Cookie de Admin
app.get('/admin/gerador-email', verifyTokenLocal, (req, res) => {
    if (req.userDecoded && (req.userDecoded.role === 'admin' || req.userDecoded.type === 'admin')) {
        // O arquivo HTML deve ser salvo dentro da pasta 'views' para não ser público
        res.sendFile(path.join(__dirname, '../views/gerador_email.html'));
    } else {
        res.redirect('/admin'); // Redireciona para o login do admin se não estiver autenticado
    }
});

// 1º: PRIMEIRO defina a rota da Home.
// Isso garante que o servidor renderize o index.ejs ao acessar a raiz '/'
app.get('/', async (req, res) => {
    try {
        // Busca até 10 psicólogos aleatórios que estejam ativos e tenham foto
        const psicologos = await db.Psychologist.findAll({
            where: {
                status: 'active',
                fotoUrl: { [Op.ne]: null }, // Garante que só venham perfis com foto
                [Op.or]: [
                    { is_exempt: true },
                    { planExpiresAt: { [Op.gt]: new Date() } }
                ]
            },
            order: db.sequelize.random(), // Pega de forma aleatória
            limit: 10, // Um pouco a mais para garantir variedade
            attributes: ['nome', 'fotoUrl', 'slug'] // Apenas os dados necessários
        });

        // --- FILTRO JS BLINDADO ---
        const agora = new Date();
        const psicologosFiltrados = psicologos.filter(psy => {
            const isVip = psy.is_exempt === true || String(psy.is_exempt).toLowerCase() === 'true' || psy.is_exempt === 1;
            if (isVip) return true;
            return psy.planExpiresAt && new Date(psy.planExpiresAt) > agora;
        });

        // --- NOVO: Busca Média de Avaliações (Prova Social) ---
        let mediaAvaliacao = '4.9';
        let totalAvaliacoes = '150+';
        let depoimentos = [];

        try {
            // 1. Estatísticas Gerais (Média e Total)
            const [result] = await db.sequelize.query(`
                SELECT 
                    AVG(CAST("searchParams"->'avaliacao_ux'->>'rating' AS NUMERIC)) as media, 
                    COUNT(*) as total 
                FROM "DemandSearches" 
                WHERE "searchParams"->'avaliacao_ux'->>'rating' IS NOT NULL
            `, { type: db.sequelize.QueryTypes.SELECT });
            
            if (result && result.media) mediaAvaliacao = parseFloat(result.media).toFixed(1);
            if (result && result.total > 0) totalAvaliacoes = result.total;

            // 2. Busca Depoimentos Reais (Texto + Nota)
            // Filtra por quem deixou feedback escrito (> 10 chars) e nota boa (>= 4)
            const rows = await db.sequelize.query(`
                SELECT "searchParams"
                FROM "DemandSearches"
                WHERE "searchParams"->'avaliacao_ux'->>'feedback' IS NOT NULL
                AND length("searchParams"->'avaliacao_ux'->>'feedback') > 10
                AND CAST("searchParams"->'avaliacao_ux'->>'rating' AS NUMERIC) >= 4
                ORDER BY "createdAt" DESC
                LIMIT 4
            `, { type: db.sequelize.QueryTypes.SELECT });

            if (rows && rows.length > 0) {
                depoimentos = rows.map(r => {
                    const p = r.searchParams || {};
                    const av = p.avaliacao_ux || {};
                    const nome = p.nome || 'Anônimo';
                    // Converte para iniciais (ex: "Ana Silva" -> "A. S.")
                    const iniciais = nome.trim().split(/\s+/).map(n => n[0].toUpperCase() + '.').join(' ');
                    
                    return {
                        nome: iniciais,
                        texto: (av.feedback || "").replace("amei a plataforma (teste)", "amei a plataforma"),
                        nota: parseInt(av.rating || 5),
                        inicial: nome[0].toUpperCase()
                    };
                });
            }
        } catch (e) { 
            console.log("Nota: Tabela 'DemandSearches' vazia ou com erro, usando valores padrão para a home.", e.message); 
        }

        // Fallback: Se não tiver depoimentos reais suficientes, completa com mocks
        if (depoimentos.length < 4) {
            const mocks = [
                { nome: "M. S.", texto: "Eu adiava a terapia por achar difícil encontrar alguém. O questionário da Yelo foi certeiro.", nota: 5, inicial: "M" },
                { nome: "C. E.", texto: "A facilidade de fazer online mudou tudo pra mim. Plataforma estável e segura.", nota: 5, inicial: "C" },
                { nome: "F. L.", texto: "O acolhimento que recebi foi fundamental. Recomendo a Yelo para todos.", nota: 5, inicial: "F" },
                { nome: "J. P.", texto: "Encontrei um espaço seguro para falar sobre minhas angústias.", nota: 5, inicial: "J" }
            ];
            // Adiciona os mocks necessários para chegar a 4
            depoimentos = [...depoimentos, ...mocks.slice(0, 4 - depoimentos.length)];
        }

        // Renderiza a página inicial, passando a variável 'profissionais' para o EJS
        res.render('index', { profissionais: psicologosFiltrados, mediaAvaliacao, totalAvaliacoes, depoimentos });

    } catch (error) {
        console.error("Erro ao buscar profissionais para a home:", error);
        // Em caso de erro, renderiza a página mesmo assim, mas sem os profissionais (mostrará os mocks)
        res.render('index', { profissionais: [], mediaAvaliacao: '4.9', totalAvaliacoes: '100+', depoimentos: [] });
    }
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
// MAPEAMENTO DE PÁGINAS (Correção de Links do Menu)
// =============================================================

// Corrige o link "Comunidade" para abrir o arquivo "perguntas.ejs"
app.get('/comunidade', (req, res) => {
    res.render('perguntas'); 
});

// [NOVO] Redireciona a antiga página /jornada para a home para evitar erro 404.
app.get('/jornada', (req, res) => {
    // O código 301 indica um redirecionamento permanente, o que é ideal para SEO.
    res.redirect(301, '/');
});

// Garante que "Profissionais" abra o arquivo correto (se existir profissionais.ejs)
app.get('/profissionais', (req, res) => {
    res.render('profissionais');
});

// Rota para a página "Nossos Psis" (Sobre Psis)
app.get('/sobre_psis', (req, res) => {
    res.render('sobre_psis');
});

// --- ADICIONE ESTE BLOCO AQUI ---
// Rota para a página de Registro do Psicólogo (Pós-Questionário)
app.get('/psi-registro', (req, res) => {
    res.render('psi_registro'); 
});
// --------------------------------

// Garante que "FAQ" abra o arquivo correto
app.get('/faq', (req, res) => {
    res.render('faq');
});

// Rota para a página de Apoio à Mulher
app.get('/ajuda-mulher', (req, res) => {
    res.render('ajuda_mulher');
});

// Rota para Banner LinkedIn (Ferramenta Interna)
app.get('/banner-linkedin', (req, res) => {
    res.render('banner_linkedin');
});

// Rotas de Autenticação (opcional, mas recomendado para segurança)
app.get('/login', (req, res) => { res.render('login'); });
app.get('/cadastro', (req, res) => { res.render('cadastro'); });
app.get('/recuperar-senha', (req, res) => { res.render('esqueci_senha'); });
app.get('/redefinir-senha', (req, res) => { res.render('redefinir_senha'); });

// --- ROTA DE LOGOUT E CORREÇÕES DE REDIRECIONAMENTO ---
app.get('/logout', (req, res) => {
    // --- MIGRAÇÃO SEGURA: Limpa o Cookie HttpOnly ---
    res.clearCookie('token');

    // Envia script para limpar localStorage e redirecionar para a Home
    res.send(`
        <html><body><script>
            localStorage.removeItem('Yelo_token');
            localStorage.removeItem('Yelo_user_type');
            localStorage.removeItem('Yelo_user_name');
            window.location.href = '/';
        </script></body></html>
    `);
});

// Captura tentativas de logout com links relativos quebrados (ex: /admin/login)
app.get(['/admin/login', '/psi/login', '/patient/login'], (req, res) => {
    res.redirect('/logout');
});

// --- ROTA PARA ROBOTS.TXT (SEO) ---
// Bloqueia o rastreamento de pastas de API e de usuários logados.
app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.send(
`User-agent: *
Disallow: /api/
Disallow: /admin/
Disallow: /psi/
Disallow: /patient/`
    );
});

// --- ROTA AUXILIAR PARA IDENTIFICAR TIPO DE USUÁRIO (RECUPERAÇÃO DE SENHA) ---
app.post('/api/auth/identify-user', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'E-mail obrigatório' });

        // Verifica na tabela de Pacientes
        const [patients] = await db.sequelize.query('SELECT 1 FROM "Patients" WHERE email ILIKE :email LIMIT 1', { replacements: { email: email.trim() } });
        if (patients.length > 0) return res.json({ type: 'patient' });

        // Verifica na tabela de Psicólogos
        const [psis] = await db.sequelize.query('SELECT 1 FROM "Psychologists" WHERE email ILIKE :email LIMIT 1', { replacements: { email: email.trim() } });
        if (psis.length > 0) return res.json({ type: 'psychologist' });

        return res.status(404).json({ error: 'E-mail não encontrado em nossa base de dados.' });
    } catch (error) {
        console.error('Erro ao identificar usuário:', error);
        res.status(500).json({ error: 'Erro interno ao verificar e-mail.' });
    }
});

// Rota da Landing Page B2C (Pacientes - Tráfego)
app.get('/terapia-online', async (req, res) => {
    try {
        const psicologos = await db.Psychologist.findAll({
            where: { 
                status: 'active', 
                fotoUrl: { [Op.ne]: null },
                [Op.or]: [ { is_exempt: true }, { planExpiresAt: { [Op.gt]: new Date() } } ]
            },
            order: db.sequelize.random(),
            limit: 10,
            attributes: ['nome', 'fotoUrl', 'slug']
        });

        const agora = new Date();
        const psicologosFiltrados = psicologos.filter(psy => {
            const isVip = psy.is_exempt === true || String(psy.is_exempt).toLowerCase() === 'true' || psy.is_exempt === 1;
            if (isVip) return true;
            return psy.planExpiresAt && new Date(psy.planExpiresAt) > agora;
        });

        let mediaAvaliacao = '4.9';
        let totalAvaliacoes = '150+';
        let depoimentos = [];

        try {
            const [result] = await db.sequelize.query(`
                SELECT AVG(CAST("searchParams"->'avaliacao_ux'->>'rating' AS NUMERIC)) as media, COUNT(*) as total 
                FROM "DemandSearches" WHERE "searchParams"->'avaliacao_ux'->>'rating' IS NOT NULL
            `, { type: db.sequelize.QueryTypes.SELECT });
            if (result && result.media) mediaAvaliacao = parseFloat(result.media).toFixed(1);
            if (result && result.total > 0) totalAvaliacoes = result.total;

            const rows = await db.sequelize.query(`
                SELECT "searchParams" FROM "DemandSearches"
                WHERE "searchParams"->'avaliacao_ux'->>'feedback' IS NOT NULL
                AND length("searchParams"->'avaliacao_ux'->>'feedback') > 10
                AND CAST("searchParams"->'avaliacao_ux'->>'rating' AS NUMERIC) >= 4
                ORDER BY "createdAt" DESC LIMIT 4
            `, { type: db.sequelize.QueryTypes.SELECT });

            if (rows && rows.length > 0) {
                depoimentos = rows.map(r => {
                    const p = r.searchParams || {};
                    const av = p.avaliacao_ux || {};
                    const nome = p.nome || 'Anônimo';
                    const iniciais = nome.trim().split(/\s+/).map(n => n[0].toUpperCase() + '.').join(' ');
                    return { nome: iniciais, texto: (av.feedback || "").replace("amei a plataforma (teste)", "amei a plataforma"), nota: parseInt(av.rating || 5), inicial: nome[0].toUpperCase() };
                });
            }
        } catch (e) { }

        if (depoimentos.length < 4) {
            const mocks = [
                { nome: "M. S.", texto: "Eu adiava a terapia por achar difícil encontrar alguém. O questionário da Yelo foi certeiro.", nota: 5, inicial: "M" },
                { nome: "C. E.", texto: "A facilidade de fazer online mudou tudo pra mim. Plataforma estável e segura.", nota: 5, inicial: "C" },
                { nome: "F. L.", texto: "O acolhimento que recebi foi fundamental. Recomendo a Yelo para todos.", nota: 5, inicial: "F" },
                { nome: "J. P.", texto: "Encontrei um espaço seguro para falar sobre minhas angústias.", nota: 5, inicial: "J" }
            ];
            depoimentos = [...depoimentos, ...mocks.slice(0, 4 - depoimentos.length)];
        }
        res.render('terapia-online', { profissionais: psicologosFiltrados, mediaAvaliacao, totalAvaliacoes, depoimentos });
    } catch (error) {
        console.error("Erro ao buscar dados para a landing page:", error);
        res.render('terapia-online', { profissionais: [], mediaAvaliacao: '4.9', totalAvaliacoes: '100+', depoimentos: [] });
    }
});

// --- ADICIONE ESTA ROTA PARA O DASHBOARD DO PACIENTE ---
app.get('/patient/patient_dashboard', (req, res) => {
    // Renderiza o arquivo que está em /views/patient/patient_dashboard.ejs
    res.render('patient/patient_dashboard');
});

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
app.use((req, res, next) => {
    res.status(404);

    // Se aceitar HTML (navegador), renderiza a página 404 personalizada
    if (req.accepts('html')) {
        res.render('404', { url: req.url });
        return;
    }

    // Se for API (JSON), retorna erro JSON limpo
    if (req.accepts('json')) {
        res.json({ error: 'Recurso não encontrado' });
        return;
    }

    // Fallback para texto simples
    res.type('txt').send('Página não encontrada');
});

// --- GLOBAL ERROR HANDLER (MULTER & OTHERS) ---
app.use((err, req, res, next) => {
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'Arquivo muito grande. Limite máximo: 10MB.' });
    }
    console.error("[SERVER ERROR]", err);
    res.status(500).json({ error: 'Erro interno no servidor.' });
});

// Inicialização
const PORT = process.env.PORT || 3001;
const startServer = async () => {
    console.time('⏱️ Tempo Total de Inicialização');

    // [OTIMIZAÇÃO] Inicia o servidor IMEDIATAMENTE para o Render detectar a porta aberta
    // Isso evita timeouts de deploy se o banco demorar alguns segundos para conectar.
    if (!server.listening) {
        server.listen(PORT, () => {
            console.log(`🚀 [FAST BOOT] Servidor ouvindo na porta ${PORT} (Inicializando conexões...)`);
        });
    }

    // --- 1. AGUARDA O BANCO ESTAR PRONTO (RETRY LOOP) ---
    // Garante que o banco aceita escrita antes de tentar alterar o schema
    let dbReady = false;
    const maxRetries = 20; // 20 tentativas * 3s = 60 segundos de tolerância
    
    for (let i = 1; i <= maxRetries; i++) {
        try {
            await db.sequelize.authenticate();
            // Tenta uma operação de escrita leve para garantir que o banco não está em Recovery Mode
            await db.sequelize.query('CREATE TEMP TABLE IF NOT EXISTS _startup_check (id serial);');
            await db.sequelize.query('DROP TABLE IF EXISTS _startup_check;');
            
            console.log('✅ [DB CONNECTION] Conexão de escrita estabelecida com sucesso.');
            dbReady = true;
            break;
        } catch (error) {
            console.warn(`⏳ [DB WAIT] Banco indisponível ou em recuperação (Tentativa ${i}/${maxRetries}): ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    if (!dbReady) {
        console.error('❌ [DB CRITICAL] O banco de dados não ficou pronto a tempo. As correções de schema podem falhar.');
    }

    // --- HELPER: EXECUÇÃO SEGURA DE SCHEMA (RETRY) ---
    // Adicionado para resolver o erro "database system is in recovery mode" durante o deploy
    const runSchemaQuery = async (sql, successMsg) => {
        const retries = 5;
        for (let i = 0; i < retries; i++) {
            try {
                await db.sequelize.query(sql, { logging: false }); // <--- OTIMIZAÇÃO: Desativa log para economizar memória
                if (successMsg) console.log(`✅ [DB FIX] ${successMsg}`);
                return;
            } catch (e) {
                const msg = e.message.toLowerCase();
                if (msg.includes('recovery mode') || msg.includes('connection')) {
                    if (i < retries - 1) {
                        console.warn(`⏳ [DB RECOVERY] Banco instável. Retentando... (${i + 1}/${retries})`);
                        await new Promise(r => setTimeout(r, 2000));
                        continue;
                    }
                }
                // Ignora erros de "já existe" ou "não nulo" que são esperados
                if (!msg.includes('already exists') && !msg.includes('duplicate')) {
                    console.warn(`⚠️ [DB FIX SKIP] ${e.message}`);
                }
                return;
            }
        }
    };

    // --- BLOCO DE SINCRONIZAÇÃO E CORREÇÃO DE SCHEMA (RODA EM TODOS OS AMBIENTES) ---
    try {
        // [OTIMIZAÇÃO] Se a variável SKIP_SCHEMA_SYNC estiver definida, pula a verificação pesada
        if (!process.env.SKIP_SCHEMA_SYNC) {
            console.log('🔧 [DB SYNC] Verificando e aplicando correções de schema...');

            // --- OTIMIZAÇÃO: Agrupa todas as queries de schema para rodar em paralelo ---
            const schemaQueries = [
            // 1. Psychologists Table - ATUALIZAÇÃO MACIÇA AGRUPADA (Reduz de 30 queries para 1)
            `ALTER TABLE "Psychologists" 
                ADD COLUMN IF NOT EXISTS "fotoUrl" VARCHAR(500),
                ADD COLUMN IF NOT EXISTS "linkedin_url" VARCHAR(500),
                ADD COLUMN IF NOT EXISTS "instagram_url" VARCHAR(500),
                ADD COLUMN IF NOT EXISTS "facebook_url" VARCHAR(500),
                ADD COLUMN IF NOT EXISTS "tiktok_url" VARCHAR(500),
                ADD COLUMN IF NOT EXISTS "x_url" VARCHAR(500),
                ADD COLUMN IF NOT EXISTS "cep" VARCHAR(20),
                ADD COLUMN IF NOT EXISTS "cidade" VARCHAR(255),
                ADD COLUMN IF NOT EXISTS "estado" VARCHAR(50),
                ADD COLUMN IF NOT EXISTS "telefone" VARCHAR(255),
                ADD COLUMN IF NOT EXISTS "bio" TEXT,
                ADD COLUMN IF NOT EXISTS "crpDocumentUrl" TEXT,
                ADD COLUMN IF NOT EXISTS "is_exempt" BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS "cnpj" VARCHAR(255) UNIQUE,
                ADD COLUMN IF NOT EXISTS "modalidade" JSONB DEFAULT '[]',
                ADD COLUMN IF NOT EXISTS "dailySummaryTime" VARCHAR(5) DEFAULT '08:00',
                ADD COLUMN IF NOT EXISTS "reminderHoursBefore" INTEGER DEFAULT 24,
                ADD COLUMN IF NOT EXISTS "publico_alvo" JSONB DEFAULT '[]',
                ADD COLUMN IF NOT EXISTS "estilo_terapia" JSONB DEFAULT '[]',
                ADD COLUMN IF NOT EXISTS "praticas_inclusivas" JSONB DEFAULT '[]',
                ADD COLUMN IF NOT EXISTS "disponibilidade_periodo" JSONB DEFAULT '[]',
                ADD COLUMN IF NOT EXISTS "temas_atuacao" JSONB DEFAULT '[]',
                ADD COLUMN IF NOT EXISTS "abordagens_tecnicas" JSONB DEFAULT '[]',
                ADD COLUMN IF NOT EXISTS "praticas_vivencias" JSONB DEFAULT '[]',
                ADD COLUMN IF NOT EXISTS "genero_identidade" VARCHAR(255),
                ADD COLUMN IF NOT EXISTS "valor_sessao_numero" FLOAT,
                ADD COLUMN IF NOT EXISTS "cpf" VARCHAR(255) UNIQUE,
                ADD COLUMN IF NOT EXISTS "whatsapp_clicks" INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS "profile_appearances" INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS "planExpiresAt" TIMESTAMP WITH TIME ZONE,
                ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" VARCHAR(255),
                ADD COLUMN IF NOT EXISTS "cancelAtPeriodEnd" BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS "subscription_payments_count" INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS "resetPasswordToken" VARCHAR(255),
                ADD COLUMN IF NOT EXISTS "resetPasswordExpires" BIGINT,
                ADD COLUMN IF NOT EXISTS "authority_level" VARCHAR(255) DEFAULT 'nivel_iniciante',
                ADD COLUMN IF NOT EXISTS "badges" JSONB DEFAULT '{}',
                ADD COLUMN IF NOT EXISTS "remarketing_step" INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS "last_remarketing_at" TIMESTAMP WITH TIME ZONE,
                ADD COLUMN IF NOT EXISTS "utm_source" VARCHAR(255),
                ADD COLUMN IF NOT EXISTS "utm_medium" VARCHAR(255),
                ADD COLUMN IF NOT EXISTS "utm_campaign" VARCHAR(255),
                ADD COLUMN IF NOT EXISTS "xp" INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS "formacao_nivel" VARCHAR(255),
                ADD COLUMN IF NOT EXISTS "formacao_desc" TEXT;`,
            
            `ALTER TABLE "Psychologists" ALTER COLUMN "crp" DROP NOT NULL;`,

            // 2. Patients Table - Grouped
            `ALTER TABLE "Patients" 
                ADD COLUMN IF NOT EXISTS "fotoUrl" VARCHAR(500),
                ADD COLUMN IF NOT EXISTS "faixa_etaria" VARCHAR(255),
                ADD COLUMN IF NOT EXISTS "idade" VARCHAR(255),
                ADD COLUMN IF NOT EXISTS "genero_profissional" VARCHAR(255),
                ADD COLUMN IF NOT EXISTS "abordagem_desejada" JSONB DEFAULT '[]',
                ADD COLUMN IF NOT EXISTS "praticas_afirmativas" JSONB DEFAULT '[]',
                ADD COLUMN IF NOT EXISTS "telefone" VARCHAR(255),
                ADD COLUMN IF NOT EXISTS "ip_registro" VARCHAR(45),
                ADD COLUMN IF NOT EXISTS "termos_aceitos" BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS "marketing_aceito" BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS "sessionValue" FLOAT DEFAULT 0,
                ADD COLUMN IF NOT EXISTS "status" VARCHAR(255) DEFAULT 'active',
                ADD COLUMN IF NOT EXISTS "observacoes" TEXT,
                ADD COLUMN IF NOT EXISTS "resetPasswordToken" VARCHAR(255),
                ADD COLUMN IF NOT EXISTS "utm_source" VARCHAR(255),
                ADD COLUMN IF NOT EXISTS "utm_medium" VARCHAR(255),
                ADD COLUMN IF NOT EXISTS "utm_campaign" VARCHAR(255),
                ADD COLUMN IF NOT EXISTS "valor_sessao_faixa" VARCHAR(255),
                ADD COLUMN IF NOT EXISTS "temas_buscados" JSONB DEFAULT '[]',
                ADD COLUMN IF NOT EXISTS "identidade_genero" VARCHAR(255),
                ADD COLUMN IF NOT EXISTS "recebe_mensagens" BOOLEAN DEFAULT TRUE,
                ADD COLUMN IF NOT EXISTS "resetPasswordExpires" BIGINT;`,
            
            `ALTER TABLE "Patients" ALTER COLUMN "email" DROP NOT NULL;`,

            // Other tables
            `ALTER TABLE "Messages" ADD COLUMN IF NOT EXISTS "status" VARCHAR(255) DEFAULT 'sent';`,
            `ALTER TABLE "Conversations" ADD COLUMN IF NOT EXISTS "status" VARCHAR(255) DEFAULT 'active';`,
            `ALTER TABLE "ForumPosts" ADD COLUMN IF NOT EXISTS "status" VARCHAR(255) DEFAULT 'active';`,
            `ALTER TABLE "ForumPosts" ADD COLUMN IF NOT EXISTS "isPinned" BOOLEAN DEFAULT FALSE;`,
            `ALTER TABLE "ForumComments" ADD COLUMN IF NOT EXISTS "status" VARCHAR(255) DEFAULT 'active';`,
            `ALTER TABLE "Appointments" ADD COLUMN IF NOT EXISTS "patientId" INTEGER;`,
            `ALTER TABLE "SystemLogs" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;`,
            `ALTER TABLE "WaitingLists" ALTER COLUMN "crp" DROP NOT NULL;`,

            // Table Creations
            `CREATE TABLE IF NOT EXISTS "Expenses" ( "id" SERIAL PRIMARY KEY, "description" VARCHAR(255), "value" FLOAT, "date" DATE, "psychologistId" INTEGER, "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP );`,
            `CREATE TABLE IF NOT EXISTS "Appointments" ( "id" SERIAL PRIMARY KEY, "title" VARCHAR(255), "start" TIMESTAMP WITH TIME ZONE, "end" TIMESTAMP WITH TIME ZONE, "status" VARCHAR(255) DEFAULT 'scheduled', "value" FLOAT DEFAULT 0, "psychologistId" INTEGER, "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP );`,
            `CREATE TABLE IF NOT EXISTS "posts" ( "id" SERIAL PRIMARY KEY, "titulo" VARCHAR(255) NOT NULL, "conteudo" TEXT NOT NULL, "imagem_url" VARCHAR(500), "tags" VARCHAR(255), "slug" VARCHAR(255) UNIQUE, "psychologist_id" INTEGER NOT NULL, "curtidas" INTEGER DEFAULT 0, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP );`,
            `CREATE TABLE IF NOT EXISTS "SystemLogs" ( "id" SERIAL PRIMARY KEY, "level" VARCHAR(255), "message" TEXT, "meta" JSONB, "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP );`,
            `CREATE TABLE IF NOT EXISTS "ActiveSessions" ( "sessionId" VARCHAR(255) PRIMARY KEY, "lastSeen" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP );`,
            `CREATE TABLE IF NOT EXISTS "AnonymousSessions" ( "sessionId" VARCHAR(255) PRIMARY KEY, "durationInSeconds" INTEGER, "endedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP );`,
            `CREATE TABLE IF NOT EXISTS "SiteVisits" ( "id" SERIAL PRIMARY KEY, "url" VARCHAR(255), "userAgent" TEXT, "referrer" TEXT, "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP );`,
            `CREATE TABLE IF NOT EXISTS "WhatsappClickLogs" ( "id" SERIAL PRIMARY KEY, "psychologistId" INTEGER, "patientId" INTEGER, "guestPhone" VARCHAR(255), "guestName" VARCHAR(255), "status" VARCHAR(255) DEFAULT 'pending', "message_sent_at" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP );`,
            `CREATE TABLE IF NOT EXISTS "PwaInstallLogs" ( "id" SERIAL PRIMARY KEY, "userAgent" TEXT, "platform" VARCHAR(50), "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP );`,
            `CREATE TABLE IF NOT EXISTS "ProfileAppearanceLogs" ( "id" SERIAL PRIMARY KEY, "psychologistId" INTEGER, "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP );`,
            `CREATE TABLE IF NOT EXISTS "MatchEvents" ( "id" SERIAL PRIMARY KEY, "psychologistId" INTEGER, "matchTags" TEXT[], "matchScore" INTEGER, "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP );`,
            `CREATE TABLE IF NOT EXISTS "FeatureTrackingLogs" ( "id" SERIAL PRIMARY KEY, "psychologistId" INTEGER, "feature" VARCHAR(255), "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP );`,
            `ALTER TABLE "MatchEvents" ADD COLUMN IF NOT EXISTS "patientId" INTEGER;`,
            `ALTER TABLE "MatchEvents" ADD COLUMN IF NOT EXISTS "source" VARCHAR(255);`,
            `CREATE TABLE IF NOT EXISTS "AdminPushSubscriptions" ( "id" SERIAL PRIMARY KEY, "endpoint" TEXT UNIQUE NOT NULL, "keys" JSONB NOT NULL, "adminId" INTEGER, "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP );`,
            `CREATE TABLE IF NOT EXISTS "SystemSettings" ( "id" SERIAL PRIMARY KEY, "maintenance_mode" BOOLEAN DEFAULT FALSE, "allow_registrations" BOOLEAN DEFAULT TRUE, "price_Essencial" FLOAT, "price_Clínico" FLOAT, "price_sol" FLOAT, "whatsapp_support" VARCHAR(255), "email_support" VARCHAR(255), "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP );`,
            `ALTER TABLE "WaitingLists" ADD COLUMN IF NOT EXISTS "telefone" VARCHAR(255);`,
            `ALTER TABLE "WaitingLists" ADD COLUMN IF NOT EXISTS "utm_source" VARCHAR(255);`,
            `ALTER TABLE "WaitingLists" ADD COLUMN IF NOT EXISTS "utm_medium" VARCHAR(255);`,
            `ALTER TABLE "WaitingLists" ADD COLUMN IF NOT EXISTS "utm_campaign" VARCHAR(255);`
            ];

            // OTIMIZAÇÃO: Executa sequencialmente para evitar sobrecarga de conexões (Connection terminated)
            for (const sql of schemaQueries) {
                await runSchemaQuery(sql);
            }

            // --- FIX: CONVERSÃO EM MASSA DE ARRAYS PARA JSONB (CORREÇÃO ERRO 500) ---
            // OTIMIZAÇÃO: Verifica metadados antes de tentar alterar.
            // Isso evita travar o banco com comandos pesados se a coluna já estiver correta.
            const [tableInfo] = await db.sequelize.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'Psychologists';
            `);

            const arrayColumns = [
                'temas_atuacao', 'abordagens_tecnicas', 'modalidade', 
                'publico_alvo', 'estilo_terapia', 'praticas_inclusivas', 
                'disponibilidade_periodo', 'praticas_vivencias'
            ];

            for (const col of arrayColumns) {
                // Verifica se a coluna já existe e se já é do tipo jsonb
                const colInfo = tableInfo.find(c => c.column_name === col);
                if (colInfo && colInfo.data_type === 'jsonb') {
                    continue; // PULA esta iteração, economizando segundos preciosos
                }

                try {
                    await runSchemaQuery(`
                        ALTER TABLE "Psychologists" 
                        ALTER COLUMN "${col}" TYPE JSONB 
                        USING to_json("${col}"::text); 
                    `);
                } catch (e) {
                    try {
                        await runSchemaQuery(`ALTER TABLE "Psychologists" ALTER COLUMN "${col}" TYPE JSONB USING "${col}"::jsonb;`); 
                    } catch (e2) { 
                    }
                }
            }

            // --- FIX: Converter DemandSearches.searchParams para JSONB ---
            try {
                await runSchemaQuery(`
                    ALTER TABLE "DemandSearches" 
                    ALTER COLUMN "searchParams" TYPE JSONB 
                    USING "searchParams"::text::jsonb;
                `);
            } catch (e) { /* Ignora se já for JSONB */ }

            console.log('🔧 [DB FIX] Colunas de lista verificadas e convertidas para JSONB.');
            console.log('✅ [DB SYNC] Correções de schema aplicadas com sucesso.');
        } else {
            console.log('⏩ [DB SYNC] Verificação de schema pulada (SKIP_SCHEMA_SYNC ativado).');
        }

         // --- FIX DEFINITIVO: Adiciona colunas faltantes em Patients via queryInterface ---
        const queryInterface = db.sequelize.getQueryInterface();
        const patientAttributes = await queryInterface.describeTable('Patients');

            if (!patientAttributes.fotoUrl) {
                await queryInterface.addColumn('Patients', 'fotoUrl', { type: DataTypes.STRING(500) });
                console.log("[FIX] Coluna fotoUrl adicionada em Patients.");
            }
        if (!patientAttributes.observacoes) {
            await queryInterface.addColumn('Patients', 'observacoes', { type: DataTypes.TEXT });
        }
        if (!patientAttributes.sessionValue) {
            await queryInterface.addColumn('Patients', 'sessionValue', { type: DataTypes.FLOAT, defaultValue: 0 });
        }
        if (!patientAttributes.recebe_mensagens) {
            await queryInterface.addColumn('Patients', 'recebe_mensagens', { type: DataTypes.BOOLEAN, defaultValue: true });
        }
        const psyAttributes = await queryInterface.describeTable('Psychologists');
            if (!psyAttributes.fotoUrl) {
                await queryInterface.addColumn('Psychologists', 'fotoUrl', { type: DataTypes.STRING(500) });
                console.log("[FIX] Coluna fotoUrl adicionada em Psychologists.");
            }
        // Adicione outras colunas do 'colsToAdd' aqui se necessário no futuro
        // --------------------------------------------------------------------------------

        
        // [FIX] Libera o acesso APENAS quando tudo estiver pronto
        isDbSynced = true;
        console.log('✅ [SERVER] Sistema totalmente operacional.');
        startCronJobs();

    } catch (e) {
        console.error('❌ [DB SYNC] Erro crítico durante a aplicação de correções de schema:', e.message);
        // Em um cenário real, você poderia querer parar o servidor se o DB estiver inconsistente.
        // process.exit(1); 
    }

    if (process.env.NODE_ENV !== 'production') {
        console.log('🔄 Iniciando sincronização do Banco de Dados (DEV)...');
        // [REMOVIDO] A sincronização com 'alter: true' está causando o bug.
        // As correções manuais acima são mais seguras.
        // console.time('🗄️ Sequelize Sync');
        // await db.sequelize.sync({ alter: true }); 
        // console.timeEnd('🗄️ Sequelize Sync');
        console.log('✅ Sincronização de DEV concluída (usando correções manuais).');
    } else {
        // Em produção, não usamos sync() para evitar problemas. As correções manuais acima cuidam das alterações.
        console.log('✅ [DB SYNC] Conexão com banco de dados estabelecida (Modo Produção).');
    }

    // Se o servidor ainda não estiver ouvindo (caso o DB sync tenha sido muito rápido ou falhado)
    if (!server.listening) {
        server.listen(PORT, () => {
            console.log(`Servidor rodando na porta ${PORT}.`);
            console.timeEnd('⏱️ Tempo Total de Inicialização');
        });
    } else {
        console.timeEnd('⏱️ Tempo Total de Inicialização');
    }
};

startServer().catch(err => console.error('Falha ao iniciar o servidor:', err));
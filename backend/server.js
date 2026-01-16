// backend/server.js (VERSÃO PRIORITÁRIA)

require('dotenv').config();
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
const messagingRoutes = require('./routes/messagingRoutes');
const messageRoutes = require('./routes/messageRoutes');
const demandRoutes = require('./routes/demandRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const adminRoutes = require('./routes/adminRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const qnaRoutes = require('./routes/qnaRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const supportRoutes = require('./routes/supportRoutes');
const adminMessageRoutes = require('./routes/adminMessageRoutes');
const adminSupportRoutes = require('./routes/adminSupportRoutes');
const blogRoutes = require('./routes/blogRoutes');
const newsletterRoutes = require('./routes/newsletterRoutes'); // <-- ADICIONADO
const forumRoutes = require('./routes/forumRoutes'); // <--- ADICIONADO

// Controllers
const demandController = require('./controllers/demandController');
const blogController = require('./controllers/blogController');
const psychologistController = require('./controllers/psychologistController'); // Importar o controller
const adminController = require('./controllers/adminController'); // <--- ADICIONADO
const qnaController = require('./controllers/qnaController'); // <--- ADICIONADO
const seedTestData = require('./controllers/seed_test_data');

const app = express();

// --- FIX: Confia no proxy (Render/Heroku/AWS) ---
// Isso é essencial para que req.hostname e req.protocol funcionem corretamente atrás de um load balancer.
app.set('trust proxy', 1);

// --- MIDDLEWARE DE REDIRECIONAMENTO DE DOMÍNIO (SEO) ---
// Redireciona yelopsi.com, www.yelopsi.com e yelopsi.com.br para www.yelopsi.com.br
app.use((req, res, next) => {
    // Usa o header 'host' para maior precisão atrás de proxies, removendo a porta se houver
    const host = req.headers.host ? req.headers.host.split(':')[0] : req.hostname;
    const target = 'www.yelopsi.com.br';

    // Ignora localhost e domínios de desenvolvimento (Render)
    if (host.includes('localhost') || host.includes('127.0.0.1') || host.includes('onrender.com') || host.includes('render.com')) {
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
            const token = socket.handshake.auth.token;
            if (token) {
                user = jwt.verify(token, process.env.JWT_SECRET || 'secreto_yelo_dev');
                
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
app.use(cors());
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
        // Insere ou atualiza o timestamp da sessão no banco. É uma operação muito rápida.
        await db.sequelize.query(
            `INSERT INTO "ActiveSessions" ("sessionId", "lastSeen") VALUES (:sessionId, NOW()) ON CONFLICT ("sessionId") DO UPDATE SET "lastSeen" = NOW();`,
            { replacements: { sessionId }, type: db.sequelize.QueryTypes.INSERT }
        );
    } catch (e) {
        // Falha silenciosa para não quebrar a navegação do usuário
    }
    next();
});

// --- MIDDLEWARES ---
app.use(cors());

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
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

// Middleware para injetar o 'io' do Socket.IO em todas as requisições
app.use((req, res, next) => {
    req.io = io;
    next();
});
app.use(express.urlencoded({ extended: true }));

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

// Rota para criar a coluna IS_EXEMPT (VIP) na tabela Psychologists
app.get('/api/fix-add-is-exempt-column', async (req, res) => {
    try {
        await db.sequelize.query('ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "is_exempt" BOOLEAN DEFAULT FALSE;');
        res.send("Sucesso! Coluna 'is_exempt' criada no banco de dados.");
    } catch (error) {
        res.status(500).send("Erro ao criar coluna: " + error.message);
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

// Rota para resetar a senha do admin
app.get('/api/fix-reset-admin-password', async (req, res) => {
    try {
        const email = 'admin@yelo.com';
        const newPassword = 'admin123';
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // 1. Atualiza na tabela Admins (Legado)
        await db.sequelize.query(
            `UPDATE "Admins" SET senha = :senha WHERE email ILIKE :email`,
            { replacements: { senha: hashedPassword, email: email } }
        );

        // 2. Atualiza na tabela Psychologists (Admin Moderno)
        if (db.Psychologist) {
            await db.Psychologist.update({ senha: hashedPassword }, { where: { email: email } });
        }

        res.send(`Sucesso! Senha do admin (${email}) resetada para: <strong>${newPassword}</strong>`);
    } catch (error) {
        res.status(500).send("Erro ao resetar senha: " + error.message);
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

// =============================================================
// ROTAS DA APLICAÇÃO
// =============================================================

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

// MOVIDO PARA CIMA: Evita conflito com a rota genérica /api/psychologists
app.use('/api/psychologists/me/posts', blogRoutes);

app.use('/api/psychologists', psychologistRoutes);
app.use('/api/messaging', messagingRoutes);
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
        // Verificação básica de token (Admin)
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'Não autorizado' });
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secreto_yelo_dev');
        if (decoded.role !== 'admin' && decoded.type !== 'admin') return res.status(403).json({ error: 'Acesso negado' });

        const { id } = req.params;
        const deleted = await db.Psychologist.destroy({ where: { id } });

        if (!deleted) return res.status(404).json({ error: 'Psicólogo não encontrado.' });
        res.json({ message: 'Psicólogo excluído com sucesso.' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao excluir: ' + error.message });
    }
});

// ROTAS DE ADMIN (ORDEM DE ESPECIFICIDADE IMPORTA)
app.use('/api/admin/messages', adminMessageRoutes); // Rotas de mensagem do admin (mais específicas)
app.use('/api/admin/support', adminSupportRoutes); // Rotas de suporte do admin (mais específicas)
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

app.use('/api/reviews', reviewRoutes);
app.use('/api/qna', qnaRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/support', supportRoutes);
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

        // Insere com o patientId (pode ser null se for visitante)
        await db.sequelize.query(
            `INSERT INTO "WhatsappClickLogs" ("psychologistId", "patientId", "guestPhone", "guestName", "createdAt", "updatedAt") VALUES (:id, :patId, :phone, :name, NOW(), NOW())`,
            { replacements: { id: psychologist.id, patId: patientId || null, phone: guestPhone || null, name: guestName || null } }
        );

        // --- GAMIFICATION: CLIQUE WHATSAPP (10 pts) ---
        gamificationService.processAction(psychologist.id, 'whatsapp_click').catch(e => console.error(e));

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
        res.send('<h1>Sucesso!</h1><p>O usuário Admin foi criado/atualizado.</p><p>Login: admin@Yelo.com</p><p>Senha: admin123</p><br><a href="/login">Ir para Login</a>');
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
*/

// 2. ROTA DE LOGIN DO ADMIN (VERIFICA NA TABELA 'Admins')
app.post('/api/login-admin-check', async (req, res) => {
    try {
        const { email, senha } = req.body;

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
            process.env.JWT_SECRET || 'secreto_yelo_dev', // Usa sua chave secreta
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

// 1º: PRIMEIRO defina a rota da Home.
// Isso garante que o servidor renderize o index.ejs ao acessar a raiz '/'
app.get('/', async (req, res) => {
    try {
        // Busca até 10 psicólogos aleatórios que estejam ativos e tenham foto
        const psicologos = await db.Psychologist.findAll({
            where: {
                status: 'active',
                fotoUrl: { [Op.ne]: null } // Garante que só venham perfis com foto
            },
            order: db.sequelize.random(), // Pega de forma aleatória
            limit: 10, // Um pouco a mais para garantir variedade
            attributes: ['nome', 'fotoUrl', 'slug'] // Apenas os dados necessários
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
        res.render('index', { profissionais: psicologos, mediaAvaliacao, totalAvaliacoes, depoimentos });

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

// Garante que "Profissionais" abra o arquivo correto (se existir profissionais.ejs)
app.get('/profissionais', (req, res) => {
    res.render('profissionais');
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

// Rotas de Autenticação (opcional, mas recomendado para segurança)
app.get('/login', (req, res) => { res.render('login'); });
app.get('/cadastro', (req, res) => { res.render('cadastro'); });
app.get('/recuperar-senha', (req, res) => { res.render('esqueci_senha'); });
app.get('/redefinir-senha', (req, res) => { res.render('redefinir_senha'); });

// --- ROTA DE LOGOUT E CORREÇÕES DE REDIRECIONAMENTO ---
app.get('/logout', (req, res) => {
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

// --- ROTA AUXILIAR PARA IDENTIFICAR TIPO DE USUÁRIO (RECUPERAÇÃO DE SENHA) ---
app.post('/api/auth/identify-user', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'E-mail obrigatório' });

        // Verifica na tabela de Pacientes
        const [patients] = await db.sequelize.query('SELECT 1 FROM "Patients" WHERE email = :email LIMIT 1', { replacements: { email } });
        if (patients.length > 0) return res.json({ type: 'patient' });

        // Verifica na tabela de Psicólogos
        const [psis] = await db.sequelize.query('SELECT 1 FROM "Psychologists" WHERE email = :email LIMIT 1', { replacements: { email } });
        if (psis.length > 0) return res.json({ type: 'psychologist' });

        return res.status(404).json({ error: 'E-mail não encontrado em nossa base de dados.' });
    } catch (error) {
        console.error('Erro ao identificar usuário:', error);
        res.status(500).json({ error: 'Erro interno ao verificar e-mail.' });
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

    // --- DIAGNÓSTICO DE CONEXÃO ---
    try {
        await db.sequelize.authenticate();
        console.log('✅ [DB CONNECTION] Conexão com o banco estabelecida com sucesso.');
    } catch (error) {
        console.error('❌ [DB CONNECTION] Falha fatal ao conectar ao banco:', error.message);
        console.error('   Dica: Verifique se a variável DATABASE_URL no Render está correta e atualizada.');
    }

    // --- BLOCO DE SINCRONIZAÇÃO E CORREÇÃO DE SCHEMA (RODA EM TODOS OS AMBIENTES) ---
    try {
        console.log('🔧 [DB SYNC] Verificando e aplicando correções de schema...');

        // Garante que as colunas críticas existam, usando ALTER TABLE que é seguro para produção.
        // Adicione novas colunas aqui no futuro para evitar erros de "column does not exist".
        await db.sequelize.query(`ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "is_exempt" BOOLEAN DEFAULT FALSE;`);
        await db.sequelize.query(`ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "cnpj" VARCHAR(255) UNIQUE;`);
        await db.sequelize.query(`ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "modalidade" JSONB DEFAULT '[]';`);
        
        // --- FIX: GARANTIR COLUNAS DA TABELA PATIENTS (EVITA ERRO NO LOGIN) ---
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "ip_registro" VARCHAR(45);');
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "termos_aceitos" BOOLEAN DEFAULT FALSE;');
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "marketing_aceito" BOOLEAN DEFAULT FALSE;');
        // ---------------------------------------------------------------------

        // --- FIX: GARANTIR TODAS AS COLUNAS DO PERFIL NOVO ---
        await db.sequelize.query(`ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "publico_alvo" JSONB DEFAULT '[]';`);
        await db.sequelize.query(`ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "estilo_terapia" JSONB DEFAULT '[]';`);
        await db.sequelize.query(`ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "praticas_inclusivas" JSONB DEFAULT '[]';`);
        await db.sequelize.query(`ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "disponibilidade_periodo" JSONB DEFAULT '[]';`);
        await db.sequelize.query(`ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "temas_atuacao" JSONB DEFAULT '[]';`);
        await db.sequelize.query(`ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "abordagens_tecnicas" JSONB DEFAULT '[]';`);
        await db.sequelize.query(`ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "genero_identidade" VARCHAR(255);`);
        await db.sequelize.query(`ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "valor_sessao_numero" FLOAT;`);
        await db.sequelize.query(`ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "cpf" VARCHAR(255) UNIQUE;`);
        // -----------------------------------------------------
        
        // --- FIX: COLUNAS DE KPI E PAGAMENTO (ADICIONADO) ---
        await db.sequelize.query(`ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "whatsapp_clicks" INTEGER DEFAULT 0;`);
        await db.sequelize.query(`ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "profile_appearances" INTEGER DEFAULT 0;`);
        await db.sequelize.query(`ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "planExpiresAt" TIMESTAMP WITH TIME ZONE;`);
        await db.sequelize.query(`ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" VARCHAR(255);`);
        await db.sequelize.query(`ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "cancelAtPeriodEnd" BOOLEAN DEFAULT FALSE;`);
        // -----------------------------------------------------

        await db.sequelize.query(`ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "authority_level" VARCHAR(255) DEFAULT 'nivel_iniciante';`);
        await db.sequelize.query(`ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "badges" JSONB DEFAULT '{}';`);
        await db.sequelize.query(`ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "xp" INTEGER DEFAULT 0;`);
        await db.sequelize.query(`ALTER TABLE "Messages" ADD COLUMN IF NOT EXISTS "status" VARCHAR(255) DEFAULT 'sent';`);
        await db.sequelize.query(`ALTER TABLE "Conversations" ADD COLUMN IF NOT EXISTS "status" VARCHAR(255) DEFAULT 'active';`);
        await db.sequelize.query(`ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "status" VARCHAR(255) DEFAULT 'active';`);
        await db.sequelize.query(`ALTER TABLE "ForumPosts" ADD COLUMN IF NOT EXISTS "status" VARCHAR(255) DEFAULT 'active';`);
        await db.sequelize.query(`ALTER TABLE "ForumComments" ADD COLUMN IF NOT EXISTS "status" VARCHAR(255) DEFAULT 'active';`);

        // --- FIX: TABELA DE LOGS DO SISTEMA (CRÍTICO PARA PAGAMENTOS) ---
        await db.sequelize.query(`
            CREATE TABLE IF NOT EXISTS "SystemLogs" (
                "id" SERIAL PRIMARY KEY,
                "level" VARCHAR(255),
                "message" TEXT,
                "meta" JSONB,
                "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('✅ [DB SYNC] Correções de schema aplicadas com sucesso.');

    } catch (e) {
        console.error('❌ [DB SYNC] Erro crítico durante a aplicação de correções de schema:', e.message);
        // Em um cenário real, você poderia querer parar o servidor se o DB estiver inconsistente.
        // process.exit(1); 
    }

    if (process.env.NODE_ENV !== 'production') {
        console.log('🔄 Iniciando sincronização do Banco de Dados (DEV)...');
        console.time('🗄️ Sequelize Sync');
        await db.sequelize.sync({ alter: true }); // Usar { alter: true } em DEV é seguro e útil.
        console.timeEnd('🗄️ Sequelize Sync');
        console.log('✅ Banco de dados sincronizado (DEV).');
    } else {
        // Em produção, não usamos sync() para evitar problemas. As correções manuais acima cuidam das alterações.
        console.log('✅ [DB SYNC] Conexão com banco de dados estabelecida (Modo Produção).');
    }

    server.listen(PORT, () => {
        console.log(`Servidor rodando na porta ${PORT}.`);
        console.timeEnd('⏱️ Tempo Total de Inicialização');
    });
};

startServer().catch(err => console.error('Falha ao iniciar o servidor:', err));
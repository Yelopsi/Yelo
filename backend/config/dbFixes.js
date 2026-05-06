/**
 * Arquivo responsável por aplicar correções em tempo de execução e 
 * atualizações de schema no banco de dados. Isola os patches e "hacks" 
 * para manter o server.js limpo.
 */
const { DataTypes } = require('sequelize');

const applyDatabaseFixes = async (db, sequelize) => {
    try {
        console.log("🛠️ Verificando e aplicando correções estruturais (Modelos/Associações)...");

        // ==============================================================
        // 1. PATCH DE MODELOS E ASSOCIAÇÕES (Runtime Attributes)
        // ==============================================================
        
        // Garante que o campo 'status' seja retornado nas consultas GET (API)
        if (db.Message && !db.Message.rawAttributes.status) {
            db.Message.rawAttributes.status = { type: DataTypes.STRING, defaultValue: 'sent' };
            if (typeof db.Message.refreshAttributes === 'function') db.Message.refreshAttributes();
        }

        // Patch Psychologist Model
        if (db.Psychologist) {
            const attrs = db.Psychologist.rawAttributes;
            let patched = false;
            const colsToAdd = {
                planExpiresAt: DataTypes.DATE, stripeSubscriptionId: DataTypes.STRING,
                subscriptionId: DataTypes.STRING, cancelAtPeriodEnd: DataTypes.BOOLEAN,
                subscription_payments_count: DataTypes.INTEGER, dailySummaryTime: DataTypes.STRING,
                reminderHoursBefore: DataTypes.INTEGER, linkedin_url: DataTypes.STRING,
                instagram_url: DataTypes.STRING, facebook_url: DataTypes.STRING,
                tiktok_url: DataTypes.STRING, x_url: DataTypes.STRING,
                cep: DataTypes.STRING, cidade: DataTypes.STRING, estado: DataTypes.STRING,
                telefone: DataTypes.STRING, bio: DataTypes.TEXT, crpDocumentUrl: DataTypes.TEXT,
                resetPasswordToken: DataTypes.STRING, resetPasswordExpires: DataTypes.BIGINT,
                formacao_nivel: DataTypes.STRING, formacao_desc: DataTypes.TEXT
            };
            for (const [col, type] of Object.entries(colsToAdd)) {
                if (!attrs[col]) { attrs[col] = { type }; patched = true; }
            }
            if (patched && typeof db.Psychologist.refreshAttributes === 'function') db.Psychologist.refreshAttributes(); 
        }

        // Patch Patient Model
        if (db.Patient) {
            const attrs = db.Patient.rawAttributes;
            let patched = false;
            const colsToAdd = {
                sessionValue: DataTypes.FLOAT, status: DataTypes.STRING, observacoes: DataTypes.TEXT,
                psychologistId: DataTypes.INTEGER, valor_sessao_faixa: DataTypes.STRING,
                temas_buscados: DataTypes.JSONB, identidade_genero: DataTypes.STRING,
                faixa_etaria: DataTypes.STRING, idade: DataTypes.STRING, genero_profissional: DataTypes.STRING,
                abordagem_desejada: DataTypes.JSONB, praticas_afirmativas: DataTypes.JSONB,
                telefone: DataTypes.STRING, recebe_mensagens: { type: DataTypes.BOOLEAN, defaultValue: true },
                resetPasswordToken: DataTypes.STRING, resetPasswordExpires: DataTypes.BIGINT
            };
            for (const [col, definition] of Object.entries(colsToAdd)) {
                if (!attrs[col]) {
                    if (definition.type) { attrs[col] = definition; } else { attrs[col] = { type: definition }; }
                    patched = true;
                }
            }
            if (patched && typeof db.Patient.refreshAttributes === 'function') db.Patient.refreshAttributes(); 
        }

        // Patch WaitingList Model (Permite partial leads sem CRP)
        if (db.WaitingList && db.WaitingList.rawAttributes.crp) {
            db.WaitingList.rawAttributes.crp.allowNull = true;
            if (typeof db.WaitingList.refreshAttributes === 'function') db.WaitingList.refreshAttributes();
        }

        if (db.Answer && !db.Answer.rawAttributes.psychologistId) {
            db.Answer.rawAttributes.psychologistId = { type: DataTypes.INTEGER };
            if (typeof db.Answer.refreshAttributes === 'function') db.Answer.refreshAttributes();
        }
        
        // ==============================================================
        // 2. HOOKS GLOBAIS
        // ==============================================================
        
        // Desarquivamento Automático
        if (db.Message && db.Conversation) {
            db.Message.addHook('afterCreate', async (message) => {
                try {
                    if (message.senderType !== 'admin') {
                        await sequelize.query(`UPDATE "Conversations" SET "status" = 'active', "updatedAt" = NOW() WHERE "id" = :id`, { replacements: { id: message.conversationId } });
                    }
                } catch (e) { console.error("Erro no hook de desarquivamento:", e.message); }
            });
        }

        // Conversão de Leads (Outbound)
        if (db.Psychologist) {
            db.Psychologist.addHook('afterCreate', async (psychologist) => {
                try {
                    if (psychologist.telefone) {
                        const telefoneLimpo = psychologist.telefone.replace(/\D/g, '');
                        const phoneSuffix = telefoneLimpo.length > 10 && telefoneLimpo.startsWith('55') ? telefoneLimpo.substring(2) : telefoneLimpo;
                        await sequelize.query(`UPDATE "Leads" SET "status_funil" = 'Cadastrado', "updatedAt" = NOW() WHERE "telefone" LIKE :phone`, { replacements: { phone: `%${phoneSuffix}%` } });
                    }
                } catch (e) { console.error("Erro no hook de conversão de Lead:", e.message); }
            });
        }

        // ==============================================================
        // 3. EXECUÇÃO DE QUERIES DE SCHEMA (ALTER TABLE)
        // ==============================================================
        if (process.env.SKIP_SCHEMA_SYNC === 'true' || process.env.SKIP_SCHEMA_SYNC === true) {
            console.log('⏩ [DB SYNC] Verificação de schema pulada (SKIP_SCHEMA_SYNC=true). O servidor iniciará mais rápido.');
            return;
        }

        console.log('🔧 [DB SYNC] Verificando e aplicando correções de schema... (Pode demorar na primeira vez)');

        const runSchemaQuery = async (sql, successMsg) => {
            const retries = 5;
            for (let i = 0; i < retries; i++) {
                try {
                    await sequelize.query(sql, { logging: false });
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
                    if (!msg.includes('already exists') && !msg.includes('duplicate')) {
                        console.warn(`⚠️ [DB FIX SKIP] ${e.message}`);
                    }
                    return;
                }
            }
        };

        const schemaQueries = [
            // Psychologists
            `ALTER TABLE "Psychologists" 
                ADD COLUMN IF NOT EXISTS "fotoUrl" VARCHAR(500), ADD COLUMN IF NOT EXISTS "linkedin_url" VARCHAR(500),
                ADD COLUMN IF NOT EXISTS "instagram_url" VARCHAR(500), ADD COLUMN IF NOT EXISTS "facebook_url" VARCHAR(500),
                ADD COLUMN IF NOT EXISTS "tiktok_url" VARCHAR(500), ADD COLUMN IF NOT EXISTS "x_url" VARCHAR(500),
                ADD COLUMN IF NOT EXISTS "cep" VARCHAR(20), ADD COLUMN IF NOT EXISTS "cidade" VARCHAR(255),
                ADD COLUMN IF NOT EXISTS "estado" VARCHAR(50), ADD COLUMN IF NOT EXISTS "telefone" VARCHAR(255),
                ADD COLUMN IF NOT EXISTS "bio" TEXT, ADD COLUMN IF NOT EXISTS "crpDocumentUrl" TEXT,
                ADD COLUMN IF NOT EXISTS "is_exempt" BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS "cnpj" VARCHAR(255) UNIQUE,
                ADD COLUMN IF NOT EXISTS "modalidade" JSONB DEFAULT '[]', ADD COLUMN IF NOT EXISTS "dailySummaryTime" VARCHAR(5) DEFAULT '08:00',
                ADD COLUMN IF NOT EXISTS "reminderHoursBefore" INTEGER DEFAULT 24, ADD COLUMN IF NOT EXISTS "publico_alvo" JSONB DEFAULT '[]',
                ADD COLUMN IF NOT EXISTS "estilo_terapia" JSONB DEFAULT '[]', ADD COLUMN IF NOT EXISTS "praticas_inclusivas" JSONB DEFAULT '[]',
                ADD COLUMN IF NOT EXISTS "disponibilidade_periodo" JSONB DEFAULT '[]', ADD COLUMN IF NOT EXISTS "temas_atuacao" JSONB DEFAULT '[]',
                ADD COLUMN IF NOT EXISTS "abordagens_tecnicas" JSONB DEFAULT '[]', ADD COLUMN IF NOT EXISTS "praticas_vivencias" JSONB DEFAULT '[]',
                ADD COLUMN IF NOT EXISTS "genero_identidade" VARCHAR(255), ADD COLUMN IF NOT EXISTS "valor_sessao_numero" FLOAT,
                ADD COLUMN IF NOT EXISTS "cpf" VARCHAR(255) UNIQUE, ADD COLUMN IF NOT EXISTS "whatsapp_clicks" INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS "profile_appearances" INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS "planExpiresAt" TIMESTAMP WITH TIME ZONE,
                ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" VARCHAR(255), ADD COLUMN IF NOT EXISTS "cancelAtPeriodEnd" BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS "subscription_payments_count" INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS "resetPasswordToken" VARCHAR(255),
                ADD COLUMN IF NOT EXISTS "resetPasswordExpires" BIGINT, ADD COLUMN IF NOT EXISTS "authority_level" VARCHAR(255) DEFAULT 'nivel_iniciante',
                ADD COLUMN IF NOT EXISTS "badges" JSONB DEFAULT '{}', ADD COLUMN IF NOT EXISTS "remarketing_step" INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS "last_remarketing_at" TIMESTAMP WITH TIME ZONE, ADD COLUMN IF NOT EXISTS "utm_source" VARCHAR(255),
                ADD COLUMN IF NOT EXISTS "utm_medium" VARCHAR(255), ADD COLUMN IF NOT EXISTS "utm_campaign" VARCHAR(255),
                ADD COLUMN IF NOT EXISTS "xp" INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS "formacao_nivel" VARCHAR(255),
                ADD COLUMN IF NOT EXISTS "formacao_desc" TEXT;`,
            `ALTER TABLE "Psychologists" ALTER COLUMN "crp" DROP NOT NULL;`,
            
            // Patients
            `ALTER TABLE "Patients" 
                ADD COLUMN IF NOT EXISTS "fotoUrl" VARCHAR(500), ADD COLUMN IF NOT EXISTS "psychologistId" INTEGER,
                ADD COLUMN IF NOT EXISTS "faixa_etaria" VARCHAR(255), ADD COLUMN IF NOT EXISTS "idade" VARCHAR(255),
                ADD COLUMN IF NOT EXISTS "genero_profissional" VARCHAR(255), ADD COLUMN IF NOT EXISTS "abordagem_desejada" JSONB DEFAULT '[]',
                ADD COLUMN IF NOT EXISTS "praticas_afirmativas" JSONB DEFAULT '[]', ADD COLUMN IF NOT EXISTS "telefone" VARCHAR(255),
                ADD COLUMN IF NOT EXISTS "ip_registro" VARCHAR(45), ADD COLUMN IF NOT EXISTS "termos_aceitos" BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS "marketing_aceito" BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS "sessionValue" FLOAT DEFAULT 0,
                ADD COLUMN IF NOT EXISTS "status" VARCHAR(255) DEFAULT 'active', ADD COLUMN IF NOT EXISTS "observacoes" TEXT,
                ADD COLUMN IF NOT EXISTS "resetPasswordToken" VARCHAR(255), ADD COLUMN IF NOT EXISTS "utm_source" VARCHAR(255),
                ADD COLUMN IF NOT EXISTS "utm_medium" VARCHAR(255), ADD COLUMN IF NOT EXISTS "utm_campaign" VARCHAR(255),
                ADD COLUMN IF NOT EXISTS "valor_sessao_faixa" VARCHAR(255), ADD COLUMN IF NOT EXISTS "temas_buscados" JSONB DEFAULT '[]',
                ADD COLUMN IF NOT EXISTS "identidade_genero" VARCHAR(255), ADD COLUMN IF NOT EXISTS "recebe_mensagens" BOOLEAN DEFAULT TRUE,
                ADD COLUMN IF NOT EXISTS "resetPasswordExpires" BIGINT;`,
            `ALTER TABLE "Patients" ALTER COLUMN "email" DROP NOT NULL;`,

            // Outras
            `ALTER TABLE "Messages" ADD COLUMN IF NOT EXISTS "status" VARCHAR(255) DEFAULT 'sent';`,
            `ALTER TABLE "Conversations" ADD COLUMN IF NOT EXISTS "status" VARCHAR(255) DEFAULT 'active';`,
            `ALTER TABLE "ForumPosts" ADD COLUMN IF NOT EXISTS "status" VARCHAR(255) DEFAULT 'active';`,
            `ALTER TABLE "ForumPosts" ADD COLUMN IF NOT EXISTS "isPinned" BOOLEAN DEFAULT FALSE;`,
            `ALTER TABLE "ForumComments" ADD COLUMN IF NOT EXISTS "status" VARCHAR(255) DEFAULT 'active';`,
            `ALTER TABLE "SystemLogs" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;`,
            `ALTER TABLE "WaitingLists" ALTER COLUMN "crp" DROP NOT NULL;`,
            `CREATE TABLE IF NOT EXISTS "Expenses" ( "id" SERIAL PRIMARY KEY, "description" VARCHAR(255), "value" FLOAT, "date" DATE, "psychologistId" INTEGER, "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP );`,
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

        for (const sql of schemaQueries) {
            await runSchemaQuery(sql);
        }

        // JSONB Conversions
        const [tableInfo] = await sequelize.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Psychologists';`);
        const arrayColumns = ['temas_atuacao', 'abordagens_tecnicas', 'modalidade', 'publico_alvo', 'estilo_terapia', 'praticas_inclusivas', 'disponibilidade_periodo', 'praticas_vivencias'];

        for (const col of arrayColumns) {
            const colInfo = tableInfo.find(c => c.column_name === col);
            if (colInfo && colInfo.data_type === 'jsonb') continue;
            try { await runSchemaQuery(`ALTER TABLE "Psychologists" ALTER COLUMN "${col}" TYPE JSONB USING to_json("${col}"::text);`); } catch (e) {
                try { await runSchemaQuery(`ALTER TABLE "Psychologists" ALTER COLUMN "${col}" TYPE JSONB USING "${col}"::jsonb;`); } catch (e2) {}
            }
        }

        try { await runSchemaQuery(`ALTER TABLE "DemandSearches" ALTER COLUMN "searchParams" TYPE JSONB USING "searchParams"::text::jsonb;`); } catch (e) {}

        // queryInterface fallbacks
        const queryInterface = sequelize.getQueryInterface();
        const patientAttributes = await queryInterface.describeTable('Patients');
        if (!patientAttributes.fotoUrl) { await queryInterface.addColumn('Patients', 'fotoUrl', { type: DataTypes.STRING(500) }); }
        if (!patientAttributes.observacoes) { await queryInterface.addColumn('Patients', 'observacoes', { type: DataTypes.TEXT }); }
        if (!patientAttributes.sessionValue) { await queryInterface.addColumn('Patients', 'sessionValue', { type: DataTypes.FLOAT, defaultValue: 0 }); }
        if (!patientAttributes.recebe_mensagens) { await queryInterface.addColumn('Patients', 'recebe_mensagens', { type: DataTypes.BOOLEAN, defaultValue: true }); }
        
        const psyAttributes = await queryInterface.describeTable('Psychologists');
        if (!psyAttributes.fotoUrl) { await queryInterface.addColumn('Psychologists', 'fotoUrl', { type: DataTypes.STRING(500) }); }

        console.log('✅ [DB SYNC] Correções de schema aplicadas com sucesso.');
    } catch (error) {
        console.error("❌ Erro ao aplicar correções estruturais no banco de dados:", error);
        throw error;
    }
};

module.exports = applyDatabaseFixes;
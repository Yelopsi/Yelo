const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');
const { protect } = require('../middleware/authMiddleware'); // Importa o Middleware
const db = require('../models'); // Necessário para as queries diretas de favoritos

// Rota de Registro: /api/patients/register (Acesso Público)
router.post('/register', patientController.registerPatient);

// Rota de Login: /api/patients/login (Acesso Público)
router.post('/login', patientController.loginPatient);

// Rota de Login com Google: /api/patients/google (Acesso Público)
router.post('/google', patientController.googleLogin);

// Rota de Dados do Paciente Logado: /api/patients/me (Acesso PRIVADO)
// O middleware 'protect' é executado ANTES do controller. 
// Ele garante que o token JWT seja válido.
router.get('/me', protect, patientController.getPatientData);

// Rota para SALVAR as respostas do questionário (Acesso PRIVADO)
router.put('/answers', protect, patientController.updatePatientAnswers);

// Rota para ATUALIZAR os dados do paciente (Acesso PRIVADO)
router.put('/me', protect, patientController.updatePatientDetails);

// Rota para buscar as avaliações do paciente logado (Acesso PRIVADO)
router.get('/me/reviews', protect, patientController.getPatientReviews);

// --- ROTA DE DEBUG (VERIFICA COLUNAS DO BANCO) ---
router.get('/debug/columns', async (req, res) => {
    try {
        const [results] = await db.sequelize.query(`
            SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Psychologists';
        `);
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- ROTA DE DEBUG/CORREÇÃO (Execute uma vez se der erro de coluna) ---
router.get('/favorites/fix-schema', async (req, res) => {
    try {
        console.log('[DEBUG] Tentando recriar tabela PatientFavorites...');
        await db.sequelize.query('DROP TABLE IF EXISTS "PatientFavorites";');
        await ensureFavoritesTable();
        res.send('Tabela PatientFavorites recriada com sucesso! Tente favoritar agora.');
    } catch (error) {
        console.error('[DEBUG ERROR] Falha ao recriar tabela:', error);
        res.status(500).send('Erro ao recriar tabela: ' + error.message);
    }
});

// --- ROTAS DE FAVORITOS (CORREÇÃO PARA O DASHBOARD) ---

// Helper para garantir tabela e evitar erros 500
const ensureFavoritesTable = async () => {
    try {
        // 1. Cria a tabela se não existir
        await db.sequelize.query(`
            CREATE TABLE IF NOT EXISTS "PatientFavorites" (
                "id" SERIAL PRIMARY KEY,
                "PatientId" INTEGER NOT NULL,
                "PsychologistId" INTEGER NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                "deletedAt" TIMESTAMP WITH TIME ZONE -- [ESTRATÉGICO] Coluna para Soft Delete
            );
        `);

        // 2. Garante explicitamente que o índice único existe (Crucial para o ON CONFLICT funcionar)
        await db.sequelize.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "patient_favorites_unique_idx" 
            ON "PatientFavorites" ("PatientId", "PsychologistId");
        `);

        // 3. Garante a coluna deletedAt se a tabela já existia antes
        await db.sequelize.query(`ALTER TABLE "PatientFavorites" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP WITH TIME ZONE;`);

    } catch (e) {
        console.error("Erro ao criar tabela PatientFavorites:", e);
    }
};

// 1. GET /favorites (Lista os favoritos)
router.get('/favorites', protect, async (req, res) => {
    try {
        // Tenta obter o ID de várias formas (req.user, req.patient ou req.userId)
        const patientId = (req.user && req.user.id) || (req.patient && req.patient.id) || req.userId;
        
        if (!patientId) {
            return res.status(401).json({ error: 'Usuário não identificado.' });
        }

        console.log(`[DEBUG GET FAVORITES] Buscando favoritos para Patient ID: ${patientId}`);
        
        await ensureFavoritesTable();

        // Busca os favoritos com os dados do psicólogo (JOIN)
        // CORREÇÃO: Aspas em TODAS as colunas do Psicólogo para evitar erro de case-sensitive
        const [results] = await db.sequelize.query(`
            SELECT 
                p."id", p."nome", p."crp", p."fotoUrl", p."slug", 
                p."abordagens_tecnicas", p."valor_sessao_numero", p."temas_atuacao"
            FROM "PatientFavorites" pf
            JOIN "Psychologists" p ON pf."PsychologistId" = p."id"
            WHERE pf."PatientId" = :patientId AND pf."deletedAt" IS NULL
        `, { replacements: { patientId } });

        res.json(results);
    } catch (error) {
        console.error('[DEBUG ERROR] Erro ao buscar favoritos:', error.original || error);
        // Envia o erro detalhado para o frontend (para debug)
        res.status(500).json({ error: 'Erro SQL: ' + (error.original?.message || error.message) });
    }
});

// 2. POST /favorites (Adicionar favorito)
router.post('/favorites', protect, async (req, res) => {
    try {
        const patientId = (req.user && req.user.id) || (req.patient && req.patient.id) || req.userId;
        const { psychologistId } = req.body;

        if (!patientId) {
            return res.status(401).json({ error: 'Usuário não identificado.' });
        }
        
        console.log(`[DEBUG POST FAVORITES] Adicionando: Patient ${patientId} -> Psi ${psychologistId}`);

        await ensureFavoritesTable();

        // LÓGICA DE VERIFICAÇÃO MANUAL (Mais robusta que ON CONFLICT)
        const [existing] = await db.sequelize.query(`SELECT 1 FROM "PatientFavorites" WHERE "PatientId" = :patientId AND "PsychologistId" = :psiId`, {
            replacements: { patientId, psiId: psychologistId }
        });

        if (existing.length > 0) {
            // [ESTRATÉGICO] Se já existe (mesmo deletado), reativamos (Soft Undelete)
            await db.sequelize.query(`
                UPDATE "PatientFavorites" 
                SET "deletedAt" = NULL, "updatedAt" = NOW() 
                WHERE "PatientId" = :patientId AND "PsychologistId" = :psiId
            `, { replacements: { patientId, psiId: psychologistId } });
            
            return res.json({ message: 'Adicionado aos favoritos novamente', favorited: true });
        }

        await db.sequelize.query(`
            INSERT INTO "PatientFavorites" ("PatientId", "PsychologistId") VALUES (:patientId, :psiId);
        `, { replacements: { patientId, psiId: psychologistId } });

        res.json({ message: 'Adicionado aos favoritos', favorited: true });
    } catch (error) {
        console.error('[DEBUG ERROR] Erro ao adicionar favorito:', error);
        res.status(500).json({ error: 'Erro ao salvar favorito' });
    }
});

// 3. DELETE /favorites/:id (Remover favorito)
router.delete('/favorites/:id', protect, async (req, res) => {
    try {
        const patientId = (req.user && req.user.id) || (req.patient && req.patient.id) || req.userId;
        const psychologistId = req.params.id;

        if (!patientId) {
            return res.status(401).json({ error: 'Usuário não identificado.' });
        }
        
        console.log(`[DEBUG DELETE FAVORITES] Removendo: Patient ${patientId} -> Psi ${psychologistId}`);

        await ensureFavoritesTable();

        // [ESTRATÉGICO] Mudamos de DELETE para UPDATE (Soft Delete)
        await db.sequelize.query(`
            UPDATE "PatientFavorites" SET "deletedAt" = NOW()
            WHERE "PatientId" = :patientId AND "PsychologistId" = :psiId
        `, { replacements: { patientId, psiId: psychologistId } });

        res.json({ message: 'Removido dos favoritos', favorited: false });
    } catch (error) {
        console.error('[DEBUG ERROR] Erro ao remover favorito:', error);
        res.status(500).json({ error: 'Erro ao remover favorito' });
    }
});

// 4. CHECK /favorites/check/:id (Verificar se já é favorito)
router.get('/favorites/check/:id', protect, async (req, res) => {
    try {
        const patientId = (req.user && req.user.id) || (req.patient && req.patient.id) || req.userId;
        const psychologistId = req.params.id;

        if (!patientId) {
            return res.status(401).json({ error: 'Usuário não identificado.' });
        }

        console.log(`[DEBUG CHECK FAVORITES] Verificando: Patient ${patientId} -> Psi ${psychologistId}`);

        await ensureFavoritesTable();

        const [results] = await db.sequelize.query(`
            SELECT 1 FROM "PatientFavorites" 
            WHERE "PatientId" = :patientId AND "PsychologistId" = :psiId AND "deletedAt" IS NULL LIMIT 1
        `, { replacements: { patientId, psiId: psychologistId } });

        res.json({ isFavorited: results.length > 0 });
    } catch (error) {
        console.error('[DEBUG ERROR] Erro ao verificar favorito:', error);
        res.status(500).json({ error: 'Erro ao verificar favorito' });
    }
});

// --- ROTAS LEGADO (Compatibilidade com patient.js) ---
// Redireciona a lógica para usar a nova tabela PatientFavorites

router.get('/me/favorites', protect, async (req, res) => {
    // Reutiliza a lógica da rota GET /favorites
    try {
        const patientId = (req.user && req.user.id) || (req.patient && req.patient.id) || req.userId;
        await ensureFavoritesTable();
        const [results] = await db.sequelize.query(`
            SELECT p."id", p."nome", p."crp", p."fotoUrl", p."slug", 
                p."abordagens_tecnicas", p."valor_sessao_numero", p."temas_atuacao"
            FROM "PatientFavorites" pf
            JOIN "Psychologists" p ON pf."PsychologistId" = p."id"
            WHERE pf."PatientId" = :patientId AND pf."deletedAt" IS NULL
        `, { replacements: { patientId } });
        res.json(results);
    } catch (error) {
        console.error('[DEBUG ERROR LEGADO] Erro ao buscar favoritos:', error);
        res.status(500).json({ error: 'Erro ao buscar favoritos (legado)' });
    }
});

router.put('/me/favorites', protect, async (req, res) => {
    // Lógica de Toggle (Adicionar/Remover)
    try {
        const patientId = (req.user && req.user.id) || (req.patient && req.patient.id) || req.userId;
        const { psychologistId } = req.body;
        await ensureFavoritesTable();

        // Verifica se já existe
        const [existing] = await db.sequelize.query(`
            SELECT "deletedAt" FROM "PatientFavorites" WHERE "PatientId" = :pid AND "PsychologistId" = :sid LIMIT 1
        `, { replacements: { pid: patientId, sid: psychologistId } });

        if (existing.length > 0) {
            const isDeleted = existing[0].deletedAt !== null;
            // Se existe e não está deletado -> Deleta (Soft)
            // Se existe e está deletado -> Restaura
            const novoStatus = isDeleted ? 'NULL' : 'NOW()';
            await db.sequelize.query(`UPDATE "PatientFavorites" SET "deletedAt" = ${novoStatus} WHERE "PatientId" = :pid AND "PsychologistId" = :sid`, { replacements: { pid: patientId, sid: psychologistId } });
            res.json({ message: 'Removido dos favoritos', favorited: false });
        } else {
            // Adiciona
            await db.sequelize.query(`INSERT INTO "PatientFavorites" ("PatientId", "PsychologistId", "createdAt", "updatedAt") VALUES (:pid, :sid, NOW(), NOW())`, 
                { replacements: { pid: patientId, sid: psychologistId } });
            res.json({ message: 'Adicionado aos favoritos', favorited: true });
        }
    } catch (error) {
        console.error("Erro toggle favorito:", error);
        res.status(500).json({ error: 'Erro ao atualizar favorito' });
    }
});

// Rota para alterar a senha do paciente (Acesso PRIVADO)
router.put('/me/password', protect, patientController.updatePatientPassword);

// Rota para EXCLUIR a conta do paciente (Acesso PRIVADO)
router.delete('/me', protect, patientController.deletePatientAccount);

module.exports = router;

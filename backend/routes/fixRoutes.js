const express = require('express');
const router = express.Router();
const fixController = require('../utils/fixController');
const db = require('../models'); // Importado para queries inline de correção

// =============================================================
// 🚨 ROTAS DE EMERGÊNCIA (DESATIVADAS PARA PRODUÇÃO) 🚨
// =============================================================

// Bloqueio global para as rotas de correção em produção
if (process.env.NODE_ENV === 'production') {
    router.use([/^\/api\/fix-.*/, /^\/fix-.*/, /^\/api\/debug-.*/, /^\/api\/run-.*/], (req, res) => res.status(403).json({ error: 'Rotas de manutenção e diagnóstico desativadas em produção por segurança.' }));
}

router.get('/api/fix-activate-psis', fixController.activatePsis);
router.get('/fix-db-columns', fixController.fixDbColumns);
router.get('/api/fix-vip-all', fixController.fixVipAll);
router.get('/api/fix-reset-payment', fixController.fixResetPayment);

// --- ROTA DE DIAGNÓSTICO PROFUNDO (DEBUG) ---
router.get('/api/debug-juliana', fixController.debugJuliana);

// --- ROTA DE LIMPEZA: APAGA PERMANENTEMENTE OS SOFT DELETES ---
router.get('/api/fix-clean-soft-deleted', fixController.cleanSoftDeleted);

// --- ROTA DE CORREÇÃO: ENVIAR CONVITE PARA TODOS DA LISTA DE ESPERA E LIMPAR ---
router.get('/api/run-invite-all-waitlist', fixController.runInviteAllWaitlist);

// --- ROTA DE CORREÇÃO: LIMPAR TODA A LISTA DE ESPERA ---
router.get('/api/run-clear-waitlist', fixController.runClearWaitlist);

// --- ROTA DE CORREÇÃO: VER QUEM FOI CONVIDADO MAS O E-MAIL FALHOU E RESETAR ---
router.get('/api/fix-reset-failed-invites', fixController.resetFailedInvites);

// --- ROTA DE DISPARO DE E-MAIL (14 DIAS) PARA PSICÓLOGOS ANTIGOS ---
router.get('/api/run-notify-trial', fixController.runNotifyTrial);

// --- ROTA DE ERRATA: AVISO DE CORREÇÃO DO BUG "EXPIRADO" ---
router.get('/api/disparar-errata-trial', fixController.dispararErrataTrial);

// --- ROTA DE AUDITORIA: BLOQUEIA PERFIS QUE BURLARAM O PAGAMENTO ---
router.get('/api/run-inadimplentes', fixController.runInadimplentes);

// Rota para criar a coluna CNPJ se ela não existir
router.get('/api/fix-add-cnpj-column', fixController.addCnpjColumn);

// Rota para criar a coluna MODALIDADE (Online/Presencial)
router.get('/api/fix-add-modalidade-column', fixController.addModalidadeColumn);

// --- ROTA DE EMERGÊNCIA: ESTENDER ASSINATURA ---
router.get('/api/fix-extend-plan', fixController.extendPlan);

// Rota para converter um psicólogo em Criador de Conteúdo (Invisível)
router.get('/api/fix-make-content-creator', fixController.makeContentCreator);

// --- ROTA DE CORREÇÃO: CRIAR TABELAS DE KPI (DASHBOARD) ---
router.get('/api/fix-create-kpi-tables', fixController.createKpiTables);

// Rota para criar a coluna IS_EXEMPT (VIP) na tabela Psychologists
router.get('/api/fix-add-is-exempt-column', fixController.addIsExemptColumn);

// Rota para criar a coluna fotoUrl (EMERGÊNCIA)
router.get('/api/fix-add-foto-url', fixController.addFotoUrl);

// Rota para criar a coluna STATUS na tabela Conversations (CORREÇÃO DO CHAT)
router.get('/api/fix-add-conversation-status', fixController.addConversationStatus);

// Rota para criar a coluna STATUS na tabela Messages (CORREÇÃO DO CHAT)
router.get('/api/fix-add-message-status', fixController.addMessageStatus);

// ROTA DE CORREÇÃO: Conserta o histórico (started -> completed)
router.get('/api/fix-status-completed', fixController.fixStatusCompleted);

// Rota para criar colunas de inteligência na tabela SiteVisits
router.get('/api/fix-add-analytics-columns', fixController.addAnalyticsColumns);

// Rota para converter a coluna de JSON para JSONB (necessário para o índice GIN)
router.get('/api/fix-json-to-jsonb', fixController.jsonToJsonb);

// Rota para criar índices GIN para acelerar buscas em JSONB
router.get('/api/fix-add-jsonb-indexes', fixController.addJsonbIndexes);

// Rota para criar colunas de AUDITORIA na tabela Patients (LGPD/Segurança)
router.get('/api/fix-patient-audit', fixController.fixPatientAudit);

// --- FIX: ROTA MANUAL PARA CRIAR COLUNAS DE SENHA ---
router.get('/api/fix-password-columns', fixController.fixPasswordColumns);

// Rota para corrigir tabela de Admins (Adicionar colunas faltantes)
router.get('/api/fix-admin-table', fixController.fixAdminTable);

// --- ROTA DE CORREÇÃO: ATRIBUI BADGES DE PIONEIRO RETROATIVAMENTE ---
router.get('/api/fix-assign-pioneer-badges', fixController.assignPioneerBadges);

// Rota para criar a coluna CURTIDAS na tabela posts
router.get('/api/fix-add-likes-column', fixController.addLikesColumn);

// Rota de DEBUG para listar todas as colunas da tabela Psychologists
router.get('/api/debug/check-schema', fixController.debugCheckSchema);

// Rota para criar a tabela de Newsletter
router.get('/api/fix-add-newsletter-table', fixController.addNewsletterTable);

// Rota para criar a tabela de Leads (Prospecção Outbound)
router.get('/api/fix-create-leads-table', fixController.createLeadsTable);

// Rota para criar índice na tabela de posts (acelera "Meus Artigos")
router.get('/api/fix-add-post-index', fixController.addPostIndex);

// --- ROTA DE LIMPEZA DE CONTEÚDO (BLOG E FÓRUM) ---
router.get('/api/fix-clear-content', fixController.clearContent);

// --- ROTA DE LIMPEZA DE PERGUNTAS DA COMUNIDADE (Q&A) ---
router.get('/api/fix-clear-qna', fixController.clearQna);

// --- ROTA DE RESET DE GAMIFICAÇÃO ---
router.get('/api/fix-reset-gamification', fixController.resetGamification);

// --- ROTA DE TESTE DE EMAIL (NOVO) ---
router.get('/api/fix-test-email', fixController.testEmail);

// --- ROTA DE EMERGÊNCIA: CORRIGIR TABELA DE PACIENTES MANUALMENTE ---
router.get('/api/fix-patients-schema-manual', fixController.fixPatientsSchemaManual);

// --- ROTA DE EMERGÊNCIA: CORRIGIR E-MAIL NULO (PACIENTES) ---
router.get('/api/fix-email-null', fixController.fixEmailNull);

// --- ROTA DE CORREÇÃO FINANCEIRA (MANUAL) ---
router.get('/api/fix-financial-tables', fixController.fixFinancialTables);

// --- ROTA DE CORREÇÃO: TABELA DE PACIENTES ---
router.get('/api/fix-patient-table', fixController.fixPatientTable);

module.exports = router;

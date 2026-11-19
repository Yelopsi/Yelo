// backend/controllers/adminCopilotController.js
const crypto = require('crypto');
const db = require('../models');
const AdminCopilotService = require('../services/adminCopilotService');
const PsychologistContextService = require('../services/psychologistContextService');
const CopilotMemoryService = require('../services/copilotMemoryService');
const CopilotInsightsService = require('../services/copilotInsightsService');
const CopilotFollowUpService = require('../services/copilotFollowUpService');

/**
 * Cache em memória para rajadas simultâneas (concorrência), complementado na Fase 1
 * por deduplicação persistente via `inputHash` em `AdminCopilotConversations`.
 */
const inFlightRespondMap = new Map();
const recentRespondCache = new Map();
const RECENT_DEDUP_TTL_MS = 10000;
const MAX_RESPOND_CACHE_ENTRIES = 50;

function pruneRecentCache() {
    const now = Date.now();
    for (const [k, v] of recentRespondCache.entries()) {
        if (!v || v.expiresAt <= now) {
            recentRespondCache.delete(k);
        }
    }
    while (recentRespondCache.size > MAX_RESPOND_CACHE_ENTRIES) {
        const oldestKey = recentRespondCache.keys().next().value;
        if (oldestKey === undefined) break;
        recentRespondCache.delete(oldestKey);
    }
}

function formatCandidate(c) {
    if (!c) return null;
    const entityType = c.entityType || 'psychologist';
    let statusLabel = c.status || null;
    if (entityType === 'psychologist') {
        const sub = AdminCopilotService.computeSubscriptionSummary(c);
        statusLabel = sub?.badgeLabel || c.status || null;
    } else if (entityType === 'lead') {
        statusLabel = c.status_funil ? `Lead (${c.status_funil})` : 'Lead Comercial';
    } else if (entityType === 'waiting_list') {
        statusLabel = `Lista de Espera (${c.status || 'pending'})`;
    }
    return {
        id: c.id,
        entityType,
        entityKey: PsychologistContextService.makeEntityKey(entityType, c.id, c.telefone),
        nome: c.nome,
        crp: c.crp || null,
        cidade: c.cidade || null,
        estado: c.estado || null,
        plano: c.plano || (entityType === 'lead' ? 'Lead' : entityType === 'waiting_list' ? 'Lista de Espera' : null),
        status: c.status || c.status_funil || null,
        fotoUrl: c.fotoUrl || null,
        statusLabel
    };
}

/**
 * Rota: POST /api/admin/copilot/identify
 */
exports.identifyFromChat = async (req, res) => {
    try {
        const { pastedChat, psychologistId, entityType: reqEntityType, entityId: reqEntityId } = req.body || {};
        if (!pastedChat && !psychologistId && !reqEntityId) {
            return res.status(400).json({ error: 'Texto da conversa ou ID do profissional não fornecido.' });
        }

        let parseResult = { detectedSender: null, cleanName: null, detectedPhone: null, candidateSenders: [], parsedMessages: [] };
        let resolution = { psychologist: null, entity: null, entityType: null, entityId: null, entityKey: null, candidates: [], ambiguous: false, status: 'not_found', matchReason: 'not_found' };

        const manualTargetId = reqEntityId || psychologistId;
        if (manualTargetId) {
            const parsedId = parseInt(manualTargetId, 10);
            const targetType = ['psychologist', 'lead', 'waiting_list'].includes(reqEntityType) ? reqEntityType : 'psychologist';
            if (!Number.isNaN(parsedId)) {
                const dossier = await AdminCopilotService.buildDossier({ entityType: targetType, entityId: parsedId });
                return res.json({
                    entityType: dossier ? targetType : null,
                    entityId: dossier ? parsedId : null,
                    entityKey: dossier?.entityKey || null,
                    status: dossier ? 'confirmed' : 'not_found',
                    detectedSender: null,
                    cleanName: null,
                    detectedPhone: null,
                    ambiguous: false,
                    candidates: [],
                    matchReason: dossier ? 'manual_id' : 'not_found',
                    psychologist: dossier && targetType === 'psychologist' ? dossier.profile : null,
                    dossier
                });
            }
        }

        if (pastedChat && typeof pastedChat === 'string') {
            parseResult = AdminCopilotService.parsePastedChat(pastedChat);
            if (parseResult.cleanName || parseResult.detectedPhone || pastedChat.trim()) {
                resolution = await AdminCopilotService.findPsychologist(parseResult.cleanName, pastedChat, parseResult);
            }
        }

        if (resolution.ambiguous) {
            return res.json({
                entityType: null,
                entityId: null,
                entityKey: null,
                status: 'identity_review',
                detectedSender: parseResult.detectedSender,
                cleanName: parseResult.cleanName,
                detectedPhone: parseResult.detectedPhone,
                ambiguous: true,
                candidates: (resolution.candidates || []).map(formatCandidate),
                matchReason: resolution.matchReason,
                psychologist: null,
                dossier: null
            });
        }

        let dossier = null;
        if (resolution.entityType && (resolution.entityId || resolution.entityKey)) {
            dossier = await AdminCopilotService.buildDossier({
                entityType: resolution.entityType,
                entityId: resolution.entityId,
                entityKey: resolution.entityKey,
                entity: resolution.entity
            });
        }

        return res.json({
            entityType: resolution.entityType || null,
            entityId: resolution.entityId || null,
            entityKey: resolution.entityKey || null,
            status: resolution.status || (dossier ? 'confirmed' : 'not_found'),
            detectedSender: parseResult.detectedSender,
            cleanName: parseResult.cleanName,
            detectedPhone: parseResult.detectedPhone,
            ambiguous: false,
            candidates: [],
            matchReason: resolution.matchReason,
            psychologist: dossier && resolution.entityType === 'psychologist' ? dossier.profile : null,
            dossier
        });
    } catch (err) {
        console.error('Erro em identifyFromChat:', err.message);
        await AdminCopilotService.logTelemetry('error', `[Copilot] Erro identifyFromChat: ${err.message}`, { module: 'copilot' });
        return res.status(500).json({ error: 'Erro ao identificar profissional no chat.' });
    }
};

/**
 * Rota: POST /api/admin/copilot/respond
 */
exports.generateResponse = async (req, res) => {
    try {
        const {
            pastedChat,
            manualPsiId,
            entityType: reqEntityType,
            entityId: reqEntityId,
            tone,
            mode,
            extension,
            selectionSource,
            regenerate,
            orientation,
            adminInstruction,
            threadId: reqThreadId
        } = req.body || {};
        if (!pastedChat || typeof pastedChat !== 'string' || !pastedChat.trim()) {
            return res.status(400).json({ error: 'Texto da conversa não fornecido.' });
        }
        const effectiveInstruction = (adminInstruction || orientation || '').toString().trim();

        const rawManualId = reqEntityId || manualPsiId;
        const parsedManualId = rawManualId ? parseInt(rawManualId, 10) : null;
        const manualEntityType = ['psychologist', 'lead', 'waiting_list'].includes(reqEntityType) ? reqEntityType : 'psychologist';

        const parseResult = AdminCopilotService.parsePastedChat(pastedChat);
        const resolution = await AdminCopilotService.findPsychologist(parseResult.cleanName, pastedChat, parseResult);

        let targetEntityType = null;
        let targetEntityId = null;
        let targetEntityKey = null;
        let targetPreloadedEntity = null;
        let detectedName = parseResult.detectedSender || parseResult.cleanName;

        if (selectionSource === 'manual' && parsedManualId) {
            const strongSenderMatch = resolution.psychologist &&
                ['feedback_token', 'header_phone', 'name', 'name_exact'].includes(resolution.matchReason) &&
                !(manualEntityType === 'psychologist' && resolution.psychologist.id === parsedManualId);

            if (strongSenderMatch) {
                return res.status(409).json({
                    error: 'O profissional selecionado manualmente diverge do remetente identificado na conversa. Confirme quem é o destinatário correto antes de gerar.',
                    identityConflict: true,
                    ambiguous: true,
                    candidates: [formatCandidate(resolution.psychologist)]
                });
            }
            targetEntityType = manualEntityType;
            targetEntityId = parsedManualId;
            targetEntityKey = PsychologistContextService.makeEntityKey(targetEntityType, targetEntityId);
        } else {
            if (resolution.ambiguous) {
                return res.status(409).json({
                    error: 'Não foi possível confirmar com segurança um único profissional para esta conversa. Confirme abaixo antes de gerar.',
                    ambiguous: true,
                    candidates: (resolution.candidates || []).map(formatCandidate)
                });
            }
            if (resolution.entityType) {
                targetEntityType = resolution.entityType;
                targetEntityId = resolution.entityId || null;
                targetEntityKey = resolution.entityKey || PsychologistContextService.makeEntityKey(targetEntityType, targetEntityId, parseResult.detectedPhone);
                targetPreloadedEntity = resolution.entity || null;
            }
        }

        const targetPsiId = targetEntityType === 'psychologist' ? targetEntityId : null;
        const normalizedTone = ['natural', 'comercial', 'tecnico'].includes(tone) ? tone : 'natural';
        const isRegenerate = Boolean(regenerate);
        const dedupKey = crypto
            .createHash('sha256')
            .update(JSON.stringify({
                adminId: req.user?.id || 'anon',
                chat: pastedChat.trim(),
                entityType: targetEntityType || null,
                entityKey: targetEntityKey || null,
                selectionSource: selectionSource === 'manual' ? 'manual' : 'auto',
                tone: normalizedTone,
                mode: mode || null,
                extension: extension || 'padrao',
                orientation: effectiveInstruction
            }))
            .digest('hex');

        const flightKey = isRegenerate ? `${dedupKey}:regen` : dedupKey;

        if (!isRegenerate) {
            pruneRecentCache();
            if (inFlightRespondMap.has(flightKey)) {
                const sharedResult = await inFlightRespondMap.get(flightKey);
                return res.status(sharedResult.statusCode || 200).json({ ...sharedResult.payload, deduped: true });
            }
            const recent = recentRespondCache.get(dedupKey);
            if (recent && recent.expiresAt > Date.now()) {
                return res.status(recent.statusCode || 200).json({ ...recent.payload, deduped: true });
            }
        } else if (inFlightRespondMap.has(flightKey)) {
            const sharedRegen = await inFlightRespondMap.get(flightKey);
            return res.status(sharedRegen.statusCode || 200).json({ ...sharedRegen.payload, deduped: true });
        }

        const workPromise = (async () => {
            let dossier = null;
            if (targetEntityType && (targetEntityId || targetEntityKey)) {
                dossier = await AdminCopilotService.buildDossier({
                    entityType: targetEntityType,
                    entityId: targetEntityId,
                    entityKey: targetEntityKey,
                    entity: targetPreloadedEntity
                });
                if (!dossier && targetEntityType === 'psychologist') {
                    return {
                        statusCode: 404,
                        payload: { error: 'O profissional selecionado não foi encontrado ou foi excluído do sistema.' }
                    };
                }
                if (dossier?.profile?.nome) {
                    detectedName = dossier.profile.nome;
                }
            }

            // Idempotência persistente via inputHash (evita re-gastar tokens no Gemini após restart no Render)
            if (!isRegenerate && req.user?.id) {
                try {
                    const [dupRows] = await db.sequelize.query(`
                        SELECT id, "aiResponse", "structuredOutput", "operationMode", "promptVersion", "threadId", "createdAt"
                        FROM "AdminCopilotConversations"
                        WHERE "inputHash" = :inputHash
                          AND ("adminId" = :adminId OR "adminId" IS NULL)
                          AND "createdAt" >= NOW() - INTERVAL '10 minutes'
                        ORDER BY id DESC
                        LIMIT 1;
                    `, { replacements: { inputHash: dedupKey, adminId: req.user.id } });
                    const existingTurn = dupRows?.[0];
                    if (existingTurn && existingTurn.aiResponse) {
                        const existingStructured = typeof existingTurn.structuredOutput === 'string'
                            ? JSON.parse(existingTurn.structuredOutput)
                            : existingTurn.structuredOutput;
                        return {
                            statusCode: 200,
                            payload: {
                                success: true,
                                deduped: true,
                                aiResponse: existingTurn.aiResponse,
                                structuredOutput: existingStructured || null,
                                promptVersion: existingTurn.promptVersion || null,
                                operationMode: existingTurn.operationMode || null,
                                detectedPsychologist: dossier,
                                entityType: targetEntityType,
                                entityId: targetEntityId,
                                entityKey: targetEntityKey,
                                threadId: existingTurn.threadId || null,
                                conversationId: existingTurn.id,
                                persistenceWarning: false,
                                meta: { dedupedFromDb: true }
                            }
                        };
                    }
                } catch (_) {}
            }

            const aiResult = await AdminCopilotService.generateResponse({
                pastedChat,
                dossier,
                tone: normalizedTone,
                mode,
                extension,
                adminInstruction: effectiveInstruction
            });

            const aiResponse = typeof aiResult === 'string' ? aiResult : aiResult.text;
            const structuredOutput = aiResult?.structuredOutput || null;
            const promptVersion = aiResult?.promptVersion || null;
            const operationMode = aiResult?.operationMode || 'resposta';
            const interactionCategory = structuredOutput?.interactionCategory || null;
            const sanitizedChat = typeof aiResult === 'string' ? pastedChat : aiResult.sanitizedChat;
            const aiMeta = typeof aiResult === 'string' ? {} : (aiResult.meta || {});
            const messageHashes = AdminCopilotService.computeMessageHashes(parseResult.parsedMessages);

            // Reaproveita thread recente da mesma entidade (continuidade entre sessões) ou gera novo UUID
            let resolvedThreadId = reqThreadId || null;
            if (!resolvedThreadId && targetEntityType && targetEntityKey) {
                try {
                    const [prevThread] = await db.sequelize.query(`
                        SELECT "threadId", "messageHashes"
                        FROM "AdminCopilotConversations"
                        WHERE "entityType" = :entityType
                          AND "entityKey" = :entityKey
                          AND "threadId" IS NOT NULL
                          AND "createdAt" >= NOW() - INTERVAL '7 days'
                        ORDER BY id DESC
                        LIMIT 1;
                    `, { replacements: { entityType: targetEntityType, entityKey: targetEntityKey } });
                    if (prevThread?.[0]?.threadId) {
                        resolvedThreadId = prevThread[0].threadId;
                    }
                } catch (_) {}
            }
            if (!resolvedThreadId) {
                resolvedThreadId = crypto.randomUUID();
            }

            const snapshotJson = JSON.stringify({
                entityType: targetEntityType || null,
                plano: dossier?.profile?.plano || null,
                status: dossier?.profile?.status || null,
                financialStatus: dossier?.subscriptionSummary?.financialStatus || null,
                visibilityStatus: dossier?.subscriptionSummary?.visibilityStatus || null,
                valor_sessao: dossier?.profile?.valor_sessao_numero || null,
                whatsapp_clicks: dossier?.profile?.whatsapp_clicks || 0,
                profile_appearances: dossier?.profile?.profile_appearances || 0,
                model: aiMeta.modelUsed || null,
                promptVersion,
                operationMode,
                interactionCategory,
                pricingSource: aiMeta.pricingSource || null,
                hadRedactions: Boolean(aiMeta.hadRedactions),
                transcriptTruncated: Boolean(aiMeta.transcriptTruncated)
            });

            let savedRecord = null;
            let persistenceWarning = false;
            try {
                const [record] = await db.sequelize.query(`
                    INSERT INTO "AdminCopilotConversations"
                    ("psychologistId", "detectedName", "rawPastedChat", "aiResponse", "contextSnapshot",
                     "threadId", "entityType", "entityId", "entityKey", "operationMode", "interactionCategory",
                     "structuredOutput", "promptVersion", "inputHash", "messageHashes", "adminId",
                     "createdAt", "updatedAt")
                    VALUES
                    (:psiId, :name, :chat, :response, :snapshot,
                     :threadId, :entityType, :entityId, :entityKey, :operationMode, :interactionCategory,
                     CAST(:structuredOutput AS jsonb), :promptVersion, :inputHash, CAST(:messageHashes AS jsonb), :adminId,
                     NOW(), NOW())
                    RETURNING id, "createdAt";
                `, {
                    replacements: {
                        psiId: targetPsiId || null,
                        name: detectedName || 'Desconhecido',
                        chat: sanitizedChat || pastedChat,
                        response: aiResponse || '[REQUER REVISÃO]',
                        snapshot: snapshotJson,
                        threadId: resolvedThreadId,
                        entityType: targetEntityType || 'psychologist',
                        entityId: targetEntityId || null,
                        entityKey: targetEntityKey || null,
                        operationMode,
                        interactionCategory,
                        structuredOutput: JSON.stringify(structuredOutput || {}),
                        promptVersion,
                        inputHash: dedupKey,
                        messageHashes: JSON.stringify(messageHashes),
                        adminId: req.user?.id || null
                    }
                });
                savedRecord = record && record[0];
            } catch (dbErr) {
                try {
                    const [legacyRecord] = await db.sequelize.query(`
                        INSERT INTO "AdminCopilotConversations" 
                        ("psychologistId", "detectedName", "rawPastedChat", "aiResponse", "contextSnapshot", "createdAt", "updatedAt")
                        VALUES (:psiId, :name, :chat, :response, :snapshot, NOW(), NOW())
                        RETURNING id, "createdAt";
                    `, {
                        replacements: {
                            psiId: targetPsiId || null,
                            name: detectedName || 'Desconhecido',
                            chat: sanitizedChat || pastedChat,
                            response: aiResponse || '[REQUER REVISÃO]',
                            snapshot: snapshotJson
                        }
                    });
                    savedRecord = legacyRecord && legacyRecord[0];
                } catch (legacyErr) {
                    persistenceWarning = true;
                    console.warn('Aviso ao persistir AdminCopilotConversations:', legacyErr.message);
                    await AdminCopilotService.logTelemetry('warn', `[Copilot] Falha ao persistir conversa: ${legacyErr.message}`, {
                        module: 'copilot',
                        psychologistId: targetPsiId || null
                    });
                }
            }

            if (targetEntityType && targetEntityKey && !persistenceWarning && aiResponse) {
                const lastMsg = Array.isArray(parseResult.parsedMessages) && parseResult.parsedMessages.length > 0
                    ? parseResult.parsedMessages[parseResult.parsedMessages.length - 1].body
                    : pastedChat.slice(-120);
                await PsychologistContextService.updateMemoryDeterministic({
                    entityType: targetEntityType,
                    entityId: targetEntityId,
                    entityKey: targetEntityKey,
                    dossier,
                    aiResponse,
                    lastUserSnippet: lastMsg
                });
            }

            return {
                statusCode: 200,
                payload: {
                    success: true,
                    aiResponse,
                    structuredOutput,
                    promptVersion,
                    operationMode,
                    interactionCategory,
                    detectedPsychologist: dossier,
                    entityType: targetEntityType,
                    entityId: targetEntityId,
                    entityKey: targetEntityKey,
                    threadId: resolvedThreadId,
                    conversationId: savedRecord?.id || null,
                    persistenceWarning,
                    meta: aiMeta
                }
            };
        })();

        inFlightRespondMap.set(flightKey, workPromise);
        try {
            const result = await workPromise;
            if (result.statusCode === 200 && result.payload?.success && !isRegenerate) {
                pruneRecentCache();
                recentRespondCache.set(dedupKey, { ...result, expiresAt: Date.now() + RECENT_DEDUP_TTL_MS });
            }
            return res.status(result.statusCode).json(result.payload);
        } finally {
            inFlightRespondMap.delete(flightKey);
        }
    } catch (err) {
        console.error('Erro em generateResponse:', err.message);
        const statusCode = err.statusCode || (err.isPrivacyBlock || err.isOutputGuardBlock ? 422 : 500);
        return res.status(statusCode).json({
            error: (err.isPrivacyBlock || err.isOutputGuardBlock || statusCode === 504)
                ? err.message
                : ('Erro ao gerar resposta da IA: ' + err.message),
            privacyBlocked: Boolean(err.isPrivacyBlock)
        });
    }
};

exports.getHistory = async (req, res) => {
    try {
        const [rows] = await db.sequelize.query(`
            SELECT 
                c.id, c."psychologistId", c."detectedName",
                LEFT(COALESCE(c."aiResponse", ''), 600) AS "aiResponse",
                c."createdAt", c."entityType", c."entityId", c."threadId", c."operationMode",
                p.nome as psi_nome, p."fotoUrl", p.plano, p.status as psi_status, p."deletedAt" as psi_deleted_at
            FROM "AdminCopilotConversations" c
            LEFT JOIN "Psychologists" p ON p.id = c."psychologistId"
            ORDER BY c."createdAt" DESC
            LIMIT 15;
        `).catch(() => db.sequelize.query(`
            SELECT 
                c.id, c."psychologistId", c."detectedName",
                LEFT(COALESCE(c."aiResponse", ''), 600) AS "aiResponse",
                c."createdAt",
                p.nome as psi_nome, p."fotoUrl", p.plano, p.status as psi_status, p."deletedAt" as psi_deleted_at
            FROM "AdminCopilotConversations" c
            LEFT JOIN "Psychologists" p ON p.id = c."psychologistId"
            ORDER BY c."createdAt" DESC
            LIMIT 15;
        `));

        return res.json({ conversations: rows || [] });
    } catch (err) {
        console.error('Erro em getHistory:', err.message);
        return res.status(500).json({ error: 'Erro ao buscar histórico do copilot.' });
    }
};

exports.searchPsychologists = async (req, res) => {
    try {
        const query = (req.query.q || '').trim();
        if (!query || query.length < 2) return res.json({ psychologists: [] });

        const normQ = query
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();

        const digits = query.replace(/\D/g, '');
        const normCol = "translate(lower(nome), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')";

        const [rows] = await db.sequelize.query(`
            SELECT id, nome, email, telefone, plano, status, "fotoUrl", "crp",
                   "is_exempt", "cancelAtPeriodEnd", "profile_paused", "canceledAt", "firstPaidAt",
                   "planExpiresAt", "subscriptionId", "subscription_payments_count"
            FROM "Psychologists"
            WHERE "deletedAt" IS NULL
              AND (
                ${normCol} LIKE :normQ 
                OR email ILIKE :q 
                ${digits.length >= 4 ? "OR REGEXP_REPLACE(COALESCE(telefone, ''), '\\D', '', 'g') LIKE :digits" : ''}
              )
            ORDER BY (CASE WHEN status = 'active' THEN 1 ELSE 0 END) DESC, id DESC
            LIMIT 10;
        `, { replacements: { normQ: `%${normQ}%`, q: `%${query}%`, digits: `%${digits}%` } });

        const psychologists = (rows || []).map(r => {
            const sub = AdminCopilotService.computeSubscriptionSummary(r);
            return { ...r, statusLabel: sub?.badgeLabel || r.status };
        });

        return res.json({ psychologists });
    } catch (err) {
        console.error('Erro em searchPsychologists:', err.message);
        return res.status(500).json({ error: 'Erro ao buscar psicólogos.' });
    }
};

exports.getConversationById = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

        const [rows] = await db.sequelize.query(`
            SELECT id, "psychologistId", "detectedName", "rawPastedChat", "aiResponse",
                   "finalReply", "structuredOutput", "operationMode", "interactionCategory",
                   "feedbackStatus", "entityType", "entityId", "entityKey", "threadId", "promptVersion", "createdAt"
            FROM "AdminCopilotConversations"
            WHERE id = :id
            LIMIT 1;
        `, { replacements: { id } }).catch(() => db.sequelize.query(`
            SELECT id, "psychologistId", "detectedName", "rawPastedChat", "aiResponse", "createdAt"
            FROM "AdminCopilotConversations"
            WHERE id = :id
            LIMIT 1;
        `, { replacements: { id } }));

        const conv = rows?.[0];
        if (!conv) return res.status(404).json({ error: 'Atendimento não encontrado.' });

        let dossier = null;
        const eType = conv.entityType || (conv.psychologistId ? 'psychologist' : null);
        const eId = conv.entityId || conv.psychologistId || null;
        if (eType && (eId || conv.entityKey)) {
            dossier = await AdminCopilotService.buildDossier({
                entityType: eType,
                entityId: eId,
                entityKey: conv.entityKey
            }).catch(() => null);
        }

        const structured = typeof conv.structuredOutput === 'string'
            ? JSON.parse(conv.structuredOutput || 'null')
            : (conv.structuredOutput || null);

        return res.json({
            conversation: {
                ...conv,
                structuredOutput: structured
            },
            dossier
        });
    } catch (err) {
        console.error('Erro em getConversationById:', err.message);
        return res.status(500).json({ error: 'Erro ao restaurar atendimento.' });
    }
};

exports.submitFeedback = async (req, res) => {
    try {
        const { conversationId, feedbackStatus, finalReply, rejectionReason, isLibraryExample } = req.body || {};
        const result = await CopilotMemoryService.recordFeedback({
            conversationId,
            feedbackStatus,
            finalReply,
            rejectionReason,
            isLibraryExample
        });
        return res.json(result);
    } catch (err) {
        console.error('Erro em submitFeedback:', err.message);
        return res.status(err.statusCode || 500).json({ error: err.message || 'Erro ao registrar feedback.' });
    }
};

exports.runDiagnosis = async (req, res) => {
    try {
        const { psychologistId } = req.body || {};
        const diagnosis = await CopilotInsightsService.runOnDemandDiagnosis(psychologistId);
        if (!diagnosis) {
            return res.status(404).json({ error: 'Profissional não encontrado para diagnóstico.' });
        }
        return res.json({ success: true, diagnosis });
    } catch (err) {
        console.error('Erro em runDiagnosis:', err.message);
        return res.status(500).json({ error: 'Erro ao gerar diagnóstico CS sob demanda.' });
    }
};

exports.createBacklogDraft = async (req, res) => {
    try {
        const { title, category, notes, psychologistId } = req.body || {};
        const cleanTitle = String(title || '').trim();
        if (!cleanTitle) {
            return res.status(400).json({ error: 'Título da sugestão ou bug é obrigatório.' });
        }
        if (!db.AdminAdjustment || typeof db.AdminAdjustment.create !== 'function') {
            return res.status(503).json({ error: 'Módulo de Backlog indisponível.' });
        }

        const noteParts = [String(notes || '').trim()];
        if (psychologistId) noteParts.push(`Origem: Copilot WhatsApp (Psicólogo ID ${psychologistId})`);
        const item = await db.AdminAdjustment.create({
            title: cleanTitle.slice(0, 220),
            target_page: 'Copilot WhatsApp',
            category: category || 'Melhoria',
            environment: 'admin',
            device: 'todos',
            priority: 'media',
            status: 'pendente',
            notes: noteParts.filter(Boolean).join('\n\n')
        });

        return res.status(201).json({ success: true, adjustment: item });
    } catch (err) {
        console.error('Erro em createBacklogDraft:', err.message);
        return res.status(500).json({ error: 'Erro ao criar item no Backlog.' });
    }
};

exports.getCollectiveInsights = async (req, res) => {
    try {
        const forceRefresh = req.query.refresh === 'true';
        const insights = await CopilotInsightsService.getCollectiveInsights({ forceRefresh });
        return res.json({ success: true, insights });
    } catch (err) {
        console.error('Erro em getCollectiveInsights:', err.message);
        return res.status(500).json({ error: 'Erro ao carregar insights coletivos.' });
    }
};

exports.listFollowUps = async (req, res) => {
    try {
        const { psychologistId, status, futureOnly, limit } = req.query || {};
        const followUps = await CopilotFollowUpService.listFollowUps({
            psychologistId: psychologistId || null,
            status: status || 'scheduled',
            futureOnly: String(futureOnly) === 'true',
            limit: limit || 30
        });
        return res.json({ success: true, followUps });
    } catch (err) {
        console.error('Erro em listFollowUps:', err.message);
        return res.status(err.statusCode || 500).json({ error: err.message || 'Erro ao listar follow-ups.' });
    }
};

exports.createFollowUp = async (req, res) => {
    try {
        const {
            psychologistId,
            conversationId,
            parentFollowUpId,
            subType,
            reason,
            contextSummary,
            dueAt,
            dueInDays,
            autoSchedulePerformanceEval,
            evaluationDelayDays
        } = req.body || {};

        const result = await CopilotFollowUpService.createFollowUp({
            psychologistId,
            conversationId,
            parentFollowUpId,
            subType,
            reason,
            contextSummary,
            dueAt,
            dueInDays,
            autoSchedulePerformanceEval,
            evaluationDelayDays,
            adminId: req.user?.id || null
        });

        return res.status(result.deduped ? 200 : 201).json({
            success: true,
            followUp: result.followUp,
            deduped: Boolean(result.deduped)
        });
    } catch (err) {
        console.error('Erro em createFollowUp:', err.message);
        return res.status(err.statusCode || 500).json({ error: err.message || 'Erro ao agendar follow-up.' });
    }
};

exports.updateFollowUp = async (req, res) => {
    try {
        const { dueAt, reason, status, evaluationDelayDays, autoSchedulePerformanceEval } = req.body || {};
        const followUp = await CopilotFollowUpService.updateFollowUp({
            id: req.params.id,
            dueAt,
            reason,
            status,
            evaluationDelayDays,
            autoSchedulePerformanceEval
        });
        return res.json({ success: true, followUp });
    } catch (err) {
        console.error('Erro em updateFollowUp:', err.message);
        return res.status(err.statusCode || 500).json({ error: err.message || 'Erro ao atualizar follow-up.' });
    }
};

exports.generateFollowUpMessage = async (req, res) => {
    try {
        const { psychologistId } = req.body || {};
        const result = await CopilotFollowUpService.generateFollowUpWhatsAppMessage({
            followUpId: req.params.id,
            psychologistId: psychologistId || null
        });
        return res.json({ success: true, ...result });
    } catch (err) {
        console.error('Erro em generateFollowUpMessage:', err.message);
        return res.status(err.statusCode || 500).json({ error: err.message || 'Erro ao gerar mensagem de follow-up.' });
    }
};

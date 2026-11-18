// backend/services/copilotMemoryService.js
const db = require('../models');
const PsychologistContextService = require('./psychologistContextService');

const PEJORATIVE_LABELS = [
    /\b(?:chato|problem[aá]tico|folgado|incompetente|burro|mentiroso|pregui[cç]oso|desonesto|trouxa|ot[aá]rio)\b/i
];

function anonymizeTextForLibrary(text, knownNames = []) {
    if (!text || typeof text !== 'string') return '';
    let out = text
        .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '[CPF]')
        .replace(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, '[CNPJ]')
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
        .replace(/(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\d{4}[-\s]?\d{4}|\d{4}[-\s]?\d{4})/g, '[TELEFONE]')
        .replace(/\bCRP[\s:.-]*\d{2}[\/\-]?\d{3,6}\b/gi, '[CRP]');

    for (const rawName of knownNames) {
        const clean = String(rawName || '').trim();
        if (clean.length >= 3) {
            const parts = clean.split(/\s+/).filter(p => p.length >= 3);
            for (const part of parts) {
                const escaped = part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                out = out.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), '[NOME]');
            }
        }
    }
    return out.trim();
}

function mergeUniqueShortList(existingArr, incomingArr, maxItems = 6, maxLen = 140) {
    const base = Array.isArray(existingArr) ? [...existingArr] : [];
    const seen = new Set(base.map(x => String(x || '').toLowerCase().trim()));
    for (const item of (Array.isArray(incomingArr) ? incomingArr : [])) {
        const clean = String(item || '').replace(/\s+/g, ' ').trim().slice(0, maxLen);
        if (!clean) continue;
        if (PEJORATIVE_LABELS.some(re => re.test(clean))) continue;
        const key = clean.toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            base.push(clean);
        }
    }
    return base.slice(-maxItems);
}

class CopilotMemoryService {
    static anonymizeTextForLibrary(text, knownNames = []) {
        return anonymizeTextForLibrary(text, knownNames);
    }

    static containsPejorativeLabel(text) {
        return PEJORATIVE_LABELS.some(re => re.test(String(text || '')));
    }

    /**
     * Recupera até 2 exemplos curtos aprovados e anonimizados via PostgreSQL FTS / categoria.
     * Retorna string vazia imediatamente quando COPILOT_LEARNING_ENABLED=false ou amostra < 3 exemplos.
     */
    static async getApprovedExamplesBlock({ interactionCategory = null, pastedChat = '' } = {}) {
        if (process.env.COPILOT_LEARNING_ENABLED === 'false') return '';
        try {
            const [countRows] = await db.sequelize.query(`
                SELECT COUNT(*) as total
                FROM "AdminCopilotConversations"
                WHERE "isLibraryExample" = true
                  AND "feedbackStatus" IN ('approved', 'edited');
            `).catch(() => [[{ total: 0 }]]);

            const totalExamples = parseInt(countRows?.[0]?.total || 0, 10);
            if (totalExamples < 3) return '';

            const queryWords = String(pastedChat || '')
                .replace(/[^\p{L}\p{N}\s]/gu, ' ')
                .split(/\s+/)
                .filter(w => w.length >= 4)
                .slice(0, 6)
                .join(' ');

            let rows = [];
            if (queryWords) {
                const [ftsRows] = await db.sequelize.query(`
                    SELECT c.id, c."interactionCategory",
                           LEFT(COALESCE(c."finalReply", c."aiResponse"), 240) AS reply_sample,
                           c."detectedName",
                           ts_rank(c."searchVector", plainto_tsquery('portuguese', :q)) AS rank
                    FROM "AdminCopilotConversations" c
                    WHERE c."isLibraryExample" = true
                      AND c."feedbackStatus" IN ('approved', 'edited')
                      AND (c."interactionCategory" = :cat OR :cat IS NULL)
                      AND (c."searchVector" IS NULL OR c."searchVector" @@ plainto_tsquery('portuguese', :q))
                    ORDER BY rank DESC NULLS LAST, c.id DESC
                    LIMIT 2;
                `, { replacements: { q: queryWords, cat: interactionCategory } }).catch(() => [[]]);
                rows = ftsRows || [];
            }

            if (rows.length === 0 && interactionCategory) {
                const [catRows] = await db.sequelize.query(`
                    SELECT id, "interactionCategory",
                           LEFT(COALESCE("finalReply", "aiResponse"), 240) AS reply_sample,
                           "detectedName"
                    FROM "AdminCopilotConversations"
                    WHERE "isLibraryExample" = true
                      AND "feedbackStatus" IN ('approved', 'edited')
                      AND "interactionCategory" = :cat
                    ORDER BY id DESC
                    LIMIT 2;
                `, { replacements: { cat: interactionCategory } }).catch(() => [[]]);
                rows = catRows || [];
            }

            if (!rows || rows.length === 0) return '';

            const lines = rows.map((r, idx) => {
                const anon = anonymizeTextForLibrary(r.reply_sample, [r.detectedName]);
                return `Exemplo ${idx + 1}: "${anon}"`;
            });
            return `EXEMPLOS DE ESTILO APROVADOS (referência de tom, não copiar literalmente):\n${lines.join('\n')}`;
        } catch (err) {
            console.warn('[CopilotMemoryService] Falha ao recuperar exemplos aprovados:', err.message);
            return '';
        }
    }

    /**
     * Registra feedback humano (approved / edited / rejected) e consolida recomendações/compromissos
     * em AdminCopilotMemories SOMENTE quando approved ou edited (nunca polui com rejeitados/rascunhos).
     */
    static async recordFeedback({ conversationId, feedbackStatus, finalReply = null, rejectionReason = null, isLibraryExample = false }) {
        if (!conversationId) {
            const err = new Error('conversationId é obrigatório.');
            err.statusCode = 400;
            throw err;
        }
        const validStatuses = ['approved', 'edited', 'rejected'];
        if (!validStatuses.includes(feedbackStatus)) {
            const err = new Error('feedbackStatus inválido (use approved, edited ou rejected).');
            err.statusCode = 400;
            throw err;
        }

        const [convRows] = await db.sequelize.query(`
            SELECT id, "psychologistId", "entityType", "entityId", "entityKey", "detectedName",
                   "rawPastedChat", "aiResponse", "structuredOutput", "interactionCategory"
            FROM "AdminCopilotConversations"
            WHERE id = :id
            LIMIT 1;
        `, { replacements: { id: conversationId } });

        const conv = convRows?.[0];
        if (!conv) {
            const err = new Error('Atendimento não encontrado.');
            err.statusCode = 404;
            throw err;
        }

        const cleanFinalReply = finalReply ? String(finalReply).trim() : null;
        const safeLibraryFlag = Boolean(isLibraryExample && feedbackStatus !== 'rejected');
        const replyForIndex = cleanFinalReply || conv.aiResponse || '';
        const anonSampleForFts = anonymizeTextForLibrary(`${conv.rawPastedChat || ''} ${replyForIndex}`, [conv.detectedName]);

        await db.sequelize.query(`
            UPDATE "AdminCopilotConversations"
            SET "feedbackStatus" = :status,
                "finalReply" = COALESCE(:finalReply, "finalReply"),
                "rejectionReason" = :rejectionReason,
                "isLibraryExample" = :isLib,
                "searchVector" = to_tsvector('portuguese', :ftsText),
                "updatedAt" = NOW()
            WHERE id = :id;
        `, {
            replacements: {
                id: conversationId,
                status: feedbackStatus,
                finalReply: cleanFinalReply,
                rejectionReason: rejectionReason ? String(rejectionReason).slice(0, 120) : null,
                isLib: safeLibraryFlag,
                ftsText: anonSampleForFts.slice(0, 4000)
            }
        }).catch(async () => {
            // Fallback se searchVector ainda não existir
            await db.sequelize.query(`
                UPDATE "AdminCopilotConversations"
                SET "feedbackStatus" = :status,
                    "finalReply" = COALESCE(:finalReply, "finalReply"),
                    "rejectionReason" = :rejectionReason,
                    "isLibraryExample" = :isLib,
                    "updatedAt" = NOW()
                WHERE id = :id;
            `, {
                replacements: {
                    id: conversationId,
                    status: feedbackStatus,
                    finalReply: cleanFinalReply,
                    rejectionReason: rejectionReason ? String(rejectionReason).slice(0, 120) : null,
                    isLib: safeLibraryFlag
                }
            });
        });

        // Regras de governança: rejected NUNCA grava recomendações/compromissos em AdminCopilotMemories
        const eType = conv.entityType || (conv.psychologistId ? 'psychologist' : null);
        const eId = conv.entityId || conv.psychologistId || null;
        const eKey = conv.entityKey || (eId ? `id:${eId}` : null);

        if (feedbackStatus !== 'rejected' && eType && eKey) {
            const structured = typeof conv.structuredOutput === 'string'
                ? JSON.parse(conv.structuredOutput || '{}')
                : (conv.structuredOutput || {});
            const updates = structured.memoryUpdates || {};
            const pending = structured.suggestedPendingItems || [];

            try {
                const [memRows] = await db.sequelize.query(`
                    SELECT id, "confirmedFacts", "recommendationsGiven", "commitments", "pendingItems", "topicsHistory"
                    FROM "AdminCopilotMemories"
                    WHERE "entityType" = :entityType AND "entityKey" = :entityKey
                    LIMIT 1;
                `, { replacements: { entityType: eType, entityKey: eKey } }).catch(() => [[]]);

                const mem = memRows?.[0];
                const facts = mergeUniqueShortList(mem?.confirmedFacts, updates.newFacts, 6);
                const recs = mergeUniqueShortList(mem?.recommendationsGiven, updates.newRecommendations, 6);
                const commits = mergeUniqueShortList(mem?.commitments, updates.commitments, 6);
                const pendings = mergeUniqueShortList(mem?.pendingItems, pending, 6);
                const topics = mergeUniqueShortList(mem?.topicsHistory, conv.interactionCategory ? [conv.interactionCategory] : [], 8, 64);

                if (mem?.id) {
                    await db.sequelize.query(`
                        UPDATE "AdminCopilotMemories"
                        SET "confirmedFacts" = CAST(:facts AS jsonb),
                            "recommendationsGiven" = CAST(:recs AS jsonb),
                            "commitments" = CAST(:commits AS jsonb),
                            "pendingItems" = CAST(:pendings AS jsonb),
                            "topicsHistory" = CAST(:topics AS jsonb),
                            "lastInteractionAt" = NOW(),
                            "updatedAt" = NOW()
                        WHERE id = :id;
                    `, {
                        replacements: {
                            id: mem.id,
                            facts: JSON.stringify(facts),
                            recs: JSON.stringify(recs),
                            commits: JSON.stringify(commits),
                            pendings: JSON.stringify(pendings),
                            topics: JSON.stringify(topics)
                        }
                    });
                } else {
                    await db.sequelize.query(`
                        INSERT INTO "AdminCopilotMemories"
                            ("entityType", "entityKey", "entityId", "confirmedFacts", "recommendationsGiven", "commitments", "pendingItems", "topicsHistory", "lastInteractionAt", "createdAt", "updatedAt")
                        VALUES
                            (:entityType, :entityKey, :entityId, CAST(:facts AS jsonb), CAST(:recs AS jsonb), CAST(:commits AS jsonb), CAST(:pendings AS jsonb), CAST(:topics AS jsonb), NOW(), NOW(), NOW())
                        ON CONFLICT ("entityType", "entityKey")
                        DO UPDATE SET
                            "confirmedFacts" = EXCLUDED."confirmedFacts",
                            "recommendationsGiven" = EXCLUDED."recommendationsGiven",
                            "commitments" = EXCLUDED."commitments",
                            "pendingItems" = EXCLUDED."pendingItems",
                            "topicsHistory" = EXCLUDED."topicsHistory",
                            "lastInteractionAt" = NOW(),
                            "updatedAt" = NOW();
                    `, {
                        replacements: {
                            entityType: eType,
                            entityKey: eKey,
                            entityId: eId,
                            facts: JSON.stringify(facts),
                            recs: JSON.stringify(recs),
                            commits: JSON.stringify(commits),
                            pendings: JSON.stringify(pendings),
                            topics: JSON.stringify(topics)
                        }
                    });
                }

                PsychologistContextService.invalidateCache(eType, eKey);
            } catch (memErr) {
                console.warn('[CopilotMemoryService] Falha não-crítica ao consolidar memória aprovada:', memErr.message);
            }
        }

        return {
            success: true,
            conversationId,
            feedbackStatus,
            isLibraryExample: safeLibraryFlag
        };
    }
}

module.exports = CopilotMemoryService;

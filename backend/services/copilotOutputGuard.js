// backend/services/copilotOutputGuard.js
const { formatForWhatsApp } = require('../utils/whatsappFormatter');
const { INTERACTION_CATEGORIES } = require('./copilotPromptBuilder');

const LEAK_PATTERNS = [
    /VERIFIED_SYSTEM_DATA/i,
    /ADMIN_INSTRUCTION/i,
    /untrusted_whatsapp_transcript/i,
    /REGRAS CR[IÍ]TICAS/i,
    /postgres(?:ql)?:\/\//i,
    /\b(?:sk_live|sk_test|AIza)[A-Za-z0-9_-]{16,}\b/,
    /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/,
    /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/
];

const INTERNAL_TERM_LEAKS_IN_REPLY = [
    /\brisco de cancelamento\b/i,
    /\bchurn\b/i,
    /\bscore de risco\b/i
];

const FORBIDDEN_PROMISES = [
    /\bgaranto\s+(?:que\s+voc[êe]\s+vai\s+fechar|no\s+m[ií]nimo)\s+\d+\s+pacientes/i,
    /\bisen[cç][aã]o\s+vital[ií]cia\b/i,
    /\b100%\s+gratuito\s+para\s+sempre\b/i,
    /\bvou\s+liberar\s+(?:um\s+)?desconto\s+de\s+\d+%/i
];

const FOLLOWUP_SUBTYPES = ['promessa_retorno', 'ajuste_perfil', 'negociacao_copilot', 'aviso_novidade'];

const FOLLOWUP_FALLBACK_DAYS = {
    ajuste_perfil: 5,
    negociacao_copilot: 4,
    promessa_retorno: 15,
    aviso_novidade: 30
};

function getTodayBrtYmd(date = new Date()) {
    try {
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(date);
    } catch (_) {
        return date.toISOString().slice(0, 10);
    }
}

function addDaysBrtYmd(days = 5) {
    const num = Math.min(365, Math.max(1, parseInt(days, 10) || 5));
    const todayYmd = getTodayBrtYmd(new Date());
    const [y, m, d] = todayYmd.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + num, 12, 0, 0));
    return getTodayBrtYmd(dt);
}

class CopilotOutputGuard {
    static normalizeSuggestedFollowUp(rawFollowUp, context = {}) {
        if (!rawFollowUp || typeof rawFollowUp !== 'object' || !rawFollowUp.shouldCreate) {
            return null;
        }
        const dossier = context.dossier;
        if (!dossier || dossier.entityType !== 'psychologist' || !dossier.profile?.id) {
            return null;
        }

        const subType = FOLLOWUP_SUBTYPES.includes(rawFollowUp.subType)
            ? rawFollowUp.subType
            : 'negociacao_copilot';
        const reason = String(rawFollowUp.reason || '').replace(/\s+/g, ' ').trim().slice(0, 240);
        if (!reason) {
            return null;
        }
        const contextSummary = String(rawFollowUp.contextSummary || '').trim().slice(0, 800);

        const todayYmd = getTodayBrtYmd(new Date());
        let dueDateIso = null;
        if (typeof rawFollowUp.dueDateIso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawFollowUp.dueDateIso.trim())) {
            const candidate = rawFollowUp.dueDateIso.trim();
            if (candidate >= todayYmd) {
                dueDateIso = candidate;
            }
        }
        if (!dueDateIso) {
            const parsedDays = parseInt(rawFollowUp.dueInDays, 10);
            const fallbackDays = !Number.isNaN(parsedDays) && parsedDays >= 1
                ? Math.min(365, parsedDays)
                : (FOLLOWUP_FALLBACK_DAYS[subType] || 5);
            dueDateIso = addDaysBrtYmd(fallbackDays);
        }

        const parsedDelay = parseInt(rawFollowUp.evaluationDelayDays, 10);
        const evaluationDelayDays = subType === 'ajuste_perfil'
            ? (!Number.isNaN(parsedDelay) ? Math.min(45, Math.max(7, parsedDelay)) : 14)
            : 14;
        const autoSchedulePerformanceEval = subType === 'ajuste_perfil'
            ? (rawFollowUp.autoSchedulePerformanceEval !== false)
            : false;

        return {
            shouldCreate: true,
            subType,
            reason,
            contextSummary,
            dueDateIso,
            autoSchedulePerformanceEval,
            evaluationDelayDays
        };
    }

    static parseAndRepairJson(rawText) {
        if (!rawText || typeof rawText !== 'string') return null;
        let cleaned = rawText.trim();
        if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
        }
        try {
            return JSON.parse(cleaned);
        } catch (_) {
            const firstBrace = cleaned.indexOf('{');
            const lastBrace = cleaned.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace > firstBrace) {
                try {
                    return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
                } catch (__) {
                    return null;
                }
            }
            return null;
        }
    }

    static validatePlainReplyText(rawText) {
        if (!rawText || typeof rawText !== 'string') {
            return { ok: false, reason: 'Resposta vazia.' };
        }
        for (const pat of LEAK_PATTERNS) {
            if (pat.test(rawText)) {
                return {
                    ok: false,
                    fatalLeak: true,
                    reason: 'A resposta gerada foi bloqueada pelo filtro de segurança por risco de exposição de informação interna/privada.'
                };
            }
        }
        for (const pat of INTERNAL_TERM_LEAKS_IN_REPLY) {
            if (pat.test(rawText)) {
                return {
                    ok: false,
                    needsReview: true,
                    reason: 'Sugestão continha terminologia analítica interna ("churn"/risco) inadequada para envio ao cliente.'
                };
            }
        }
        for (const pat of FORBIDDEN_PROMISES) {
            if (pat.test(rawText)) {
                return {
                    ok: false,
                    needsReview: true,
                    reason: 'Atenção: a sugestão gerada continha menção potencialmente interpretável como promessa comercial não autorizada e exige revisão.'
                };
            }
        }
        return { ok: true, reason: null };
    }

    static sanitizeReplyList(arr, maxLen = 3) {
        if (!Array.isArray(arr)) return [];
        return arr
            .map(item => String(item || '').trim())
            .filter(Boolean)
            .slice(0, maxLen);
    }

    static normalizeStructuredOutput(rawText, context = {}) {
        const parsed = typeof rawText === 'object' && rawText !== null
            ? rawText
            : this.parseAndRepairJson(rawText);

        // Se IA falhou no JSON, nunca expor JSON quebrado no campo de cópia
        if (!parsed || typeof parsed !== 'object') {
            const looksLikeBrokenJson = typeof rawText === 'string' && /^\s*[{[]/.test(rawText);
            const fallbackReply = looksLikeBrokenJson
                ? null
                : (typeof rawText === 'string' && rawText.trim() ? formatForWhatsApp(rawText.trim(), { preserveDashBullets: true }) : null);

            const guard = fallbackReply ? this.validatePlainReplyText(fallbackReply) : { ok: false };
            const safeFallback = guard.fatalLeak ? null : fallbackReply;

            return {
                structured: {
                    status: 'requires_review',
                    whatsappReply: safeFallback,
                    alternativeReply: null,
                    interactionCategory: 'outros',
                    evidences: [],
                    investigativeHypotheses: [],
                    churnRisk: { level: 'low', reason: 'Avaliação automática indisponível neste turno.' },
                    strategicAlerts: ['A resposta da IA veio fora do formato estruturado esperado e requer revisão manual antes do envio.'],
                    nextBestAction: 'Revisar o texto antes de copiar e enviar.',
                    missingInformation: [],
                    suggestedPendingItems: [],
                    memoryUpdates: { newFacts: [], newRecommendations: [], commitments: [] },
                    suggestedFollowUp: null
                },
                parseRecovered: false
            };
        }

        const validStatuses = ['ready', 'needs_information', 'identity_review', 'requires_review'];
        let status = validStatuses.includes(parsed.status) ? parsed.status : 'ready';
        if (context.forceIdentityReview) {
            status = 'identity_review';
        }

        const category = INTERACTION_CATEGORIES.includes(parsed.interactionCategory)
            ? parsed.interactionCategory
            : 'outros';

        let whatsappReply = (parsed.whatsappReply && typeof parsed.whatsappReply === 'string')
            ? formatForWhatsApp(parsed.whatsappReply.trim(), { preserveDashBullets: true })
            : null;
        let alternativeReply = (parsed.alternativeReply && typeof parsed.alternativeReply === 'string')
            ? formatForWhatsApp(parsed.alternativeReply.trim(), { preserveDashBullets: true })
            : null;

        const alerts = this.sanitizeReplyList(parsed.strategicAlerts, 4);

        if (status === 'identity_review') {
            whatsappReply = null;
            alternativeReply = null;
        }

        if (whatsappReply) {
            const check = this.validatePlainReplyText(whatsappReply);
            if (!check.ok) {
                status = 'requires_review';
                alerts.unshift(check.reason);
                if (check.fatalLeak) {
                    whatsappReply = null;
                }
            }
        }

        if (alternativeReply) {
            const altCheck = this.validatePlainReplyText(alternativeReply);
            if (!altCheck.ok && altCheck.fatalLeak) {
                alternativeReply = null;
            }
        }

        // Checa divergência evidente entre afirmação de "zero contatos/cliques" na instrução/resposta vs banco real
        const dossier = context.dossier;
        const confirmedContacts = Number(dossier?.stats?.contacts_received || 0);
        const totalClicks = Number(dossier?.funnel?.total?.whatsappClicks ?? dossier?.profile?.whatsapp_clicks ?? 0);
        const adminHint = String(context.adminInstruction || '');
        if ((confirmedContacts > 0 || totalClicks >= 3) && (/\b(?:0|nenhum)\s+(?:clique|contato)/i.test(adminHint) || /\bvocê ainda não recebeu nenhum clique/i.test(whatsappReply || ''))) {
            status = 'requires_review';
            alerts.unshift(`Divergência com o sistema: há ${totalClicks} cliques WPP e ${confirmedContacts} contatos confirmados registrados no banco.`);
        }

        const riskLevel = ['low', 'medium', 'high'].includes(parsed.churnRisk?.level)
            ? parsed.churnRisk.level
            : 'low';

        return {
            structured: {
                status,
                whatsappReply,
                alternativeReply,
                interactionCategory: category,
                evidences: this.sanitizeReplyList(parsed.evidences, 3),
                investigativeHypotheses: this.sanitizeReplyList(parsed.investigativeHypotheses, 2),
                churnRisk: {
                    level: riskLevel,
                    reason: String(parsed.churnRisk?.reason || 'Sem sinais críticos observados.').slice(0, 220)
                },
                strategicAlerts: alerts.slice(0, 4),
                nextBestAction: String(parsed.nextBestAction || '').slice(0, 220),
                missingInformation: this.sanitizeReplyList(parsed.missingInformation, 4),
                suggestedPendingItems: this.sanitizeReplyList(parsed.suggestedPendingItems, 4),
                memoryUpdates: {
                    newFacts: this.sanitizeReplyList(parsed.memoryUpdates?.newFacts, 4),
                    newRecommendations: this.sanitizeReplyList(parsed.memoryUpdates?.newRecommendations, 4),
                    commitments: this.sanitizeReplyList(parsed.memoryUpdates?.commitments, 4)
                },
                suggestedFollowUp: this.normalizeSuggestedFollowUp(parsed.suggestedFollowUp, context)
            },
            parseRecovered: true
        };
    }
}

module.exports = CopilotOutputGuard;

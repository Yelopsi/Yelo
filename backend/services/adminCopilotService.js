// backend/services/adminCopilotService.js
const crypto = require('crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('../models');
const { formatForWhatsApp } = require('../utils/whatsappFormatter');
const { sanitizeObject } = require('../utils/logger');
const promoCouponService = require('./promoCouponService');
const PsychologistContextService = require('./psychologistContextService');
const { PROMPT_VERSION, getResponseSchema, CopilotPromptBuilder } = require('./copilotPromptBuilder');
const CopilotOutputGuard = require('./copilotOutputGuard');
const CopilotMemoryService = require('./copilotMemoryService');
const CopilotInsightsService = require('./copilotInsightsService');

const SYSTEM_NOTICE_PATTERNS = [
    /^mensagens e chamadas são protegidas pela criptografia/i,
    /^messages and calls are end-to-end encrypted/i,
    /^hoje$/i,
    /^ontem$/i,
    /^você criou (o|este) grupo/i,
    /^encaminhada(?:\s+com\s+frequência)?$/i,
    /^forwarded(?:\s+many\s+times)?$/i,
    /^ligação de (voz|vídeo)/i
];

const DELETED_MSG_REGEX = /^(?:esta mensagem foi apagada|mensagem apagada|você apagou esta mensagem|this message was deleted)$/i;
const EDITED_SUFFIX_REGEX = /\s*(?:<mensagem editada>|\(mensagem editada\)|<edited>|esta mensagem foi editada\.?)\s*$/i;
const OMITTED_MEDIA_REGEX = /^<?\s*(?:m[ií]dia|imagem|foto|[áa]udio|v[ií]deo|figurinha|sticker|documento|gif|contato)\s+(?:oculta|ocultado|ocultada|omitido|omitida)\s*>?$/i;

const NON_SENDER_LABELS = new Set([
    'pix', 'crp', 'cpf', 'cnpj', 'cep', 'rg', 'email', 'e-mail', 'tel', 'telefone', 'celular',
    'whatsapp', 'wpp', 'valor', 'sessao', 'sessão', 'horario', 'horário', 'data', 'obs',
    'observacao', 'observação', 'link', 'link do perfil', 'perfil', 'chave', 'agencia',
    'agência', 'conta', 'banco', 'plano', 'status', 'resumo', 'assunto', 'paciente',
    'protocolo', 'atendimento', 'vencimento', 'fatura', 'endereco', 'endereço', 'http', 'https'
]);

const ADMIN_KEYWORDS = ['anderson', 'anderson costa', 'você', 'voce', 'eu', 'suporte', 'yelo', 'atendimento', 'desconhecido'];

// Cache em memória limitado (não persiste entre restarts/instâncias)
const failedModelsCache = new Map();
let settingsCache = { data: null, expiresAt: 0 };

class AdminCopilotService {
    static formatDateBRT(dateInput) {
        return PsychologistContextService.formatDateBRT(dateInput);
    }

    static formatPlanDisplayName(rawPlano) {
        return PsychologistContextService.formatPlanDisplayName(rawPlano);
    }

    static computeSubscriptionSummary(psy, extras = {}) {
        return PsychologistContextService.computeSubscriptionSummary(psy, extras);
    }

    static computeMessageHashes(parsedMessages = []) {
        return PsychologistContextService.computeMessageHashes(parsedMessages);
    }

    static async logTelemetry(level, message, meta = {}) {
        try {
            if (db.SystemLog && typeof db.SystemLog.create === 'function') {
                await db.SystemLog.create({
                    level: level || 'info',
                    message: String(message || '').slice(0, 500),
                    meta: sanitizeObject(meta)
                });
            }
        } catch (logErr) {
            console.warn('[AdminCopilotService] Falha ao gravar SystemLog:', logErr.message);
        }
    }

    /**
     * Consulta preços vigentes sem usar valores históricos hardcoded como fallback silencioso.
     * Se SystemSettings estiver indisponível ou zerado (0.00), sinaliza explicitamente indisponibilidade.
     */
    static async getCommercialPricing(psi = null) {
        const now = Date.now();
        let settingsResult = null;
        let readFailed = false;

        if (settingsCache.data && settingsCache.expiresAt > now) {
            settingsResult = settingsCache.data;
        } else {
            try {
                if (db.SystemSetting && typeof db.SystemSetting.findOne === 'function') {
                    const s = await db.SystemSetting.findOne();
                    if (s) {
                        const ess = Number(s.price_Essencial || 0);
                        const cli = Number(s['price_Clínico'] || s.price_Clinico || 0);
                        const ref = Number(s.price_sol || 0);
                        settingsResult = {
                            priceEssencial: ess > 0 ? ess : null,
                            priceClinico: cli > 0 ? cli : null,
                            priceReferencia: ref > 0 ? ref : null
                        };
                        settingsCache = { data: settingsResult, expiresAt: now + 15 * 60 * 1000 };
                    }
                }
            } catch (err) {
                readFailed = true;
                console.warn('[AdminCopilotService] Falha ao ler SystemSettings:', err.message);
            }
        }

        let activeOffer = null;
        if (psi && psi.id && psi.email) {
            try {
                const offer = await promoCouponService.getActiveOfferForPsychologist(psi, psi.plano || 'ESSENTIAL');
                if (offer && offer.eligible) {
                    activeOffer = {
                        code: offer.code,
                        title: offer.title,
                        chargeToday: offer.chargeToday,
                        renewalValue: offer.renewalValue
                    };
                }
            } catch (_) {
                // Silencioso caso modelo de Payment/SystemLog não esteja disponível em teste unitário isolado
            }
        }

        const hasPositiveSettings = Boolean(settingsResult && settingsResult.priceEssencial);
        return {
            available: hasPositiveSettings,
            readFailed,
            source: hasPositiveSettings ? 'SystemSettings' : 'unavailable',
            priceEssencial: settingsResult?.priceEssencial || null,
            priceClinico: settingsResult?.priceClinico || null,
            priceReferencia: settingsResult?.priceReferencia || null,
            activeOffer,
            unavailableNote: hasPositiveSettings
                ? null
                : (readFailed
                    ? 'Tabela de preços (SystemSettings) indisponível por falha de leitura no banco; NÃO invente nem cite valor fixo de plano.'
                    : 'Preços padrão não configurados em SystemSettings (0,00); caso não conste valor na assinatura do profissional, não afirme preço fixo sem confirmação de Anderson.')
        };
    }

    /**
     * Parser resiliente aos formatos reais do WhatsApp Brasil (iPhone, Android, WPP Web),
     * espaços não separáveis, marcas Unicode invisíveis, emojis em nomes, multilinha, editadas,
     * apagadas, encaminhadas e mídias omitidas.
     */
    static parsePastedChat(rawChat) {
        if (!rawChat || typeof rawChat !== 'string') {
            return {
                detectedSender: null,
                cleanName: null,
                detectedPhone: null,
                candidateSenders: [],
                hasForwardedContent: false,
                parsedMessages: []
            };
        }

        // Remove marcas bidirecionais/invisíveis e converte NBSP / narrow NBSP em espaço normal
        const cleanRaw = rawChat
            .replace(/[\u200e\u200f\u202a-\u202e\ufeff\u200b-\u200d]/g, '')
            .replace(/[\u00a0\u202f]/g, ' ');

        const lines = cleanRaw.split(/\r?\n/);
        const senders = [];
        const senderSet = new Set();
        const parsedMessages = [];
        let hasForwardedContent = false;

        const dateFirstBracket = /^\[(\d{1,4}[\/\.-]\d{1,2}(?:[\/\.-]\d{2,4})?,?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp][Mm])?)\]\s*(?:~|~\s*)?([^:\n]+):\s*(.*)$/;
        const timeFirstBracket = /^\[(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp][Mm])?,?\s+\d{1,2}[\/\.-]\d{1,2}(?:[\/\.-]\d{2,4})?)\]\s*(?:~|~\s*)?([^:\n]+):\s*(.*)$/;
        const dateFirstDash = /^(\d{1,4}[\/\.-]\d{1,2}(?:[\/\.-]\d{2,4})?,?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp][Mm])?)\s*(?:[-–—]|:)\s*(?:~|~\s*)?([^:\n]+):\s*(.*)$/;
        const timeFirstDash = /^(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp][Mm])?,?\s+\d{1,2}[\/\.-]\d{1,2}(?:[\/\.-]\d{2,4})?)\s*(?:[-–—]|:)\s*(?:~|~\s*)?([^:\n]+):\s*(.*)$/;

        const headerPatterns = [dateFirstBracket, timeFirstBracket, dateFirstDash, timeFirstDash];

        const addSender = (s) => {
            if (!senderSet.has(s)) {
                senderSet.add(s);
                senders.push(s);
            }
        };

        const normalizeMessageContent = (txt) => {
            let cleaned = String(txt || '').replace(EDITED_SUFFIX_REGEX, '').trim();
            const wasEdited = cleaned !== String(txt || '').trim();

            if (DELETED_MSG_REGEX.test(cleaned)) {
                return { content: '[mensagem apagada no WhatsApp]', omittedMedia: false, deletedMessage: true, wasEdited };
            }
            if (OMITTED_MEDIA_REGEX.test(cleaned)) {
                return { content: '[mídia omitida no WhatsApp]', omittedMedia: true, deletedMessage: false, wasEdited };
            }
            return { content: cleaned, omittedMedia: false, deletedMessage: false, wasEdited };
        };

        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;

            if (/^(?:encaminhada(?:\s+com\s+frequência)?|forwarded(?:\s+many\s+times)?)$/i.test(line)) {
                hasForwardedContent = true;
                continue;
            }
            if (SYSTEM_NOTICE_PATTERNS.some(re => re.test(line))) continue;

            // Citação com '>' nunca inicia cabeçalho de remetente real
            if (line.startsWith('>')) {
                hasForwardedContent = true;
                if (parsedMessages.length > 0) {
                    parsedMessages[parsedMessages.length - 1].content += '\n' + line;
                }
                continue;
            }

            let matched = null;
            for (const re of headerPatterns) {
                const m = line.match(re);
                if (m) {
                    matched = m;
                    break;
                }
            }

            if (matched) {
                const timestamp = matched[1].trim();
                const sender = matched[2].trim();
                const info = normalizeMessageContent(matched[3]);
                addSender(sender);
                parsedMessages.push({
                    timestamp,
                    sender,
                    content: info.content,
                    omittedMedia: info.omittedMedia,
                    deletedMessage: info.deletedMessage,
                    wasEdited: info.wasEdited
                });
            } else if (parsedMessages.length > 0) {
                const last = parsedMessages[parsedMessages.length - 1];
                const info = normalizeMessageContent(line);
                last.content = last.content ? `${last.content}\n${info.content}` : info.content;
                if (info.omittedMedia) last.omittedMedia = true;
            }
        }

        // Fallback para formato simples "Nome: Mensagem", sem capturar URLs, rótulos ou headers citados
        if (parsedMessages.length === 0 && lines.length > 0) {
            const simpleRegex = /^([^:\n]{2,40}):\s*(.+)$/;
            for (const rawLine of lines) {
                const line = rawLine.trim();
                if (!line) continue;
                if (SYSTEM_NOTICE_PATTERNS.some(re => re.test(line))) continue;
                if (line.startsWith('>') || /https?:\/\/|www\./i.test(line)) {
                    if (parsedMessages.length > 0) {
                        parsedMessages[parsedMessages.length - 1].content += '\n' + line;
                    }
                    continue;
                }

                const m = line.match(simpleRegex);
                if (m) {
                    const candidateLabel = m[1].trim();
                    const normalizedLabel = candidateLabel.toLowerCase().replace(/^~+/, '').trim();
                    const startsLikeBracketOrNumber = /^[\[\d\-\+\(\*]/.test(candidateLabel);
                    const isKnownLabel = NON_SENDER_LABELS.has(normalizedLabel) || normalizedLabel.includes('link ');

                    if (!startsLikeBracketOrNumber && !isKnownLabel) {
                        const info = normalizeMessageContent(m[2]);
                        addSender(candidateLabel);
                        parsedMessages.push({
                            timestamp: null,
                            sender: candidateLabel,
                            content: info.content,
                            omittedMedia: info.omittedMedia,
                            deletedMessage: info.deletedMessage,
                            wasEdited: info.wasEdited
                        });
                        continue;
                    }
                }
                if (parsedMessages.length > 0) {
                    parsedMessages[parsedMessages.length - 1].content += '\n' + line;
                }
            }
        }

        if (parsedMessages.length === 0 && cleanRaw.trim()) {
            parsedMessages.push({
                timestamp: null,
                sender: 'Desconhecido',
                content: cleanRaw.trim(),
                omittedMedia: false,
                deletedMessage: false,
                wasEdited: false
            });
        }

        const extractSenderInfo = (rawSender) => {
            const stripped = rawSender.replace(/^~+/, '').trim();
            const digitsOnly = stripped.replace(/\D/g, '');
            const nonPhoneText = stripped.replace(/[\d\s\+\-\(\)\.]/g, '');
            if (digitsOnly.length >= 8 && nonPhoneText.length === 0) {
                return { rawSender, cleanName: null, phone: digitsOnly };
            }
            const nameCleaned = stripped
                .replace(/^(Psic[oó]log[ao]|Psi|Dr|Dra|Prof)\.?\s+/i, '')
                .replace(/[^\w\sÀ-ÿ]/gi, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            return {
                rawSender,
                cleanName: (nameCleaned && /[a-zA-ZÀ-ÿ]/.test(nameCleaned)) ? nameCleaned : null,
                phone: null
            };
        };

        const nonAdminSenders = senders.filter((s) => {
            const lower = s.replace(/^~+/, '').trim().toLowerCase();
            return !ADMIN_KEYWORDS.some(kw => lower === kw || lower.startsWith('anderson'));
        });

        const candidateSenders = nonAdminSenders.map(extractSenderInfo);
        const primary = candidateSenders[0] || null;

        return {
            detectedSender: primary ? primary.rawSender : null,
            cleanName: primary ? primary.cleanName : null,
            detectedPhone: primary ? primary.phone : null,
            candidateSenders,
            hasForwardedContent,
            parsedMessages
        };
    }

    static async _queryPsychologistsByName(nameStr) {
        return PsychologistContextService._queryPsychologistsByName(nameStr);
    }

    static async _queryPsychologistsByPhone(digits) {
        return PsychologistContextService._queryPsychologistsByPhone(digits);
    }

    static async findPsychologist(cleanName, rawChat, parsedMeta = {}) {
        return PsychologistContextService.resolveIdentity(cleanName, rawChat, parsedMeta);
    }

    static async buildDossier(targetInput, options = {}) {
        return PsychologistContextService.buildDossier(targetInput, options);
    }

    /**
     * Limita transcrições extensas (ex.: exportação .txt do WhatsApp) mantendo os turnos mais recentes
     * para reduzir custo de tokens sem perder o contexto imediato do atendimento.
     */
    static windowTranscriptForLLM(sanitizedText, maxChars = 6000) {
        if (!sanitizedText || typeof sanitizedText !== 'string') {
            return { text: '', wasTruncated: false, omittedChars: 0 };
        }
        if (sanitizedText.length <= maxChars) {
            return { text: sanitizedText, wasTruncated: false, omittedChars: 0 };
        }
        const tail = sanitizedText.slice(-maxChars);
        const firstNewline = tail.indexOf('\n');
        const cleanTail = firstNewline > 0 && firstNewline < 240 ? tail.slice(firstNewline + 1) : tail;
        const omittedChars = sanitizedText.length - cleanTail.length;
        return {
            text: `[${omittedChars} caracteres anteriores omitidos para economia de tokens]\n${cleanTail}`,
            wasTruncated: true,
            omittedChars
        };
    }

    /**
     * Abordagem conservadora de privacidade pré-LLM (Fase 0.1):
     * - Redige identificadores detectáveis (CPF, CNPJ, RG, e-mail, tokens, chaves PIX, endereços, telefones terceiros e nomes explícitos de pacientes).
     * - BLOQUEIA (HTTP 422) conteúdo com credenciais/segredos ou informação clínica sensível associada a identificadores que não podem ser garantidamente anonimizados por regex.
     * Limitação explícita: expressões regulares não garantem anonimização completa de texto livre; bloqueios exigem revisão e limpeza manual pelo administrador antes do reenvio.
     */
    static sanitizeChatForLLM(rawChat, options = {}) {
        if (!rawChat || typeof rawChat !== 'string') {
            return { sanitizedText: '', blocked: false, hadRedactions: false };
        }

        // 1. Bloqueio estrito para credenciais / chaves / connection strings / JWT
        const secretPatterns = [
            /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
            /postgres(?:ql)?:\/\/[^\s'"]+/i,
            /\b(?:sk_live|sk_test|rk_live|AIza)[A-Za-z0-9_-]{16,}\b/,
            /\bBearer\s+[A-Za-z0-9\-._~+\/]+=*/i,
            /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/
        ];

        for (const pat of secretPatterns) {
            if (pat.test(rawChat)) {
                const err = new Error('Conteúdo bloqueado antes do envio à IA externa: credenciais, tokens ou chaves privadas detectadas. Remova essas informações e tente novamente.');
                err.statusCode = 422;
                err.isPrivacyBlock = true;
                throw err;
            }
        }

        // 2. Bloqueio conservador para conteúdo clínico sensível associado a identificador / contexto de paciente
        const clinicalDocHeader = /(?:prontu[aá]rio|anamnese|laudo psicol[oó]gico|cid[-\s]*10|ficha cl[ií]nica|evolu[cç][aã]o cl[ií]nica)\s*:/i.test(rawChat);
        const severeClinicalTerms = /(?:idea[cç][aã]o suicida|suic[ií]dio|tentativa de suic[ií]dio|automutila[cç][aã]o|abuso sexual|viol[eê]ncia dom[eé]stica|esquizofrenia|transtorno bipolar|borderline|psicose|depress[aã]o grave|surto psic[oó]tico)/i.test(rawChat);
        const medicationTerms = /\b(?:fluoxetina|sertralina|escitalopram|citalopram|venlafaxina|desvenlafaxina|rivotril|clonazepam|alprazolam|diazepam|lorazepam|zolpidem|quetiapina|risperidona|olanzapina|haloperidol|l[ií]tio|carbonato de l[ií]tio|bupropiona|amitriptilina|duloxetina)\b/i.test(rawChat);
        const clinicalWordWithPerson = /(?:paciente|atendendo um|atendendo uma|caso d[eao]|diagn[oó]stico d[eao]|laudo d[eao]|medica[cç][aã]o d[eao]|toma(?:ndo)?\s+(?:fluoxetina|sertralina|rivotril|clonazepam|l[ií]tio|quetiapina|escitalopram|zolpidem|alprazolam))\b/i.test(rawChat);

        // Nome próprio composto (ex.: "Maria Clara Oliveira") fora dos prefixos de cabeçalho [data] Nome:
        const bodyWithoutHeaders = rawChat
            .split(/\r?\n/)
            .map(l => l.replace(/^(?:\[[^\]]+\]\s*|[\d\/,\s:-]+[-–—]\s*)?(?:~|~\s*)?[^:\n]{2,45}:\s*/, ''))
            .join('\n');
        const hasPersonFullNameInBody = /\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-zà-ú]{2,}\s+(?:(?:da|de|do|dos|das)\s+)?[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-zà-ú]{2,}\b/.test(bodyWithoutHeaders);
        const hasSensitiveId = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\bRG\s*:?\s*[\d.\-X]{5,}/i.test(rawChat);

        if (clinicalDocHeader || ((severeClinicalTerms || medicationTerms) && (hasPersonFullNameInBody || hasSensitiveId || clinicalWordWithPerson))) {
            const err = new Error('Conteúdo bloqueado antes do envio à IA externa por conter relatos clínicos sensíveis (diagnóstico, medicação, violência/risco) associados a paciente identificável. Resuma ou anonimize manualmente os dados do paciente antes de gerar.');
            err.statusCode = 422;
            err.isPrivacyBlock = true;
            throw err;
        }

        // Bloqueio de dados bancários explícitos com titular/CPF
        const hasBankAccountBlock = /\b(?:ag[eê]ncia|conta\s*(?:corrente|poupan[cç]a))\s*:?\s*\d{3,}/i.test(rawChat) && hasSensitiveId;
        if (hasBankAccountBlock) {
            const err = new Error('Conteúdo bloqueado por conter dados bancários privados associados a documento. Remova agência/conta/CPF antes de enviar à IA.');
            err.statusCode = 422;
            err.isPrivacyBlock = true;
            throw err;
        }

        let sanitized = rawChat;
        let hadRedactions = false;
        const allowedDigits = new Set(
            (options.allowedPhones || [])
                .map(p => String(p || '').replace(/\D/g, '').slice(-8))
                .filter(d => d.length === 8)
        );

        const replaceTrack = (regex, replacement) => {
            sanitized = sanitized.replace(regex, (...args) => {
                hadRedactions = true;
                return typeof replacement === 'function' ? replacement(...args) : replacement;
            });
        };

        // Links privados e tokens na URL
        replaceTrack(/(https?:\/\/[^\s]+?(?:token|auth|session|key|secret|reset|convite)=[^\s]+)/gi, '[LINK_PRIVADO_OMITIDO]');
        replaceTrack(/(token=|reset-password\/|magic-feedback\?token=)([a-zA-Z0-9._-]{8,})/gi, '$1[TOKEN_OMITIDO]');
        // CPF, CNPJ e RG
        replaceTrack(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '[CPF_OMITIDO]');
        replaceTrack(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, '[CNPJ_OMITIDO]');
        replaceTrack(/\bRG\s*:?\s*[\d.\-X]{5,14}\b/gi, '[RG_OMITIDO]');
        // E-mails
        replaceTrack(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_OMITIDO]');
        // Chaves PIX explícitas ou EVP UUIDs isolados
        replaceTrack(/(chave\s+pix\s*:?\s*)([^\s,;]+)/gi, '$1[CHAVE_PIX_OMITIDA]');
        // Endereços físicos
        replaceTrack(/\b(?:Rua|Avenida|Av\.?|Travessa|Alameda|Rodovia|Estrada|Praça)\s+[A-Za-zÀ-ÿ0-9\s.'-]{4,60}(?:,\s*(?:n[º°]?\.?\s*)?\d{1,5})?(?:\s*[-–]\s*[A-Za-zÀ-ÿ\s]{2,30})?/gi, '[ENDERECO_OMITIDO]');
        replaceTrack(/\b\d{5}-\d{3}\b/g, '[CEP_OMITIDO]');
        // Nomes explícitos de pacientes em narrativa
        replaceTrack(/((?:meu\s+|minha\s+)?(?:paciente|consulente|atendido|atendida|menor|filho|filha|cliente)\s*(?::\s*|\s+(?:se chama|é|chamado|chamada)\s+|\s+))([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-zà-ú]{2,}(?:\s+(?:da|de|do|dos|das|[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-zà-ú]{2,}))*)/g, '$1[PACIENTE_OMITIDO]');
        // Sequências financeiras longas (cartões, boletos, PIX numérico longo)
        replaceTrack(/\b\d{13,48}\b/g, '[DADO_FINANCEIRO_OMITIDO]');

        // Telefones que não pertençam ao psicólogo do dossiê
        sanitized = sanitized.replace(/(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\d{4}[-\s]\d{4}|\d{4}[-\s]\d{4}|\(?[1-9]\d\)?\s?9?\d{8})/g, (match) => {
            const digits = match.replace(/\D/g, '');
            const suffix = digits.slice(-8);
            if (suffix.length === 8 && allowedDigits.has(suffix)) {
                return match;
            }
            hadRedactions = true;
            return '[TELEFONE_TERCEIRO]';
        });

        // Neutraliza qualquer tentativa de fechar delimitadores XML no texto importado
        sanitized = sanitized.replace(/<\/?\s*untrusted_whatsapp_transcript[^>]*>/gi, '[TAG_REMOVIDA]');

        return { sanitizedText: sanitized, blocked: false, hadRedactions };
    }

    /**
     * Validação determinística de saída (delega para CopilotOutputGuard)
     */
    static validateGeneratedOutput(rawText) {
        return CopilotOutputGuard.validatePlainReplyText(rawText);
    }

    /**
     * Gera resposta com Gemini separando systemInstruction modular de contents delimitados por nonce,
     * utilizando schema JSON estruturado (Fase 2) com rollback via COPILOT_V2_STRUCTURED=false,
     * sanitização pré-LLM, CopilotOutputGuard, timeout e telemetria sem PII.
     */
    static resolveSmartMode({ mode, tone, pastedChat = '', adminInstruction = '' }) {
        const normalizedExplicit = CopilotPromptBuilder.normalizeMode(mode, tone);
        // Se um modo específico (diferente do genérico "resposta") foi escolhido explicitamente, respeita
        if (mode && mode !== 'resposta' && mode !== 'auto') {
            return normalizedExplicit;
        }
        if (tone === 'comercial' || tone === 'tecnico') {
            return normalizedExplicit;
        }

        const combined = `${pastedChat}\n${adminInstruction}`
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();

        if (/\b(?:revise|revisar|rascunho|melhore esse texto|corrija esse texto)\b/.test(combined)) {
            return 'revisao';
        }
        if (/\b(?:cancelar|cancelamento|nao vou assinar|parar de pagar|pausar perfil|estorno|reembolso|desistir|outra plataforma)\b/.test(combined)) {
            return 'retencao';
        }
        if (/\b(?:quantos pacientes|media de|fluxo de pacientes|fechar mensalmente|retorno financeiro|converte pacientes|qual valor|quanto custa|mensalidade|plano essencial|plano clinico|compensa)\b/.test(combined)) {
            return 'comercial';
        }
        if (/\b(?:match|algoritmo|prontuario|notificar|bug|erro|perfil|avaliacoes|google meu negocio|agenda|como funciona)\b/.test(combined)) {
            return 'suporte';
        }
        return 'resposta';
    }

    static detectInputKind({ pastedChat = '', parsedMeta = {}, dossier = null }) {
        if (dossier?.profile || parsedMeta?.detectedSender || parsedMeta?.hasForwardedContent) {
            return 'whatsapp_chat';
        }
        const trimmed = String(pastedChat || '').trim();
        const norm = trimmed.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        // Saudações diretas ao Anderson ainda simulam chat do WhatsApp
        if (/\b(?:oi|ola|bom dia|boa tarde|boa noite)\s*,?\s*anderson\b/.test(norm) || /^oi\s+anderson\b/.test(norm)) {
            return 'whatsapp_chat';
        }
        const hasExternalGreeting = /\b(?:boa tarde|boa noite|bom dia|ola|oi)\b/.test(norm) && norm.length > 25;
        const looksLikeDataQuestion = /\b(?:quantos|quantas|qual a media|quais sao|como esta a demanda|demanda para|por mes|mensalmente|taxa de conversao|estatistica|ranking|dados do banco)\b/.test(norm)
            || (norm.includes('?') && /\b(?:profissional|profissionais|psicologo|psicologos|plataforma|yelo|paciente|pacientes)\b/.test(norm));

        if (looksLikeDataQuestion && !hasExternalGreeting) {
            return 'direct_query';
        }
        return 'whatsapp_chat';
    }

    /**
     * Gera resposta com Gemini separando systemInstruction modular de contents delimitados por nonce,
     * utilizando schema JSON estruturado (Fase 2) com rollback via COPILOT_V2_STRUCTURED=false,
     * sanitização pré-LLM, CopilotOutputGuard, timeout e telemetria sem PII.
     */
    static async generateResponse({
        pastedChat,
        dossier,
        tone = 'natural',
        mode = null,
        extension = 'padrao',
        adminInstruction = '',
        interactionCategoryHint = null
    }) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error('GEMINI_API_KEY não configurada no servidor.');

        const structuredEnabled = process.env.COPILOT_V2_STRUCTURED !== 'false';
        const effectiveMode = this.resolveSmartMode({ mode, tone, pastedChat, adminInstruction });
        const effectiveExtension = CopilotPromptBuilder.normalizeExtension(extension);
        const parsedMeta = this.parsePastedChat(pastedChat);
        const inputKind = this.detectInputKind({ pastedChat, parsedMeta, dossier });

        const { sanitizedText, hadRedactions } = this.sanitizeChatForLLM(pastedChat, {
            allowedPhones: dossier?.profile?.telefone ? [dossier.profile.telefone] : []
        });
        const windowedChat = this.windowTranscriptForLLM(sanitizedText, 6000);

        const [pricing, fewShotBlock, dbContext] = await Promise.all([
            this.getCommercialPricing(dossier?.profile || null),
            CopilotMemoryService.getApprovedExamplesBlock({
                interactionCategory: interactionCategoryHint,
                pastedChat: windowedChat.text
            }),
            CopilotInsightsService.getPlatformDatabaseContext({
                pastedChat: windowedChat.text,
                adminInstruction,
                dossier
            }).catch(() => ({ platformMetricsBlock: '', dynamicDbBlock: '' }))
        ]);

        const genAI = new GoogleGenerativeAI(apiKey);
        const CANDIDATE_MODELS = CopilotPromptBuilder.selectCandidateModels({
            mode: effectiveMode,
            chatLength: windowedChat.text.length
        });

        let contextBlock = 'Nenhum profissional específico confirmado no banco de dados. NÃO invente métricas privadas individuais, mas utilize livremente PLATFORM_DB_METRICS e DYNAMIC_DB_QUERY_RESULTS com transparência.';
        let pastContext = '';

        if (dossier && dossier.profile) {
            const entityType = dossier.entityType || 'psychologist';
            const p = dossier.profile;

            if (entityType === 'lead' || entityType === 'waiting_list' || entityType === 'unregistered') {
                const lines = [
                    `VERIFIED_SYSTEM_DATA (${entityType}):`,
                    `- Interessado: ${p.nome || 'Não informado'}${p.crp ? ` (CRP: ${p.crp})` : ''}`,
                    `- Tipo/Status: ${dossier.subscriptionSummary?.badgeLabel || entityType} (ainda não é assinante ativo na vitrine)`,
                    p.origem_url ? `- Origem: ${p.origem_url}` : null,
                    p.valor_sessao_faixa ? `- Faixa informada: ${p.valor_sessao_faixa}` : null
                ].filter(Boolean);
                contextBlock = lines.join('\n');
            } else {
                const s = dossier.stats || {};
                const funnel = dossier.funnel || null;
                const usage = dossier.usage || null;
                const posts = dossier.posts || { total: 0, top: [] };
                const reviews = dossier.reviews || { total: 0, avgRating: null, gmbCount: 0, platformReview: null };
                const community = dossier.community || { qnaAnswers: 0, forumPosts: 0, forumComments: 0 };
                const sub = dossier.subscriptionSummary || this.computeSubscriptionSummary(p, {
                    latestPayment: dossier.latestPayment,
                    subscription: dossier.subscription
                });

                const valorFormatado = (p.valor_sessao_numero && Number(p.valor_sessao_numero) > 0)
                    ? `R$ ${p.valor_sessao_numero}`
                    : (p.tipo_cobranca === 'mensal' && p.valor_mensal_numero ? `R$ ${p.valor_mensal_numero}/mês` : 'A combinar');

                const matchesTotal = funnel?.total?.matches ?? (p.profile_appearances || 0);
                const viewsTotal = funnel?.total?.profileViews ?? 0;
                const clicksTotal = funnel?.total?.whatsappClicks ?? (p.whatsapp_clicks || s.total_clicks || 0);
                const clicks30d = funnel?.d30?.whatsappClicks ?? s.clicks_30d ?? 0;
                const clicks7d = funnel?.d7?.whatsappClicks ?? s.clicks_7d ?? 0;

                const monthlyStr = Array.isArray(dossier.monthlyHistory) && dossier.monthlyHistory.length > 0
                    ? dossier.monthlyHistory.map(m => `${m.month}: ${m.matches} match/${m.clicks} cliques/${m.contacts} contatos/${m.deals} fechados`).join(' ; ')
                    : null;

                const dataLines = [
                    'VERIFIED_SYSTEM_DATA:',
                    `- Profissional: ${p.nome} (CRP: ${p.crp || 'N/I'}) | ${p.cidade || 'Online'}${p.estado ? '/' + p.estado : ''} | Bio: ${p.bio_length || 0} chars | XP: ${p.xp || 0} (${p.authority_level || 'padrao'})`,
                    `- Cadastro: ${sub?.cadastreStatus || p.status} | Financeiro: ${sub?.financialStatus || p.status} | Visibilidade: ${sub?.visibilityStatus || 'N/I'}`,
                    `- Plano: ${sub?.planText || p.plano || 'N/D'} | Validade(BRT): ${sub?.expireText || this.formatDateBRT(p.planExpiresAt) || '-'} | Pagamentos: ${p.subscription_payments_count || 0}${p.lifetimeRevenue ? ` | LTV pago: R$ ${Number(p.lifetimeRevenue).toFixed(2)}` : ''}`,
                    dossier.latestPayment ? `- Última fatura: ${dossier.latestPayment.status} (R$ ${dossier.latestPayment.value || '-'}, ${dossier.latestPayment.billingType || '-'}, Venc:${dossier.latestPayment.dueDate || '-'})` : null,
                    `- Sessão: ${valorFormatado} | Modalidade: ${Array.isArray(p.modalidade) ? p.modalidade.join(', ') : (p.modalidade || 'Online')} | Abordagens: ${Array.isArray(p.abordagens_tecnicas) ? p.abordagens_tecnicas.slice(0, 4).join(', ') : (p.abordagens_tecnicas || 'Geral')} | Temas: ${Array.isArray(p.temas_atuacao) ? p.temas_atuacao.slice(0, 5).join(', ') : (p.temas_atuacao || '-')}`,
                    `- Funil Geral: Match=${matchesTotal} (30d:${funnel?.d30?.matches ?? 0}, 7d:${funnel?.d7?.matches ?? 0}) | Visitas Perfil=${viewsTotal} (30d:${funnel?.d30?.profileViews ?? 0}) | Cliques WPP=${clicksTotal} (30d:${clicks30d}, 7d:${clicks7d}) | Contatos=${s.contacts_received || 0} | SemContato=${s.no_contact || 0} | EmNeg=${s.in_negotiation || 0} | Fechamentos=${s.deals_closed || 0}`,
                    monthlyStr ? `- Evolução mensal deste profissional: ${monthlyStr}` : null,
                    `- Provas sociais & Autoridade: ${reviews.total || 0} avaliações Yelo${reviews.avgRating ? ` (nota ${reviews.avgRating})` : ''}, ${reviews.gmbCount || 0} reviews Google Meu Negócio, ${posts.total || 0} artigo(s) Blog${posts.top.length > 0 ? ` (Top: "${posts.top[0].titulo}" [${posts.top[0].curtidas}❤])` : ''}, ${community.qnaAnswers || 0} respostas Q&A, ${community.forumPosts || 0} posts Fórum`,
                    (usage && (usage.activePatients > 0 || usage.appointments30d > 0 || usage.appointmentsTotal > 0)) ? `- Uso Clínica: ${usage.activePatients} pac. ativos, ${usage.appointments30d} sessões/30d (${usage.appointmentsTotal || 0} total)` : null,
                    Array.isArray(dossier.optimizationChecklist) && dossier.optimizationChecklist.length > 0 ? `- Oportunidades de otimização detectadas no perfil: ${dossier.optimizationChecklist.join('; ')}` : null,
                    reviews.platformReview ? `- Avaliação que o psi deu à Yelo: nota ${reviews.platformReview.rating}/5${reviews.platformReview.comment ? ` ("${reviews.platformReview.comment}")` : ''}` : null,
                    dossier.exitSurvey ? `- ExitSurvey: "${dossier.exitSurvey.motivo}"${dossier.exitSurvey.sugestao ? ` ("${dossier.exitSurvey.sugestao}")` : ''}` : null,
                    pricing.activeOffer ? `- Oferta elegível (requer aprovação): ${pricing.activeOffer.title}` : null
                ].filter(Boolean);
                contextBlock = dataLines.join('\n');
            }

            if (dossier.memory?.rollingSummary) {
                const memParts = [String(dossier.memory.rollingSummary).slice(0, 420)];
                if (Array.isArray(dossier.memory.pendingItems) && dossier.memory.pendingItems.length > 0) {
                    memParts.push(`Pendências: ${dossier.memory.pendingItems.slice(0, 3).join('; ')}`);
                }
                pastContext = `\nRELATIONSHIP_MEMORY:\n${memParts.join('\n')}`;
            } else if (dossier.pastConversations && dossier.pastConversations.length > 0) {
                pastContext = `\nHISTÓRICO RECENTE DO COPILOT:\n${dossier.pastConversations
                    .slice(0, 2)
                    .map(c => `- (${this.formatDateBRT(c.createdAt) || ''}): "${String(c.aiResponse || '').substring(0, 120)}..."`)
                    .join('\n')}`;
            }
        }

        const commercialBlock = pricing.available
            ? `CONDIÇÃO COMERCIAL VIGENTE (SystemSettings): Plano Essencial R$ ${Number(pricing.priceEssencial).toFixed(2).replace('.', ',')}/mês${pricing.priceClinico ? ` | Plano Clínico R$ ${Number(pricing.priceClinico).toFixed(2).replace('.', ',')}/mês` : ''}. Sem fidelidade e 0% de comissão sobre sessões.`
            : `CONDIÇÃO COMERCIAL VIGENTE: ${pricing.unavailableNote} (A Yelo não cobra comissão sobre sessões; nunca invente preços não presentes no contexto).`;

        let toneInstruction = 'Tom natural, parceiro e maduro (entre colegas psicólogos).';
        if (tone === 'comercial') {
            toneInstruction = pricing.available
                ? `Tom consultivo focado em clareza comercial e ROI (0% de comissão; Plano Essencial vigente R$ ${Number(pricing.priceEssencial).toFixed(2).replace('.', ',')}/mês). Nunca prometa retorno garantido ou isenções sem autorização.`
                : 'Tom consultivo transparente focado em ROI e dados reais do banco (0% de comissão sobre sessões); não afirme valores numéricos fixos que não constem nos blocos de dados.';
        } else if (tone === 'tecnico') {
            toneInstruction = 'Tom prático explicando ajustes de perfil, funcionalidades reais da plataforma ou funcionamento oficial do Match da Yelo (critérios clínicos 65% + operacionais 35% + cotas dinâmicas, sem inventar pesos ou regras).';
        }

        const nonce = crypto.randomBytes(4).toString('hex');
        const transcriptTag = `untrusted_whatsapp_transcript_${nonce}`;

        const systemInstruction = CopilotPromptBuilder.buildSystemInstruction({
            transcriptTag,
            mode: effectiveMode,
            extension: effectiveExtension,
            toneInstruction,
            structured: structuredEnabled,
            inputKind
        });

        const userContents = CopilotPromptBuilder.buildUserContents({
            contextBlock,
            platformMetricsBlock: dbContext.platformMetricsBlock,
            dynamicDbBlock: dbContext.dynamicDbBlock,
            pastContext,
            commercialBlock,
            adminInstruction,
            fewShotBlock,
            transcriptTag,
            sanitizedTranscript: windowedChat.text,
            structured: structuredEnabled
        });

        const timeoutMs = Number(process.env.COPILOT_AI_TIMEOUT_MS) || 20000;
        const now = Date.now();
        const availableModels = CANDIDATE_MODELS.filter((m) => {
            const failUntil = failedModelsCache.get(m);
            return !failUntil || failUntil < now;
        });
        const modelsToTry = availableModels.length > 0 ? availableModels : CANDIDATE_MODELS;

        let rawText = null;
        let lastErr = null;
        let usedModel = null;
        let usageMetadata = null;
        const startMs = Date.now();
        let retries = 0;

        for (const modelName of modelsToTry) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(new Error('Timeout na chamada ao provedor de IA.')), timeoutMs);
            try {
                const generationConfig = structuredEnabled
                    ? { maxOutputTokens: 1600, responseMimeType: 'application/json', responseSchema: getResponseSchema() }
                    : { maxOutputTokens: 1100 };

                const model = genAI.getGenerativeModel({
                    model: modelName,
                    systemInstruction,
                    generationConfig
                });

                const result = await model.generateContent(userContents, {
                    timeout: timeoutMs,
                    signal: controller.signal
                });

                const candidateText = result?.response?.text?.();
                if (candidateText) {
                    rawText = candidateText;
                    usedModel = modelName;
                    usageMetadata = result?.response?.usageMetadata || null;
                    break;
                }
            } catch (err) {
                retries++;
                const isAbort = err?.name === 'AbortError' || /abort|timeout/i.test(err?.message || '');
                const isNotFound = /404|not found/i.test(err?.message || '');
                if (isNotFound) {
                    failedModelsCache.set(modelName, Date.now() + 5 * 60 * 1000);
                }
                console.warn(`[AdminCopilotService] Falha no modelo ${modelName}:`, err.message);
                lastErr = isAbort ? new Error(`Tempo limite (${timeoutMs}ms) excedido na geração via IA.`) : err;
                if (isAbort) break;
            } finally {
                clearTimeout(timer);
            }
        }

        const latencyMs = Date.now() - startMs;

        if (!rawText) {
            await this.logTelemetry('error', `[Copilot] Falha ao gerar resposta IA: ${lastErr?.message || 'erro desconhecido'}`, {
                module: 'copilot',
                latencyMs,
                retries,
                hadRedactions,
                psychologistId: dossier?.profile?.id || null
            });
            const outErr = new Error(`Falha ao gerar resposta via IA: ${lastErr?.message || 'Serviço de IA temporariamente indisponível'}`);
            if (lastErr && /tempo limite|timeout/i.test(lastErr.message)) {
                outErr.statusCode = 504;
            }
            throw outErr;
        }

        let formatted = null;
        let structuredOutput = null;

        if (structuredEnabled) {
            const { structured, parseRecovered } = CopilotOutputGuard.normalizeStructuredOutput(rawText, {
                dossier,
                adminInstruction
            });
            structuredOutput = structured;

            if (!parseRecovered && structured.whatsappReply) {
                const plainCheck = CopilotOutputGuard.validatePlainReplyText(structured.whatsappReply);
                if (!plainCheck.ok) {
                    await this.logTelemetry('warn', `[Copilot] Saída bloqueada pelo filtro pós-geração: ${plainCheck.reason}`, {
                        module: 'copilot',
                        model: usedModel,
                        latencyMs,
                        psychologistId: dossier?.profile?.id || null
                    });
                    const err = new Error(plainCheck.reason);
                    err.statusCode = 422;
                    err.isOutputGuardBlock = true;
                    throw err;
                }
            }

            if (parseRecovered && structured.whatsappReply === null && structured.status === 'requires_review' && structured.strategicAlerts?.[0]?.includes('bloqueada pelo filtro')) {
                const err = new Error(structured.strategicAlerts[0]);
                err.statusCode = 422;
                err.isOutputGuardBlock = true;
                throw err;
            }

            formatted = structured.whatsappReply || '';
        } else {
            formatted = formatForWhatsApp(rawText, { preserveDashBullets: true });
            const outputCheck = this.validateGeneratedOutput(formatted);
            if (!outputCheck.ok) {
                await this.logTelemetry('warn', `[Copilot] Saída bloqueada pelo filtro pós-geração: ${outputCheck.reason}`, {
                    module: 'copilot',
                    model: usedModel,
                    latencyMs,
                    psychologistId: dossier?.profile?.id || null
                });
                const err = new Error(outputCheck.reason);
                err.statusCode = 422;
                err.isOutputGuardBlock = true;
                throw err;
            }
            structuredOutput = {
                status: 'ready',
                whatsappReply: formatted,
                alternativeReply: null,
                interactionCategory: 'outros',
                evidences: [],
                investigativeHypotheses: [],
                churnRisk: { level: 'low', reason: 'Modo legado.' },
                strategicAlerts: [],
                nextBestAction: '',
                missingInformation: [],
                suggestedPendingItems: [],
                memoryUpdates: { newFacts: [], newRecommendations: [], commitments: [] }
            };
        }

        await this.logTelemetry('info', '[Copilot] Resposta gerada', {
            module: 'copilot',
            model: usedModel,
            promptVersion: PROMPT_VERSION,
            operationMode: effectiveMode,
            interactionCategory: structuredOutput?.interactionCategory || 'outros',
            latencyMs,
            retries,
            hadRedactions,
            pricingSource: pricing.source,
            promptTokens: usageMetadata?.promptTokenCount || null,
            outputTokens: usageMetadata?.candidatesTokenCount || null,
            psychologistId: dossier?.profile?.id || null
        });

        return {
            text: formatted,
            structuredOutput,
            promptVersion: PROMPT_VERSION,
            operationMode: effectiveMode,
            extension: effectiveExtension,
            sanitizedChat: sanitizedText,
            meta: {
                modelUsed: usedModel,
                promptVersion: PROMPT_VERSION,
                operationMode: effectiveMode,
                extension: effectiveExtension,
                latencyMs,
                retries,
                hadRedactions,
                transcriptTruncated: windowedChat.wasTruncated,
                omittedChars: windowedChat.omittedChars,
                pricingSource: pricing.source,
                promptTokens: usageMetadata?.promptTokenCount || null,
                outputTokens: usageMetadata?.candidatesTokenCount || null
            }
        };
    }
}

module.exports = AdminCopilotService;

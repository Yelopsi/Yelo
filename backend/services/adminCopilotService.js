// backend/services/adminCopilotService.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('../models');
const { formatForWhatsApp } = require('../utils/whatsappFormatter');

const NICKNAMES = {
    'fred': 'frederico',
    'leo': 'leonardo',
    'ze': 'jose',
    'bia': 'beatriz',
    'dani': 'daniela',
    'lu': 'luciana',
    'beto': 'roberto',
    'chico': 'francisco',
    'manu': 'manuela',
    'gabi': 'gabriela',
    'theo': 'teodoro',
    'cadu': 'carlos',
    'gui': 'guilherme',
    'rafa': 'rafael'
};

class AdminCopilotService {
    /**
     * Extrai o interlocutor que NÃO seja o Anderson do chat colado do WhatsApp
     */
    static parsePastedChat(rawChat) {
        if (!rawChat || typeof rawChat !== 'string') return { detectedSender: null, messages: [] };

        // Sanitiza caracteres invisíveis LTR/RTL e BOM do WhatsApp (muito comuns no mobile iOS/Android)
        const cleanRaw = rawChat.replace(/[\u200e\u200f\u202a-\u202e\ufeff]/g, '');

        const lines = cleanRaw.split('\n');
        const senders = new Set();
        const parsedMessages = [];

        // Padrões de export/cópia do WhatsApp no Brasil e internacional:
        // [16/09/26, 09:56:49] ~Psicóloga Thamiris Borges: ...
        // [16/09/2026 09:56:49] Anderson Costa: ...
        // [16/09/2026, 9:56:49 AM] Psicóloga Thamiris: ...
        // 16/09/2026, 09:56 - ~Psicóloga Thamiris Borges: ...
        // 16/09/2026 09:56 - Psicóloga Thamiris: ...
        // 16/09/2026 09:56:49: Psicóloga Thamiris: ...
        const headerRegex = /^(?:\[(?:\d{1,4}[\/\.-]\d{1,2}[\/\.-]\d{2,4}),?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp][Mm])?\]|(?:\d{1,4}[\/\.-]\d{1,2}[\/\.-]\d{2,4}),?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp][Mm])?\s*(?:[-–—]|:))\s*(?:~|~\s*)?([^:]+):\s*(.*)$/i;

        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;

            const match = line.match(headerRegex);
            if (match) {
                const sender = match[1].trim();
                const content = match[2].trim();
                senders.add(sender);
                parsedMessages.push({ sender, content });
            } else if (parsedMessages.length > 0) {
                // Continuação de mensagem anterior de múltiplas linhas
                parsedMessages[parsedMessages.length - 1].content += '\n' + line;
            }
        }

        // Se nenhum padrão de data/hora deu match, tenta formato simples "Nome: Mensagem"
        if (parsedMessages.length === 0 && lines.length > 0) {
            const simpleRegex = /^([^:\n]{2,40}):\s*(.+)$/;
            for (const rawLine of lines) {
                const line = rawLine.trim();
                if (!line) continue;
                const m = line.match(simpleRegex);
                if (m) {
                    const sender = m[1].trim();
                    const content = m[2].trim();
                    senders.add(sender);
                    parsedMessages.push({ sender, content });
                } else if (parsedMessages.length > 0) {
                    parsedMessages[parsedMessages.length - 1].content += '\n' + line;
                }
            }
        }

        // Se ainda não tiver mensagens identificadas, considera todo o texto como uma mensagem
        if (parsedMessages.length === 0 && cleanRaw.trim()) {
            parsedMessages.push({ sender: 'Desconhecido', content: cleanRaw.trim() });
        }

        // Filtra para achar o contato que NÃO é o Anderson
        const adminKeywords = ['anderson', 'anderson costa', 'você', 'voce', 'eu', 'suporte', 'yelo', 'atendimento'];
        let candidate = null;

        for (const s of senders) {
            const lower = s.toLowerCase();
            const isAdmin = adminKeywords.some(kw => lower === kw || lower.startsWith('anderson'));
            if (!isAdmin) {
                candidate = s;
                break;
            }
        }

        // Limpeza do nome do candidato
        let cleanName = null;
        if (candidate) {
            cleanName = candidate
                .replace(/^~+/, '')
                .replace(/^(Psic[oó]log[ao]|Psi|Dr|Dra|Prof)\.?\s+/i, '')
                .replace(/[^\w\sÀ-ÿ]/gi, '')
                .trim();
        }

        return {
            detectedSender: candidate,
            cleanName,
            parsedMessages
        };
    }

    /**
     * Localiza o psicólogo no banco de dados com tolerância a apelidos, buscas parciais,
     * suporte a tokens do WhatsAppClickLogs (magic-feedback) e insensibilidade a acentos.
     */
    static async findPsychologist(cleanName, rawChat) {
        if (!cleanName && !rawChat) return null;
        const cleanRaw = rawChat ? rawChat.replace(/[\u200e\u200f\u202a-\u202e\ufeff]/g, '') : '';

        // 1. Extração por token de feedback no chat (ex: magic-feedback?token=uuid) - 100% determinístico
        if (rawChat) {
            const tokenMatch = rawChat.match(/(?:token=|\/magic-feedback\?token=)([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
            if (tokenMatch) {
                const token = tokenMatch[1];
                try {
                    const [clickRows] = await db.sequelize.query(`
                        SELECT p.id, p.nome, p.email, p.telefone, p.status, p.plano, p."planExpiresAt", p."whatsapp_clicks", p."profile_appearances", p."slug", p."fotoUrl", p."crp"
                        FROM "WhatsAppClickLogs" w
                        JOIN "Psychologists" p ON p.id = w."psychologistId"
                        WHERE w."feedbackToken" = :token
                        LIMIT 1;
                    `, { replacements: { token } });

                    if (clickRows && clickRows.length > 0) return clickRows[0];
                } catch (tokErr) {
                    console.warn("[AdminCopilotService] Erro ao buscar por token:", tokErr.message);
                }
            }
        }

        // 2. Extração por telefone detectado no chat
        if (rawChat) {
            const phoneMatch = rawChat.match(/(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\d{4}[-\s]?\d{4}|\d{4}[-\s]?\d{4})/);
            if (phoneMatch) {
                const digits = phoneMatch[0].replace(/\D/g, '');
                if (digits.length >= 8) {
                    try {
                        const [phoneMatches] = await db.sequelize.query(`
                            SELECT id, nome, email, telefone, status, plano, "planExpiresAt", "whatsapp_clicks", "profile_appearances", "slug", "fotoUrl", "crp"
                            FROM "Psychologists"
                            WHERE telefone LIKE :query
                            ORDER BY (CASE WHEN status = 'active' THEN 1 ELSE 0 END) DESC, id DESC
                            LIMIT 1;
                        `, { replacements: { query: `%${digits.slice(-8)}%` } });

                        if (phoneMatches && phoneMatches.length > 0) return phoneMatches[0];
                    } catch (phoneErr) {
                        console.warn("[AdminCopilotService] Erro ao buscar por telefone:", phoneErr.message);
                    }
                }
            }
        }

        // 3. Busca por nome com desacentuação nativa e tolerância a apelidos
        if (cleanName) {
            const norm = cleanName
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, ' ')
                .trim();

            const stopWords = new Set(['de', 'da', 'do', 'dos', 'das', 'e', 'psi', 'dr', 'dra']);
            const rawWords = norm.split(/\s+/).filter(w => w.length >= 2 && !stopWords.has(w));
            const words = rawWords.map(w => NICKNAMES[w] || w);

            // Função translate no PostgreSQL para desacentuar a coluna nome sem requerer extensões
            const normCol = "translate(lower(nome), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')";

            try {
                if (words.length >= 2) {
                    // Todos os termos principais devem existir no nome do profissional
                    const whereClauses = words.map((_, i) => `${normCol} LIKE :w${i}`).join(' AND ');
                    const replacements = {};
                    words.forEach((w, i) => { replacements[`w${i}`] = `%${w}%`; });

                    const [rows] = await db.sequelize.query(`
                        SELECT id, nome, email, telefone, status, plano, "planExpiresAt", "whatsapp_clicks", "profile_appearances", "slug", "fotoUrl", "crp"
                        FROM "Psychologists"
                        WHERE ${whereClauses}
                        ORDER BY (CASE WHEN status = 'active' THEN 1 ELSE 0 END) DESC, id DESC
                        LIMIT 1;
                    `, { replacements });

                    if (rows && rows.length > 0) return rows[0];
                } else if (words.length === 1) {
                    // Termo único (ex: 'Thamiris' ou 'Frederico')
                    const [rows] = await db.sequelize.query(`
                        SELECT id, nome, email, telefone, status, plano, "planExpiresAt", "whatsapp_clicks", "profile_appearances", "slug", "fotoUrl", "crp"
                        FROM "Psychologists"
                        WHERE ${normCol} LIKE :w
                        ORDER BY (CASE WHEN status = 'active' THEN 1 ELSE 0 END) DESC, id DESC
                        LIMIT 1;
                    `, { replacements: { w: `%${words[0]}%` } });

                    if (rows && rows.length > 0) return rows[0];
                }
            } catch (nameErr) {
                console.warn("[AdminCopilotService] Erro ao buscar por nome desacentuado:", nameErr.message);
            }
        }

        return null;
    }

    /**
     * Constrói o dossiê 360º de inteligência do psicólogo
     */
    static async buildDossier(psychologistId) {
        if (!psychologistId) return null;

        const [psis] = await db.sequelize.query(`
            SELECT 
                id, nome, crp, email, telefone, slug, "fotoUrl", plano, status,
                "planExpiresAt", "subscriptionId", "subscription_payments_count", "is_exempt",
                "valor_sessao_numero", "tipo_cobranca", "valor_mensal_numero", "modalidade",
                cidade, estado, bio, temas_atuacao, abordagens_tecnicas, free_session_active,
                "whatsapp_clicks", "profile_appearances", "last_shown_match_at", "createdAt"
            FROM "Psychologists"
            WHERE id = :id;
        `, { replacements: { id: psychologistId } });

        if (!psis || psis.length === 0) return null;
        const psi = psis[0];

        // 1. Leads e Fechamentos do WhatsApp (dealClosed é varchar no Postgres)
        const [wppStats] = await db.sequelize.query(`
            SELECT 
                COUNT(*) as total_clicks,
                COUNT(*) FILTER (WHERE "dealClosed" IN ('yes', 'started', 'true')) as deals_closed,
                COUNT(*) FILTER (WHERE status = 'negotiating') as in_negotiation,
                COUNT(*) FILTER (WHERE "contactReceived" = true) as contacts_received
            FROM "WhatsAppClickLogs"
            WHERE "psychologistId" = :id;
        `, { replacements: { id: psychologistId } }).catch(err => {
            console.warn("[AdminCopilotService] Erro wppStats:", err.message);
            return [[{ total_clicks: 0, deals_closed: 0, in_negotiation: 0, contacts_received: 0 }]];
        });

        // 2. Artigos / Posts publicados no blog
        const [topPosts] = await db.sequelize.query(`
            SELECT id, titulo, curtidas, created_at
            FROM "posts"
            WHERE "psychologist_id" = :id
            ORDER BY curtidas DESC
            LIMIT 3;
        `, { replacements: { id: psychologistId } }).catch(() => [[]]);

        const [postCount] = await db.sequelize.query(`
            SELECT COUNT(*) as total FROM "posts" WHERE "psychologist_id" = :id;
        `, { replacements: { id: psychologistId } }).catch(() => [[{ total: 0 }]]);

        // 3. Conversas anteriores no Copilot
        let pastConversations = [];
        try {
            const [past] = await db.sequelize.query(`
                SELECT "detectedName", "aiResponse", "createdAt"
                FROM "AdminCopilotConversations"
                WHERE "psychologistId" = :id
                ORDER BY "createdAt" DESC
                LIMIT 2;
            `, { replacements: { id: psychologistId } });
            pastConversations = past || [];
        } catch (e) {}

        return {
            profile: psi,
            stats: wppStats[0] || {},
            posts: {
                total: parseInt(postCount[0]?.total || 0, 10),
                top: topPosts || []
            },
            pastConversations
        };
    }

    /**
     * Gera a resposta com Gemini seguindo rigorosamente a persona do Anderson Costa
     */
    static async generateResponse({ pastedChat, dossier, tone = 'natural' }) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY não configurada no servidor.");

        const genAI = new GoogleGenerativeAI(apiKey);
        const CANDIDATE_MODELS = [
            "gemini-3.5-flash-lite",
            "gemini-3.1-flash-lite"
        ];

        let contextBlock = "Nenhum psicólogo específico identificado automaticamente no banco de dados.";
        let pastContext = "";

        if (dossier && dossier.profile) {
            const p = dossier.profile;
            const s = dossier.stats || {};
            const posts = dossier.posts || { total: 0, top: [] };

            const valorFormatado = (p.valor_sessao_numero && Number(p.valor_sessao_numero) > 0)
                ? `R$ ${p.valor_sessao_numero}`
                : (p.tipo_cobranca === 'mensal' && p.valor_mensal_numero ? `R$ ${p.valor_mensal_numero}/mês` : 'A combinar (sem valor fixo cadastrado)');

            contextBlock = `
DOSSIÊ REAL DO PSICÓLOGO NO BANCO DE DADOS DA YELO:
- Nome Completo: ${p.nome} (CRP: ${p.crp || 'Não informado'})
- Situação do Plano: ${p.plano || 'Essencial'} (${p.status})
- Data de Validade/Renovação: ${p.planExpiresAt ? new Date(p.planExpiresAt).toLocaleDateString('pt-BR') : 'Sem data'}
- Mensalidades já pagas: ${p.subscription_payments_count || 0}
- Valor Cobrado: ${valorFormatado}
- Modalidade: ${Array.isArray(p.modalidade) ? p.modalidade.join(', ') : (p.modalidade || 'Online')} | Cidade: ${p.cidade || ''} - ${p.estado || ''}
- Abordagens/Especialidades: ${Array.isArray(p.abordagens_tecnicas) ? p.abordagens_tecnicas.join(', ') : (p.abordagens_tecnicas || 'Geral')}
- Métricas na Plataforma:
  * Aparições nas buscas (Match): ${p.profile_appearances || 0}
  * Cliques no WhatsApp: ${p.whatsapp_clicks || s.total_clicks || 0}
  * Pacientes Fechados confirmados: ${s.deals_closed || 0}
  * Pacientes em Negociação: ${s.in_negotiation || 0}
- Produção de Conteúdo no Blog da Yelo:
  * Total de artigos publicados: ${posts.total}
  ${posts.top.length > 0 ? `* Artigos com mais curtidas: ${posts.top.map(t => `"${t.titulo}" (${t.curtidas} curtidas)`).join(', ')}` : ''}
`;
            if (dossier.pastConversations && dossier.pastConversations.length > 0) {
                pastContext = `
HISTÓRICO DE RESPOSTAS ANTERIORES GERADAS PELO COPILOT PARA ESTE PSICÓLOGO:
${dossier.pastConversations.map(c => `- Resposta enviada em ${new Date(c.createdAt).toLocaleDateString('pt-BR')}: "${c.aiResponse.substring(0, 150)}..."`).join('\n')}
`;
            }
        }

        let toneInstruction = "Tom natural, parceiro e maduro (padrão de conversa entre psicólogos colegas).";
        if (tone === 'comercial') {
            toneInstruction = "Tom focado em quebra de objeção, clareza do modelo de ROI da Yelo (sem comissão, R$ 99 fixo que se paga com 2 sessões) e encorajamento prático para assinatura/continuidade.";
        } else if (tone === 'tecnico') {
            toneInstruction = "Tom focado em explicação técnica e prática de como a plataforma distribui pacientes (algoritmo V6) ou ajustes no perfil.";
        }

        const prompt = `Você é o Anderson Costa.
SOBRE VOCÊ:
- Você é homem, psicólogo clínico e o fundador da Yelo (plataforma de saúde mental).
- Você está respondendo uma mensagem real que um psicólogo parceiro te enviou no WhatsApp.
- Fale de psicólogo para psicólogo, como colega de profissão e parceiro que acompanha a clínica dele, e NUNCA como um atendente corporativo de suporte, telemarketing ou robô.

DIRETRIZ DE TOM (${toneInstruction}):
1. SUCINTO, DIRETO e NATURAL. Parágrafos curtos, escaneáveis e sem enrolação.
2. ZERO HIPÉRBOLES ou exageros artificiais de IA:
   - NÃO use "Que notícia maravilhosa!", "Isso é incrível!", "Compreendo perfeitamente sua dor", "Estou à sua inteira disposição".
   - Use linguagem humana e sóbria: "Que bacana", "Muito bom", "Eu entendo", "Faz todo sentido", "Tranquilo".
3. NÃO CHOVA NO MOLHADO:
   - Não fique repetindo para o psicólogo os títulos dos posts que ele mesmo escreveu ou listando métricas óbvias como se apresentasse um slide. Ele já sabe o que fez. Apenas valide e comente como colega.
4. NUNCA se apresente no início:
   - Não diga "Olá, aqui é o Anderson", "Sou o Anderson da Yelo" ou "Como fundador da Yelo". Ele já conversa com você no WhatsApp.
5. CONHECIMENTO ESSENCIAL DA YELO:
   - A Yelo NÃO cobra comissão sobre sessões (100% do valor da consulta vai para o psicólogo).
   - Plano Essencial é R$ 99,00 fixo por mês. Sem fidelidade (cancela quando quiser).
   - A matemática do consultório: com 2 sessões o custo do mês está pago. O paciente semanal gera retorno recorrente e o restante é lucro líquido do profissional.
   - O algoritmo V6 entrega pacientes qualificados respeitando tetos para que todos os pagantes recebam fluxo.
6. FORMATAÇÃO RÍGIDA DE WHATSAPP:
   - Use APENAS negrito nativo com um asterisco *assim* e itálico nativo _assim_.
   - NUNCA use duplo asterisco (**assim**).
   - NUNCA use títulos com hashtags (# Título).
   - NUNCA use marcadores com asterisco (* item) que quebram a leitura no WhatsApp.
   - Emojis com parcimônia (no máximo 1 como 🌿 se couber).

${contextBlock}
${pastContext}

CONVERSA COPIADA DO WHATSAPP:
"""
${pastedChat}
"""

Gere a resposta exata e pronta para o Anderson copiar e enviar no WhatsApp:`;

        let text = null;
        let lastErr = null;

        for (const modelName of CANDIDATE_MODELS) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent(prompt);
                text = result.response.text();
                if (text) break;
            } catch (err) {
                console.warn(`[AdminCopilotService] Falha no modelo ${modelName}:`, err.message);
                lastErr = err;
            }
        }

        if (!text) {
            throw new Error(`Falha ao gerar resposta via IA: ${lastErr?.message || 'Serviço de IA temporariamente indisponível'}`);
        }

        text = formatForWhatsApp(text);
        return text;
    }
}

module.exports = AdminCopilotService;

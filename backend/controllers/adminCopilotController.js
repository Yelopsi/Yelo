// backend/controllers/adminCopilotController.js
const db = require('../models');
const AdminCopilotService = require('../services/adminCopilotService');

/**
 * Rota: POST /api/admin/copilot/identify
 * Identifica o psicólogo no banco de dados a partir do texto colado (sem chamar o LLM)
 */
exports.identifyFromChat = async (req, res) => {
    try {
        const { pastedChat, psychologistId } = req.body;
        if (!pastedChat && !psychologistId) {
            return res.status(400).json({ error: 'Texto da conversa ou ID do psicólogo não fornecido.' });
        }

        let psychologist = null;
        let parseResult = { detectedSender: null, cleanName: null };

        if (psychologistId) {
            psychologist = { id: parseInt(psychologistId, 10) };
        } else if (pastedChat) {
            parseResult = AdminCopilotService.parsePastedChat(pastedChat);
            if (parseResult.cleanName || pastedChat) {
                psychologist = await AdminCopilotService.findPsychologist(parseResult.cleanName, pastedChat);
            }
        }

        let dossier = null;
        if (psychologist && psychologist.id) {
            dossier = await AdminCopilotService.buildDossier(psychologist.id);
        }

        res.json({
            detectedSender: parseResult.detectedSender,
            cleanName: parseResult.cleanName,
            psychologist: dossier ? dossier.profile : null,
            dossier
        });
    } catch (err) {
        console.error("Erro em identifyFromChat:", err);
        res.status(500).json({ error: 'Erro ao identificar psicólogo no chat.' });
    }
};

/**
 * Rota: POST /api/admin/copilot/respond
 * Processa a conversa, monta o dossiê e gera a resposta via IA
 */
exports.generateResponse = async (req, res) => {
    try {
        const { pastedChat, manualPsiId, tone } = req.body;
        if (!pastedChat || typeof pastedChat !== 'string') {
            return res.status(400).json({ error: 'Texto da conversa não fornecido.' });
        }

        // 1. Identificação automática ou manual
        let targetPsiId = manualPsiId ? parseInt(manualPsiId, 10) : null;
        let detectedName = null;

        if (!targetPsiId) {
            const parseResult = AdminCopilotService.parsePastedChat(pastedChat);
            detectedName = parseResult.detectedSender || parseResult.cleanName;
            const foundPsi = await AdminCopilotService.findPsychologist(parseResult.cleanName, pastedChat);
            if (foundPsi) targetPsiId = foundPsi.id;
        }

        // 2. Monta o Dossiê 360º
        let dossier = null;
        if (targetPsiId) {
            dossier = await AdminCopilotService.buildDossier(targetPsiId);
            if (dossier?.profile?.nome) detectedName = dossier.profile.nome;
        }

        // 3. Gera a resposta com Gemini
        const aiResponse = await AdminCopilotService.generateResponse({
            pastedChat,
            dossier,
            tone: tone || 'natural'
        });

        // 4. Salva no banco de dados para manter histórico
        let savedRecord = null;
        try {
            const [record] = await db.sequelize.query(`
                INSERT INTO "AdminCopilotConversations" 
                ("psychologistId", "detectedName", "rawPastedChat", "aiResponse", "contextSnapshot", "createdAt", "updatedAt")
                VALUES (:psiId, :name, :chat, :response, :snapshot, NOW(), NOW())
                RETURNING id, "createdAt";
            `, {
                replacements: {
                    psiId: targetPsiId,
                    name: detectedName || 'Desconhecido',
                    chat: pastedChat,
                    response: aiResponse,
                    snapshot: dossier ? JSON.stringify({
                        plano: dossier.profile.plano,
                        status: dossier.profile.status,
                        valor_sessao: dossier.profile.valor_sessao_numero,
                        whatsapp_clicks: dossier.profile.whatsapp_clicks,
                        profile_appearances: dossier.profile.profile_appearances
                    }) : null
                }
            });
            savedRecord = record && record[0];
        } catch (dbErr) {
            console.warn("Aviso ao persistir AdminCopilotConversations:", dbErr.message);
        }

        res.json({
            success: true,
            aiResponse,
            detectedPsychologist: dossier,
            conversationId: savedRecord?.id || null
        });
    } catch (err) {
        console.error("Erro em generateResponse:", err);
        res.status(500).json({ error: 'Erro ao gerar resposta da IA: ' + err.message });
    }
};

/**
 * Rota: GET /api/admin/copilot/history
 * Lista as últimas respostas geradas pelo Copilot
 */
exports.getHistory = async (req, res) => {
    try {
        const [rows] = await db.sequelize.query(`
            SELECT 
                c.id, c."psychologistId", c."detectedName", c."rawPastedChat", 
                c."aiResponse", c."contextSnapshot", c."createdAt",
                p.nome as psi_nome, p."fotoUrl", p.plano, p.status as psi_status
            FROM "AdminCopilotConversations" c
            LEFT JOIN "Psychologists" p ON p.id = c."psychologistId"
            ORDER BY c."createdAt" DESC
            LIMIT 20;
        `);

        res.json({ conversations: rows || [] });
    } catch (err) {
        console.error("Erro em getHistory:", err);
        res.status(500).json({ error: 'Erro ao buscar histórico do copilot.' });
    }
};

/**
 * Rota: GET /api/admin/copilot/search-psychologists
 * Busca rápida para seleção manual caso o admin prefira
 */
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
            SELECT id, nome, email, telefone, plano, status, "fotoUrl", "crp"
            FROM "Psychologists"
            WHERE ${normCol} LIKE :normQ 
               OR email ILIKE :q 
               ${digits.length >= 4 ? 'OR telefone LIKE :digits' : ''}
            ORDER BY (CASE WHEN status = 'active' THEN 1 ELSE 0 END) DESC, id DESC
            LIMIT 10;
        `, { replacements: { normQ: `%${normQ}%`, q: `%${query}%`, digits: `%${digits}%` } });

        res.json({ psychologists: rows || [] });
    } catch (err) {
        console.error("Erro em searchPsychologists:", err);
        res.status(500).json({ error: 'Erro ao buscar psicólogos.' });
    }
};

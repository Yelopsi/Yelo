const db = require('../models');
const { Op } = require('sequelize');
const { resolveActor } = require('../utils/actorClassifier');

const NON_PATIENT_TYPES = new Set([
    'psychologist',
    'psychologist_logged',
    'psychologist_unlogged',
    'psi',
    'admin',
    'admin_logged',
    'admin_unlogged'
]);

function normalizeRespondentType(rawType) {
    const val = String(rawType || '').trim().toLowerCase();
    if (NON_PATIENT_TYPES.has(val)) return val;
    return 'patient';
}

function resolveRespondentType(req, fallbackBody = {}) {
    return resolveActor(req, fallbackBody).actorType;
}

/**
 * Inicia o rastreamento de um questionário (Status: started)
 */
exports.startSearch = async (req, res) => {
    try {
        const body = (req.body && typeof req.body === 'object') ? req.body : {};
        const respondentType = resolveRespondentType(req, body);

        // Cria um registro, salvando o status e tipo de respondente dentro do JSON para consistência
        const search = await db.DemandSearch.create({
            searchParams: { 
                status: 'started', // Salva o status no JSON
                startedAt: new Date().toISOString(),
                respondent_type: respondentType
            }
        });
        // Retorna o ID para o Frontend salvar na sessão
        res.status(201).json({ searchId: search.id, respondent_type: respondentType });
    } catch (error) {
        console.error('Erro ao iniciar rastreamento:', error);
        res.status(500).json({ error: 'Erro ao iniciar.' });
    }
};

/**
 * Finaliza o questionário: Atualiza o rascunho com as respostas e muda status para 'completed'
 */
exports.recordSearch = async (req, res) => {
    try {
        let data = req.body;

        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) { return res.status(400).json({ error: "Formato inválido" }); }
        }
        data = (data && typeof data === 'object') ? data : {};
        const searchId = data.searchId;
        const resolvedType = resolveRespondentType(req, data);

        const finalPayload = { ...data };
        delete finalPayload.searchId;
        delete finalPayload.user_type;

        // [CORREÇÃO] Força 'organico' para qualquer usuário sem UTM
        if (!finalPayload.utm_source) {
            finalPayload.utm_source = 'organico';
        }

        if (data.avaliacao_ux) {
            finalPayload.rating = data.avaliacao_ux.rating;
            finalPayload.feedback = data.avaliacao_ux.feedback;
        }

        if (searchId) {
            // CENÁRIO A: Atualiza o rascunho existente preservando metadados (ex: respondent_type)
            const existing = await db.DemandSearch.findByPk(searchId, { attributes: ['id', 'searchParams'] }).catch(() => null);
            const existingParams = (existing && existing.searchParams && typeof existing.searchParams === 'object')
                ? existing.searchParams
                : {};
            const existingType = normalizeRespondentType(existingParams.respondent_type);
            const finalRespondentType = NON_PATIENT_TYPES.has(resolvedType)
                ? resolvedType
                : (NON_PATIENT_TYPES.has(existingType) ? existingType : 'patient');

            await db.DemandSearch.update({
                searchParams: {
                    ...existingParams,
                    ...finalPayload,
                    respondent_type: finalRespondentType
                },
                completedAt: new Date(), // [ESTRATÉGICO] Salva data exata da conclusão para cálculo de duração
                status: 'completed' // <--- CORREÇÃO: Atualiza a coluna de status
            }, {
                where: { id: searchId }
            });
        } else {
            // CENÁRIO B: Fallback (Cria novo se perdeu o ID)
            await db.DemandSearch.create({
                searchParams: {
                    ...finalPayload,
                    respondent_type: resolvedType
                },
                completedAt: new Date(),
                status: 'completed' // <--- CORREÇÃO: Já cria como concluído
            });
        }

        res.status(201).json({ message: 'Busca finalizada com sucesso!' });

    } catch (error) {
        console.error('[DEBUG] Erro ao finalizar questionário:', error);
        res.status(500).json({ error: 'Erro interno ao salvar dados.' });
    }
};

/**
 * Busca as avaliações lendo de dentro do JSON (PostgreSQL)
 */
exports.getRatings = async (req, res) => {
    try {
        if (!req.userDecoded || (req.userDecoded.role !== 'admin' && req.userDecoded.type !== 'admin')) {
            return res.status(403).json({ error: 'Acesso negado' });
        }
        
        // SQL Otimizado para ler campos dentro do JSONB (searchParams ->> 'rating')
        /// a sintaxe (searchParams->>'rating') extrai o valor como texto
        
        const [stats] = await db.sequelize.query(`
            SELECT 
                AVG(CAST("searchParams"->>'rating' AS FLOAT))::numeric(10,1) as media, 
                COUNT(*) as total 
            FROM "DemandSearches" 
            WHERE "searchParams"->>'rating' IS NOT NULL
        `);

        const [reviews] = await db.sequelize.query(`
            SELECT 
                "searchParams"->>'rating' as rating, 
                "searchParams"->>'feedback' as feedback, 
                "createdAt"
            FROM "DemandSearches"
            WHERE "searchParams"->>'rating' IS NOT NULL
            ORDER BY "createdAt" DESC
            LIMIT 50
        `);

        res.json({
            stats: stats[0] || { media: 0, total: 0 },
            reviews: reviews || []
        });

    } catch (error) {
        console.error('Erro ao buscar avaliações (Admin):', error);
        // Fallback para array vazio para não quebrar o painel
        res.json({ stats: { media: 0, total: 0 }, reviews: [] });
    }
};

/**
 * Rota: POST /api/demand/visit
 * Descrição: Contador simples de acessos (Pixel de Rastreamento)
 */
exports.recordVisit = async (req, res) => {
    try {
        const page = req.body?.page || 'home';
        const actor = resolveActor(req, { ...(req.body || {}), page });

        await db.SiteVisit.create({ 
            page,
            actor_type: actor.actorType
        });
        res.status(200).send('ok'); // Resposta leve e rápida
    } catch (error) {
        // Falha silenciosa para não atrapalhar a navegação do usuário
        console.error('Erro ao registrar visita:', error.message);
        res.status(200).send('ok'); 
    }
};
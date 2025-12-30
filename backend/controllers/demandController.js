const db = require('../models');
const { Op } = require('sequelize');

/**
 * Inicia o rastreamento de um questionário (Status: started)
 */
exports.startSearch = async (req, res) => {
    try {
        // Cria um registro, salvando o status dentro do JSON para consistência
        const search = await db.DemandSearch.create({
            searchParams: { 
                status: 'started', // Salva o status no JSON
                startedAt: new Date().toISOString() 
            }
        });
        // Retorna o ID para o Frontend salvar na sessão
        res.status(201).json({ searchId: search.id });
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
        const searchId = data.searchId; 

        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) { return res.status(400).json({ error: "Formato inválido" }); }
        }
        const finalPayload = { ...data };
        delete finalPayload.searchId; 

        if (data.avaliacao_ux) {
            finalPayload.rating = data.avaliacao_ux.rating;
            finalPayload.feedback = data.avaliacao_ux.feedback;
        }

        if (searchId) {
            // CENÁRIO A: Atualiza o rascunho existente
            await db.DemandSearch.update({
                searchParams: finalPayload,
                completedAt: new Date(), // [ESTRATÉGICO] Salva data exata da conclusão para cálculo de duração
                status: 'completed' // <--- CORREÇÃO: Atualiza a coluna de status
            }, {
                where: { id: searchId }
            });
        } else {
            // CENÁRIO B: Fallback (Cria novo se perdeu o ID)
            await db.DemandSearch.create({
                searchParams: finalPayload,
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
        // SQL Otimizado para ler campos dentro do JSONB (searchParams ->> 'rating')
        // A sintaxe (searchParams->>'rating') extrai o valor como texto
        
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
        // [ESTRATÉGICO] Captura metadados ricos para igualar ao middleware do server.js
        const userAgent = req.headers['user-agent'] || 'Unknown';
        const referrer = req.headers['referer'] || null;
        
        await db.SiteVisit.create({ 
            page: req.body.page || 'home',
            userAgent: userAgent,
            referrer: referrer
        });
        res.status(200).send('ok'); // Resposta leve e rápida
    } catch (error) {
        // Falha silenciosa para não atrapalhar a navegação do usuário
        console.error('Erro ao registrar visita:', error.message);
        res.status(200).send('ok'); 
    }
};
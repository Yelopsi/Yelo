// Arquivo: backend/controllers/matchController.js
const db = require('../models');
const { Op } = require('sequelize');
const crypto = require('crypto');
const matchService = require('../services/matchService'); // Algoritmo unificado de Match

// --- CACHE DE IDEMPOTÊNCIA PARA EVITAR SUPERCONTAGEM (F5) ---
const recentMatchesCache = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of recentMatchesCache.entries()) {
        if (now - timestamp > 15 * 60 * 1000) recentMatchesCache.delete(key); // Limpa após 15 min
    }
}, 5 * 60 * 1000);

// Flag global de otimização: Evita executar ALTER TABLE em todas as buscas de Match
let matchSchemaChecked = false;

// Função auxiliar para proteger a privacidade do paciente nas avaliações (Ex: "Suzana Gomes" -> "Suzana G.")
const formatPatientName = (name) => {
    if (!name || name === 'Anônimo') return 'Anônimo';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
};

// ----------------------------------------------------------------------
// Rota: GET /api/psychologists/matches (Rota Protegida - Usuário Logado)
// ----------------------------------------------------------------------
exports.getPatientMatches = async (req, res) => {
    try {
        const patient = req.patient;

        if (!patient) {
            return res.status(401).json({ error: 'Paciente não autenticado.' });
        }

        // --- CORREÇÃO: Normaliza as preferências do paciente para o formato esperado pelo motor de match ---
        // O motor de match espera as mesmas chaves enviadas pelo questionário anônimo.
        const patientPreferences = {
            faixa_valor: patient.valor_sessao_faixa,
            temas: patient.temas_buscados || [],
            pref_genero_prof: patient.genero_profissional,
            caracteristicas_prof: patient.praticas_afirmativas || [],
            idade: patient.idade || '',
            modalidade_atendimento: patient.modalidade_preferida
        };

        // Validação rápida se o perfil está vazio
        const hasData = patientPreferences.faixa_valor || (patientPreferences.temas && patientPreferences.temas.length > 0);
        if (!hasData) {
            return res.status(200).json({
                message: 'Por favor, preencha o questionário para encontrar psicólogos compatíveis.',
                matchTier: 'none',
                results: []
            });
        }

        // Gera Hash Único da Busca para evitar contar F5 repetido na mesma sessão
        const matchHash = crypto.createHash('md5').update(JSON.stringify(patientPreferences) + patient.id).digest('hex');
        const isDuplicate = recentMatchesCache.has(matchHash);
        recentMatchesCache.set(matchHash, Date.now());

        // --- A MÁGICA ACONTECE AQUI ---
        const matchResult = await matchService.calculateMatches(patientPreferences);

        // --- FIX DOS PREÇOS ---
        // Garante que os valores financeiros sejam enviados ao frontend (caso o algoritmo matchService os omita)
        if (matchResult && matchResult.results) {
            for (let psi of matchResult.results) {
                if (psi.valor_sessao_numero === undefined || psi.tipo_cobranca === undefined) {
                    const dbPsi = await db.Psychologist.findByPk(psi.id, { attributes: ['valor_sessao_numero', 'valor_mensal_numero', 'tipo_cobranca'] });
                    if (dbPsi) {
                        psi.valor_sessao_numero = dbPsi.valor_sessao_numero;
                        psi.valor_mensal_numero = dbPsi.valor_mensal_numero;
                        psi.tipo_cobranca = dbPsi.tipo_cobranca;
                    }
                }
            }
        }

        // --- LOG DE EVENTO DE MATCH E UPDATE DE FAIRNESS ---
        if (!isDuplicate && matchResult && matchResult.results && matchResult.results.length > 0) {
            const matchEvents = matchResult.results.map(psi => ({
                psychologistId: psi.id,
                patientId: patient ? patient.id : null, // Suporta tanto usuário logado quanto anônimo
                matchScore: psi.matchScore,
                source: patient ? 'patient_dashboard' : 'questionnaire'
            }));
            try {
                // 1. Garantia de Colunas (Executa apenas UMA VEZ na vida útil do servidor para evitar gargalo de I/O)
                if (!matchSchemaChecked) {
                    await db.sequelize.query(`
                        CREATE TABLE IF NOT EXISTS "MatchEvents" (
                            "id" SERIAL PRIMARY KEY,
                            "psychologistId" INTEGER,
                            "patientId" INTEGER,
                            "matchTags" TEXT[], 
                            "matchScore" FLOAT,
                            "source" VARCHAR(255),
                            "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                            "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                        );
                    `).catch(() => {});
                    await db.sequelize.query(`ALTER TABLE "MatchEvents" ADD COLUMN IF NOT EXISTS "patientId" INTEGER, ADD COLUMN IF NOT EXISTS "source" VARCHAR(255), ADD COLUMN IF NOT EXISTS "matchScore" FLOAT;`).catch(() => {});
                    await db.sequelize.query(`ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "last_shown_match_at" TIMESTAMP WITH TIME ZONE;`).catch(() => {});
                    matchSchemaChecked = true;
                }

                for (const event of matchEvents) {
                    await db.sequelize.query(
                        `INSERT INTO "MatchEvents" ("psychologistId", "patientId", "matchScore", "source", "createdAt", "updatedAt") VALUES (:psychologistId, :patientId, :matchScore, :source, NOW(), NOW())`,
                        { replacements: event, type: db.sequelize.QueryTypes.INSERT }
                    );
                }

                // 2. ATUALIZA O COOLDOWN E AS IMPRESSÕES (A Mágica do UCB)
                const idsParaAtualizar = matchResult.results.map(psi => psi.id);
                if (idsParaAtualizar.length > 0) {
                    await db.sequelize.query(
                        `UPDATE "Psychologists" 
                         SET profile_appearances = profile_appearances + 1, 
                             last_shown_match_at = NOW() 
                         WHERE id IN (:ids)`,
                        { 
                            replacements: { ids: idsParaAtualizar }, 
                            type: db.sequelize.QueryTypes.UPDATE 
                        }
                    );
                }
            } catch (err) {
                console.error("Erro ao registrar evento de match: ", err);
            }
        }

        res.status(200).json({
            message: matchResult.matchTier === 'ideal' ? 'Psicólogos compatíveis encontrados!' : 'Psicólogos próximos encontrados!',
            matchTier: matchResult.matchTier,
            results: matchResult.results,
            compromiseText: matchResult.compromiseText
        });

    } catch (error) {
        res.status(500).json({ error: 'Erro interno no servidor ao buscar psicólogos compatíveis.' });
    }
};

// ----------------------------------------------------------------------
// Rota: POST /api/psychologists/match (Endpoint Público - Anônimo)
// ----------------------------------------------------------------------
exports.getAnonymousMatches = async (req, res) => {
    try {
        // As respostas do questionário (req.body) já vêm no formato que o motor de match espera.
        // Não é necessário remapear as chaves.
        const patientPreferences = req.body;

        if (!patientPreferences.faixa_valor) {
             return res.status(400).json({ error: 'Faixa de valor é obrigatória.' });
        }

        // Gera Hash Único da Busca usando o IP para anônimos
        const userIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'anon';
        const matchHash = crypto.createHash('md5').update(JSON.stringify(patientPreferences) + userIp).digest('hex');
        const isDuplicate = recentMatchesCache.has(matchHash);
        recentMatchesCache.set(matchHash, Date.now());

        // Reutiliza a MESMA lógica do usuário logado
        const matchResult = await matchService.calculateMatches(patientPreferences);

        // --- FIX DOS PREÇOS ---
        // Garante que os valores financeiros sejam enviados ao frontend (caso o algoritmo matchService os omita)
        if (matchResult && matchResult.results) {
            for (let psi of matchResult.results) {
                if (psi.valor_sessao_numero === undefined || psi.tipo_cobranca === undefined) {
                    const dbPsi = await db.Psychologist.findByPk(psi.id, { attributes: ['valor_sessao_numero', 'valor_mensal_numero', 'tipo_cobranca'] });
                    if (dbPsi) {
                        psi.valor_sessao_numero = dbPsi.valor_sessao_numero;
                        psi.valor_mensal_numero = dbPsi.valor_mensal_numero;
                        psi.tipo_cobranca = dbPsi.tipo_cobranca;
                    }
                }
            }
        }

        const patient = null; // Declarado para não quebrar o bloco unificado

        // --- LOG DE EVENTO DE MATCH E UPDATE DE FAIRNESS ---
        if (!isDuplicate && matchResult && matchResult.results && matchResult.results.length > 0) {
            const matchEvents = matchResult.results.map(psi => ({
                psychologistId: psi.id,
                patientId: patient ? patient.id : null, // Suporta tanto usuário logado quanto anônimo
                matchScore: psi.matchScore,
                source: patient ? 'patient_dashboard' : 'questionnaire'
            }));
            try {
                // 1. Garantia de Colunas (Executa apenas UMA VEZ na vida útil do servidor para evitar gargalo de I/O)
                if (!matchSchemaChecked) {
                    await db.sequelize.query(`
                        CREATE TABLE IF NOT EXISTS "MatchEvents" (
                            "id" SERIAL PRIMARY KEY,
                            "psychologistId" INTEGER,
                            "patientId" INTEGER,
                            "matchTags" TEXT[], 
                            "matchScore" FLOAT,
                            "source" VARCHAR(255),
                            "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                            "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                        );
                    `).catch(() => {});
                    await db.sequelize.query(`ALTER TABLE "MatchEvents" ADD COLUMN IF NOT EXISTS "patientId" INTEGER, ADD COLUMN IF NOT EXISTS "source" VARCHAR(255), ADD COLUMN IF NOT EXISTS "matchScore" FLOAT;`).catch(() => {});
                    await db.sequelize.query(`ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "last_shown_match_at" TIMESTAMP WITH TIME ZONE;`).catch(() => {});
                    matchSchemaChecked = true;
                }

                for (const event of matchEvents) {
                    await db.sequelize.query(
                        `INSERT INTO "MatchEvents" ("psychologistId", "patientId", "matchScore", "source", "createdAt", "updatedAt") VALUES (:psychologistId, :patientId, :matchScore, :source, NOW(), NOW())`,
                        { replacements: event, type: db.sequelize.QueryTypes.INSERT }
                    );
                }

                // 2. ATUALIZA O COOLDOWN E AS IMPRESSÕES (A Mágica do UCB)
                const idsParaAtualizar = matchResult.results.map(psi => psi.id);
                if (idsParaAtualizar.length > 0) {
                    await db.sequelize.query(
                        `UPDATE "Psychologists" 
                         SET profile_appearances = profile_appearances + 1, 
                             last_shown_match_at = NOW() 
                         WHERE id IN (:ids)`,
                        { 
                            replacements: { ids: idsParaAtualizar }, 
                            type: db.sequelize.QueryTypes.UPDATE 
                        }
                    );
                }
            } catch (err) {
                console.error("Erro ao registrar evento de match: ", err);
            }
        }

        res.status(200).json(matchResult);

    } catch (error) {
        res.status(500).json({ error: 'Erro interno no servidor ao buscar recomendações.' });
    }
};

// ----------------------------------------------------------------------
// Rota: GET /api/psychologists/showcase
// ----------------------------------------------------------------------
exports.getShowcasePsychologists = async (req, res) => {
    try {
        // Lê o limite da URL ou usa 4 como padrão para não quebrar outras páginas (ex: Home)
        const limit = parseInt(req.query.limit, 10) || 4;
        const dbLimit = limit > 4 ? limit * 2 : 20; // Busca um pouco mais no DB para compensar possíveis inativos

        const psychologists = await db.Psychologist.findAll({
            where: {
                fotoUrl: { [Op.ne]: null }
            },
            order: db.sequelize.random(), 
            limit: dbLimit, 
            attributes: ['id', 'nome', 'slug', 'fotoUrl', 'status', 'createdAt', 'planExpiresAt', 'is_exempt'] 
        });

        const agora = new Date();
        const validPsychologists = psychologists.map(psy => {
            let isActive = psy.status === 'active';
            const isVip = psy.is_exempt === true || String(psy.is_exempt).toLowerCase() === 'true' || psy.is_exempt === 1;
            
            if (!isVip && (!psy.planExpiresAt || new Date(psy.planExpiresAt) <= agora)) {
                isActive = false;
            }
            
            const psyData = psy.toJSON ? psy.toJSON() : { ...psy };
            // Se o psicólogo estiver inativo ou com plano vencido, anulamos o link de perfil dele.
            if (!isActive) psyData.slug = null; 
            
            return psyData;
        }).slice(0, limit);

        while (validPsychologists.length < 4) {
            validPsychologists.push({
                id: 0,
                nome: "Em breve",
                fotoUrl: "https://images.pexels.com/photos/3769021/pexels-photo-3769021.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1"
            });
        }

        res.status(200).json(validPsychologists);
    } catch (error) {
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

// ----------------------------------------------------------------------
// Rota: GET /api/psychologists/slug/:slug (VERSÃO DESTRAVADA PARA DEV)
// ----------------------------------------------------------------------
exports.getProfileBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const psychologist = await db.Psychologist.findOne({
      where: { slug: { [Op.iLike]: slug } }, 
      attributes: { exclude: ['senha', 'resetPasswordToken', 'resetPasswordExpires', 'cpf'] },
    });

    if (!psychologist) {
      return res.status(404).json({ error: 'Perfil não encontrado.' });
    }

    if (psychologist.status === 'content_creator') {
        return res.status(404).json({ error: 'Perfil não encontrado.' });
    }

    const hoje = new Date();
    const validade = psychologist.planExpiresAt ? new Date(psychologist.planExpiresAt) : null;
    const status = psychologist.status;
    const isVip = psychologist.is_exempt === true || String(psychologist.is_exempt).toLowerCase() === 'true' || psychologist.is_exempt === 1;

    if (!isVip) {
        if (!validade || validade <= hoje) {
            return res.status(404).json({ error: 'Perfil indisponível (Assinatura inativa).' });
        }
    }
    
    if (status !== 'active') {
        return res.status(404).json({ error: 'Perfil indisponível no momento.' });
    }

    const reviews = await db.Review.findAll({
      where: { psychologistId: psychologist.id },
      include: [{ model: db.Patient, as: 'patient', attributes: ['nome'] }],
      order: [['createdAt', 'DESC']]
    });

    const responseData = {
      ...psychologist.toJSON(),
      reviews: reviews.map(r => ({
        id: r.id,
        rating: r.rating,
        comment: (r.comment === 'null' || r.comment === null) ? '' : r.comment,
        patientName: formatPatientName(r.patient?.nome),
        createdAt: r.createdAt
      }))
    };
    res.status(200).json(responseData);
  } catch (error) { res.status(500).json({ error: 'Erro interno no servidor.' }); }
};

// ----------------------------------------------------------------------
// Rota: GET /api/psychologists/:id
// ----------------------------------------------------------------------
exports.getPsychologistProfile = async (req, res) => {
    try {
        const { id } = req.params;
        if (!/^\d+$/.test(id)) return res.status(404).json({ error: 'ID inválido ou rota não encontrada.' });

        const psychologist = await db.Psychologist.findByPk(id, { attributes: { exclude: ['senha', 'resetPasswordToken', 'resetPasswordExpires'] } });
        if (!psychologist) return res.status(404).json({ error: 'Psicólogo não encontrado.' });

        const isVip = psychologist.is_exempt === true || String(psychologist.is_exempt).toLowerCase() === 'true' || psychologist.is_exempt === 1;
        const hoje = new Date();
        const validade = psychologist.planExpiresAt ? new Date(psychologist.planExpiresAt) : null;
        
        if (!isVip && (!validade || validade <= hoje)) return res.status(404).json({ error: 'Perfil indisponível (Assinatura inativa).' });
        if (psychologist.status !== 'active') return res.status(404).json({ error: 'Perfil indisponível no momento.' });

        const reviews = await db.Review.findAll({ where: { psychologistId: id }, include: [{ model: db.Patient, as: 'patient', attributes: ['nome'] }], order: [['createdAt', 'DESC']] });

        const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
        const average_rating = reviews.length > 0 ? (totalRating / reviews.length).toFixed(1) : 0;

        const psychologistData = {
            ...psychologist.toJSON(),
            average_rating, review_count: reviews.length,
            reviews: reviews.map(r => { const rev = r.toJSON(); if (rev.patient && rev.patient.nome) { rev.patient.nome = formatPatientName(rev.patient.nome); } rev.comment = (rev.comment === 'null' || rev.comment === null) ? '' : rev.comment; return rev; })
        };
        res.status(200).json(psychologistData);
    } catch (error) { res.status(500).json({ error: 'Erro interno no servidor.' }); }
};

// ----------------------------------------------------------------------
// Rota: GET /api/psychologists/:id/reviews
// ----------------------------------------------------------------------
exports.getPsychologistReviews = async (req, res) => {
    try {
        const { id } = req.params;
        const reviews = await db.Review.findAll({
            where: { psychologistId: id },
            include: [{ model: db.Patient, as: 'patient', attributes: ['nome', 'fotoUrl'] }], 
            order: [['createdAt', 'DESC']]
        });

        const formattedReviews = reviews.map(r => {
            const rev = r.toJSON();
            if (rev.patient && rev.patient.nome) rev.patient.nome = formatPatientName(rev.patient.nome);
            rev.comment = (rev.comment === 'null' || rev.comment === null) ? '' : rev.comment;
            return rev;
        });
        return res.json({ reviews: formattedReviews }); 
    } catch (error) { res.status(500).json({ error: 'Erro interno no servidor ao buscar avaliações.' }); }
};
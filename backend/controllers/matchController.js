// Arquivo: backend/controllers/matchController.js
const db = require('../models');
const { Op } = require('sequelize');
const crypto = require('crypto');
const matchService = require('../services/matchService'); // Algoritmo unificado de Match

// --- CACHE LRU (Evitar Denial of Wallet e DB Exhaustion) ---
class MatchLRUCache {
    constructor(maxSize, ttlMs) {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.ttlMs = ttlMs;
    }
    get(key) {
        if (!this.cache.has(key)) return null;
        const entry = this.cache.get(key);
        if (Date.now() - entry.timestamp > this.ttlMs) {
            this.cache.delete(key);
            return null;
        }
        // LRU Update: remove e reinsere no final
        this.cache.delete(key);
        this.cache.set(key, entry);
        return entry.data;
    }
    set(key, data) {
        if (this.cache.has(key)) this.cache.delete(key);
        if (this.cache.size >= this.maxSize) {
            this.cache.delete(this.cache.keys().next().value); // Evicção do mais antigo
        }
        this.cache.set(key, { data, timestamp: Date.now() });
    }
}
const recentMatchesCache = new MatchLRUCache(1000, 5 * 60 * 1000); // Max 1000 items, 5 minutos TTL

// --- INPUT VALIDATION & SANITIZATION ---
const validateAndSanitizeMatchPreferences = (prefs) => {
    // 1. Rejeita estruturalmente inválido
    if (!prefs || typeof prefs !== 'object') throw new Error('Preferências inválidas.');
    if (JSON.stringify(prefs).length > 2000) throw new Error('Payload excessivo.');

    const sanitizeString = (str) => {
        if (typeof str !== 'string') return '';
        return str.substring(0, 50).trim();
    };

    const sanitizeArray = (arr) => {
        if (Array.isArray(arr)) {
            if (arr.length > 5) throw new Error('Número máximo de opções excedido.');
            return arr.map(sanitizeString);
        } else if (typeof arr === 'string') {
            return [sanitizeString(arr)];
        }
        return [];
    };

    return {
        faixa_valor: sanitizeString(prefs.faixa_valor),
        temas: sanitizeArray(prefs.temas),
        pref_genero_prof: sanitizeString(prefs.pref_genero_prof),
        caracteristicas_prof: sanitizeArray(prefs.caracteristicas_prof),
        idade: sanitizeString(prefs.idade),
        modalidade_atendimento: sanitizeString(prefs.modalidade_atendimento),
        abordagem_ideal: sanitizeString(prefs.abordagem_ideal)
    };
};

// Flag global de otimização: Evita executar ALTER TABLE em todas as buscas de Match
let matchSchemaChecked = false;

// --- SINGLE FLIGHT (Deduplicação de Promises em Voo) ---
const inFlightMatches = new Map();

async function executeMatchSingleFlight(safePreferences, matchHash, patient) {
    if (inFlightMatches.has(matchHash)) {
        return await inFlightMatches.get(matchHash);
    }

    const matchPromise = (async () => {
        const matchResult = await matchService.calculateMatches(safePreferences);

        // Garante que os valores financeiros sejam enviados ao frontend
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
        if (matchResult && matchResult.results && matchResult.results.length > 0) {
            const matchEvents = matchResult.results.map(psi => ({
                psychologistId: psi.id,
                patientId: patient ? patient.id : null,
                matchScore: psi.matchScore,
                source: patient ? 'patient_dashboard' : 'questionnaire',
                explainability_log: psi.explainability ? JSON.stringify(psi.explainability) : null,
                ai_justification: psi.matchReasons || null
            }));
            try {
                if (!matchSchemaChecked) {
                    await db.sequelize.query(`
                        CREATE TABLE IF NOT EXISTS "MatchEvents" (
                            "id" SERIAL PRIMARY KEY,
                            "psychologistId" INTEGER,
                            "patientId" INTEGER,
                            "matchTags" TEXT[], 
                            "matchScore" FLOAT,
                            "source" VARCHAR(255),
                            "explainability_log" JSONB,
                            "ai_justification" TEXT,
                            "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                            "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                        );
                    `).catch(() => {});
                    await db.sequelize.query(`ALTER TABLE "MatchEvents" ADD COLUMN IF NOT EXISTS "patientId" INTEGER, ADD COLUMN IF NOT EXISTS "source" VARCHAR(255), ADD COLUMN IF NOT EXISTS "matchScore" FLOAT, ADD COLUMN IF NOT EXISTS "explainability_log" JSONB, ADD COLUMN IF NOT EXISTS "ai_justification" TEXT;`).catch(() => {});
                    await db.sequelize.query(`ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "last_shown_match_at" TIMESTAMP WITH TIME ZONE;`).catch(() => {});
                    matchSchemaChecked = true;
                }

                for (const event of matchEvents) {
                    await db.sequelize.query(
                        `INSERT INTO "MatchEvents" ("psychologistId", "patientId", "matchScore", "source", "explainability_log", "ai_justification", "createdAt", "updatedAt") VALUES (:psychologistId, :patientId, :matchScore, :source, :explainability_log, :ai_justification, NOW(), NOW())`,
                        { replacements: event, type: db.sequelize.QueryTypes.INSERT }
                    );
                }

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

        // O payload exato que a rota devolverá
        const finalPayload = {
            message: matchResult.matchTier === 'ideal' ? 'Psicólogos compatíveis encontrados!' : 'Psicólogos próximos encontrados!',
            matchTier: matchResult.matchTier,
            results: matchResult.results,
            compromiseText: matchResult.compromiseText
        };
        
        // Salva no cache LRU ANTES de resolver a promise
        recentMatchesCache.set(matchHash, finalPayload);
        
        return finalPayload;
    })();

    inFlightMatches.set(matchHash, matchPromise);

    try {
        return await matchPromise;
    } finally {
        // Remove do inFlight, garantindo que não cresça indefinidamente 
        // e que novas requisições em caso de falha possam ser retentadas
        inFlightMatches.delete(matchHash);
    }
}


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

        const safePreferences = validateAndSanitizeMatchPreferences(patientPreferences);

        // Gera Hash Único da Busca para cachear o resultado
        const matchHash = crypto.createHash('md5').update(JSON.stringify(safePreferences) + patient.id).digest('hex');
        
        // --- EARLY RETURN (CACHE HIT) ---
        const cachedResult = recentMatchesCache.get(matchHash);
        if (cachedResult) {
            return res.status(200).json(cachedResult);
        }

        const authenticatedPatient = await db.Patient.findByPk(req.user.id);
        const finalPayload = await executeMatchSingleFlight(safePreferences, matchHash, authenticatedPatient);
        
        res.status(200).json(finalPayload);

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

        let safePreferences;
        try {
            safePreferences = validateAndSanitizeMatchPreferences(patientPreferences);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }

        // Gera Hash Único da Busca usando o IP para anônimos
        const userIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'anon';
        const matchHash = crypto.createHash('md5').update(JSON.stringify(safePreferences) + userIp).digest('hex');
        
        // --- EARLY RETURN (CACHE HIT) ---
        const cachedResult = recentMatchesCache.get(matchHash);
        if (cachedResult) {
            return res.status(200).json(cachedResult);
        }

        const finalPayload = await executeMatchSingleFlight(safePreferences, matchHash, null);
        res.status(200).json(finalPayload);

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
const db = require('../models');
const { Op } = require('sequelize');

// Variaveis globais de cache para o Motor de Match (Ponto 3)
let cachedTotalImpressions = null;
let lastImpressionCacheTime = 0;

// Pesos Globais da Yelo
const WEIGHTS = {
    CLINICAL: 0.65,
    OPERATIONAL: 0.35,
    UCB_EXPLORATION_RATE: 2.0 // Define a força com que o sistema testa novatos
};

const MAPA_CARACTERISTICAS = {
    "LGBTQIAPN+ Friendly 🏳️‍🌈": ["LGBTQIAPN+ Friendly 🏳️‍🌈", "LGBTQIAPN+ friendly", "Afirmativa"],
    "Que faça parte da comunidade LGBTQIAPN+": ["Faz parte da comunidade LGBTQIAPN+ / Afirmativa", "Comunidade LGBTQIAPN+", "Que faça parte da comunidade LGBTQIAPN+"],
    "Pessoa não-branca ou com prática antirracista": ["Pessoa não-branca // Prática Antirracista", "Antirracista", "Negritude", "Pessoa não-branca // Antirracista", "Que seja uma pessoa não-branca (racializada) / prática antirracista"],
    "Que tenha uma perspectiva feminista": ["Perspectiva Feminista", "Feminista", "Perspetiva feminista", "Que tenha uma perspectiva feminista"],
    "Especialista em Neurodiversidade (TDAH, Autismo)": ["Neurodiversidade (TDAH, Autismo)", "Neurodiversidade", "TDAH", "Autismo", "Que entenda de neurodiversidade (TDAH, Autismo, etc.)"]
};

const parsePriceRange = (rangeString) => {
    if (!rangeString || typeof rangeString !== 'string') return { min: 0, max: 9999 };
    if (rangeString.toLowerCase().includes('acima')) return { min: 150, max: 9999 }; // Corrige o teto ilimitado para pacientes premium
    const numbers = rangeString.match(/\d+/g);
    if (!numbers || numbers.length === 0) return { min: 0, max: 9999 };
    const min = parseInt(numbers[0], 10);
    const max = numbers.length > 1 ? parseInt(numbers[1], 10) : min;
    return { min, max };
};

const getArrayField = (field) => {
    if (Array.isArray(field)) return field;
    if (typeof field === 'string') {
        try { return field.trim().startsWith('[') ? JSON.parse(field) : [field]; } 
        catch (e) { return []; }
    }
    return [];
};

const mapAgeToTarget = (idadeStr) => {
    if (!idadeStr) return [];
    if (idadeStr.includes("Menor de 18")) return ["Crianças", "Adolescentes"];
    if (idadeStr.includes("55+")) return ["Idosos", "Adultos"];
    return ["Adultos"];
};

// --- L1: DATABASE PRE-FILTER ---
const fetchEligibleCandidates = async (preferences, priceRange, relaxFilters = false) => {
    const agora = new Date();
    
    const prefMod = preferences.modalidade_preferida;
    const requiresSpecificModality = prefMod && prefMod !== 'Indiferente' && prefMod !== 'Indiferente (Online ou Presencial)';

    const whereConditions = { 
        status: 'active',
        fotoUrl: { [Op.ne]: null }, // Exige foto
        [Op.and]: [
            // Exige biografia com pelo menos 10 caracteres
            db.sequelize.where(db.sequelize.fn('LENGTH', db.sequelize.fn('TRIM', db.sequelize.col('bio'))), { [Op.gte]: 10 }),
            // Exige que seja VIP/Isento OU que o plano ainda não tenha vencido
            {
                [Op.or]: [
                    { is_exempt: true },
                    { planExpiresAt: { [Op.gt]: agora } }
                ]
            }
        ]
    };

    // Ponto 4: Filtro de Modalidade movido para o Banco de Dados com Cast seguro (ILIKE)
    if (requiresSpecificModality && !relaxFilters) {
        whereConditions[Op.and].push({
            [Op.or]: [
                db.sequelize.where(db.sequelize.cast(db.sequelize.col('modalidade'), 'text'), { [Op.iLike]: `%${prefMod}%` }),
                db.sequelize.where(db.sequelize.cast(db.sequelize.col('modalidade'), 'text'), { [Op.iLike]: `%Indiferente%` })
            ]
        });
    }

    // Busca Super Otimizada: O banco de dados faz todo o filtro pesado de eligibilidade
    const eligibleCandidates = await db.Psychologist.findAll({
        where: whereConditions,
        attributes: [
            'id', 'nome', 'fotoUrl', 'bio', 'slug', 'status', 'is_exempt', 'planExpiresAt',
            'temas_atuacao', 'publico_alvo', 'valor_sessao_numero', 
            'praticas_inclusivas', 'praticas_vivencias', 'genero_identidade', 'modalidade',
            'profile_appearances', 'whatsapp_clicks', 'last_shown_match_at', 'xp'
        ]
    });

    const targetAges = mapAgeToTarget(preferences.idade_paciente);

    return eligibleCandidates.filter(psy => {
        if (relaxFilters) return true; // Fallback: ignora os bloqueios rígidos para garantir resultados

        // 2. Hard Block: Público-Alvo (Idade do Paciente vs Atendimento do Psi)
        if (targetAges.length > 0) {
            const psiPublico = getArrayField(psy.publico_alvo);
            if (psiPublico.length > 0 && !targetAges.some(age => psiPublico.includes(age))) return false;
        }

        // 3. Hard Block: Perigo Financeiro (Valor da sessão > 50% acima do teto do paciente)
        const valorPsi = parseFloat(psy.valor_sessao_numero || 0);
        if (valorPsi > 0 && valorPsi > priceRange.max * 1.5) return false;

        return true;
    });
};

// --- L2: SCORING CLINICO & OPERACIONAL ---
const calculateSimilarity = (psy, preferences, priceRange) => {
    let sClinical = 0;
    let sOp = 50;
    const explainability = { positives: [], negatives: [], neutral: [], penalties: [], absoluteBlock: false };

    const temasPsi = getArrayField(psy.temas_atuacao);
    const temasBuscados = preferences.temas_buscados || [];
    
    // 1. MATCH CLÍNICO
    const matches = temasBuscados.filter(t => temasPsi.includes(t));
    if (matches.length > 0) {
        const densityFactor = matches.length / Math.log10(Math.max(10, temasPsi.length * 10));
        sClinical += (matches.length * 40) * densityFactor;
        explainability.positives.push(`Especialista em ${matches[0]}`);
    }

    if (temasPsi.length > 12) {
        sClinical -= 15; // Penalidade para "SEO Frankenstein"
    }

    // 1.2 MATCH DE GÊNERO
    const prefGenero = preferences.genero_profissional;
    if (prefGenero && prefGenero !== 'Indiferente') {
        if (psy.genero_identidade === prefGenero) {
            sClinical += 15;
            explainability.positives.push(`Gênero de preferência atendido`);
        }
    }

    // 1.3 MATCH DE PRÁTICAS INCLUSIVAS / AFIRMATIVAS
    const praticasDesejadas = preferences.praticas_desejadas || [];
    const praticasPsi = getArrayField(psy.praticas_inclusivas).concat(getArrayField(psy.praticas_vivencias));
    if (praticasDesejadas.length > 0) {
        let praticasAtendidas = 0;
        for (const pratica of praticasDesejadas) {
            const sinonimos = MAPA_CARACTERISTICAS[pratica] || [pratica];
            if (sinonimos.some(s => praticasPsi.includes(s))) {
                praticasAtendidas++;
                explainability.positives.push(pratica.replace(' 🏳️‍🌈', ''));
            }
        }
        if (praticasAtendidas > 0) {
            sClinical += (praticasAtendidas * 20); // Bônus forte por compatibilidade de vivência
        }
    }

    // 2. MATCH OPERACIONAL E ORÇAMENTO
    const prefMod = preferences.modalidade_preferida;
    if (prefMod && prefMod !== 'Indiferente' && prefMod !== 'Indiferente (Online ou Presencial)') {
        const psiMods = getArrayField(psy.modalidade);
        if (psiMods.includes(prefMod) || psiMods.includes('Indiferente')) {
            sOp += 20;
        }
    }

    const valorPsi = parseFloat(psy.valor_sessao_numero || 0);
    if (valorPsi > 0) {
        if (valorPsi >= priceRange.min && valorPsi <= priceRange.max) {
            sOp += 30; 
            explainability.positives.push("Dentro do orçamento ideal");
        } else if (valorPsi < priceRange.min) {
            sOp += 20; 
        } else if (valorPsi > priceRange.max) {
            sOp -= 20; // Penalidade suave. Se fosse > 50% mais caro, já teria sido cortado no Hard Block inicial.
        }
    }

    const rawMatchScore = (Math.max(0, Math.min(100, sClinical)) * WEIGHTS.CLINICAL) + (Math.max(0, sOp) * WEIGHTS.OPERATIONAL);
    
    return { rawMatchScore, explainability };
};

// --- L3: FAIRNESS (MULTI-ARMED BANDIT - UCB) ---
const applyFairness = (scoredCandidates, totalSystemImpressions) => {
    return scoredCandidates.map(c => {
        // Cooldown Progressivo: Penalidade máxima de 20% decaindo para 0% ao longo de 60 minutos
        const minutesSinceLastShown = c.last_shown_match_at ? (new Date() - new Date(c.last_shown_match_at)) / 60000 : 9999;
        
        let cooldownPenalty = 1.0;
        if (minutesSinceLastShown < 60) {
            const decayProgress = minutesSinceLastShown / 60; // De 0 (agora) a 1 (60 min)
            cooldownPenalty = 0.80 + (0.20 * decayProgress); // Sobe suavemente de 0.80 para 1.00
        }

        const impressions = Math.max(1, c.profile_appearances || 1);
        const clicks = c.whatsapp_clicks || 0;
        const ctr = clicks / impressions;

        // Bônus UCB para descoberta de novos talentos
        const explorationBonus = WEIGHTS.UCB_EXPLORATION_RATE * Math.sqrt(Math.log(totalSystemImpressions || 10) / impressions);
        
        // Aplica modificadores garantindo que o algoritmo clínico ainda seja o fator principal
        let finalScore = (c.rawMatchScore * cooldownPenalty) + (ctr * 10) + Math.min(15, explorationBonus);

        return { ...c, finalScore };
    });
};

exports.calculateMatches = async (preferences) => {
    try {
        // Ponto 3: Busca Total de Impressões com Cache de 5 minutos (Evita gargalo no banco)
        const now = Date.now();
        if (!cachedTotalImpressions || now - lastImpressionCacheTime > 5 * 60 * 1000) {
            // Blindagem: Garante que o retorno é um número seguro para o Math.log do UCB
            cachedTotalImpressions = parseInt(await db.Psychologist.sum('profile_appearances').catch(() => 1000), 10) || 1000;
            lastImpressionCacheTime = now;
        }
        const totalSystemImpressions = cachedTotalImpressions;

        const priceRange = parsePriceRange(preferences.valor_sessao_faixa);

        let candidates = await fetchEligibleCandidates(preferences, priceRange, false);
        
        // --- FALLBACK DE SEGURANÇA (Plano B) ---
        if (candidates.length < 3) {
            candidates = await fetchEligibleCandidates(preferences, priceRange, true);
        }

        if (!candidates.length) return { matchTier: 'none', results: [] };

        let scored = candidates.map(psy => {
            const { rawMatchScore, explainability } = calculateSimilarity(psy, preferences, priceRange);
            const psyJSON = psy.toJSON ? psy.toJSON() : psy;
            return { 
                ...psyJSON, 
                rawMatchScore, 
                matchDetails: [...new Set(explainability.positives)],
                explainability 
            };
        });

        let strictScored = scored.filter(c => c.rawMatchScore > 20);
        if (strictScored.length < 3) {
            scored = scored.sort((a, b) => (b.rawMatchScore || 0) - (a.rawMatchScore || 0)); 
        } else {
            scored = strictScored;
        }

        // Aplica o UCB e o Anti-Monopólio
        scored = applyFairness(scored, totalSystemImpressions);

        // Ordenação Final Primária
        scored.sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));

        // WEIGHTED RANDOMIZATION (Roleta Viciada para Empates)
        const topCandidates = scored.slice(0, 6); // Pega o Top 6 para sortear 3
        const results = [];
        
        while (results.length < 3 && topCandidates.length > 0) {
            const totalWeight = topCandidates.reduce((acc, val) => acc + Math.pow(val.finalScore || 1, 2), 0);
            let randomPoint = Math.random() * totalWeight;
            
            for (let i = 0; i < topCandidates.length; i++) {
                randomPoint -= Math.pow(topCandidates[i].finalScore || 1, 2);
                if (randomPoint <= 0) {
                    results.push(topCandidates[i]);
                    topCandidates.splice(i, 1);
                    break;
                }
            }
        }

        // Fallback Masking para a UX
        let tier = 'ideal';
        let compromiseText = "";
        if (results.length > 0) {
            const bestScore = results[0].rawMatchScore;
            if (bestScore < 75 && bestScore >= 50) {
                tier = 'near';
                compromiseText = "Compreendemos o que você busca! Não encontramos um profissional com 100% exato de sinergia, mas selecionamos excelentes especialistas que chegam muito perto.";
            } else if (bestScore < 50) {
                tier = 'fallback';
                compromiseText = "Para não te deixar sem apoio, flexibilizamos levemente alguns detalhes e encontramos ótimos profissionais prontos para te acolher.";
            }

            results.forEach(r => {
                let display = r.rawMatchScore || 0;
                if (display < 50) display = Math.max(45, 60 + (display / 100));
                if (display > 98) display = 98;
                r.displayMatchScore = parseFloat(display.toFixed(1));
                r.matchScore = r.displayMatchScore; 
            });
        }

        return { matchTier: tier, compromiseText, results };
    } catch (error) {
        console.error("🔥 Erro fatal no calculateMatches:", error);
        throw error;
    }
};
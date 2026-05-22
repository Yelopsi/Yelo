const db = require('../models');
const { Op } = require('sequelize');

// Conecta demandas de identidade do paciente com vivências do psicólogo
const MAPA_CARACTERISTICAS = {
    "LGBTQIAPN+ Friendly 🏳️‍🌈": ["LGBTQIAPN+ Friendly 🏳️‍🌈", "LGBTQIAPN+ friendly", "Afirmativa"],
    "Que faça parte da comunidade LGBTQIAPN+": ["Faz parte da comunidade LGBTQIAPN+ / Afirmativa", "Comunidade LGBTQIAPN+", "Que faça parte da comunidade LGBTQIAPN+"],
    
    "Pessoa não-branca ou com prática antirracista": ["Pessoa não-branca // Prática Antirracista", "Antirracista", "Negritude", "Pessoa não-branca // Antirracista", "Que seja uma pessoa não-branca (racializada) / prática antirracista"],
    
    "Que tenha uma perspectiva feminista": ["Perspectiva Feminista", "Feminista", "Perspetiva feminista", "Que tenha uma perspectiva feminista"],
    
    "Especialista em Neurodiversidade (TDAH, Autismo)": ["Neurodiversidade (TDAH, Autismo)", "Neurodiversidade", "TDAH", "Autismo", "Que entenda de neurodiversidade (TDAH, Autismo, etc.)"]
};

// --- FUNÇÃO AUXILIAR: Parse de Preço ---
const parsePriceRange = (rangeString) => {
    if (!rangeString || typeof rangeString !== 'string') return { min: 0, max: 9999 };
    const numbers = rangeString.match(/\d+/g);
    if (!numbers || numbers.length === 0) return { min: 0, max: 9999 };
    const min = parseInt(numbers[0], 10);
    const max = numbers.length > 1 ? parseInt(numbers[1], 10) : min;
    return { min, max };
};

// --- FUNÇÃO AUXILIAR: Jitter Determinístico (Pseudo-Random) ---
// Cria uma variação de desempate estável baseada em ID e Seed (ex: hora do dia) para evitar sensação de loteria
const deterministicRandom = (seedStr) => {
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
        const char = seedStr.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    const x = Math.sin(hash++) * 10000;
    return x - Math.floor(x);
};

const mapAgeToTarget = (idadeStr) => {
    if (!idadeStr) return [];
    if (idadeStr.includes("Menor de 18")) return ["Crianças", "Adolescentes"];
    if (idadeStr.includes("55+")) return ["Idosos", "Adultos"];
    return ["Adultos"];
};

// --- FUNÇÃO AUXILIAR: Garantir Array ---
const getArrayField = (field) => {
    if (Array.isArray(field)) return field;
    if (typeof field === 'string') {
        try { return field.trim().startsWith('[') ? JSON.parse(field) : [field]; } 
        catch (e) { return []; }
    }
    return [];
};

// --- 1. CLINICAL SCORE (Compatibilidade Clínica e Densidade Temática) ---
const calculateClinicalScore = (psychologist, preferences, explainability) => {
    let baseScore = 0;
    const temasPsi = getArrayField(psychologist.temas_atuacao);
    let matchCount = 0;
    
    // 1.1. MAPEAMENTO DE TEMAS
    if (preferences.temas_buscados && preferences.temas_buscados.length > 0) {
        const mapaTemas = {
            "Ansiedade ou Estresse": ["Ansiedade", "Estresse"],
            "Depressão ou Tristeza": ["Depressão", "Tristeza"],
            "Relacionamentos": ["Relacionamentos"],
            "Carreira e Trabalho": ["Carreira", "Trabalho"],
            "Autoestima": ["Autoestima"],
            "Luto ou Traumas": ["Luto", "Traumas"],
            "Autoconhecimento": ["Autoconhecimento"]
        };

        let temasParaBuscar = [];
        preferences.temas_buscados.forEach(t => {
            if (mapaTemas[t]) temasParaBuscar.push(...mapaTemas[t]);
            else temasParaBuscar.push(t);
        });

        const matches = temasParaBuscar.filter(tema => temasPsi.includes(tema));
        matchCount = matches.length;
        
        if (matchCount > 0) {
            baseScore += 40; // Base de match temático
            explainability.positives.push(`Especialista em ${matches[0]}`);
        } else {
            explainability.negatives.push("Não possui os temas principais buscados");
        }

        // 1.2. NEGATIVE MATCHING: Exigência de Neurodiversidade
        const pedeNeuro = temasParaBuscar.includes("TDAH") || (preferences.praticas_desejadas && preferences.praticas_desejadas.some(p => p.includes("Neurodiversidade")));
        const temNeuro = temasPsi.includes("TDAH") || temasPsi.includes("Autismo") || temasPsi.includes("Neurodiversidade");
        
        if (pedeNeuro) {
            if (temNeuro) {
                baseScore += 20;
                explainability.positives.push("Especialista em Neurodiversidade");
            } else {
                // SOFT PENALTY: Paciente precisa de neuro, psi não atende
                baseScore *= 0.3; 
                explainability.penalties.push({
                    type: 'MISSING_NEURO_SPECIALTY',
                    severity: 'high',
                    scoreImpact: -30
                });
                explainability.negatives.push("Não possui especialização em neurodiversidade");
            }
        }
    }

    // 1.3. ANTI-GAMING: DENSIDADE DE ESPECIALIZAÇÃO
    // Premia quem foca. Se marcou 20 temas e acertou 1, é generalista (densidade 5%).
    // Se marcou 3 e acertou 1, é especialista (densidade 33%).
    let densityMultiplier = 1.0;
    let coherencePenalty = 0;
    if (temasPsi.length > 0) {
        if (matchCount > 0) {
            const density = matchCount / temasPsi.length;
            if (density >= 0.3 && temasPsi.length <= 8) densityMultiplier = 1.2; // +20% para altamente nichados e coerentes
        }
        if (temasPsi.length > 12) {
            coherencePenalty = 15; // Penalidade para "SEO Interno / Perfil Frankenstein"
            explainability.penalties.push({ type: 'LOW_CLINICAL_COHERENCE', severity: 'medium', scoreImpact: -15 });
        }
    }
    baseScore = (baseScore * densityMultiplier) - coherencePenalty;

    // 1.4. PRÁTICAS INCLUSIVAS E IDENTIDADE
    if (preferences.praticas_desejadas && preferences.praticas_desejadas.length > 0) {
        const praticasPsi = [
            ...getArrayField(psychologist.praticas_inclusivas),
            ...getArrayField(psychologist.praticas_vivencias)
        ];
        
        let patricasMatches = 0;
        preferences.praticas_desejadas.forEach(pref => {
            const termosTecnicos = MAPA_CARACTERISTICAS[pref] || [pref];
            if (termosTecnicos.some(termo => praticasPsi.includes(termo))) patricasMatches++;
        });

        if (patricasMatches > 0) { 
            baseScore += 20; 
            explainability.positives.push("Alinhamento de vivências/identidade"); 
        }
    }

    // 1.5. NEGATIVE MATCHING: Público Alvo
    if (preferences.idade_paciente) {
        const targetsEsperados = mapAgeToTarget(preferences.idade_paciente);
        const alvoPsi = getArrayField(psychologist.publico_alvo);
        
        if (targetsEsperados.some(t => alvoPsi.includes(t))) {
            baseScore += 10;
        } else {
            // ABSOLUTE BLOCK: Não atende a faixa etária selecionada (Cemitério Invisível)
            explainability.absoluteBlock = true;
            explainability.penalties.push({
                type: 'AGE_GROUP_MISMATCH',
                severity: 'absolute',
                scoreImpact: -1000
            });
            explainability.negatives.push("Não atende a faixa etária selecionada");
        }
    }

    return Math.max(0, Math.min(100, baseScore));
};

// --- 2. OPERATIONAL SCORE (Logística e Orçamento) ---
const calculateOperationalScore = (psychologist, preferences, priceRange, explainability) => {
    let score = 50; // Base inicial
    let modifier = 1.0;

    // 2.1 Modalidade - HARD CONSTRAINT
    const prefMod = preferences.modalidade_preferida;
    if (prefMod && prefMod !== 'Indiferente' && prefMod !== 'Indiferente (Online ou Presencial)') {
        const psiMods = getArrayField(psychologist.modalidade);
        if (psiMods.includes(prefMod) || psiMods.includes('Indiferente')) {
            score += 20;
        } else {
            // ABSOLUTE BLOCK: Incompatibilidade de Local/Modalidade
            explainability.absoluteBlock = true;
            explainability.penalties.push({
                type: 'MODALITY_MISMATCH',
                severity: 'absolute',
                scoreImpact: -1000
            });
            explainability.negatives.push(`Atende apenas ${psiMods.join(' e ')} (Buscado: ${prefMod})`);
        }
    }

    // 2.2 Orçamento - HARD CONSTRAINT PARCIAL
    const valorPsi = parseFloat(psychologist.valor_sessao_numero || 0);
    if (valorPsi > 0) {
        if (valorPsi >= priceRange.min && valorPsi <= priceRange.max) {
            score += 30; 
            explainability.positives.push("Dentro do orçamento ideal");
        } else if (valorPsi < priceRange.min) {
            score += 20; 
            explainability.positives.push("Abaixo do orçamento (acessível)");
        } else if (valorPsi <= priceRange.max * 1.3) {
            // Pouco acima, não elimina, mas não ganha bônus
            explainability.neutral.push("Valor um pouco acima do desejado");
        } else {
            modifier *= 0.4; // Muito acima do orçamento: Reduz peso drasticamente
            explainability.penalties.push({
                type: 'PRICE_TOO_HIGH',
                severity: 'medium',
                scoreImpact: -30
            });
            explainability.negatives.push("Valor acima do desejado");
        }
    }

    // 2.3 Gênero
    if (preferences.genero_profissional && preferences.genero_profissional !== "Indiferente") {
        if (psychologist.genero_identidade === preferences.genero_profissional) score += 20;
    }

    return Math.max(0, Math.min(100, score * modifier));
};

// --- 3. MARKETPLACE FAIRNESS (Anti-monopólio & Distribuição) ---
// Reduzido peso estatístico. Atua agora como um bônus numérico suave (0 a 10 pontos finais)
const calculateMarketplaceScore = (psychologist) => {
    let fairnessBoost = 0;
    
    const clicks = psychologist.whatsapp_clicks || 0;
    const daysSinceCreation = (new Date() - new Date(psychologist.createdAt)) / (1000 * 60 * 60 * 24);

    // Cold Start: Oportunidade para novatos mostrarem serviço (+8 pts)
    if (daysSinceCreation <= 14 && clicks < 3) {
        fairnessBoost = 8; 
    } else {
        // Curva de Fadiga Suave (Diminishing Boosts)
        if (clicks === 0) fairnessBoost = 8;
        else if (clicks <= 3) fairnessBoost = 5;
        else if (clicks <= 7) fairnessBoost = 2;
        else if (clicks <= 15) fairnessBoost = 0;
        else fairnessBoost = -5; // Saturação: Penalidade leve para dar lugar a outros
    }

    return fairnessBoost; // Retorna pontuação flat direta
};

// --- 4. PERFORMANCE E MONETIZAÇÃO (Desempate Leve) ---
// Não define mais competência clínica. Máximo de +6 pontos.
const calculatePerformanceScore = (psychologist) => {
    let perfBoost = 0;
    
    const xp = psychologist.xp || 0;
    perfBoost += Math.min(3, (xp / 1000) * 2); // Max +3 pontos por comunidade

    const p = (psychologist.plano || '').toUpperCase();
    if (p === 'REFERENCE' || p === 'SOL' || psychologist.is_exempt) perfBoost += 3;
    else if (p === 'CLINICAL' || p === 'CLÍNICO') perfBoost += 1.5;

    return perfBoost;
};

// --- 5. DIVERSIDADE CONTEXTUAL (SMART JITTER) ---
// Apenas altera a ordem dos psicólogos se eles estiverem estatisticamente empatados (Diferença < 5 pts), de forma determinística
const applyControlledExploration = (psychologists, sessionId) => {
    if (psychologists.length <= 1) return psychologists;
    
    // Isola o Top 1 (Garante estabilidade para o melhor match real)
    let finalPool = [psychologists[0]];
    
    // Grupo de exploração: Posições 2 a 5
    let exploratoryPool = psychologists.slice(1, 5);
    
    if (exploratoryPool.length > 1) {
        const referenceScore = exploratoryPool[0].rawMatchScore;
        const hourSeed = new Date().getHours().toString();
        const baseSeed = sessionId || hourSeed;
        
        exploratoryPool.forEach(p => {
            // Se a pontuação está colada na referência (menos de 5 pontos de diferença)
            if (Math.abs(referenceScore - p.rawMatchScore) <= 5) {
                // Aplica ruído determinístico microscópico para desempatar de forma fluida mas estável
                const jitter = (deterministicRandom(p.id.toString() + baseSeed) * 2) - 1;
                p._jitteredScore = p.rawMatchScore + jitter;
            } else {
                p._jitteredScore = p.rawMatchScore; // Mantém hierarquia firme se diferença for grande
            }
        });

        exploratoryPool.sort((a, b) => b._jitteredScore - a._jitteredScore);
    }
    
    return [...finalPool, ...exploratoryPool, ...psychologists.slice(5)];
};

// --- FUNÇÃO PRINCIPAL EXPORTADA ---
exports.calculateMatches = async (preferences) => {
    const allPsychologists = await db.Psychologist.findAll({
        where: {
            status: 'active',
        },
        attributes: { exclude: ['senha', 'cpf', 'cnpj', 'resetPasswordToken', 'resetPasswordExpires'] }
    });

    const agora = new Date();
    const validCandidates = allPsychologists.filter(psy => {
        if (!psy.fotoUrl || !psy.bio || psy.bio.trim().length < 10) return false;

        const isVip = psy.is_exempt === true || String(psy.is_exempt).toLowerCase() === 'true' || psy.is_exempt === 1;
        if (isVip) return true;
        if (!psy.planExpiresAt) return false;
        return new Date(psy.planExpiresAt) > agora;
    });

    const priceRange = parsePriceRange(preferences.valor_sessao_faixa);
    const scoredPsychologists = [];
    
    for (const psy of validCandidates) {
        const explainability = { positives: [], negatives: [], neutral: [], penalties: [], absoluteBlock: false };

        const clinicalScore = calculateClinicalScore(psy, preferences, explainability);
        const operationalScore = calculateOperationalScore(psy, preferences, priceRange, explainability);

        const fairnessBoost = calculateMarketplaceScore(psy);
        const perfBoost = calculatePerformanceScore(psy);

        // Arquitetura Final de Score (Base 100)
        // Clínica e Operacional definem 100% da relevância da recomendação.
        const baseScore = (clinicalScore * 0.65) + (operationalScore * 0.35);
        
        // Modificadores comerciais/plataforma entram apenas como offsets (máx ~14 pts)
        let totalScore = baseScore + fairnessBoost + perfBoost;
        let fallbackPriorityScore = (clinicalScore * 0.8) + (operationalScore * 0.2);

        // Penalidades (Progressive Relaxation & Absolute Blocks)
        // Agora, mesmo bloqueios absolutos aplicam penalidade máxima ao invés de excluir, garantindo um fallback
        explainability.penalties.forEach(penalty => {
            totalScore += penalty.scoreImpact;
            if (penalty.severity === 'absolute') {
                fallbackPriorityScore += penalty.scoreImpact;
            }
        });


        const psyJSON = psy.toJSON();
        psyJSON.rawMatchScore = parseFloat(totalScore.toFixed(2));
        psyJSON.fallbackScore = parseFloat(fallbackPriorityScore.toFixed(2));
        psyJSON.matchScore = psyJSON.rawMatchScore; // Display provisório
        
        // Explicabilidade traduzida para compatibilidade front-end (matchDetails)
        psyJSON.matchDetails = [...new Set(explainability.positives)];
        psyJSON.explainability = explainability; // Preparado para o futuro ML
            
        scoredPsychologists.push(psyJSON);
    }

    // Ordenação Determinística Original
    scoredPsychologists.sort((a, b) => b.rawMatchScore - a.rawMatchScore);

    // Se o melhor match for insuficiente, ativa modo Fallback Contextual (Semântico)
    if (scoredPsychologists.length > 0 && scoredPsychologists[0].rawMatchScore < 50) {
        scoredPsychologists.sort((a, b) => b.fallbackScore - a.fallbackScore);
    }

    // Aplicação de Diversidade e Exploração
    const randomizedPool = applyControlledExploration(scoredPsychologists, preferences.patientSessionId);

    const results = randomizedPool.slice(0, 3); 

    if (results.length === 0) {
        // Fallback absoluto: Só ocorre se a base de dados estiver completamente vazia de profissionais ativos
        return { matchTier: 'none', results: [] };
    }

    const bestMatchScore = results[0].rawMatchScore;
    let tier = 'ideal';
    let compromiseText = "";

    if (bestMatchScore >= 75) {
        tier = 'ideal';
    } else if (bestMatchScore >= 50) {
        tier = 'near';
            compromiseText = "Compreendemos o que você busca! Não encontramos um profissional com 100% exato de sinergia, mas selecionamos excelentes especialistas que chegam muito perto do seu momento.";
    } else if (bestMatchScore >= 0) {
        tier = 'fallback';
            compromiseText = "Para não te deixar sem apoio, flexibilizamos levemente alguns detalhes (como valor ou modalidade) e encontramos ótimos profissionais prontos para te acolher.";
            // Substitui críticas negativas por destaques positivos (Foco em conversão)
        results.forEach(r => {
            if (r.explainability.neutral.length > 0 && r.matchDetails.length < 3) {
                r.matchDetails.push(r.explainability.neutral[0]);
                }
                
                // Se faltar tags e for um fallback, adiciona a especialidade principal
                if (r.matchDetails.length === 0) {
                    const temas = getArrayField(r.temas_atuacao);
                    if (temas.length > 0) {
                        r.matchDetails.push(`Foca em ${temas[0]}`);
                    } else {
                        r.matchDetails.push("Profissional de Excelência");
                    }
            }
        });
    } else {
        tier = 'weak fallback';
            compromiseText = "O seu momento é único e seus critérios são bem específicos. Selecionamos profissionais de excelência que, mesmo tendo características um pouco diferentes, têm total capacidade de te ajudar nessa jornada.";
            // Substitui críticas negativas por destaques positivos (Foco em conversão)
            results.forEach(r => {
                if (r.matchDetails.length === 0) {
                    const temas = getArrayField(r.temas_atuacao);
                    if (temas.length > 0) {
                        r.matchDetails.push(`Especialista em ${temas[0]}`);
                    } else {
                        r.matchDetails.push("Profissional Qualificado");
                    }
                }
            });
    }

    // UX Masking Bug Fixed: Preserva rawMatchScore e ajusta apenas o displayMatchScore para não contaminar a inteligência do pipeline
    results.forEach(r => {
        let displayScore = r.rawMatchScore;
            // Impede que pontuações fiquem desencorajadoras (negativas ou muito baixas) nos fallbacks, mantendo em uma faixa de 45% a 65%
            if (displayScore < 50) displayScore = Math.max(45, 60 + (displayScore / 100));
        if (displayScore > 98) displayScore = 98.5 + deterministicRandom(r.id.toString());
        r.displayMatchScore = parseFloat(displayScore.toFixed(1));
        r.matchScore = r.displayMatchScore; // Mantém compatibilidade com front-end atual
    });

    return {
        matchTier: tier,
        compromiseText: compromiseText,
        results: results
    };
};
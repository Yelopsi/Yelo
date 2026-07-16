const db = require('../models');
const { Op } = require('sequelize');
const seoService = require('./seoService'); // Importa a IA para gerar os textos de conexão

// Variaveis globais de cache para o Motor de Match (Ponto 3)
let cachedTotalImpressions = null;
let lastImpressionCacheTime = 0;

// Pesos Globais da Yelo
const WEIGHTS = {
    CLINICAL: 0.65,
    OPERATIONAL: 0.35,
    UCB_EXPLORATION_RATE: 3.0, // Aumentado para dar mais chance aos novatos
    MVP_ZERO_CLICK_BOOST: 25   // Bônus massivo para quem nunca recebeu um clique no WhatsApp
};

const MAPA_CARACTERISTICAS = {
    "LGBTQIAPN+ Friendly 🏳️‍🌈": ["LGBTQIAPN+ Friendly 🏳️‍🌈", "LGBTQIAPN+ friendly", "Afirmativa"],
    "Que faça parte da comunidade LGBTQIAPN+": ["Faz parte da comunidade LGBTQIAPN+ / Afirmativa", "Comunidade LGBTQIAPN+", "Que faça parte da comunidade LGBTQIAPN+"],
    "Pessoa não-branca ou com prática antirracista": ["Pessoa não-branca // Prática Antirracista", "Antirracista", "Negritude", "Pessoa não-branca // Antirracista", "Que seja uma pessoa não-branca (racializada) / prática antirracista"],
    "Que tenha uma perspectiva feminista": ["Perspectiva Feminista", "Feminista", "Perspetiva feminista", "Que tenha uma perspectiva feminista"],
    "Especialista em Neurodiversidade (TDAH, Autismo)": ["Neurodiversidade (TDAH, Autismo)", "Neurodiversidade", "TDAH", "Autismo", "Que entenda de neurodiversidade (TDAH, Autismo, etc.)"]
};

const parsePriceRange = (rangeString) => {
    if (!rangeString || typeof rangeString !== 'string') return { min: 0, max: 99999 };
    if (rangeString.toLowerCase().includes('acima')) return { min: 150, max: 9999 }; // Corrige o teto ilimitado para pacientes premium
    const numbers = rangeString.match(/\d+/g);
    if (!numbers || numbers.length === 0) return { min: 0, max: 9999 };
    const min = parseInt(numbers[0], 10);
    const max = numbers.length > 1 ? parseInt(numbers[1], 10) : (min === 0 ? 99999 : min);
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
    if (!idadeStr || typeof idadeStr !== 'string') return [];
    if (idadeStr.includes("Menor de 18")) return ["Crianças", "Adolescentes"];
    if (idadeStr.includes("55+")) return ["Idosos", "Adultos"];
    return ["Adultos"];
};

// --- L2: SCORING CLINICO & OPERACIONAL ---
const calculateSimilarity = (psy, preferences = {}, priceRange) => {
    try {
    let sClinical = 0;
    let sOp = 50;
    const explainability = { positives: [], negatives: [], neutral: [], penalties: [], absoluteBlock: false };

    // --- REQUISITOS MÍNIMOS (AGORA COMO PENALIDADES) ---
    const agora = new Date();
    const isVip = psy.is_exempt === true || String(psy.is_exempt).toLowerCase() === 'true';
    const hasActivePlan = isVip || (psy.planExpiresAt && new Date(psy.planExpiresAt) > agora);
    const hasPhoto = psy.fotoUrl && psy.fotoUrl.trim() !== '' && !psy.fotoUrl.includes('placehold.co');
    const hasMinBio = psy.bio && psy.bio.trim().length >= 10;

    // Se os requisitos mínimos não forem atendidos, a pontuação será drasticamente reduzida,
    // garantindo que esses perfis só apareçam como último recurso.
    if (!hasActivePlan) sOp -= 100;
    if (!hasPhoto) sOp -= 50;
    if (!hasMinBio) sOp -= 50;

    // --- VIP BOOST ---
    if (isVip) {
        sOp += 10;
        explainability.positives.push("Profissional Verificado (VIP)");
    }
    // --- FIM DOS REQUISITOS MÍNIMOS ---

    const temasPsi = getArrayField(psy.temas_atuacao);
    const temasBuscados = preferences.temas || []; // CORRIGIDO
    
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
    const prefGenero = preferences.pref_genero_prof; // CORRIGIDO
    if (prefGenero && prefGenero !== 'Indiferente') {
        if (psy.genero_identidade === prefGenero) {
            sClinical += 15;
            explainability.positives.push(`Gênero de preferência atendido`);
        }
    }

    // 1.3 MATCH DE PRÁTICAS INCLUSIVAS / AFIRMATIVAS
    const praticasDesejadas = preferences.caracteristicas_prof || []; // CORRIGIDO
    const praticasPsi = getArrayField(psy.praticas_inclusivas).concat(getArrayField(psy.praticas_vivencias));
    if (praticasDesejadas.length > 0 && !praticasDesejadas.includes('Indiferente')) {
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

    // 1.4 MATCH DE ABORDAGEM IDEAL (NOVO)
    const abordagemDesejada = getArrayField(preferences.abordagem_ideal);
    const abordagemPsi = getArrayField(psy.abordagens_tecnicas);
    if (abordagemDesejada.length > 0 && abordagemPsi.length > 0) {
        if (abordagemDesejada.some(a => abordagemPsi.includes(a))) {
            sClinical += 25;
            explainability.positives.push('Abordagem ideal para o seu perfil');
        }
    }

    // 2. MATCH OPERACIONAL E ORÇAMENTO
    const prefMod = preferences.modalidade_atendimento; // CORRIGIDO
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
            sOp -= 20; // Penalidade suave. Ocorre apenas se o filtro rigoroso falhar (relaxFilters ativado na L3).
        }
    }

    const rawMatchScore = (Math.max(0, Math.min(100, sClinical)) * WEIGHTS.CLINICAL) + (Math.max(0, sOp) * WEIGHTS.OPERATIONAL);
    
    // Se os requisitos mínimos não forem atendidos, limita a pontuação a um valor muito baixo.
    if (!hasActivePlan || !hasPhoto || !hasMinBio) {
        return { rawMatchScore: Math.min(5, rawMatchScore), explainability };
    }

    return { rawMatchScore, explainability };
    } catch (err) {
        console.error("🔥 [MATCH ENGINE] Erro no calculateSimilarity:", err.message);
        return { rawMatchScore: 10, explainability: { positives: [], negatives: [], neutral: [], penalties: [], absoluteBlock: false } };
    }
};

// --- L3: FAIRNESS (MULTI-ARMED BANDIT - UCB) ---
const applyFairness = (scoredCandidates, totalSystemImpressions) => {
    // Calcula a velocidade média de aparições (Aparições por Dia) para não penalizar psicólogos mais antigos
    const currentVelocities = scoredCandidates.map(c => {
        const days = Math.max(1, (new Date() - new Date(c.createdAt || Date.now())) / (1000 * 60 * 60 * 24));
        return (c.profile_appearances || 0) / days;
    });
    const totalVelocity = currentVelocities.reduce((sum, val) => sum + val, 0);
    const avgVelocity = scoredCandidates.length > 0 ? Math.max(0.1, totalVelocity / scoredCandidates.length) : 0.1;

    return scoredCandidates.map((c, index) => {
        try {
        // Cooldown Progressivo MVP: Penalidade máxima de 50% decaindo para 0% ao longo de 24 horas (1440 minutos)
        // Isso força a plataforma a "girar a roleta" e mostrar psicólogos diferentes o dia todo
        const minutesSinceLastShown = c.last_shown_match_at ? (new Date() - new Date(c.last_shown_match_at)) / 60000 : 99999;
        
        let cooldownPenalty = 1.0;
        if (minutesSinceLastShown < 1440) {
            const decayProgress = minutesSinceLastShown / 1440; // De 0 (agora) a 1 (1440 min)
            cooldownPenalty = 0.50 + (0.50 * decayProgress); // Sobe de 0.50 para 1.00
        }

        const impressions = Math.max(1, c.profile_appearances || 1);
        const clicks = c.whatsapp_clicks || 0;
        const ctr = clicks / impressions;

        // Bônus UCB para descoberta de novos talentos
        const explorationBonus = WEIGHTS.UCB_EXPLORATION_RATE * Math.sqrt(Math.log(Math.max(2, totalSystemImpressions || 10)) / impressions);
        
        // --- BÔNUS MVP (ZERO TO ONE) ---
        const mvpBoost = (clicks === 0) ? WEIGHTS.MVP_ZERO_CLICK_BOOST : 0;

        // Calcula a pontuação final preliminar
        let finalScore = (c.rawMatchScore * cooldownPenalty) + (ctr * 10) + Math.min(20, explorationBonus) + mvpBoost;

        // --- EXPOSURE THROTTLE (Velocidade de Aparições) ---
        // Se a velocidade (Aparições/Dia) for muito maior que a média, aplicamos o freio.
        // Assim protegemos profissionais antigos que acumularam muitas aparições ao longo dos meses.
        const velocity = currentVelocities[index];
        if (velocity > avgVelocity * 1.5) {
            finalScore *= 0.75; // Penalidade para quem monopoliza o tráfego recente
        } else if (velocity < avgVelocity * 0.5) {
            finalScore *= 1.25; // Bônus para quem está girando devagar
        }

        // --- TRIAL-END BOOST ---
        // Se estiver nos últimos 3 dias de plano, recebe um forte bônus para gerar demanda antes da cobrança
        if (c.planExpiresAt) {
            const daysUntilExpiry = (new Date(c.planExpiresAt) - new Date()) / (1000 * 60 * 60 * 24);
            if (daysUntilExpiry > 0 && daysUntilExpiry <= 3) {
                finalScore += 15;
            }
        }

            if (isNaN(finalScore) || finalScore < 0) finalScore = c.rawMatchScore || 1; // Fallback de segurança matemática absoluta

        return { ...c, finalScore };
        } catch(e) {
            console.error("🔥 [MATCH ENGINE] Erro no applyFairness:", e.message);
            return { ...c, finalScore: c.rawMatchScore || 1 };
        }
    });
};

exports.calculateMatches = async (preferences = {}) => {
    // --- MODO DEBUG ---
    const debugLog = [];
    const startTime = Date.now();
    debugLog.push(`\n======================================================================`);
    debugLog.push(`🧩 [MATCH ENGINE V4 - DEBUG MODE] - ${new Date().toISOString()}`);
    debugLog.push(`======================================================================`);
    debugLog.push(`[0ms] ➡️  Iniciando novo match.`);
    debugLog.push(`[0ms] 🎯 Preferências do Paciente: ${JSON.stringify(preferences)}`);
    
    console.log("\n=======================================================");
    console.log("🧩 [MATCH ENGINE V4 - DEBUG MODE] INICIANDO NOVO MOTOR DE MATCH");
    console.log("🧩 PREFERÊNCIAS DO PACIENTE:", JSON.stringify(preferences));
    
    try {
        const now = Date.now();
        if (!cachedTotalImpressions || now - lastImpressionCacheTime > 5 * 60 * 1000) {
            cachedTotalImpressions = parseInt(await db.Psychologist.sum('profile_appearances').catch(() => 1000), 10) || 1000;
            lastImpressionCacheTime = now;
        }
        const totalSystemImpressions = cachedTotalImpressions;
        const agora = new Date();

        // --- MUDANÇA ESTRATÉGICA: BUSCA RESTRITA A ATIVOS E TRIALS COMPLETOS ---
        const baseWhereConditions = { 
            status: { [Op.in]: ['active', 'trial'] },
            bio: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] },
            cpf: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] },
            fotoUrl: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] }
        };

        debugLog.push(`[${Date.now() - startTime}ms] 🔍 Buscando candidatos elegíveis no banco de dados...`);
        const allEligiblePsychologists = await db.Psychologist.findAll({ where: baseWhereConditions });
        debugLog.push(`[${Date.now() - startTime}ms] ✅ Encontrados ${allEligiblePsychologists.length} candidatos elegíveis.`);

        if (allEligiblePsychologists.length === 0) {
            debugLog.push(`[${Date.now() - startTime}ms] ❌ FIM DO MATCH: A base de dados não possui profissionais com assinatura ativa e perfil preenchido.`);
            console.log(debugLog.join('\n'));
            return { 
                matchTier: 'none', 
                compromiseText: 'Puxa! Não encontramos profissionais disponíveis em nossa plataforma no momento. Nossa base de especialistas cresce todos os dias, por favor, tente novamente mais tarde.',
                results: [] 
            };
        }

        const priceRange = parsePriceRange(preferences.faixa_valor);
        debugLog.push(`[${Date.now() - startTime}ms] 💯 Calculando pontuação de similaridade para ${allEligiblePsychologists.length} candidatos...`);
        
        let scored = allEligiblePsychologists.map(psy => {
            const { rawMatchScore, explainability } = calculateSimilarity(psy, preferences, priceRange);
            const psyJSON = psy.toJSON ? psy.toJSON() : psy;
            debugLog.push(`   - ID: ${psyJSON.id} | Nome: ${psyJSON.nome.substring(0,15)}... | Score Bruto: ${rawMatchScore.toFixed(2)}`);
            return { 
                ...psyJSON, 
                rawMatchScore, 
                matchDetails: [...new Set(explainability.positives)],
                explainability 
            };
        });

        // --- REMOÇÃO DO FILTRO RÍGIDO ---
        // O filtro `strictScored` foi removido. Agora, todos os candidatos elegíveis
        // entram na fase de "fairness" e ordenação, garantindo que ninguém seja
        // descartado prematuramente por uma pontuação baixa.
        debugLog.push(`[${Date.now() - startTime}ms] 🗑️ Filtro de score bruto > 20 foi REMOVIDO. Todos os ${scored.length} candidatos seguem para a próxima fase.`);

        debugLog.push(`[${Date.now() - startTime}ms] ⚖️ Aplicando algoritmos de fairness (UCB, Cooldown, MVP Boost)...`);
        scored = applyFairness(scored, totalSystemImpressions);

        scored.sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));
        debugLog.push(`[${Date.now() - startTime}ms] 📊 Candidatos ordenados por pontuação final (Top 10):`);
        scored.slice(0, 10).forEach((c, i) => {
            debugLog.push(`   ${i+1}. ID: ${c.id} | Nome: ${c.nome.substring(0,15)}... | Score Final: ${c.finalScore.toFixed(2)} (Bruto: ${c.rawMatchScore.toFixed(2)})`);
        });

        // 1. Pegamos os 4 Melhores Absolutos (Mérito Clínico Puro - Mantém a qualidade alta)
        const topMerit = scored.slice(0, 4);

        // 2. Buscamos 2 candidatos "Ociosos" (Round-Robin para quem está no limbo)
        // Regras: Não estar no Top 4, ter match >= 40 (segurança clínica), ordenados pelos menos leads (whatsapp_clicks)
        const idleCandidates = scored
            .filter(c => !topMerit.some(t => t.id === c.id))
            .filter(c => c.rawMatchScore >= 40)
            .sort((a, b) => {
                const daysUntilExpiryA = a.planExpiresAt ? (new Date(a.planExpiresAt) - new Date()) / (1000 * 60 * 60 * 24) : 999;
                const daysUntilExpiryB = b.planExpiresAt ? (new Date(b.planExpiresAt) - new Date()) / (1000 * 60 * 60 * 24) : 999;
                
                const isRiskA = (daysUntilExpiryA > 0 && daysUntilExpiryA <= 3);
                const isRiskB = (daysUntilExpiryB > 0 && daysUntilExpiryB <= 3);

                if (isRiskA && !isRiskB) return -1; // Dá preferência total ao psicólogo na zona de risco
                if (isRiskB && !isRiskA) return 1;

                if ((a.whatsapp_clicks || 0) !== (b.whatsapp_clicks || 0)) {
                    return (a.whatsapp_clicks || 0) - (b.whatsapp_clicks || 0);
                }
                const lastA = a.last_shown_match_at ? new Date(a.last_shown_match_at).getTime() : 0;
                const lastB = b.last_shown_match_at ? new Date(b.last_shown_match_at).getTime() : 0;
                return lastA - lastB;
            });

        const topIdle = idleCandidates.slice(0, 2);

        // 3. Junta os Pools (Máximo de 6 candidatos irão para o sorteio roleta)
        const topCandidates = [...topMerit, ...topIdle];
        debugLog.push(`[${Date.now() - startTime}ms] 🎰 Selecionando ${topCandidates.length} candidatos (${topMerit.length} por mérito, ${topIdle.length} ociosos) para o sorteio ponderado.`);
        const results = [];
        
        let loopCounter = 0;
        while (results.length < 3 && topCandidates.length > 0 && loopCounter < 20) {
            loopCounter++;
            const totalWeight = topCandidates.reduce((acc, val) => acc + Math.pow(val.finalScore || 1, 2), 0);
            
            if (isNaN(totalWeight) || totalWeight <= 0) {
                results.push(topCandidates.shift());
                continue;
            }

            let randomPoint = Math.random() * totalWeight;
            
            let selected = false;
            for (let i = 0; i < topCandidates.length; i++) {
                randomPoint -= Math.pow(topCandidates[i].finalScore || 1, 2);
                if (randomPoint <= 0) {
                    results.push(topCandidates[i]);
                    topCandidates.splice(i, 1);
                    selected = true;
                    break;
                }
            }
            
            if (!selected && topCandidates.length > 0) {
                results.push(topCandidates.shift());
            }
        }

        debugLog.push(`[${Date.now() - startTime}ms] ✅ Sorteio concluído! Retornando ${results.length} profissionais.`);
        debugLog.push(`   - IDs Sorteados: ${results.map(r => r.id).join(', ')}`);

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
        
        if (results.length > 0) {
            try {
                const psiDataForAI = results.map(r => ({
                    id: r.id,
                    nome: r.nome,
                    temas_atuacao: r.temas_atuacao,
                    modalidade: r.modalidade,
                    bio: r.bio || ''
                }));
                
                const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve({ error: "Gemini Timeout após 30 segundos" }), 30000));
                
                const aiReasons = await Promise.race([
                    seoService.generateMatchCopy(preferences, psiDataForAI), 
                    timeoutPromise
                ]);

                if (aiReasons && aiReasons.error) {
                    results.forEach(r => r.aiError = aiReasons.error);
                } else if (aiReasons) {
                    results.forEach(r => {
                        const psiAi = aiReasons[r.id] || aiReasons[String(r.id)];
                        if (psiAi) {
                            r.matchReasons = psiAi.reasons || psiAi; // Fallback se retornar array antigo
                            r.miniBio = psiAi.miniBio || null;
                        }
                    });
                }
            } catch (aiErr) {
                debugLog.push(`[${Date.now() - startTime}ms] ⚠️ Fallback da IA de Match: ${aiErr.message}`);
            }
        }

        debugLog.push(`[${Date.now() - startTime}ms] 🏁 Match finalizado.`);
        console.log(debugLog.join('\n'));
        
        return { matchTier: tier, compromiseText, results };
    } catch (error) {
        debugLog.push(`[${Date.now() - startTime}ms] 🔥 Erro fatal no calculateMatches: ${error.message}`);
        console.error(debugLog.join('\n'), error);
        throw error;
    }
};
const db = require('../models');
const { Op } = require('sequelize');
const seoService = require('./seoService'); // Importa a IA para gerar os textos de conexão

// Variaveis globais de cache para o Motor de Match
// (Removido cache de impressões pois usaremos Cotas Dinâmicas baseadas em conversões)

const WEIGHTS = {
    CLINICAL: 0.65,
    OPERATIONAL: 0.35
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

    // --- FIM DOS REQUISITOS MÍNIMOS ---

    const temasPsi = getArrayField(psy.temas_atuacao);
    const temasBuscados = getArrayField(preferences.temas); // CORRIGIDO
    
    // 1. MATCH CLÍNICO
    const matches = temasBuscados.filter(t => temasPsi.includes(t));
    if (matches.length > 0) {
        const densityFactor = matches.length / Math.log10(Math.max(10, temasPsi.length * 10));
        sClinical += (matches.length * 40) * densityFactor;
        explainability.positives.push(`Especialista em ${matches[0]}`);
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
    const praticasDesejadas = getArrayField(preferences.caracteristicas_prof); // CORRIGIDO
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

    let valorPsi = parseFloat(psy.valor_sessao_numero || 0);
    if (valorPsi === 0 && psy.tipo_cobranca === 'mensal' && parseFloat(psy.valor_mensal_numero || 0) > 0) {
        valorPsi = parseFloat(psy.valor_mensal_numero) / 4;
    }
    if (valorPsi === 0) {
        valorPsi = 100; // Assumir valor médio da plataforma para burlar o filtro de preço
    }
    
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

// --- L3: FAIRNESS (FAIR SHARE V5) ---
const applyFairness = (scoredCandidates, fairShare) => {
    return scoredCandidates.map((c) => {
        try {
            // Cooldown Progressivo MVP: Penalidade máxima de 50% decaindo para 0% ao longo de 24 horas
            const minutesSinceLastShown = c.last_shown_match_at ? (new Date() - new Date(c.last_shown_match_at)) / 60000 : 99999;
            
            let cooldownPenalty = 1.0;
            if (minutesSinceLastShown < 1440) {
                const decayProgress = minutesSinceLastShown / 1440; // De 0 a 1
                cooldownPenalty = 0.50 + (0.50 * decayProgress); 
            }

            let finalScore = c.rawMatchScore;

            // --- BÔNUS DE FOME (Cota Justa) ---
            const conversoes = c.conversoes14d || 0;
            const leads = c.leads14d || 0;

            if (conversoes === 0) {
                finalScore += 50; // Maior bônus para quem não fechou ninguém
            } else if (conversoes < fairShare) {
                finalScore += 25; // Bônus médio para quem ainda não bateu a cota
            }

            // --- PENALIDADE DE DESPERDÍCIO (Bad Sales) ---
            // 7 ou mais cliques nos últimos 14 dias com ZERO conversões
            if (leads >= 7 && conversoes === 0) {
                finalScore *= 0.60; // Penalidade severa (-40%) no score final
            }

            // --- TRIAL-END BOOST ---
            if (c.planExpiresAt) {
                const daysUntilExpiry = (new Date(c.planExpiresAt) - new Date()) / (1000 * 60 * 60 * 24);
                if (daysUntilExpiry > 0 && daysUntilExpiry <= 3) {
                    finalScore += 5; 
                }
            }

            // Aplica o cooldown no score FINAL
            finalScore *= cooldownPenalty;

            if (isNaN(finalScore) || finalScore < 0) finalScore = c.rawMatchScore || 1;

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
        const agora = new Date();

        // --- MUDANÇA ESTRATÉGICA: BUSCA RESTRITA A ATIVOS E TRIALS COMPLETOS ---
        const baseWhereConditions = { 
            status: { [Op.in]: ['active', 'trial'] },
            bio: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] },
            cpf: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] },
            fotoUrl: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] },
            profile_paused: { [Op.ne]: true }
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

        // --- MATCH V5: FAIRNESS POR CONVERSÕES REAIS ---
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
        
        debugLog.push(`[${Date.now() - startTime}ms] 📊 Carregando CRM e calculando Cota Justa...`);
        const logs14d = await db.sequelize.query(`
            SELECT "psychologistId", "dealClosed", COUNT(*) as count 
            FROM "WhatsAppClickLogs" 
            WHERE "createdAt" >= :fourteenDaysAgo 
            GROUP BY "psychologistId", "dealClosed"
        `, { replacements: { fourteenDaysAgo }, type: db.sequelize.QueryTypes.SELECT });
        
        let totalConversoes14d = 0;
        const psyStats = {};
        
        logs14d.forEach(log => {
            const pid = log.psychologistId;
            const count = parseInt(log.count, 10);
            if (!psyStats[pid]) psyStats[pid] = { leads: 0, conversoes: 0 };
            
            psyStats[pid].leads += count;
            if (log.dealClosed === 'closed') {
                psyStats[pid].conversoes += count;
                totalConversoes14d += count;
            }
        });

        const fairShare = allEligiblePsychologists.length > 0 
            ? Math.max(1, Math.ceil(totalConversoes14d / allEligiblePsychologists.length))
            : 1;

        debugLog.push(`[${Date.now() - startTime}ms] 🎯 Cota Justa (Fair Share) de Conversões / mês: ${fairShare}`);

        const priceRange = parsePriceRange(preferences.faixa_valor);
        debugLog.push(`[${Date.now() - startTime}ms] 💯 Calculando pontuação de similaridade para ${allEligiblePsychologists.length} candidatos...`);
        
        let scored = allEligiblePsychologists.map(psy => {
            const { rawMatchScore, explainability } = calculateSimilarity(psy, preferences, priceRange);
            const psyJSON = psy.toJSON ? psy.toJSON() : psy;
            
            const stats = psyStats[psyJSON.id] || { leads: 0, conversoes: 0 };
            
            debugLog.push(`   - ID: ${psyJSON.id} | Score Clínico: ${rawMatchScore.toFixed(2)} | Leads 14d: ${stats.leads} | Fechados 14d: ${stats.conversoes}`);
            
            return { 
                ...psyJSON, 
                leads14d: stats.leads,
                conversoes14d: stats.conversoes,
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

        debugLog.push(`[${Date.now() - startTime}ms] ⚖️ Aplicando algoritmos de fairness V5 (Bônus Fome, Penalidade Desperdício)...`);
        scored = applyFairness(scored, fairShare);

        debugLog.push(`[${Date.now() - startTime}ms] 📊 Candidatos elegíveis (Nota de Corte >= 50)...`);
        
        let eligibleForSlots = [...scored].filter(c => c.rawMatchScore >= 50);
        if (eligibleForSlots.length === 0) {
            debugLog.push(`   ⚠️ Ninguém passou no corte (>=50). Flexibilizando para os melhores disponíveis.`);
            eligibleForSlots = [...scored];
        }

        const results = [];

        // --- VAGA 1: MAIOR MÉRITO CLÍNICO ---
        let slot1Candidates = [...eligibleForSlots].sort((a, b) => b.rawMatchScore - a.rawMatchScore);
        if (slot1Candidates.length > 0) {
            results.push(slot1Candidates[0]);
            debugLog.push(`   🥇 Vaga 1 (Maior Score Clínico): ID ${slot1Candidates[0].id} (Score: ${slot1Candidates[0].rawMatchScore})`);
            eligibleForSlots = eligibleForSlots.filter(c => c.id !== slot1Candidates[0].id);
        }

        // --- VAGA 2: O MAIS OCIOSO (Justiça) ---
        if (eligibleForSlots.length > 0) {
            // Ordenado pelo Bônus Total (finalScore), que já tem bônus para quem tem 0 conversões.
            let slot2Candidates = [...eligibleForSlots].sort((a, b) => b.finalScore - a.finalScore);
            results.push(slot2Candidates[0]);
            debugLog.push(`   ⚖️ Vaga 2 (Justiça/Ocioso): ID ${slot2Candidates[0].id} (Score Final c/ Bônus: ${slot2Candidates[0].finalScore})`);
            eligibleForSlots = eligibleForSlots.filter(c => c.id !== slot2Candidates[0].id);
        }

        // --- VAGA 3: SORTEIO LINEAR C/ HARD COOLDOWN ---
        if (eligibleForSlots.length > 0) {
            // Elimina quem já apareceu na vitrine nas últimas 3 horas (180 mins)
            let slot3Eligible = eligibleForSlots.filter(c => {
                if (!c.last_shown_match_at) return true;
                const mins = (new Date() - new Date(c.last_shown_match_at)) / 60000;
                return mins > 180;
            });

            if (slot3Eligible.length === 0) {
                debugLog.push(`   ⚠️ Todos da base estão em cooldown < 3h. Relaxando regra da Vaga 3.`);
                slot3Eligible = eligibleForSlots;
            }

            const totalWeight = slot3Eligible.reduce((acc, val) => acc + (val.finalScore || 1), 0);
            let randomPoint = Math.random() * totalWeight;
            
            let winner3 = null;
            for (let i = 0; i < slot3Eligible.length; i++) {
                randomPoint -= (slot3Eligible[i].finalScore || 1);
                if (randomPoint <= 0) {
                    winner3 = slot3Eligible[i];
                    break;
                }
            }
            if (!winner3) winner3 = slot3Eligible[0]; // Fallback
            
            results.push(winner3);
            debugLog.push(`   🎲 Vaga 3 (Sorteio): ID ${winner3.id} (Peso de Sorteio Linear: ${winner3.finalScore})`);
        }

        debugLog.push(`[${Date.now() - startTime}ms] ✅ Seleção de Slots concluída!`);

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
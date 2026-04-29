const db = require('../models');
const { Op } = require('sequelize');

// Conecta demandas de identidade do paciente com vivências do psicólogo
const MAPA_CARACTERISTICAS = {
    "LGBTQIAPN+ Friendly 🏳️‍🌈": ["LGBTQIAPN+ Friendly 🏳️‍🌈", "LGBTQIAPN+ friendly", "Afirmativa"],
    "Que faça parte da comunidade LGBTQIAPN+": ["Faz parte da comunidade LGBTQIAPN+ / Afirmativa", "Comunidade LGBTQIAPN+", "Que faça parte da comunidade LGBTQIAPN+"],
    
    "Pessoa não-branca ou com prática antirracista": ["Pessoa não-branca / Prática Antirracista", "Antirracista", "Negritude", "Pessoa não-branca / Antirracista", "Que seja uma pessoa não-branca (racializada) / prática antirracista"],
    
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

// --- FUNÇÃO AUXILIAR: Mapear Idade para Público Alvo ---
const mapAgeToTarget = (idadeStr) => {
    if (!idadeStr) return [];
    if (idadeStr.includes("Menor de 18")) return ["Crianças", "Adolescentes"];
    if (idadeStr.includes("55+")) return ["Idosos", "Adultos"];
    // Para "18-24", "25-34", "35-44", "45-54"
    return ["Adultos"];
};

// --- ALGORITMO DE PONTUAÇÃO ---
const calculateScore = (psychologist, preferences, priceRange) => {
    let score = 0;
    let matchDetails = [];

    // 1. FILTRO RÍGIDO: Modalidade (Online vs Presencial)
    const prefModalidade = preferences.modalidade_preferida;
    if (prefModalidade && prefModalidade !== 'Indiferente' && prefModalidade !== 'Indiferente (Online ou Presencial)') {
        const psiMods = Array.isArray(psychologist.modalidade) ? psychologist.modalidade : [];
        if (!psiMods.includes(prefModalidade) && !psiMods.includes('Indiferente')) {
            score -= 50; // Penalidade forte para evitar frustração do paciente
        } else {
            score += 10;
        }
    }

    // 2. PREÇO (Peso: 25)
    const valorPsi = parseFloat(psychologist.valor_sessao_numero || 0);
    if (valorPsi >= priceRange.min && valorPsi <= priceRange.max) {
        score += 25; // Dentro do orçamento
        matchDetails.push("Dentro do orçamento");
    } else if (valorPsi < priceRange.min) {
        score += 20; // Mais barato também serve
        matchDetails.push("Valor acessível");
    } else if (valorPsi <= priceRange.max * 1.3) {
        score += 10; // Um pouco acima, mas aceitável
    }

    // 3. GÊNERO (Peso: 15)
    if (preferences.genero_profissional && preferences.genero_profissional !== "Indiferente") {
        if (psychologist.genero_identidade === preferences.genero_profissional) {
            score += 15;
            matchDetails.push("Preferência de gênero atendida");
        }
    } else {
        score += 5; // Indiferente ganha ponto base
    }

    // 4. TEMAS E DOR DO PACIENTE (Peso Cumulativo: 10 pts por tema)
    if (preferences.temas_buscados && preferences.temas_buscados.length > 0) {
        const temasPsi = psychologist.temas_atuacao || [];
        
        // Mapa para traduzir as novas opções combinadas do frontend
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
            if (mapaTemas[t]) {
                temasParaBuscar.push(...mapaTemas[t]);
            } else {
                temasParaBuscar.push(t);
            }
        });

        const matches = temasParaBuscar.filter(tema => temasPsi.includes(tema));
        
        // Boost Especial (Neurodiversidade)
        const pedeNeurodiversidade = temasParaBuscar.includes("TDAH") || 
            (preferences.praticas_desejadas && preferences.praticas_desejadas.some(p => p.includes("Neurodiversidade")));

        if (pedeNeurodiversidade) {
             if (temasPsi.includes("TDAH") || temasPsi.includes("Autismo") || temasPsi.includes("Neurodiversidade")) {
                 score += 15; // Boost de match
                 matchDetails.push("Especialista em Neurodiversidade/TDAH");
             }
        }

        if (matches.length > 0) {
            score += matches.length * 10;
            matchDetails.push(`Especialista em ${matches[0]}`);
        }
    }

    // 5. PRÁTICAS INCLUSIVAS / AFIRMATIVAS (Identidade) (Peso: 20 pts por prática)
    if (preferences.praticas_desejadas && preferences.praticas_desejadas.length > 0) {
        const praticasPsi = psychologist.praticas_inclusivas || [];
        let patricasMatches = 0;
        
        preferences.praticas_desejadas.forEach(pref => {
            const termosTecnicos = MAPA_CARACTERISTICAS[pref];
            if (termosTecnicos) {
                const deuMatch = termosTecnicos.some(termo => praticasPsi.includes(termo));
                if (deuMatch) patricasMatches++;
            }
        });

        if (patricasMatches > 0) {
            score += patricasMatches * 20;
            matchDetails.push("Identidade/Vivência compatível");
        }
    }

    // 6. PÚBLICO ALVO (Idade do Paciente) (Peso: 10 pts)
    if (preferences.idade_paciente) {
        const targetsEsperados = mapAgeToTarget(preferences.idade_paciente);
        const alvoPsi = psychologist.publico_alvo || [];
        const atendeIdade = targetsEsperados.some(t => alvoPsi.includes(t));
        if (atendeIdade) {
            score += 10;
        }
    }

    // 7. ESTRATÉGIA PLG: Boost de Novos Profissionais (Trial 14 Dias)
    const TRIAL_DAYS = 14;
    const MAX_TRIAL_CLICKS = 3; // Limite de leads (cliques) para não prejudicar os assinantes antigos
    
    const daysSinceCreation = (new Date() - new Date(psychologist.createdAt)) / (1000 * 60 * 60 * 24);
    const whatsappClicks = psychologist.whatsapp_clicks || 0;

    if (daysSinceCreation <= TRIAL_DAYS && whatsappClicks < MAX_TRIAL_CLICKS) {
        score += 30; // Boost generoso para jogar o profissional novo para os primeiros lugares
        // Nota: Não inserimos no 'matchDetails' para não transparecer ao paciente que é um impulsionamento artificial.
    }

    return { 
        score: Math.max(0, Math.min(score, 99)), // Garante que a pontuação fique entre 0 e 99
        matchDetails: [...new Set(matchDetails)] // Remove detalhes duplicados
    };
};

// --- FUNÇÃO PRINCIPAL EXPORTADA ---
exports.calculateMatches = async (preferences) => {
    // 1. Busca os candidatos base (ativos)
    const allPsychologists = await db.Psychologist.findAll({
        where: {
            status: 'active',
        },
        attributes: { exclude: ['senha', 'cpf', 'cnpj', 'resetPasswordToken', 'resetPasswordExpires'] }
    });

    // 2. Blindagem de Assinatura
    const agora = new Date();
    const validCandidates = allPsychologists.filter(psy => {
        // Blindagem de Qualidade: Oculta perfis em branco (Mesmo que estejam no Trial)
        if (!psy.fotoUrl || !psy.bio || psy.bio.trim().length < 10) return false;

        const isVip = psy.is_exempt === true || String(psy.is_exempt).toLowerCase() === 'true' || psy.is_exempt === 1;
        if (isVip) return true;
        if (!psy.planExpiresAt) return false;
        return new Date(psy.planExpiresAt) > agora;
    });

    const priceRange = parsePriceRange(preferences.valor_sessao_faixa);
    const scoredPsychologists = [];
    
    // 3. Aplica o cálculo
    for (const psy of validCandidates) {
        const { score, matchDetails } = calculateScore(psy, preferences, priceRange);
        
        // Filtro mínimo para não exibir resultados totalmente incompatíveis
        if (score >= 0) { 
            const psyJSON = psy.toJSON();
            psyJSON.matchScore = score; 
            psyJSON.matchDetails = matchDetails; 
            
            scoredPsychologists.push(psyJSON);
        }
    }

    // 4. Ordena do mais compatível pro menos compatível
    scoredPsychologists.sort((a, b) => b.matchScore - a.matchScore);

    // 5. Categoriza (Ideal vs Próximo)
    const IDEAL_THRESHOLD = 70; // Pontuação alta
    
    // Retorna no máximo 3 opções para garantir a premissa de escassez e foco
    const results = scoredPsychologists.slice(0, 3); 

    if (results.length === 0) {
        return { matchTier: 'none', results: [] };
    }

    const bestMatchScore = results[0].matchScore;
    const tier = bestMatchScore >= IDEAL_THRESHOLD ? 'ideal' : 'near';
    
    let compromiseText = "";
    if (tier === 'near') {
        compromiseText = "Não encontramos alguém com 100% das características, mas estes profissionais são excelentes opções.";
    }

    return {
        matchTier: tier,
        compromiseText: compromiseText,
        results: results
    };
};
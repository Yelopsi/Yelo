const db = require('../models');
const { Op } = require('sequelize');

// --- DICIONÁRIO DE TRADUÇÃO (A "PEDRA DE ROSETA") ---
// Conecta a linguagem do paciente (Chave) à linguagem técnica do Psicólogo (Valor)
const MAPA_ABORDAGENS = {
    "Um espaço de escuta e acolhimento para me encontrar": ["Psicanálise", "Humanista / Centrada na Pessoa", "Gestalt-terapia", "Jungiana"],
    "Ferramentas e tarefas práticas para aplicar no dia a dia": ["Terapia Cognitivo-Comportamental (TCC)", "Análise do Comportamento (ABA)"],
    "Entender meu passado e a raiz das minhas emoções": ["Psicanálise", "Jungiana", "Sistêmica"],
    "Focar em soluções para problemas específicos": ["Terapia Cognitivo-Comportamental (TCC)", "Breve / Focal"],
    "Não sei / Indiferente": [] // Dá match com tudo levemente
};

// Conecta demandas de identidade do paciente com vivências do psicólogo
const MAPA_CARACTERISTICAS = {
    "Que faça parte da comunidade LGBTQIAPN+": ["LGBTQIAPN+ friendly", "Afirmativa"], // Ajuste conforme seu cadastro de Psi
    "Que seja uma pessoa não-branca (racializada) / prática antirracista": ["Antirracista", "Negritude"],
    "Que tenha uma perspectiva feminista": ["Feminista"],
    "Que entenda de neurodiversidade (TDAH, Autismo, etc.)": ["Neurodiversidade", "TDAH", "Autismo"] // Mapeia para temas ou práticas
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

// --- ALGORITMO DE PONTUAÇÃO ---
const calculateScore = (psychologist, preferences, priceRange) => {
    let score = 0;
    let matchDetails = [];

    // 1. FILTRO RÍGIDO: Preço (Peso Alto)
    // Se o psicólogo for muito mais caro que o budget, pontua pouco ou zero.
    // Aqui somos flexíveis: se passar até 20% do valor máximo, ainda aceita, mas pontua menos.
    const valorPsi = parseFloat(psychologist.valor_sessao_numero || 0);
    if (valorPsi <= priceRange.max) {
        score += 25; // Dentro do orçamento
        matchDetails.push("Dentro do orçamento");
    } else if (valorPsi <= priceRange.max * 1.2) {
        score += 10; // Um pouco acima, mas aceitável
        matchDetails.push("Valor próximo");
    }

    // 2. GÊNERO (Peso Médio)
    if (preferences.genero_profissional && preferences.genero_profissional !== "Indiferente") {
        if (psychologist.genero_identidade === preferences.genero_profissional) {
            score += 15;
            matchDetails.push("Preferência de gênero atendida");
        }
    } else {
        score += 5; // Indiferente ganha ponto base
    }

    // 3. TEMAS (A Dor do Paciente) - Peso Muito Alto
    // Ex: Paciente tem "Ansiedade". Psi tem "Ansiedade".
    if (preferences.temas_buscados && preferences.temas_buscados.length > 0) {
        const temasPsi = psychologist.temas_atuacao || [];
        const matches = preferences.temas_buscados.filter(tema => temasPsi.includes(tema));
        
        // Bônus especial para Neurodiversidade/TDAH se solicitado
        if (preferences.temas_buscados.includes("TDAH") || preferences.praticas_afirmativas.includes("Que entenda de neurodiversidade (TDAH, Autismo, etc.)")) {
             if (temasPsi.includes("TDAH") || temasPsi.includes("Neurodiversidade")) {
                 score += 15; // Boost de match
                 matchDetails.push("Especialista em Neurodiversidade/TDAH");
             }
        }

        if (matches.length > 0) {
            score += matches.length * 10; // 10 pontos por tema coincidente
            matchDetails.push(`Especialista em ${matches[0]}`);
        }
    }

    // 4. ABORDAGEM (A Tradução Técnica) - Peso Alto
    // Usa o MAPA_ABORDAGENS para traduzir
    if (preferences.abordagem_desejada && preferences.abordagem_desejada.length > 0) {
        const abordagensPsi = psychologist.abordagens_tecnicas || []; // Ex: ["TCC"]
        
        preferences.abordagem_desejada.forEach(desejoPaciente => { // Ex: "Ferramentas práticas..."
            const traducoesTecnicas = MAPA_ABORDAGENS[desejoPaciente] || [];
            
            // Verifica se alguma das traduções está na lista do Psi
            const deuMatch = traducoesTecnicas.some(tec => abordagensPsi.includes(tec));
            
            if (deuMatch) {
                score += 20;
                matchDetails.push("Estilo terapêutico compatível");
            }
        });
    }

    // 5. PRÁTICAS AFIRMATIVAS (Identidade) - Peso Crítico (Pode definir a escolha)
    if (preferences.praticas_afirmativas && preferences.praticas_afirmativas.length > 0) {
        const vivenciasPsi = psychologist.praticas_vivencias || [];
        
        preferences.praticas_afirmativas.forEach(pref => {
            const termosTecnicos = MAPA_CARACTERISTICAS[pref];
            if (termosTecnicos) {
                const deuMatch = termosTecnicos.some(termo => vivenciasPsi.includes(termo));
                if (deuMatch) {
                    score += 20;
                    matchDetails.push("Identidade/Vivência compatível");
                }
            }
        });
    }

    // 6. BOOST DE NOVOS USUÁRIOS (TRIAL 14 DIAS) - PLG Strategy
    const TRIAL_DAYS = 14;
    const MAX_TRIAL_CLICKS = 3; // Limite de leads (cliques) para não prejudicar os assinantes antigos
    
    const daysSinceCreation = (new Date() - new Date(psychologist.createdAt)) / (1000 * 60 * 60 * 24);
    const whatsappClicks = psychologist.whatsapp_clicks || 0;

    if (daysSinceCreation <= TRIAL_DAYS && whatsappClicks < MAX_TRIAL_CLICKS) {
        score += 30; // Boost generoso para jogar o profissional novo para os primeiros lugares
        // Nota: Não inserimos no 'matchDetails' para não transparecer ao paciente que é um impulsionamento artificial.
    }

    return { score, matchDetails };
};

// --- FUNÇÃO PRINCIPAL EXPORTADA ---
exports.findMatches = async (preferences) => {
    // 1. Busca todos os psis ativos e com foto (Requisito básico de qualidade)
    // Otimização: Em produção, faríamos filtros de banco SQL aqui. 
    // Como é MVP e base pequena (<1000), trazemos tudo e filtramos em memória pela complexidade do algoritmo.
    const allPsychologists = await db.Psychologist.findAll({
        where: {
            status: { [Op.in]: ['active', 'pending'] },
            [Op.or]: [
                { is_exempt: true },
                { planExpiresAt: { [Op.gt]: new Date() } },
                { status: 'pending' } // Mantém pending solto para a checagem JS dos 14 dias
            ]
            // fotoUrl: { [Op.ne]: null } // Opcional: só mostrar quem tem foto
        },
        attributes: { exclude: ['senha', 'cpf', 'cnpj', 'resetPasswordToken'] }
    });

    const priceRange = parsePriceRange(preferences.valor_sessao_faixa);
    const scoredPsychologists = [];
    
    const TRIAL_DAYS = 14;

    // 2. Calcula Score para cada um
    for (const psy of allPsychologists) {
        // --- CONTROLE DE EXIBIÇÃO (TRIAL EXPIRADO OU ASSINATURA VENCIDA) ---
        const isVip = psy.is_exempt === true || String(psy.is_exempt).toLowerCase() === 'true' || psy.is_exempt === 1;
        if (!isVip) {
            if (psy.status === 'pending') {
                const daysSinceCreation = (new Date() - new Date(psy.createdAt)) / (1000 * 60 * 60 * 24);
                if (daysSinceCreation > TRIAL_DAYS) continue; 
            } else if (psy.status === 'active') {
                if (!psy.planExpiresAt || new Date(psy.planExpiresAt) <= new Date()) {
                    continue; // Pula no exato segundo do vencimento
                }
            } else {
                continue; // Pula inativos e rejeitados
            }
        }

        const { score, matchDetails } = calculateScore(psy, preferences, priceRange);
        
        // Só adiciona se tiver um mínimo de compatibilidade
        if (score > 10) {
            // Adiciona propriedades virtuais para o frontend ler
            const psyJSON = psy.toJSON();
            psyJSON.matchScore = score; // Usado para debug ou ordenação
            psyJSON.matchDetails = matchDetails; // Para mostrar "Por que esse match?"
            
            // Flag de "Favorito" viria aqui se tivéssemos o ID do usuário logado
            
            scoredPsychologists.push(psyJSON);
        }
    }

    // 3. Ordena pelo Score (Do maior para o menor)
    scoredPsychologists.sort((a, b) => b.matchScore - a.matchScore);

    // 4. Categoriza (Ideal vs Próximo)
    const IDEAL_THRESHOLD = 70; // Pontuação alta
    const results = scoredPsychologists.slice(0, 6); // Top 6

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
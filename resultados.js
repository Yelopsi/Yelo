// js/resultados.js
// CORREÇÃO: Definição segura da API (evita o erro de configuração)

// Se a variável global não existir, cria uma local apontando para o seu PC
var BASE_URL = (typeof window.API_BASE_URL !== 'undefined') 
    ? window.API_BASE_URL 
    : 'http://localhost:3001';

document.addEventListener('DOMContentLoaded', async () => {

    const loadingState = document.getElementById('loading-state');
    const resultsContainer = document.getElementById('results-container');
    const loginUrl = 'login.html'; // URL para redirecionar se não houver login

    // --- FUNÇÃO PARA CRIAR O CARD (COM LÓGICA DE FAVORITO TEMPORÁRIO) ---
    function createProfileCard(profile, tier, compromiseText = "") {
        const contextLabel = tier === 'near' && compromiseText
            ? `<div class="match-context-alert">⚠️ ${compromiseText}</div>`
            : '';

        const foto = profile.fotoUrl || 'assets/images/default-avatar.png'; 
        const bio = profile.bio || "Profissional dedicado(a) a oferecer um espaço seguro para seu desenvolvimento.";
        const preco = profile.valor_sessao_numero 
            ? `R$ ${parseFloat(profile.valor_sessao_numero).toFixed(2).replace('.', ',')}` 
            : 'Sob consulta';

        // Lógica da Porcentagem
        let score = profile.matchScore || 0; 
        if (score > 99) score = 99; 
        if (score < 60) score = 60;
        if (!profile.matchScore) score = tier === 'ideal' ? 95 : 75;

        // Tags
        let tagsHtml = '';
        if (profile.matchDetails && profile.matchDetails.length > 0) {
            tagsHtml = profile.matchDetails.map(tag => {
                // ABREVIAÇÃO AUTOMÁTICA
                const textoAbreviado = tag.replace('Especialista em', 'Espec. em');
                return `<span class="tag tag-match">✨ ${textoAbreviado}</span>`;
            }).join('');
        } else if (profile.temas_atuacao && profile.temas_atuacao.length > 0) {
            tagsHtml = profile.temas_atuacao.slice(0, 3).map(tag => `<span class="tag">${tag}</span>`).join('');
        }

        // --- LÓGICA NOVA DE FAVORITO ---
        // Verifica se já está favoritado (seja via API ou localmente)
        const token = localStorage.getItem('girassol_token');
        let isFav = profile.isFavorited;

        if (!token) {
            // Se não tá logado, olha na "memória temporária" do navegador
            const tempFavs = JSON.parse(localStorage.getItem('temp_favorites') || '[]');
            if (tempFavs.includes(String(profile.id))) {
                isFav = true;
            }
        }

        const heartIcon = isFav ? '♥' : '♡';
        const heartClass = isFav ? 'heart-icon favorited' : 'heart-icon';
        // -------------------------------

        return `
            <div class="pro-card pro-card-resultado">
                ${contextLabel}
                <div class="pro-card-header">
                    <div class="match-percentage-badge">${score}% Compatível</div>
                    
                    <img src="${foto}" alt="Foto de ${profile.nome}" class="pro-card-img">
                    <span class="${heartClass}" data-id="${profile.id}" role="button" aria-label="Favoritar">${heartIcon}</span>
                </div>
                
                <div class="pro-card-body">
                    <div class="pro-info">
                        <h3>${profile.nome}</h3>
                        <p class="crp">CRP ${profile.crp}</p>
                        <div class="rating-badge">
                            ${profile.review_count > 0 
                                ? `★ ${profile.average_rating} <span class="review-count">(${profile.review_count})</span>` 
                                : '<span class="new-badge">Novo</span>'}
                        </div>
                    </div>

                    <div class="match-reasons">
                        ${tagsHtml}
                    </div>

                    <p class="bio-snippet">${bio.substring(0, 110)}${bio.length > 110 ? '...' : ''}</p>
                    
                    <div class="pro-footer">
                        <div class="price-tag">
                            <span class="label">Sessão</span>
                            <span class="value">${preco}</span>
                        </div>
                        <a href="perfil_psicologo.html?slug=${profile.slug}" class="btn btn-principal btn-sm">Ver Perfil</a>
                    </div>
                </div>
            </div>
        `;
    }

    // --- FUNÇÃO PRINCIPAL DE RENDERIZAÇÃO ---
    function renderResults(data) { // --- FUNÇÃO PRINCIPAL DE RENDERIZAÇÃO (TEXTOS HUMANIZADOS) ---
        let htmlContent = '';
        
        // Novos textos: Mais acolhedores e menos "robóticos"
        const titulo = data.matchTier === 'ideal' 
            ? "Que bom que você chegou até aqui." 
            : "Aqui estão caminhos possíveis para o seu bem-estar.";
            
        const subtitulo = data.matchTier === 'ideal'
            ? "Com base nas suas respostas, sentimos que estes profissionais têm a escuta e a experiência que você procura."
            : (data.compromiseText || "Ainda que a compatibilidade não seja total, acreditamos que estes profissionais podem te oferecer um ótimo acolhimento.");

        if (data.results && data.results.length > 0) {
            htmlContent = `
                <div class="resultados-intro">
                    <h1>${titulo}</h1>
                    <p>${subtitulo}</p>
                </div>
                <div class="pro-results-grid">
                    ${data.results.map(profile => createProfileCard(profile, data.matchTier)).join('')}
                </div>
                <div class="results-actions" style="text-align: center; margin-top: 40px;">
                    <a href="questionario.html" class="btn btn-outline" style="color: var(--verde-escuro); border-color: var(--verde-escuro);">Refazer Busca</a>
                </div>
            `;
        } else {
            // Cenário: Nenhum resultado
            htmlContent = `
                <div class="no-results-container">
                    <img src="assets/images/searching.svg" alt="Ilustração de busca" style="max-width: 200px; margin-bottom: 20px; opacity: 0.8;">
                    <h2>Estamos expandindo nossa rede de cuidado.</h2>
                    <p>No momento, não encontramos alguém com 100% das características específicas que você pediu, mas novos profissionais chegam todos os dias.</p>
                    <a href="questionario.html" class="btn btn-principal">Tentar ajustar alguns filtros</a>
                </div>
            `;
        }
        
        loadingState.classList.add('hidden');
        resultsContainer.innerHTML = htmlContent;
        resultsContainer.classList.remove('hidden');

        setupFavoriteButtons();
    }

    // --- FUNÇÃO DE INICIALIZAÇÃO DA PÁGINA ---
    function initializePage() {
        // Tenta pegar o resultado real
        let storedResults = sessionStorage.getItem('matchResults');

        // --- MODO DE DESENVOLVIMENTO: DADOS MOCKADOS ---
        // Se não tiver dados reais, cria dados falsos para você ver a tela
        // Substitua o bloco "MODO DEV" antigo por este:
    // --- DENTRO DE initializePage, SUBSTITUA O MOCK DATA POR ESTE ---
    if (!storedResults) {
        console.warn("MODO DEV: Gerando perfis com porcentagem.");
            storedResults = JSON.stringify({
                matchTier: 'ideal',
                results: [
                    {
                        id: 1,
                        nome: "Dra. Ana Silva",
                        crp: "06/123456",
                        fotoUrl: "https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=400",
                        valor_sessao_numero: 150.00,
                        bio: "Especialista em TCC com foco em ansiedade e desenvolvimento de carreira.",
                        slug: "ana-silva",
                        matchDetails: ["Dentro do orçamento", "Especialista em Ansiedade", "TCC"],
                        matchScore: 98, // ADICIONADO: Porcentagem Alta
                        average_rating: 4.9,
                        review_count: 24,
                        temas_atuacao: ["Ansiedade", "Carreira"],
                        isFavorited: false
                    },
                    {
                        id: 2,
                        nome: "Dr. João Costa",
                        crp: "06/987654",
                        fotoUrl: "https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=400",
                        valor_sessao_numero: 120.00,
                        bio: "Psicanálise e escuta ativa. Um espaço seguro para entender suas emoções.",
                        slug: "joao-costa",
                        matchDetails: ["Estilo compatível", "Experiência em Luto"],
                        matchScore: 85, // ADICIONADO: Porcentagem Média
                        average_rating: 5.0,
                        review_count: 12,
                        temas_atuacao: ["Luto", "Depressão"],
                        isFavorited: true
                    },
                    {
                        id: 3,
                        nome: "Psi. Mariana Luz",
                        crp: "06/555123",
                        fotoUrl: "https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=400",
                        valor_sessao_numero: 90.00,
                        bio: "Atendimento humanizado para jovens e adultos. Foco em autoestima.",
                        slug: "mariana-luz",
                        matchDetails: ["Valor acessível", "Horário Flexível"],
                        matchScore: 79, // ADICIONADO: Porcentagem Menor
                        average_rating: 0,
                        review_count: 0,
                        temas_atuacao: ["Autoestima", "Relacionamentos"],
                        isFavorited: false
                    }
                ]
            });
        }
        // -----------------------------------------------

        if (storedResults) {
            renderResults(JSON.parse(storedResults));
            // sessionStorage.removeItem('matchResults'); // Comente essa linha enquanto estiver desenvolvendo!
        } else {
            fetchAndRenderMatches();
        }
    }

    // --- FUNÇÃO PARA BUSCAR OS DADOS REAIS DA API ---
    async function fetchAndRenderMatches() {
        // Esta função agora é o "fallback" para usuários já logados
        console.log("Buscando recomendações na API...");

        // SUGESTÃO: Lógica para texto de carregamento dinâmico
        const loadingMessages = [
            "Analisando suas respostas...",
            "Buscando os perfis mais compatíveis...",
            "Afinando os últimos detalhes...",
            "Quase lá!"
        ];
        let messageIndex = 0;
        const loadingTextElement = document.querySelector('#loading-state p');

        const messageInterval = setInterval(() => {
            if (loadingTextElement && messageIndex < loadingMessages.length) {
                loadingTextElement.textContent = loadingMessages[messageIndex];
                messageIndex++;
            } else {
                clearInterval(messageInterval);
            }
        }, 2000); // Muda a mensagem a cada 2 segundos

        // Garante que o intervalo seja limpo quando os resultados chegarem
        const clearLoadingInterval = () => clearInterval(messageInterval);

        // 1. Pega o token do localStorage
        const token = localStorage.getItem('girassol_token');

        // 2. Se não houver token, redireciona para o login
        if (!token) {
            console.error("Token não encontrado. Redirecionando para login.");
            clearLoadingInterval();
            window.location.href = loginUrl;
            return;
        }

        try {
            // 3. Faz a chamada para a API, enviando o token
            const response = await fetch(`${BASE_URL}/api/psychologists/matches`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            // 4. Trata a resposta
            if (response.ok) {
                clearLoadingInterval();
                const data = await response.json();
                console.log("Dados recebidos da API:", data);
                renderResults(data); // Renderiza os resultados reais
            } else {
                // Se o token for inválido ou expirado, a API retornará um erro 401
                clearLoadingInterval();
                console.error("Falha na autenticação ou erro na API:", response.status);
                localStorage.removeItem('girassol_token'); // Limpa o token inválido
                window.location.href = loginUrl; // Envia para o login
            }

        } catch (error) {
            clearLoadingInterval();
            console.error("Erro de conexão ao buscar matches:", error);
            // Renderiza o estado de "nenhum resultado" com uma mensagem de erro
            renderResults({ matchTier: 'none', results: [] });
        }
    }

    // --- FUNÇÃO PARA MOSTRAR NOTIFICAÇÕES (TOAST) ---
    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        container.appendChild(toast);

        // Remove o toast do DOM após a animação de saída
        setTimeout(() => {
            toast.remove();
        }, 4500);
    }

    // --- FUNÇÃO PARA CONTROLAR OS BOTÕES DE FAVORITO (HÍBRIDA) ---
    function setupFavoriteButtons() {
        // Usa delegação de eventos ou seleciona novamente (para garantir que pegue os novos cards)
        const favoriteButtons = document.querySelectorAll('.heart-icon');
        
        favoriteButtons.forEach(button => {
            // Clona e substitui para remover event listeners antigos e evitar cliques duplos
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);

            newButton.addEventListener('click', async (e) => {
                e.preventDefault(); 
                e.stopPropagation(); // Evita clicar no card se houver link
                
                const psychologistId = newButton.dataset.id;
                const token = localStorage.getItem('girassol_token');

                // --- CENÁRIO 1: USUÁRIO NÃO LOGADO (OFFLINE) ---
                if (!token) {
                    // 1. Alterna visualmente na hora (Feedback Imediato)
                    const isNowFavorited = newButton.classList.toggle('favorited');
                    newButton.textContent = isNowFavorited ? '♥' : '♡';

                    // 2. Salva/Remove da lista temporária no navegador
                    let tempFavs = JSON.parse(localStorage.getItem('temp_favorites') || '[]');
                    
                    if (isNowFavorited) {
                        if (!tempFavs.includes(psychologistId)) tempFavs.push(psychologistId);
                        // AVISO INTELIGENTE
                        showToast("Salvo! Crie uma conta para não perder essa lista.", "success");
                    } else {
                        tempFavs = tempFavs.filter(id => id !== psychologistId);
                    }
                    
                    localStorage.setItem('temp_favorites', JSON.stringify(tempFavs));
                    return; // Para aqui, não chama a API
                }

                // --- CENÁRIO 2: USUÁRIO LOGADO (ONLINE/API) ---
                try {
                    const response = await fetch(`${BASE_URL}/api/patients/me/favorites`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ psychologistId })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        newButton.textContent = data.favorited ? '♥' : '♡';
                        newButton.classList.toggle('favorited', data.favorited);
                        showToast(data.message, 'success');
                    }
                } catch (error) {
                    console.error("Erro ao favoritar:", error);
                    showToast("Erro de conexão.", 'error');
                }
            });
        });
    }

    // --- INICIA O PROCESSO REAL ---
    initializePage();
});
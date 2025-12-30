document.addEventListener('DOMContentLoaded', () => {
    // Pega a URL base do config.js ou usa fallback
    const BASE_URL = window.API_BASE_URL || 'http://localhost:3001';

    const loadingScreen = document.getElementById('loading-screen');
    const resultsContent = document.getElementById('results-content');
    const grid = document.getElementById('results-grid');
    
    function createCard(profile) {
        const tagsHtml = profile.tags.map(tag => `<span class="match-tag">${tag}</span>`).join('');
        const priceFormatted = profile.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        // Lógica de Favorito (Verifica localStorage se não tiver info do backend)
        let isFav = profile.isFavorited;
        const token = localStorage.getItem('Yelo_token');
        
        if (!token) {
            // Se não está logado, verifica a lista temporária
            const tempFavs = JSON.parse(localStorage.getItem('temp_favorites') || '[]');
            if (tempFavs.includes(String(profile.id))) isFav = true;
        }

        const heartClass = isFav ? 'heart-icon favorited' : 'heart-icon';
        const heartSymbol = isFav ? '♥' : '♡';

        return `
            <div class="match-card">
                <div class="match-badge">${profile.score}% Compatível</div>
                <div class="${heartClass}" data-id="${profile.id}" title="Favoritar">${heartSymbol}</div>
                
                <img src="${profile.fotoUrl}" alt="${profile.nome}" class="match-header-img">
                
                <div class="match-body">
                    <h3 class="match-name">${profile.nome}</h3>
                    <span class="match-crp">CRP ${profile.crp}</span>
                    
                    <div class="match-tags">
                        ${tagsHtml}
                    </div>
                    
                    <p class="match-bio">${profile.bio}</p>
                    
                    <div class="match-footer">
                        <div class="match-price">
                            <span>Valor Sessão</span>
                            <strong>${priceFormatted}</strong>
                        </div>
                        <a href="/${profile.slug}" class="btn-profile" target="_blank">Ver Perfil</a>
                    </div>
                </div>
            </div>
        `;
    }

    // Função para ativar os botões de coração
    function setupFavoriteButtons() {
        document.querySelectorAll('.heart-icon').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();

                const id = btn.dataset.id;
                const token = localStorage.getItem('Yelo_token');
                
                // Alterna visualmente na hora (Feedback instantâneo)
                const isNowFav = btn.classList.toggle('favorited');
                btn.textContent = isNowFav ? '♥' : '♡';

                if (!token) {
                    // --- MODO OFFLINE (Sem Login) ---
                    let tempFavs = JSON.parse(localStorage.getItem('temp_favorites') || '[]');
                    if (isNowFav) {
                        if (!tempFavs.includes(id)) tempFavs.push(id);
                        showToast('Salvo nos favoritos temporários!', 'success');
                    } else {
                        tempFavs = tempFavs.filter(favId => favId !== id);
                    }
                    localStorage.setItem('temp_favorites', JSON.stringify(tempFavs));
                } else {
                    // --- MODO ONLINE (Com API) ---
                    try {
                        await fetch(`${BASE_URL}/api/patients/me/favorites`, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ psychologistId: id })
                        });
                        // Não precisamos fazer nada se der certo, o visual já mudou
                    } catch (error) {
                        console.error("Erro ao favoritar", error);
                        // Reverte se der erro
                        btn.classList.toggle('favorited');
                        btn.textContent = !isNowFav ? '♥' : '♡';
                        showToast('Erro ao salvar favorito.', 'error');
                    }
                }
            });
        });
    }

    // Função para contabilizar o KPI "Aparições no Top 3"
    function trackTop3Appearances(profiles) {
        if (!profiles || !Array.isArray(profiles)) return;

        // Pega apenas os 3 primeiros resultados (Top 3)
        const top3 = profiles.slice(0, 3);

        top3.forEach(profile => {
            if (profile.id) {
                // Envia o evento para o backend (Fire and Forget)
                fetch(`${BASE_URL}/api/public/psychologists/${profile.id}/appearance`, { 
                    method: 'POST' 
                }).catch(err => console.warn(`Erro ao registrar aparição para ID ${profile.id}`, err));
            }
        });
    }

    function init() {
        // BLOQUEIO: Verifica se há resultados para mostrar
        if (!sessionStorage.getItem('matchResults')) {
            createBlockingModal(
                "Ops! Nenhum resultado.",
                "Você precisa responder o questionário antes de ver os resultados.",
                "/questionario.html"
            );
            return;
        }

        // Simula delay de carregamento
        setTimeout(() => {
            // Tenta pegar dados reais do sessionStorage
            const stored = sessionStorage.getItem('matchResults');
            let dataToRender = [];

            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    if (parsed.results && parsed.results.length > 0) {
                        // Mapeia os dados reais para o formato do card novo
                        dataToRender = parsed.results.map(p => ({
                            id: p.id,
                            nome: p.nome,
                            crp: p.crp,
                            fotoUrl: p.fotoUrl || "https://placehold.co/400",
                            valor: parseFloat(p.valor_sessao_numero || 0),
                            bio: p.bio || "Sem biografia.",
                            slug: p.slug,
                            tags: p.matchDetails || p.temas_atuacao || [],
                            score: p.matchScore || 90,
                            isFavorited: p.isFavorited || false
                        }));
                    }
                } catch (e) {
                    console.error("Erro ao ler dados salvos", e);
                }
            }

            // Renderiza
            if (dataToRender.length === 0) {
                grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #666;">Nenhum profissional encontrado com os critérios selecionados. <br><a href="/questionario.html" style="color: var(--verde-escuro); font-weight: bold;">Refazer busca</a></div>';
            } else {
                grid.innerHTML = dataToRender.map(createCard).join('');
            }
            
            // Ativa os botões
            setupFavoriteButtons();
            
            // KPI: Contabiliza aparições para os 3 primeiros
            trackTop3Appearances(dataToRender);

            // Troca telas
            loadingScreen.style.display = 'none';
            resultsContent.style.display = 'block';
            
        }, 1500);
    }

    // Função simples de Toast (Notificação)
    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.display = 'block';
        toast.style.opacity = '1';
        
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    init();

    // Função para criar Modal de Bloqueio (Estilo Yelo)
    function createBlockingModal(title, message, redirectUrl) {
        const overlay = document.createElement('div');
        overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter: blur(3px);";
        
        const modal = document.createElement('div');
        modal.style.cssText = "background:white; padding:30px; border-radius:16px; width:90%; max-width:400px; text-align:center; box-shadow:0 20px 40px rgba(0,0,0,0.2); font-family: 'Inter', sans-serif; animation: slideUp 0.3s ease-out;";
        
        modal.innerHTML = `
            <div style="font-size:3rem; margin-bottom:15px;">⚠️</div>
            <h3 style="color:#1B4332; margin:0 0 10px 0; font-size:1.5rem;">${title}</h3>
            <p style="color:#555; font-size:1rem; line-height:1.5; margin-bottom:25px;">${message}</p>
            <button id="btn-block-redirect" style="background:#1B4332; color:white; border:none; padding:12px 30px; border-radius:50px; font-weight:bold; font-size:1rem; cursor:pointer; width:100%; transition: transform 0.2s;">Entendi</button>
        `;
        
        const style = document.createElement('style');
        style.innerHTML = `@keyframes slideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }`;
        document.head.appendChild(style);

        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        document.getElementById('btn-block-redirect').onclick = () => window.location.href = redirectUrl;
    }
});
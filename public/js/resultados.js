document.addEventListener('DOMContentLoaded', () => {
    // Pega a URL base do config.js ou usa fallback
    const BASE_URL = window.API_BASE_URL || 'http://localhost:3001';

    const loadingScreen = document.getElementById('loading-screen');
    const resultsContent = document.getElementById('results-content');
    const grid = document.getElementById('results-grid');
    
    function createCard(profile) {
        // Limita a 3 tags visuais no card
        const displayTags = profile.tags.slice(0, 3);
        let tagsHtml = displayTags.map(tag => `<span class="match-tag">${tag}</span>`).join('');
        
        // Se houver mais tags ocultas, avisa o usuário (ex: +2)
        if (profile.tags.length > 3) {
            tagsHtml += `<span class="match-tag" style="background: transparent; border: none; padding-left: 0; color: #888;">+${profile.tags.length - 3}</span>`;
        }

        let precoHtml = '';
        const isMensal = profile.tipo_cobranca === 'mensal';
        
        // Pega o valor (faz fallback entre os campos pois o form salva no valor_sessao_numero por padrão)
        const rawValue = isMensal 
            ? (profile.valor_mensal_numero || profile.valor_sessao_numero) 
            : (profile.valor_sessao_numero || profile.valor_mensal_numero);

        // Limpa formatações (R$, espaços, vírgulas e pontos) para converter em float seguro
        const parsePrice = (val) => {
            if (!val) return 0;
            if (typeof val === 'number') return val;
            let str = String(val).replace(/[R$\s]/gi, '');
            if (str.includes(',') && str.includes('.')) {
                str = str.replace(/\./g, '').replace(',', '.'); // ex: "1.500,00" -> "1500.00"
            } else if (str.includes(',')) {
                str = str.replace(',', '.'); // ex: "150,00" -> "150.00"
            }
            return parseFloat(str) || 0;
        };

        const priceNum = parsePrice(rawValue);

        if (priceNum > 0) {
            const priceFormatted = priceNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            precoHtml = `<span>Por ${isMensal ? 'mês' : 'sessão'}</span><strong>${priceFormatted}</strong>`;
        } else {
            precoHtml = `<span>Por ${isMensal ? 'mês' : 'sessão'}</span><strong style="font-size: 1.1rem;">A combinar</strong>`;
        }
        
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
            <div class="match-card" style="animation-delay: ${profile.animationDelay}s; cursor: pointer;" data-slug="${profile.slug}">
                <div class="match-badge">${profile.score}% Compatível</div>
                <div class="${heartClass}" data-id="${profile.id}" title="Favoritar">${heartSymbol}</div>
                
                <div class="match-header-wrapper">
                    <img src="${profile.fotoUrl}" alt="${profile.nome}" class="match-header-img" onerror="this.src='https://placehold.co/400x500/1B4332/FFF?text=Foto'">
                </div>
                
                <div class="match-body">
                    <h3 class="match-name">${profile.nome}</h3>
                    <span class="match-crp">CRP ${profile.crp}</span>
                    
                    <div class="match-tags">
                        ${tagsHtml}
                    </div>
                    
                    <p class="match-bio">${profile.bio}</p>
                    
                    <div class="match-footer">
                        <div class="match-price">${precoHtml}</div>
                        <a href="/${profile.slug}?ref=match" class="btn-profile" target="_blank">Ver Perfil</a>
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
                        // Reverte se der erro
                        btn.classList.toggle('favorited');
                        btn.textContent = !isNowFav ? '♥' : '♡';
                        showToast('Erro ao salvar favorito.', 'error');
                    }
                }
            });
        });
    }

    function init() {
        // BLOQUEIO: Verifica se há resultados para mostrar
        const storedResults = sessionStorage.getItem('matchResults');
        const pendingAnswers = sessionStorage.getItem('pendingMatchAnswers');

        if (!storedResults && !pendingAnswers) {
            createBlockingModal(
                "Ops! Nenhum resultado.",
                "Você precisa responder o questionário antes de ver os resultados.",
                "/questionario.html"
            );
            return;
        }

        if (loadingScreen) {
            loadingScreen.style.display = 'flex';
            loadingScreen.style.opacity = '1';
        }
        if (resultsContent) {
            resultsContent.style.display = 'none';
        }

        if (pendingAnswers) {
            const userAnswers = JSON.parse(pendingAnswers);
            fetch(`${BASE_URL}/api/psychologists/match`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userAnswers),
            })
            .then(res => res.ok ? res.json() : { matchTier: 'none', results: [] })
            .then(matchData => {
                sessionStorage.setItem('matchResults', JSON.stringify(matchData));
                sessionStorage.removeItem('pendingMatchAnswers');
                renderData(matchData);
            })
            .catch(() => renderData({ matchTier: 'none', results: [] }));
        } else {
            renderData(JSON.parse(storedResults));
        }
    }

    function renderData(parsed) {
        let dataToRender = [];
        if (parsed && parsed.results && parsed.results.length > 0) {
            const top3Results = parsed.results.slice(0, 3);
            dataToRender = top3Results.map((p, index) => ({
                id: p.id,
                nome: p.nome,
                crp: p.crp,
                fotoUrl: p.fotoUrl || "https://placehold.co/400",
                tipo_cobranca: p.tipo_cobranca || 'sessao',
                valor_sessao_numero: p.valor_sessao_numero,
                valor_mensal_numero: p.valor_mensal_numero,
                bio: p.bio || "Sem biografia.",
                slug: p.slug,
                tags: p.matchDetails || p.temas_atuacao || [],
                score: p.matchScore || 90,
                isFavorited: p.isFavorited || false,
                animationDelay: index * 0.15
            }));
        }

        if (dataToRender.length === 0) {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #666;">Nenhum profissional encontrado com os critérios selecionados. <br><a href="/questionario.html" style="color: var(--verde-escuro); font-weight: bold;">Refazer busca</a></div>';
        } else {
            grid.innerHTML = dataToRender.map(createCard).join('');
        }
        
        setupFavoriteButtons();

        loadingScreen.style.transition = 'opacity 0.3s ease';
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
            loadingScreen.style.display = 'none';
            resultsContent.style.opacity = '0';
            resultsContent.style.display = 'block';
            resultsContent.style.transition = 'opacity 0.4s ease';
            requestAnimationFrame(() => {
                resultsContent.style.opacity = '1';
            });
        }, 150);
        
        grid.addEventListener('click', (e) => {
            const card = e.target.closest('.match-card');
            if (card && !e.target.closest('.heart-icon')) {
                const slug = card.dataset.slug;
                if (!e.target.closest('.btn-profile') && slug) {
                    window.open(`/${slug}?ref=match`, '_blank');
                }
            }
        });
    }

    // Função de Notificação (Estilo WhatsApp)
    function showToast(message, type = 'success') {
        // Garante que o container exista
        let container = document.getElementById('pill-notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'pill-notification-container';
            document.body.appendChild(container);
        }

        const pill = document.createElement('div');
        pill.className = `pill-notification ${type}`;

        // Ícones para cada tipo
        let iconHtml = '';
        if (type === 'success') {
            iconHtml = '<span class="icon">✅</span>';
        } else if (type === 'error') {
            iconHtml = '<span class="icon">❌</span>';
        } else if (type === 'info') {
            iconHtml = '<span class="icon">ℹ️</span>';
        }

        pill.innerHTML = `${iconHtml}<span>${message}</span>`;
        
        container.appendChild(pill);

        /// a animação CSS cuida da entrada e saída. Apenas removemos o elemento do DOM depois.
        setTimeout(() => {
            pill.remove();
        }, 4500); // O tempo da animação é 4.5s
    }

    init();

    // Função para criar Modal de Bloqueio (Estilo Yelo)
    function createBlockingModal(title, message, redirectUrl) {
        const overlay = document.createElement('div');
        overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter: blur(3px); animation: modalOverlayFade 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;";
        const modal = document.createElement('div');
        modal.style.cssText = "background:white; padding:30px; border-radius:16px; width:90%; max-width:400px; text-align:center; box-shadow:0 20px 40px rgba(0,0,0,0.2); font-family: 'Inter', sans-serif; animation: modalContentPop 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;";
        modal.innerHTML = `
            <div style="font-size:3rem; margin-bottom:15px;">⚠️</div>
            <h3 style="color:#1B4332; margin:0 0 10px 0; font-size:1.5rem;">${title}</h3>
            <p style="color:#555; font-size:1rem; line-height:1.5; margin-bottom:25px;">${message}</p>
            <button id="btn-block-redirect" style="background:#1B4332; color:white; border:none; padding:12px 30px; border-radius:50px; font-weight:bold; font-size:1rem; cursor:pointer; width:100%; transition: transform 0.2s;">Entendi</button>
        `;
        
        const style = document.createElement('style');
        style.innerHTML = `@keyframes modalOverlayFade { from { opacity: 0; backdrop-filter: blur(0px); } to { opacity: 1; backdrop-filter: blur(3px); } } @keyframes modalContentPop { from { opacity: 0; transform: translateY(30px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }`;
        document.head.appendChild(style);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        document.getElementById('btn-block-redirect').onclick = () => window.location.href = redirectUrl;
    }
});
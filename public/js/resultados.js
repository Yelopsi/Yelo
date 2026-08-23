document.addEventListener('DOMContentLoaded', () => {
    // Pega a URL base do config.js ou usa fallback
    const BASE_URL = window.API_BASE_URL || 'http://localhost:3001';

    const loadingScreen = document.getElementById('loading-screen');
    const resultsContent = document.getElementById('results-content');
    const grid = document.getElementById('results-grid');
    
    // Elementos do Load More
    const loadMoreContainer = document.getElementById('load-more-container');
    const btnLoadMore = document.getElementById('btn-load-more');
    const loadMoreSpinner = document.getElementById('load-more-spinner');
    
    let currentDisplayedIds = [];
    let clickCount = 0;
    const MAX_CLICKS = 1; // Limite de 1 clique (trazendo mais 3 psicólogos no total, somando 6 na tela)
    
    
    function createCard(profile) {
        console.log("Card Data:", profile);
        // NOVA LÓGICA: Usa os motivos gerados pela IA ou faz fallback para as antigas tags
        let reasonsHtml = '';
        let matchReasons = profile.matchReasons || [];
        if (typeof matchReasons === 'string') matchReasons = [matchReasons];
        
        let tags = profile.tags || [];
        if (typeof tags === 'string') tags = tags.split(',').map(t => t.trim());
        
        const displayReasons = (matchReasons.length > 0) ? matchReasons.slice(0, 1) : tags.slice(0, 1);

        if (displayReasons && displayReasons.length > 0) {
            reasonsHtml = `
                <div class="match-reasons-box" style="background-color: #E8F5E9; padding: 12px; border-radius: 8px; margin-bottom: 15px;">
                    <span style="display: block; font-size: 0.75rem; font-weight: 700; color: var(--verde-escuro); text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">Por que recomendamos</span>
                    <p id="reason-text-${profile.id}" style="margin: 0; color: var(--verde-escuro); font-size: 0.85rem; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;"></p>
                </div>
            `;
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

        // Mapeia o score original (0 a 100) para a faixa (85 a 99) para manter a percepção de alta compatibilidade
        const displayScore = (85 + (parseFloat(profile.score) * 0.14)).toFixed(1);

        // Lógica de validação do link da foto (só aceita HTTP/HTTPS, previne javascript:alert)
        const isSafeFoto = (profile.fotoUrl && (profile.fotoUrl.startsWith('http://') || profile.fotoUrl.startsWith('https://')));
        const placeholderFoto = 'https://placehold.co/400x500/1B4332/FFF?text=Foto';

        // Retorna o HTML estrutural com IDs estáticos e vazios. 
        // Nenhum dado do usuário controlado é interpolado diretamente aqui.
        return `
            <div class="match-card" id="card-${profile.id}" style="animation-delay: ${profile.animationDelay}s; cursor: pointer;">
                <div class="match-badge">${displayScore}% Compatível</div>
                <div class="${heartClass}" data-id="${profile.id}" title="Favoritar">${heartSymbol}</div>
                
                <div class="match-header-wrapper">
                    <img id="img-${profile.id}" src="${isSafeFoto ? profile.fotoUrl : placeholderFoto}" class="match-header-img" onerror="this.src='${placeholderFoto}'">
                </div>
                
                <div class="match-body">
                    <h3 id="nome-${profile.id}" class="match-name"></h3>
                    <span id="crp-${profile.id}" class="match-crp"></span>
                    
                    ${reasonsHtml}
                    
                    <div id="bio-text-${profile.id}" class="match-bio"></div>
                    
                    <div class="match-footer">
                        <div class="match-price">${precoHtml}</div>
                        <a id="link-${profile.id}" class="btn-profile" target="_blank">Ver Perfil</a>
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

        // Recuperar excludeIds, se já existir
        const storedExcludeIds = sessionStorage.getItem('yelo_excludeIds');
        if (storedExcludeIds) {
            currentDisplayedIds = JSON.parse(storedExcludeIds);
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
                sessionStorage.setItem('yelo_lastAnswers', pendingAnswers);
                sessionStorage.removeItem('pendingMatchAnswers');
                
                // Salvar IDs iniciais
                if (matchData.results) {
                    currentDisplayedIds = matchData.results.map(r => r.id);
                    sessionStorage.setItem('yelo_excludeIds', JSON.stringify(currentDisplayedIds));
                }
                
                renderData(matchData, false);
            })
            .catch(() => renderData({ matchTier: 'none', results: [] }, false));
        } else {
            renderData(JSON.parse(storedResults), false);
        }
    }

    function renderData(parsed, isAppend = false) {
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
                miniBio: p.miniBio,
                slug: p.slug,
                matchReasons: p.matchReasons || [], // Puxa os motivos da IA
                tags: p.matchDetails || p.temas_atuacao || [],
                score: p.matchScore || 90,
                isFavorited: p.isFavorited || false,
                aiError: p.aiError || null,
                animationDelay: index * 0.15
            }));
        }

        if (dataToRender.length === 0 && !isAppend) {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #666;">Nenhum profissional encontrado com os critérios selecionados. <br><a href="/questionario.html" style="color: var(--verde-escuro); font-weight: bold;">Refazer busca</a></div>';
        } else if (dataToRender.length > 0) {
            const htmlToInject = dataToRender.map(createCard).join('');
            if (isAppend) {
                grid.insertAdjacentHTML('beforeend', htmlToInject);
            } else {
                grid.innerHTML = htmlToInject;
            }
            
            // XSS MITIGATION (Vulnerabilidade #9): Preencher TODOS os dados controlados por usuário via DOM API segura.
            dataToRender.forEach(profile => {
                // Preenchimento textual seguro (escapa HTML nativamente)
                const nomeEl = document.getElementById(`nome-${profile.id}`);
                if (nomeEl) nomeEl.textContent = profile.nome || 'Não informado';

                const crpEl = document.getElementById(`crp-${profile.id}`);
                if (crpEl) crpEl.textContent = `CRP ${profile.crp || 'Não informado'}`;

                // Injeção de atributos segura via setAttribute e validação de base
                const imgEl = document.getElementById(`img-${profile.id}`);
                if (imgEl && profile.nome) imgEl.setAttribute('alt', profile.nome);

                const cardEl = document.getElementById(`card-${profile.id}`);
                if (cardEl && profile.slug) cardEl.setAttribute('data-slug', profile.slug);

                const linkEl = document.getElementById(`link-${profile.id}`);
                if (linkEl && profile.slug) {
                    // O slug já é higienizado pelo backend (só letras e números), mas a API setAttribute protege adicionalmente o href.
                    linkEl.setAttribute('href', `/${profile.slug}?ref=match`);
                }

                // Campos dinâmicos do LLM e Bio
                const reasonEl = document.getElementById(`reason-text-${profile.id}`);
                if (reasonEl) {
                    let matchReasons = profile.matchReasons || [];
                    if (typeof matchReasons === 'string') matchReasons = [matchReasons];
                    let tags = profile.tags || [];
                    if (typeof tags === 'string') tags = tags.split(',').map(t => t.trim());
                    
                    const displayReasons = (matchReasons.length > 0) ? matchReasons.slice(0, 1) : tags.slice(0, 1);
                    if (displayReasons && displayReasons.length > 0) {
                        const r = displayReasons[0];
                        reasonEl.textContent = r.charAt(0).toUpperCase() + r.slice(1);
                    }
                }

                const bioEl = document.getElementById(`bio-text-${profile.id}`);
                if (bioEl) {
                    bioEl.textContent = `"${profile.miniBio || profile.bio || ''}"`;
                }
            });
        }
        
        // Ativar botão de Load More baseado na flag hasMore E no limite de cliques
        if (parsed.hasMore === true && clickCount < MAX_CLICKS) {
            loadMoreContainer.style.display = 'block';
        } else {
            loadMoreContainer.style.display = 'none';
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

    // --- LÓGICA DO BOTÃO CARREGAR MAIS ---
    if (btnLoadMore) {
        btnLoadMore.addEventListener('click', () => {
            if (clickCount >= MAX_CLICKS) return;
            
            const lastAnswersStr = sessionStorage.getItem('yelo_lastAnswers');
            if (!lastAnswersStr) {
                showToast("Suas respostas expiraram. Por favor, refaça o questionário.", "error");
                return;
            }
            
            const userAnswers = JSON.parse(lastAnswersStr);
            userAnswers.excludeIds = currentDisplayedIds;
            
            // UI Feedback
            btnLoadMore.disabled = true;
            btnLoadMore.style.opacity = '0.7';
            if (loadMoreSpinner) loadMoreSpinner.style.display = 'inline-block';
            
            fetch(`${BASE_URL}/api/psychologists/match`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userAnswers),
            })
            .then(res => res.ok ? res.json() : { matchTier: 'none', results: [], hasMore: false })
            .then(matchData => {
                // UI Feedback Reset
                btnLoadMore.disabled = false;
                btnLoadMore.style.opacity = '1';
                if (loadMoreSpinner) loadMoreSpinner.style.display = 'none';
                
                if (matchData.results && matchData.results.length > 0) {
                    const newIds = matchData.results.map(r => r.id);
                    currentDisplayedIds = currentDisplayedIds.concat(newIds);
                    sessionStorage.setItem('yelo_excludeIds', JSON.stringify(currentDisplayedIds));
                    
                    clickCount++; // Incrementa o contador de cliques
                    renderData(matchData, true); // true = isAppend
                } else {
                    // Sem mais resultados
                    loadMoreContainer.style.display = 'none';
                    showToast("Você já viu todos os profissionais compatíveis!", "info");
                }
            })
            .catch(() => {
                btnLoadMore.disabled = false;
                btnLoadMore.style.opacity = '1';
                if (loadMoreSpinner) loadMoreSpinner.style.display = 'none';
                showToast("Erro ao buscar mais profissionais.", "error");
            });
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

    // --- LÓGICA DO MODAL EXIT-INTENT (FEEDBACK) ---
    const feedbackModal = document.getElementById('exit-feedback-modal');
    if (feedbackModal) {
        let hasShownFeedback = sessionStorage.getItem('yelo_feedback_shown') === 'true';
        let ratingValue = 0;

        const showFeedbackModal = () => {
            if (hasShownFeedback) return;
            hasShownFeedback = true;
            sessionStorage.setItem('yelo_feedback_shown', 'true');
            feedbackModal.style.display = 'flex';
            // Pega o frame seguinte para garantir que a transição do CSS ocorra
            requestAnimationFrame(() => feedbackModal.classList.add('active'));
        };

        const closeFeedbackModal = () => {
            feedbackModal.classList.remove('active');
            setTimeout(() => { feedbackModal.style.display = 'none'; }, 300);
        };

        // 1. Rastreamento Desktop (Mouse saiu para cima)
        document.addEventListener('mouseleave', (e) => {
            if (e.clientY < 5) showFeedbackModal();
        });

        // 2. Rastreamento Mobile (Fallback por tempo após 15 segundos)
        setTimeout(() => {
            showFeedbackModal();
        }, 15000);

        // UI Eventos
        const closeBtn = document.getElementById('close-feedback-btn');
        if(closeBtn) closeBtn.addEventListener('click', closeFeedbackModal);
        
        const stars = document.querySelectorAll('input[name="ux-rating"]');
        stars.forEach(star => {
            star.addEventListener('change', (e) => {
                ratingValue = e.target.value;
            });
        });

        const submitBtn = document.getElementById('submit-feedback-btn');
        if(submitBtn) {
            submitBtn.addEventListener('click', async () => {
                if (ratingValue == 0) {
                    showToast('Por favor, selecione uma nota de 1 a 5 estrelas.', 'error');
                    return;
                }
                const feedbackText = document.getElementById('ux-feedback-text').value;
                submitBtn.textContent = 'Enviando...';
                submitBtn.disabled = true;

                try {
                    await fetch(`${BASE_URL}/api/demand/searches`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            searchId: sessionStorage.getItem('currentSearchId') || null,
                            avaliacao_ux: { rating: ratingValue, feedback: feedbackText }
                        })
                    });
                    closeFeedbackModal();
                    showToast('Muito obrigado pelo seu feedback!', 'success');
                } catch (err) {
                    closeFeedbackModal();
                }
            });
        }
    }
});
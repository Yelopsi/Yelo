// Arquivo: public/js/perfil_psicologo.js

const initProfilePage = async () => {

    // --- 1. CONFIGURAÇÃO INICIAL ---
    const BASE_URL = (typeof window.API_BASE_URL !== 'undefined') 
        ? window.API_BASE_URL 
        : 'http://localhost:3001';

    // FIX: Esconde a navegação inferior mobile em páginas públicas
    const mobileNavs = document.querySelectorAll('.mobile-bottom-nav, .bottom-nav');
    mobileNavs.forEach(nav => nav.style.display = 'none');

    // Importa os renderizadores e helpers extraídos para o módulo de UI
    const { showToast, showModernModal, renderHeroRating, renderTagsSection, renderSocialLinks, renderReviewsList } = window.PerfilUI;

    // --- 5. LÓGICA DO BOTÃO DE WHATSAPP ---
    /// a URL já é renderizada no servidor, mas o JS adiciona o rastreamento de clique.
            const setupZapButton = (profile) => {
                const setupButton = (btnId) => {
                const btnZap = document.getElementById(btnId);
                if (!btnZap) return;

                if (profile.telefone) {
                    const cleanPhone = profile.telefone.replace(/\D/g, '');
                    btnZap.href = `https://api.whatsapp.com/send?phone=55${cleanPhone}&text=Olá, ${profile.nome.split(' ')[0]}! Vi seu perfil na Yelo e gostaria de verificar horários disponíveis para agendamento.`;
                    btnZap.target = '_blank';
                    btnZap.classList.remove('disabled');

                    // --- NOVO: RASTREAMENTO DE CLIQUE ---
                    // Remove event listeners antigos para evitar duplicação
                    const newBtnZap = btnZap.cloneNode(true);
                    btnZap.parentNode.replaceChild(newBtnZap, btnZap);
                    
                    newBtnZap.addEventListener('click', async () => {
                        try {
                            // [NOVO] Rastreamento GA4 - Clique no WhatsApp
                            if (typeof gtag === 'function') {
                                gtag('event', 'click_whatsapp', {
                                    'id_psi': profile.id
                                });
                            }

                            let patientId = null;
                            const token = localStorage.getItem('Yelo_token');
                            if (token && token !== 'cookie_auth_active') {
                                try {
                                    const payload = JSON.parse(atob(token.split('.')[1]));
                                    if (payload.type === 'patient') patientId = payload.id;
                                } catch(e) {}
                            }

                            // Recupera dados do visitante se houver
                            const guestPhone = localStorage.getItem('yelo_guest_phone');
                            const guestName = localStorage.getItem('yelo_guest_name') || 'Visitante';

                            // Não esperamos o fetch terminar para não atrasar o usuário
                            fetch(`${BASE_URL}/api/psychologists/${profile.slug}/whatsapp-click`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ patientId, guestPhone, guestName })
                            }).catch(() => {});
                            
                            // --- Tracking específico para o Modal PLG de Conversão ---
                            fetch(`${BASE_URL}/api/public/whatsapp-click-log`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ psychologistId: profile.id, guestName })
                            }).catch(() => {});
                            
                        } catch (err) {
                        }
                    }, { once: true });
                } else {
                    btnZap.classList.add('disabled');
                    btnZap.href = "#";
                }
                };
                setupButton('btn-agendar-whatsapp');
                setupButton('btn-agendar-whatsapp-mobile');
            };

    // --- 6. LÓGICA DE AVALIAÇÃO ---
    const setupReviewForm = (psychologistId) => {
        const form = document.getElementById('form-nova-avaliacao');
        if (!form) return;

        // --- LÓGICA DE RASCUNHO (RESTORE) ---
        const draftKey = `review_draft_${psychologistId}`;
        const savedDraft = localStorage.getItem(draftKey);

        if (savedDraft) {
            try {
                const { rating, comment } = JSON.parse(savedDraft);
                
                if (comment) {
                    const commentInput = form.querySelector('textarea[name="comentario"]');
                    if (commentInput) commentInput.value = comment;
                }

                if (rating) {
                    const ratingInput = form.querySelector(`input[name="rating"][value="${rating}"]`);
                    if (ratingInput) ratingInput.checked = true;
                }

                setTimeout(() => {
                    const reviewsSection = document.getElementById('tab-avaliacoes');
                    if(reviewsSection) {
                        reviewsSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        form.style.transition = "box-shadow 0.5s";
                        form.style.boxShadow = "0 0 0 4px rgba(27, 67, 50, 0.1)";
                        setTimeout(() => form.style.boxShadow = "none", 2000);
                    }
                }, 800);
            } catch (e) { }
        }

        form.onsubmit = async (e) => {
            e.preventDefault();

            const ratingInput = form.querySelector('input[name="rating"]:checked');
            const commentInput = form.querySelector('textarea[name="comentario"]');
            
            const rating = ratingInput ? ratingInput.value : null;
            const comment = commentInput ? commentInput.value.trim() : '';

            if (!rating) {
                showToast("Por favor, selecione uma nota (estrelas).", "error");
                return;
            }

            const btn = form.querySelector('button[type="submit"]');
            const originalText = btn ? btn.textContent : 'Enviar';

            const enviarAvaliacao = async (authToken) => {
                if (btn) { btn.disabled = true; btn.textContent = "Enviando..."; }

                try {
                    const response = await fetch(`${BASE_URL}/api/reviews`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authToken}`
                        },
                        body: JSON.stringify({ psychologistId, rating: parseInt(rating), comment })
                    });

                    const data = await response.json();

                    if (response.ok) {
                        showToast("Avaliação enviada com sucesso!", "success");
                        localStorage.removeItem(draftKey); // Limpa rascunho
                        
                        // 1. Injeta a avaliação no topo da lista visualmente sem recarregar a página
                        const listContainer = document.getElementById('reviews-list-container');
                        if (listContainer) {
                            const emptyState = listContainer.querySelector('p');
                            if (emptyState && emptyState.textContent.includes('não possui avaliações')) emptyState.remove();
                            
                            const userName = localStorage.getItem('Yelo_user_name') || 'Você';
                            const initial = userName.charAt(0).toUpperCase();
                            const newReviewHtml = `
                                <div class="review-card" style="border-left: 4px solid var(--cor-Yelo); animation: fadeIn 0.5s ease; margin-bottom: 20px;">
                                    <div class="review-header">
                                        <div class="review-avatar">
                                            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#E8F5E9"/><text x="50" y="55" font-family="Arial" font-size="40" fill="#1B4332" text-anchor="middle" dominant-baseline="middle">${initial}</text></svg>
                                        </div>
                                        <div class="review-author-info">
                                        <strong class="review-author-name">${userName} <span style="display:inline-flex; align-items:center; margin-left:4px;" title="Autenticado pelo Google"><svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="12" height="12"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.7 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path></svg></span></strong>
                                            <span class="review-date">Agora mesmo</span>
                                        </div>
                                    </div>
                                    <div class="review-rating">${'★'.repeat(parseInt(rating))}${'<span style="color:#ddd">★</span>'.repeat(5 - parseInt(rating))}</div>
                                    <p class="review-comment">${comment}</p>
                                </div>
                            `;
                            listContainer.insertAdjacentHTML('afterbegin', newReviewHtml);
                        }

                        // 2. Substitui o formulário por um Call to Action de sucesso
                        const formBox = form.closest('.review-form-box');
                        if (formBox) {
                            formBox.innerHTML = `
                                <div style="text-align: center; padding: 20px 10px; animation: fadeIn 0.5s ease;">
                                    <div style="font-size: 3rem; margin-bottom: 10px;">🎉</div>
                                    <h3 style="color: var(--verde-escuro); margin-bottom: 10px; font-family: var(--font-titulos);">Avaliação Publicada!</h3>
                                    <p style="color: #666; margin-bottom: 25px; line-height: 1.5; font-size: 0.95rem;">Obrigado por sua contribuição! Sua avaliação foi validada com sucesso pelo Google.</p>
                                </div>
                            `;
                        } else {
                            setTimeout(() => window.location.reload(), 2000);
                        }
                    } else {
                        // TRATAMENTO DE SESSÃO EXPIRADA (401)
                        if (response.status === 401) {
                            // Salva rascunho se a sessão caiu no meio do processo
                            if (rating || comment) {
                                localStorage.setItem(draftKey, JSON.stringify({ rating, comment }));
                            }
                            localStorage.removeItem('Yelo_token'); // Limpa token inválido
                            showToast("Sessão expirada. Faça login novamente.", "error");
                            const currentUrl = encodeURIComponent(window.location.href);
                            setTimeout(() => window.location.href = `/login?redirect=${currentUrl}`, 2000);
                        } else if (response.status === 409) {
                            showToast("Você já avaliou este profissional. Não é possível enviar avaliações duplicadas.", "error");
                        } else {
                            showToast(data.error || "Erro ao salvar avaliação.", "error");
                        }
                    }
                } catch (error) {
                    showToast("Erro de conexão.", "error");
                } finally {
                    if (btn) { btn.disabled = false; btn.textContent = originalText; }
                }
            };

            // 1. Verifica Login
            let token = localStorage.getItem('Yelo_token');
            if (token === 'cookie_auth_active') {
                localStorage.removeItem('Yelo_token');
                token = null;
            }
            if (!token) {
                if (rating || comment) {
                    localStorage.setItem(draftKey, JSON.stringify({ rating, comment }));
                }
                
                showModernModal(
                    '🔒',
                    'Identificação Necessária',
                    'Para garantir autenticidade e evitar perfis falsos, confirme sua identidade com o Google com um único clique.',
                    null, // Botão primário substituído pelo iframe do Google
                    null,
                    'Cancelar',
                    '<div id="google-btn-container" style="display:flex; justify-content:center; margin-bottom: 20px; min-height: 44px;"></div>'
                );
        
                const script = document.createElement('script');
                script.src = 'https://accounts.google.com/gsi/client';
                script.async = true;
                script.defer = true;
                script.onload = () => {
                    google.accounts.id.initialize({
                        client_id: '283886540808-qj13i35cfagnp9rc6qou1o66mdv3ppkl.apps.googleusercontent.com',
                        callback: async (response) => {
                            try {
                                const containerBtn = document.getElementById('google-btn-container');
                                if (containerBtn) containerBtn.innerHTML = '<span style="color:#1B4332; font-weight:bold;">Validando e enviando...</span>';
                                
                                const authRes = await fetch(`${BASE_URL}/api/patients/google`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ token: response.credential, isReviewValidation: true })
                                });
                                
                                if (authRes.ok) {
                                    const authData = await authRes.json();
                                    localStorage.setItem('Yelo_token', authData.token);
                                    localStorage.setItem('Yelo_user_type', 'patient');
                                    localStorage.setItem('Yelo_user_name', authData.nome);
                                    
                                    const modernOverlay = document.getElementById('modern-modal-overlay') || document.querySelector('div[style*="z-index:999999"]') || document.querySelector('div[style*="z-index: 999999"]');
                                    if (modernOverlay) modernOverlay.remove();
                                    
                                    enviarAvaliacao(authData.token);
                                } else {
                                    showToast("Falha na autenticação com o Google.", "error");
                                    if (containerBtn) {
                                        containerBtn.innerHTML = '';
                                        google.accounts.id.renderButton(containerBtn, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with' });
                                    }
                                }
                            } catch (error) {
                                showToast("Erro ao conectar com o Google.", "error");
                            }
                        }
                    });
                    const container = document.getElementById('google-btn-container');
                    if (container) {
                        google.accounts.id.renderButton(container, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with' });
                    }
                };
                document.head.appendChild(script);
                return;
            }

            // Já está logado
            enviarAvaliacao(token);
        };
    };

    // --- 7. LÓGICA DE FAVORITOS (REAL) ---
    const setupFavoriteButton = async (psychologistId) => {
        const btn = document.getElementById('btn-favorite');
        if (!btn) return;

        // Remove clones de event listeners antigos
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        const activeBtn = document.getElementById('btn-favorite');

        let token = localStorage.getItem('Yelo_token');
        if (token === 'cookie_auth_active') {
            localStorage.removeItem('Yelo_token');
            token = null;
        }
        const userType = localStorage.getItem('Yelo_user_type');

        // 1. Verifica status inicial (se logado)
        if (token && userType === 'patient') {
            try {
                const res = await fetch(`${BASE_URL}/api/patients/favorites/check/${psychologistId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.isFavorited) activeBtn.classList.add('active');
                }
            } catch (e) { }
        }

        // 2. Click Handler
        activeBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            if (!token || userType !== 'patient') {
                const currentUrl = window.location.href;
                const separator = currentUrl.includes('?') ? '&' : '?';
                const redirectUrl = encodeURIComponent(`${currentUrl}${separator}autoFavorite=true`);

                showModernModal(
                    '❤️',
                    'Salvar Favorito',
                    'Conecte sua conta em 1 clique para salvar seus profissionais favoritos de forma segura e acessá-los depois.',
                    null,
                    null,
                    'Agora não',
                    '<div id="google-btn-fav-container" style="display:flex; justify-content:center; margin-bottom: 20px; min-height: 44px;"></div>'
                );
                
                const script = document.createElement('script');
                script.src = 'https://accounts.google.com/gsi/client';
                script.async = true;
                script.defer = true;
                script.onload = () => {
                    google.accounts.id.initialize({
                        client_id: '283886540808-qj13i35cfagnp9rc6qou1o66mdv3ppkl.apps.googleusercontent.com',
                        callback: async (response) => {
                            try {
                                const authRes = await fetch(`${BASE_URL}/api/patients/google`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ token: response.credential })
                                });
                                
                                if (authRes.ok) {
                                    const authData = await authRes.json();
                                    localStorage.setItem('Yelo_token', authData.token);
                                    localStorage.setItem('Yelo_user_type', 'patient');
                                    localStorage.setItem('Yelo_user_name', authData.nome);
                                    
                                    const modernOverlay = document.getElementById('modern-modal-overlay') || document.querySelector('div[style*="z-index:999999"]') || document.querySelector('div[style*="z-index: 999999"]');
                                    if (modernOverlay) modernOverlay.remove();
                                    
                                    // Favorita na mesma hora
                                    await fetch(`${BASE_URL}/api/patients/favorites`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authData.token}` },
                                        body: JSON.stringify({ psychologistId })
                                    });
                                    activeBtn.classList.add('active');
                                    showToast("Adicionado aos favoritos!", "success");
                                }
                            } catch (error) { }
                        }
                    });
                    const container = document.getElementById('google-btn-fav-container');
                    if (container) {
                        google.accounts.id.renderButton(container, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with' });
                    }
                };
                document.head.appendChild(script);
                return;
            }

            const isActive = activeBtn.classList.contains('active');
            const method = isActive ? 'DELETE' : 'POST';
            const url = isActive 
                ? `${BASE_URL}/api/patients/favorites/${psychologistId}`
                : `${BASE_URL}/api/patients/favorites`;
            
            const body = isActive ? null : JSON.stringify({ psychologistId });

            try {
                const res = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body
                });

                if (res.ok) {
                    activeBtn.classList.toggle('active');
                    showToast(isActive ? "Removido dos favoritos." : "Adicionado aos favoritos!", "success");
                } else {
                    showToast("Erro ao atualizar favoritos.", "error");
                }
            } catch (err) {
                showToast("Erro de conexão.", "error");
            }
        });
    };

    // --- 8. INICIALIZAÇÃO OTIMIZADA (PÓS-SSR) ---
    const init = async () => {
        // Os dados do perfil agora são injetados pelo EJS em `window.YELO_PROFILE_DATA`
        const profileData = window.YELO_PROFILE_DATA;

        if (!profileData) {
            return;
        }

        // Rastreamento GA4: Visualização do Perfil
        try {
            if (typeof gtag === 'function') {
                gtag('event', 'view_perfil_psi', {
                    'id_psi': profileData.id
                });
            }
        } catch(e) { }

        // Rastreamento Yelo: Visualização do Perfil (Com Fonte)
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const source = urlParams.get('ref') === 'match' ? 'profile_click_funnel' : 'direct_view';
            fetch(`${BASE_URL}/api/psychologists/${profileData.id}/appearance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: source })
            }).catch(() => {});
        } catch(e) {}

        /// a página já foi renderizada no servidor.
        // Apenas inicializamos os componentes dinâmicos que o JS controla.
        try {
            // A. Lógica de Auto-Favoritar (se aplicável, vindo de um redirect)
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('autoFavorite') === 'true') {
                let token = localStorage.getItem('Yelo_token');
                if (token === 'cookie_auth_active') {
                    localStorage.removeItem('Yelo_token');
                    token = null;
                }
                const userType = localStorage.getItem('Yelo_user_type');
                if (token && userType === 'patient') {
                    const url = new URL(window.location.href);
                    url.searchParams.delete('autoFavorite');
                    window.history.replaceState({}, document.title, url.toString());
                    try {
                        await fetch(`${BASE_URL}/api/patients/favorites`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({ psychologistId: profileData.id })
                        });
                        showToast("Adicionado aos favoritos!", "success");
                        const btn = document.getElementById('btn-favorite');
                        if (btn) btn.classList.add('active');
                    } catch (e) { }
                }
            }

            // B. Inicializa os componentes interativos que dependem de JS
            // O HTML principal já foi renderizado no servidor.
            if(typeof renderTagsSection === 'function') renderTagsSection(profileData);
            if(typeof renderSocialLinks === 'function') renderSocialLinks(profileData);
            if(typeof renderHeroRating === 'function') renderHeroRating(profileData.reviews);
            if(typeof renderReviewsList === 'function') renderReviewsList(profileData.reviews);
            if(typeof setupReviewForm === 'function') setupReviewForm(profileData.id);
            if(typeof setupFavoriteButton === 'function') setupFavoriteButton(profileData.id);
            if(typeof setupZapButton === 'function') setupZapButton(profileData);

            // C. Lógica de Horários Disponíveis (se houver)
            try {
                let nextSlot = null;

                // 1. Tenta verificar se a API já trouxe essa info embutida no perfil
                if (profileData.proximoAtendimento) {
                    nextSlot = new Date(profileData.proximoAtendimento);
                } else {
                    // 2. Faz uma requisição auxiliar buscando a agenda pública do psi
                    const resAgenda = await fetch(`${BASE_URL}/api/psychologists/${profileData.slug}/availability`);
                    if (resAgenda.ok) {
                        const slots = await resAgenda.json();
                        const now = new Date();
                        const futureSlots = slots
                            .filter(s => new Date(s.start) > now && s.status === 'available')
                            .sort((a, b) => new Date(a.start) - new Date(b.start));
                            
                        if (futureSlots.length > 0) {
                            nextSlot = new Date(futureSlots[0].start);
                        }
                    }
                }

                if (nextSlot && nextSlot > new Date()) {
                    const now = new Date();
                    const tomorrow = new Date(now);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    
                    let dateStr = nextSlot.toDateString() === now.toDateString() ? 'Hoje' 
                                : nextSlot.toDateString() === tomorrow.toDateString() ? 'Amanhã' 
                                : nextSlot.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                    
                    const timeStr = nextSlot.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
                    document.querySelectorAll('.texto-proximo-horario').forEach(el => el.textContent = `${dateStr}, às ${timeStr}`);
                    document.querySelectorAll('.badge-proximo-horario').forEach(el => {
                        el.classList.add('has-slot');
                        el.style.setProperty('display', 'flex', 'important'); // Força a exibição
                    });
                }
            } catch (e) { }

        } catch (dynamicInitError) {
        }
    };

    // --- INICIALIZAÇÃO GERAL ---
    init();

    // Configura as abas
    document.querySelectorAll('.tab-link').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-link').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            e.target.classList.add('active');
            const tabId = e.target.dataset.tab;
            document.getElementById(`tab-${tabId}`).classList.add('active');
        });
    });
};

document.addEventListener('DOMContentLoaded', initProfilePage);
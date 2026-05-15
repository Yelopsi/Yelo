document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = window.API_BASE_URL || window.location.origin;
    const profileContainer = document.getElementById('profile-page-container');
    const loaderContainer = document.getElementById('loader-container');

    // Garante que a bottom nav padrão do app não apareça no perfil público
    document.querySelectorAll('.mobile-bottom-nav, .bottom-nav').forEach(nav => nav.style.setProperty('display', 'none', 'important'));

    let psi = window.YELO_PROFILE_DATA;

    if (!psi) {
        showError('Perfil não encontrado.');
        return;
    }

    // BUSCA DADOS FRESCOS VIA API PARA GARANTIR COLUNAS NOVAS E ESPELHAR CORRETAMENTE
    if (psi.slug) {
        // Busca diretamente da rota correta definida no backend (psychologistController.js)
        fetch(`${API_BASE_URL}/api/psychologists/slug/${psi.slug}`)
            .then(res => {
                if (!res.ok) {
                    return null;
                }
                return res.json();
            })
            .then(freshData => {
                if (freshData) Object.assign(psi, freshData);
                populatePage(psi);
                if (loaderContainer) loaderContainer.style.display = 'none';
                if (profileContainer) profileContainer.style.display = 'block';
            })
            .catch(error => {
                console.error(error);
                showError('Erro ao processar as informações do perfil.');
            });
    } else {
        populatePage(psi);
        if (loaderContainer) loaderContainer.style.display = 'none';
        if (profileContainer) profileContainer.style.display = 'block';
    }

    function showError(message) {
        if (loaderContainer) {
            loaderContainer.innerHTML = `<div style="text-align:center; color:red; padding: 40px;"><p>${message}</p></div>`;
        }
    }

    function populatePage(psi) {
        // Título da Página
        document.title = `${psi.nome} | Psicólogo(a) na Yelo`;

        // Bloco Principal
        const photoEl = document.getElementById('psi-photo');
        if (photoEl) {
            photoEl.src = psi.fotoUrl || 'https://placehold.co/180x180/e8f5e9/1B4332?text=Psi';
            photoEl.alt = `Foto de ${psi.nome}`;
        }

        const nameEl = document.getElementById('psi-name');
        if (nameEl && psi.nome) {
            const verifiedSvg = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.918-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.337 2.25c-.416-.165-.866-.25-1.336-.25-2.21 0-3.918 1.79-3.918 4 0 .495.084.965.238 1.4-1.273.65-2.148 2.02-2.148 3.6 0 1.46.758 2.746 1.9 3.42-.047.19-.074.385-.074.58 0 2.21 1.71 4.002 3.918 4.002.47 0 .92-.086 1.336-.25.52 1.335 1.828 2.25 3.337 2.25s2.816-.915 3.337-2.25c.416.164.866.25 1.336.25 2.21 0 3.918-1.792 3.918-4 0-.195-.027-.39-.074-.58 1.14-.675 1.9-1.96 1.9-3.42z" fill="#1B4332"/><path d="M16.97 8.47a1.5 1.5 0 0 1 0 2.12l-6.5 6.5a1.5 1.5 0 0 1-2.12 0l-3.5-3.5a1.5 1.5 0 1 1 2.12-2.12l2.44 2.44 5.44-5.44a1.5 1.5 0 0 1 2.12 0z" fill="white"/></svg>`;
            const nameParts = psi.nome.trim().split(' ');
            if (nameParts.length > 1) {
                nameEl.innerHTML = `<span class="first-name-wrapper" style="position: relative; display: inline-block;">${nameParts[0]}<span title="Psicólogo Verificado" class="hero-verified-badge mobile-only-badge">${verifiedSvg}</span></span><span class="name-break-mobile">${nameParts.slice(1).join(' ')}</span><span title="Psicólogo Verificado" class="hero-verified-badge desktop-only-badge">${verifiedSvg}</span>`;
            } else {
                nameEl.innerHTML = `<span class="first-name-wrapper" style="position: relative; display: inline-block;">${psi.nome}<span title="Psicólogo Verificado" class="hero-verified-badge mobile-only-badge">${verifiedSvg}</span></span><span title="Psicólogo Verificado" class="hero-verified-badge desktop-only-badge">${verifiedSvg}</span>`;
            }
        }

        // Subtítulo dinâmico com base nas abordagens técnicas
        const subtitleEl = document.getElementById('psi-hero-subtitle');
        if (subtitleEl) {
            let approach = 'Psicoterapia e Acolhimento';
            if (psi.abordagens_tecnicas) {
                let ab = psi.abordagens_tecnicas;
                if (typeof ab === 'string') {
                    try { ab = JSON.parse(ab); } catch(e) {}
                }
                if (Array.isArray(ab) && ab.length > 0) {
                    approach = ab[0];
                } else if (typeof ab === 'string' && ab.trim().length > 0) {
                    approach = ab;
                }
            }
            subtitleEl.textContent = `Psicólogo Clínico | ${approach}`;
        }

        const crpEl = document.getElementById('psi-crp');
        if (crpEl) crpEl.textContent = `CRP: ${psi.crp || 'Não informado'}`; // Mantido para compatibilidade, injetado no authority block

        // Cálculo de Anos de Experiência
        const expContainer = document.getElementById('auth-experiencia');
        const expText = document.getElementById('psi-experiencia-text');
        const mqExpContainer = document.getElementById('mq-experiencia');
        const mqExpText = document.getElementById('mq-experiencia-text');
        
        if (psi.ano_inicio_experiencia) {
            const currentYear = new Date().getFullYear();
            const anosExp = currentYear - parseInt(psi.ano_inicio_experiencia);
            if (anosExp >= 0) {
                const isZero = anosExp === 0;
                const textoFull = isZero ? 'Menos de 1 ano de experiência' : `Profissional com ${anosExp} ano${anosExp > 1 ? 's' : ''} de experiência`;
                const textoCurto = isZero ? 'Menos de 1 ano' : `${anosExp} ano${anosExp > 1 ? 's' : ''}`;
                
                if (expContainer && expText) {
                    expText.textContent = textoFull;
                    expContainer.style.display = 'flex';
                }
                if (mqExpContainer && mqExpText) {
                    mqExpText.textContent = textoCurto;
                    mqExpContainer.style.display = 'flex';
                }
            }
        }

        const bioEl = document.getElementById('psi-bio-text');
        if (bioEl) {
            bioEl.innerHTML = psi.bio ? psi.bio.replace(/\n/g, '<br>') : 'Biografia não informada.';
            
            // Lógica de colapsar texto longo (UX moderna)
            if (psi.bio && psi.bio.length > 350) {
                bioEl.style.display = '-webkit-box';
                bioEl.style.webkitLineClamp = '5';
                bioEl.style.webkitBoxOrient = 'vertical';
                bioEl.style.overflow = 'hidden';
                
                const readMoreBtn = document.createElement('button');
                readMoreBtn.style.cssText = "background: transparent; border: none; color: var(--verde-escuro); font-weight: 700; padding: 0; margin-top: 10px; cursor: pointer; font-size: 0.95rem; text-decoration: underline; display: block; transition: color 0.2s ease;";
                readMoreBtn.textContent = 'Ler mais sobre mim';
                
                // Efeito Hover sutil (sem alterar fundo)
                readMoreBtn.onmouseover = () => { readMoreBtn.style.color = '#143d2e'; };
                readMoreBtn.onmouseout = () => { readMoreBtn.style.color = 'var(--verde-escuro)'; };

                let isCollapsed = true;
                readMoreBtn.onclick = () => {
                    isCollapsed = !isCollapsed;
                    if (isCollapsed) {
                        bioEl.style.display = '-webkit-box';
                        readMoreBtn.textContent = 'Ler mais sobre mim';
                    } else {
                        bioEl.style.display = 'block';
                        readMoreBtn.textContent = 'Mostrar menos';
                    }
                };
                
                bioEl.parentNode.appendChild(readMoreBtn);
            }
        }

        // Localização
        const locationEl = document.getElementById('psi-location');
        const locationElMobile = document.getElementById('psi-location-mobile');
        const locationText = `${psi.cidade || 'Localidade não informada'}, ${psi.estado || 'UF'}`;
        if (locationEl) locationEl.textContent = locationText;
        if (locationElMobile) locationElMobile.textContent = locationText;

        // Preço (Investimento)
        const priceContainer = document.getElementById('price-display-container');
        const priceContainerMobile = document.getElementById('price-display-mobile');
        
        if (psi.tipo_cobranca === 'mensal') {
            if (psi.valor_mensal_numero && parseFloat(psi.valor_mensal_numero) > 0) {
                if (priceContainer) {
                    priceContainer.innerHTML = `
                        <div class="price-display" style="font-family: var(--font-titulos); font-size: 2.8rem; font-weight: 700; color: var(--verde-escuro); margin: 10px 0 0 0; line-height: 1;">R$ ${parseFloat(psi.valor_mensal_numero).toFixed(2).replace('.', ',')}</div>
                        <div class="price-suffix" style="font-size: 0.9rem; color: #999; font-weight: 500;">por mês</div>
                    `;
                }
                if (priceContainerMobile) {
                    priceContainerMobile.innerHTML = `<span class="label">Mensal</span><span class="value">R$ ${parseFloat(psi.valor_mensal_numero).toFixed(2).replace('.', ',')}</span>`;
                }
            } else {
                if (priceContainer) {
                    priceContainer.innerHTML = `
                        <div class="price-display" style="font-family: var(--font-titulos); font-size: 2.2rem; font-weight: 700; color: var(--verde-escuro); margin: 10px 0 0 0; line-height: 1;">A combinar</div>
                        <div class="price-suffix" style="font-size: 0.9rem; color: #999; font-weight: 500;">por mês</div>
                    `;
                }
                if (priceContainerMobile) {
                    priceContainerMobile.innerHTML = `<span class="label">Mensal</span><span class="value" style="font-size: 1.5rem;">A combinar</span>`;
                }
            }
        } else {
            if (psi.valor_sessao_numero && parseFloat(psi.valor_sessao_numero) > 0) {
                if (priceContainer) {
                    priceContainer.innerHTML = `
                        <div class="price-display" style="font-family: var(--font-titulos); font-size: 2.8rem; font-weight: 700; color: var(--verde-escuro); margin: 10px 0 0 0; line-height: 1;">R$ ${parseFloat(psi.valor_sessao_numero).toFixed(2).replace('.', ',')}</div>
                        <div class="price-suffix" style="font-size: 0.9rem; color: #999; font-weight: 500;">por sessão</div>
                    `;
                }
                if (priceContainerMobile) {
                    priceContainerMobile.innerHTML = `<span class="label">Por Sessão</span><span class="value">R$ ${parseFloat(psi.valor_sessao_numero).toFixed(2).replace('.', ',')}</span>`;
                }
            } else {
                if (priceContainer) {
                    priceContainer.innerHTML = `
                        <div class="price-display" style="font-family: var(--font-titulos); font-size: 2.2rem; font-weight: 700; color: var(--verde-escuro); margin: 10px 0 0 0; line-height: 1;">A combinar</div>
                        <div class="price-suffix" style="font-size: 0.9rem; color: #999; font-weight: 500;">por sessão</div>
                    `;
                }
                if (priceContainerMobile) {
                    priceContainerMobile.innerHTML = `<span class="label">Por Sessão</span><span class="value" style="font-size: 1.5rem;">A combinar</span>`;
                }
            }
        }

        // Modalidade de Atendimento
        const modalidadeEl = document.getElementById('psi-modalidade');
        const modalidadeElMobile = document.getElementById('psi-modalidade-mobile');
        if (modalidadeEl || modalidadeElMobile) {
            let modalidadeStr = 'Não informado';
            if (Array.isArray(psi.modalidade) && psi.modalidade.length > 0) {
                modalidadeStr = psi.modalidade.join(' // ');
            } else if (typeof psi.modalidade === 'string' && psi.modalidade.trim() !== '') {
                try {
                    const parsed = JSON.parse(psi.modalidade);
                    modalidadeStr = (Array.isArray(parsed) && parsed.length > 0) ? parsed.join(' // ') : psi.modalidade;
                } catch(e) {
                    modalidadeStr = psi.modalidade;
                }
            }
            
            if (modalidadeStr === '[]' || modalidadeStr === '') modalidadeStr = 'Não informado';

            if (modalidadeEl) modalidadeEl.textContent = modalidadeStr;
            if (modalidadeElMobile) modalidadeElMobile.textContent = modalidadeStr;
        }

        // Formação Acadêmica
        const formacaoNivel = document.getElementById('psi-formacao-nivel');
        const formacaoDesc = document.getElementById('psi-formacao-desc');
        const formacaoSection = document.getElementById('formacao-section');

        if (psi.formacao_nivel || psi.formacao_desc) {
            if(formacaoNivel) formacaoNivel.textContent = psi.formacao_nivel || 'Formação Superior';
            if(formacaoDesc) formacaoDesc.textContent = psi.formacao_desc || 'Sem detalhes adicionais informados.';
            if(formacaoSection) formacaoSection.style.display = 'block';
        } else {
            if(formacaoSection) formacaoSection.style.display = 'none';
        }

        // Botão do WhatsApp (Rastreamento)
        const setupZapButton = (btnId) => {
            const btnAgendar = document.getElementById(btnId);
            if (btnAgendar) {
                let mensagem = `Olá, ${psi.nome}! Encontrei seu perfil na Yelo e gostaria de agendar uma consulta.`;
                if (psi.tipo_cobranca === 'mensal') {
                    mensagem = `Olá, ${psi.nome}! Encontrei seu perfil na Yelo e gostaria de saber mais sobre o seu plano de acompanhamento mensal.`;
                }
                const whatsappLink = `https://api.whatsapp.com/send?phone=55${(psi.telefone || '').replace(/\D/g, '')}&text=${encodeURIComponent(mensagem)}`;
                btnAgendar.href = whatsappLink;
                btnAgendar.onclick = (e) => {
                    e.preventDefault(); // Evita a "Race Condition" bloqueando a saída imediata
                    
                    // 1. Dispara tracking interno (Fire and Forget)
                    fetch(`${API_BASE_URL}/api/psychologists/${psi.slug}/whatsapp-click`, { method: 'POST' }).catch(console.error);
                    
                    const goToWhatsApp = () => window.open(whatsappLink, '_blank');
                    
                    // 2. Dispara a Conversão do Google Ads com fallback seguro
                    let redirectDone = false;
                    if (typeof gtag === 'function') {
                        gtag('event', 'conversion', {
                            'send_to': 'AW-11236864912/Y_n_COzEiaUcEJDnk-4p',
                            'event_callback': function() {
                                if (!redirectDone) {
                                    redirectDone = true;
                                    goToWhatsApp();
                                }
                            }
                        });
                        
                        // Fallback: Se o script do Ads falhar/demorar, libera o clique após 600ms
                        setTimeout(() => { if (!redirectDone) { redirectDone = true; goToWhatsApp(); } }, 600);
                    } else {
                        // Se houver AdBlocker impedindo o gtag, redireciona normalmente
                        goToWhatsApp();
                    }
                };
            }
        };
        setupZapButton('btn-agendar-whatsapp');
        setupZapButton('btn-agendar-whatsapp-mobile');

        // Tags de Especialidades e Atuação
        populateTags('psi-temas-container', psi.temas_atuacao);
        populateTags('psi-publico-container', psi.publico_alvo);
        populateTags('psi-abordagem-container', psi.abordagens_tecnicas);
        populateTags('psi-praticas-container', psi.praticas_inclusivas);

        // Avaliações
        populateReviews(psi.reviews || []);

        // Redes Sociais
        populateSocialLinks(psi);

        // Configura o formulário de avaliação
        setupReviewForm(psi.id);
    }

    function populateTags(containerId, tagsArray) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = '';
        let parsedTags = tagsArray;
        
        if (typeof tagsArray === 'string') {
            try { parsedTags = JSON.parse(tagsArray); } catch(e) { parsedTags = []; }
        }

        if (Array.isArray(parsedTags) && parsedTags.length > 0) {
            parsedTags.forEach(tag => {
                if (!tag) return;
                const tagElement = document.createElement('span');
                tagElement.style.cssText = 'background-color: #f0fdf4; color: #166534; padding: 5px 14px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; border: 1px solid #bbf7d0; display: inline-block;';
                tagElement.textContent = tag;
                container.appendChild(tagElement);
            });
        } else {
            container.innerHTML = '<span style="color: #aaa; font-size: 0.85rem; font-style: italic;">Não informado</span>';
        }
    }

    function populateReviews(reviews) {
        const reviewCountSpan = document.getElementById('review-count');
        const reviewsListContainer = document.getElementById('reviews-list-container');
        const ratingSummary = document.getElementById('psi-rating-summary');
        
        if (reviewCountSpan) reviewCountSpan.textContent = reviews.length;

        if (reviews.length === 0) {
            if (reviewsListContainer) reviewsListContainer.innerHTML = '<p style="color: #666; font-style: italic; text-align: center;">Este profissional ainda não possui avaliações.</p>';
            if (ratingSummary) ratingSummary.innerHTML = '<span style="color: #666; font-size: 0.9rem; font-weight: 600;">Novo(a) na Yelo</span>';
            return;
        }

        const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
        const avgRating = (totalRating / reviews.length).toFixed(1);
        let starsHtml = '';
        for (let i = 1; i <= 5; i++) {
            starsHtml += `<span style="color: ${i <= Math.round(avgRating) ? '#f59e0b' : '#e5e7eb'}; font-size: 1.2rem;">★</span>`;
        }
        
        if (ratingSummary) {
            ratingSummary.innerHTML = `${starsHtml} <span style="color: #666; font-size: 0.9rem; font-weight: 600; margin-left: 5px;">${avgRating} de 5</span>`;
        }

        // Função para converter o nome completo em iniciais (ex: "Anderson Costa" -> "A. C.")
        const getInitials = (fullName) => {
            if (!fullName || fullName === 'Anônimo') return 'Anônimo';
            return fullName.trim().split(/\s+/).map(n => n[0].toUpperCase() + '.').join(' ');
        };

        let visibleCount = 5; // Quantidade inicial de avaliações a exibir

        const renderList = () => {
            if (!reviewsListContainer) return;
            
            reviewsListContainer.innerHTML = '';
            const reviewsToShow = reviews.slice(0, visibleCount);
            
            reviewsToShow.forEach(review => {
                const reviewCard = document.createElement('div');
                reviewCard.style.cssText = 'background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 16px; padding: 20px; margin-bottom: 15px;';
                let reviewStars = '';
                for (let i = 1; i <= 5; i++) {
                    reviewStars += `<span style="color: ${i <= review.rating ? '#f59e0b' : '#e5e7eb'};">★</span>`;
                }
                
                const authorInitials = getInitials(review.patientName);

                reviewCard.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <h4 style="margin: 0; font-family: var(--font-principal); color: #333; font-size: 1rem;">${authorInitials}</h4>
                        <div>${reviewStars}</div>
                    </div>
                    <p style="margin: 0; color: #555; font-style: italic; font-size: 0.95rem; line-height: 1.5;">"${review.comment}"</p>
                `;
                reviewsListContainer.appendChild(reviewCard);
            });

            // Se houver mais avaliações do que a quantidade visível, mostra o botão
            if (reviews.length > visibleCount) {
                const btnMore = document.createElement('button');
                btnMore.textContent = `Ver mais avaliações (${reviews.length - visibleCount})`;
                btnMore.style.cssText = 'display: block; margin: 20px auto 0; background: transparent; border: 2px solid var(--verde-escuro); color: var(--verde-escuro); padding: 10px 24px; border-radius: 50px; font-weight: bold; cursor: pointer; transition: all 0.2s;';
                btnMore.onmouseover = () => { btnMore.style.background = 'rgba(27, 67, 50, 0.05)'; };
                btnMore.onmouseout = () => { btnMore.style.background = 'transparent'; };
                btnMore.onclick = () => { visibleCount += 5; renderList(); };
                reviewsListContainer.appendChild(btnMore);
            }
        };

        renderList();
    }

    function showToast(message, type = 'success') {
        let container = document.getElementById('pill-notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'pill-notification-container';
            document.body.appendChild(container);
        }
        const pill = document.createElement('div');
        pill.className = `pill-notification ${type}`;
        let iconHtml = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
        pill.innerHTML = `<span class="icon">${iconHtml}</span><span>${message}</span>`;
        container.appendChild(pill);
        setTimeout(() => pill.remove(), 4500);
    }

    function showModernModal(icon, title, message, primaryText, primaryUrl, secondaryText, customHtml = '') {
        const overlay = document.createElement('div');
        overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:999999; display:flex; align-items:center; justify-content:center; backdrop-filter: blur(3px); opacity: 0; transition: opacity 0.3s ease;";
        
        const box = document.createElement('div');
        box.style.cssText = "background:#fff; padding:40px 30px; border-radius:24px; width:90%; max-width:420px; text-align:center; box-shadow:0 20px 50px rgba(0,0,0,0.15); transform: translateY(20px); transition: transform 0.3s ease;";
        
        box.innerHTML = `
            <div style="font-size:3.5rem; margin-bottom:15px; line-height:1;">${icon}</div>
            <h3 style="color:var(--verde-escuro, #1B4332); margin:0 0 15px 0; font-family: var(--font-titulos, serif); font-size:1.6rem;">${title}</h3>
            <p style="color:#555; font-size:1rem; line-height:1.6; margin-bottom:30px;">${message}</p>
            ${customHtml}
            <div style="display:flex; flex-direction:column; gap:12px;">
                ${primaryText ? `<button id="modal-primary-btn" style="background:var(--verde-escuro, #1B4332); color:#fff; border:none; padding:14px; border-radius:50px; font-weight:bold; font-size:1rem; cursor:pointer; transition:transform 0.2s, box-shadow 0.2s; box-shadow: 0 4px 15px rgba(27,67,50,0.2);">${primaryText}</button>` : ''}
                <button id="modal-secondary-btn" style="background:transparent; color:#666; border:none; padding:10px; font-weight:600; cursor:pointer; text-decoration:underline;">${secondaryText}</button>
            </div>
        `;
        
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            box.style.transform = 'translateY(0)';
        });
        
        const closeModal = () => {
            overlay.style.opacity = '0';
            box.style.transform = 'translateY(20px)';
            setTimeout(() => overlay.remove(), 300);
        };
        document.getElementById('modal-secondary-btn').onclick = closeModal;
        overlay.onclick = (e) => { if(e.target === overlay) closeModal(); };
    }

    function setupReviewForm(psychologistId) {
        const form = document.getElementById('form-nova-avaliacao');
        if (!form) return;

        const draftKey = `review_draft_${psychologistId}`;
        const savedDraft = localStorage.getItem(draftKey);

        if (savedDraft) {
            try {
                const { rating, comment } = JSON.parse(savedDraft);
                if (comment) form.querySelector('textarea[name="comentario"]').value = comment;
                if (rating) form.querySelector(`input[name="rating"][value="${rating}"]`).checked = true;
            } catch (e) { console.error(e); }
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
                    const response = await fetch(`${API_BASE_URL}/api/reviews`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                        body: JSON.stringify({ psychologistId, rating: parseInt(rating), comment })
                    });
                    if (response.ok) {
                        showToast("Avaliação enviada com sucesso!", "success");
                        localStorage.removeItem(draftKey);
                        setTimeout(() => window.location.reload(), 1500);
                    } else {
                        showToast("Erro ao enviar avaliação.", "error");
                    }
                } catch (error) {
                    showToast("Erro de conexão.", "error");
                } finally {
                    if (btn) { btn.disabled = false; btn.textContent = originalText; }
                }
            };

            let token = localStorage.getItem('Yelo_token');
            if (token === 'cookie_auth_active') {
                localStorage.removeItem('Yelo_token');
                token = null;
            }

            if (!token) {
                localStorage.setItem(draftKey, JSON.stringify({ rating, comment }));
                
                showModernModal('🔒', 'Identificação Necessária', 'Para garantir autenticidade e evitar perfis falsos, confirme sua identidade com o Google.', null, null, 'Cancelar', '<div id="google-btn-container" style="display:flex; justify-content:center; margin-bottom: 20px; min-height: 44px;"></div>');
        
                const script = document.createElement('script');
                script.src = 'https://accounts.google.com/gsi/client';
                script.async = true;
                script.defer = true;
                script.onload = () => {
                    console.log('[DEBUG GOOGLE LOGIN] Script do Google carregado.');
                    try {
                        google.accounts.id.initialize({
                            client_id: '283886540808-qj13i35cfagnp9rc6qou1o66mdv3ppkl.apps.googleusercontent.com',
                            callback: async (response) => {
                                console.log('[DEBUG GOOGLE LOGIN] Callback do Google disparado!', response);
                                try {
                                    console.log('[DEBUG GOOGLE LOGIN] Enviando token para o backend na rota:', `${API_BASE_URL}/api/patients/google`);
                                    const authRes = await fetch(`${API_BASE_URL}/api/patients/google`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: response.credential, isReviewValidation: true }) });
                                    
                                    console.log('[DEBUG GOOGLE LOGIN] Resposta do backend:', authRes.status);
                                    if (authRes.ok) {
                                        const authData = await authRes.json();
                                        console.log('[DEBUG GOOGLE LOGIN] Sucesso no backend:', authData);
                                        localStorage.setItem('Yelo_token', authData.token);
                                        document.querySelector('div[style*="z-index:999999"]').remove();
                                        enviarAvaliacao(authData.token);
                                    } else { 
                                        const errorText = await authRes.text();
                                        console.error('[DEBUG GOOGLE LOGIN] Erro retornado pelo backend:', errorText);
                                        showToast("Falha na autenticação.", "error"); 
                                    }
                                } catch (error) { 
                                    console.error('[DEBUG GOOGLE LOGIN] Erro no fetch para o backend:', error);
                                    showToast("Erro ao conectar com o Google.", "error"); 
                                }
                            }
                        });
                        console.log('[DEBUG GOOGLE LOGIN] Renderizando botão...');
                        google.accounts.id.renderButton(document.getElementById('google-btn-container'), { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with' });
                    } catch (e) {
                        console.error('[DEBUG GOOGLE LOGIN] Erro fatal ao inicializar GSI:', e);
                    }
                };
                document.head.appendChild(script);
                return;
            }
            enviarAvaliacao(token);
        };
    }

    function populateSocialLinks(psi) {
        const container = document.getElementById('psi-social-links');
        const section = document.getElementById('redes-sociais-section');
        if (!container) return;
        
        container.innerHTML = '';

        const socialMap = {
            instagram_url: { base: 'https://instagram.com/', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>' },
            linkedin_url: { base: 'https://linkedin.com/in/', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>' },
            facebook_url: { base: 'https://facebook.com/', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>' },
            tiktok_url: { base: 'https://tiktok.com/@', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"></path></svg>' },
            x_url: { base: 'https://twitter.com/', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4l11.733 16h4.267l-11.733 -16z"></path><path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772"></path></svg>' }
        };

        let hasLinks = false;
        for (const key in socialMap) {
            if (psi[key]) {
                hasLinks = true;
                const link = document.createElement('a');
                let userHandle = psi[key].replace('@', '');
                link.href = socialMap[key].base + userHandle;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.title = `Ver perfil social`;
                link.style.cssText = 'width: 44px; height: 44px; border-radius: 50%; border: 1px solid #e0e0e0; display: flex; align-items: center; justify-content: center; color: #555; text-decoration: none; transition: all 0.2s; background: #f8f9fa;';
                link.innerHTML = socialMap[key].icon;
                
                link.onmouseover = function() { this.style.backgroundColor = 'var(--verde-escuro)'; this.style.color = '#fff'; this.style.borderColor = 'var(--verde-escuro)'; this.style.transform = 'translateY(-3px)'; };
                link.onmouseout = function() { this.style.backgroundColor = '#f8f9fa'; this.style.color = '#555'; this.style.borderColor = '#e0e0e0'; this.style.transform = 'translateY(0)'; };

                container.appendChild(link);
            }
        }

        if (!hasLinks && section) {
            section.style.display = 'none';
        } else if (section) {
            section.style.display = 'block';
        }
    }
});

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
        fetch(`${API_BASE_URL}/api/psychologists/slug/${psi.slug}?t=${new Date().getTime()}`, { cache: 'no-store', headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' } })
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

        // Rastreamento GA4: Visualização do Perfil
        try {
            if (typeof gtag === 'function') {
                gtag('event', 'view_perfil_psi', {
                    'id_psi': psi.id
                });
            }
        } catch(e) { }

        // Rastreamento Yelo: Visualização do Perfil (Com Fonte)
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const source = urlParams.get('ref') === 'match' ? 'profile_click_funnel' : 'direct_view';
            fetch(`${API_BASE_URL}/api/psychologists/${psi.id}/appearance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: source })
            }).catch(() => {});
        } catch(e) {}

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
                nameEl.innerHTML = `<span class="first-name-wrapper" style="display: inline-flex; align-items: center; gap: 4px; position: relative;">${nameParts[0]}<span title="Psicólogo Verificado" class="hero-verified-badge mobile-only-badge" style="display: inline-flex;">${verifiedSvg}</span></span><span class="name-break-mobile">${nameParts.slice(1).join(' ')}</span><span title="Psicólogo Verificado" class="hero-verified-badge desktop-only-badge" style="display: inline-flex; margin-left: 4px;">${verifiedSvg}</span>`;
            } else {
                nameEl.innerHTML = `<span class="first-name-wrapper" style="display: inline-flex; align-items: center; gap: 4px; position: relative;">${psi.nome}<span title="Psicólogo Verificado" class="hero-verified-badge mobile-only-badge" style="display: inline-flex;">${verifiedSvg}</span></span><span title="Psicólogo Verificado" class="hero-verified-badge desktop-only-badge" style="display: inline-flex; margin-left: 4px;">${verifiedSvg}</span>`;
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

            let profTitle = "Psicólogo(a) Clínico(a)";
            let genVal = psi.genero_identidade;
            if (typeof genVal === 'string' && genVal.startsWith('[')) {
                try { genVal = JSON.parse(genVal)[0]; } catch(e) {}
            } else if (Array.isArray(genVal)) {
                genVal = genVal[0];
            }
            
            if (genVal === 'Feminino') {
                profTitle = "Psicóloga Clínica";
            } else if (genVal === 'Masculino') {
                profTitle = "Psicólogo Clínico";
            } else if (genVal === 'Não-binário' || genVal === 'Outro') {
                profTitle = "Psicólogue Clínique";
            }

            subtitleEl.textContent = `${profTitle} | ${approach}`;
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
                        <div class="price-display" style="font-family: var(--font-titulos); font-size: 2.0rem; font-weight: 700; color: var(--verde-escuro); margin: 5px 0 0 0; line-height: 1;">R$ ${parseFloat(psi.valor_mensal_numero).toFixed(2).replace('.', ',')}</div>
                        <div class="price-suffix" style="font-size: 0.9rem; color: #999; font-weight: 500;">por mês</div>
                    `;
                }
                if (priceContainerMobile) {
                    priceContainerMobile.innerHTML = `<span class="label">Mensal</span><span class="value">R$ ${parseFloat(psi.valor_mensal_numero).toFixed(2).replace('.', ',')}</span>`;
                }
            } else {
                if (priceContainer) {
                    priceContainer.innerHTML = `
                        <div class="price-display" style="font-family: var(--font-titulos); font-size: 2.0rem; font-weight: 700; color: var(--verde-escuro); margin: 5px 0 0 0; line-height: 1;">A combinar</div>
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
                        <div class="price-display" style="font-family: var(--font-titulos); font-size: 2.0rem; font-weight: 700; color: var(--verde-escuro); margin: 5px 0 0 0; line-height: 1;">R$ ${parseFloat(psi.valor_sessao_numero).toFixed(2).replace('.', ',')}</div>
                        <div class="price-suffix" style="font-size: 0.9rem; color: #999; font-weight: 500;">por sessão</div>
                    `;
                }
                if (priceContainerMobile) {
                    priceContainerMobile.innerHTML = `<span class="label">Por Sessão</span><span class="value">R$ ${parseFloat(psi.valor_sessao_numero).toFixed(2).replace('.', ',')}</span>`;
                }
            } else {
                if (priceContainer) {
                    priceContainer.innerHTML = `
                        <div class="price-display" style="font-family: var(--font-titulos); font-size: 2.0rem; font-weight: 700; color: var(--verde-escuro); margin: 5px 0 0 0; line-height: 1;">A combinar</div>
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
                let mensagem = `Olá, ${psi.nome}! Encontrei seu perfil na Yelo e gostaria de tirar algumas dúvidas sobre como funciona o seu atendimento.`;
                if (psi.tipo_cobranca === 'mensal') {
                    mensagem = `Olá, ${psi.nome}! Encontrei seu perfil na Yelo e gostaria de tirar algumas dúvidas sobre como funciona o seu atendimento.`;
                }
                const whatsappLink = `https://api.whatsapp.com/send?phone=55${(psi.telefone || '').replace(/\D/g, '')}&text=${encodeURIComponent(mensagem)}`;
                btnAgendar.href = whatsappLink;
                btnAgendar.onclick = (e) => {
                    e.preventDefault(); // Evita a "Race Condition" bloqueando a saída imediata
                    if (btnAgendar.dataset.clicked) return;
                    btnAgendar.dataset.clicked = "true";
                    setTimeout(() => delete btnAgendar.dataset.clicked, 2000); // Debounce de 2s
                    
                    // Dispara evento para o Google Analytics (GA4)
                    try {
                        if (typeof gtag === 'function') {
                            gtag('event', 'whatsapp_click', {
                                'id_psi': psi.id,
                                'nome_psi': psi.nome,
                                'btn_id': btnId
                            });
                        }
                    } catch(e) {}

                    // 1. Dispara tracking interno (Fire and Forget)
                    fetch(`${API_BASE_URL}/api/psychologists/${psi.slug}/whatsapp-click`, { method: 'POST' }).catch(() => {});
                    
                    // --- Tracking específico para o Modal PLG de Conversão ---
                    const guestName = localStorage.getItem('yelo_guest_name') || 'um paciente';
                    fetch(`${API_BASE_URL}/api/psychologists/public/whatsapp-click-log`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ psychologistId: psi.id, guestName })
                    }).catch(() => {});
                    // ---------------------------------------------------------------

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
        
        let avaliacoes = psi.reviews || [];
        populateReviews(avaliacoes, psi);

        // Redes Sociais
        populateSocialLinks(psi);

        // Configura o formulário de avaliação
        setupReviewForm(psi.id);
        
        // Configura modal de avaliação
        setupReviewModal();

        // Próximo Horário Disponível (A partir de 2h)
        try {
            fetch(`${API_BASE_URL}/api/public/psychologists/${psi.slug}/availability`)
                .then(res => res.ok ? res.json() : [])
                .then(slots => {
                    if (!Array.isArray(slots)) return;
                    const nowPlus2h = new Date(Date.now() + 2 * 60 * 60 * 1000);
                    const futureSlots = slots
                        .filter(s => new Date(s.start) > nowPlus2h && s.status === 'available')
                        .sort((a, b) => new Date(a.start) - new Date(b.start));
                        
                    if (futureSlots.length > 0) {
                        const nextSlot = new Date(futureSlots[0].start);
                        const now = new Date();
                        const tomorrow = new Date(now);
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        
                        let dateStr = nextSlot.toDateString() === now.toDateString() ? 'Hoje' 
                                    : nextSlot.toDateString() === tomorrow.toDateString() ? 'Amanhã' 
                                    : nextSlot.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                        
                        const timeStr = nextSlot.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
                        
                        const badge = document.getElementById('proximo-horario-badge');
                        const texto = document.getElementById('proximo-horario-texto');
                        if (badge && texto) {
                            texto.textContent = `${dateStr}, às ${timeStr}`;
                            badge.style.display = 'flex';
                        }
                        
                        const badgeMobile = document.getElementById('proximo-horario-badge-mobile');
                        const textoMobile = document.getElementById('proximo-horario-texto-mobile');
                        if (badgeMobile && textoMobile) {
                            textoMobile.textContent = `${dateStr}, às ${timeStr}`;
                            badgeMobile.style.display = 'flex';
                            
                            // Lógica de fechamento (Click/Tap no X)
                            const closeBtn = document.getElementById('close-badge-mobile');
                            if (closeBtn) {
                                closeBtn.onclick = (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    badgeMobile.style.opacity = '0';
                                    setTimeout(() => badgeMobile.style.display = 'none', 300);
                                };
                            }
                            
                            // Lógica de Swipe
                            let startX = 0;
                            let currentX = 0;
                            let isDragging = false;
                            
                            badgeMobile.addEventListener('touchstart', (e) => {
                                startX = e.touches[0].clientX;
                                currentX = startX;
                                isDragging = true;
                                badgeMobile.style.transition = 'none';
                                badgeMobile.style.animation = 'none';
                            }, {passive: true});
                            
                            badgeMobile.addEventListener('touchmove', (e) => {
                                if (!isDragging) return;
                                currentX = e.touches[0].clientX;
                                const diff = currentX - startX;
                                badgeMobile.style.transform = `translateX(${diff}px)`;
                            }, {passive: true});
                            
                            badgeMobile.addEventListener('touchend', (e) => {
                                if (!isDragging) return;
                                isDragging = false;
                                const diff = currentX - startX;
                                badgeMobile.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
                                
                                if (Math.abs(diff) > 50) {
                                    badgeMobile.style.transform = `translateX(${diff > 0 ? 150 : -150}%)`;
                                    badgeMobile.style.opacity = '0';
                                    setTimeout(() => badgeMobile.style.display = 'none', 300);
                                } else {
                                    badgeMobile.style.transform = '';
                                    setTimeout(() => { badgeMobile.style.animation = ''; }, 300);
                                }
                            });
                        }
                    }
                }).catch(() => {});
        } catch (e) {}
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
            const finalTags = new Set();
            parsedTags.forEach(tag => {
                if (!tag) return;
                let displayTag = tag.trim();
                
                if (containerId === 'psi-praticas-container') {
                    if (displayTag === "Que faça parte da comunidade LGBTQIAPN+" || displayTag === "Comunidade LGBTQIAPN+") displayTag = "Faz parte da comunidade LGBTQIAPN+ / Afirmativa";
                    else if (displayTag === "LGBTQIAPN+ friendly" || displayTag === "LGBTQIAPN+ Friendly") displayTag = "LGBTQIAPN+ Friendly 🏳️‍🌈";
                    else if (displayTag.includes("não-branca") || displayTag.includes("Antirracista")) displayTag = "Pessoa não-branca // Prática Antirracista";
                    else if (displayTag.includes("Feminista")) displayTag = "Perspectiva Feminista";
                    else if (displayTag.includes("Neurodiversidade") || displayTag.includes("TDAH") || displayTag.includes("Autismo")) displayTag = "Neurodiversidade (TDAH, Autismo)";
                }
                if (displayTag !== "Indiferente" && displayTag !== "Nenhuma específica") {
                    finalTags.add(displayTag);
                }
            });
            if (finalTags.size > 0) {
                finalTags.forEach(tag => {
                    const tagElement = document.createElement('span');
                    tagElement.style.cssText = 'background-color: #f0fdf4; color: #166534; padding: 5px 14px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; border: 1px solid #bbf7d0; display: inline-block; word-break: break-word; white-space: normal; box-sizing: border-box; max-width: 100%;';
                    tagElement.textContent = tag;
                    container.appendChild(tagElement);
                });
            } else {
                container.innerHTML = '<span style="color: #aaa; font-size: 0.85rem; font-style: italic;">Não informado</span>';
            }
        } else {
            container.innerHTML = '<span style="color: #aaa; font-size: 0.85rem; font-style: italic;">Não informado</span>';
        }
    }

    function populateReviews(reviews, psi) {
        const reviewsSection = document.getElementById('reviews-section');
        const reviewsListContainer = document.getElementById('reviews-list-container');
        const scrollIndicator = document.getElementById('reviews-scroll-indicator');
        const ratingSummary = document.getElementById('psi-rating-summary');
        
        const reviewCountSpan = document.getElementById('review-count');
        const reviewCountWrapper = document.getElementById('review-count-wrapper');
        
        if (reviewCountSpan) reviewCountSpan.textContent = reviews.length;

        if (reviews.length === 0) {
            if (reviewCountWrapper) reviewCountWrapper.style.display = 'none';
            if (reviewsListContainer) reviewsListContainer.innerHTML = '<p style="color: #666; font-style: italic; width: 100%;">Este profissional ingressou recentemente. Se você já conhece o trabalho, seja o primeiro a deixar um depoimento!</p>';
            
            let novoText = 'Novo(a) na Yelo';
            if (psi) {
                if (psi.genero_identidade === 'Feminino') {
                    novoText = 'Nova na Yelo';
                } else if (psi.genero_identidade === 'Masculino') {
                    novoText = 'Novo na Yelo';
                } else if (psi.genero_identidade === 'Não-binário' || psi.genero_identidade === 'Outro') {
                    novoText = 'Nove na Yelo';
                }
            }
            
            if (ratingSummary) ratingSummary.innerHTML = `<span style="color: #666; font-size: 0.9rem; font-weight: 600;">${novoText}</span>`;
            if (scrollIndicator) scrollIndicator.style.display = 'none';
            return;
        }

        if (reviewCountWrapper) reviewCountWrapper.style.display = 'inline';

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

        if (scrollIndicator) {
            // Mostra o indicador de scroll se tiver mais de 1 avaliação (para rolar o carrossel)
            scrollIndicator.style.display = reviews.length > 1 ? 'flex' : 'none';
        }

        const visibleCount = 5; // Limita a quantidade inicial no carrossel

        const renderList = () => {
            if (!reviewsListContainer) return;
            
            reviewsListContainer.innerHTML = '';
            const reviewsToShow = reviews.slice(0, visibleCount);
            
            reviewsToShow.forEach(review => {
                const reviewCard = document.createElement('div');
                reviewCard.style.cssText = 'background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 16px; padding: 20px; width: 85vw; max-width: 350px; flex-shrink: 0; scroll-snap-align: start; cursor: pointer; transition: background 0.2s; box-sizing: border-box;';
                reviewCard.onmouseover = () => { reviewCard.style.background = '#f0fdf4'; };
                reviewCard.onmouseout = () => { reviewCard.style.background = '#f8f9fa'; };
                reviewCard.onclick = () => { openAllReviewsView(reviews); };
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
                btnMore.textContent = `Ver todas as ${reviews.length} avaliações`;
                btnMore.style.cssText = 'display: flex; align-items: center; justify-content: center; min-width: 200px; flex-shrink: 0; scroll-snap-align: start; background: transparent; border: 2px solid var(--verde-escuro); color: var(--verde-escuro); padding: 10px 24px; border-radius: 16px; font-weight: bold; cursor: pointer; transition: all 0.2s;';
                btnMore.onmouseover = () => { btnMore.style.background = 'rgba(27, 67, 50, 0.05)'; };
                btnMore.onmouseout = () => { btnMore.style.background = 'transparent'; };
                btnMore.onclick = () => { openAllReviewsView(reviews); };
                reviewsListContainer.appendChild(btnMore);
            }
        };

        renderList();
    }

    function openAllReviewsView(reviews) {
        const view = document.getElementById('all-reviews-view');
        const listContainer = document.getElementById('all-reviews-list-container');
        const countSpan = document.getElementById('all-reviews-count');
        const closeBtn = document.getElementById('btn-close-all-reviews');

        if (!view || !listContainer) return;

        // Função para converter o nome completo em iniciais
        const getInitials = (fullName) => {
            if (!fullName || fullName === 'Anônimo') return 'Anônimo';
            return fullName.trim().split(/\s+/).map(n => n[0].toUpperCase() + '.').join(' ');
        };

        countSpan.textContent = reviews.length;
        listContainer.innerHTML = '';

        reviews.forEach(review => {
            const reviewCard = document.createElement('div');
            reviewCard.style.cssText = 'background: #fff; border: 1px solid #e9ecef; border-radius: 16px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.02); box-sizing: border-box; width: 100%;';
            let reviewStars = '';
            for (let i = 1; i <= 5; i++) {
                reviewStars += `<span style="color: ${i <= review.rating ? '#f59e0b' : '#e5e7eb'};">★</span>`;
            }
            
            const authorInitials = getInitials(review.patientName);
            const dateStr = review.createdAt ? new Date(review.createdAt).toLocaleDateString('pt-BR') : '';

            reviewCard.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                    <div>
                        <h4 style="margin: 0 0 5px 0; font-family: var(--font-principal); color: #333; font-size: 1.05rem;">${authorInitials}</h4>
                        <div style="font-size: 0.85rem; color: #888;">${dateStr}</div>
                    </div>
                    <div style="font-size: 1.1rem;">${reviewStars}</div>
                </div>
                <p style="margin: 10px 0 0 0; color: #444; font-size: 0.95rem; line-height: 1.6;">"${review.comment}"</p>
            `;
            listContainer.appendChild(reviewCard);
        });

        view.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Impede rolagem do fundo

        if (closeBtn) {
            closeBtn.onclick = () => {
                view.style.display = 'none';
                document.body.style.overflow = '';
            };
        }
    }

    function setupReviewModal() {
        const btnOpen = document.getElementById('btn-open-review-modal');
        const modal = document.getElementById('modal-review');
        const btnClose = document.getElementById('btn-close-review-modal');
        
        if (btnOpen && modal) {
            btnOpen.onclick = () => {
                modal.style.display = 'flex';
            };
        }

        // Se URL tiver ?review=true, abre o modal automaticamente (Link Mágico)
        try {
            const urlParams = new URLSearchParams(window.location.search);
            if (modal && urlParams.get('review') === 'true') {
                modal.style.display = 'flex';
                // Remove o parâmetro da URL para não reabrir em refresh
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        } catch(e) {}
        
        if (btnClose && modal) {
            btnClose.onclick = () => { modal.style.display = 'none'; };
        }
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
        overlay.id = 'modern-modal-overlay';
        overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:999999; display:flex; align-items:center; justify-content:center; backdrop-filter: blur(3px); opacity: 0; transition: opacity 0.3s ease;";
        
        const box = document.createElement('div');
        box.style.cssText = "background:#fff; padding:40px 30px; border-radius:24px; width:90%; max-width:420px; text-align:center; box-shadow:0 20px 50px rgba(0,0,0,0.15); transform: translateY(20px); transition: transform 0.3s ease; box-sizing: border-box;";
        
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
                // Preenche os dados, mas NÃO abre o modal automaticamente para não ser intrusivo
                if (comment) form.querySelector('textarea[name="comentario"]').value = comment;
                if (rating) form.querySelector(`input[name="rating"][value="${rating}"]`).checked = true;
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
                    const response = await fetch(`${API_BASE_URL}/api/reviews`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                        body: JSON.stringify({ psychologistId, rating: parseInt(rating), comment })
                    });
                    if (response.ok) {
                        showToast("Avaliação enviada com sucesso!", "success");
                        localStorage.removeItem(draftKey);
                        const modalReview = document.getElementById('modal-review');
                        if (modalReview) modalReview.style.display = 'none';
                        setTimeout(() => window.location.reload(), 1500);
                    } else {
                        if (response.status === 409) {
                            showToast("Você já avaliou este profissional. Não é possível enviar avaliações duplicadas.", "error");
                        } else if (response.status === 401) {
                            showToast("Sua sessão expirou. Por favor, autentique-se novamente.", "error");
                        } else {
                            const errData = await response.json().catch(() => ({}));
                            showToast(errData.error || "Erro ao enviar avaliação.", "error");
                        }
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
                    try {
                        google.accounts.id.initialize({
                            client_id: '283886540808-qj13i35cfagnp9rc6qou1o66mdv3ppkl.apps.googleusercontent.com',
                            callback: async (response) => {
                                try {
                                    const authRes = await fetch(`${API_BASE_URL}/api/patients/google`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: response.credential, isReviewValidation: true }) });
                                    
                                    if (authRes.ok) {
                                        const authData = await authRes.json();
                                        localStorage.setItem('Yelo_token', authData.token);
                                        
                                        const modernOverlay = document.getElementById('modern-modal-overlay') || document.querySelector('div[style*="z-index:999999"]') || document.querySelector('div[style*="z-index: 999999"]');
                                        if (modernOverlay) modernOverlay.remove();
                                        
                                        enviarAvaliacao(authData.token);
                                    } else { 
                                        const errorText = await authRes.text();
                                        showToast("Falha na autenticação.", "error"); 
                                    }
                                } catch (error) { 
                                    showToast("Erro ao conectar com o Google.", "error"); 
                                }
                            }
                        });
                        google.accounts.id.renderButton(document.getElementById('google-btn-container'), { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with' });
                    } catch (e) {
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

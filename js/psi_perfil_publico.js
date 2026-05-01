document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = window.API_BASE_URL || window.location.origin;
    const profileContainer = document.getElementById('profile-page-container');
    const loaderContainer = document.getElementById('loader-container');

    // O EJS já injetou os dados perfeitamente no HTML (SSR). Não precisamos mais de fetch!
    const psi = window.YELO_PROFILE_DATA;

    if (!psi) {
        showError('Perfil não encontrado.');
        return;
    }

    try {
        populatePage(psi);
        // Mostra o conteúdo instantaneamente e esconde o loader
        if (loaderContainer) loaderContainer.style.display = 'none';
        if (profileContainer) profileContainer.style.display = 'block';
    } catch (error) {
        console.error(error);
        showError('Erro ao processar as informações do perfil.');
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
        if (nameEl) nameEl.textContent = psi.nome;

        const crpEl = document.getElementById('psi-crp');
        if (crpEl) crpEl.textContent = `CRP: ${psi.crp || 'Não informado'}`;

        const bioEl = document.getElementById('psi-bio-text');
        if (bioEl) bioEl.innerHTML = psi.bio ? psi.bio.replace(/\n/g, '<br>') : 'Biografia não informada.';

        // Localização
        const locationEl = document.getElementById('psi-location');
        if (locationEl) locationEl.textContent = `${psi.cidade || 'Localidade não informada'}, ${psi.estado || 'UF'}`;

        // Preço (Investimento)
        const priceContainer = document.getElementById('price-display-container');
        if (priceContainer) {
            if (psi.tipo_cobranca === 'mensal' && psi.valor_mensal_numero) {
                priceContainer.innerHTML = `
                    <div class="price-display" style="font-family: var(--font-titulos); font-size: 2.8rem; font-weight: 700; color: var(--verde-escuro); margin: 10px 0 0 0; line-height: 1;">R$ ${parseFloat(psi.valor_mensal_numero).toFixed(2).replace('.', ',')}</div>
                    <div class="price-suffix" style="font-size: 0.9rem; color: #999; font-weight: 500;">por mês</div>
                `;
            } else {
                priceContainer.innerHTML = `
                    <div class="price-display" style="font-family: var(--font-titulos); font-size: 2.8rem; font-weight: 700; color: var(--verde-escuro); margin: 10px 0 0 0; line-height: 1;">R$ ${parseFloat(psi.valor_sessao_numero || 0).toFixed(2).replace('.', ',')}</div>
                    <div class="price-suffix" style="font-size: 0.9rem; color: #999; font-weight: 500;">por sessão</div>
                `;
            }
        }

        // Modalidade de Atendimento
        const modalidadeEl = document.getElementById('psi-modalidade');
        if (modalidadeEl) {
            let modalidadeStr = 'Não informado';
            if (Array.isArray(psi.modalidade) && psi.modalidade.length > 0) {
                modalidadeStr = psi.modalidade.join(' e ');
            } else if (typeof psi.modalidade === 'string') {
                try {
                    const parsed = JSON.parse(psi.modalidade);
                    modalidadeStr = Array.isArray(parsed) ? parsed.join(' e ') : psi.modalidade;
                } catch(e) {
                    modalidadeStr = psi.modalidade;
                }
            }
            modalidadeEl.textContent = modalidadeStr;
        }

        // Formação Acadêmica
        const formacaoNivel = document.getElementById('psi-formacao-nivel');
        const formacaoDesc = document.getElementById('psi-formacao-desc');
        const formacaoSection = document.getElementById('formacao-section');

        if (psi.formacao_nivel || psi.formacao_desc) {
            if(formacaoNivel) formacaoNivel.textContent = psi.formacao_nivel || 'Formação Superior';
            if(formacaoDesc) formacaoDesc.textContent = psi.formacao_desc || 'Sem detalhes adicionais informados.';
        } else {
            if(formacaoSection) formacaoSection.style.display = 'none';
        }

        // Botão do WhatsApp (Rastreamento)
        const btnAgendar = document.getElementById('btn-agendar-whatsapp');
        if (btnAgendar) {
            const whatsappLink = `https://api.whatsapp.com/send?phone=55${(psi.telefone || '').replace(/\D/g, '')}&text=Olá, ${psi.nome}! Encontrei seu perfil na Yelo e gostaria de agendar uma consulta.`;
            btnAgendar.href = whatsappLink;
            btnAgendar.onclick = () => {
                fetch(`${API_BASE_URL}/api/public/psychologists/${psi.slug}/whatsapp-click`, { method: 'POST' }).catch(console.error);
            };
        }

        // Tags de Especialidades e Atuação
        populateTags('psi-temas-container', psi.temas_atuacao);
        populateTags('psi-publico-container', psi.publico_alvo);
        populateTags('psi-abordagem-container', psi.abordagens_tecnicas);
        populateTags('psi-praticas-container', psi.praticas_inclusivas);

        // Avaliações
        populateReviews(psi.reviews || []);

        // Redes Sociais
        populateSocialLinks(psi);
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
            if (reviewsListContainer) reviewsListContainer.innerHTML = '<p style="color: #666; font-style: italic;">Ainda não há avaliações para este profissional.</p>';
            if (ratingSummary) ratingSummary.innerHTML = '<span style="color: #999; font-size: 0.9rem;">Sem avaliações</span>';
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

        if (reviewsListContainer) {
            reviewsListContainer.innerHTML = '';
            reviews.forEach(review => {
                const reviewCard = document.createElement('div');
                reviewCard.style.cssText = 'background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 16px; padding: 20px; margin-bottom: 15px;';
                let reviewStars = '';
                for (let i = 1; i <= 5; i++) {
                    reviewStars += `<span style="color: ${i <= review.rating ? '#f59e0b' : '#e5e7eb'};">★</span>`;
                }
                reviewCard.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <h4 style="margin: 0; font-family: var(--font-principal); color: #333; font-size: 1rem;">${review.patientName || 'Anônimo'}</h4>
                        <div>${reviewStars}</div>
                    </div>
                    <p style="margin: 0; color: #555; font-style: italic; font-size: 0.95rem; line-height: 1.5;">"${review.comment}"</p>
                `;
                reviewsListContainer.appendChild(reviewCard);
            });
        }
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
        }
    }
});

/**
 * Arquivo: perfil_psicologo_ui.js
 * Responsabilidade: Isolar a renderização de DOM, SVGs e componentes visuais do perfil público.
 */
window.PerfilUI = (function() {
    let visibleReviewCount = 5;

    // --- FUNÇÕES AUXILIARES DE UI ---
    const showToast = (message, type = 'success') => {
        let container = document.getElementById('pill-notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'pill-notification-container';
            document.body.appendChild(container);
        }

        const pill = document.createElement('div');
        pill.className = `pill-notification ${type}`;

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

        setTimeout(() => {
            pill.remove();
        }, 4500);
    };

    const showModernModal = (icon, title, message, primaryText, primaryUrl, secondaryText, customHtml = '') => {
        const overlay = document.createElement('div');
        overlay.id = 'modern-modal-overlay';
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
        
        const primaryBtn = document.getElementById('modal-primary-btn');
        if (primaryBtn) {
            primaryBtn.onclick = () => { 
                if (primaryUrl) window.location.href = primaryUrl; 
            };
        }
        const closeModal = () => {
            overlay.style.opacity = '0';
            box.style.transform = 'translateY(20px)';
            setTimeout(() => overlay.remove(), 300);
        };
        document.getElementById('modal-secondary-btn').onclick = closeModal;
        overlay.onclick = (e) => { if(e.target === overlay) closeModal(); };
    };

    // --- RENDERIZADORES DE COMPONENTES ---

    // A. Renderiza Estrelas (Média)
    const renderHeroRating = (reviews) => {
        const container = document.getElementById('hero-rating-display');
        if (!reviews || reviews.length === 0) {
            container.innerHTML = '<span class="hero-rating-text">Novo(a) na Yelo</span>';
            return;
        }

        const total = reviews.reduce((acc, r) => acc + r.rating, 0);
        const avg = total / reviews.length;
        const fullStars = Math.round(avg);
        
        let starsHtml = '';
        for(let i=0; i<5; i++) {
            starsHtml += i < fullStars ? '★' : '<span style="color:#ddd">★</span>';
        }

        container.innerHTML = `
            ${starsHtml} 
            <span class="hero-rating-text">(${reviews.length} avaliações)</span>
        `;
    };

    // B. Renderiza Tags (Especialidades, etc)
    const renderTagsSection = (profile) => {
        if (!document.getElementById('dynamic-tags-style')) {
            const style = document.createElement('style');
            style.id = 'dynamic-tags-style';
            style.innerHTML = `
                .tags-container {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 25px;
                    margin-top: 25px;
                    text-align: left;
                }
                @media (max-width: 992px) {
                    .tags-container { grid-template-columns: repeat(2, 1fr); }
                }
                @media (max-width: 600px) {
                    .tags-container { grid-template-columns: 1fr; gap: 15px; }
                }
                .tag-pill {
                    display: inline-block;
                    padding: 6px 14px;
                    border-radius: 20px;
                    font-size: 0.85rem;
                    font-weight: 500;
                    letter-spacing: 0.3px;
                }
                .tag-abordagem {
                    background-color: #E8F5E9; color: #1B4332; border: 1px solid #C8E6C9;
                }
                .tag-especialidade {
                    background-color: #FFF8E1; color: #B08D00; border: 1px solid #FFE082;
                }
                .tag-info {
                    background-color: #E1F5FE; color: #0277BD; border: 1px solid #B3E5FC;
                }
                .tag-group { margin-bottom: 16px; }
                .tag-group-title {
                    display: block; font-size: 0.75rem; color: #666; margin-bottom: 6px; font-weight: 700; text-transform: uppercase;
                }
            `;
            document.head.appendChild(style);
        }

        let tagsContainer = document.getElementById('psi-tags-container');
        
        if (!tagsContainer) {
            const tabSobre = document.getElementById('tab-sobre');
            if (tabSobre) {
                tabSobre.innerHTML = ''; 
                tagsContainer = document.createElement('div');
                tagsContainer.id = 'psi-tags-container';
                tagsContainer.className = 'tags-container';
                tabSobre.appendChild(tagsContainer);
            } else {
                const bioEl = document.getElementById('psi-bio-text');
                const anchor = bioEl || document.getElementById('psi-disponibilidade');
                if (anchor && anchor.parentNode) {
                    tagsContainer = document.createElement('div');
                    tagsContainer.id = 'psi-tags-container';
                    tagsContainer.className = 'tags-container';
                    tagsContainer.style.marginTop = '15px';
                    anchor.parentNode.insertBefore(tagsContainer, anchor.nextSibling);
                } else {
                    return;
                }
            }
        }

        tagsContainer.innerHTML = '';

        const ensureArray = (data) => {
            if (!data) return [];
            if (Array.isArray(data)) return data;
            if (typeof data === 'string') {
                if (data.trim().startsWith('[')) {
                    try { return JSON.parse(data); } catch(e) { return []; }
                }
                return data.split(',').map(s => s.trim());
            }
            return [];
        };

        const abordagens = ensureArray(profile.abordagens_tecnicas || profile.abordagens);
        const temas = ensureArray(profile.temas_atuacao || profile.temas);
        const publico = ensureArray(profile.publico_alvo);
        const estilo = ensureArray(profile.estilo_terapia);
        const inclusivas = ensureArray(profile.praticas_inclusivas || profile.praticas_vivencias || profile.praticas);

        const inclusivasFormatadas = [];
        inclusivas.forEach(tag => {
            let dTag = typeof tag === 'string' ? tag.trim() : tag;
            if (dTag === "Que faça parte da comunidade LGBTQIAPN+" || dTag === "Faz parte da comunidade LGBTQIAPN+ / Afirmativa") {
                dTag = "Faz parte da comunidade LGBTQIAPN+";
            }
            if (dTag !== "Indiferente" && dTag !== "Nenhuma específica") {
                inclusivasFormatadas.push(dTag);
            }
        });

        const createGroup = (title, items, cssClass) => {
            if (!items || items.length === 0) return;
            const groupDiv = document.createElement('div');
            groupDiv.className = 'tag-group';
            const titleEl = document.createElement('span');
            titleEl.className = 'tag-group-title';
            titleEl.textContent = title;
            groupDiv.appendChild(titleEl);
            const listDiv = document.createElement('div');
            listDiv.style.display = 'flex';
            listDiv.style.flexWrap = 'wrap';
            listDiv.style.gap = '8px';
            items.forEach(text => {
                const span = document.createElement('span');
                span.className = `tag-pill ${cssClass}`;
                span.textContent = text;
                listDiv.appendChild(span);
            });
            groupDiv.appendChild(listDiv);
            tagsContainer.appendChild(groupDiv);
        };

        createGroup('Abordagem', abordagens, 'tag-abordagem');
        createGroup('Temas de Atuação', temas, 'tag-especialidade');
        createGroup('Público-Alvo Principal', publico, 'tag-info');
        createGroup('Estilo de Terapia', estilo, 'tag-info');
        createGroup('Identificadores e Práticas Inclusivas', [...new Set(inclusivasFormatadas)], 'tag-especialidade');
        
        let genero = profile.genero || profile.genero_identidade;
        if (typeof genero === 'string' && genero.startsWith('[')) {
            try { genero = JSON.parse(genero)[0]; } catch(e) {}
        } else if (Array.isArray(genero)) {
            genero = genero[0];
        }
        if (genero && !['Prefiro não informar', 'Não informado'].includes(genero)) {
            createGroup('Gênero de Identidade', [genero], 'tag-info');
        }
        
        if (tagsContainer.children.length === 0) {
             tagsContainer.innerHTML = '<span style="color:#999; font-size:0.9em;">Detalhes não informados.</span>';
        }
    };

    // C. Renderização de Redes Sociais
    const renderSocialLinks = (profile) => {
        const container = document.querySelector('.social-links-profile');
        if (!container) return;
        
        container.innerHTML = '';

        const networks = [
            { key: 'instagram_url', base: 'https://instagram.com/', label: 'Instagram', icon: '<svg viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>' },
            { key: 'linkedin_url', base: 'https://linkedin.com/in/', label: 'LinkedIn', icon: '<svg viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>' },
            { key: 'facebook_url', base: 'https://facebook.com/', label: 'Facebook', icon: '<svg viewBox="0 0 24 24"><path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"/></svg>' },
            { key: 'tiktok_url', base: 'https://tiktok.com/@', label: 'TikTok', icon: '<svg viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.35-1.17.82-1.51 1.45-.39.69-.5 1.49-.41 2.27.08.76.43 1.48.97 2.01 1.05 1.05 2.74 1.34 4.09.81.93-.34 1.71-1.01 2.11-1.92.35-.8.44-1.7.43-2.58 0-2.16-.01-4.32-.01-6.48v-8.48z"/></svg>' },
            { key: 'x_url', base: 'https://x.com/', label: 'X // Twitter', icon: '<svg viewBox="0 0 24 24"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/></svg>' }
        ];

        let hasLinks = false;

        networks.forEach(net => {
            let userValue = profile[net.key];
            if (userValue && userValue.trim() !== '') {
                hasLinks = true;
                let finalUrl = userValue;
                if (!userValue.startsWith('http')) {
                    userValue = userValue.replace('@', '');
                    finalUrl = net.base + userValue;
                }
                
                const link = document.createElement('a');
                link.href = finalUrl;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.className = 'icon-social';
                link.setAttribute('aria-label', net.label);
                link.innerHTML = net.icon;
                
                container.appendChild(link);
            }
        });

        if (!hasLinks) {
            container.style.display = 'none';
        } else {
            container.style.display = 'flex';
        }
    };

    // D. Renderiza Lista de Avaliações
    const renderReviewsList = (reviews) => {
        const listContainer = document.getElementById('reviews-list-container');
        const reviewsSection = document.getElementById('tab-avaliacoes');
        if (!listContainer || !reviewsSection) return;

        const oldSummary = reviewsSection.querySelector('.reviews-summary');
        if (oldSummary) oldSummary.remove();
        const oldButton = reviewsSection.querySelector('.btn-show-more');
        if (oldButton) oldButton.remove();

        if (!reviews || reviews.length === 0) {
            listContainer.innerHTML = '<p style="text-align:center; color:#777; padding: 20px;">Este profissional ainda não possui avaliações.</p>';
            return;
        }

        const totalRating = reviews.reduce((acc, r) => acc + r.rating, 0);
        const avgRating = (totalRating / reviews.length).toFixed(1);
        const fullStars = Math.round(avgRating);
        let summaryStarsHtml = '';
        for(let i=0; i<5; i++) {
            summaryStarsHtml += i < fullStars ? '★' : '<span style="color:#ddd">★</span>';
        }

        const summaryContainer = document.createElement('div');
        summaryContainer.className = 'reviews-summary';
        summaryContainer.innerHTML = `
            <div class="summary-avg-rating">${avgRating.replace('.', ',')}</div>
            <div>
                <div class="summary-stars">${summaryStarsHtml}</div>
                <div class="summary-count">Baseado em ${reviews.length} avaliações</div>
                <div style="font-size: 0.85rem; color: #10b981; margin-top: 6px; display: flex; align-items: center; gap: 4px; font-weight: 600;">
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="14" height="14"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.7 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path></svg>
                    Avaliações 100% Autenticadas
                </div>
            </div>
        `;
        listContainer.parentNode.insertBefore(summaryContainer, listContainer);

        const reviewsToShow = reviews.slice(0, visibleReviewCount);

        const getInitials = (fullName) => {
            if (!fullName) return 'P. Y.';
            return fullName.trim().split(/\s+/).map(n => n[0].toUpperCase() + '.').join(' ');
        };

        const generateAvatarSvg = (seedString) => {
            let h = 0xdeadbeef;
            for(let i = 0; i < seedString.length; i++) {
                h = Math.imul(h ^ seedString.charCodeAt(i), 2654435761);
            }
            h = ((h ^ h >>> 16) >>> 0);

            const rand = () => {
                h = Math.imul(h, 1664525) + 1013904223 | 0;
                return (h >>> 0) / 4294967296;
            };

            const pastelColors = ['#FFEBEE', '#F3E5F5', '#E3F2FD', '#E0F2F1', '#F1F8E9', '#FFFDE7', '#FFF3E0', '#FBE9E7', '#E0F7FA', '#F8BBD0', '#E8EAF6', '#F9FBE7'];
            const skinTones = ['#FFDFC4', '#F0D5BE', '#EECEB3', '#E1B899', '#E5C298', '#FFDCB2', '#E5B887', '#E5A073', '#DB9065', '#CE967C', '#C68642', '#8D5524', '#513227', '#3E2723'];
            const hairColors = ['#090806', '#2C222B', '#71635A', '#B7A69E', '#D6C4C2', '#CABFB1', '#DCD0BA', '#FFF5E1', '#E6CEA8', '#A56B46', '#8D4A43', '#91553D', '#533D32', '#3B3024', '#554838', '#4E433F', '#504444', '#6A4E42', '#A7856A', '#977961'];
            const shirtColors = ['#90A4AE', '#7986CB', '#4DB6AC', '#AED581', '#FF8A65', '#A1887F', '#FFD54F', '#4DD0E1', '#BA68C8', '#FFB74D'];

            const pick = (arr) => arr[Math.floor(rand() * arr.length)];

            const bgColor = pick(pastelColors);
            const skinColor = pick(skinTones);
            const hairColor = pick(hairColors);
            const shirtColor = pick(shirtColors);
            const hairStyle = Math.floor(rand() * 7); 

            let hairPath = '';
            switch(hairStyle) {
                case 0: hairPath = `<path d="M30,45 Q50,15 70,45 Q70,35 50,25 Q30,35 30,45" fill="${hairColor}" />`; break;
                case 1: hairPath = `<path d="M30,45 Q50,15 70,45 L72,85 L28,85 L30,45 Z" fill="${hairColor}" />`; break;
                case 2: hairPath = `<path d="M28,50 Q50,10 72,50 L72,65 Q50,55 28,65 Z" fill="${hairColor}" />`; break;
                case 3: hairPath = `<circle cx="50" cy="25" r="10" fill="${hairColor}" /><path d="M30,45 Q50,20 70,45" fill="${hairColor}" />`; break;
                case 4: hairPath = `<circle cx="50" cy="42" r="24" fill="${hairColor}" />`; break;
                case 5: hairPath = `<path d="M30,45 Q50,5 70,45 L70,50 Q50,30 30,50 Z" fill="${hairColor}" />`; break;
                case 6: hairPath = ''; break;
            }

            return `
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
                <circle cx="50" cy="50" r="50" fill="${bgColor}" />
                <rect x="42" y="55" width="16" height="20" fill="${skinColor}" />
                <path d="M15,100 Q50,65 85,100" fill="${shirtColor}" />
                <circle cx="50" cy="50" r="19" fill="${skinColor}" />
                ${hairPath}
            </svg>`;
        };

        listContainer.innerHTML = reviewsToShow.map(r => `
            <div class="review-card">
                <div class="review-header">
                    <div class="review-avatar">
                        ${generateAvatarSvg(r.id ? String(r.id) : (r.patientName || 'anon') + (r.createdAt || Math.random()))}
                    </div>
                    <div class="review-author-info">
                        <strong class="review-author-name">${getInitials(r.patientName)}</strong>
                        <span class="review-date">${new Date(r.createdAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                </div>
                <div class="review-rating">${'★'.repeat(r.rating)}${'<span style="color:#ddd">★</span>'.repeat(5 - r.rating)}</div>
                <p class="review-comment">${r.comment || ''}</p>
            </div>
        `).join('');

        if (reviews.length > visibleReviewCount) {
            const showMoreBtn = document.createElement('button');
            showMoreBtn.className = 'btn-show-more';
            showMoreBtn.textContent = 'Mostrar mais';
            showMoreBtn.onclick = () => {
                visibleReviewCount += 5; 
                renderReviewsList(reviews); 
            };
            reviewsSection.appendChild(showMoreBtn);
        }
    };

    return {
        showToast,
        showModernModal,
        renderHeroRating,
        renderTagsSection,
        renderSocialLinks,
        renderReviewsList
    };
})();
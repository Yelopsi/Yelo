// Arquivo: public/js/perfil_psicologo.js

const initProfilePage = async () => {
    let visibleReviewCount = 5;

    // --- 1. CONFIGURAÇÃO INICIAL ---
    const BASE_URL = (typeof window.API_BASE_URL !== 'undefined') 
        ? window.API_BASE_URL 
        : 'http://localhost:3001';

    // FIX: Esconde a navegação inferior mobile em páginas públicas
    const mobileNavs = document.querySelectorAll('.mobile-bottom-nav, .bottom-nav');
    mobileNavs.forEach(nav => nav.style.display = 'none');

    // --- 2. FUNÇÕES AUXILIARES DE UI ---
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
                if (typeof primaryUrl === 'function') {
                    primaryUrl();
                } else {
                    window.location.href = primaryUrl; 
                }
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

    // --- 4. RENDERIZADORES DE COMPONENTES ---

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
        // INJEÇÃO DE ESTILOS (CSS) PARA AS TAGS
        // Garante que fiquem bonitas e com as cores da marca (Verde/Dourado)
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
                    background-color: #E8F5E9; /* Verde Claro Suave */
                    color: #1B4332; /* Verde Institucional */
                    border: 1px solid #C8E6C9;
                }
                .tag-especialidade {
                    background-color: #FFF8E1; /* Amarelo Claro */
                    color: #B08D00; /* Dourado Escuro Legível */
                    border: 1px solid #FFE082;
                }
                .tag-info {
                    background-color: #E1F5FE; /* Azul Claro */
                    color: #0277BD; /* Azul Escuro */
                    border: 1px solid #B3E5FC;
                }
                .tag-group {
                    margin-bottom: 16px;
                }
                .tag-group-title {
                    display: block;
                    font-size: 0.75rem;
                    color: #666;
                    margin-bottom: 6px;
                    font-weight: 700;
                    text-transform: uppercase;
                }
            `;
            document.head.appendChild(style);
        }

        let tagsContainer = document.getElementById('psi-tags-container');
        
        // AUTO-CORREÇÃO: Se o elemento não existir no HTML, cria ele dinamicamente
        if (!tagsContainer) {
            // 1. Tenta encontrar a aba "Detalhes Profissionais" (tab-sobre) - PRIORIDADE
            const tabSobre = document.getElementById('tab-sobre');

            if (tabSobre) {
                tabSobre.innerHTML = ''; // Limpa o texto placeholder "Informações detalhadas..."
                tagsContainer = document.createElement('div');
                tagsContainer.id = 'psi-tags-container';
                tagsContainer.className = 'tags-container';
                
                tabSobre.appendChild(tagsContainer);
            } 
            // 2. Fallback (apenas se a aba não existir): Insere após a Bio
            else {
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

        // Função auxiliar para garantir Array (trata JSON string ou array real)
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
        // Novos campos adicionados
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

        // Helper para criar grupos separados com título
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

        // 1. Abordagem
        createGroup('Abordagem', abordagens, 'tag-abordagem');

        // 2. Temas de Atuação
        createGroup('Temas de Atuação', temas, 'tag-especialidade');

        // 3. Público-Alvo Principal
        createGroup('Público-Alvo Principal', publico, 'tag-info');

        // 4. Estilo de Terapia
        createGroup('Estilo de Terapia', estilo, 'tag-info');

        // 5. Identificadores e Práticas Inclusivas
        createGroup('Identificadores e Práticas Inclusivas', [...new Set(inclusivasFormatadas)], 'tag-especialidade');
        
        // Gênero (Movido para o final para manter a ordem solicitada acima)
        const genero = profile.genero || profile.genero_identidade;
        if (genero && !['Prefiro não informar', 'Não informado'].includes(genero)) {
            createGroup('Gênero de Identidade', [genero], 'tag-info');
        }
        
        if (tagsContainer.children.length === 0) {
             tagsContainer.innerHTML = '<span style="color:#999; font-size:0.9em;">Detalhes não informados.</span>';
        }
    };

    // --- RENDERIZAÇÃO DE REDES SOCIAIS (CORRIGIDA) ---
    const renderSocialLinks = (profile) => {
        const container = document.querySelector('.social-links-profile');
        if (!container) return;
        
        container.innerHTML = '';

        // Mapa de Redes: Chave do Banco -> Configuração do Ícone e URL Base
        const networks = [
            { 
                key: 'instagram_url', 
                base: 'https://instagram.com/', 
                label: 'Instagram',
                // SVG Instagram
                icon: '<svg viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>'
            },
            { 
                key: 'linkedin_url', 
                base: 'https://linkedin.com/in/', 
                label: 'LinkedIn',
                // SVG LinkedIn
                icon: '<svg viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>'
            },
            { 
                key: 'facebook_url', 
                base: 'https://facebook.com/', 
                label: 'Facebook',
                // SVG Facebook
                icon: '<svg viewBox="0 0 24 24"><path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"/></svg>'
            },
            { 
                key: 'tiktok_url', 
                base: 'https://tiktok.com/@', 
                label: 'TikTok',
                // SVG TikTok
                icon: '<svg viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.35-1.17.82-1.51 1.45-.39.69-.5 1.49-.41 2.27.08.76.43 1.48.97 2.01 1.05 1.05 2.74 1.34 4.09.81.93-.34 1.71-1.01 2.11-1.92.35-.8.44-1.7.43-2.58 0-2.16-.01-4.32-.01-6.48v-8.48z"/></svg>'
            },
            { 
                key: 'x_url', 
                base: 'https://x.com/', 
                label: 'X // Twitter',
                // SVG X (Twitter)
                icon: '<svg viewBox="0 0 24 24"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/></svg>'
            }
        ];

        let hasLinks = false;

        networks.forEach(net => {
            let userValue = profile[net.key];

            // Só renderiza se o campo tiver conteúdo
            if (userValue && userValue.trim() !== '') {
                hasLinks = true;

                // Lógica inteligente para construir a URL
                // Se o usuário digitou só "usuario", adicionamos a base (ex: instagram.com/)
                // Se ele digitou a URL completa (http...), usamos ela direto
                let finalUrl = userValue;
                if (!userValue.startsWith('http')) {
                    // Remove @ se houver, para evitar duplicidade na URL
                    userValue = userValue.replace('@', '');
                    finalUrl = net.base + userValue;
                }
                
                const link = document.createElement('a');
                link.href = finalUrl;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.className = 'icon-social';
                link.setAttribute('aria-label', net.label);
                link.innerHTML = net.icon; // Insere o SVG inline
                
                container.appendChild(link);
            }
        });

        // Se não tiver nenhum link, esconde o container inteiro para não ficar espaço em branco
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

        // Limpa conteúdo antigo (botão e sumário) para evitar duplicação
        const oldSummary = reviewsSection.querySelector('.reviews-summary');
        if (oldSummary) oldSummary.remove();
        const oldButton = reviewsSection.querySelector('.btn-show-more');
        if (oldButton) oldButton.remove();

        // 1. Trata caso sem avaliações
        if (!reviews || reviews.length === 0) {
            listContainer.innerHTML = '<p style="text-align:center; color:#777; padding: 20px;">Este profissional ainda não possui avaliações.</p>';
            return;
        }

        // 2. Renderiza o sumário (média e total)
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
        // Insere o sumário ANTES da lista de reviews
        listContainer.parentNode.insertBefore(summaryContainer, listContainer);

        // 3. Lógica de "Mostrar Mais"
        const reviewsToShow = reviews.slice(0, visibleReviewCount);

        // Helpers de Iniciais
        const getInitials = (fullName) => {
            if (!fullName) return 'P. Y.'; // Paciente Yelo
            return fullName.trim().split(/\s+/).map(n => n[0].toUpperCase() + '.').join(' ');
        };
        const getAvatarInitials = (fullName) => {
            if (!fullName) return 'PY';
            return fullName.trim().split(/\s+/).map(n => n[0].toUpperCase()).slice(0, 2).join('');
        };

        // --- GERADOR DE AVATAR FLAT DESIGN (ANÔNIMO & DIVERSO) ---
        const generateAvatarSvg = (seedString) => {
            // 1. Hash Melhorado (Avalanche para inputs sequenciais)
            let h = 0xdeadbeef;
            for(let i = 0; i < seedString.length; i++) {
                h = Math.imul(h ^ seedString.charCodeAt(i), 2654435761);
            }
            h = ((h ^ h >>> 16) >>> 0);

            // 2. Gerador Pseudo-Aleatório (LCG)
            // Permite extrair vários números "aleatórios" da mesma seed
            const rand = () => {
                h = Math.imul(h, 1664525) + 1013904223 | 0;
                return (h >>> 0) / 4294967296;
            };

            // Paletas de Cores (Tons Pastéis e Naturais)
            const pastelColors = ['#FFEBEE', '#F3E5F5', '#E3F2FD', '#E0F2F1', '#F1F8E9', '#FFFDE7', '#FFF3E0', '#FBE9E7', '#E0F7FA', '#F8BBD0', '#E8EAF6', '#F9FBE7'];
            const skinTones = ['#FFDFC4', '#F0D5BE', '#EECEB3', '#E1B899', '#E5C298', '#FFDCB2', '#E5B887', '#E5A073', '#DB9065', '#CE967C', '#C68642', '#8D5524', '#513227', '#3E2723'];
            const hairColors = ['#090806', '#2C222B', '#71635A', '#B7A69E', '#D6C4C2', '#CABFB1', '#DCD0BA', '#FFF5E1', '#E6CEA8', '#A56B46', '#8D4A43', '#91553D', '#533D32', '#3B3024', '#554838', '#4E433F', '#504444', '#6A4E42', '#A7856A', '#977961'];
            const shirtColors = ['#90A4AE', '#7986CB', '#4DB6AC', '#AED581', '#FF8A65', '#A1887F', '#FFD54F', '#4DD0E1', '#BA68C8', '#FFB74D'];

            // Seleção usando o rand()
            const pick = (arr) => arr[Math.floor(rand() * arr.length)];

            const bgColor = pick(pastelColors);
            const skinColor = pick(skinTones);
            const hairColor = pick(hairColors);
            const shirtColor = pick(shirtColors);
            const hairStyle = Math.floor(rand() * 7); // 7 estilos

            let hairPath = '';
            // Desenhos vetoriais simplificados dos cabelos
            switch(hairStyle) {
                case 0: hairPath = `<path d="M30,45 Q50,15 70,45 Q70,35 50,25 Q30,35 30,45" fill="${hairColor}" />`; break; // Curto
                case 1: hairPath = `<path d="M30,45 Q50,15 70,45 L72,85 L28,85 L30,45 Z" fill="${hairColor}" />`; break; // Longo Liso
                case 2: hairPath = `<path d="M28,50 Q50,10 72,50 L72,65 Q50,55 28,65 Z" fill="${hairColor}" />`; break; // Médio/Chanel
                case 3: hairPath = `<circle cx="50" cy="25" r="10" fill="${hairColor}" /><path d="M30,45 Q50,20 70,45" fill="${hairColor}" />`; break; // Coque
                case 4: hairPath = `<circle cx="50" cy="42" r="24" fill="${hairColor}" />`; break; // Afro/Cacheado
                case 5: hairPath = `<path d="M30,45 Q50,5 70,45 L70,50 Q50,30 30,50 Z" fill="${hairColor}" />`; break; // Topete
                case 6: hairPath = ''; break; // Careca
            }

            return `
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
                <circle cx="50" cy="50" r="50" fill="${bgColor}" />
                <rect x="42" y="55" width="16" height="20" fill="${skinColor}" /> <!-- Pescoço -->
                <path d="M15,100 Q50,65 85,100" fill="${shirtColor}" /> <!-- Camisa -->
                <circle cx="50" cy="50" r="19" fill="${skinColor}" /> <!-- Cabeça -->
                ${hairPath}
            </svg>`;
        };

        // 4. Renderiza os cards
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

        // 5. Adiciona o botão "Mostrar Mais" se necessário
        if (reviews.length > visibleReviewCount) {
            const showMoreBtn = document.createElement('button');
            showMoreBtn.className = 'btn-show-more';
            showMoreBtn.textContent = 'Mostrar mais';
            showMoreBtn.onclick = () => {
                visibleReviewCount += 5; // Incrementa
                renderReviewsList(reviews); // Re-renderiza a lista
            };
            // Insere o botão DEPOIS da lista de reviews
            reviewsSection.appendChild(showMoreBtn);
        }
    };

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
                            const guestName = localStorage.getItem('yelo_guest_name');

                            // Não esperamos o fetch terminar para não atrasar o usuário
                            /// a rota foi movida para /api/...
                            await fetch(`${BASE_URL}/api/psychologists/${profile.slug}/whatsapp-click`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ patientId, guestPhone, guestName })
                            });
                        } catch (err) {
                            console.error("Erro ao registrar clique:", err);
                        }
                    });
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
            } catch (e) { console.error("Erro ao restaurar rascunho:", e); }
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
                    console.error("Erro review:", error);
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
            } catch (e) { console.error("Erro ao checar favorito:", e); }
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
                console.error(err);
                showToast("Erro de conexão.", "error");
            }
        });
    };

    // --- 8. INICIALIZAÇÃO OTIMIZADA (PÓS-SSR) ---
    const init = async () => {
        // Os dados do perfil agora são injetados pelo EJS em `window.YELO_PROFILE_DATA`
        const profileData = window.YELO_PROFILE_DATA;

        if (!profileData) {
            console.error("Dados do perfil não encontrados. O SSR pode ter falhado.");
            return;
        }

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
                    } catch (e) { console.error("Erro no auto-favorite:", e); }
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
            } catch (e) { console.warn("Aviso de próximo horário ignorado: Rota pendente no backend.", e); }

        } catch (dynamicInitError) {
            console.error("Erro ao inicializar componentes dinâmicos:", dynamicInitError);
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
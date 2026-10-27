// ==========================================================================
// YELO PSI - FÓRUM MODERNO (PROPOSTA V2 / BETA CONTROLLER)
// Mantém 100% de compatibilidade com os endpoints de API do backend,
// trazendo uma camada de apresentação e UX de última geração.
// ==========================================================================

(function() {
    window.inicializarForumModerno = async function(preFetchedData = null) {
        const API_BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : window.location.origin;
        const apiFetch = window.apiFetch || function(url, options = {}) {
            options.credentials = 'include';
            options.headers = options.headers || {};
            if (!options.headers['Content-Type'] && !(options.body instanceof FormData)) {
                options.headers['Content-Type'] = 'application/json';
            }
            return fetch(url, options);
        };
        const formatImageUrl = window.formatImageUrl || function(url) {
            return url || '/img/default-avatar.png';
        };
        const showToast = window.showToast || function(msg, type = 'info') {
            console.log(`[TOAST ${type}]`, msg);
            alert(msg);
        };
        const abrirModalConfirmacao = (title, msg, onConfirm, opts = {}) => {
            if (typeof window.abrirModalConfirmacaoPersonalizado === 'function') {
                window.abrirModalConfirmacaoPersonalizado(title, msg, onConfirm, opts);
            } else if (confirm(`${title}\n\n${msg}`)) {
                onConfirm();
            }
        };

        // --- Cache de Snippets de Tópicos para Menções ---
        window.forumSnippetsCache = window.forumSnippetsCache || {};

        // --- Elementos da Interface ---
        const feedView = document.getElementById('modern-forum-feed');
        const postView = document.getElementById('modern-forum-post-view');
        const postsContainer = document.getElementById('modern-posts-feed-container');
        const loadMorePostsBtn = document.getElementById('modern-btn-load-more-posts');
        const createModal = document.getElementById('modern-create-post-modal');
        const createForm = document.getElementById('modern-create-post-form');
        const openCreateModalBtn = document.getElementById('modern-btn-trigger-create');
        const closeCreateModalBtn = document.getElementById('modern-modal-close-btn');
        const mobileFabBtn = document.getElementById('modern-mobile-fab-create');
        const cancelCreateModalBtn = document.getElementById('modern-btn-modal-cancel');

        // --- Estado do Fórum ---
        let currentPostId = null;
        let currentPostData = null;
        let currentPage = 1;
        const POSTS_LIMIT = 5;

        function isCurrentDiscussionClosed() {
            if (!currentPostData) return false;
            return Boolean(
                (currentPostData.redirectPost && currentPostData.redirectPost.id) ||
                currentPostData.redirectPostId ||
                currentPostData.isClosed ||
                currentPostData.status === 'archived' ||
                currentPostData.status === 'closed' ||
                currentPostData.status === 'encerrada'
            );
        }
        let currentCommentsPage = 1;
        const COMMENTS_LIMIT = 8;
        let isLoadingPosts = false;
        let activeFilter = 'recentes';
        let activeCategory = '';
        let searchQuery = '';
        let searchDebounceTimer = null;

        // --- Ícones SVG embutidos para máxima nitidez ---
        const HEART_ICON_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
        const COMMENT_ICON_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>`;
        const SHARE_ICON_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>`;
        const TRASH_ICON_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
        const EDIT_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-pencil"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path><path d="M15 5l4 4"></path></svg>`;
        const REPORT_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>`;
        const PIN_ICON_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg>`;
        const REDDIT_EXPAND_ICON_SVG = `<svg rpl="" class="reddit-thread-icon" fill="currentColor" height="16" icon-name="add-circle" viewBox="0 0 20 20" width="16" xmlns="http://www.w3.org/2000/svg"><path d="M10 1a9 9 0 100 18 9 9 0 000-18Zm0 16.2a7.2 7.2 0 117.2-7.2 7.208 7.208 0 01-7.2 7.2Zm.9-8.1H14v1.8h-3.1V14H9.1v-3.1H6V9.1h3.1V6h1.8v3.1Z"></path></svg>`;
        const REDDIT_COLLAPSE_ICON_SVG = `<svg rpl="" class="reddit-thread-icon" fill="currentColor" height="16" icon-name="subtract-circle" viewBox="0 0 20 20" width="16" xmlns="http://www.w3.org/2000/svg"><path d="M10 1a9 9 0 100 18 9 9 0 000-18Zm0 16.2a7.2 7.2 0 117.2-7.2 7.208 7.208 0 01-7.2 7.2ZM6 9.1h8v1.8H6Z"></path></svg>`;

        // Helper de tempo relativo humano
        function timeSince(dateString) {
            const date = new Date(dateString);
            const seconds = Math.floor((new Date() - date) / 1000);
            let interval = seconds / 31536000;
            if (interval > 1) return Math.floor(interval) + " anos";
            interval = seconds / 2592000;
            if (interval > 1) return Math.floor(interval) + " meses";
            interval = seconds / 86400;
            if (interval > 1) return Math.floor(interval) + " dias";
            interval = seconds / 3600;
            if (interval > 1) return Math.floor(interval) + " horas";
            interval = seconds / 60;
            if (interval > 1) return Math.floor(interval) + " minutos";
            return "poucos segundos";
        }

        // Sanitização básica contra XSS
        function sanitizeHTML(str) {
            if (!str) return '';
            return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
        }

        // Coloca o cursor no final exato do texto (após a menção)
        function placeCaretAtEnd(el) {
            if (!el) return;
            el.focus();
            if (typeof window.getSelection !== 'undefined' && typeof document.createRange !== 'undefined') {
                const range = document.createRange();
                range.selectNodeContents(el);
                range.collapse(false);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            }
        }

        // Retorna a classe de cor da categoria
        function getCategoryCssClass(cat) {
            if (!cat) return 'tag-offtopic';
            if (cat.includes('Intervisão') || cat.includes('Casos')) return 'tag-intervisao';
            if (cat.includes('Legislação') || cat.includes('CRP')) return 'tag-legislacao';
            if (cat.includes('Indicações')) return 'tag-indicacoes';
            if (cat.includes('Ferramentas')) return 'tag-ferramentas';
            if (cat.includes('Marketing')) return 'tag-marketing';
            return 'tag-offtopic';
        }

        // Renderiza selos de autoridade do psicólogo
        function renderAuthorBadges(badges) {
            if (!badges) return '';
            let html = '';
            if (badges.verified || badges.crp_verificado) html += `<span title="CRP Verificado" style="color:#10b981;">🛡️</span> `;
            if (badges.specialist) html += `<span title="Especialista" style="color:#6366f1;">🎓</span> `;
            if (badges.vip) html += `<span title="Membro VIP" style="color:#f59e0b;">⭐</span> `;
            return html;
        }

        // --- 1. BUSCA E RENDERIZAÇÃO DO FEED DE POSTS ---
        async function fetchAndRenderPosts(page = 1, append = false) {
            if (isLoadingPosts) return;
            isLoadingPosts = true;

            if (!append) {
                postsContainer.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: var(--yelo-text-light);">
                        <div class="loader-spinner" style="margin: 0 auto 12px auto; width: 32px; height: 32px; border: 3px solid #E2E8F0; border-top-color: var(--yelo-primary); border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
                        <span style="font-size: 0.95rem; font-weight: 500;">Carregando discussões da comunidade...</span>
                    </div>
                `;
                if (loadMorePostsBtn) loadMorePostsBtn.style.display = 'none';
            } else if (loadMorePostsBtn) {
                loadMorePostsBtn.textContent = 'Carregando...';
                loadMorePostsBtn.disabled = true;
            }

            try {
                const fetchLimit = POSTS_LIMIT + 1;
                const url = `${API_BASE_URL}/api/forum/posts?filter=${activeFilter}&category=${encodeURIComponent(activeCategory)}&search=${encodeURIComponent(searchQuery)}&page=${page}&limit=${fetchLimit}&pageSize=${POSTS_LIMIT}`;
                const res = await apiFetch(url);
                if (!res.ok) throw new Error('Falha ao obter discussões');
                const posts = await res.json();

                if (!append) postsContainer.innerHTML = '';

                let hasMore = false;
                if (posts.length > POSTS_LIMIT) {
                    hasMore = true;
                    posts.pop();
                }

                if (posts.length === 0 && !append) {
                    postsContainer.innerHTML = `
                        <div style="text-align: center; padding: 60px 20px; background: #FFFFFF; border-radius: var(--yelo-radius-lg); border: 1px dashed var(--yelo-border-subtle);">
                            <div style="font-size: 2.2rem; margin-bottom: 10px;">💬</div>
                            <h3 style="margin: 0 0 6px 0; color: var(--yelo-text-main); font-size: 1.15rem;">Nenhuma discussão encontrada</h3>
                            <p style="color: var(--yelo-text-muted); font-size: 0.9rem; margin: 0 0 18px 0;">Seja o primeiro a abrir um tópico com este tema!</p>
                            <button type="button" class="modern-btn-create-post" onclick="document.getElementById('modern-btn-trigger-create').click()" style="margin: 0 auto;">Iniciar Discussão</button>
                        </div>
                    `;
                    if (loadMorePostsBtn) loadMorePostsBtn.style.display = 'none';
                    return;
                }

                posts.forEach(post => renderPostCard(post, postsContainer));

                if (loadMorePostsBtn) {
                    if (hasMore) {
                        loadMorePostsBtn.style.display = 'inline-flex';
                        loadMorePostsBtn.textContent = 'Carregar mais discussões';
                        loadMorePostsBtn.disabled = false;
                    } else {
                        loadMorePostsBtn.style.display = 'none';
                    }
                }
            } catch (err) {
                console.error("Erro ao carregar posts:", err);
                if (!append) {
                    postsContainer.innerHTML = `<div style="text-align:center; padding:30px; color:#DC2626;">Erro ao carregar o fórum. Tente novamente.</div>`;
                }
            } finally {
                isLoadingPosts = false;
            }
        }

        // Renderiza um único Post Card no feed
        function renderPostCard(post, container) {
            const card = document.createElement('div');
            card.className = 'modern-post-card';
            card.dataset.postId = post.id;

            const authorName = post.isAnonymous ? 'Colega (Anônimo)' : (post.authorName || 'Psicólogo');
            const authorPhoto = post.isAnonymous ? '/img/anonymous-avatar.png' : formatImageUrl(post.authorPhoto);
            const authorSlugLink = (!post.isAnonymous && post.authorSlug) ? `<a href="/${post.authorSlug}" target="_blank" onclick="event.stopPropagation()">${authorName}</a>` : authorName;
            const categoryClass = getCategoryCssClass(post.category);

            card.innerHTML = `
                <div class="modern-card-header">
                    <div class="author-info-group">
                        <div class="modern-avatar-wrapper">
                            <img class="modern-author-avatar" src="${authorPhoto}" alt="${authorName}" onerror="this.src='/img/default-avatar.png'">
                        </div>
                        <div class="author-meta-block">
                            <div class="author-name-row">
                                ${authorSlugLink}
                                <span class="author-badges">${renderAuthorBadges(post.authorBadges)}</span>
                            </div>
                            <span class="post-timestamp-text">há ${timeSince(post.createdAt)}</span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        ${post.isPinned ? `<span class="pinned-badge-chip">${PIN_ICON_SVG} Fixado</span>` : ''}
                        <span class="modern-category-tag ${categoryClass}">${sanitizeHTML(post.category || 'Geral')}</span>
                    </div>
                </div>

                <div>
                    <h3 class="modern-card-title">${sanitizeHTML(post.title)}</h3>
                    <p class="modern-card-snippet" style="margin-top: 8px;">${sanitizeHTML(post.content ? post.content.substring(0, 160) : '')}...</p>
                </div>

                <div class="modern-card-footer">
                    <div class="modern-action-group-left">
                        <button type="button" class="modern-pill-btn support-btn ${post.supportedByMe ? 'supported' : ''}" data-post-id="${post.id}" title="Apoiar este post">
                            ${HEART_ICON_SVG}
                            <span class="post-votes-count">${post.votes || 0}</span>
                        </button>
                        <button type="button" class="modern-pill-btn fake-comment-btn" title="Ver respostas">
                            ${COMMENT_ICON_SVG}
                            <span>${post.commentCount || 0} ${post.commentCount === 1 ? 'resposta' : 'respostas'}</span>
                        </button>
                    </div>
                    <div class="modern-action-group-right">
                        <button type="button" class="modern-icon-action-btn share-btn" title="Copiar link" onclick="event.stopPropagation(); navigator.clipboard.writeText(window.location.origin + '/psi/psi_dashboard.html#postId=' + ${post.id}); alert('Link da discussão copiado!');">
                            ${SHARE_ICON_SVG}
                        </button>
                        ${post.isMine ? `
                            <button type="button" class="modern-icon-action-btn delete" title="Excluir post" onclick="event.stopPropagation(); window.modernForumDeletePost(${post.id}, false)">
                                ${TRASH_ICON_SVG}
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;

            // Click no card abre a discussão
            card.onclick = (e) => {
                if (e.target.closest('button') || e.target.closest('a')) return;
                openPostDetails(post.id);
            };

            // Clique no botão de apoio
            const supportBtn = card.querySelector('.support-btn');
            supportBtn.onclick = (e) => {
                e.stopPropagation();
                toggleSupport(post.id, supportBtn);
            };

            // Filtro rápido ao clicar na tag de categoria do card
            const catTag = card.querySelector('.modern-category-tag');
            if (catTag && post.category) {
                catTag.style.cursor = 'pointer';
                catTag.title = `Filtrar discussões por ${post.category}`;
                catTag.onclick = (e) => {
                    e.stopPropagation();
                    const catSelect = document.getElementById('modern-category-select');
                    if (catSelect) {
                        catSelect.value = post.category;
                        catSelect.dispatchEvent(new Event('change'));
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                };
            }

            container.appendChild(card);
        }

        // --- 2. DETALHES DO POST & COMENTÁRIOS (TELA ÚNICA) ---
        async function openPostDetails(postId) {
            currentPostId = postId;
            feedView.classList.add('hidden');
            postView.classList.remove('hidden');
            if (mobileFabBtn) mobileFabBtn.style.display = 'none';
            window.scrollTo({ top: 0, behavior: 'smooth' });

            postView.innerHTML = `
                <div style="text-align: center; padding: 60px; color: var(--yelo-text-light);">
                    <div class="loader-spinner" style="margin: 0 auto 12px auto; width: 32px; height: 32px; border: 3px solid #E2E8F0; border-top-color: var(--yelo-primary); border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
                    <span>Carregando debate...</span>
                </div>
            `;

            try {
                const res = await apiFetch(`${API_BASE_URL}/api/forum/posts/${postId}`);
                if (!res.ok) throw new Error('Post não encontrado');
                const post = await res.json();
                currentPostData = post;

                const authorName = post.isAnonymous ? 'Colega (Anônimo)' : (post.authorName || 'Psicólogo');
                const authorPhoto = post.isAnonymous ? '/img/anonymous-avatar.png' : formatImageUrl(post.authorPhoto);
                const authorSlugLink = (!post.isAnonymous && post.authorSlug) ? `<a href="/${post.authorSlug}" target="_blank">${authorName}</a>` : authorName;
                const categoryClass = getCategoryCssClass(post.category);

                postView.innerHTML = `
                    <div class="modern-fullpost-container">
                        <div class="modern-fullpost-main">
                            <div class="modern-fullpost-header-nav">
                                <nav class="forum-breadcrumb-nav" aria-label="Navegação do Fórum">
                                    <button type="button" class="breadcrumb-back-btn app-back-btn" id="modern-btn-back-to-feed" title="Voltar ao Feed do Fórum">
                                        <span class="back-icon-circle">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                                        </span>
                                        <span class="back-btn-text">Fórum</span>
                                    </button>
                                    <span class="breadcrumb-sep" aria-hidden="true">›</span>
                                    <span class="breadcrumb-current-cat modern-category-tag ${categoryClass}">${sanitizeHTML(post.category || 'Geral')}</span>
                                </nav>
                            </div>

                            <article class="modern-fullpost-card">
                                <div class="modern-card-header full-post-author-row" style="margin-bottom: 18px;">
                                    <div class="author-info-group">
                                        <img class="modern-author-avatar" style="width: 64px; height: 64px; min-width: 64px; min-height: 64px;" src="${authorPhoto}" alt="${authorName}" onerror="this.src='/img/default-avatar.png'">
                                        <div class="author-meta-block">
                                            <div class="author-name-row" style="font-size: 1.25rem; font-weight: 800;">
                                                ${authorSlugLink}
                                                <span class="author-badges">${renderAuthorBadges(post.authorBadges)}</span>
                                            </div>
                                            <span class="post-timestamp-text" style="display: none;">Publicado há ${timeSince(post.createdAt)}</span>
                                            <div class="post-actions-right fullpost-actions-row" style="display: flex !important; gap: 16px !important; align-items: center !important; margin-top: 6px !important;">
                                                <button type="button" class="modern-icon-action-btn share-btn-full" title="Copiar link da discussão" onclick="navigator.clipboard.writeText(window.location.href); alert('Link copiado!');">
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="post-header-top-right">
                                        <button type="button" class="report-btn modern-icon-action-btn" title="Denunciar Discussão" onclick="window.modernForumReportPost ? window.modernForumReportPost(${post.id}) : null">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>
                                        </button>
                                    </div>
                                </div>

                                <h1 class="modern-fullpost-title">${sanitizeHTML(post.title)}</h1>
                                <div class="modern-fullpost-body">${window.formatTextContent ? window.formatTextContent(post.content) : sanitizeHTML(post.content).replace(/\n/g, '<br>')}</div>
                                <div class="modern-fullpost-footer">
                                    <button type="button" class="modern-pill-btn support-btn ${post.supportedByMe ? 'supported' : ''}" id="fullpost-support-btn" title="Gostei">
                                        ${HEART_ICON_SVG}
                                        <span class="post-votes-count">${post.votes || 0}</span>
                                        <span class="support-label">gostei</span>
                                    </button>
                                </div>
                            </article>

                            <!-- SEÇÃO DE COMENTÁRIOS -->
                            <section class="modern-comments-section">
                                <h3 class="comments-header-title">
                                    ${COMMENT_ICON_SVG}
                                    <span id="post-total-comments-label">Comentários e Trocas</span>
                                </h3>

                                <!-- Composer Moderno de Comentário -->
                                <form id="modern-comment-composer-form" class="modern-comment-composer">
                                    <div id="modern-comment-editor" class="composer-editable-area rich-mention-input" contenteditable="true" data-placeholder="deixe seu comentário."></div>
                                    <div class="composer-toolbar" style="display: flex !important; flex-direction: row !important; align-items: center !important; justify-content: space-between !important; flex-wrap: nowrap !important; gap: 8px !important; width: 100% !important;">
                                        <label class="composer-checkbox-label" style="display: inline-flex !important; align-items: center !important; gap: 6px !important; margin: 0 !important; white-space: nowrap !important; flex-shrink: 0 !important;">
                                            <input type="checkbox" id="modern-comment-anonymous">
                                            <span>Comentar como Anônimo</span>
                                        </label>
                                        <div class="composer-actions-right" style="display: inline-flex !important; align-items: center !important; gap: 8px !important; margin-left: auto !important; flex-shrink: 0 !important;">
                                            <button type="button" id="modern-btn-ai-assist" class="modern-pill-btn" style="background:#ECFDF5; border-color:#A7F3D0; color:#059669; font-weight:700;" title="Sugerir rascunho de resposta fundamentada com IA">
                                                ✨ IA Sugestão
                                            </button>
                                            <button type="submit" class="composer-btn-send" id="modern-btn-submit-comment">
                                                Comentar
                                            </button>
                                        </div>
                                    </div>
                                </form>

                                <!-- Thread de Comentários -->
                                <div id="modern-comment-thread" class="modern-comment-thread">
                                    <div style="text-align: center; padding: 20px; color: var(--yelo-text-light);">Carregando respostas...</div>
                                </div>
                            </section>
                        </div>

                        <!-- Sidebar Lateral: Destaques & Contexto Clínico -->
                        <aside class="modern-sidebar-panel">
                            <div class="sidebar-box">
                                <div class="sidebar-box-header">
                                    <span style="font-size: 1.2rem;">🛡️</span>
                                    <h4 class="sidebar-box-title">Espaço Seguro & CFP</h4>
                                </div>
                                <p style="font-size: 0.85rem; color: #64748B; line-height: 1.5; margin: 0;">
                                    Lembre-se de preservar a confidencialidade e nunca expor dados identificáveis de pacientes.
                                </p>
                            </div>

                            <div class="sidebar-box">
                                <div class="sidebar-box-header">
                                    <span style="font-size: 1.2rem;">🔥</span>
                                    <h4 class="sidebar-box-title">Discussões Populares</h4>
                                </div>
                                <div id="modern-related-posts-container" style="display: flex; flex-direction: column; gap: 12px;">
                                    <span style="font-size: 0.85rem; color: var(--yelo-text-light);">Carregando...</span>
                                </div>
                            </div>
                        </aside>
                    </div>
                `;

                // Eventos da Tela Única
                document.getElementById('modern-btn-back-to-feed').onclick = () => {
                    postView.classList.add('hidden');
                    feedView.classList.remove('hidden');
                    if (mobileFabBtn) mobileFabBtn.style.display = '';
                    currentPostId = null;
                    currentPostData = null;
                };

                const fullSupportBtn = document.getElementById('fullpost-support-btn');
                fullSupportBtn.onclick = () => toggleSupport(postId, fullSupportBtn);

                // Carrega comentários
                fetchAndRenderComments(postId);
                loadSidebarRelatedPosts(postId);

                // Configura formulário de comentário principal
                setupCommentComposer(postId, post.title, post.content);

            } catch (err) {
                console.error("Erro ao carregar post:", err);
                postView.innerHTML = `<div style="text-align:center; padding:50px; color:#DC2626;">Discussão não encontrada ou removida. <br><br><button class="modern-back-btn" onclick="document.getElementById('modern-forum-feed').classList.remove('hidden'); document.getElementById('modern-forum-post-view').classList.add('hidden'); const fab=document.getElementById('modern-mobile-fab-create'); if(fab) fab.style.display='';">Voltar ao Fórum</button></div>`;
            }
        }

        // --- 3. COMENTÁRIOS E THREADS RECURSIVAS ---
        async function fetchAndRenderComments(postId) {
            const container = document.getElementById('modern-comment-thread');
            if (!container) return;

            try {
                const res = await apiFetch(`${API_BASE_URL}/api/forum/posts/${postId}/comments`);
                if (!res.ok) throw new Error('Falha ao carregar comentários');
                const comments = await res.json();

                container.innerHTML = '';
                if (comments.length === 0) {
                    container.innerHTML = `<p style="text-align:center; padding:30px; color:var(--yelo-text-light); font-style:italic;">Ainda não há respostas nesta discussão. Seja o primeiro a compartilhar sua reflexão!</p>`;
                    return;
                }

                comments.forEach(c => renderCommentCard(c, container));
            } catch (err) {
                container.innerHTML = `<p style="color:#DC2626; text-align:center; padding:20px;">Erro ao carregar comentários.</p>`;
            }
        }

        // Renderiza um comentário e suas respostas aninhadas
        function renderCommentCard(comment, container, prepend = false) {
            const card = document.createElement('div');
            card.className = 'modern-comment-card' + (comment.isPinned ? ' pinned-comment' : '');
            card.dataset.commentId = comment.id;

            const authorName = comment.isAnonymous ? 'Colega (Anônimo)' : (comment.authorName || 'Psicólogo');
            const authorPhoto = comment.isAnonymous ? '/img/anonymous-avatar.png' : formatImageUrl(comment.authorPhoto);
            const authorSlugLink = (!comment.isAnonymous && comment.authorSlug) ? `<a href="/${comment.authorSlug}" target="_blank">${authorName}</a>` : authorName;

            const totalReplies = (typeof comment.totalRepliesCount === 'number') ? comment.totalRepliesCount : (comment.replies ? comment.replies.length : 0);

            if (totalReplies > 0) {
                card.classList.add('has-replies');
            }

            card.innerHTML = `
                <!-- Linha tronco clicável oficial do Reddit -->
                ${totalReplies > 0 ? `<div class="threadline-strip cursor-pointer" title="Clique para recolher conversa" aria-hidden="true"></div>` : ''}

                <div class="modern-comment-header" style="display: flex !important; align-items: flex-start !important; gap: 10px !important;">
                    <img class="modern-author-avatar" style="width: 36px !important; height: 36px !important; min-width: 36px !important; min-height: 36px !important; border-radius: 50% !important; object-fit: cover !important; margin: 0 !important; flex-shrink: 0 !important;" src="${authorPhoto}" alt="${authorName}" onerror="this.src='/img/default-avatar.png'">
                    <div class="author-meta-block" style="display: flex !important; flex-direction: column !important; align-items: flex-start !important; justify-content: flex-start !important; gap: 0 !important; margin: 0 !important; padding: 0 !important;">
                        <div class="author-name-row" style="font-size: 0.88rem; margin: 0 !important; padding: 0 !important; height: auto !important; min-height: 0 !important; display: block !important; line-height: 1.35 !important;">
                            ${authorSlugLink}
                            <span class="author-badges" style="display: inline-flex !important; align-items: center !important; gap: 4px !important; vertical-align: middle !important; margin-left: 6px !important; white-space: nowrap !important;">${renderAuthorBadges(comment.authorBadges)}</span>
                            ${comment.isPinned ? `<span class="pinned-badge-chip" style="font-size: 0.68rem; padding: 1px 7px;">${PIN_ICON_SVG} Fixado</span>` : ''}
                        </div>
                        <span class="comment-time-ago" style="margin: 2px 0 0 0 !important; padding: 0 !important; line-height: 1.2 !important; display: block !important;">há ${timeSince(comment.createdAt)}</span>
                    </div>
                </div>

                <div class="yt-comment-content-wrapper">
                    <div class="modern-comment-text">${window.formatTextContent ? window.formatTextContent(comment.content) : sanitizeHTML(comment.content).replace(/\n/g, '<br>')}</div>

                    <div class="modern-comment-actions">
                        <button type="button" class="comment-action-pill like-btn ${comment.likedByMe ? 'liked' : ''}" data-comment-id="${comment.id}">
                            ${HEART_ICON_SVG}
                            <span class="likes-count">${comment.likes || 0}</span>
                        </button>
                        <button type="button" class="comment-action-pill reply-btn" data-comment-id="${comment.id}">
                            ${COMMENT_ICON_SVG}
                            <span>Responder</span>
                        </button>
                        <div class="comment-secondary-actions">
                            ${comment.isMine ? `
                                <button type="button" class="comment-action-pill edit-comment-btn yt-action-btn" title="Editar" onclick="window.modernForumEditComment ? window.modernForumEditComment(${comment.id}, this) : null">
                                    ${EDIT_ICON_SVG}
                                    <span>Editar</span>
                                </button>
                                <button type="button" class="comment-action-pill delete-comment-btn yt-action-btn" style="color:#DC2626;" title="Excluir" onclick="window.modernForumDeleteComment(${comment.id}, this)">
                                    ${TRASH_ICON_SVG}
                                    <span>Excluir</span>
                                </button>
                            ` : ''}
                            <button type="button" class="comment-action-pill report-btn yt-action-btn inline-report" title="Denunciar" onclick="window.modernForumReportComment ? window.modernForumReportComment(${comment.id}) : null">
                                ${REPORT_ICON_SVG}
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Sub-respostas / Tree Reddit -->
                <div class="modern-replies-branch comment-replies-container" style="display: none;"></div>
                ${totalReplies > 0 ? `
                    <button type="button" class="modern-toggle-replies-btn yt-toggle-replies" data-total-replies="${totalReplies}">
                        ${REDDIT_EXPAND_ICON_SVG}
                        <span>${totalReplies} ${totalReplies === 1 ? 'outra resposta' : 'outras respostas'}</span>
                    </button>
                ` : ''}
            `;

            // Ações do comentário
            const likeBtn = card.querySelector('.like-btn');
            likeBtn.onclick = () => toggleCommentLike(comment.id, likeBtn);

            const replyBtn = card.querySelector('.reply-btn');
            if (isCurrentDiscussionClosed()) {
                replyBtn.disabled = true;
                replyBtn.classList.add('disabled');
                replyBtn.setAttribute('disabled', 'disabled');
                replyBtn.setAttribute('title', 'Discussão encerrada para novas respostas');
                replyBtn.style.opacity = '0.45';
                replyBtn.style.cursor = 'not-allowed';
                replyBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    showToast('Esta discussão está encerrada para novas respostas.', 'info');
                };
            } else {
                replyBtn.onclick = () => showInlineReplyBox(comment.id, card, authorName);
            }

            const editBtn = card.querySelector('.edit-comment-btn');
            if (editBtn && isCurrentDiscussionClosed()) {
                editBtn.disabled = true;
                editBtn.classList.add('disabled');
                editBtn.setAttribute('disabled', 'disabled');
                editBtn.setAttribute('title', 'Discussão encerrada para edições');
                editBtn.style.opacity = '0.45';
                editBtn.style.cursor = 'not-allowed';
                editBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    showToast('Esta discussão está encerrada para edições.', 'info');
                };
            }

            // Toggle de respostas aninhadas (Reddit style ⊕ / ⊖ com clique na threadline)
            const toggleBtn = card.querySelector('.modern-toggle-replies-btn');
            const branch = card.querySelector('.modern-replies-branch');
            const threadline = card.querySelector('.threadline-strip');

            if (branch && (toggleBtn || threadline)) {
                if (threadline) threadline.style.display = 'none';

                const expandThread = () => {
                    const count = toggleBtn ? (parseInt(toggleBtn.dataset.totalReplies, 10) || totalReplies) : totalReplies;
                    branch.style.display = 'flex';
                    card.classList.add('has-expanded-replies');
                    if (threadline) threadline.style.display = 'block';

                    if (!renderedNested && comment.replies && comment.replies.length > 0) {
                        comment.replies.forEach(r => renderCommentCard(r, branch));
                        renderedNested = true;
                    }
                    if (toggleBtn) {
                        // Move o botão para o FINAL das respostas
                        branch.appendChild(toggleBtn);
                        toggleBtn.innerHTML = `${REDDIT_COLLAPSE_ICON_SVG} <span>Ocultar ${count === 1 ? 'resposta' : 'respostas'}</span>`;
                    }
                };

                const collapseThread = () => {
                    const count = toggleBtn ? (parseInt(toggleBtn.dataset.totalReplies, 10) || totalReplies) : totalReplies;
                    branch.style.display = 'none';
                    card.classList.remove('has-expanded-replies');
                    if (threadline) threadline.style.display = 'none';

                    if (toggleBtn) {
                        // Move o botão de volta para fora da branch (abaixo do comentário pai)
                        card.insertBefore(toggleBtn, branch.nextSibling);
                        toggleBtn.innerHTML = `${REDDIT_EXPAND_ICON_SVG} <span>${count} ${count === 1 ? 'outra resposta' : 'outras respostas'}</span>`;
                    }
                };

                if (toggleBtn) {
                    toggleBtn.onclick = () => {
                        if (branch.style.display === 'none') {
                            expandThread();
                        } else {
                            collapseThread();
                        }
                    };
                }

                if (threadline) {
                    threadline.onclick = () => {
                        if (branch.style.display === 'none') {
                            expandThread();
                        } else {
                            collapseThread();
                        }
                    };
                }
            }

            if (prepend) container.insertBefore(card, container.firstChild);
            else container.appendChild(card);
        }

        // Formulário de resposta rápida inline no próprio card do comentário
        function showInlineReplyBox(parentId, parentCard, replyToName) {
            if (isCurrentDiscussionClosed()) {
                showToast('Esta discussão está encerrada para novas respostas.', 'info');
                return;
            }
            const existing = parentCard.querySelector('.modern-inline-reply-form');
            if (existing) { existing.remove(); return; }

            const replyBox = document.createElement('form');
            replyBox.className = 'modern-inline-reply-form modern-comment-composer';
            replyBox.style.marginTop = '14px';
            replyBox.innerHTML = `
                <div class="composer-editable-area rich-mention-input" contenteditable="true" data-placeholder="Escreva sua réplica..."></div>
                <div class="composer-toolbar">
                    <label class="composer-checkbox-label">
                        <input type="checkbox" class="inline-anonymous-checkbox">
                        <span>Anônimo</span>
                    </label>
                    <div style="display: flex; gap: 8px;">
                        <button type="button" class="modern-pill-btn btn-cancel-reply" style="border:none;">Cancelar</button>
                        <button type="submit" class="composer-btn-send" style="padding: 7px 16px; font-size: 0.85rem;">Responder</button>
                    </div>
                </div>
            `;

            const editor = replyBox.querySelector('.composer-editable-area');
            const firstName = replyToName ? replyToName.split(' ')[0] : '';
            if (firstName && firstName !== 'Colega') {
                editor.innerText = `@${firstName} `;
            }

            parentCard.appendChild(replyBox);
            placeCaretAtEnd(editor);

            replyBox.querySelector('.btn-cancel-reply').onclick = () => replyBox.remove();
            replyBox.onsubmit = async (e) => {
                e.preventDefault();
                const content = editor.innerText.trim();
                if (!content) return;
                const isAnon = replyBox.querySelector('.inline-anonymous-checkbox').checked;
                const submitBtn = replyBox.querySelector('button[type="submit"]');

                submitBtn.disabled = true;
                submitBtn.textContent = 'Enviando...';

                try {
                    const res = await apiFetch(`${API_BASE_URL}/api/forum/posts/${currentPostId}/comments`, {
                        method: 'POST',
                        body: JSON.stringify({ content, isAnonymous: isAnon, parentId })
                    });
                    if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        throw new Error(err.reason || err.error || 'Erro ao enviar resposta');
                    }
                    const newComment = await res.json();
                    newComment.isMine = true;

                    // Garante que o branch e threadline estejam visíveis
                    parentCard.classList.add('has-replies');
                    parentCard.classList.add('has-expanded-replies');
                    let threadline = parentCard.querySelector('.threadline-strip');
                    if (!threadline) {
                        threadline = document.createElement('div');
                        threadline.className = 'threadline-strip cursor-pointer';
                        threadline.title = 'Clique para recolher conversa';
                        threadline.setAttribute('aria-hidden', 'true');
                        parentCard.insertBefore(threadline, parentCard.firstChild);
                    }
                    if (threadline) threadline.style.display = 'block';

                    const branch = parentCard.querySelector('.comment-replies-container');
                    if (branch) {
                        branch.style.display = 'flex';
                        renderCommentCard(newComment, branch, false);
                    }

                    // Incrementa contadores ancestrais
                    let curr = parentCard;
                    while (curr) {
                        curr.classList.add('has-replies');
                        const tBtn = curr.querySelector('.modern-toggle-replies-btn');
                        if (tBtn) {
                            const newTotal = (parseInt(tBtn.dataset.totalReplies, 10) || 0) + 1;
                            tBtn.dataset.totalReplies = newTotal;
                            const b = curr.querySelector('.comment-replies-container');
                            const isOpen = b && b.style.display !== 'none';
                            tBtn.innerHTML = isOpen 
                                ? `${REDDIT_COLLAPSE_ICON_SVG} <span>Ocultar ${newTotal === 1 ? 'resposta' : 'respostas'}</span>` 
                                : `${REDDIT_EXPAND_ICON_SVG} <span>${newTotal} ${newTotal === 1 ? 'outra resposta' : 'outras respostas'}</span>`;
                            if (isOpen && b) {
                                b.appendChild(tBtn);
                            }
                        }
                        curr = curr.parentElement ? curr.parentElement.closest('.modern-comment-card') : null;
                    }

                    replyBox.remove();
                } catch (err) {
                    alert(err.message || 'Erro ao responder.');
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Responder';
                }
            };
        }

        // Configura o formulário principal de comentários
        function setupCommentComposer(postId, postTitle, postContent) {
            const form = document.getElementById('modern-comment-composer-form');
            const editor = document.getElementById('modern-comment-editor');
            const submitBtn = document.getElementById('modern-btn-submit-comment');
            const aiBtn = document.getElementById('modern-btn-ai-assist');

            if (!form || !editor) return;

            // Assistente de IA
            if (aiBtn) {
                aiBtn.onclick = async () => {
                    aiBtn.disabled = true;
                    aiBtn.innerHTML = '⏳ Pensando...';
                    try {
                        const res = await apiFetch(`${API_BASE_URL}/api/forum/ai/generate-comment`, {
                            method: 'POST',
                            body: JSON.stringify({ postTitle, postContent })
                        });
                        if (res.ok) {
                            const data = await res.json();
                            editor.innerText = data.generatedText || '';
                            placeCaretAtEnd(editor);
                        } else {
                            alert('Não foi possível gerar sugestão da IA no momento.');
                        }
                    } catch (e) {
                        alert('Erro ao conectar com assistente de IA.');
                    } finally {
                        aiBtn.disabled = false;
                        aiBtn.innerHTML = '✨ IA Sugestão';
                    }
                };
            }

            form.onsubmit = async (e) => {
                e.preventDefault();
                const content = editor.innerText.trim();
                if (!content) return;
                const isAnon = document.getElementById('modern-comment-anonymous').checked;

                submitBtn.disabled = true;
                submitBtn.textContent = 'Enviando...';

                try {
                    const res = await apiFetch(`${API_BASE_URL}/api/forum/posts/${postId}/comments`, {
                        method: 'POST',
                        body: JSON.stringify({ content, isAnonymous: isAnon, parentId: null })
                    });
                    if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        throw new Error(err.reason || err.error || 'Erro ao publicar comentário');
                    }
                    const newComment = await res.json();
                    newComment.isMine = true;

                    const thread = document.getElementById('modern-comment-thread');
                    const empty = thread.querySelector('p');
                    if (empty) empty.remove();

                    renderCommentCard(newComment, thread, true);
                    editor.innerText = '';
                } catch (err) {
                    alert(err.message || 'Erro ao publicar comentário.');
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Comentar';
                }
            };
        }

        // Votar / Apoiar post
        async function toggleSupport(postId, btnElement) {
            const isSupported = btnElement.classList.contains('supported');
            const countEl = btnElement.querySelector('.post-votes-count');
            const currentVotes = parseInt(countEl.textContent, 10) || 0;

            btnElement.classList.toggle('supported');
            countEl.textContent = isSupported ? Math.max(0, currentVotes - 1) : currentVotes + 1;

            try {
                await apiFetch(`${API_BASE_URL}/api/forum/posts/${postId}/vote`, { method: 'POST' });
            } catch (err) {
                btnElement.classList.toggle('supported');
                countEl.textContent = currentVotes;
            }
        }

        // Curtir comentário
        async function toggleCommentLike(commentId, btnElement) {
            const isLiked = btnElement.classList.contains('liked');
            const countEl = btnElement.querySelector('.likes-count');
            const currentLikes = parseInt(countEl.textContent, 10) || 0;

            btnElement.classList.toggle('liked');
            countEl.textContent = isLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1;

            try {
                await apiFetch(`${API_BASE_URL}/api/forum/comments/${commentId}/vote`, { method: 'POST' });
            } catch (err) {
                btnElement.classList.toggle('liked');
                countEl.textContent = currentLikes;
            }
        }

        // Excluir post (global helper)
        window.modernForumDeletePost = (id, isFullView) => {
            abrirModalConfirmacao(
                'Excluir Discussão', 
                'Tem certeza de que deseja excluir permanentemente este tópico?', 
                async () => {
                    try {
                        const res = await apiFetch(`${API_BASE_URL}/api/forum/posts/${id}`, { method: 'DELETE' });
                        if (res.ok) {
                            showToast('Discussão excluída com sucesso.', 'info');
                            if (isFullView) {
                                postView.classList.add('hidden');
                                feedView.classList.remove('hidden');
                            }
                            fetchAndRenderPosts(1, false);
                        }
                    } catch (e) {
                        showToast('Erro ao excluir discussão.', 'error');
                    }
                },
                {
                    danger: true,
                    confirmText: 'Sim, excluir discussão',
                    cancelText: 'Cancelar',
                    notice: 'Esta ação é irreversível. Todas as respostas e apoios desta discussão serão removidos.'
                }
            );
        };

        // Excluir comentário (global helper)
        window.modernForumDeleteComment = (id, btnElement) => {
            abrirModalConfirmacao(
                'Excluir Comentário', 
                'Deseja realmente remover seu comentário permanentemente?', 
                async () => {
                    try {
                        const res = await apiFetch(`${API_BASE_URL}/api/forum/comments/${id}`, { method: 'DELETE' });
                        if (res.ok) {
                            const card = btnElement.closest('.modern-comment-card');
                            if (card) card.remove();
                            showToast('Comentário removido.', 'info');
                        }
                    } catch (e) {
                        showToast('Erro ao excluir comentário.', 'error');
                    }
                },
                {
                    danger: true,
                    confirmText: 'Excluir comentário',
                    cancelText: 'Cancelar',
                    notice: 'Sua resposta será apagada de forma permanente da discussão.'
                }
            );
        };

        // Denunciar post (global helper)
        window.modernForumReportPost = (id) => {
            abrirModalConfirmacao(
                'Denunciar Discussão', 
                'Você tem certeza que deseja denunciar esta discussão à moderação?', 
                async () => {
                    try {
                        await apiFetch(`${API_BASE_URL}/api/forum/report`, { method: 'POST', body: JSON.stringify({ type: 'post', id }) });
                        showToast('Denúncia enviada. Agradecemos por cuidar da comunidade!', 'info');
                    } catch (e) {
                        showToast('Erro ao enviar denúncia.', 'error');
                    }
                },
                {
                    report: true,
                    confirmText: 'Enviar denúncia',
                    cancelText: 'Voltar',
                    notice: 'Sua denúncia é 100% anônima e será avaliada com prioridade pela moderação da Yelo.'
                }
            );
        };

        // Denunciar comentário (global helper)
        window.modernForumReportComment = (id) => {
            abrirModalConfirmacao(
                'Denunciar Comentário', 
                'Você tem certeza que deseja denunciar este comentário à moderação?', 
                async () => {
                    try {
                        await apiFetch(`${API_BASE_URL}/api/forum/report`, { method: 'POST', body: JSON.stringify({ type: 'comment', id }) });
                        showToast('Denúncia enviada. Agradecemos por cuidar da comunidade!', 'info');
                    } catch (e) {
                        showToast('Erro ao enviar denúncia.', 'error');
                    }
                },
                {
                    report: true,
                    confirmText: 'Enviar denúncia',
                    cancelText: 'Voltar',
                    notice: 'Sua denúncia é 100% anônima e será avaliada com prioridade pela moderação da Yelo.'
                }
            );
        };

        // Editar comentário (global helper)
        window.modernForumEditComment = (id, btnElement) => {
            if (isCurrentDiscussionClosed()) {
                showToast('Esta discussão está encerrada para edições.', 'info');
                return;
            }
            const card = btnElement.closest('.modern-comment-card');
            if (!card) return;
            const textEl = card.querySelector('.modern-comment-text');
            if (!textEl) return;
            const currentText = textEl.innerText.trim();
            const newText = prompt('Editar comentário:', currentText);
            if (newText !== null && newText.trim() !== '' && newText.trim() !== currentText) {
                apiFetch(`${API_BASE_URL}/api/forum/comments/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ content: newText.trim() })
                }).then(r => {
                    if (r.ok) {
                        textEl.innerHTML = window.formatTextContent ? window.formatTextContent(newText.trim()) : sanitizeHTML(newText.trim()).replace(/\n/g, '<br>');
                        showToast('Comentário atualizado!', 'success');
                    } else {
                        showToast('Erro ao atualizar comentário.', 'error');
                    }
                }).catch(() => showToast('Erro ao atualizar comentário.', 'error'));
            }
        };

        // Sidebar: carrega tópicos populares
        async function loadSidebarRelatedPosts(currentId) {
            const container = document.getElementById('modern-related-posts-container');
            if (!container) return;
            try {
                const res = await apiFetch(`${API_BASE_URL}/api/forum/posts?filter=populares&limit=4`);
                if (!res.ok) return;
                const posts = await res.json();
                const filtered = posts.filter(p => p.id != currentId).slice(0, 3);
                container.innerHTML = '';
                if (filtered.length === 0) {
                    container.innerHTML = `<span style="font-size:0.85rem; color:#94A3B8;">Nenhum outro tópico no momento.</span>`;
                    return;
                }
                filtered.forEach(p => {
                    const item = document.createElement('div');
                    item.style.cssText = 'padding: 10px 12px; background: #F8FAFC; border-radius: 10px; cursor: pointer; transition: all 0.2s; border: 1px solid #E2E8F0;';
                    item.onmouseover = () => { item.style.borderColor = '#52B788'; item.style.background = '#FFFFFF'; };
                    item.onmouseout = () => { item.style.borderColor = '#E2E8F0'; item.style.background = '#F8FAFC'; };
                    item.innerHTML = `
                        <div style="font-size: 0.75rem; font-weight: 700; color: #1B4332; margin-bottom: 3px;">${sanitizeHTML(p.category || 'Geral')}</div>
                        <div style="font-size: 0.88rem; font-weight: 700; color: #0F172A; line-height: 1.3;">${sanitizeHTML(p.title)}</div>
                    `;
                    item.onclick = () => openPostDetails(p.id);
                    container.appendChild(item);
                });
            } catch (e) {
                container.innerHTML = '';
            }
        }

        // --- 4. FILTROS, BUSCA E CRIAÇÃO DE POSTS ---
        // Segmented Tabs
        document.querySelectorAll('.modern-tab-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.modern-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeFilter = btn.dataset.filter || 'recentes';
                currentPage = 1;
                fetchAndRenderPosts(1, false);
            };
        });

        // Seletor Cascata de Categorias
        const categorySelect = document.getElementById('modern-category-select');
        if (categorySelect) {
            categorySelect.onchange = () => {
                activeCategory = categorySelect.value || '';
                const box = categorySelect.closest('.cascade-select-box');
                if (activeCategory) {
                    categorySelect.classList.add('active-filter');
                    if (box) box.classList.add('has-active-filter');
                } else {
                    categorySelect.classList.remove('active-filter');
                    if (box) box.classList.remove('has-active-filter');
                }
                currentPage = 1;
                fetchAndRenderPosts(1, false);
            };
        }

        // Search Input
        const searchInput = document.getElementById('modern-forum-search-input');
        if (searchInput) {
            searchInput.oninput = () => {
                clearTimeout(searchDebounceTimer);
                searchDebounceTimer = setTimeout(() => {
                    searchQuery = searchInput.value.trim();
                    currentPage = 1;
                    fetchAndRenderPosts(1, false);
                }, 350);
            };
        }

        // Load More Posts
        if (loadMorePostsBtn) {
            loadMorePostsBtn.onclick = () => {
                fetchAndRenderPosts(++currentPage, true);
            };
        }

        // Modal / Bottom Sheet de Criação de Post
        const openModalFn = () => {
            if (!createModal) return;
            createModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            const bNav = document.querySelector('.mobile-bottom-nav');
            if (bNav) bNav.classList.add('hidden');
        };

        const closeModalFn = () => {
            if (!createModal) return;
            createModal.style.display = 'none';
            document.body.style.overflow = '';
            const bNav = document.querySelector('.mobile-bottom-nav');
            if (bNav) bNav.classList.remove('hidden');
        };

        if (openCreateModalBtn) openCreateModalBtn.onclick = openModalFn;
        if (mobileFabBtn) mobileFabBtn.onclick = openModalFn;
        if (closeCreateModalBtn) closeCreateModalBtn.onclick = closeModalFn;
        if (cancelCreateModalBtn) cancelCreateModalBtn.onclick = closeModalFn;
        if (createModal) {
            createModal.onclick = (e) => {
                if (e.target === createModal) closeModalFn();
            };
        }

        if (createForm) {
            createForm.onsubmit = async (e) => {
                e.preventDefault();
                const title = document.getElementById('modern-new-post-title').value.trim();
                const category = document.getElementById('modern-new-post-category').value;
                const content = document.getElementById('modern-new-post-content').value.trim();
                const isAnonymous = document.getElementById('modern-new-post-anonymous').checked;
                const submitBtn = createForm.querySelector('button[type="submit"]');

                if (!title || !category || !content) {
                    alert('Por favor, preencha todos os campos do tópico.');
                    return;
                }

                submitBtn.disabled = true;
                submitBtn.textContent = 'Verificando ética & publicando...';

                try {
                    const res = await apiFetch(`${API_BASE_URL}/api/forum/posts`, {
                        method: 'POST',
                        body: JSON.stringify({ title, category, content, isAnonymous })
                    });
                    if (res.status === 422) {
                        const err = await res.json().catch(() => ({}));
                        alert(`Publicação não permitida pelo CFP: ${err.reason || err.error}`);
                        return;
                    }
                    if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        throw new Error(err.error || 'Erro ao publicar tópico');
                    }
                    const newPost = await res.json();
                    closeModalFn();
                    createForm.reset();
                    alert('Discussão publicada com sucesso!');
                    openPostDetails(newPost.id);
                } catch (err) {
                    alert(err.message || 'Erro ao publicar discussão.');
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Publicar Tópico';
                }
            };
        }

        // Inicialização primária
        fetchAndRenderPosts(1, false);
    };

    // Auto-inicializa se estiver executando como página direta
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (document.getElementById('modern-forum-container')) window.inicializarForumModerno();
        });
    } else {
        if (document.getElementById('modern-forum-container')) window.inicializarForumModerno();
    }
})();

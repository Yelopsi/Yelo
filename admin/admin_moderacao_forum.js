// admin/admin_moderacao_forum.js

window.initializePage = function() {
    const tbody = document.getElementById('lista-posts-forum');
    const loadingState = document.getElementById('loading-state-posts');
    const emptyState = document.getElementById('empty-state-posts');
    const emptyTitle = document.getElementById('empty-state-title');
    const emptyDesc = document.getElementById('empty-state-desc');
    const refreshBtn = document.getElementById('btn-refresh-posts');
    const refreshIcon = document.getElementById('icon-refresh-spinner');
    const searchInput = document.getElementById('input-search-forum');
    const clearSearchBtn = document.getElementById('btn-clear-search');
    const categorySelect = document.getElementById('select-category-filter');
    
    // Limpa instância antiga órfã no body caso a página esteja sendo reinicializada
    const oldBodyModal = document.querySelector('body > #modal-preview-post');
    const newPageModal = document.querySelector('#main-content #modal-preview-post');
    if (oldBodyModal && newPageModal && oldBodyModal !== newPageModal) {
        oldBodyModal.remove();
    }
    let previewModal = document.getElementById('modal-preview-post');

    const token = localStorage.getItem('Yelo_token') || localStorage.getItem('Yelo_token_admin');
    const API_BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : '';

    // Estado da página
    let state = {
        status: 'active', // 'active' por padrão para não poluir a visualização com posts removidos
        search: '',
        category: 'all',
        posts: [],
        stats: { total: 0, active: 0, hidden: 0, pinned: 0 },
        searchDebounceTimeout: null,
        currentPreviewPost: null
    };

    /**
     * Busca os posts com os filtros selecionados
     */
    async function carregarPostsDoForum() {
        if (!tbody) return;

        if (refreshIcon) refreshIcon.style.animation = 'spin 0.8s linear infinite';
        if (loadingState) loadingState.style.display = 'block';
        if (emptyState) emptyState.style.display = 'none';
        tbody.innerHTML = '';

        try {
            const params = new URLSearchParams();
            if (state.status) params.append('status', state.status);
            if (state.search) params.append('search', state.search);
            if (state.category && state.category !== 'all') params.append('category', state.category);
            params.append('limit', '100');

            const response = await fetch(`${API_BASE_URL}/api/admin/forum/posts?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || 'Falha ao carregar posts do fórum.');
            }

            const result = await response.json();
            const posts = Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []);
            state.posts = posts;

            // Atualiza estatísticas / KPIs se disponíveis
            if (result.stats) {
                state.stats = result.stats;
                updateStatsUI(result.stats);
            }

            renderPosts(posts);

        } catch (error) {
            console.error('Erro ao carregar posts do fórum:', error);
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 30px; color: #dc2626;">Erro ao carregar publicações: ${error.message}</td></tr>`;
            }
        } finally {
            if (loadingState) loadingState.style.display = 'none';
            if (refreshIcon) refreshIcon.style.animation = 'none';
        }
    }

    /**
     * Atualiza os números nos cards e badges de status
     */
    function updateStatsUI(stats) {
        const kpiTotal = document.getElementById('kpi-total-posts');
        const kpiActive = document.getElementById('kpi-active-posts');
        const kpiHidden = document.getElementById('kpi-hidden-posts');
        const kpiPinned = document.getElementById('kpi-pinned-posts');

        const badgeActive = document.getElementById('pill-badge-active');
        const badgeHidden = document.getElementById('pill-badge-hidden');
        const badgeAll = document.getElementById('pill-badge-all');

        if (kpiTotal) kpiTotal.textContent = stats.total ?? '--';
        if (kpiActive) kpiActive.textContent = stats.active ?? '--';
        if (kpiHidden) kpiHidden.textContent = stats.hidden ?? '--';
        if (kpiPinned) kpiPinned.textContent = stats.pinned ?? '--';

        if (badgeActive) badgeActive.textContent = stats.active ?? '0';
        if (badgeHidden) badgeHidden.textContent = stats.hidden ?? '0';
        if (badgeAll) badgeAll.textContent = stats.total ?? '0';
    }

    /**
     * Renderiza a lista de posts na tabela
     */
    function renderPosts(posts) {
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!posts || posts.length === 0) {
            if (emptyState) {
                emptyState.style.display = 'block';
                if (state.search) {
                    if (emptyTitle) emptyTitle.textContent = 'Nenhum resultado encontrado';
                    if (emptyDesc) emptyDesc.textContent = `Nenhuma discussão correspondeu ao termo "${state.search}".`;
                } else if (state.status === 'hidden') {
                    if (emptyTitle) emptyTitle.textContent = 'Nenhum tópico oculto 🎉';
                    if (emptyDesc) emptyDesc.textContent = 'Não há publicações ocultadas no momento.';
                } else {
                    if (emptyTitle) emptyTitle.textContent = 'Nenhuma discussão encontrada';
                    if (emptyDesc) emptyDesc.textContent = 'Não há publicações para os filtros aplicados.';
                }
            }
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        posts.forEach(post => {
            const tr = document.createElement('tr');
            tr.id = `row-post-${post.id}`;

            const isHidden = post.status === 'hidden_by_admin' || post.status === 'hidden';
            if (isHidden) tr.classList.add('row-hidden');

            // Mapeamento de status
            const statusConfig = {
                'active': { text: 'Ativo', pillClass: 'status-pill-active' },
                'approved_by_admin': { text: 'Ativo', pillClass: 'status-pill-active' },
                'pending_review': { text: 'Pendente', pillClass: 'status-pill-pending' },
                'hidden_by_admin': { text: 'Oculto', pillClass: 'status-pill-hidden' },
                'hidden': { text: 'Oculto', pillClass: 'status-pill-hidden' }
            };
            const currentStatus = statusConfig[post.status] || { text: post.status || 'Ativo', pillClass: 'status-pill-active' };

            // Formatação de data
            const dateObj = post.createdAt ? new Date(post.createdAt) : new Date();
            const dataFormatada = dateObj.toLocaleDateString('pt-BR');
            const horaFormatada = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            // Iniciais do autor para avatar fallback
            const autorNome = post.authorName || 'Anônimo';
            const iniciais = autorNome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'AD';

            // Avatar do autor
            const avatarHTML = post.authorPhoto
                ? `<img src="${post.authorPhoto}" alt="${autorNome}" class="mod-author-avatar" onerror="this.onerror=null; this.outerHTML='<div class=\\'mod-author-avatar\\'>${iniciais}</div>';">`
                : `<div class="mod-author-avatar">${iniciais}</div>`;

            // Trecho do conteúdo (snippet de 120 caracteres)
            const cleanContent = (post.content || '').replace(/<[^>]*>?/gm, '').trim();
            const excerpt = cleanContent ? (cleanContent.length > 120 ? cleanContent.substring(0, 120) + '...' : cleanContent) : 'Sem descrição adicional.';

            // Botão de Ocultar / Restaurar
            let moderateActionBtn = '';
            if (isHidden) {
                moderateActionBtn = `
                    <button type="button" class="btn-act btn-act-restore" onclick="window.handleModerateAction(${post.id}, 'restore')" title="Restaurar publicação no fórum público">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg>
                        <span>Restaurar</span>
                    </button>
                `;
            } else {
                moderateActionBtn = `
                    <button type="button" class="btn-act btn-act-hide" onclick="window.handleModerateAction(${post.id}, 'hide')" title="Ocultar do fórum público">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                        <span>Ocultar</span>
                    </button>
                `;
            }

            // Botão de Fixar
            const isPinned = !!post.isPinned;
            const pinBtnHTML = `
                <button type="button" class="btn-act btn-act-pin ${isPinned ? 'is-pinned' : ''}" onclick="window.togglePinPost('${post.id}', ${isPinned})" title="${isPinned ? 'Desafixar do topo' : 'Fixar no topo'}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg>
                    <span>${isPinned ? 'Fixado' : 'Fixar'}</span>
                </button>
            `;

            // Botão de Excluir Definitivamente
            const deleteBtnHTML = `
                <button type="button" class="btn-act btn-act-delete" onclick="window.handleDeletePost(${post.id})" title="Excluir post permanentemente da base de dados">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    <span>Excluir</span>
                </button>
            `;

            // Botão de Visualizar Detalhes
            const previewBtnHTML = `
                <button type="button" class="btn-act btn-act-preview" onclick="window.openPreviewModal(${post.id})" title="Visualizar mensagem completa e respostas">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    <span>Ver</span>
                </button>
            `;

            tr.innerHTML = `
                <td>
                    <div class="mod-topic-cell">
                        <div class="mod-topic-title-row">
                            ${isPinned ? '<span class="mod-pinned-badge">📌 Fixado</span>' : ''}
                            <span class="mod-category-pill">${post.category || 'Geral'}</span>
                            <span class="mod-topic-title" onclick="window.openPreviewModal(${post.id})">${post.title || 'Sem título'}</span>
                        </div>
                        <div class="mod-topic-excerpt">${excerpt}</div>
                    </div>
                </td>
                <td>
                    <div class="mod-author-cell">
                        ${avatarHTML}
                        <div class="mod-author-info">
                            <span class="mod-author-name">${autorNome}</span>
                            <span class="mod-author-meta">${post.authorEmail || (post.isAnonymous ? 'Anônimo' : 'Psicólogo')}</span>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="mod-engagement-cell">
                        <span class="mod-eng-item" title="Comentários">💬 <strong>${post.commentCount || 0}</strong> respostas</span>
                        <span class="mod-eng-item" title="Votos">👍 <strong>${post.votes || 0}</strong> apoios</span>
                    </div>
                </td>
                <td>
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                        <span style="font-weight: 600; color: #1e293b;">${dataFormatada}</span>
                        <span style="font-size: 0.75rem; color: #94a3b8;">${horaFormatada}</span>
                    </div>
                </td>
                <td>
                    <span class="status-pill ${currentStatus.pillClass}">
                        <span class="dot"></span>
                        ${currentStatus.text}
                    </span>
                </td>
                <td>
                    <div class="mod-actions-cell">
                        ${previewBtnHTML}
                        ${moderateActionBtn}
                        ${pinBtnHTML}
                        ${deleteBtnHTML}
                    </div>
                </td>
            `;

            tbody.appendChild(tr);
        });
    }

    /**
     * Modera o post: Ocultar (soft-delete) ou Restaurar
     */
    window.handleModerateAction = function(postId, action) {
        const isHide = action === 'hide' || action === 'remove';
        const modalTitle = isHide ? 'Ocultar Tópico do Fórum' : 'Restaurar Tópico no Fórum';
        const modalMessage = isHide
            ? 'Você tem certeza que deseja <strong>ocultar</strong> esta publicação?<br><br>Ela será removida imediatamente do feed público dos psicólogos e ficará visível apenas para os administradores na aba <em>Ocultos</em>.'
            : 'Deseja <strong>restaurar</strong> esta publicação?<br><br>Ela voltará a ficar pública e visível para toda a comunidade de psicólogos no fórum.';

        const executeAction = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/admin/forum/moderate`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        contentType: 'post',
                        contentId: postId,
                        action: isHide ? 'remove' : 'restore'
                    })
                });

                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Falha ao moderar publicação.');

                if (window.showToast) {
                    window.showToast(result.message || (isHide ? 'Tópico ocultado com sucesso!' : 'Tópico restaurado com sucesso!'), 'success');
                }

                // Se estamos na aba 'active' e acabamos de ocultar, remove a linha na hora com fade
                if (isHide && state.status === 'active') {
                    const row = document.getElementById(`row-post-${postId}`);
                    if (row) {
                        row.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                        row.style.opacity = '0';
                        row.style.transform = 'translateX(20px)';
                        setTimeout(() => row.remove(), 300);
                    }
                }

                // Se o modal de preview estava aberto, atualiza ou fecha
                if (state.currentPreviewPost && state.currentPreviewPost.id === postId) {
                    window.closePreviewModal();
                }

                // Recarrega lista e contadores
                carregarPostsDoForum();

            } catch (error) {
                console.error('Erro na moderação:', error);
                if (window.showToast) window.showToast(`Erro: ${error.message}`, 'error');
            }
        };

        if (window.openConfirmationModal) {
            window.openConfirmationModal(modalTitle, modalMessage, executeAction);
        } else if (confirm(modalTitle + '\n\n' + modalMessage.replace(/<[^>]*>?/gm, ''))) {
            executeAction();
        }
    };

    /**
     * Exclui o post definitivamente da base de dados
     */
    window.handleDeletePost = function(postId) {
        const modalTitle = 'Excluir Post Permanentemente';
        const modalMessage = '⚠️ <strong>Esta ação é definitiva e irreversível!</strong><br><br>Tem certeza que deseja apagar este tópico e todas as suas respostas da base de dados?';

        const executeDelete = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/admin/forum/posts/${postId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Falha ao excluir publicação.');

                if (window.showToast) {
                    window.showToast(result.message || 'Post excluído permanentemente!', 'success');
                }

                // Remove linha da tabela imediatamente
                const row = document.getElementById(`row-post-${postId}`);
                if (row) {
                    row.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                    row.style.opacity = '0';
                    row.style.transform = 'scale(0.95)';
                    setTimeout(() => row.remove(), 300);
                }

                if (state.currentPreviewPost && state.currentPreviewPost.id === postId) {
                    window.closePreviewModal();
                }

                // Recarrega dados completos
                carregarPostsDoForum();

            } catch (error) {
                console.error('Erro ao excluir post:', error);
                if (window.showToast) window.showToast(`Erro: ${error.message}`, 'error');
            }
        };

        if (window.openConfirmationModal) {
            window.openConfirmationModal(modalTitle, modalMessage, executeDelete);
        } else if (confirm('Excluir Definitivamente\n\nEsta ação é irreversível. Deseja realmente excluir este post?')) {
            executeDelete();
        }
    };

    /**
     * Abre modal de preview com detalhes do post e comentários
     */
    window.openPreviewModal = async function(postId) {
        if (!previewModal) previewModal = document.getElementById('modal-preview-post');
        if (!previewModal) return;

        // Move modal para o body para escapar do contexto de empilhamento e zoom do painel
        if (previewModal.parentElement !== document.body) {
            document.body.appendChild(previewModal);
        }

        // Esconde a bottom nav mobile e bloqueia scroll de fundo
        document.body.classList.add('mod-modal-open');
        document.body.style.overflow = 'hidden';
        const bottomNav = document.querySelector('.mobile-bottom-nav');
        if (bottomNav) {
            bottomNav.classList.add('nav-hidden');
            bottomNav.style.setProperty('display', 'none', 'important');
        }

        const titleEl = document.getElementById('preview-title');
        const catEl = document.getElementById('preview-category');
        const authorNameEl = document.getElementById('preview-author-name');
        const authorAvatarEl = document.getElementById('preview-author-avatar');
        const authorCrpEl = document.getElementById('preview-author-crp');
        const dateEl = document.getElementById('preview-date');
        const statusBadgeEl = document.getElementById('preview-status-badge');
        const contentEl = document.getElementById('preview-content');
        const votesEl = document.getElementById('preview-votes-count');
        const commentsCountEl = document.getElementById('preview-comments-count');
        const commentsTotalEl = document.getElementById('preview-comments-total');
        const commentsListEl = document.getElementById('preview-comments-list');
        const actionsContainer = document.getElementById('preview-quick-actions');

        // Reset visual inicial
        if (titleEl) titleEl.textContent = 'Carregando detalhes...';
        if (contentEl) contentEl.textContent = 'Buscando informações do post...';
        if (commentsListEl) commentsListEl.innerHTML = '<p class="mod-no-comments">Carregando comentários...</p>';
        previewModal.style.display = 'flex';

        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/forum/posts/${postId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error('Não foi possível carregar os detalhes do post.');

            const post = await res.json();
            state.currentPreviewPost = post;

            const isHidden = post.status === 'hidden_by_admin' || post.status === 'hidden';

            if (titleEl) titleEl.textContent = post.title || 'Sem título';
            if (catEl) catEl.textContent = post.category || 'Geral';
            if (authorNameEl) authorNameEl.textContent = post.author?.name || 'Anônimo';
            
            const initials = (post.author?.name || 'AD').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
            if (authorAvatarEl) {
                if (post.author?.photo) {
                    authorAvatarEl.innerHTML = `<img src="${post.author.photo}" alt="${post.author.name}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
                } else {
                    authorAvatarEl.textContent = initials;
                }
            }

            if (authorCrpEl) {
                if (post.author?.crp) {
                    authorCrpEl.style.display = 'inline';
                    authorCrpEl.textContent = `CRP: ${post.author.crp}`;
                } else {
                    authorCrpEl.style.display = 'none';
                }
            }

            if (dateEl) {
                const dateObj = new Date(post.createdAt);
                dateEl.textContent = `Publicado em ${dateObj.toLocaleDateString('pt-BR')} às ${dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
            }

            if (statusBadgeEl) {
                if (isHidden) {
                    statusBadgeEl.className = 'status-pill status-pill-hidden';
                    statusBadgeEl.innerHTML = '● Oculto da Comunidade';
                } else {
                    statusBadgeEl.className = 'status-pill status-pill-active';
                    statusBadgeEl.innerHTML = '● Ativo no Fórum';
                }
            }

            if (contentEl) contentEl.textContent = post.content || 'Sem texto no corpo da mensagem.';
            if (votesEl) votesEl.textContent = `${post.votes || 0} apoios`;
            if (commentsCountEl) commentsCountEl.textContent = `${(post.comments || []).length} respostas`;
            if (commentsTotalEl) commentsTotalEl.textContent = (post.comments || []).length;

            // Renderiza comentários
            if (commentsListEl) {
                if (!post.comments || post.comments.length === 0) {
                    commentsListEl.innerHTML = '<p class="mod-no-comments">Nenhum comentário publicado nesta discussão.</p>';
                } else {
                    commentsListEl.innerHTML = post.comments.map(c => {
                        const cDate = new Date(c.createdAt).toLocaleDateString('pt-BR');
                        return `
                            <div class="mod-comment-card">
                                <div class="mod-comment-head">
                                    <span class="mod-comment-author">${c.authorName || 'Anônimo'}</span>
                                    <span class="mod-comment-date">${cDate}</span>
                                </div>
                                <div class="mod-comment-body">${(c.content || '').replace(/</g, '&lt;')}</div>
                            </div>
                        `;
                    }).join('');
                }
            }

            // Injeta botões de ação rápida no rodapé do modal
            if (actionsContainer) {
                const isPinned = !!post.isPinned;
                const toggleModerateBtn = isHidden
                    ? `<button type="button" class="btn-act btn-act-restore" onclick="window.handleModerateAction(${post.id}, 'restore')">🔄 Restaurar no Fórum</button>`
                    : `<button type="button" class="btn-act btn-act-hide" onclick="window.handleModerateAction(${post.id}, 'hide')">👁️‍🗨️ Ocultar do Fórum</button>`;

                actionsContainer.innerHTML = `
                    ${toggleModerateBtn}
                    <button type="button" class="btn-act btn-act-pin ${isPinned ? 'is-pinned' : ''}" onclick="window.togglePinPost('${post.id}', ${isPinned})">
                        📌 ${isPinned ? 'Desafixar' : 'Fixar no Topo'}
                    </button>
                    <button type="button" class="btn-act btn-act-delete" onclick="window.handleDeletePost(${post.id})">
                        🗑️ Excluir Definitivamente
                    </button>
                `;
            }

        } catch (error) {
            console.error('Erro ao abrir preview:', error);
            if (contentEl) contentEl.textContent = `Erro: ${error.message}`;
        }
    };

    /**
     * Fecha modal de preview
     */
    window.closePreviewModal = function() {
        if (!previewModal) previewModal = document.getElementById('modal-preview-post');
        if (previewModal) previewModal.style.display = 'none';
        state.currentPreviewPost = null;

        // Restaura o body e reexibe a bottom nav mobile
        document.body.classList.remove('mod-modal-open');
        document.body.style.removeProperty('overflow');
        const bottomNav = document.querySelector('.mobile-bottom-nav');
        if (bottomNav) {
            bottomNav.classList.remove('nav-hidden');
            bottomNav.style.removeProperty('display');
        }
    };

    // Fechar modal ao clicar fora
    if (previewModal) {
        previewModal.onclick = (e) => {
            if (e.target === previewModal) window.closePreviewModal();
        };
    }

    // Fechar modal ao pressionar ESC
    const onEscapeKey = (e) => {
        if (e.key === 'Escape') {
            const modal = previewModal || document.getElementById('modal-preview-post');
            if (modal && modal.style.display !== 'none') {
                window.closePreviewModal();
            }
        }
    };
    document.removeEventListener('keydown', onEscapeKey);
    document.addEventListener('keydown', onEscapeKey);

    /**
     * Filtra por status via pills ou KPI cards
     */
    window.setForumStatusFilter = function(status) {
        state.status = status;

        // Atualiza estilo dos pills
        document.querySelectorAll('.mod-pill-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-status') === status);
        });

        // Atualiza estilo dos KPI cards
        document.querySelectorAll('.mod-kpi-card').forEach(card => {
            card.classList.toggle('active-kpi', card.getAttribute('data-filter') === status);
        });

        carregarPostsDoForum();
    };

    /**
     * Filtra por categoria
     */
    window.setForumCategoryFilter = function(category) {
        state.category = category;
        if (categorySelect && category !== 'pinned') categorySelect.value = category;
        carregarPostsDoForum();
    };

    /**
     * Busca com debounce
     */
    window.debounceForumSearch = function(value) {
        state.search = value.trim();

        if (clearSearchBtn) {
            clearSearchBtn.style.display = state.search ? 'block' : 'none';
        }

        clearTimeout(state.searchDebounceTimeout);
        state.searchDebounceTimeout = setTimeout(() => {
            carregarPostsDoForum();
        }, 350);
    };

    /**
     * Limpa o campo de busca
     */
    window.clearForumSearch = function() {
        if (searchInput) searchInput.value = '';
        if (clearSearchBtn) clearSearchBtn.style.display = 'none';
        state.search = '';
        carregarPostsDoForum();
    };

    /**
     * Reseta todos os filtros
     */
    window.resetForumFilters = function() {
        state.status = 'active';
        state.search = '';
        state.category = 'all';

        if (searchInput) searchInput.value = '';
        if (clearSearchBtn) clearSearchBtn.style.display = 'none';
        if (categorySelect) categorySelect.value = 'all';

        document.querySelectorAll('.mod-pill-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-status') === 'active');
        });

        document.querySelectorAll('.mod-kpi-card').forEach(card => {
            card.classList.remove('active-kpi');
        });

        carregarPostsDoForum();
    };

    // Exporta funções principais para escopo global do admin
    window.carregarPostsDoForum = carregarPostsDoForum;

    // Inicialização automática ao montar a tela
    carregarPostsDoForum();
};
// Arquivo: psi_forum.js
// Módulo responsável pelo gerenciamento da Comunidade (Fórum) do Psicólogo

(function() {
    window.inicializarForum = async function(preFetchedData = null) {
        const API_BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : 'http://localhost:3001';
        const apiFetch = window.apiFetch;
        const formatImageUrl = window.formatImageUrl;
        const showToast = window.showToast;
        const abrirModalConfirmacaoPersonalizado = window.abrirModalConfirmacaoPersonalizado;

        // --- Elementos da UI ---
        const feedView = document.getElementById('forum-feed-view');
        const postView = document.getElementById('forum-post-view');
        const postsContainer = document.getElementById('forum-posts-container');
        const loadMoreBtn = document.getElementById('btn-load-more-posts');
        const createModal = document.getElementById('forum-create-modal');
        const createForm = document.getElementById('forum-create-form');
        const closeModalBtn = document.getElementById('forum-modal-close-btn');

        // --- Templates ---
        const postCardTemplate = document.getElementById('forum-post-card-template');
        const fullPostTemplate = document.getElementById('forum-full-post-template');
        const commentTemplate = document.getElementById('forum-comment-template');

        // --- Estado ---
        let currentPostId = null;
        let currentPage = 1;
        const POSTS_LIMIT = 3; // Limite de posts por carga
        
        let currentCommentsPage = 1;
        const COMMENTS_LIMIT = 3; // Limite de comentários por carga

        let isLoadingMore = false;

        const DELETE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
        const EDIT_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-pencil"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path><path d="M15 5l4 4"></path><path d="M5 15l4 4"></path><path d="M3.5 16.5l4 4"></path></svg>`;

        // --- Funções Auxiliares ---
        function setupAutoResizeTextarea(textarea) {
            if (!textarea) return;
            const autoResize = () => {
                textarea.style.height = 'auto';
                // UX Mobile: Limita o crescimento para não empurrar os botões de envio para fora da tela
                const maxHeight = window.innerHeight * 0.3; // Máximo de 30% da altura da janela visível
                if (textarea.scrollHeight > maxHeight) {
                    textarea.style.height = maxHeight + 'px';
                    textarea.style.overflowY = 'auto';
                } else {
                    textarea.style.height = textarea.scrollHeight + 'px';
                    textarea.style.overflowY = 'hidden';
                }
            };
            // UX Mobile: Ao focar no campo e abrir o teclado, puxa o formulário para a visão
            textarea.addEventListener('focus', () => {
                setTimeout(() => {
                    const form = textarea.closest('form') || textarea.parentElement;
                    if (form) form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 300); // 300ms de delay para dar tempo ao teclado nativo subir
            });
            textarea.addEventListener('input', autoResize);
            autoResize();
        }

        function renderInlineAuthorBadges(badges, level) {
            let badgesData = badges;
            if (typeof badges === 'string') {
                try { badgesData = JSON.parse(badges); } catch(e) { badgesData = {}; }
            }

            if (!badgesData && !level) return '';

            let badgesHtml = '';
            let levelHtml = '';
            
            const levelMap = { 'nivel_iniciante': 'Iniciante', 'nivel_verificado': 'Verificado', 'nivel_ativo': 'Ativo', 'nivel_especialista': 'Especialista', 'nivel_mentor': 'Mentor' };
            if (level && levelMap[level] && level !== 'nivel_iniciante') {
                levelHtml = `<span class="author-level-badge">${levelMap[level]}</span>`;
            }

            const badgeIconMap = {
                autentico: { icon: '<svg width="1.2em" height="1.2em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: text-bottom;"><path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.918-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.337 2.25c-.416-.165-.866-.25-1.336-.25-2.21 0-3.918 1.79-3.918 4 0 .495.084.965.238 1.4-1.273.65-2.148 2.02-2.148 3.6 0 1.46.758 2.746 1.9 3.42-.047.19-.074.385-.074.58 0 2.21 1.71 4.002 3.918 4.002.47 0 .92-.086 1.336-.25.52 1.335 1.828 2.25 3.337 2.25s2.816-.915 3.337-2.25c.416.164.866.25 1.336.25 2.21 0 3.918-1.792 3.918-4 0-.195-.027-.39-.074-.58 1.14-.675 1.9-1.96 1.9-3.42z" fill="#1B4332"/><path d="M16.97 8.47a1.5 1.5 0 0 1 0 2.12l-6.5 6.5a1.5 1.5 0 0 1-2.12 0l-3.5-3.5a1.5 1.5 0 1 1 2.12-2.12l2.44 2.44 5.44-5.44a1.5 1.5 0 0 1 2.12 0z" fill="white"/></svg>', title: 'Autêntico' },
                semeador:  { icon: '🌱', title: 'Semeador' },
                voz_ativa: { icon: '💬', title: 'Voz Ativa' },
                pioneiro:  { icon: '🏅', title: 'Pioneiro' }
            };

            const badgeOrder = ['autentico', 'semeador', 'voz_ativa', 'pioneiro'];
            if (badgesData) {
                badgeOrder.forEach(key => {
                    const badgeValue = badgesData[key];
                    if (badgeValue) {
                        let title = badgeIconMap[key].title;
                        if (typeof badgeValue === 'string') title += ` (${badgeValue.charAt(0).toUpperCase() + badgeValue.slice(1)})`;
                        badgesHtml += `<span class="author-badge-icon" title="${title}">${badgeIconMap[key].icon}</span>`;
                    }
                });
            }
            return `${badgesHtml} ${levelHtml}`;
        }

        const sanitizeHTML = (str) => { const temp = document.createElement('div'); temp.textContent = str; return temp.innerHTML; };

        const timeSince = (date) => {
            const seconds = Math.floor((new Date() - new Date(date)) / 1000);
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
            return Math.floor(seconds) + " segundos";
        };

    // --- UX: Scroll e Highlight Blindado ---
    function scrollToAndHighlightComment(commentId) {
        if (!commentId) return;
        let attempts = 0;
        const poller = setInterval(() => {
            attempts++;
            const targetComment = document.querySelector(`.comment-card[data-comment-id="${commentId}"]`);
            if (targetComment) {
                clearInterval(poller);
                
                // Rolagem segura compatível com o layout da Yelo (.dashboard-main)
                const dashboardMain = document.querySelector('.dashboard-main');
                if (dashboardMain) {
                    const dashboardRect = dashboardMain.getBoundingClientRect();
                    const targetRect = targetComment.getBoundingClientRect();
                    const targetTop = targetRect.top - dashboardRect.top + dashboardMain.scrollTop;
                    dashboardMain.scrollTo({ top: targetTop - (dashboardRect.height / 3), behavior: 'smooth' });
                } else {
                    try { targetComment.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e) {}
                }

                // Flash Visual Seguro (Forçando propriedades inline para sobrepor CSS bugado em mobiles antigos)
                targetComment.style.setProperty('transition', 'background-color 0.6s ease, box-shadow 0.6s ease', 'important');
                targetComment.style.setProperty('background-color', 'rgba(255, 238, 140, 0.9)', 'important');
                targetComment.style.setProperty('box-shadow', '0 0 0 4px rgba(255, 238, 140, 0.9)', 'important');
                targetComment.style.setProperty('border-radius', '12px', 'important');
                
                setTimeout(() => {
                    targetComment.style.backgroundColor = 'transparent';
                    targetComment.style.boxShadow = 'none';
                }, 3500);
            } else if (attempts >= 25) { // Desiste após 5 segundos
                clearInterval(poller);
            }
        }, 200);
    }

        // --- Funções de Renderização ---
        function renderPostCard(post) {
            const card = postCardTemplate.content.cloneNode(true).firstElementChild;
            card.dataset.postId = post.id;

            if (post.isPinned) {
                card.classList.add('pinned');
                const titleEl = card.querySelector('.post-title');
                if (titleEl) titleEl.innerHTML = `<span class="pinned-icon" title="Fixado">📌</span> ${post.title}`;
            } else {
                card.querySelector('.post-title').textContent = post.title;
            }

            card.querySelector('.post-category').textContent = post.category;
            const mobileCat = card.querySelector('.post-category-mobile');
            if(mobileCat) mobileCat.textContent = post.category;
            
            const authorName = post.isAnonymous ? 'Anônimo' : post.authorName;
            const authorAvatarEl = card.querySelector('.post-author-avatar');
            if (authorAvatarEl) authorAvatarEl.src = formatImageUrl(post.authorPhoto);
            
            const authorHtml = (post.isAnonymous || !post.authorSlug) 
                ? `por ${authorName}` : `por <a href="/${post.authorSlug}" target="_blank" class="author-link" title="Ver perfil público">${authorName}</a>`;
            card.querySelector('.post-author').innerHTML = authorHtml;
            if (post.isAnonymous) card.querySelector('.post-author').style.fontStyle = 'italic';

            const badgesContainer = card.querySelector('.author-badges');
            if (badgesContainer) badgesContainer.innerHTML = renderInlineAuthorBadges(post.authorBadges, post.authorLevel);

            card.querySelector('.post-time').textContent = `há ${timeSince(post.createdAt)}`;
            card.querySelector('.post-snippet').textContent = post.content.substring(0, 120) + '...';
            card.querySelector('.post-votes-count').textContent = post.votes || 0;
            card.querySelector('.post-comments-count').textContent = `💬 ${post.commentCount || 0} Comentários`;

            card.addEventListener('click', (e) => {
                if (!e.target.closest('.support-btn') && !e.target.closest('.report-btn')) loadFullPost(post.id);
            });

            const supportBtn = card.querySelector('.support-btn');
            if (post.supportedByMe) supportBtn.classList.add('supported');
            supportBtn.onclick = () => toggleSupport(post.id, supportBtn);

            const reportBtn = card.querySelector('.report-btn');
            const editBtn = card.querySelector('.edit-btn');
            const deleteBtn = card.querySelector('.delete-btn');

            if (post.isMine) {
                if (reportBtn) reportBtn.style.display = 'none';
                if (editBtn) { editBtn.classList.remove('hidden'); editBtn.onclick = (e) => { e.stopPropagation(); openEditPostModal(post); }; }
                if (deleteBtn) { deleteBtn.classList.remove('hidden'); deleteBtn.onclick = (e) => { e.stopPropagation(); deletePost(post.id); }; }
            } else {
                if (reportBtn) { reportBtn.style.display = 'inline-block'; reportBtn.onclick = (e) => { e.stopPropagation(); reportContent('post', post.id); }; }
                if (editBtn) editBtn.classList.add('hidden');
                if (deleteBtn) deleteBtn.classList.add('hidden');
            }
            postsContainer.appendChild(card);
        }

        async function loadFullPost(postId) {
            currentPostId = postId;
            currentCommentsPage = 1; 
            
            feedView.classList.add('hidden');
            postView.innerHTML = '<div class="loader-wrapper"><div class="loader-spinner"></div></div>';
            postView.classList.remove('hidden');

            const mHeader = document.querySelector('.mobile-header');
            if (mHeader) mHeader.style.display = 'none';

            const dashboardMain = document.querySelector('.dashboard-main');
            if (dashboardMain && window.innerWidth <= 992) dashboardMain.style.setProperty('padding-top', '0px', 'important');

            try {
                const postRes = await apiFetch(`${API_BASE_URL}/api/forum/posts/${postId}`);
                if (!postRes.ok) throw new Error('Erro ao carregar post');
                const post = await postRes.json();
                
                const postEl = fullPostTemplate.content.cloneNode(true).firstElementChild;
                postEl.querySelector('.full-post-title').textContent = post.title;
                postEl.querySelector('.full-post-category').textContent = post.category;

                const appHeaderTitle = postEl.querySelector('.app-header-title');
                if (appHeaderTitle) appHeaderTitle.textContent = post.title;
                
                const authorAvatarEl = postEl.querySelector('.full-post-avatar');
                if (authorAvatarEl) authorAvatarEl.src = formatImageUrl(post.authorPhoto);
                
                const authorHtml = (post.isAnonymous || !post.authorSlug) 
                    ? (post.isAnonymous ? 'Anônimo' : post.authorName)
                    : `<a href="/${post.authorSlug}" target="_blank" class="author-link" title="Ver perfil público">${post.authorName}</a>`;
                postEl.querySelector('.full-post-author').innerHTML = authorHtml;
                
                const badgesContainer = postEl.querySelector('.author-badges-full');
                if (badgesContainer) badgesContainer.innerHTML = renderInlineAuthorBadges(post.authorBadges, post.authorLevel);

                postEl.querySelector('.full-post-content').innerHTML = window.formatTextContent(post.content);
                postEl.querySelector('.post-votes-count').textContent = post.votes;

                postEl.querySelector('#forum-back-to-feed-btn').onclick = () => {
                    postView.classList.add('hidden');
                    feedView.classList.remove('hidden');
                    currentPostId = null;
                    const mHeader = document.querySelector('.mobile-header');
                    if (mHeader) mHeader.style.display = '';
                    const dashboardMain = document.querySelector('.dashboard-main');
                    if (dashboardMain && window.innerWidth <= 992) dashboardMain.style.paddingTop = ''; 
                };

                const supportBtn = postEl.querySelector('.support-btn');
                if (post.supportedByMe) supportBtn.classList.add('supported');
                supportBtn.onclick = () => toggleSupport(post.id, supportBtn);
                
                const reportBtnFull = postEl.querySelector('.report-btn');
                const editBtnFull = postEl.querySelector('.edit-btn-full');
                const deleteBtnFull = postEl.querySelector('.delete-btn-full');

                if (post.isMine) {
                    if (reportBtnFull) reportBtnFull.style.display = 'none';
                    if (editBtnFull) { editBtnFull.classList.remove('hidden'); editBtnFull.onclick = () => openEditPostModal(post); }
                    if (deleteBtnFull) { deleteBtnFull.classList.remove('hidden'); deleteBtnFull.onclick = () => deletePost(post.id, true); }
                } else {
                    if (reportBtnFull) { reportBtnFull.style.display = 'inline-block'; reportBtnFull.onclick = () => reportContent('post', post.id); }
                    if (editBtnFull) editBtnFull.classList.add('hidden');
                    if (deleteBtnFull) deleteBtnFull.classList.add('hidden');
                }

                postEl.querySelector('#comment-form').onsubmit = handleCommentSubmit;

                const mainCommentTextarea = postEl.querySelector('#comment-content');
                if (mainCommentTextarea) setupAutoResizeTextarea(mainCommentTextarea);

                const loadMoreCommentsBtn = postEl.querySelector('#btn-load-more-comments');
                loadMoreCommentsBtn.onclick = () => fetchAndRenderComments(postId, ++currentCommentsPage, true);

                postView.innerHTML = '';
                postView.appendChild(postEl);

                fetchAndRenderComments(postId, 1, false);
                loadRelatedPosts(postEl.querySelector('#related-posts-container'), postId);

            } catch (err) {
                postView.innerHTML = '<p>Erro ao carregar a discussão.</p>';
            }
        }

        async function fetchAndRenderComments(postId, page = 1, append = false) {
            const commentThread = document.getElementById('comment-thread');
            const loadMoreBtn = document.getElementById('btn-load-more-comments');
            
            if (!commentThread || !loadMoreBtn) return;

            if (!append) {
                commentThread.innerHTML = '<div style="text-align:center; padding:20px; color:#999;">Carregando comentários...</div>';
                loadMoreBtn.style.display = 'none';
            } else {
                loadMoreBtn.textContent = 'Carregando...';
                loadMoreBtn.disabled = true;
            }

            try {
                const fetchLimit = COMMENTS_LIMIT + 1;
                const res = await apiFetch(`${API_BASE_URL}/api/forum/posts/${postId}/comments?page=${page}&limit=${fetchLimit}&pageSize=${COMMENTS_LIMIT}`);
                if (!res.ok) throw new Error('Erro ao buscar comentários');
                const comments = await res.json();
                
                if (!append) commentThread.innerHTML = '';

                let hasMore = false;
                if (comments.length > COMMENTS_LIMIT) {
                    hasMore = true;
                    comments.pop();
                }

                if (comments.length === 0 && !append) {
                    commentThread.innerHTML = '<p style="color:#666; padding:20px; text-align:center; font-style:italic;">Seja o primeiro a comentar nesta discussão!</p>';
                } else {
                    comments.forEach(comment => renderComment(comment, commentThread));
                }

                if (hasMore) {
                    loadMoreBtn.style.display = 'block';
                    loadMoreBtn.textContent = 'Mostrar mais comentários';
                    loadMoreBtn.disabled = false;
                    loadMoreBtn.classList.remove('hidden');
                } else {
                    loadMoreBtn.style.display = 'none';
                }

                // Destaque de comentário ao abrir via notificação
                if (window.yeloCommentToHighlight) {
                    const commentIdToHighlight = window.yeloCommentToHighlight;
                    window.yeloCommentToHighlight = null; // Limpa imediatamente para não repetir
                    scrollToAndHighlightComment(commentIdToHighlight);
                }
            } catch (err) {
                if (!append) commentThread.innerHTML = '<p style="color:#d32f2f; padding:15px; text-align:center;">Erro ao carregar comentários.</p>';
            }
        }

        async function loadRelatedPosts(container, currentPostId) {
            if (!container) return;
            container.innerHTML = '<div style="padding:20px; text-align:center; color:#999;">Carregando...</div>';
            try {
                const res = await apiFetch(`${API_BASE_URL}/api/forum/posts?filter=populares&limit=6`);
                if (!res.ok) return;
                const posts = await res.json();
                const related = posts.filter(p => p.id != currentPostId).slice(0, 5);
                
                container.innerHTML = '';
                if (related.length === 0) {
                    container.innerHTML = '<p style="color:#999; font-size:0.9rem; padding:10px;">Nenhum tópico popular no momento.</p>';
                    return;
                }
                const relatedTemplate = document.getElementById('forum-related-post-template');
                related.forEach(post => {
                    const item = relatedTemplate.content.cloneNode(true).firstElementChild;
                    item.querySelector('.related-post-category').textContent = post.category;
                    item.querySelector('.related-post-title').textContent = post.title;
                    item.querySelector('.related-post-votes').textContent = `❤️ ${post.votes}`;
                    item.querySelector('.related-post-comments').textContent = `💬 ${post.commentCount}`;
                    item.onclick = (e) => { e.preventDefault(); loadFullPost(post.id); };
                    container.appendChild(item);
                });
            } catch (err) { container.innerHTML = ''; }
        }

        function renderComment(comment, container, prepend = false) {
            const commentEl = commentTemplate.content.cloneNode(true).firstElementChild;
            commentEl.dataset.commentId = comment.id; 
            const authorName = comment.isAnonymous ? 'Anônimo' : comment.authorName;
            
            const authorAvatarEl = commentEl.querySelector('.comment-avatar');
            if (authorAvatarEl) authorAvatarEl.src = formatImageUrl(comment.authorPhoto);
            
            const authorHtml = (comment.isAnonymous || !comment.authorSlug) 
                ? authorName : `<a href="/${comment.authorSlug}" target="_blank" class="author-link" title="Ver perfil público">${authorName}</a>`;
            commentEl.querySelector('.comment-author').innerHTML = authorHtml;
            
            if (comment.isAnonymous) commentEl.querySelector('.comment-author').style.fontStyle = 'italic';
            
            const badgesContainer = commentEl.querySelector('.author-badges');
            if (badgesContainer) badgesContainer.innerHTML = renderInlineAuthorBadges(comment.authorBadges, comment.authorLevel);

            commentEl.querySelector('.comment-time').textContent = `há ${timeSince(comment.createdAt)}`;
            commentEl.querySelector('.comment-body').innerHTML = window.formatTextContent(comment.content);
            
            const likeBtn = commentEl.querySelector('.comment-like-btn');
            const likesCount = commentEl.querySelector('.comment-likes-count');
            const replyBtn = commentEl.querySelector('.comment-reply-btn');

            likesCount.textContent = comment.likes || 0;
            if (comment.likedByMe) likeBtn.classList.add('liked');

            likeBtn.onclick = () => toggleCommentLike(comment.id, likeBtn, likesCount);
            replyBtn.onclick = () => showReplyForm(comment.id, commentEl);

            const reportBtn = commentEl.querySelector('.report-btn');
            if (comment.isMine) reportBtn.style.display = 'none';
            reportBtn.onclick = () => reportContent('comment', comment.id);

            if (comment.isMine) {
                const actionsDiv = commentEl.querySelector('.comment-actions');
                const editBtn = document.createElement('button');
                editBtn.className = 'yt-action-btn';
                editBtn.style.marginLeft = 'auto';
                editBtn.innerHTML = EDIT_ICON_SVG;
                editBtn.title = 'Editar';
                editBtn.onclick = () => enableCommentEditing(comment, commentEl);
                
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'yt-action-btn';
                deleteBtn.style.color = '#d32f2f';
                deleteBtn.innerHTML = DELETE_ICON_SVG;
                deleteBtn.title = 'Excluir';
                deleteBtn.onclick = () => deleteComment(comment.id, commentEl);

                actionsDiv.appendChild(editBtn);
                actionsDiv.appendChild(deleteBtn);
            }

            if (comment.replies && comment.replies.length > 0) {
                const repliesWrapper = commentEl.querySelector('.yt-replies-wrapper');
                const repliesContainer = commentEl.querySelector('.comment-replies-container');
                const threadLine = commentEl.querySelector('.yt-thread-line');
                const allReplies = comment.replies;
                let shownCount = 0;
                const BATCH_SIZE = 3;

                const toggleBtn = document.createElement('button');
                toggleBtn.className = 'yt-toggle-replies';
                toggleBtn.innerHTML = `↳ ${comment.replies.length} resposta${comment.replies.length > 1 ? 's' : ''}`;
                
                const loadMoreBtn = document.createElement('button');
                loadMoreBtn.className = 'yt-toggle-replies';
                loadMoreBtn.innerHTML = `↳ Mostrar mais respostas`;
                loadMoreBtn.style.display = 'none';

                repliesWrapper.parentNode.insertBefore(toggleBtn, repliesWrapper);
                repliesContainer.style.display = 'none';

                const renderNextBatch = () => {
                    const nextBatch = allReplies.slice(shownCount, shownCount + BATCH_SIZE);
                    nextBatch.forEach(reply => renderComment(reply, repliesContainer, false));
                    shownCount += nextBatch.length;
                    if (shownCount < allReplies.length) {
                        repliesContainer.appendChild(loadMoreBtn);
                        loadMoreBtn.style.display = 'flex';
                    } else {
                        loadMoreBtn.remove();
                    }
                };

                toggleBtn.onclick = () => {
                    if (repliesContainer.style.display === 'none') {
                        repliesContainer.style.display = 'block';
                        threadLine.classList.remove('hidden');
                        toggleBtn.innerHTML = `▲ Ocultar resposta${comment.replies.length > 1 ? 's' : ''}`;
                        if (shownCount === 0) renderNextBatch();
                    } else {
                        repliesContainer.style.display = 'none';
                        threadLine.classList.add('hidden');
                        toggleBtn.innerHTML = `↳ ${comment.replies.length} resposta${comment.replies.length > 1 ? 's' : ''}`;
                    }
                };
                loadMoreBtn.onclick = (e) => { e.stopPropagation(); renderNextBatch(); };

                // Expande automaticamente se a resposta alvo (notificação) estiver nesta thread
                const hasTargetReply = window.yeloCommentToHighlight && allReplies.some(r => String(r.id) === String(window.yeloCommentToHighlight));
                if (hasTargetReply) {
                    toggleBtn.click();
                    while (shownCount < allReplies.length) {
                        const found = repliesContainer.querySelector(`.comment-card[data-comment-id="${window.yeloCommentToHighlight}"]`);
                        if (found) break;
                        renderNextBatch();
                    }
                }
            }
            if (prepend) container.insertBefore(commentEl, container.firstChild);
            else container.appendChild(commentEl);

            // --- Lógica de Truncamento (Ler mais) do YouTube ---
            const textContainer = commentEl.querySelector('.yt-text');
            const readMoreBtn = commentEl.querySelector('.yt-read-more');
            if (textContainer && readMoreBtn) {
                // Requisita o frame de animação para garantir que o elemento já está renderizado para ler o .scrollHeight
                requestAnimationFrame(() => {
                    if (textContainer.scrollHeight > 85) {
                        textContainer.classList.add('collapsed');
                        readMoreBtn.classList.remove('hidden');
                        readMoreBtn.onclick = () => {
                            textContainer.classList.remove('collapsed');
                            readMoreBtn.remove();
                        };
                    }
                });
            }
        }

        function showReplyForm(parentId, parentElement) {
            const existingForm = document.getElementById('reply-form-dynamic');
            if (existingForm) existingForm.remove();

            const formContainer = document.createElement('div');
            formContainer.id = 'reply-form-dynamic';
            formContainer.innerHTML = `
                <form>
                    <div class="form-group">
                        <textarea rows="1" placeholder="Escreva sua resposta..." required class="comment-input-capsule" style="max-height: 25vh; overflow-y: auto;"></textarea>
                    </div>
                    <div style="display: flex; justify-content: flex-end; gap: 15px; margin-top: 8px;">
                        <button type="button" class="btn-cancel-reply" style="background:none; border:none; text-decoration:underline; cursor:pointer; color:#666; font-size:0.9rem;">Cancelar</button>
                        <button type="submit" class="btn-submit-reply" style="background:none; border:none; text-decoration:underline; cursor:pointer; color:#1B4332; font-weight:bold; font-size:0.9rem;">Responder</button>
                    </div>
                </form>
            `;
            
            const repliesWrapper = parentElement.querySelector('.yt-replies-wrapper') || parentElement.querySelector('.comment-replies-container');
            repliesWrapper.parentNode.insertBefore(formContainer, repliesWrapper);
            const textarea = formContainer.querySelector('textarea');
            
            setupAutoResizeTextarea(textarea);
            textarea.focus();

            formContainer.querySelector('form').onsubmit = (e) => handleCommentSubmit(e, parentId);
            formContainer.querySelector('.btn-cancel-reply').onclick = () => formContainer.remove();
        }

        async function fetchAndRenderPosts(page = 1, append = false) {
            if (isLoadingMore) return;
            if (append) isLoadingMore = true;

            if (!append) {
                postsContainer.innerHTML = '<div class="loader-wrapper"><div class="loader-spinner"></div></div>';
                if (loadMoreBtn) loadMoreBtn.style.display = 'none';
            }
            if (loadMoreBtn) { loadMoreBtn.textContent = 'Carregando...'; loadMoreBtn.disabled = true; }
            try {
                const activeFilter = document.querySelector('.forum-tabs .tab-item.active')?.dataset.filter || 'populares';
                const searchTerm = document.getElementById('forum-search-input')?.value || '';
                let posts;
                
                if (page === 1 && preFetchedData) {
                    posts = await preFetchedData;
                    preFetchedData = null;
                } else {
                    const fetchLimit = POSTS_LIMIT + 1;
                    const res = await apiFetch(`${API_BASE_URL}/api/forum/posts?filter=${activeFilter}&search=${encodeURIComponent(searchTerm)}&page=${page}&limit=${fetchLimit}&pageSize=${POSTS_LIMIT}`);
                    if (!res.ok) throw new Error('Erro ao buscar posts');
                    posts = await res.json();
                }

                if (!append) postsContainer.innerHTML = '';
                
                if (!Array.isArray(posts) || posts.length === 0) {
                    if (!append) postsContainer.innerHTML = '<p style="text-align:center; color:#888;">Nenhuma discussão encontrada.</p>';
                    if (loadMoreBtn) loadMoreBtn.style.display = 'none';
                    return;
                }

                let hasMore = false;
                if (posts.length > POSTS_LIMIT) {
                    hasMore = true;
                    posts.pop(); 
                }

                posts.forEach(renderPostCard);
                
                if (loadMoreBtn) {
                    if (hasMore) { loadMoreBtn.style.display = 'block'; loadMoreBtn.classList.remove('hidden'); } 
                    else { loadMoreBtn.style.display = 'none'; }
                }
            } catch (err) {
               if (!append) postsContainer.innerHTML = '<p>Erro ao carregar discussões.</p>';
            } finally {
                if (loadMoreBtn) { loadMoreBtn.textContent = 'Mostrar mais'; loadMoreBtn.disabled = false; }
                if (append) isLoadingMore = false;
            }
        }

        async function handlePostSubmit(e) {
            e.preventDefault();
            const btn = document.getElementById('forum-submit-post-btn');
            btn.disabled = true;
            btn.textContent = 'Publicando...';
            const formData = new FormData(createForm);
            const data = {
                title: sanitizeHTML(formData.get('title')),
                content: sanitizeHTML(formData.get('content')),
                category: formData.get('category'),
                isAnonymous: formData.get('isAnonymous') === 'on'
            };
            try {
                await apiFetch(`${API_BASE_URL}/api/forum/posts`, { method: 'POST', body: JSON.stringify(data) });
                showToast('Discussão criada com sucesso!', 'success');
                createModal.style.display = 'none';
                createForm.reset();
                if (createTextarea) createTextarea.style.height = 'auto';
                fetchAndRenderPosts();
            } catch (err) { showToast('Erro ao criar discussão.', 'error'); } 
            finally { btn.disabled = false; btn.textContent = 'Publicar'; }
        }

        async function handleCommentSubmit(e, parentId = null) {
            e.preventDefault();
            const form = e.target;
            const textarea = form.querySelector('textarea');
            const checkbox = form.querySelector('input[type="checkbox"]');
            const btn = form.querySelector('button[type="submit"]');
            const content = textarea.value.trim();
            if (!content) return;

            btn.disabled = true;
            const data = { content: sanitizeHTML(content), isAnonymous: checkbox ? checkbox.checked : false, parentId: parentId };

            try {
                const res = await apiFetch(`${API_BASE_URL}/api/forum/posts/${currentPostId}/comments`, { method: 'POST', body: JSON.stringify(data) });
                if (!res.ok) throw new Error('Erro ao salvar comentário');
                const newComment = await res.json();
                
                newComment.isMine = true; 
                const container = parentId ? document.querySelector(`.comment-card[data-comment-id="${parentId}"] .comment-replies-container`) : document.getElementById('comment-thread');
                if (!container) throw new Error('Container não encontrado');
                
                renderComment(newComment, container, true);
                form.reset();
                if (parentId) form.parentElement.remove(); 
            } catch (err) { showToast('Erro ao enviar comentário.', 'error'); } 
            finally { btn.disabled = false; }
        }

        async function toggleSupport(postId, btnElement) {
            const isSupported = btnElement.classList.toggle('supported');
            const votesCountEl = btnElement.parentElement.querySelector('.post-votes-count');
            let currentVotes = parseInt(votesCountEl.textContent);
            votesCountEl.textContent = isSupported ? currentVotes + 1 : currentVotes - 1;
            try {
                await apiFetch(`${API_BASE_URL}/api/forum/posts/${postId}/vote`, { method: 'POST' });
            } catch (err) {
                btnElement.classList.toggle('supported');
                votesCountEl.textContent = currentVotes;
                showToast('Erro ao registrar voto.', 'error');
            }
        }

        async function toggleCommentLike(commentId, btnElement, countElement) {
            const isLiked = btnElement.classList.toggle('liked');
            let currentLikes = parseInt(countElement.textContent);
            countElement.textContent = isLiked ? currentLikes + 1 : currentLikes - 1;
            try {
                await apiFetch(`${API_BASE_URL}/api/forum/comments/${commentId}/vote`, { method: 'POST' });
            } catch (err) {
                btnElement.classList.toggle('liked');
                countElement.textContent = currentLikes;
                showToast('Erro ao registrar voto.', 'error');
            }
        }

        async function deletePost(id, isFullView = false) {
            abrirModalConfirmacaoPersonalizado('Excluir Discussão', 'Tem certeza que deseja excluir esta discussão permanentemente?', async () => {
                try {
                    const res = await apiFetch(`${API_BASE_URL}/api/forum/posts/${id}`, { method: 'DELETE' });
                    if (res.ok) {
                        const data = await res.json();
                        if (data.pointsDeducted) showToast(`Discussão excluída. Perdeu ${data.pointsDeducted} XP.`, 'info');
                        else showToast('Discussão excluída.', 'success');
                        
                        if (isFullView) {
                            postView.classList.add('hidden');
                            feedView.classList.remove('hidden');
                            currentPostId = null;
                            const mHeader = document.querySelector('.mobile-header');
                            if (mHeader) mHeader.style.display = '';
                        }
                        fetchAndRenderPosts();
                    } else { showToast('Erro ao excluir discussão.', 'error'); }
                } catch (err) { showToast('Erro ao excluir discussão.', 'error'); }
            });
        }

        async function deleteComment(id, element) {
            abrirModalConfirmacaoPersonalizado('Excluir Comentário', 'Tem certeza que deseja excluir este comentário?', async () => {
                try {
                    const res = await apiFetch(`${API_BASE_URL}/api/forum/comments/${id}`, { method: 'DELETE' });
                    if (res.ok) {
                        const data = await res.json();
                        element.remove();
                        if (data.pointsDeducted) showToast(`Comentário excluído. Perdeu ${data.pointsDeducted} XP.`, 'info');
                        else showToast('Comentário excluído.', 'success');
                    } else { showToast('Erro ao excluir comentário.', 'error'); }
                } catch (err) { showToast('Erro ao excluir comentário.', 'error'); }
            });
        }

        function reportContent(type, id) {
            abrirModalConfirmacaoPersonalizado('Denunciar Conteúdo', 'Você tem certeza que deseja denunciar este conteúdo como inadequado?', async () => {
                try {
                    await apiFetch(`${API_BASE_URL}/api/forum/report`, { method: 'POST', body: JSON.stringify({ type, id }) });
                    showToast('Denúncia enviada. Agradecemos!', 'info');
                } catch (err) { showToast('Erro ao enviar denúncia.', 'error'); }
            });
        }

        function openEditPostModal(post) {
            createForm.querySelector('[name="title"]').value = post.title;
            const catSelect = document.getElementById('post-category');
            if (catSelect && catSelect.tomselect) catSelect.tomselect.setValue(post.category);
            else createForm.querySelector('[name="category"]').value = post.category;
            
            const contentTextarea = createForm.querySelector('[name="content"]');
            contentTextarea.value = post.content;
            contentTextarea.style.height = 'auto';
            contentTextarea.style.height = contentTextarea.scrollHeight + 'px';
            createForm.querySelector('[name="isAnonymous"]').checked = post.isAnonymous;

            createModal.querySelector('h3').textContent = 'Editar Discussão';
            const submitBtn = document.getElementById('forum-submit-post-btn');
            submitBtn.textContent = 'Salvar Alterações';

            createForm.onsubmit = async (e) => {
                e.preventDefault();
                submitBtn.disabled = true; submitBtn.textContent = 'Salvando...';
                const formData = new FormData(createForm);
                const data = {
                    title: sanitizeHTML(formData.get('title')),
                    content: sanitizeHTML(formData.get('content')),
                    category: formData.get('category'),
                    isAnonymous: formData.get('isAnonymous') === 'on'
                };
                try {
                    const res = await apiFetch(`${API_BASE_URL}/api/forum/posts/${post.id}`, { method: 'PUT', body: JSON.stringify(data) });
                    if (res.ok) {
                        showToast('Discussão atualizada!', 'success');
                        createModal.style.display = 'none';
                        createForm.reset();
                        if (createTextarea) createTextarea.style.height = 'auto';
                        if (currentPostId === post.id) loadFullPost(post.id);
                        fetchAndRenderPosts();
                    } else { showToast('Erro ao atualizar.', 'error'); }
                } catch (err) { showToast('Erro ao atualizar.', 'error'); } 
                finally { submitBtn.disabled = false; submitBtn.textContent = 'Salvar Alterações'; }
            };
            createModal.style.display = 'flex';
        }

        function enableCommentEditing(comment, commentEl) {
            const bodyEl = commentEl.querySelector('.comment-body');
            const originalContent = comment.content;
            bodyEl.style.display = 'none';
            if (commentEl.querySelector('.edit-comment-form')) return;

            const editForm = document.createElement('div');
            editForm.className = 'edit-comment-form';
            editForm.style.marginTop = '10px';
            editForm.innerHTML = `
                <textarea rows="3" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px; max-height: 25vh; overflow-y: auto;">${originalContent}</textarea>
                <div style="display: flex; justify-content: flex-end; gap: 15px; margin-top: 8px;">
                    <button class="cancel-edit" style="background:none; border:none; text-decoration:underline; cursor:pointer; color:#666; font-size:0.9rem;">Cancelar</button>
                    <button class="save-edit" style="background:none; border:none; text-decoration:underline; cursor:pointer; color:#1B4332; font-weight:bold; font-size:0.9rem;">Salvar</button>
                </div>
            `;
            bodyEl.parentNode.insertBefore(editForm, bodyEl.nextSibling);
            const textarea = editForm.querySelector('textarea');
            
            editForm.querySelector('.cancel-edit').onclick = () => { editForm.remove(); bodyEl.style.display = 'block'; };
            editForm.querySelector('.save-edit').onclick = async () => {
                const newContent = textarea.value.trim();
                if (!newContent) return;
                try {
                    const res = await apiFetch(`${API_BASE_URL}/api/forum/comments/${comment.id}`, { method: 'PUT', body: JSON.stringify({ content: newContent }) });
                    if (res.ok) {
                        const updatedComment = await res.json();
                        comment.content = updatedComment.content; 
                        bodyEl.innerHTML = window.formatTextContent(updatedComment.content); 
                        editForm.remove(); bodyEl.style.display = 'block';
                        showToast('Comentário atualizado.', 'success');
                    } else { showToast('Erro ao atualizar.', 'error'); }
                } catch (err) { showToast('Erro ao atualizar.', 'error'); }
            };
        }

        // --- INICIALIZAÇÃO E EVENT LISTENERS ---
        const createTextarea = createForm.querySelector('textarea[name="content"]');
        if (createTextarea) setupAutoResizeTextarea(createTextarea);
                
        const catSelect = document.getElementById('post-category');
        if (catSelect && typeof TomSelect !== 'undefined' && !catSelect.tomselect) {
            const isDesktop = window.innerWidth >= 992;
            if (isDesktop) {
                new TomSelect(catSelect, {
                    create: false,
                    controlInput: `<input type="text" autocomplete="off" size="1" style="opacity:0; width:0; position:absolute; pointer-events:none;">`,
                    dropdownParent: 'body',
                    dropdownClass: 'ts-dropdown custom-ts-dropdown'
                });
            }
        }

        let createPrompt = document.getElementById('modern-create-post-prompt');
        if (!createPrompt && postsContainer) {
            createPrompt = document.createElement('div');
            createPrompt.id = 'modern-create-post-prompt';
            createPrompt.className = 'modern-create-prompt';
            postsContainer.parentNode.insertBefore(createPrompt, postsContainer);
        }
            
        if (createPrompt) {
            const psiData = typeof window.getPsychologistData === 'function' ? window.getPsychologistData() : null;
            const localName = (psiData && psiData.nome) ? psiData.nome : (localStorage.getItem('Yelo_user_name') || 'Colega');
            const userFirstName = localName.split(' ')[0];
            const localPhoto = (psiData && psiData.fotoUrl) ? psiData.fotoUrl : localStorage.getItem('Yelo_user_photo');
            const userPhoto = localPhoto ? formatImageUrl(localPhoto) : 'https://placehold.co/70x70/1B4332/FFFFFF?text=Psi';

            createPrompt.innerHTML = `
                <img src="${userPhoto}" alt="Sua foto" class="prompt-avatar">
                <div class="prompt-fake-input">Compartilhe um caso, dúvida ou insight, ${userFirstName}...</div>
                <button class="prompt-btn">Criar Tópico</button>
            `;
            
            createPrompt.onclick = () => {
                createForm.reset();
                if (createTextarea) createTextarea.style.height = 'auto';
                if (catSelect && catSelect.tomselect) catSelect.tomselect.clear(true);
                createModal.querySelector('h3').textContent = 'Criar Nova Discussão';
                document.getElementById('forum-submit-post-btn').textContent = 'Publicar';
                createForm.onsubmit = handlePostSubmit;
                createModal.style.display = 'flex';
            };
        }

        closeModalBtn.onclick = () => createModal.style.display = 'none';
        createModal.onclick = (e) => { if (e.target === createModal) createModal.style.display = 'none'; };
        createForm.onsubmit = handlePostSubmit;
        
        const cancelForumBtn = document.getElementById('cancel-forum-modal');
        if (cancelForumBtn) cancelForumBtn.onclick = () => createModal.style.display = 'none';
        
        const tabs = document.querySelectorAll('.forum-tabs .tab-item');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentPage = 1;
                fetchAndRenderPosts(1, false);
            });
        });

        const searchInput = document.getElementById('forum-search-input');
        let searchDebounce;
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(searchDebounce);
                searchDebounce = setTimeout(() => {
                    currentPage = 1;
                    fetchAndRenderPosts(1, false);
                }, 500); 
            });
        }

        if (loadMoreBtn) loadMoreBtn.onclick = () => fetchAndRenderPosts(++currentPage, true);

        fetchAndRenderPosts(1, false);

        if (window.yeloPostToOpen) {
            setTimeout(() => {
                loadFullPost(window.yeloPostToOpen);
                window.yeloPostToOpen = null;
            }, 100);
        }
    };
})();
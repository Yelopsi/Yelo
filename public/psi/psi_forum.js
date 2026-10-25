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
        let currentPostData = null;
        let currentPage = 1;
        const POSTS_LIMIT = 3; // Limite de posts por carga

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
        const COMMENTS_LIMIT = 5; // Paginação de comentários ativada (Deep linking faz o auto-load caso necessário)

        let isLoadingMore = false;

        const DELETE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
        const EDIT_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-pencil"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path><path d="M15 5l4 4"></path></svg>`;
        const REPORT_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>`;
        const REDDIT_EXPAND_ICON_SVG = `<svg rpl="" class="reddit-thread-icon" fill="currentColor" height="16" icon-name="add-circle" viewBox="0 0 20 20" width="16" xmlns="http://www.w3.org/2000/svg"><path d="M10 1a9 9 0 100 18 9 9 0 000-18Zm0 16.2a7.2 7.2 0 117.2-7.2 7.208 7.208 0 01-7.2 7.2Zm.9-8.1H14v1.8h-3.1V14H9.1v-3.1H6V9.1h3.1V6h1.8v3.1Z"></path></svg>`;
        const REDDIT_COLLAPSE_ICON_SVG = `<svg rpl="" class="reddit-thread-icon" fill="currentColor" height="16" icon-name="subtract-circle" viewBox="0 0 20 20" width="16" xmlns="http://www.w3.org/2000/svg"><path d="M10 1a9 9 0 100 18 9 9 0 000-18Zm0 16.2a7.2 7.2 0 117.2-7.2 7.208 7.208 0 01-7.2 7.2ZM6 9.1h8v1.8H6Z"></path></svg>`;

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
            // UX Mobile: Ao focar no campo e abrir o teclado, centraliza suavemente na área visível
            textarea.addEventListener('focus', () => {
                setTimeout(() => {
                    if (textarea.scrollIntoViewIfNeeded) {
                        textarea.scrollIntoViewIfNeeded();
                    } else {
                        textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 350); // 350ms para acomodar a animação do teclado no iOS
            });
            textarea.addEventListener('input', autoResize);
            autoResize();
        }

        function renderInlineAuthorBadges(badges) {
            let badgesData = badges;
            if (typeof badges === 'string') {
                try { badgesData = JSON.parse(badges); } catch(e) { badgesData = {}; }
            }

            if (!badgesData || typeof badgesData !== 'object') return '';

            let badgesHtml = '';

            const badgeIconMap = {
                autentico: {
                    icon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;"><path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.918-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.337 2.25c-.416-.165-.866-.25-1.336-.25-2.21 0-3.918 1.79-3.918 4 0 .495.084.965.238 1.4-1.273.65-2.148 2.02-2.148 3.6 0 1.46.758 2.746 1.9 3.42-.047.19-.074.385-.074.58 0 2.21 1.71 4.002 3.918 4.002.47 0 .92-.086 1.336-.25.52 1.335 1.828 2.25 3.337 2.25s2.816-.915 3.337-2.25c.416.164.866.25 1.336.25 2.21 0 3.918-1.792 3.918-4 0-.195-.027-.39-.074-.58 1.14-.675 1.9-1.96 1.9-3.42z" fill="#1B4332"/><path d="M16.97 8.47a1.5 1.5 0 0 1 0 2.12l-6.5 6.5a1.5 1.5 0 0 1-2.12 0l-3.5-3.5a1.5 1.5 0 1 1 2.12-2.12l2.44 2.44 5.44-5.44a1.5 1.5 0 0 1 2.12 0z" fill="white"/></svg>',
                    title: 'Autêntico'
                },
                semeador: {
                    icon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><path d="M12 22v-9"/><path d="M12 13a5 5 0 0 0-5-5c0 4 2 6 5 6Z"/><path d="M12 10a5 5 0 0 1 5-5c0 4-2 6-5 6Z"/></svg>',
                    title: 'Semeador'
                },
                voz_ativa: {
                    icon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
                    title: 'Voz Ativa'
                },
                pioneiro: {
                    icon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>',
                    title: 'Pioneiro'
                }
            };

            const badgeOrder = ['autentico', 'semeador', 'voz_ativa', 'pioneiro'];
            badgeOrder.forEach(key => {
                const badgeValue = badgesData[key];
                if (badgeValue && badgeIconMap[key]) {
                    let title = badgeIconMap[key].title;
                    if (typeof badgeValue === 'string') title += ` (${badgeValue.charAt(0).toUpperCase() + badgeValue.slice(1)})`;
                    badgesHtml += `<span class="author-badge-icon mini-badge" data-badge="${key}" title="${title}">${badgeIconMap[key].icon}</span>`;
                }
            });

            return badgesHtml.trim();
        }

        function openEthicsBlockedModal(data) {
            const ethicsModal = document.getElementById('forum-ethics-blocked-modal');
            if (!ethicsModal) {
                alert(`Publicação não permitida: ${data?.reason || 'Conteúdo viola as diretrizes éticas profissionais.'}`);
                return;
            }

            const badgeEl = document.getElementById('ethics-violation-badge');
            const reasonEl = document.getElementById('ethics-violation-reason');
            const suggestionEl = document.getElementById('ethics-violation-suggestion');
            const btnUnderstand = document.getElementById('btn-ethics-understand');

            const categoryNames = {
                'RESPEITO_URBANIDADE': 'Diretrizes: Respeito Acima de Tudo',
                'SIGILO_PROFISSIONAL': 'Diretrizes: Sigilo Profissional é Inegociável',
                'SPAM_AUTOPROMOCAO': 'Diretrizes: Conteúdo Construtivo / Sem Spam',
                'DIVULGACAO_CONCORRENTES': 'Diretrizes: Sem Divulgação de Concorrentes',
                'DIREITOS_HUMANOS': 'Diretrizes: Direitos Humanos',
                'PRESCRICAO_MEDICAMENTOSA': 'Código de Ética CFP: Prescrição de Medicamentos',
                'PRESCRIÇÃO_MEDICAMENTOSA': 'Código de Ética CFP: Prescrição de Medicamentos',
                'TERAPIA_REVERSAO': 'Código de Ética CFP: Res. 01/99 (Direitos Humanos)',
                'DISCURSO_ODIO': 'Diretrizes: Direitos Humanos / Tolerância Zero',
                'TESTES_PSICOLOGICOS': 'Código de Ética CFP: Material Restrito (SATEPSI)',
                'AUTOEXTERMINIO': 'Apoio em Crise / Prevenção',
                'OUTRO': 'Regras da Comunidade Yelo'
            };

            const catKey = data?.category || 'OUTRO';
            if (badgeEl) {
                badgeEl.textContent = categoryNames[catKey] || catKey.replace(/_/g, ' ');
            }

            if (reasonEl) {
                reasonEl.textContent = data?.reason || 'Este conteúdo contém trechos que violam o Código de Ética Profissional do Psicólogo ou as diretrizes da comunidade Yelo.';
            }

            if (suggestionEl) {
                suggestionEl.textContent = data?.suggestion || 'Revise o texto, remova quaisquer dados identificáveis ou orientações contrárias ao código de ética e tente novamente.';
            }

            const closeModal = () => {
                ethicsModal.style.display = 'none';
            };

            if (btnUnderstand) {
                btnUnderstand.onclick = closeModal;
            }

            ethicsModal.onclick = (e) => {
                if (e.target === ethicsModal) closeModal();
            };

            ethicsModal.style.display = 'flex';
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
                window.yeloCommentToHighlight = null; // Limpa ao encontrar
                
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
            } else {
                // Se não encontrou, talvez esteja numa página de paginação ou escondido.
                // A cada 1 segundo (5 attempts), se houver botão de carregar mais, clica nele.
                if (attempts % 5 === 0) {
                    const loadMoreBtn = document.getElementById('btn-load-more-comments');
                    if (loadMoreBtn && loadMoreBtn.style.display !== 'none' && !loadMoreBtn.disabled) {
                        loadMoreBtn.click();
                    } else if (attempts >= 40) { // Desiste após 8 segundos ou se não há mais páginas
                        clearInterval(poller);
                        window.yeloCommentToHighlight = null;
                    }
                } else if (attempts >= 40) {
                    clearInterval(poller);
                    window.yeloCommentToHighlight = null;
                }
            }
        }, 200);
    }

        // --- Funções de Citação, Menção e Compartilhamento de Tópicos ---
        window.forumSnippetsCache = window.forumSnippetsCache || {};

        function copyPostLink(postId, postTitle) {
            const postUrl = `${window.location.origin}/psi/psi_dashboard.html?tab=forum&post=${postId}`;
            const notifySuccess = () => {
                if (typeof showToast === 'function') {
                    showToast('Link do tópico copiado!', 'success');
                } else if (typeof window.showToast === 'function') {
                    window.showToast('Link do tópico copiado!', 'success');
                }
            };

            const fallbackCopy = (text) => {
                try {
                    const temp = document.createElement('textarea');
                    temp.value = text;
                    temp.style.position = 'fixed';
                    temp.style.top = '-9999px';
                    temp.style.left = '-9999px';
                    temp.setAttribute('readonly', '');
                    document.body.appendChild(temp);
                    temp.focus();
                    temp.select();
                    temp.setSelectionRange(0, 99999);
                    document.execCommand('copy');
                    document.body.removeChild(temp);
                } catch (e) {
                    console.warn('Fallback copy failed', e);
                }
            };

            if (navigator.clipboard && window.isSecureContext && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(postUrl)
                    .then(notifySuccess)
                    .catch(() => {
                        fallbackCopy(postUrl);
                        notifySuccess();
                    });
            } else {
                fallbackCopy(postUrl);
                notifySuccess();
            }
        }

        async function hydrateForumMentions(container) {
            if (!container) return;
            const elements = container.querySelectorAll('.forum-topic-mention-card, .forum-mention-pill');
            if (elements.length === 0) return;

            const postIds = new Set();
            elements.forEach(el => {
                const id = el.dataset.postId;
                if (id) postIds.add(id);
            });

            postIds.forEach(async (id) => {
                if (window.forumSnippetsCache[id]) {
                    applySnippetToElements(id, window.forumSnippetsCache[id], container);
                    return;
                }
                try {
                    const res = await apiFetch(`${API_BASE_URL}/api/forum/posts/${id}/snippet`);
                    if (res.ok) {
                        const snippet = await res.json();
                        window.forumSnippetsCache[id] = snippet;
                        applySnippetToElements(id, snippet, container);
                    } else if (res.status === 404) {
                        window.forumSnippetsCache[id] = { notFound: true };
                        applySnippetToElements(id, { notFound: true }, container);
                    }
                } catch(e) {
                    console.warn('Erro ao carregar snippet do post #' + id, e);
                }
            });
        }

        function applySnippetToElements(id, snippet, container) {
            const cards = container.querySelectorAll(`.forum-topic-mention-card[data-post-id="${id}"]`);
            cards.forEach(card => {
                if (snippet.notFound) {
                    card.classList.add('not-found');
                    const titleEl = card.querySelector(`.mention-title-${id}`) || card.querySelector('.mention-card-title');
                    if (titleEl) titleEl.textContent = `Tópico #${id} não encontrado ou removido`;
                    const catEl = card.querySelector(`.mention-cat-${id}`) || card.querySelector('.mention-card-category');
                    if (catEl) catEl.textContent = 'Indisponível';
                    const metaEl = card.querySelector(`.mention-meta-${id}`) || card.querySelector('.mention-card-meta');
                    if (metaEl) metaEl.innerHTML = '<span class="meta-item">Esta discussão não está mais disponível.</span>';
                    return;
                }
                const titleEl = card.querySelector(`.mention-title-${id}`) || card.querySelector('.mention-card-title');
                if (titleEl) titleEl.textContent = snippet.title || `Discussão #${id}`;

                const catEl = card.querySelector(`.mention-cat-${id}`) || card.querySelector('.mention-card-category');
                if (catEl && snippet.category) catEl.textContent = snippet.category;

                const metaEl = card.querySelector(`.mention-meta-${id}`) || card.querySelector('.mention-card-meta');
                if (metaEl) {
                    const comments = snippet.commentCount || 0;
                    const votes = snippet.votes || 0;
                    const author = snippet.authorName ? ` • por ${snippet.authorName}` : '';
                    let metaHtml = `<span class="meta-item"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg> ${comments} ${comments === 1 ? 'comentário' : 'comentários'}</span>`;
                    if (votes > 0) {
                        metaHtml += `<span class="meta-item"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg> ${votes} ${votes === 1 ? 'apoio' : 'apoios'}</span>`;
                    }
                    if (author) {
                        metaHtml += `<span class="meta-item" style="color:#64748B;">${author}</span>`;
                    }
                    metaEl.innerHTML = metaHtml;
                }
            });

            const pills = [];
            if (container.classList && container.classList.contains('forum-mention-pill') && container.dataset.postId == id) {
                pills.push(container);
            }
            container.querySelectorAll(`.forum-mention-pill[data-post-id="${id}"]`).forEach(p => pills.push(p));
            pills.forEach(pill => {
                if (!snippet.notFound && snippet.title) {
                    const pillText = pill.querySelector(`.mention-pill-${id}`) || pill.querySelector('.mention-pill-text');
                    if (pillText) {
                        pillText.textContent = `${snippet.title}`;
                    }
                    pill.title = `Abrir discussão #${id}: ${snippet.title}`;
                } else if (snippet.notFound) {
                    const pillText = pill.querySelector(`.mention-pill-${id}`) || pill.querySelector('.mention-pill-text');
                    if (pillText) {
                        pillText.textContent = `Discussão #${id} (indisponível)`;
                    }
                    pill.title = `Discussão #${id} não encontrada ou removida`;
                }
            });
        }

        // --- Extrator Robusto de IDs de Tópicos do Fórum em Textos ---
        function extractForumPostIds(text) {
            if (!text || typeof text !== 'string') return [];
            const cleanText = text.replace(/&amp;/g, '&');
            const ids = [];
            const seen = new Set();
            
            // 1. Matches URLs ou query strings contendo postId=123 ou post=123
            const paramRegex = /(?:[?&#]|(?:^|\s))(?:postId|post)=(\d+)\b/gi;
            let match;
            while ((match = paramRegex.exec(cleanText)) !== null) {
                const id = parseInt(match[1], 10);
                if (id && !seen.has(id)) {
                    seen.add(id);
                    ids.push(id);
                }
            }
            
            // 2. Matches rotas de post como /posts/502 ou /forum/502 ou /api/forum/posts/502 ou /topico/502
            const pathRegex = /(?:\/posts\/|\/forum\/|\/topico\/)(\d+)\b/gi;
            while ((match = pathRegex.exec(cleanText)) !== null) {
                const id = parseInt(match[1], 10);
                if (id && !seen.has(id)) {
                    seen.add(id);
                    ids.push(id);
                }
            }

            // 3. Matches hashtags ou menções como #502, #topico502, @topico:502, #post502
            const tagRegex = /(?:^|\s|[([{"'])(?:#topico:|#topico|#post:|#post|@topico:|@post:|#)(\d+)\b/gi;
            while ((match = tagRegex.exec(cleanText)) !== null) {
                const id = parseInt(match[1], 10);
                if (id && !seen.has(id)) {
                    seen.add(id);
                    ids.push(id);
                }
            }

            return ids;
        }

        // --- Extração Confiável de Conteúdo de Inputs Ricos (Contenteditable) ---
        function extractCommentText(editor) {
            if (!editor) return '';
            if (editor.isContentEditable || editor.getAttribute('contenteditable') === 'true') {
                const clone = editor.cloneNode(true);
                const pills = clone.querySelectorAll('.forum-mention-pill');
                const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'http://localhost:3001';
                pills.forEach(pill => {
                    const id = pill.dataset.postId;
                    const textNode = document.createTextNode(` ${origin}/psi/psi_dashboard.html?tab=forum&post=${id} `);
                    pill.parentNode.replaceChild(textNode, pill);
                });

                // Fallback para tags <a> nativas que não foram transformadas previamente no mobile
                const rawAnchors = clone.querySelectorAll('a:not(.forum-mention-pill)');
                rawAnchors.forEach(a => {
                    const combined = ((a.getAttribute('href') || '') + ' ' + (a.textContent || '')).replace(/&amp;/g, '&');
                    const ids = extractForumPostIds(combined);
                    if (ids.length > 0) {
                        const textNode = document.createTextNode(` ${origin}/psi/psi_dashboard.html?tab=forum&post=${ids[0]} `);
                        a.parentNode.replaceChild(textNode, a);
                    }
                });

                const brs = clone.querySelectorAll('br');
                brs.forEach(br => br.parentNode.replaceChild(document.createTextNode('\n'), br));
                const divs = clone.querySelectorAll('div, p');
                divs.forEach(d => d.appendChild(document.createTextNode('\n')));
                return (clone.textContent || '').replace(/\u00A0/g, ' ').replace(/[ \t]+/g, ' ').trim();
            }
            return (editor.value || '').trim();
        }

        // --- Editor Rico de Menção: Transforma Links do Fórum DIRETAMENTE DENTRO DO INPUT ---
        function setupRichMentionInput(editor) {
            if (!editor || editor.dataset.richSetupDone) return;
            editor.dataset.richSetupDone = 'true';
            editor.contentEditable = 'true';
            if (!editor.dataset.placeholder) {
                editor.dataset.placeholder = editor.getAttribute('placeholder') || 'Adicionar um comentário...';
            }

            function updateEmptyState() {
                const text = (editor.innerText || editor.textContent || '').replace(/\u00A0/g, ' ').trim();
                const hasPills = !!editor.querySelector('.forum-mention-pill');
                if (!text && !hasPills) {
                    if (editor.innerHTML !== '' && editor.innerHTML !== '<br>') {
                        editor.innerHTML = '';
                    }
                    editor.setAttribute('data-empty', 'true');
                } else {
                    editor.removeAttribute('data-empty');
                }
            }

            updateEmptyState();

            // Mobile auto-scroll: Quando o teclado sobe no iOS Safari, rola suavemente para o centro visível
            function scrollIntoViewOnMobile() {
                setTimeout(() => {
                    if (editor.scrollIntoViewIfNeeded) {
                        editor.scrollIntoViewIfNeeded();
                    } else {
                        editor.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 350);
            }

            function createPillElement(id) {
                const cached = (typeof window !== 'undefined' && window.forumSnippetsCache) ? window.forumSnippetsCache[id] : null;
                const hasRealTitle = cached && cached.title && !cached.notFound;
                const title = hasRealTitle ? cached.title : `#${id}`;
                const titleAttr = hasRealTitle ? `Abrir discussão #${id}: ${cached.title}` : `Abrir discussão #${id}`;

                const pill = document.createElement('a');
                pill.href = 'javascript:void(0)';
                pill.className = 'forum-mention-pill';
                pill.contentEditable = 'false';
                pill.dataset.postId = id;
                pill.title = titleAttr;
                pill.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.yeloOpenForumPost(id);
                };
                pill.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align: middle;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg> <span class="mention-pill-text mention-pill-${id}">${title}</span>`;
                return pill;
            }

            editor.addEventListener('focus', () => {
                scrollIntoViewOnMobile();
                updateEmptyState();
                transformLinksInText(true);
            });

            editor.addEventListener('click', () => {
                scrollIntoViewOnMobile();
            });

            let isTransforming = false;
            let debounceTimer = null;

            async function transformLinksInText(force = false) {
                if (isTransforming) return;

                let didTransform = false;

                // 1. Pre-pass para links <a> nativos: No iOS Safari e Chrome mobile, colar um link ou o auto-linking do WebKit insere tags <a>
                const rawAnchors = Array.from(editor.querySelectorAll('a:not(.forum-mention-pill)'));
                for (const a of rawAnchors) {
                    const combined = ((a.getAttribute('href') || '') + ' ' + (a.textContent || '')).replace(/&amp;/g, '&');
                    const ids = extractForumPostIds(combined);
                    if (ids.length > 0) {
                        const id = ids[0];
                        const pill = createPillElement(id);
                        const spaceNode = document.createTextNode('\u00A0');
                        a.parentNode.insertBefore(pill, a);
                        a.parentNode.insertBefore(spaceNode, a);
                        a.parentNode.removeChild(a);
                        didTransform = true;
                    } else {
                        // Se não for link do fórum, desfaz a tag <a> nativa para não ficar azul dentro do editor
                        const plainText = a.textContent || a.getAttribute('href') || '';
                        a.parentNode.replaceChild(document.createTextNode(plainText), a);
                    }
                }

                const text = editor.innerText || editor.textContent || '';
                if (!text || !text.trim()) {
                    if (didTransform) hydrateForumMentions(editor);
                    return;
                }

                // 2. URLs de tópicos em nós de texto puros (suporta &amp;, todos os hosts locais e rotas)
                const forumUrlRegex = force
                    ? /(?:https?:\/\/[^\s<]+)?(?:\/psi\/|psi_|\/forum\/|\/posts\/|\.html|\?tab=forum)[^\s<]*(?:[?&#]|&amp;)(?:postId|post)=(\d+)[^\s<]*/i
                    : /(?:https?:\/\/[^\s<]+)?(?:\/psi\/|psi_|\/forum\/|\/posts\/|\.html|\?tab=forum)[^\s<]*(?:[?&#]|&amp;)(?:postId|post)=(\d+)(?:[^\w]|\s|$)/i;

                const forumPathRegex = force
                    ? /(?:https?:\/\/[^\s<]+)?(?:\/posts\/|\/forum\/|\/topico\/)(\d+)\b[^\s<]*/i
                    : /(?:https?:\/\/[^\s<]+)?(?:\/posts\/|\/forum\/|\/topico\/)(\d+)(?:[^\w]|\s|$)/i;

                const cleanText = text.replace(/&amp;/g, '&');
                if (!forumUrlRegex.test(cleanText) && !forumPathRegex.test(cleanText)) {
                    if (didTransform) hydrateForumMentions(editor);
                    return;
                }

                isTransforming = true;
                try {
                    function walk(node) {
                        if (node.nodeType === Node.TEXT_NODE) {
                            const val = node.nodeValue;
                            const m = forumUrlRegex.exec(val) || forumPathRegex.exec(val);
                            if (m) {
                                const id = parseInt(m[1], 10);
                                const before = val.substring(0, m.index);
                                const after = val.substring(m.index + m[0].length);

                                const cached = (typeof window !== 'undefined' && window.forumSnippetsCache) ? window.forumSnippetsCache[id] : null;
                                if (cached && cached.notFound) {
                                    return false;
                                }

                                const pill = createPillElement(id);
                                const parent = node.parentNode;
                                if (before) parent.insertBefore(document.createTextNode(before), node);
                                parent.insertBefore(pill, node);
                                const spaceNode = document.createTextNode('\u00A0');
                                parent.insertBefore(spaceNode, node);
                                if (after) parent.insertBefore(document.createTextNode(after), node);
                                parent.removeChild(node);

                                // Reposiciona o cursor após o espaço de forma segura
                                const sel = window.getSelection();
                                if (sel) {
                                    try {
                                        const range = document.createRange();
                                        range.setStartAfter(spaceNode);
                                        range.collapse(true);
                                        sel.removeAllRanges();
                                        sel.addRange(range);
                                    } catch (e) {}
                                }
                                return true;
                            }
                        } else if (node.nodeType === Node.ELEMENT_NODE && !node.classList.contains('forum-mention-pill')) {
                            for (const child of Array.from(node.childNodes)) {
                                if (walk(child)) return true;
                            }
                        }
                        return false;
                    }

                    let count = 0;
                    while (walk(editor) && count < 10) {
                        count++;
                        didTransform = true;
                    }

                    if (didTransform) {
                        hydrateForumMentions(editor);
                    }
                } finally {
                    isTransforming = false;
                }
            }

            editor.transformLinks = () => transformLinksInText(true);

            editor.addEventListener('beforeinput', (e) => {
                editor.removeAttribute('data-empty');
                if (e && (e.inputType === 'insertFromPaste' || e.inputType === 'insertFromDrop')) {
                    setTimeout(() => {
                        transformLinksInText(true);
                    }, 50);
                }
            });

            editor.addEventListener('input', () => {
                updateEmptyState();
                // Conversão ao vivo inteligente com debounce para mobile (iOS/Android) e desktop
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    transformLinksInText(true);
                }, 200);
            });

            editor.addEventListener('paste', (e) => {
                editor.removeAttribute('data-empty');
                const clip = e.clipboardData || window.clipboardData;
                let text = clip ? clip.getData('text/plain') : '';
                
                // Fallback para text/html se text/plain vier vazio
                if (!text && clip) {
                    const html = clip.getData('text/html');
                    if (html) {
                        const temp = document.createElement('div');
                        temp.innerHTML = html;
                        text = temp.textContent || temp.innerText || '';
                    }
                }

                if (text) {
                    e.preventDefault();
                    // Inserção síncrona segura no ponto do cursor (compatível com iOS Safari sem perder contexto de usuário)
                    const sel = window.getSelection();
                    if (sel && sel.rangeCount > 0) {
                        const range = sel.getRangeAt(0);
                        range.deleteContents();
                        const textNode = document.createTextNode(text);
                        range.insertNode(textNode);
                        range.setStartAfter(textNode);
                        range.collapse(true);
                        sel.removeAllRanges();
                        sel.addRange(range);
                    } else {
                        document.execCommand('insertText', false, text);
                    }
                }

                // Dispara transformação imediata forçada logo após a colagem
                setTimeout(() => {
                    transformLinksInText(true);
                }, 30);
            });

            editor.addEventListener('keyup', (e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                    transformLinksInText(false);
                }
            });

            editor.addEventListener('blur', () => {
                updateEmptyState();
                transformLinksInText(true);
            });
        }

        // --- Prévia em Tempo Real (Live Preview) ao Colar/Digitar Links no Composer ---
        function setupLiveLinkPreview(textarea, container) {
            if (!textarea || !container) return;

            let debounceTimer = null;
            let currentPreviewedId = null;

            async function checkTextForPostLinks() {
                const text = textarea.value || '';
                const postIds = extractForumPostIds(text);

                if (postIds.length === 0) {
                    container.innerHTML = '';
                    currentPreviewedId = null;
                    return;
                }

                const targetId = postIds[0];

                // Se já temos a caixa de prévia aberta para este ID, atualiza apenas o texto ao vivo
                const existingPreviewBody = container.querySelector('.comment-body.yt-text');
                if (currentPreviewedId === targetId && existingPreviewBody) {
                    existingPreviewBody.innerHTML = window.formatTextContent(text);
                    return;
                }

                currentPreviewedId = targetId;

                // Carrega snippet da discussão se não estiver em cache
                if (!window.forumSnippetsCache[targetId]) {
                    container.innerHTML = `
                        <div class="forum-comment-live-preview-box" style="margin: 8px 0 12px 0;">
                            <div style="font-size: 0.72rem; color: #1B4332; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between;">
                                <span style="display: flex; align-items: center; gap: 5px;">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                    Prévia do comentário
                                </span>
                            </div>
                            <div class="yt-comment-text-container" style="background: #ffffff; border: 1px solid #E2E8F0; border-radius: 12px; padding: 10px 14px;">
                                <div class="comment-body yt-text" style="color: #64748B;">Carregando dados da discussão vinculada...</div>
                            </div>
                        </div>
                    `;

                    try {
                        const res = await apiFetch(`${API_BASE_URL}/api/forum/posts/${targetId}/snippet`);
                        if (res.ok) {
                            window.forumSnippetsCache[targetId] = await res.json();
                        } else {
                            window.forumSnippetsCache[targetId] = { notFound: true };
                        }
                    } catch (e) {
                        window.forumSnippetsCache[targetId] = { notFound: true };
                    }
                }

                if (currentPreviewedId !== targetId) return;

                // Renderiza exatamente a estrutura do comentário com o pill formatado
                container.innerHTML = `
                    <div class="forum-comment-live-preview-box" style="margin: 8px 0 12px 0;">
                        <div style="font-size: 0.72rem; color: #1B4332; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between;">
                            <span style="display: flex; align-items: center; gap: 5px;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                Prévia de exibição do seu comentário:
                            </span>
                            <button type="button" class="preview-box-close" style="background:none; border:none; color:#94a3b8; font-size:1.1rem; cursor:pointer; line-height:1;" title="Fechar prévia">&times;</button>
                        </div>
                        <div class="yt-comment-text-container" style="background: #ffffff; border: 1px solid #E2E8F0; border-radius: 12px; padding: 10px 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                            <div class="comment-body yt-text">${window.formatTextContent(textarea.value)}</div>
                            <button class="yt-read-more hidden">Ler mais</button>
                        </div>
                    </div>
                `;

                const btn = container.querySelector('.preview-box-close');
                if (btn) btn.onclick = () => { container.innerHTML = ''; currentPreviewedId = null; };
            }

            textarea.addEventListener('input', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(checkTextForPostLinks, 100);
            });

            textarea.addEventListener('paste', () => {
                setTimeout(checkTextForPostLinks, 20);
            });

            if (textarea.value && textarea.value.trim().length > 0) {
                setTimeout(checkTextForPostLinks, 30);
            }
        }

        function getCategoryClass(category) {
            if (!category) return '';
            const c = category.toLowerCase();
            if (c.includes('intervisão') || c.includes('casos')) return 'tag-intervisao';
            if (c.includes('burocracia') || c.includes('legislação') || c.includes('crp')) return 'tag-legislacao';
            if (c.includes('indicações') || c.includes('encaminhamentos')) return 'tag-indicacoes';
            if (c.includes('ferramentas') || c.includes('referências')) return 'tag-ferramentas';
            if (c.includes('marketing') || c.includes('carreira')) return 'tag-marketing';
            if (c.includes('café') || c.includes('off-topic')) return 'tag-offtopic';
            return '';
        }

        // --- Funções de Renderização ---
        function renderPostCard(post, targetContainer = null) {
            const container = (targetContainer instanceof HTMLElement) ? targetContainer : postsContainer;
            const card = postCardTemplate.content.cloneNode(true).firstElementChild;
            card.dataset.postId = post.id;

            const pinnedPill = card.querySelector('.post-pinned-pill');
            if (post.isPinned) {
                card.classList.add('pinned');
                if (pinnedPill) pinnedPill.classList.remove('hidden');
            } else {
                card.classList.remove('pinned');
                if (pinnedPill) pinnedPill.classList.add('hidden');
            }
            card.querySelector('.post-title').textContent = post.title;

            const catEl = card.querySelector('.post-category');
            if (catEl) {
                catEl.textContent = post.category;
                const catClass = getCategoryClass(post.category);
                if (catClass) catEl.classList.add(catClass);
            }
            const mobileCat = card.querySelector('.post-category-mobile');
            if (mobileCat) {
                mobileCat.textContent = post.category;
                const catClass = getCategoryClass(post.category);
                if (catClass) mobileCat.classList.add(catClass);
            }
            
            const authorName = post.isAnonymous ? 'Anônimo' : post.authorName;
            const authorAvatarEl = card.querySelector('.post-author-avatar');
            if (authorAvatarEl) authorAvatarEl.src = formatImageUrl(post.authorPhoto);
            
            const authorHtml = (post.isAnonymous || !post.authorSlug) 
                ? `por ${authorName}` : `por <a href="/${post.authorSlug}" target="_blank" class="author-link" title="Ver perfil público">${authorName}</a>`;
            card.querySelector('.post-author').innerHTML = authorHtml;
            if (post.isAnonymous) card.querySelector('.post-author').style.fontStyle = 'italic';

            const badgesContainer = card.querySelector('.author-badges');
            if (badgesContainer) badgesContainer.innerHTML = renderInlineAuthorBadges(post.authorBadges);

            card.querySelector('.post-time').textContent = `há ${timeSince(post.createdAt)}`;
            
            const snippetEl = card.querySelector('.post-snippet');
            if (snippetEl) {
                snippetEl.innerHTML = window.formatTextContent ? window.formatTextContent(post.content.substring(0, 120) + '...') : (sanitizeHTML(post.content.substring(0, 120)) + '...');
            }

            const votesEl = card.querySelector('.post-votes-count');
            if (votesEl) votesEl.textContent = post.votes || 0;

            const commentsCountEl = card.querySelector('.post-comments-count');
            if (commentsCountEl) {
                const count = post.commentCount || 0;
                commentsCountEl.textContent = `${count} ${count === 1 ? 'comentário' : 'comentários'}`;
            }

            card.addEventListener('click', (e) => {
                if (e.target.closest('a') || e.target.closest('.forum-topic-mention-card') || e.target.closest('.forum-mention-pill')) {
                    return;
                }
                if (!e.target.closest('.support-btn') && !e.target.closest('.report-btn') && !e.target.closest('.share-btn') && !e.target.closest('.edit-btn') && !e.target.closest('.delete-btn')) {
                    loadFullPost(post.id);
                }
            });

            const fakeCommentBtn = card.querySelector('.fake-comment-btn');
            if (fakeCommentBtn) {
                fakeCommentBtn.onclick = (e) => {
                    e.stopPropagation();
                    loadFullPost(post.id);
                };
            }

            const supportBtn = card.querySelector('.support-btn');
            if (supportBtn) {
                supportBtn.dataset.postId = post.id;
                if (post.supportedByMe) supportBtn.classList.add('supported');
                supportBtn.onclick = (e) => {
                    e.stopPropagation();
                    toggleSupport(post.id, supportBtn);
                };
            }

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
            hydrateForumMentions(card);
            container.appendChild(card);
        }

        async function loadFullPost(postId) {
            currentPostId = postId;
            currentCommentsPage = 1; 
            
            feedView.classList.add('hidden');
            postView.innerHTML = '<div class="loader-wrapper"><div class="loader-spinner"></div></div>';
            postView.classList.remove('hidden');
            window.scrollTo(0, 0);

            const mobileFab = document.getElementById('forum-mobile-fab');
            if (mobileFab) mobileFab.classList.add('hidden');

            const mHeader = document.querySelector('.mobile-header');
            if (mHeader) mHeader.style.display = 'none';

            const dashboardMain = document.querySelector('.dashboard-main');
            if (dashboardMain && window.innerWidth <= 992) {
                dashboardMain.style.setProperty('padding-top', '0px', 'important');
                dashboardMain.style.setProperty('padding-left', '0px', 'important');
                dashboardMain.style.setProperty('padding-right', '0px', 'important');
            }

            try {
                const postRes = await apiFetch(`${API_BASE_URL}/api/forum/posts/${postId}`);
                if (!postRes.ok) throw new Error('Erro ao carregar post');
                const post = await postRes.json();
                currentPostData = post;
                
                const postEl = fullPostTemplate.content.cloneNode(true).firstElementChild;
                postEl.querySelector('.full-post-title').textContent = post.title;
                
                const fullCatEl = postEl.querySelector('.full-post-category');
                if (fullCatEl) {
                    fullCatEl.textContent = post.category;
                    const catClass = getCategoryClass(post.category);
                    if (catClass) fullCatEl.classList.add(catClass);
                }

                const appHeaderTitle = postEl.querySelector('.app-header-title');
                if (appHeaderTitle) appHeaderTitle.textContent = post.title;
                
                const authorAvatarEl = postEl.querySelector('.full-post-avatar');
                if (authorAvatarEl) authorAvatarEl.src = formatImageUrl(post.authorPhoto);
                
                const authorHtml = (post.isAnonymous || !post.authorSlug) 
                    ? (post.isAnonymous ? 'Anônimo' : post.authorName)
                    : `<a href="/${post.authorSlug}" target="_blank" class="author-link" title="Ver perfil público">${post.authorName}</a>`;
                postEl.querySelector('.full-post-author').innerHTML = authorHtml;
                
                const pinnedPill = postEl.querySelector('.post-pinned-pill');
                if (pinnedPill) {
                    if (post.isPinned) pinnedPill.classList.remove('hidden');
                    else pinnedPill.classList.add('hidden');
                }

                const badgesContainer = postEl.querySelector('.author-badges-full');
                if (badgesContainer) badgesContainer.innerHTML = renderInlineAuthorBadges(post.authorBadges);

                const postTimeEl = postEl.querySelector('.post-timestamp-text') || postEl.querySelector('.post-time');
                if (postTimeEl) postTimeEl.textContent = `Publicado há ${timeSince(post.createdAt)}`;

                // --- Banner de Redirecionamento Oficial (se post vinculado) ---
                const redirectBanner = postEl.querySelector('.full-post-redirect-banner');
                if (redirectBanner) {
                    if (post.redirectPost && post.redirectPost.id) {
                        redirectBanner.classList.remove('hidden');
                        redirectBanner.innerHTML = `
                            <div class="forum-official-redirect-banner">
                                <div class="redirect-banner-icon">💡</div>
                                <div class="redirect-banner-content">
                                    <strong>Aviso da Comunidade</strong>
                                    <p>Este assunto já possui um debate ativo em <em>"${sanitizeHTML(post.redirectPost.title)}"</em>. Recomendamos concentrar as respostas por lá para centralizar o conhecimento!</p>
                                </div>
                                <button type="button" class="redirect-banner-btn" onclick="window.yeloOpenForumPost(${post.redirectPost.id})">Abrir Discussão ➔</button>
                            </div>
                        `;
                    } else {
                        redirectBanner.classList.add('hidden');
                        redirectBanner.innerHTML = '';
                    }
                }

                postEl.querySelector('.full-post-content').innerHTML = window.formatTextContent(post.content);
                hydrateForumMentions(postEl);
                postEl.querySelectorAll('.post-votes-count').forEach(el => {
                    el.textContent = post.votes;
                });

                postEl.querySelector('#forum-back-to-feed-btn').onclick = () => {
                    postView.classList.add('hidden');
                    feedView.classList.remove('hidden');
                    currentPostId = null;
                    currentPostData = null;
                    const mHeader = document.querySelector('.mobile-header');
                    if (mHeader) mHeader.style.display = '';
                    const mFab = document.getElementById('forum-mobile-fab');
                    if (mFab) mFab.classList.remove('hidden');
                    const dashboardMain = document.querySelector('.dashboard-main');
                    if (dashboardMain && window.innerWidth <= 992) {
                        dashboardMain.style.paddingTop = ''; 
                        dashboardMain.style.paddingLeft = ''; 
                        dashboardMain.style.paddingRight = ''; 
                    }
                };

                postEl.querySelectorAll('.support-btn').forEach(supportBtn => {
                    supportBtn.dataset.postId = post.id;
                    if (post.supportedByMe) supportBtn.classList.add('supported');
                    supportBtn.onclick = (e) => {
                        e.stopPropagation();
                        toggleSupport(post.id, supportBtn);
                    };
                });

                postEl.querySelectorAll('.share-btn-full').forEach(shareBtnFull => {
                    shareBtnFull.onclick = () => copyPostLink(post.id, post.title);
                });
                
                const reportBtnFull = postEl.querySelector('.report-btn');
                const editBtnFull = postEl.querySelector('.edit-btn-full');
                const deleteBtnFull = postEl.querySelector('.delete-btn-full');
                const redirectBtnFull = postEl.querySelector('.redirect-btn-full');

                const adminPsiData = typeof window.getPsychologistData === 'function' ? window.getPsychologistData() : null;
                const isUserAdmin = adminPsiData && (
                    adminPsiData.isAdmin === true || 
                    adminPsiData.email === 'pix@yelopsi.com.br' || 
                    adminPsiData.email === 'pix@yeloposi.com.br'
                );

                if (post.isMine) {
                    if (reportBtnFull) reportBtnFull.style.display = 'none';
                    if (editBtnFull) { editBtnFull.classList.remove('hidden'); editBtnFull.onclick = () => openEditPostModal(post); }
                    if (deleteBtnFull) { deleteBtnFull.classList.remove('hidden'); deleteBtnFull.title = 'Excluir Post'; deleteBtnFull.onclick = () => deletePost(post.id, true); }
                } else {
                    if (reportBtnFull) { reportBtnFull.style.display = 'inline-block'; reportBtnFull.onclick = () => reportContent('post', post.id); }
                    if (editBtnFull) editBtnFull.classList.add('hidden');
                    if (deleteBtnFull) {
                        if (isUserAdmin) {
                            deleteBtnFull.classList.remove('hidden');
                            deleteBtnFull.title = 'Moderar / Excluir Post (Admin)';
                            deleteBtnFull.onclick = () => deletePost(post.id, true);
                        } else {
                            deleteBtnFull.classList.add('hidden');
                        }
                    }
                }

                // Permite vincular/redirecionar para o próprio autor do post ou administrador
                if (redirectBtnFull) {
                    if (post.isMine || isUserAdmin) {
                        redirectBtnFull.classList.remove('hidden');
                        redirectBtnFull.onclick = () => openRedirectModal(post);
                    } else {
                        redirectBtnFull.classList.add('hidden');
                    }
                }

                const commentForm = postEl.querySelector('#comment-form');
                if (commentForm) {
                    if (post.redirectPost && post.redirectPost.id) {
                        commentForm.innerHTML = `
                            <div style="background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 14px; padding: 18px 20px; text-align: center; margin: 15px 0;">
                                <span style="font-size: 1.5rem; display: block; margin-bottom: 6px;">🔒</span>
                                <p style="color: #475569; font-weight: 700; font-size: 0.92rem; margin: 0 0 6px;">Discussão Encerrada / Redirecionada</p>
                                <p style="color: #64748b; font-size: 0.84rem; margin: 0 0 12px; max-width: 480px; margin-left: auto; margin-right: auto;">Este debate foi unificado com o tópico oficial para concentrar as respostas da comunidade. Novos comentários devem ser feitos na discussão principal:</p>
                                <button type="button" class="btn btn-principal" onclick="window.yeloOpenForumPost(${post.redirectPost.id})" style="padding: 8px 20px; border-radius: 50px; font-size: 0.86rem; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
                                    <span>Ir para a Discussão Principal</span>
                                    <span>➔</span>
                                </button>
                            </div>
                        `;
                    } else if (post.isClosed || post.status === 'archived' || post.status === 'closed' || post.status === 'encerrada') {
                        commentForm.innerHTML = `
                            <div style="background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 14px; padding: 18px 20px; text-align: center; margin: 15px 0;">
                                <span style="font-size: 1.5rem; display: block; margin-bottom: 6px;">🔒</span>
                                <p style="color: #475569; font-weight: 700; font-size: 0.92rem; margin: 0 0 6px;">Discussão Encerrada</p>
                                <p style="color: #64748b; font-size: 0.84rem; margin: 0; max-width: 480px; margin-left: auto; margin-right: auto;">Este debate foi encerrado para novas interações.</p>
                            </div>
                        `;
                    } else {
                        commentForm.onsubmit = handleCommentSubmit;
                    }
                }

                const mainCommentInput = postEl.querySelector('#comment-content');
                if (mainCommentInput) {
                    const isRich = mainCommentInput.classList.contains('rich-mention-input') || 
                                   mainCommentInput.getAttribute('contenteditable') === 'true' || 
                                   mainCommentInput.isContentEditable;
                    if (isRich) {
                        setupRichMentionInput(mainCommentInput);
                    } else {
                        setupAutoResizeTextarea(mainCommentInput);
                        const previewSlot = postEl.querySelector('#comment-preview-slot');
                        if (previewSlot) setupLiveLinkPreview(mainCommentInput, previewSlot);
                    }
                }

                // Lógica do botão de IA para Admins
                const btnAiComment = postEl.querySelector('#btn-generate-ai-comment');
                if (btnAiComment && isUserAdmin) {
                    btnAiComment.classList.remove('hidden');
                    btnAiComment.onclick = async () => {
                        const postTitleEl = postEl.querySelector('.full-post-title');
                        const postContentEl = postEl.querySelector('.full-post-content');
                        const commentInput = postEl.querySelector('#comment-content');
                        
                        if (!postTitleEl || !postContentEl) return;
                        
                        const postTitle = postTitleEl.textContent;
                        const postContent = postContentEl.innerText;
                        
                        // Pega os 3 primeiros comentários para dar contexto
                        const commentEls = postEl.querySelectorAll('.comment-thread .comment-body');
                        let commentsContext = '';
                        for (let i = 0; i < Math.min(3, commentEls.length); i++) {
                            commentsContext += `- ${commentEls[i].innerText}\n`;
                        }

                        btnAiComment.disabled = true;
                        const originalText = btnAiComment.innerHTML;
                        btnAiComment.innerHTML = '✨ Pensando...';

                        try {
                            const res = await apiFetch(`${API_BASE_URL}/api/forum/ai/generate-comment`, {
                                method: 'POST',
                                body: JSON.stringify({ postTitle, postContent, comments: commentsContext, authorName: post.authorName })
                            });
                            if (res.ok) {
                                const data = await res.json();
                                if (commentInput) {
                                    const isRich = commentInput.classList.contains('rich-mention-input') || 
                                                   commentInput.getAttribute('contenteditable') === 'true' || 
                                                   commentInput.isContentEditable;
                                    if (isRich) {
                                        commentInput.innerText = data.generatedText;
                                        delete commentInput.dataset.empty;
                                    } else {
                                        commentInput.value = data.generatedText;
                                        commentInput.style.height = 'auto';
                                        commentInput.style.height = commentInput.scrollHeight + 'px';
                                    }
                                }
                                showToast('Comentário gerado! Revise e publique.', 'info');
                            } else {
                                showToast('Erro ao gerar com IA.', 'error');
                            }
                        } catch (err) {
                            showToast('Erro ao gerar com IA.', 'error');
                        } finally {
                            btnAiComment.disabled = false;
                            btnAiComment.innerHTML = originalText;
                        }
                    };
                }

                const loadMoreCommentsBtn = postEl.querySelector('#btn-load-more-comments');
                loadMoreCommentsBtn.onclick = () => fetchAndRenderComments(postId, ++currentCommentsPage, true);

                postView.innerHTML = '';
                postView.appendChild(postEl);

                // Garante a inicialização do input conectado no DOM para WebKit (iOS Safari / iOS Chrome)
                const attachedCommentInput = postView.querySelector('#comment-content');
                if (attachedCommentInput && !attachedCommentInput.dataset.richSetupDone) {
                    setupRichMentionInput(attachedCommentInput);
                }

                fetchAndRenderComments(postId, 1, false);
                loadRelatedPosts(postEl.querySelector('#related-posts-container'), postId);
                loadSuggestedPosts(postEl.querySelector('#suggested-posts-container'), postId, post.category);

            } catch (err) {
                postView.innerHTML = `
                    <div style="text-align:center; padding: 50px 24px; max-width: 500px; margin: 40px auto; background: white; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
                        <div style="font-size: 3rem; margin-bottom: 12px;">🔒</div>
                        <h3 style="color:#1B4332; font-family: var(--font-titulos); font-size: 1.35rem; margin-bottom: 8px;">Esta discussão não está disponível</h3>
                        <p style="color:#64748b; font-size:0.92rem; line-height: 1.5; margin:0 auto 24px auto;">O tópico pode ter sido removido, arquivado ou ocultado pela moderação da comunidade.</p>
                        <button type="button" class="btn btn-principal" id="btn-err-back-to-feed" style="border-radius:50px; padding:10px 24px; font-weight:600; font-size:0.95rem;">Voltar ao Feed de Discussões ➔</button>
                    </div>
                `;
                const backBtn = postView.querySelector('#btn-err-back-to-feed');
                if (backBtn) {
                    backBtn.onclick = () => {
                        postView.classList.add('hidden');
                        feedView.classList.remove('hidden');
                        currentPostId = null;
                        currentPostData = null;
                        const mHeader = document.querySelector('.mobile-header');
                        if (mHeader) mHeader.style.display = '';
                    };
                }
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

                const totalCount = parseInt(res.headers.get('X-Total-Count') || '0', 10);
                const loadedCount = (page - 1) * COMMENTS_LIMIT + comments.length;
                const remaining = totalCount - loadedCount;

                if (hasMore) {
                    loadMoreBtn.style.display = 'inline-flex';
                    // Premium Button Styles
                    loadMoreBtn.className = 'btn';
                    loadMoreBtn.style.cssText = 'padding: 10px 26px; border-radius: 50px; background: linear-gradient(135deg, #f59e0b, #d97706); color: white; font-weight: 600; border: none; box-shadow: 0 4px 10px rgba(245, 158, 11, 0.3); display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s ease; cursor: pointer; font-size: 0.95rem;';
                    loadMoreBtn.onmouseover = () => { loadMoreBtn.style.transform = 'translateY(-2px)'; loadMoreBtn.style.boxShadow = '0 6px 14px rgba(245, 158, 11, 0.4)'; };
                    loadMoreBtn.onmouseout = () => { loadMoreBtn.style.transform = 'none'; loadMoreBtn.style.boxShadow = '0 4px 10px rgba(245, 158, 11, 0.3)'; };
                    
                    if (remaining > 0) {
                        loadMoreBtn.innerHTML = `Mostrar mais ${remaining} comentári${remaining > 1 ? 'os' : 'o'} <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
                    } else {
                        loadMoreBtn.innerHTML = `Carregar mais comentários <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
                    }
                    loadMoreBtn.disabled = false;
                } else {
                    loadMoreBtn.style.display = 'none';
                }

                // Destaque de comentário ao abrir via notificação
                if (window.yeloCommentToHighlight && !append) {
                    scrollToAndHighlightComment(window.yeloCommentToHighlight);
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
                const related = posts.filter(p => p.id != currentPostId).slice(0, 3);
                
                container.innerHTML = '';
                if (related.length === 0) {
                    container.innerHTML = '<p style="color:#999; font-size:0.9rem; padding:10px;">Nenhum tópico popular no momento.</p>';
                    return;
                }
                related.forEach(p => {
                    const item = document.createElement('div');
                    item.className = 'sidebar-popular-item';
                    item.innerHTML = `
                        <div class="sidebar-popular-category">${sanitizeHTML(p.category || 'Geral')}</div>
                        <div class="sidebar-popular-title">${sanitizeHTML(p.title)}</div>
                    `;
                    item.onclick = () => {
                        if (typeof window.yeloOpenForumPost === 'function') {
                            window.yeloOpenForumPost(p.id);
                        } else {
                            carregarPostCompleto(p.id);
                        }
                    };
                    container.appendChild(item);
                });
            } catch (err) { container.innerHTML = ''; }
        }

        async function loadSuggestedPosts(container, currentPostId, currentCategory) {
            if (!container) return;
            container.innerHTML = '<div style="padding:15px; text-align:center; color:#999; font-size: 0.85rem;">Carregando sugestões...</div>';
            try {
                let posts = [];
                if (currentCategory) {
                    const catRes = await apiFetch(`${API_BASE_URL}/api/forum/posts?category=${encodeURIComponent(currentCategory)}&limit=8`);
                    if (catRes.ok) {
                        const catPosts = await catRes.json();
                        posts = catPosts.filter(p => p.id != currentPostId);
                    }
                }
                if (posts.length < 3) {
                    const allRes = await apiFetch(`${API_BASE_URL}/api/forum/posts?limit=12`);
                    if (allRes.ok) {
                        const allPosts = await allRes.json();
                        allPosts.forEach(p => {
                            if (p.id != currentPostId && !posts.some(existing => existing.id == p.id)) {
                                posts.push(p);
                            }
                        });
                    }
                }

                // Identifica os posts já exibidos no widget de populares para evitar duplicação
                const popularContainer = document.querySelector('#related-posts-container');
                const popularTitles = popularContainer 
                    ? Array.from(popularContainer.querySelectorAll('.sidebar-popular-title')).map(el => el.textContent.trim()) 
                    : [];

                const suggested = posts.filter(p => !popularTitles.includes(p.title.trim())).slice(0, 3);

                container.innerHTML = '';
                if (suggested.length === 0) {
                    container.innerHTML = '<p style="color:#94a3b8; font-size:0.85rem; padding:10px; margin:0;">Nenhuma outra sugestão no momento.</p>';
                    return;
                }
                suggested.forEach(p => {
                    const item = document.createElement('div');
                    item.className = 'sidebar-popular-item';
                    item.innerHTML = `
                        <div class="sidebar-popular-category">${sanitizeHTML(p.category || 'Geral')}</div>
                        <div class="sidebar-popular-title">${sanitizeHTML(p.title)}</div>
                    `;
                    item.onclick = () => {
                        if (typeof window.yeloOpenForumPost === 'function') {
                            window.yeloOpenForumPost(p.id);
                        } else {
                            carregarPostCompleto(p.id);
                        }
                    };
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
            if (badgesContainer) badgesContainer.innerHTML = renderInlineAuthorBadges(comment.authorBadges);

            commentEl.querySelector('.comment-time').textContent = `há ${timeSince(comment.createdAt)}`;
            commentEl.querySelector('.comment-body').innerHTML = window.formatTextContent(comment.content);
            hydrateForumMentions(commentEl);
            
            // Destaque visual de comentário fixado pelo Administrador
            const pinnedBadge = commentEl.querySelector('.comment-pinned-badge');
            if (comment.isPinned) {
                commentEl.classList.add('pinned-comment');
                if (pinnedBadge) pinnedBadge.classList.remove('hidden');
            } else {
                commentEl.classList.remove('pinned-comment');
                if (pinnedBadge) pinnedBadge.classList.add('hidden');
            }

            const likeBtn = commentEl.querySelector('.comment-like-btn');
            const likesCount = commentEl.querySelector('.comment-likes-count');
            const replyBtn = commentEl.querySelector('.comment-reply-btn');

            likesCount.textContent = comment.likes || 0;
            if (comment.likedByMe) likeBtn.classList.add('liked');

            likeBtn.onclick = () => toggleCommentLike(comment.id, likeBtn, likesCount);
            
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
                replyBtn.onclick = () => showReplyForm(comment.id, commentEl, authorName);
            }

            const aiReplyBtn = commentEl.querySelector('.comment-ai-reply-btn');
            const adminPsiData = typeof window.getPsychologistData === 'function' ? window.getPsychologistData() : null;
            if (aiReplyBtn && isCurrentDiscussionClosed()) {
                aiReplyBtn.classList.add('hidden');
            } else if (aiReplyBtn && adminPsiData && (adminPsiData.isAdmin || adminPsiData.email === 'pix@yelopsi.com.br' || adminPsiData.email === 'pix@yeloposi.com.br')) {
                aiReplyBtn.classList.remove('hidden');
                aiReplyBtn.onclick = async () => {
                    const postTitleEl = document.querySelector('.full-post-title');
                    const postContentEl = document.querySelector('.full-post-content');
                    if (!postTitleEl || !postContentEl) return;
                    
                    const postTitle = postTitleEl.textContent;
                    const postContent = postContentEl.innerText;
                    const targetComment = comment.content;

                    aiReplyBtn.disabled = true;
                    const originalText = aiReplyBtn.innerHTML;
                    aiReplyBtn.innerHTML = '⏳';

                    try {
                        const res = await apiFetch(`${API_BASE_URL}/api/forum/ai/generate-comment`, {
                            method: 'POST',
                            body: JSON.stringify({ postTitle, postContent, targetComment, authorName: comment.authorName })
                        });
                        if (res.ok) {
                            const data = await res.json();
                            showReplyForm(comment.id, commentEl);
                            setTimeout(() => {
                                const replyForm = commentEl.querySelector('#reply-form-dynamic');
                                    const replyInput = replyForm.querySelector('.rich-mention-input') || replyForm.querySelector('textarea');
                                    if (replyInput) {
                                        const isRich = replyInput.classList.contains('rich-mention-input') || 
                                                       replyInput.getAttribute('contenteditable') === 'true' || 
                                                       replyInput.isContentEditable;
                                        if (isRich) {
                                            replyInput.innerText = data.generatedText;
                                            delete replyInput.dataset.empty;
                                        } else {
                                            replyInput.value = data.generatedText;
                                            replyInput.style.height = 'auto';
                                            replyInput.style.height = replyInput.scrollHeight + 'px';
                                        }
                                        if (typeof showToast === 'function') showToast('Resposta gerada! Revise e publique.', 'info');
                                    }
                            }, 50);
                        } else {
                            if (typeof showToast === 'function') showToast('Erro ao gerar com IA.', 'error');
                        }
                    } catch (err) {
                        if (typeof showToast === 'function') showToast('Erro ao gerar com IA.', 'error');
                    } finally {
                        aiReplyBtn.disabled = false;
                        aiReplyBtn.innerHTML = originalText;
                    }
                };
            }

            // --- AÇÃO EXCLUSIVA DO ADMINISTRADOR: FIXAR COMENTÁRIO NO TOPO ---
            const pinBtn = commentEl.querySelector('.comment-pin-btn');
            const isUserAdmin = adminPsiData && (
                adminPsiData.isAdmin === true || 
                adminPsiData.email === 'pix@yelopsi.com.br' || 
                adminPsiData.email === 'pix@yeloposi.com.br'
            );

            if (pinBtn && isUserAdmin) {
                pinBtn.classList.remove('hidden');
                const pinBtnText = pinBtn.querySelector('.pin-btn-text');
                if (comment.isPinned) {
                    pinBtn.classList.add('is-pinned');
                    pinBtn.title = 'Desafixar comentário';
                    if (pinBtnText) pinBtnText.textContent = 'Desafixar';
                } else {
                    pinBtn.classList.remove('is-pinned');
                    pinBtn.title = 'Fixar comentário no topo';
                    if (pinBtnText) pinBtnText.textContent = 'Fixar';
                }

                pinBtn.onclick = async () => {
                    pinBtn.disabled = true;
                    try {
                        const targetState = !comment.isPinned;
                        const res = await apiFetch(`${API_BASE_URL}/api/forum/comments/${comment.id}/pin`, {
                            method: 'PUT',
                            body: JSON.stringify({ isPinned: targetState })
                        });
                        if (res.ok) {
                            const data = await res.json();
                            if (typeof showToast === 'function') {
                                showToast(data.message || (targetState ? 'Comentário fixado no topo!' : 'Comentário desafixado.'), 'sucesso');
                            }
                            // Recarrega lista de comentários para reordenar instantaneamente
                            if (currentPostId) {
                                currentCommentsPage = 1;
                                fetchAndRenderComments(currentPostId, 1, false);
                            }
                        } else {
                            const errData = await res.json().catch(() => ({}));
                            if (typeof showToast === 'function') {
                                showToast(errData.error || 'Erro ao fixar/desafixar comentário.', 'erro');
                            }
                        }
                    } catch (err) {
                        console.error('Erro ao alternar fixação de comentário:', err);
                        if (typeof showToast === 'function') {
                            showToast('Erro ao alternar fixação do comentário.', 'erro');
                        }
                    } finally {
                        pinBtn.disabled = false;
                    }
                };
            }

            const reportBtn = commentEl.querySelector('.report-btn');
            if (reportBtn) {
                reportBtn.innerHTML = REPORT_ICON_SVG;
                reportBtn.onclick = () => reportContent('comment', comment.id);
            }

            if (comment.isMine) {
                const secondaryActions = commentEl.querySelector('.comment-secondary-actions');
                const targetContainer = secondaryActions || commentEl.querySelector('.comment-actions');

                const editBtn = document.createElement('button');
                editBtn.className = 'comment-action-pill edit-comment-btn yt-action-btn';
                if (!secondaryActions) editBtn.style.marginLeft = 'auto';
                editBtn.innerHTML = `${EDIT_ICON_SVG} <span>Editar</span>`;
                editBtn.title = 'Editar';
                
                if (isCurrentDiscussionClosed()) {
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
                } else {
                    editBtn.onclick = () => enableCommentEditing(comment, commentEl);
                }
                
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'comment-action-pill delete-comment-btn yt-action-btn';
                deleteBtn.style.color = '#dc2626';
                deleteBtn.innerHTML = `${DELETE_ICON_SVG} <span>Excluir</span>`;
                deleteBtn.title = 'Excluir';
                deleteBtn.onclick = () => deleteComment(comment.id, commentEl);

                targetContainer.appendChild(editBtn);
                targetContainer.appendChild(deleteBtn);
            }

            const totalCount = (typeof comment.totalRepliesCount === 'number') 
                ? comment.totalRepliesCount 
                : (comment.replies ? comment.replies.length : 0);

            if (comment.replies && comment.replies.length > 0) {
                const repliesWrapper = commentEl.querySelector('.yt-replies-wrapper');
                const repliesContainer = commentEl.querySelector('.comment-replies-container');
                const threadLine = commentEl.querySelector('.yt-thread-line');
                const allReplies = comment.replies;
                let shownCount = 0;
                const BATCH_SIZE = 3;

                commentEl.classList.add('has-replies');
                let threadlineStrip = commentEl.querySelector('.threadline-strip');
                if (!threadlineStrip) {
                    threadlineStrip = document.createElement('div');
                    threadlineStrip.className = 'threadline-strip cursor-pointer';
                    threadlineStrip.title = 'Clique para recolher conversa';
                    threadlineStrip.setAttribute('aria-hidden', 'true');
                    commentEl.insertBefore(threadlineStrip, commentEl.firstChild);
                }
                threadlineStrip.style.display = 'none';

                const toggleBtn = document.createElement('button');
                toggleBtn.className = 'yt-toggle-replies modern-toggle-replies-btn';
                toggleBtn.dataset.totalReplies = totalCount;
                toggleBtn.innerHTML = `${REDDIT_EXPAND_ICON_SVG} <span>${totalCount} ${totalCount > 1 ? 'outras respostas' : 'outra resposta'}</span>`;
                
                const loadMoreBtn = document.createElement('button');
                loadMoreBtn.className = 'yt-toggle-replies modern-toggle-replies-btn';
                loadMoreBtn.innerHTML = `${REDDIT_EXPAND_ICON_SVG} <span>Mostrar mais respostas</span>`;
                loadMoreBtn.style.display = 'none';

                repliesWrapper.parentNode.insertBefore(toggleBtn, repliesWrapper);
                repliesContainer.style.display = 'none';
                repliesContainer.classList.add('hidden');
                repliesWrapper.style.display = 'none';
                repliesWrapper.classList.add('hidden');

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
                    repliesContainer.appendChild(toggleBtn);
                };

                const expandThread = () => {
                    const currentTotal = parseInt(toggleBtn.dataset.totalReplies, 10) || totalCount || 1;
                    commentEl.classList.add('has-expanded-replies');
                    threadlineStrip.style.display = 'block';
                    repliesWrapper.style.display = 'block';
                    repliesWrapper.classList.remove('hidden');
                    repliesContainer.style.display = 'flex';
                    repliesContainer.classList.remove('hidden');
                    toggleBtn.innerHTML = `${REDDIT_COLLAPSE_ICON_SVG} <span>Ocultar ${currentTotal === 1 ? 'resposta' : 'respostas'}</span>`;
                    if (shownCount === 0) {
                        renderNextBatch();
                    } else {
                        repliesContainer.appendChild(toggleBtn);
                    }
                };

                const collapseThread = () => {
                    const currentTotal = parseInt(toggleBtn.dataset.totalReplies, 10) || totalCount || 1;
                    commentEl.classList.remove('has-expanded-replies');
                    threadlineStrip.style.display = 'none';
                    repliesContainer.style.display = 'none';
                    repliesContainer.classList.add('hidden');
                    repliesWrapper.style.display = 'none';
                    repliesWrapper.classList.add('hidden');
                    repliesWrapper.parentNode.insertBefore(toggleBtn, repliesWrapper);
                    toggleBtn.innerHTML = `${REDDIT_EXPAND_ICON_SVG} <span>${currentTotal} ${currentTotal === 1 ? 'outra resposta' : 'outras respostas'}</span>`;
                };

                toggleBtn.onclick = () => {
                    const isCurrentlyHidden = repliesContainer.style.display === 'none' || repliesContainer.classList.contains('hidden');
                    if (isCurrentlyHidden) expandThread();
                    else collapseThread();
                };

                threadlineStrip.onclick = () => {
                    const isCurrentlyHidden = repliesContainer.style.display === 'none' || repliesContainer.classList.contains('hidden');
                    if (isCurrentlyHidden) expandThread();
                    else collapseThread();
                };

                loadMoreBtn.onclick = (e) => { e.stopPropagation(); renderNextBatch(); };

                // Expande automaticamente se a resposta alvo (notificação) estiver nesta thread (direta ou aninhada)
                const hasDescendantReply = (list, targetId) => {
                    if (!list || !list.length) return false;
                    return list.some(r => String(r.id) === String(targetId) || hasDescendantReply(r.replies, targetId));
                };
                const hasTargetReply = window.yeloCommentToHighlight && hasDescendantReply(allReplies, window.yeloCommentToHighlight);
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

        function showReplyForm(parentId, parentElement, replyTarget = null) {
            if (isCurrentDiscussionClosed()) {
                showToast('Esta discussão está encerrada para novas respostas.', 'info');
                return;
            }
            const existingForm = document.getElementById('reply-form-dynamic');
            if (existingForm) existingForm.remove();

            const formContainer = document.createElement('div');
            formContainer.id = 'reply-form-dynamic';
            formContainer.innerHTML = `
                <form>
                    <div class="form-group">
                        <div class="comment-input-capsule rich-mention-input" contenteditable="true" data-placeholder="Escreva sua resposta..." style="max-height: 25vh; overflow-y: auto; outline: none; border: 1px solid #ccc; border-radius: 8px; padding: 10px 14px;"></div>
                    </div>
                    <div style="display: flex; justify-content: flex-end; gap: 15px; margin-top: 8px;">
                        <button type="button" class="btn-cancel-reply" style="background:none; border:none; text-decoration:underline; cursor:pointer; color:#666; font-size:0.9rem;">Cancelar</button>
                        <button type="submit" class="btn-submit-reply" style="background:none; border:none; text-decoration:underline; cursor:pointer; color:#1B4332; font-weight:bold; font-size:0.9rem;">Responder</button>
                    </div>
                </form>
            `;
            
            const repliesWrapper = parentElement.querySelector('.yt-replies-wrapper') || parentElement.querySelector('.comment-replies-container');
            repliesWrapper.parentNode.insertBefore(formContainer, repliesWrapper);
            const replyEditor = formContainer.querySelector('.rich-mention-input');
            
            let mentionTag = '';
            if (replyTarget) {
                if (typeof replyTarget === 'string') {
                    mentionTag = `@${replyTarget.split(' ')[0]} `;
                } else if (typeof replyTarget === 'object') {
                    if (replyTarget.isAnonymous) {
                        mentionTag = '';
                    } else if (replyTarget.slug) {
                        mentionTag = `@${replyTarget.slug} `;
                    } else if (replyTarget.name) {
                        mentionTag = `@${replyTarget.name.split(' ')[0]} `;
                    }
                }
            }

            if (mentionTag) {
                replyEditor.innerText = mentionTag;
                replyEditor.removeAttribute('data-empty');
            }

            setupRichMentionInput(replyEditor);
            placeCaretAtEnd(replyEditor);
            setTimeout(() => placeCaretAtEnd(replyEditor), 15);

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
                const category = document.getElementById('forum-category-select')?.value || '';
                let posts;
                
                if (page === 1 && preFetchedData) {
                    posts = await preFetchedData;
                    preFetchedData = null;
                } else {
                    const fetchLimit = POSTS_LIMIT + 1;
                    const res = await apiFetch(`${API_BASE_URL}/api/forum/posts?filter=${activeFilter}&category=${encodeURIComponent(category)}&search=${encodeURIComponent(searchTerm)}&page=${page}&limit=${fetchLimit}&pageSize=${POSTS_LIMIT}`);
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
                    if (hasMore) {
                        loadMoreBtn.style.display = 'inline-block';
                        loadMoreBtn.classList.remove('hidden');
                        loadMoreBtn.textContent = 'Mostrar mais';
                    } else {
                        loadMoreBtn.style.display = 'none';
                        loadMoreBtn.classList.add('hidden');
                    }
                }
            } catch (err) {
               if (!append) postsContainer.innerHTML = '<p style="text-align:center; padding:30px; color:#DC2626;">Erro ao carregar discussões.</p>';
            } finally {
                if (loadMoreBtn) {
                    loadMoreBtn.textContent = 'Mostrar mais';
                    loadMoreBtn.disabled = false;
                }
                if (append) isLoadingMore = false;
            }
        }

        function openDuplicateModal(matchedPost, explanation) {
            const aiModal = document.getElementById('forum-ai-duplicate-modal');
            const aiExplanation = document.getElementById('ai-duplicate-explanation');
            const aiMatchedTitle = document.getElementById('ai-matched-post-title');
            const aiMatchedCard = document.getElementById('ai-matched-post-card');
            const btnGoToTopic = document.getElementById('btn-ai-go-to-topic');
            const btnPublishAnyway = document.getElementById('btn-ai-publish-anyway');
            const btn = document.getElementById('forum-submit-post-btn');

            if (!aiModal || !matchedPost) return;

            if (aiExplanation) {
                aiExplanation.textContent = explanation || 'Identificamos que já existe uma discussão aberta com tema muito similar ao que você está escrevendo.';
            }
            if (aiMatchedTitle) {
                aiMatchedTitle.textContent = matchedPost.title || `Discussão #${matchedPost.id}`;
            }

            const navigateToMatched = () => {
                aiModal.style.display = 'none';
                createModal.style.display = 'none';
                createForm.dataset.aiChecked = '';
                loadFullPost(matchedPost.id);
            };

            if (aiMatchedCard) aiMatchedCard.onclick = navigateToMatched;
            if (btnGoToTopic) btnGoToTopic.onclick = navigateToMatched;

            if (btnPublishAnyway) {
                btnPublishAnyway.onclick = () => {
                    aiModal.style.display = 'none';
                    createForm.dataset.aiChecked = 'true';
                    if (btn) btn.click();
                };
            }

            aiModal.style.display = 'flex';
        }

        async function handlePostSubmit(e) {
            e.preventDefault();
            
            const psiData = typeof window.getPsychologistData === 'function' ? window.getPsychologistData() : null;
            if (psiData && psiData.status === 'pending') {
                if (typeof window.showToast === 'function') {
                    window.showToast("Preencha o seu CPF na aba 'Perfil Público' para ativar os seus 7 dias de teste e interagir no Fórum!", 'error');
                } else {
                    alert("Preencha o seu CPF na aba 'Perfil Público' para ativar os seus 7 dias de teste e interagir no Fórum!");
                }
                if (typeof window.loadPage === 'function') {
                    window.loadPage('psi_meu_perfil.html');
                }
                return;
            }

            const formData = new FormData(createForm);
            const rawTitle = (formData.get('title') || '').toString().trim();
            const rawContent = (formData.get('content') || '').toString().trim();
            const category = formData.get('category');
            const isAnonymous = formData.get('isAnonymous') === 'on';

            const btn = document.getElementById('forum-submit-post-btn');

            // --- CAMADA 2: DETECÇÃO DE DUPLICIDADE (IA + DETERMINÍSTICA) ANTES DE PUBLICAR ---
            if (createForm.dataset.aiChecked !== 'true' && rawTitle.length >= 5) {
                btn.disabled = true;
                const originalText = btn.textContent;
                btn.textContent = '✨ Analisando diretrizes...';

                try {
                    const aiRes = await apiFetch(`${API_BASE_URL}/api/forum/posts/check-duplicate-ai`, {
                        method: 'POST',
                        body: JSON.stringify({ title: rawTitle, content: rawContent, category })
                    });

                    if (aiRes.ok) {
                        const aiData = await aiRes.json();

                        // BLOQUEIO ESTRITO: Se for violação do Código de Ética ou Diretrizes
                        if (aiData.isProhibited) {
                            btn.disabled = false;
                            btn.textContent = originalText;
                            openEthicsBlockedModal(aiData);
                            return;
                        }

                        const matchedPost = aiData.matchedPost || (aiData.matchedPostId ? { id: aiData.matchedPostId, title: aiData.matchedPostTitle } : null);
                        if (aiData.isDuplicate && matchedPost) {
                            btn.disabled = false;
                            btn.textContent = originalText;
                            openDuplicateModal(matchedPost, aiData.explanation);
                            return;
                        }
                    }
                } catch(e) {
                    console.warn('Erro na verificação de IA semântica, prosseguindo com publicação.', e);
                } finally {
                    btn.disabled = false;
                    btn.textContent = originalText;
                }
            }

            btn.disabled = true;
            btn.textContent = 'Publicando...';
            const wasAiChecked = createForm.dataset.aiChecked === 'true';
            createForm.dataset.aiChecked = ''; // Reset para futuros envios

            const data = {
                title: sanitizeHTML(rawTitle),
                content: sanitizeHTML(rawContent),
                category: category,
                isAnonymous: isAnonymous,
                forcePublish: wasAiChecked
            };
            try {
                const res = await apiFetch(`${API_BASE_URL}/api/forum/posts`, { method: 'POST', body: JSON.stringify(data) });
                if (res.status === 422) {
                    const errData = await res.json().catch(() => ({}));
                    if (errData.error === 'ETHICS_VIOLATION' || errData.code === 'ETHICS_VIOLATION') {
                        openEthicsBlockedModal(errData);
                        return;
                    }
                }
                if (res.status === 409) {
                    const errData = await res.json().catch(() => ({}));
                    if (errData.error === 'DUPLICATE_POST') {
                        const matchedPost = errData.matchedPost || { id: errData.matchedPostId, title: errData.matchedPostTitle };
                        openDuplicateModal(matchedPost, errData.explanation);
                        return;
                    }
                }
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.message || 'Erro ao criar discussão.');
                }
                showToast('Discussão criada com sucesso!', 'success');
                
                const psiData = typeof window.getPsychologistData === 'function' ? window.getPsychologistData() : null;
                if (psiData && psiData.gamificationProgress) {
                    psiData.gamificationProgress.vozAtiva = (psiData.gamificationProgress.vozAtiva || 0) + 1;
                }
                createModal.style.display = 'none';
                const similarBox = document.getElementById('forum-similar-topics-box');
                if (similarBox) similarBox.style.display = 'none';
                createForm.reset();
                const createPreviewSlot = document.getElementById('post-create-preview-slot');
                if (createPreviewSlot) createPreviewSlot.innerHTML = '';
                if (createTextarea) createTextarea.style.height = 'auto';
                fetchAndRenderPosts();
            } catch (err) { showToast(err.message || 'Erro ao criar discussão.', 'error'); } 
            finally { btn.disabled = false; btn.textContent = 'Publicar'; }
        }

        async function handleCommentSubmit(e, parentId = null) {
            e.preventDefault();
            
            const psiData = typeof window.getPsychologistData === 'function' ? window.getPsychologistData() : null;
            if (psiData && psiData.status === 'pending') {
                if (typeof window.showToast === 'function') {
                    window.showToast("Preencha o seu CPF na aba 'Perfil Público' para ativar os seus 7 dias de teste e interagir no Fórum!", 'error');
                } else {
                    alert("Preencha o seu CPF na aba 'Perfil Público' para ativar os seus 7 dias de teste e interagir no Fórum!");
                }
                if (typeof window.loadPage === 'function') {
                    window.loadPage('psi_meu_perfil.html');
                }
                return;
            }

            const form = e.target;
            const editor = form.querySelector('.rich-mention-input') || form.querySelector('textarea');
            if (editor && typeof editor.transformLinks === 'function') {
                try { editor.transformLinks(); } catch (tfErr) {}
            }
            const checkbox = form.querySelector('input[type="checkbox"]');
            const btn = form.querySelector('button[type="submit"]');
            const content = extractCommentText(editor);
            if (!content) return;

            const originalBtnHtml = btn ? btn.innerHTML : '';
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<span style="display:inline-flex;align-items:center;gap:6px;">Enviando...</span>';
            }
            const data = { content: sanitizeHTML(content), isAnonymous: checkbox ? checkbox.checked : false, parentId: parentId };

            try {
                const res = await apiFetch(`${API_BASE_URL}/api/forum/posts/${currentPostId}/comments`, { method: 'POST', body: JSON.stringify(data) });
                if (res.status === 422) {
                    const errData = await res.json().catch(() => ({}));
                    if (errData.code === 'ETHICS_VIOLATION' || errData.error === 'ETHICS_VIOLATION' || errData.reason) {
                        try {
                            openEthicsBlockedModal(errData);
                        } catch (mErr) {
                            alert(`Publicação não permitida: ${errData.reason || errData.error || 'Violação das diretrizes éticas.'}`);
                        }
                        if (btn) {
                            btn.disabled = false;
                            btn.innerHTML = originalBtnHtml;
                        }
                        return;
                    }
                }
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.error || errData.reason || errData.message || 'Erro ao salvar comentário');
                }
                const newComment = await res.json();
                
                const psiData = typeof window.getPsychologistData === 'function' ? window.getPsychologistData() : null;
                if (psiData && psiData.gamificationProgress) {
                    psiData.gamificationProgress.vozAtiva = (psiData.gamificationProgress.vozAtiva || 0) + 1;
                }

                newComment.isMine = true; 

                if (parentId) {
                    const parentCard = document.querySelector(`.comment-card[data-comment-id="${parentId}"]`);
                    if (!parentCard) throw new Error('Comentário pai não encontrado');

                    parentCard.classList.add('has-replies');
                    parentCard.classList.add('has-expanded-replies');
                    let threadlineStrip = parentCard.querySelector('.threadline-strip');
                    if (!threadlineStrip) {
                        threadlineStrip = document.createElement('div');
                        threadlineStrip.className = 'threadline-strip cursor-pointer';
                        threadlineStrip.title = 'Clique para recolher conversa';
                        threadlineStrip.setAttribute('aria-hidden', 'true');
                        parentCard.insertBefore(threadlineStrip, parentCard.firstChild);
                    }
                    if (threadlineStrip) threadlineStrip.style.display = 'block';

                    const repliesWrapper = parentCard.querySelector(':scope > .yt-replies-wrapper');
                    const repliesContainer = repliesWrapper ? repliesWrapper.querySelector('.comment-replies-container') : null;
                    if (!repliesContainer) throw new Error('Container de respostas não encontrado');

                    // Assegura que o container esteja visível
                    repliesContainer.style.display = 'flex';
                    repliesContainer.classList.remove('hidden');
                    if (repliesWrapper) {
                        repliesWrapper.style.display = 'block';
                        repliesWrapper.classList.remove('hidden');
                    }

                    // Insere o comentário na thread
                    renderComment(newComment, repliesContainer, false);

                    // Atualiza ou cria o botão de toggle no parentCard e incrementa todos os ancestrais
                    let currCard = parentCard;
                    while (currCard) {
                        currCard.classList.add('has-replies');
                        const currWrapper = currCard.querySelector(':scope > .yt-replies-wrapper');
                        if (currWrapper) {
                            const currContainer = currWrapper.querySelector('.comment-replies-container');
                            let toggleBtn = currContainer.querySelector(':scope > .yt-toggle-replies') || currWrapper.previousElementSibling;
                            if (toggleBtn && toggleBtn.classList.contains('yt-toggle-replies')) {
                                const newTotal = (parseInt(toggleBtn.dataset.totalReplies, 10) || 0) + 1;
                                toggleBtn.dataset.totalReplies = newTotal;
                                const isOpen = currContainer && currContainer.style.display !== 'none';
                                toggleBtn.innerHTML = isOpen 
                                    ? `${REDDIT_COLLAPSE_ICON_SVG} <span>Ocultar resposta${newTotal > 1 ? 's' : ''}</span>` 
                                    : `${REDDIT_EXPAND_ICON_SVG} <span>${newTotal} ${newTotal > 1 ? 'outras respostas' : 'outra resposta'}</span>`;
                                if (isOpen && currContainer) {
                                    currContainer.appendChild(toggleBtn);
                                }
                            } else if (currCard === parentCard) {
                                // Cria o botão de toggle caso ainda não existisse respostas neste card
                                toggleBtn = document.createElement('button');
                                toggleBtn.className = 'yt-toggle-replies modern-toggle-replies-btn';
                                toggleBtn.dataset.totalReplies = 1;
                                toggleBtn.innerHTML = `${REDDIT_COLLAPSE_ICON_SVG} <span>Ocultar resposta</span>`;
                                currContainer.appendChild(toggleBtn);

                                toggleBtn.onclick = () => {
                                    const count = parseInt(toggleBtn.dataset.totalReplies, 10) || 1;
                                    const isCurrentlyHidden = currContainer.style.display === 'none' || currContainer.classList.contains('hidden');
                                    if (isCurrentlyHidden) {
                                        currWrapper.style.display = 'block';
                                        currWrapper.classList.remove('hidden');
                                        currContainer.style.display = 'flex';
                                        currContainer.classList.remove('hidden');
                                        currContainer.appendChild(toggleBtn);
                                        toggleBtn.innerHTML = `${REDDIT_COLLAPSE_ICON_SVG} <span>Ocultar resposta${count > 1 ? 's' : ''}</span>`;
                                    } else {
                                        currContainer.style.display = 'none';
                                        currContainer.classList.add('hidden');
                                        currWrapper.style.display = 'none';
                                        currWrapper.classList.add('hidden');
                                        currWrapper.parentNode.insertBefore(toggleBtn, currWrapper);
                                        toggleBtn.innerHTML = `${REDDIT_EXPAND_ICON_SVG} <span>${count} ${count > 1 ? 'outras respostas' : 'outra resposta'}</span>`;
                                    }
                                };
                            }
                        }
                    }
                } else {
                    const threadContainer = document.getElementById('comment-thread');
                    if (!threadContainer) throw new Error('Container de comentários não encontrado');
                    const emptyMsg = threadContainer.querySelector('p');
                    if (emptyMsg && emptyMsg.textContent.includes('Seja o primeiro')) {
                        emptyMsg.remove();
                    }
                    renderComment(newComment, threadContainer, true);
                }

                if (editor) {
                    const isRich = editor.classList.contains('rich-mention-input') || 
                                   editor.getAttribute('contenteditable') === 'true' || 
                                   editor.isContentEditable;
                    if (isRich) {
                        editor.innerHTML = '';
                        editor.dataset.empty = 'true';
                    } else {
                        editor.value = '';
                    }
                }
                form.reset();
                const previewSlot = form.querySelector('.forum-preview-slot') || document.getElementById('comment-preview-slot');
                if (previewSlot) previewSlot.innerHTML = '';
                if (parentId) form.parentElement.remove(); 
                
                // Atualiza contagem de comentários no card principal (Feed)
                const feedCard = document.querySelector(`.forum-post-card[data-post-id="${currentPostId}"]`);
                if (feedCard) {
                    const commentCountEl = feedCard.querySelector('.post-comments-count');
                    if (commentCountEl) {
                        const currentText = commentCountEl.textContent;
                        const match = currentText.match(/\d+/);
                        const currentCount = match ? parseInt(match[0]) : 0;
                        commentCountEl.textContent = `💬 ${currentCount + 1} Comentários`;
                    }
                }

                // Atualiza contagem de comentários na visualização detalhada do post
                const detailCountEls = document.querySelectorAll('.post-comments-count');
                detailCountEls.forEach(el => {
                    const match = el.textContent.match(/\d+/);
                    if (match) {
                        const count = parseInt(match[0], 10);
                        el.textContent = el.textContent.includes('💬') ? `💬 ${count + 1} Comentários` : `${count + 1} comentários`;
                    }
                });
                
                // Atualiza a contagem na sidebar se existir
                const relatedItem = document.querySelector(`.related-post-item[data-post-id="${currentPostId}"]`);
                if (relatedItem) {
                    const commentCountEl = relatedItem.querySelector('.related-post-comments');
                    if (commentCountEl) {
                        const currentText = commentCountEl.textContent;
                        const match = currentText.match(/\d+/);
                        const currentCount = match ? parseInt(match[0]) : 0;
                        commentCountEl.textContent = `💬 ${currentCount + 1}`;
                    }
                } 
            } catch (err) {
                console.error('Erro ao enviar comentário:', err);
                showToast(err.message || 'Erro ao enviar comentário.', 'error');
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = originalBtnHtml;
                }
            }
        }

        async function toggleSupport(postId, btnElement) {
            // Pegar o estado atualizado (baseado no botão que foi clicado)
            const isSupported = !btnElement.classList.contains('supported');
            
            // Pega os votos atuais (do botão clicado)
            const votesCountEl = btnElement.querySelector('.post-votes-count') || btnElement.parentElement.querySelector('.post-votes-count');
            const currentVotes = votesCountEl ? (parseInt(votesCountEl.textContent) || 0) : 0;
            const newVotes = isSupported ? currentVotes + 1 : currentVotes - 1;

            // Atualizar UI de todos os botões correspondentes na tela (Feed e Modal)
            const allBtns = document.querySelectorAll(`.support-btn[data-post-id="${postId}"]`);
            allBtns.forEach(btn => {
                if (isSupported) {
                    btn.classList.add('supported');
                } else {
                    btn.classList.remove('supported');
                }
                const countEl = btn.querySelector('.post-votes-count') || btn.parentElement.querySelector('.post-votes-count');
                if (countEl) countEl.textContent = newVotes;
            });

            try {
                const res = await apiFetch(`${API_BASE_URL}/api/forum/posts/${postId}/vote`, { method: 'POST' });
                const data = await res.json();
                
                // Se a API retornar o número de votos exato, atualiza a UI novamente para garantir sincronia
                if (data && data.votes !== undefined) {
                    allBtns.forEach(btn => {
                        const countEl = btn.querySelector('.post-votes-count') || btn.parentElement.querySelector('.post-votes-count');
                        if (countEl) countEl.textContent = data.votes;
                    });
                }
            } catch (err) {
                // Reverter UI em caso de erro
                allBtns.forEach(btn => {
                    if (isSupported) {
                        btn.classList.remove('supported');
                    } else {
                        btn.classList.add('supported');
                    }
                    const countEl = btn.querySelector('.post-votes-count') || btn.parentElement.querySelector('.post-votes-count');
                    if (countEl) countEl.textContent = currentVotes;
                });
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
                            currentPostData = null;
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
                        // Atualiza contadores de respostas nos cards ancestrais
                        let ancestor = element.parentElement ? element.parentElement.closest('.comment-card') : null;
                        while (ancestor) {
                            const ancWrapper = ancestor.querySelector(':scope > .yt-replies-wrapper');
                            if (ancWrapper) {
                                const toggleBtn = ancWrapper.previousElementSibling;
                                if (toggleBtn && toggleBtn.classList.contains('yt-toggle-replies')) {
                                    const count = Math.max(0, (parseInt(toggleBtn.dataset.totalReplies, 10) || 1) - 1);
                                    toggleBtn.dataset.totalReplies = count;
                                    if (count === 0) {
                                        toggleBtn.remove();
                                        const repCont = ancWrapper.querySelector('.comment-replies-container');
                                        if (repCont) repCont.style.display = 'none';
                                        const line = ancWrapper.querySelector('.yt-thread-line');
                                        if (line) line.classList.add('hidden');
                                    } else {
                                        const repCont = ancWrapper.querySelector('.comment-replies-container');
                                        const isOpen = repCont && repCont.style.display !== 'none';
                                        toggleBtn.innerHTML = isOpen 
                                            ? `${REDDIT_COLLAPSE_ICON_SVG} <span>Ocultar resposta${count > 1 ? 's' : ''}</span>` 
                                            : `${REDDIT_EXPAND_ICON_SVG} <span>${count} ${count > 1 ? 'outras respostas' : 'outra resposta'}</span>`;
                                    }
                                }
                            }
                            ancestor = ancestor.parentElement ? ancestor.parentElement.closest('.comment-card') : null;
                        }
                        element.remove();
                        // Atualiza contador de comentários no post
                        const detailCountEls = document.querySelectorAll('.post-comments-count');
                        detailCountEls.forEach(el => {
                            const match = el.textContent.match(/\d+/);
                            if (match) {
                                const count = Math.max(0, parseInt(match[0], 10) - 1);
                                el.textContent = el.textContent.includes('💬') ? `💬 ${count} Comentários` : `${count} comentários`;
                            }
                        });
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

        function openRedirectModal(post) {
            const modal = document.getElementById('forum-redirect-modal');
            if (!modal) return;

            const closeBtn = document.getElementById('forum-redirect-modal-close-btn');
            const cancelBtn = document.getElementById('btn-cancel-redirect');
            const removeBtn = document.getElementById('btn-remove-redirect');
            const searchInput = document.getElementById('redirect-search-input');
            const searchResults = document.getElementById('redirect-search-results');
            const currentInfo = document.getElementById('current-redirect-info');

            const closeModal = () => { modal.style.display = 'none'; };
            if (closeBtn) closeBtn.onclick = closeModal;
            if (cancelBtn) cancelBtn.onclick = closeModal;
            modal.onclick = (e) => { if (e.target === modal) closeModal(); };

            if (searchInput) searchInput.value = '';
            if (searchResults) {
                searchResults.innerHTML = '<p style="color:#94a3b8; font-size:0.85rem; margin:10px 0; text-align:center;">Digite ao menos 2 letras para buscar outro tópico...</p>';
            }

            if (post.redirectPost && post.redirectPost.id) {
                if (currentInfo) {
                    currentInfo.style.display = 'block';
                    currentInfo.innerHTML = `<strong>Vínculo Atual:</strong> Redirecionando para <span style="font-weight:600; color:#1B4332;">#${post.redirectPost.id} - ${sanitizeHTML(post.redirectPost.title)}</span>`;
                }
                if (removeBtn) {
                    removeBtn.style.display = 'inline-block';
                    removeBtn.onclick = async () => {
                        removeBtn.disabled = true;
                        removeBtn.textContent = 'Removendo...';
                        try {
                            const res = await apiFetch(`${API_BASE_URL}/api/forum/posts/${post.id}/redirect`, {
                                method: 'PUT',
                                body: JSON.stringify({ redirectPostId: null })
                            });
                            if (res.ok) {
                                showToast('Vínculo removido com sucesso!', 'success');
                                closeModal();
                                loadFullPost(post.id);
                            } else {
                                showToast('Erro ao remover vínculo.', 'error');
                            }
                        } catch(e) {
                            showToast('Erro ao remover vínculo.', 'error');
                        } finally {
                            removeBtn.disabled = false;
                            removeBtn.textContent = 'Remover Vínculo';
                        }
                    };
                }
            } else {
                if (currentInfo) currentInfo.style.display = 'none';
                if (removeBtn) removeBtn.style.display = 'none';
            }

            const fetchSuggestions = async (query = '') => {
                if (!searchResults) return;
                searchResults.innerHTML = '<p style="color:#64748b; font-size:0.85rem; margin:10px 0; text-align:center;">Carregando discussões...</p>';

                try {
                    const res = await apiFetch(`${API_BASE_URL}/api/forum/posts/search-similar?q=${encodeURIComponent(query)}&excludeId=${post.id}`);
                    if (!res.ok) throw new Error('Erro na busca');
                    const data = await res.json();
                    const posts = Array.isArray(data) ? data : (data.posts || []);
                    if (posts.length === 0) {
                        searchResults.innerHTML = '<p style="color:#94a3b8; font-size:0.85rem; margin:10px 0; text-align:center;">Nenhuma outra discussão encontrada.</p>';
                        return;
                    }

                    searchResults.innerHTML = '';
                    posts.forEach(p => {
                        const item = document.createElement('div');
                        item.style.cssText = 'padding: 10px 12px; background: #fff; border: 1.5px solid #e2e8f0; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; gap: 10px; transition: border-color 0.2s;';
                        item.innerHTML = `
                            <div style="flex: 1; min-width: 0;">
                                <div style="font-weight: 700; color: #1e293b; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${sanitizeHTML(p.title)}</div>
                                <div style="font-size: 0.75rem; color: #64748b;">${p.category || 'Geral'} • ${p.commentCount || 0} comentários</div>
                            </div>
                            <button type="button" class="btn btn-principal" style="padding: 6px 14px; border-radius: 50px; font-size: 0.8rem; white-space: nowrap; font-weight: 600;">Vincular</button>
                        `;
                        const linkBtn = item.querySelector('button');
                        linkBtn.onclick = async () => {
                            linkBtn.disabled = true;
                            linkBtn.textContent = 'Vinculando...';
                            try {
                                const res = await apiFetch(`${API_BASE_URL}/api/forum/posts/${post.id}/redirect`, {
                                    method: 'PUT',
                                    body: JSON.stringify({ redirectPostId: p.id })
                                });
                                if (res.ok) {
                                    showToast('Discussão vinculada com sucesso!', 'success');
                                    closeModal();
                                    loadFullPost(post.id);
                                } else {
                                    const err = await res.json().catch(() => ({}));
                                    showToast(err.error || 'Erro ao vincular discussão.', 'error');
                                }
                            } catch(e) {
                                showToast('Erro ao vincular discussão.', 'error');
                            } finally {
                                linkBtn.disabled = false;
                                linkBtn.textContent = 'Vincular';
                            }
                        };
                        searchResults.appendChild(item);
                    });
                } catch(e) {
                    searchResults.innerHTML = '<p style="color:#ef4444; font-size:0.85rem; margin:10px 0; text-align:center;">Erro ao pesquisar tópicos.</p>';
                }
            };

            let searchTimer;
            if (searchInput) {
                searchInput.oninput = () => {
                    clearTimeout(searchTimer);
                    const query = searchInput.value.trim();
                    searchTimer = setTimeout(() => {
                        fetchSuggestions(query);
                    }, 250);
                };
            }

            modal.style.display = 'flex';
            // Carrega discussões existentes imediatamente para o usuário selecionar na hora
            fetchSuggestions('');
        }

        function setupSimilarTopicsLiveSearch() {
            const titleInput = document.getElementById('post-title');
            const similarBox = document.getElementById('forum-similar-topics-box');
            const similarList = document.getElementById('similar-topics-list');
            const dismissBtn = document.getElementById('btn-dismiss-similar');

            if (!titleInput || !similarBox || !similarList) return;

            let liveDebounce;
            titleInput.addEventListener('input', () => {
                clearTimeout(liveDebounce);
                const query = titleInput.value.trim();
                if (query.length < 3) {
                    similarBox.style.display = 'none';
                    similarList.innerHTML = '';
                    return;
                }

                liveDebounce = setTimeout(async () => {
                    try {
                        const catSelect = document.getElementById('post-category');
                        const catVal = catSelect ? catSelect.value : '';
                        let url = `${API_BASE_URL}/api/forum/posts/search-similar?q=${encodeURIComponent(query)}`;
                        if (catVal) url += `&category=${encodeURIComponent(catVal)}`;

                        const res = await apiFetch(url);
                        if (!res.ok) return;
                        const data = await res.json();
                        const posts = Array.isArray(data) ? data : (data.posts || []);
                        if (posts.length === 0) {
                            similarBox.style.display = 'none';
                            similarList.innerHTML = '';
                            return;
                        }

                        similarList.innerHTML = '';
                        posts.slice(0, 3).forEach(p => {
                            const item = document.createElement('div');
                            item.className = 'similar-item';
                            const count = p.commentCount || 0;
                            const commentText = count === 1 ? '1 comentário' : `${count} comentários`;
                            const catLabel = sanitizeHTML(p.category || 'Geral');
                            const titleText = sanitizeHTML(p.title || '');
                            item.innerHTML = `
                                <div class="similar-item-top">
                                    <span class="similar-category-badge" title="Tópico / Categoria">
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                                        <span>${catLabel}</span>
                                    </span>
                                    <span class="similar-view-action">
                                        <span>Ver discussão</span>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                                    </span>
                                </div>
                                <div class="similar-item-title">${titleText}</div>
                                <div class="similar-item-bottom">
                                    <span class="similar-comments-count">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                                        <span>${commentText}</span>
                                    </span>
                                </div>
                            `;
                            item.onclick = () => {
                                createModal.style.display = 'none';
                                similarBox.style.display = 'none';
                                loadFullPost(p.id);
                            };
                            similarList.appendChild(item);
                        });
                        similarBox.style.display = 'block';
                    } catch(e) {
                        similarBox.style.display = 'none';
                    }
                }, 350);
            });

            if (dismissBtn) {
                dismissBtn.onclick = () => {
                    similarBox.style.display = 'none';
                };
            }
        }

        function openEditPostModal(post) {
            const similarBox = document.getElementById('forum-similar-topics-box');
            if (similarBox) similarBox.style.display = 'none';
            createForm.dataset.aiChecked = '';
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
                    if (res.status === 422) {
                        const errData = await res.json().catch(() => ({}));
                        if (errData.code === 'ETHICS_VIOLATION' || errData.error === 'ETHICS_VIOLATION' || errData.reason) {
                            openEthicsBlockedModal(errData);
                            return;
                        }
                    }
                    if (res.ok) {
                        showToast('Discussão atualizada!', 'success');
                        createModal.style.display = 'none';
                        createForm.reset();
                        const createPreviewSlot = document.getElementById('post-create-preview-slot');
                        if (createPreviewSlot) createPreviewSlot.innerHTML = '';
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
            if (isCurrentDiscussionClosed()) {
                showToast('Esta discussão está encerrada para edições.', 'info');
                return;
            }
            const bodyEl = commentEl.querySelector('.comment-body');
            const originalContent = comment.content;
            bodyEl.style.display = 'none';
            if (commentEl.querySelector('.edit-comment-form')) return;

            const editForm = document.createElement('div');
            editForm.className = 'edit-comment-form';
            editForm.style.marginTop = '10px';
            editForm.innerHTML = `
                <div class="rich-mention-input" contenteditable="true" style="width:100%; padding:10px 14px; border:1px solid #ccc; border-radius:8px; max-height: 25vh; overflow-y: auto; outline: none; background: #fff;">${window.formatTextContent(originalContent).replace(/class="forum-mention-pill"/g, 'class="forum-mention-pill" contenteditable="false"')}</div>
                <div style="display: flex; justify-content: flex-end; gap: 15px; margin-top: 8px;">
                    <button class="cancel-edit" style="background:none; border:none; text-decoration:underline; cursor:pointer; color:#666; font-size:0.9rem;">Cancelar</button>
                    <button class="save-edit" style="background:none; border:none; text-decoration:underline; cursor:pointer; color:#1B4332; font-weight:bold; font-size:0.9rem;">Salvar</button>
                </div>
            `;
            bodyEl.parentNode.insertBefore(editForm, bodyEl.nextSibling);
            const editEditor = editForm.querySelector('.rich-mention-input');
            setupRichMentionInput(editEditor);
            
            editForm.querySelector('.cancel-edit').onclick = () => { editForm.remove(); bodyEl.style.display = 'block'; };
            editForm.querySelector('.save-edit').onclick = async () => {
                const newContent = extractCommentText(editEditor);
                if (!newContent) return;
                try {
                    const res = await apiFetch(`${API_BASE_URL}/api/forum/comments/${comment.id}`, { method: 'PUT', body: JSON.stringify({ content: newContent }) });
                    if (res.status === 422) {
                        const errData = await res.json().catch(() => ({}));
                        if (errData.code === 'ETHICS_VIOLATION' || errData.error === 'ETHICS_VIOLATION' || errData.reason) {
                            openEthicsBlockedModal(errData);
                            return;
                        }
                    }
                    if (res.ok) {
                        const updatedComment = await res.json();
                        comment.content = updatedComment.content; 
                        bodyEl.innerHTML = window.formatTextContent(updatedComment.content); 
                        hydrateForumMentions(commentEl);
                        editForm.remove(); bodyEl.style.display = 'block';
                        showToast('Comentário atualizado.', 'success');
                    } else { showToast('Erro ao atualizar.', 'error'); }
                } catch (err) { showToast('Erro ao atualizar.', 'error'); }
            };
        }

        // --- INICIALIZAÇÃO E EVENT LISTENERS ---
        const createTextarea = createForm.querySelector('textarea[name="content"]');
        if (createTextarea) {
            setupAutoResizeTextarea(createTextarea);
            const createPreviewSlot = document.getElementById('post-create-preview-slot');
            if (createPreviewSlot) setupLiveLinkPreview(createTextarea, createPreviewSlot);
        }
                
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
            
            const openCreateModalAction = () => {
                createForm.reset();
                createForm.dataset.aiChecked = '';
                const similarBox = document.getElementById('forum-similar-topics-box');
                if (similarBox) similarBox.style.display = 'none';
                if (createTextarea) createTextarea.style.height = 'auto';
                if (catSelect && catSelect.tomselect) catSelect.tomselect.clear(true);
                const titleH3 = createModal.querySelector('h3');
                if (titleH3) titleH3.textContent = 'Criar Nova Discussão';
                const submitBtn = document.getElementById('forum-submit-post-btn');
                if (submitBtn) submitBtn.textContent = 'Publicar';
                createForm.onsubmit = handlePostSubmit;
                createModal.style.display = 'flex';
                const bNav = document.querySelector('.mobile-bottom-nav');
                if (bNav) bNav.classList.add('hidden');
                const mFab = document.getElementById('forum-mobile-fab');
                if (mFab) mFab.classList.add('hidden');
            };
            createPrompt.onclick = openCreateModalAction;

            document.querySelectorAll('.trigger-create-post').forEach(btn => {
                btn.onclick = openCreateModalAction;
            });
        } else {
            document.querySelectorAll('.trigger-create-post').forEach(btn => {
                btn.onclick = () => {
                    createForm.reset();
                    createForm.dataset.aiChecked = '';
                    const similarBox = document.getElementById('forum-similar-topics-box');
                    if (similarBox) similarBox.style.display = 'none';
                    if (createTextarea) createTextarea.style.height = 'auto';
                    if (catSelect && catSelect.tomselect) catSelect.tomselect.clear(true);
                    const titleH3 = createModal.querySelector('h3');
                    if (titleH3) titleH3.textContent = 'Criar Nova Discussão';
                    const submitBtn = document.getElementById('forum-submit-post-btn');
                    if (submitBtn) submitBtn.textContent = 'Publicar';
                    createForm.onsubmit = handlePostSubmit;
                    createModal.style.display = 'flex';
                    const bNav = document.querySelector('.mobile-bottom-nav');
                    if (bNav) bNav.classList.add('hidden');
                    const mFab = document.getElementById('forum-mobile-fab');
                    if (mFab) mFab.classList.add('hidden');
                };
            });
        }

        const closeCreateModal = () => {
            createModal.style.display = 'none';
            const similarBox = document.getElementById('forum-similar-topics-box');
            if (similarBox) similarBox.style.display = 'none';
            const bNav = document.querySelector('.mobile-bottom-nav');
            if (bNav) bNav.classList.remove('hidden');
            const mFab = document.getElementById('forum-mobile-fab');
            if (mFab && currentPostId === null) mFab.classList.remove('hidden');
        };

        closeModalBtn.onclick = closeCreateModal;
        createModal.onclick = (e) => { if (e.target === createModal) closeCreateModal(); };
        createForm.onsubmit = handlePostSubmit;
        
        const cancelForumBtn = document.getElementById('cancel-forum-modal');
        if (cancelForumBtn) cancelForumBtn.onclick = closeCreateModal;

        const toggleGuidelines = () => {
            const listEl = document.getElementById('guidelines-list-el');
            const toggleText = document.getElementById('guidelines-toggle-text');
            const toggleIcon = document.getElementById('guidelines-toggle-icon');
            const btnMobile = document.querySelector('.btn-toggle-guidelines-mobile');
            if (!listEl) return;
            const isHidden = listEl.style.display === 'none';
            if (isHidden) {
                listEl.style.display = 'flex';
                if (toggleText) toggleText.textContent = 'Ocultar regras';
                if (toggleIcon) toggleIcon.textContent = '▲';
                if (btnMobile) btnMobile.innerHTML = REDDIT_COLLAPSE_ICON_SVG;
            } else {
                listEl.style.display = 'none';
                if (toggleText) toggleText.textContent = 'Ver regras (5)';
                if (toggleIcon) toggleIcon.textContent = '▼';
                if (btnMobile) btnMobile.innerHTML = REDDIT_EXPAND_ICON_SVG;
            }
        };
        const btnToggleGuidelines = document.getElementById('btn-toggle-guidelines');
        if (btnToggleGuidelines) btnToggleGuidelines.onclick = toggleGuidelines;
        const btnToggleGuidelinesMobile = document.querySelector('.btn-toggle-guidelines-mobile');
        if (btnToggleGuidelinesMobile) btnToggleGuidelinesMobile.onclick = (e) => { e.stopPropagation(); toggleGuidelines(); };
        const headerGuidelinesMobile = document.querySelector('.guidelines-header-mobile');
        if (headerGuidelinesMobile) headerGuidelinesMobile.onclick = toggleGuidelines;

        const aiModal = document.getElementById('forum-ai-duplicate-modal');
        if (aiModal) {
            aiModal.onclick = (e) => { if (e.target === aiModal) aiModal.style.display = 'none'; };
        }

        const ethicsModal = document.getElementById('forum-ethics-blocked-modal');
        if (ethicsModal) {
            ethicsModal.onclick = (e) => { if (e.target === ethicsModal) ethicsModal.style.display = 'none'; };
            const btnEthicsClose = document.getElementById('btn-ethics-understand');
            if (btnEthicsClose) {
                btnEthicsClose.onclick = () => { ethicsModal.style.display = 'none'; };
            }
        }

        // Exportação global para navegação direta ao clicar em cards de citação/menção
        window.loadFullPost = loadFullPost;

        // Ativa a busca de tópicos semelhantes em tempo real (Camada 1)
        setupSimilarTopicsLiveSearch();

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
        
        const categoryFilter = document.getElementById('forum-category-select');
        if (categoryFilter) {
            categoryFilter.addEventListener('change', () => {
                currentPage = 1;
                fetchAndRenderPosts(1, false);
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
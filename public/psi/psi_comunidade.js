// Arquivo: psi_comunidade.js
// Módulo responsável pela Comunidade Q&A e Hub

(function() {
    window.bloquearCard = function(elementId, mensagem) {
        const card = document.getElementById(elementId);
        if (!card) return;
        if (card.querySelector('.premium-lock-overlay')) return;
        
        card.classList.add('premium-feature-container');
        Array.from(card.children).forEach(child => child.classList.add('premium-blur'));
    
        const overlay = document.createElement('div');
        overlay.className = 'premium-lock-overlay';
        overlay.innerHTML = `
            <div class="lock-icon-circle">
                <svg width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
                </svg>
            </div>
            <div class="premium-text">
                <span style="display:block; font-size:0.8rem; text-transform:uppercase; letter-spacing:1px; color:#888; margin-bottom:5px;">Recurso Premium</span>
                ${mensagem}
            </div>
            <button class="btn-unlock-feature">Desbloquear Agora</button>
        `;
    
        overlay.querySelector('button').onclick = (e) => {
            e.preventDefault(); e.stopPropagation();
            if (window.loadPage) window.loadPage('psi_assinatura.html');
        };
    
        card.appendChild(overlay);
    };
    
    window.desbloquearCard = function(elementId) {
        const card = document.getElementById(elementId);
        if (!card) return;
        card.classList.remove('premium-feature-container');
        Array.from(card.children).forEach(child => child.classList.remove('premium-blur'));
        const overlay = card.querySelector('.premium-lock-overlay');
        if (overlay) overlay.remove();
    };

    window.inicializarComunidade = function(preFetchedData = null) {
        const API_BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : 'http://localhost:3001';
        const apiFetch = window.apiFetch;
        const formatTextContent = window.formatTextContent;
        const abrirModalConfirmacaoPersonalizado = window.abrirModalConfirmacaoPersonalizado;
        const showToast = window.showToast;

        const bannerTitle = document.querySelector('.main-header h1');
        const bannerSub = document.querySelector('.subtitulo-header');
        if(bannerTitle) bannerTitle.textContent = "Comunidade";
        if(bannerSub) bannerSub.textContent = "Tire dúvidas e compartilhe conhecimento com outros profissionais.";

        const container = document.getElementById('qna-list-container');
        const paginationContainer = document.getElementById('qna-pagination');
        const searchInput = document.getElementById('forum-search-input');
        
        let allQuestions = [];
        let filteredQuestions = [];
        let currentPage = 1;
        const ITEMS_PER_PAGE = 5;
        let currentFilter = 'all';
        let currentQuestionIdToAnswer = null;
        
        if (!container) return;

        async function loadQuestions() {
            container.innerHTML = '<div class="loader-wrapper"><div class="loader-spinner"></div></div>';
            try {
                let questions;
                if (preFetchedData) {
                    questions = await preFetchedData;
                    preFetchedData = null;
                } else {
                    const res = await apiFetch(`${API_BASE_URL}/api/qna?page=1&limit=100`);
                    if (!res.ok) throw new Error('Falha ao buscar perguntas');
                    questions = await res.json();
                }

                allQuestions = questions;
                applyFiltersAndSort();
            } catch (err) {
                container.innerHTML = `<div style="text-align:center; padding:40px; color:red;">Erro ao carregar perguntas.</div>`;
            }
        }

        if (apiFetch) {
            apiFetch(`${API_BASE_URL}/api/psychologists/me/qna-unanswered-count`)
                .then(res => res.ok ? res.json() : {count: 0})
                .then(data => {
                    const alertBox = document.getElementById('qna-new-questions-alert');
                    if (data.count > 0 && alertBox) {
                        alertBox.innerHTML = `👋 Olá! Há <strong>${data.count} pergunta(s)</strong> da comunidade aguardando resposta. Responda e ganhe XP!`;
                        alertBox.style.display = 'block';
                    }
                }).catch(() => {});
        }

        if (searchInput) {
            searchInput.addEventListener('input', () => { applyFiltersAndSort(); });
        }
        
        const filterTabs = document.querySelectorAll('#qna-filter-tabs .tab-item');
        if (filterTabs) {
            filterTabs.forEach(tab => {
                tab.addEventListener('click', (e) => {
                    filterTabs.forEach(t => t.classList.remove('active'));
                    e.target.classList.add('active');
                    currentFilter = e.target.dataset.filter;
                    applyFiltersAndSort();
                });
            });
        }

        function applyFiltersAndSort() {
            const term = searchInput ? searchInput.value.toLowerCase() : '';
            
            filteredQuestions = allQuestions.filter(q => {
                const matchesSearch = (q.titulo && q.titulo.toLowerCase().includes(term)) || 
                                      (q.conteudo && q.conteudo.toLowerCase().includes(term)) ||
                                      (q.content && q.content.toLowerCase().includes(term));
                const isAnsweredByMe = q.respondedByMe === true;
                
                if (currentFilter === 'pending') return matchesSearch && !isAnsweredByMe;
                if (currentFilter === 'answered') return matchesSearch && isAnsweredByMe;
                return matchesSearch;
            });

            filteredQuestions.sort((a, b) => {
                const aAnswered = a.respondedByMe === true;
                const bAnswered = b.respondedByMe === true;
                
                if (aAnswered !== bAnswered) return aAnswered ? 1 : -1; 
                return new Date(b.createdAt) - new Date(a.createdAt);
            });

            currentPage = 1;
            renderPage();
        }

        function renderPage() {
            container.innerHTML = '';
            if (filteredQuestions.length === 0) {
                showEmptyState();
                if(paginationContainer) paginationContainer.innerHTML = '';
                return;
            }

            const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
            const pageData = filteredQuestions.slice(startIndex, startIndex + ITEMS_PER_PAGE);
            const template = document.getElementById('qna-card-template-psi');

            pageData.forEach(q => {
                const clone = template.content.cloneNode(true);
                const cardElement = clone.querySelector('.qna-card-psi') || clone.firstElementChild; 

                if(cardElement) cardElement.style.position = 'relative';

                clone.querySelector('.qna-question-title').textContent = q.titulo || q.title || 'Dúvida da Comunidade';
                
                const cardBody = clone.querySelector('.qna-card-body');
                if (cardBody) {
                    const questionText = q.conteudo || q.content || '';
                    cardBody.style.background = 'transparent';
                    cardBody.style.border = 'none';
                    cardBody.style.padding = '0';
                    cardBody.innerHTML = ''; 
                    
                    const threadWrapper = document.createElement('div');
                    threadWrapper.className = 'qna-conversation-thread';
                    
                    const qBubble = document.createElement('div');
                    qBubble.className = 'qna-bubble qna-bubble-question';
                    qBubble.innerHTML = `<p style="margin:0;">${formatTextContent ? formatTextContent(questionText) : questionText}</p>`;
                    threadWrapper.appendChild(qBubble);
                    
                    cardBody.appendChild(threadWrapper);
                } else {
                    const fallbackContent = clone.querySelector('.qna-question-content, p, .conteudo');
                    if (fallbackContent) fallbackContent.innerHTML = formatTextContent ? formatTextContent(q.conteudo || q.content || '') : (q.conteudo || q.content || '');
                }

                const dataEnvio = new Date(q.createdAt).toLocaleDateString('pt-BR');
                clone.querySelector('.qna-question-author').textContent = `Enviada em ${dataEnvio} • Paciente Anônimo`;

                const answersList = clone.querySelector('.existing-answers-list');
                const templateAnswer = document.getElementById('qna-existing-answer-template');

                if (answersList) {
                    answersList.innerHTML = '';
                    if (q.answers && q.answers.length > 0) {
                        const sortedAnswers = q.answers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                        
                        if (templateAnswer) {
                            renderSingleAnswer(sortedAnswers[0], answersList, templateAnswer);
                        }
                    } else {
                        answersList.innerHTML = '<div class="status-aguardando"><span style="margin-right:5px">⏳</span> Aguardando resposta...</div>';
                    }
                }

                const btnResponder = clone.querySelector('.btn-responder');
                const isAnsweredByMe = q.respondedByMe === true;

                if (isAnsweredByMe) {
                    if (btnResponder) btnResponder.style.display = 'none';
                    if (cardElement) {
                        cardElement.classList.add('answered');
                    }
                } else {
                    if (btnResponder) {
                        btnResponder.onclick = (e) => {
                            if (e) e.stopPropagation();
                            const modal = document.getElementById('qna-answer-modal');
                            const textarea = document.getElementById('qna-answer-textarea');
                            if (!modal || !textarea) return;
                            
                            currentQuestionIdToAnswer = q.id;
                            window.currentQnaCardEl = cardElement;
                            modal.querySelector('.modal-title').textContent = `Respondendo: ${q.titulo || q.title || 'Dúvida'}`;
                            textarea.value = '';
                            checkCharCount();
                            if (modal.parentNode !== document.body) document.body.appendChild(modal);
                            modal.style.setProperty('display', 'flex', 'important');
                        };
                    }
                    
                    const btnIgnorar = document.createElement('button');
                    btnIgnorar.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
                    btnIgnorar.title = "Ignorar esta pergunta";
                    btnIgnorar.style.cssText = "position: absolute; top: 15px; right: 15px; background: none; border: none; padding: 5px; cursor: pointer; color: #1B4332; opacity: 0.4; transition: all 0.3s ease; z-index: 2;";
                    btnIgnorar.onmouseover = () => { btnIgnorar.style.opacity = '1'; btnIgnorar.style.transform = 'scale(1.1)'; };
                    btnIgnorar.onmouseout = () => { btnIgnorar.style.opacity = '0.4'; btnIgnorar.style.transform = 'scale(1)'; };
                    
                    btnIgnorar.onclick = (e) => {
                        if (e) e.stopPropagation();
                        if (abrirModalConfirmacaoPersonalizado) {
                            abrirModalConfirmacaoPersonalizado(
                                'Ignorar Pergunta',
                                'Tem certeza que deseja ignorar esta dúvida? Ela sumirá da sua lista.',
                                async () => {
                                    try {
                                        if(cardElement) cardElement.style.opacity = '0.5'; 
                                        const res = await apiFetch(`${API_BASE_URL}/api/qna/${q.id}/ignore`, { method: 'POST' });
                                        if(res.ok) {
                                            allQuestions = allQuestions.filter(item => item.id !== q.id);
                                            applyFiltersAndSort();
                                            decrementUnansweredCount();
                                            if (showToast) showToast('Pergunta removida.', 'info');
                                        }
                                    } catch(e) {
                                        if(cardElement) cardElement.style.opacity = '1'; 
                                        if (showToast) showToast('Erro ao ignorar pergunta.', 'error');
                                    }
                                }
                            );
                        }
                    };
                    
                    if (cardElement) cardElement.appendChild(btnIgnorar);
                }

                container.appendChild(clone);
            });
            renderPagination();
        }

        function renderPagination() {
            if (!paginationContainer) return;
            paginationContainer.innerHTML = '';
            const totalPages = Math.ceil(filteredQuestions.length / ITEMS_PER_PAGE);
            if (totalPages <= 1) return;

            for (let i = 1; i <= totalPages; i++) {
                const btn = document.createElement('button');
                btn.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
                btn.textContent = i;
                btn.onclick = () => {
                    currentPage = i;
                    renderPage();
                    document.querySelector('.main-header').scrollIntoView({ behavior: 'smooth' });
                };
                paginationContainer.appendChild(btn);
            }
        }

        function renderSingleAnswer(ans, containerEl, templateElement) {
            const ansClone = templateElement.content.cloneNode(true);
            const nameEl = ansClone.querySelector('.answer-psi-name');
            const textEl = ansClone.querySelector('.answer-psi-text');
            const imgEl = ansClone.querySelector('.answer-psi-photo');

            if (nameEl) nameEl.textContent = ans.psychologist ? ans.psychologist.nome : 'Psicólogo';
            if (textEl) textEl.textContent = ans.conteudo || ans.content;
            
            if (imgEl && ans.psychologist && ans.psychologist.fotoUrl) {
                const formatImageUrl = window.formatImageUrl;
                imgEl.src = typeof formatImageUrl === 'function' ? formatImageUrl(ans.psychologist.fotoUrl) : ans.psychologist.fotoUrl;
            } else if (imgEl) {
                imgEl.src = 'https://placehold.co/40x40/1B4332/FFFFFF?text=Psi';
            }
            containerEl.appendChild(ansClone);
        }

        function checkCharCount() {
            const textarea = document.getElementById('qna-answer-textarea');
            const charCounter = document.getElementById('qna-char-counter');
            const btnSubmit = document.getElementById('qna-submit-answer');
            
            if (charCounter && textarea) {
                const len = textarea.value.length;
                charCounter.textContent = `${len}/50 caracteres`;
                if (len >= 50) {
                    charCounter.style.color = "#1B4332";
                    charCounter.style.fontWeight = "bold";
                } else {
                    charCounter.style.color = "#666";
                }
            }
            if (btnSubmit && textarea) {
                btnSubmit.disabled = textarea.value.length < 50;
            }
        }

        function showEmptyState() {
            container.innerHTML = `
                <div style="text-align:center; padding:60px 20px; color:#1B4332;">
                    <div style="font-size: 3rem; margin-bottom: 10px;">🎉</div>
                    <h3 style="font-family:'New Kansas', serif; margin-bottom: 10px;">Tudo limpo por aqui!</h3>
                    <p style="color:#666; max-width: 400px; margin: 0 auto;">
                        Nenhuma pergunta encontrada com os filtros atuais.
                    </p>
                </div>`;
        }

        function decrementUnansweredCount() {
            const alertBox = document.getElementById('qna-new-questions-alert');
            if (alertBox && alertBox.style.display !== 'none') {
                const countMatch = alertBox.innerHTML.match(/<strong>(\d+)/);
                if (countMatch && countMatch[1]) {
                    let count = parseInt(countMatch[1]) - 1;
                    if (count > 0) {
                        alertBox.innerHTML = `👋 Olá! Há <strong>${count} pergunta(s)</strong> da comunidade aguardando resposta. Responda e ganhe XP!`;
                    } else {
                        alertBox.style.display = 'none';
                    }
                }
            }
        }

        const textarea = document.getElementById('qna-answer-textarea');
        if (textarea) textarea.oninput = checkCharCount;

        const fecharModal = () => {
            const modal = document.getElementById('qna-answer-modal');
            if (modal) modal.style.setProperty('display', 'none', 'important');
        };
        
        const modal = document.getElementById('qna-answer-modal');
        if (modal) {
            const closeBtn = modal.querySelector('.modal-close');
            const cancelBtn = modal.querySelector('.modal-cancel');
            if(closeBtn) closeBtn.onclick = fecharModal;
            if(cancelBtn) cancelBtn.onclick = fecharModal;
        }

        const form = document.getElementById('qna-answer-form');
        
        // --- Lógica do botão de IA para Admins ---
        const btnAiQna = document.getElementById('btn-generate-ai-qna');
        const adminPsiData = typeof window.getPsychologistData === 'function' ? window.getPsychologistData() : null;
        if (btnAiQna && adminPsiData && (adminPsiData.isAdmin || adminPsiData.email === 'pix@yelopsi.com.br' || adminPsiData.email === 'pix@yeloposi.com.br')) {
            btnAiQna.classList.remove('hidden');
            btnAiQna.onclick = async () => {
                const q = allQuestions.find(item => item.id === currentQuestionIdToAnswer);
                if (!q) return;

                btnAiQna.disabled = true;
                const originalText = btnAiQna.innerHTML;
                btnAiQna.innerHTML = '✨ Pensando...';

                try {
                    const res = await apiFetch(`${API_BASE_URL}/api/forum/ai/generate-comment`, {
                        method: 'POST',
                        body: JSON.stringify({ postTitle: q.titulo || q.title || 'Dúvida', postContent: q.conteudo || q.content || '', comments: '', authorName: 'Anônimo' })
                    });
                    if (res.ok) {
                        const data = await res.json();
                        const textarea = document.getElementById('qna-answer-textarea');
                        textarea.value = data.generatedText;
                        textarea.style.height = 'auto';
                        textarea.style.height = textarea.scrollHeight + 'px';
                        if (typeof checkCharCount === 'function') checkCharCount();
                        if (typeof showToast === 'function') showToast('Resposta gerada! Revise e publique.', 'info');
                    } else {
                        if (typeof showToast === 'function') showToast('Erro ao gerar com IA.', 'error');
                    }
                } catch (err) {
                    if (typeof showToast === 'function') showToast('Erro ao gerar com IA.', 'error');
                } finally {
                    btnAiQna.disabled = false;
                    btnAiQna.innerHTML = originalText;
                }
            };
        }
        // ----------------------------------------

        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                const textarea = document.getElementById('qna-answer-textarea');
                const btnSubmit = document.getElementById('qna-submit-answer');
                if (!currentQuestionIdToAnswer || textarea.value.length < 50) return;

                const originalText = btnSubmit.textContent;
                btnSubmit.textContent = "Enviando...";
                btnSubmit.disabled = true;
                
                try {
                    const res = await apiFetch(`${API_BASE_URL}/api/qna/${currentQuestionIdToAnswer}/answer`, {
                        method: 'POST',
                        body: JSON.stringify({ conteudo: textarea.value })
                    });

                    if (res.ok) {
                        if (showToast) showToast('Resposta enviada com sucesso! 🌻', 'success');
                        
                        const psiData = typeof window.getPsychologistData === 'function' ? window.getPsychologistData() : null;
                        if (psiData && psiData.gamificationProgress) {
                            psiData.gamificationProgress.conselheiro = (psiData.gamificationProgress.conselheiro || 0) + 1;
                        }
                        fecharModal();
                        
                        const qIndex = allQuestions.findIndex(q => q.id === currentQuestionIdToAnswer);
                        if (qIndex !== -1) {
                            allQuestions[qIndex].respondedByMe = true;
                            allQuestions[qIndex].minhaResposta = textarea.value;
                            if (!allQuestions[qIndex].answers) allQuestions[qIndex].answers = [];
                            allQuestions[qIndex].answers.push({
                                content: textarea.value,
                                createdAt: new Date().toISOString(),
                                psychologist: { nome: localStorage.getItem('Yelo_user_name') || 'Você' }
                            });
                        }
                        
                        if (window.currentQnaCardEl) {
                            window.currentQnaCardEl.classList.add('answered');
                            
                            const answersList = window.currentQnaCardEl.querySelector('.existing-answers-list');
                            if (answersList) {
                                if (answersList.querySelector('.status-aguardando')) {
                                    answersList.innerHTML = '';
                                }
                                
                                const templateAnswer = document.getElementById('qna-existing-answer-template');
                                if (templateAnswer) {
                                    const clone = templateAnswer.content.cloneNode(true);
                                    
                                    const nameEl = clone.querySelector('.answer-psi-name');
                                    const textEl = clone.querySelector('.answer-psi-text');
                                    const imgEl = clone.querySelector('.answer-psi-photo');
                                    
                                    if (nameEl) nameEl.textContent = localStorage.getItem('Yelo_user_name') || 'Você';
                                    if (textEl) textEl.textContent = textarea.value;
                                    if (imgEl) {
                                        const fotoUrl = localStorage.getItem('Yelo_user_photo');
                                        if (fotoUrl) {
                                            imgEl.src = typeof window.formatImageUrl === 'function' ? window.formatImageUrl(fotoUrl) : fotoUrl;
                                        } else {
                                            imgEl.src = 'https://placehold.co/40x40/1B4332/FFFFFF?text=Psi';
                                        }
                                    }
                                    
                                    answersList.insertBefore(clone, answersList.firstChild);
                                }
                            }
                            
                            const btnIgnorar = window.currentQnaCardEl.querySelector('button[title="Ignorar esta pergunta"]');
                            if (btnIgnorar) btnIgnorar.remove();
                        }
                        
                        decrementUnansweredCount();
                    } else {
                        throw new Error('Falha no envio');
                    }
                } catch (error) {
                    if (showToast) showToast('Erro ao enviar resposta.', 'error');
                } finally {
                    btnSubmit.textContent = originalText;
                    if(textarea.value.length < 50) btnSubmit.disabled = true;
                }
            };
        }

        loadQuestions();
    };

    window.inicializarHubComunidade = function() {
        const API_BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : 'http://localhost:3001';
        const apiFetch = window.apiFetch;
        const psychologistData = window.getPsychologistData();

        const containerHub = document.getElementById('hub-content-to-lock');
        if (!containerHub) return;

        const planoAtual = psychologistData && psychologistData.plano ? psychologistData.plano.toUpperCase() : '';

        if (apiFetch) {
            apiFetch(`${API_BASE_URL}/api/admin/community-resources`)
                .then(async (res) => {
                    if(res.ok) {
                        const links = await res.json();
                        const btnInter = document.getElementById('btn-link-intervisao');
                        const btnBiblio = document.getElementById('btn-link-biblioteca');
                        const btnCursos = document.getElementById('btn-link-cursos');

                        if(btnInter && links.link_intervisao && links.link_intervisao.length > 5) btnInter.href = links.link_intervisao;
                        if(btnBiblio && links.link_biblioteca && links.link_biblioteca.length > 5) btnBiblio.href = links.link_biblioteca;
                        if(btnCursos && links.link_cursos && links.link_cursos.length > 5) btnCursos.href = links.link_cursos;
                    }
                })
                .catch(err => {});
        }

        if (!planoAtual || planoAtual === 'ESSENTIAL') {
            if (window.bloquearCard) {
                window.bloquearCard('hub-content-to-lock', 'Workshops e Biblioteca são exclusivos dos planos Clínico e Referência.');
            }
            
            const lockBtn = containerHub.querySelector('.btn-unlock-feature');
            if(lockBtn) {
                lockBtn.textContent = "Fazer Upgrade para Acessar";
                lockBtn.style.backgroundColor = "#1B4332";
                lockBtn.style.color = "#fff";
            }
        } else {
            if (window.desbloquearCard) {
                window.desbloquearCard('hub-content-to-lock');
            }
        }
    };
})();
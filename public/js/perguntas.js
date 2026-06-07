function initPerguntas() {

    const BASE_URL = typeof window.API_BASE_URL !== 'undefined' ? window.API_BASE_URL : 'http://localhost:3001';
    
    // Elementos
    const form = document.getElementById('anonymous-question-form');
    const container = document.getElementById('qa-container');
    const submitBtn = document.getElementById('submit-question-btn');
    const textarea = document.getElementById('question-text');
    const charCounter = document.getElementById('char-counter');
    const errorMessage = document.getElementById('char-error-message');
    const btnLoadMore = document.getElementById('btn-load-more');
    const loadMoreContainer = document.getElementById('load-more-container');

    // Variáveis de Paginação
    let allQuestions = [];
    let visibleCount = 5; // Quantas perguntas aparecem inicialmente
    const INCREMENT = 5; // Quantas aparecem ao clicar em "Ver mais"
    
    let currentDetailsAnswers = [];
    let currentDetailsVisibleCount = 0;
    const DETAILS_INCREMENT = 5;

    // 1. Carregar perguntas ao abrir
    loadQuestions();

    async function loadQuestions() {
        try {
            const timestamp = new Date().getTime(); 
            const res = await fetch(`${BASE_URL}/api/qna/public?v=${timestamp}`);
            if (!res.ok) throw new Error("Falha ao buscar");
            
            allQuestions = await res.json();
            
            // Garante ordenação por data (mais recente primeiro)
            allQuestions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            updateListDisplay();
        } catch (error) {
            if(container) container.innerHTML = `<p style="text-align:center; color:#777;">Ainda não há perguntas. Seja o primeiro!</p>`;
        }
    }

    // Função que gerencia o "Ver Mais" e fatia a lista
    function updateListDisplay() {
        if (!allQuestions || allQuestions.length === 0) {
            renderQuestions([]);
            if(loadMoreContainer) loadMoreContainer.style.display = 'none';
            return;
        }

        // Pega apenas a quantidade visível atual
        const visibleQuestions = allQuestions.slice(0, visibleCount);
        renderQuestions(visibleQuestions);

        // Controla visibilidade do botão "Ver mais"
        if (loadMoreContainer) {
            if (visibleCount >= allQuestions.length) {
                loadMoreContainer.style.display = 'none';
            } else {
                loadMoreContainer.style.display = 'block';
            }
        }
    }

    // 2. Renderizar lista
    function renderQuestions(list) {
        if(!container) return;
        container.innerHTML = '';
        
        if (!list || list.length === 0) {
            container.innerHTML = `<p style="text-align:center; color:#777;">Nenhuma pergunta encontrada.</p>`;
            return;
        }

        const templateCard = document.getElementById('qa-card-template');
        const templateAnswer = document.getElementById('qa-answer-template');

        list.forEach(q => {
            const clone = templateCard.content.cloneNode(true);
            
            clone.querySelector('.data-question-title').textContent = q.title || 'Dúvida da Comunidade';
            
            const contentEl = clone.querySelector('.data-question-content');

            // Colapsa textos de perguntas muito longas (Via JavaScript para garantir o corte perfeito)
            if (q.content && q.content.length > 200) {
                const fullText = q.content;
                const shortText = fullText.substring(0, 200) + '...';
                contentEl.textContent = shortText;

                const readMoreBtn = document.createElement('button');
                readMoreBtn.className = 'btn-read-more';
                // Style inline garante que o botão tenha estilo no Desktop, mesmo se houver conflito no CSS
                readMoreBtn.style.cssText = "background: transparent; border: 1px solid #1B4332; color: #1B4332; font-weight: 600; padding: 6px 16px; border-radius: 20px; margin-top: 5px; margin-bottom: 15px; cursor: pointer; font-size: 0.85rem; display: inline-block; transition: all 0.2s ease;";
                readMoreBtn.textContent = 'Ler mais...';
                
                let isCollapsed = true;
                readMoreBtn.onclick = () => {
                    isCollapsed = !isCollapsed;
                    contentEl.textContent = isCollapsed ? shortText : fullText;
                    readMoreBtn.textContent = isCollapsed ? 'Ler mais...' : 'Mostrar menos';
                };
                contentEl.after(readMoreBtn);
            } else {
                contentEl.textContent = q.content;
            }
            
            const patientNameEl = clone.querySelector('.data-patient-name');
        if (patientNameEl) patientNameEl.remove();

            const answersContainer = clone.querySelector('.qa-card-answers-container');
            
            if (q.answers && q.answers.length > 0) {
                // Ordena para garantir que a mais recente seja a primeira (índice 0)
                const sortedAnswers = q.answers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                
                // Renderiza a última resposta (a mais recente após o sort)
                renderSingleAnswer(sortedAnswers[0], answersContainer, templateAnswer);

                // Se houver mais respostas, esconde as antigas com botão de expandir
                if (sortedAnswers.length > 1) {
                    const btnVerMais = document.createElement('button');
                    btnVerMais.className = 'btn-read-more';
                    btnVerMais.style.cssText = "background: transparent; border: none; color: #1B4332; font-weight: 600; padding: 0; margin-top: 5px; cursor: pointer; font-size: 0.9rem; align-self: flex-end; text-decoration: underline;";
                    btnVerMais.textContent = `Ver outras ${sortedAnswers.length - 1} respostas`;
                    
                    btnVerMais.onclick = (e) => {
                        e.stopPropagation();
                        abrirDetalhesPergunta(q);
                    };
                    
                    answersContainer.appendChild(btnVerMais);
                }

            } else {
                const waiting = document.createElement('div');
                waiting.className = "status-aguardando"; 
                waiting.innerHTML = `<span style="margin-right:5px">⏳</span> Aguardando resposta de um profissional...`;
                answersContainer.appendChild(waiting);
            }
            
            const cardEl = clone.firstElementChild; 
            if (cardEl) {
                cardEl.style.cursor = 'pointer';
                cardEl.onclick = (e) => {
                    const target = e.target;
                    if (target.tagName === 'BUTTON' || (target.closest && target.closest('button'))) return;
                    if (target.tagName === 'A' || (target.closest && target.closest('a'))) return;
                    abrirDetalhesPergunta(q);
                };
            }
            
            container.appendChild(clone);
        });
    }
    
    function renderSingleAnswer(ans, containerEl, templateElement) {
        const ansClone = templateElement.content.cloneNode(true);
        const ansContentEl = ansClone.querySelector('.data-answer-content');

        if (ans.content && ans.content.length > 250) {
            const fullText = ans.content;
            const shortText = fullText.substring(0, 250) + '...';
            ansContentEl.textContent = shortText;

            const readMoreAnsBtn = document.createElement('button');
            readMoreAnsBtn.className = 'btn-read-more';
            readMoreAnsBtn.style.cssText = "background: transparent; border: 1px solid #1B4332; color: #1B4332; font-weight: 600; padding: 6px 16px; border-radius: 20px; margin-top: 5px; margin-bottom: 15px; cursor: pointer; font-size: 0.85rem; display: inline-block; transition: all 0.2s ease;";
            readMoreAnsBtn.textContent = 'Ler mais...';
            
            let isCollapsed = true;
            readMoreAnsBtn.onclick = (e) => {
                e.stopPropagation();
                isCollapsed = !isCollapsed;
                ansContentEl.textContent = isCollapsed ? shortText : fullText;
                readMoreAnsBtn.textContent = isCollapsed ? 'Ler mais...' : 'Mostrar menos';
            };
            ansContentEl.after(readMoreAnsBtn);
        } else {
            ansContentEl.textContent = ans.content;
        }
        
        if (ans.psychologist) {
            const nameEl = ansClone.querySelector('.data-psy-name');
            const img = ansClone.querySelector('.data-psy-photo');
            
            nameEl.textContent = ans.psychologist.nome;
            ansClone.querySelector('.data-psy-crp').textContent = `CRP: ${ans.psychologist.crp}`;
            
            if (ans.psychologist.fotoUrl) {
                let url = ans.psychologist.fotoUrl;
                if(!url.startsWith('http')) url = `${BASE_URL}${url}`;
                img.src = url;
            } else {
                img.src = "https://placehold.co/60x60/1B4332/FFEE8C?text=Psi";
            }

            const btnPerfil = ansClone.querySelector('.btn-ver-perfil');
            if (ans.psychologist.slug) {
                const profileUrl = `/${ans.psychologist.slug}`;
                btnPerfil.href = profileUrl;
                
                img.style.cursor = 'pointer';
                img.onclick = (e) => { e.stopPropagation(); window.location.href = profileUrl; };
                nameEl.style.cursor = 'pointer';
                nameEl.onclick = (e) => { e.stopPropagation(); window.location.href = profileUrl; };
            } else {
                btnPerfil.style.display = 'none';
            }
        }
        containerEl.appendChild(ansClone);
    }
    
    function abrirDetalhesPergunta(question) {
        let detailsView = document.getElementById('qa-details-view');
        if (!detailsView) {
            detailsView = document.createElement('div');
            detailsView.id = 'qa-details-view';
            detailsView.style.display = 'none';
            detailsView.style.animation = 'fadeIn 0.3s ease';
            
            detailsView.innerHTML = `
                <button id="btn-back-qa" style="background: transparent; border: 1px solid #1B4332; color: #1B4332; font-weight: 600; padding: 8px 16px; border-radius: 20px; margin-bottom: 20px; display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    Voltar para as perguntas
                </button>
                <div id="qa-details-question-container"></div>
                <h3 style="margin-top: 30px; margin-bottom: 15px; color: #1B4332; border-bottom: 1px solid #eee; padding-bottom: 10px;">Todas as Respostas</h3>
                <div id="qa-details-answers-list" style="display: flex; flex-direction: column; gap: 15px;"></div>
                <div style="text-align: center; margin-top: 25px; margin-bottom: 30px;">
                    <button id="btn-load-more-details" style="display: none; background: transparent; border: 1px solid #1B4332; color: #1B4332; font-weight: 600; padding: 10px 24px; border-radius: 50px; cursor: pointer; margin: 0 auto;">Carregar mais respostas</button>
                </div>
            `;
            if (container && container.parentNode) {
                container.parentNode.insertBefore(detailsView, container);
            }
            
            document.getElementById('btn-back-qa').onclick = () => {
                toggleMainView(true);
            };
            document.getElementById('btn-load-more-details').onclick = () => {
                carregarMaisRespostasDetalhes();
            };
        }

        toggleMainView(false);
        window.scrollTo(0, 0);

        const qContainer = document.getElementById('qa-details-question-container');
        qContainer.innerHTML = '';
        const templateCard = document.getElementById('qa-card-template');
        const qClone = templateCard.content.cloneNode(true);
        
        qClone.querySelector('.data-question-title').textContent = question.title || 'Dúvida da Comunidade';
        qClone.querySelector('.data-question-content').textContent = question.content;
        
        const patientNameEl = qClone.querySelector('.data-patient-name');
        if (patientNameEl) patientNameEl.remove();
        
        const ansContainer = qClone.querySelector('.qa-card-answers-container');
        if (ansContainer) ansContainer.remove();

        const cardEl = qClone.firstElementChild;
        if(cardEl) {
            cardEl.style.cursor = 'default';
        }

        qContainer.appendChild(qClone);

        currentDetailsAnswers = question.answers ? question.answers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) : [];
        currentDetailsVisibleCount = 0;
        document.getElementById('qa-details-answers-list').innerHTML = '';
        carregarMaisRespostasDetalhes();
    }
    
    function carregarMaisRespostasDetalhes() {
        const answersList = document.getElementById('qa-details-answers-list');
        const templateAnswer = document.getElementById('qa-answer-template');
        const btnLoadMoreDetails = document.getElementById('btn-load-more-details');

        if (!answersList || !templateAnswer) return;

        const nextAnswers = currentDetailsAnswers.slice(currentDetailsVisibleCount, currentDetailsVisibleCount + DETAILS_INCREMENT);
        
        nextAnswers.forEach(ans => {
            renderSingleAnswer(ans, answersList, templateAnswer);
        });

        currentDetailsVisibleCount += nextAnswers.length;

        if (btnLoadMoreDetails) {
            if (currentDetailsVisibleCount >= currentDetailsAnswers.length) {
                btnLoadMoreDetails.style.display = 'none';
            } else {
                btnLoadMoreDetails.style.display = 'inline-block';
            }
        }
    }

    function toggleMainView(showMain) {
        const elsToToggle = [
            document.getElementById('anonymous-question-form'),
            document.getElementById('qa-container'),
            document.getElementById('load-more-container')
        ];

        // Encontra elementos que são irmãos anteriores ao formulário (ex: cabeçalhos e títulos)
        const form = document.getElementById('anonymous-question-form');
        if (form && form.previousElementSibling) {
             let prev = form.previousElementSibling;
             while(prev) {
                 if (prev.id !== 'qa-details-view') elsToToggle.push(prev);
                 prev = prev.previousElementSibling;
             }
        }
        
        elsToToggle.forEach(el => {
            if (el) el.style.display = showMain ? '' : 'none';
        });

        const detailsView = document.getElementById('qa-details-view');
        if (detailsView) detailsView.style.display = showMain ? 'none' : 'block';
    }

    // 3. Enviar Pergunta
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            
            const conteudo = textarea.value.trim();
            if (conteudo.length < 50) return;

            const originalText = submitBtn.textContent;
            submitBtn.textContent = "Enviando...";
            submitBtn.disabled = true;

            try {
                const res = await fetch(`${BASE_URL}/api/qna/ask`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        conteudo: conteudo,
                        content: conteudo,
                        titulo: 'Dúvida da Comunidade',
                        title: 'Dúvida da Comunidade' 
                    })
                });

                let data = {};
                try {
                    data = await res.json();
                } catch(e) {
                    console.error("A resposta do servidor não é um JSON válido. Status:", res.status);
                }

                if (res.ok) {
                    textarea.value = '';
                    showToast("Sua pergunta foi enviada com sucesso!", "success");
                    
                    // --- LÓGICA DE "APROVAÇÃO IMEDIATA" ---
                    // Em vez de recarregar do servidor (que pode estar esperando aprovação),
                    // adicionamos a pergunta manualmente na lista local para o usuário ver agora.
                    const newQuestion = {
                        title: 'Sua Pergunta (Recente)',
                        content: conteudo,
                        createdAt: new Date().toISOString(),
                        answers: []
                    };

                    allQuestions.unshift(newQuestion); // Adiciona no topo
                    visibleCount++; // Aumenta o contador para caber a nova pergunta
                    updateListDisplay(); // Atualiza a tela
                    
                    // Scroll suave
                    setTimeout(() => {
                        const lista = document.getElementById('qa-container');
                        if (lista) {
                            const y = lista.getBoundingClientRect().top + window.scrollY - 150;
                            window.scrollTo({ top: y, behavior: 'smooth' });
                        }
                        
                        // Exibe o modal convidando para o questionário após um breve delay
                        setTimeout(mostrarModalQuestionario, 800);
                    }, 100);
                    
                    checkCharCount();
                    submitBtn.disabled = true; 
                } else {
                    showToast("Erro: " + (data.error || "Erro desconhecido"), "error");
                }
            } catch (err) {
                console.error("Erro na requisição:", err);
                showToast("Erro de conexão com o servidor.", "error");
            } finally {
                submitBtn.textContent = originalText;
                if(textarea.value.length < 50) submitBtn.disabled = true;
            }
        };
    }

    // Evento do Botão Ver Mais
    if (btnLoadMore) {
        btnLoadMore.addEventListener('click', () => {
            visibleCount += INCREMENT;
            updateListDisplay();
        });
    }

    // Contador e Botão
    function checkCharCount() {
        const len = textarea.value.length;
        if(charCounter) charCounter.textContent = `${len}/50 caracteres`;

        if (len >= 50) {
            submitBtn.disabled = false;
            if(errorMessage) errorMessage.textContent = "";
            if(charCounter) { charCounter.style.color = "#1B4332"; charCounter.style.fontWeight = "bold"; }
        } else {
            submitBtn.disabled = true;
            if (len > 0 && errorMessage) errorMessage.textContent = `Faltam ${50 - len} caracteres`;
            else if(errorMessage) errorMessage.textContent = "";
            
            if(charCounter) { charCounter.style.color = "#666"; charCounter.style.fontWeight = "normal"; }
        }
    }

    if (textarea && submitBtn) {
        checkCharCount(); 
        textarea.addEventListener('input', checkCharCount);
    }

    // --- MODAL DE CONVITE PARA O QUESTIONÁRIO ---
    function mostrarModalQuestionario() {
        const modalId = 'modal-invite-questionnaire';
        if (document.getElementById(modalId)) return; // Evita duplicatas

        const modal = document.createElement('div');
        modal.id = modalId;
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.65); display: flex; justify-content: center; align-items: center; z-index: 100000; animation: fadeIn 0.3s ease; backdrop-filter: blur(4px);';
        
        modal.innerHTML = `
            <style>
                @media (max-width: 768px) {
                    #${modalId} {
                        align-items: flex-end !important;
                    }
                    #${modalId} .invite-modal-box {
                        width: 100% !important;
                        max-width: 100% !important;
                        border-radius: 24px 24px 0 0 !important;
                        padding: 30px 20px 40px 20px !important;
                        margin: 0 !important;
                        animation: slideUpSheet 0.4s cubic-bezier(0.16, 1, 0.3, 1) !important;
                    }
                    #${modalId} .invite-modal-box::before {
                        content: ''; display: block; width: 40px; height: 5px; background: #e0e0e0; border-radius: 5px; margin: -15px auto 20px auto;
                    }
                }
                @keyframes slideUpSheet { from { transform: translateY(100%); } to { transform: translateY(0); } }
                @keyframes slideUpWelcome { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            </style>
            <div class="invite-modal-box" style="background: white; padding: 40px 30px; border-radius: 20px; width: 90%; max-width: 450px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.2); position: relative; animation: slideUpWelcome 0.4s cubic-bezier(0.16, 1, 0.3, 1);">
                <div style="font-size: 3.5rem; margin-bottom: 15px;">💛</div>
                <h3 style="color: #1B4332; margin-bottom: 15px; font-family: var(--font-titulos, 'Fraunces', serif); font-size: 1.6rem; line-height: 1.2;">Sua pergunta foi enviada!</h3>
                <p style="color: #444; line-height: 1.6; margin-bottom: 25px; font-size: 1rem; font-family: var(--font-principal, 'Inter', sans-serif);">
                    Os nossos profissionais já foram notificados e em breve responderão à sua dúvida.<br><br>
                    Enquanto isso, que tal descobrir o(a) terapeuta ideal para o seu momento atual?
                </p>
                <div style="display: flex; gap: 10px; justify-content: center; flex-direction: column;">
                    <button id="btn-invite-yes" style="background-color: #1B4332; color: white; border: none; padding: 14px 28px; border-radius: 50px; font-weight: bold; cursor: pointer; width: 100%; font-size: 1.05rem; transition: transform 0.2s, background-color 0.2s;">Encontrar meu Psicólogo</button>
                    <button id="btn-invite-no" style="background-color: transparent; color: #666; border: none; padding: 10px 28px; border-radius: 50px; font-weight: bold; cursor: pointer; width: 100%; font-size: 0.95rem; transition: transform 0.2s, color 0.2s; text-decoration: underline;">Pular por enquanto</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const closeModal = () => {
            const box = modal.querySelector('.invite-modal-box');
            if (box) {
                box.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease';
                box.style.transform = window.innerWidth <= 768 ? 'translateY(100%)' : 'translateY(30px)';
                box.style.opacity = '0';
            }
            modal.style.transition = 'opacity 0.3s ease';
            modal.style.opacity = '0';
            setTimeout(() => modal.remove(), 300);
        };

        document.getElementById('btn-invite-yes').onclick = () => { window.location.href = '/questionario'; };
        document.getElementById('btn-invite-no').onclick = closeModal;
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };
    }

    function showToast(message, type = 'success') {
        // Garante que o container exista
        let container = document.getElementById('pill-notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'pill-notification-container';
            container.style.cssText = 'position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 999999; display: flex; flex-direction: column; gap: 10px; align-items: center;';
            document.body.appendChild(container);
        }

        const pill = document.createElement('div');
        pill.className = `pill-notification ${type}`;
        pill.style.cssText = `background: ${type === 'success' ? '#1B4332' : '#dc2626'}; color: white; padding: 12px 24px; border-radius: 50px; display: flex; align-items: center; gap: 8px; font-weight: 600; box-shadow: 0 8px 20px rgba(0,0,0,0.15); font-family: sans-serif; font-size: 0.95rem;`;

        // Ícones para cada tipo
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

        /// a animação CSS cuida da entrada e saída. Apenas removemos o elemento do DOM depois.
        setTimeout(() => {
            pill.remove();
        }, 4500); // O tempo da animação é 4.5s
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPerguntas);
} else {
    initPerguntas();
}
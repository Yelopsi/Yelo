function initPerguntas() {
    console.log("Sistema de Perguntas Restaurado");

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
            console.error(error);
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
            
            const dataEnvio = new Date(q.createdAt).toLocaleDateString('pt-BR', {
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit'
            });
            clone.querySelector('.data-patient-name').textContent = `Enviada em ${dataEnvio}`;

            const answersContainer = clone.querySelector('.qa-card-answers-container');
            
            if (q.answers && q.answers.length > 0) {
                // Ordena para garantir que a mais recente seja a primeira (índice 0)
                const sortedAnswers = q.answers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                
                const renderAns = (ans, containerEl) => {
                    const ansClone = templateAnswer.content.cloneNode(true);
                    const ansContentEl = ansClone.querySelector('.data-answer-content');

                    // Colapsa textos de respostas muito longas também (Via JavaScript)
                    if (ans.content && ans.content.length > 250) {
                        const fullText = ans.content;
                        const shortText = fullText.substring(0, 250) + '...';
                        ansContentEl.textContent = shortText;

                        const readMoreAnsBtn = document.createElement('button');
                        readMoreAnsBtn.className = 'btn-read-more';
                        readMoreAnsBtn.style.cssText = "background: transparent; border: 1px solid #1B4332; color: #1B4332; font-weight: 600; padding: 6px 16px; border-radius: 20px; margin-top: 5px; margin-bottom: 15px; cursor: pointer; font-size: 0.85rem; display: inline-block; transition: all 0.2s ease;";
                        readMoreAnsBtn.textContent = 'Ler mais...';
                        
                        let isCollapsed = true;
                        readMoreAnsBtn.onclick = () => {
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
                            
                            // Navegação via foto e nome (para mobile e desktop)
                            img.style.cursor = 'pointer';
                            img.onclick = () => window.location.href = profileUrl;
                            nameEl.style.cursor = 'pointer';
                            nameEl.onclick = () => window.location.href = profileUrl;
                        } else {
                            btnPerfil.style.display = 'none';
                        }
                    }
                    containerEl.appendChild(ansClone);
                };

                // Renderiza a última resposta (a mais recente após o sort)
                renderAns(sortedAnswers[0], answersContainer);

                // Se houver mais respostas, esconde as antigas com botão de expandir
                if (sortedAnswers.length > 1) {
                    const extraContainer = document.createElement('div');
                    extraContainer.style.display = 'none';
                    extraContainer.style.flexDirection = 'column';
                    extraContainer.style.gap = '15px';
                    extraContainer.style.width = '100%';
                    
                    for (let i = 1; i < sortedAnswers.length; i++) {
                        renderAns(sortedAnswers[i], extraContainer);
                    }
                    
                    const btnVerMais = document.createElement('button');
                    btnVerMais.className = 'btn-read-more';
                    btnVerMais.style.cssText = "background: transparent; border: none; color: #1B4332; font-weight: 600; padding: 0; margin-top: 5px; cursor: pointer; font-size: 0.9rem; align-self: flex-end; text-decoration: underline;";
                    btnVerMais.textContent = `Ver outras ${sortedAnswers.length - 1} respostas`;
                    
                    btnVerMais.onclick = () => {
                        extraContainer.style.display = 'flex';
                        btnVerMais.style.display = 'none';
                    };
                    
                    answersContainer.appendChild(btnVerMais);
                    answersContainer.appendChild(extraContainer);
                }

            } else {
                const waiting = document.createElement('div');
                waiting.className = "status-aguardando"; 
                waiting.innerHTML = `<span style="margin-right:5px">⏳</span> Aguardando resposta de um profissional...`;
                answersContainer.appendChild(waiting);
            }
            container.appendChild(clone);
        });
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
                    body: JSON.stringify({ conteudo })
                });

                const data = await res.json();

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
                    }, 100);
                    
                    checkCharCount();
                    submitBtn.disabled = true; 
                } else {
                    showToast("Erro: " + (data.error || "Erro desconhecido"), "error");
                }
            } catch (err) {
                console.error(err);
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

    function showToast(message, type = 'success') {
        // Garante que o container exista
        let container = document.getElementById('pill-notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'pill-notification-container';
            document.body.appendChild(container);
        }

        const pill = document.createElement('div');
        pill.className = `pill-notification ${type}`;

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
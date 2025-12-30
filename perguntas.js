document.addEventListener('DOMContentLoaded', () => {
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
    const INCREMENT = 5;  // Quantas aparecem ao clicar em "Ver mais"

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
            clone.querySelector('.data-question-content').textContent = q.content;
            
            const dataEnvio = new Date(q.createdAt).toLocaleDateString('pt-BR', {
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit'
            });
            clone.querySelector('.data-patient-name').textContent = `Enviada em ${dataEnvio}`;

            const answersContainer = clone.querySelector('.qa-card-answers-container');
            
            if (q.answers && q.answers.length > 0) {
                q.answers.forEach(ans => {
                    const ansClone = templateAnswer.content.cloneNode(true);
                    ansClone.querySelector('.data-answer-content').textContent = ans.content;
                    
                    if (ans.psychologist) {
                        ansClone.querySelector('.data-psy-name').textContent = ans.psychologist.nome;
                        ansClone.querySelector('.data-psy-crp').textContent = `CRP: ${ans.psychologist.crp}`;
                        
                        const img = ansClone.querySelector('.data-psy-photo');
                        if (ans.psychologist.fotoUrl) {
                            let url = ans.psychologist.fotoUrl;
                            if(!url.startsWith('http')) url = `${BASE_URL}${url}`;
                            img.src = url;
                        } else {
                            img.src = "https://placehold.co/60x60/1B4332/FFEE8C?text=Psi";
                        }

                        const btnPerfil = ansClone.querySelector('.btn-ver-perfil');
                        if (ans.psychologist.slug) {
                            btnPerfil.href = `/${ans.psychologist.slug}`;
                        } else {
                            btnPerfil.style.display = 'none';
                        }
                    }
                    answersContainer.appendChild(ansClone);
                });
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
        let toast = document.getElementById('Yelo-toast');
        if (!toast) return alert(message);
        toast.textContent = message;
        toast.className = `toast toast-${type}`;
        toast.style.display = 'block';
        requestAnimationFrame(() => { toast.style.opacity = '1'; });
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => { toast.style.display = 'none'; }, 400); 
        }, 4000);
    }
});
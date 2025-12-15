// admin/admin_gestao_conteudo.js

window.initializePage = function() {
    const token = localStorage.getItem('girassol_token');
    const reviewsList = document.getElementById('pending-reviews-list');
    const loadingState = document.getElementById('reviews-loading-state');
    const emptyState = document.getElementById('reviews-empty-state');

    // Seletores para a nova seção de Q&A
    const questionsList = document.getElementById('pending-questions-list');
    const questionsLoadingState = document.getElementById('questions-loading-state');
    const questionsEmptyState = document.getElementById('questions-empty-state');

    if (!token) {
        console.error("Elementos essenciais ou token não encontrados.");
        return;
    }

    /**
     * Renderiza uma única avaliação na lista.
     * @param {object} review - O objeto da avaliação.
     */
    function renderReviewItem(review) {
        const listItem = document.createElement('li');
        listItem.setAttribute('data-review-id', review.id);

        const ratingStars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);

        listItem.innerHTML = `
            <div class="avaliacao-info">
                <span class="avaliacao-autor">${review.patient.nome} (para ${review.psychologist.nome})</span>
                <span class="avaliacao-data">${new Date(review.createdAt).toLocaleDateString('pt-BR')}</span>
            </div>
            <p class="avaliacao-texto">"${review.comment}"</p>
            <div class="avaliacao-rating">${ratingStars} (${review.rating}/5)</div>
            <div class="moderacao-acoes">
                <button class="btn-tabela btn-aprovar" data-action="approved">Aprovar</button>
                <button class="btn-tabela btn-reprovar" data-action="rejected">Rejeitar</button>
            </div>
        `;
        return listItem;
    }

    /**
     * Busca as avaliações pendentes da API e as renderiza.
     */
    async function fetchPendingReviews() {
        loadingState.style.display = 'block';
        emptyState.style.display = 'none';
        reviewsList.innerHTML = '';

        try {
            const response = await fetch('http://localhost:3001/api/admin/reviews/pending', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Falha ao buscar avaliações.');

            const reviews = await response.json();
            loadingState.style.display = 'none';
 
            if (reviews.length === 0) {
                emptyState.style.display = 'block';
            } else {
                reviews.forEach(review => {
                    reviewsList.appendChild(renderReviewItem(review));
                });
            }

        } catch (error) {
            loadingState.style.display = 'none';
            emptyState.textContent = `Erro ao carregar avaliações: ${error.message}`;
            emptyState.style.display = 'block';
        }
    }

    /**
     * Lida com o clique nos botões de moderação.
     * @param {string} reviewId - O ID da avaliação.
     * @param {string} action - 'approved' ou 'rejected'.
     */
    async function handleModeration(reviewId, action) {
        try {
            const response = await fetch(`http://localhost:3001/api/admin/reviews/${reviewId}/moderate`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: action })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error);

            // Animação de remoção e atualização da UI
            const itemToRemove = reviewsList.querySelector(`[data-review-id="${reviewId}"]`);
            if (itemToRemove) {
                itemToRemove.style.transition = 'opacity 0.5s, transform 0.5s';
                itemToRemove.style.opacity = '0';
                itemToRemove.style.transform = 'translateX(20px)';
                setTimeout(() => {
                    itemToRemove.remove();
                    if (reviewsList.children.length === 0) {
                        emptyState.style.display = 'block';
                    }
                }, 500);
            }

        } catch (error) {
            alert(`Erro ao moderar avaliação: ${error.message}`);
        }
    }

    // Adiciona um único event listener na lista para lidar com todos os cliques (delegação)
    reviewsList.addEventListener('click', (e) => {
        if (e.target.matches('.btn-aprovar, .btn-reprovar')) {
            const reviewItem = e.target.closest('li');
            const reviewId = reviewItem.dataset.reviewId;
            const action = e.target.dataset.action;
            handleModeration(reviewId, action);
        }
    });

    // --- LÓGICA PARA MODERAÇÃO DE PERGUNTAS (Q&A) ---

    /**
     * Renderiza um item de pergunta na lista de moderação.
     * @param {object} question - O objeto da pergunta.
     */
    function renderQuestionItem(question) {
        const listItem = document.createElement('li');
        listItem.setAttribute('data-question-id', question.id);

        listItem.innerHTML = `
            <div class="avaliacao-info">
                <span class="avaliacao-autor">Pergunta Anônima</span>
                <span class="avaliacao-data">${new Date(question.createdAt).toLocaleDateString('pt-BR')}</span>
            </div>
            <p class="avaliacao-texto"><strong>${question.title}</strong></p>
            <p class="avaliacao-texto" style="margin-top: 4px;">${question.content}</p>
            <div class="moderacao-acoes">
                <button class="btn-tabela btn-aprovar" data-action="approved">Aprovar</button>
                <button class="btn-tabela btn-reprovar" data-action="rejected">Rejeitar</button>
            </div>
        `;
        return listItem;
    }

    /**
     * Busca as perguntas pendentes da API e as renderiza.
     */
    async function fetchPendingQuestions() {
        if (!questionsList) return;
        questionsLoadingState.style.display = 'block';
        questionsEmptyState.style.display = 'none';
        questionsList.innerHTML = '';

        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/qna/pending`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Falha ao buscar perguntas pendentes.');

            const questions = await response.json();
            questionsLoadingState.style.display = 'none';
 
            if (questions.length === 0) {
                questionsEmptyState.style.display = 'block';
            } else {
                questions.forEach(question => {
                    questionsList.appendChild(renderQuestionItem(question));
                });
            }

        } catch (error) {
            questionsLoadingState.style.display = 'none';
            questionsEmptyState.textContent = `Erro ao carregar perguntas: ${error.message}`;
            questionsEmptyState.style.display = 'block';
        }
    }

    /**
     * Lida com o clique nos botões de moderação de perguntas.
     * @param {string} questionId - O ID da pergunta.
     * @param {string} action - 'approved' ou 'rejected'.
     */
    async function handleQuestionModeration(questionId, action) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/qna/${questionId}/moderate`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: action })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.message);

            const itemToRemove = questionsList.querySelector(`[data-question-id="${questionId}"]`);
            if (itemToRemove) {
                itemToRemove.style.transition = 'opacity 0.5s, transform 0.5s';
                itemToRemove.style.opacity = '0';
                itemToRemove.style.transform = 'translateX(20px)';
                setTimeout(() => {
                    itemToRemove.remove();
                    if (questionsList.children.length === 0) {
                        questionsEmptyState.style.display = 'block';
                    }
                }, 500);
            }

        } catch (error) {
            alert(`Erro ao moderar pergunta: ${error.message}`);
        }
    }

    if (questionsList) {
        questionsList.addEventListener('click', (e) => {
            if (e.target.matches('.btn-aprovar, .btn-reprovar')) {
                const questionItem = e.target.closest('li');
                const questionId = questionItem.dataset.questionId;
                const action = e.target.dataset.action;
                handleQuestionModeration(questionId, action);
            }
        });
    }

    // Inicia o carregamento dos dados
    function initializeStaticPageManagement() {
        const editButtons = document.querySelectorAll('.widget .btn-tabela');

        editButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const pageKey = e.target.closest('tr').querySelector('td').textContent;
                
                // Simula a navegação para a página de edição, passando a chave da página como parâmetro
                // A função loadPage do seu admin.js precisaria ser ajustada para lidar com parâmetros.
                // Por enquanto, vamos fazer um redirecionamento simples.
                window.location.hash = `admin_editar_pagina.html?page=${pageKey}`;
            });
        });
    }

    fetchPendingReviews();
    fetchPendingQuestions();
    initializeStaticPageManagement(); // Adiciona a inicialização dos botões de edição
};
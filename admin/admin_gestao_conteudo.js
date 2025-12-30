// admin/admin_gestao_conteudo.js

window.initializePage = function() {
    const token = localStorage.getItem('Yelo_token');
    // Garante URL base correta
    const API_BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : 'http://localhost:3001';

    const reviewsList = document.getElementById('pending-reviews-list');
    const loadingState = document.getElementById('reviews-loading-state');
    const emptyState = document.getElementById('reviews-empty-state');

    // Seletores para a nova seção de Q&A
    const questionsList = document.getElementById('pending-questions-list');
    const questionsLoadingState = document.getElementById('questions-loading-state');
    const questionsEmptyState = document.getElementById('questions-empty-state');

    // Seletor para o novo botão de Gestão da Comunidade
    const btnManageCommunity = document.getElementById('btn-manage-community');

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

        // CORREÇÃO: Lida com casos onde o paciente ou psicólogo foram excluídos
        const patientName = review.patient ? review.patient.nome : 'Usuário Excluído';
        const psychologistName = review.psychologist ? review.psychologist.nome : 'Profissional Excluído';

        listItem.innerHTML = `
            <div class="avaliacao-info">
                <span class="avaliacao-autor">${patientName} (para ${psychologistName})</span>
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
            const response = await fetch(`${API_BASE_URL}/api/admin/reviews/pending`, {
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
            const response = await fetch(`${API_BASE_URL}/api/admin/reviews/${reviewId}/moderate`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: action })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error);

            // Feedback visual de sucesso
            if (window.showToast) window.showToast(`Avaliação ${action === 'approved' ? 'aprovada' : 'rejeitada'} com sucesso!`);

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
            if (window.showToast) window.showToast(`Erro ao moderar avaliação: ${error.message}`, 'error');
            else alert(`Erro: ${error.message}`);
        }
    }

    // Adiciona um único event listener na lista para lidar com todos os cliques (delegação)
    reviewsList.addEventListener('click', (e) => {
        if (e.target.matches('.btn-aprovar, .btn-reprovar')) {
            const reviewItem = e.target.closest('li');
            const reviewId = reviewItem.dataset.reviewId;
            const action = e.target.dataset.action;
            
            const actionText = action === 'approved' ? 'aprovar' : 'rejeitar';
            const title = action === 'approved' ? 'Aprovar Avaliação' : 'Rejeitar Avaliação';

            if (window.openConfirmationModal) {
                window.openConfirmationModal(
                    title, 
                    `Tem certeza que deseja <strong>${actionText}</strong> esta avaliação?`, 
                    () => handleModeration(reviewId, action)
                );
            } else {
                handleModeration(reviewId, action);
            }
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

            if (window.showToast) window.showToast(`Pergunta ${action === 'approved' ? 'aprovada' : 'rejeitada'} com sucesso!`);

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
            if (window.showToast) window.showToast(`Erro ao moderar pergunta: ${error.message}`, 'error');
            else alert(`Erro: ${error.message}`);
        }
    }

    if (questionsList) {
        questionsList.addEventListener('click', (e) => {
            if (e.target.matches('.btn-aprovar, .btn-reprovar')) {
                const questionItem = e.target.closest('li');
                const questionId = questionItem.dataset.questionId;
                const action = e.target.dataset.action;
                
                const actionText = action === 'approved' ? 'aprovar' : 'rejeitar';
                const title = action === 'approved' ? 'Aprovar Pergunta' : 'Rejeitar Pergunta';

                if (window.openConfirmationModal) {
                    window.openConfirmationModal(
                        title,
                        `Tem certeza que deseja <strong>${actionText}</strong> esta pergunta?`,
                        () => handleQuestionModeration(questionId, action)
                    );
                } else {
                    handleQuestionModeration(questionId, action);
                }
            }
        });
    }

    // Inicia o carregamento dos dados
    function initializeStaticPageManagement() {
        const staticPagesWidget = document.getElementById('static-pages-widget');
        if (!staticPagesWidget) return;

        // Usando delegação de eventos para mais robustez
        staticPagesWidget.addEventListener('click', (e) => {
            if (e.target.matches('.btn-tabela')) {
                const pageKey = e.target.closest('tr')?.querySelector('td')?.textContent;
                if (pageKey && typeof window.navigateToPage === 'function') {
                    window.navigateToPage(`admin_editar_pagina.html?page=${pageKey.trim()}`);
                } else {
                    console.error("Não foi possível navegar ou encontrar a chave da página.");
                }
            }
        });
    }

    // Adiciona a lógica para o botão de Gerenciar Comunidade
    function initializeCommunityManagementLink() {
        if (btnManageCommunity && typeof window.navigateToPage === 'function') {
            btnManageCommunity.addEventListener('click', () => {
                window.navigateToPage('admin_comunidade_gestao.html');
            });
        }
    }

    fetchPendingReviews();
    fetchPendingQuestions();
    initializeStaticPageManagement(); // Adiciona a inicialização dos botões de edição
    initializeCommunityManagementLink(); // Adiciona a inicialização do novo botão
};
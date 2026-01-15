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

    // Seletores para a Central de Remoção
    const contentTabs = document.querySelectorAll('.content-tab-btn');
    const contentListContainer = document.getElementById('content-removal-list');

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

    // --- LÓGICA DA CENTRAL DE REMOÇÃO (BLOG, FÓRUM, Q&A) ---

    async function loadContentForRemoval(type) {
        contentListContainer.innerHTML = '<p class="loading-state">Carregando...</p>';
        
        let endpoint = '';
        if (type === 'blog') endpoint = '/api/admin/content/blog';
        if (type === 'forum') endpoint = '/api/admin/content/forum';
        if (type === 'qna') endpoint = '/api/admin/content/qna';

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (data.length === 0) {
                contentListContainer.innerHTML = '<p class="empty-state">Nenhum conteúdo encontrado.</p>';
                return;
            }

            let html = '<ul class="lista-moderacao">';
            data.forEach(item => {
                let title = item.titulo || item.title || 'Sem título';
                let author = item.autor?.nome || item.Psychologist?.nome || item.Patient?.nome || 'Anônimo';
                let date = new Date(item.createdAt || item.created_at).toLocaleDateString('pt-BR');
                let id = item.id;

                html += `
                    <li style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong>${title}</strong><br>
                            <small style="color: #666;">Por: ${author} em ${date}</small>
                        </div>
                        <button class="btn-tabela btn-tabela-perigo btn-delete-content" data-type="${type}" data-id="${id}">
                            Excluir
                        </button>
                    </li>
                `;
            });
            html += '</ul>';
            contentListContainer.innerHTML = html;

        } catch (error) {
            contentListContainer.innerHTML = `<p class="empty-state" style="color: red;">Erro: ${error.message}</p>`;
        }
    }

    async function deleteContent(type, id) {
        if (!confirm('Tem certeza que deseja excluir este item permanentemente?')) return;

        let endpoint = '';
        if (type === 'blog') endpoint = `/api/admin/content/blog/${id}`;
        if (type === 'forum') endpoint = `/api/admin/content/forum/${id}`;
        if (type === 'qna') endpoint = `/api/admin/content/qna/${id}`;

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                if (window.showToast) window.showToast('Conteúdo excluído com sucesso!');
                loadContentForRemoval(type); // Recarrega a lista
            } else {
                alert('Erro ao excluir.');
            }
        } catch (e) {
            console.error(e);
            alert('Erro de conexão.');
        }
    }

    // Event Listeners para as Abas
    contentTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            contentTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            loadContentForRemoval(tab.dataset.target);
        });
    });

    // Event Listener para Botão de Excluir (Delegação)
    contentListContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-delete-content')) {
            deleteContent(e.target.dataset.type, e.target.dataset.id);
        }
    });

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
    
    // Carrega a aba inicial (Blog)
    loadContentForRemoval('blog');

    initializeStaticPageManagement(); // Adiciona a inicialização dos botões de edição
    initializeCommunityManagementLink(); // Adiciona a inicialização do novo botão
};
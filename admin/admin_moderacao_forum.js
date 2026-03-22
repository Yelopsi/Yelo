// admin/admin_moderacao_forum.js

window.initializePage = function() {
    const tbody = document.getElementById('lista-posts-forum');
    const emptyState = document.getElementById('empty-state-posts');
    const token = localStorage.getItem('Yelo_token');

    async function carregarPostsDoForum() {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">Carregando...</td></tr>';
        emptyState.style.display = 'none';

        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/forum/posts`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Falha ao carregar posts do fórum.');
            }

            const result = await response.json();
            renderPosts(result.data);

        } catch (error) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color: red;">${error.message}</td></tr>`;
        }
    }

    function renderPosts(posts) {
        tbody.innerHTML = '';
        if (posts.length === 0) {
            emptyState.style.display = 'block';
            return;
        }

        posts.forEach(post => {
            const tr = document.createElement('tr');

            const statusMap = {
                'active': { text: 'Ativo', class: 'status-active' },
                'approved_by_admin': { text: 'Ativo', class: 'status-active' },
                'pending_review': { text: 'Pendente', class: 'status-pending' },
                'hidden_by_admin': { text: 'Oculto', class: 'status-inactive' }
            };
            const postStatus = statusMap[post.status] || { text: 'Desconhecido', class: 'status-inactive' };

            const pinButtonHTML = `
                <button 
                  class="btn-tabela btn-fixar ${post.isPinned ? 'pinned' : ''}" 
                  onclick="togglePinPost('${post.id}', ${post.isPinned})">
                  <span>${post.isPinned ? 'Desafixar' : 'Fixar'}</span>
                </button>
            `;

            tr.innerHTML = `
                <td data-label="Título">${post.title}</td>
                <td data-label="Autor">${post.authorName}</td>
                <td data-label="Categoria">${post.category}</td>
                <td data-label="Data">${new Date(post.createdAt).toLocaleDateString('pt-BR')}</td>
                <td data-label="Status"><span class="status ${postStatus.class}">${postStatus.text}</span></td>
                <td data-label="Ações">
                    <button class="btn-tabela btn-tabela-aviso" onclick="handleModerate('post', '${post.id}', 'approve')">Manter</button>
                    <button class="btn-tabela btn-tabela-perigo" onclick="handleModerate('post', '${post.id}', 'remove')">Remover</button>
                    ${pinButtonHTML}
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.handleModerate = function(contentType, contentId, action) {
        const actionText = action === 'remove' ? 'remover' : 'manter';
        openConfirmationModal('Confirmar Moderação', `Você tem certeza que deseja <strong>${actionText}</strong> este conteúdo?`, async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/admin/forum/moderate`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ contentType, contentId, action }) });
                const result = await response.json();
                if (response.ok) { showToast(result.message, 'success'); carregarPostsDoForum(); } else { throw new Error(result.error); }
            } catch (error) { showToast(`Erro: ${error.message}`, 'error'); }
        });
    }
    
    window.carregarPostsDoForum = carregarPostsDoForum;
    carregarPostsDoForum();
};
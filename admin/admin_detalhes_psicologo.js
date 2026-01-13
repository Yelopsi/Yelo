window.initializePage = function() {
    const params = new URLSearchParams(window.pageQueryString);
    const psyId = params.get('id');

    if (!psyId) {
        alert("ID do psicólogo não fornecido.");
        navigateToPage('admin_gerenciar_psicologos.html');
        return;
    }

    loadPsychologistDetails(psyId);

    // Função global para troca de abas
    window.switchDetailTab = function(tabName) {
        document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.details-tabs .tab-btn').forEach(el => el.classList.remove('active'));
        
        document.getElementById(`tab-${tabName}`).style.display = 'block';
        // Encontra o botão que chamou a função (hack simples) ou usa seletor
        const btn = Array.from(document.querySelectorAll('.details-tabs .tab-btn'))
            .find(b => b.getAttribute('onclick').includes(tabName));
        if(btn) btn.classList.add('active');
    };
};

async function loadPsychologistDetails(id) {
    const loading = document.getElementById('psy-details-loading');
    const content = document.getElementById('psy-details-content');
    
    try {
        const token = localStorage.getItem('Yelo_token');
        // NOTA: Esta rota precisará ser criada no backend
        const response = await fetch(`${API_BASE_URL}/api/admin/psychologists/${id}/full-details`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Erro ao carregar detalhes.');

        const data = await response.json();
        renderDetails(data);

        loading.style.display = 'none';
        content.style.display = 'block';

    } catch (error) {
        console.error(error);
        loading.innerHTML = `<p style="color:red">Erro ao carregar dados: ${error.message}</p>`;
    }
}

function renderDetails(data) {
    const p = data.psychologist;
    const stats = data.stats || {};

    // 1. Header Info
    document.getElementById('detail-nome').textContent = p.nome;
    document.getElementById('detail-crp').textContent = `CRP: ${p.crp || 'N/A'}`;
    document.getElementById('detail-email').textContent = p.email;
    document.getElementById('detail-telefone').textContent = p.telefone || 'N/A';
    document.getElementById('detail-local').textContent = `${p.cidade || ''} - ${p.estado || ''}`;
    document.getElementById('detail-data').textContent = new Date(p.createdAt).toLocaleDateString('pt-BR');
    
    if(p.fotoUrl) document.getElementById('detail-foto').src = p.fotoUrl;

    // Status e Plano
    const statusEl = document.getElementById('detail-status');
    statusEl.textContent = (p.status || 'inativo').toUpperCase();
    statusEl.className = `status-badge status-${p.status || 'inactive'}`;

    const planEl = document.getElementById('detail-plano');
    planEl.textContent = p.plano || 'Sem Plano';
    if(p.is_exempt) planEl.textContent += ' (VIP)';

    // 2. Stats
    document.getElementById('stat-matches').textContent = stats.matches || 0;
    document.getElementById('stat-whatsapp').textContent = stats.whatsappClicks || 0;
    document.getElementById('stat-blog').textContent = data.blogPosts?.length || 0;
    document.getElementById('stat-forum').textContent = (data.forumPosts?.length || 0) + (data.forumComments?.length || 0);

    // 3. Timeline (Juntando tudo e ordenando)
    renderTimeline(data);

    // 4. Listas Específicas
    renderList('blog-list', data.blogPosts, renderBlogItem);
    renderList('forum-list', [...(data.forumPosts || []), ...(data.forumComments || [])], renderForumItem);
    renderList('reviews-list', data.reviews, renderReviewItem);
}

function renderTimeline(data) {
    const container = document.getElementById('timeline-list');
    const events = [];

    // Normaliza eventos
    if(data.blogPosts) data.blogPosts.forEach(x => events.push({ type: 'blog', date: x.createdAt, data: x }));
    if(data.forumPosts) data.forumPosts.forEach(x => events.push({ type: 'forum_post', date: x.createdAt, data: x }));
    if(data.forumComments) data.forumComments.forEach(x => events.push({ type: 'forum_comment', date: x.createdAt, data: x }));
    if(data.reviews) data.reviews.forEach(x => events.push({ type: 'review', date: x.createdAt, data: x }));
    if(data.matches) data.matches.forEach(x => events.push({ type: 'match', date: x.createdAt, data: x }));
    
    // Ordena decrescente
    events.sort((a, b) => new Date(b.date) - new Date(a.date));

    if(events.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhuma atividade recente.</p>';
        return;
    }

    container.innerHTML = events.map(e => {
        const dateStr = new Date(e.date).toLocaleString('pt-BR');
        let icon = '•';
        let title = '';
        let desc = '';
        let colorClass = '';

        switch(e.type) {
            case 'blog':
                icon = '📝'; title = 'Publicou um Artigo'; 
                desc = e.data.titulo; colorClass = 'evt-blog';
                break;
            case 'forum_post':
                icon = '💬'; title = 'Criou Tópico no Fórum'; 
                desc = e.data.titulo; colorClass = 'evt-forum';
                break;
            case 'forum_comment':
                icon = '↩️'; title = 'Respondeu no Fórum'; 
                desc = `Em: ${e.data.postTitle || 'tópico'}`; colorClass = 'evt-forum';
                break;
            case 'review':
                icon = '⭐'; title = 'Recebeu Avaliação'; 
                desc = `Nota: ${e.data.nota}`; colorClass = 'evt-review';
                break;
            case 'match':
                icon = '🎯'; title = 'Apareceu em Busca (Match)'; 
                desc = `Tags: ${e.data.tags || 'N/A'}`; colorClass = 'evt-match';
                break;
        }

        return `
            <div class="timeline-item ${colorClass}">
                <div class="tl-icon">${icon}</div>
                <div class="tl-content">
                    <span class="tl-date">${dateStr}</span>
                    <h4>${title}</h4>
                    <p>${desc}</p>
                </div>
            </div>
        `;
    }).join('');
}

function renderList(containerId, items, renderFn) {
    const container = document.getElementById(containerId);
    if (!items || items.length === 0) return; // Mantém empty state padrão
    container.innerHTML = items.map(renderFn).join('');
}

function renderBlogItem(post) {
    return `
        <div class="content-card">
            <h4>${post.titulo}</h4>
            <p>Publicado em: ${new Date(post.createdAt).toLocaleDateString()}</p>
            <a href="/blog/post/${post.slug}" target="_blank">Ver Post</a>
        </div>
    `;
}

function renderForumItem(item) {
    const isPost = !!item.titulo;
    return `
        <div class="content-card">
            <h4>${isPost ? 'Tópico: ' + item.titulo : 'Comentário'}</h4>
            <p>${isPost ? item.conteudo.substring(0, 100) + '...' : item.texto}</p>
            <small>${new Date(item.createdAt).toLocaleDateString()}</small>
        </div>
    `;
}

function renderReviewItem(review) {
    return `
        <div class="content-card">
            <div class="review-stars">${'★'.repeat(review.nota)}${'☆'.repeat(5-review.nota)}</div>
            <p>"${review.comentario || 'Sem comentário'}"</p>
            <small>Por: ${review.autor || 'Anônimo'} em ${new Date(review.createdAt).toLocaleDateString()}</small>
        </div>
    `;
}
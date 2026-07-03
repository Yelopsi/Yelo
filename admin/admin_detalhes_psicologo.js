window.initializePage = function() {
    const params = new URLSearchParams(window.pageQueryString);
    const psyId = params.get('id');

    if (!psyId) {
        alert("ID do psicólogo não fornecido.");
        navigateToPage('admin_crm_psicologos.html');
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
    
    let detailStatusLabel = (p.status || 'inativo').toUpperCase();
    if (p.status === 'active') {
        if (p.is_exempt) {
            detailStatusLabel = 'VIP';
        } else if (!p.stripeSubscriptionId && p.planExpiresAt && new Date(p.planExpiresAt) > new Date()) {
            detailStatusLabel = 'TRIAL';
        } else {
            detailStatusLabel = 'ATIVO';
        }
    } else if (p.status === 'pending') {
        detailStatusLabel = 'INCOMPLETO';
    } else if (p.status === 'inactive') {
        detailStatusLabel = 'EXPIRADO';
    }
    
    statusEl.textContent = detailStatusLabel;
    statusEl.className = `status-badge status-${p.status || 'inactive'}`;

    const planEl = document.getElementById('detail-plano');
    planEl.textContent = p.plano || 'Sem Plano';
    if(p.is_exempt) planEl.textContent += ' (VIP)';

    // Vencimento da Assinatura
    const vencimentoEl = document.getElementById('detail-vencimento');
    if (vencimentoEl) {
        if (p.is_exempt) {
            vencimentoEl.innerHTML = '<span class="status-badge" style="background:#FFD700; color:#000;">Isento (VIP)</span>';
        } else if (p.planExpiresAt) {
            const vencimento = new Date(p.planExpiresAt);
            if (vencimento.getFullYear() < 2000) {
                vencimentoEl.innerHTML = `<span style="color:#d32f2f; font-weight:bold;">Expirado</span>`;
            } else {
                const dataFormatada = vencimento.toLocaleDateString('pt-BR');
                if (vencimento < new Date()) {
                    vencimentoEl.innerHTML = `<span style="color:#d32f2f; font-weight:bold;">${dataFormatada} (Vencida)</span>`;
                } else {
                    vencimentoEl.textContent = dataFormatada;
                }
            }
        } else {
            vencimentoEl.textContent = 'Sem assinatura';
        }
    }

    // Botão de Ver Perfil Público
    const btnVerPerfil = document.getElementById('btn-ver-perfil-publico');
    if (btnVerPerfil) {
        if (p.slug) {
            btnVerPerfil.style.display = 'inline-flex';
            btnVerPerfil.onclick = () => window.open(`/${p.slug}`, '_blank');
        } else {
            btnVerPerfil.style.display = 'none';
        }
    }

    // 2. Stats
    document.getElementById('stat-matches').textContent = stats.matches || 0;
    document.getElementById('stat-whatsapp').textContent = stats.whatsappClicks || 0;
    document.getElementById('stat-blog').textContent = data.blogPosts?.length || 0;
    document.getElementById('stat-forum').textContent = stats.forumActivities || ((data.forumPosts?.length || 0) + (data.forumComments?.length || 0));

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
    
    // Ordena decrescente (mais recentes primeiro)
    events.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Limita a linha do tempo às últimas 10 atividades
    const latestEvents = events.slice(0, 10);

    if(latestEvents.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhuma atividade recente.</p>';
        return;
    }

    container.innerHTML = latestEvents.map(e => {
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
                desc = e.data.title || 'Sem título'; colorClass = 'evt-forum';
                break;
            case 'forum_comment':
                icon = '↩️'; title = 'Respondeu no Fórum'; 
                desc = `Em: ${e.data.postTitle || 'tópico'}`; colorClass = 'evt-forum';
                break;
            case 'review':
                icon = '⭐'; title = 'Recebeu Avaliação'; 
                desc = `Nota: ${e.data.rating || e.data.nota}`; colorClass = 'evt-review';
                break;
            case 'match':
            {
                icon = '🎯'; title = 'Apareceu em Busca (Match)'; 
                let tags = 'N/A';
                if (e.data.matchTags) {
                    if (Array.isArray(e.data.matchTags)) tags = e.data.matchTags.join(', ');
                    else if (typeof e.data.matchTags === 'string') tags = e.data.matchTags;
                }
                desc = `Tags: ${tags}`; colorClass = 'evt-match';
                break;
            }
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
    
    if (events.length > 10) {
        container.innerHTML += `<div style="text-align: center; margin-top: 15px; color: #94a3b8; font-size: 0.85rem;">Mostrando as 10 atividades mais recentes (de um total de ${events.length}).</div>`;
    }
}

function renderList(containerId, items, renderFn) {
    const container = document.getElementById(containerId);
    if (!items || items.length === 0) return; // Mantém empty state padrão
    container.innerHTML = items.map(renderFn).join('');
}

function renderBlogItem(post) {
    return `
        <div class="content-card">
            <h4>${post.titulo || post.title || 'Artigo'}</h4>
            <p>Publicado em: ${new Date(post.createdAt || post.created_at || new Date()).toLocaleDateString('pt-BR')}</p>
            <a href="/blog/post/${post.slug || post.id}" target="_blank">Ver Post</a>
        </div>
    `;
}

function renderForumItem(item) {
    const isPost = Object.prototype.hasOwnProperty.call(item, 'title');
    const titulo = item.title || item.postTitle || 'Fórum';
    const conteudo = item.content || item.texto || '';
    const resumo = conteudo.length > 100 ? conteudo.substring(0, 100) + '...' : conteudo;
    return `
        <div class="content-card">
            <h4>${isPost ? 'Tópico: ' + titulo : 'Comentário em: ' + titulo}</h4>
            <p>${resumo}</p>
            <small>${new Date(item.createdAt).toLocaleDateString()}</small>
        </div>
    `;
}

function renderReviewItem(review) {
    const nota = review.rating || review.nota || 0;
    const comentario = review.comment || review.comentario || 'Sem comentário';
    const autor = review.patient?.nome || review.autor || 'Anônimo';
    return `
        <div class="content-card">
            <div class="review-stars">${'★'.repeat(nota)}${'☆'.repeat(5-nota)}</div>
            <p>"${comentario}"</p>
            <small>Por: ${autor} em ${new Date(review.createdAt).toLocaleDateString()}</small>
        </div>
    `;
}
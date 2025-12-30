window.initializePage = function() {
    carregarDenuncias();
};

async function carregarDenuncias() {
    const tbody = document.getElementById('lista-denuncias');
    const emptyState = document.getElementById('empty-state-reports');
    
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Carregando...</td></tr>';
    emptyState.style.display = 'none';

    try {
        const token = localStorage.getItem('Yelo_token');
        const res = await fetch(`${API_BASE_URL}/api/forum/admin/reports`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error('Erro ao buscar denúncias');
        
        const reports = await res.json();
        
        tbody.innerHTML = '';

        if (reports.length === 0) {
            emptyState.style.display = 'block';
            return;
        }

        // --- LÓGICA DE AGRUPAMENTO ---
        const agrupados = {};
        reports.forEach(r => {
            // Cria uma chave única baseada no tipo e ID do conteúdo
            const contentId = r.content ? r.content.id : 'unknown';
            const key = `${r.type}_${contentId}`;
            
            if (!agrupados[key]) {
                agrupados[key] = {
                    ...r,
                    count: 0,
                    reportIds: [], // Guarda IDs de todas as denúncias deste conteúdo
                    reportersNames: []
                };
            }
            agrupados[key].count++;
            agrupados[key].reportIds.push(r.id);
            if (r.reporter && r.reporter.nome) {
                agrupados[key].reportersNames.push(r.reporter.nome);
            }
        });

        // Renderiza os itens agrupados
        Object.values(agrupados).forEach(item => {
            const tr = document.createElement('tr');
            
            const dataFormatada = new Date(item.createdAt).toLocaleDateString('pt-BR');
            const tipoLabel = item.type === 'post' ? '<span class="status status-ativo">Post</span>' : '<span class="status status-pendente">Comentário</span>';
            
            const autorConteudo = item.content && item.content.Psychologist ? item.content.Psychologist.nome : 'Anônimo';
            
            // Botão que chama o modal global
            // Usamos JSON.stringify e replace para passar o objeto no onclick sem quebrar as aspas
            const btnVer = `<button class="btn-tabela" onclick='abrirModalDetalhes(${JSON.stringify(item).replace(/'/g, "&#39;")})'>Ver Detalhes</button>`;

            tr.innerHTML = `
                <td data-label="Data">${dataFormatada}</td>
                <td data-label="Tipo">${tipoLabel}</td>
                <td data-label="Autor">${autorConteudo}</td>
                <td data-label="Denúncias"><span class="badge-count">${item.count}</span></td>
                <td data-label="Ações">${btnVer}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Erro ao carregar dados.</td></tr>';
    }
}

window.abrirModalDetalhes = function(item) {
    if (window.openReportModal) {
        // Prepara a lista de denunciantes únicos
        const denunciantes = [...new Set(item.reportersNames)].join(', ') || 'Anônimo';
        
        window.openReportModal({
            title: item.type === 'post' ? 'Denúncia de Postagem' : 'Denúncia de Comentário',
            author: item.content && item.content.Psychologist ? item.content.Psychologist.nome : 'Desconhecido',
            reason: `Denunciado por: ${denunciantes}`,
            count: item.count,
            content: item.content ? (item.content.title ? `<strong>${item.content.title}</strong><br><br>${item.content.content}` : item.content.content) : 'Conteúdo indisponível',
            isHtml: true,
            actionLabel: 'Remover Conteúdo',
            onAction: () => resolverGrupo(item.reportIds, 'delete_content')
        });
    } else {
        console.error("Modal global (admin.js) não carregado.");
    }
};

async function resolverGrupo(ids, action) {
    const token = localStorage.getItem('Yelo_token');
    let successCount = 0;

    window.showToast('Processando...', 'info');

    // Itera sobre todos os IDs de denúncia desse conteúdo para limpar a fila
    for (const id of ids) {
        try {
            const res = await fetch(`${API_BASE_URL}/api/forum/admin/reports/${id}/resolve`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ action })
            });
            if (res.ok) successCount++;
        } catch (e) {
            console.error(e);
        }
    }

    if (successCount > 0) {
        window.showToast(`${successCount} denúncia(s) resolvida(s).`);
        carregarDenuncias(); // Atualiza a tabela
    } else {
        window.showToast('Erro ao processar denúncias.', 'error');
    }
}
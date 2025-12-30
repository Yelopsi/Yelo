window.initializePage = function() {
    const token = localStorage.getItem('Yelo_token');
    const API_BASE_URL = window.API_BASE_URL || 'http://localhost:3001';
    
    const btnFiltrar = document.getElementById('btn-filtrar-exit');
    const listaContainer = document.getElementById('lista-exit');
    
    // KPIs
    const kpiTotal = document.getElementById('exit-total');
    const kpiMedia = document.getElementById('exit-media');
    const kpiMotivo = document.getElementById('exit-motivo');

    async function loadExitSurveys() {
        try {
            const motivo = document.getElementById('filtro-motivo').value;
            const nota = document.getElementById('filtro-nota').value;
            const inicio = document.getElementById('filtro-data-inicio').value;
            const fim = document.getElementById('filtro-data-fim').value;

            const params = new URLSearchParams();
            if(motivo) params.append('motivo', motivo);
            if(nota) params.append('nota', nota);
            if(inicio) params.append('startDate', inicio);
            if(fim) params.append('endDate', fim);

            listaContainer.innerHTML = '<p style="text-align:center; color:#999;">Carregando...</p>';

            const response = await fetch(`${API_BASE_URL}/api/admin/exit-surveys?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Erro ao carregar dados.');

            const data = await response.json();
            renderKPIs(data.stats);
            renderList(data.list);

        } catch (error) {
            console.error(error);
            listaContainer.innerHTML = '<p style="text-align:center; color:red;">Erro ao carregar dados.</p>';
        }
    }

    function renderKPIs(stats) {
        // Mapa de tradução para os motivos
        const reasonMap = {
            'financeiro': 'Preço / Financeiro',
            'plataforma': 'Dificuldade com a Plataforma',
            'suporte': 'Suporte Insuficiente',
            'demanda': 'Baixa Demanda',
            'outro': 'Outros'
        };

        if(kpiTotal) kpiTotal.innerText = stats.total || 0;
        if(kpiMedia) kpiMedia.innerText = stats.media || '-';
        
        const rawReason = stats.topReason;
        // Se tiver no mapa, usa. Se não, usa o original. Se for nulo, põe texto padrão.
        const displayReason = reasonMap[rawReason] || rawReason || 'Aguardando dados';
        
        if(kpiMotivo) kpiMotivo.innerText = displayReason; 
    }

    function renderList(list) {
        listaContainer.innerHTML = '';
        if(!list || list.length === 0) {
            listaContainer.innerHTML = '<p style="text-align:center; color:#999;">Nenhum registro encontrado para os filtros selecionados.</p>';
            return;
        }

        list.forEach(item => {
            const card = document.createElement('div');
            card.className = 'review-card'; // Reutiliza estilo de card de review
            card.style.borderLeft = `4px solid ${getRatingColor(item.avaliacao)}`;
            card.style.padding = '20px';
            card.style.background = '#fff';
            card.style.borderRadius = '8px';
            card.style.boxShadow = '0 2px 5px rgba(0,0,0,0.05)';
            
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                    <div>
                        <h4 style="margin: 0; color: #333; font-size: 1.1rem;">${item.motivo || 'Sem motivo especificado'}</h4>
                        <span style="font-size: 0.85rem; color: #888;">${new Date(item.createdAt).toLocaleDateString('pt-BR')} às ${new Date(item.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    <div style="font-weight: bold; color: ${getRatingColor(item.avaliacao)}; font-size: 1.2rem;">
                        ${item.avaliacao} ★
                    </div>
                </div>
                <p style="margin: 0; color: #555; font-style: italic; line-height: 1.5;">"${item.sugestao || 'Sem comentários adicionais.'}"</p>
                ${item.psychologistId ? `<div style="margin-top:15px; font-size:0.8rem; color:#999; border-top: 1px solid #eee; padding-top: 5px;">ID do Profissional: ${item.psychologistId}</div>` : ''}
            `;
            listaContainer.appendChild(card);
        });
    }

    function getRatingColor(rating) {
        if(rating >= 4) return '#27ae60'; // Verde
        if(rating === 3) return '#f39c12'; // Laranja
        return '#e74c3c'; // Vermelho
    }

    if(btnFiltrar) btnFiltrar.addEventListener('click', loadExitSurveys);
    
    // Carregamento inicial
    loadExitSurveys();
};

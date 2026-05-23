window.initializePage = async function() {
    const API_BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : 'http://localhost:3001';
    const token = localStorage.getItem('Yelo_token');

    let allReviews = [];

    const totalEl = document.getElementById('nps-total');
    const mediaEl = document.getElementById('nps-media');
    const aprovadosEl = document.getElementById('nps-aprovados');
    const tbody = document.querySelector('#tabela-nps tbody');
    const filtroNota = document.getElementById('filtro-nota-nps');
    const filtroDepoimento = document.getElementById('filtro-depoimento-nps');

    async function loadPlatformReviews() {
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/platform-reviews`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!res.ok) throw new Error('Falha ao buscar avaliações.');
            
            allReviews = await res.json();
            updateDashboard(allReviews);
            renderTable(allReviews);
        } catch (error) {
            console.error(error);
            if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Erro ao carregar dados.</td></tr>`;
        }
    }

    function updateDashboard(data) {
        if (!data || data.length === 0) {
            if (totalEl) totalEl.textContent = '0';
            if (mediaEl) mediaEl.textContent = '0.0';
            if (aprovadosEl) aprovadosEl.textContent = '0';
            return;
        }

        const total = data.length;
        const sum = data.reduce((acc, curr) => acc + curr.rating, 0);
        const aprovados = data.filter(r => r.isTestimonial).length;

        if (totalEl) totalEl.textContent = total;
        if (mediaEl) mediaEl.textContent = (sum / total).toFixed(1);
        if (aprovadosEl) aprovadosEl.textContent = aprovados;
    }

    function renderTable(data) {
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Nenhuma avaliação encontrada.</td></tr>`;
            return;
        }

        data.forEach(review => {
            const tr = document.createElement('tr');
            
            const dataFormatada = new Date(review.createdAt).toLocaleDateString('pt-BR');
            const estrelas = '⭐'.repeat(review.rating);
            
            const btnTestimonialText = review.isTestimonial ? 'Remover da LP' : 'Aprovar p/ LP';
            const btnClass = review.isTestimonial ? 'btn-tabela-perigo' : 'btn-tabela-aviso';

            tr.innerHTML = `
                <td data-label="Psicólogo">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${review.psychologistPhoto || 'https://placehold.co/40x40/1B4332/FFFFFF?text=Psi'}" alt="Avatar" style="width:30px; height:30px; border-radius:50%; object-fit:cover;">
                        <div style="display:flex; flex-direction:column;">
                            <strong style="color:var(--verde-escuro);">${review.psychologistName || 'Usuário Removido'}</strong>
                            <span style="font-size:0.75rem; color:#666;">${review.psychologistEmail || ''}</span>
                        </div>
                    </div>
                </td>
                <td data-label="Nota"><span style="font-size:1.1rem;" title="${review.rating} Estrelas">${estrelas}</span></td>
                <td data-label="Comentário" style="max-width:300px; white-space:normal; overflow-wrap:break-word;">
                    ${review.comment ? `"${review.comment}"` : '<em style="color:#aaa;">Sem comentário</em>'}
                </td>
                <td data-label="Data">${dataFormatada}</td>
                <td>
                    <button class="btn-tabela ${btnClass}" onclick="toggleTestimonial(${review.id}, ${!review.isTestimonial})">${btnTestimonialText}</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.toggleTestimonial = async function(id, isTestimonial) {
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/platform-reviews/${id}/testimonial`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ isTestimonial })
            });
            if (res.ok) {
                window.showToast(isTestimonial ? 'Depoimento adicionado à Landing Page!' : 'Depoimento removido.', 'success');
                loadPlatformReviews();
            } else throw new Error();
        } catch(e) {
            window.showToast('Erro ao atualizar status.', 'error');
        }
    };

    function applyFilters() {
        const nota = filtroNota.value;
        const status = filtroDepoimento.value;
        
        let filtered = allReviews.filter(r => (!nota || r.rating.toString() === nota) && (!status || r.isTestimonial.toString() === status));
        renderTable(filtered);
    }

    if (filtroNota) filtroNota.addEventListener('change', applyFilters);
    if (filtroDepoimento) filtroDepoimento.addEventListener('change', applyFilters);

    loadPlatformReviews();
};
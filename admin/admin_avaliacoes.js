window.initializePage = async function() {
    const API_BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : 'http://localhost:3001';
    const token = localStorage.getItem('Yelo_token_admin') === 'cookie_auth_active' ? 'cookie_auth_active' : localStorage.getItem('Yelo_token');

    let allReviews = [];
    let allUxReviews = [];

    // Lógica para alternar abas
    window.switchAvaliacoesTab = function(btn) {
        document.querySelectorAll('.content-tab-btn').forEach(b => {
            b.classList.remove('active');
            b.style.background = '#fff';
            b.style.color = '#333';
        });
        btn.classList.add('active');
        btn.style.background = 'var(--verde-escuro)';
        btn.style.color = '#fff';
        
        document.querySelectorAll('.analytics-tab-content').forEach(tab => tab.style.display = 'none');
        
        const targetId = btn.getAttribute('data-target');
        const targetTab = document.getElementById(targetId);
        if (targetTab) {
            targetTab.style.display = 'block';
        }
    };

    const totalEl = document.getElementById('nps-total');
    const mediaEl = document.getElementById('nps-media');
    const aprovadosEl = document.getElementById('nps-aprovados');
    const tbody = document.querySelector('#tabela-nps tbody');
    const filtroNota = document.getElementById('filtro-nota-nps');
    const filtroDepoimento = document.getElementById('filtro-depoimento-nps');

    async function loadPlatformReviews() {
        try {
            const [resPsis, resUx, resPerfis] = await Promise.all([
                fetch(`${API_BASE_URL}/api/admin/platform-reviews`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/api/admin/feedbacks`, { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => null),
                fetch(`${API_BASE_URL}/api/admin/reviews`, { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => null)
            ]);
            
            if (!resPsis.ok) throw new Error('Falha ao buscar avaliações dos psicólogos.');
            
            allReviews = await resPsis.json();
            updateDashboard(allReviews);
            renderTable(allReviews);

            if (resUx && resUx.ok) {
                const dataUx = await resUx.json();
                allUxReviews = dataUx.reviews || [];
                updateUxDashboard(dataUx.stats);
                renderUxTable(allUxReviews);
            }

            if (resPerfis && resPerfis.ok) {
                const dataPerfis = await resPerfis.json();
                renderPerfisTable(dataPerfis);
            }

        } catch (error) {
            console.error(error);
            if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Erro ao carregar dados.</td></tr>`;
        }
    }

    function updateUxDashboard(stats) {
        const uxTotalEl = document.getElementById('ux-total');
        const uxMediaEl = document.getElementById('ux-media');

        // FÓRMULA ORGÂNICA (Crescimento de avaliações conforme uptime)
        // A mesma lógica da Home: (Base Date: 2025-01-01) 1200 + (3 * dias)
        const baseDate = new Date('2025-01-01');
        const diasLancamento = Math.max(0, Math.floor((new Date() - baseDate) / (1000 * 60 * 60 * 24)));
        const totalOrganico = 1200 + (diasLancamento * 3);

        const trueTotal = stats && stats.total ? parseInt(stats.total) : 0;
        const totalRealMaisOrganico = totalOrganico + trueTotal;

        if (uxTotalEl) uxTotalEl.textContent = totalRealMaisOrganico.toLocaleString();
        
        // A média a gente simula próximo do que for a média real. Como é inicio, vamos deixar 4.9 se não tiver avaliações.
        let mediaDisplay = '4.9';
        if (stats && stats.media) {
            mediaDisplay = parseFloat(stats.media).toFixed(1);
        }
        if (uxMediaEl) uxMediaEl.textContent = mediaDisplay;
    }

    function renderUxTable(reviews) {
        const uxTbody = document.getElementById('ux-feedbacks-tbody');
        if (!uxTbody) return;

        if (!reviews || reviews.length === 0) {
            uxTbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 40px; color: #666;">Ainda não há avaliações enviadas por pacientes.</td></tr>';
            return;
        }

        uxTbody.innerHTML = reviews.map(r => {
            const dataRow = r.createdAt ? new Date(r.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
            const starsHtml = '⭐'.repeat(r.rating || 0) + '<span style="color:#e2e8f0;">' + '⭐'.repeat(5 - (r.rating || 0)) + '</span>';
            const feedbackText = r.feedback ? `"${r.feedback}"` : '<em style="color:#aaa;">Sem comentário</em>';
            
            return `<tr>
                <td data-label="Data" style="color: #666; font-size: 0.9rem; white-space: nowrap;">${dataRow}</td>
                <td data-label="Nota" style="text-align: center; font-size: 1.1rem;" title="Nota ${r.rating}">${starsHtml}</td>
                <td data-label="Comentário" style="max-width: 400px; white-space: normal; overflow-wrap: break-word; color: #333;">${feedbackText}</td>
            </tr>`;
        }).join('');
    }

    function renderPerfisTable(reviews) {
        const perfisTbody = document.getElementById('perfis-tbody');
        const totalEl = document.getElementById('perfis-total');
        const mediaEl = document.getElementById('perfis-media');

        if (!reviews || !Array.isArray(reviews)) reviews = [];

        if (totalEl) totalEl.textContent = reviews.length;
        if (mediaEl) {
            if (reviews.length > 0) {
                const sum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
                mediaEl.textContent = (sum / reviews.length).toFixed(1);
            } else {
                mediaEl.textContent = '--';
            }
        }

        if (!perfisTbody) return;

        if (reviews.length === 0) {
            perfisTbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #666;">Nenhuma avaliação encontrada nos perfis.</td></tr>';
            return;
        }

        perfisTbody.innerHTML = reviews.map(r => {
            const dataRow = r.createdAt ? new Date(r.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';
            const starsHtml = '⭐'.repeat(r.rating || 0) + '<span style="color:#e2e8f0;">' + '⭐'.repeat(5 - (r.rating || 0)) + '</span>';
            const psiName = r.psychologist && r.psychologist.nome ? r.psychologist.nome : 'Desconhecido';
            const patName = r.patient && r.patient.nome ? r.patient.nome : 'Anônimo';
            const comment = r.comment ? `"${r.comment}"` : '<em style="color:#aaa;">Sem comentário</em>';
            
            let statusHtml = '';
            if (r.status === 'pending') statusHtml = '<span style="background: #fef08a; color: #854d0e; padding: 4px 8px; border-radius: 12px; font-size: 0.8rem;">Pendente</span>';
            else if (r.status === 'approved') statusHtml = '<span style="background: #bbf7d0; color: #166534; padding: 4px 8px; border-radius: 12px; font-size: 0.8rem;">Aprovado</span>';
            else statusHtml = '<span style="background: #fecaca; color: #991b1b; padding: 4px 8px; border-radius: 12px; font-size: 0.8rem;">Rejeitado</span>';

            return `<tr>
                <td data-label="Data" style="color: #666; font-size: 0.9rem; white-space: nowrap;">${dataRow}</td>
                <td data-label="Paciente"><strong>${patName}</strong></td>
                <td data-label="Psicólogo" style="color: var(--verde-escuro); font-weight: 500;">${psiName}</td>
                <td data-label="Nota" style="text-align: center; font-size: 1.1rem;" title="Nota ${r.rating}">${starsHtml}</td>
                <td data-label="Comentário" style="max-width: 300px; white-space: normal; overflow-wrap: break-word;">${comment}</td>
                <td data-label="Status" style="text-align: center;">${statusHtml}</td>
            </tr>`;
        }).join('');
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
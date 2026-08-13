async function loadAbTestData() {
    const API_BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : '';
    const token = localStorage.getItem('Yelo_token_admin') === 'cookie_auth_active' ? 'cookie_auth_active' : localStorage.getItem('Yelo_token');

    ['clicks-a','clicks-b','contato-a','contato-b','fechou-a','fechou-b','neg-a','neg-b','taxa-a','taxa-b']
        .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '...'; });

    try {
        const res = await fetch(`${API_BASE_URL}/api/admin/analytics/whatsapp-ab`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const totalCliques = (data.A.cliques || 0) + (data.B.cliques || 0);

        // Preenche métricas de cada variante
        ['A', 'B'].forEach(v => {
            const d = data[v];
            const suf = v.toLowerCase();
            const cliques = d.cliques || 0;
            const feedbacks = d.feedbacks || 0;
            const contato = d.contatoRecebido || 0;
            const fechou = d.negocioFechado || 0;
            const neg = d.emNegociacao || 0;

            document.getElementById(`clicks-${suf}`).textContent = cliques;
            document.getElementById(`contato-${suf}`).textContent = contato;
            document.getElementById(`fechou-${suf}`).textContent = fechou;
            document.getElementById(`neg-${suf}`).textContent = neg;

            // Taxa de conversão final = fechados / cliques (métrica principal do teste)
            const taxa = cliques > 0 ? ((fechou / cliques) * 100).toFixed(1) : '0.0';
            document.getElementById(`taxa-${suf}`).textContent = `${taxa}%`;
            document.getElementById(`bar-${suf}`).style.width = `${Math.min(100, parseFloat(taxa) * 5)}%`;

            // Nota de cobertura de feedbacks
            const noteEl = document.getElementById(`feedback-note-${suf}`);
            if (noteEl) {
                if (cliques === 0) {
                    noteEl.textContent = 'Nenhum clique ainda.';
                } else {
                    const cobPct = ((feedbacks / cliques) * 100).toFixed(0);
                    noteEl.textContent = `${feedbacks} de ${cliques} cliques com feedback (${cobPct}% de cobertura)`;
                }
            }
        });

        // Destaca o vencedor (por taxa de conversão final)
        const taxaA = data.A.cliques > 0 ? data.A.negocioFechado / data.A.cliques : 0;
        const taxaB = data.B.cliques > 0 ? data.B.negocioFechado / data.B.cliques : 0;
        if (totalCliques >= 10) {
            if (taxaA > taxaB) {
                document.getElementById('card-a').style.boxShadow = '0 0 0 2px #3b82f6';
                document.getElementById('card-a').style.background = '#f0f7ff';
            } else if (taxaB > taxaA) {
                document.getElementById('card-b').style.boxShadow = '0 0 0 2px #10b981';
                document.getElementById('card-b').style.background = '#f0fdf9';
            }
        }

        // Nota global de status
        const noteEl = document.getElementById('ab-note');
        if (noteEl) {
            if (totalCliques === 0) {
                noteEl.textContent = '⚠️ Nenhum clique com variante ainda. Os dados aparecerão conforme pacientes usarem o botão WhatsApp.';
                noteEl.style.color = '#d97706';
            } else {
                const totalFechou = (data.A.negocioFechado || 0) + (data.B.negocioFechado || 0);
                noteEl.textContent = `${totalCliques} cliques no total · ${totalFechou} negócios fechados combinados`;
                noteEl.style.color = '#64748b';
            }
        }

    } catch(e) {
        console.error('Erro ao carregar dados do Teste A/B:', e);
        ['clicks-a','clicks-b','contato-a','contato-b','fechou-a','fechou-b','neg-a','neg-b','taxa-a','taxa-b']
            .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '-'; });
    }
}

window.initializePage = function() {
    loadAbTestData();
};

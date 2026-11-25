// admin/admin_roadmap_reavaliacoes.js

window.initializePage = async function() {
    const baseUrl = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : 'http://localhost:3001';
    const token = localStorage.getItem('Yelo_token');

    function formatCountdown(isoStr) {
        const target = new Date(isoStr);
        const now = new Date();
        const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
        const diff = Math.round((startTarget - startToday) / (1000 * 60 * 60 * 24));

        if (diff === 0) return 'É hoje!';
        if (diff === 1) return 'Amanhã';
        if (diff > 1) return `Faltam ${diff} dias`;
        const ago = Math.abs(diff);
        return `Passou há ${ago} ${ago === 1 ? 'dia' : 'dias'}`;
    }

    const seoText = formatCountdown('2026-11-30T00:00:00-03:00');
    const trafficText = formatCountdown('2026-12-08T00:00:00-03:00');

    const seoCd = document.getElementById('rm-cd-seo');
    const trafficCd = document.getElementById('rm-cd-traffic');
    const chipSeo = document.getElementById('rm-chip-seo');
    const chipTraffic = document.getElementById('rm-chip-traffic');

    if (seoCd) seoCd.textContent = seoText;
    if (trafficCd) trafficCd.textContent = trafficText;
    if (chipSeo) chipSeo.textContent = `30/11 · ${seoText}`;
    if (chipTraffic) chipTraffic.textContent = `08/12 · ${trafficText}`;

    const marcosEl = document.getElementById('rm-marcos-line');
    if (token) {
        try {
            const res = await fetch(`${baseUrl}/api/admin/analytics/growth/health`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                const m = data?.dashboard?.marcos;
                if (m) {
                    if (marcosEl) marcosEl.textContent = 'Progresso atualizado automaticamente com base nos pagamentos confirmados.';
                    const setMarco = (txtId, barId, item, target) => {
                        const txt = document.getElementById(txtId);
                        const bar = document.getElementById(barId);
                        if (txt && item) txt.textContent = `${item.atual}/${target} (${item.percentual}%)`;
                        if (bar && item) bar.style.width = `${Math.min(100, item.percentual || 0)}%`;
                    };
                    setMarco('rm-m20-txt', 'rm-m20-bar', m.m20, 20);
                    setMarco('rm-m70-txt', 'rm-m70-bar', m.m70, 70);
                    setMarco('rm-m120-txt', 'rm-m120-bar', m.m120, 120);
                    return;
                }
            }
        } catch (e) {}
    }
    if (marcosEl) marcosEl.textContent = 'Acompanhe os marcos atualizados em Saúde & Crescimento.';
};

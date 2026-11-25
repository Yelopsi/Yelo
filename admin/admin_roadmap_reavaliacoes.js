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

        if (diff === 0) return '· 🚨 É hoje!';
        if (diff === 1) return '· ⏰ Amanhã';
        if (diff > 1) return `· Faltam ${diff} dias`;
        const ago = Math.abs(diff);
        return `· Passou há ${ago} ${ago === 1 ? 'dia' : 'dias'}`;
    }

    const seoCd = document.getElementById('rm-cd-seo');
    const trafficCd = document.getElementById('rm-cd-traffic');
    if (seoCd) seoCd.textContent = formatCountdown('2026-11-30T00:00:00-03:00');
    if (trafficCd) trafficCd.textContent = formatCountdown('2026-12-08T00:00:00-03:00');

    const marcosEl = document.getElementById('rm-marcos-line');
    if (marcosEl && token) {
        try {
            const res = await fetch(`${baseUrl}/api/admin/analytics/growth/health`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                const m = data?.dashboard?.marcos;
                if (m) {
                    marcosEl.textContent = `Operacional: ${m.m20.atual}/20 (${m.m20.percentual}%) · Saída MEI: ${m.m70.atual}/70 (${m.m70.percentual}%) · Pró-labore: ${m.m120.atual}/120 (${m.m120.percentual}%)`;
                    return;
                }
            }
        } catch (e) {}
        marcosEl.textContent = 'Acompanhe o progresso atualizado em Saúde & Crescimento.';
    }
};

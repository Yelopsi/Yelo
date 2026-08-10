document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('yelo_admin_token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const response = await fetch('/api/admin/analytics/whatsapp-ab', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401 || response.status === 403) {
            window.location.href = 'login.html';
            return;
        }

        const data = await response.json();
        
        const clicksA = data.A || 0;
        const clicksB = data.B || 0;
        const total = clicksA + clicksB;

        const elClicksA = document.getElementById('clicks-a');
        const elClicksB = document.getElementById('clicks-b');
        const elRateA = document.getElementById('rate-a');
        const elRateB = document.getElementById('rate-b');

        if (elClicksA) elClicksA.textContent = clicksA;
        if (elClicksB) elClicksB.textContent = clicksB;

        if (total > 0) {
            if (elRateA) elRateA.textContent = ((clicksA / total) * 100).toFixed(1) + '%';
            if (elRateB) elRateB.textContent = ((clicksB / total) * 100).toFixed(1) + '%';
        }

    } catch (error) {
        console.error("Erro ao carregar dados do Teste A/B", error);
    }
});

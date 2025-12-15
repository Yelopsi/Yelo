window.initializePage = async function() {
    const container = document.getElementById('lista-exit');
    const token = localStorage.getItem('girassol_token');

    try {
        const response = await fetch('/api/admin/exit-surveys', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        // Atualiza Stats
        document.getElementById('exit-total').innerText = data.stats.total || 0;
        document.getElementById('exit-media').innerText = data.stats.media || "0.0";
        
        // Traduz o motivo (ex: 'custo' -> 'Custo Alto')
        const motivosMap = {
            'custo': 'Valor da Assinatura',
            'pouco_retorno': 'Pouco Retorno',
            'plataforma_dificil': 'Dificuldade de Uso',
            'migracao': 'Migração',
            'pausa': 'Pausa na Carreira'
        };
        document.getElementById('exit-motivo').innerText = motivosMap[data.stats.principal_motivo] || data.stats.principal_motivo || "-";

        // Renderiza Lista
        container.innerHTML = '';
        if(!data.list.length) {
            container.innerHTML = '<p style="text-align:center; color:#ccc;">Nenhum registro de saída.</p>';
            return;
        }

        data.list.forEach(item => {
            const stars = '★'.repeat(item.avaliacao || 0) + '☆'.repeat(5 - (item.avaliacao || 0));
            const motivoTexto = motivosMap[item.motivo] || item.motivo;
            const date = new Date(item.createdAt).toLocaleDateString('pt-BR');

            const div = document.createElement('div');
            div.style.cssText = 'background: #fff0f0; border: 1px solid #ffcdd2; padding: 15px; border-radius: 8px;';
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; font-size:0.9rem; margin-bottom:8px;">
                    <strong style="color:#c62828;">${motivoTexto}</strong>
                    <span style="color:#666;">${date}</span>
                </div>
                <div style="color: #f57f17; letter-spacing: 2px; margin-bottom: 5px;">${stars}</div>
                <p style="margin:0; color:#444; font-style:italic;">"${item.sugestao || 'Sem comentário'}"</p>
            `;
            container.appendChild(div);
        });

    } catch (error) {
        console.error(error);
        if(container) container.innerHTML = '<p style="color:red; text-align:center;">Erro ao carregar.</p>';
    }
};
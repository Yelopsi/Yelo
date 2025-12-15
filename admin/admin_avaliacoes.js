// Arquivo: admin/admin_avaliacoes.js

window.initializePage = async function() {
    console.log("Inicializando página de Avaliações...");
    
    const container = document.getElementById('lista-feedbacks');
    if (!container) return;

    // 1. RECUPERA O TOKEN DE SEGURANÇA
    const token = localStorage.getItem('girassol_token');

    // Se não tiver token, nem tenta buscar (força logout ou avisa)
    if (!token) {
        container.innerHTML = '<p style="color:red; text-align:center;">Sessão expirada. Faça login novamente.</p>';
        return;
    }

    try {
        // 2. FAZ O FETCH ENVIANDO O TOKEN NO HEADER
        const response = await fetch('/api/demand/ratings', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // <--- O PULO DO GATO ESTÁ AQUI
            }
        });
        
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new Error("Acesso negado. Token inválido.");
            }
            throw new Error('Falha ao buscar dados');
        }

        const data = await response.json();

        // 3. Atualiza os Números (Média e Total)
        const mediaEl = document.getElementById('rating-media');
        const totalEl = document.getElementById('rating-total');
        
        if(mediaEl) mediaEl.innerText = data.stats.media || '0.0';
        if(totalEl) totalEl.innerText = (data.stats.total || '0') + ' avaliações';

        // 4. Renderiza a Lista de Feedbacks
        container.innerHTML = ''; 

        if (!data.reviews || data.reviews.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#ccc; padding:20px;">Nenhuma avaliação recebida ainda.</p>';
            return;
        }

        data.reviews.forEach(review => {
            const nota = parseInt(review.rating);
            const stars = '<span style="color:#f39c12;">' + '★'.repeat(nota) + '</span>' + '<span style="color:#ddd;">' + '★'.repeat(5 - nota) + '</span>';
            
            const dateObj = new Date(review.createdAt);
            const dateStr = dateObj.toLocaleDateString('pt-BR') + ' às ' + dateObj.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
            
            const feedbackContent = review.feedback 
                ? `<span style="color: #333; font-weight: 500;">"${review.feedback}"</span>` 
                : '<em style="color:#ccc; font-weight: normal;">Apenas nota (sem comentário por escrito)</em>';

            const item = document.createElement('div');
            item.className = "feedback-item";
            item.style.cssText = 'background: #f9f9f9; padding: 15px 20px; border-radius: 12px; border: 1px solid #eee; margin-bottom: 5px; transition: background 0.2s;';
            
            item.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items: center; margin-bottom: 8px;">
                    <div style="font-size: 1.2rem; letter-spacing: 1px;">${stars}</div>
                    <div style="font-size: 0.75rem; color: #888; background: #fff; padding: 3px 10px; border-radius: 15px; border: 1px solid #eee;">${dateStr}</div>
                </div>
                <p style="margin: 0; font-size: 0.95rem; line-height: 1.5; color: #555;">${feedbackContent}</p>
            `;

            item.onmouseover = () => item.style.background = '#f0f2f5';
            item.onmouseout = () => item.style.background = '#f9f9f9';

            container.appendChild(item);
        });

    } catch (error) {
        console.error("Erro ao carregar avaliações:", error);
        container.innerHTML = `
            <div style="text-align:center; padding: 20px; color: #d9534f;">
                <p><strong>Erro ao carregar dados:</strong> ${error.message}</p>
            </div>
        `;
    }
};
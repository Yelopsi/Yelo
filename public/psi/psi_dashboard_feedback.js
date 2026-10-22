/**
 * Arquivo: psi_dashboard_feedback.js
 * Responsabilidade: Isolar a lógica de exibição e submissão do modal de Avaliação de Plataforma (NPS).
 * Suporte a reavaliação periódica (30 dias) para notas baixas (1 a 3 estrelas), sem incomodar quem deu nota boa (4 ou 5).
 */
window.PsiFeedback = (function() {

    function abrirModalFeedbackPlataforma(isReavaliacao = false) {
        let modal = document.getElementById('modal-feedback-plataforma');
        if (modal) {
            modal.remove(); // Remove para recriar com os textos adequados
        }

        modal = document.createElement('div');
        modal.id = 'modal-feedback-plataforma';
        modal.className = 'custom-modal-overlay';
        modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 16px; backdrop-filter: blur(3px);';

        const icone = isReavaliacao ? '🌿' : '⭐';
        const titulo = isReavaliacao 
            ? 'Como está sua experiência hoje?' 
            : 'Como está sendo sua experiência?';
        const subtitulo = isReavaliacao
            ? 'Vimos que em sua avaliação anterior alguns pontos não foram ideais. Nossa equipe trabalhou em melhorias na plataforma desde então! Como você avalia a Yelo hoje?'
            : 'Você já está na Yelo há alguns dias! Gostaríamos muito de saber o que você está achando da plataforma para continuarmos melhorando.';

        modal.innerHTML = `
            <div class="custom-modal-box" style="text-align: center; max-width: 460px; width: 100%; background: #ffffff; border-radius: 20px; padding: 28px 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.2); position: relative; animation: fadeInModal 0.25s ease-out;">
                <button type="button" id="btn-fechar-modal-x" style="position: absolute; top: 14px; right: 16px; background: none; border: none; font-size: 1.5rem; color: #94a3b8; cursor: pointer; line-height: 1; padding: 4px;" title="Lembrar mais tarde">&times;</button>
                
                <div style="font-size: 3.2rem; margin-bottom: 8px; line-height: 1;">${icone}</div>
                <h2 style="margin: 0 0 10px 0; font-family: var(--font-titulos, sans-serif); color: var(--verde-escuro, #1B4332); font-size: 1.35rem; font-weight: 800;">${titulo}</h2>
                <p style="color: #64748b; font-size: 0.92rem; line-height: 1.5; margin: 0 0 20px 0;">${subtitulo}</p>
                
                <form id="form-feedback-plataforma">
                    <div class="star-rating-input" style="justify-content: center; width: 100%; margin-bottom: 18px; flex-direction: row-reverse; display: flex; gap: 8px;">
                        <input type="radio" id="fb-star5" name="rating" value="5" /><label for="fb-star5" title="5 estrelas - Excelente" style="font-size: 2.8rem; color: #e2e8f0; cursor: pointer; transition: all 0.2s;">★</label>
                        <input type="radio" id="fb-star4" name="rating" value="4" /><label for="fb-star4" title="4 estrelas - Boa" style="font-size: 2.8rem; color: #e2e8f0; cursor: pointer; transition: all 0.2s;">★</label>
                        <input type="radio" id="fb-star3" name="rating" value="3" /><label for="fb-star3" title="3 estrelas - Regular" style="font-size: 2.8rem; color: #e2e8f0; cursor: pointer; transition: all 0.2s;">★</label>
                        <input type="radio" id="fb-star2" name="rating" value="2" /><label for="fb-star2" title="2 estrelas - Ruim" style="font-size: 2.8rem; color: #e2e8f0; cursor: pointer; transition: all 0.2s;">★</label>
                        <input type="radio" id="fb-star1" name="rating" value="1" /><label for="fb-star1" title="1 estrela - Péssima" style="font-size: 2.8rem; color: #e2e8f0; cursor: pointer; transition: all 0.2s;">★</label>
                    </div>
                    <style>
                        #form-feedback-plataforma .star-rating-input input { display: none; }
                        #form-feedback-plataforma .star-rating-input input:checked ~ label,
                        #form-feedback-plataforma .star-rating-input label:hover,
                        #form-feedback-plataforma .star-rating-input label:hover ~ label {
                            color: #F59E0B !important;
                            transform: scale(1.15);
                        }
                        @keyframes fadeInModal {
                            from { opacity: 0; transform: translateY(12px) scale(0.98); }
                            to { opacity: 1; transform: translateY(0) scale(1); }
                        }
                    </style>
                    <textarea id="feedback-mensagem" rows="3" placeholder="Deixe um comentário, crítica ou sugestão de melhoria (opcional)..." style="width: 100%; padding: 12px 14px; border: 1.5px solid #e2e8f0; border-radius: 12px; font-family: inherit; font-size: 0.9rem; resize: vertical; margin-bottom: 20px; box-sizing: border-box; background-color: #f8fafc; outline: none;"></textarea>
                    
                    <div style="display: flex; flex-direction: column; gap: 10px; align-items: center;">
                        <button type="submit" class="btn btn-principal" id="btn-enviar-feedback" style="width: 100%; padding: 13px 20px; border-radius: 50px; font-weight: 700; font-size: 0.95rem; background: var(--verde-escuro, #1B4332); color: #FFEE8C; border: none; cursor: pointer; transition: opacity 0.2s;">Enviar Avaliação</button>
                        <button type="button" id="btn-adiar-feedback" style="background: none; border: none; color: #94a3b8; font-size: 0.82rem; cursor: pointer; text-decoration: underline;">Lembrar mais tarde</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);

        const adiarModal = () => {
            modal.style.display = 'none';
            // Adia por 7 dias para não ser invasivo caso o psicólogo esteja ocupado
            localStorage.setItem('yelo_platform_feedback_adiado_ate', (Date.now() + 7 * 24 * 60 * 60 * 1000).toString());
        };

        const fecharPermanente = () => {
            modal.style.display = 'none';
            localStorage.setItem('yelo_platform_feedback_done', 'true');
            localStorage.removeItem('yelo_platform_feedback_adiado_ate');
        };

        const btnX = document.getElementById('btn-fechar-modal-x');
        if (btnX) btnX.addEventListener('click', adiarModal);

        const btnAdiar = document.getElementById('btn-adiar-feedback');
        if (btnAdiar) btnAdiar.addEventListener('click', adiarModal);

        document.getElementById('form-feedback-plataforma').addEventListener('submit', async function(e) {
            e.preventDefault();
            const ratingInput = document.querySelector('#form-feedback-plataforma input[name="rating"]:checked');
            const feedbackText = document.getElementById('feedback-mensagem').value.trim();
            
            if (!ratingInput) {
                if (window.showToast) window.showToast('Por favor, selecione uma nota de 1 a 5 estrelas.', 'error');
                else alert('Por favor, selecione uma nota de 1 a 5 estrelas.');
                return;
            }

            const ratingValue = parseInt(ratingInput.value, 10);
            const btnEnviar = document.getElementById('btn-enviar-feedback');
            btnEnviar.disabled = true;
            btnEnviar.textContent = 'Enviando...';

            try {
                const API_BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : '';
                const token = localStorage.getItem('Yelo_token');
                
                const res = await fetch(`${API_BASE_URL}/api/psychologists/me/platform-review`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ 
                        rating: ratingValue, 
                        comment: feedbackText 
                    })
                });

                if (res.ok) {
                    // Atualiza cache do psicólogo em memória
                    const psiData = typeof window.getPsychologistData === 'function' ? window.getPsychologistData() : null;
                    if (psiData) {
                        psiData.lastPlatformReview = {
                            rating: ratingValue,
                            createdAt: new Date().toISOString()
                        };
                        psiData.hasPlatformReview = true;
                    }

                    if (ratingValue >= 4) {
                        // Nota boa (4 ou 5) -> Promotor/Satisfeito: nunca mais pergunta
                        fecharPermanente();
                        if (window.showToast) window.showToast('Obrigado pelo seu feedback! Ficamos muito felizes! 💚', 'success');
                    } else {
                        // Nota baixa (1 a 3) -> Fecha e zera o lock para reavaliar no próximo ciclo de 30 dias se ativo
                        modal.style.display = 'none';
                        localStorage.removeItem('yelo_platform_feedback_done');
                        localStorage.removeItem('yelo_platform_feedback_adiado_ate');
                        if (window.showToast) window.showToast('Obrigado pelo feedback! Vamos nos dedicar para melhorar cada vez mais. 💚', 'success');
                    }
                } else {
                    throw new Error('Falha no envio');
                }
            } catch (err) {
                if (window.showToast) window.showToast('Erro ao enviar avaliação. Tente novamente mais tarde.', 'error');
                btnEnviar.disabled = false;
                btnEnviar.textContent = 'Enviar Avaliação';
            }
        });
        
        modal.style.display = 'flex';
    }

    return {
        checkAndShowModal: function() {
            const psychologistData = typeof window.getPsychologistData === 'function' ? window.getPsychologistData() : null;
            if (!psychologistData || !psychologistData.createdAt) return;
            
            // Exibe apenas para profissionais com assinatura ativa (pagantes)
            if (!psychologistData.subscriptionId || psychologistData.status !== 'active') {
                return;
            }

            // Se o usuário adiou recentemente (clicou em "Lembrar mais tarde" ou "X")
            const adiadoAte = localStorage.getItem('yelo_platform_feedback_adiado_ate');
            if (adiadoAte && Date.now() < parseInt(adiadoAte, 10)) {
                return;
            }

            const lastReview = psychologistData.lastPlatformReview;

            if (!lastReview) {
                // CASO 1: Nunca avaliou
                // Aparece após 20 dias da assinatura
                if (localStorage.getItem('yelo_platform_feedback_done')) return;

                const referenceDate = new Date(psychologistData.subscribedAt || psychologistData.createdAt);
                const daysSincePaid = (Date.now() - referenceDate.getTime()) / (1000 * 60 * 60 * 24);
                
                if (daysSincePaid >= 20) {
                    setTimeout(() => abrirModalFeedbackPlataforma(false), 4000); 
                }
                return;
            }

            // CASO 2: Já avaliou com nota BOA (4 ou 5 estrelas)
            // Satisfeito -> Não precisa pedir de novo!
            if (lastReview.rating >= 4) {
                localStorage.setItem('yelo_platform_feedback_done', 'true');
                return;
            }

            // CASO 3: A última nota foi RUIM ou NEUTRA (1, 2 ou 3 estrelas)
            // Reaparece após 30 dias desde a última avaliação ruim se continuar assinante ativo
            const reviewDate = new Date(lastReview.createdAt);
            const daysSinceLastReview = (Date.now() - reviewDate.getTime()) / (1000 * 60 * 60 * 24);

            if (daysSinceLastReview >= 30) {
                // Remove o lock do localStorage para permitir a reavaliação
                localStorage.removeItem('yelo_platform_feedback_done');
                setTimeout(() => abrirModalFeedbackPlataforma(true), 4000);
            }
        }
    };
})();
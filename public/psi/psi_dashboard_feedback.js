/**
 * Arquivo: psi_dashboard_feedback.js
 * Responsabilidade: Isolar a lógica de exibição e submissão do modal de Avaliação de Plataforma (NPS).
 */
window.PsiFeedback = (function() {

    function abrirModalFeedbackPlataforma() {
        let modal = document.getElementById('modal-feedback-plataforma');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-feedback-plataforma';
            modal.className = 'custom-modal-overlay';
            modal.innerHTML = `
                <div class="custom-modal-box" style="text-align: center; max-width: 450px;">
                    <div class="modal-header" style="display: flex; justify-content: flex-end; margin-bottom: -20px;">
                        <button type="button" id="btn-fechar-modal-fb-x" style="background: none; border: none; font-size: 2rem; cursor: pointer; color: #aaa; padding: 0; line-height: 1; z-index: 10;">&times;</button>
                    </div>
                    <div style="font-size: 3.5rem; margin-bottom: 10px;">⭐</div>
                    <h2 style="margin: 0 0 10px 0; font-family: var(--font-titulos); color: var(--verde-escuro);">Como está sendo sua experiência?</h2>
                    <p style="color: #666; font-size: 0.95rem; line-height: 1.5; margin-bottom: 20px;">Você já está na Yelo há alguns dias! Gostaríamos muito de saber o que você está achando da plataforma para continuarmos melhorando.</p>
                    
                    <form id="form-feedback-plataforma">
                        <div class="star-rating-input" style="justify-content: center; width: 100%; margin-bottom: 20px; flex-direction: row-reverse; display: flex; gap: 8px;">
                            <input type="radio" id="fb-star5" name="rating" value="5" /><label for="fb-star5" title="5 estrelas" style="font-size: 3rem; color: #e4e5e9; cursor: pointer; transition: all 0.2s;">★</label>
                            <input type="radio" id="fb-star4" name="rating" value="4" /><label for="fb-star4" title="4 estrelas" style="font-size: 3rem; color: #e4e5e9; cursor: pointer; transition: all 0.2s;">★</label>
                            <input type="radio" id="fb-star3" name="rating" value="3" /><label for="fb-star3" title="3 estrelas" style="font-size: 3rem; color: #e4e5e9; cursor: pointer; transition: all 0.2s;">★</label>
                            <input type="radio" id="fb-star2" name="rating" value="2" /><label for="fb-star2" title="2 estrelas" style="font-size: 3rem; color: #e4e5e9; cursor: pointer; transition: all 0.2s;">★</label>
                            <input type="radio" id="fb-star1" name="rating" value="1" /><label for="fb-star1" title="1 estrela" style="font-size: 3rem; color: #e4e5e9; cursor: pointer; transition: all 0.2s;">★</label>
                        </div>
                        <style>
                            #form-feedback-plataforma .star-rating-input input:checked ~ label,
                            #form-feedback-plataforma .star-rating-input label:hover,
                            #form-feedback-plataforma .star-rating-input label:hover ~ label {
                                color: #FFC107 !important;
                                transform: scale(1.15);
                            }
                        </style>
                        <textarea id="feedback-mensagem" rows="3" placeholder="Deixe um comentário, sugestão ou crítica (opcional)" style="width: 100%; padding: 15px; border: 1px solid #e0e0e0; border-radius: 12px; font-family: var(--font-principal); font-size: 0.95rem; resize: vertical; margin-bottom: 25px; box-sizing: border-box; background-color: #f9fafb;"></textarea>
                        
                        <div style="display: flex; justify-content: center; gap: 15px;">
                            <button type="button" class="btn btn-secundario" id="btn-fechar-feedback" style="padding: 12px 25px; border-radius: 50px; font-weight: bold;">Lembrar depois</button>
                            <button type="submit" class="btn btn-principal" id="btn-enviar-feedback" style="padding: 12px 25px; border-radius: 50px; font-weight: bold;">Enviar Avaliação</button>
                        </div>
                    </form>
                </div>
            `;
            document.body.appendChild(modal);

            const fecharModal = (permanente = false) => {
                modal.style.display = 'none';
                if (permanente) {
                    localStorage.setItem('yelo_platform_feedback_done', 'true');
                } else {
                    const adiarAte = new Date().getTime() + (3 * 24 * 60 * 60 * 1000);
                    localStorage.setItem('yelo_platform_feedback_adiado_ate', adiarAte.toString());
                }
            };

            document.getElementById('btn-fechar-modal-fb-x').addEventListener('click', () => fecharModal(true));
            document.getElementById('btn-fechar-feedback').addEventListener('click', () => fecharModal(false));

            document.getElementById('form-feedback-plataforma').addEventListener('submit', async function(e) {
                e.preventDefault();
                const ratingInput = document.querySelector('#form-feedback-plataforma input[name="rating"]:checked');
                const feedbackText = document.getElementById('feedback-mensagem').value.trim();
                
                if (!ratingInput) {
                    if (window.showToast) window.showToast('Por favor, selecione uma nota de 1 a 5 estrelas.', 'error');
                    return;
                }

                const btnEnviar = document.getElementById('btn-enviar-feedback');
                btnEnviar.disabled = true;
                btnEnviar.textContent = 'Enviando...';

                try {
                    const API_BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : 'http://localhost:3001';
                    const token = localStorage.getItem('Yelo_token');
                    
                    const res = await fetch(`${API_BASE_URL}/api/psychologists/me/platform-review`, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ 
                            rating: ratingInput.value, 
                            comment: feedbackText 
                        })
                    });

                    if (res.ok) {
                        if (window.showToast) window.showToast('Obrigado pelo seu feedback! 💚', 'success');
                        fecharModal(true);
                    } else {
                        throw new Error('Falha no envio');
                    }
                } catch (err) {
                    if (window.showToast) window.showToast('Erro ao enviar avaliação. Tente novamente mais tarde.', 'error');
                    btnEnviar.disabled = false;
                    btnEnviar.textContent = 'Enviar Avaliação';
                }
            });
        }
        
        modal.style.display = 'flex';
    }

    return {
        checkAndShowModal: function() {
            const psychologistData = typeof window.getPsychologistData === 'function' ? window.getPsychologistData() : null;
            if (!psychologistData || !psychologistData.createdAt) return;
            
            if (psychologistData.hasPlatformReview) {
                localStorage.setItem('yelo_platform_feedback_done', 'true');
                return;
            }

            if (localStorage.getItem('yelo_platform_feedback_done')) return;

            const adiadoAte = localStorage.getItem('yelo_platform_feedback_adiado_ate');
            if (adiadoAte && new Date().getTime() < parseInt(adiadoAte)) return;
            
            const accountCreated = new Date(psychologistData.createdAt);
            const daysSinceCreation = (new Date() - accountCreated) / (1000 * 60 * 60 * 24);
            
            if (daysSinceCreation >= 7 && psychologistData.status === 'active') {
                setTimeout(abrirModalFeedbackPlataforma, 4000); 
            }
        }
    };
})();
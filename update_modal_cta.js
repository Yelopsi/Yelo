const fs = require('fs');
const file = '/Users/andehrson/SITES/Yelo/views/psi_perfil_publico.ejs';
let content = fs.readFileSync(file, 'utf8');

// Find the start of the all-reviews-view
const startIndex = content.indexOf('<div id="all-reviews-view"');
if (startIndex === -1) { console.error("Could not find all-reviews-view"); process.exit(1); }

const endReviewModal = content.indexOf('<!-- MODAL DE AVALIAÇÃO -->');

const replacement = `    <div id="all-reviews-view" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #f8f9fa; z-index: 200000; overflow-y: auto;">
        <div style="background: #fff; padding: 15px 20px; border-bottom: 1px solid #eee; position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
            <div style="display: flex; align-items: center; gap: 15px;">
                <button id="btn-close-all-reviews" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #1B4332; display: flex; align-items: center; justify-content: center; padding: 5px;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                </button>
                <h3 style="margin: 0; color: #1B4332; font-size: 1.2rem;">Todas as Avaliações (<span id="all-reviews-count"><%= reviewCount %></span>)</h3>
            </div>
        </div>

        <style>
            .reviews-modal-layout { display: flex; gap: 40px; padding: 20px; max-width: 1200px; margin: 0 auto; box-sizing: border-box; }
            .reviews-modal-list { flex: 1; display: flex; flex-direction: column; gap: 15px; }
            .reviews-modal-sidebar { width: 350px; flex-shrink: 0; display: none; }
            .reviews-modal-mobile-cta-wrapper { display: flex; position: sticky; bottom: 0; background: #fff; border-top: 1px solid #eee; z-index: 20; box-shadow: 0 -4px 15px rgba(0,0,0,0.05); }
            @media (min-width: 993px) {
                .reviews-modal-sidebar { display: block; }
                .reviews-modal-mobile-cta-wrapper { display: none !important; }
            }
        </style>

        <div class="reviews-modal-layout">
            <div class="reviews-modal-list">
                <% if (reviewCount > 0) { %>
                    <% reviews.forEach(review => {
                        let reviewStars = '';
                        for (let i = 1; i <= 5; i++) {
                            reviewStars += \`<span style="color: \${i <= review.rating ? '#f59e0b' : '#e5e7eb'};">★</span>\`;
                        }
                    %>
                    <div style="background: #fff; border: 1px solid #e9ecef; border-radius: 16px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.02); box-sizing: border-box; width: 100%;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                            <h4 style="margin: 0; font-family: var(--font-principal); color: #333; font-size: 1rem;"><%= review.patientName %></h4>
                            <div><%- reviewStars %></div>
                        </div>
                        <p style="margin: 0; color: #555; font-style: italic; font-size: 0.95rem; line-height: 1.5;">"<%= review.comment %>"</p>
                    </div>
                    <% }); %>
                <% } %>
            </div>

            <!-- DESKTOP SIDEBAR -->
            <div class="reviews-modal-sidebar">
                <div class="conversion-card-wrapper" style="position: sticky; top: 100px; align-self: start; z-index: 10;">
                    <div class="conversion-card-modern">
                        <h3 style="font-size: 0.95rem; color: #888; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px 0; font-family: var(--font-principal);">Investimento</h3>
                        <div style="background: #ecfdf5; color: #059669; font-size: 0.75rem; font-weight: 700; padding: 4px 10px; border-radius: 20px; display: inline-block; margin-bottom: 12px; border: 1px solid #a7f3d0;">✓ conversa sem compromisso</div>
                        
                        <div id="price-display-container-reviews">
                            <div class="price-display" style="font-family: var(--font-titulos); font-size: 2.0rem; font-weight: 700; color: var(--verde-escuro); margin: 5px 0 0 0; line-height: 1;"><%= psicologo.valor_sessao_numero ? 'R$ ' + psicologo.valor_sessao_numero.replace('.', ',') : 'R$ 120,00' %></div>
                            <div class="price-suffix" style="font-size: 0.9rem; color: #999; font-weight: 500;">por sessão</div>
                        </div>

                        <div class="conversion-card-details" style="margin: 25px 0; background: #f8f9fa; padding: 20px; border-radius: 16px; display: flex; flex-direction: row; justify-content: center; gap: 15px; flex-wrap: wrap; box-sizing: border-box;">
                            <div class="info-row" style="display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; flex: 1; min-width: 100px;">
                                <div style="width: 40px; height: 40px; background: #e8f5e9; color: #16a34a; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0;">📍</div>
                                <div style="display: flex; flex-direction: column; gap: 4px;">
                                    <span style="font-size: 0.7rem; color: #888; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Localização</span>
                                    <span id="psi-location-reviews" style="font-size: 0.95rem; color: #333; font-weight: 600; line-height: 1.2;"><%= psicologo.cidade ? psicologo.cidade + ", " + psicologo.estado : "Online" %></span>
                                </div>
                            </div>
                            <div class="info-row" style="display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; flex: 1; min-width: 100px;">
                                <div style="width: 40px; height: 40px; background: #e0f2fe; color: #0284c7; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0;">💻</div>
                                <div style="display: flex; flex-direction: column; gap: 4px;">
                                    <span style="font-size: 0.7rem; color: #888; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Atendimento</span>
                                    <span id="psi-modalidade-reviews" style="font-size: 0.95rem; color: #333; font-weight: 600; line-height: 1.2;"><%= psicologo.modalidade === 'presencial' ? 'Presencial' : (psicologo.modalidade === 'hibrido' ? 'Híbrido' : 'Online') %></span>
                                </div>
                            </div>
                        </div>
                        
                        <a id="btn-agendar-whatsapp-reviews" href="#" class="btn btn-principal btn-pulse" target="_blank" rel="noopener noreferrer" style="width: 100%; display: flex; justify-content: center; align-items: center; gap: 10px; padding: 16px; border-radius: 50px; font-size: 1.05rem; box-shadow: 0 6px 20px rgba(27,67,50,0.25); text-decoration: none; font-weight: 700; color: #fff;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                            Conversar com <%= pronome %><%= firstName %>
                        </a>
                        <p class="cta-subtitle" style="font-size: 0.85rem; color: #888; margin-top: 15px; line-height: 1.4;">Clique para enviar um "Oi". Não há cobrança para conversar.</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- MOBILE CTA FOOTER -->
        <div class="reviews-modal-mobile-cta-wrapper">
            <div class="mobile-sticky-cta" style="width: 100%; box-sizing: border-box; flex-direction: column; gap: 12px; padding: 20px 24px calc(24px + env(safe-area-inset-bottom)) 24px; background: transparent;">
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                        <div id="mobile-sticky-rating-reviews" style="font-size: 0.95rem; font-weight: 700; color: #333; display: flex; align-items: center; gap: 4px;">
                            <span style="color: #f59e0b;">⭐</span> <%= reviewCount > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviewCount).toFixed(1).replace('.', ',') : '5,0' %> de 5
                        </div>
                    </div>

                    <div class="mobile-sticky-price" id="price-display-mobile-reviews" style="text-align: right; flex-direction: column; display: flex;">
                        <span class="label" style="font-size: 0.7rem; color: #888; text-transform: uppercase; font-weight: 700;">Por Sessão</span>
                        <span class="value" style="font-size: 1.1rem; font-weight: 700; color: #1B4332;"><%= psicologo.valor_sessao_numero ? 'R$ ' + psicologo.valor_sessao_numero.replace('.', ',') : 'R$ 120,00' %></span>
                    </div>
                </div>

                <a id="btn-agendar-whatsapp-mobile-reviews" href="#" class="btn btn-principal" target="_blank" rel="noopener noreferrer" style="width: 100%; margin: 0; display: flex; justify-content: center; align-items: center;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                    Conversar com <%= pronome %><%= firstName %>
                </a>
                
                <div style="font-size: 0.75rem; color: #888; text-align: center; margin-top: -2px;">
                    Você falará diretamente com <%= firstName %>. Sem compromisso.
                </div>
            </div>
        </div>
    </div>
`;

content = content.substring(0, startIndex) + replacement + content.substring(endReviewModal);
fs.writeFileSync(file, content);

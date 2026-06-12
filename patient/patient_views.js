/**
 * Arquivo: patient_views.js
 * Responsabilidade: Módulo de UI para gerar os cards HTML do painel do paciente.
 */

window.PatientUI = (function() {
    
    function createProCard(pro, isFavorite, formatImageFn) {
        const fotoUrl = formatImageFn(pro.fotoUrl || pro.foto, 'https://placehold.co/400x400/1B4332/FFFFFF?text=Psi');
        const tags = pro.temas_atuacao || pro.temas || [];
        const tagsHtml = tags.slice(0, 3).map(tag => `<span class="tag" style="white-space: nowrap; width: max-content; display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; background-color: #e8f5e9; color: var(--verde-escuro); border: 1px solid #c8e6c9; line-height: 1.2;">${tag}</span>`).join('');
        const priceFormatted = (pro.valor_sessao_numero || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const bio = pro.bio || "Sem biografia.";
        const profileLink = pro.slug ? `/${pro.slug}` : `../perfil_psicologo.html?id=${pro.id}`;

        const heartIcon = isFavorite 
            ? `<div class="heart-icon favorited" data-id="${pro.id}" title="Desfavoritar"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg></div>`
            : `<div class="heart-icon" data-id="${pro.id}" title="Favoritar"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg></div>`;

        return `
        <div class="pro-card-resultado">
            <div class="pro-card-header">
                ${heartIcon}
                <img src="${fotoUrl}" alt="${pro.nome}" class="pro-card-img">
            </div>
            <div class="pro-card-body">
                <div class="pro-info">
                    <h3 style="font-family: var(--font-titulos); font-size: 1.35rem; color: var(--verde-escuro); margin: 0 0 5px 0; font-weight: 700;">${pro.nome}</h3>
                    <div class="crp" style="font-size: 0.85rem; color: #888; margin-bottom: 8px;">CRP ${pro.crp}</div>
                </div>
                <div class="match-reasons" style="margin: 12px 0; display: flex; flex-wrap: wrap; gap: 6px;">
                    ${tagsHtml}
                </div>
                <p class="bio-snippet" style="font-style: italic; color: var(--cinza-texto); flex-grow: 1; margin-bottom: 20px; font-size: 0.95rem; line-height: 1.5;">${bio.length > 100 ? bio.substring(0, 100) + '...' : bio}</p>
                <div class="pro-footer">
                    <div class="price-tag"><span class="label">Valor Sessão</span><span class="value">${priceFormatted}</span></div>
                    <a href="${profileLink}" class="btn btn-principal btn-sm" style="border-radius: 50px; width: max-content; padding: 8px 20px; white-space: nowrap; flex-shrink: 0; line-height: 1;">Ver Perfil</a>
                </div>
            </div>
        </div>`;
    }

    function createReviewCard(review) {
        const renderStars = (rating) => '★'.repeat(rating) + '☆'.repeat(5 - rating);
        return `
        <div class="review-item" style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 20px;">
            <div class="review-header" style="display: flex; align-items: center; gap: 15px; margin-bottom: 10px;">
                <img src="${review.psychologist.fotoUrl || 'https://placehold.co/60x60'}" alt="Foto de ${review.psychologist.nome}" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover;">
                <div><h3 style="margin: 0; font-size: 1.2rem;">${review.psychologist.nome}</h3><span style="font-size: 0.9rem; color: #888;">Avaliado em ${new Date(review.createdAt).toLocaleDateString('pt-BR')}</span></div>
            </div>
            <div class="perfil-rating"><span class="stars" style="color: #f39c12; font-weight: bold;">${renderStars(review.rating)}</span></div>
            <p style="margin-top: 10px;">${review.comment || '<i>Nenhum comentário adicionado.</i>'}</p>
        </div>`;
    }

    return { createProCard, createReviewCard };
})();
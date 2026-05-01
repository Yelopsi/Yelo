document.addEventListener('DOMContentLoaded', async () => {
    const API_BASE_URL = window.API_BASE_URL || 'http://localhost:3001';
    const profileContainer = document.getElementById('profile-page-container');
    const loaderContainer = document.getElementById('loader-container');

    // Pega o slug da URL (ex: yelopsi.com.br/nome-do-psi -> "nome-do-psi")
    const slug = window.location.pathname.split('/').pop();

    if (!slug) {
        showError('Perfil não encontrado.');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/psychologists/slug/${slug}`);
        if (!response.ok) {
            throw new Error('Perfil não encontrado ou indisponível.');
        }
        const psychologist = await response.json();

        // Popula a página com os dados
        populatePage(psychologist);

        // Mostra o conteúdo e esconde o loader
        loaderContainer.style.display = 'none';
        profileContainer.style.display = 'block';

    } catch (error) {
        showError(error.message);
    }

    function showError(message) {
        loaderContainer.innerHTML = `<div class="widget" style="text-align:center; color:red;"><p>${message}</p></div>`;
    }

    function populatePage(psi) {
        // Título da Página
        document.title = `${psi.nome} | Psicólogo(a) na Yelo`;

        // Bloco Principal
        document.getElementById('psi-photo').src = psi.fotoUrl || 'https://placehold.co/180x180/e8f5e9/1B4332?text=Psi';
        document.getElementById('psi-photo').alt = `Foto de ${psi.nome}`;
        document.getElementById('psi-name').textContent = psi.nome;
        document.getElementById('psi-crp').textContent = `CRP: ${psi.crp}`;
        document.getElementById('psi-bio-text').innerHTML = psi.bio ? psi.bio.replace(/\n/g, '<br>') : 'Biografia não informada.';

        // Localização
        document.getElementById('psi-location').textContent = `${psi.cidade || 'Localidade não informada'}, ${psi.estado || 'UF'}`;

        // Preço (Lógica para Sessão vs. Mensal)
        const priceContainer = document.getElementById('price-display-container');
        if (psi.tipo_cobranca === 'mensal' && psi.valor_mensal_numero) {
            priceContainer.innerHTML = `
                <div class="price-display">R$ ${parseFloat(psi.valor_mensal_numero).toFixed(2).replace('.', ',')}</div>
                <div class="price-suffix">por mês</div>
            `;
        } else {
            priceContainer.innerHTML = `
                <div class="price-display">R$ ${parseFloat(psi.valor_sessao_numero || 0).toFixed(2).replace('.', ',')}</div>
                <div class="price-suffix">por sessão</div>
            `;
        }

        // Botão do WhatsApp
        const whatsappLink = `https://api.whatsapp.com/send?phone=55${(psi.telefone || '').replace(/\D/g, '')}&text=Olá, ${psi.nome}! Encontrei seu perfil na Yelo e gostaria de agendar uma consulta.`;
        document.getElementById('btn-agendar-whatsapp').href = whatsappLink;

        // Tags de Especialidades
        const practicesContainer = document.getElementById('practices-container');
        practicesContainer.innerHTML = '';
        const allTags = [
            ...(psi.temas_atuacao || []),
            ...(psi.abordagens_tecnicas || []),
            ...(psi.praticas_inclusivas || [])
        ];
        if (allTags.length > 0) {
            allTags.forEach(tag => {
                const tagElement = document.createElement('div');
                tagElement.className = 'practice-tag';
                tagElement.textContent = tag;
                practicesContainer.appendChild(tagElement);
            });
        } else {
            practicesContainer.innerHTML = '<p>Nenhuma especialidade informada.</p>';
        }

        // Avaliações (simulação, idealmente viria de outra rota)
        populateReviews(psi.reviews || []);

        // Links Sociais
        populateSocialLinks(psi);

        // Configura abas
        setupTabs();
    }

    function populateReviews(reviews) {
        const reviewCountSpan = document.getElementById('review-count');
        const reviewsListContainer = document.getElementById('reviews-list-container');
        reviewCountSpan.textContent = reviews.length;

        if (reviews.length === 0) {
            reviewsListContainer.innerHTML = '<p>Ainda não há avaliações para este profissional.</p>';
            return;
        }

        // Resumo no topo
        const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
        const avgRating = (totalRating / reviews.length).toFixed(1);
        let starsHtml = '';
        for (let i = 1; i <= 5; i++) {
            starsHtml += `<span class="star ${i <= Math.round(avgRating) ? 'filled' : ''}">★</span>`;
        }
        document.getElementById('psi-rating-summary').innerHTML = `${starsHtml} <span class="hero-rating-text">(${avgRating} de 5)</span>`;

        // Lista de avaliações
        reviewsListContainer.innerHTML = '';
        reviews.forEach(review => {
            const reviewCard = document.createElement('div');
            reviewCard.className = 'review-card';
            let reviewStars = '';
            for (let i = 1; i <= 5; i++) {
                reviewStars += `<span class="star ${i <= review.rating ? 'filled' : ''}">★</span>`;
            }
            reviewCard.innerHTML = `
                <div class="review-header">
                    <h4>${review.patientName || 'Anônimo'}</h4>
                    <div class="rating-stars">${reviewStars}</div>
                </div>
                <p class="review-comment">"${review.comment}"</p>
            `;
            reviewsListContainer.appendChild(reviewCard);
        });
    }

    function populateSocialLinks(psi) {
        const container = document.getElementById('psi-social-links');
        container.innerHTML = ''; // Limpa o container

        const socialMap = {
            instagram_url: { base: 'https://instagram.com/', icon: 'instagram' },
            linkedin_url: { base: 'https://linkedin.com/in/', icon: 'linkedin' },
            facebook_url: { base: 'https://facebook.com/', icon: 'facebook' },
        };

        for (const key in socialMap) {
            if (psi[key]) {
                const link = document.createElement('a');
                link.href = socialMap[key].base + psi[key];
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.className = 'icon-btn-modern';
                link.title = `Ver ${socialMap[key].icon}`;
                link.innerHTML = `<svg>...</svg>`; // Adicionar SVGs aqui
                container.appendChild(link);
            }
        }
    }

    function setupTabs() {
        const tabLinks = document.querySelectorAll('.tab-link');
        const tabContents = document.querySelectorAll('.tab-content');

        tabLinks.forEach(link => {
            link.addEventListener('click', () => {
                const tabId = link.dataset.tab;

                // Desativa todos
                tabLinks.forEach(l => l.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));

                // Ativa o clicado
                link.classList.add('active');
                document.getElementById(`tab-content-${tabId}`).classList.add('active');
            });
        });
    }
});
```

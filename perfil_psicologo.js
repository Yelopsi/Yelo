// Arquivo: public/js/perfil_psicologo.js

document.addEventListener('DOMContentLoaded', async () => {
    
    // --- 1. CONFIGURAÇÃO INICIAL ---
    const BASE_URL = (typeof window.API_BASE_URL !== 'undefined') 
        ? window.API_BASE_URL 
        : 'http://localhost:3001';

    const profileContainer = document.getElementById('profile-container');
    const loadingElement = document.getElementById('loading-state');
    const errorElement = document.getElementById('error-state');
    const toastContainer = document.getElementById('toast-container');

    // --- 2. FUNÇÕES AUXILIARES DE UI ---
    const showToast = (message, type = 'success') => {
        if (!toastContainer) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = message;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    };

    const toggleLoading = (isLoading) => {
        if(isLoading) {
            loadingElement.style.display = 'block';
            profileContainer.style.display = 'none';
        } else {
            loadingElement.style.display = 'none';
            profileContainer.style.display = 'block';
            profileContainer.classList.remove('hidden');
            setTimeout(() => profileContainer.style.opacity = '1', 10); // Fade in
        }
    };

    // --- 3. EXTRAIR SLUG DA URL ---
    const extractSlug = () => {
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        let slug = pathParts[pathParts.length - 1];
        if (slug && (slug.endsWith('.html') || slug === 'perfil_psicologo')) {
            const urlParams = new URLSearchParams(window.location.search);
            slug = urlParams.get('slug');
        }
        return slug;
    };

    // --- 4. RENDERIZADORES DE COMPONENTES ---

    // A. Renderiza Estrelas (Média)
    const renderHeroRating = (reviews) => {
        const container = document.getElementById('hero-rating-display');
        if (!reviews || reviews.length === 0) {
            container.innerHTML = '<span class="hero-rating-text">Novo no Yelo</span>';
            return;
        }

        const total = reviews.reduce((acc, r) => acc + r.rating, 0);
        const avg = total / reviews.length;
        const fullStars = Math.round(avg);
        
        let starsHtml = '';
        for(let i=0; i<5; i++) {
            starsHtml += i < fullStars ? '★' : '<span style="color:#ddd">★</span>';
        }

        container.innerHTML = `
            ${starsHtml} 
            <span class="hero-rating-text">(${reviews.length} avaliações)</span>
        `;
    };

    // B. Renderiza Tags (Especialidades, etc)
    const renderTagsSection = (profile) => {
        const createTags = (data) => {
            if (!data || (Array.isArray(data) && data.length === 0)) {
                return '<span style="color:#999; font-style:italic;">Não informado</span>';
            }
            // Garante que seja array, mesmo se vier string do banco
            const list = Array.isArray(data) ? data : (data.split ? data.split(',') : []);
            
            return list.map(item => `<span class="practice-tag">${item.trim()}</span>`).join('');
        };

        const container = document.getElementById('tab-sobre');
        if (container) {
            container.innerHTML = `
                <div class="about-section-modern" style="text-align: left;">
                    <h3 class="practices-title" style="font-family: 'New Kansas', serif; color: var(--verde-escuro); margin-top: 30px;">Especialidades</h3>
                    <div class="practices-container" style="margin-bottom:20px;">${createTags(profile.temas_atuacao)}</div>
                    
                    <h3 class="practices-title" style="font-family: 'New Kansas', serif; color: var(--verde-escuro);">Abordagem</h3>
                    <div class="practices-container" style="margin-bottom:20px;">${createTags(profile.abordagens_tecnicas)}</div>
                    
                    <h3 class="practices-title" style="font-family: 'New Kansas', serif; color: var(--verde-escuro);">Identidade & Vivências</h3>
                    <div class="practices-container">${createTags(profile.praticas_vivencias)}</div>
                </div>
            `;
        }
    };

    // C. Renderiza Redes Sociais (AGORA COM ÍCONES REAIS)
    const renderSocialLinks = (profile) => {
        const container = document.getElementById('psi-social-links');
        container.innerHTML = '';
        
        // SVGs dos ícones
        const icons = {
            instagram: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.5 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z"/></svg>',
            linkedin: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M100.28 448H7.4V148.9h92.88zM53.79 108.1C24.09 108.1 0 83.5 0 53.8a53.79 53.79 0 0 1 107.58 0c0 29.7-24.1 54.3-53.79 54.3zM447.9 448h-92.68V302.4c0-34.7-.7-79.2-48.29-79.2-48.29 0-55.69 37.7-55.69 76.7V448h-92.78V148.9h89.08v40.8h1.3c12.4-23.5 42.69-48.3 87.88-48.3 94 0 111.28 61.9 111.28 142.3V448z"/></svg>',
            facebook: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M504 256C504 119 393 8 256 8S8 119 8 256c0 123.78 90.69 226.38 209.25 245V327.69h-63V256h63v-54.64c0-62.15 37-96.48 93.67-96.48 27.14 0 55.52 4.84 55.52 4.84v61h-31.28c-30.8 0-40.41 19.12-40.41 38.73V256h68.78l-11 71.69h-57.78V501C413.31 482.38 504 379.78 504 256z"/></svg>'
        };

        const networks = [
            { field: 'instagram_url', icon: icons.instagram, urlPrefix: 'https://instagram.com/' },
            { field: 'linkedin_url', icon: icons.linkedin, urlPrefix: 'https://linkedin.com/in/' },
            { field: 'facebook_url', icon: icons.facebook, urlPrefix: 'https://facebook.com/' }
        ];

        let hasLinks = false;
        networks.forEach(net => {
            let userHandle = profile[net.field];
            if (userHandle) {
                // Remove prefixos para garantir link limpo
                userHandle = userHandle.replace(net.urlPrefix, '').replace('https://', '').replace('www.', '');
                
                const link = document.createElement('a');
                link.href = net.urlPrefix + userHandle;
                link.target = '_blank';
                link.className = 'icon-social';
                link.innerHTML = net.icon; // Insere o SVG
                container.appendChild(link);
                hasLinks = true;
            }
        });

        if (!hasLinks) container.style.display = 'none';
    };

    // D. Renderiza Lista de Avaliações
    const renderReviewsList = (reviews) => {
        const listContainer = document.getElementById('reviews-list-container');
        if (!reviews || reviews.length === 0) {
            listContainer.innerHTML = '<p style="text-align:center; color:#777; padding: 20px;">Este profissional ainda não possui avaliações.</p>';
            return;
        }

        listContainer.innerHTML = reviews.map(r => `
            <div style="background: #fff; padding: 15px; border-bottom: 1px solid #eee; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <strong style="color: var(--verde-escuro);">${r.patientName || 'Paciente Yelo'}</strong>
                    <span style="color: #FFC107;">${'★'.repeat(r.rating)}</span>
                </div>
                <p style="color: #555; font-size: 0.95rem; margin: 0;">${r.comment || ''}</p>
                <small style="color: #aaa;">${new Date(r.createdAt).toLocaleDateString()}</small>
            </div>
        `).join('');
    };

    // --- 5. POPULAR PERFIL (CORRIGIDO: FOTO + ERRO FANTASMA) ---
    const populateProfile = (profile) => {
        // 1. GARANTIA: Esconde explicitamente o erro se chegou aqui (Sucesso)
        document.getElementById('error-state').style.display = 'none';
        document.getElementById('error-state').classList.add('hidden');

        // Textos Simples
        document.getElementById('psi-nome').textContent = profile.nome;
        document.getElementById('psi-crp').textContent = profile.crp ? `CRP: ${profile.crp}` : '';
        document.getElementById('psi-modalidade').textContent = 
            (Array.isArray(profile.modalidade) ? profile.modalidade.join(' e ') : profile.modalidade) || 'Online';
        
        // --- CORREÇÃO DA FOTO (MIGRAÇÃO) ---
        // O banco salva "public\uploads\foto.jpg". O navegador precisa de "/uploads/foto.jpg"
        const foto = document.getElementById('psi-foto');
        let photoSrc = profile.fotoUrl;
        
        if (photoSrc) {
            // Corrige barras invertidas do Windows (\ -> /)
            photoSrc = photoSrc.replace(/\\/g, '/');
            // Remove o prefixo 'public/' se existir, pois a pasta public é a raiz do servidor estático
            photoSrc = photoSrc.replace(/^public\//, ''); 
            // Garante que comece com / se não for http
            if (!photoSrc.startsWith('http') && !photoSrc.startsWith('/')) {
                photoSrc = '/' + photoSrc;
            }
        }
        
        // Usa a foto tratada ou o placeholder
        foto.src = photoSrc || "https://placehold.co/180x180/1B4332/FFFFFF?text=Sem+Foto";
        
        // Fallback final se o arquivo não existir
        foto.onerror = () => { 
            foto.src = "https://placehold.co/180x180/1B4332/FFFFFF?text=Sem+Foto"; 
            foto.onerror = null; // Evita loop infinito
        };

        // Bio
        const bioEl = document.getElementById('psi-bio-text');
        bioEl.innerHTML = profile.bio ? profile.bio.replace(/\n/g, '<br>') : '<em>Biografia não informada.</em>';

        // Preço
        const valorEl = document.getElementById('psi-valor');
        if(profile.valor_sessao_numero) {
            valorEl.textContent = `R$ ${parseFloat(profile.valor_sessao_numero).toFixed(2).replace('.', ',')}`;
        } else {
            valorEl.textContent = profile.valor_sessao_faixa || "Sob Consulta";
        }

        // Localização (Cidade/Estado)
        if (profile.cidade && profile.estado) {
            document.getElementById('psi-localizacao-container').style.display = 'block';
            document.getElementById('psi-cidade-estado').textContent = `${profile.cidade} - ${profile.estado}`;
        }

        // WhatsApp
        const btnZap = document.getElementById('btn-agendar-whatsapp');
        if (profile.telefone) {
            const cleanPhone = profile.telefone.replace(/\D/g, '');
            btnZap.href = `https://api.whatsapp.com/send?phone=55${cleanPhone}&text=Olá! Vi seu perfil na Yelo.`;
            btnZap.classList.remove('disabled');
            btnZap.textContent = "Agendar uma conversa";
        } else {
            btnZap.classList.add('disabled');
            btnZap.textContent = 'Contato Indisponível';
            btnZap.href = "#";
        }

        // Renderizações Complexas
        renderTagsSection(profile);
        renderSocialLinks(profile); // Ícones reais
        renderHeroRating(profile.reviews);
        renderReviewsList(profile.reviews);

        // Setup do Formulário de Avaliação (Passando o ID do Psi)
        setupReviewForm(profile.id);
    };

    // --- 6. LÓGICA DE AVALIAÇÃO ---
    const setupReviewForm = (psychologistId) => {
        const form = document.getElementById('form-nova-avaliacao');
        form.onsubmit = async (e) => {
            e.preventDefault();
            const rating = form.querySelector('input[name="rating"]:checked')?.value;
            const comment = form.querySelector('textarea[name="comentario"]').value;

            if (!rating) {
                showToast("Por favor, selecione as estrelas.", "error");
                return;
            }

            // Exemplo de envio (Precisa da rota backend /api/reviews)
            // Aqui estamos simulando o sucesso visualmente
            showToast("Avaliação enviada! Obrigado.", "success");
            
            // Limpa form
            form.reset();
        };
    };

    // --- 7. INICIALIZAÇÃO ---
    const init = async () => {
        toggleLoading(true);
        const slug = extractSlug();

        if (!slug) {
            document.getElementById('error-state').classList.remove('hidden');
            toggleLoading(false);
            return;
        }

        try {
            const res = await fetch(`${BASE_URL}/api/psychologists/slug/${slug}`);
            if (!res.ok) throw new Error("Perfil não encontrado");
            const profileData = await res.json();
            
            populateProfile(profileData);
            toggleLoading(false);

        } catch (err) {
            console.error(err);
            document.getElementById('error-state').classList.remove('hidden');
            document.querySelector('#error-state p').textContent = "Perfil não encontrado ou erro de conexão.";
            toggleLoading(false);
        }
    };

    init();

    // Lógica das Abas
    document.querySelectorAll('.tab-link').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-link').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            e.target.classList.add('active');
            const tabId = e.target.dataset.tab;
            document.getElementById(`tab-${tabId}`).classList.add('active');
        });
    });
});
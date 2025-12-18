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

    // C. Renderiza Redes Sociais
    const renderSocialLinks = (profile) => {
        const container = document.getElementById('psi-social-links');
        container.innerHTML = '';
        
        // Mapa de campos do banco vs Texto do Botão
        const networks = [
            { field: 'instagram_url', label: 'IG', urlPrefix: 'https://instagram.com/' },
            { field: 'linkedin_url', label: 'IN', urlPrefix: 'https://linkedin.com/in/' },
            { field: 'facebook_url', label: 'FB', urlPrefix: 'https://facebook.com/' }
        ];

        let hasLinks = false;
        networks.forEach(net => {
            let userHandle = profile[net.field];
            if (userHandle) {
                // Remove prefixos se o usuário colou a URL inteira
                userHandle = userHandle.replace(net.urlPrefix, '').replace('https://', '');
                
                const link = document.createElement('a');
                link.href = net.urlPrefix + userHandle;
                link.target = '_blank';
                link.className = 'icon-social';
                link.textContent = net.label;
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

    // --- 5. POPULAR PERFIL (PRINCIPAL) ---
    const populateProfile = (profile) => {
        // Textos Simples
        document.getElementById('psi-nome').textContent = profile.nome;
        document.getElementById('psi-crp').textContent = profile.crp ? `CRP: ${profile.crp}` : '';
        document.getElementById('psi-modalidade').textContent = 
            (Array.isArray(profile.modalidade) ? profile.modalidade.join(' e ') : profile.modalidade) || 'Online';
        
        // Foto
        const foto = document.getElementById('psi-foto');
        foto.src = profile.fotoUrl || "https://placehold.co/180x180/1B4332/FFFFFF?text=Sem+Foto";
        foto.onerror = () => { foto.src = "https://placehold.co/180x180/1B4332/FFFFFF?text=Sem+Foto"; };

        // Bio
        const bioEl = document.getElementById('psi-bio-text');
        bioEl.innerHTML = profile.bio ? profile.bio.replace(/\n/g, '<br>') : '<em>Biografia não informada.</em>';

        // Preço
        const valorEl = document.getElementById('psi-valor');
        if(profile.valor_sessao_numero) {
            valorEl.textContent = `R$ ${parseFloat(profile.valor_sessao_numero).toFixed(2).replace('.', ',')}`;
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
        } else {
            btnZap.classList.add('disabled');
            btnZap.textContent = 'Contato Indisponível';
        }

        // Renderizações Complexas
        renderTagsSection(profile);
        renderSocialLinks(profile);
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
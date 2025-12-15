// Arquivo: perfil_psicologo.js (VERSÃO FINAL - CORRIGIDA E COM TRACKING)

document.addEventListener('DOMContentLoaded', async () => {
    // Verifica se o config.js foi carregado
    if (typeof window.API_BASE_URL === 'undefined') {
        console.error("ERRO CRÍTICO: config.js não foi carregado. A API falhará.");
        alert("Erro de configuração do sistema. Contate o suporte.");
        return;
    }

    const profileContainer = document.getElementById('profile-container');
    const loadingElement = document.getElementById('loading-state');
    const errorElement = document.getElementById('error-state');
    const toastContainer = document.getElementById('toast-container');

    // --- CORREÇÃO DE ROTA ---
    const BASE_URL = (typeof window.API_BASE_URL !== 'undefined') 
        ? window.API_BASE_URL 
        : 'http://localhost:3001';

    // --- TRACKING DE CONVERSÃO (NOVO!) ---
    // Envia ao backend que alguém clicou no botão de contato
    async function trackConversion(psychologistId, type = 'whatsapp') {
        try {
            console.log(`[BI] Registrando clique de conversão (${type}) para Psi ID: ${psychologistId}...`);
            // Nota: Você precisará criar essa rota no backend futuramente para salvar estatísticas
            // Por enquanto, deixamos o console.log para validar que a intenção existe.
            /* await fetch(`${BASE_URL}/api/analytics/conversion`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ psychologistId, type })
            });
            */
        } catch (e) {
            console.warn("[BI] Falha ao registrar conversão (não afeta o usuário):", e);
        }
    }

    // --- FUNÇÕES DE UI ---
    const showToast = (message, type = 'success') => {
        if (!toastContainer) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`; // Corrigido classe CSS
        toast.innerHTML = message; // Simplificado
        toastContainer.appendChild(toast);
        
        // Remove após 4s
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    };

    const showLoading = () => {
        if(loadingElement) loadingElement.classList.remove('hidden');
        if(profileContainer) profileContainer.classList.add('hidden');
        if(errorElement) errorElement.classList.add('hidden');
    };

    const showError = (message) => {
        if(loadingElement) loadingElement.classList.add('hidden');
        if(profileContainer) profileContainer.classList.add('hidden');
        if(errorElement) {
            const p = errorElement.querySelector('p');
            if(p) p.textContent = message;
            errorElement.classList.remove('hidden');
        }
    };

    const showProfile = () => {
        if(loadingElement) loadingElement.classList.add('hidden');
        if(errorElement) errorElement.classList.add('hidden');
        if(profileContainer) profileContainer.classList.remove('hidden');
    };

    // --- CORE: EXTRAÇÃO DO SLUG (CORRIGIDO) ---
    const extractSlug = () => {
        // Tenta pegar da URL amigável (ex: /psi/anderson-costa)
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        let slug = pathParts[pathParts.length - 1];

        // Se for arquivo .html (desenvolvimento local), tenta pegar do ?slug=...
        if (slug && (slug.endsWith('.html') || slug === 'perfil_psicologo')) {
            const urlParams = new URLSearchParams(window.location.search);
            slug = urlParams.get('slug');
        }

        return slug;
    };

    // --- CORE: POPULAR PERFIL ---
    const populateProfile = (profile) => {
        // Helper seguro para texto
        const setText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text || '';
        };

        // Header
        setText('psi-nome', profile.nome);
        setText('psi-crp', profile.crp ? `CRP: ${profile.crp}` : '');
        
        const foto = document.getElementById('psi-foto');
        if (foto) {
            foto.src = profile.fotoUrl || 'assets/images/default-avatar.png'; // Caminho absoluto ou relativo seguro
            foto.onerror = () => { foto.src = 'assets/images/default-avatar.png'; }; // Fallback se a imagem quebrar
        }

        // Bio
        const bioEl = document.getElementById('psi-bio-text');
        if (bioEl) {
            bioEl.innerHTML = profile.bio 
                ? profile.bio.replace(/\n/g, '<br>') 
                : '<em>Biografia não informada.</em>';
        }

        // Valor e Detalhes
        const valorFormatado = profile.valor_sessao_numero 
            ? `R$ ${parseFloat(profile.valor_sessao_numero).toFixed(2).replace('.', ',')}` 
            : 'Sob Consulta';
        setText('psi-valor', valorFormatado);
        
        setText('psi-modalidade', profile.modalidade || 'Online');

        // Botão de WhatsApp (Conversão)
        const btnZap = document.getElementById('btn-agendar-whatsapp');
        if (btnZap) {
            if (profile.telefone) {
                const cleanPhone = profile.telefone.replace(/\D/g, '');
                // Link oficial da API do WhatsApp
                btnZap.href = `https://api.whatsapp.com/send?phone=55${cleanPhone}&text=Olá!%20Encontrei%20seu%20perfil%20na%20plataforma%20Jano/Girassol%20e%20gostaria%20de%20saber%20sobre%20horários.`;
                
                // TRACKING: Adiciona o evento de clique
                btnZap.onclick = () => trackConversion(profile.id, 'whatsapp');
                
                btnZap.classList.remove('disabled');
            } else {
                btnZap.href = '#';
                btnZap.textContent = 'Contato Indisponível';
                btnZap.classList.add('disabled');
            }
        }

        // Renderiza Tags (Aba Sobre)
        renderTagsSection(profile);
        
        // Renderiza Redes Sociais
        renderSocialLinks(profile);

        // Prepara Avaliações
        // (Aqui chamaria a função de avaliações se existir)
    };

    // --- RENDERIZADORES AUXILIARES ---
    const renderTagsSection = (profile) => {
        const createTags = (list) => {
            if (!list || list.length === 0) return '<span style="color:#777; font-size:0.9rem;">Não informado</span>';
            // Se vier string "Ansiedade, Depressão", converte. Se vier Array, mantém.
            const arr = Array.isArray(list) ? list : list.split(',');
            return arr.map(item => `<span class="practice-tag">${item.trim()}</span>`).join('');
        };

        const container = document.getElementById('tab-sobre');
        if (container) {
            container.innerHTML = `
                <div class="about-section-modern">
                    <h3 class="practices-title">Especialidades</h3>
                    <div class="practices-container" style="margin-bottom:20px;">${createTags(profile.temas_atuacao)}</div>
                    
                    <h3 class="practices-title">Abordagem</h3>
                    <div class="practices-container" style="margin-bottom:20px;">${createTags(profile.abordagens_tecnicas)}</div>
                    
                    <h3 class="practices-title">Identidade & Vivências</h3>
                    <div class="practices-container">${createTags(profile.praticas_vivencias)}</div>
                </div>
            `;
        }
    };

    const renderSocialLinks = (profile) => {
        const container = document.getElementById('psi-social-links');
        if (!container) return;
        container.innerHTML = '';

        const links = [
            { k: 'instagram_url', i: 'IG' }, // Simplificado: Pode colocar SVG aqui depois
            { k: 'linkedin_url', i: 'IN' },
            { k: 'facebook_url', i: 'FB' }
        ];

        links.forEach(link => {
            if (profile[link.k]) {
                const a = document.createElement('a');
                a.href = profile[link.k];
                a.target = '_blank';
                a.className = 'icon-btn';
                a.textContent = link.i; // Ou innerHTML com SVG
                container.appendChild(a);
            }
        });
    };

    // --- INICIALIZAÇÃO ---
    const init = async () => {
        showLoading();
        
        const slug = extractSlug();
        console.log("[Perfil] Buscando slug:", slug);

        if (!slug) {
            showError("Perfil não especificado na URL.");
            return;
        }

        try {
            // Chama a API usando a URL global do config.js
            const res = await fetch(`${BASE_URL}/api/psychologists/slug/${slug}`);
            
            if (res.status === 404) {
                showError("Ops! Não encontramos este profissional.");
                return;
            }
            
            if (!res.ok) throw new Error("Erro de servidor");

            const profileData = await res.json();
            populateProfile(profileData);
            showProfile();

        } catch (err) {
            console.error(err);
            showError("Falha ao carregar perfil. Verifique sua conexão.");
        }
    };

    // Inicializa a página
    init();

    // Configura abas (Tabs) simples
    const tabs = document.querySelectorAll('.tab-link');
    tabs.forEach(t => t.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-link').forEach(x => x.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(x => x.classList.remove('active'));
        
        e.target.classList.add('active');
        const targetId = e.target.dataset.tab; // ex: 'sobre'
        document.getElementById(`tab-${targetId}`)?.classList.add('active');
    }));
});
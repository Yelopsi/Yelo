// Arquivo: psi_dashboard.js (VERSÃO FINAL 2.1)

document.addEventListener('DOMContentLoaded', function() {
    console.log("--- SISTEMA Yelo V2.1 INICIADO ---");
    
    let psychologistData = null; 
    
    // Variável para guardar qual plano o usuário está tentando assinar no modal
    let currentPlanAttempt = '';

    // Variável global temporária para saber qual botão disparou a ação
    let btnReativacaoAtual = null;

    const mainContent = document.getElementById('main-content');
    const toastContainer = document.getElementById('toast-container');
    
    // Estado global para contar conversas não lidas
    window.psiUnreadConversations = new Set();

    // --- ESTILOS GLOBAIS (BADGE + BLOQUEIO) ---
    const globalStyles = document.createElement('style');
    globalStyles.innerHTML = `
        /* BADGE DA SIDEBAR */
        .sidebar-badge {
            background-color: #FFEE8C; /* Amarelo Yelo */
            color: #1B4332; /* Verde Yelo */
            border-radius: 50%;
            min-width: 18px;
            height: 18px;
            padding: 0 4px;
            position: absolute;
            right: 15px;
            top: 50%;
            transform: translateY(-50%);
            display: none;
            box-shadow: 0 0 0 1px #fff;
            font-size: 11px;
            font-weight: 800;
            align-items: center;
            justify-content: center;
            z-index: 10;
        }
        .sidebar-badge.visible { display: flex; }
        .sidebar-nav li a { position: relative; }

        /* MODO RESTRITO (SEM PLANO) - Substitui o antigo Lock Overlay */
        .dashboard-main.restricted-mode button, 
        .dashboard-main.restricted-mode input, 
        .dashboard-main.restricted-mode textarea, 
        .dashboard-main.restricted-mode select, 
        .dashboard-main.restricted-mode a {
            pointer-events: none !important;
            opacity: 0.5 !important;
            cursor: not-allowed !important;
            filter: grayscale(100%);
        }

        /* Banner Flutuante de Restrição */
        .restriction-floating-banner {
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            background-color: #1B4332;
            color: white;
            padding: 15px 30px;
            border-radius: 50px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 20px;
            font-size: 1rem;
            animation: fadeInUp 0.5s ease-out;
            width: max-content;
            max-width: 90%;
            border: 1px solid #FFEE8C;
        }
        
        .restriction-floating-banner button {
            background: #FFEE8C;
            color: #1B4332;
            border: none;
            padding: 8px 20px;
            border-radius: 20px;
            font-weight: 800;
            cursor: pointer;
            font-size: 0.9rem;
            transition: transform 0.2s;
            pointer-events: auto !important; /* Garante clique */
            opacity: 1 !important;
            filter: none !important;
        }
        
        .restriction-floating-banner button:hover {
            transform: scale(1.05);
        }

        @keyframes fadeInUp {
            from { opacity: 0; transform: translate(-50%, 20px); }
            to { opacity: 1; transform: translate(-50%, 0); }
        }

        /* ANIMAÇÃO PULSE (BOTÃO DESTAQUE) */
        @keyframes pulse-green {
            0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(27, 67, 50, 0.7); }
            70% { transform: scale(1.03); box-shadow: 0 0 0 10px rgba(27, 67, 50, 0); }
            100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(27, 67, 50, 0); }
        }
        .btn-pulse-effect {
            animation: pulse-green 2s infinite;
        }
    `;
    document.head.appendChild(globalStyles);

    // Função para controlar a badge no menu
    function updateSidebarBadge(pageName, show) {
        const link = document.querySelector(`.sidebar-nav a[data-page="${pageName}"]`);
        if (!link) return;
        
        let badge = link.querySelector('.sidebar-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'sidebar-badge';
            link.appendChild(badge);
        }
        
        if (show) {
            const count = window.psiUnreadConversations.size;
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : count;
                badge.classList.add('visible');
            } else {
                badge.classList.remove('visible');
            }
        } else {
            badge.classList.remove('visible');
            badge.textContent = '';
        }
    }

    // --- LÓGICA DO MENU MOBILE ---
    const toggleBtn = document.getElementById('toggleSidebar');
    const sidebar = document.querySelector('.dashboard-sidebar');
    
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('is-open');
        });
        
        // Fecha ao clicar fora
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 992 && 
                sidebar.classList.contains('is-open') && 
                !sidebar.contains(e.target) && 
                !toggleBtn.contains(e.target)) {
                sidebar.classList.remove('is-open');
            }
        });
    }

    // --- LÓGICA DE UPLOAD NA SIDEBAR ---
    const sidebarTrigger = document.getElementById('sidebar-photo-trigger');
    const sidebarInput = document.getElementById('sidebar-photo-input');

    if (sidebarTrigger && sidebarInput) {
        sidebarTrigger.onclick = () => sidebarInput.click();

        sidebarInput.onchange = async (e) => {
            if (e.target.files[0]) {
                const fd = new FormData();
                fd.append('foto', e.target.files[0]);
                
                showToast('Atualizando foto...', 'info');

                try {
                    const res = await apiFetch(`${API_BASE_URL}/api/psychologists/me/foto`, { 
                        method: 'POST', body: fd 
                    });
                    if (res.ok) {
                        const d = await res.json();
                        if(psychologistData) psychologistData.fotoUrl = d.fotoUrl;
                        atualizarInterfaceLateral(); // Atualiza a imagem na hora
                        showToast('Foto atualizada!', 'success');
                    } else {
                        // Captura o erro retornado pelo backend
                        const errData = await res.json().catch(() => ({}));
                        throw new Error(errData.error || 'Erro ao enviar foto.');
                    }
                } catch (err) {
                    console.error(err);
                    // Mostra a mensagem real do erro (ex: "Arquivo muito grande")
                    showToast(err.message || 'Erro ao enviar foto.', 'error');
                }
            }
        };
    }

    // --- LÓGICA DO BOTÃO SAIR (LOGOUT) ---
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.onclick = function() {
            // 1. Feedback visual (opcional, mas bom para mobile)
            this.textContent = "Saindo...";
            
            // 2. Remove o "crachá" de acesso (Token)
            localStorage.removeItem('Yelo_token');
            
            // 3. Redireciona imediatamente para o Login
            window.location.href = '/';
        };
    }

    // BOTÃO X FECHAR MODAL (Lógica Global Segura)
    const btnCloseX = document.getElementById('btn-close-modal-x');
    const modalPagamento = document.getElementById('payment-modal');

    if (btnCloseX && modalPagamento) {
        btnCloseX.addEventListener('click', function(e) {
            e.preventDefault();
            modalPagamento.style.setProperty('display', 'none', 'important');
        });
    }
    
    // BOTÃO APLICAR CUPOM (Lógica dentro do Modal)
    const btnAplicarModal = document.getElementById('btn-aplicar-cupom-modal');
    if (btnAplicarModal) {
        btnAplicarModal.addEventListener('click', async (e) => {
            e.preventDefault();
            const cupomVal = document.getElementById('modal-cupom-input').value;
            if(!cupomVal || !currentPlanAttempt) return;

            // Feedback visual
            btnAplicarModal.textContent = "...";
            
            // Reinicia o pagamento com o cupom aplicado
            try {
                // Fechamos o modal visualmente por 1s ou apenas recarregamos o elemento
                await window.iniciarPagamento(currentPlanAttempt, { textContent: '', tagName: 'BUTTON' }, cupomVal);
                // Nota: iniciarPagamento já cuida de remontar o Stripe Element
            } catch (err) {
                console.error(err);
            } finally {
                btnAplicarModal.textContent = "Aplicar";
            }
        });
    }


    // --- HELPERS E FETCH ---
    function showToast(message, type = 'success') {
        if (!toastContainer) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }

    function formatImageUrl(path) {
        if (!path) return 'https://placehold.co/70x70/1B4332/FFFFFF?text=Psi';
        if (path.startsWith('http')) return path; 
        let cleanPath = path.replace(/\\/g, '/');
        if (cleanPath.includes('uploads/')) cleanPath = cleanPath.substring(cleanPath.lastIndexOf('uploads/'));
        if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;
        return `${API_BASE_URL}${cleanPath}`;
    }

    async function apiFetch(url, options = {}) {
        const token = localStorage.getItem('Yelo_token');
        if (!token) throw new Error("Token não encontrado.");
        const headers = { 'Authorization': `Bearer ${token}`, ...options.headers };
        if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
        const response = await fetch(url, { ...options, headers });
        if (response.status === 401) {
            localStorage.removeItem('Yelo_token');
            window.location.href = '/';
            throw new Error("Sessão expirada.");
        }
        return response;
    }

    async function fetchPsychologistData() {
        const token = localStorage.getItem('Yelo_token');
        if (!token) { window.location.href = '/'; return false; }
        try {
            // Adicionado timestamp (?t=...) para evitar que o navegador use dados velhos do cache
            const response = await fetch(`${API_BASE_URL}/api/psychologists/me?t=${new Date().getTime()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                psychologistData = await response.json();

                atualizarInterfaceLateral(); 
                return true;
            }
            throw new Error("Token inválido");
        } catch (error) {
            localStorage.removeItem('Yelo_token');
            window.location.href = '/';
            return false;
        }
    }

    function atualizarInterfaceLateral() {
        if (!psychologistData) return;
        const nameEl = document.getElementById('psi-sidebar-name');
        const imgEl = document.getElementById('psi-sidebar-photo');
        if(nameEl) nameEl.textContent = psychologistData.nome;
        if(imgEl) {
            imgEl.src = formatImageUrl(psychologistData.fotoUrl);
            // Correção para imagem quebrada (404)
            imgEl.onerror = function() { this.src = 'https://placehold.co/70x70/1B4332/FFFFFF?text=Psi'; };
        }
        const btnLink = document.getElementById('btn-view-public-profile');
        if(btnLink && psychologistData.slug) btnLink.href = `/${psychologistData.slug}`;

        // --- NOVO: Renderiza as badges ---
        if (psychologistData.badges) {
            renderSidebarBadges(psychologistData.badges);
        }
    }

    function renderSidebarBadges(badgesData) {
        const container = document.getElementById('sidebar-badges-container');
        if (!container || !badgesData) return;
    
        let html = '';
        const badgeInfo = {
            autentico: { emoji: '🛡️', title: 'Autêntico: Perfil 100% completo e verificado.' },
            semeador: { emoji: '🌱', title: 'Semeador: Produz conteúdo e educa a audiência.' },
            voz_ativa: { emoji: '💬', title: 'Voz Ativa: Acolhe e responde dúvidas na Comunidade.' },
            pioneiro: { emoji: '🏅', title: 'Pioneiro: Um dos primeiros membros da Yelo.' }
        };
    
        // Ordem de exibição preferencial
        const badgeOrder = ['autentico', 'semeador', 'voz_ativa', 'pioneiro'];
    
        badgeOrder.forEach(key => {
            const badgeValue = badgesData[key];
            if (badgeValue) {
                const info = badgeInfo[key];
                let finalTitle = info.title;
                let cssClass = `badge-${key}`;
    
                // Se for badge com nível (string), usa a cor do nível
                if (typeof badgeValue === 'string') {
                    const nivel = badgeValue; // bronze, prata, ouro
                    const label = nivel.charAt(0).toUpperCase() + nivel.slice(1);
                    finalTitle = `${info.title} (Nível ${label})`;
                    cssClass = `badge-${nivel}`; // Usa a cor do nível (ex: badge-bronze)
                }
    
                html += `
                    <div class="badge-item ${cssClass}" title="${finalTitle}">
                        <span class="badge-icon">${info.emoji}</span>
                    </div>
                `;
            }
        });
    
        container.innerHTML = html;
    }

    function updateGamificationWidgets(user, isOverview = false) {
        if (!user) return;

        const level = user.authority_level || 'nivel_iniciante';
        const badges = user.badges || {};
        const currentXP = user.xp || 0;

        const LEVELS = [
            { slug: 'nivel_iniciante',    min: 0,      label: 'Iniciante' },
            { slug: 'nivel_verificado',   min: 500,    label: 'Verificado' },
            { slug: 'nivel_ativo',        min: 1500,   label: 'Ativo' },
            { slug: 'nivel_especialista', min: 5000,   label: 'Especialista' },
            { slug: 'nivel_mentor',       min: 15000,  label: 'Mentor' }
        ];

        const currentLevelObj = LEVELS.find(l => l.slug === level) || LEVELS[0];
        const currentIdx = LEVELS.indexOf(currentLevelObj);
        const nextLevelObj = LEVELS[currentIdx + 1];
        
        const levelDisplay = document.getElementById('current-level-display');
        if(levelDisplay) levelDisplay.textContent = currentLevelObj.label;
        
        const xpBarFill = document.getElementById('xp-bar-fill');
        const xpProgressText = document.getElementById('xp-progress-text');
        const xpCurrentLabel = document.getElementById('xp-current-level-label');
        const xpNextLabel = document.getElementById('xp-next-level-label');

        if (nextLevelObj) {
            const xpForLevel = currentXP - currentLevelObj.min;
            const xpTotalForNext = nextLevelObj.min - currentLevelObj.min;
            const progressPercent = Math.min(100, (xpForLevel / xpTotalForNext) * 100);
            
            if(xpBarFill) xpBarFill.style.width = `${progressPercent}%`;
            if(xpProgressText) xpProgressText.textContent = `${currentXP} / ${nextLevelObj.min} XP`;
            if(xpCurrentLabel) xpCurrentLabel.textContent = `Nível ${currentIdx + 1}`;
            if(xpNextLabel) xpNextLabel.textContent = `Nível ${currentIdx + 2}`;
        } else { // Nível Máximo
            if(xpBarFill) xpBarFill.style.width = '100%';
            if(xpProgressText) xpProgressText.textContent = `${currentXP} XP`;
            if(xpCurrentLabel) xpCurrentLabel.textContent = `Nível ${currentIdx + 1}`;
            if(xpNextLabel) xpNextLabel.textContent = 'Máximo';
        }

        const nextLevelInfo = document.getElementById('next-level-info');
        const nextLevelText = document.getElementById('next-level-text');
        
        if (nextLevelInfo && nextLevelText) {
            let msg = "";
            if (nextLevelObj) {
                const xpFaltante = nextLevelObj.min - currentXP;
                
                if (isOverview) {
                    // Versão Resumida (Visão Geral)
                    msg = `Faltam <strong>${xpFaltante} XP</strong> para ${nextLevelObj.label}`;
                } else {
                    // Versão Completa (Jornada)
                    msg = `Faltam <strong>${xpFaltante} XP</strong> para o nível <strong>${nextLevelObj.label}</strong>.`;
                    if (level === 'nivel_iniciante') {
                        msg += "<br>Dica: Complete seu perfil para ganhar 500 XP de uma vez!";
                    } else {
                        msg += "<br>Dica: Escreva um artigo (+50 XP) ou responda dúvidas (+20 XP).";
                    }
                }
            } else {
                msg = "Parabéns! Você atingiu o nível máximo de autoridade na Yelo. Mantenha seu status com conteúdos de qualidade.";
                nextLevelInfo.style.background = "#FFFDE7";
                nextLevelInfo.style.borderColor = "#FDD835";
                nextLevelInfo.style.color = "#F57F17";
            }
            nextLevelText.innerHTML = msg;
        }

        const updateBadgeCard = (elementId, level, progressData) => {
            const el = document.getElementById(elementId);
            if (!el) return;
            const statusEl = el.querySelector('.badge-status');
            const progressContainer = el.querySelector('.badge-progress-container');
            const progressBar = el.querySelector('.badge-progress-bar');
            const progressText = el.querySelector('.badge-progress-text');
            el.classList.remove('unlocked', 'locked', 'bronze', 'prata', 'ouro', 'unico');
            if (level) {
                el.classList.add('unlocked', typeof level === 'string' ? level : 'unico');
                if(statusEl) statusEl.textContent = typeof level === 'string' ? `${level.charAt(0).toUpperCase() + level.slice(1)}` : "Conquistado";
            } else {
                el.classList.add('locked');
                if(statusEl) statusEl.textContent = "Bloqueado";
            }
            if (progressContainer && progressData) {
                progressContainer.style.display = 'block';
                const percent = Math.min(100, (progressData.current / progressData.next) * 100);
                if(progressBar) progressBar.style.width = `${percent}%`;
                if(progressText) progressText.textContent = progressData.tier === 'max' ? 'Nível Máximo!' : `${progressData.current}/${progressData.next} para ${progressData.tier}`;
            } else if (progressContainer) {
                progressContainer.style.display = 'none';
            }
        };

        const semeadorProg = badges.semeador_progress || { current: 0, next: 1, tier: 'Bronze' };
        updateBadgeCard('badge-semeador', badges.semeador, semeadorProg);
        const vozProg = badges.voz_ativa_progress || { current: 0, next: 10, tier: 'Bronze' };
        updateBadgeCard('badge-voz', badges.voz_ativa, vozProg);
        const autenticoProg = badges.autentico ? { current: 1, next: 1, tier: 'max' } : { current: 0, next: 1, tier: 'Conquistar' };
        updateBadgeCard('badge-autentico', badges.autentico, autenticoProg);
        const pioneiroProg = badges.pioneiro ? { current: 1, next: 1, tier: 'max' } : { current: 0, next: 1, tier: 'Conquistar' };
        updateBadgeCard('badge-pioneiro', badges.pioneiro, pioneiroProg);
    }

    // --- FUNÇÃO DE BLOQUEIO GERAL (NOVA) ---
    function verificarBloqueioGeral(url) {
        if (!psychologistData) return;

        // Páginas permitidas mesmo sem plano (para o usuário poder pagar)
        const paginasPermitidas = ['psi_assinatura.html']; 

        // Verifica se tem plano válido (se plano for null/vazio, considera inativo)
        const temPlano = psychologistData.plano && psychologistData.plano.trim().length > 0;
        
        const mainEl = document.querySelector('.dashboard-main');
        if (!mainEl) return;
        
        // 1. Limpa bloqueios anteriores (para quando navegar para página permitida)
        mainEl.classList.remove('blocked-view');
        mainEl.classList.remove('restricted-mode');
        
        const existingOverlay = document.querySelector('.dashboard-lock-overlay');
        if (existingOverlay) existingOverlay.remove();
        
        const existingBanner = document.querySelector('.restriction-floating-banner');
        if (existingBanner) existingBanner.remove();

        // 2. Aplica bloqueio se NÃO tem plano e NÃO está na página de assinatura
        if (!temPlano && !paginasPermitidas.includes(url)) {
            mainEl.classList.add('restricted-mode');
            
            const banner = document.createElement('div');
            banner.className = 'restriction-floating-banner';
            banner.innerHTML = `
                <span>🔒 Modo de visualização. Ative seu plano para interagir.</span>
                <button onclick="document.querySelector('a[data-page=\\'psi_assinatura.html\\']').click()">Ver Planos</button>
            `;
            document.body.appendChild(banner);
        }
    }

    function loadPage(url) {
        if (!url) return;

        // --- FIX CRÍTICO: Limpeza de recursos da página anterior ---
        // Garante que o socket do chat seja morto ANTES de carregar qualquer outra coisa.
        if (typeof window.cleanupPsiChat === 'function') {
            console.log("Limpando chat anterior...");
            window.cleanupPsiChat();
            window.cleanupPsiChat = null; // Remove a referência para não chamar de novo
        }

        // Salva a página atual para persistir após o refresh
        localStorage.setItem('yelo_last_psi_page', url);
        // Spinner de carregamento entre páginas
        mainContent.innerHTML = `
            <div class="loader-wrapper" style="height: 100%; min-height: 400px; align-items: center;">
                <div class="loader-spinner"></div>
            </div>`;
        document.querySelectorAll('.sidebar-nav li').forEach(li => li.classList.remove('active'));
        const activeLink = document.querySelector(`.sidebar-nav a[data-page="${url}"]`);
        if (activeLink) activeLink.closest('li').classList.add('active');

        // --- OTIMIZAÇÃO: PRÉ-FETCH DE DADOS (Paralelismo) ---
        // Dispara a busca de dados IMEDIATAMENTE, sem esperar o HTML carregar
        let dataPromise = null;
        if (url.includes('psi_blog.html')) { 
             dataPromise = apiFetch(`${API_BASE_URL}/api/psychologists/me/posts?page=1&limit=3`).then(r => r.ok ? r.json() : null).catch(() => null);
        } else if (url.includes('psi_comunidade.html')) {
             dataPromise = apiFetch(`${API_BASE_URL}/api/qna?page=1&limit=15`).then(r => r.ok ? r.json() : null).catch(() => null);
        } else if (url.includes('psi_forum.html')) {
             // Busca 4 itens (3 para exibir + 1 para checar se tem mais)
             dataPromise = apiFetch(`${API_BASE_URL}/api/forum/posts?filter=populares&search=&page=1&limit=4&pageSize=3`).then(r => r.ok ? r.json() : null).catch(() => null);
        } else if (url.includes('psi_caixa_de_entrada.html')) {
             dataPromise = apiFetch(`${API_BASE_URL}/api/messages?contactType=admin`).then(r => r.ok ? r.json() : null).catch(() => null);
        }

        // Se for a caixa de entrada, remove a badge
        if (url.includes('caixa_de_entrada')) {
            window.psiUnreadConversations.clear();
            updateSidebarBadge('psi_caixa_de_entrada.html', false);
        }

        fetch(url).then(r => r.ok ? r.text() : Promise.reject(url))
            .then(html => {
                mainContent.innerHTML = html;
                
                // --- VERIFICAÇÃO DE BLOQUEIO ---
                verificarBloqueioGeral(url);
                
                if (url.includes('jornada')) {
                    if (psychologistData) updateGamificationWidgets(psychologistData);
                }
                else if (url.includes('meu_perfil')) inicializarLogicaDoPerfil();
                else if (url.includes('visao_geral')) inicializarVisaoGeral();
                else if (url.includes('assinatura')) inicializarAssinatura();
                else if (url.includes('comunidade')) inicializarComunidade(dataPromise); // Passa a promessa
                else if (url.includes('caixa_de_entrada')) inicializarCaixaEntrada(dataPromise); // Passa a promessa
                else if (url.includes('psi_hub')) inicializarHubComunidade(); 
                else if (url.includes('psi_blog')) inicializarBlog(dataPromise); // Passa a promessa
                else if (url.includes('psi_forum')) inicializarForum(dataPromise); // Passa a promessa
                // Adicione outras inicializações de página aqui
            })
            .catch(e => mainContent.innerHTML = `<p>Erro ao carregar: ${e}</p>`);
    }

    // --- LÓGICA DE PAGAMENTO ---

    window.iniciarPagamento = async function(planType, btnElement, cupomForce = null) {
        // Guarda qual plano está sendo tentado para caso use o cupom
        currentPlanAttempt = planType;
        
        // Se btnElement não for um elemento DOM real (chamada via código), simulamos um obj
        const btn = btnElement.tagName ? btnElement : { textContent: '', disabled: false };
        
        const originalText = btn.textContent;
        if(btn.tagName) {
            btn.textContent = "Carregando...";
            btn.disabled = true;
        }

        // Abre o modal imediatamente para o usuário preencher os dados
        abrirModalAsaas(planType, cupomForce);
        
        // Restaura botão
        if(btn.tagName) {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    };

    function abrirModalAsaas(planType, cupomPreenchido) {
        const modal = document.getElementById('payment-modal');
        const form = document.getElementById('payment-form');
        const btnSubmit = document.getElementById('btn-confirmar-stripe');
        const msgDiv = document.getElementById('payment-message');
        
        // Elementos novos
        const stepMethod = document.getElementById('step-payment-method');
        const btnSelectCard = document.getElementById('btn-select-card');
        const btnSelectPix = document.getElementById('btn-select-pix');
        const btnBackMethod = document.getElementById('btn-back-method');
        
        const creditSection = document.getElementById('credit-card-section');
        const pixResult = document.getElementById('pix-result-container');
        const customerSection = document.getElementById('customer-data-section');
        const securityBadges = document.getElementById('security-badges');
        
        let currentMethod = 'CREDIT_CARD';

        if (!modal) return;

        modal.style.display = 'flex';
        modal.style.opacity = 1;
        modal.style.visibility = 'visible';
        
        // Reset UI
        if(msgDiv) msgDiv.classList.add('hidden');
        stepMethod.style.display = 'block';
        form.style.display = 'none';
        pixResult.style.display = 'none';
        
        // Lógica de Abas
        const setTab = (method) => {
            currentMethod = method;
            stepMethod.style.display = 'none';
            form.style.display = 'block';
            customerSection.style.display = 'flex';

            if (method === 'CREDIT_CARD') {
                creditSection.style.display = 'flex';
                securityBadges.style.display = 'block';
                btnSubmit.textContent = "Pagar com Cartão";
                document.getElementById('card-holder-name').placeholder = "Nome impresso no cartão";
                // Torna campos obrigatórios
                document.getElementById('card-number').required = true;
                document.getElementById('card-expiry').required = true;
                document.getElementById('card-ccv').required = true;
            } else {
                creditSection.style.display = 'none';
                securityBadges.style.display = 'none';
                btnSubmit.textContent = "Gerar PIX";
                document.getElementById('card-holder-name').placeholder = "Nome completo";
                // Remove obrigatoriedade
                document.getElementById('card-number').required = false;
                document.getElementById('card-expiry').required = false;
                document.getElementById('card-ccv').required = false;
            }
        };
        
        btnSelectCard.onclick = () => setTab('CREDIT_CARD');
        btnSelectPix.onclick = () => setTab('PIX');
        
        btnBackMethod.onclick = () => {
            form.style.display = 'none';
            stepMethod.style.display = 'block';
            if(msgDiv) msgDiv.classList.add('hidden');
        };
        
        // Limpa mensagens anteriores
        if(msgDiv) msgDiv.classList.add('hidden');
        
        // Se tiver cupom vindo da tentativa anterior, preenche
        if(cupomPreenchido) {
            const cupomInput = document.getElementById('modal-cupom-input');
            if (cupomInput) cupomInput.value = cupomPreenchido;
        }

        // Pré-preenche dados do titular se disponíveis no perfil
        if (psychologistData) {
            const elCpf = document.getElementById('card-holder-cpf');
            const elCep = document.getElementById('card-holder-cep');
            const elPhone = document.getElementById('card-holder-phone');
            if (elCpf && psychologistData.cpf) elCpf.value = psychologistData.cpf;
            if (elCep && psychologistData.cep) elCep.value = psychologistData.cep;
            if (elPhone && psychologistData.telefone) elPhone.value = psychologistData.telefone;
        }

        // --- APLICA MÁSCARAS AOS CAMPOS DO CARTÃO ---
        setTimeout(() => {
            if (window.IMask) {
                const cardExpiry = document.getElementById('card-expiry');
                const cardNumber = document.getElementById('card-number');
                const cardCcv = document.getElementById('card-ccv');
                const cardCpf = document.getElementById('card-holder-cpf');
                const cardCep = document.getElementById('card-holder-cep');
                const cardPhone = document.getElementById('card-holder-phone');

                if (cardExpiry) {
                    IMask(cardExpiry, {
                        mask: 'MM/YYYY',
                        blocks: {
                            MM: { mask: IMask.MaskedRange, from: 1, to: 12 },
                            YYYY: { mask: IMask.MaskedRange, from: 1900, to: 2999 }
                        }
                    });
                }
                if (cardNumber) IMask(cardNumber, { mask: '0000 0000 0000 0000' });
                if (cardCcv) IMask(cardCcv, { mask: '0000' });
                
                // MÁSCARA HÍBRIDA CPF/CNPJ
                if (cardCpf) {
                    IMask(cardCpf, {
                        mask: [
                            { mask: '000.000.000-00' },
                            { mask: '00.000.000/0000-00' }
                        ]
                    });
                }
                
                if (cardCep) IMask(cardCep, { mask: '00000-000' });
                if (cardPhone) IMask(cardPhone, { mask: '(00) 00000-0000' });
            }
        }, 100);

        // --- BUSCA CEP AUTOMÁTICA (ANTIFRAUDE) ---
        const cepInput = document.getElementById('card-holder-cep');
        if (cepInput) {
            cepInput.addEventListener('blur', async (e) => {
                const cep = e.target.value.replace(/\D/g, '');
                if (cep.length === 8) {
                    try {
                        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                        const data = await res.json();
                        if (!data.erro) {
                            document.getElementById('card-holder-street').value = data.logradouro || '';
                            document.getElementById('card-holder-neighborhood').value = data.bairro || '';
                            document.getElementById('card-holder-city').value = data.localidade || '';
                            document.getElementById('card-holder-state').value = data.uf || '';
                            document.getElementById('card-holder-number').focus();
                        }
                    } catch (err) { console.error("Erro CEP:", err); }
                }
            });
        }

        // Impede duplo submit
        form.onsubmit = async (e) => {
            e.preventDefault();
            if(msgDiv) msgDiv.classList.add('hidden'); // Limpa erro anterior ao tentar de novo
            btnSubmit.disabled = true;
            btnSubmit.textContent = "Processando com Asaas...";

            // Coleta dados do formulário
            const cardData = {
                holderName: document.getElementById('card-holder-name').value,
                holderCpf: document.getElementById('card-holder-cpf').value,
                holderPhone: document.getElementById('card-holder-phone').value,
                postalCode: document.getElementById('card-holder-cep').value, // CEP enviado pelo usuário
                addressNumber: document.getElementById('card-holder-number').value,
                addressComplement: document.getElementById('card-holder-complement').value,
                // Dados enriquecidos pelo CEP (importante para antifraude)
                addressStreet: document.getElementById('card-holder-street').value,
                addressNeighborhood: document.getElementById('card-holder-neighborhood').value
            };
            
            // Dados específicos do cartão
            if (currentMethod === 'CREDIT_CARD') {
                cardData.number = document.getElementById('card-number').value;
                cardData.expiry = document.getElementById('card-expiry').value;
                cardData.ccv = document.getElementById('card-ccv').value;
            }

            const cupomInput = document.getElementById('modal-cupom-input');
            const cupom = cupomInput ? cupomInput.value : '';

            try {
                const res = await apiFetch(`${API_BASE_URL}/api/payments/create-preference`, {
                    method: 'POST',
                    body: JSON.stringify({ 
                        planType, 
                        cupom,
                        billingType: currentMethod,
                        creditCard: cardData
                    })
                });

                let data;
                const contentType = res.headers.get("content-type");
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    data = await res.json();
                } else {
                    // Se não for JSON (ex: erro 500 HTML), lê como texto para não quebrar
                    const text = await res.text();
                    throw new Error(`Erro no servidor (${res.status}). Tente novamente mais tarde.`);
                }

                if (res.ok) {
                    if (currentMethod === 'PIX' && data.pix) {
                        // Mostra QR Code
                        customerSection.style.display = 'none';
                        creditSection.style.display = 'none';
                        securityBadges.style.display = 'none';
                        btnSubmit.style.display = 'none';
                        pixResult.style.display = 'block';
                        
                        document.getElementById('pix-qr-image').src = `data:image/png;base64,${data.pix.encodedImage}`;
                        document.getElementById('pix-copy-paste').value = data.pix.payload;
                        
                        // Botão Copiar
                        document.getElementById('btn-copy-pix').onclick = () => {
                            const copyText = document.getElementById('pix-copy-paste');
                            copyText.select();
                            document.execCommand("copy");
                            showToast('Código PIX copiado!', 'success');
                        };
                        
                        // Botão Já Paguei
                        document.getElementById('btn-pix-paid').onclick = () => window.location.reload();
                        
                    } else {
                        // Cartão (Sucesso imediato)
                        showToast('Assinatura realizada com sucesso!', 'success');
                        modal.style.setProperty('display', 'none', 'important');
                        await fetchPsychologistData();
                        loadPage('psi_assinatura.html');
                    }
                } else {
                    throw new Error(data.error || 'Erro ao processar pagamento.');
                }
            } catch (error) {
                console.error(error);
                if(msgDiv) {
                    msgDiv.classList.remove('hidden');
                    msgDiv.textContent = error.message;
                    msgDiv.style.color = "red";
                }
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.textContent = currentMethod === 'CREDIT_CARD' ? "Pagar Agora" : "Gerar PIX";
            }
        };
    }


    function inicializarAssinatura() {
        const cardResumo = document.getElementById('card-resumo-assinatura');
        const areaCancelamento = document.getElementById('area-cancelamento');
        
        // Verifica se tem plano (agora suportando os novos nomes em maiúsculo vindo do banco)
        const temPlano = psychologistData && psychologistData.plano;
        
        // 1. ATUALIZAÇÃO: Mapeamento dos novos Planos e Preços
        // As chaves devem ser em minúsculo para garantir o match
        const precos = { 
            'essential': 'R$ 99,00', 
            'clinical': 'R$ 159,00', 
            'reference': 'R$ 259,00',
            // Mantendo compatibilidade legada temporária (caso tenha algum perdido no banco)
            'Essencial': 'R$ 99,00', 'Clínico': 'R$ 149,00', 'sol': 'R$ 199,00'
        };

        if (temPlano && cardResumo) {
            cardResumo.style.display = 'flex';
            
            // ATUALIZE ESTA LINHA PARA LER O CAMPO NOVO:
            const isCancelado = psychologistData.cancelAtPeriodEnd || psychologistData.cancel_at_period_end || psychologistData.status === 'canceled';

            if (areaCancelamento) {
                areaCancelamento.style.display = isCancelado ? 'none' : 'block';
            }

            // --- BANNER SUPERIOR ---
            // Tradução visual para o usuário (ESSENTIAL -> Essencial)
            const mapNomes = { 'ESSENTIAL': 'Essencial', 'CLINICAL': 'Clínico', 'REFERENCE': 'Referência' };
            const nomeExibicao = mapNomes[psychologistData.plano.toUpperCase()] || psychologistData.plano;

            const elNome = document.getElementById('banner-nome-plano');
            if(elNome) elNome.textContent = `Plano ${nomeExibicao}`;
            
            const planoKey = psychologistData.plano.toLowerCase();
            const elPreco = document.getElementById('banner-preco');
            if(elPreco) elPreco.textContent = `${precos[planoKey] || 'R$ --'} / mês`;

            const elData = document.getElementById('banner-renovacao');
            const elBadge = cardResumo.querySelector('.status-badge');

            let dataDisplay;
            if (psychologistData.planExpiresAt) { // Nova propriedade que criamos no Model
                dataDisplay = new Date(psychologistData.planExpiresAt);
            } else if (psychologistData.subscription_expires_at) { // Legado
                dataDisplay = new Date(psychologistData.subscription_expires_at);
            } else {
                const hoje = new Date();
                dataDisplay = new Date(hoje.setMonth(hoje.getMonth() + 1));
            }
            const dataFormatada = dataDisplay.toLocaleDateString('pt-BR');

            if (isCancelado) {
                if (elData) elData.textContent = `Acesso até: ${dataFormatada}`;
                if (elBadge) elBadge.innerHTML = `<span style="width: 8px; height: 8px; background: #FFC107; border-radius: 50%;"></span> Cancelado`;
            } else {
                if (elData) elData.textContent = `Renova em: ${dataFormatada}`;
                if (elBadge) elBadge.innerHTML = `<span style="width: 8px; height: 8px; background: #4ade80; border-radius: 50%;"></span> Ativo`;
            }

            // Lógica do Modal de Cancelamento (Mantida igual, apenas garantindo funcionamento)
            setupBotaoCancelamento(isCancelado);

        } else {
            if(cardResumo) cardResumo.style.display = 'none';
            if(areaCancelamento) areaCancelamento.style.display = 'none';
        }

        // --- CARDS E BOTÕES ---
        document.querySelectorAll('.plano-card').forEach(card => {
            const btn = card.querySelector('.btn-mudar-plano');
            if (!btn) return;
            
            // 2. ATUALIZAÇÃO: Lê estritamente o atributo novo do HTML (ESSENTIAL, CLINICAL...)
            const planoAlvo = btn.getAttribute('data-plano'); 
            if (!planoAlvo) return; // Se não tiver data-plano, ignora

            card.classList.remove('plano-card--ativo');
            btn.classList.remove('btn-reativar');
            
            const selo = card.querySelector('.selo-plano-atual');
            if(selo) selo.remove();

            // Compara ignorando maiúsculas/minúsculas
            const planoUsuario = temPlano ? psychologistData.plano.toUpperCase() : '';
            const isCurrent = planoUsuario === planoAlvo.toUpperCase();
            
            const isCancelado = psychologistData.cancel_at_period_end || psychologistData.status === 'canceled' || psychologistData.cancelado_localmente;

            if(isCurrent) {
                // É O PLANO ATUAL
                const novoSelo = document.createElement('div');
                novoSelo.className = 'selo-plano-atual';
                novoSelo.textContent = 'Seu Plano Atual';
                novoSelo.style.cssText = "background:#1B4332; color:#fff; padding:5px 10px; border-radius:4px; margin-bottom:10px; font-size:0.8rem; display:inline-block; font-weight:bold;";
                card.insertBefore(novoSelo, card.firstChild);
                card.classList.add('plano-card--ativo'); // Adiciona borda visual se quiser CSS específico

                if (isCancelado) {
                    btn.textContent = "Reativar Assinatura";
                    btn.disabled = false;
                    btn.classList.add('btn-reativar');
                    btn.onclick = (e) => { e.preventDefault(); reativarAssinatura(btn); };
                } else {
                    btn.textContent = "Plano Ativo";
                    btn.disabled = true;
                    btn.style.opacity = "0.7";
                }
            } else {
                // É UM OUTRO PLANO (Upgrade ou Downgrade)
                // Se o usuário não tem plano nenhum, mostramos "Testar Grátis"
                if (!temPlano) {
                    btn.innerHTML = "ASSINAR AGORA";
                    btn.classList.add('btn-upgrade');
                    btn.classList.add('btn-pulse-effect');
                } else {
                    btn.textContent = "Mudar para este";
                    btn.classList.remove('btn-upgrade');
                    btn.classList.remove('btn-pulse-effect');
                }
                
                btn.disabled = false;
                btn.onclick = (e) => {
                    e.preventDefault();
                    // Envia para a função global de pagamento
                    window.iniciarPagamento(planoAlvo, btn);
                };
            }
        });
    }

    // Função Auxiliar para isolar a lógica do cancelar (apenas organização)
    function setupBotaoCancelamento(isCancelado) {
        const btnCancelar = document.getElementById('btn-cancelar-assinatura');
        const modalCancel = document.getElementById('modal-cancelamento');
            
        if(btnCancelar && modalCancel && !isCancelado) {
            const novoBtn = btnCancelar.cloneNode(true);
            btnCancelar.parentNode.replaceChild(novoBtn, btnCancelar);
            
            novoBtn.onclick = (e) => { e.preventDefault(); modalCancel.style.display = 'flex'; };
            
            const btnFechar = document.getElementById('btn-fechar-modal-cancel');
            if(btnFechar) btnFechar.onclick = () => modalCancel.style.display = 'none';
            
            const btnConfirmar = document.getElementById('btn-confirmar-cancelamento');
            const novoConfirmar = btnConfirmar.cloneNode(true);
            btnConfirmar.parentNode.replaceChild(novoConfirmar, btnConfirmar);

            novoConfirmar.onclick = async function() {
                this.textContent = "Processando...";
                try {
                    await apiFetch(`${API_BASE_URL}/api/psychologists/me/cancel-subscription`, { method: 'POST' });
                    psychologistData.cancel_at_period_end = true; 
                    psychologistData.cancelado_localmente = true; 
                    modalCancel.style.display = 'none';
                    showToast('Renovação cancelada.', 'info');
                    inicializarAssinatura(); 
                } catch(e) {
                    showToast('Erro: ' + e.message, 'error');
                } finally {
                    this.textContent = "Sim, Cancelar";
                }
            };
        }
    }

    // Função Auxiliar para Reativar (Conectada ao Modal Visual)
    function reativarAssinatura(btnElement) {
        const modal = document.getElementById('modal-reativacao');
        const btnFechar = document.getElementById('btn-fechar-modal-reativacao');
        const btnConfirmar = document.getElementById('btn-confirmar-reativacao');
        
        btnReativacaoAtual = btnElement;

        if (modal) {
            modal.style.display = 'flex';
            
            btnFechar.onclick = () => {
                modal.style.display = 'none';
            };

            btnConfirmar.onclick = async function() {
                // Em vez de chamar a API direta (que falha pois a assinatura foi deletada),
                // abrimos o modal de pagamento para recriar a assinatura.
                // O backend cuidará de não cobrar hoje se ainda houver prazo.
                modal.style.display = 'none';
                const planoAtual = psychologistData.plano || 'ESSENTIAL';
                window.iniciarPagamento(planoAtual, btnReativacaoAtual);
            };
        }
    }
    // --- RESTANTE DAS FUNÇÕES (PERFIL, EXCLUIR CONTA, ETC) ---
    async function inicializarVisaoGeral() {
        // 1. Saudação e Alerta de Perfil (Mantidos)
        if (document.getElementById('psi-welcome-name') && psychologistData) {
            document.getElementById('psi-welcome-name').textContent = `Olá, ${psychologistData.nome.split(' ')[0]}!`;
        }

        const abordagens = psychologistData.abordagens || psychologistData.abordagens_tecnicas || [];
        const temas = psychologistData.temas || psychologistData.temas_atuacao || [];
        const isProfileIncomplete = !psychologistData.nome || !psychologistData.crp || abordagens.length === 0 || temas.length === 0;

        const alertBox = document.getElementById('alert-complete-profile');
        if (alertBox) alertBox.style.display = isProfileIncomplete ? 'flex' : 'none';

        // --- CORREÇÃO: Lógica de bloqueio de recursos movida para fora do try/catch ---
        // Isso garante que o blur seja aplicado mesmo que a busca de KPIs falhe.
        const planoAtual = psychologistData.plano ? psychologistData.plano.toUpperCase() : '';
        
        const cardFavoritos = 'card-favoritos';
        const cardDemandas = 'card-demandas';
        const cardBench = 'card-benchmarking';

        if (!planoAtual || planoAtual === 'ESSENTIAL') {
            bloquearCard(cardFavoritos, 'Veja quem salvou seu perfil no Plano Clínico');
            bloquearCard(cardDemandas, 'Saiba quais queixas chegam até você no Plano Clínico');
            bloquearCard(cardBench, 'Comparativo de mercado exclusivo Plano Referência');
        } 
        else if (planoAtual === 'CLINICAL') {
            desbloquearCard(cardFavoritos);
            desbloquearCard(cardDemandas);
            bloquearCard(cardBench, 'Destrave o Comparativo de Mercado no Plano Referência');
        } 
        else if (planoAtual === 'REFERENCE') {
            desbloquearCard(cardFavoritos);
            desbloquearCard(cardDemandas);
            desbloquearCard(cardBench);
            const benchCardEl = document.getElementById(cardBench);
            if(benchCardEl) {
                benchCardEl.style.border = "1px solid #FFC107";
                benchCardEl.style.background = "linear-gradient(to right, #fff, #fffae6)";
            }
        }
        // --- FIM DA CORREÇÃO ---

        // --- NOVA LÓGICA DE FILTRO E RENDERIZAÇÃO DE KPIs ---
        const filterSelect = document.getElementById('kpi-date-filter');
        const kpiGrid = document.querySelector('.kpi-grid');
        const btnRefresh = document.getElementById('btn-refresh-kpis');

        // Variável para guardar a instância do gráfico e não duplicar
        let xpChartInstance = null;

        async function fetchAndRenderKPIs(period = 'last30days') {
            const cards = document.querySelectorAll('.kpi-grid .kpi-card');
            
            console.time('Frontend KPI Render');
            // Ativa o estado de carregamento com a animação de esqueleto
            cards.forEach(card => {
                card.classList.add('is-loading');
                // Seleciona os elementos de texto para aplicar o esqueleto
                card.querySelectorAll('.kpi-value, h3, .kpi-link, #lista-demandas div').forEach(el => {
                    el.classList.add('skeleton-text');
                });
            });

            try {
                const statsUrl = `${API_BASE_URL}/api/psychologists/me/stats?period=${period}`;
                const res = await apiFetch(statsUrl);

                // --- CORREÇÃO: Verifica o tipo de conteúdo ANTES de tentar ler como JSON ---
                const contentType = res.headers.get("content-type");
                if (!contentType || !contentType.includes("application/json")) {
                    const responseText = await res.text();
                    console.error("A API de estatísticas não retornou JSON. Resposta do servidor:", responseText);
                    // Joga um erro claro que será pego pelo bloco catch
                    throw new Error(`O servidor retornou uma resposta inesperada (tipo: ${contentType}).`);
                }

                const stats = await res.json();
                
                // Atualiza os cards com os novos dados
                // CORREÇÃO: Verifica se os elementos existem antes de atualizar (evita erro ao trocar de página)
                const elCliques = document.getElementById('kpi-cliques-contato');
                if (elCliques) elCliques.textContent = stats.whatsappClicks || 0;

                const elRecomendacoes = document.getElementById('kpi-recomendacoes');
                if (elRecomendacoes) elRecomendacoes.textContent = stats.profileAppearances || 0;

                const elFavoritos = document.getElementById('kpi-favoritos');
                if (elFavoritos) elFavoritos.textContent = stats.favoritesCount || 0;

                const elDemandas = document.getElementById('lista-demandas');
                if (elDemandas) {
                    if (stats.topDemands && stats.topDemands.length > 0) {
                        elDemandas.innerHTML = stats.topDemands.map((demanda, index) => 
                            `<div style="font-size: 0.9rem; margin-bottom: 5px; color: ${index > 1 ? '#666' : 'inherit'};">
                                ${index + 1}. ${demanda.name} (${demanda.percentage}%)
                            </div>`
                        ).join('');
                    } else {
                        elDemandas.innerHTML = '<div style="font-size: 0.9rem; color: #999;">Ainda não há dados suficientes para este período.</div>';
                    }
                }

                // --- RENDERIZA GRÁFICO DE XP ---
                if (stats.xpHistory) {
                    renderXPChart(stats.xpHistory);
                }

            } catch (error) {
                console.error("Erro ao buscar KPIs:", error);
                showToast('Não foi possível atualizar as métricas.', 'error');
            } finally {
                // Desativa o estado de carregamento
                cards.forEach(card => {
                    card.classList.remove('is-loading');
                    // Remove a classe de esqueleto de todos os elementos de texto
                    card.querySelectorAll('.skeleton-text').forEach(el => {
                        el.classList.remove('skeleton-text');
                    });
                });
            }
        }

        function renderXPChart(data) {
            const ctx = document.getElementById('xpChart');
            if (!ctx) return;
            
            if (xpChartInstance) {
                xpChartInstance.destroy();
            }

            // Prepara dados (se vazio, mostra vazio)
            const labels = data.map(d => {
                const parts = d.date.split('-');
                return `${parts[2]}/${parts[1]}`; // DD/MM
            });
            const points = data.map(d => parseInt(d.points));

            xpChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'XP',
                        data: points,
                        borderColor: '#1B4332',
                        backgroundColor: (context) => {
                            const ctx = context.chart.ctx;
                            const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                            gradient.addColorStop(0, 'rgba(27, 67, 50, 0.2)');
                            gradient.addColorStop(1, 'rgba(27, 67, 50, 0)');
                            return gradient;
                        },
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#fff',
                        pointBorderColor: '#1B4332',
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: '#1B4332',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            callbacks: {
                                label: function(context) {
                                    return `+${context.parsed.y} XP`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { borderDash: [5, 5], color: '#f0f0f0' },
                            ticks: { font: { family: 'Mulish' } }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { font: { family: 'Mulish' } }
                        }
                    }
                }
            });
        }

        // Adiciona o listener para o filtro
        if (filterSelect) {
            // Remove listener antigo para evitar duplicação ao recarregar a página
            const newFilterSelect = filterSelect.cloneNode(true);
            filterSelect.parentNode.replaceChild(newFilterSelect, filterSelect);
            
            newFilterSelect.addEventListener('change', (e) => {
                fetchAndRenderKPIs(e.target.value);
            });
        }

        // Listener do botão de atualizar
        if (btnRefresh) {
            btnRefresh.onclick = (e) => {
                e.preventDefault();
                // Animação simples de rotação no ícone
                const icon = btnRefresh.querySelector('svg');
                if(icon) {
                    icon.style.transition = 'transform 0.5s ease';
                    icon.style.transform = 'rotate(360deg)';
                    setTimeout(() => { icon.style.transform = 'none'; }, 500);
                }
                const currentSelect = document.getElementById('kpi-date-filter');
                fetchAndRenderKPIs(currentSelect ? currentSelect.value : 'last30days');
            };
        }

        // Carga inicial dos KPIs
        fetchAndRenderKPIs('last30days');

        // NOVO: Renderiza o widget de gamificação
        if (psychologistData) {
            updateGamificationWidgets(psychologistData, true);
        }
    }

    // --- FUNÇÕES AUXILIARES DE BLOQUEIO (FEATURE GATING) ---
    
    function bloquearCard(elementId, mensagem) {
        const card = document.getElementById(elementId);
        if (!card) return;
    
        // Se já estiver bloqueado, não faz nada (evita duplicar cadeados)
        if (card.querySelector('.premium-lock-overlay')) return;
    
        // Adiciona classe para referência
        card.classList.add('premium-feature-container');
    
        // Aplica o blur em todos os filhos atuais do card
        Array.from(card.children).forEach(child => {
            child.classList.add('premium-blur');
        });
    
        // Cria o Overlay do Cadeado
        const overlay = document.createElement('div');
        overlay.className = 'premium-lock-overlay';
        overlay.innerHTML = `
            <div class="lock-icon-circle">
                <svg width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
                </svg>
            </div>
            <div class="premium-text">
                <span style="display:block; font-size:0.8rem; text-transform:uppercase; letter-spacing:1px; color:#888; margin-bottom:5px;">Recurso Premium</span>
                ${mensagem}
            </div>
            <button class="btn-unlock-feature">Desbloquear Agora</button>
        `;
    
        // Ação do Botão "Liberar" -> Leva para a página de Assinatura
        overlay.querySelector('button').onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Simula o clique no menu lateral para carregar a página de assinatura
            const linkAssinatura = document.querySelector('[data-page="psi_assinatura.html"]');
            if(linkAssinatura) linkAssinatura.click();
        };
    
        card.appendChild(overlay);
    }
    
    function desbloquearCard(elementId) {
        const card = document.getElementById(elementId);
        if (!card) return;
        
        card.classList.remove('premium-feature-container');
        
        // Remove blur dos filhos
        Array.from(card.children).forEach(child => {
            child.classList.remove('premium-blur');
        });
    
        // Remove overlay do cadeado se existir
        const overlay = card.querySelector('.premium-lock-overlay');
        if (overlay) overlay.remove();
    }
    // --- LÓGICA DO PERFIL (ATUALIZADA E CORRIGIDA) ---

    // Variável para guardar a instância da máscara do documento
    let documentMaskInstance = null;

    function inicializarLogicaDoPerfil() {
        const form = document.getElementById('perfil-form');
        if (!form) return;

        const inputDoc = document.getElementById('cpf');
        const inputRazao = document.getElementById('razao_social');
        const groupRazao = document.getElementById('group-razao-social');

        // Inicializa componentes
        setupMultiselects();
        setupMasks();
        setupCepSearch();

        if (psychologistData) {
            // 1. Preencher campos de texto simples
            ['nome', 'email', 'crp', 'telefone', 'bio', 'valor_sessao_numero', 'slug', 'cep', 'cidade', 'estado'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = psychologistData[id] || '';
            });

            // 2. Preenchimento Inteligente do Documento (CPF/CNPJ)
            if (inputDoc) {
                const docSalvo = psychologistData.cpf || psychologistData.cnpj || psychologistData.document_number || '';
                if (documentMaskInstance) {
                    documentMaskInstance.value = docSalvo; 
                    if (documentMaskInstance.unmaskedValue.length > 11) {
                        groupRazao.classList.remove('hidden');
                    } else {
                        groupRazao.classList.add('hidden');
                    }
                } else {
                    inputDoc.value = docSalvo;
                }
            }

            if (inputRazao) inputRazao.value = psychologistData.razao_social || '';

            // 3. Preenchimento das Redes Sociais
            ['linkedin_url', 'instagram_url', 'facebook_url', 'tiktok_url', 'x_url'].forEach(key => {
                const el = document.getElementById(key);
                if (el && psychologistData[key]) {
                    let val = psychologistData[key].replace(/https?:\/\/(www\.)?/, '').replace(/linkedin\.com\/in\//, '').replace(/instagram\.com\//, '');
                    el.value = val;
                }
            });

            // 4. CARREGAR DADOS DOS MULTISELECTS (Lendo os nomes corretos do banco)
            // Nota: O banco pode retornar 'temas_atuacao' ou 'temas', verificamos ambos
            updateMultiselect('temas_atuacao_multiselect', psychologistData.temas_atuacao || psychologistData.temas || []);
            updateMultiselect('abordagens_tecnicas_multiselect', psychologistData.abordagens_tecnicas || psychologistData.abordagens || []);
            updateMultiselect('genero_identidade_multiselect', psychologistData.genero_identidade ? [psychologistData.genero_identidade] : []);
            // ADICIONADO: Carrega os dados dos novos campos
            updateMultiselect('publico_alvo_multiselect', psychologistData.publico_alvo || []);
            updateMultiselect('estilo_terapia_multiselect', psychologistData.estilo_terapia || []);
            updateMultiselect('praticas_inclusivas_multiselect', psychologistData.praticas_inclusivas || []);

            updateMultiselect('disponibilidade_periodo_multiselect', psychologistData.disponibilidade_periodo || []);

            // 5. CORREÇÃO DA MODALIDADE (Online/Presencial)
            let modData = psychologistData.modalidade || [];
            if (typeof modData === 'string') {
                try { modData = JSON.parse(modData); } catch(e) { modData = [modData]; }
            }
            // Traduz legado "Apenas X" para o formato novo
            if (Array.isArray(modData)) {
                modData = modData.map(item => {
                    if (item.includes('Apenas Online')) return 'Online';
                    if (item === 'Apenas Presencial') return 'Presencial';
                    return item;
                });
            }
            updateMultiselect('modalidade_atendimento_multiselect', modData);

            // 6. Controle de Edição
            const btnAlterar = document.getElementById('btn-alterar');
            const multiselects = document.querySelectorAll('.multiselect-tag');
            const modeIndicator = document.getElementById('form-mode-indicator');
            const modeText = document.getElementById('form-mode-text');
            const modeIcon = document.getElementById('form-mode-icon');
            
            if(btnAlterar) {
                btnAlterar.onclick = (e) => {
                    e.preventDefault();
                    document.getElementById('form-fieldset').disabled = false;
                    multiselects.forEach(m => m.classList.remove('disabled'));

                    // Muda para Modo de Edição
                    if(modeIndicator) {
                        modeIndicator.classList.remove('mode-indicator-view');
                        modeIndicator.classList.add('mode-indicator-edit');
                        modeText.textContent = "Modo de Edição";
                        modeIcon.textContent = "✏️";
                    }

                    btnAlterar.classList.add('hidden');
                    document.getElementById('btn-salvar').classList.remove('hidden');
                };
            }

            // --- AÇÃO DE SALVAR (CORRIGIDA: Agora ouve os erros do servidor) ---
            form.onsubmit = async (e) => {
                e.preventDefault();
                const btnSalvar = document.getElementById('btn-salvar');
                const btnAlterar = document.getElementById('btn-alterar');
                const fieldset = document.getElementById('form-fieldset');
                
                // Feedback visual de carregamento
                btnSalvar.textContent = "Salvando...";
                btnSalvar.disabled = true; 
                
                const fd = new FormData(form);
                const data = Object.fromEntries(fd.entries());

                // --- MAPEAMENTO DE DADOS ---
                data.temas_atuacao = getMultiselectValues('temas_atuacao_multiselect');
                data.abordagens_tecnicas = getMultiselectValues('abordagens_tecnicas_multiselect');
                data.modalidade = getMultiselectValues('modalidade_atendimento_multiselect'); // Mantido
                data.disponibilidade_periodo = getMultiselectValues('disponibilidade_periodo_multiselect'); // CORRIGIDO: Nome do campo padronizado
                // ADICIONADO: Coleta os valores dos novos campos para salvar
                data.publico_alvo = getMultiselectValues('publico_alvo_multiselect');
                data.estilo_terapia = getMultiselectValues('estilo_terapia_multiselect');
                data.praticas_inclusivas = getMultiselectValues('praticas_inclusivas_multiselect');


                const generoArr = getMultiselectValues('genero_identidade_multiselect');
                data.genero_identidade = generoArr.length > 0 ? generoArr[0] : '';

                if (data.valor_sessao_numero) {
                    data.valor_sessao_numero = parseFloat(data.valor_sessao_numero.toString().replace(',', '.'));
                }

                if (data.cpf) data.cpf = data.cpf.replace(/\D/g, '');
                if (data.telefone) data.telefone = data.telefone.replace(/\D/g, '');
                if (data.cpf && data.cpf.length <= 11) data.razao_social = ''; 

                try {
                    console.log("Enviando atualização:", data);
                    
                    // 1. Envia ao servidor e AGUARDA a resposta completa
                    const res = await apiFetch(`${API_BASE_URL}/api/psychologists/me`, { 
                        method: 'PUT', 
                        body: JSON.stringify(data) 
                    });
                    
                    // 2. VERIFICAÇÃO CRUCIAL: O servidor aceitou?
                    if (!res.ok) {
                        // Se não aceitou (ex: erro 400 de link duplicado), pegamos a mensagem
                        const errData = await res.json();
                        throw new Error(errData.error || 'Erro desconhecido ao salvar.');
                    }

                    // 3. Se passou daqui, foi SUCESSO REAL
                    showToast('Perfil salvo com sucesso!', 'success');
                    
                    // Atualiza dados locais
                    psychologistData = { ...psychologistData, ...data };
                    // Se mudou o link, atualiza o objeto local para refletir na sidebar
                    if(data.slug) psychologistData.slug = data.slug;
                    
                    // Trava o formulário novamente
                    fieldset.disabled = true; 
                    const multiselects = document.querySelectorAll('.multiselect-tag');
                    multiselects.forEach(m => m.classList.add('disabled'));

                    // Volta para Modo de Visualização
                    if(modeIndicator) {
                        modeIndicator.classList.remove('mode-indicator-edit');
                        modeIndicator.classList.add('mode-indicator-view');
                        modeText.textContent = "Modo de Visualização";
                        modeIcon.textContent = "●";
                    }

                    btnSalvar.classList.add('hidden');
                    btnAlterar.classList.remove('hidden');
                    
                    atualizarInterfaceLateral();

                } catch (err) {
                    console.error("Erro ao salvar perfil:", err);
                    // Se for um erro de rede, mostra uma mensagem genérica.
                    // Se for um erro enviado pelo servidor (ex: "Link já em uso"), mostra a mensagem específica.
                    let friendlyMessage = 'Não foi possível salvar. Verifique sua conexão e tente novamente.';
                    if (err.message && !err.message.toLowerCase().includes('failed to fetch')) {
                        friendlyMessage = err.message;
                    }
                    showToast(friendlyMessage, 'error');
                } finally {
                    btnSalvar.textContent = "Salvar Alterações";
                    btnSalvar.disabled = false;
                }
            };
        }

        // Upload de foto (Mantido)
        const uploadInput = document.getElementById('profile-photo-upload');
        if (uploadInput) {
            uploadInput.onchange = async (e) => {
                if (e.target.files[0]) {
                    const fd = new FormData(); fd.append('foto', e.target.files[0]);
                    try {
                        const res = await apiFetch(`${API_BASE_URL}/api/psychologists/me/foto`, { method: 'POST', body: fd });
                        if (res.ok) {
                            const d = await res.json();
                            psychologistData.fotoUrl = d.fotoUrl;
                            atualizarInterfaceLateral(); showToast('Foto atualizada!');
                        }
                    } catch (err) { showToast('Erro na foto', 'error'); }
                }
            };
        }
    }

    // Função de Máscara Híbrida (CPF ou CNPJ automático)
    function setupDocumentMask() {
        if (typeof IMask === 'undefined') return;

        const inputDoc = document.getElementById('cpf'); // ID mantido como 'cpf'
        const groupRazao = document.getElementById('group-razao-social');
        
        if (!inputDoc) return;

        // Destroi anterior se existir para evitar conflitos
        if (documentMaskInstance) {
            documentMaskInstance.destroy();
            documentMaskInstance = null;
        }

        const maskOptions = {
            mask: [
                { mask: '000.000.000-00' },
                { mask: '00.000.000/0000-00' }
            ]
        };

        documentMaskInstance = IMask(inputDoc, maskOptions);

        // Evento para mostrar/ocultar Razão Social dinamicamente
        documentMaskInstance.on('accept', () => {
            const currentVal = documentMaskInstance.unmaskedValue;
            // Se passar de 11 dígitos, assumimos que está digitando um CNPJ
            if (currentVal.length > 11) {
                if(groupRazao) groupRazao.classList.remove('hidden');
            } else {
                if(groupRazao) groupRazao.classList.add('hidden');
            }
        });
    }

    function setupMasks() {
        if (typeof IMask === 'undefined') return;

        // Máscaras estáticas (Telefone e CRP)
        const tel = document.getElementById('telefone');
        const crp = document.getElementById('crp');

        if (tel) IMask(tel, { mask: '(00) 00000-0000' });
        if (crp) IMask(crp, { mask: '00/000000' });

        // Chama a máscara do documento (agora híbrida por padrão)
        setupDocumentMask(); // A função antiga foi removida
    }

    // --- LÓGICA DA COMUNIDADE (Q&A) ---
    function inicializarComunidade(preFetchedData = null) {
        let currentPage = 1;
        const limit = 15;
        // Ajuste dinâmico do Banner (Título e Subtítulo)
        const bannerTitle = document.querySelector('.main-header h1');
        const bannerSub = document.querySelector('.subtitulo-header');
        if(bannerTitle) bannerTitle.textContent = "Perguntas";
        if(bannerSub) bannerSub.textContent = "Responda dúvidas da comunidade e ganhe visibilidade.";

        const container = document.getElementById('qna-list-container');
        const loadMoreBtn = document.getElementById('btn-load-more-questions');
        const modal = document.getElementById('qna-answer-modal');
        const form = document.getElementById('qna-answer-form');
        const textarea = document.getElementById('qna-answer-textarea');
        const charCounter = document.getElementById('qna-char-counter');
        const btnSubmit = document.getElementById('qna-submit-answer');
        let currentQuestionId = null;

        if (!container || !loadMoreBtn) return;

        async function fetchAndRender(page, append = false) {
            if (!append) {
                container.innerHTML = '<div class="loader-wrapper"><div class="loader-spinner"></div></div>';
            }
            loadMoreBtn.textContent = 'Carregando...';
            loadMoreBtn.disabled = true;

            try {
                let questions;
                if (page === 1 && preFetchedData) {
                    questions = await preFetchedData;
                    preFetchedData = null;
                } else {
                    const res = await apiFetch(`${API_BASE_URL}/api/qna?page=${page}&limit=${limit}`);
                    if (!res.ok) throw new Error('Falha ao buscar perguntas');
                    questions = await res.json();
                }

                if (!append) container.innerHTML = '';

                if (questions.length > 0) {
                    renderQuestions(questions);
                }

                if (questions.length < limit) {
                    loadMoreBtn.classList.add('hidden');
                } else {
                    loadMoreBtn.classList.remove('hidden');
                }

                if (page === 1 && questions.length === 0) {
                    showEmptyState();
                }
            } catch (err) {
                console.error(err);
                if (!append) container.innerHTML = `<div style="text-align:center; padding:40px;">Erro ao carregar perguntas.</div>`;
            } finally {
                loadMoreBtn.textContent = 'Carregar Mais Perguntas';
                loadMoreBtn.disabled = false;
            }
        }

        function renderQuestions(allQuestions) {
            
            const pendingQuestions = allQuestions.filter(q => q.respondedByMe === false);
            
            const template = document.getElementById('qna-card-template-psi');
            if (!template) {
                console.error("CRITICAL: Template 'qna-card-template-psi' não encontrado no DOM.");
                container.innerHTML = '<p style="color:red; text-align:center;">Erro de interface: Template de perguntas não encontrado.</p>';
                return;
            }
            
            pendingQuestions.forEach(q => {
                const clone = template.content.cloneNode(true); // Agora 'template' é garantido que existe
                
                // --- CORREÇÃO INFALÍVEL ---
                // Em vez de procurar pelo nome '.qna-card', pegamos o primeiro elemento do template.
                // Isso funciona independente do nome da classe no seu HTML.
                const cardElement = clone.firstElementChild; 

                if(cardElement) {
                    // Necessário para o ícone ficar no canto certo
                    cardElement.style.position = 'relative';
                }

                clone.querySelector('.qna-question-title').textContent = q.titulo || 'Dúvida da Comunidade';
                clone.querySelector('.qna-question-content').textContent = q.conteudo || q.content;
                
                const dataEnvio = new Date(q.createdAt).toLocaleDateString('pt-BR');
                clone.querySelector('.qna-question-author').textContent = `Enviada em ${dataEnvio} • Paciente Anônimo`;

                const badge = clone.querySelector('.badge-respondido');
                if(badge) badge.style.display = 'none';

                // Botão Responder
                const btnResponder = clone.querySelector('.btn-responder');
                btnResponder.onclick = () => abrirModalResposta(q.id, q.titulo);

                // --- BOTÃO LIXEIRA (SVG) ---
                const btnIgnorar = document.createElement('button');
                
                // SVG Inline (O desenho da lixeira)
                btnIgnorar.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                `;
                
                btnIgnorar.title = "Ignorar esta pergunta";
                
                // CSS para posicionar e colorir
                btnIgnorar.style.cssText = `
                    position: absolute;
                    top: 15px;
                    right: 15px;
                    background: none;
                    border: none;
                    padding: 5px;
                    cursor: pointer;
                    color: #1B4332; /* Verde Yelo */
                    opacity: 0.4;
                    transition: all 0.3s ease;
                    z-index: 2;
                `;
                
                // Efeito Hover
                btnIgnorar.onmouseover = () => {
                    btnIgnorar.style.opacity = '1';
                    btnIgnorar.style.transform = 'scale(1.1)';
                };
                btnIgnorar.onmouseout = () => {
                    btnIgnorar.style.opacity = '0.4';
                    btnIgnorar.style.transform = 'scale(1)';
                };

                // Ação de Clique com Modal Personalizado
                btnIgnorar.onclick = () => {
                    abrirModalConfirmacaoPersonalizado(
                        'Ignorar Pergunta',
                        'Tem certeza que deseja ignorar esta dúvida? Ela sumirá da sua lista.',
                        async () => {
                            try {
                                if(cardElement) cardElement.style.opacity = '0.5'; 
                                
                                const res = await apiFetch(`${API_BASE_URL}/api/qna/${q.id}/ignore`, { method: 'POST' });
                                if(res.ok) {
                                    if(cardElement) cardElement.remove(); 
                                    showToast('Pergunta removida da sua lista.', 'info');
                                    // Verifica se a lista ficou vazia
                                    if(container.children.length === 0) inicializarComunidade();
                                }
                            } catch(e) {
                                console.error(e);
                                if(cardElement) cardElement.style.opacity = '1'; 
                                showToast('Erro ao ignorar pergunta.', 'error');
                            }
                        }
                    );
                };

                // Adiciona o botão diretamente no card (se o card foi encontrado)
                if (cardElement) {
                    cardElement.appendChild(btnIgnorar);
                }

                container.appendChild(clone);
            });
        }

        // 2. Lógica do Modal
        function abrirModalResposta(id, titulo) {
            currentQuestionId = id;
            modal.querySelector('.modal-title').textContent = `Respondendo: ${titulo}`;
            textarea.value = ''; // Limpa o campo
            checkCharCount();    // Reseta o contador visualmente
            
            // Força display flex com !important por causa do CSS global
            modal.style.setProperty('display', 'flex', 'important');
        }

        // Função auxiliar para contar caracteres (Reutilizável)
        function checkCharCount() {
            const len = textarea.value.length;
            charCounter.textContent = `${len}/50 caracteres`;
            if (len >= 50) {
                charCounter.style.color = "#1B4332"; // Verde Yelo
                charCounter.style.fontWeight = "bold";
                btnSubmit.disabled = false;
            } else {
                charCounter.style.color = "#666";
                btnSubmit.disabled = true;
            }
        }

        function showEmptyState() {
            container.innerHTML = `
                <div style="text-align:center; padding:60px 20px; color:#1B4332;">
                    <div style="font-size: 3rem; margin-bottom: 10px;">🎉</div>
                    <h3 style="font-family:'New Kansas', serif; margin-bottom: 10px;">Tudo limpo por aqui!</h3>
                    <p style="color:#666; max-width: 400px; margin: 0 auto;">
                        Você zerou as perguntas da comunidade.
                    </p>
                </div>`;
        }

        // 2. Lógica do Modal
        function abrirModalResposta(id, titulo) {
            currentQuestionId = id;
            modal.querySelector('.modal-title').textContent = `Respondendo: ${titulo}`;
            textarea.value = ''; // Limpa o campo
            checkCharCount();    // Reseta o contador visualmente
            
            // Força display flex com !important por causa do CSS global
            modal.style.setProperty('display', 'flex', 'important');
        }

        // Carga Inicial
        fetchAndRender(1, false);

        loadMoreBtn.onclick = () => fetchAndRender(++currentPage, true);

        // Fechar Modal
        const fecharModal = () => modal.style.setProperty('display', 'none', 'important');
        if(modal.querySelector('.modal-close')) modal.querySelector('.modal-close').onclick = fecharModal;
        if(modal.querySelector('.modal-cancel')) modal.querySelector('.modal-cancel').onclick = fecharModal;

        // Validação de Caracteres ao digitar
        textarea.oninput = checkCharCount;

        // 3. Enviar Resposta
        form.onsubmit = async (e) => {
            e.preventDefault();
            btnSubmit.textContent = "Enviando...";
            btnSubmit.disabled = true; // Evita duplo clique
            
            try {
                const res = await apiFetch(`${API_BASE_URL}/api/qna/${currentQuestionId}/answer`, {
                    method: 'POST',
                    body: JSON.stringify({ conteudo: textarea.value })
                });

                if (res.ok) {
                    showToast('Resposta enviada com sucesso! 🌻', 'success');
                    fecharModal();
                    
                    // A MÁGICA ACONTECE AQUI:
                    // Recarregamos a lista. Como o backend agora vai dizer que essa pergunta
                    // tem "respondedByMe = true", o filtro acima vai escondê-la automaticamente.
                    inicializarComunidade(); 
                } else {
                    throw new Error('Falha no envio');
                }

            } catch (error) {
                console.error(error);
                showToast('Erro ao enviar resposta.', 'error');
            } finally {
                btnSubmit.textContent = "Enviar Resposta";
                // Mantém disabled até digitar novamente (se desse erro) ou fecha modal
                if(textarea.value.length < 50) btnSubmit.disabled = true;
            }
        };
    }

    // --- LÓGICA DA CAIXA DE ENTRADA (ATUALIZADA COM SOCKET.IO) ---
    function inicializarCaixaEntrada(preFetchedData = null) {

        const conversationList = document.getElementById('conversation-list');
        const messagesThread = document.getElementById('messages-thread');
        const replyInput = document.getElementById('psi-reply-input');
        const sendBtn = document.getElementById('send-reply-btn');
        const welcomeScreen = document.getElementById('chat-welcome-screen');
        const activeChatScreen = document.getElementById('active-chat-screen');
        const btnVoltarMobile = document.getElementById('btn-voltar-mobile');
        
        // Elementos do Menu de Opções e Busca
        const btnChatOptions = document.getElementById('btn-chat-options');
        const chatOptionsMenu = document.getElementById('chat-options-menu');
        const btnOptSearch = document.getElementById('btn-opt-search');
        const btnOptClear = document.getElementById('btn-opt-clear');
        const chatSearchBar = document.getElementById('chat-search-bar');
        const chatSearchInput = document.getElementById('chat-search-input');
        const btnCloseSearch = document.getElementById('btn-close-search');

        if (!messagesThread || !replyInput || !sendBtn) {
            console.error("Elementos essenciais do chat não encontrados.");
            return;
        }

        let adminConversationId = null;
        let psiSocket = null;
        // Chave para o armazenamento local do status de leitura
        const getReadStatusStorageKey = () => `yelo_read_msg_status_${adminConversationId}`;

        // --- FUNÇÃO PARA CARREGAR SOCKET.IO DINAMICAMENTE ---
        function loadSocketScript(callback) {
            if (typeof io !== 'undefined') {
                callback();
                return;
            }
            const script = document.createElement('script');
            // Tenta carregar do servidor da API ou CDN como fallback
            script.src = `${API_BASE_URL}/socket.io/socket.io.js`; 
            script.onload = () => {
                callback();
            };
            script.onerror = () => console.error("Falha ao carregar Socket.IO. O chat em tempo real não funcionará.");
            document.body.appendChild(script);
        }

        function getStatusIcon(status) {
            const sentIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;" title="Enviado"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
            const deliveredIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;" title="Entregue"><path d="M18 6L7 17l-5-5"></path><path d="M22 10l-7.5 7.5L13 16"></path></svg>`;
            const readIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34B7F1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;" title="Lido"><path d="M18 6L7 17l-5-5"></path><path d="M22 10l-7.5 7.5L13 16"></path></svg>`;
            
            const s = status ? status.toLowerCase() : 'sent';
            if (s === 'read') return readIcon;
            if (s === 'delivered') return deliveredIcon;
            return sentIcon;
        }

        // Helper para formatar a data do divisor
        function getDateLabel(dateString) {
            const date = new Date(dateString);
            const today = new Date();
            const yesterday = new Date();
            yesterday.setDate(today.getDate() - 1);

            if (date.toDateString() === today.toDateString()) return 'Hoje';
            if (date.toDateString() === yesterday.toDateString()) return 'Ontem';
            return date.toLocaleDateString('pt-BR');
        }

        // Função para carregar e renderizar a conversa com o admin
        async function loadAdminConversation() {
            try {
                let messages;
                if (preFetchedData) {
                    messages = await preFetchedData;
                } else {
                    const token = localStorage.getItem('Yelo_token');
                    const response = await fetch(`${API_BASE_URL}/api/messages?contactType=admin`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (response.ok) messages = await response.json();
                }
                
                if (messages && messages.length > 0) {
                    adminConversationId = messages[0].conversationId;
                
                // FILTRO DE LIMPEZA LOCAL: Verifica se o usuário limpou a conversa
                const clearedTime = localStorage.getItem(`cleared_chat_${adminConversationId}`);
                if (clearedTime) {
                    const clearDate = new Date(clearedTime);
                    messages = messages.filter(m => new Date(m.createdAt) > clearDate);
                }
                }

                // Renderiza a lista lateral (apenas com o admin)
                if (conversationList) {
                    conversationList.innerHTML = `
                        <li class="conversation-item active" id="btn-open-support-chat">
                            <img src="/assets/logos/logo-escura.png" alt="Avatar" class="avatar" style="background:#f0f0f0; padding:5px; object-fit: contain;">
                            <div class="conversation-details">
                                <div class="details-header">
                                    <span class="contact-name">Suporte Yelo</span>
                                    <span class="timestamp">Agora</span>
                                </div>
                                <p class="last-message">Canal de suporte direto</p>
                            </div>
                        </li>
                    `;
                    
                    // Adiciona evento de clique para abrir e marcar como lido
                    const btnOpen = document.getElementById('btn-open-support-chat');
                    if (btnOpen) {
                        btnOpen.addEventListener('click', () => {
                            if (welcomeScreen) welcomeScreen.style.display = 'none';
                            if (activeChatScreen) activeChatScreen.style.display = 'flex';
                            
                            // CORREÇÃO: Rola para o final assim que a conversa se torna visível
                            if (messagesThread) messagesThread.scrollTop = messagesThread.scrollHeight;

                            // Marca como lido apenas ao abrir
                            if (psiSocket && psiSocket.connected && adminConversationId) {
                                psiSocket.emit('messages_read', { conversationId: adminConversationId });
                            }
                        });
                    }
                }

                // Renderiza as mensagens no painel principal
                renderMessages(messages);
            } catch (error) {
                console.error(error);
                messagesThread.innerHTML = `<p style="color:red; text-align:center;">Erro ao carregar chat.</p>`;
            }
        }

        // Renderiza as mensagens na tela
        function renderMessages(messages) {
            // CORREÇÃO: Smart Update
            if (messagesThread.children.length === 0) {
                messagesThread.innerHTML = '';
                let lastDate = null;
                messages.forEach(msg => {
                    const msgDate = new Date(msg.createdAt).toDateString();
                    if (msgDate !== lastDate) {
                        appendDateSeparator(msg.createdAt);
                        lastDate = msgDate;
                    }
                    appendMessageToView(msg, false);
                });
                messagesThread.scrollTop = messagesThread.scrollHeight;
                return;
            }

            const domMessages = {};
            document.querySelectorAll('.message-bubble[data-message-id]').forEach(el => {
                domMessages[el.dataset.messageId] = el;
            });

            messages.forEach(msg => {
                const existingEl = domMessages[msg.id];
                if (existingEl) {
                    const isSentByMe = (msg.senderType && msg.senderType.toLowerCase() === 'psychologist');
                    if (isSentByMe) {
                        const statusContainer = existingEl.querySelector('.message-status');
                        if (statusContainer) {
                            const currentHtml = statusContainer.innerHTML;
                            const newStatus = msg.status || 'sent';
                            let shouldUpdate = true;
                            if (currentHtml.includes('title="Lido"') && newStatus !== 'read') shouldUpdate = false;
                            if (currentHtml.includes('title="Entregue"') && newStatus === 'sent') shouldUpdate = false;
                            if (shouldUpdate) statusContainer.innerHTML = getStatusIcon(newStatus);
                        }
                    }
                } else {
                    const lastBubble = messagesThread.querySelector('.message-bubble:last-of-type');
                    const lastDate = lastBubble ? lastBubble.dataset.date : null;
                    const msgDate = new Date(msg.createdAt).toDateString();
                    if (msgDate !== lastDate) appendDateSeparator(msg.createdAt);
                    appendMessageToView(msg, true);
                }
            });
        }

        function appendDateSeparator(dateString) {
            const div = document.createElement('div');
            div.style.cssText = "text-align: center; margin: 15px 0; font-size: 0.75rem; color: #888; display: flex; justify-content: center;";
            div.innerHTML = `<span style="background: rgba(0,0,0,0.05); padding: 4px 12px; border-radius: 12px;">${getDateLabel(dateString)}</span>`;
            messagesThread.appendChild(div);
        }

        // Adiciona uma única mensagem na tela
        function appendMessageToView(msg, scrollToBottom = true) {
            // Verifica se precisa adicionar separador de data (para mensagens novas)
            if (scrollToBottom && messagesThread.lastElementChild) {
                const lastMsgDate = messagesThread.lastElementChild.dataset.date;
                const currentMsgDate = new Date(msg.createdAt).toDateString();
                if (lastMsgDate && lastMsgDate !== currentMsgDate) {
                    appendDateSeparator(msg.createdAt);
                }
            }

            const div = document.createElement('div');
            if (msg.id) div.dataset.messageId = msg.id;
            div.dataset.date = new Date(msg.createdAt).toDateString();
            
            const isSentByMe = (msg.senderType && msg.senderType.toLowerCase() === 'psychologist');
            div.className = `message-bubble ${isSentByMe ? 'sent' : 'received'}`;
            
            const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const statusIcon = isSentByMe ? getStatusIcon(msg.status || 'sent') : '';

            div.innerHTML = `
                <p>${msg.content}</p>
                <div class="message-meta">
                    <span>${time}</span>
                    <span class="message-status">${statusIcon}</span>
                </div>
            `;
            messagesThread.appendChild(div);
            if (scrollToBottom) {
                messagesThread.scrollTop = messagesThread.scrollHeight;
            }
            return div;
        }

        // Envia uma resposta para o admin
        async function sendReply() {
            const content = replyInput.value.trim();
            if (!content) return;

            // --- CORREÇÃO: ATUALIZAÇÃO OTIMISTA (UI IMEDIATA) ---
            const tempMessage = {
                content: content,
                senderType: 'psychologist',
                createdAt: new Date().toISOString(),
                status: 'sent'
            };
            const tempBubble = appendMessageToView(tempMessage); 
            replyInput.value = ''; 
            // ----------------------------------------------------

            try {
                const token = localStorage.getItem('Yelo_token');
                const response = await fetch(`${API_BASE_URL}/api/messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ recipientType: 'admin', content })
                });

                if (response.ok) {
                    const savedMessage = await response.json();
                    
                    // Atualiza o ID do balão na tela com o ID real do banco
                    if (tempBubble) {
                        tempBubble.dataset.messageId = savedMessage.id;
                        const statusContainer = tempBubble.querySelector('.message-status');
                        if (statusContainer) statusContainer.innerHTML = getStatusIcon(savedMessage.status || 'sent');
                    }
                } else {
                    throw new Error('Falha ao enviar');
                }
            } catch (error) {
                console.error(error);
                showToast('Erro ao enviar mensagem.', 'error');
                if (tempBubble) tempBubble.remove(); // Remove a mensagem se falhar
            }
        }

        function connectSocket() {
            if (typeof io === 'undefined') return; // O loader dinâmico cuidará disso
            const token = localStorage.getItem('Yelo_token');

            psiSocket = io(API_BASE_URL, {
                auth: { token: token },
                transports: ['websocket', 'polling']
            });

            psiSocket.on('connect', () => {
                if (adminConversationId) {
                    psiSocket.emit('messages_read', { conversationId: adminConversationId });
                }
            });

            psiSocket.on('receiveMessage', (msg) => {
                
                // 1. DEDUPLICAÇÃO: Se a mensagem já existe na tela, ignora
                if (document.querySelector(`.message-bubble[data-message-id='${msg.id}']`)) {
                    return;
                }

                if (msg.senderType && msg.senderType.toLowerCase() === 'admin') {
                    // CORREÇÃO: Se for a primeira mensagem, captura o ID da conversa para poder marcar como lida
                    if (!adminConversationId && msg.conversationId) {
                        adminConversationId = msg.conversationId;
                    }

                    appendMessageToView(msg, true); // true = Rola para o final
                    psiSocket.emit('message_delivered', { messageId: msg.id });
                    
                    // 2. STATUS LIDO: Só marca se o chat estiver VISÍVEL
                    const chatScreen = document.getElementById('active-chat-screen');
                    const isVisible = chatScreen && (chatScreen.style.display === 'flex' || chatScreen.style.display === 'block');
                    
                    if (adminConversationId && isVisible) {
                        psiSocket.emit('messages_read', { conversationId: adminConversationId });
                    }
                }
            });

            psiSocket.on('message_status_updated', (data) => {
                const { messageId, status } = data;
                // CORREÇÃO: Só busca balões ENVIADOS (.sent) para atualizar o ícone
                const messageBubble = document.querySelector(`.message-bubble.sent[data-message-id='${messageId}']`);
                if (messageBubble) {
                    const statusContainer = messageBubble.querySelector('.message-status');
                    if (statusContainer) statusContainer.innerHTML = getStatusIcon(status);

                    // SALVA O STATUS 'LIDO' NO LOCALSTORAGE
                    if (status === 'read' && adminConversationId) {
                        const readStatusKey = getReadStatusStorageKey();
                        const readMessageIds = JSON.parse(localStorage.getItem(readStatusKey) || '{}');
                        readMessageIds[messageId] = 'read';
                        localStorage.setItem(readStatusKey, JSON.stringify(readMessageIds));
                    }
                }
            });
        }

        // --- FECHAR COM ESC ---
        const handleEscKey = (e) => {
            if (e.key === 'Escape') {
                if (activeChatScreen && activeChatScreen.style.display !== 'none') {
                    activeChatScreen.style.display = 'none';
                    if (welcomeScreen) welcomeScreen.style.display = 'flex';
                }
            }
        };
        document.addEventListener('keydown', handleEscKey);

        // --- Eventos e Inicialização ---
        replyInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendReply();
            }
        });
        sendBtn.addEventListener('click', sendReply);

        // Carrega mensagens e tenta conectar o socket (com fallback de carregamento do script)
        loadAdminConversation();
        loadSocketScript(() => {
            connectSocket();
        });

        // Limpeza ao sair da página
        window.cleanupPage = () => {
            document.removeEventListener('keydown', handleEscKey);
            document.removeEventListener('click', handleDocumentClickForMenu);
            if (psiSocket) {
                psiSocket.disconnect();
                psiSocket = null;
            }
        };
    }

    // --- SOCKET GLOBAL (PARA NOTIFICAÇÕES FORA DO CHAT) ---
    function connectGlobalPsiSocket() {
        if (typeof io === 'undefined') return;
        
        const token = localStorage.getItem('Yelo_token');
        if (!token) return;

        // Evita duplicar conexão se já existir uma global
        if (window.psiGlobalSocket && window.psiGlobalSocket.connected) return;

        const socket = io(API_BASE_URL, {
            auth: { token: token },
            transports: ['websocket', 'polling']
        });

        socket.on('connect', () => {
            // console.log('Socket Global Conectado');
        });

        socket.on('receiveMessage', (msg) => {
            // Se receber mensagem do admin, mostra badge
            if (msg.senderType && msg.senderType.toLowerCase() === 'admin') {
                // Verifica se o usuário já está na caixa de entrada
                const activePage = document.querySelector('.sidebar-nav li.active a')?.getAttribute('data-page');
                const isInboxOpen = activePage && activePage.includes('caixa_de_entrada');

                if (!isInboxOpen) {
                    if (msg.conversationId) window.psiUnreadConversations.add(msg.conversationId);
                    updateSidebarBadge('psi_caixa_de_entrada.html', true);
                    showToast('Nova mensagem do Suporte Yelo', 'info');
                }
            }
        });

        window.psiGlobalSocket = socket;
    }

    // Carrega lib do socket globalmente se necessário
    function loadGlobalSocketLib() {
        if (typeof io !== 'undefined') {
            connectGlobalPsiSocket();
            return;
        }
        const script = document.createElement('script');
        script.src = `${API_BASE_URL}/socket.io/socket.io.js`;
        script.onload = connectGlobalPsiSocket;
        document.body.appendChild(script);
    }

    function inicializarHubComunidade() {
        const containerHub = document.getElementById('hub-content-to-lock');
        if (!containerHub) return;

        // 1. Verifica plano
        const planoAtual = psychologistData && psychologistData.plano ? psychologistData.plano.toUpperCase() : '';

        // 2. BUSCA DADOS (Agora vai funcionar pois liberamos a rota no Backend!)
        apiFetch(`${API_BASE_URL}/api/admin/community-resources`)
            .then(async (res) => {
                if(res.ok) {
                    const links = await res.json();
                    const btnInter = document.getElementById('btn-link-intervisao');
                    const btnBiblio = document.getElementById('btn-link-biblioteca');
                    const btnCursos = document.getElementById('btn-link-cursos');

                    // Só atualiza se o botão existir e o link não for vazio ou "#"
                    if(btnInter && links.link_intervisao && links.link_intervisao.length > 5) btnInter.href = links.link_intervisao;
                    if(btnBiblio && links.link_biblioteca && links.link_biblioteca.length > 5) btnBiblio.href = links.link_biblioteca;
                    if(btnCursos && links.link_cursos && links.link_cursos.length > 5) btnCursos.href = links.link_cursos;
                }
            })
            .catch(err => console.error("Links:", err)); // Se der erro, mantém o href="#"

        // 3. Regra de Bloqueio
        if (!planoAtual || planoAtual === 'ESSENTIAL') {
            bloquearCard('hub-content-to-lock', 'Workshops e Biblioteca são exclusivos dos planos Clínico e Referência.');
            
            const lockBtn = containerHub.querySelector('.btn-unlock-feature');
            if(lockBtn) {
                lockBtn.textContent = "Fazer Upgrade para Acessar";
                lockBtn.style.backgroundColor = "#1B4332";
                lockBtn.style.color = "#fff";
            }
        } else {
            desbloquearCard('hub-content-to-lock');
        }
    }

    // INIT
    fetchPsychologistData().then(ok => {
        // Remove o loader global com fade-out
        const loader = document.getElementById('global-loader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.style.display = 'none', 500);
        }

        if (ok) {
            document.getElementById('dashboard-container').style.display = 'flex';
            document.querySelectorAll('.sidebar-nav a').forEach(l => {
                l.onclick = (e) => { 
                    e.preventDefault(); 
                    loadPage(l.getAttribute('data-page'));
                    // FECHA O MENU NO MOBILE AO CLICAR
                    if (window.innerWidth <= 992 && sidebar && sidebar.classList.contains('is-open')) {
                        sidebar.classList.remove('is-open');
                    }
                };
            });
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.has('status')) {
                loadPage('psi_assinatura.html');
                if (urlParams.get('status') === 'approved') {
                    showToast('Pagamento Aprovado!', 'success');
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            } else {
                // Carrega a última página visitada ou a visão geral como padrão
                const lastPage = localStorage.getItem('yelo_last_psi_page');
                loadPage(lastPage || 'psi_visao_geral.html');
            }
            
            // Inicia socket global para notificações
            loadGlobalSocketLib();

            // --- NOVO: INICIA A LÓGICA DE TOOLTIPS MOBILE ---
            setupMobileBadgeTooltips();
        }
    });

     // --- FUNÇÃO GLOBAL PARA TOOLTIPS DE BADGES NO MOBILE ---
    function setupMobileBadgeTooltips() {
        // Garante que o listener seja adicionado apenas uma vez
        if (document.body.dataset.mobileTooltipsSetup) return;
        document.body.dataset.mobileTooltipsSetup = 'true';

        document.body.addEventListener('click', function(e) {
            const existingTooltip = document.querySelector('.mobile-badge-tooltip');
            
            // Se clicou em um alvo de badge
            const target = e.target.closest('.badge-card, .badge-item');

            // Primeiro, remove qualquer tooltip existente para limpar a tela
            if (existingTooltip) {
                existingTooltip.remove();
            }

            // Se não clicou em um alvo de badge, ou se estamos no desktop, apenas saia
            if (!target || window.innerWidth > 992) {
                return;
            }
            
            // Se clicou em um alvo, previne outras ações e mostra o novo tooltip
            e.preventDefault();
            e.stopPropagation();

            const title = target.getAttribute('title');
            if (!title) return;

            // Cria o novo tooltip
            const tooltip = document.createElement('div');
            tooltip.className = 'mobile-badge-tooltip';
            tooltip.textContent = title;
            document.body.appendChild(tooltip);

            // Posiciona o tooltip
            const targetRect = target.getBoundingClientRect();
            const tooltipRect = tooltip.getBoundingClientRect();

            let top = targetRect.bottom + 10;
            tooltip.classList.add('bottom');

            if ((top + tooltipRect.height) > window.innerHeight - 20) {
                top = targetRect.top - tooltipRect.height - 10;
                tooltip.classList.remove('bottom');
                tooltip.classList.add('top');
            }
            
            let left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
            if (left < 10) left = 10;
            if (left + tooltipRect.width > window.innerWidth - 10) left = window.innerWidth - tooltipRect.width - 10;

            tooltip.style.top = `${top}px`;
            tooltip.style.left = `${left}px`;
        });
    }

// --- FUNÇÕES DOS CAMPOS MULTISELECT (V3 - ESTILO BULLETS & TOGGLE) ---

function setupMultiselects() {
        document.querySelectorAll('.multiselect-tag').forEach(container => {
            const display = container.querySelector('.multiselect-display');
            const optionsContainer = container.querySelector('.multiselect-options');
            // Verifica se o HTML pede seleção única (agora inclui Abordagens)
            const isSingle = container.dataset.singleSelect === 'true';

            // 1. Toggle do Menu (Abrir/Fechar)
            display.onclick = (e) => {
                if (container.classList.contains('disabled')) return;
                // Fecha outros menus abertos
                document.querySelectorAll('.multiselect-options').forEach(opt => {
                    if (opt !== optionsContainer) opt.style.display = 'none';
                });
                optionsContainer.style.display = optionsContainer.style.display === 'block' ? 'none' : 'block';
                e.stopPropagation();
            };

            // 2. Lógica de Clique nas Opções (Toggle: Adiciona ou Remove)
            optionsContainer.querySelectorAll('.option').forEach(opt => {
                opt.onclick = (e) => {
                    e.stopPropagation();
                    if (container.classList.contains('disabled')) return;

                    const val = opt.dataset.value;
                    let currentSelected = getMultiselectValues(container.id);

                    if (isSingle) {
                        // Modo Único: Se clicar no que já tá, desmarca. Se for novo, substitui.
                        if (currentSelected.includes(val)) {
                            currentSelected = [];
                        } else {
                            currentSelected = [val];
                        }
                        updateMultiselect(container.id, currentSelected);
                        optionsContainer.style.display = 'none'; // Fecha após escolher
                    } else {
                        // Modo Múltiplo: Toggle (Adiciona se não tem, remove se já tem)
                        if (currentSelected.includes(val)) {
                            currentSelected = currentSelected.filter(v => v !== val); // Remove
                        } else {
                            currentSelected.push(val); // Adiciona
                        }
                        updateMultiselect(container.id, currentSelected);
                        // Mantém o menu aberto para continuar selecionando
                    }
                };
            });
        });

        // Fecha ao clicar fora em qualquer lugar da tela
        document.addEventListener('click', () => {
            document.querySelectorAll('.multiselect-options').forEach(opt => opt.style.display = 'none');
        });
    }

    // Atualiza o visual (Bullets) e marca as opções no menu (VERSÃO BLINDADA)
    function updateMultiselect(containerId, rawValues) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        // --- PROTEÇÃO DE DADOS (CRUCIAL) ---
        // Garante que valuesArray seja SEMPRE um array, não importa o que venha do banco
        let valuesArray = rawValues;

        if (!valuesArray) {
            valuesArray = [];
        } else if (typeof valuesArray === 'string') {
            // Se vier como texto JSON (ex: '["Online"]'), tenta converter
            try {
                valuesArray = JSON.parse(valuesArray);
            } catch (e) {
                // Se for texto comum, transforma em array (ex: "Online" vira ["Online"])
                valuesArray = [valuesArray]; 
            }
        }
        
        // Se depois de tudo não for array, força ser vazio para não quebrar o .forEach
        if (!Array.isArray(valuesArray)) {
            valuesArray = [];
        }
        // -----------------------------------

        const display = container.querySelector('.multiselect-display');
        const optionsContainer = container.querySelector('.multiselect-options');

        // Salva os dados no elemento para envio posterior
        container.dataset.value = JSON.stringify(valuesArray);

        // 1. Atualiza o Display (Estilo Lista com Bullets)
        display.innerHTML = ''; 
        if (valuesArray.length === 0) {
            display.innerHTML = '<span style="color:#999; font-size:0.9rem;">Selecione...</span>';
        } else {
            // Cria a lista não ordenada (ul)
            const ul = document.createElement('ul');
            ul.style.cssText = "margin: 8px 0 8px 25px; padding: 0; list-style-type: disc; color: #333;";
            
            valuesArray.forEach(val => {
                const li = document.createElement('li');
                li.textContent = val;
                li.style.marginBottom = '4px'; 
                ul.appendChild(li);
            });
            display.appendChild(ul);
        }

        // 2. Atualiza visualmente o Dropdown (Feedback do que está marcado)
        if (optionsContainer) {
            Array.from(optionsContainer.children).forEach(opt => {
                if (valuesArray.includes(opt.dataset.value)) {
                    opt.style.fontWeight = 'bold';
                    opt.style.color = '#1B4332';
                    opt.style.backgroundColor = '#E0F2F1';
                } else {
                    opt.style.fontWeight = 'normal';
                    opt.style.color = '#666';
                    opt.style.backgroundColor = 'transparent';
                }
            });
        }
    }

    // Lê os valores (Permanece igual)
    function getMultiselectValues(containerId) {
        const container = document.getElementById(containerId);
        if (!container || !container.dataset.value) return [];
        try {
            return JSON.parse(container.dataset.value);
        } catch (e) { return []; }
    }

// --- FUNÇÃO AUXILIAR: MODAL DE CONFIRMAÇÃO PERSONALIZADO (TEMA Yelo) ---
function abrirModalConfirmacaoPersonalizado(titulo, mensagem, onConfirm) {
    // 1. Cria o fundo escuro (overlay)
    const overlay = document.createElement('div');
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px;";

    // 2. Cria a caixa do modal
    const modalBox = document.createElement('div');
    modalBox.style.cssText = "background:#fff; width:100%; max-width:500px; border-radius:12px; overflow:hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.2); animation: fadeIn 0.2s ease-out;";

    // 3. Cabeçalho Verde
    const header = document.createElement('div');
    header.style.cssText = "background: #1B4332; color: #fff; padding: 15px 20px; font-family: 'New Kansas', sans-serif; font-size: 1.2rem;";
    header.textContent = titulo;

    // 4. Corpo da Mensagem
    const body = document.createElement('div');
    body.style.cssText = "padding: 25px 20px; color: #333; font-size: 1rem; line-height: 1.5;";
    body.innerHTML = mensagem;

    // 5. Rodapé com Botões
    const footer = document.createElement('div');
    footer.style.cssText = "padding: 15px 20px; background: #f9f9f9; display:flex; justify-content:flex-end; gap:10px; border-top:1px solid #eee;";

    const btnCancelar = document.createElement('button');
    btnCancelar.textContent = "Cancelar";
    btnCancelar.style.cssText = "padding: 10px 20px; border: 1px solid #ccc; background:#fff; color:#666; border-radius:25px; cursor:pointer; font-weight:bold;";
    
    const btnConfirmar = document.createElement('button');
    btnConfirmar.textContent = "Confirmar";
    btnConfirmar.style.cssText = "padding: 10px 20px; border: none; background:#1B4332; color:#fff; border-radius:25px; cursor:pointer; font-weight:bold;";

    // Ações
    const fechar = () => document.body.removeChild(overlay);
    btnCancelar.onclick = fechar;
    overlay.onclick = (e) => { if(e.target === overlay) fechar(); };
    
    btnConfirmar.onclick = () => {
        fechar();
        onConfirm(); // Executa a ação real
    };

    // Montagem
    footer.appendChild(btnCancelar);
    footer.appendChild(btnConfirmar);
    modalBox.appendChild(header);
    modalBox.appendChild(body);
    modalBox.appendChild(footer);
    overlay.appendChild(modalBox);
    document.body.appendChild(overlay);
}

// --- INTEGRAÇÃO VIACEP ---
function setupCepSearch() {
    const elCep = document.getElementById('cep');
    const elCidade = document.getElementById('cidade');
    const elEstado = document.getElementById('estado');
    const elLoading = document.getElementById('cep-loading');

    if (!elCep) return;

    // Aplica máscara simples enquanto digita
    elCep.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 5) {
            val = val.substring(0, 5) + '-' + val.substring(5, 8);
        }
        e.target.value = val;
    });

    // Busca ao sair do campo (blur)
    elCep.addEventListener('blur', async (e) => {
        const rawCep = e.target.value.replace(/\D/g, '');
        
        if (rawCep.length === 8) {
            if(elLoading) elLoading.style.display = 'block';
            elCep.disabled = true;

            try {
                const res = await fetch(`https://viacep.com.br/ws/${rawCep}/json/`);
                const data = await res.json();

                if (!data.erro) {
                    if(elCidade) elCidade.value = data.localidade;
                    if(elEstado) elEstado.value = data.uf;
                } else {
                    showToast('CEP não encontrado.', 'error');
                    if(elCidade) elCidade.value = '';
                    if(elEstado) elEstado.value = '';
                }
            } catch (err) {
                console.error(err);
                showToast('Erro ao buscar CEP.', 'error');
            } finally {
                if(elLoading) elLoading.style.display = 'none';
                elCep.disabled = false;
            }
        }
    });
}

// --- LÓGICA DO BLOG (MEUS ARTIGOS) - VERSÃO ROBUSTA COM DEBUG ---
function inicializarBlog(preFetchedData = null) {
    console.log("Iniciando lógica do Blog...");
    let currentPage = 1;
    const ARTICLES_LIMIT = 3; // Limite de artigos por página
    const loadMoreBtn = document.getElementById('btn-load-more-articles');

    // Tenta achar os elementos cruciais
    const viewLista = document.getElementById('view-lista-artigos');
    const viewForm = document.getElementById('view-form-artigo');
    const containerLista = document.getElementById('lista-artigos-render');
    const form = document.getElementById('form-blog');
    const btnSalvar = document.getElementById('btn-salvar-artigo');
    
    // --- LIMITE DE CARACTERES DO TÍTULO (50) ---
    const inputTitulo = document.getElementById('blog-titulo');
    
    if (inputTitulo && !document.getElementById('contador-titulo-blog')) {
        // 1. Define o limite físico no input HTML
        inputTitulo.setAttribute('maxlength', '50');

        // 2. Cria o contador visual dinamicamente
        const contador = document.createElement('div');
        contador.id = 'contador-titulo-blog';
        contador.style.cssText = "font-size: 0.85rem; color: #666; text-align: right; margin-top: 4px;";
        contador.textContent = `${inputTitulo.value.length}/50 caracteres`;
        
        // Insere o contador logo abaixo do input de título
        inputTitulo.parentNode.insertBefore(contador, inputTitulo.nextSibling);

        // 3. Ouve a digitação para atualizar o número
        inputTitulo.addEventListener('input', function() {
            const atual = this.value.length;
            contador.textContent = `${atual}/50 caracteres`;

            // Muda de cor se chegar no limite
            if (atual >= 50) {
                contador.style.color = "#e63946"; // Vermelho
                contador.style.fontWeight = "bold";
            } else {
                contador.style.color = "#666";
                contador.style.fontWeight = "normal";
            }
        });
    }
    // -------------------------------------------

    // Verificação de segurança: se a página não carregou direito, para tudo.
    if (!viewLista || !viewForm || !form || !btnSalvar) {
        console.error("ERRO CRÍTICO: Elementos do blog não encontrados no HTML.");
        showToast("Erro ao carregar componentes da página. Atualize (F5).", "error");
        return;
    }

    // --- NOVA FUNÇÃO: CARREGAR SUGESTÕES DE TEMAS ---
    async function carregarSugestoes() {
        const container = document.getElementById('lista-sugestoes-temas');
        if (!container) return;

        try {
            // Usa o endpoint de stats, que já tem os topDemands
            const res = await apiFetch(`${API_BASE_URL}/api/psychologists/me/stats?period=last90days`);
            if (res.ok) {
                const stats = await res.json();
                if (stats.topDemands && stats.topDemands.length > 0) {
                    container.innerHTML = ''; // Limpa os skeletons
                    stats.topDemands.forEach(tema => {
                        const div = document.createElement('div');
                        div.className = 'sugestao-item';
                        div.textContent = `✍️ ${tema.name}`;
                        div.title = `Clique para usar "${tema.name}" como título do seu novo artigo`;
                        
                        // Ação de clique: preenche o formulário de novo artigo
                        div.onclick = () => {
                            limparFormulario();
                            document.getElementById('blog-titulo').value = tema.name;
                            document.getElementById('form-titulo-acao').textContent = "Novo Artigo";
                            toggleView(true);
                        };
                        container.appendChild(div);
                    });
                } else {
                    container.innerHTML = '<p style="font-size:0.9rem; color:#92400e; grid-column: 1 / -1; text-align: center;">Nenhuma tendência encontrada. Escreva sobre o que você domina!</p>';
                }
            } else {
                throw new Error("Falha ao buscar dados de tendências.");
            }
        } catch (error) {
            console.error("Erro ao buscar sugestões de temas:", error);
            container.innerHTML = '<p style="font-size:0.9rem; color:#92400e; grid-column: 1 / -1; text-align: center;">Não foi possível carregar as sugestões.</p>';
        }
    }

    // --- Navegação ---
    const toggleView = (showForm) => {
        if (showForm) {
            viewLista.style.display = 'none';
            viewForm.style.display = 'block';
            // Foca no título para facilitar
            setTimeout(() => document.getElementById('blog-titulo').focus(), 100);
        } else {
            viewForm.style.display = 'none';
            viewLista.style.display = 'block';
            // limparFormulario(); // Removido para manter o rascunho se cancelar
        }
    };

    // --- Listeners dos Botões de Navegação ---
    const setupBtn = (id, action) => {
        const btn = document.getElementById(id);
        if(btn) btn.onclick = action;
    };
    setupBtn('btn-novo-artigo', () => {
        // Só limpa se estiver vindo de uma EDIÇÃO (tem ID)
        // Se não tiver ID, assume que é um rascunho de novo artigo e mantém o texto
        const blogId = document.getElementById('blog-id').value;
        if (blogId) {
            limparFormulario();
        }
        document.getElementById('form-titulo-acao').textContent = "Novo Artigo";
        toggleView(true);
    });
    setupBtn('btn-voltar-lista', () => toggleView(false));

    function limparFormulario() {
        // Busca o formulário atual no DOM (pois o original pode ter sido substituído)
        const currentForm = document.getElementById('form-blog');
        if(currentForm) currentForm.reset(); 
        
        document.getElementById('blog-id').value = ''; // Limpa o ID
        
        // Reseta contador
        const contador = document.getElementById('contador-titulo-blog');
        if(contador) {
            contador.textContent = "0/50 caracteres";
            contador.style.color = "#666";
            contador.style.fontWeight = "normal";
        }
    }


    // --- 1. FUNÇÃO DE CARREGAR (GET) ---
    async function carregarArtigos(page = 1, append = false) {
        if (!append) {
            containerLista.innerHTML = '<div style="text-align:center; padding:40px; color:#666;"><span style="font-size:2rem;">⏳</span><br>Carregando seus artigos...</div>';
        }
        if (loadMoreBtn) {
            loadMoreBtn.textContent = 'Carregando...';
            loadMoreBtn.disabled = true;
        }
        
        try {
            // Verifica se API_BASE_URL existe
            if (typeof API_BASE_URL === 'undefined') throw new Error("API_BASE_URL não está definida no JS global.");
            
            let posts;
            if (page === 1 && preFetchedData) {
                posts = await preFetchedData;
                preFetchedData = null;
            } else {
                // Lógica de paginação padrão (mais segura se o backend não suportar pageSize)
                const res = await apiFetch(`${API_BASE_URL}/api/psychologists/me/posts?page=${page}&limit=${ARTICLES_LIMIT}`);
                if (res.ok) {
                    posts = await res.json();
                } else {
                    throw new Error(`Erro no servidor: ${res.status}`);
                }
            }

            if (!Array.isArray(posts)) {
                throw new Error("Resposta da API não é um array válido.");
            }

            // Lógica de Paginação: Se vieram 3 posts, assumimos que pode haver mais
            let hasMore = false;
            if (posts.length === ARTICLES_LIMIT) {
                hasMore = true;
            }

            renderizarLista(posts, append);

            if (loadMoreBtn) {
                if (hasMore) {
                    loadMoreBtn.classList.remove('hidden');
                } else {
                    loadMoreBtn.style.display = 'none'; // Usa display none para garantir
                }
            }
          
        } catch (error) {
            console.error("ERRO AO CARREGAR ARTIGOS:", error);
              if (!append) {
                containerLista.innerHTML = `<div style="text-align:center; padding:30px; color:#d32f2f; background:#fff0f0; border-radius:8px;"><p><strong>Não foi possível carregar.</strong></p><p style="font-size:0.8rem;">${error.message}</p></div>`;
            }
        } finally {
            if (loadMoreBtn) {
                loadMoreBtn.textContent = 'Mostrar mais';
                loadMoreBtn.disabled = false;
            }
        }
    }

    function renderizarLista(posts, append = false) {
        if (!append) containerLista.innerHTML = '';

        if ((!posts || posts.length === 0) && !append) {
            containerLista.innerHTML = `
                <div style="text-align:center; padding:50px 20px; color:#666; background:#f9f9f9; border-radius:12px;">
                    <p style="font-size:3rem; margin-bottom:10px;">📝</p>
                    <h3 style="color:#1B4332;">Você ainda não tem artigos.</h3>
                    <p>Escrever é a melhor forma de demonstrar autoridade.</p>
                    <p>Clique em <strong>+ Escrever Novo</strong> acima para começar!</p>
                </div>`;
            return;
        }

        if (!posts) return;

        posts.forEach(post => {
            const div = document.createElement('div');
            div.className = 'artigo-item';
            div.title = "Clique para ver o artigo público";
            
            const dataStr = post.created_at || post.createdAt || new Date();
            const dataF = new Date(dataStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

            div.innerHTML = `
                <div style="flex: 1;">
                    <strong style="font-size:1.2rem; color:#1B4332; display:block; margin-bottom:8px;">${post.titulo}</strong>
                    
                    <div style="display: flex; align-items: center; gap: 20px; font-size:0.85rem; color:#666;">
                        
                        <span style="display: flex; align-items: center; gap: 5px;">
                            📅 ${dataF}
                        </span>

                        <span style="display: flex; align-items: center; gap: 5px; color: #e63946; font-weight: bold;" title="Total de leitores que curtiram">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                <path fill-rule="evenodd" d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314z"/>
                            </svg>
                            ${post.curtidas || 0}
                        </span>

                    </div>
                </div>

                <div class="btn-acoes-grupo">
                    <button class="btn-acao btn-editar">✏️ Editar</button>
                    <button class="btn-acao btn-excluir">🗑️ Excluir</button>
                </div>
            `;

            div.querySelector('.btn-editar').onclick = () => carregarParaEdicao(post);
            div.querySelector('.btn-excluir').onclick = () => {
                if(confirm(`Tem certeza que deseja apagar o artigo "${post.titulo}"? Essa ação não pode ser desfeita.`)) {
                    deletarArtigo(post.id);
                }
            };

            // Torna o card clicável para abrir o post público
            div.style.cursor = 'pointer';
            div.addEventListener('click', (e) => {
                // Impede a navegação se o clique for nos botões de ação
                if (e.target.closest('.btn-acao')) {
                    return;
                }
                // Abre o post em uma nova aba
                window.open(`/blog/post/${post.id}`, '_blank');
            });

            containerLista.appendChild(div);
        });
    }

    async function deletarArtigo(id) {
        try {
            const res = await apiFetch(`${API_BASE_URL}/api/psychologists/me/posts/${id}`, { method: 'DELETE' });
            if(res.ok) {
                showToast('Artigo excluído com sucesso.', 'success');
                carregarArtigos();
            } else {
                throw new Error("Falha ao excluir");
            }
        } catch (e) {
            console.error(e);
            showToast('Erro ao excluir artigo.', 'error');
        }
    }

    function carregarParaEdicao(post) {
        console.log("Carregando para edição:", post.id);
        document.getElementById('form-titulo-acao').textContent = "Editar Artigo";
        document.getElementById('blog-id').value = post.id;
        document.getElementById('blog-titulo').value = post.titulo;
        document.getElementById('blog-conteudo').value = post.conteudo || '';
        document.getElementById('blog-imagem').value = post.imagem_url || '';
        toggleView(true);
    }

    // --- 2. FUNÇÃO DE SALVAR (IMPORTANTE: Corrigido o evento) ---
    // Removemos qualquer listener anterior clonando o form
    const novoForm = form.cloneNode(true);
    form.parentNode.replaceChild(novoForm, form);
    
    // --- CORREÇÃO DO CANCELAR (Aqui é o lugar certo!) ---
    // Como clonamos o form, precisamos pegar o botão "novo" que acabou de nascer
    const btnCancelarNovo = document.getElementById('btn-cancelar-artigo');
    if (btnCancelarNovo) {
        btnCancelarNovo.onclick = (e) => {
            e.preventDefault(); // Impede recarregar
            toggleView(false);  // Volta para a lista mantendo o rascunho
        };
    }

    // Listener de Submit no NOVO form
    novoForm.addEventListener('submit', async function(e) {
        e.preventDefault(); // IMPEDE O RECARREGAMENTO DA PÁGINA
        console.log("Botão PUBLICAR clicado! Iniciando envio...");

        const btn = document.getElementById('btn-salvar-artigo');
        const originalText = btn.innerHTML;
        btn.innerHTML = "⏳ Salvando...";
        btn.disabled = true;

        try {
            // Verifica API_BASE_URL novamente
            if (typeof API_BASE_URL === 'undefined') throw new Error("API_BASE_URL indefinida.");

            const id = document.getElementById('blog-id').value;
            const method = id ? 'PUT' : 'POST';
            const url = id 
                ? `${API_BASE_URL}/api/psychologists/me/posts/${id}`
                : `${API_BASE_URL}/api/psychologists/me/posts`;
            
            const payload = {
                titulo: document.getElementById('blog-titulo').value,
                conteudo: document.getElementById('blog-conteudo').value,
                imagem_url: document.getElementById('blog-imagem').value
            };
            
            console.log("Enviando dados para:", url, "Método:", method, "Payload:", payload);

            const res = await apiFetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' }, // Garante que o back entenda que é JSON
                body: JSON.stringify(payload)
            });
            
            console.log("Resposta do servidor (Salvar):", res.status);

            if(res.ok) {
                showToast(id ? 'Artigo atualizado!' : 'Artigo publicado com sucesso!', 'success');
                limparFormulario(); // Limpa tudo para o próximo post
                toggleView(false);
                carregarArtigos();
            } else {
                const erroData = await res.json();
                throw new Error(erroData.error || "Erro desconhecido ao salvar no servidor.");
            }
        } catch (error) {
            console.error("ERRO AO SALVAR:", error);
            showToast('Não foi possível salvar: ' + error.message, 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });

    // Inicializa carregando a lista assim que abre a tela
    carregarArtigos(1, false);
    carregarSugestoes();

    // Evento do botão Carregar Mais
    if (loadMoreBtn) {
        loadMoreBtn.onclick = () => carregarArtigos(++currentPage, true);
    }
}

// --- LÓGICA DO FÓRUM ---
async function inicializarForum(preFetchedData = null) {
    // --- Elementos da UI ---
    const feedView = document.getElementById('forum-feed-view');
    const postView = document.getElementById('forum-post-view');
    const postsContainer = document.getElementById('forum-posts-container');
    const loadMoreBtn = document.getElementById('btn-load-more-posts');
    const fab = document.getElementById('forum-fab');
    const createModal = document.getElementById('forum-create-modal');
    const createForm = document.getElementById('forum-create-form');
    const closeModalBtn = document.getElementById('forum-modal-close-btn');

    // --- Templates ---
    const postCardTemplate = document.getElementById('forum-post-card-template');
    const fullPostTemplate = document.getElementById('forum-full-post-template');
    const commentTemplate = document.getElementById('forum-comment-template');

    // --- Estado ---
    let currentPostId = null;
    let currentPage = 1;
    const POSTS_LIMIT = 3; // Limite de posts por carga
    
    let currentCommentsPage = 1;
    const COMMENTS_LIMIT = 3; // Limite de comentários por carga

    let isLoadingMore = false;

    const DELETE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
    const EDIT_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-pencil"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path><path d="M15 5l4 4"></path><path d="M5 15l4 4"></path><path d="M3.5 16.5l4 4"></path></svg>`;

    // --- Funções Auxiliares ---
    function setupAutoResizeTextarea(textarea) {
        if (!textarea) return;
        
        const autoResize = () => {
            textarea.style.height = 'auto'; // Reseta a altura para calcular o novo scrollHeight
            textarea.style.height = textarea.scrollHeight + 'px'; // Define a nova altura
        };

        textarea.addEventListener('input', autoResize);
        autoResize(); // Ajusta o tamanho inicial caso haja texto pré-existente
    }

    function renderInlineAuthorBadges(badges, level) {
        let badgesData = badges;
        if (typeof badges === 'string') {
            try { badgesData = JSON.parse(badges); } catch(e) { badgesData = {}; }
        }

        if (!badgesData && !level) return '';

        let badgesHtml = '';
        let levelHtml = '';
        
        // 1. NÍVEL DE AUTORIDADE (TEXTO)
        const levelMap = {
            'nivel_iniciante': 'Iniciante',
            'nivel_verificado': 'Verificado',
            'nivel_ativo': 'Ativo',
            'nivel_especialista': 'Especialista',
            'nivel_mentor': 'Mentor'
        };

        if (level && levelMap[level] && level !== 'nivel_iniciante') {
            levelHtml = `<span class="author-level-badge">${levelMap[level]}</span>`;
        }

        // 2. BADGES DE CONQUISTA (ÍCONES)
        const badgeIconMap = {
            autentico: { icon: '🛡️', title: 'Autêntico' },
            semeador:  { icon: '🌱', title: 'Semeador' },
            voz_ativa: { icon: '💬', title: 'Voz Ativa' },
            pioneiro:  { icon: '🏅', title: 'Pioneiro' }
        };

        const badgeOrder = ['autentico', 'semeador', 'voz_ativa', 'pioneiro'];

        if (badgesData) {
            badgeOrder.forEach(key => {
                const badgeValue = badgesData[key];
                if (badgeValue) {
                    let title = badgeIconMap[key].title;
                    if (typeof badgeValue === 'string') {
                        title += ` (${badgeValue.charAt(0).toUpperCase() + badgeValue.slice(1)})`;
                    }
                    badgesHtml += `<span class="author-badge-icon" title="${title}">${badgeIconMap[key].icon}</span>`;
                }
            });
        }
        // Retorna os ícones das badges, e depois o texto do nível
        return `${badgesHtml} ${levelHtml}`;
    }

    const sanitizeHTML = (str) => {
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    };

    const timeSince = (date) => {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " anos";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " meses";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " dias";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " horas";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " minutos";
        return Math.floor(seconds) + " segundos";
    };

    // --- Funções de Renderização ---

    // Renderiza um card de post no feed
    function renderPostCard(post) {
        const card = postCardTemplate.content.cloneNode(true).firstElementChild;
        card.dataset.postId = post.id;

        card.querySelector('.post-category').textContent = post.category;
        const mobileCat = card.querySelector('.post-category-mobile');
        if(mobileCat) mobileCat.textContent = post.category;
        // Lógica de anonimato
        const authorName = post.isAnonymous ? 'Anônimo' : post.authorName;
        
        // Foto do autor
        // CORREÇÃO: Define o avatar e o nome em elementos separados para evitar quebra
        const authorAvatarEl = card.querySelector('.post-author-avatar');
        if (authorAvatarEl) authorAvatarEl.src = formatImageUrl(post.authorPhoto);
        card.querySelector('.post-author').textContent = `por ${authorName}`;
        if (post.isAnonymous) card.querySelector('.post-author').style.fontStyle = 'italic';

        const badgesContainer = card.querySelector('.author-badges');
        if (badgesContainer) {
            badgesContainer.innerHTML = renderInlineAuthorBadges(post.authorBadges, post.authorLevel);
        }

        card.querySelector('.post-time').textContent = `há ${timeSince(post.createdAt)}`;
        card.querySelector('.post-title').textContent = post.title;
        card.querySelector('.post-snippet').textContent = post.content.substring(0, 120) + '...';
        card.querySelector('.post-votes-count').textContent = post.votes || 0;
        card.querySelector('.post-comments-count').textContent = `💬 ${post.commentCount || 0} Comentários`;

        // Evento de clique para abrir o post completo
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.support-btn') && !e.target.closest('.report-btn')) {
                loadFullPost(post.id);
            }
        });

        // Evento de clique para apoiar
        const supportBtn = card.querySelector('.support-btn');
        if (post.supportedByMe) supportBtn.classList.add('supported');
        supportBtn.onclick = () => toggleSupport(post.id, supportBtn);

        // Configuração de botões de ação (Editar/Excluir vs Denunciar)
        const reportBtn = card.querySelector('.report-btn');
        const editBtn = card.querySelector('.edit-btn');
        const deleteBtn = card.querySelector('.delete-btn');

        if (post.isMine) {
            // É dono: Mostra Editar/Excluir, Esconde Denunciar
            if (reportBtn) reportBtn.style.display = 'none';
            
            if (editBtn) {
                editBtn.classList.remove('hidden');
                editBtn.onclick = (e) => { 
                    e.stopPropagation(); 
                    openEditPostModal(post); 
                };
            }
            
            if (deleteBtn) {
                deleteBtn.classList.remove('hidden');
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    deletePost(post.id);
                };
            }
        } else {
            // Não é dono: Mostra Denunciar, Esconde Editar/Excluir
            if (reportBtn) {
                reportBtn.style.display = 'inline-block';
                reportBtn.onclick = (e) => {
                    e.stopPropagation();
                    reportContent('post', post.id);
                };
            }
            if (editBtn) editBtn.classList.add('hidden');
            if (deleteBtn) deleteBtn.classList.add('hidden');
        }

        postsContainer.appendChild(card);
    }

    // Carrega e exibe o post completo
    async function loadFullPost(postId) {
        currentPostId = postId;
        currentCommentsPage = 1; // Reseta a página de comentários
        
        feedView.classList.add('hidden');
        if (fab) fab.style.display = 'none';
        postView.innerHTML = '<div class="loader-wrapper"><div class="loader-spinner"></div></div>';
        postView.classList.remove('hidden');

        try {
            const postRes = await apiFetch(`${API_BASE_URL}/api/forum/posts/${postId}`);
            if (!postRes.ok) throw new Error('Erro ao carregar post');
            const post = await postRes.json();
            
            const postEl = fullPostTemplate.content.cloneNode(true).firstElementChild;
            postEl.querySelector('.full-post-title').textContent = post.title;
            postEl.querySelector('.full-post-category').textContent = post.category;
            
            // CORREÇÃO: Define o avatar e o nome em elementos separados
            const authorAvatarEl = postEl.querySelector('.full-post-avatar');
            if (authorAvatarEl) authorAvatarEl.src = formatImageUrl(post.authorPhoto);
            postEl.querySelector('.full-post-author').textContent = post.isAnonymous ? 'Anônimo' : post.authorName;
            
            const badgesContainer = postEl.querySelector('.author-badges-full');
            if (badgesContainer) {
                badgesContainer.innerHTML = renderInlineAuthorBadges(post.authorBadges, post.authorLevel);
            }

            postEl.querySelector('.full-post-content').textContent = post.content; // O conteúdo já vem sanitizado do backend
            postEl.querySelector('.post-votes-count').textContent = post.votes;

            // Botão de voltar
            postEl.querySelector('#forum-back-to-feed-btn').onclick = () => {
                postView.classList.add('hidden');
                feedView.classList.remove('hidden');
                if (fab) fab.style.display = 'block';
                currentPostId = null;
            };

            // Ações (Apoiar, Denunciar)
            const supportBtn = postEl.querySelector('.support-btn');
            if (post.supportedByMe) supportBtn.classList.add('supported');
            supportBtn.onclick = () => toggleSupport(post.id, supportBtn);
            
            // Configuração de botões de ação (Visualização Completa)
            const reportBtnFull = postEl.querySelector('.report-btn');
            const editBtnFull = postEl.querySelector('.edit-btn-full');
            const deleteBtnFull = postEl.querySelector('.delete-btn-full');

            if (post.isMine) {
                if (reportBtnFull) reportBtnFull.style.display = 'none';
                
                if (editBtnFull) {
                    editBtnFull.classList.remove('hidden');
                    editBtnFull.onclick = () => openEditPostModal(post);
                }
                
                if (deleteBtnFull) {
                    deleteBtnFull.classList.remove('hidden');
                    deleteBtnFull.onclick = () => deletePost(post.id, true);
                }
            } else {
                if (reportBtnFull) {
                    reportBtnFull.style.display = 'inline-block';
                    reportBtnFull.onclick = () => reportContent('post', post.id);
                }
                if (editBtnFull) editBtnFull.classList.add('hidden');
                if (deleteBtnFull) deleteBtnFull.classList.add('hidden');
            }

            // Formulário de comentário
            postEl.querySelector('#comment-form').onsubmit = handleCommentSubmit;

            // --- NOVO: Aplica auto-resize no textarea principal ---
            const mainCommentTextarea = postEl.querySelector('#comment-content');
            if (mainCommentTextarea) {
                setupAutoResizeTextarea(mainCommentTextarea);
            }

            // Renderizar comentários
            // Configura o botão "Mostrar mais comentários"
            const loadMoreCommentsBtn = postEl.querySelector('#btn-load-more-comments');
            loadMoreCommentsBtn.onclick = () => fetchAndRenderComments(postId, ++currentCommentsPage, true);

            postView.innerHTML = '';
            postView.appendChild(postEl);

            // Carrega os comentários iniciais
            fetchAndRenderComments(postId, 1, false);

            // Carregar Tópicos Populares na Sidebar
            loadRelatedPosts(postEl.querySelector('#related-posts-container'), postId);

        } catch (err) {
            postView.innerHTML = '<p>Erro ao carregar a discussão.</p>';
            console.error(err);
        }
    }

    // Nova função para carregar comentários com paginação
    async function fetchAndRenderComments(postId, page = 1, append = false) {
        const commentThread = document.getElementById('comment-thread');
        const loadMoreBtn = document.getElementById('btn-load-more-comments');
        
        if (!commentThread || !loadMoreBtn) return;

        if (!append) {
            commentThread.innerHTML = '<div style="text-align:center; padding:20px; color:#999;">Carregando comentários...</div>';
            loadMoreBtn.style.display = 'none';
        } else {
            loadMoreBtn.textContent = 'Carregando...';
            loadMoreBtn.disabled = true;
        }

        try {
            // Busca um item a mais para verificar se há próxima página
            const fetchLimit = COMMENTS_LIMIT + 1;
            const res = await apiFetch(`${API_BASE_URL}/api/forum/posts/${postId}/comments?page=${page}&limit=${fetchLimit}&pageSize=${COMMENTS_LIMIT}&_t=${Date.now()}`);
            
            if (!res.ok) throw new Error('Erro ao buscar comentários');
            
            const comments = await res.json();
            
            if (!append) commentThread.innerHTML = '';

            // Lógica de Paginação
            let hasMore = false;
            if (comments.length > COMMENTS_LIMIT) {
                hasMore = true;
                comments.pop(); // Remove o item extra
            }

            if (comments.length === 0 && !append) {
                commentThread.innerHTML = '<p style="color:#666; padding:20px; text-align:center; font-style:italic;">Seja o primeiro a comentar nesta discussão!</p>';
            } else {
                comments.forEach(comment => renderComment(comment, commentThread));
            }

            // Atualiza visibilidade do botão
            if (hasMore) {
                loadMoreBtn.style.display = 'inline-block';
                loadMoreBtn.textContent = 'Mostrar mais comentários';
                loadMoreBtn.disabled = false;
                loadMoreBtn.classList.remove('hidden');
            } else {
                loadMoreBtn.style.display = 'none';
            }

        } catch (err) {
            console.error(err);
            if (!append) commentThread.innerHTML = '<p style="color:#d32f2f; padding:15px; text-align:center;">Erro ao carregar comentários.</p>';
        }
    }

    // Carregar Posts Relacionados/Populares
    async function loadRelatedPosts(container, currentPostId) {
        if (!container) return;
        container.innerHTML = '<div style="padding:20px; text-align:center; color:#999;">Carregando...</div>';

        try {
            // Busca posts populares (trazemos 6 para garantir que tenhamos 5 mesmo se o atual estiver na lista)
            const res = await apiFetch(`${API_BASE_URL}/api/forum/posts?filter=populares&limit=6`);
            if (!res.ok) return;
            
            const posts = await res.json();
            
            // Filtra para não mostrar o post que já estamos vendo
            const related = posts.filter(p => p.id != currentPostId).slice(0, 5);
            
            container.innerHTML = '';
            
            if (related.length === 0) {
                container.innerHTML = '<p style="color:#999; font-size:0.9rem; padding:10px;">Nenhum tópico popular no momento.</p>';
                return;
            }

            const relatedTemplate = document.getElementById('forum-related-post-template');
            
            related.forEach(post => {
                const item = relatedTemplate.content.cloneNode(true).firstElementChild;
                
                item.querySelector('.related-post-category').textContent = post.category;
                item.querySelector('.related-post-title').textContent = post.title;
                item.querySelector('.related-post-votes').textContent = `❤️ ${post.votes}`;
                item.querySelector('.related-post-comments').textContent = `💬 ${post.commentCount}`;
                
                item.onclick = (e) => {
                    e.preventDefault();
                    loadFullPost(post.id);
                };
                
                container.appendChild(item);
            });
        } catch (err) {
            console.error(err);
            container.innerHTML = '';
        }
    }

    // Renderiza um comentário
    function renderComment(comment, container) {
        const commentEl = commentTemplate.content.cloneNode(true).firstElementChild;
        commentEl.dataset.commentId = comment.id; // Adiciona ID para permitir respostas
        const authorName = comment.isAnonymous ? 'Anônimo' : comment.authorName;
        
        // CORREÇÃO: Define o avatar e o nome em elementos separados
        const authorAvatarEl = commentEl.querySelector('.comment-avatar');
        if (authorAvatarEl) authorAvatarEl.src = formatImageUrl(comment.authorPhoto);
        commentEl.querySelector('.comment-author').textContent = authorName;
        
        if (comment.isAnonymous) commentEl.querySelector('.comment-author').style.fontStyle = 'italic';
        
        const badgesContainer = commentEl.querySelector('.author-badges');
        if (badgesContainer) {
            badgesContainer.innerHTML = renderInlineAuthorBadges(comment.authorBadges, comment.authorLevel);
        }

        commentEl.querySelector('.comment-time').textContent = `• há ${timeSince(comment.createdAt)}`;
        commentEl.querySelector('.comment-body').textContent = comment.content;
        
        // Ações do comentário (Like, Responder)
        const likeBtn = commentEl.querySelector('.comment-like-btn');
        const likesCount = commentEl.querySelector('.comment-likes-count');
        const replyBtn = commentEl.querySelector('.comment-reply-btn');

        likesCount.textContent = comment.likes || 0;
        if (comment.likedByMe) {
            likeBtn.classList.add('liked');
        }

        likeBtn.onclick = () => toggleCommentLike(comment.id, likeBtn, likesCount);
        replyBtn.onclick = () => showReplyForm(comment.id, commentEl);

        const reportBtn = commentEl.querySelector('.report-btn');
        if (comment.isMine) {
            reportBtn.style.display = 'none';
        }
        reportBtn.onclick = () => reportContent('comment', comment.id);

        // Ações do Dono (Editar e Excluir)
        if (comment.isMine) {
            const actionsDiv = commentEl.querySelector('.comment-actions');
            const reportBtn = commentEl.querySelector('.report-btn');

            // 1. Editar (Ícone)
            const editBtn = document.createElement('button');
            // margin-left: auto empurra o grupo para a direita
            editBtn.style.cssText = "background:none; border:none; cursor:pointer; font-size:1rem; margin-left:auto; color: #999;";
            editBtn.innerHTML = EDIT_ICON_SVG;
            editBtn.title = 'Editar';
            editBtn.onclick = () => enableCommentEditing(comment, commentEl);
            
            // 2. Excluir (Ícone)
            const deleteBtn = document.createElement('button');
            deleteBtn.style.cssText = "background:none; border:none; cursor:pointer; font-size:1rem; color: #999;";
            deleteBtn.innerHTML = DELETE_ICON_SVG;
            deleteBtn.title = 'Excluir';
            deleteBtn.onclick = () => deleteComment(comment.id, commentEl);

            // Adiciona botões de ação
            actionsDiv.appendChild(editBtn);
            actionsDiv.appendChild(deleteBtn);
        }

        // Renderiza respostas aninhadas, se houver
        if (comment.replies && comment.replies.length > 0) {
            const repliesContainer = commentEl.querySelector('.comment-replies-container');
            
            // --- NOVA LÓGICA: Paginação e Colapso ---
            const allReplies = comment.replies;
            let shownCount = 0;
            const BATCH_SIZE = 3; // Mostra 3 por vez

            // 1. Botão Toggle (Ver X respostas) - Inicial
            const toggleBtn = document.createElement('button');
            toggleBtn.textContent = `Ver mais ${comment.replies.length} respostas`;
            toggleBtn.style.cssText = "background:none; border:none; color:#1B4332; font-size:0.85rem; font-weight:600; cursor:pointer; margin-top:10px; padding:5px 0; text-decoration:underline; display:block;";
            
            // 2. Botão Carregar Mais (Aparece no final da lista)
            const loadMoreBtn = document.createElement('button');
            loadMoreBtn.textContent = "Mostrar mais respostas ⬇";
            loadMoreBtn.style.cssText = "background:none; border:none; color:#666; font-size:0.8rem; font-weight:600; cursor:pointer; margin-top:5px; padding:5px 0; display:none; margin-left: 10px;";

            // Insere o botão de abrir antes do container
            repliesContainer.parentNode.insertBefore(toggleBtn, repliesContainer);
            
            // Configuração inicial do container
            repliesContainer.style.display = 'none';
            repliesContainer.classList.add('thread-line-interactive'); // Classe para CSS (cursor pointer na linha)
            repliesContainer.title = "Clique na linha à esquerda para colapsar";

            // Função para renderizar o próximo lote
            const renderNextBatch = () => {
                const nextBatch = allReplies.slice(shownCount, shownCount + BATCH_SIZE);
                nextBatch.forEach(reply => renderComment(reply, repliesContainer));
                shownCount += nextBatch.length;

                // Gerencia botão "Carregar mais"
                if (shownCount < allReplies.length) {
                    repliesContainer.appendChild(loadMoreBtn); // Move para o final
                    loadMoreBtn.style.display = 'block';
                } else {
                    loadMoreBtn.remove(); // Remove se acabou
                }
            };

            // Ação do Toggle (Abrir Thread)
            toggleBtn.onclick = () => {
                repliesContainer.style.display = 'block';
                toggleBtn.style.display = 'none';
                // Se ainda não renderizou nada, renderiza o primeiro lote
                if (shownCount === 0) renderNextBatch();
            };

            // Ação do Load More (Carregar mais 3)
            loadMoreBtn.onclick = (e) => {
                e.stopPropagation();
                renderNextBatch();
            };

            // --- LÓGICA DE COLAPSAR (CLIQUE NA LINHA) ---
            repliesContainer.addEventListener('click', (e) => {
                const rect = repliesContainer.getBoundingClientRect();
                // Área de clique: 15px da esquerda (cobre a borda e um pouco do padding)
                if ((e.clientX - rect.left) <= 15) {
                    e.stopPropagation(); // Não propaga para o pai
                    
                    // Colapsa
                    repliesContainer.style.display = 'none';
                    toggleBtn.style.display = 'block';
                    toggleBtn.textContent = `Ver mais ${comment.replies.length} respostas (Thread colapsada)`;
                }
            });
        }

        container.appendChild(commentEl);
    }

    // Mostra o formulário de resposta a um comentário
    function showReplyForm(parentId, parentElement) {
        // Remove formulários de resposta abertos para não poluir
        const existingForm = document.getElementById('reply-form-dynamic');
        if (existingForm) existingForm.remove();

        const formContainer = document.createElement('div');
        formContainer.id = 'reply-form-dynamic';
        // Estilo movido para CSS para suportar mobile fixed position
        formContainer.innerHTML = `
            <form>
                <div class="form-group">
                    <textarea rows="1" placeholder="Escreva sua resposta..." required class="comment-input-capsule"></textarea>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 15px; margin-top: 8px;">
                    <button type="button" class="btn-cancel-reply" style="background:none; border:none; text-decoration:underline; cursor:pointer; color:#666; font-size:0.9rem;">Cancelar</button>
                    <button type="submit" class="btn-submit-reply" style="background:none; border:none; text-decoration:underline; cursor:pointer; color:#1B4332; font-weight:bold; font-size:0.9rem;">Responder</button>
                </div>
            </form>
        `;
        
        parentElement.querySelector('.comment-replies-container').prepend(formContainer);
        const textarea = formContainer.querySelector('textarea');
        
        // Aplica o auto-resize no textarea de resposta
        setupAutoResizeTextarea(textarea);
        textarea.focus();

        formContainer.querySelector('form').onsubmit = (e) => handleCommentSubmit(e, parentId);
        formContainer.querySelector('.btn-cancel-reply').onclick = () => formContainer.remove();
    }

    // --- Funções de Ação ---

    // Carrega os posts do feed
    async function fetchAndRenderPosts(page = 1, append = false) {
        if (isLoadingMore) return;
        if (append) isLoadingMore = true;

        if (!append) {
            postsContainer.innerHTML = '<div class="loader-wrapper"><div class="loader-spinner"></div></div>';
            loadMoreBtn.style.display = 'none';
        }
        if (loadMoreBtn) {
            loadMoreBtn.textContent = 'Carregando...';
            loadMoreBtn.disabled = true;
        }
        try {
            // Pega o filtro da aba ativa e o termo de busca
            const activeFilter = document.querySelector('.forum-tabs .tab-item.active')?.dataset.filter || 'populares';
            const searchTerm = document.getElementById('forum-search-input')?.value || '';
            let posts;
            
            if (page === 1 && preFetchedData) {
                posts = await preFetchedData;
                preFetchedData = null;
            } else {
                // Busca um item a mais (POSTS_LIMIT + 1) para verificar se há próxima página
                const fetchLimit = POSTS_LIMIT + 1;
                const res = await apiFetch(`${API_BASE_URL}/api/forum/posts?filter=${activeFilter}&search=${encodeURIComponent(searchTerm)}&page=${page}&limit=${fetchLimit}&pageSize=${POSTS_LIMIT}&_t=${Date.now()}`);
                if (!res.ok) throw new Error('Erro ao buscar posts');
                posts = await res.json();
            }

            if (!append) postsContainer.innerHTML = '';
            
            if (!Array.isArray(posts) || posts.length === 0) {
                if (!append) postsContainer.innerHTML = '<p style="text-align:center; color:#888;">Nenhuma discussão encontrada.</p>';
                if (loadMoreBtn) loadMoreBtn.style.display = 'none';
                return;
            }

            // Lógica de Paginação: Se vieram mais posts que o limite, existe próxima página
            let hasMore = false;
            if (posts.length > POSTS_LIMIT) {
                hasMore = true;
                posts.pop(); // Remove o item extra da exibição atual
            }

            posts.forEach(renderPostCard);
            
            if (loadMoreBtn) {
                if (hasMore) {
                    loadMoreBtn.style.display = 'inline-block';
                    loadMoreBtn.classList.remove('hidden');
                } else {
                    loadMoreBtn.style.display = 'none';
                }
            }

        } catch (err) {
           if (!append) postsContainer.innerHTML = '<p>Erro ao carregar discussões.</p>';
            console.error(err);
        } finally {
            if (loadMoreBtn) { loadMoreBtn.textContent = 'Mostrar mais'; loadMoreBtn.disabled = false; }
            if (append) isLoadingMore = false;
        }
    }

    // Submete o formulário de novo post
    async function handlePostSubmit(e) {
        e.preventDefault();
        const btn = document.getElementById('forum-submit-post-btn');
        btn.disabled = true;
        btn.textContent = 'Publicando...';

        const formData = new FormData(createForm);
        const data = {
            title: sanitizeHTML(formData.get('title')),
            content: sanitizeHTML(formData.get('content')),
            category: formData.get('category'),
            isAnonymous: formData.get('isAnonymous') === 'on'
        };

        try {
            await apiFetch(`${API_BASE_URL}/api/forum/posts`, { method: 'POST', body: JSON.stringify(data) });
            showToast('Discussão criada com sucesso!', 'success');
            createModal.style.display = 'none';
            createForm.reset();
            fetchAndRenderPosts(); // Recarrega o feed
        } catch (err) {
            showToast('Erro ao criar discussão.', 'error');
            console.error(err);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Publicar';
        }
    }

    // Submete um novo comentário
    async function handleCommentSubmit(e, parentId = null) {
        e.preventDefault();
        const form = e.target;
        const textarea = form.querySelector('textarea');
        const checkbox = form.querySelector('input[type="checkbox"]');
        const btn = form.querySelector('button[type="submit"]');
        const content = textarea.value.trim();
        
        if (!content) return;

        btn.disabled = true;
        const data = {
            content: sanitizeHTML(content),
            isAnonymous: checkbox ? checkbox.checked : false, // Checkbox pode não existir no form de resposta
            parentId: parentId
        };

        try {
            const res = await apiFetch(`${API_BASE_URL}/api/forum/posts/${currentPostId}/comments`, { method: 'POST', body: JSON.stringify(data) });
            if (!res.ok) throw new Error('Erro ao salvar comentário');
            const newComment = await res.json();
            
            // Decide onde renderizar: no container principal ou no de respostas
            const container = parentId ? document.querySelector(`.comment-card[data-comment-id="${parentId}"] .comment-replies-container`) : document.getElementById('comment-thread');
            
            if (!container) throw new Error('Container não encontrado');
            renderComment(newComment, container);
            
            form.reset();
            if (parentId) form.parentElement.remove(); // Remove o form dinâmico de resposta
        } catch (err) {
            showToast('Erro ao enviar comentário.', 'error');
            console.error(err);
        } finally {
            btn.disabled = false;
        }
    }

    // Lógica de "Apoiar"
    async function toggleSupport(postId, btnElement) {
        const isSupported = btnElement.classList.toggle('supported');
        const votesCountEl = btnElement.parentElement.querySelector('.post-votes-count');
        let currentVotes = parseInt(votesCountEl.textContent);
        votesCountEl.textContent = isSupported ? currentVotes + 1 : currentVotes - 1;

        try {
            await apiFetch(`${API_BASE_URL}/api/forum/posts/${postId}/vote`, { method: 'POST' });
        } catch (err) {
            // Reverte a ação em caso de erro
            btnElement.classList.toggle('supported');
            votesCountEl.textContent = currentVotes;
            showToast('Erro ao registrar voto.', 'error');
        }
    }

    // Lógica de "Like" em Comentário
    async function toggleCommentLike(commentId, btnElement, countElement) {
        const isLiked = btnElement.classList.toggle('liked');
        let currentLikes = parseInt(countElement.textContent);
        countElement.textContent = isLiked ? currentLikes + 1 : currentLikes - 1;

        try {
            // API real para registrar o voto no comentário
            await apiFetch(`${API_BASE_URL}/api/forum/comments/${commentId}/vote`, { method: 'POST' });
        } catch (err) {
            // Reverte a ação em caso de erro
            btnElement.classList.toggle('liked');
            countElement.textContent = currentLikes;
            showToast('Erro ao registrar voto no comentário.', 'error');
        }
    }

    // Excluir Post
    async function deletePost(id, isFullView = false) {
        abrirModalConfirmacaoPersonalizado(
            'Excluir Discussão',
            'Tem certeza que deseja excluir esta discussão permanentemente? Esta ação não pode ser desfeita.',
            async () => {
                try {
                    const res = await apiFetch(`${API_BASE_URL}/api/forum/posts/${id}`, { method: 'DELETE' });
                    if (res.ok) {
                        showToast('Discussão excluída.', 'success');
                        if (isFullView) {
                            // Volta para o feed
                            postView.classList.add('hidden');
                            feedView.classList.remove('hidden');
                            if (fab) fab.style.display = 'block';
                            currentPostId = null;
                        }
                        fetchAndRenderPosts();
                    } else {
                        showToast('Erro ao excluir discussão.', 'error');
                    }
                } catch (err) {
                    showToast('Erro ao excluir discussão.', 'error');
                }
            }
        );
    }

    // Excluir Comentário
    async function deleteComment(id, element) {
        abrirModalConfirmacaoPersonalizado(
            'Excluir Comentário',
            'Tem certeza que deseja excluir este comentário?',
            async () => {
                try {
                    const res = await apiFetch(`${API_BASE_URL}/api/forum/comments/${id}`, { method: 'DELETE' });
                    if (res.ok) {
                        element.remove();
                        showToast('Comentário excluído.', 'success');
                    } else {
                        showToast('Erro ao excluir comentário.', 'error');
                    }
                } catch (err) {
                    showToast('Erro ao excluir comentário.', 'error');
                }
            }
        );
    }

    // Lógica de "Denunciar"
    function reportContent(type, id) {
        abrirModalConfirmacaoPersonalizado(
            'Denunciar Conteúdo',
            'Você tem certeza que deseja denunciar este conteúdo como inadequado? Nossa equipe de moderação será notificada.',
            async () => {
                try {
                    await apiFetch(`${API_BASE_URL}/api/forum/report`, { method: 'POST', body: JSON.stringify({ type, id }) });
                    showToast('Denúncia enviada. Agradecemos sua colaboração!', 'info');
                } catch (err) {
                    showToast('Erro ao enviar denúncia.', 'error');
                }
            }
        );
    }

    // --- FUNÇÕES DE EDIÇÃO ---

    // Abrir Modal de Edição de Post
    function openEditPostModal(post) {
        // Popula o formulário com os dados atuais
        createForm.querySelector('[name="title"]').value = post.title;
        createForm.querySelector('[name="category"]').value = post.category;
        createForm.querySelector('[name="content"]').value = post.content;
        createForm.querySelector('[name="isAnonymous"]').checked = post.isAnonymous;

        // Altera visualmente para modo de edição
        createModal.querySelector('h3').textContent = 'Editar Discussão';
        const submitBtn = document.getElementById('forum-submit-post-btn');
        submitBtn.textContent = 'Salvar Alterações';

        // Substitui o handler de submit
        createForm.onsubmit = async (e) => {
            e.preventDefault();
            submitBtn.disabled = true;
            submitBtn.textContent = 'Salvando...';

            const formData = new FormData(createForm);
            const data = {
                title: sanitizeHTML(formData.get('title')),
                content: sanitizeHTML(formData.get('content')),
                category: formData.get('category'),
                isAnonymous: formData.get('isAnonymous') === 'on'
            };

            try {
                const res = await apiFetch(`${API_BASE_URL}/api/forum/posts/${post.id}`, { 
                    method: 'PUT', 
                    body: JSON.stringify(data) 
                });
                
                if (res.ok) {
                    showToast('Discussão atualizada!', 'success');
                    createModal.style.display = 'none';
                    createForm.reset();
                    
                    // Se estiver vendo o post completo, recarrega ele
                    if (currentPostId === post.id) loadFullPost(post.id);
                    // Recarrega o feed
                    fetchAndRenderPosts();
                } else {
                    showToast('Erro ao atualizar discussão.', 'error');
                }
            } catch (err) {
                showToast('Erro ao atualizar discussão.', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Salvar Alterações';
            }
        };

        createModal.style.display = 'flex';
    }

    // Habilitar Edição de Comentário Inline
    function enableCommentEditing(comment, commentEl) {
        const bodyEl = commentEl.querySelector('.comment-body');
        const originalContent = comment.content;
        
        // Esconde o texto original
        bodyEl.style.display = 'none';
        
        // Cria o formulário de edição se não existir
        if (commentEl.querySelector('.edit-comment-form')) return;

        const editForm = document.createElement('div');
        editForm.className = 'edit-comment-form';
        editForm.style.marginTop = '10px';
        editForm.innerHTML = `
            <textarea rows="3" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;">${originalContent}</textarea>
            <div style="display: flex; justify-content: flex-end; gap: 15px; margin-top: 8px;">
                <button class="cancel-edit" style="background:none; border:none; text-decoration:underline; cursor:pointer; color:#666; font-size:0.9rem;">Cancelar</button>
                <button class="save-edit" style="background:none; border:none; text-decoration:underline; cursor:pointer; color:#1B4332; font-weight:bold; font-size:0.9rem;">Salvar</button>
            </div>
        `;
        
        bodyEl.parentNode.insertBefore(editForm, bodyEl.nextSibling);
        
        const textarea = editForm.querySelector('textarea');
        
        // Ação Cancelar
        editForm.querySelector('.cancel-edit').onclick = () => {
            editForm.remove();
            bodyEl.style.display = 'block';
        };
        
        // Ação Salvar
        editForm.querySelector('.save-edit').onclick = async () => {
            const newContent = textarea.value.trim();
            if (!newContent) return;
            
            try {
                const res = await apiFetch(`${API_BASE_URL}/api/forum/comments/${comment.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ content: newContent })
                });
                
                if (res.ok) {
                    const updatedComment = await res.json();
                    comment.content = updatedComment.content; // Atualiza objeto local
                    bodyEl.textContent = updatedComment.content; // Atualiza UI
                    editForm.remove();
                    bodyEl.style.display = 'block';
                    showToast('Comentário atualizado.', 'success');
                } else {
                    showToast('Erro ao atualizar comentário.', 'error');
                }
            } catch (err) {
                showToast('Erro ao atualizar comentário.', 'error');
            }
        };
    }

    // --- Inicialização e Event Listeners ---
    fab.onclick = () => {
        // Reseta o modal para o estado de "Criar"
        createForm.reset();
        createModal.querySelector('h3').textContent = 'Criar Nova Discussão';
        document.getElementById('forum-submit-post-btn').textContent = 'Publicar';
        createForm.onsubmit = handlePostSubmit;
        createModal.style.display = 'flex';
    };
    closeModalBtn.onclick = () => createModal.style.display = 'none';
    createModal.onclick = (e) => { if (e.target === createModal) createModal.style.display = 'none'; };
    createForm.onsubmit = handlePostSubmit;
    
    // --- LÓGICA DE ABAS DE FILTRO ---
    const tabs = document.querySelectorAll('.forum-tabs .tab-item');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            currentPage = 1;
            fetchAndRenderPosts(1, false);
        });
    });

    // --- LÓGICA DE BUSCA ---
    const searchInput = document.getElementById('forum-search-input');
    let searchDebounce;
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchDebounce);
            searchDebounce = setTimeout(() => {
                currentPage = 1;
                fetchAndRenderPosts(1, false);
            }, 500); // Espera 500ms após o usuário parar de digitar
        });
    }

    if (loadMoreBtn) {
        loadMoreBtn.onclick = () => fetchAndRenderPosts(++currentPage, true);
    }

    // Carga inicial com o filtro padrão
    fetchAndRenderPosts(1, false);
}
});
// Arquivo: psi_dashboard.js (VERSÃO FINAL 2.1)

document.addEventListener('DOMContentLoaded', function() {
    // --- SHADOW TRACKING (TELEMETRIA DE USO) ---
    document.body.addEventListener('click', function(e) {
        // Captura cliques em elementos com classe track-feature ou em links de navegação do menu principal
        const trackEl = e.target.closest('.track-feature') || e.target.closest('.sidebar-nav a') || e.target.closest('.bottom-nav-item');
        
        if (trackEl) {
            let funcionalidade = trackEl.getAttribute('data-feature');
            
            // Fallback: se não tiver data-feature explícito, extrai do data-page (ex: 'psi_financeiro.html' vira 'financeiro')
            if (!funcionalidade) {
                const page = trackEl.getAttribute('data-page') || trackEl.getAttribute('data-target-page');
                if (page) {
                    funcionalidade = page.replace('psi_', '').replace('.html', '');
                }
            }
            
            if (!funcionalidade) return;
            
            const token = localStorage.getItem('Yelo_token');
            if (!token) return;

            const API_BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : 'http://localhost:3001';

            fetch(`${API_BASE_URL}/api/tracking/uso-feature`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ feature: funcionalidade })
            }).catch(err => console.error('Erro no tracking', err));
        }
    });

    // --- FIX: Adiciona evento de clique para o card de Benchmarking ---
    // Delegação de evento no body para garantir que funcione mesmo com conteúdo carregado dinamicamente.
    document.body.addEventListener('click', function(e) {
        // Procura por um link com data-page dentro dos cards de KPI
        const link = e.target.closest('.kpi-card a[data-page]');
        if (link) {
            e.preventDefault(); // Impede a navegação padrão do link
            // Usa a função global para carregar a página de análise
            const pageToLoad = link.getAttribute('data-page');
            if (pageToLoad && typeof window.loadPage === 'function') {
                window.loadPage(pageToLoad);
            }
        }
    });

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
            background-color: #E63946; /* Vermelho Alerta (Mais visível) */
            color: white;
            border-radius: 50px;
            min-width: 20px;
            height: 20px;
            padding: 0 6px;
            margin-left: auto; /* Empurra para o canto direito no flexbox sem sobrepor o texto */
            display: none;
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

        @keyframes fadeInUpBanner {
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
        let targetPage = pageName;
        // O motivo da bolinha amarela aparecer em Ajustes foi eliminado:
        // if (pageName === 'psi_caixa_de_entrada.html') {
        //     targetPage = 'psi_ajustes_hub.html';
        // }
        
        const updateBadgeOnElement = (element, isBottomNav = false) => {
            if (!element) return;
            let badge = element.querySelector('.sidebar-badge');
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'sidebar-badge';
                if (isBottomNav) {
                    badge.style.position = 'absolute';
                    badge.style.top = '0';
                    badge.style.right = '10px';
                    badge.style.transform = 'none';
                    badge.style.margin = '0';
                    element.style.position = 'relative';
                }
                element.appendChild(badge);
            }
            
            // Permite receber um número direto ou boolean
            let num = 0;
            if (typeof show === 'number') {
                num = show;
            } else if (show === true) {
                num = window.psiUnreadConversations ? window.psiUnreadConversations.size : 0;
            }

            if (num > 0) {
                badge.textContent = num > 99 ? '99+' : num;
                badge.classList.add('visible');
                badge.style.display = 'flex';
            } else {
                badge.classList.remove('visible');
                badge.textContent = '';
                badge.style.display = 'none';
            }
        };
        
        // Atualiza na sidebar desktop
        updateBadgeOnElement(document.querySelector(`.sidebar-nav a[data-page="${targetPage}"]`), false);
        // Atualiza na bottom nav mobile
        updateBadgeOnElement(document.querySelector(`.bottom-nav-item[data-target-page="${targetPage}"]`), true);
        
        // Atualiza no sino do header mobile (Avisos)
        if (targetPage === 'psi_avisos.html') {
            const mobileAvisosTrigger = document.getElementById('mobile-avisos-trigger');
            if (mobileAvisosTrigger) {
                let badge = mobileAvisosTrigger.querySelector('.sidebar-badge');
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'sidebar-badge';
                    badge.style.position = 'absolute';
                    badge.style.top = '-2px';
                    badge.style.right = '-2px';
                    badge.style.transform = 'none';
                    badge.style.margin = '0';
                    badge.style.padding = '0 5px';
                    badge.style.fontSize = '9px';
                    mobileAvisosTrigger.appendChild(badge);
                }
                
                let num = 0;
                if (typeof show === 'number') num = show;
                else if (show === true) num = window.psiUnreadConversations ? window.psiUnreadConversations.size : 0;

                if (num > 0) {
                    badge.textContent = num > 99 ? '99+' : num;
                    badge.classList.add('visible');
                    badge.style.display = 'flex';
                } else {
                    badge.classList.remove('visible');
                    badge.textContent = '';
                    badge.style.display = 'none';
                }
            }
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
    
    // Elementos do Cropper
    const cropModal = document.getElementById('crop-modal');
    const imageElement = document.getElementById('image-to-crop');
    const btnCancelCrop = document.getElementById('btn-cancel-crop');
    const btnConfirmCrop = document.getElementById('btn-confirm-crop');
    let cropper = null;

    if (sidebarTrigger && sidebarInput) {
        sidebarTrigger.onclick = () => sidebarInput.click();

        sidebarInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                // Validação prévia de tamanho (10MB)
                if (file.size > 10 * 1024 * 1024) {
                    showToast('Arquivo muito grande. Limite máximo: 10MB.', 'error');
                    sidebarInput.value = '';
                    return;
                }

                const reader = new FileReader();
                reader.onload = (event) => {
                    if (cropModal) cropModal.style.display = 'flex';
                    if (imageElement) {
                        imageElement.src = event.target.result;
                        if (cropper) cropper.destroy();
                        cropper = new Cropper(imageElement, {
                            aspectRatio: 1, // Quadrado perfeito
                            viewMode: 1,
                            autoCropArea: 1,
                        });
                    }
                };
                reader.readAsDataURL(file);
            }
        };

        if (btnCancelCrop) {
            btnCancelCrop.onclick = () => {
                if (cropModal) cropModal.style.display = 'none';
                if (cropper) cropper.destroy();
                sidebarInput.value = '';
            };
        }

        if (btnConfirmCrop) {
            btnConfirmCrop.onclick = () => {
                if (!cropper) return;
                
                cropper.getCroppedCanvas({ width: 400, height: 400 }).toBlob(async (blob) => {
                    if (!blob) return;
                    if (cropModal) cropModal.style.display = 'none';
                    
                    const fd = new FormData();
                    fd.append('foto', blob, 'profile.jpg');
                    showToast('Enviando foto...', 'info');

                    try {
                        const res = await apiFetch(`${API_BASE_URL}/api/psychologists/me/foto`, { method: 'POST', body: fd });
                        if (res.ok) {
                            const d = await res.json();
                            if(psychologistData) psychologistData.fotoUrl = d.fotoUrl;
                            atualizarInterfaceLateral();
                            showToast('Foto atualizada!', 'success');
                        } else {
                            const errData = await res.json().catch(() => ({}));
                            throw new Error(errData.error || 'Erro ao enviar foto.');
                        }
                    } catch (err) {
                        showToast(err.message || 'Erro ao enviar foto.', 'error');
                    } finally {
                        if (cropper) cropper.destroy();
                        sidebarInput.value = '';
                    }
                }, 'image/jpeg', 0.9);
            };
        }
    }

    // --- LÓGICA DO BOTÃO SAIR (LOGOUT) ---
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.onclick = function() {
            // 1. Feedback visual (opcional, mas bom para mobile)
            this.textContent = "Saindo...";
            
            // 2. Remove o "crachá" de acesso (Token)
            localStorage.removeItem('Yelo_token');
            localStorage.removeItem('yelo_last_psi_page'); // Limpa a última página visitada no logout
            
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


    // --- HELPERS E FETCH (Agora importados via scripts globais em /js) ---
    const showToast = window.showToast;
    const formatImageUrl = window.formatImageUrl;
    const apiFetch = window.apiFetch;

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

                // Sincroniza o nome e foto no LocalStorage para o Header Público
                if (psychologistData.nome) {
                    localStorage.setItem('Yelo_user_name', psychologistData.nome);
                }
                if (psychologistData.fotoUrl) {
                    localStorage.setItem('Yelo_user_photo', psychologistData.fotoUrl);
                }
                
                // --- SANITIZAÇÃO DE DADOS LEGADOS (GHOST TAGS) ---
                // Impede que tags antigas fiquem presas e invisíveis no painel de edição
                const sanitizeTags = (field) => {
                    if (!psychologistData[field]) return;
                    let arr = psychologistData[field];
                    
                    if (typeof arr === 'string') { 
                        if (arr.trim().startsWith('[')) {
                            try { arr = JSON.parse(arr); } catch(e) { arr = [arr]; } 
                        } else {
                            arr = [arr]; 
                        }
                    }
                    
                    if (Array.isArray(arr)) {
                        let clean = [];
                        arr.flat(Infinity).forEach(tag => {
                            if (!tag) return;
                            let t = typeof tag === 'string' ? tag.trim() : tag;
                            
                            // Divide strings legadas concatenadas por vírgula (Ignora vírgula dentro de parênteses como no TDAH)
                            let subTags = [t];
                            if (typeof t === 'string' && t.includes(',')) {
                                subTags = t.split(/,(?![^\(\)]*\))/).map(s => s.trim());
                            }

                            subTags.forEach(subT => {
                                if (!subT) return;
                                if (field === 'praticas_inclusivas') {
                                    if (subT === "Que faça parte da comunidade LGBTQIAPN+" || subT === "Comunidade LGBTQIAPN+") clean.push("Faz parte da comunidade LGBTQIAPN+ / Afirmativa");
                                    else if (subT === "LGBTQIAPN+ friendly" || subT === "LGBTQIAPN+ Friendly") clean.push("LGBTQIAPN+ Friendly 🏳️‍🌈");
                                    else if (subT.includes("não-branca") || subT.includes("Antirracista")) clean.push("Pessoa não-branca // Prática Antirracista");
                                    else if (subT.includes("Feminista")) clean.push("Perspectiva Feminista");
                                    else if (subT.includes("Neurodiversidade") || subT.includes("TDAH") || subT.includes("Autismo")) clean.push("Neurodiversidade (TDAH, Autismo)");
                                    else if (subT === "Faz parte da comunidade LGBTQIAPN+ / Afirmativa" || subT === "LGBTQIAPN+ Friendly 🏳️‍🌈") clean.push(subT);
                                    else if (subT !== "Indiferente" && subT !== "Nenhuma específica") clean.push(subT);
                                } else {
                                    if (subT !== "Indiferente" && subT !== "Nenhuma específica") clean.push(subT);
                                }
                            });
                        });
                        psychologistData[field] = [...new Set(clean)];
                    }
                };
                
                const multiSelectFields = ['temas_atuacao', 'publico_alvo', 'praticas_inclusivas', 'abordagens_tecnicas', 'modalidade', 'disponibilidade_periodo', 'estilo_terapia'];
                multiSelectFields.forEach(f => sanitizeTags(f));

                atualizarInterfaceLateral(); 
                return true;
            } else if (response.status === 401) {
                // Apenas 401 (Não autorizado) deve causar logout
                throw new Error("Token inválido");
            } else {
                // Erros 500, 502, 503 (Servidor/Banco) não devem deslogar o usuário
                console.warn(`Erro no servidor ao buscar perfil: ${response.status}`);
                return false; // Retorna false para tratar na inicialização
            }
        } catch (error) {
            if (error.message === "Token inválido") {
                localStorage.removeItem('Yelo_token');
                window.location.href = '/';
            } else {
                console.error("Erro de conexão ou servidor:", error);
                // Não desloga em erro de rede/fetch
            }
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
        
        // --- NOVO: Atualiza a foto na tela de Ajustes de Perfil (Modo Mobile) ---
        const mobileImgEl = document.getElementById('mobile-profile-photo-preview');
        if (mobileImgEl) {
            mobileImgEl.src = formatImageUrl(psychologistData.fotoUrl);
            mobileImgEl.onerror = function() { this.src = 'https://placehold.co/120x120/1B4332/FFFFFF?text=Psi'; };
        }

        // --- NOVO: Atualiza o Nível Globalmente na Sidebar ---
        let level = psychologistData.authority_level || 'nivel_iniciante';
        // Força "Mentor" se a XP máxima já foi atingida
        if (psychologistData.xp && psychologistData.xp >= 15000) level = 'nivel_mentor';

        const levelMap = { 'nivel_iniciante': 'Iniciante', 'nivel_verificado': 'Verificado', 'nivel_ativo': 'Ativo', 'nivel_especialista': 'Especialista', 'nivel_mentor': 'Mentor' };
        const levelDisplaySidebar = document.getElementById('psi-sidebar-level');
        if (levelDisplaySidebar) {
            levelDisplaySidebar.innerHTML = `🔥 Nível: <strong>${levelMap[level] || 'Iniciante'}</strong>`;
        }

        // --- NOVO: Renderiza as badges ---
        if (psychologistData) {
            renderSidebarBadges(psychologistData);
        }
    }

    function renderSidebarBadges(user) {
        const container = document.getElementById('sidebar-badges-container');
        if (!container || !user) return;
    
        let badgesData = user.badges || {};
        const isMaxLevel = (user.authority_level === 'nivel_mentor' || (user.xp && user.xp >= 15000));

        if (isMaxLevel) {
            badgesData = {
                autentico: true,
                semeador: 'ouro',
                voz_ativa: 'ouro',
                pioneiro: true
            };
        }

        let html = '';
        const badgeInfo = {
            autentico: { emoji: '<svg width="1.2em" height="1.2em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle;"><path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.918-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.337 2.25c-.416-.165-.866-.25-1.336-.25-2.21 0-3.918 1.79-3.918 4 0 .495.084.965.238 1.4-1.273.65-2.148 2.02-2.148 3.6 0 1.46.758 2.746 1.9 3.42-.047.19-.074.385-.074.58 0 2.21 1.71 4.002 3.918 4.002.47 0 .92-.086 1.336-.25.52 1.335 1.828 2.25 3.337 2.25s2.816-.915 3.337-2.25c.416.164.866.25 1.336.25 2.21 0 3.918-1.792 3.918-4 0-.195-.027-.39-.074-.58 1.14-.675 1.9-1.96 1.9-3.42z" fill="#1B4332"/><path d="M16.97 8.47a1.5 1.5 0 0 1 0 2.12l-6.5 6.5a1.5 1.5 0 0 1-2.12 0l-3.5-3.5a1.5 1.5 0 1 1 2.12-2.12l2.44 2.44 5.44-5.44a1.5 1.5 0 0 1 2.12 0z" fill="white"/></svg>', title: 'Autêntico: Perfil 100% completo e verificado.' },
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
        
        // Update novo design da sidebar (Nome do Nível)
        const levelMap = { 'nivel_iniciante': 'Iniciante', 'nivel_verificado': 'Verificado', 'nivel_ativo': 'Ativo', 'nivel_especialista': 'Especialista', 'nivel_mentor': 'Mentor' };
        const levelDisplaySidebar = document.getElementById('psi-sidebar-level');
        if(levelDisplaySidebar) {
            levelDisplaySidebar.innerHTML = `🔥 Nível: <strong>${levelMap[level] || 'Iniciante'}</strong>`;
        }

        const badges = user.badges || {};
        const currentXP = user.xp || 0;
        const progress = user.gamificationProgress || { blogPostCount: 0, forumActivityCount: 0, answerCount: 0 };

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
            if(xpProgressText) xpProgressText.textContent = `${currentXP} // ${nextLevelObj.min} XP`;
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

        const updateBadgeCard = (elementId, badgeLevel, currentCount, thresholds) => {
            const el = document.getElementById(elementId);
            if (!el) return;
            const statusEl = el.querySelector('.badge-status');
            const progressContainer = el.querySelector('.badge-progress-container');
            const progressBar = el.querySelector('.badge-progress-bar');
            const progressText = el.querySelector('.badge-progress-text');
            
            el.classList.remove('unlocked', 'locked', 'bronze', 'prata', 'ouro', 'unico');
            
            let finalLevel = badgeLevel;
            const isMaxLevel = (level === 'nivel_mentor' || currentXP >= 15000);

            if (isMaxLevel) {
                finalLevel = thresholds ? 'ouro' : 'unico';
                if (currentCount !== null && thresholds) currentCount = Math.max(currentCount, thresholds.ouro);
            } else if (thresholds && currentCount !== null) {
                if (currentCount >= thresholds.ouro) finalLevel = 'ouro';
                else if (currentCount >= thresholds.prata) finalLevel = 'prata';
                else if (currentCount >= thresholds.bronze) finalLevel = 'bronze';
            }

            let target, progressTextStr, progressPercentage;

            if (thresholds) {
                if (finalLevel === 'ouro') {
                    target = thresholds.ouro;
                    progressTextStr = `${Math.min(currentCount, target)}/${target} (Máximo)`;
                    progressPercentage = 100;
                } else if (finalLevel === 'prata') {
                    target = thresholds.ouro;
                    progressTextStr = `${currentCount}/${target} para Ouro`;
                    progressPercentage = (currentCount / target) * 100;
                } else if (finalLevel === 'bronze') {
                    target = thresholds.prata;
                    progressTextStr = `${currentCount}/${target} para Prata`;
                    progressPercentage = (currentCount / target) * 100;
                } else { // Bloqueado
                    target = thresholds.bronze;
                    progressTextStr = `${currentCount}/${target} para Bronze`;
                    progressPercentage = (currentCount / target) * 100;
                }
            }

            if (finalLevel) {
                el.classList.add('unlocked', typeof finalLevel === 'string' ? finalLevel : 'unico');
                if(statusEl) statusEl.textContent = typeof finalLevel === 'string' ? `${finalLevel.charAt(0).toUpperCase() + finalLevel.slice(1)}` : "Conquistado";
            } else {
                el.classList.add('locked');
                if(statusEl) statusEl.textContent = "Bloqueado";
            }

            if (progressContainer && thresholds) {
                progressContainer.style.display = 'block';
                if(progressBar) progressBar.style.width = `${Math.min(100, progressPercentage)}%`;
                if(progressText) progressText.textContent = progressTextStr;
            } else if (progressContainer) {
                progressContainer.style.display = 'block';
                if(progressBar) progressBar.style.width = finalLevel ? '100%' : '0%';
                if(progressText) progressText.textContent = finalLevel ? '1/1' : '0/1';
            }
        };

        const blogCount = progress.semeador || progress.blogPostCount || 0;
        const forumCount = progress.vozAtiva || progress.forumActivityCount || 0;
        const answersCount = progress.conselheiro || progress.answerCount || 0;

        updateBadgeCard('badge-semeador', badges.semeador, blogCount, { bronze: 1, prata: 5, ouro: 15 });
        updateBadgeCard('badge-voz-ativa', badges.voz_ativa, forumCount, { bronze: 10, prata: 50, ouro: 200 });
        updateBadgeCard('badge-conselheiro', badges.conselheiro, answersCount, { bronze: 10, prata: 50, ouro: 150 });
        
        updateBadgeCard('badge-autentico', badges.autentico, null, null);
        updateBadgeCard('badge-pioneiro', badges.pioneiro, null, null);
    }

    // --- FUNÇÃO DE BLOQUEIO GERAL (NOVA) ---
    function verificarBloqueioGeral(url) {
        if (!psychologistData) return;

        // Páginas permitidas mesmo com o status inativo (para assinar, ajustar perfil, suporte ou exclusão)
        const paginasPermitidas = ['psi_assinatura.html', 'psi_ajustes_hub.html', 'psi_caixa_de_entrada.html', 'psi_excluir_conta.html']; 

        // O Paywall de fim de teste é acionado quando o status muda para inactive
        const estaInativo = psychologistData.status === 'inactive';
        
        const mainEl = document.querySelector('.dashboard-main');
        const paywallOverlay = document.getElementById('paywall-overlay');
        const bannerAnterior = document.querySelector('.restriction-floating-banner');
        const trialPremiumBanner = document.getElementById('trial-premium-banner');


        if (!mainEl) return;
        
        // 1. Limpa os bloqueios visuais da tela anterior
        mainEl.classList.remove('blocked-view');
        mainEl.classList.remove('restricted-mode');
        if (paywallOverlay) paywallOverlay.style.display = 'none';
        if (trialPremiumBanner) trialPremiumBanner.style.display = 'none'; // Esconde o banner de trial por padrão
        if (bannerAnterior) bannerAnterior.remove();

        // Usuários VIP/Isentos nunca são bloqueados
        if (psychologistData.is_exempt) return;

        // 2. Aplica o Paywall se estiver inativo e em página restrita
        if (estaInativo && !paginasPermitidas.includes(url)) {
            mainEl.classList.add('blocked-view');
            
            if (paywallOverlay) {
                paywallOverlay.style.display = 'flex';
            } else {
                // Fallback caso o paywall HTML fixo não exista na página
                mainEl.classList.add('restricted-mode');
                const banner = document.createElement('div');
                banner.className = 'restriction-floating-banner';
                banner.innerHTML = `<span>🔒 Seu período de teste expirou. Ative o Premium para continuar.</span><button onclick="window.loadPage('psi_assinatura.html')">Assinar Agora</button>`;
                document.body.appendChild(banner);
            }
         } else if (psychologistData.showTrialBanner && trialPremiumBanner) {
            // Exibe o banner de trial premium se a flag do backend for true
            trialPremiumBanner.style.display = 'flex';
            const titleEl = document.getElementById('trial-premium-title');
            const messageEl = document.getElementById('trial-premium-message');
            if (titleEl) titleEl.textContent = psychologistData.trialBannerMessage || "Complete seu CPF para liberar o Premium!";
            if (messageEl) messageEl.textContent = "Seu perfil está quase pronto! Adicione seu CPF para ativar seus 14 dias Premium grátis e começar a receber pacientes.";
        }
    }

    function inicializarAjustesHub() {
        const btnPublic = document.getElementById('hub-btn-public-profile');
        if (btnPublic && psychologistData && psychologistData.slug) {
            btnPublic.href = `/${psychologistData.slug}`;
        }
    }

    // --- LÓGICA DO FALE COM A YELO (MODAL MOBILE) ---
    function abrirModalFaleComYelo() {
        let modal = document.getElementById('modal-fale-com-yelo');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-fale-com-yelo';
            modal.className = 'custom-modal-overlay';
            modal.innerHTML = `
                <div class="custom-modal-box">
                    <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <h2 style="margin: 0; font-family: var(--font-titulos); color: var(--verde-escuro);">Fale com a Yelo</h2>
                        <button type="button" class="modal-close" id="btn-fechar-modal-yelo" style="background: none; border: none; font-size: 2rem; cursor: pointer; color: #aaa; padding: 0; line-height: 1;">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p style="margin-bottom: 20px; color: #666; font-size: 0.95rem; line-height: 1.5;">Precisa de ajuda ou tem alguma sugestão? Envie sua mensagem e nossa equipe responderá o mais breve possível.</p>
                        <form id="form-fale-yelo">
                            <div class="form-group" style="margin-bottom: 15px;">
                                <label for="fale-yelo-assunto" style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--verde-escuro);">Assunto</label>
                                <select id="fale-yelo-assunto" name="assunto" required style="width: 100%; padding: 12px 15px; border: 1px solid #e0e0e0; border-radius: 12px; font-family: var(--font-principal); font-size: 1rem; background-color: #f9fafb;">
                                    <option value="Dúvida Geral">Dúvida Geral</option>
                                    <option value="Sou Profissional">Sou Profissional</option>
                                    <option value="Financeiro // Assinatura">Financeiro // Assinatura</option>
                                    <option value="Suporte Técnico">Suporte Técnico</option>
                                    <option value="Sugestões">Sugestões</option>
                                </select>
                            </div>
                            <div class="form-group" style="margin-bottom: 20px;">
                                <label for="fale-yelo-mensagem" style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--verde-escuro);">Sua mensagem</label>
                                <textarea id="fale-yelo-mensagem" rows="5" required style="width: 100%; padding: 12px 15px; border: 1px solid #e0e0e0; border-radius: 12px; font-family: var(--font-principal); font-size: 1rem; resize: vertical; box-sizing: border-box; background-color: #f9fafb;" placeholder="Como podemos ajudar?"></textarea>
                            </div>
                            <div class="form-status" id="fale-yelo-status" style="min-height:1.5em; margin-bottom: 15px; font-weight: bold; font-size: 0.9rem;"></div>
                            <div class="form-acoes" style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px;">
                                <button type="button" class="btn btn-secundario" id="btn-cancelar-fale-yelo" style="padding: 10px 20px; border-radius: 50px;">Cancelar</button>
                                <button type="submit" class="btn btn-principal" id="btn-enviar-fale-yelo" style="padding: 10px 20px; border-radius: 50px;">Enviar Mensagem</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            const fecharModal = () => {
                modal.style.display = 'none';
                const statusDiv = document.getElementById('fale-yelo-status');
                if(statusDiv) statusDiv.textContent = '';
            };

            document.getElementById('btn-fechar-modal-yelo').addEventListener('click', fecharModal);
            document.getElementById('btn-cancelar-fale-yelo').addEventListener('click', fecharModal);
            modal.addEventListener('click', (e) => {
                if (e.target === modal) fecharModal();
            });

            document.getElementById('form-fale-yelo').addEventListener('submit', function(e) {
                e.preventDefault();
                const textarea = document.getElementById('fale-yelo-mensagem');
                const selectAssunto = document.getElementById('fale-yelo-assunto');
                const btnEnviar = document.getElementById('btn-enviar-fale-yelo');
                const statusDiv = document.getElementById('fale-yelo-status');
                
                const content = textarea.value.trim();
                const assunto = selectAssunto.value;

                if (!content) return;

                // Identifica o psicólogo logado (dispensa o campo de email visualmente)
                const nome = psychologistData && psychologistData.nome ? psychologistData.nome : 'Psicólogo Logado';
                const email = psychologistData && psychologistData.email ? psychologistData.email : 'N/A';

                btnEnviar.disabled = true;
                btnEnviar.textContent = 'Enviando...';
                statusDiv.textContent = '';

                fetch(`${API_BASE_URL}/api/contato`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nome: nome, email: email, assunto: assunto, mensagem: content })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        showToast('Mensagem enviada com sucesso! Responderemos em breve.', 'success');
                        textarea.value = '';
                        selectAssunto.selectedIndex = 0;
                        fecharModal();
                    } else {
                        statusDiv.textContent = data.error || 'Erro ao enviar mensagem.';
                        statusDiv.style.color = '#e22';
                    }
                })
                .catch(err => {
                    console.error(err);
                    statusDiv.textContent = 'Erro de conexão. Tente novamente mais tarde.';
                    statusDiv.style.color = '#e22';
                })
                .finally(() => {
                    btnEnviar.disabled = false;
                    btnEnviar.textContent = 'Enviar Mensagem';
                });
            });
        }

        const textarea = document.getElementById('fale-yelo-mensagem');
        if (textarea) textarea.value = '';
        const statusDiv = document.getElementById('fale-yelo-status');
        if (statusDiv) statusDiv.textContent = '';

        modal.style.display = 'flex';
    }

    let currentPageUrl = 'psi_visao_geral.html';

    window.loadPage = function(url) {
        if (!url) return;

        // --- FALE COM A YELO (MODAL MOBILE) ---
        // Se estiver no mobile e tentar abrir a caixa de entrada (Fale com a Yelo)
        if (url.includes('caixa_de_entrada') && window.innerWidth <= 992) {
            abrirModalFaleComYelo();
            
            // Restaura visualmente a seleção do menu para a página atual que o usuário estava
            document.querySelectorAll('.sidebar-nav li').forEach(li => li.classList.remove('active'));
            document.querySelectorAll('.bottom-nav-item').forEach(b => b.classList.remove('active'));
            
            let activeLink = document.querySelector(`.sidebar-nav a[data-page="${currentPageUrl}"]`);
            let activeBottomLink = document.querySelector(`.bottom-nav-item[data-target-page="${currentPageUrl}"]`);
            
            if (!activeLink || !activeBottomLink) {
                let hubPage = '';
                if (['psi_pacientes.html', 'psi_financeiro.html', 'psi_analytics.html', 'psi_favoritos_analytics.html'].includes(currentPageUrl)) {
                    hubPage = 'psi_clinica_hub.html';
                } else if (['psi_jornada.html', 'psi_blog.html', 'psi_forum.html', 'psi_comunidade.html', 'psi_hub.html', 'psi_lista_espera.html'].includes(currentPageUrl)) {
                    hubPage = 'psi_evolucao_hub.html';
                } else if (['psi_meu_perfil.html', 'psi_assinatura.html', 'psi_caixa_de_entrada.html', 'psi_excluir_conta.html'].includes(currentPageUrl)) {
                    hubPage = 'psi_ajustes_hub.html';
                }
                if (hubPage) {
                    if (!activeLink) activeLink = document.querySelector(`.sidebar-nav a[data-page="${hubPage}"]`);
                    if (!activeBottomLink) activeBottomLink = document.querySelector(`.bottom-nav-item[data-target-page="${hubPage}"]`);
                }
            }

            if (activeLink) activeLink.closest('li').classList.add('active');
            if (activeBottomLink) activeBottomLink.classList.add('active');

            return; // Interrompe o carregamento da página de chat
        }
        
        currentPageUrl = url;

        // --- V6: Limpeza de listeners da página de Blog ---
        if (typeof window.cleanupBlog === 'function') {
            console.log("Limpando listeners do blog anterior...");
            window.cleanupBlog();
            window.cleanupBlog = null;
        }

        // --- FIX CRÍTICO: Limpeza de recursos da página anterior ---
        // Garante que o socket do chat seja morto ANTES de carregar qualquer outra coisa.
        if (typeof window.cleanupPsiChat === 'function') {
            console.log("Limpando chat anterior...");
            window.cleanupPsiChat();
            window.cleanupPsiChat = null; // Remove a referência para não chamar de novo
        }

        // --- Limpeza do estado da página Jornada ---
        if (typeof window.cleanupPaginaJornada === 'function') {
            window.cleanupPaginaJornada();
        }

        // Salva a página atual para persistir após o refresh
        localStorage.setItem('yelo_last_psi_page', url);
        // Spinner de carregamento entre páginas
        mainContent.innerHTML = `
            <div class="loader-wrapper" style="height: 100%; min-height: 400px; align-items: center;">
                <div class="loader-spinner"></div>
            </div>`;
            
        document.querySelectorAll('.sidebar-nav li').forEach(li => li.classList.remove('active'));
        document.querySelectorAll('.bottom-nav-item').forEach(b => b.classList.remove('active'));

        // Garante que o menu inferior reapareça se estivesse oculto pelo Smart Scroll
        const bNav = document.querySelector('.mobile-bottom-nav');
        if (bNav) bNav.classList.remove('nav-hidden');
        
        // Garante que o header mobile reapareça caso tenha sido oculto por alguma tela full-screen (como posts do fórum)
        const mHeader = document.querySelector('.mobile-header');
        if (mHeader) mHeader.style.display = '';

        let activeLink = document.querySelector(`.sidebar-nav a[data-page="${url}"]`);
        let activeBottomLink = document.querySelector(`.bottom-nav-item[data-target-page="${url}"]`);
        
        if (!activeLink || !activeBottomLink) {
            let hubPage = '';
            if (['psi_pacientes.html', 'psi_financeiro.html', 'psi_analytics.html', 'psi_favoritos_analytics.html'].includes(url)) {
                hubPage = 'psi_clinica_hub.html';
            } else if (['psi_jornada.html', 'psi_blog.html', 'psi_forum.html', 'psi_comunidade.html', 'psi_hub.html', 'psi_lista_espera.html'].includes(url)) {
                hubPage = 'psi_evolucao_hub.html';
            } else if (['psi_meu_perfil.html', 'psi_assinatura.html', 'psi_caixa_de_entrada.html', 'psi_excluir_conta.html'].includes(url)) {
                hubPage = 'psi_ajustes_hub.html';
            }

            if (hubPage) {
                if (!activeLink) activeLink = document.querySelector(`.sidebar-nav a[data-page="${hubPage}"]`);
                if (!activeBottomLink) activeBottomLink = document.querySelector(`.bottom-nav-item[data-target-page="${hubPage}"]`);
            }
        }

        if (activeLink) activeLink.closest('li').classList.add('active');
        if (activeBottomLink) activeBottomLink.classList.add('active');
        
        // Destaca o sino no header se for a página de avisos
        const mobileAvisosTrigger = document.getElementById('mobile-avisos-trigger');
        if (mobileAvisosTrigger) {
            if (url === 'psi_avisos.html') {
                mobileAvisosTrigger.style.backgroundColor = '#f0fdf4';
                mobileAvisosTrigger.style.color = 'var(--verde-escuro)';
            } else {
                mobileAvisosTrigger.style.backgroundColor = 'transparent';
                mobileAvisosTrigger.style.color = '#1B4332';
            }
        }

        // --- OTIMIZAÇÃO: PRÉ-FETCH DE DADOS (Paralelismo) ---
        // Dispara a busca de dados IMEDIATAMENTE, sem esperar o HTML carregar
        let dataPromise = null;
        if (url.includes('psi_blog.html')) { 
             dataPromise = apiFetch(`${API_BASE_URL}/api/psychologists/me/posts?page=1&limit=3`).then(r => r.ok ? r.json() : null).catch(() => null);
        } else if (url.includes('psi_comunidade.html')) {
             dataPromise = apiFetch(`${API_BASE_URL}/api/qna?page=1&limit=15`).then(r => r.ok ? r.json() : null).catch(() => null);
        } else if (url.includes('psi_forum.html')) {
             // Busca 4 itens (3 para exibir + 1 para checar se tem mais)
             dataPromise = apiFetch(`${API_BASE_URL}/api/forum/posts?filter=populares&search=&page=1&limit=4`).then(r => r.ok ? r.json() : null).catch(() => null);
        }

        // Se for a caixa de entrada, remove a badge
        if (url.includes('caixa_de_entrada')) {
            window.psiUnreadConversations.clear();
            updateSidebarBadge('psi_caixa_de_entrada.html', false);
        }

        // FIX: Garante que o arquivo seja buscado da raiz da pasta /psi/
        const fetchUrl = url.startsWith('/') ? url : `/psi/${url}`;
        fetch(fetchUrl).then(r => r.ok ? r.text() : Promise.reject(url))
            .then(html => {
                mainContent.innerHTML = html;
                
                // --- VERIFICAÇÃO DE BLOQUEIO ---
                verificarBloqueioGeral(url);
                
                if (url.includes('jornada')) {
                    if (psychologistData) updateGamificationWidgets(psychologistData);
                }
                else if (url.includes('visao_geral')) inicializarVisaoGeral();
                else if (url.includes('comunidade')) inicializarComunidade(dataPromise); // Passa a promessa
                else if (url.includes('psi_hub')) inicializarHubComunidade(); 
                else if (url.includes('psi_ajustes_hub')) inicializarAjustesHub(); 
                else if (url.includes('psi_blog')) inicializarBlog(dataPromise); // Passa a promessa
                else if (url.includes('psi_forum')) inicializarForum(dataPromise); // Passa a promessa
                else if (url.includes('psi_favoritos_analytics.html')) {
                    /// a página se auto-inicializa, mas garantimos que o cleanup de outras páginas rode.
                }
                else if (url.includes('psi_avisos.html')) {
                    window.carregarAvisosBackground(); // Atualiza a bolinha vermelha no menu
                }
                // Adicione outras inicializações de página aqui
            })
            .catch(e => mainContent.innerHTML = `<p>Erro ao carregar: ${e}</p>`);

        // --- LÓGICA DE SMART SCROLL (PÁGINAS CURTAS) ---
        // Adicionado aqui para rodar a cada carregamento de página
        const scrollableContent = document.querySelector('.dashboard-main');
        const bottomNav = document.querySelector('.mobile-bottom-nav');

        if (scrollableContent && bottomNav && window.innerWidth <= 992) {
            // Usa um timeout para garantir que o DOM foi renderizado e a altura é calculada corretamente
            setTimeout(() => {
                const isScrollable = scrollableContent.scrollHeight > scrollableContent.clientHeight;
                if (!isScrollable) {
                    // Se a página não tem rolagem, encolhe a barra após 2 segundos
                    setTimeout(() => {
                        bottomNav.classList.add('nav-hidden');
                    }, 2000);
                }
            }, 150); // Delay de 150ms para cálculo da altura
        }
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

        const proceedToPayment = () => {
            // Abre o modal imediatamente para o usuário preencher os dados
            abrirModalAsaas(planType, cupomForce);
            
            // Restaura botão
            if(btn.tagName) {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        };

        const cancelPayment = () => {
            if(btn.tagName) {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        };

        const hoje = new Date();
        const hasSubscription = psychologistData && (psychologistData.stripeSubscriptionId || psychologistData.subscriptionId);
        const planExpiresAt = psychologistData && psychologistData.planExpiresAt ? new Date(psychologistData.planExpiresAt) : null;
        const isInTrial = !hasSubscription && planExpiresAt && planExpiresAt > hoje;

        if (isInTrial) {
            if (typeof window.abrirModalConfirmacaoPersonalizado === 'function') {
                window.abrirModalConfirmacaoPersonalizado(
                    'Você está no período de teste! 🎁',
                    'Você ainda tem dias grátis para conhecer a plataforma e <strong>não precisa cadastrar um cartão de crédito agora.</strong><br><br>Mas se preferir deixar sua assinatura já configurada para não se preocupar depois, <strong>você só será cobrado no 15º dia</strong> (após o fim do seu teste).',
                    () => { proceedToPayment(); }
                );
                cancelPayment();
            } else {
                const confirmou = confirm('Você está no período de teste grátis e não precisa cadastrar um cartão agora.\n\nSe quiser assinar mesmo assim, você só será cobrado no 15º dia. Deseja continuar?');
                if (confirmou) proceedToPayment();
                else cancelPayment();
            }
        } else {
            proceedToPayment();
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
        const loaderEl = document.getElementById('pix-direct-loader');
        if (loaderEl) loaderEl.style.display = 'none';
        
        // Lógica de Abas
        const setTab = (method) => {
            currentMethod = method;
            stepMethod.style.display = 'none';
            form.style.display = 'block';
            customerSection.style.display = 'flex';
            
            const cepInput = document.getElementById('card-holder-cep');
            const numInput = document.getElementById('card-holder-number');
            const elCepRow = cepInput ? cepInput.closest('.payment-flex-row') : null;

            if (method === 'CREDIT_CARD') {
                creditSection.style.display = 'flex';
                securityBadges.style.display = 'block';
                if (elCepRow) elCepRow.style.display = 'flex';
                btnSubmit.innerHTML = `Ativar Assinatura <span style="display:block;font-size:0.75rem;font-weight:normal;opacity:0.8;margin-top:2px;">Acesso Premium Ilimitado</span>`;
                document.getElementById('card-holder-name').placeholder = "Nome impresso no cartão";
                // Torna campos obrigatórios
                document.getElementById('card-number').required = true;
                document.getElementById('card-expiry').required = true;
                document.getElementById('card-ccv').required = true;
                if (cepInput) cepInput.required = true;
                if (numInput) numInput.required = true;
            } else {
                creditSection.style.display = 'none';
                securityBadges.style.display = 'none';
                if (elCepRow) elCepRow.style.display = 'none';
                btnSubmit.textContent = "Gerar QR Code PIX";
                document.getElementById('card-holder-name').placeholder = "Nome completo";
                // Remove obrigatoriedade
                document.getElementById('card-number').required = false;
                document.getElementById('card-expiry').required = false;
                document.getElementById('card-ccv').required = false;
                if (cepInput) cepInput.required = false;
                if (numInput) numInput.required = false;
            }
        };
        
        btnSelectCard.onclick = () => setTab('CREDIT_CARD');
        btnSelectPix.onclick = async () => {
            currentMethod = 'PIX';
            
            // --- FIX: REGRA DO BANCO CENTRAL (BACEN) ---
            // O Asaas exige CPF para gerar o PIX. Se não tivermos, pedimos minimalista.
            const hasCpf = psychologistData && (psychologistData.cpf || psychologistData.cnpj);
            
            if (!hasCpf) {
                setTab('PIX');
                document.getElementById('card-holder-name').value = psychologistData ? psychologistData.nome : '';
                return;
            }

            stepMethod.style.display = 'none';
            if(msgDiv) msgDiv.classList.add('hidden');
            
            let loaderEl = document.getElementById('pix-direct-loader');
            if (!loaderEl) {
                loaderEl = document.createElement('div');
                loaderEl.id = 'pix-direct-loader';
                loaderEl.innerHTML = '<div class="loader-spinner" style="margin: 0 auto;"></div><p style="text-align:center; color:#1B4332; margin-top:15px; font-weight:bold;">Gerando código PIX...</p>';
                stepMethod.parentNode.insertBefore(loaderEl, stepMethod.nextSibling);
            }
            loaderEl.style.display = 'block';

            try {
                const cupomInput = document.getElementById('modal-cupom-input');
                const cupom = cupomInput ? cupomInput.value : '';
                const res = await apiFetch(`${API_BASE_URL}/api/payments/create-preference`, {
                    method: 'POST',
                    body: JSON.stringify({ 
                        planType, 
                        cupom,
                        billingType: 'PIX',
                        creditCard: {}
                    })
                });
                const data = await res.json();
                if (res.ok && data.pix) {
                    loaderEl.style.display = 'none';
                    pixResult.style.display = 'block';
                    document.getElementById('pix-qr-image').src = `data:image/png;base64,${data.pix.encodedImage}`;
                    document.getElementById('pix-copy-paste').value = data.pix.payload;
                } else {
                    throw new Error(data.error || 'Erro ao gerar PIX.');
                }
            } catch (error) {
                loaderEl.style.display = 'none';
                stepMethod.style.display = 'block';
                if(msgDiv) { msgDiv.classList.remove('hidden'); msgDiv.textContent = error.message; msgDiv.style.color = "red"; }
            }
        };
        
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
                holderCpf: document.getElementById('card-holder-cpf').value.replace(/\D/g, ''),
                holderPhone: document.getElementById('card-holder-phone').value.replace(/\D/g, ''),
                postalCode: document.getElementById('card-holder-cep').value.replace(/\D/g, ''), // CEP limpo de traços
                addressNumber: document.getElementById('card-holder-number').value,
                addressComplement: document.getElementById('card-holder-complement').value,
                // Dados enriquecidos pelo CEP (importante para antifraude)
                addressStreet: document.getElementById('card-holder-street').value,
                addressNeighborhood: document.getElementById('card-holder-neighborhood').value
            };
            
            // Dados específicos do cartão
            if (currentMethod === 'CREDIT_CARD') {
                cardData.number = document.getElementById('card-number').value.replace(/\D/g, ''); // Remove espaços da máscara
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
                btnSubmit.innerHTML = currentMethod === 'CREDIT_CARD' ? `Ativar Assinatura <span style="display:block;font-size:0.75rem;font-weight:normal;opacity:0.8;margin-top:2px;">Acesso Premium Ilimitado</span>` : "Gerar PIX";
            }
        };
    }


    function inicializarAssinatura() {
        const cardResumo = document.getElementById('card-resumo-assinatura');
        const areaCancelamento = document.getElementById('area-cancelamento');
        
        // Verifica se tem plano (agora suportando os novos nomes em maiúsculo vindo do banco)
        const temPlano = psychologistData && psychologistData.plano;
        const hasSubscription = psychologistData && (psychologistData.stripeSubscriptionId || psychologistData.subscriptionId);
        
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
                areaCancelamento.style.display = (isCancelado || !hasSubscription) ? 'none' : 'block';
            }

            // --- BANNER SUPERIOR ---
            // Tradução visual para o usuário (ESSENTIAL -> Essencial)
            const mapNomes = { 'ESSENTIAL': 'Essencial', 'CLINICAL': 'Clínico', 'REFERENCE': 'Referência' };
            const nomeExibicao = mapNomes[psychologistData.plano.toUpperCase()] || psychologistData.plano;

            const elNome = document.getElementById('banner-nome-plano');
            if(elNome) elNome.textContent = `Plano ${nomeExibicao}`;
            
            const planoKey = psychologistData.plano.toLowerCase();
            const elPreco = document.getElementById('banner-preco');
            if(elPreco) elPreco.textContent = `${precos[planoKey] || 'R$ --'} // mês`;

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
                    const res = await apiFetch(`${API_BASE_URL}/api/psychologists/me/cancel-subscription`, { method: 'POST' });
                    const data = await res.json();

                    // Verifica se foi cancelamento imediato (Arrependimento)
                    if (data.message && (data.message.includes('estornado') || data.message.includes('Arrependimento') || data.message.includes('cancelada'))) {
                        showToast('Assinatura cancelada.', 'success');
                        window.location.reload(); // [OTIMIZAÇÃO] Recarrega imediatamente sem esperar
                    } else {
                        // Cancelamento agendado (fim do ciclo)
                        psychologistData.cancel_at_period_end = true; 
                        modalCancel.style.display = 'none';
                        showToast(data.message || 'Renovação cancelada.', 'info');
                        inicializarAssinatura(); 
                    }
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
        if (!psychologistData) return;

        // 1. Saudação Hero
        const welcomeEl = document.getElementById('psi-welcome-name');
        if (welcomeEl) {
            welcomeEl.textContent = `Olá, ${psychologistData.nome.split(' ')[0]}!`;
        }

        // Animação de carregamento geral nas métricas
        const elementsToLoad = ['hero-contacts', 'hero-views', 'kpi-whatsapp-clicks', 'kpi-profile-views', 'kpi-taxa-escolha', 'kpi-artigos', 'kpi-interacoes', 'agenda-hoje', 'faturamento-mes'];
        elementsToLoad.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '<span class="loading-spinner-sm" style="display:inline-block; border-color: rgba(27,67,50,0.2); border-top-color: var(--verde-escuro);"></span>';
        });

        try {
            // Busca estatísticas gerais do perfil e gamificação
            // FIX: Adicionado timestamp para evitar cache do navegador e garantir que as métricas estejam sempre atualizadas.
            const resStats = await apiFetch(`${API_BASE_URL}/api/psychologists/me/stats?period=last30days&t=${new Date().getTime()}`);
            const stats = resStats.ok ? await resStats.json() : {};

            const profileViews = stats.profileViews || stats.profileAppearances || 0;
            // CORREÇÃO: O sistema de resultados registra a aparição no match chamando 
            /// a rota /appearance (ProfileAppearanceLogs). Portanto, apontamos esse valor 
            // para corrigir o contador de impressões zerado.
            const matchImpressions = stats.matchImpressions > 0 ? stats.matchImpressions : profileViews;
            const whatsappClicks = stats.whatsappClicks || 0;

            // --- BLOCO 0: HERO & BLOCO 2/3: PACIENTES E AUTORIDADE ---
            const safeCalc = (num, den) => (den && den > 0 ? ((num / den) * 100).toFixed(1) : null);
            // CORREÇÃO: A "Taxa de Clique" no card de Pacientes deve ser calculada em relação às aparições no match,
            // não às visualizações de perfil. Isso evita valores > 100% (caso haja um botão de contato direto na listagem)
            // e cria uma métrica mais coesa com os outros dados do card.
            const convRate = safeCalc(whatsappClicks, matchImpressions);

            if(document.getElementById('hero-contacts')) document.getElementById('hero-contacts').innerHTML = whatsappClicks > 0 ? `+${whatsappClicks}` : '<span style="font-size: 1.1rem; opacity: 0.8; font-weight: 500;">Ainda nenhum contato</span>';
            if(document.getElementById('hero-views')) document.getElementById('hero-views').innerHTML = profileViews > 0 ? profileViews : '<span style="font-size: 1.1rem; opacity: 0.8; font-weight: 500;">Sem visualizações por enquanto</span>';
            
            // Métrica real de Ranking (Seu perfil está melhor que...)
            const realScore = stats.betterThanPercentage !== undefined ? stats.betterThanPercentage : 0;
            if(document.getElementById('hero-benchmark-text')) {
                if (realScore > 0) {
                    document.getElementById('hero-benchmark-text').innerHTML = `🔥 Seu perfil está melhor que <strong>${realScore}%</strong> dos psicólogos`;
                } else {
                    document.getElementById('hero-benchmark-text').innerHTML = `🌱 <strong>Dica:</strong> Complete seu perfil para ganhar destaque no ranking!`;
                }
            }

            // Ação do Botão "Melhorar meu perfil"
            const btnMelhorarPerfil = document.querySelector('.modern-hero-cta');
            if (btnMelhorarPerfil) {
                btnMelhorarPerfil.onclick = (e) => {
                    e.preventDefault();
                    window.loadPage('psi_meu_perfil.html');
                };
            }

            if(document.getElementById('psi-sidebar-growth-val')) {
                const growthRate = profileViews > 0 ? '+12%' : '+0%';
                document.getElementById('psi-sidebar-growth-val').textContent = growthRate;
            }
            
            const renderFriendlyZero = (value, fallbackText) => value > 0 ? value : `<span style="font-size: 1.2rem; color: #888;">${fallbackText}</span>`;
            
            if(document.getElementById('kpi-whatsapp-clicks')) document.getElementById('kpi-whatsapp-clicks').innerHTML = renderFriendlyZero(whatsappClicks, 'Ainda não');
            if(document.getElementById('kpi-profile-views')) document.getElementById('kpi-profile-views').innerHTML = renderFriendlyZero(profileViews, 'Nenhuma');
            if(document.getElementById('kpi-match-impressions')) document.getElementById('kpi-match-impressions').innerHTML = renderFriendlyZero(matchImpressions, 'Aguardando');
            if(document.getElementById('kpi-taxa-escolha')) {
                if (convRate === null) {
                    document.getElementById('kpi-taxa-escolha').innerHTML = '<span style="font-size: 1.2rem; color: #888;">Em breve</span>';
                } else {
                    document.getElementById('kpi-taxa-escolha').textContent = `${convRate}%`;
                }
            }

            // --- BLOCO 4: COMUNIDADE ---
            const progress = stats.gamificationProgress || psychologistData.gamificationProgress || {};
            const blogCount = progress.semeador || progress.blogPostCount || 0;
            const forumCount = progress.vozAtiva || progress.forumActivityCount || 0;
            const answersCount = progress.conselheiro || progress.answerCount || 0;
            const interactions = forumCount + answersCount;

            if(document.getElementById('kpi-artigos')) document.getElementById('kpi-artigos').innerHTML = renderFriendlyZero(blogCount, 'Nenhum');
            if(document.getElementById('kpi-interacoes')) document.getElementById('kpi-interacoes').innerHTML = renderFriendlyZero(interactions, 'Nenhuma');

            // --- LÓGICA DO CARD DE LEMBRETE DE INTERAÇÃO ---
            const interactionReminderCard = document.getElementById('interaction-reminder-card');
            if (interactionReminderCard) {
                if (blogCount > 0 || interactions > 0) {
                    interactionReminderCard.style.display = 'none';
                } else {
                    const lastDismissed = localStorage.getItem('yelo_interaction_dismissed_at');
                    const nowMs = new Date().getTime();
                    const seteDiasEmMs = 7 * 24 * 60 * 60 * 1000;
                    
                    if (lastDismissed && (nowMs - parseInt(lastDismissed)) < seteDiasEmMs) {
                        interactionReminderCard.style.display = 'none';
                    } else {
                        interactionReminderCard.style.display = 'block';
                        const btnDismiss = document.getElementById('btn-dismiss-interaction');
                        if (btnDismiss) {
                            btnDismiss.onclick = () => {
                                interactionReminderCard.style.display = 'none';
                                localStorage.setItem('yelo_interaction_dismissed_at', new Date().getTime().toString());
                            };
                        }
                    }
                }
            }

            // --- BLOCO 2: CHECKLIST DINÂMICO & FEEDBACK INTELIGENTE ---
            const actionListContainer = document.querySelector('.modern-action-list');
            if (actionListContainer) {
                const hasPhoto = psychologistData.fotoUrl && !psychologistData.fotoUrl.includes('placehold.co');
                const hasBio = psychologistData.bio && psychologistData.bio.length > 150;
                const hasForumActivity = forumCount > 0;
                const hasArticle = blogCount > 0;
                const hasCpf = psychologistData.cpf && psychologistData.cpf.replace(/\D/g, '').length >= 11;
                const hasSpecialties = psychologistData.temas_atuacao && psychologistData.temas_atuacao.length > 0;

                const phase1Steps = [
                    { title: hasPhoto ? 'Foto profissional adicionada' : 'Adicionar uma foto profissional', impact: 'Obrigatório', completed: hasPhoto, url: 'psi_meu_perfil.html' },
                    { title: hasBio ? 'Biografia otimizada' : 'Escrever biografia (mín. 150 caracteres)', impact: 'Obrigatório', completed: hasBio, url: 'psi_meu_perfil.html' },
                    { title: hasCpf ? 'Documento validado' : 'Preencher CPF/CNPJ', impact: 'Obrigatório', completed: hasCpf, url: 'psi_meu_perfil.html' },
                    { title: hasSpecialties ? 'Especialidades definidas' : 'Definir temas de atuação', impact: 'Obrigatório', completed: hasSpecialties, url: 'psi_meu_perfil.html' }
                ];

                const phase2Steps = [
                    { title: hasForumActivity ? 'Primeira participação no fórum' : 'Responder a uma dúvida na comunidade', impact: 'Maior Visibilidade', completed: hasForumActivity, url: 'psi_forum.html' },
                    { title: hasArticle ? 'Primeiro artigo publicado' : 'Publicar seu primeiro artigo', impact: 'Autoridade', completed: hasArticle, url: 'psi_blog.html' }
                ];

                const isPhase1Completed = phase1Steps.every(s => s.completed);
                const isPhase2Completed = phase2Steps.every(s => s.completed);

                let stepsToRender = [];
                let headerTitle = "";
                let isAdvancedPhase = false;

                if (!isPhase1Completed) {
                    headerTitle = "🎯 Fase 1: Primeiros passos para os matches";
                    stepsToRender = phase1Steps;
                    stepsToRender.sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));
                } else if (!isPhase2Completed) {
                    headerTitle = "🚀 Fase 2: Próximos passos para crescer";
                    stepsToRender = phase2Steps;
                    stepsToRender.sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));
                } else {
                    // MODO AVANÇADO (Missões Contínuas de Manutenção)
                    isAdvancedPhase = true;
                    headerTitle = "🔄 Fase 3: Manutenção de Autoridade";
                    
                    const diasSemArtigo = stats.lastInteractions?.blog ? Math.floor((new Date() - new Date(stats.lastInteractions.blog)) / (1000 * 60 * 60 * 24)) : 999;
                    const hasRecentArticle = diasSemArtigo <= 30; // 1 artigo por mês
                    
                    const diasSemForum = stats.lastInteractions?.forum ? Math.floor((new Date() - new Date(stats.lastInteractions.forum)) / (1000 * 60 * 60 * 24)) : 999;
                    const hasRecentForum = diasSemForum <= 7; // 1 interação por semana

                    stepsToRender.push({ title: hasRecentForum ? 'Interação semanal mantida' : 'Interagir na comunidade esta semana', impact: hasRecentForum ? 'Em dia!' : '🔥 Alto Impacto', completed: hasRecentForum, url: 'psi_forum.html', isRecurring: true });
                    stepsToRender.push({ title: hasRecentArticle ? 'Artigo mensal publicado' : 'Publicar um artigo este mês', impact: hasRecentArticle ? 'Em dia!' : 'Autoridade', completed: hasRecentArticle, url: 'psi_blog.html', isRecurring: true });
                    
                    // Inteligência de Otimização do Funil
                    const impressions = stats.matchImpressions || 0;
                    const views = stats.profileViews || 0;
                    const clicks = stats.whatsappClicks || 0;
                    const myPrice = psychologistData.valor_sessao_numero || 0;
                    const viewToClickRate = views > 0 ? (clicks / views) : 0;

                    // Mostra no máximo 1 sugestão de funil por vez para não sobrecarregar
                    if (impressions < 5) {
                        stepsToRender.push({ title: 'Adicionar mais temas e especialidades para aparecer mais vezes no Match', impact: 'Maior Alcance', completed: false, url: 'psi_meu_perfil.html' });
                    } else if (impressions >= 10 && (views / impressions) < 0.15) {
                    } else if (impressions >= 10 && (views / impressions) < 0.15) {
                        stepsToRender.push({ title: 'Ajustar o início do seu texto de bio para melhorar a taxa de clique no seu perfil', impact: 'Maior Conversão', completed: false, url: 'psi_meu_perfil.html' });
                    } else if (views >= 10 && viewToClickRate >= 0.25 && myPrice > 0 && myPrice < 130) {
                        stepsToRender.push({ title: 'Sua conversão está excelente! Considere reajustar o valor da sessão para valorizar sua hora clínica', impact: 'Mais Faturamento', completed: false, url: 'psi_meu_perfil.html' });
                    } else if (views >= 10 && viewToClickRate < 0.10 && myPrice > 160) {
                        stepsToRender.push({ title: 'Muitas visitas, mas poucos contatos. Considere reduzir o valor da sessão temporariamente para atrair pacientes', impact: 'Mais Contatos', completed: false, url: 'psi_meu_perfil.html' });
                    } else if (views >= 5 && viewToClickRate < 0.15) {
                        stepsToRender.push({ title: 'Ajustar sua página pública e foto para passar mais confiança e receber mais chamadas', impact: 'Mais Contatos', completed: false, url: 'psi_meu_perfil.html' });
                    }

                    stepsToRender.push({ title: 'Gestão financeira e agenda revisadas', impact: 'Organização', completed: true, url: 'psi_financeiro.html', isRecurring: true });
                    
                    // Ordena deixando o que precisa ser feito primeiro
                    stepsToRender.sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));
                }

                let totalTasks = 0;
                let completedForProgress = 0;
                
                // Filtramos a tarefa "dummy" para que as estatísticas da barra reflitam tarefas reais
                const validTasks = stepsToRender.filter(s => s.title !== 'Gestão financeira e agenda revisadas');
                totalTasks = validTasks.length;
                completedForProgress = validTasks.filter(s => s.completed).length;

                // Renderiza HTML dinâmico removendo os estáticos preexistentes
                actionListContainer.innerHTML = '';
                
                // Altera o título do card focando estritamente no componente atual para evitar conflitos
                const checklistCard = actionListContainer.closest('.modern-checklist-card');
                const titleEl = checklistCard ? checklistCard.querySelector('.checklist-title') : document.querySelector('.checklist-title');
                if (titleEl) titleEl.textContent = headerTitle;

                stepsToRender.forEach(step => {
                    const extraStyles = isAdvancedPhase && step.completed ? 'color: #888; text-decoration: none;' : '';
                    const html = `
                        <a href="#" onclick="event.preventDefault(); window.loadPage('${step.url}');" class="modern-action-item ${step.completed ? 'completed' : ''}">
                            <div class="action-checkbox">${step.completed ? '✓' : ''}</div>
                            <div class="action-content">
                                <h4 class="action-title" style="${extraStyles}">${step.title}</h4>
                                ${!step.completed 
                                    ? `<span class="action-impact">${step.impact}</span>` 
                                    : (isAdvancedPhase ? `<p style="margin: 4px 0 0 0; font-size: 0.85rem; color: #888;">${step.impact}</p>` : '')
                                }
                            </div>
                        </a>
                    `;
                    actionListContainer.insertAdjacentHTML('beforeend', html);
                });

                // Atualiza barra de progresso
                const progressText = document.querySelector('.checklist-progress-text');
                const progressBar = document.querySelector('.checklist-progress-fill');
                if (progressText) progressText.textContent = isAdvancedPhase ? `${completedForProgress}/${totalTasks} em dia` : `${completedForProgress}/${totalTasks} concluídos`;
                if (progressBar) progressBar.style.width = `${totalTasks > 0 ? (completedForProgress / totalTasks) * 100 : 100}%`;
            }

            // --- BLOCO 6: NOTIFICAÇÕES E LEMBRETES ---
            const feed = document.getElementById('notification-feed');
            const emptyState = document.getElementById('notifications-empty-state');
            
            if (feed) {
                const notifications = [];
                const diasInativo = stats.diasDesdeUltimaInteracao || (forumCount === 0 && blogCount === 0 ? 8 : 0);
                const novasInteracoes = stats.novasInteracoes || 0;

                if (diasInativo > 7) {
                    notifications.push({
                        type: 'reminder', icon: '🤔',
                        text: `Você não interage na comunidade há <strong>${diasInativo} dias</strong>. Que tal fortalecer sua presença?`,
                        time: 'Agora mesmo', link: 'psi_forum.html'
                    });
                }

                if (novasInteracoes > 0) {
                    notifications.push({
                        type: 'interaction', icon: '❤️',
                        text: `Suas publicações receberam <strong>${novasInteracoes} novas interações</strong>! Veja quem curtiu e respondeu.`,
                        time: 'Hoje', link: 'psi_forum.html?filter=meus_posts'
                    });
                }

                if (notifications.length > 0) {
                    if (emptyState) emptyState.style.display = 'none';
                    notifications.forEach(notif => {
                        const item = document.createElement('a');
                        item.href = '#';
                        item.className = `notification-item type-${notif.type}`;
                        item.onclick = (e) => { e.preventDefault(); window.loadPage(notif.link); };
                        item.innerHTML = `
                            <div class="notification-icon">${notif.icon}</div>
                            <div class="notification-content">
                                <p>${notif.text}</p>
                                <span class="notification-time">${notif.time}</span>
                            </div>
                        `;
                        feed.appendChild(item);
                    });
                } else if (emptyState) {
                    emptyState.style.display = 'flex';
                }
            }

            // --- BLOCO 5: GESTÃO (Consultas paralelas para o dashboard secundário) ---
            try {
                // Agenda Hoje
                const resAppts = await apiFetch(`${API_BASE_URL}/api/appointments`);
                if(resAppts.ok) {
                    const allAppts = await resAppts.json();
                    const todayStr = new Date().toLocaleDateString('pt-BR');
                    const todayAppts = allAppts.filter(a => new Date(a.start).toLocaleDateString('pt-BR') === todayStr && a.status !== 'available' && a.status !== 'cancelled');
                    if(document.getElementById('agenda-hoje')) {
                        document.getElementById('agenda-hoje').innerHTML = todayAppts.length > 0 ? `${todayAppts.length} atends.` : '<span style="color:#888; font-weight:normal; font-size:0.85rem;">Livre hoje</span>';
                    }
                }

                // Financeiro (Mês Atual)
                const currentMonthStr = new Date().toISOString().slice(0, 7);
                const resFin = await apiFetch(`${API_BASE_URL}/api/financials/dashboard?period=current`);
                if(resFin.ok) {
                    const finData = await resFin.json();
                    const income = (finData.appointments || []).filter(e => e.status === 'done').reduce((acc, curr) => acc + (curr.value || 0), 0);
                    if(document.getElementById('faturamento-mes')) {
                        document.getElementById('faturamento-mes').innerHTML = income > 0 ? `R$ ${income.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '<span style="color:#888; font-weight:normal; font-size:0.85rem;">Sem saldo</span>';
                    }
                }
            } catch(e) {
                console.warn("Erro ao carregar dados secundários:", e);
                if(document.getElementById('agenda-hoje')) document.getElementById('agenda-hoje').innerHTML = '<span style="color:#888; font-weight:normal; font-size:0.85rem;">Livre hoje</span>';
                if(document.getElementById('faturamento-mes')) document.getElementById('faturamento-mes').innerHTML = '<span style="color:#888; font-weight:normal; font-size:0.85rem;">Sem saldo</span>';
            }

        } catch (error) {
            console.error("Erro ao buscar dados da Visão Geral:", error);
            showToast('Não foi possível atualizar todas as métricas.', 'error');
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
            window.loadPage('psi_assinatura.html');
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
        const profileContainer = document.getElementById('profile-blocks-container');
        if (!profileContainer) return;
        
        let originalProfileData = { ...psychologistData };
        const dirtyBlocks = new Set();
        const debounceTimers = {};
        
        const stickyFooter = document.getElementById('sticky-actions');
        const dirtyCountSpan = document.getElementById('dirty-count');
        const saveAllButton = document.getElementById('btn-save-all');

        // --- LÓGICA DO MODELO DE COBRANÇA (INTEGRADA) ---
        const tipoCobrancaRadios = document.querySelectorAll('input[name="tipo_cobranca"]');
        const valorDinamicoLabel = document.getElementById('valor_dinamico_label');
        const valorDinamicoInput = document.getElementById('valor_dinamico_input');

        function updateBillingFields(isInitialLoad = false) {
            if (!valorDinamicoLabel || !valorDinamicoInput) return;
            
            const tipoSelecionado = document.querySelector('input[name="tipo_cobranca"]:checked')?.value || 'sessao';

            if (tipoSelecionado === 'sessao') {
                valorDinamicoLabel.textContent = 'Valor da Sessão (R$)';
                valorDinamicoInput.name = 'valor_sessao_numero';
                valorDinamicoInput.placeholder = '120,00';
                if (isInitialLoad) valorDinamicoInput.value = originalProfileData.valor_sessao_numero || '';
            } else { // mensal
                valorDinamicoLabel.textContent = 'Valor Mensal (R$)';
                valorDinamicoInput.name = 'valor_mensal_numero';
                valorDinamicoInput.placeholder = '500,00';
                if (isInitialLoad) valorDinamicoInput.value = originalProfileData.valor_mensal_numero || '';
            }
        }

        if (tipoCobrancaRadios.length) {
            tipoCobrancaRadios.forEach(radio => {
                radio.addEventListener('change', () => { updateBillingFields(false); valorDinamicoInput.value = ''; const block = radio.closest('.profile-block'); if (block) checkForChanges(block); });
            });
        }

        // Inicializa componentes
        setupMultiselects();
        setupMasks();
        setupCepSearch();

        if (psychologistData) {
            populateBlockForm(psychologistData);
            
            // Garante que os inputs inciem travados
            profileContainer.querySelectorAll('input, textarea, select').forEach(el => { el.disabled = true; });
        }
        
        function populateBlockForm(data) {
            // Foto Mobile
            const mobileImgEl = document.getElementById('mobile-profile-photo-preview');
            if (mobileImgEl) {
                mobileImgEl.src = formatImageUrl(data.fotoUrl);
                mobileImgEl.onerror = function() { this.src = 'https://placehold.co/120x120/1B4332/FFFFFF?text=Psi'; };
            }

            // Helper para popular selects nativos
            function populateNativeSelect(selectId, values) {
                const select = document.getElementById(selectId);
                if (!select) return;
                const valuesArray = Array.isArray(values) ? values : (values ? [values] : []);
                Array.from(select.options).forEach(option => {
                    option.selected = valuesArray.includes(option.value);
                });
            }

            // Campos Simples
        ['nome', 'email', 'crp', 'telefone', 'bio', 'slug', 'cep', 'cidade', 'estado', 'razao_social', 'formacao_desc', 'ano_inicio_experiencia'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = data[id] || '';
            });

            // Documento (CPF/CNPJ) Híbrido
            const inputDoc = document.getElementById('cpf');
            const groupRazao = document.getElementById('group-razao-social');
            if (inputDoc) {
                const docSalvo = data.cpf || data.cnpj || data.document_number || '';
                if (documentMaskInstance) {
                    documentMaskInstance.value = docSalvo; 
                    if (documentMaskInstance.unmaskedValue.length > 11 && groupRazao) {
                        groupRazao.classList.remove('hidden');
                    } else if (groupRazao) {
                        groupRazao.classList.add('hidden');
                    }
                } else {
                    inputDoc.value = docSalvo;
                }
            }

            // Modelo de Cobrança
            const tipoCobranca = data.tipo_cobranca || 'sessao';
            const radioSessao = document.getElementById('tipo_cobranca_sessao');
            if (radioSessao) radioSessao.checked = tipoCobranca === 'sessao';
            const radioMensal = document.getElementById('tipo_cobranca_mensal');
            if (radioMensal) radioMensal.checked = tipoCobranca === 'mensal';
            updateBillingFields(true);

            // Redes Sociais
            ['linkedin_url', 'instagram_url', 'facebook_url', 'tiktok_url', 'x_url'].forEach(key => {
                const el = document.getElementById(key);
                if (el && data[key]) {
                    el.value = data[key].replace(/https?:\/\/(www\.)?/, '').replace(/linkedin\.com\/in\//, '').replace(/instagram\.com\//, '');
                }
            });

            // Multiselects e Selects Nativos
            const multiSelectIds = ['temas_atuacao', 'publico_alvo', 'praticas_inclusivas', 'abordagens_tecnicas', 'genero_identidade', 'modalidade', 'disponibilidade_periodo', 'formacao_nivel'];
            multiSelectIds.forEach(id => {
                const desktopId = `${id}_multiselect`;
                const nativeId = `${id}_native`;
                const values = data[id] || [];
                if (document.getElementById(desktopId)) {
                    updateMultiselect(desktopId, values);
                }
                const nativeEl = document.getElementById(nativeId);
                if (nativeEl) {
                    const valuesArray = Array.isArray(values) ? values : (values ? [values] : []);
                    Array.from(nativeEl.options).forEach(opt => {
                        opt.selected = valuesArray.includes(opt.value);
                    });
                }
            });
        }
        
        // --- Eventos de Edição (Delegação por Bloco) ---
        profileContainer.addEventListener('click', (e) => {
            const btnEdit = e.target.closest('.btn-edit');
            const btnCancel = e.target.closest('.btn-cancel');
            const btnSave = e.target.closest('.btn-save');
            
            if (btnEdit) {
                e.preventDefault();
                enterEditMode(btnEdit.closest('.profile-block'));
            } else if (btnCancel) {
                e.preventDefault();
                cancelEditMode(btnCancel.closest('.profile-block'));
            } else if (btnSave) {
                e.preventDefault();
                saveBlockData(btnSave.closest('.profile-block'));
            } else {
                // Checa alterações em cliques de multiselect
                const opt = e.target.closest('.option');
                if (opt) {
                    const block = opt.closest('.profile-block');
                    if (block && block.classList.contains('editing')) {
                        const blockId = block.dataset.blockId;
                        clearTimeout(debounceTimers[blockId]);
                        debounceTimers[blockId] = setTimeout(() => checkForChanges(block), 600);
                    }
                }
            }
        });

        profileContainer.addEventListener('input', (e) => {
            const block = e.target.closest('.profile-block');
            if (block && block.classList.contains('editing')) {
                const blockId = block.dataset.blockId;
                clearTimeout(debounceTimers[blockId]);
                debounceTimers[blockId] = setTimeout(() => checkForChanges(block), 600);
            }
        });
        
        function enterEditMode(block) {
            block.classList.add('editing');
            setBlockState(block, 'default');
            
            block.querySelectorAll('input, textarea, select').forEach(el => {
                // Impede edição de dados sensíveis ou controlados por API
                if (el.id !== 'email' && el.id !== 'cidade' && el.id !== 'estado') {
                    // Bloqueia edição do CPF/CNPJ caso já esteja preenchido e seja válido (maior que 10 dígitos)
                    if (el.id === 'cpf' && originalProfileData.cpf && originalProfileData.cpf.length >= 11) {
                        return; // Sai deste loop e mantém o disabled no input de documento
                    }
                    el.disabled = false;
                    el.readOnly = false;
                }
            });
            block.querySelectorAll('.multiselect-tag').forEach(el => el.classList.remove('disabled'));

            block.querySelector('.btn-edit').classList.add('hidden');
            block.querySelector('.btn-cancel').classList.remove('hidden');
            block.querySelector('.btn-save').classList.remove('hidden');
        }

        function cancelEditMode(block) {
            block.classList.remove('editing');
            populateBlockForm(originalProfileData); // Reverte pro que tá no banco

            block.querySelectorAll('input, textarea, select').forEach(el => { el.disabled = true; });
            block.querySelectorAll('.multiselect-tag').forEach(el => el.classList.add('disabled'));

            block.querySelector('.btn-edit').classList.remove('hidden');
            block.querySelector('.btn-cancel').classList.add('hidden');
            block.querySelector('.btn-save').classList.add('hidden');
            
            checkForChanges(block); // Limpa o estado dirty deste bloco
        }

        function exitEditMode(block) {
            block.classList.remove('editing');
            block.querySelectorAll('input, textarea, select').forEach(el => { el.disabled = true; });
            block.querySelectorAll('.multiselect-tag').forEach(el => el.classList.add('disabled'));
            block.querySelector('.btn-edit').classList.remove('hidden');
            block.querySelector('.btn-cancel').classList.add('hidden');
            block.querySelector('.btn-save').classList.add('hidden');
        }

        function setBlockState(block, state, message = '') {
            const statusEl = block.querySelector('.block-status');
            const saveBtn = block.querySelector('.btn-save');
            const btnText = saveBtn ? saveBtn.querySelector('.btn-text') || saveBtn : null;
            let originalSaveHtml = 'Salvar';

            if (statusEl) statusEl.className = 'block-status'; // Reset
            if (saveBtn) saveBtn.disabled = false;

            switch (state) {
                case 'saving':
                    if (saveBtn) saveBtn.disabled = true;
                    if (btnText) btnText.innerHTML = '<span class="spinner"></span> Salvando...';
                    break;
                case 'success':
                    if (statusEl) {
                        statusEl.textContent = message || 'Salvo ✔';
                        statusEl.classList.add('visible', 'success');
                        setTimeout(() => statusEl.classList.remove('visible'), 2500);
                    }
                    if (btnText) btnText.innerHTML = originalSaveHtml;
                    break;
                case 'error':
                    if (statusEl) {
                        statusEl.textContent = message || 'Erro ao salvar.';
                        statusEl.classList.add('visible', 'error');
                    }
                    if (btnText) btnText.innerHTML = originalSaveHtml;
                    break;
                case 'default':
                    if (statusEl) statusEl.classList.remove('visible');
                    if (btnText) btnText.innerHTML = originalSaveHtml;
                    break;
            }
        }

        function getBlockData(block) {
            const data = {};
            // Pega apenas inputs de texto, textareas e selects não nativos
            block.querySelectorAll('input, textarea, select').forEach(input => {
                if (input.name && input.type !== 'radio' && !input.classList.contains('native-select-mobile')) {
                    if (input.type === 'number' || input.id === 'valor_dinamico_input') {
                        const valStr = input.value.toString().replace(',', '.').trim();
                        const parsed = parseFloat(valStr);
                        data[input.name] = !isNaN(parsed) ? parsed : null;
                    } else if (input.id === 'cpf' || input.id === 'telefone') {
                        data[input.name] = input.value.replace(/\D/g, ''); // Remove máscara
                    } else {
                        data[input.name] = input.value;
                    }
                }
            });
            
            const tipoCobrancaRadio = block.querySelector('input[name="tipo_cobranca"]:checked');
            if (tipoCobrancaRadio) {
                data.tipo_cobranca = tipoCobrancaRadio.value;
                if (data.tipo_cobranca === 'sessao') data.valor_mensal_numero = null;
                else data.valor_sessao_numero = null;
            }

            const isMobile = window.innerWidth <= 992;
            block.querySelectorAll('.multiselect-tag').forEach(multi => {
                const idKey = multi.id.replace('_multiselect', '');
                const nativeSelect = document.getElementById(idKey + '_native');
                
                if (isMobile && nativeSelect) {
                    if (nativeSelect.multiple) {
                        data[idKey] = Array.from(nativeSelect.selectedOptions).map(opt => opt.value);
                    } else {
                        data[idKey] = nativeSelect.value;
                    }
                } else {
                    const values = getMultiselectValues(multi.id);
                    if (multi.dataset.singleSelect === 'true') {
                        data[idKey] = values.length > 0 ? values[0] : '';
                    } else {
                        data[idKey] = values;
                    }
                }
            });

            return data;
        }

        async function saveBlockData(block) {
            setBlockState(block, 'saving');
            const payload = getBlockData(block);

            // Lógica legada para limpar razão social se não for CNPJ
            if (payload.cpf && payload.cpf.length <= 11) payload.razao_social = '';

            try {
                const res = await apiFetch(`${API_BASE_URL}/api/psychologists/me`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });

                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(errData.error || 'Falha ao salvar bloco.');
                }

                // Tudo certo! Atualiza as origens
                Object.assign(originalProfileData, payload);
                psychologistData = { ...psychologistData, ...payload };
                if (payload.slug) psychologistData.slug = payload.slug;

                // Sincroniza o nome no LocalStorage e no Header Público (se visível)
                if (payload.nome) {
                    localStorage.setItem('Yelo_user_name', payload.nome);
                    const primeiroNome = payload.nome.split(' ')[0];
                    
                    const headerGreeting = document.querySelector('.user-greeting-text');
                    if (headerGreeting) headerGreeting.textContent = `Painel de ${primeiroNome}`;
                    
                    const headerAvatar = document.getElementById('header-avatar-initial');
                    if (headerAvatar && !headerAvatar.tagName.toLowerCase().includes('img')) headerAvatar.textContent = primeiroNome.charAt(0).toUpperCase();
                }

                setBlockState(block, 'success');
                dirtyBlocks.delete(block.dataset.blockId);
                updateStickyFooter();
                
                setTimeout(() => exitEditMode(block), 600);
                atualizarInterfaceLateral();

            } catch (err) {
                console.error("Erro ao salvar bloco:", err);
                setBlockState(block, 'error', err.message);
            }
        }

        function checkForChanges(block) {
            const blockId = block.dataset.blockId;
            const currentData = getBlockData(block);
            let isDirty = false;

            for (const key in currentData) {
                let origVal = originalProfileData[key];
                let currVal = currentData[key];
                
                if (key === 'tipo_cobranca' && origVal === undefined) origVal = 'sessao';

                if (Array.isArray(currVal)) {
                    let origArr = origVal;
                    if (typeof origArr === 'string') { try { origArr = JSON.parse(origArr); } catch(e) { origArr = [origArr]; } }
                    if (!Array.isArray(origArr)) origArr = origArr ? [origArr] : [];

                    const sortedOriginal = [...origArr].sort();
                    const sortedCurrent = [...currVal].sort();
                    if (JSON.stringify(sortedOriginal) !== JSON.stringify(sortedCurrent)) {
                        isDirty = true; break;
                    }
                } else {
                    // Evita falsos positivos com strings numéricas
                    if ((key === 'cpf' || key === 'telefone') && String(origVal || '').replace(/\D/g, '') !== String(currVal || '').replace(/\D/g, '')) {
                         isDirty = true; break;
                    }
                    else if (key !== 'cpf' && key !== 'telefone' && String(origVal || '') !== String(currVal || '')) {
                        isDirty = true; break;
                    }
                }
            }

            if (isDirty) dirtyBlocks.add(blockId);
            else dirtyBlocks.delete(blockId);

            updateStickyFooter();
        }

        function updateStickyFooter() {
            if (!stickyFooter || !dirtyCountSpan) return;
            const count = dirtyBlocks.size;
            if (count > 0) {
                dirtyCountSpan.textContent = count;
                stickyFooter.classList.remove('hidden');
            } else {
                stickyFooter.classList.add('hidden');
            }
        }

        if (saveAllButton) {
            saveAllButton.onclick = async () => {
                const btnText = saveAllButton.querySelector('.btn-text') || saveAllButton;
                const spinner = saveAllButton.querySelector('.spinner');
                
                saveAllButton.disabled = true;
                if (btnText) btnText.classList.add('hidden');
                if (spinner) spinner.classList.remove('hidden');

                const allDirtyData = {};
                dirtyBlocks.forEach(blockId => {
                    const block = profileContainer.querySelector(`[data-block-id="${blockId}"]`);
                    if (block) {
                        Object.assign(allDirtyData, getBlockData(block));
                        setBlockState(block, 'saving');
                    }
                });
                
                if (allDirtyData.tipo_cobranca === undefined) {
                    allDirtyData.tipo_cobranca = originalProfileData.tipo_cobranca || 'sessao';
                    allDirtyData.valor_mensal_numero = originalProfileData.valor_mensal_numero || null;
                    allDirtyData.valor_sessao_numero = originalProfileData.valor_sessao_numero || null;
                }

                if (allDirtyData.cpf && allDirtyData.cpf.length <= 11) allDirtyData.razao_social = '';

                try {
                    const res = await apiFetch(`${API_BASE_URL}/api/psychologists/me`, {
                        method: 'PUT',
                        body: JSON.stringify(allDirtyData)
                    });

                    if (!res.ok) throw new Error((await res.json()).error || 'Falha ao salvar tudo.');

                    Object.assign(originalProfileData, allDirtyData);
                    psychologistData = { ...psychologistData, ...allDirtyData };
                    if (allDirtyData.slug) psychologistData.slug = allDirtyData.slug;

                    // Sincroniza o nome no LocalStorage e no Header Público (se visível)
                    if (allDirtyData.nome) {
                        localStorage.setItem('Yelo_user_name', allDirtyData.nome);
                        const primeiroNome = allDirtyData.nome.split(' ')[0];
                        
                        const headerGreeting = document.querySelector('.user-greeting-text');
                        if (headerGreeting) headerGreeting.textContent = `Painel de ${primeiroNome}`;
                        
                        const headerAvatar = document.getElementById('header-avatar-initial');
                        if (headerAvatar && !headerAvatar.tagName.toLowerCase().includes('img')) headerAvatar.textContent = primeiroNome.charAt(0).toUpperCase();
                    }

                    dirtyBlocks.forEach(blockId => {
                        const block = profileContainer.querySelector(`[data-block-id="${blockId}"]`);
                        if (block) {
                            setBlockState(block, 'success');
                            setTimeout(() => exitEditMode(block), 500);
                        }
                    });
                    
                    dirtyBlocks.clear();
                    updateStickyFooter();
                    atualizarInterfaceLateral();
                    showToast('Todas as alterações salvas!', 'success');

                } catch (err) {
                    showToast(err.message, 'error');
                    dirtyBlocks.forEach(blockId => {
                        const block = profileContainer.querySelector(`[data-block-id="${blockId}"]`);
                        if (block) setBlockState(block, 'error');
                    });
                } finally {
                    saveAllButton.disabled = false;
                    if (btnText) btnText.classList.remove('hidden');
                    if (spinner) spinner.classList.add('hidden');
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
                            localStorage.setItem('Yelo_user_photo', d.fotoUrl);
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
        setupDocumentMask(); /// a função antiga foi removida
    }

    // --- LÓGICA DA COMUNIDADE (Q&A) ---
    function inicializarComunidade(preFetchedData = null) {
        // Ajuste dinâmico do Banner (Título e Subtítulo)
        const bannerTitle = document.querySelector('.main-header h1');
        const bannerSub = document.querySelector('.subtitulo-header');
        if(bannerTitle) bannerTitle.textContent = "Comunidade";
        if(bannerSub) bannerSub.textContent = "Tire dúvidas e compartilhe conhecimento com outros profissionais.";

        const container = document.getElementById('qna-list-container');
        const paginationContainer = document.getElementById('qna-pagination');
        const searchInput = document.getElementById('forum-search-input');
        
        // As referências do modal serão buscadas dinamicamente para evitar elementos mortos
        let allQuestions = [];
        let filteredQuestions = [];
        let currentPage = 1;
        const ITEMS_PER_PAGE = 5;
        let currentFilter = 'all';
        let currentQuestionIdToAnswer = null;

        if (!container) return;

        async function loadQuestions() {
            container.innerHTML = '<div class="loader-wrapper"><div class="loader-spinner"></div></div>';
            try {
                let questions;
                if (preFetchedData) {
                    questions = await preFetchedData;
                    preFetchedData = null;
                } else {
                    // Busca um lote maior para o client-side lidar com os filtros tranquilamente
                    const res = await apiFetch(`${API_BASE_URL}/api/qna?page=1&limit=100`);
                    if (!res.ok) throw new Error('Falha ao buscar perguntas');
                    questions = await res.json();
                }

                allQuestions = questions;
                applyFiltersAndSort();
            } catch (err) {
                console.error(err);
                container.innerHTML = `<div style="text-align:center; padding:40px; color:red;">Erro ao carregar perguntas.</div>`;
            }
        }

        if (searchInput) {
            searchInput.addEventListener('input', () => { applyFiltersAndSort(); });
        }
        
        const filterTabs = document.querySelectorAll('#qna-filter-tabs .tab-item');
        if (filterTabs) {
            filterTabs.forEach(tab => {
                tab.addEventListener('click', (e) => {
                    filterTabs.forEach(t => t.classList.remove('active'));
                    e.target.classList.add('active');
                    currentFilter = e.target.dataset.filter;
                    applyFiltersAndSort();
                });
            });
        }

        function applyFiltersAndSort() {
            const term = searchInput ? searchInput.value.toLowerCase() : '';
            
            filteredQuestions = allQuestions.filter(q => {
                const matchesSearch = (q.titulo && q.titulo.toLowerCase().includes(term)) || 
                                      (q.conteudo && q.conteudo.toLowerCase().includes(term)) ||
                                      (q.content && q.content.toLowerCase().includes(term));
                const isAnsweredByMe = q.respondedByMe === true;
                
                if (currentFilter === 'pending') return matchesSearch && !isAnsweredByMe;
                if (currentFilter === 'answered') return matchesSearch && isAnsweredByMe;
                return matchesSearch;
            });

            filteredQuestions.sort((a, b) => {
                const aAnswered = a.respondedByMe === true;
                const bAnswered = b.respondedByMe === true;
                
                if (aAnswered !== bAnswered) return aAnswered ? 1 : -1; 
                return new Date(b.createdAt) - new Date(a.createdAt);
            });

            currentPage = 1;
            renderPage();
        }

        function renderPage() {
            container.innerHTML = '';
            if (filteredQuestions.length === 0) {
                showEmptyState();
                if(paginationContainer) paginationContainer.innerHTML = '';
                return;
            }

            const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
            const pageData = filteredQuestions.slice(startIndex, startIndex + ITEMS_PER_PAGE);
            const template = document.getElementById('qna-card-template-psi');

            pageData.forEach(q => {
                const clone = template.content.cloneNode(true);
                const cardElement = clone.firstElementChild; 

                if(cardElement) {
                    cardElement.style.position = 'relative';
                }

                clone.querySelector('.qna-question-title').textContent = q.titulo || q.title || 'Dúvida da Comunidade';
                
                // FIX: Procura a caixa principal do card para garantir a reescrita visual
                const cardBody = clone.querySelector('.qna-card-body');
                if (cardBody) {
                    const questionText = q.conteudo || q.content || '';
                    
                    // Limpa o estilo de "bloco" original para não interferir no flexbox
                    cardBody.style.background = 'transparent';
                    cardBody.style.border = 'none';
                    cardBody.style.padding = '0';
                    cardBody.innerHTML = ''; 
                    
                    const threadWrapper = document.createElement('div');
                    threadWrapper.className = 'qna-conversation-thread';
                    
                    // Balão da Pergunta
                    const qBubble = document.createElement('div');
                    qBubble.className = 'qna-bubble qna-bubble-question';
                    qBubble.innerHTML = `<p style="margin:0;">${questionText}</p>`;
                    threadWrapper.appendChild(qBubble);
                    
                    cardBody.appendChild(threadWrapper);
                } else {
                    // Fallback seguro se a classe HTML não for exata
                    const fallbackContent = clone.querySelector('.qna-question-content, p, .conteudo');
                    if (fallbackContent) fallbackContent.textContent = q.conteudo || q.content || '';
                }

                const dataEnvio = new Date(q.createdAt).toLocaleDateString('pt-BR');
                clone.querySelector('.qna-question-author').textContent = `Enviada em ${dataEnvio} • Paciente Anônimo`;

                const btnResponder = clone.querySelector('.btn-responder');
                
                const isAnsweredByMe = q.respondedByMe === true;

                if (isAnsweredByMe) {
                    if (btnResponder) btnResponder.style.display = 'none';
                    if (cardElement) {
                        cardElement.style.borderLeft = 'none';
                        cardElement.style.opacity = '0.5'; // Deixa o card apagado para indicar que já foi respondido
                    }
                } else {
                    if (btnResponder) {
                        btnResponder.onclick = () => {
                        const modal = document.getElementById('qna-answer-modal');
                        const textarea = document.getElementById('qna-answer-textarea');
                        if (!modal || !textarea) return;
                        
                        currentQuestionIdToAnswer = q.id;
                        modal.querySelector('.modal-title').textContent = `Respondendo: ${q.titulo || q.title || 'Dúvida'}`;
                        textarea.value = '';
                        checkCharCount();
                        if (modal.parentNode !== document.body) document.body.appendChild(modal);
                        modal.style.setProperty('display', 'flex', 'important');
                    };
                    }
                    
                    // Botão Lixeira
                    const btnIgnorar = document.createElement('button');
                    btnIgnorar.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
                    btnIgnorar.title = "Ignorar esta pergunta";
                    btnIgnorar.style.cssText = "position: absolute; top: 15px; right: 15px; background: none; border: none; padding: 5px; cursor: pointer; color: #1B4332; opacity: 0.4; transition: all 0.3s ease; z-index: 2;";
                    btnIgnorar.onmouseover = () => { btnIgnorar.style.opacity = '1'; btnIgnorar.style.transform = 'scale(1.1)'; };
                    btnIgnorar.onmouseout = () => { btnIgnorar.style.opacity = '0.4'; btnIgnorar.style.transform = 'scale(1)'; };
                    
                    btnIgnorar.onclick = () => {
                        abrirModalConfirmacaoPersonalizado(
                            'Ignorar Pergunta',
                            'Tem certeza que deseja ignorar esta dúvida? Ela sumirá da sua lista.',
                            async () => {
                                try {
                                    if(cardElement) cardElement.style.opacity = '0.5'; 
                                    const res = await apiFetch(`${API_BASE_URL}/api/qna/${q.id}/ignore`, { method: 'POST' });
                                    if(res.ok) {
                                        allQuestions = allQuestions.filter(item => item.id !== q.id);
                                        applyFiltersAndSort();
                                        showToast('Pergunta removida.', 'info');
                                    }
                                } catch(e) {
                                    if(cardElement) cardElement.style.opacity = '1'; 
                                    showToast('Erro ao ignorar pergunta.', 'error');
                                }
                            }
                        );
                    };
                    
                    if (cardElement) cardElement.appendChild(btnIgnorar);
                }

                container.appendChild(clone);
            });
            renderPagination();
        }

        function renderPagination() {
            if (!paginationContainer) return;
            paginationContainer.innerHTML = '';
            const totalPages = Math.ceil(filteredQuestions.length / ITEMS_PER_PAGE);
            if (totalPages <= 1) return;

            for (let i = 1; i <= totalPages; i++) {
                const btn = document.createElement('button');
                btn.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
                btn.textContent = i;
                btn.onclick = () => {
                    currentPage = i;
                    renderPage();
                    document.querySelector('.main-header').scrollIntoView({ behavior: 'smooth' });
                };
                paginationContainer.appendChild(btn);
            }
        }

        // Função auxiliar para contar caracteres (Reutilizável)
        function checkCharCount() {
            const textarea = document.getElementById('qna-answer-textarea');
            const charCounter = document.getElementById('qna-char-counter');
            const btnSubmit = document.getElementById('qna-submit-answer');
            
            if (charCounter && textarea) {
                const len = textarea.value.length;
                charCounter.textContent = `${len}/50 caracteres`;
                if (len >= 50) {
                    charCounter.style.color = "#1B4332";
                    charCounter.style.fontWeight = "bold";
                } else {
                    charCounter.style.color = "#666";
                }
            }
            if (btnSubmit && textarea) {
                btnSubmit.disabled = textarea.value.length < 50;
            }
        }

        function showEmptyState() {
            container.innerHTML = `
                <div style="text-align:center; padding:60px 20px; color:#1B4332;">
                    <div style="font-size: 3rem; margin-bottom: 10px;">🎉</div>
                    <h3 style="font-family:'New Kansas', serif; margin-bottom: 10px;">Tudo limpo por aqui!</h3>
                    <p style="color:#666; max-width: 400px; margin: 0 auto;">
                        Nenhuma pergunta encontrada com os filtros atuais.
                    </p>
                </div>`;
        }

        const textarea = document.getElementById('qna-answer-textarea');
        if (textarea) textarea.oninput = checkCharCount;

        const fecharModal = () => {
            const modal = document.getElementById('qna-answer-modal');
            if (modal) modal.style.setProperty('display', 'none', 'important');
        };
        
        const modal = document.getElementById('qna-answer-modal');
        if (modal) {
            const closeBtn = modal.querySelector('.modal-close');
            const cancelBtn = modal.querySelector('.modal-cancel');
            if(closeBtn) closeBtn.onclick = fecharModal;
            if(cancelBtn) cancelBtn.onclick = fecharModal;
        }

        const form = document.getElementById('qna-answer-form');
        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                const textarea = document.getElementById('qna-answer-textarea');
                const btnSubmit = document.getElementById('qna-submit-answer');
                if (!currentQuestionIdToAnswer || textarea.value.length < 50) return;

                const originalText = btnSubmit.textContent;
                btnSubmit.textContent = "Enviando...";
                btnSubmit.disabled = true;
                
                try {
                    const res = await apiFetch(`${API_BASE_URL}/api/qna/${currentQuestionIdToAnswer}/answer`, {
                        method: 'POST',
                        body: JSON.stringify({ conteudo: textarea.value })
                    });

                    if (res.ok) {
                        showToast('Resposta enviada com sucesso! 🌻', 'success');
                        fecharModal();
                        
                        // Atualiza a pergunta no array local
                        const qIndex = allQuestions.findIndex(q => q.id === currentQuestionIdToAnswer);
                        if (qIndex !== -1) {
                            allQuestions[qIndex].respondedByMe = true;
                            // Salva a resposta digitada para mostrar no balão instantaneamente
                            allQuestions[qIndex].minhaResposta = textarea.value;
                        }
                        
                        applyFiltersAndSort();
                    } else {
                        throw new Error('Falha no envio');
                    }
                } catch (error) {
                    console.error(error);
                    showToast('Erro ao enviar resposta.', 'error');
                } finally {
                    btnSubmit.textContent = originalText;
                    if(textarea.value.length < 50) btnSubmit.disabled = true;
                }
            };
        }

        loadQuestions();
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

        // Limpeza ao sair da página (Chat)
        window.cleanupPsiChat = () => {
            document.removeEventListener('keydown', handleEscKey);
            if (psiSocket) {
                psiSocket.disconnect();
                psiSocket = null;
            }
        };
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

    // --- FEED DE COMUNICADOS (MÓDULO SEPARADO) ---
    
    // Função de background para contar não lidos e atualizar a Badge no Menu Lateral
    window.carregarAvisosBackground = async function() {
        try {
            const res = await apiFetch(`${API_BASE_URL}/api/psychologists/me/announcements`);
            if (res.ok) {
                const avisos = await res.json();
                const unread = avisos.filter(a => !a.read).length;
                
                // Atualiza a badge do menu passando o número diretamente
                updateSidebarBadge('psi_avisos.html', unread);
            }
        } catch (error) {
            console.error("Fundo: Erro ao carregar avisos", error);
        }
    };

    // Atualiza badges silenciosamente no background
    setTimeout(window.carregarAvisosBackground, 2000);

    // --- NOVA LÓGICA DE NOTIFICAÇÕES DE NAVEGADOR (SESSÕES) ---
    window.setupSessionNotifications = function() {
        if (!("Notification" in window)) {
            console.warn("⚠️ Notificações do navegador bloqueadas. O navegador exige HTTPS ou localhost para exibir notificações.");
            return;
        }

        const startChecking = () => {
            if (Notification.permission !== "granted") return;

            const checkAppointments = async () => {
                try {
                    const token = localStorage.getItem('Yelo_token');
                    if (!token) return;

                    const resAppts = await fetch(`${API_BASE_URL}/api/appointments`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    
                    if (resAppts.ok) {
                        const allAppts = await resAppts.json();
                        const now = new Date();
                        
                        console.log(`[Notificações] Checando ${allAppts.length} agendamentos... Hora atual:`, now.toLocaleTimeString());
                        
                        const upcomingAppts = allAppts.filter(a => {
                            const start = new Date(a.start);
                            return (a.status === 'scheduled' || a.status === 'confirmed') &&
                                   start > now;
                        });

                        upcomingAppts.forEach(appt => {
                            const start = new Date(appt.start);
                            const timeUntilStart = start.getTime() - now.getTime();
                            const fifteenMins = 15 * 60 * 1000;
                            const minutesLeft = Math.round(timeUntilStart / 60000);

                            console.log(`[Notificações] Sessão ${appt.id} (${appt.title}) - Faltam ${minutesLeft} min.`);

                            // Se a sessão vai começar em até 15 minutos (e já não foi notificada)
                            if (timeUntilStart > 0 && timeUntilStart <= fifteenMins) { 
                                const notifKey = `notified_appt_${appt.id}`;
                                if (!sessionStorage.getItem(notifKey)) {
                                console.log("🔔 Exibindo notificação para a sessão:", appt.id);
                                    showDesktopNotification(appt);
                                    sessionStorage.setItem(notifKey, 'shown');
                                } else {
                                    console.log(`[Notificações] Sessão ${appt.id} já foi notificada anteriormente nesta aba.`);
                                }
                            }
                        });
                    }
                } catch (e) {
                    console.error("Erro ao checar notificações de sessão:", e);
                }
            };

            checkAppointments();
            if (window.notifInterval) clearInterval(window.notifInterval);
            window.notifInterval = setInterval(checkAppointments, 60000); // Checa a cada 1 minuto
        };

        if (Notification.permission === "default") {
            console.log("Aguardando clique na tela para solicitar permissão de notificação...");
            const requestNotif = async () => {
                try {
                    console.log("Solicitando permissão de notificação...");
                    const permission = await Notification.requestPermission();
                    console.log("Status da permissão:", permission);
                    document.removeEventListener('click', requestNotif);
                    if (permission === "granted") startChecking();
                } catch(e) { console.error(e); }
            };
            document.addEventListener('click', requestNotif);
        } else if (Notification.permission === "granted") {
            console.log("Permissão já concedida. Iniciando checagem da agenda...");
            startChecking();
        } else if (Notification.permission === "denied") {
            console.warn("⚠️ Permissão de notificação foi negada pelo navegador.");
        }
    };

    function showDesktopNotification(appt) {
        if (Notification.permission === "granted") {
            const timeStr = new Date(appt.start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const patientName = appt.title || 'Paciente';
            
            try {
                const notification = new Notification("Sessão em 15 minutos ⏰", {
                    body: `Sua sessão com ${patientName} começará às ${timeStr}.`,
                    icon: '/assets/images/favicon.png'
                });

                notification.onclick = function() {
                    window.focus();
                    if (typeof window.loadPage === 'function') {
                        window.loadPage('psi_pacientes.html');
                    }
                    notification.close();
                };
            } catch (e) {
                console.error("Erro ao criar a notificação visual:", e);
            }
        }
    }

    // Função utilitária para você testar as notificações pelo console
    window.testarNotificacao = function() {
        if (Notification.permission === "granted") {
            new Notification("Teste de Notificação Yelo ✅", {
                body: "Se você está vendo isso, o sistema de alertas do seu computador está funcionando perfeitamente!",
                icon: '/assets/images/favicon.png'
            });
            console.log("Notificação de teste enviada para o Sistema Operacional.");
        } else {
            console.warn("Não é possível testar: a permissão atual é", Notification.permission);
        }
    };

    // INIT
    fetchPsychologistData().then(ok => {
        // Remove o loader global com fade-out
        const loader = document.getElementById('global-loader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.style.display = 'none', 500);
        }

        if (ok) {
            // Lógica do Modal de Instabilidade
            if (!localStorage.getItem('Yelo_aviso_instabilidade_lido')) {
                const modalInstabilidade = document.getElementById('modal-aviso-instabilidade');
                const btnEntendi = document.getElementById('btn-entendi-instabilidade');
                const nomeEl = document.getElementById('aviso-instabilidade-nome');
                
                if (modalInstabilidade) {
                    if (nomeEl && psychologistData && psychologistData.nome) {
                        nomeEl.textContent = psychologistData.nome.split(' ')[0];
                    }
                    modalInstabilidade.style.display = 'flex';
                    
                    if (btnEntendi) {
                        btnEntendi.onclick = () => {
                            modalInstabilidade.style.display = 'none';
                            localStorage.setItem('Yelo_aviso_instabilidade_lido', 'true');
                        };
                    }
                }
            }

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
            // Carrega a última página visitada ou a visão geral como padrão.
            const lastPage = localStorage.getItem('yelo_last_psi_page');
            loadPage(lastPage || 'psi_visao_geral.html');
            }
            
            // --- LÓGICA DE SMART SCROLL (OCULTAR MENU INFERIOR AO ROLAR) ---
            function setupSmartScroll() {
                // Só executa em telas mobile
                if (window.innerWidth > 992) return;

                const bottomNav = document.querySelector('.mobile-bottom-nav');
                // O elemento que de fato rola é o .dashboard-main
                const scrollableContent = document.querySelector('.dashboard-main');
                
                if (!bottomNav || !scrollableContent) return;

                // Adiciona listener para expandir ao clicar na barra encolhida (executa uma vez)
                bottomNav.addEventListener('click', () => {
                    if (bottomNav.classList.contains('nav-hidden')) {
                        // Apenas remove a classe, a navegação continua se o clique foi num link
                        bottomNav.classList.remove('nav-hidden');
                    }
                });

                let lastScrollY = scrollableContent.scrollTop;
                const scrollThreshold = 100; // Distância mínima para começar a ocultar

                scrollableContent.addEventListener('scroll', () => {
                    const currentScrollY = scrollableContent.scrollTop;

                    if (currentScrollY > lastScrollY && currentScrollY > scrollThreshold) {
                        // Rolando para baixo: Oculta o menu
                        bottomNav.classList.add('nav-hidden');
                    } else if (currentScrollY < lastScrollY) {
                        // Rolando para cima: Mostra o menu
                        bottomNav.classList.remove('nav-hidden');
                    }
                    lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY;
                }, { passive: true });
            }
            setupSmartScroll();

            // --- NOVO: INICIA A LÓGICA DE TOOLTIPS MOBILE ---
            setupMobileBadgeTooltips();
            
            // --- NOVO: INICIA A LÓGICA DE NOTIFICAÇÕES DE NAVEGADOR ---
            if (typeof window.setupSessionNotifications === 'function') {
                window.setupSessionNotifications();
            }
        } else {
            // Se falhou mas não deslogou (ex: erro 500 do banco), mostra tela de erro amigável
            // Isso evita que o usuário veja uma tela branca ou seja deslogado injustamente
            if (localStorage.getItem('Yelo_token')) {
                document.body.innerHTML = `
                    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif; color:#1B4332; text-align:center; padding:20px;">
                        <div style="font-size:3rem; margin-bottom:20px;">🛠️</div>
                        <h2>Instabilidade Temporária</h2>
                        <p style="color:#666; max-width:400px; margin:0 auto;">Estamos com uma breve instabilidade na conexão com o banco de dados. Seus dados estão seguros.</p>
                        <button onclick="window.location.reload()" style="padding:12px 30px; background:#1B4332; color:white; border:none; border-radius:50px; cursor:pointer; margin-top:25px; font-weight:bold; font-size:1rem; transition: transform 0.2s;">Tentar Novamente</button>
                    </div>
                `;
            }
        }
    });

     // --- FUNÇÃO GLOBAL PARA TOOLTIPS DE BADGES NO MOBILE E DESKTOP ---
    function setupMobileBadgeTooltips() {
        if (document.body.dataset.tooltipsSetup) return;
        document.body.dataset.tooltipsSetup = 'true';

        let activeTooltip = null;

        const createTooltip = (target) => {
            const title = target.getAttribute('title') || target.dataset.originalTitle;
            if (!title) return null;

            // Transfere o title para data-original-title para evitar o tooltip nativo feio do navegador
            if (target.getAttribute('title')) {
                target.dataset.originalTitle = title;
                target.removeAttribute('title');
            }
            
            if (activeTooltip) activeTooltip.remove();

            const tooltip = document.createElement('div');
            tooltip.className = 'mobile-badge-tooltip'; 
            tooltip.textContent = title;
            document.body.appendChild(tooltip);
            activeTooltip = tooltip;

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
            
            return tooltip;
        };

        const removeTooltip = () => {
            if (activeTooltip) {
                activeTooltip.remove();
                activeTooltip = null;
            }
        };

        // Para Mobile (Click)
        document.body.addEventListener('click', function(e) {
            const target = e.target.closest('.badge-card, .badge-item');
            if (!target) {
                removeTooltip();
                return;
            }
            if (window.innerWidth <= 992) {
                e.preventDefault();
                e.stopPropagation();
                createTooltip(target);
            }
        });

        // Para Desktop (Hover)
        document.body.addEventListener('mouseover', function(e) {
            if (window.innerWidth <= 992) return;
            const target = e.target.closest('.badge-card, .badge-item');
            if (target) {
                createTooltip(target);
            }
        });

        document.body.addEventListener('mouseout', function(e) {
            if (window.innerWidth <= 992) return;
            const target = e.target.closest('.badge-card, .badge-item');
            if (target) {
                removeTooltip();
            }
        });
    }

    // --- FUNÇÃO AUXILIAR: MODAL DE CONFIRMAÇÃO (Carregado de ui-helpers.js) ---
    const abrirModalConfirmacaoPersonalizado = window.abrirModalConfirmacaoPersonalizado;

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
    
    // --- INICIALIZAÇÃO DO EDITOR QUILL (Movido para depois do clone do form) ---
    let quill;

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
        blogTitleInputHandler = function() {
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
        };
        inputTitulo.addEventListener('input', blogTitleInputHandler);
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
            viewForm.style.display = 'flex';
            // Foca no título para facilitar
            setTimeout(() => document.getElementById('blog-titulo').focus(), 100);
        } else {
            viewForm.style.display = 'none';
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
        const formTitle = document.getElementById('form-titulo-acao');
        if (formTitle) formTitle.textContent = "Novo Artigo";
        toggleView(true);
    });

    // O botão de voltar/cancelar agora é gerenciado com os outros listeners
    // setupBtn('btn-voltar-lista', () => toggleView(false));

    function limparFormulario() {
        // Busca o formulário atual no DOM (pois o original pode ter sido substituído)
        const currentForm = document.getElementById('form-blog');
        if(currentForm) currentForm.reset(); 
        
        document.getElementById('blog-id').value = ''; // Limpa o ID
        
        if (quill) {
            quill.setText(''); // Limpa o texto
        }
        
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
                // Se a API retornou um objeto de erro (ex: 500), tenta ler a mensagem
                if (posts && posts.error) throw new Error(posts.error); // CORREÇÃO: Verifica se posts existe
                // Se não, lança erro genérico mas não quebra a aplicação
                console.warn("Resposta inesperada da API de posts:", posts);
                posts = []; // Assume vazio para não travar a tela
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
                containerLista.innerHTML = `<div style="text-align:center; padding:30px; color:#d32f2f; background:#fff0f0; border-radius:8px;"><p><strong>Não foi possível carregar seus artigos.</strong></p><p style="font-size:0.8rem;">Tente recarregar a página.</p></div>`;
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
                abrirModalConfirmacaoPersonalizado(
                    'Excluir Artigo',
                    `Tem certeza que deseja apagar o artigo "<strong>${post.titulo}</strong>"?<br>Essa ação não pode ser desfeita.`,
                    () => deletarArtigo(post.id)
                );
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
                const data = await res.json();
                if (data.pointsDeducted) {
                    showToast(`Artigo excluído. Você perdeu ${data.pointsDeducted} XP.`, 'info');
                } else {
                    showToast('Artigo excluído com sucesso.', 'success');
                }
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
        
        // Carrega conteúdo no Quill
        if (quill && post.conteudo) {
            // Uso da API correta para inserir HTML e atualizar o estado
            quill.clipboard.dangerouslyPasteHTML(0, post.conteudo);
        }
        
        document.getElementById('blog-imagem').value = post.imagem_url || '';
        toggleView(true);
    }

    // --- V6: INICIALIZAÇÃO DO QUILL (SEM CLONE) ---
    if (document.getElementById('editor-container')) {
        // LIMPEZA CRÍTICA: Remove a estrutura interna do Quill clonada antes de reinicializar.
        // Isso evita que o Quill se confunda com um editor "fantasma".
        document.getElementById('editor-container').innerHTML = '';

        quill = new Quill('#editor-container', {
            theme: 'snow',
            placeholder: 'Comece a escrever seu artigo aqui...',
            modules: {
                toolbar: [
                    [{ 'header': [2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    ['link'],
                    ['clean']
                ]
            }
        });
    }

    // --- V6: GERENCIAMENTO DE LISTENERS ---
    const btnCancelar = document.getElementById('btn-cancelar-artigo');
    const btnFecharModal = document.getElementById('btn-fechar-modal-artigo');

    blogCancelHandler = (e) => {
        e.preventDefault();
        toggleView(false);
    };
    if (btnCancelar) {
        btnCancelar.addEventListener('click', blogCancelHandler);
    }
    if (btnFecharModal) {
        btnFecharModal.addEventListener('click', blogCancelHandler);
    }
    // Fecha ao clicar fora do modal
    if (viewForm) {
        viewForm.addEventListener('click', (e) => {
            if (e.target === viewForm) blogCancelHandler(e);
        });
    }

    blogSubmitHandler = async function(e) {
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
                conteudo: quill ? quill.root.innerHTML : '', // Pega HTML do Quill
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
    };
    form.addEventListener('submit', blogSubmitHandler);

    // --- V6: FUNÇÃO DE LIMPEZA ---
    window.cleanupBlog = () => {
        if (form && blogSubmitHandler) {
            form.removeEventListener('submit', blogSubmitHandler);
        }
        if (btnCancelar && blogCancelHandler) {
            btnCancelar.removeEventListener('click', blogCancelHandler);
        }
        if (btnFecharModal && blogCancelHandler) {
            btnFecharModal.removeEventListener('click', blogCancelHandler);
        }
        if (inputTitulo && blogTitleInputHandler) {
            inputTitulo.removeEventListener('input', blogTitleInputHandler);
        }
        blogSubmitHandler = null;
        blogCancelHandler = null;
        blogTitleInputHandler = null;
    };

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
            autentico: { icon: '<svg width="1.2em" height="1.2em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: text-bottom;"><path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.918-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.337 2.25c-.416-.165-.866-.25-1.336-.25-2.21 0-3.918 1.79-3.918 4 0 .495.084.965.238 1.4-1.273.65-2.148 2.02-2.148 3.6 0 1.46.758 2.746 1.9 3.42-.047.19-.074.385-.074.58 0 2.21 1.71 4.002 3.918 4.002.47 0 .92-.086 1.336-.25.52 1.335 1.828 2.25 3.337 2.25s2.816-.915 3.337-2.25c.416.164.866.25 1.336.25 2.21 0 3.918-1.792 3.918-4 0-.195-.027-.39-.074-.58 1.14-.675 1.9-1.96 1.9-3.42z" fill="#1B4332"/><path d="M16.97 8.47a1.5 1.5 0 0 1 0 2.12l-6.5 6.5a1.5 1.5 0 0 1-2.12 0l-3.5-3.5a1.5 1.5 0 1 1 2.12-2.12l2.44 2.44 5.44-5.44a1.5 1.5 0 0 1 2.12 0z" fill="white"/></svg>', title: 'Autêntico' },
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

        // NOVO: Adiciona classe e ícone se o post for fixado
        if (post.isPinned) {
            card.classList.add('pinned');
            const titleEl = card.querySelector('.post-title');
            if (titleEl) {
                // Adiciona o ícone antes do texto do título
                titleEl.innerHTML = `<span class="pinned-icon" title="Fixado">📌</span> ${post.title}`;
            }
        } else {
            card.querySelector('.post-title').textContent = post.title;
        }

        card.querySelector('.post-category').textContent = post.category;
        const mobileCat = card.querySelector('.post-category-mobile');
        if(mobileCat) mobileCat.textContent = post.category;
        // Lógica de anonimato
        const authorName = post.isAnonymous ? 'Anônimo' : post.authorName;
        
        // Foto do autor
        // CORREÇÃO: Define o avatar e o nome em elementos separados para evitar quebra
        const authorAvatarEl = card.querySelector('.post-author-avatar');
        if (authorAvatarEl) authorAvatarEl.src = formatImageUrl(post.authorPhoto);
        
        const authorHtml = (post.isAnonymous || !post.authorSlug) 
            ? `por ${authorName}` 
            : `por <a href="/${post.authorSlug}" target="_blank" class="author-link" title="Ver perfil público">${authorName}</a>`;
        card.querySelector('.post-author').innerHTML = authorHtml;

        if (post.isAnonymous) card.querySelector('.post-author').style.fontStyle = 'italic';

        const badgesContainer = card.querySelector('.author-badges');
        if (badgesContainer) {
            badgesContainer.innerHTML = renderInlineAuthorBadges(post.authorBadges, post.authorLevel);
        }

        card.querySelector('.post-time').textContent = `há ${timeSince(post.createdAt)}`;
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

        // Esconde a header mobile padrão para dar lugar ao cabeçalho exclusivo do fórum
        const mHeader = document.querySelector('.mobile-header');
        if (mHeader) mHeader.style.display = 'none';

        try {
            const postRes = await apiFetch(`${API_BASE_URL}/api/forum/posts/${postId}`);
            if (!postRes.ok) throw new Error('Erro ao carregar post');
            const post = await postRes.json();
            
            const postEl = fullPostTemplate.content.cloneNode(true).firstElementChild;
            postEl.querySelector('.full-post-title').textContent = post.title;
            postEl.querySelector('.full-post-category').textContent = post.category;

            // Atualiza o título na App Header (Barra Flutuante do Mobile)
            const appHeaderTitle = postEl.querySelector('.app-header-title');
            if (appHeaderTitle) appHeaderTitle.textContent = post.title;
            
            // CORREÇÃO: Define o avatar e o nome em elementos separados
            const authorAvatarEl = postEl.querySelector('.full-post-avatar');
            if (authorAvatarEl) authorAvatarEl.src = formatImageUrl(post.authorPhoto);
            
            const authorHtml = (post.isAnonymous || !post.authorSlug) 
                ? (post.isAnonymous ? 'Anônimo' : post.authorName)
                : `<a href="/${post.authorSlug}" target="_blank" class="author-link" title="Ver perfil público">${post.authorName}</a>`;
            postEl.querySelector('.full-post-author').innerHTML = authorHtml;
            
            const badgesContainer = postEl.querySelector('.author-badges-full');
            if (badgesContainer) {
                badgesContainer.innerHTML = renderInlineAuthorBadges(post.authorBadges, post.authorLevel);
            }

            postEl.querySelector('.full-post-content').textContent = post.content;
            postEl.querySelector('.post-votes-count').textContent = post.votes;

            // Botão de voltar
            postEl.querySelector('#forum-back-to-feed-btn').onclick = () => {
                postView.classList.add('hidden');
                feedView.classList.remove('hidden');
                // if (fab) fab.style.display = 'block'; // Oculto globalmente
                currentPostId = null;
                
                const mHeader = document.querySelector('.mobile-header');
                if (mHeader) mHeader.style.display = '';
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
            const res = await apiFetch(`${API_BASE_URL}/api/forum/posts/${postId}/comments?page=${page}&limit=${fetchLimit}`);
            
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
        
        const authorHtml = (comment.isAnonymous || !comment.authorSlug) 
            ? authorName
            : `<a href="/${comment.authorSlug}" target="_blank" class="author-link" title="Ver perfil público">${authorName}</a>`;
        commentEl.querySelector('.comment-author').innerHTML = authorHtml;
        
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
            toggleBtn.innerHTML = `[+] Ver respostas (${comment.replies.length})`;
            toggleBtn.style.cssText = "background:none; border:none; color:#1c1c1c; font-size:0.85rem; font-weight:600; cursor:pointer; margin-top:5px; padding:0; display:block;";
            
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
                const isHidden = repliesContainer.style.display === 'none';
                if (isHidden) {
                    repliesContainer.style.display = 'block';
                    toggleBtn.innerHTML = `[-] Ocultar respostas`;
                    if (shownCount === 0) renderNextBatch();
                } else {
                    repliesContainer.style.display = 'none';
                    toggleBtn.innerHTML = `[+] Ver respostas (${comment.replies.length})`;
                }
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
                    toggleBtn.innerHTML = `[+] Ver respostas (${comment.replies.length})`;
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
        
        const repliesContainer = parentElement.querySelector('.comment-replies-container');
        repliesContainer.parentNode.insertBefore(formContainer, repliesContainer);
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
                const res = await apiFetch(`${API_BASE_URL}/api/forum/posts?filter=${activeFilter}&search=${encodeURIComponent(searchTerm)}&page=${page}&limit=${fetchLimit}`);
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
            if (createTextarea) {
                createTextarea.style.height = 'auto';
            }
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
                        const data = await res.json();
                        if (data.pointsDeducted) {
                            showToast(`Discussão excluída. Você perdeu ${data.pointsDeducted} XP.`, 'info');
                        } else {
                            showToast('Discussão excluída.', 'success');
                        }
                        if (isFullView) {
                            // Volta para o feed
                            postView.classList.add('hidden');
                            feedView.classList.remove('hidden');
                            // if (fab) fab.style.display = 'block'; // Oculto globalmente
                            currentPostId = null;
                            
                            const mHeader = document.querySelector('.mobile-header');
                            if (mHeader) mHeader.style.display = '';
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
                        const data = await res.json();
                        element.remove();
                        if (data.pointsDeducted) {
                            showToast(`Comentário excluído. Você perdeu ${data.pointsDeducted} XP.`, 'info');
                        } else {
                            showToast('Comentário excluído.', 'success');
                        }
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
        
        const catSelect = document.getElementById('post-category');
        if (catSelect && catSelect.tomselect) {
            catSelect.tomselect.setValue(post.category);
        } else {
            createForm.querySelector('[name="category"]').value = post.category;
        }
        
        const contentTextarea = createForm.querySelector('[name="content"]');
        contentTextarea.value = post.content;
        contentTextarea.style.height = 'auto';
        contentTextarea.style.height = contentTextarea.scrollHeight + 'px';
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
                    if (createTextarea) {
                        createTextarea.style.height = 'auto';
                    }
                    
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
    if (fab) fab.style.display = 'none'; // Desativa o FAB antigo
    
    // --- AUTO-RESIZE DO TEXTAREA ---
    const createTextarea = createForm.querySelector('textarea[name="content"]');
    if (createTextarea) {
        setupAutoResizeTextarea(createTextarea);
    }
            
            // --- ESTÉTICA DO SELECT CATEGORIA (TomSelect) ---
            const catSelect = document.getElementById('post-category');
            if (catSelect && typeof TomSelect !== 'undefined' && !catSelect.tomselect) {
                const isDesktop = window.innerWidth >= 992;
                if (isDesktop) {
                    new TomSelect(catSelect, {
                        create: false,
                        controlInput: `<input type="text" autocomplete="off" size="1" style="opacity:0; width:0; position:absolute; pointer-events:none;">`,
                        dropdownParent: 'body',
                        dropdownClass: 'ts-dropdown custom-ts-dropdown'
                    });
                }
            }

    // --- NOVA UX: Criar Post Moderno (Estilo Feed) ---
    let createPrompt = document.getElementById('modern-create-post-prompt');
    if (!createPrompt && postsContainer) {
        createPrompt = document.createElement('div');
        createPrompt.id = 'modern-create-post-prompt';
        createPrompt.className = 'modern-create-prompt';
        
        const userFirstName = psychologistData && psychologistData.nome ? psychologistData.nome.split(' ')[0] : 'Colega';
        const userPhoto = (psychologistData && psychologistData.fotoUrl) ? formatImageUrl(psychologistData.fotoUrl) : 'https://placehold.co/70x70/1B4332/FFFFFF?text=Psi';

        createPrompt.innerHTML = `
            <img src="${userPhoto}" alt="Sua foto" class="prompt-avatar">
            <div class="prompt-fake-input">Compartilhe um caso, dúvida ou insight, ${userFirstName}...</div>
            <button class="prompt-btn">Criar Tópico</button>
        `;
        
        // Insere logo antes do container de posts
        postsContainer.parentNode.insertBefore(createPrompt, postsContainer);
        
        createPrompt.onclick = () => {
            createForm.reset();
            if (createTextarea) {
                createTextarea.style.height = 'auto';
            }
            if (catSelect && catSelect.tomselect) {
                catSelect.tomselect.clear(true);
            }
            createModal.querySelector('h3').textContent = 'Criar Nova Discussão';
            document.getElementById('forum-submit-post-btn').textContent = 'Publicar';
            createForm.onsubmit = handlePostSubmit;
            createModal.style.display = 'flex';
        };
    }

    closeModalBtn.onclick = () => createModal.style.display = 'none';
    createModal.onclick = (e) => { if (e.target === createModal) createModal.style.display = 'none'; };
    createForm.onsubmit = handlePostSubmit;
    
    const cancelForumBtn = document.getElementById('cancel-forum-modal');
    if (cancelForumBtn) {
        cancelForumBtn.onclick = () => createModal.style.display = 'none';
    }
    
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

// --- LÓGICA DO FAB MÓVEL (DRAGGABLE) ---
const fabContainer = document.querySelector('.fab-container');
const fabDragTarget = document.querySelector('.fab-main'); // Alvo do toque restrito

if (fabContainer && fabDragTarget) {
    let isDragging = false;
    let startX, startY, startRight, startBottom;

    // Restaura posição salva pelo usuário
    const savedPos = localStorage.getItem('yelo_fab_pos');
    if (savedPos) {
        try {
            const pos = JSON.parse(savedPos);
            fabContainer.style.right = pos.right;
            fabContainer.style.bottom = pos.bottom;
        } catch(e) {}
    }

    fabDragTarget.addEventListener('touchstart', (e) => {
        isDragging = false;
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        
        const style = window.getComputedStyle(fabContainer);
        startRight = parseInt(style.right, 10);
        startBottom = parseInt(style.bottom, 10);
        
        fabContainer.style.transition = 'none'; // Remove animação para arrastar rápido
    }, { passive: false });

    fabDragTarget.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];
        const deltaX = startX - touch.clientX; // Movimento p/ esquerda aumenta o right
        const deltaY = startY - touch.clientY; // Movimento p/ cima aumenta o bottom

        // Se mover mais que 5px, considera que está arrastando
        if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
            isDragging = true;
            if (e.cancelable) e.preventDefault(); // Evita rolar a tela junto
        }

        if (isDragging) {
            fabContainer.style.right = `${startRight + deltaX}px`;
            fabContainer.style.bottom = `${startBottom + deltaY}px`;
        }
    }, { passive: false });

    fabDragTarget.addEventListener('touchend', (e) => {
        fabContainer.style.transition = ''; // Restaura animação suave
        if (isDragging) {
            // Salva a nova posição
            localStorage.setItem('yelo_fab_pos', JSON.stringify({
                right: fabContainer.style.right,
                bottom: fabContainer.style.bottom
            }));
            
            // Bloqueia o clique imediato para não abrir o menu ao soltar
            const captureClick = (ev) => {
                ev.stopPropagation();
                ev.preventDefault();
                fabContainer.removeEventListener('click', captureClick, true);
            };
            fabContainer.addEventListener('click', captureClick, true);
            
            setTimeout(() => {
                fabContainer.removeEventListener('click', captureClick, true);
            }, 100);
        }
    });
}
});     
// Arquivo: patient.js (MOTOR DO DASHBOARD - Renderização CORRETA)

document.addEventListener('DOMContentLoaded', () => {

    // -----------------------------------------------------
    // 0. CONFIGURAÇÕES GLOBAIS
    // -----------------------------------------------------
    const API_BASE_URL = window.API_BASE_URL || 'http://localhost:3001';

    // -----------------------------------------------------
    // FUNÇÃO UTILITÁRIA PARA IMAGENS
    // -----------------------------------------------------
    function formatImageUrl(path, fallback = 'https://placehold.co/100x100') {
        if (!path) return fallback;
        if (path.startsWith('http') || path.startsWith('data:')) return path;
        let cleanPath = path.replace(/\\/g, '/');
        if (cleanPath.includes('uploads/')) cleanPath = cleanPath.substring(cleanPath.lastIndexOf('uploads/'));
        if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;
        return `${API_BASE_URL}${cleanPath}`;
    }

    // -----------------------------------------------------
    // 1. VARIÁVEIS DE ESTADO E INFORMAÇÃO
    // -----------------------------------------------------
    let patientData = null; 
    const loginUrl = '/login'; 

    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('patient-main-content');
    const navLinks = document.querySelectorAll('.sidebar-nav li');

    // -----------------------------------------------------
    // 2. FUNÇÃO DE SEGURANÇA E BUSCA DE DADOS REAIS
    // -----------------------------------------------------
    async function fetchPatientData() {
        const token = localStorage.getItem('Yelo_token');

        if (!token) {
            window.location.href = loginUrl;
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/patients/me`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}` 
                }
            });

            if (response.ok) {
                patientData = await response.json();
                
                // --- ATUALIZAÇÃO: Preenche sidebar com dados do paciente ---
                updateSidebarUserInfo(patientData);
                
                if (patientData.nome) localStorage.setItem('Yelo_user_name', patientData.nome);
                if (patientData.fotoUrl) localStorage.setItem('Yelo_user_photo', patientData.fotoUrl);
                
                initializeDashboard();
            } else {
                throw new Error("Sessão inválida.");
            }

        } catch (error) {
            console.error('Falha na autenticação inicial:', error.message);
            localStorage.removeItem('Yelo_token');
            window.location.href = loginUrl;
        }
    }

    // --- NOVO: Função para atualizar sidebar ---
    function updateSidebarUserInfo(data) {
        const nameEl = document.getElementById('patient-sidebar-name');
        const photoEl = document.getElementById('patient-sidebar-photo');
        const mobilePhotoEl = document.getElementById('patient-mobile-photo');
        
        if (nameEl && data.nome) {
            nameEl.textContent = data.nome.split(' ')[0];
        }
        
        if (data.fotoUrl) {
            const fotoUrl = formatImageUrl(data.fotoUrl);
            if (photoEl) photoEl.src = fotoUrl; 
            if (mobilePhotoEl) mobilePhotoEl.src = fotoUrl;
        }
    }

    // -----------------------------------------------------
    // 3. LÓGICA DAS PÁGINAS ESPECÍFICAS
    // -----------------------------------------------------

    function inicializarVisaoGeral() {
        const welcomeHeader = document.querySelector('.welcome-section h1, .modern-hero-title'); // Seletor atualizado para moderno
        if (welcomeHeader && patientData) {
            const nomeCurto = patientData.nome.split(' ')[0];
            let saudacao = 'Boas-vindas'; // Padrão neutro

            // Lógica para definir a saudação com base no gênero
            if (patientData.identidade_genero === 'Masculino') {
                saudacao = 'Bem-vindo';
            } else if (patientData.identidade_genero === 'Feminino') {
                saudacao = 'Bem-vinda';
            }

            // Atualiza o conteúdo do H1 com a saudação e o nome
            welcomeHeader.innerHTML = `${saudacao}, <span id="nome-usuario-dash">${nomeCurto}</span>! 👋`;
        } else {
            const nomeUsuarioEl = document.getElementById('nome-usuario-dash');
            if (nomeUsuarioEl && patientData && patientData.nome) nomeUsuarioEl.textContent = patientData.nome.split(' ')[0];
        }

        // --- Buscar KPIs do Dashboard de Informações ---
        try {
            const token = localStorage.getItem('Yelo_token');
            const headers = { 'Authorization': `Bearer ${token}` };

            // Matches Encontrados
            fetch(`${API_BASE_URL}/api/psychologists/matches`, { headers })
                .then(res => res.json())
                .then(data => {
                    const list = Array.isArray(data) ? data : (data.results || []);
                    const el = document.getElementById('kpi-matches');
                    if (el) el.textContent = list.length;
                }).catch(() => {
                    const el = document.getElementById('kpi-matches');
                    if (el) el.textContent = '0';
                });

            // Favoritos
            fetch(`${API_BASE_URL}/api/patients/favorites`, { headers })
                .then(res => res.json())
                .then(data => {
                    const el = document.getElementById('kpi-favoritos');
                    if (el) el.textContent = data.length || 0;
                }).catch(() => {
                    const el = document.getElementById('kpi-favoritos');
                    if (el) el.textContent = '0';
                });

            // Avaliações Publicadas
            fetch(`${API_BASE_URL}/api/patients/me/reviews`, { headers })
                .then(res => res.json())
                .then(data => {
                    const el = document.getElementById('kpi-avaliacoes');
                    if (el) el.textContent = data.length || 0;
                }).catch(() => {
                    const el = document.getElementById('kpi-avaliacoes');
                    if (el) el.textContent = '0';
                });
                
        } catch (err) {
            console.error('Erro ao buscar estatísticas:', err);
        }
    }
    
    // Função para a tela de Matches
    async function inicializarMatches() {
        const matchesGrid = document.getElementById('matches-grid');
        if (!matchesGrid) return;
        
        matchesGrid.className = 'pro-results-grid'; // Aplica o grid moderno Yelo

        try {
            const token = localStorage.getItem('Yelo_token');
            
            const response = await fetch(`${API_BASE_URL}/api/psychologists/matches`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}` 
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Resposta vazia ou inválida.' }));
                throw new Error(`Falha ao carregar profissionais. Status ${response.status}: ${errorData.error || 'Erro desconhecido.'}`);
            }

            const responseData = await response.json();
            const psychologists = Array.isArray(responseData) ? responseData : (responseData.results || []);
            
            if (psychologists.length === 0) {
                const emptyState = document.getElementById('favoritos-vazio');
                if (emptyState) emptyState.classList.remove('hidden');
                matchesGrid.innerHTML = '';
                return;
            }

            const emptyState = document.getElementById('favoritos-vazio');
            if (emptyState) emptyState.classList.add('hidden');

            matchesGrid.innerHTML = psychologists.map(pro => window.PatientUI.createProCard(pro, false, formatImageUrl)).join('');

            // ADICIONADO: Conecta a função de favoritar aos novos botões criados
            setupFavoriteButtonsInDashboard(inicializarMatches);

        } catch (error) {
            console.error('Erro fatal ao buscar matches:', error);
            matchesGrid.innerHTML = `<p class="text-center text-error">Erro ao carregar profissionais: ${error.message}.</p>`;
        }
    }

    // Função para a tela de "Favoritos"
    async function inicializarFavoritos() {
        const favoritosGrid = document.getElementById('favoritos-grid');
        const favoritosVazio = document.getElementById('favoritos-vazio');
        if (!favoritosGrid || !favoritosVazio) return;

        try {
            const token = localStorage.getItem('Yelo_token');
            // CORREÇÃO: Usando a rota padronizada e corrigida '/favorites'
            const response = await fetch(`${API_BASE_URL}/api/patients/favorites`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Erro Backend Favoritos:", errorText);
                throw new Error(`Falha ao buscar favoritos: ${response.status}`);
            }

            const favorites = await response.json();

            if (favorites.length === 0) {
                favoritosGrid.classList.add('hidden');
                favoritosVazio.classList.remove('hidden');
            } else {
                favoritosGrid.classList.remove('hidden');
                favoritosVazio.classList.add('hidden');
                favoritosGrid.className = 'pro-results-grid'; // Aplica o grid moderno Yelo

                favoritosGrid.innerHTML = favorites.map(pro => window.PatientUI.createProCard(pro, true, formatImageUrl)).join('');

                // Adiciona a funcionalidade de desfavoritar na própria página
                setupFavoriteButtonsInDashboard(inicializarFavoritos);
            }

        } catch (error) {
            console.error("Erro ao carregar favoritos:", error);
            favoritosGrid.innerHTML = `<p style="color: red; text-align: center;">Ocorreu um erro ao carregar seus favoritos.<br><small>${error.message}</small></p>`;
            favoritosVazio.classList.add('hidden');
        }
    }

    // Função para a tela de "Minhas Avaliações"
    async function inicializarAvaliacoes() {
        const container = document.getElementById('reviews-list-container');
        const emptyState = document.getElementById('reviews-empty-state');
        if (!container || !emptyState) return;

        try {
            const token = localStorage.getItem('Yelo_token');
            const response = await fetch(`${API_BASE_URL}/api/patients/me/reviews`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Falha ao buscar avaliações.');

            const reviews = await response.json();

            if (reviews.length === 0) {
                container.classList.add('hidden');
                emptyState.classList.remove('hidden');
            } else {
                container.classList.remove('hidden');
                emptyState.classList.add('hidden');

                container.innerHTML = '<h2>Suas avaliações publicadas</h2>' + reviews.map(review => window.PatientUI.createReviewCard(review)).join('');
            }

        } catch (error) {
            console.error("Erro ao carregar avaliações:", error);
            container.innerHTML = '<p style="color: red;">Ocorreu um erro ao carregar suas avaliações. Tente novamente mais tarde.</p>';
            emptyState.classList.add('hidden');
        }
    }

    // Função de favoritar específica para o dashboard, que recarrega a lista
    function setupFavoriteButtonsInDashboard(callbackOnSuccess) {
        // CORREÇÃO: O seletor correto para o botão é '.btn-favorito'
        const favoriteButtons = document.querySelectorAll('.btn-favorito, .heart-icon');
        favoriteButtons.forEach(button => {
            button.addEventListener('click', async () => {
                const psychologistId = button.dataset.id;
                const token = localStorage.getItem('Yelo_token');

                try { // prettier-ignore
                    const response = await fetch(`${API_BASE_URL}/api/patients/me/favorites`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ psychologistId })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        showToast(data.message, 'success');

                        // Atualiza a UI do botão clicado
                        button.classList.toggle('favorited', data.favorited);

                        // Se a operação foi bem-sucedida (ex: desfavoritou),
                        // chama a função de callback para recarregar a lista.
                        if (callbackOnSuccess) {
                            callbackOnSuccess();
                        }
                    } else {
                        showToast("Erro ao remover favorito.", 'error');
                    }
                } catch (error) {
                    console.error("Erro ao favoritar no dashboard:", error);
                }
            });
        });
    }

    // --- FUNÇÃO GLOBAL PARA MOSTRAR NOTIFICAÇÕES (TOAST) ---
    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;
    const showToast = window.showToast;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        container.appendChild(toast);

        // Remove o toast do DOM após a animação de saída
        setTimeout(() => {
            toast.remove();
        }, 4500); // Duração da animação (4s) + tempo extra
    }


    // Função para a tela "Minha Conta"
    function inicializarMinhaConta() {
        const formDados = document.getElementById('form-dados-pessoais');
        const formSenha = document.getElementById('form-senha');
        
        if (!formDados || !formSenha) return;

        // Preenche os campos com os dados atuais do paciente
        const nomeInput = document.getElementById('nome-paciente');
        const emailInput = document.getElementById('email-paciente');
        const btnDados = formDados.querySelector('button[type="submit"]');
        
        if (patientData && patientData.nome) {
            nomeInput.value = patientData.nome;
            emailInput.value = patientData.email;
        }

        // --- Lógica da Foto de Perfil na aba Minha Conta ---
        const photoPreview = document.getElementById('account-profile-photo-preview');
        const photoTrigger = document.getElementById('account-photo-trigger');
        const photoInput = document.getElementById('account-photo-input');

        if (patientData && patientData.fotoUrl && photoPreview) {
            photoPreview.src = formatImageUrl(patientData.fotoUrl);
        }

        if (photoTrigger && photoInput) {
            photoTrigger.onclick = () => {
                photoInput.click();
            };
            photoInput.onclick = (e) => e.stopPropagation();

            photoInput.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    if (file.size > 10 * 1024 * 1024) {
                        return showToast('Arquivo muito grande. Limite máximo: 10MB.', 'error');
                    }
                    const fd = new FormData();
                    fd.append('foto', file);
                    showToast('Enviando foto...', 'info');
                    try {
                        const res = await fetch(`${API_BASE_URL}/api/patients/me/foto`, { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('Yelo_token')}` }, body: fd });
                        if (res.ok) {
                            const d = await res.json();
                            if(patientData) patientData.fotoUrl = d.fotoUrl;
                            updateSidebarUserInfo(patientData);
                            if(photoPreview) photoPreview.src = formatImageUrl(d.fotoUrl);
                            showToast('Foto atualizada com sucesso!', 'success');
                        } else throw new Error();
                    } catch (err) { showToast('Erro ao atualizar foto.', 'error'); } finally { photoInput.value = ''; }
                }
            };
        }

        // --- Lógica para atualizar dados pessoais ---
        formDados.addEventListener('submit', async (e) => {
            e.preventDefault();

            const token = localStorage.getItem('Yelo_token');
            const originalText = btnDados.textContent;
            btnDados.disabled = true;
            btnDados.textContent = 'Salvando...';

            try {
                const response = await fetch(`${API_BASE_URL}/api/patients/me`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        nome: nomeInput.value,
                        email: emailInput.value
                    })
                });

                const result = await response.json();
                if (response.ok) {
                    showToast(result.message, 'success');
                    // Atualiza os dados locais para refletir a mudança
                    patientData.nome = nomeInput.value;
                    patientData.email = emailInput.value;
                    
                    // Atualiza o nome globalmente (Header e Dashboard)
                    const novoNome = nomeInput.value;
                    const primeiroNome = novoNome.split(' ')[0];
                    
                    localStorage.setItem('Yelo_user_name', novoNome);
                    
                    // Atualiza "Olá, [Nome]" no Header
                    const headerGreeting = document.querySelector('.user-greeting-text');
                    if (headerGreeting) headerGreeting.textContent = `Painel de ${primeiroNome}`;
                    const headerAvatar = document.getElementById('header-avatar-initial');
                    if (headerAvatar && !headerAvatar.tagName.toLowerCase().includes('img')) headerAvatar.textContent = primeiroNome.charAt(0).toUpperCase();

                    // Atualiza Banner de Boas-vindas (se estiver visível)
                    const dashName = document.getElementById('nome-usuario-dash');
                    if (dashName) dashName.textContent = primeiroNome;

                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                showToast(error.message || 'Erro ao atualizar dados.', 'error');
            } finally {
                btnDados.disabled = false;
                btnDados.textContent = originalText;
            }
        });

        // --- Lógica para alterar a senha ---
        formSenha.addEventListener('submit', async (e) => {
            e.preventDefault();
            const token = localStorage.getItem('Yelo_token');

            const senhaAtual = document.getElementById('senha-atual').value;
            const novaSenha = document.getElementById('nova-senha').value;

            try {
                const response = await fetch(`${API_BASE_URL}/api/patients/me/password`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        senha_atual: senhaAtual,
                        nova_senha: novaSenha
                    })
                });

                const result = await response.json();
                if (response.ok) {
                    showToast(result.message, 'success');
                    formSenha.reset(); // Limpa os campos de senha
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                showToast(error.message || 'Erro ao alterar senha.', 'error');
            }
        });

        // --- Lógica para Excluir Conta ---
        const btnExcluir = document.getElementById('btn-excluir-conta');
        const modalExclusao = document.getElementById('modal-exclusao-conta');
        const btnCancelar = document.getElementById('btn-cancelar-exclusao');
        const btnConfirmar = document.getElementById('btn-confirmar-exclusao');
        const inputSenhaExclusao = document.getElementById('senha-exclusao');

        if (btnExcluir && modalExclusao) {
            // Abrir Modal
            btnExcluir.addEventListener('click', (e) => {
                e.preventDefault();
                modalExclusao.style.setProperty('display', 'flex', 'important');
                inputSenhaExclusao.value = ''; 
                setTimeout(() => inputSenhaExclusao.focus(), 100);
            });

            // Fechar Modal
            const fecharModal = () => { modalExclusao.style.setProperty('display', 'none', 'important'); };
            if (btnCancelar) btnCancelar.addEventListener('click', (e) => { e.preventDefault(); fecharModal(); });
            modalExclusao.addEventListener('click', (e) => { if (e.target === modalExclusao) fecharModal(); });

            // Confirmar Exclusão
            if (btnConfirmar) btnConfirmar.addEventListener('click', async (e) => {
                e.preventDefault();
                const senha = inputSenhaExclusao.value;
                if (!senha) return showToast("Por favor, digite sua senha.", 'error');

                try {
                    const token = localStorage.getItem('Yelo_token');
                    btnConfirmar.textContent = 'Excluindo...';
                    btnConfirmar.disabled = true;

                    const response = await fetch(`${API_BASE_URL}/api/patients/me`, {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ senha })
                    });

                    const result = await response.json();

                    if (response.ok) {
                        showToast(result.message, 'success');
                        setTimeout(() => {
                            localStorage.removeItem('Yelo_token');
                            window.location.href = '/login';
                        }, 1500);
                    } else {
                        showToast(result.error || 'Erro ao excluir conta.', 'error');
                        btnConfirmar.textContent = 'Excluir Conta';
                        btnConfirmar.disabled = false;
                    }
                } catch (error) {
                    showToast('Erro de conexão.', 'error');
                    btnConfirmar.textContent = 'Excluir Conta';
                    btnConfirmar.disabled = false;
                }
            });
        }
    }

    // -----------------------------------------------------
    // 4. GERENCIADOR DE CARREGAMENTO E INICIALIZAÇÃO
    // -----------------------------------------------------

    window.loadPage = function(pageUrl) {
        if (!pageUrl) return;

        window.appHistory = window.appHistory || [];
        window.appForwardHistory = window.appForwardHistory || [];
        
        if (!window.isHistoryNav) {
            if (window.appHistory[window.appHistory.length - 1] !== pageUrl) {
                window.appHistory.push(pageUrl);
                window.appForwardHistory = [];
            }
        }
        window.isHistoryNav = false;

        // FIX: Garante que o arquivo seja buscado da raiz da pasta /patient/
        const fetchUrl = pageUrl.startsWith('/') ? pageUrl : `/patient/${pageUrl}`;
        fetch(fetchUrl) 
            .then(response => response.ok ? response.text() : Promise.reject(`Arquivo não encontrado: ${pageUrl}`))
            .then(html => {
                mainContent.innerHTML = html;
                
                // --- Lógica de Hub: Sincronizar estado ativo na Sidebar e Bottom Nav ---
                document.querySelectorAll('.sidebar-nav li').forEach(li => li.classList.remove('active'));
                document.querySelectorAll('.bottom-nav-item').forEach(b => b.classList.remove('active'));

                let activeLink = document.querySelector(`.sidebar-nav a[data-page="${pageUrl}"]`);
                let activeBottomLink = document.querySelector(`.bottom-nav-item[data-target-page="${pageUrl}"]`);
                
                if (!activeLink || !activeBottomLink) {
                    let hubPage = '';
                    if (['patient_matches.html', 'patient_favoritos.html', 'patient_avaliacoes.html'].includes(pageUrl)) {
                        hubPage = 'patient_conexoes_hub.html';
                    } else if (['patient_minha_conta.html'].includes(pageUrl)) {
                        hubPage = 'patient_ajustes_hub.html';
                    }

                    if (hubPage) {
                        if (!activeLink) activeLink = document.querySelector(`.sidebar-nav a[data-page="${hubPage}"]`);
                        if (!activeBottomLink) activeBottomLink = document.querySelector(`.bottom-nav-item[data-target-page="${hubPage}"]`);
                    }
                }

                if (activeLink) activeLink.closest('li').classList.add('active');
                if (activeBottomLink) activeBottomLink.classList.add('active');

                if (pageUrl.includes('patient_visao_geral.html')) {
                    inicializarVisaoGeral();
                } else if (pageUrl.includes('patient_matches.html')) {
                    inicializarMatches(); 
                } else if (pageUrl.includes('patient_avaliacoes.html')) {
                    inicializarAvaliacoes();
                } else if (pageUrl.includes('patient_favoritos.html')) {
                    inicializarFavoritos();
                } else if (pageUrl.includes('patient_minha_conta.html')) {
                    inicializarMinhaConta();
                }

                // SMART SCROLL PARA PÁGINAS CURTAS
                const scrollableContent = document.querySelector('.dashboard-main');
                const bottomNav = document.querySelector('.mobile-bottom-nav');
                if (scrollableContent && bottomNav && window.innerWidth <= 992) {
                    setTimeout(() => { const isScrollable = scrollableContent.scrollHeight > scrollableContent.clientHeight; if (!isScrollable) setTimeout(() => bottomNav.classList.add('nav-hidden'), 2000); }, 150);
                }

            })
            .catch(error => {
                mainContent.innerHTML = `<h1>Página em Construção ou Erro de Carregamento</h1>`;
                console.error(error);
            });
    }

    function initializeDashboard() {
        // --- REMOVE O LOADER GLOBAL ---
        const loader = document.getElementById('global-loader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.style.display = 'none', 500);
        }
        const dashboardContainer = document.getElementById('dashboard-container');
        if (dashboardContainer) dashboardContainer.style.display = 'flex';

        // --- LÓGICA DE UPLOAD DE FOTO (SIDEBAR) ---
        const sidebarTrigger = document.getElementById('sidebar-photo-trigger');
        const sidebarInput = document.getElementById('sidebar-photo-input');

        if (sidebarTrigger && sidebarInput) {
            sidebarTrigger.onclick = () => {
                sidebarInput.click();
            };
            sidebarInput.onclick = (e) => e.stopPropagation();

            sidebarInput.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    if (file.size > 10 * 1024 * 1024) {
                        showToast('Arquivo muito grande. Limite máximo: 10MB.', 'error');
                        sidebarInput.value = '';
                        return;
                    }

                    const fd = new FormData();
                    fd.append('foto', file);
                    showToast('Enviando foto...', 'info');

                    try {
                        const res = await fetch(`${API_BASE_URL}/api/patients/me/foto`, { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('Yelo_token')}` }, body: fd });
                        if (res.ok) {
                            const d = await res.json();
                            if(patientData) patientData.fotoUrl = d.fotoUrl;
                            updateSidebarUserInfo(patientData);
                            showToast('Foto atualizada!', 'success');
                        } else throw new Error();
                    } catch (err) {
                        showToast('Erro ao atualizar foto.', 'error');
                    } finally { sidebarInput.value = ''; }
                }
            };
        }

        // --- LÓGICA DO MENU MOBILE (ADAPTADA PARA O HEADER GLOBAL) ---
        const menuBtn = document.querySelector('.menu-hamburguer');
        if (menuBtn && sidebar) {
            // 1. Clona o botão para remover o listener do script.js (que abre o nav container)
            const newMenuBtn = menuBtn.cloneNode(true);
            menuBtn.parentNode.replaceChild(newMenuBtn, menuBtn);

            // 2. Adiciona o novo listener que controla a sidebar do dashboard
            newMenuBtn.addEventListener('click', (e) => {
                e.preventDefault();
                sidebar.classList.toggle('is-open');
            });
        }

        // --- LÓGICA DE LOGOUT ---
        const logoutLink = document.getElementById('btn-logout'); 
        if (logoutLink) {
            logoutLink.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.removeItem('Yelo_token'); 
                window.location.href = '/login'; 
            });
        }

        // --- NOVO: NAVEGAÇÃO INTERNA PELOS CARDS DO DASHBOARD ---
        mainContent.addEventListener('click', (e) => {
            const targetCard = e.target.closest('[data-page-target]');
            if (targetCard) {
                const page = targetCard.getAttribute('data-page-target');
                if (page) {
                    // 1. Atualiza visualmente o menu lateral (se encontrar o link)
                    const allLinks = document.querySelectorAll('.sidebar-nav li');
                    allLinks.forEach(item => item.classList.remove('active'));
                    
                    // Tenta achar o LI pelo atributo no próprio LI ou no A filho
                    let sidebarLink = document.querySelector(`.sidebar-nav li[data-page="${page}"]`);
                    if (!sidebarLink) {
                        const anchor = document.querySelector(`.sidebar-nav li a[data-page="${page}"]`);
                        if (anchor) sidebarLink = anchor.closest('li');
                    }
                    
                    if (sidebarLink) sidebarLink.classList.add('active');

                    // 2. Carrega a página DIRETAMENTE (sem depender do click no menu)
                    window.loadPage(page);
                }
            }
        });

        // --- ADICIONA EVENTO DE CLIQUE PARA A NAVEGAÇÃO (DELEGAÇÃO) ---
        const sidebarNavList = document.querySelector('.sidebar-nav ul');
        if (sidebarNavList) {
            sidebarNavList.addEventListener('click', (e) => {
                const li = e.target.closest('li');
                if (!li) return;

                let page = li.getAttribute('data-page');
                const childLink = li.querySelector('a');

                // Fallback: verifica se o atributo está no link <a> filho
                if (!page && childLink) {
                    page = childLink.getAttribute('data-page');
                }

                if (!page) {
                    // Se for link normal (href), deixa navegar
                    if (childLink && childLink.getAttribute('href') && childLink.getAttribute('href') !== '#') {
                        return; 
                    }
                    e.preventDefault();
                    return;
                }

                e.preventDefault(); // Previne navegação padrão (SPA)

                if (sidebar && sidebar.classList.contains('is-open')) {
                    sidebar.classList.remove('is-open');
                }

                window.loadPage(page);
            });
        }

        // --- INICIALIZAÇÃO DE TELA (Carrega a Visão Geral) ---
        window.loadPage('patient_visao_geral.html');

        // --- LÓGICA DA BOTTOM NAV E SHEET (MOBILE) ---
        const bottomNavItems = document.querySelectorAll('.bottom-nav-item[data-target-page]');
        bottomNavItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const targetPage = item.getAttribute('data-target-page');
                document.querySelectorAll('.bottom-nav-item').forEach(b => b.classList.remove('active'));
                item.classList.add('active');
                const sidebarLink = document.querySelector(`.sidebar-nav a[data-page="${targetPage}"]`);
                if (sidebarLink) sidebarLink.click();
            });
        });

        const accountSheetOverlay = document.getElementById('account-sheet-overlay');
        const accountSheet = document.querySelector('.account-sheet');
        const closeSheetBtn = document.getElementById('close-account-sheet');
        const trigger = document.getElementById('mobile-avatar-trigger');
        if(trigger) {
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                accountSheetOverlay.classList.add('active');
                setTimeout(() => accountSheet.classList.add('active'), 10);
            });
        }
        const closeSheet = () => {
            if(accountSheet) accountSheet.classList.remove('active');
            if(accountSheetOverlay) setTimeout(() => accountSheetOverlay.classList.remove('active'), 300);
        };
        if(closeSheetBtn) closeSheetBtn.addEventListener('click', closeSheet);
        if(accountSheetOverlay) accountSheetOverlay.addEventListener('click', (e) => { if(e.target === accountSheetOverlay) closeSheet(); });

        document.querySelectorAll('.sheet-link[data-page]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.getAttribute('data-page');
                const sidebarLink = document.querySelector(`.sidebar-nav a[data-page="${page}"]`);
                if (sidebarLink) sidebarLink.click();
                closeSheet();
            });
        });
        const btnLogoutSheet = document.getElementById('btn-logout-sheet');
        if(btnLogoutSheet) btnLogoutSheet.addEventListener('click', () => document.getElementById('btn-logout').click());

        // --- LÓGICA DE SMART SCROLL ---
        const scrollableContent = document.querySelector('.dashboard-main');
        const bottomNav = document.querySelector('.mobile-bottom-nav');
        if (window.innerWidth <= 992 && scrollableContent && bottomNav) {
            bottomNav.addEventListener('click', () => bottomNav.classList.remove('nav-hidden'));
            let lastScrollY = scrollableContent.scrollTop;
            scrollableContent.addEventListener('scroll', () => {
                const currentScrollY = scrollableContent.scrollTop;
                if (currentScrollY > lastScrollY && currentScrollY > 100) bottomNav.classList.add('nav-hidden');
                else if (currentScrollY < lastScrollY) bottomNav.classList.remove('nav-hidden');
                lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY;
            }, { passive: true });
        }
        
        // Inicia o Pull to Refresh
        if (window.setupPullToRefresh) window.setupPullToRefresh();

        // Inicia Navegação por Swipe
        if (window.setupSwipeNavigation) window.setupSwipeNavigation();

    } // FIM initializeDashboard()

    // -----------------------------------------------------
    // 5. INÍCIO DA EXECUÇÃO
    // -----------------------------------------------------
    fetchPatientData(); 
});
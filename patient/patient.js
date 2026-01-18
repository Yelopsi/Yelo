// Arquivo: patient.js (MOTOR DO DASHBOARD - Renderização CORRETA)

document.addEventListener('DOMContentLoaded', () => {

    // -----------------------------------------------------
    // 0. CONFIGURAÇÕES GLOBAIS
    // -----------------------------------------------------
    const API_BASE_URL = window.API_BASE_URL || 'http://localhost:3001';

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
        
        if (nameEl && data.nome) {
            nameEl.textContent = data.nome.split(' ')[0];
        }
        
        if (photoEl && data.fotoUrl) {
            let fotoUrl = data.fotoUrl;
            if (fotoUrl && !fotoUrl.startsWith('http') && !fotoUrl.startsWith('data:')) {
                fotoUrl = `${API_BASE_URL}/${fotoUrl.replace(/^backend\/public\//, '').replace(/^\//, '')}`;
            }
            photoEl.src = fotoUrl; 
        }
    }

    // -----------------------------------------------------
    // 3. LÓGICA DAS PÁGINAS ESPECÍFICAS
    // -----------------------------------------------------

    function inicializarVisaoGeral() {
        const welcomeHeader = document.querySelector('.welcome-section h1'); // Seletor atualizado
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
    }
    
    // Função para a tela de Matches
    async function inicializarMatches() {
        const matchesGrid = document.getElementById('matches-grid');
        if (!matchesGrid) return;
        
        matchesGrid.innerHTML = '<div style="text-align:center; padding:40px; grid-column: 1 / -1;"><div class="loader-spinner" style="margin: 0 auto;"></div><p style="margin-top: 15px; color: #666;">Buscando profissionais compatíveis...</p></div>';

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

            matchesGrid.innerHTML = psychologists.map(pro => {
                // Tratamento de Imagem
                let fotoUrl = pro.fotoUrl || pro.foto || 'https://placehold.co/400x400/1B4332/FFFFFF?text=Psi';
                if (fotoUrl && !fotoUrl.startsWith('http') && !fotoUrl.startsWith('data:')) {
                    fotoUrl = `${API_BASE_URL}/${fotoUrl.replace(/^backend\/public\//, '').replace(/^\//, '')}`;
                }

                const tags = pro.temas_atuacao || pro.temas || [];
                const tagsHtml = tags.slice(0, 3).map(tag => `<span class="match-tag">${tag}</span>`).join('');
                const priceFormatted = (pro.valor_sessao_numero || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                const bio = pro.bio || "Sem biografia.";
                const profileLink = pro.slug ? `/${pro.slug}` : `../perfil_psicologo.html?id=${pro.id}`;

                return `
                <div class="match-card">
                    <div class="heart-icon" data-id="${pro.id}" title="Favoritar">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                    </div>
                    
                    <img src="${fotoUrl}" alt="${pro.nome}" class="match-header-img">
                    
                    <div class="match-body">
                        <h3 class="match-name">${pro.nome}</h3>
                        <span class="match-crp">CRP ${pro.crp}</span>
                        
                        <div class="match-tags">${tagsHtml}</div>
                        
                        <p class="match-bio">${bio}</p>
                        
                        <div class="match-footer">
                            <div class="match-price">
                                <span>Valor Sessão</span>
                                <strong>${priceFormatted}</strong>
                            </div>
                            <a href="${profileLink}" class="btn-profile">Ver Perfil</a>
                        </div>
                    </div>
                </div>
                `;
            }).join('');

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

        favoritosGrid.innerHTML = '<div style="text-align:center; padding:40px; grid-column: 1 / -1;"><div class="loader-spinner" style="margin: 0 auto;"></div><p style="margin-top: 15px; color: #666;">Carregando seus favoritos...</p></div>';

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

                // Reutiliza a lógica de criação de card (similar a 'inicializarMatches')
                favoritosGrid.innerHTML = favorites.map(pro => {
                    // Tratamento de Imagem
                    let fotoUrl = pro.fotoUrl || pro.foto || 'https://placehold.co/400x400/1B4332/FFFFFF?text=Psi';
                    if (fotoUrl && !fotoUrl.startsWith('http') && !fotoUrl.startsWith('data:')) {
                        fotoUrl = `${API_BASE_URL}/${fotoUrl.replace(/^backend\/public\//, '').replace(/^\//, '')}`;
                    }

                    const tags = pro.temas_atuacao || pro.temas || [];
                    const tagsHtml = tags.slice(0, 3).map(tag => `<span class="match-tag">${tag}</span>`).join('');
                    const priceFormatted = (pro.valor_sessao_numero || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    const bio = pro.bio || "Sem biografia.";
                    const profileLink = pro.slug ? `/${pro.slug}` : `../perfil_psicologo.html?id=${pro.id}`;

                    return `
                    <div class="match-card">
                        <div class="heart-icon favorited" data-id="${pro.id}" title="Desfavoritar">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                        </div>
                        
                        <img src="${fotoUrl}" alt="${pro.nome}" class="match-header-img">
                        
                        <div class="match-body">
                            <h3 class="match-name">${pro.nome}</h3>
                            <span class="match-crp">CRP ${pro.crp}</span>
                            
                            <div class="match-tags">${tagsHtml}</div>
                            
                            <p class="match-bio">${bio}</p>
                            
                            <div class="match-footer">
                                <div class="match-price">
                                    <span>Valor Sessão</span>
                                    <strong>${priceFormatted}</strong>
                                </div>
                                <a href="${profileLink}" class="btn-profile">Ver Perfil</a>
                            </div>
                        </div>
                    </div>
                    `;
                }).join('');

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

                // Helper para gerar estrelas
                const renderStars = (rating) => '★'.repeat(rating) + '☆'.repeat(5 - rating);

                container.innerHTML = '<h2>Suas avaliações publicadas</h2>' + reviews.map(review => `
                    <div class="review-item" style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 20px;">
                        <div class="review-header" style="display: flex; align-items: center; gap: 15px; margin-bottom: 10px;">
                            <img src="${review.psychologist.fotoUrl || 'https://placehold.co/60x60'}" alt="Foto de ${review.psychologist.nome}" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover;">
                            <div>
                                <h3 style="margin: 0; font-size: 1.2rem;">${review.psychologist.nome}</h3>
                                <span style="font-size: 0.9rem; color: #888;">Avaliado em ${new Date(review.createdAt).toLocaleDateString('pt-BR')}</span>
                            </div>
                        </div>
                        <div class="perfil-rating">
                            <span class="stars" style="color: #f39c12; font-weight: bold;">${renderStars(review.rating)}</span>
                        </div>
                        <p style="margin-top: 10px;">${review.comment || '<i>Nenhum comentário adicionado.</i>'}</p>
                    </div>
                `).join('');
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

        // --- REMOVE A OPÇÃO DE FOTO (SOLICITADO) ---
        const photoSection = document.querySelector('.profile-photo-section');
        if (photoSection) photoSection.style.display = 'none';
        // -------------------------------------------

        // Preenche os campos com os dados atuais do paciente
        const nomeInput = document.getElementById('nome-paciente');
        const emailInput = document.getElementById('email-paciente');
        const btnDados = formDados.querySelector('button[type="submit"]');
        
        let isEditing = false; // Estado inicial: Visualização

        if (patientData && patientData.nome) {
            nomeInput.value = patientData.nome;
            emailInput.value = patientData.email;
        }

        // --- Lógica para atualizar dados pessoais (Toggle Alterar/Salvar) ---
        formDados.addEventListener('submit', async (e) => {
            e.preventDefault();

            // 1. Se NÃO estiver editando, ativa o modo de edição
            if (!isEditing) {
                isEditing = true;
                nomeInput.disabled = false;
                emailInput.disabled = false;
                nomeInput.focus();
                
                // Muda aparência do botão
                btnDados.textContent = 'Salvar Dados';
                btnDados.classList.remove('btn-secundario');
                btnDados.classList.add('btn-principal');
                return;
            }

            // 2. Se JÁ estiver editando, realiza o salvamento
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
                    const headerGreeting = document.querySelector('.user-greeting');
                    if (headerGreeting) headerGreeting.textContent = `Olá, ${primeiroNome}`;

                    // Atualiza Banner de Boas-vindas (se estiver visível)
                    const dashName = document.getElementById('nome-usuario-dash');
                    if (dashName) dashName.textContent = primeiroNome;

                    // Volta ao estado de visualização
                    isEditing = false;
                    nomeInput.disabled = true;
                    emailInput.disabled = true;
                    btnDados.textContent = 'Alterar Dados';
                    btnDados.classList.remove('btn-principal');
                    btnDados.classList.add('btn-secundario');
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                showToast(error.message || 'Erro ao atualizar dados.', 'error');
            } finally {
                btnDados.disabled = false;
                if (isEditing) btnDados.textContent = 'Salvar Dados'; // Mantém texto se der erro
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
        if (btnExcluir) {
            btnExcluir.addEventListener('click', async (e) => {
                e.preventDefault();
                
                if (!confirm("Tem certeza que deseja excluir sua conta? Essa ação é irreversível e apagará todos os seus dados.")) {
                    return;
                }

                const senha = prompt("Por favor, digite sua senha para confirmar a exclusão:");
                if (!senha) return;

                try {
                    const token = localStorage.getItem('Yelo_token');
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
                        alert(result.message);
                        localStorage.removeItem('Yelo_token');
                        window.location.href = '../index.html';
                    } else {
                        alert(result.error || 'Ocorreu um erro ao excluir a conta.');
                    }
                } catch (error) {
                    alert('Erro de conexão ao tentar excluir a conta.');
                }
            });
        }
    }

    // -----------------------------------------------------
    // 4. GERENCIADOR DE CARREGAMENTO E INICIALIZAÇÃO
    // -----------------------------------------------------

    function loadPage(pageUrl) {
        if (!pageUrl) return;

        fetch(pageUrl) 
            .then(response => response.ok ? response.text() : Promise.reject(`Arquivo não encontrado: ${pageUrl}`))
            .then(html => {
                mainContent.innerHTML = html;
                
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
        // (Corrigido para usar a URL de login correta e o seletor de Sair)
        const logoutLink = document.querySelector('.sidebar-footer a[href="/index.html"]'); // ACHA O BOTÃO "SAIR"
        if (logoutLink) {
            logoutLink.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.removeItem('Yelo_token'); 
                window.location.href = '/login'; // MANDA PARA A PÁGINA DE LOGIN (NA RAIZ)
            });
        }

        // --- NOVO: NAVEGAÇÃO INTERNA PELOS CARDS DO DASHBOARD ---
        // Permite que qualquer elemento com 'data-page-target' funcione como link
        mainContent.addEventListener('click', (e) => {
            const targetCard = e.target.closest('[data-page-target]');
            if (targetCard) {
                const page = targetCard.getAttribute('data-page-target');
                // Encontra o link correspondente na sidebar para ativar o estado visual
                const sidebarLink = document.querySelector(`.sidebar-nav li[data-page="${page}"]`);
                if (sidebarLink) sidebarLink.click();
            }
        });

        // --- ADICIONA EVENTO DE CLIQUE PARA A NAVEGAÇÃO ---
        navLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                
                let page = this.getAttribute('data-page');
                // Fallback: verifica se o atributo está no link <a> filho, caso o HTML tenha mudado
                if (!page) {
                    const childLink = this.querySelector('a');
                    if (childLink) page = childLink.getAttribute('data-page');
                }

                // Se for um link externo (como o do questionário), navega para a URL do 'href'
                if (!page) {
                    const externalLink = this.querySelector('a');
                    // Se tiver href válido e diferente de #, deixa navegar nativamente
                    if (externalLink && externalLink.getAttribute('href') && externalLink.getAttribute('href') !== '#') {
                        return; 
                    }
                    e.preventDefault();
                    return;
                }

                e.preventDefault(); // Previne navegação padrão apenas para links internos (SPA)
                if (sidebar.classList.contains('is-open')) {
                    sidebar.classList.remove('is-open');
                }

                navLinks.forEach(item => item.classList.remove('active'));
                this.classList.add('active');
                loadPage(page);
            });
        });

        // --- INICIALIZAÇÃO DE TELA (Carrega a Visão Geral) ---
        loadPage('./patient_visao_geral.html');

    } // FIM initializeDashboard()

    // -----------------------------------------------------
    // 5. INÍCIO DA EXECUÇÃO
    // -----------------------------------------------------
    fetchPatientData(); 
});
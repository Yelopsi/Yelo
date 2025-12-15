// Arquivo: patient.js (MOTOR DO DASHBOARD - Renderização CORRETA)

document.addEventListener('DOMContentLoaded', () => {

    // -----------------------------------------------------
    // 1. VARIÁVEIS DE ESTADO E INFORMAÇÃO
    // -----------------------------------------------------
    let patientData = null; 
    const loginUrl = '../login.html'; 
    
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('patient-main-content');
    const navLinks = document.querySelectorAll('.sidebar-nav li');

    // -----------------------------------------------------
    // 2. FUNÇÃO DE SEGURANÇA E BUSCA DE DADOS REAIS
    // -----------------------------------------------------
    async function fetchPatientData() {
        const token = localStorage.getItem('girassol_token');

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
                initializeDashboard();
            } else {
                throw new Error("Sessão inválida.");
            }

        } catch (error) {
            console.error('Falha na autenticação inicial:', error.message);
            localStorage.removeItem('girassol_token');
            window.location.href = loginUrl;
        }
    }

    // -----------------------------------------------------
    // 3. LÓGICA DAS PÁGINAS ESPECÍFICAS
    // -----------------------------------------------------

    function inicializarVisaoGeral() {
        const welcomeHeader = document.querySelector('.welcome-header h1');
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
            welcomeHeader.innerHTML = `${saudacao} à sua jornada, <span id="nome-usuario">${nomeCurto}</span>!`;
        } else {
            const nomeUsuarioEl = document.getElementById('nome-usuario');
            if (nomeUsuarioEl && patientData && patientData.nome) nomeUsuarioEl.textContent = patientData.nome.split(' ')[0];
        }

        const statusPaciente = 'novo'; 
        const cardPassosEl = document.getElementById('card-proximos-passos');
        
        if (cardPassosEl) {
            if (statusPaciente === 'novo') {
                cardPassosEl.innerHTML = `
                    <h2>Pronto(a) para começar a conversa?</h2>
                    <p>Explore os perfis que encontramos para você na seção 'Meus Matches' e inicie o contato com quem você mais se identificar.</p>
                    <a href="#" class="btn btn-principal" data-target="patient_matches.html">Ver meus Matches</a>
                `;
            } else {
                cardPassosEl.innerHTML = `
                    <h2>Como foi sua experiência?</h2>
                    <p>Sua opinião é muito importante para nossa comunidade. Quando se sentir confortável, você pode deixar uma avaliação sobre o profissional com quem conversou.</p>
                    <a href="#" class="btn btn-principal" data-target="patient_matches.html">Avaliar Profissional</a>
                `;
            }

            // Adiciona o evento de clique para o botão "Ver meus Matches"
            const verMatchesBtn = cardPassosEl.querySelector('[data-target="patient_matches.html"]');
            if (verMatchesBtn) {
                verMatchesBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    // Encontra o link correspondente na barra lateral e simula um clique
                    const matchesLink = document.querySelector('.sidebar-nav li[data-page="patient_matches.html"]');
                    if (matchesLink) {
                        matchesLink.click();
                    }
                });
            }
        }
    }
    
    // Função para a tela de Matches
    async function inicializarMatches() {
        const matchesGrid = document.getElementById('matches-grid');
        if (!matchesGrid) return;
        
        matchesGrid.innerHTML = '<p class="text-center">Buscando profissionais compatíveis...</p>';

        try {
            const token = localStorage.getItem('girassol_token');
            
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
            const psychologists = responseData.results || []; 
            
            if (psychologists.length === 0) {
                const emptyState = document.getElementById('favoritos-vazio');
                if (emptyState) emptyState.classList.remove('hidden');
                matchesGrid.innerHTML = '';
                return;
            }

            const emptyState = document.getElementById('favoritos-vazio');
            if (emptyState) emptyState.classList.add('hidden');

            matchesGrid.innerHTML = psychologists.map(pro => `
                <div class="pro-card">
                    <img src="${pro.fotoUrl || 'https://placehold.co/400x400/1B4332/FFFFFF?text=CRP'}" alt="Foto de ${pro.nome}" class="pro-card-img">
                    <div class="pro-card-content" style="padding: 15px;">
                        <span class="pro-crp">CRP ${pro.crp}</span>
                        <h3>${pro.nome}</h3>
                        
                        <p class="pro-abordagem">
                            <strong>Abordagens:</strong> ${pro.abordagens_tecnicas && pro.abordagens_tecnicas.length > 0 ? pro.abordagens_tecnicas.join(', ') : 'Não informado'}
                        </p>
                        <p class="pro-especialidades">
                            <strong>Temas:</strong> ${pro.temas_atuacao && pro.temas_atuacao.length > 0 ? pro.temas_atuacao.join(', ') : 'Não informado'}
                        </p>
                        <p class="pro-valor">
                            <strong>Valor:</strong> R$ ${pro.valor_sessao_numero ? pro.valor_sessao_numero.toFixed(2).replace('.', ',') : 'Não informado'}
                        </p>
                    </div>
                    
                    <div class="pro-card-actions">
                        <a href="../perfil_psicologo.html?id=${pro.id}" class="btn btn-principal">Ver Perfil</a>
                        <button class="btn-favorito" data-id="${pro.id}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-heart"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                        </button>
                    </div>
                </div>
            `).join('');

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

        favoritosGrid.innerHTML = '<p>Carregando seus favoritos...</p>';

        try {
            const token = localStorage.getItem('girassol_token');
            const response = await fetch(`${API_BASE_URL}/api/patients/me/favorites`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Falha ao buscar favoritos.');

            const favorites = await response.json();

            if (favorites.length === 0) {
                favoritosGrid.classList.add('hidden');
                favoritosVazio.classList.remove('hidden');
            } else {
                favoritosGrid.classList.remove('hidden');
                favoritosVazio.classList.add('hidden');

                // Reutiliza a lógica de criação de card (similar a 'inicializarMatches')
                favoritosGrid.innerHTML = favorites.map(pro => `
                    <div class="pro-card">
                        <img src="${pro.fotoUrl || 'https://placehold.co/400x400/1B4332/FFFFFF?text=CRP'}" alt="Foto de ${pro.nome}" class="pro-card-img">
                        <div class="pro-card-content" style="padding: 15px; flex-grow: 1;">
                            <h3>${pro.nome}</h3>
                            <p class="crp">CRP ${pro.crp}</p>
                        </div>
                        <div class="pro-card-actions">
                            <a href="../perfil_psicologo.html?id=${pro.id}" class="btn btn-principal">Ver Perfil</a>
                            <button class="btn-favorito favorited" data-id="${pro.id}" aria-label="Desfavoritar">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-heart"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                            </button>
                        </div>
                    </div>
                `).join('');

                // Adiciona a funcionalidade de desfavoritar na própria página
                setupFavoriteButtonsInDashboard(inicializarFavoritos);
            }

        } catch (error) {
            console.error("Erro ao carregar favoritos:", error);
            favoritosGrid.innerHTML = '<p style="color: red;">Ocorreu um erro ao carregar seus favoritos.</p>';
            favoritosVazio.classList.add('hidden');
        }
    }

    // Função para a tela de "Minhas Avaliações"
    async function inicializarAvaliacoes() {
        const container = document.getElementById('reviews-list-container');
        const emptyState = document.getElementById('reviews-empty-state');
        if (!container || !emptyState) return;

        try {
            const token = localStorage.getItem('girassol_token');
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
        const favoriteButtons = document.querySelectorAll('.btn-favorito');
        favoriteButtons.forEach(button => {
            button.addEventListener('click', async () => {
                const psychologistId = button.dataset.id;
                const token = localStorage.getItem('girassol_token');

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

        // Preenche os campos com os dados atuais do paciente
        const nomeInput = document.getElementById('nome-paciente');
        const emailInput = document.getElementById('email-paciente');
        if (patientData && patientData.nome) {
            nomeInput.value = patientData.nome;
            emailInput.value = patientData.email;
        }

        // --- Lógica para atualizar dados pessoais ---
        formDados.addEventListener('submit', async (e) => {
            e.preventDefault();
            const token = localStorage.getItem('girassol_token');

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
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                showToast(error.message || 'Erro ao atualizar dados.', 'error');
            }
        });

        // --- Lógica para alterar a senha ---
        formSenha.addEventListener('submit', async (e) => {
            e.preventDefault();
            const token = localStorage.getItem('girassol_token');

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
            btnExcluir.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Abre o modal com as configurações para exclusão de conta
                openConfirmationModal({
                    title: 'Excluir sua conta?',
                    body: `
                        <p>Esta ação é <strong>permanente e não pode ser desfeita</strong>. Todos os seus dados, incluindo favoritos e avaliações, serão removidos.</p>
                        <p>Para confirmar, por favor, digite sua senha atual:</p>
                        <div class="form-group" style="margin-top: 15px;">
                            <label for="modal-password-confirm" class="sr-only">Senha Atual</label>
                            <input type="password" id="modal-password-confirm" class="form-group input" placeholder="Digite sua senha aqui" required>
                        </div>
                        <p id="modal-error-message" style="color: red; font-size: 0.9em;"></p>
                    `,
                    confirmText: 'Excluir Permanentemente',
                    onConfirm: async () => {
                        const senha = document.getElementById('modal-password-confirm').value;
                        const modalErrorMsg = document.getElementById('modal-error-message');

                        if (!senha) {
                            modalErrorMsg.textContent = 'A senha é obrigatória.';
                            return; // Não fecha o modal
                        }

                        try {
                            const token = localStorage.getItem('girassol_token');
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
                                localStorage.removeItem('girassol_token');
                                window.location.href = '../index.html';
                            } else {
                                modalErrorMsg.textContent = result.error || 'Ocorreu um erro.';
                            }
                        } catch (error) {
                            modalErrorMsg.textContent = 'Erro de conexão ao tentar excluir a conta.';
                        }
                    }
                });
            });
        }
    }

    // --- FUNÇÕES GLOBAIS PARA O MODAL ---
    const modal = document.getElementById('confirmation-modal');
    const modalConfirmBtn = document.getElementById('modal-confirm-btn');
    let onConfirmCallback = null;

    function openConfirmationModal({ title, body, confirmText, onConfirm }) {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML = body;
        modalConfirmBtn.textContent = confirmText;
        onConfirmCallback = onConfirm;
        modal.classList.add('is-visible');
        modal.setAttribute('aria-hidden', 'false');
    }

    function closeModal() {
        modal.classList.remove('is-visible');
        modal.setAttribute('aria-hidden', 'true');
        onConfirmCallback = null; // Limpa o callback
    }

    // Eventos para fechar o modal
    modal.addEventListener('click', (e) => {
        if (e.target.id === 'confirmation-modal' || e.target.id === 'modal-cancel-btn' || e.target.id === 'modal-close-btn') {
            closeModal();
        }
    });

    modalConfirmBtn.addEventListener('click', () => {
        if (onConfirmCallback) {
            onConfirmCallback();
        }
    });

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
        
        // --- LÓGICA DO MENU MOBILE ---
        if (menuToggle && sidebar) {
            menuToggle.addEventListener('click', () => {
                sidebar.classList.toggle('is-open');
            });
        }

        // --- LÓGICA DE LOGOUT ---
        // (Corrigido para usar a URL de login correta e o seletor de Sair)
        const logoutLink = document.querySelector('.sidebar-footer a[href="../index.html"]'); // ACHA O BOTÃO "SAIR"
        if (logoutLink) {
            logoutLink.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.removeItem('girassol_token'); 
                window.location.href = '../login.html'; // MANDA PARA A PÁGINA DE LOGIN (NA RAIZ)
            });
        }

        // --- ADICIONA EVENTO DE CLIQUE PARA A NAVEGAÇÃO ---
        navLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                
                const page = this.getAttribute('data-page');

                // Se for um link externo (como o do questionário), navega para a URL do 'href'
                if (!page) {
                    const externalLink = this.querySelector('a');
                    if (externalLink && externalLink.href) {
                        window.location.href = externalLink.href;
                    }
                    return;
                }

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
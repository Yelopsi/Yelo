// Aguarda o carregamento completo do documento antes de executar o script
document.addEventListener('DOMContentLoaded', () => {
    // 1. Elementos do Formulário
    const loginForm = document.getElementById('form-login');
    const emailInput = document.getElementById('email-login');
    const senhaInput = document.getElementById('senha-login');
    const mensagemEl = document.getElementById('mensagem-login');
    const btnPaciente = document.getElementById('btnPaciente');
    const btnPsicologo = document.getElementById('btnPsicologo');

    // --- LÓGICA DE PRÉ-PREENCHIMENTO (via URL) ---
    const urlParams = new URLSearchParams(window.location.search);
    const tipoUsuario = urlParams.get('tipo'); // Pega o valor de 'tipo' (ex: 'psi')
    const emailParam = urlParams.get('email'); // Pega o email

    // Preenche o e-mail se ele veio na URL
    if (emailParam) {
        emailInput.value = emailParam;
    }

    // Seleciona o botão "Sou Psicólogo(a)" se o tipo for 'psi'
    if (tipoUsuario === 'psi' && btnPsicologo && btnPaciente) {
        btnPaciente.classList.remove('active');
        btnPsicologo.classList.add('active');
    }
    // --- FIM DO BLOCO DE PRÉ-PREENCHIMENTO ---



    // --- LÓGICA PARA O NOVO SELETOR DE PERFIL ---
    let selectedRole = 'patient'; // Valor padrão

    if (btnPaciente && btnPsicologo) {
        // ... (o resto do seu código de seletor de perfil continua igual) ...
        // Adiciona um campo oculto para guardar o valor do papel selecionado
        let roleInput = loginForm.querySelector('input[name="role"]');
        if (!roleInput) {
            roleInput = document.createElement('input');
            roleInput.type = 'hidden';
            roleInput.name = 'role';
            loginForm.appendChild(roleInput);
        }
        roleInput.value = selectedRole; // Define o valor inicial

        // Atualiza o valor padrão se o pré-preenchimento já o mudou
        if (tipoUsuario === 'psi') {
            roleInput.value = 'psychologist';
            selectedRole = 'psychologist'; // <--- ADICIONE ESTA LINHA
        }

        btnPaciente.addEventListener('click', () => {
            btnPaciente.classList.add('active');
            btnPsicologo.classList.remove('active');
            selectedRole = 'patient';
            roleInput.value = selectedRole;
        });

        btnPsicologo.addEventListener('click', () => {
            btnPsicologo.classList.add('active');
            btnPaciente.classList.remove('active');
            // Garante que a variável de controle também seja atualizada
            selectedRole = 'psychologist';
            roleInput.value = selectedRole;
        });
    }

    // Função para exibir mensagens (Sucesso ou Erro)
    function showMessage(text, isError = false) {
        mensagemEl.textContent = text;
        mensagemEl.classList.remove('mensagem-oculta', 'mensagem-erro', 'mensagem-sucesso');
        mensagemEl.classList.add(isError ? 'mensagem-erro' : 'mensagem-sucesso');
        
        setTimeout(() => {
            mensagemEl.classList.add('mensagem-oculta');
        }, 5000);
    }

    // 2. Evento de Submissão do Formulário
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault(); 

            const email = emailInput.value;
            const senha = senhaInput.value;

            mensagemEl.textContent = '';
            mensagemEl.classList.add('mensagem-oculta');

            // Pega o 'selectedRole' do JS, que é mais confiável
            const role = selectedRole; 

            const apiUrl = role === 'patient'
                ? `${API_BASE_URL}/api/patients/login`
                : `${API_BASE_URL}/api/psychologists/login`;

            const dashboardPath = role === 'patient'
                ? '/patient/patient_dashboard.html'
                : '/psi/psi_dashboard.html';

            const payload = JSON.stringify({ email, senha });

            try {
                // 3. Chamada à API de Login
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: payload,
                });

                const data = await response.json();

                // 4. Tratamento da Resposta
                if (response.ok) {
                    showMessage('Login bem-sucedido! Redirecionando...', false);
                    localStorage.setItem('Yelo_token', data.token);
                    localStorage.setItem('Yelo_role', role); // <-- LINHA ADICIONADA

                    // --- INÍCIO DA CORREÇÃO ---
                    // 1. Procura por um parâmetro 'return_url' na URL
                    const urlParams = new URLSearchParams(window.location.search);
                    const returnUrl = urlParams.get('return_url');
                    // --- FIM DA CORREÇÃO ---

                    setTimeout(() => {
                        // --- CORREÇÃO 2: Verifica o 'returnUrl' PRIMEIRO ---
                        if (returnUrl) {
                            window.location.href = returnUrl; // Volta para a página de perfil
                            return;
                        }
                        // --- FIM DA CORREÇÃO 2 ---

                        if (role === 'psychologist') {
                            window.location.href = window.location.origin + dashboardPath;
                            return;
                        }

                        const savedAnswers = localStorage.getItem('Yelo_questionario_respostas');
                        if (savedAnswers) {
                            window.location.href = 'resultados.html';
                        } else {
                            window.location.href = window.location.origin + dashboardPath;
                        }
                    }, 500); 
                } else {
                    const errorMessage = data.error || 'Email ou senha inválidos. Tente novamente.';
                    showMessage(errorMessage, true);
                }
            } catch (error) {
                console.error('Erro de conexão:', error);
                showMessage('Falha na conexão com o servidor. Verifique se o backend está ligado.', true);
            }
        });
    }
});
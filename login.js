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
    // --- NOVA LÓGICA DE LOGIN UNIFICADO ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // UI: Feedback visual imediato
        const originalBtnText = loginForm.querySelector('button[type="submit"]').textContent;
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Verificando...';
        if(mensagemEl) mensagemEl.style.display = 'none';

        const email = emailInput.value.trim();
        const senha = senhaInput.value;

        // Função auxiliar para tentar o login em uma URL específica
        const attemptLogin = async (url, type) => {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, senha })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    return { success: true, data, type };
                }
                return { success: false };
            } catch (err) {
                return { success: false, error: err };
            }
        };

        try {
            // 1ª Tentativa: Tenta logar como PACIENTE
            let result = await attemptLogin(`${API_BASE_URL}/api/patients/login`, 'patient');

            // 2ª Tentativa: Se falhou, tenta como PSICÓLOGO
            if (!result.success) {
                console.log('Não é paciente, verificando registro profissional...');
                result = await attemptLogin(`${API_BASE_URL}/api/psychologists/login`, 'psychologist');
            }

            // --- RESULTADO FINAL ---
            if (result.success) {
                // SUCESSO! Salva os dados
                const { token, user } = result.data;
                localStorage.setItem('Yelo_token', token);
                localStorage.setItem('Yelo_user_type', result.type);
                if (user && user.nome) localStorage.setItem('Yelo_user_name', user.nome);

                // Feedback visual de sucesso
                if (mensagemEl) {
                    mensagemEl.textContent = 'Login realizado! Redirecionando...';
                    mensagemEl.className = 'mensagem-sucesso';
                    mensagemEl.style.display = 'block';
                }

                // Verifica se tem URL de retorno salva ou define o destino padrão
                const returnUrl = localStorage.getItem('returnUrl');
                localStorage.removeItem('returnUrl'); // Limpa após usar

                setTimeout(() => {
                    if (returnUrl) {
                        window.location.href = returnUrl;
                    } else if (result.type === 'psychologist') {
                        // Painel do Psicólogo (AJUSTE AQUI SE SUA ROTA FOR DIFERENTE)
                        window.location.href = '/psi/psi_dashboard.html'; 
                    } else {
                        // Painel do Paciente (AJUSTE AQUI SE SUA ROTA FOR DIFERENTE)
                        window.location.href = '/patient/patient_dashboard.html';
                    }
                }, 800);

            } else {
                // FALHOU NAS DUAS: Usuário ou senha incorretos
                throw new Error('E-mail ou senha incorretos.');
            }

        } catch (error) {
            console.error('Erro no login:', error);
            if (mensagemEl) {
                mensagemEl.textContent = error.message || 'Erro ao conectar. Tente novamente.';
                mensagemEl.className = 'mensagem-erro'; // Garante cor vermelha
                mensagemEl.style.display = 'block';
            }
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
    });
    }
});
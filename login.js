document.addEventListener('DOMContentLoaded', () => {
    // Garante a URL base correta (Localhost ou Produção)
    const BASE_URL = (typeof window.API_BASE_URL !== 'undefined') 
        ? window.API_BASE_URL 
        : '';

    const loginForm = document.getElementById('form-login');
    const emailInput = document.getElementById('email-login');
    const senhaInput = document.getElementById('senha-login');
    const mensagemEl = document.getElementById('mensagem-login');

    // --- LIMPEZA DE SESSÃO (LOGOUT FORÇADO) ---
    // Se o usuário acessou a página de login, limpamos qualquer sessão anterior
    localStorage.removeItem('Yelo_token');
    localStorage.removeItem('Yelo_user_type');
    localStorage.removeItem('Yelo_user_name');

    // --- CORREÇÃO DE LINKS (Remove .html para compatibilidade com rotas do servidor) ---
    // Isso impede que o clique leve para uma página 404 que redireciona para a Home
    const regLinks = document.querySelectorAll('a[href*="registrar"], a[href*="cadastro"], a[href*="registro"]');
    regLinks.forEach(link => {
        let rawHref = link.getAttribute('href');
        // AJUSTE: Redireciona para a rota '/cadastro' que está funcional
        const query = rawHref && rawHref.includes('?') ? rawHref.substring(rawHref.indexOf('?')) : '';
        link.setAttribute('href', '/cadastro' + query);
    });

    // --- LÓGICA DE REDIRECIONAMENTO (Preserva o link de volta se vier de outra página) ---
    const params = new URLSearchParams(window.location.search);
    const redirectParam = params.get('redirect');

    if (redirectParam) {
        // Atualiza links de cadastro para manter o redirect caso o usuário decida criar conta
        const registerLinks = document.querySelectorAll('a[href*="registrar"], a[href*="cadastro"], a[href*="registro"]');
        registerLinks.forEach(link => {
            if (link.href.includes('?')) link.href += `&redirect=${encodeURIComponent(redirectParam)}`;
            else link.href += `?redirect=${encodeURIComponent(redirectParam)}`;
        });
    }
    
    // --- NOVO: PREENCHIMENTO AUTOMÁTICO DE E-MAIL (PÓS-CADASTRO) ---
    const emailParam = params.get('email');
    if (emailParam && emailInput) {
        emailInput.value = emailParam;
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.textContent;
            
            // Feedback visual
            submitBtn.disabled = true;
            submitBtn.textContent = 'Autenticando...';
            if(mensagemEl) mensagemEl.style.display = 'none';
            const email = emailInput.value.trim().toLowerCase();
            const senha = senhaInput.value;

            // Função auxiliar de fetch
            const attemptLogin = async (url, type) => {
                try {
                    const response = await fetch(`${BASE_URL}${url}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, senha })
                    });

                    // Se o status for 401 ou 404, apenas retorna falha sem jogar erro
                    if (!response.ok) {
                        return { success: false };
                    }

                    const data = await response.json();
                    return { success: true, data, type };
                } catch (err) {
                    return { success: false };
                }
            };

            try {
                let result = { success: false };

                // 1ª TENTATIVA: ADMIN (No Banco de Dados)
                // Se der certo, o servidor retorna success: true
                result = await attemptLogin('/api/login-admin-check', 'admin');

                // 2ª TENTATIVA: PACIENTE (Se não for admin)
                if (!result.success) {
                    // Ajuste a rota se a sua API for diferente (ex: /api/patients/login)
                    result = await attemptLogin('/api/patients/login', 'patient');
                }

                // 3ª TENTATIVA: PSICÓLOGO (Se não for paciente)
                if (!result.success) {
                    // Ajuste a rota se a sua API for diferente
                    result = await attemptLogin('/api/psychologists/login', 'psychologist');
                }

                // --- DECISÃO FINAL ---
                if (result.success) {
                    const { token, redirect, user } = result.data;
                    
                    // Salva dados na sessão
                    if (token) localStorage.setItem('Yelo_token', token);
                    localStorage.setItem('Yelo_user_type', result.type);
                    
                    // CORREÇÃO: Pega o nome se estiver dentro de 'user' OU direto na raiz da resposta
                    const nomeSalvo = (user && user.nome) ? user.nome : result.data.nome;
                    if (nomeSalvo) localStorage.setItem('Yelo_user_name', nomeSalvo);

                    // Mensagem de sucesso
                    if (mensagemEl) {
                        if (result.type === 'patient') mensagemEl.textContent = "Bem-vindo(a), Paciente!";
                        else if (result.type === 'psychologist') mensagemEl.textContent = "Bem-vindo(a), Psi!";
                        else if (result.type === 'admin') mensagemEl.textContent = "Bem-vindo(a), Admin!";
                        mensagemEl.className = 'mensagem-sucesso';
                        mensagemEl.style.display = 'block';
                    }

                    // Redireciona
                    setTimeout(() => {
                        // Prioridade para o redirecionamento que vem do servidor (caso do Admin)
                        if (redirect) {
                            window.location.href = redirect;
                        } else if (redirectParam) {
                            // Se tiver um redirect na URL (ex: veio do perfil), volta pra lá
                            window.location.href = decodeURIComponent(redirectParam);
                        } else if (result.type === 'psychologist') {
                            window.location.href = '/psi/psi_dashboard.html'; 
                        } else {
                            window.location.href = '/patient/patient_dashboard';
                        }
                    }, 800);

                } else {
                    throw new Error('E-mail ou senha incorretos.');
                }

            } catch (error) {
                console.error(error);
                if (mensagemEl) {
                    mensagemEl.textContent = error.message;
                    mensagemEl.className = 'mensagem-erro';
                    mensagemEl.style.display = 'block';
                }
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }
        });
    }
});
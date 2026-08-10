// --- FUNÇÃO DE NOTIFICAÇÃO EM PÍLULA (TOAST) GLOBAL ---
window.showToast = function(message, type = 'success') {
    let container = document.getElementById('pill-notification-container');
    
    if (!container) {
        container = document.createElement('div');
        container.id = 'pill-notification-container';
        container.style.cssText = 'position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 999999; display: flex; flex-direction: column; gap: 10px; align-items: center; pointer-events: none;';
        document.body.appendChild(container);
    }

    const pill = document.createElement('div');
    const bgColor = type === 'success' ? '#1B4332' : '#dc2626';
    const iconHtml = type === 'success' ? '✅' : '❌';

    pill.style.cssText = `background: ${bgColor}; color: white; padding: 12px 24px; border-radius: 50px; display: flex; align-items: center; gap: 8px; font-weight: 600; box-shadow: 0 8px 20px rgba(0,0,0,0.15); font-family: sans-serif; font-size: 0.95rem; white-space: nowrap; max-width: 90vw; overflow: hidden; text-overflow: ellipsis; opacity: 0; transform: translateY(20px); transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);`;
    pill.innerHTML = `<span class="icon" style="flex-shrink: 0;">${iconHtml}</span><span style="overflow: hidden; text-overflow: ellipsis;">${message}</span>`;
    
    container.appendChild(pill);

    setTimeout(() => { pill.style.opacity = '1'; pill.style.transform = 'translateY(0)'; }, 10);
    setTimeout(() => {
        pill.style.opacity = '0'; pill.style.transform = 'translateY(20px)';
        setTimeout(() => pill.remove(), 300);
    }, 4500);
};

document.addEventListener('DOMContentLoaded', () => {
    // Garante a URL base correta (Localhost ou Produção)
    const BASE_URL = (typeof window.API_BASE_URL !== 'undefined') 
        ? window.API_BASE_URL 
        : '';

    const loginForm = document.getElementById('form-login');
    const emailInput = document.getElementById('email-login');
    const senhaInput = document.getElementById('senha-login');

    // --- LIMPEZA DE SESSÃO (LOGOUT FORÇADO) ---
    // Se o usuário acessou a página de login, limpamos qualquer sessão anterior
    localStorage.removeItem('Yelo_token');
    localStorage.removeItem('Yelo_user_type');
    localStorage.removeItem('Yelo_user_name');
    localStorage.removeItem('Yelo_token_admin');
    localStorage.removeItem('yelo_last_psi_page'); // Garante que a visão geral seja carregada após o login

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
            submitBtn.innerHTML = '<svg class="spin-anim" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px; vertical-align: middle;"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Autenticando...';
            const email = emailInput.value.trim().toLowerCase();
            const senha = senhaInput.value;

            // Função auxiliar de fetch
            const attemptLogin = async (url, fallbackType) => {
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
                    
                    // Tracking GA4
                    try {
                        if (typeof gtag === 'function') {
                            gtag('event', 'login', { method: 'email' });
                        }
                    } catch(e) {}
                    
                    return { success: true, data, fallbackType };
                } catch (err) {
                    return { success: false };
                }
            };

            try {
                let result = { success: false };

                // 1ª TENTATIVA: ADMIN (No Banco de Dados)
                // Se der certo, o servidor retorna success: true
                result = await attemptLogin('/api/admin/login', 'admin');

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
                    const { token, redirect, user, type, accountRestored } = result.data;
                    
                    // --- MIGRAÇÃO: Segurança XSS ---
                    // Em vez de salvar o JWT real (que agora vive no Cookie HttpOnly),
                    // salvamos apenas uma flag. Isso engana o código antigo do frontend
                    // fazendo-o achar que o usuário está logado, sem expor o token!
                    if (token) {
                        localStorage.setItem('Yelo_token', 'cookie_auth_active');
                    }
                    
                    const finalUserType = type || result.fallbackType;
                    localStorage.setItem('Yelo_user_type', finalUserType);
                    
                    if (finalUserType === 'admin' && token) {
                        localStorage.setItem('Yelo_token_admin', 'cookie_auth_active');
                    }

                    // Se a conta foi restaurada, salva flag para mostrar modal no dashboard
                    if (accountRestored) {
                        localStorage.setItem('Yelo_account_restored', 'true');
                    }

                    // CORREÇÃO: Pega o nome se estiver dentro de 'user' OU direto na raiz da resposta
                    let nomeSalvo = result.data.nome;
                    if (!nomeSalvo && user && user.nome) {
                        nomeSalvo = user.nome;
                    }
                    
                    if (nomeSalvo) {
                        localStorage.setItem('Yelo_user_name', nomeSalvo);
                    }
                    
                    // Salva a foto para o header
                    if (user && user.fotoUrl) {
                        localStorage.setItem('Yelo_user_photo', user.fotoUrl);
                    }

                    // Mensagem de sucesso personalizada
                    let msgBemVindo = "Bem-vindo(a)!";
                    
                    // Verifica se é o primeiro acesso neste dispositivo/browser
                    const userId = result.data.id || email;
                    const accessKey = `Yelo_has_logged_${finalUserType}_${userId}`;
                    const isFirstAccess = !localStorage.getItem(accessKey);
                    localStorage.setItem(accessKey, 'true'); // Marca que já logou
                    
                    if (finalUserType === 'patient') {
                        if (nomeSalvo) {
                            msgBemVindo = isFirstAccess ? `Bem-vindo(a), ${nomeSalvo.split(' ')[0]}!` : `Bem-vindo(a) de volta, ${nomeSalvo.split(' ')[0]}!`;
                        } else {
                            msgBemVindo = isFirstAccess ? "Bem-vindo(a), Paciente!" : "Bem-vindo(a) de volta, Paciente!";
                        }
                    } else if (finalUserType === 'psychologist') {
                        let genero = result.data.genero || (user && user.genero) || '';
                        let saudacao = "Bem-vindo(a)";
                        let saudacaoVolta = "Bem-vindo(a) de volta";
                        
                        if (genero === 'Feminino' || genero === 'Mulher Cis' || genero === 'Mulher Trans') {
                            saudacao = "Bem-vinda";
                            saudacaoVolta = "Bem-vinda de volta";
                        } else if (genero === 'Masculino' || genero === 'Homem Cis' || genero === 'Homem Trans') {
                            saudacao = "Bem-vindo";
                            saudacaoVolta = "Bem-vindo de volta";
                        } else if (genero === 'Não-binário' || genero === 'Gênero fluido') {
                            saudacao = "Boas-vindas";
                            saudacaoVolta = "Boas-vindas de volta";
                        }

                        let saudacaoFinal = isFirstAccess ? saudacao : saudacaoVolta;

                        if (nomeSalvo) {
                            msgBemVindo = `${saudacaoFinal}, ${nomeSalvo.split(' ')[0]}!`;
                        } else {
                            msgBemVindo = `${saudacaoFinal}, Psi!`;
                        }
                    } else if (finalUserType === 'admin') {
                        msgBemVindo = isFirstAccess ? "Bem-vindo(a), Admin!" : "Bem-vindo(a) de volta, Admin!";
                    }
                    
                    window.showToast(msgBemVindo, 'success');
                    // Redireciona
                    setTimeout(() => {
                        // FIX: Prioridade absoluta para Admin para evitar redirecionamentos quebrados (/admin -> /admin/login.html)
                        if (finalUserType === 'admin') {
                            window.location.href = '/admin';
                        } 
                        // Prioridade para o redirecionamento que vem do servidor (para outros usuários)
                        else if (redirect) {
                            window.location.href = redirect;
                        } else if (redirectParam) {
                            // Se tiver um redirect na URL (ex: veio do perfil), volta pra lá
                            window.location.href = decodeURIComponent(redirectParam);
                        } else if (finalUserType === 'psychologist') {
                            window.location.href = '/psi/psi_dashboard.html'; 
                        } else {
                            window.location.href = '/patient/patient_dashboard';
                        }
                    }, 800);

                } else {
                    throw new Error('E-mail ou senha incorretos.');
                }

            } catch (error) {
                window.showToast(error.message, 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }
        });
    }
});
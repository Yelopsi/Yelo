document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('form-admin-login');
    const emailInput = document.getElementById('email-login');
    const senhaInput = document.getElementById('senha-login');
    const mensagemEl = document.getElementById('mensagem-login');

    // --- FIX: LIMPEZA DE SESSÃO (PREVINE LOOP DE EXPULSÃO) ---
    // Ao acessar a tela de login, limpamos qualquer token antigo para garantir um novo acesso limpo.
    localStorage.removeItem('Yelo_token');
    localStorage.removeItem('Yelo_user_type');
    localStorage.removeItem('Yelo_user_name');

    function showMessage(text, isError = false) {
        mensagemEl.textContent = text;
        mensagemEl.className = isError ? 'mensagem-erro' : 'mensagem-sucesso';
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = emailInput.value;
        const senha = senhaInput.value;

        showMessage('Autenticando...', false);

        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, senha })
            });

            const data = await response.json();

            if (response.ok) {
                showMessage('Login bem-sucedido! Redirecionando...', false);
                localStorage.setItem('Yelo_token', data.token);
                // AJUSTE: Salva o tipo e nome do usuário para consistência do header
                localStorage.setItem('Yelo_user_type', 'admin');
                // Assumindo que a API retorna o nome do usuário em `data.user.nome`
                localStorage.setItem('Yelo_user_name', data.user?.nome || 'Admin');
                setTimeout(() => {
                    window.location.href = '/admin/';
                }, 500);
            } else {
                throw new Error(data.error || 'Credenciais inválidas.');
            }

        } catch (error) {
            console.error('Erro de login:', error);
            showMessage(error.message, true);
        }
    });
});
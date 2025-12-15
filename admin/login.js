document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('form-admin-login');
    const emailInput = document.getElementById('email-login');
    const senhaInput = document.getElementById('senha-login');
    const mensagemEl = document.getElementById('mensagem-login');

    // Se já existe um token, tenta redirecionar direto para o dashboard
    if (localStorage.getItem('girassol_token')) {
        window.location.href = 'admin.html';
    }

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
                localStorage.setItem('girassol_token', data.token);
                setTimeout(() => {
                    window.location.href = 'admin.html';
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
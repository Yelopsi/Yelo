document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-redefinir-senha');
    const novaSenhaInput = document.getElementById('nova-senha');
    const confirmarSenhaInput = document.getElementById('confirmar-nova-senha');
    const mensagemEl = document.getElementById('mensagem-redefinir-senha');

    // --- CORREÇÃO DE ROTA ---
    const BASE_URL = (typeof window.API_BASE_URL !== 'undefined') 
        ? window.API_BASE_URL 
        : 'http://localhost:3001';

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const userType = params.get('type');

    if (!token || !userType) {
        mensagemEl.textContent = 'Link de redefinição inválido ou expirado.';
        mensagemEl.className = 'mensagem-erro';
        form.style.display = 'none';
        return;
    }

    // EM: redefinir_senha.js (Adicione no bloco principal document.addEventListener)

    // Lógica para o Ícone de Visualização de Senha
    document.querySelectorAll('.password-toggle-icon').forEach(icon => {
        icon.innerHTML = '👁️'; // Placeholder visual simples. Mude para seu SVG/código CSS se necessário.
        
        icon.addEventListener('click', () => {
            const input = icon.previousElementSibling;
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.innerHTML = '👁️'; // Olho aberto
            } else {
                input.type = 'password';
                icon.innerHTML = '🙈'; // Olho fechado (Use 👁️ ou o código CSS de olho riscado)
            }
            input.focus();
        });
    });
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const novaSenha = novaSenhaInput.value;
        const confirmarSenha = confirmarSenhaInput.value;

        if (novaSenha !== confirmarSenha) {
            mensagemEl.textContent = 'As senhas não conferem.';
            mensagemEl.className = 'mensagem-erro';
            return;
        }

        const apiUrl = userType === 'patient'
            ? `${BASE_URL}/api/patients/reset-password/${token}`
            : `${BASE_URL}/api/psychologists/reset-password/${token}`;

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ senha: novaSenha })
            });

            const result = await response.json();

            if (response.ok) {
                mensagemEl.textContent = result.message + ' Redirecionando para o login...';
                mensagemEl.className = 'mensagem-sucesso';
                setTimeout(() => {
                    window.location.href = '/login';
                }, 3000);
            } else {
                mensagemEl.textContent = result.error || 'Ocorreu um erro.';
                mensagemEl.className = 'mensagem-erro';
            }
        } catch (error) {
            console.error('Erro de conexão:', error);
            mensagemEl.textContent = 'Falha na conexão com o servidor.';
            mensagemEl.className = 'mensagem-erro';
        }
    });
});
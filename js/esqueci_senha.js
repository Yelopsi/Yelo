document.addEventListener('DOMContentLoaded', () => {
    const BASE_URL = (typeof window.API_BASE_URL !== 'undefined') 
        ? window.API_BASE_URL 
        : 'http://localhost:3001';

    const form = document.getElementById('form-esqueci-senha');
    const emailInput = document.getElementById('email-recuperacao');
    const mensagemEl = document.getElementById('mensagem-esqueci-senha');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = emailInput.value;

            mensagemEl.textContent = 'Verificando e-mail...';
            mensagemEl.className = 'mensagem-sucesso';

            try {
                // 1. Identifica o tipo de usuário
                const identifyResponse = await fetch(`${BASE_URL}/api/auth/identify-user`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });

                const identifyResult = await identifyResponse.json();

                if (!identifyResponse.ok) {
                    throw new Error(identifyResult.error || 'E-mail não encontrado.');
                }

                // 2. Define a URL correta com base no tipo identificado
                const apiUrl = identifyResult.type === 'patient'
                    ? `${BASE_URL}/api/patients/forgot-password`
                    : `${BASE_URL}/api/psychologists/forgot-password`;

                mensagemEl.textContent = 'Enviando link...';

                // 3. Envia a solicitação de recuperação
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });

                const result = await response.json();

                if (response.ok) {
                    mensagemEl.textContent = result.message;
                    mensagemEl.className = 'mensagem-sucesso';
                    form.reset();
                } else {
                    mensagemEl.textContent = result.error || 'Ocorreu um erro.';
                    mensagemEl.className = 'mensagem-erro';
                }

            } catch (error) {
                console.error('Erro de conexão:', error);
                mensagemEl.textContent = error.message || 'Falha na conexão com o servidor.';
                mensagemEl.className = 'mensagem-erro';
            }
        });
    }
});
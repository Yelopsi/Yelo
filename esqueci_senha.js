document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-esqueci-senha');
    const emailInput = document.getElementById('email-recuperacao');
    const mensagemEl = document.getElementById('mensagem-esqueci-senha');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = emailInput.value;
            const userType = document.querySelector('input[name="user-type"]:checked').value;

            mensagemEl.textContent = 'Enviando...';
            mensagemEl.className = 'mensagem-sucesso';

            const apiUrl = userType === 'patient'
                ? `${API_BASE_URL}/api/patients/forgot-password`
                : `${API_BASE_URL}/api/psychologists/forgot-password`;

            try {
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
                mensagemEl.textContent = 'Falha na conexão com o servidor.';
                mensagemEl.className = 'mensagem-erro';
            }
        });
    }
});
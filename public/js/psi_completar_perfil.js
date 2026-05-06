document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-completar-perfil');
    const mensagemEl = document.getElementById('mensagem-completar-perfil');
    const crpInput = document.getElementById('crp');
    const telefoneInput = document.getElementById('telefone');

    // --- CORREÇÃO DE ROTA ---
    const BASE_URL = (typeof window.API_BASE_URL !== 'undefined') 
        ? window.API_BASE_URL 
        : 'http://localhost:3001';

    // Aplica máscaras aos inputs
    if (window.IMask) {
        IMask(crpInput, { mask: '00/000000' });
        IMask(telefoneInput, { mask: '(00) 00000-0000' });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const token = localStorage.getItem('Yelo_token');
        if (!token) {
            window.location.href = 'login.html';
            return;
        }

        const payload = {
            crp: crpInput.value,
            telefone: telefoneInput.value
        };

        try {
            const response = await fetch(`${BASE_URL}/api/psychologists/me/complete-profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (response.ok) {
                mensagemEl.textContent = 'Perfil completo! Redirecionando para o seu painel...';
                mensagemEl.className = 'mensagem-sucesso';

                setTimeout(() => {
                    window.location.href = '/psi/psi_dashboard.html';
                }, 2000);

            } else {
                mensagemEl.textContent = result.error || 'Ocorreu um erro ao salvar os dados.';
                mensagemEl.className = 'mensagem-erro';
            }

        } catch (error) {
            console.error('Erro ao completar perfil:', error);
            mensagemEl.textContent = 'Falha na conexão com o servidor.';
            mensagemEl.className = 'mensagem-erro';
        }
    });
});
document.addEventListener('DOMContentLoaded', () => {
    
    // Configuração da API
    const BASE_URL = (typeof window.API_BASE_URL !== 'undefined') 
        ? window.API_BASE_URL 
        : ''; // Usa caminho relativo por padrão

    const form = document.getElementById('form-registro');
    const msgFeedback = document.getElementById('mensagem-registro');
    const btnSubmit = form.querySelector('button[type="submit"]');

    if (!form) return;

    // --- Lógica de Mostrar/Ocultar Senha ---
    document.querySelectorAll('.btn-toggle-senha').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (input) {
                const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
                input.setAttribute('type', type);
                
                // Alterna ícone (opcional, visualmente simples por enquanto)
                btn.style.color = type === 'text' ? '#1B4332' : '#666';
            }
        });
    });

    // --- Envio do Formulário ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. Limpa erros anteriores e muda estado do botão
        msgFeedback.style.display = 'none';
        msgFeedback.textContent = '';
        msgFeedback.className = 'mensagem-oculta';
        
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Criando conta...';
        btnSubmit.style.opacity = '0.7';

        // 2. Coleta dados
        const nome = document.getElementById('nome-completo').value.trim();
        const email = document.getElementById('email').value.trim();
        const senha = document.getElementById('senha').value;
        const confirmarSenha = document.getElementById('confirmar-senha').value;
        const termos = document.getElementById('termos').checked;

        // 3. Validações Frontend Rápidas
        if (senha !== confirmarSenha) {
            mostrarErro('As senhas não coincidem.');
            restaurarBotao();
            return;
        }

        // 4. Envio para API
        try {
            const payload = {
                nome,
                email,
                senha,
                termos
            };

            const response = await fetch(`${BASE_URL}/api/patients/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erro ao realizar cadastro.');
            }

            // 5. Sucesso!
            msgFeedback.textContent = 'Conta criada com sucesso! Redirecionando...';
            msgFeedback.className = 'mensagem-sucesso';
            msgFeedback.style.display = 'block';
            
            // Redireciona para login preenchendo o email
            setTimeout(() => {
                window.location.href = '/login?email=' + encodeURIComponent(email);
            }, 1500);

        } catch (error) {
            console.error(error);
            mostrarErro(error.message);
            restaurarBotao();
        }
    });

    // Funções Auxiliares
    function mostrarErro(texto) {
        msgFeedback.textContent = texto;
        msgFeedback.className = 'mensagem-erro';
        msgFeedback.style.display = 'block';
    }

    function restaurarBotao() {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Criar Conta Gratuita';
        btnSubmit.style.opacity = '1';
    }
});
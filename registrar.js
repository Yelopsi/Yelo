// Arquivo: registrar.js (NA RAIZ)

// Adicione no topo do arquivo para funcionar o clique
window.toggleSenha = function(inputId, btn) {
    const input = document.getElementById(inputId);
    const icon = btn.querySelector('svg');

    if (input.type === 'password') {
        input.type = 'text'; // Mostra senha
        // Muda ícone para "olho riscado"
        icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M1 1l22 22"></path><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path>';
        btn.style.color = '#1B4332';
    } else {
        input.type = 'password'; // Esconde senha
        // Volta ícone para "olho normal"
        icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
        btn.style.color = '#666';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Configuração da API
    const BASE_URL = (typeof window.API_BASE_URL !== 'undefined') 
        ? window.API_BASE_URL 
        : 'https://yelo.onrender.com';
    
    // Tenta pelo ID, mas faz fallback para tag 'form' se não achar (garante que funcione)
    let formRegistro = document.getElementById('form-registro');
    if (!formRegistro) {
        formRegistro = document.querySelector('form');
    }

    const mensagemRegistro = document.getElementById('mensagem-registro');
    const btnSubmit = formRegistro ? formRegistro.querySelector('button[type="submit"]') : null;

    if (!formRegistro) {
        console.error("Formulário não encontrado. O script não pode interceptar o envio.");
        return;
    }

    formRegistro.addEventListener('submit', async (event) => {
        event.preventDefault(); 

        // UI Feedback
        if (mensagemRegistro) {
            mensagemRegistro.textContent = '';
            mensagemRegistro.style.display = 'none';
        }

        if(btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.textContent = 'Criando conta...';
            btnSubmit.style.opacity = '0.7';
        }

        // 1. Coleta dados (IDs batendo com o cadastro.ejs)
        const nome = document.getElementById('nome-completo').value.trim();
        const email = document.getElementById('email').value.trim();
        const senha = document.getElementById('senha').value;
        const confirmarSenha = document.getElementById('confirmar-senha').value;

        // 2. Validações
        if (senha !== confirmarSenha) {
            mostrarErro('As senhas não coincidem.');
            restaurarBotao();
            return;
        }

        if (senha.length < 6) {
            mostrarErro('A senha deve ter no mínimo 6 caracteres.');
            restaurarBotao();
            return;
        }

        // 3. Objeto de dados (Payload)
        const dadosPaciente = {
            nome: nome,
            email: email,
            senha: senha
            // Adicione outros campos se o seu backend exigir
        };

        try {
            // 4. Envio para a API de PACIENTES
            const response = await fetch(`${BASE_URL}/api/patients/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dadosPaciente)
            });

            const result = await response.json();

            // 5. Sucesso
            if (response.ok) { 
                if (mensagemRegistro) {
                    mensagemRegistro.textContent = "Conta criada! Entrando...";
                    mensagemRegistro.className = 'mensagem-sucesso';
                    mensagemRegistro.style.color = ''; // Remove cor inline antiga se houver
                    mensagemRegistro.style.display = 'block';
                }

                // Tenta login automático
                try {
                    const loginRes = await fetch(`${BASE_URL}/api/patients/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, senha })
                    });

                    if (loginRes.ok) {
                        const loginData = await loginRes.json();
                        
                        if (loginData.token) localStorage.setItem('Yelo_token', loginData.token);
                        localStorage.setItem('Yelo_user_type', 'patient');
                        
                        // CORREÇÃO: Garante que o nome seja salvo (da API ou do formulário)
                        const nomeSalvo = (loginData.user && loginData.user.nome) ? loginData.user.nome : nome;
                        localStorage.setItem('Yelo_user_name', nomeSalvo);

                        const params = new URLSearchParams(window.location.search);
                        const redirectParam = params.get('redirect');
                        
                        setTimeout(() => {
                            if (redirectParam) {
                                window.location.href = decodeURIComponent(redirectParam);
                            } else {
                                window.location.href = '/patient/patient_dashboard';
                            }
                        }, 1000);
                        return;
                    }
                } catch (e) {
                    console.warn("Login automático falhou:", e);
                }

                // Fallback: Redireciona para login se o automático falhar
                setTimeout(() => {
                    const params = new URLSearchParams(window.location.search);
                    const redirectParam = params.get('redirect');
                    let target = '/login';
                    if (redirectParam) target += `?redirect=${encodeURIComponent(redirectParam)}`;
                    window.location.href = target; 
                }, 1500);

            } else {
                // 6. Erro do Backend (Ex: Email já existe)
                mostrarErro(result.error || 'Erro ao criar conta.');
                restaurarBotao();
            }

        } catch (error) {
            console.error('Erro de conexão:', error);
            mostrarErro('Erro de conexão com o servidor. Tente novamente.');
            restaurarBotao();
        }
    });

    function mostrarErro(texto) {
        if (mensagemRegistro) {
            mensagemRegistro.textContent = texto;
            mensagemRegistro.className = 'mensagem-erro';
            mensagemRegistro.style.color = ''; // Remove cor inline antiga se houver
            mensagemRegistro.style.display = 'block';
        } else {
            alert(texto);
        }
    }

    function restaurarBotao() {
        if(btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Criar Conta Gratuita';
            btnSubmit.style.opacity = '1';
        }
    }
});
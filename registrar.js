// Lógica para registrar um novo paciente usando a API REST
document.addEventListener('DOMContentLoaded', () => {

    // --- CORREÇÃO DE ROTA (GPS) ---
    // Tenta pegar a variável global do config.js. 
    // Se ela não existir, usa o endereço oficial do Render como garantia.
    const BASE_URL = window.API_BASE_URL || 'https://yelo.onrender.com';
    
    console.log('🔗 Conectando API em:', BASE_URL);

    // Encontra o formulário e a área de mensagens usando os IDs do HTML
    const formRegistro = document.getElementById('form-registro');
    const mensagemRegistro = document.getElementById('mensagem-registro');

    // Se o formulário não existir nesta página, não faz nada.
    if (!formRegistro) {
        return;
    }

    formRegistro.addEventListener('submit', async (event) => {
        
        event.preventDefault(); // Impede o recarregamento da página

        // Limpa a mensagem anterior e prepara o estilo
        mensagemRegistro.textContent = '';
        mensagemRegistro.style.color = 'black'; 

        // 1. Coleta os dados APENAS dos inputs que existem no HTML
        const nome = document.getElementById('nome-completo').value;
        const email = document.getElementById('email').value;
        const senha = document.getElementById('senha').value;
        const confirmarSenha = document.getElementById('confirmar-senha').value;
        
        // 2. Validação de senhas no Front-end (Essencial)
        if (senha !== confirmarSenha) {
            mensagemRegistro.textContent = 'As senhas não conferem. Verifique.';
            mensagemRegistro.style.color = 'red';
            return; // Interrompe a submissão
        }

        // 3. Objeto de dados pronto para o Backend. 
        // O campo 'telefone' será implicitamente NULL/vazio no banco.
        const dadosPaciente = {
            nome: nome,
            email: email,
            senha: senha
        };

        try {
            // 4. Chamada à API (endpoint de registro no localhost:3001)
            const response = await fetch(`${BASE_URL}/api/patients/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json' // Indica que o corpo é JSON
                },
                body: JSON.stringify(dadosPaciente) // Envia os dados
            });

            // 5. Recebe e interpreta a resposta do servidor
            const result = await response.json();

            // 6. Trata a Resposta: Sucesso (Status 201)
            if (response.ok) { 
                mensagemRegistro.textContent = result.message + " Redirecionando para o login...";
                mensagemRegistro.style.color = 'green';

                formRegistro.reset(); // Limpa o formulário

                // Redireciona para o login após 2 segundos
                setTimeout(() => {
                    window.location.href = 'login.html'; 
                }, 2000);

            } else {
                // 7. Trata a Resposta: Erro (Ex: Status 409 Conflict - Email já existe)
                // Exibe a mensagem de erro que veio do seu backend
                mensagemRegistro.textContent = result.error;
                mensagemRegistro.style.color = 'red';
            }

        } catch (error) {
            // 8. Trata Erros de Rede (Servidor Desligado, etc.)
            console.error('Erro de conexão com a API:', error);
            mensagemRegistro.textContent = 'Erro ao conectar com o servidor. Verifique se o backend está rodando.';
            mensagemRegistro.style.color = 'red';
        }
    });
});

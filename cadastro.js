// Arquivo: cadastro.js (VERSÃO SIMPLIFICADA - RAIZ)

document.addEventListener('DOMContentLoaded', () => {
    
    // Configuração da API
    const BASE_URL = (typeof window.API_BASE_URL !== 'undefined') 
        ? window.API_BASE_URL 
        : 'https://yelo.onrender.com';

    const form = document.getElementById('form-cadastro-psi');
    const msgErro = document.getElementById('mensagem-erro');
    const btnSubmit = form.querySelector('button[type="submit"]');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. Limpa erros anteriores e muda estado do botão
        msgErro.style.display = 'none';
        msgErro.textContent = '';
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Criando conta...';
        btnSubmit.style.opacity = '0.7';

        // 2. Coleta dados
        const nome = document.getElementById('nome').value.trim();
        const email = document.getElementById('email').value.trim();
        const documento = document.getElementById('documento').value.replace(/\D/g, ''); // Remove pontos
        const crp = document.getElementById('crp').value.trim();
        const senha = document.getElementById('senha').value;
        const confirmarSenha = document.getElementById('confirmar-senha').value;

        // 3. Validações Frontend Rápidas
        if (senha !== confirmarSenha) {
            mostrarErro('As senhas não coincidem.');
            restaurarBotao();
            return;
        }

        if (documento.length !== 11 && documento.length !== 14) {
            mostrarErro('Documento inválido. Digite um CPF (11 dígitos) ou CNPJ (14 dígitos).');
            restaurarBotao();
            return;
        }

        // 4. Envio para API
        try {
            const payload = {
                nome,
                email,
                senha,
                documento, // Backend espera "documento" (que vira cpf ou cnpj)
                crp,
                // Campos padrão para não quebrar o banco
                genero_identidade: 'Não informado',
                valor_sessao_faixa: 'Sob Consulta'
            };

            const response = await fetch(`${BASE_URL}/api/psychologists/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erro ao realizar cadastro.');
            }

            // 5. Sucesso!
            alert('Cadastro realizado com sucesso! Faça login para completar seu perfil.');
            window.location.href = '/login';

        } catch (error) {
            console.error(error);
            mostrarErro(error.message);
            restaurarBotao();
        }
    });

    // Funções Auxiliares
    function mostrarErro(texto) {
        msgErro.textContent = texto;
        msgErro.style.display = 'block';
    }

    function restaurarBotao() {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Criar Conta Profissional';
        btnSubmit.style.opacity = '1';
    }
});
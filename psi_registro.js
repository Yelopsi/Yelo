// Arquivo: psi_registro.js (COM MODO ADMIN)
document.addEventListener('DOMContentLoaded', () => {

    // --- CORREÇÃO DE ROTA ---
    // Pega do config.js ou assume localhost:3001
    const BASE_URL = (typeof window.API_BASE_URL !== 'undefined') 
        ? window.API_BASE_URL 
        : 'http://localhost:3001';

    // --- PRÉ-PREENCHIMENTO E MODO ADMIN ---
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token'); 
    const modeParam = params.get('mode'); 

    // --- MÁSCARAS DE INPUT ---
    const crpInput = document.getElementById('crp');
    const docInput = document.getElementById('documento');
    const docFeedback = document.getElementById('doc-feedback');
    const emailInput = document.getElementById('email'); 

    // --- NOVO TRECHO (Copie e cole no lugar do antigo) ---

    // 1. Tenta recuperar respostas salvas no navegador (LocalStorage)
    let storedAnswers = {};
    try {
        const rawData = localStorage.getItem('psi_questionario_respostas');
        if (rawData) storedAnswers = JSON.parse(rawData);
    } catch (e) { console.warn("Sem dados prévios."); }

    // 2. Define o valor final (Prioridade: URL > LocalStorage > Vazio)
    const finalNome = params.get('nome') || params.get('nome-completo') || storedAnswers.nome || '';
    const finalEmail = params.get('email') || storedAnswers.email || '';
    const finalCrp = params.get('crp') || storedAnswers.crp || '';

    // 3. Aplica nos campos do formulário
    const nomeInput = document.getElementById('nome-completo');
    if (nomeInput && finalNome) nomeInput.value = finalNome;

    if (emailInput && finalEmail) emailInput.value = finalEmail;

    if (crpInput && finalCrp) {
        crpInput.value = finalCrp;
        // Se usar IMask, atualize o valor interno também
        if (typeof crpInput.updateValue === 'function') crpInput.updateValue(); 
    }

    // --- LIMPEZA DE URL (SEGURANÇA E ESTÉTICA) ---
    // Remove os dados visíveis da barra de endereço sem recarregar a página
    if (params.get('nome') || params.get('nome-completo') || params.get('email') || params.get('crp')) {
        const newUrl = window.location.pathname + (modeParam ? '?mode=' + modeParam : '');
        window.history.replaceState({}, document.title, newUrl);
    }

    if (crpInput && window.IMask) {
        IMask(crpInput, { mask: '00/000000' });
    }

    let docMask; // Declara a variável da máscara
    if(docInput) {
        const maskOptions = {
            mask: [
                { mask: '000.000.000-00', maxLength: 11 }, // CPF
                { mask: '00.000.000/0000-00' }             // CNPJ
            ],
            dispatch: function (appended, dynamicMasked) {
                const number = (dynamicMasked.value + appended).replace(/\D/g, '');
                // Se tiver mais de 11 dígitos, muda para CNPJ automaticamente
                return dynamicMasked.compiledMasks[number.length > 11 ? 1 : 0];
            }
        };

        docMask = IMask(docInput, maskOptions);

        // Escuta a digitação para mostrar o feedback
        docInput.addEventListener('input', function() {
            const cleanVal = docMask.unmaskedValue;
            
            if (cleanVal.length === 11) {
                docFeedback.style.display = 'block';
                docFeedback.innerText = "✓ Pessoa Física (CPF)";
            } else if (cleanVal.length === 14) {
                docFeedback.style.display = 'block';
                docFeedback.innerText = "✓ Pessoa Jurídica (CNPJ)";
            } else {
                docFeedback.style.display = 'none';
            }
        });
    }

    // --- LÓGICA DO FORMULÁRIO ---
    const formRegistro = document.getElementById('form-registro-psi');
    const mensagemRegistro = document.getElementById('mensagem-registro-psi');

    if (!formRegistro) return;

    if (typeof setupPasswordToggles === 'function') {
        setupPasswordToggles();
    }

    formRegistro.addEventListener('submit', async (event) => {
        event.preventDefault();
        mensagemRegistro.textContent = '';
        mensagemRegistro.className = 'mensagem-oculta';

        const senha = document.getElementById('senha').value;
        const confirmarSenha = document.getElementById('confirmar-senha').value;
        const cleanDoc = docMask.unmaskedValue;
        const docType = cleanDoc.length > 11 ? 'CNPJ' : 'CPF';
        const termosAceite = document.getElementById('termos-aceite').checked;

        if (senha !== confirmarSenha) { mensagemRegistro.textContent = 'As senhas não conferem.'; mensagemRegistro.className = 'mensagem-erro'; return; }
        if (senha.length < 6) { mensagemRegistro.textContent = 'A senha deve ter no mínimo 6 caracteres.'; mensagemRegistro.className = 'mensagem-erro'; return; }
        // Validação simples para CPF ou CNPJ
        if (cleanDoc.length !== 11 && cleanDoc.length !== 14) { mensagemRegistro.textContent = 'CPF ou CNPJ inválido.'; mensagemRegistro.className = 'mensagem-erro'; return; }
        if (!termosAceite) { mensagemRegistro.textContent = 'Você deve aceitar os termos.'; mensagemRegistro.className = 'mensagem-erro'; return; }

        // --- CORREÇÃO DO PERFIL (ADMIN vs NORMAL) ---
        let storedAnswers = {};

        if (modeParam === 'admin') {
            console.log("Modo Admin detectado: Usando dados padrão.");
            // Cria dados fictícios para passar na validação do backend
            storedAnswers = {
                genero_identidade: 'Prefiro não informar',
                valor_sessao_faixa: 'A combinar',
                temas_atuacao: ['Cadastro Administrativo'],
                abordagens_tecnicas: ['Não especificado'],
                praticas_vivencias: [],
                modalidade: 'Online'
            };
        } else {
            // Fluxo normal: pega do localStorage
            storedAnswers = JSON.parse(localStorage.getItem('psi_questionario_respostas') || '{}');
        }

        const registrationData = {
            nome: document.getElementById('nome-completo').value,
            crp: crpInput.value,
            documento: docInput.value, // Manda o valor com máscara, como solicitado
            tipo_documento: docType, // Manda qual é o tipo
            email: emailInput.value,
            senha: senha,
            invitationToken: tokenParam
        };

        const dadosPsicologo = { ...storedAnswers, ...registrationData };

        try {
            const response = await fetch(`${BASE_URL}/api/psychologists/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dadosPsicologo)
            });
            const result = await response.json();

            if (response.ok) {
                // Se não for admin, limpa o cache. Se for admin, não precisa limpar nada.
                if (modeParam !== 'admin') {
                    localStorage.removeItem('psi_questionario_respostas');
                }
                
                // Não faz login automático se for admin criando conta pra outro
                if (modeParam === 'admin') {
                     mensagemRegistro.textContent = "Cadastro Administrativo realizado com sucesso!";
                     mensagemRegistro.className = 'mensagem-sucesso';
                     formRegistro.reset(); // Limpa o formulário para o próximo
                } else {
                    localStorage.setItem('login_prefetch_email', registrationData.email);
                    localStorage.setItem('login_prefetch_role', 'psychologist');
                    mensagemRegistro.textContent = result.message + " Redirecionando...";
                    mensagemRegistro.className = 'mensagem-sucesso';
                    setTimeout(() => { 
                        window.location.href = `login.html?email=${encodeURIComponent(registrationData.email)}&tipo=psi`; 
                    }, 2000);
                }

            } else {
                mensagemRegistro.textContent = result.error;
                mensagemRegistro.className = 'mensagem-erro';
            }
        } catch (error) {
            console.error('Erro de conexão ou script:', error);
            mensagemRegistro.textContent = 'Erro ao conectar com o servidor.';
            mensagemRegistro.className = 'mensagem-erro';
        }
    });    
});
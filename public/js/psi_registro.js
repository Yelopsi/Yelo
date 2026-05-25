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
    const telefoneInput = document.getElementById('telefone'); 

    // --- NOVO TRECHO (Copie e cole no lugar do antigo) ---

    // 1. Tenta recuperar respostas salvas no navegador (LocalStorage)
    let storedAnswers = {};
    try {
        const rawData = localStorage.getItem('psi_questionario_respostas');
        if (rawData) storedAnswers = JSON.parse(rawData);
    } catch (e) { }

    // BLOQUEIO: Se não for admin e não tiver preenchido o questionário, redireciona
    if (modeParam !== 'admin' && (!storedAnswers || Object.keys(storedAnswers).length === 0)) {
        createBlockingModal(
            "Etapa Necessária",
            "Para realizar o cadastro, é necessário preencher o questionário de perfil profissional antes.",
            "/psi_questionario.html"
        );
        return;
    }

    // 2. Define o valor final (Prioridade: URL > LocalStorage > Vazio)
    const finalNome = params.get('nome') || params.get('nome-completo') || storedAnswers.nome || '';
    const finalEmail = params.get('email') || storedAnswers.email || '';
    const finalCrp = params.get('crp') || storedAnswers.crp || '';
    const finalTelefone = params.get('telefone') || storedAnswers.telefone || '';

    // 3. Aplica nos campos do formulário
    const nomeInput = document.getElementById('nome-completo');
    if (nomeInput && finalNome) nomeInput.value = finalNome;

    if (emailInput && finalEmail) emailInput.value = finalEmail;

    if (crpInput && finalCrp) {
        crpInput.value = finalCrp;
        // Se usar IMask, atualize o valor interno também
        if (typeof crpInput.updateValue === 'function') crpInput.updateValue(); 
    }

    if (telefoneInput && finalTelefone) telefoneInput.value = finalTelefone;

    // --- LIMPEZA DE URL (SEGURANÇA E ESTÉTICA) ---
    // Remove os dados visíveis da barra de endereço sem recarregar a página
    if (params.get('nome') || params.get('nome-completo') || params.get('email') || params.get('crp') || params.get('telefone')) {
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
                { mask: '00.000.000/0000-00' } // CNPJ
            ],
            dispatch: function (appended, dynamicMasked) {
                const number = (dynamicMasked.value + appended).replace(/\D/g, '');
                // Se tiver mais de 11 dígitos, muda para CNPJ automaticamente
                return dynamicMasked.compiledMasks[number.length > 11 ? 1 : 0];
            }
        };

        // Só aplica a máscara se a biblioteca carregou (Modo Offline Seguro)
        if (typeof IMask !== 'undefined') {
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
        
        const btnSubmit = formRegistro.querySelector('button[type="submit"]');
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.textContent = 'Processando...';
        }

        mensagemRegistro.textContent = '';
        mensagemRegistro.className = 'mensagem-oculta';

        const senha = document.getElementById('senha').value;
        const confirmarSenha = document.getElementById('confirmar-senha').value;
        
        // --- FIX: Verifica se os campos existem antes de acessar ---
        let cleanDoc = '';
        let docType = 'CPF';
        
        if (docInput) {
            // Pega o valor limpo da máscara OU o valor bruto se a máscara falhou/não existe
            cleanDoc = docMask ? docMask.unmaskedValue : docInput.value.replace(/\D/g, '');
            docType = cleanDoc.length > 11 ? 'CNPJ' : 'CPF';
            
            // Validação simples para CPF ou CNPJ (apenas se o campo existir)
            if (cleanDoc.length !== 11 && cleanDoc.length !== 14) { 
                mensagemRegistro.textContent = 'CPF ou CNPJ inválido.'; 
                mensagemRegistro.className = 'mensagem-erro'; 
                if(btnSubmit) { btnSubmit.disabled = false; btnSubmit.textContent = 'Registrar'; }
                return; 
            }
        }

        if (senha !== confirmarSenha) { 
            mensagemRegistro.textContent = 'As senhas não conferem.'; 
            mensagemRegistro.className = 'mensagem-erro'; 
            if(btnSubmit) { btnSubmit.disabled = false; btnSubmit.textContent = 'Registrar'; }
            return; 
        }
        
        const senhaRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
        if (!senhaRegex.test(senha)) { 
            mensagemRegistro.textContent = 'A senha deve ter no mínimo 8 caracteres, incluindo uma letra maiúscula, um número e um caractere especial.'; 
            mensagemRegistro.className = 'mensagem-erro'; 
            if(btnSubmit) { btnSubmit.disabled = false; btnSubmit.textContent = 'Registrar'; }
            return; 
        }
        
        // --- CORREÇÃO DO PERFIL (ADMIN vs NORMAL) ---
        let storedAnswers = {};

        if (modeParam === 'admin') {
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

        // Gera um ID único para o evento (desduplicação do Meta Pixel + CAPI)
        const metaEventId = 'evt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

        const registrationData = {
            nome: document.getElementById('nome-completo').value,
            crp: crpInput ? crpInput.value : '',
            telefone: telefoneInput ? telefoneInput.value : '',
            documento: docInput ? docInput.value : '', // Manda o valor com máscara, como solicitado
            tipo_documento: docType, // Manda qual é o tipo
            email: emailInput.value.trim().toLowerCase(),
            senha: senha,
            invitationToken: tokenParam,
            meta_event_id: metaEventId
        };

        // Se usou conta Google
        if (window.googleRegisterToken) registrationData.googleToken = window.googleRegisterToken;

        const dadosPsicologo = { ...storedAnswers, ...registrationData };
        
        // --- DEBUG: VERIFICAÇÃO DE DADOS ---

        try {
            const response = await fetch(`${BASE_URL}/api/psychologists/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dadosPsicologo)
            });
            const result = await response.json();

            // --- DEBUG: RESPOSTA DO SERVIDOR ---

            if (response.ok) {
                // Se não for admin, limpa o cache. Se for admin, não precisa limpar nada.
                if (modeParam !== 'admin') {
                    localStorage.removeItem('psi_questionario_respostas');
                }
                
                // Pega o valor do e-mail que o usuário digitou no formulário (SANITIZADO)
                const emailDigitado = emailInput.value.trim().toLowerCase();

                if (typeof showToast === 'function') {
                    showToast('Cadastro realizado!', 'success');
                } else {
                    mensagemRegistro.textContent = 'Cadastro realizado!';
                    mensagemRegistro.className = 'mensagem-sucesso';
                }

                // --- EVENTO DE CADASTRO DO META PIXEL ---
                if (typeof fbq === 'function') {
                    fbq('track', 'CompleteRegistration', {}, { eventID: metaEventId });
                }

                setTimeout(() => { 
                    // MUDANÇA AQUI: Passamos o e-mail na URL
                    window.location.href = `/login?email=${encodeURIComponent(emailDigitado)}`;
                }, 1500);

            } else if (response.status === 409) {
                // --- LÓGICA DE RETOMADA ---
                const msg = "Que bom te ver de volta! Identificamos que você já possui cadastro. Redirecionando para o login...";
                if (typeof showToast === 'function') showToast(msg, 'info');
                else { mensagemRegistro.textContent = msg; mensagemRegistro.className = 'mensagem-sucesso'; }
                
                setTimeout(() => {
                    window.location.href = `/login?email=${encodeURIComponent(emailInput.value.trim())}`;
                }, 2000);
            } else {
                mensagemRegistro.textContent = result.error;
                mensagemRegistro.className = 'mensagem-erro';
                if(btnSubmit) { btnSubmit.disabled = false; btnSubmit.textContent = 'Registrar'; }
            }
        } catch (error) {
            mensagemRegistro.textContent = 'Erro ao conectar com o servidor.';
            mensagemRegistro.className = 'mensagem-erro';
            if(btnSubmit) { btnSubmit.disabled = false; btnSubmit.textContent = 'Registrar'; }
        }
    });    

    // Função para criar Modal de Bloqueio (Estilo Yelo)
    function createBlockingModal(title, message, redirectUrl) {
        const overlay = document.createElement('div');
        overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter: blur(3px); animation: modalOverlayFade 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;";
        
        const modal = document.createElement('div');
        modal.style.cssText = "background:white; padding:30px; border-radius:16px; width:90%; max-width:400px; text-align:center; box-shadow:0 20px 40px rgba(0,0,0,0.2); font-family: 'Inter', sans-serif; animation: modalContentPop 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;";
        
        modal.innerHTML = `
            <div style="font-size:3rem; margin-bottom:15px;">⚠️</div>
            <h3 style="color:#1B4332; margin:0 0 10px 0; font-size:1.5rem;">${title}</h3>
            <p style="color:#555; font-size:1rem; line-height:1.5; margin-bottom:25px;">${message}</p>
            <button id="btn-block-redirect" style="background:#1B4332; color:white; border:none; padding:12px 30px; border-radius:50px; font-weight:bold; font-size:1rem; cursor:pointer; width:100%; transition: transform 0.2s;">Entendi</button>
        `;
        
        const style = document.createElement('style');
        style.innerHTML = `@keyframes modalOverlayFade { from { opacity: 0; backdrop-filter: blur(0px); } to { opacity: 1; backdrop-filter: blur(3px); } } @keyframes modalContentPop { from { opacity: 0; transform: translateY(30px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }`;
        document.head.appendChild(style);

        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        document.getElementById('btn-block-redirect').onclick = () => window.location.href = redirectUrl;
    }
});
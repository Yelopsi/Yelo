// Arquivo: professionals.js (COMPLETO E CORRIGIDO)

document.addEventListener('DOMContentLoaded', () => {

    // --- CORREÇÃO DE ROTA ---
    // Pega do config.js ou detecta automaticamente o ambiente
    const BASE_URL = (typeof window.API_BASE_URL !== 'undefined') 
        ? window.API_BASE_URL 
        : (window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1'))
            ? 'http://localhost:3001'
            : window.location.origin;

    // --- FORÇAR COR DA BARRA DO NAVEGADOR (MOBILE) ---
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
        metaThemeColor.setAttribute('content', '#1B4332');
    } else {
        const meta = document.createElement('meta');
        meta.name = "theme-color";
        meta.content = "#1B4332";
        document.head.appendChild(meta);
    }
    document.documentElement.style.backgroundColor = '#1B4332';

    // --- CAPTURA DE UTMS DA URL E GLOBAL ---
    const urlParams = new URLSearchParams(window.location.search);
    const globalUtms = JSON.parse(localStorage.getItem('yelo_global_utms') || '{}');
    const utms = {
        utm_source: urlParams.get('utm_source') || globalUtms.utm_source || '',
        utm_medium: urlParams.get('utm_medium') || globalUtms.utm_medium || '',
        utm_campaign: urlParams.get('utm_campaign') || globalUtms.utm_campaign || ''
    };

    // Estrutura de dados extraída para o módulo de configuração
    const questions = window.ProfissionaisConfig.getQuestions();

    let currentStep = 0;
    const userAnswers = {};
    const slidesContainer = document.querySelector('.slides-container');
    const progressBarFill = document.querySelector('.progress-bar-fill');
    const totalQuestions = questions.filter(q => !['welcome', 'info', 'loading', 'approved', 'waitlisted', 'error', 'cep'].includes(q.type)).length;

    // Esta é a função COMPLETA que estava faltando
    function createSlideHTML(questionData, index) {
        let contentHTML = '', navHTML = '';
        const isFirstInteractiveStep = questions.findIndex(q => !['welcome', 'info', 'error'].includes(q.type)) === index;

        switch (questionData.type) {
            case 'lead-capture':
                contentHTML = `
                    <div class="form-group-questionario" style="margin-bottom: 20px;">
                        <input type="text" id="input-nome" class="text-input" placeholder=" " required>
                        <label for="input-nome" class="input-label">Nome Completo</label>
                    </div>
                    <div class="form-group-questionario" style="margin-bottom: 20px;">
                        <input type="tel" id="input-telefone" class="text-input" placeholder=" " required inputmode="numeric">
                        <label for="input-telefone" class="input-label">WhatsApp (com DDD)</label>
                    </div>
                    <div class="form-group-questionario" style="margin-bottom: 20px;">
                        <input type="email" id="input-email" class="text-input" placeholder=" " required>
                        <label for="input-email" class="input-label">Melhor E-mail</label>
                    </div>`;
                break;
            case 'text': case 'email': {
                const inputMode = questionData.inputMode ? `inputmode="${questionData.inputMode}"` : '';
                contentHTML = `
                    <div class="form-group-questionario">
                        <input type="${questionData.type}" id="input-${questionData.id}" class="text-input" placeholder=" " required ${inputMode}>
                        <label for="input-${questionData.id}" class="input-label">${questionData.placeholder}</label>
                    </div>`;
                
                if (questionData.footerLink) {
                    contentHTML += `<div style="margin-top: 15px; text-align: center;">
                        <a href="${questionData.footerLink.url}" style="color: rgba(255,255,255,0.6); font-size: 0.9rem; text-decoration: underline; transition: color 0.2s;">${questionData.footerLink.text}</a>
                    </div>`;
                }
                break;
            }
            case 'choice': case 'multiple-choice': {
                const choicesClass = questionData.scrollable ? 'options-grid scrollable' : 'options-grid';
                const buttonClass = `choice-button ${questionData.type === 'multiple-choice' ? 'multi-choice' : ''}`;
                contentHTML = `<div class="${choicesClass}">${questionData.choices.map(choice => `<button class="${buttonClass}" data-value="${choice}">${choice}</button>`).join('')}</div>`;
                break;
            }
            case 'approved':
                // O conteúdo foi removido, pois o redirecionamento será direto.
                break;
            case 'loading':
                contentHTML = '<div class="loader-wrapper"><div class="loader-spinner"></div></div>';
                break;
            case 'waitlisted':
                // Sem input de e-mail agora, pois já o capturamos na tela 1
                contentHTML = ``;
                break;
            case 'welcome': case 'info': case 'error':
                break;
            default:
                contentHTML = `<p>Tipo de pergunta não reconhecido: ${questionData.type}</p>`;
        }

        const backButtonHTML = !isFirstInteractiveStep && !['welcome', 'info', 'loading', 'approved', 'waitlisted', 'error'].includes(questionData.type) ? `<button class="back-button">← Voltar</button>` : '';

        let nextButtonHTML = '';
        if (['welcome', 'info', 'text', 'email', 'multiple-choice', 'lead-capture'].includes(questionData.type)) {
            const buttonText = questionData.buttonText || "Avançar";
            const action = questionData.buttonText ? "check" : "next";
            nextButtonHTML = `<button class="cta-button" data-action="${action}">${buttonText}</button>`;
        } else if (questionData.type === 'approved') {
            nextButtonHTML = `<button class="cta-button" data-action="submit-validation">Finalizar Cadastro</button>`;
        } else if (questionData.type === 'waitlisted') {
            nextButtonHTML = `<button class="cta-button" data-action="submit-waitlist">${questionData.buttonText}</button>`;
        } else if (questionData.type === 'error') {
            nextButtonHTML = `<button class="cta-button" data-action="restart">${questionData.buttonText}</button>`;
        }

        const navClass = backButtonHTML ? '' : 'single-button';
        if (backButtonHTML || nextButtonHTML) {
            navHTML = `<div class="navigation-buttons ${navClass}">${backButtonHTML}${nextButtonHTML}</div>`;
        }

        return `
            <div class="slide" id="slide-${questionData.id}" data-index="${index}">
                <div class="slide-header"><h1>${questionData.question || ''}</h1><p class="subtitle">${questionData.subtitle || ''}</p></div>
                <div class="slide-body">${contentHTML}</div>
                ${navHTML}
            </div>`;
    }

    function updateProgressBar() {
        const questionIndex = questions.slice(0, currentStep + 1).filter(q => !['welcome', 'info', 'loading', 'approved', 'waitlisted', 'error'].includes(q.type)).length;
        const progress = Math.max(0, (questionIndex / totalQuestions) * 100);
        progressBarFill.style.width = `${progress}%`;
    }

    // NOVA FUNÇÃO: Verifica o estado dos inputs e habilita/desabilita o botão de avançar
    function checkNextButtonState(slide) {
        const nextButton = slide.querySelector('[data-action="next"], [data-action="check"]');
        if (!nextButton) return;
    
        // Validação Múltipla para o slide de Captura
        if (slide.querySelector('#input-nome') && slide.querySelector('#input-telefone') && slide.querySelector('#input-email')) {
            const nomeVal = slide.querySelector('#input-nome').value.trim();
            const telVal = slide.querySelector('#input-telefone').value.replace(/\D/g, '');
            const emailVal = slide.querySelector('#input-email').value.trim();
            
            const isNomeValid = nomeVal.split(/\s+/).length >= 2;
            const isTelValid = telVal.length >= 10;
            const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal);
            
            nextButton.disabled = !(isNomeValid && isTelValid && isEmailValid);
            return; // Sai da função para não conflitar com a lógica padrão
        }

        const input = slide.querySelector('input[required]');
        if (input) {
            const value = input.value.trim();
            // Remove tudo que não é número para contar os dígitos reais
            const cleanValue = value.replace(/\D/g, ''); 
    
            const isEmail = input.type === 'email';
            const isCrp = input.id === 'input-crp';
            const isCep = input.id === 'input-cep'; 
            const isNome = input.id === 'input-nome';
            
            let isValid = value !== '';
    
            if (isValid && isEmail) {
                isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
            } else if (isValid && isCrp) {
                // CORREÇÃO: Aceita se tiver PELO MENOS 6 números (confiamos na máscara para o teto)
                isValid = cleanValue.length >= 6; 
            } else if (isValid && isCep) {
                // CORREÇÃO: Aceita se tiver PELO MENOS 8 números
                isValid = cleanValue.length >= 8;
            } else if (isValid && isNome) {
                const partesNome = value.split(/\s+/);
                isValid = partesNome.length >= 2;
            }
            nextButton.disabled = !isValid;
        }
    }

    function goToSlide(index) {
        let targetIndex = index;
        const direction = targetIndex >= currentStep ? 1 : -1;

        // Avalia condições dinâmicas para pular slides
        while (questions[targetIndex] && questions[targetIndex].condition) {
            try {
                const conditionFn = new Function('answers', `return ${questions[targetIndex].condition};`);
                if (!conditionFn(userAnswers)) {
                    targetIndex += direction;
                } else {
                    break;
                }
            } catch (e) {
                console.error("Erro ao avaliar condição do slide:", e);
                break;
            }
        }

        document.querySelector('.slide.active')?.classList.remove('active');
        currentStep = targetIndex;
        // Seleciona o novo slide
        const nextSlideElement = document.querySelector(`[data-index="${currentStep}"]`);
        nextSlideElement?.classList.add('active');
        
        updateProgressBar();
    
        const currentQuestion = questions[currentStep];
        
        // Configurações de Máscara (IMask)
        if (currentQuestion) {
            if (currentQuestion.id === 'lead-capture') {
                const telInput = document.getElementById('input-telefone');
                if (telInput && window.IMask) {
                    IMask(telInput, {
                        mask: [ { mask: '(00) 0000-0000' }, { mask: '(00) 00000-0000' } ]
                    });
                }
            }
            if (currentQuestion.id === 'crp') {
                const crpInput = document.getElementById(`input-${currentQuestion.id}`);
                if (crpInput && window.IMask) {
                    // Máscara flexível (permite digitar até preencher)
                    IMask(crpInput, { mask: '00/000000' });
                }
            }
            if (currentQuestion.id === 'cep') {
                const cepInput = document.getElementById(`input-${currentQuestion.id}`);
                if (cepInput && window.IMask) {
                    IMask(cepInput, { mask: '00000-000' }); // Corrigi a máscara de CEP que estava igual a de CRP no seu código original
                }
            }
        }
    
        // LÓGICA DE AUTO-FOCUS (Novo)
        // Pequeno delay para garantir que a transição CSS (se houver) iniciou
        setTimeout(() => {
            if (nextSlideElement) {
                const inputToFocus = nextSlideElement.querySelector('input, textarea');
                if (inputToFocus) inputToFocus.focus();
            }
        }, 150);
    
        // Chama a verificação do botão
        checkNextButtonState(nextSlideElement);
    }

    function collectAnswer() {
        const question = questions[currentStep];
        if (!question || !question.id) return;

        if (question.type === 'lead-capture') {
            userAnswers.nome = document.getElementById('input-nome')?.value || '';
            userAnswers.telefone = document.getElementById('input-telefone')?.value || '';
            userAnswers.email = document.getElementById('input-email')?.value || '';
        } else if (['text', 'email'].includes(question.type)) {
            userAnswers[question.id] = document.getElementById(`input-${question.id}`)?.value || '';
        }
        else if (['choice', 'multiple-choice'].includes(question.type)) {
            const selected = Array.from(document.querySelectorAll(`#slide-${question.id} .choice-button.selected`)).map(btn => btn.dataset.value);
            userAnswers[question.id] = question.type === 'choice' ? selected[0] : selected;
        }
    }

    // --- FUNÇÃO DE PERSONALIZAÇÃO (NOVO) ---
    function updateNamePlaceholders(fullName) {
        if (!fullName) return;
        // Pega o primeiro nome e capitaliza
        const firstName = fullName.trim().split(' ')[0];
        const formattedName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();

        const allSlides = document.querySelectorAll('.slide');
        allSlides.forEach(slide => {
            const title = slide.querySelector('h1');
            const subtitle = slide.querySelector('p.subtitle');
            
            if (title && title.innerHTML.includes('[NOME]')) title.innerHTML = title.innerHTML.replace(/\[NOME\]/g, formattedName);
            if (subtitle && subtitle.innerHTML.includes('[NOME]')) subtitle.innerHTML = subtitle.innerHTML.replace(/\[NOME\]/g, formattedName);
        });
    }

    function validateAndAdvance() {
        const currentQuestion = questions[currentStep];
        const currentSlideEl = document.querySelector('.slide.active');
        
        // Se não é obrigatória, passa direto
        if (!currentQuestion.required) {
            collectAnswer();
            goToSlide(currentStep + 1);
            return;
        }
    
        let isValid = true;
        let elementToShake;
    
        // Funções auxiliares de validação
        const isEmailValid = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        // Regex CRP ajustado: 2 dígitos + barra + 4 a 6 dígitos
        const isCrpValid = (crp) => /^\d{2}\/\d{4,6}$/.test(crp);
        const isCepValid = (cep) => /^\d{5}-\d{3}$/.test(cep);
    
        if (currentQuestion.type === 'lead-capture') {
            const nomeInput = document.getElementById('input-nome');
            const telInput = document.getElementById('input-telefone');
            const emailInput = document.getElementById('input-email');
            
            const nomeVal = nomeInput.value.trim();
            const telVal = telInput.value.replace(/\D/g, '');
            const emailVal = emailInput.value.trim();

            if (nomeVal.split(/\s+/).length < 2) {
                isValid = false; elementToShake = nomeInput.parentElement;
            } else if (telVal.length < 10) {
                isValid = false; elementToShake = telInput.parentElement;
            } else if (!isEmailValid(emailVal)) {
                isValid = false; elementToShake = emailInput.parentElement;
            }
        } else if (['text', 'email'].includes(currentQuestion.type)) {
            const input = document.getElementById(`input-${currentQuestion.id}`);
            elementToShake = input.parentElement; 
    
            const value = input.value.trim();
            
            if (!value) {
                isValid = false;
            } else if (currentQuestion.type === 'email' && !isEmailValid(value)) {
                isValid = false;
            } else if (currentQuestion.id === 'crp' && !isCrpValid(value)) {
                isValid = false;
            } else if (currentQuestion.id === 'cep' && !isCepValid(value)) {
                isValid = false;
            } else if (currentQuestion.id === 'nome') {
                // Validação de Nome + Sobrenome
                const partesNome = value.split(/\s+/);
                if (partesNome.length < 2) isValid = false;
            }
    
        } else if (['multiple-choice'].includes(currentQuestion.type)) {
            elementToShake = currentSlideEl.querySelector('.options-grid');
            if (currentSlideEl.querySelectorAll('.choice-button.selected').length === 0) isValid = false;
        }
        
        if (isValid) {
            collectAnswer();

            // --- CAPTURA OCULTA DO LEAD (Background) ---
            if (currentQuestion.type === 'lead-capture') {
                const partialLead = {
                    nome: userAnswers.nome,
                    email: userAnswers.email,
                    telefone: userAnswers.telefone,
                    utm_source: utms.utm_source,
                    utm_medium: utms.utm_medium,
                    utm_campaign: utms.utm_campaign
                };
                // Envia para o banco silenciosamente (lista de espera funciona como repositório de leads)
                window.ProfissionaisAPI.captureLeadSilent(partialLead, BASE_URL);
                
                // --- EVENTO DE LEAD DO META PIXEL ---
                if (typeof fbq === 'function') {
                    fbq('track', 'Lead');
                }
            }

            // Se acabou de responder o nome, atualiza os próximos slides
            if (currentQuestion.id === 'lead-capture' || currentQuestion.id === 'nome') {
                updateNamePlaceholders(userAnswers.nome);
            }

            if (currentQuestion.buttonText) {
                checkDemand();
            } else {
                goToSlide(currentStep + 1);
            }
        } else if (elementToShake) {
            // Efeito visual de erro
            elementToShake.classList.add('shake-error');
            setTimeout(() => elementToShake.classList.remove('shake-error'), 500);
            
            // Se for erro de nome, podemos dar um feedback extra (opcional)
            if (currentQuestion.id === 'nome') {
                 // Opcional: alterar placeholder ou mostrar msg pequena
                 // input.placeholder = "Digite Nome e Sobrenome";
            }
        }
    }

    async function checkDemand() {
        collectAnswer();
        goToSlide(questions.findIndex(q => q.id === 'loading'));

        try {
            // Camada de API modularizada
            const data = await window.ProfissionaisAPI.checkDemand(userAnswers, BASE_URL);
            
            if (data.status === 'approved') {
                // --- Lógica Dinâmica de Copy Voltada à Conversão ---
                const approvedSlide = document.getElementById('slide-approved');
                if (approvedSlide) {
                    const subtitleEl = approvedSlide.querySelector('.subtitle');
                    if (subtitleEl) {
                        let baseClicks = 210;
                        let baseRate = 68;

                        // 1. Faixa de Preço (Maior impacto na demanda)
                        if (userAnswers.valor_sessao_faixa === "Até R$ 50") {
                            baseClicks += 940; baseRate = 92;
                        } else if (userAnswers.valor_sessao_faixa === "R$ 51 - R$ 90") {
                            baseClicks += 620; baseRate = 85;
                        } else if (userAnswers.valor_sessao_faixa === "R$ 91 - R$ 150") {
                            baseClicks += 280; baseRate = 76;
                        }

                        // 2. Modalidade
                        if (userAnswers.modalidade === "Apenas Online" || userAnswers.modalidade === "Híbrido (Online e Presencial)") {
                            baseClicks += 150; 
                        }

                        // 3. Quantidade de temas atuados
                        if (userAnswers.temas_atuacao && Array.isArray(userAnswers.temas_atuacao)) {
                            baseClicks += (userAnswers.temas_atuacao.length * 35);
                            baseRate += Math.min(10, userAnswers.temas_atuacao.length); // ganha até +10%
                        }

                        // Randomização sutil para parecer puramente orgânico
                        baseClicks += Math.floor(Math.random() * 45); 
                        baseRate = Math.min(98, baseRate); // Teto de 98% para ser crível

                        const formatNumber = (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                        
                        subtitleEl.innerHTML = `Nos últimos 30 dias tivemos <b>${formatNumber(baseClicks)}</b> cliques de contato em perfis com características semelhantes às suas e <b>${baseRate}%</b> de taxa média de conversão em pacientes.`;
                    }
                }
                
                goToSlide(questions.findIndex(q => q.id === 'approved'));
            } else { // 'waitlisted'
                goToSlide(questions.findIndex(q => q.id === 'waitlisted'));
            }
        } catch (error) {
            goToSlide(questions.findIndex(q => q.id === 'error'));
        }
    }

    async function submitToWaitlist() {
        // O e-mail já foi validado na primeira tela (lead-capture)
        if (!userAnswers.email) {
            alert("Erro de captura. Por favor, reinicie o questionário.");
            return;
        }

        try {
            await window.ProfissionaisAPI.submitToWaitlist(userAnswers, BASE_URL);
            window.location.href = 'obrigado_lista_espera.html';
        } catch (error) {
            alert("Ocorreu um erro ao salvar seu e-mail. Tente novamente.");
        }
    }

    function initializeQuiz() {
        slidesContainer.innerHTML = questions.map((q, i) => createSlideHTML(q, i)).join('');

        // Adiciona capitalização automática para o campo de nome
        const nomeInput = document.getElementById('input-nome');
        if (nomeInput) {
            nomeInput.addEventListener('input', (e) => {
                const start = e.target.selectionStart;
                const end = e.target.selectionEnd;
                // Capitaliza a primeira letra de cada palavra
                e.target.value = e.target.value.replace(/\b\w/g, char => char.toUpperCase());
                e.target.setSelectionRange(start, end);
            });
        }
        
        // 1. LÓGICA DO "ENTER PARA AVANÇAR" (Problema 1)
        slidesContainer.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
                e.preventDefault(); // Impede o envio padrão do formulário
                // Encontra o botão de avançar (data-action="next") no slide ativo
                const ctaButton = document.querySelector('.slide.active .cta-button[data-action="next"]');
                if (ctaButton && !ctaButton.disabled) {
                    ctaButton.click(); // Simula o clique no botão "Avançar"
                }
            }
        });

        // Adiciona o listener de input para todos os campos de texto requeridos
        slidesContainer.querySelectorAll('input[required]').forEach(input => {
            const slide = input.closest('.slide');
            input.addEventListener('input', () => checkNextButtonState(slide));
        });

        slidesContainer.addEventListener('click', (e) => {
            const target = e.target;
            
            // CORREÇÃO CRÍTICA: Usamos .closest para pegar o botão mesmo clicando no texto
            const nextBtn = target.closest('[data-action="next"]');
            const restartBtn = target.closest('[data-action="restart"]');
            const submitValidationBtn = target.closest('[data-action="submit-validation"]');
            const checkBtn = target.closest('[data-action="check"]');
            const submitWaitlistBtn = target.closest('[data-action="submit-waitlist"]');
            const backBtn = target.closest('.back-button');
            const choiceBtn = target.closest('.choice-button'); // Aqui está a mágica

            if (nextBtn) {
                validateAndAdvance();
            } else if (restartBtn) {
                goToSlide(0); 
            } else if (submitValidationBtn) {
                // Adiciona UTMs capturadas no início às respostas finais
                userAnswers.utm_source = utms.utm_source;
                userAnswers.utm_medium = utms.utm_medium;
                userAnswers.utm_campaign = utms.utm_campaign;

                localStorage.setItem('psi_questionario_respostas', JSON.stringify(userAnswers));
                sessionStorage.setItem('questionarioCompleto', 'true');

                // --- EVENTO CUSTOMIZADO DE APROVAÇÃO ---
                // O evento 'Lead' padrão já foi disparado na Etapa 1.
                if (typeof fbq === 'function') {
                    fbq('trackCustom', 'QuestionarioAprovado');
                }

                const { nome, email, crp, telefone } = userAnswers;
                const params = new URLSearchParams({ nome: nome || '', email: email || '', crp: crp || '', telefone: telefone || '' });
                
                // CORRETO: aponta para a rota que acabamos de criar no servidor
                window.location.href = `/psi-registro?${params.toString()}`;
            } else if (checkBtn) {
                validateAndAdvance(); 
            } else if (submitWaitlistBtn) {
                submitToWaitlist();
            } else if (backBtn) {
                goToSlide(currentStep - 1);
            } 
            // Lógica de Seleção Corrigida
            else if (choiceBtn) {
                const currentQuestion = questions[currentStep];
                let proximoPasso = currentStep + 1;

                if (choiceBtn.classList.contains('multi-choice')) {
                    choiceBtn.classList.toggle('selected'); // Agora vai ficar amarelo!
                } else {
                    choiceBtn.closest('.options-grid').querySelectorAll('.choice-button').forEach(btn => btn.classList.remove('selected'));
                    choiceBtn.classList.add('selected'); // Agora vai ficar amarelo!
                    
                    collectAnswer();
                    
                    setTimeout(() => goToSlide(proximoPasso), 200);
                }
            }
        });

        goToSlide(0);
    }

    initializeQuiz();
});
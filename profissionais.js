// Arquivo: professionals.js (COMPLETO E CORRIGIDO)

document.addEventListener('DOMContentLoaded', () => {
    // --- CORREÇÃO DE ROTA ---
    // Pega do config.js ou assume localhost:3001
    const BASE_URL = (typeof window.API_BASE_URL !== 'undefined') 
        ? window.API_BASE_URL 
        : 'http://localhost:3001';

    const questions = [
        // Etapa 1: Boas-vindas e Dados Básicos
        { id: 'boas-vindas', type: 'welcome', question: "Boas-vindas ao Girassol, colega.", subtitle: "Estamos felizes por ter você aqui. Este questionário inicial é a etapa mais importante: ele define seu perfil para que possamos conectá-lo(a) aos pacientes certos. Responda com calma." },        
        { id: 'nome', type: 'text', question: "Primeiro, qual o seu nome completo?", placeholder: "Nome Completo", required: true },
        { id: 'email', type: 'email', question: "Qual o seu melhor e-mail profissional?", placeholder: "E-mail Profissional", required: true, inputMode: 'email' },
        { id: 'crp', type: 'text', question: "E o seu número de registro no CRP?", placeholder: "Número do CRP (ex: 06/123456)", required: true, inputMode: 'numeric' },
        // Etapa 2: Definição do Nicho
        { id: 'modalidade', type: 'choice', question: "Como você prefere atender?", choices: ["Apenas Online", "Apenas Presencial", "Híbrido (Online e Presencial)"], required: true },
        { id: 'cep', type: 'text', question: "Qual o CEP do seu local de atendimento?", placeholder: "CEP (ex: 12345-678)", required: true, inputMode: 'numeric' },
        { id: 'nicho-intro', type: 'info', question: "Entendendo sua Prática e Especialidades", subtitle: "Suas respostas aqui são cruciais. Elas definem seu 'nicho de mercado' e nos permitem verificar se há uma demanda ativa de pacientes para o seu perfil." },
        { id: 'genero_identidade', question: "Com qual gênero você se identifica?", type: 'choice', choices: ["Feminino", "Masculino", "Não-binário", "Outro"], required: true },
        { id: 'valor_sessao_faixa', question: "Em qual faixa de preço você pretende atender?", type: 'choice', choices: ["Até R$ 50", "R$ 51 - R$ 90", "R$ 91 - R$ 150", "Acima de R$ 150"], required: true },
        { id: 'temas_atuacao', question: "Quais são seus principais temas de atuação?", type: 'multiple-choice', scrollable: true, choices: ["Ansiedade", "Estresse", "Depressão", "Relacionamentos", "Carreira", "Autoestima", "Luto", "Traumas", "TDAH", "Sexualidade"], required: true },
        { id: 'abordagem_teorica', question: "Qual a sua principal abordagem teórica?", type: 'choice', scrollable: true, choices: ["Psicanálise", "Terapia Cognitivo-Comportamental (TCC)", "Humanista / Centrada na Pessoa", "Gestalt-terapia", "Análise do Comportamento (ABA)", "Outra"], required: true },
        { id: 'praticas_afirmativas', question: "Sua prática é afirmativa para quais comunidades ou perspectivas?", type: 'multiple-choice', scrollable: true, choices: ["LGBTQIAPN+ friendly", "Antirracista", "Feminista", "Neurodiversidade", "Nenhuma específica"], required: true, buttonText: "Verificar Demanda" },
        // Telas de Resultado Dinâmico
        { id: 'loading', type: 'loading', question: "Analisando a demanda...", subtitle: "Estamos cruzando seus dados com as buscas de nossos pacientes. Só um instante." },
        
        { id: 'approved', type: 'approved', 
          question: "Ótima notícia! Há uma grande procura por seu perfil."
        },

        { id: 'waitlisted', type: 'waitlisted', question: "Agradecemos seu interesse na Girassol!", subtitle: "No momento, a busca por profissionais com seu perfil específico já está bem atendida. Para garantir que todos os nossos parceiros tenham sucesso, adicionamos seu perfil à nossa lista de espera. Deixe seu e-mail abaixo para ser notificado(a) assim que surgir uma nova oportunidade.", buttonText: "Confirmar E-mail e Finalizar" },
        { id: 'error', type: 'error', question: "Oops! Ocorreu um problema.", subtitle: "Não foi possível conectar ao servidor para verificar a demanda. Por favor, tente novamente em alguns instantes.", buttonText: "Tentar Novamente" }
    ];

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
            case 'text':
            case 'email':
                const inputMode = questionData.inputMode ? `inputmode="${questionData.inputMode}"` : '';
                contentHTML = `
                    <div class="form-group-questionario">
                        <input type="${questionData.type}" id="input-${questionData.id}" class="text-input" placeholder=" " required ${inputMode}>
                        <label for="input-${questionData.id}" class="input-label">${questionData.placeholder}</label>
                    </div>`;
                break;
            case 'choice': case 'multiple-choice': 
                const choicesClass = questionData.scrollable ? 'choices-container scrollable' : 'choices-container';
                const buttonClass = `choice-button ${questionData.type === 'multiple-choice' ? 'multi-choice' : ''}`;
                contentHTML = `<div class="${choicesClass}">${questionData.choices.map(choice => `<button class="${buttonClass}" data-value="${choice}">${choice}</button>`).join('')}</div>`;
                break;
            case 'approved':
                // O conteúdo foi removido, pois o redirecionamento será direto.
                break;
            case 'loading':
                contentHTML = '<div class="loader-wrapper"><div class="loader-spinner"></div></div>';
                break;
            case 'waitlisted':
                contentHTML = `
                    <div class="form-group-questionario">
                        <input type="email" id="input-waitlist-email" class="text-input" placeholder=" " required>
                        <label for="input-waitlist-email" class="input-label">Seu melhor e-mail</label>
                    </div>`;
                break;
            case 'welcome': case 'info': case 'error':
                break;
            default:
                contentHTML = `<p>Tipo de pergunta não reconhecido: ${questionData.type}</p>`;
        }

        const backButtonHTML = !isFirstInteractiveStep && !['welcome', 'info', 'loading', 'approved', 'waitlisted', 'error'].includes(questionData.type) ? `<button class="back-button">← Voltar</button>` : '';

        let nextButtonHTML = '';
        if (['welcome', 'info', 'text', 'email', 'multiple-choice'].includes(questionData.type)) {
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
        document.querySelector('.slide.active')?.classList.remove('active');
        currentStep = index;
        // Seleciona o novo slide
        const nextSlideElement = document.querySelector(`[data-index="${currentStep}"]`);
        nextSlideElement?.classList.add('active');
        
        updateProgressBar();
    
        const currentQuestion = questions[currentStep];
        
        // Configurações de Máscara (IMask)
        if (currentQuestion) {
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
            if (currentQuestion.id === 'waitlisted') {
                const waitlistEmailInput = document.getElementById('input-waitlist-email');
                if (waitlistEmailInput && userAnswers.email) {
                    waitlistEmailInput.value = userAnswers.email;
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

        if (['text', 'email'].includes(question.type)) {
            userAnswers[question.id] = document.getElementById(`input-${question.id}`)?.value || '';
        }
        else if (['choice', 'multiple-choice'].includes(question.type)) {
            const selected = Array.from(document.querySelectorAll(`#slide-${question.id} .choice-button.selected`)).map(btn => btn.dataset.value);
            userAnswers[question.id] = question.type === 'choice' ? selected[0] : selected;
        }
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
    
        if (['text', 'email'].includes(currentQuestion.type)) {
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
            elementToShake = currentSlideEl.querySelector('.choices-container');
            if (currentSlideEl.querySelectorAll('.choice-button.selected').length === 0) isValid = false;
        }
        
        if (isValid) {
            collectAnswer();
            goToSlide(currentStep + 1);
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
            const response = await fetch(`${BASE_URL}/api/psychologists/check-demand`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userAnswers)
            });
            const data = await response.json();

            if (response.ok) {
                if (data.status === 'approved') {
                    goToSlide(questions.findIndex(q => q.id === 'approved'));
                } else { // 'waitlisted'
                    goToSlide(questions.findIndex(q => q.id === 'waitlisted'));
                }
            } else {
                console.error("Erro na API:", data.error);
                goToSlide(questions.findIndex(q => q.id === 'error'));
            }
        } catch (error) {
            console.error("Erro de conexão:", error);
            goToSlide(questions.findIndex(q => q.id === 'error'));
        }
    }

    async function submitToWaitlist() {
        const waitlistEmailInput = document.getElementById('input-waitlist-email');
        const email = waitlistEmailInput.value;

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            waitlistEmailInput.parentElement.classList.add('shake-error');
            setTimeout(() => waitlistEmailInput.parentElement.classList.remove('shake-error'), 500);
            return;
        }

        userAnswers.email = email;

        try {
            await fetch(`${BASE_URL}/api/psychologists/add-to-waitlist`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userAnswers)
            });
            window.location.href = 'obrigado_lista_espera.html';
        } catch (error) {
            console.error("Erro ao adicionar à lista de espera:", error);
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
                if (ctaButton) {
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
                localStorage.setItem('psi_questionario_respostas', JSON.stringify(userAnswers));
                sessionStorage.setItem('questionarioCompleto', 'true');
                const { nome, email, crp } = userAnswers;
                const params = new URLSearchParams({ nome: nome || '', email: email || '', crp: crp || '' });
                window.location.href = `psi_registro.html?${params.toString()}`;
            } else if (checkBtn) {
                const currentSlideEl = document.querySelector('.slide.active');
                if (currentSlideEl.querySelectorAll('.choice-button.selected').length > 0) {
                    checkDemand();
                } else {
                    validateAndAdvance(); 
                }
            } else if (submitWaitlistBtn) {
                submitToWaitlist();
            } else if (backBtn) {
                let passoAnterior = currentStep - 1;
                const cepStepIndex = questions.findIndex(q => q.id === 'cep');
                if (currentStep === cepStepIndex + 1) {
                    const modalidade = userAnswers['modalidade'];
                    if (modalidade === 'Apenas Online') {
                        passoAnterior = cepStepIndex - 1;
                    }
                }
                goToSlide(passoAnterior);
            } 
            // Lógica de Seleção Corrigida
            else if (choiceBtn) {
                const currentQuestion = questions[currentStep];
                let proximoPasso = currentStep + 1;

                if (choiceBtn.classList.contains('multi-choice')) {
                    choiceBtn.classList.toggle('selected'); // Agora vai ficar amarelo!
                } else {
                    choiceBtn.closest('.choices-container').querySelectorAll('.choice-button').forEach(btn => btn.classList.remove('selected'));
                    choiceBtn.classList.add('selected'); // Agora vai ficar amarelo!
                    
                    collectAnswer();
                    
                    if (currentQuestion.id === 'modalidade') {
                        const modalidade = userAnswers['modalidade'];
                        if (modalidade === 'Apenas Online') {
                            const cepStepIndex = questions.findIndex(q => q.id === 'cep');
                            proximoPasso = cepStepIndex + 1; 
                            userAnswers['cep'] = null; 
                        }
                    }
                    setTimeout(() => goToSlide(proximoPasso), 200);
                }
            }
        });

        goToSlide(0);
    }

    initializeQuiz();
});
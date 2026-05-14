// /js/questionario.js
// SE JÁ EXISTE NO CONFIG.JS, USA ELE. SE NÃO, USA LOCALHOST.
var BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : 'http://localhost:3001';

document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 questionario.js inicializado com sucesso!");

    // --- FORÇAR COR DA BARRA DO NAVEGADOR (MOBILE) ---
    // Garante que a barra fique verde (#1B4332)
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
        metaThemeColor.setAttribute('content', '#1B4332');
    } else {
        const meta = document.createElement('meta');
        meta.name = "theme-color";
        meta.content = "#1B4332";
        document.head.appendChild(meta);
    }
    
    // FIX: Aplica a cor verde e a textura de ruído diretamente no HTML.
    // Isso garante que as "sobras" de tela no rodapé (safe-areas ou telas altas) mantenham a mesma textura contínua.
    document.documentElement.style.backgroundColor = '#1B4332';
    document.documentElement.style.backgroundImage = 'var(--ruido-claro)';
    document.documentElement.style.backgroundAttachment = 'fixed';
    document.documentElement.style.backgroundRepeat = 'repeat';

    let currentSearchId = null; // Guarda o ID do rascunho

    const questions = [
        { id: 'boas-vindas', question: "Vamos encontrar a pessoa certa para te acompanhar nesta jornada.", subtitle: "Responda a algumas perguntas para começarmos.", type: 'welcome' },
        { id: 'idade', question: "Para começarmos, qual a sua faixa etária?", type: 'choice', choices: ["Menor de 18 anos", "18-24 anos", "25-34 anos", "35-44 anos", "45-54 anos", "55+ anos"], required: true },
        { id: 'pref_genero_prof', question: "Você tem preferência pelo gênero do(a) profissional?", subtitle: "Sua segurança e conforto são a nossa prioridade.", type: 'choice', choices: ["Indiferente", "Masculino", "Feminino", "Não-binário"], required: true },
        { id: 'temas', question: "O que te motivou a procurar terapia agora?", subtitle: "Selecione os temas que você gostaria de explorar.", type: 'multiple-choice', scrollable: true, choices: ["Ansiedade ou Estresse", "Depressão ou Tristeza", "Relacionamentos", "Carreira e Trabalho", "Autoestima", "Luto ou Traumas", "Autoconhecimento", "Outro"], required: true },
        { id: 'caracteristicas_prof', question: "Existem características importantes para você no profissional?", subtitle: "A identidade de quem te escuta pode fazer diferença.", type: 'multiple-choice', choices: ["LGBTQIAPN+ Friendly 🏳️‍🌈", "Que faça parte da comunidade LGBTQIAPN+", "Pessoa não-branca ou com prática antirracista", "Que tenha uma perspectiva feminista", "Especialista em Neurodiversidade (TDAH, Autismo)", "Indiferente"], required: true },
        { id: 'faixa_valor', question: "Qual a faixa de valor que você pode investir por sessão?", subtitle: "Para conectarmos você a profissionais dentro do seu orçamento.", type: 'choice', choices: ["Até R$ 50", "R$ 51 - R$ 90", "R$ 91 - R$ 150", "Acima de R$ 150"], required: true },
        { id: 'modalidade_atendimento', question: "Como você prefere ser atendido(a)?", type: 'choice', choices: ["Online", "Presencial", "Indiferente (Online ou Presencial)"], required: true },
        { id: 'cep', question: "Qual o seu CEP?", subtitle: "Para encontrarmos profissionais perto de você.", type: 'text', placeholder: "00000-000", required: true, inputMode: 'numeric' },
        { id: 'nome', question: "Para finalizar, como podemos te chamar?", subtitle: "Isso nos ajuda a entregar uma experiência personalizada para você.", type: 'text', placeholder: "Digite o seu nome ou apelido", required: true, autocomplete: 'off', autofocus: true },
        { id: 'final', type: 'final', question: "Tudo pronto, [NOME]!", subtitle: "Estamos cruzando as suas respostas para encontrar as conexões mais significativas. Em instantes, você verá as suas recomendações."},
        { id: 'erro-idade', type: 'error', question: "Atenção", subtitle: "A plataforma Yelo é destinada apenas para maiores de 18 anos...", buttonText: "Entendi e Sair"}
    ];
    
    let currentStep = 0;
    const userAnswers = {};
    const slidesContainer = document.querySelector('.slides-container');
    const progressBarFill = document.querySelector('.progress-bar-fill');
    const totalQuestions = questions.filter(q => !['welcome', 'final', 'error', 'thank-you', 'cep'].includes(q.type)).length; 

    // =====================================================================
    // FUNÇÃO createSlideHTML CORRIGIDA
    // =====================================================================
    function createSlideHTML(questionData, index) { 
        let contentHTML = '', navHTML = ''; 
        const isFirstStep = questions.findIndex(q => q.type !== 'welcome') === index; 
        
        switch (questionData.type) { 
            case 'text': case 'tel': {
                const inputModeAttr = questionData.inputMode ? `inputmode="${questionData.inputMode}"` : '';
                const autocompleteAttr = questionData.autocomplete ? `autocomplete="${questionData.autocomplete}"` : '';
                const autofocusAttr = questionData.autofocus ? 'autofocus' : '';
                contentHTML = `<div class="input-wrapper"><input type="${questionData.type}" id="input-${questionData.id}" class="text-input" placeholder="${questionData.placeholder}" ${inputModeAttr} ${autocompleteAttr} ${autofocusAttr}>
                <span class="enter-hint">Pressione <strong>Enter ↵</strong></span></div>`; 
                if (questionData.footer) {
                    contentHTML += `<p style="margin-top: 12px; font-size: 0.85rem; opacity: 0.8; text-align: center; line-height: 1.4;">${questionData.footer}</p>`;
                }
                break; 
            }
            case 'choice': case 'multiple-choice': {
                const choicesClass = questionData.scrollable ? 'options-grid scrollable' : 'options-grid'; 
                const buttonClass = questionData.type === 'multiple-choice' ? 'choice-button multi-choice' : 'choice-button'; 
                contentHTML = `<div class="${choicesClass}">${questionData.choices.map(choice => `<button class="${buttonClass}" data-value="${choice}">${choice}</button>`).join('')}</div>`; 
                break;
            }
            case 'rating': {
                // Definição do Ícone SVG (Estrela vazada)
                const starIcon = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;

                contentHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; width: 100%;">
                    <div class="rating-stars">
                        <input type="radio" id="star5" name="avaliacao" value="5" />
                        <label for="star5">${starIcon}</label>
                        
                        <input type="radio" id="star4" name="avaliacao" value="4" />
                        <label for="star4">${starIcon}</label>
                        
                        <input type="radio" id="star3" name="avaliacao" value="3" />
                        <label for="star3">${starIcon}</label>
                        
                        <input type="radio" id="star2" name="avaliacao" value="2" />
                        <label for="star2">${starIcon}</label>
                        
                        <input type="radio" id="star1" name="avaliacao" value="1" />
                        <label for="star1">${starIcon}</label>
                    </div>

                    <div class="form-group-questionario" style="margin-top: 5px;">
                        <textarea id="input-feedback" class="feedback-textarea" placeholder=" " rows="2"></textarea>
                        <label class="input-label">Deixe um elogio ou sugestão (Opcional)</label>
                    </div>
                </div>`;
                break;
            }
            case 'welcome':
            case 'thank-you':
            case 'final':
            case 'error':
                contentHTML = ''; // Slides informativos, sem campos de input
                break;
            default: 
                console.warn("Tipo de pergunta desconhecido:", questionData.type); 
                contentHTML = ''; 
        } 
        
        const backButtonHTML = !isFirstStep && !['welcome', 'final', 'error', 'thank-you'].includes(questionData.type) ? `<button class="back-button">← Voltar</button>` : ''; 
        let nextButtonHTML = ''; 

        if (questionData.type === 'welcome') { 
            nextButtonHTML = `<button class="cta-button" data-action="next">Vamos começar</button>`; 
        } else if (['text', 'tel', 'multiple-choice', 'rating'].includes(questionData.type)) { 
            let buttonText = "Avançar";
            let buttonAction = "next";
            
            // Personalizações do botão
            if(questionData.id === 'nome') { buttonText = "Finalizar"; buttonAction = "finalize"; }
            if(questionData.type === 'rating') { buttonText = "Finalizar"; buttonAction = "finalize"; } // Mantido caso decida voltar com a avaliação
            
            nextButtonHTML = `<button class="cta-button" data-action="${buttonAction}">${buttonText}</button>`; 
        } else if (questionData.type === 'error') { 
            navHTML = `<a href="/" class="cta-button">${questionData.buttonText}</a>`; 
        } 
        
        const navigationClass = backButtonHTML ? '' : 'single-button'; 
        if (!navHTML && (backButtonHTML || nextButtonHTML)) { 
            navHTML = `<div class="navigation-buttons ${navigationClass}">${backButtonHTML}${nextButtonHTML}</div>`; 
        } 
        return `<div class="slide" id="slide-${questionData.id}" data-index="${index}"><div class="slide-header"><h1>${questionData.question}</h1><p class="subtitle">${questionData.subtitle || ''}</p></div><div class="slide-body ${questionData.scrollable ? 'scrollable' : ''}">${contentHTML}</div>${navHTML}</div>`; 
    }

    // =====================================================================
    // FUNÇÃO recordAnonymousSearch
    // =====================================================================
    async function recordAnonymousSearch() {
        try {
            const { nome, ...demandAnswers } = userAnswers;
            await fetch(`${BASE_URL}/api/demand/searches`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(demandAnswers),
            });
            console.log("Busca anônima registrada com sucesso.");
        } catch (error) {
            console.error("Não foi possível registrar a busca anônima:", error);
        }
    }

    // =====================================================================
    // FUNÇÃO finalize (CORRIGIDA: REMOVIDO BEACON, ADICIONADO FETCH SEGURO)
    // =====================================================================
    async function finalize() {
        // 1. Garante que a última resposta (estrelas) foi coletada
        collectAnswer();

        // 2. Mostra a tela de "final" visualmente
        const finalSlideIndex = questions.findIndex(q => q.id === 'final');
        if (finalSlideIndex !== -1) goToSlide(finalSlideIndex);

        try {
            // Separa dados para salvar
            const { nome, ...demandAnswers } = userAnswers;
            
            // [NOVO] Salva o telefone para usar no clique do WhatsApp (mesmo se não logar)
            if (nome) localStorage.setItem('yelo_guest_name', nome);

            // Normaliza o consentimento para booleano (para facilitar o filtro no Admin)
            demandAnswers.contact_consent = true;

            // Adiciona o ID do rascunho para o backend saber qual atualizar
            if (currentSearchId) {
                demandAnswers.searchId = currentSearchId;
            }

            // --- CORREÇÃO DO CONTADOR ZERO ---
            // Envia para o banco de dados e ESPERA (await) a resposta
            const saveResponse = await fetch(`${BASE_URL}/api/demand/searches`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(demandAnswers)
            });

            if (saveResponse.ok) {
                console.log("✅ Questionário contabilizado no Dashboard!");
            } else {
                console.warn("⚠️ Servidor recebeu, mas deu erro ao salvar:", saveResponse.status);
            }

            // --- BUSCA O MATCH ---
            const matchResponse = await fetch(`${BASE_URL}/api/psychologists/match`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userAnswers),
            });

            if (!matchResponse.ok) throw new Error("Falha ao buscar recomendações");

            const matchData = await matchResponse.json();

            // --- DISPARO DE CONVERSÃO DO GOOGLE ADS E GA4 ---
            try {
                if (typeof window.gtag === 'function') {
                    console.log('[GA4 Debug] Conversão final do questionário disparada.');
                    // Disparo para a conta oficial do Google Ads
                    window.gtag('event', 'conversion', {'send_to': 'AW-11236864912/hOYjCPO1lqAcEJDnk-4p'});
                    // Disparo para o funil do GA4
                    window.gtag('event', 'match_concluido');
                }
            } catch (trackingError) {
                console.warn('[Tracking Debug] Erro ao disparar conversão:', trackingError);
            }

            // Pequena pausa dramática (UX)
            await new Promise(r => setTimeout(r, 1500));

            // Salva resultados e redireciona
            sessionStorage.setItem('matchResults', JSON.stringify(matchData));
            window.location.href = '/resultados';

        } catch (error) {
            console.error("❌ Erro no finalize():", error);
            // Fallback de segurança: se der erro, vai para resultados mesmo assim
            setTimeout(() => {
                sessionStorage.setItem('matchResults', JSON.stringify({ matchTier: 'none', results: [] }));
                window.location.href = '/resultados';
            }, 2000);
        }
    }
    
    // --- FUNÇÕES AUXILIARES ---
    function updateProgressBar() { 
        const validQuestions = questions.filter(q => !['welcome', 'final', 'error', 'thank-you'].includes(q.type));
        const currentValidIndex = questions.slice(0, currentStep + 1).filter(q => !['welcome', 'final', 'error', 'thank-you'].includes(q.type)).length; 
        
        const progress = Math.max(0, (currentValidIndex / totalQuestions) * 100); 
        progressBarFill.style.width = `${progress}%`; 

        const counterEl = document.querySelector('.step-counter');
        if(counterEl && currentValidIndex > 0 && currentValidIndex <= totalQuestions) {
            counterEl.textContent = `Pergunta ${currentValidIndex} de ${totalQuestions}`;
            counterEl.style.opacity = '1';
        } else {
            if(counterEl) counterEl.style.opacity = '0';
        }
    }

    function goToSlide(index) { 
        const currentSlide = document.querySelector('.slide.active'); 
        const nextSlide = document.querySelector(`[data-index="${index}"]`);
        
        // Se houver slide ativo e estivermos mudando de passo, faz a animação de saída
        if (currentSlide && currentStep !== index) {
            const isMobile = window.innerWidth <= 992;
            const inputToFocus = nextSlide ? nextSlide.querySelector('input, textarea') : null;
            
            if (inputToFocus && isMobile) {
                // HACK MOBILE DEFINITIVO: O teclado nativo não sobe se houver setTimeout.
                // Cortamos a animação neste passo específico para focar de forma síncrona com o clique.
                currentSlide.classList.remove('active', 'fade-out-up');
                showNextSlide(index);
            } else {
                currentSlide.classList.add('fade-out-up');
                setTimeout(() => {
                    currentSlide.classList.remove('active', 'fade-out-up');
                    showNextSlide(index);
                }, 300);
            }
        } else {
            if (currentSlide) currentSlide.classList.remove('active');
            showNextSlide(index);
        }
    }

    function showNextSlide(index) {
        currentStep = index; 
        const nextSlide = document.querySelector(`[data-index="${currentStep}"]`); 
        
        if (nextSlide) {
            nextSlide.classList.add('active'); 

            const inputToFocus = nextSlide.querySelector('input, textarea');
            
            // --- CORREÇÃO DE SCROLL E FOCO ---
            // Scroll força o mobile a ocultar o teclado. Só rola a tela se não houver input.
            if (!inputToFocus) {
                window.scrollTo(0, 0);
                const slideBody = nextSlide.querySelector('.slide-body');
                if (slideBody) slideBody.scrollTop = 0;
            } else {
                inputToFocus.focus();
            }
        } else {
            console.error(`Slide com index ${index} não encontrado.`); 
        }
        
        updateProgressBar(); 
        
        // --- RASTREAMENTO DE FUNIL E DESISTÊNCIAS (Google e Meta) ---
        const currentQuestion = questions[currentStep];
        if (currentQuestion) {
            try {
                // 1. Envia o passo atual para o Google Analytics (GA4/Ads)
                if (typeof window.gtag === 'function') {
                    console.log(`[GA4 Debug] Disparando evento 'passo_questionario' | Passo: ${currentStep} | Pergunta: ${currentQuestion.id}`);
                    window.gtag('event', 'passo_questionario', {
                        'numero_pergunta': currentStep,
                        'nome_pergunta': currentQuestion.id
                    });
                } else {
                    console.warn('[GA4 Debug] window.gtag não está definido no momento da chamada.');
                }
                // 2. Envia o passo atual para o Facebook/Meta Pixel
                if (typeof window.fbq === 'function') {
                    window.fbq('trackCustom', 'PassoQuestionario', { passo: currentStep, nome_pergunta: currentQuestion.id });
                }
            } catch (trackingError) {
                console.warn('[Tracking Debug] AdBlocker impediu o disparo dos eventos de passo:', trackingError);
            }
            
            // 3. Envia o passo atual para o Banco de Dados da Yelo (Painel Admin)
            if (currentSearchId) {
                const globalUtms = JSON.parse(localStorage.getItem('yelo_global_utms') || '{}');
                fetch(`${BASE_URL}/api/tracking/questionario-step`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        searchId: currentSearchId, 
                        step: currentQuestion.id,
                        utms: globalUtms
                    })
                }).catch(() => {});
            }
        }

        // --- PROTEÇÃO OFFLINE (IMask) ---
        // Só tenta criar máscaras se a biblioteca IMask tiver carregado
        if (typeof IMask !== 'undefined') {
            const currentQuestion = questions[currentStep]; 
            if (currentQuestion && currentQuestion.id === 'cep') { 
                const cepInput = document.getElementById(`input-${currentQuestion.id}`); 
                if (cepInput) IMask(cepInput, { mask: '00000-000' }); 
            }
        }
    }
    
    // =====================================================================
    // FUNÇÃO collectAnswer CORRIGIDA (COM RATING)
    // =====================================================================
    function collectAnswer() { 
        const question = questions[currentStep]; 
        if (!question || !question.id || ['welcome', 'final', 'error', 'thank-you'].includes(question.type)) return; 
        
        let answer; 
        if (question.type === 'text') { 
            answer = document.getElementById(`input-${question.id}`)?.value || ''; 
        } else if (question.type === 'choice') { 
            const selectedButton = document.querySelector(`#slide-${question.id} .choice-button.selected`); 
            answer = selectedButton ? selectedButton.dataset.value : undefined; 
        } else if (question.type === 'multiple-choice') { 
            const selected = []; 
            document.querySelectorAll(`#slide-${question.id} .choice-button.selected`).forEach(btn => selected.push(btn.dataset.value)); 
            answer = selected; 
        } else if (question.type === 'rating') {
            // Pega a estrela selecionada e o feedback
            const ratingEl = document.querySelector('input[name="avaliacao"]:checked');
            const rating = ratingEl ? ratingEl.value : null;
            const feedbackEl = document.getElementById('input-feedback');
            const feedback = feedbackEl ? feedbackEl.value : '';
            
            // Salva como objeto
            answer = { rating: rating, feedback: feedback };
        }
        userAnswers[question.id] = answer; 
    }

    function validateAndAdvance() { 
        const currentQuestion = questions[currentStep]; 
        const currentSlideEl = document.querySelector('.slide.active'); 
        
        let isValid = true; 
        
        if (currentQuestion.required) { 
            if (currentQuestion.type === 'text') { 
                const input = document.getElementById(`input-${currentQuestion.id}`); 
                if (input.value.trim() === '') { 
                    input.classList.add('shake-error'); setTimeout(() => input.classList.remove('shake-error'), 500); isValid = false; 
                } 
            } else if (['choice', 'multiple-choice'].includes(currentQuestion.type)) { 
                if (currentSlideEl.querySelectorAll('.choice-button.selected').length === 0) { 
                    const btnToShake = currentSlideEl.querySelector('.cta-button') || currentSlideEl.querySelector('.options-grid'); 
                    btnToShake.classList.add('shake-error'); setTimeout(() => btnToShake.classList.remove('shake-error'), 500); isValid = false; 
                } 
            } 
            // Validação para Rating (Opcional: se required=true, obriga a dar estrela)
            else if (currentQuestion.type === 'rating') {
                const ratingEl = document.querySelector('input[name="avaliacao"]:checked');
                if (!ratingEl) {
                    // Treme as estrelas se não selecionou nada
                    const starsContainer = currentSlideEl.querySelector('.rating-stars');
                    starsContainer.classList.add('shake-error'); 
                    setTimeout(() => starsContainer.classList.remove('shake-error'), 500); 
                    isValid = false;
                    
                    // Exibe Modal Personalizado em vez de alert
                    const modal = document.getElementById('rating-validation-modal');
                    if (modal) {
                        modal.style.display = 'flex';
                    } else {
                        alert("Por favor, selecione uma nota de 1 a 5 estrelas.");
                    }
                }
            }
        }

        if (isValid) { 
            collectAnswer(); 
            if (currentQuestion.id === 'nome') { updateNamePlaceholders(userAnswers.nome); } 
            
            const actionButton = currentSlideEl.querySelector('.cta-button'); 
            const action = actionButton ? actionButton.dataset.action : null; 
            
            if (action === 'finalize') { 
                finalize(); 
            } else { 
                goToSlide(currentStep + 1); 
            } 
        } 
    }

    function initializeQuiz() { 
        try { 
            slidesContainer.innerHTML = questions.map((q, i) => createSlideHTML(q, i)).join(''); 
        } catch (error) { 
            console.error("Erro ao gerar o HTML dos slides:", error); 
            slidesContainer.innerHTML = "<p style='color:red; text-align:center; padding: 40px;'>Ocorreu um erro ao carregar o questionário. Tente recarregar a página.</p>"; 
            return; 
        } 
        
        slidesContainer.addEventListener('click', (e) => { 
            const target = e.target; 
            const currentQuestion = questions[currentStep]; 
            
            // --- 1. Ação: Avançar/Finalizar ---
            if (target.matches('[data-action="next"], [data-action="finalize"]')) { 
                // Se clicou em "Vamos começar" (primeiro slide), avisa o backend
                if (target.matches('[data-action="next"]') && currentStep === 0) {
                    // Dispara o aviso sem travar o usuário (Fire and Forget)
                    fetch(`${BASE_URL}/api/demand/start`, { method: 'POST' })
                        .then(r => r.json())
                        .then(data => { 
                            currentSearchId = data.searchId;
                            console.log("Rastreamento iniciado. ID:", currentSearchId);
                        })
                        .catch(e => console.warn("Falha ao iniciar rastreamento", e));
                }
                validateAndAdvance(); 
            } 
            
            // --- 2. Ação: Voltar ---
            if (target.matches('.back-button')) {
                let passoAnterior = currentStep - 1;
                const cepStepIndex = questions.findIndex(q => q.id === 'cep');

                // Se estou no passo DEPOIS do CEP (ex: 'whatsapp')
                if (currentStep === cepStepIndex + 1) {
                    const modalidade = userAnswers['modalidade_atendimento'];
                    if (modalidade === 'Online') {
                        passoAnterior = cepStepIndex - 1; // PULA o CEP e volta direto para Modalidade
                    }
                }
                goToSlide(passoAnterior); 
            } 

            // --- 3. Ação: Clicar em um Botão de Escolha ---
            if (target.matches('.choice-button')) { 
                const isMulti = target.classList.contains('multi-choice'); 
                if (isMulti) { 
                    target.classList.toggle('selected'); 
                } else { 
                    const parent = target.closest('.options-grid'); 
                    parent.querySelectorAll('.choice-button').forEach(btn => btn.classList.remove('selected')); 
                    target.classList.add('selected'); 
                    collectAnswer(); 

                    // --- LÓGICA DE IDADE ---
                    if (currentQuestion.id === 'idade' && target.dataset.value === 'Menor de 18 anos') {
                        sessionStorage.setItem('Yelo_user_name', userAnswers.nome || ''); 
                        setTimeout(() => { window.location.href = '/menor_de_idade'; }, 300);
                    } else {
                        let proximoPasso = currentStep + 1;
                        if (currentQuestion.id === 'modalidade_atendimento') {
                            const modalidade = userAnswers['modalidade_atendimento'];
                            if (modalidade === 'Online') {
                                const cepStepIndex = questions.findIndex(q => q.id === 'cep');
                                proximoPasso = cepStepIndex + 1;
                                userAnswers['cep'] = null; 
                            }
                        }
                    setTimeout(() => goToSlide(proximoPasso), 450); /* Aumentado para ver a transição */
                    } 
                } 
            } 
            
            // NOTA: A lógica de auto-avançar ao clicar nas estrelas foi REMOVIDA
            // para permitir que o usuário escreva no campo de texto.
        }); 
        
        slidesContainer.addEventListener('keydown', (e) => { 
            // Permite avançar com Enter (exceto se tiver selecionado um botão CTA manualmente)
        if (e.key === 'Enter' && !e.target.matches('.cta-button')) { 
            e.preventDefault(); 
                validateAndAdvance(); 
            } 
        }); 

        // [NOVO] Salva o WhatsApp em tempo real para garantir que não se perca
        slidesContainer.addEventListener('input', (e) => {
            if (e.target.id === 'input-nome') {
                // Capitaliza a primeira letra do nome (e sobrenomes) em tempo real
                let val = e.target.value;
                let newVal = val.replace(/(?:^|\s)\S/g, function(a) { return a.toUpperCase(); });
                
                if (val !== newVal) {
                    const start = e.target.selectionStart;
                    const end = e.target.selectionEnd;
                    e.target.value = newVal;
                    e.target.setSelectionRange(start, end); // Evita que o cursor pule para o final
                }
                localStorage.setItem('yelo_guest_name', e.target.value);
            }
        });
        
        if (document.querySelector(`[data-index="0"]`)) { 
            goToSlide(0); 
        } else { 
            console.error("Erro: Slide inicial não encontrado."); 
        } 
    }

    // Listener para fechar o modal de avaliação
    const btnCloseRating = document.getElementById('btn-close-rating-modal');
    if (btnCloseRating) {
        btnCloseRating.addEventListener('click', () => {
            document.getElementById('rating-validation-modal').style.display = 'none';
        });
    }

    initializeQuiz();

    function updateNamePlaceholders(name) { 
        if (!name) return; 
        
        // Pega apenas o primeiro nome e garante a primeira letra maiúscula
        const firstName = name.trim().split(' ')[0];
        const formattedName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();

        const allSlides = document.querySelectorAll('.slide'); 
        allSlides.forEach(slide => { 
            const title = slide.querySelector('h1'); 
            const subtitle = slide.querySelector('p.subtitle'); 
            if (title && title.innerHTML.includes('[NOME]')) { 
                title.innerHTML = title.innerHTML.replace(/\[NOME\]/g, formattedName); 
            } 
            if (subtitle && subtitle.innerHTML.includes('[NOME]')) { 
                subtitle.innerHTML = subtitle.innerHTML.replace(/\[NOME\]/g, formattedName); 
            } 
        }); 
    }
});
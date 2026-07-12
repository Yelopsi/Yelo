// /js/questionario.js
// SE JÁ EXISTE NO CONFIG.JS, USA ELE. SE NÃO, USA LOCALHOST.
var BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : 'http://localhost:3001';

document.addEventListener('DOMContentLoaded', () => {

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

    function isTestUser() {
        const type = localStorage.getItem('Yelo_user_type');
        return type === 'psychologist' || type === 'admin' || type === 'psi';
    }

    // Pré-carrega a página de resultados no cache do navegador para transição instantânea
    const prefetchLink = document.createElement('link');
    prefetchLink.rel = 'prefetch';
    prefetchLink.href = '/resultados';
    document.head.appendChild(prefetchLink);

    const questions = [
        { id: 'idade', question: "Para começarmos, qual a sua faixa etária?", type: 'choice', choices: ["Menor de 18 anos", "18-24 anos", "25-34 anos", "35-44 anos", "45-54 anos", "55+ anos"], required: true },
        { id: 'responsavel_menor', question: "Você é o responsável legal por este paciente?", subtitle: "Atendimentos para menores de idade exigem o acompanhamento ou autorização de um responsável (pai, mãe ou tutor legal).", type: 'choice', choices: ["Sim, sou o responsável legal", "Não, sou o próprio menor"], required: true },
        { id: 'pref_genero_prof', question: "Você tem preferência pelo gênero do(a) profissional?", subtitle: "Sua segurança e conforto são a nossa prioridade.", type: 'choice', choices: ["Indiferente", "Masculino", "Feminino", "Não-binário"], required: true },
        { id: 'temas', question: "O que te motivou a procurar terapia agora?", subtitle: "Selecione até 3 temas que você gostaria de explorar.", type: 'multiple-choice', scrollable: true, choices: ["Ansiedade ou Estresse", "Depressão ou Tristeza", "Relacionamentos", "Carreira e Trabalho", "Autoestima", "Luto ou Traumas", "Sexualidade", "Autoconhecimento", "Outro"], required: true },
        { id: 'caracteristicas_prof', question: "Existem características importantes para você no profissional?", subtitle: "A identidade de quem te escuta pode fazer diferença.", type: 'multiple-choice', choices: ["LGBTQIAPN+ Friendly 🏳️‍🌈", "Faz parte da comunidade LGBTQIAPN+", "Pessoa não-branca ou prática antirracista", "Perspectiva Feminista", "Especialista em Neurodiversidade (TDAH, Autismo)", "Indiferente"], required: true },
        { id: 'faixa_valor', question: "Qual a faixa de valor que você pode investir por sessão?", subtitle: "Para conectarmos você a profissionais dentro do seu orçamento.", type: 'choice', choices: ["Até R$ 50", "R$ 51 - R$ 90", "R$ 91 - R$ 150", "Acima de R$ 150"], required: true },
        { id: 'modalidade_atendimento', question: "Como você prefere ser atendido(a)?", type: 'choice', choices: ["Online", "Presencial", "Indiferente (Online ou Presencial)"], required: true },
        { id: 'cep', question: "Qual o seu CEP?", subtitle: "Para encontrarmos profissionais perto de você.", type: 'text', placeholder: "00000-000", required: true, inputMode: 'numeric' },
        { id: 'nome', question: "Para finalizar, como podemos te chamar? (Opcional)", subtitle: "Isso nos ajuda a entregar uma experiência personalizada para você.", type: 'text', placeholder: "Digite o seu nome ou apelido", required: false, autocomplete: 'off', autofocus: true },
        { id: 'final', type: 'final', question: "Tudo pronto, [NOME]!", subtitle: "Estamos cruzando as suas respostas para encontrar as conexões mais significativas. Em instantes, você verá as suas recomendações.<br><br><div style=\"display:flex; justify-content:center; margin-top:20px;\"><div style=\"width: 45px; height: 45px; border: 4px solid rgba(255,255,255,0.2); border-top-color: #FFEE8C; border-radius: 50%; animation: spinYelo 1s linear infinite;\"></div></div><style>@keyframes spinYelo { to { transform: rotate(360deg); } }</style>" },
        { id: 'erro-idade', type: 'error', question: "Atenção", subtitle: "A plataforma Yelo é destinada apenas para maiores de 18 anos...", buttonText: "Entendi e Sair" }
    ];

    let currentStep = 0;
    const userAnswers = {};
    const slidesContainer = document.querySelector('.slides-container');
    const progressBarFill = document.querySelector('.progress-bar-fill');
    const totalQuestions = questions.filter(q => !['welcome', 'final', 'error', 'thank-you', 'cep'].includes(q.type)).length;

    // =====================================================================
    // FUNÇÃO finalize (CORRIGIDA: REMOVIDO BEACON, ADICIONADO FETCH SEGURO)
    // =====================================================================
    async function finalize() {
        // 1. Garante que a última resposta (estrelas) foi coletada
        collectAnswer();

        // 2. Feedback visual instantâneo no botão
        const currentSlideEl = document.querySelector('.slide.active');
        const actionButton = currentSlideEl ? currentSlideEl.querySelector('.cta-button') : null;
        if (actionButton) {
            actionButton.textContent = "Processando...";
            actionButton.disabled = true;
        }

        try {
            // Separa dados para salvar
            const { nome, ...demandAnswers } = userAnswers;

            const utms = JSON.parse(localStorage.getItem('yelo_global_utms') || '{}');

            // Adiciona as UTMs capturadas da URL para aparecerem no gráfico de Canais de Aquisição
            demandAnswers.utm_source = utms.utm_source;
            demandAnswers.utm_medium = utms.utm_medium;
            demandAnswers.utm_campaign = utms.utm_campaign;
            demandAnswers.utm_content = utms.utm_content;

            // [NOVO] Salva o telefone para usar no clique do WhatsApp (mesmo se não logar)
            if (nome) localStorage.setItem('yelo_guest_name', nome);

            // Normaliza o consentimento para booleano (para facilitar o filtro no Admin)
            demandAnswers.contact_consent = true;

            // Adiciona o ID do rascunho para o backend saber qual atualizar
            if (currentSearchId) {
                demandAnswers.searchId = currentSearchId;
            }

            if (window.QuestionarioService && !isTestUser()) {
                window.QuestionarioService.saveAnswers(demandAnswers).catch(e => console.error(e));
                window.QuestionarioService.trackMatchCompleted();
            }

            // --- REDIRECIONAMENTO IMEDIATO ---
            // Salva as respostas para que a página de resultados faça o match e exiba o loading animado
            sessionStorage.setItem('pendingMatchAnswers', JSON.stringify(userAnswers));
            window.location.href = '/resultados';

        } catch (error) {
            console.error("❌ Erro no finalize():", error);

            // Fallback de segurança: se der erro, vai para resultados vazio
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
        if (counterEl && currentValidIndex > 0 && currentValidIndex <= totalQuestions) {
            counterEl.textContent = `Pergunta ${currentValidIndex} de ${totalQuestions}`;
            counterEl.style.opacity = '1';
        } else {
            if (counterEl) counterEl.style.opacity = '0';
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
        }

        updateProgressBar();

        // --- RASTREAMENTO DE FUNIL E DESISTÊNCIAS (Google e Meta) ---
        const currentQuestion = questions[currentStep];
        if (currentQuestion && !isTestUser()) {
            if (window.QuestionarioService) {
                window.QuestionarioService.trackStep(currentStep, currentQuestion.id, currentSearchId);
            }
        }

        // --- PROTEÇÃO OFFLINE (IMask) ---
        // Só tenta criar máscaras se a biblioteca IMask tiver carregado
        if (typeof IMask !== 'undefined') {
            const currentQuestion = questions[currentStep];
            if (currentQuestion && currentQuestion.id === 'cep') {
                const cepInput = document.getElementById(`input-${currentQuestion.id}`);
                if (cepInput && !cepInput.maskRef) {
                    const mask = IMask(cepInput, { mask: '00000-000' });
                    cepInput.maskRef = mask;

                    // Avanço automático ao completar o CEP
                    mask.on('complete', () => {
                        const savedStep = currentStep;
                        cepInput.blur(); // Esconde o teclado mobile
                        // Pequeno delay visual para o usuário ver o CEP preenchido antes da transição
                        setTimeout(() => { if (currentStep === savedStep) validateAndAdvance(); }, 300);
                    });
                }
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
            const firstInteractiveIndex = questions.findIndex(q => q.type !== 'welcome');
            slidesContainer.innerHTML = questions.map((q, i) => {
                const isFirstStep = i === firstInteractiveIndex;
                return window.QuestionarioUI ? window.QuestionarioUI.createSlideHTML(q, i, isFirstStep) : '';
            }).join('');
        } catch (error) {
            slidesContainer.innerHTML = "<p style='color:red; text-align:center; padding: 40px;'>Ocorreu um erro ao carregar o questionário. Tente recarregar a página.</p>";
            return;
        }

        slidesContainer.addEventListener('click', (e) => {
            const target = e.target;
            const currentQuestion = questions[currentStep];

            // --- 1. Ação: Avançar/Finalizar ---
            if (target.matches('[data-action="next"], [data-action="finalize"]')) {
                validateAndAdvance();
            }

            // --- 2. Ação: Voltar ---
            if (target.matches('.back-button')) {
                let passoAnterior = currentStep - 1;
                const cepStepIndex = questions.findIndex(q => q.id === 'cep');
                const responsavelStepIndex = questions.findIndex(q => q.id === 'responsavel_menor');
                const generoStepIndex = questions.findIndex(q => q.id === 'pref_genero_prof');

                // Se estou no passo DEPOIS do CEP (ex: 'whatsapp')
                if (currentStep === cepStepIndex + 1) {
                    const modalidade = userAnswers['modalidade_atendimento'];
                    if (modalidade === 'Online') {
                        passoAnterior = cepStepIndex - 1; // PULA o CEP e volta direto para Modalidade
                    }
                }

                // Se estou voltando da pergunta de Gênero, verifico se pulo o passo do Responsável
                if (currentStep === generoStepIndex) {
                    if (userAnswers['idade'] !== 'Menor de 18 anos') {
                        passoAnterior = responsavelStepIndex - 1; // Volta direto para a pergunta de idade
                    }
                }
                goToSlide(passoAnterior);
            }

            // --- 3. Ação: Clicar em um Botão de Escolha ---
            if (target.matches('.choice-button')) {
                const isMulti = target.classList.contains('multi-choice');
                if (isMulti) {
                    const grid = target.closest('.options-grid');
                    const isThemesQuestion = grid && grid.closest('#slide-temas');

                    if (isThemesQuestion && !target.classList.contains('selected')) {
                        const selectedCount = grid.querySelectorAll('.choice-button.selected').length;
                        if (selectedCount >= 3) {
                            // Já tem 3, se tentar clicar no 4º, apenas ignora e avança
                            validateAndAdvance();
                            return;
                        }
                    }

                    target.classList.toggle('selected');

                    if (isThemesQuestion && target.classList.contains('selected')) {
                        const newCount = grid.querySelectorAll('.choice-button.selected').length;
                        if (newCount === 3) {
                            // Pequeno delay visual para ver a cor mudar antes de deslizar
                            setTimeout(() => validateAndAdvance(), 200);
                        }
                    }
                } else {
                    const parent = target.closest('.options-grid');
                    parent.querySelectorAll('.choice-button').forEach(btn => btn.classList.remove('selected'));
                    target.classList.add('selected');
                    collectAnswer();

                    let proximoPasso = currentStep + 1;

                    // --- LÓGICA CONDICIONAL DE IDADE E RESPONSÁVEL ---
                    if (currentQuestion.id === 'idade') {
                        if (target.dataset.value !== 'Menor de 18 anos') {
                            const generoStepIndex = questions.findIndex(q => q.id === 'pref_genero_prof');
                            proximoPasso = generoStepIndex; // Pula a tela do responsável se for adulto
                        }
                    } else if (currentQuestion.id === 'responsavel_menor') {
                        if (target.dataset.value === 'Não, sou o próprio menor') {
                            sessionStorage.setItem('Yelo_user_name', userAnswers.nome || '');

                            try { if (typeof window.gtag === 'function') window.gtag('event', 'desqualificado_idade'); } catch (e) { }

                            if (currentSearchId) {
                                fetch(`${BASE_URL}/api/tracking/disqualify`, {
                                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ searchId: currentSearchId, reason: 'under_18' })
                                }).catch(() => { });
                            }

                            setTimeout(() => { window.location.href = '/menor_de_idade'; }, 300);
                            return; // Encerra a execução para não rolar slide
                        }
                    } else if (currentQuestion.id === 'modalidade_atendimento') {
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

        // [NOVO] Garante submissão via teclado mobile (Go/Avançar) quando os inputs estão dentro de forms
        slidesContainer.addEventListener('submit', (e) => {
            e.preventDefault();
            validateAndAdvance();
        });

        // [NOVO] Salva o WhatsApp em tempo real para garantir que não se perca
        slidesContainer.addEventListener('input', (e) => {
            if (e.target.id === 'input-nome') {
                // Capitaliza a primeira letra do nome (e sobrenomes) em tempo real
                let val = e.target.value;
                let newVal = val.replace(/(?:^|\s)\S/g, function (a) { return a.toUpperCase(); });

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
            // Dispara a criação do rascunho de busca imediatamente no carregamento da página
            if (window.QuestionarioService && !isTestUser()) {
                window.QuestionarioService.startSearch().then(id => { if (id) currentSearchId = id; });
            }
        } else {
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
        let formattedName = '';
        if (name && name.trim() !== '') {
            // Pega apenas o primeiro nome e garante a primeira letra maiúscula
            const firstName = name.trim().split(' ')[0];
            formattedName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
        }

        const allSlides = document.querySelectorAll('.slide');
        allSlides.forEach(slide => {
            const title = slide.querySelector('h1');
            const subtitle = slide.querySelector('p.subtitle');
            if (title && title.innerHTML.includes('[NOME]')) {
                if (formattedName) {
                    title.innerHTML = title.innerHTML.replace(/\[NOME\]/g, formattedName);
                } else {
                    title.innerHTML = title.innerHTML.replace(/,\s*\[NOME\]/g, '').replace(/\[NOME\]/g, '');
                }
            }
            if (subtitle && subtitle.innerHTML.includes('[NOME]')) {
                if (formattedName) {
                    subtitle.innerHTML = subtitle.innerHTML.replace(/\[NOME\]/g, formattedName);
                } else {
                    subtitle.innerHTML = subtitle.innerHTML.replace(/,\s*\[NOME\]/g, '').replace(/\[NOME\]/g, '');
                }
            }
        });
    }
});
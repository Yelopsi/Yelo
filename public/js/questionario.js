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
        { id: 'idade', question: "Para começarmos, qual a sua faixa etária?", subtitle: "Precisamos saber sua idade para garantir que a sua experiência seja a mais adequada e segura para o seu momento de vida.", type: 'choice', choices: ["Menor de 18 anos", "18-24 anos", "25-34 anos", "35-44 anos", "45-54 anos", "55+ anos"], required: true },
        { id: 'responsavel_menor', question: "Você é o responsável legal por este paciente?", subtitle: "Para cuidarmos de você da melhor forma, o atendimento de menores requer o acompanhamento ou autorização de um adulto responsável.", type: 'choice', choices: ["Sim, sou o responsável legal", "Não, sou o próprio menor"], required: true },
        { id: 'pref_genero_prof', question: "Você tem preferência pelo gênero do(a) profissional?", subtitle: "Queremos que você se sinta em um ambiente totalmente seguro e à vontade. Escolha o que te deixa mais confortável.", type: 'choice', choices: ["Indiferente", "Masculino", "Feminino", "Não-binário"], required: true },
        { id: 'temas', question: "O que te motivou a procurar terapia agora?", subtitle: "Entender o que te traz aqui nos ajuda a encontrar o(a) profissional com a experiência certa para te apoiar neste momento.", type: 'choice', choices: ["Ansiedade, Estresse ou Tristeza", "Amor, Relacionamentos e Sexualidade", "Autoconhecimento e Autoestima", "Carreira e Trabalho", "Luto ou Traumas", "Outro"], required: true },
        { id: 'abordagem_ideal', question: "Pensando nisso...", subtitle: "Cada pessoa se adapta melhor a um estilo de terapia. Vamos descobrir qual jeito de conduzir a sessão mais combina com você.", type: 'choice', choices: [], required: true },
        { id: 'caracteristicas_prof', question: "Existem características importantes para você no profissional?", subtitle: "Sabemos que a identificação com o profissional é fundamental para criar um espaço de confiança e empatia.", type: 'multiple-choice', choices: ["LGBTQIAPN+ Friendly 🏳️‍🌈", "Faz parte da comunidade LGBTQIAPN+", "Pessoa não-branca ou prática antirracista", "Perspectiva Feminista", "Especialista em Neurodiversidade (TDAH, Autismo)", "Indiferente"], required: true },
        { id: 'faixa_valor', question: "Qual a faixa de valor que você pode investir por sessão?", subtitle: "Acreditamos que o cuidado com a saúde mental deve caber no seu bolso. Vamos focar em opções dentro da sua realidade.", type: 'choice', choices: ["Até R$ 50", "R$ 51 - R$ 90", "R$ 91 - R$ 150", "Acima de R$ 150"], required: true },
        { id: 'modalidade_atendimento', question: "Como você prefere ser atendido(a)?", subtitle: "Você pode escolher o conforto da sua casa ou o ambiente acolhedor do consultório. O que funciona melhor para você?", type: 'choice', choices: ["Online", "Presencial", "Indiferente (Online ou Presencial)"], required: true },
        { id: 'cep', question: "Qual o seu CEP?", subtitle: "Usaremos essa informação com todo o cuidado apenas para sugerir profissionais pertinho de você.", type: 'text', placeholder: "00000-000", required: true, inputMode: 'numeric' },
        { id: 'final', type: 'final', question: "Tudo pronto!", subtitle: "Nossa inteligência está analisando com carinho as suas respostas. Em instantes, apresentaremos as melhores conexões para você.<br><br><div style=\"display:flex; justify-content:center; margin-top:20px;\"><div style=\"width: 45px; height: 45px; border: 4px solid rgba(255,255,255,0.2); border-top-color: #FFEE8C; border-radius: 50%; animation: spinYelo 1s linear infinite;\"></div></div><style>@keyframes spinYelo { to { transform: rotate(360deg); } }</style>" },
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
            const { ...demandAnswers } = userAnswers;

            const utms = JSON.parse(localStorage.getItem('yelo_global_utms') || '{}');

            // Adiciona as UTMs capturadas da URL para aparecerem no gráfico de Canais de Aquisição
            demandAnswers.utm_source = utms.utm_source || 'organico';
            demandAnswers.utm_medium = utms.utm_medium;
            demandAnswers.utm_campaign = utms.utm_campaign;
            demandAnswers.utm_content = utms.utm_content;

            // [NOVO] Salva o telefone para usar no clique do WhatsApp (mesmo se não logar)


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

            // --- REDIRECIONAMENTO ---
            // Salva as respostas para que a página de resultados faça o match e exiba o loading animado
            sessionStorage.setItem('pendingMatchAnswers', JSON.stringify(userAnswers));
            
            // Adiciona um delay para que o usuário veja a animação de carregamento na tela final
            setTimeout(() => {
                window.location.href = '/resultados';
            }, 2500);

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

            // SE O SLIDE FOR O FINAL, ENGATILHA O FINALIZE AUTOMATICAMENTE
            if (questions[currentStep].type === 'final') {
                finalize();
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
            if (question.id === 'abordagem_ideal' && answer) {
                answer = answer.split(',');
            }
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

            if (currentQuestion.id === 'temas') { updateAbordagemIdealSlide(); }

            const actionButton = currentSlideEl.querySelector('.cta-button');
            const action = actionButton ? actionButton.dataset.action : null;

            // Sempre avança para o próximo slide. Se o próximo for o final, showNextSlide aciona finalize()
            goToSlide(currentStep + 1);
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
                    
                    if (currentQuestion.id === 'temas') { updateAbordagemIdealSlide(); }

                    let proximoPasso = currentStep + 1;

                    // --- LÓGICA CONDICIONAL DE IDADE E RESPONSÁVEL ---
                    if (currentQuestion.id === 'idade') {
                        if (target.dataset.value !== 'Menor de 18 anos') {
                            const generoStepIndex = questions.findIndex(q => q.id === 'pref_genero_prof');
                            proximoPasso = generoStepIndex; // Pula a tela do responsável se for adulto
                        }
                    } else if (currentQuestion.id === 'responsavel_menor') {
                        if (target.dataset.value === 'Não, sou o próprio menor') {


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



    function updateAbordagemIdealSlide() {
        const temasSelecionados = [].concat(userAnswers['temas'] || []);
        const temasSintomas = ["Ansiedade, Estresse ou Tristeza", "Luto ou Traumas"];
        const temasRelacionais = ["Amor, Relacionamentos e Sexualidade"];
        
        let categoria = "desenvolvimento"; // Default
        if (temasSelecionados.length === 1 && temasSelecionados[0] === "Outro") {
            categoria = "outro";
        } else if (temasSelecionados.some(t => temasSintomas.includes(t))) {
            categoria = "sintomas";
        } else if (temasSelecionados.some(t => temasRelacionais.includes(t))) {
            categoria = "relacional";
        }

        let questionText = "";
        let choicesHTML = "";

        const valTCC = "Terapia Cognitivo-Comportamental (TCC),Análise do Comportamento,ACT - Terapia de Aceitação e Compromisso";
        const valPsi = "Psicanálise,Jungiana";
        const valPsiOnly = "Psicanálise";
        const valHum = "Humanista,Gestalt-terapia";
        const valSis = "Sistêmica";
        const valIndiferente = "Indiferente";

        if (categoria === "sintomas") {
            questionText = "Lidando com essas questões, como o terapeuta poderia te ajudar melhor?";
            choicesHTML = `
                <button class="choice-button" data-value="${valTCC}"><strong>Foco Prático:</strong> Quero ferramentas e exercícios para mudar meus hábitos no dia a dia.</button>
                <button class="choice-button" data-value="${valPsiOnly}"><strong>Foco Profundo:</strong> Quero um espaço livre para investigar a raiz dos meus problemas.</button>
                <button class="choice-button" data-value="${valHum}"><strong>Acolhimento:</strong> Quero focar em entender e aceitar meus sentimentos no presente.</button>
                <button class="choice-button" data-value="${valSis}"><strong>Foco no Ambiente:</strong> Quero entender como as pessoas ao meu redor influenciam o que sinto.</button>
                <button class="choice-button" data-value="${valIndiferente}" style="margin-top: 10px;"><strong>Não sei escolher</strong> / Pode me recomendar</button>
            `;
        } else if (categoria === "relacional") {
            questionText = "Ao focar nas suas relações e intimidade, qual dinâmica de terapia te atrai mais?";
            choicesHTML = `
                <button class="choice-button" data-value="${valSis}"><strong>Dinâmica Familiar:</strong> Quero entender como a minha família molda meus relacionamentos.</button>
                <button class="choice-button" data-value="${valPsi}"><strong>Explorar o Passado:</strong> Quero entender de onde vêm os meus padrões de relacionamento.</button>
                <button class="choice-button" data-value="${valTCC}"><strong>Estratégias:</strong> Gostaria de dicas diretas para me comunicar melhor e mudar atitudes.</button>
                <button class="choice-button" data-value="${valHum}"><strong>Expressão Autêntica:</strong> Quero focar na forma como eu me sinto e me expresso na relação agora.</button>
                <button class="choice-button" data-value="${valIndiferente}" style="margin-top: 10px;"><strong>Não sei escolher</strong> / Pode me recomendar</button>
            `;
        } else if (categoria === "outro") {
            questionText = "Independentemente do motivo que te trouxe aqui, como você prefere conduzir a sessão?";
            choicesHTML = `
                <button class="choice-button" data-value="${valTCC}"><strong>Foco Prático:</strong> Quero ferramentas e exercícios para mudar meus hábitos no dia a dia.</button>
                <button class="choice-button" data-value="${valPsi}"><strong>Foco Profundo:</strong> Gosto da ideia de investigar a raiz das questões e o meu inconsciente.</button>
                <button class="choice-button" data-value="${valHum}"><strong>Acolhimento:</strong> Quero um espaço focado na minha autoaceitação livre de julgamentos.</button>
                <button class="choice-button" data-value="${valSis}"><strong>Foco no Ambiente:</strong> Quero entender como o meu convívio social influencia quem eu sou.</button>
                <button class="choice-button" data-value="${valIndiferente}" style="margin-top: 10px;"><strong>Não sei escolher</strong> / Pode me recomendar</button>
            `;
        } else {
            questionText = "Buscando desenvolvimento pessoal, como você prefere conduzir a sessão?";
            choicesHTML = `
                <button class="choice-button" data-value="${valTCC}"><strong>Metas Claras:</strong> Quero descobrir quais hábitos me travam e agir para mudá-los.</button>
                <button class="choice-button" data-value="${valPsi}"><strong>Mergulho Interior:</strong> Gosto da ideia de analisar meus sonhos e o meu inconsciente.</button>
                <button class="choice-button" data-value="${valHum}"><strong>Potencial Humano:</strong> Quero focar na minha autoaceitação livre de julgamentos.</button>
                <button class="choice-button" data-value="${valSis}"><strong>Padrões Sociais:</strong> Quero entender as expectativas que a sociedade colocou em mim.</button>
                <button class="choice-button" data-value="${valIndiferente}" style="margin-top: 10px;"><strong>Não sei escolher</strong> / Pode me recomendar</button>
            `;
        }

        const abordagemSlideIndex = questions.findIndex(q => q.id === 'abordagem_ideal');
        const slideEl = document.querySelector(`[data-index="${abordagemSlideIndex}"]`);
        
        if (slideEl) {
            const h1 = slideEl.querySelector('h1');
            if (h1) h1.textContent = questionText;
            
            const grid = slideEl.querySelector('.options-grid');
            if (grid) grid.innerHTML = choicesHTML;
            
            // Clear previous selection visually and in data
            userAnswers['abordagem_ideal'] = undefined;
        }
    }
});
// js/questionario.js
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
    document.documentElement.style.backgroundColor = '#1B4332';

    let currentSearchId = null; // Guarda o ID do rascunho

    const questions = [
        { id: 'boas-vindas', question: "Vamos encontrar a pessoa certa para te acompanhar nessa jornada.", subtitle: "Responda algumas perguntas para começarmos.", type: 'welcome' },
        { id: 'nome', question: "Olá! Para começarmos, como podemos te chamar?", subtitle: "Isso nos ajuda a te entregar uma experiência personalizada.", type: 'text', placeholder: "Digite seu nome ou apelido", required: true, autocomplete: 'off' },
        { id: 'idade', question: "Certo, [NOME]. Muito prazer! E qual a sua faixa etária?", subtitle: "Isso nos ajuda a entender melhor quem busca a Yelo.", type: 'choice', choices: ["Menor de 18 anos", "18-24 anos", "25-34 anos", "35-44 anos", "45-54 anos", "55+ anos"], required: true },
        { id: 'identidade_genero', question: "Agora, [NOME], com qual gênero você se identifica?", subtitle: "Sua identidade é importante. Selecione a opção que melhor te representa.", type: 'choice', scrollable: true, choices: ["Masculino", "Feminino", "Não-binário", "Agênero", "Bigênero", "Pangênero", "Genderqueer", "Gênero fluido", "Demigênero", "Andrógeno", "Outro", "Prefiro não informar"], required: true },
        { id: 'pref_genero_prof', question: "Você tem preferência pelo gênero do(a) profissional?", subtitle: "Sua segurança e conforto são nossa prioridade.", type: 'choice', choices: ["Indiferente", "Masculino", "Feminino", "Não-binário"], required: true },
        { id: 'motivacao', question: "[NOME], o que te motivou a buscar terapia agora?", subtitle: "Saber seu ponto de partida nos ajuda a encontrar o melhor caminho. Selecione as principais opções.", type: 'multiple-choice', scrollable: true, choices: ["Estou passando por um desafio específico", "Quero me conhecer melhor", "Recebi uma recomendação", "Estou lidando com sintomas difíceis (ansiedade, tristeza)", "Quero melhorar meus relacionamentos", "Outro", "Não tenho certeza"], required: true },
        { id: 'temas', question: "Quais temas ou sentimentos você gostaria de explorar?", subtitle: "Já estamos finalizando. Selecione os principais. Isso nos ajuda a focar na sua necessidade.", type: 'multiple-choice', scrollable: true, choices: ["Ansiedade", "Estresse", "Depressão", "Relacionamentos", "Carreira", "Autoestima", "Luto", "Traumas"], required: true },
        { id: 'terapia_anterior', question: "Você já fez terapia antes, [NOME]?", subtitle: "Entender sua trajetória nos ajuda a traçar um novo futuro.", type: 'choice', choices: ["Sim, e foi uma boa experiência", "Sim, mas não foi uma boa experiência", "Não, esta é minha primeira vez"], required: true },
        { id: 'experiencia_desejada', question: "Que tipo de experiência terapêutica você imagina?", subtitle: "Isso nos ajuda a alinhar seu estilo com o do profissional.", type: 'multiple-choice', choices: ["Um espaço de escuta e acolhimento para me encontrar", "Ferramentas e tarefas práticas para aplicar no dia a dia", "Entender meu passado e a raiz das minhas emoções", "Focar em soluções para problemas específicos", "Não sei / Indiferente"], required: true },
        { id: 'caracteristicas_prof', question: "Existem características importantes para você em um(a) psicólogo(a)?", subtitle: "A identidade de quem te escuta pode fazer toda a diferença.", type: 'multiple-choice', choices: ["Que faça parte da comunidade LGBTQIAPN+", "Que seja uma pessoa não-branca (racializada) / prática antirracista", "Que tenha uma perspectiva feminista", "Que entenda de neurodiversidade (TDAH, Autismo, etc.)", "Indiferente"], required: true },
        { id: 'faixa_valor', question: "Qual faixa de valor você pode investir por sessão?", subtitle: "Isso garante que vamos te conectar com profissionais que cabem no seu orçamento.", type: 'choice', choices: ["Até R$ 50", "R$ 51 - R$ 90", "R$ 91 - R$ 150", "Acima de R$ 150"], required: true },
        { id: 'modalidade_atendimento', question: "Como você prefere ser atendido?", subtitle: "Isso nos ajuda a filtrar profissionais pela sua localização ou disponibilidade online.", type: 'choice', choices: ["Online", "Presencial", "Indiferente (Online ou Presencial)"], required: true },
        { id: 'cep', question: "Qual o seu CEP?", subtitle: "Isso nos ajuda a encontrar profissionais que atendem presencialmente perto de você.", type: 'text', placeholder: "00000-000", required: true, inputMode: 'numeric' },
        { id: 'whatsapp', question: "Para finalizar, [NOME], qual seu número de WhatsApp?", subtitle: "Nos importamos com a sua jornada. Ao avançar, enviaremos uma mensagem nos próximos dias para saber se o atendimento atendeu as suas expectativas.", type: 'tel', placeholder: "(XX) XXXXX-XXXX", required: true, inputMode: 'numeric' },
        { id: 'avaliacao_ux', question: "Como você avalia sua experiência ao preencher este questionário?", subtitle: "Seu feedback nos ajuda a melhorar!", type: 'rating', required: true },
        { id: 'agradecimento', type: 'thank-you', question: "Obrigado pelo seu feedback, [NOME]!", subtitle: "Sua jornada de cuidado está prestes a começar." },
        { id: 'final', type: 'final', question: "Tudo pronto, [NOME]!", subtitle: "Estamos cruzando suas respostas para encontrar as conexões mais significativas. Em instantes, você verá suas recomendações."},
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
            case 'text': case 'tel':
                const inputModeAttr = questionData.inputMode ? `inputmode="${questionData.inputMode}"` : '';
                const autocompleteAttr = questionData.autocomplete ? `autocomplete="${questionData.autocomplete}"` : '';
                contentHTML = `<div class="input-wrapper"><input type="${questionData.type}" id="input-${questionData.id}" class="text-input" placeholder="${questionData.placeholder}" ${inputModeAttr} ${autocompleteAttr}>
                <span class="enter-hint">Pressione <strong>Enter ↵</strong></span></div>`; 
                if (questionData.footer) {
                    contentHTML += `<p style="margin-top: 12px; font-size: 0.85rem; opacity: 0.8; text-align: center; line-height: 1.4;">${questionData.footer}</p>`;
                }
                break; 
            case 'choice': case 'multiple-choice': 
                const choicesClass = questionData.scrollable ? 'choices-container scrollable' : 'choices-container'; 
                const buttonClass = questionData.type === 'multiple-choice' ? 'choice-button multi-choice' : 'choice-button'; 
                contentHTML = `<div class="${choicesClass}">${questionData.choices.map(choice => `<button class="${buttonClass}" data-value="${choice}">${choice}</button>`).join('')}</div>`; 
                break;
            case 'rating':
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
            if(questionData.id === 'whatsapp') { buttonText = "Ver Avaliação"; }
            if(questionData.type === 'rating') { buttonText = "Finalizar"; buttonAction = "finalize"; } // Botão Finalizar
            
            nextButtonHTML = `<button class="cta-button" data-action="${buttonAction}">${buttonText}</button>`; 
        } else if (questionData.type === 'error') { 
            navHTML = `<a href="index.html" class="cta-button">${questionData.buttonText}</a>`; 
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
            const { nome, whatsapp, ...demandAnswers } = userAnswers;
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
            const { nome, whatsapp, ...demandAnswers } = userAnswers;
            
            // [NOVO] Salva o telefone para usar no clique do WhatsApp (mesmo se não logar)
            if (whatsapp) localStorage.setItem('yelo_guest_phone', whatsapp);
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
        if (currentSlide) currentSlide.classList.remove('active'); 
        
        currentStep = index; 
        const nextSlide = document.querySelector(`[data-index="${currentStep}"]`); 
        
        if (nextSlide) {
            nextSlide.classList.add('active'); 

            // --- CORREÇÃO DE SCROLL ---
            // Garante que a tela suba para o topo ao trocar de pergunta
            window.scrollTo(0, 0);
            const slideBody = nextSlide.querySelector('.slide-body');
            if (slideBody) slideBody.scrollTop = 0;
        } else {
            console.error(`Slide com index ${index} não encontrado.`); 
        }
        
        updateProgressBar(); 
        
        // --- PROTEÇÃO OFFLINE (IMask) ---
        // Só tenta criar máscaras se a biblioteca IMask tiver carregado
        if (typeof IMask !== 'undefined') {
            const currentQuestion = questions[currentStep]; 
            if (currentQuestion && currentQuestion.type === 'tel') { 
                const phoneInput = document.getElementById(`input-${currentQuestion.id}`); 
                if (phoneInput) IMask(phoneInput, { mask: '(00) 00000-0000' }); 
            } else if (currentQuestion && currentQuestion.id === 'cep') { 
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
        if (['text', 'tel'].includes(question.type)) { 
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
        
        if (!currentQuestion.required) { 
            collectAnswer(); 
            goToSlide(currentStep + 1); 
            return; 
        } 
        
        let isValid = true; 
        
        if (['text', 'tel'].includes(currentQuestion.type)) { 
            const input = document.getElementById(`input-${currentQuestion.id}`); 
            if (input.value.trim() === '') { 
                input.classList.add('shake-error'); setTimeout(() => input.classList.remove('shake-error'), 500); isValid = false; 
            } 
            if (currentQuestion.type === 'tel' && input.value.length < 15) { 
                input.classList.add('shake-error'); setTimeout(() => input.classList.remove('shake-error'), 500); isValid = false; 
            } 
        } else if (['choice', 'multiple-choice'].includes(currentQuestion.type)) { 
            if (currentSlideEl.querySelectorAll('.choice-button.selected').length === 0) { 
                const btnToShake = currentSlideEl.querySelector('.cta-button') || currentSlideEl.querySelector('.choices-container'); 
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
                    const parent = target.closest('.choices-container'); 
                    parent.querySelectorAll('.choice-button').forEach(btn => btn.classList.remove('selected')); 
                    target.classList.add('selected'); 
                    collectAnswer(); 

                    // --- LÓGICA DE IDADE ---
                    if (currentQuestion.id === 'idade' && target.dataset.value === 'Menor de 18 anos') {
                        sessionStorage.setItem('Yelo_user_name', userAnswers.nome || ''); 
                        window.location.href = '/menor_de_idade';
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
                        setTimeout(() => goToSlide(proximoPasso), 250);
                    } 
                } 
            } 
            
            // NOTA: A lógica de auto-avançar ao clicar nas estrelas foi REMOVIDA
            // para permitir que o usuário escreva no campo de texto.
        }); 
        
        slidesContainer.addEventListener('keydown', (e) => { 
            if (e.key === 'Enter' && e.target.matches('.text-input')) { 
                e.preventDefault(); 
                validateAndAdvance(); 
            } 
        }); 

        // [NOVO] Salva o WhatsApp em tempo real para garantir que não se perca
        slidesContainer.addEventListener('input', (e) => {
            if (e.target.id === 'input-whatsapp') {
                localStorage.setItem('yelo_guest_phone', e.target.value);
            }
            if (e.target.id === 'input-nome') {
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
        const allSlides = document.querySelectorAll('.slide'); 
        allSlides.forEach(slide => { 
            const title = slide.querySelector('h1'); 
            const subtitle = slide.querySelector('p.subtitle'); 
            if (title && title.innerHTML.includes('[NOME]')) { 
                title.innerHTML = title.innerHTML.replace(/\[NOME\]/g, name); 
            } 
            if (subtitle && subtitle.innerHTML.includes('[NOME]')) { 
                subtitle.innerHTML = subtitle.innerHTML.replace(/\[NOME\]/g, name); 
            } 
        }); 
    }
});
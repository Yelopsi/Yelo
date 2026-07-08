/**
 * Arquivo: questionario_ui.js
 * Responsabilidade: Isolar a fábrica de interface (geração de HTML) do questionário.
 */
window.QuestionarioUI = (function() {
    return {
        createSlideHTML: function(questionData, index, isFirstStep) { 
            let contentHTML = '', navHTML = ''; 
            
            switch (questionData.type) { 
                case 'text': case 'tel': {
                    const inputModeAttr = questionData.inputMode ? `inputmode="${questionData.inputMode}"` : '';
                    const autocompleteAttr = questionData.autocomplete ? `autocomplete="${questionData.autocomplete}"` : '';
                    const autofocusAttr = questionData.autofocus ? 'autofocus' : '';
                    const enterHintAttr = questionData.id === 'nome' ? 'enterkeyhint="go"' : 'enterkeyhint="next"';
                    
                    contentHTML = `<form onsubmit="return false;" class="input-wrapper" style="margin: 0; width: 100%;"><input type="${questionData.type}" id="input-${questionData.id}" class="text-input" placeholder="${questionData.placeholder}" ${inputModeAttr} ${autocompleteAttr} ${autofocusAttr} ${enterHintAttr}>
                    <span class="enter-hint">Pressione <strong>Enter ↵</strong></span></form>`; 
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
                case 'error':
                    contentHTML = '';
                    break;
                case 'final':
                    contentHTML = '<div class="loader-wrapper" style="margin-top: 30px;"><div class="loader-spinner"></div></div>';
                    break;
                default: 
                    contentHTML = ''; 
            } 
            
            const backButtonHTML = !isFirstStep && !['welcome', 'final', 'error', 'thank-you'].includes(questionData.type) ? `<button class="back-button">← Voltar</button>` : ''; 
            let nextButtonHTML = ''; 

            if (questionData.type === 'welcome') { 
                nextButtonHTML = `<button class="cta-button" data-action="next">Vamos começar</button>`; 
            } else if (['text', 'tel', 'multiple-choice', 'rating', 'info'].includes(questionData.type)) { 
                let buttonText = "Avançar";
                let buttonAction = "next";
                if(questionData.id === 'nome') { buttonText = "Encontrar meu psi"; buttonAction = "finalize"; }
                if(questionData.type === 'rating') { buttonText = "Finalizar"; buttonAction = "finalize"; }
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
    };
})();
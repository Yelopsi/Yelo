// Arquivo: /cadastro/psi-cadastro.js (AJUSTADO PARA 5 ETAPAS)

document.addEventListener('DOMContentLoaded', () => {
    let currentStep = 0;
    const slides = document.querySelectorAll('.slide');
    const progressBarFill = document.querySelector('.progress-bar-fill');
    const userAnswers = {};

    function updateProgressBar() {
        const progress = ((currentStep + 1) / 5) * 100; // AGORA SÃO 5 ETAPAS
        progressBarFill.style.width = `${progress}%`;
    }

    function goToSlide(slideId) {
        const newSlide = document.getElementById(slideId);
        if (newSlide) {
            const currentActiveSlide = document.querySelector('.slide.active');
            if (currentActiveSlide) currentActiveSlide.classList.remove('active');
            newSlide.classList.add('active');
            
            slides.forEach((slide, index) => { if (slide.id === slideId) currentStep = index; });
            updateProgressBar();
        }
    }

    function validateStep(stepIndex) {
        const slide = slides[stepIndex];
        let isValid = true;
        slide.querySelectorAll('input[required]').forEach(input => {
            if (input.value.trim() === '') { isValid = false; input.classList.add('shake-error'); }
            if (input.type === 'email' && !/^\S+@\S+\.\S+$/.test(input.value)) { isValid = false; input.classList.add('shake-error'); }
        });
        const singleChoiceGroup = slide.querySelector('.choices-container:not([data-question*="topics"]):not([data-question*="approaches"]):not([data-question*="affirmativePractices"])');
        if (singleChoiceGroup && !singleChoiceGroup.querySelector('.choice-button.selected')) { isValid = false; singleChoiceGroup.classList.add('shake-error'); }
        slide.querySelectorAll('.choices-container[data-question]').forEach(group => {
            if (group.querySelectorAll('.multi-choice.selected').length === 0) { isValid = false; group.classList.add('shake-error'); }
        });
        setTimeout(() => { slide.querySelectorAll('.shake-error').forEach(el => el.classList.remove('shake-error')); }, 600);
        return isValid;
    }

    function collectAnswers() {
        document.querySelectorAll('input[name]').forEach(input => { userAnswers[input.name] = input.value; });
        document.querySelectorAll('.choices-container[data-question]').forEach(group => {
            const question = group.dataset.question;
            const selected = [];
            group.querySelectorAll('.choice-button.selected').forEach(btn => { selected.push(btn.dataset.value); });
            userAnswers[question] = group.querySelector('.multi-choice') ? selected : selected[0];
        });
    }
    
    async function checkDemand() {
        console.log("Enviando dados para verificação de demanda:", userAnswers);
        const checkButton = document.querySelector('.slide.active [data-action="check"]');
        checkButton.textContent = 'Verificando...';
        checkButton.disabled = true;
        await new Promise(resolve => setTimeout(resolve, 2000));
        const hasVacancy = true; 
        if (hasVacancy) { goToSlide('slide-vaga-disponivel'); } 
        else { goToSlide('slide-lista-espera'); }
    }

    document.querySelector('.questionario-container').addEventListener('click', (e) => {
        const target = e.target;
        if (target.matches('[data-action="next"]')) { if (validateStep(currentStep)) { goToSlide(slides[currentStep + 1].id); } }
        if (target.matches('[data-action="prev"]')) { goToSlide(slides[currentStep - 1].id); }
        if (target.matches('.choice-button')) {
            const isMulti = target.classList.contains('multi-choice');
            const group = target.closest('.choices-container');
            if (isMulti) {
                const question = group.dataset.question;
                const maxSelections = (question === 'topics') ? 5 : 100;
                if (target.classList.contains('selected')) { target.classList.remove('selected'); } 
                else if (group.querySelectorAll('.selected').length < maxSelections) { target.classList.add('selected'); } 
                else { alert(`Você pode selecionar no máximo ${maxSelections} opções.`); }
            } else {
                group.querySelectorAll('.choice-button').forEach(btn => btn.classList.remove('selected'));
                target.classList.add('selected');
                // Auto-avança para perguntas de escolha única
                setTimeout(() => { goToSlide(slides[currentStep + 1].id); }, 250);
            }
        }
        if (target.matches('[data-action="check"]')) { if (validateStep(currentStep)) { collectAnswers(); checkDemand(); } }
    });

    const crpInput = document.getElementById('crp');
    if(crpInput) { IMask(crpInput, { mask: '00/000000' }); }
    updateProgressBar();
});
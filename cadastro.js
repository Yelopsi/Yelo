document.addEventListener('DOMContentLoaded', () => {
    const slides = document.querySelectorAll('.slide');
    const progressBarFill = document.getElementById('progress-bar-fill');
    let currentSlide = 0;
    const totalSlides = slides.length;
    const formData = {};

    function updateProgressBar() {
        const progress = ((currentSlide + 1) / totalSlides) * 100;
        progressBarFill.style.width = `${progress}%`;
    }

    function showSlide(slideIndex) {
        slides.forEach((slide, index) => {
            slide.classList.toggle('active', index === slideIndex);
        });
        currentSlide = slideIndex;
        updateProgressBar();
        checkNextButtonState(slides[slideIndex]);
    }

    function checkNextButtonState(slide) {
        const nextButton = slide.querySelector('[data-action="next"]');
        if (!nextButton) return;

        const input = slide.querySelector('input[required]');
        if (input) {
            const isInputValid = input.value.trim() !== '' && (!input.minlength || input.value.length >= input.minlength);
            nextButton.disabled = !isInputValid;
        }
    }

    function handleNext() {
        const currentSlideElement = slides[currentSlide];
        const input = currentSlideElement.querySelector('input[required]');

        // Validação para campos de texto obrigatórios
        if (input) {
            if (input.value.trim() === '') {
                alert('Este campo é obrigatório.');
                return;
            }
            if (input.type === 'email' && !/^\S+@\S+\.\S+$/.test(input.value)) {
                alert('Por favor, insira um e-mail válido.');
                return;
            }
            if (input.minlength && input.value.length < input.minlength) {
                alert(`A senha deve ter no mínimo ${input.minlength} caracteres.`);
                return;
            }
            formData[input.id] = input.value;
        }

        if (currentSlide < totalSlides - 1) {
            showSlide(currentSlide + 1);
        } else {
            // Lógica de finalização do formulário
            console.log('Formulário concluído:', formData);
            alert('Cadastro finalizado! (Ver console para dados)');
            // Aqui você faria a chamada para a API para registrar o psicólogo
        }
    }

    function handlePrev() {
        if (currentSlide > 0) {
            showSlide(currentSlide - 1);
        }
    }

    slides.forEach((slide, index) => {
        // Lógica para botões de avançar e voltar
        const nextButton = slide.querySelector('[data-action="next"]');
        const prevButton = slide.querySelector('[data-action="prev"]');

        if (nextButton) {
            nextButton.addEventListener('click', handleNext);
        }
        if (prevButton) {
            prevButton.addEventListener('click', handlePrev);
        }

        // Lógica para campos de input obrigatórios
        const input = slide.querySelector('input[required]');
        if (input) {
            input.addEventListener('input', () => checkNextButtonState(slide));
        }

        // Lógica para avanço automático em questões de seleção única
        if (slide.dataset.type === 'single-choice') {
            const choiceButtons = slide.querySelectorAll('.choice-button');
            choiceButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const key = slide.dataset.slideId === '4' ? 'modalidade_atendimento' : slide.querySelector('h1').innerText;
                    formData[key] = button.dataset.value;
                    
                    // Adiciona um pequeno delay para o usuário ver a seleção
                    setTimeout(() => {
                        handleNext();
                    }, 300);
                });
            });
        }
    });

    // Inicializa o questionário
    showSlide(0);
});
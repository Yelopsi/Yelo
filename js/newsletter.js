document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('newsletter-form');
    if (!form) return;

    const emailInput = document.getElementById('newsletter-email');
    const consentCheckbox = document.getElementById('newsletter-consent');
    const submitBtn = document.getElementById('newsletter-submit-btn');
    const messageEl = document.getElementById('newsletter-message');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!consentCheckbox.checked) {
            showMessage('Você precisa aceitar receber comunicações.', 'erro');
            return;
        }

        const email = emailInput.value;
        const originalBtnText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = '...';

        try {
            const response = await fetch('/api/newsletter/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, origin: 'rodape' })
            });

            const data = await response.json();

            if (response.ok) {
                showMessage(data.message, 'sucesso');
                form.reset(); // Limpa o formulário
            } else {
                throw new Error(data.message || 'Ocorreu um erro.');
            }
        } catch (error) {
            showMessage(error.message, 'erro');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
    });

    function showMessage(text, type) {
        messageEl.textContent = text;
        messageEl.className = `mensagem-newsletter ${type}`; // Remove 'mensagem-oculta' e adiciona as novas classes
    }
});
document.addEventListener('DOMContentLoaded', () => {
    let deferredPrompt;
    const installButtonContainer = document.getElementById('pwa-install-banner');
    const installButton = document.getElementById('pwa-install-button');

    window.addEventListener('beforeinstallprompt', (e) => {
        // Previne o mini-infobar de aparecer no Chrome
        e.preventDefault();
        
        // Verifica a trava de 7 dias do localStorage
        const lastDismissed = localStorage.getItem('yelo_pwa_dismissed_at');
        const now = new Date().getTime();
        const DIAS_7_EM_MS = 7 * 24 * 60 * 60 * 1000;
        if (lastDismissed && (now - parseInt(lastDismissed)) <= DIAS_7_EM_MS) {
            return; // Se ainda não passaram 7 dias, ignora o prompt nativo
        }
        
        // Guarda o evento para que possa ser acionado mais tarde.
        deferredPrompt = e;
        // Mostra nosso banner de instalação customizado
        if (installButtonContainer) {
            installButtonContainer.style.display = 'block';
        }
        console.log(`'beforeinstallprompt' foi disparado.`);
    });

    if (installButton) {
        installButton.addEventListener('click', async () => {
            console.log('Botão de instalação clicado.');
            // Esconde nosso banner
            installButtonContainer.style.display = 'none';
            // Mostra o prompt de instalação nativo
            deferredPrompt.prompt();
            // Espera o usuário responder ao prompt
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`Resposta do usuário: ${outcome}`);
            // Não precisaremos mais do prompt, limpamos a variável
            deferredPrompt = null;
        });
    }

    window.addEventListener('appinstalled', () => {
        // Esconde o banner de instalação se o app for instalado
        if (installButtonContainer) {
            installButtonContainer.style.display = 'none';
        }
        // Limpa o prompt
        deferredPrompt = null;
        console.log('PWA foi instalado');
    });
});
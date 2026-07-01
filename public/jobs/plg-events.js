// public/js/utils/plg-events.js

window.verificarConquistasPLG = function(user) {
    if (!user) return;
    const clicks = parseInt(user.whatsapp_clicks || 0, 10);
    const appearances = parseInt(user.profile_appearances || 0, 10); 
    
    const banner = document.getElementById('lead-plg-banner');
    const title = document.getElementById('lead-plg-title');
    
    if (clicks > 0 && user.status !== 'active' && !user.is_exempt) {
        if (banner && title) {
            title.innerText = `Opa, ${clicks} paciente(s) tentou falar com você! 💛`;
            banner.style.display = 'flex';
        }
    } else if (banner) {
        banner.style.display = 'none';
    }
    
    const hasSeenConfetti = user.badges && user.badges.hasSeenConfetti === true;
    
    let deveComemorar = false;
    if (clicks > 0 && !hasSeenConfetti) {
        deveComemorar = true;
    }
    
    if (deveComemorar && typeof confetti === 'function') {
        setTimeout(() => {
            confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#1B4332', '#FFEE8C', '#f59e0b'] });
            confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#1B4332', '#FFEE8C', '#f59e0b'] });
            
            // Grava no backend para nunca mais exibir
            fetch('/api/psychologists/me/confetti-seen', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('yelo_token_psi')}`
                }
            }).catch(err => console.error('Erro ao marcar confetti como visto:', err));
        }, 600);
    }
};
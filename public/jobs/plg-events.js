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
    
    const appKey = `Yelo_apps_count_${user.id}`;
    const clickKey = `Yelo_clicks_count_${user.id}`;
    const storedApps = parseInt(localStorage.getItem(appKey) || '0', 10);
    const storedClicks = parseInt(localStorage.getItem(clickKey) || '0', 10);
    
    let deveComemorar = false;
    if (appearances > 0 && storedApps === 0) deveComemorar = true;
    if (clicks > 0 && storedClicks === 0) deveComemorar = true;
    
    localStorage.setItem(appKey, appearances.toString());
    localStorage.setItem(clickKey, clicks.toString());
    
    if (deveComemorar && typeof confetti === 'function') {
        setTimeout(() => {
            confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#1B4332', '#FFEE8C', '#f59e0b'] });
            confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#1B4332', '#FFEE8C', '#f59e0b'] });
        }, 600);
    }
};
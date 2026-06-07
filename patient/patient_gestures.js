/**
 * Arquivo: patient_gestures.js
 * Responsabilidade: Controlar os gestos mobile (Pull to Refresh, Swipe Navigation) no painel do paciente.
 */

window.setupPullToRefresh = function() {
    if (window.innerWidth > 992) return; // Apenas Mobile

    const mainContent = document.querySelector('.dashboard-main');
    if (!mainContent) return;

    let ptrEl = document.querySelector('.ptr-element');
    if (!ptrEl) {
        ptrEl = document.createElement('div');
        ptrEl.className = 'ptr-element';
        ptrEl.innerHTML = `
            <div class="ptr-spinner">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                </svg>
            </div>`;
        document.body.appendChild(ptrEl);
    }

    let startY = 0;
    let startX_ptr = 0;
    let currentY = 0;
    let isPulling = false;
    const threshold = 70;

    mainContent.addEventListener('touchstart', (e) => {
        if (mainContent.scrollTop <= 1) {
            startY = e.touches[0].clientY;
            startX_ptr = e.touches[0].clientX;
            isPulling = true;
            ptrEl.style.transition = 'none';
            ptrEl.classList.remove('ptr-refreshing');
        }
    }, { passive: true });

    mainContent.addEventListener('touchmove', (e) => {
        if (!isPulling) return;
        
        currentY = e.touches[0].clientY;
        const currentX = e.touches[0].clientX;
        const pullDistance = currentY - startY;
        const pullDistanceX = Math.abs(currentX - startX_ptr);

        // Cancela o PTR se o movimento for mais horizontal do que vertical
        if (pullDistanceX > Math.abs(pullDistance)) {
            isPulling = false;
            ptrEl.style.transform = 'translateY(-150%)';
            return;
        }

        if (pullDistance > 0 && mainContent.scrollTop <= 1) {
            if (e.cancelable) e.preventDefault();
            const resistance = pullDistance * 0.45;
            ptrEl.style.transform = `translateY(${Math.min(resistance, threshold + 20)}px)`;
            const svg = ptrEl.querySelector('svg');
            if (svg) svg.style.transform = `rotate(${pullDistance}deg)`;
        } else {
            isPulling = false;
        }
    }, { passive: false });

    mainContent.addEventListener('touchend', () => {
        if (!isPulling) return;
        isPulling = false;
        ptrEl.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
        const pullDistance = currentY - startY;

        if (pullDistance * 0.45 > threshold) {
            ptrEl.classList.add('ptr-refreshing');
            ptrEl.style.transform = `translateY(${threshold / 1.5}px)`;
            if (typeof window.loadPage === 'function') window.loadPage(document.querySelector('.sidebar-nav li.active a')?.getAttribute('data-page') || 'patient_visao_geral.html');
            setTimeout(() => { ptrEl.style.transform = 'translateY(-150%)'; ptrEl.classList.remove('ptr-refreshing'); }, 300);
        } else {
            ptrEl.style.transform = 'translateY(-150%)';
        }
    });
};

window.setupSwipeNavigation = function() {
    if (window.innerWidth > 992) return; // Apenas Mobile

    const mainContent = document.querySelector('.dashboard-main');
    if (!mainContent) return;

    let startX = 0, startY = 0, currentX = 0;
    let isSwiping = false, swipeDirection = null;
    const edgeThreshold = 30; // Começa a no máximo 30px da borda
    const triggerThreshold = 80; // Distância mínima de arraste

    document.addEventListener('touchstart', (e) => {
        if (window.innerWidth > 992 || e.touches.length > 1) return;
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;

        // Proteção contra conflitos horizontais: Ignora se for calendário, input, tabela, slider ou carrossel
        const target = e.target;
        if (target.closest('input, textarea, select, .fc, .slider, .scrollable-x, .tabela-wrapper, .quality-grid')) return;

        if (startX <= edgeThreshold) {
            if (!window.appHistory || window.appHistory.length <= 1) return;
            isSwiping = true; swipeDirection = 'back';
            mainContent.style.transition = 'none';
        } else if (startX >= window.innerWidth - edgeThreshold) {
            if (!window.appForwardHistory || window.appForwardHistory.length === 0) return;
            isSwiping = true; swipeDirection = 'forward';
            mainContent.style.transition = 'none';
        }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (!isSwiping) return;
        currentX = e.touches[0].clientX; const currentY = e.touches[0].clientY;
        const deltaX = currentX - startX, deltaY = currentY - startY;

        // Aborta se o usuário deslizar verticalmente no meio do gesto lateral
        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 15) return abortSwipe();

        if (e.cancelable) e.preventDefault();
        
        // Desliza a página inteira para criar efeito app-like
        if (swipeDirection === 'back' && deltaX > 0) {
            mainContent.style.transform = `translateX(${deltaX}px)`;
            mainContent.style.opacity = 1 - (deltaX / window.innerWidth) * 0.4;
        } else if (swipeDirection === 'forward' && deltaX < 0) {
            mainContent.style.transform = `translateX(${deltaX}px)`;
            mainContent.style.opacity = 1 - (Math.abs(deltaX) / window.innerWidth) * 0.4;
        }
    }, { passive: false });

    function abortSwipe() {
        if (!isSwiping) return;
        isSwiping = false; swipeDirection = null;
        mainContent.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        mainContent.style.transform = 'translateX(0)';
        mainContent.style.opacity = '1';
    }

    document.addEventListener('touchend', () => {
        if (!isSwiping) return;
        const deltaX = swipeDirection === 'back' ? currentX - startX : startX - currentX;
        if (deltaX >= triggerThreshold) {
            mainContent.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
            mainContent.style.transform = swipeDirection === 'back' ? `translateX(${window.innerWidth}px)` : `translateX(-${window.innerWidth}px)`;
            mainContent.style.opacity = '0';
            
            setTimeout(() => {
                 if (swipeDirection === 'back') {
                    if (window.appHistory && window.appHistory.length > 1) {
                        const currentPage = window.appHistory.pop();
                        window.appForwardHistory.push(currentPage);
                        const prevPage = window.appHistory[window.appHistory.length - 1];
                        window.isHistoryNav = true;
                        if (typeof window.loadPage === 'function') window.loadPage(prevPage);
                    }
                } else {
                    if (window.appForwardHistory && window.appForwardHistory.length > 0) {
                        const nextPage = window.appForwardHistory.pop();
                        window.appHistory.push(nextPage);
                        window.isHistoryNav = true;
                        if (typeof window.loadPage === 'function') window.loadPage(nextPage);
                    }
                }
                setTimeout(() => {
                    mainContent.style.transition = 'none';
                    mainContent.style.transform = 'translateX(0)';
                    mainContent.style.opacity = '1';
                }, 300);
            }, 300);
        } else {
            abortSwipe();
        }
        isSwiping = false;
    });
};
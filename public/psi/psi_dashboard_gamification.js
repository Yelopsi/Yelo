/**
 * Arquivo: psi_dashboard_gamification.js
 * Responsabilidade: Renderizar as badges e barras de XP (Gamificação).
 */
window.renderSidebarBadges = function(user) {
    const container = document.getElementById('sidebar-badges-container');
    if (!container || !user) return;

    let badgesData = user.badges || {};
    const isMaxLevel = (user.authority_level === 'nivel_mentor' || (user.xp && user.xp >= 15000));

    if (isMaxLevel) {
        badgesData = {
            autentico: true,
            semeador: 'ouro',
            voz_ativa: 'ouro',
            pioneiro: true
        };
    }

    let html = '';
    const badgeInfo = {
        autentico: { emoji: '<svg width="1.2em" height="1.2em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle;"><path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.918-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.337 2.25c-.416-.165-.866-.25-1.336-.25-2.21 0-3.918 1.79-3.918 4 0 .495.084.965.238 1.4-1.273.65-2.148 2.02-2.148 3.6 0 1.46.758 2.746 1.9 3.42-.047.19-.074.385-.074.58 0 2.21 1.71 4.002 3.918 4.002.47 0 .92-.086 1.336-.25.52 1.335 1.828 2.25 3.337 2.25s2.816-.915 3.337-2.25c.416.164.866.25 1.336.25 2.21 0 3.918-1.792 3.918-4 0-.195-.027-.39-.074-.58 1.14-.675 1.9-1.96 1.9-3.42z" fill="#1B4332"/><path d="M16.97 8.47a1.5 1.5 0 0 1 0 2.12l-6.5 6.5a1.5 1.5 0 0 1-2.12 0l-3.5-3.5a1.5 1.5 0 1 1 2.12-2.12l2.44 2.44 5.44-5.44a1.5 1.5 0 0 1 2.12 0z" fill="white"/></svg>', title: 'Autêntico: Perfil 100% completo e verificado.' },
        semeador: { emoji: '🌱', title: 'Semeador: Produz conteúdo e educa a audiência.' },
        voz_ativa: { emoji: '💬', title: 'Voz Ativa: Acolhe e responde dúvidas na Comunidade.' },
        pioneiro: { emoji: '🏅', title: 'Pioneiro: Um dos primeiros membros da Yelo.' }
    };

    const badgeOrder = ['autentico', 'semeador', 'voz_ativa', 'pioneiro'];

    badgeOrder.forEach(key => {
        const badgeValue = badgesData[key];
        if (badgeValue) {
            const info = badgeInfo[key];
            let finalTitle = info.title;
            let cssClass = `badge-${key}`;

            if (typeof badgeValue === 'string') {
                const nivel = badgeValue;
                const label = nivel.charAt(0).toUpperCase() + nivel.slice(1);
                finalTitle = `${info.title} (Nível ${label})`;
                cssClass = `badge-${nivel}`;
            }

            html += `
                <div class="badge-item ${cssClass}" title="${finalTitle}">
                    <span class="badge-icon">${info.emoji}</span>
                </div>
            `;
        }
    });

    container.innerHTML = html;
};

window.updateGamificationWidgets = function(user, isOverview = false) {
    if (!user) return;

    const level = user.authority_level || 'nivel_iniciante';
    
    const levelMap = { 'nivel_iniciante': 'Iniciante', 'nivel_verificado': 'Verificado', 'nivel_ativo': 'Ativo', 'nivel_especialista': 'Especialista', 'nivel_mentor': 'Mentor' };
    const levelDisplaySidebar = document.getElementById('psi-sidebar-level');
    if(levelDisplaySidebar) {
        levelDisplaySidebar.innerHTML = `🔥 Nível: <strong>${levelMap[level] || 'Iniciante'}</strong>`;
    }

    const badges = user.badges || {};
    const currentXP = user.xp || 0;
    const progress = user.gamificationProgress || { blogPostCount: 0, forumActivityCount: 0, answerCount: 0 };

    const LEVELS = [
        { slug: 'nivel_iniciante',    min: 0,      label: 'Iniciante' },
        { slug: 'nivel_verificado',   min: 500,    label: 'Verificado' },
        { slug: 'nivel_ativo',        min: 1500,   label: 'Ativo' },
        { slug: 'nivel_especialista', min: 5000,   label: 'Especialista' },
        { slug: 'nivel_mentor',       min: 15000,  label: 'Mentor' }
    ];

    const currentLevelObj = LEVELS.find(l => l.slug === level) || LEVELS[0];
    const currentIdx = LEVELS.indexOf(currentLevelObj);
    const nextLevelObj = LEVELS[currentIdx + 1];
    
    const levelDisplay = document.getElementById('current-level-display');
    if(levelDisplay) levelDisplay.textContent = currentLevelObj.label;
    
    const xpBarFill = document.getElementById('xp-bar-fill');
    const xpProgressText = document.getElementById('xp-progress-text');
    const xpCurrentLabel = document.getElementById('xp-current-level-label');
    const xpNextLabel = document.getElementById('xp-next-level-label');

    if (nextLevelObj) {
        const xpForLevel = currentXP - currentLevelObj.min;
        const xpTotalForNext = nextLevelObj.min - currentLevelObj.min;
        const progressPercent = Math.min(100, (xpForLevel / xpTotalForNext) * 100);
        
        if(xpBarFill) xpBarFill.style.width = `${progressPercent}%`;
        if(xpProgressText) xpProgressText.textContent = `${currentXP} // ${nextLevelObj.min} XP`;
        if(xpCurrentLabel) xpCurrentLabel.textContent = `Nível ${currentIdx + 1}`;
        if(xpNextLabel) xpNextLabel.textContent = `Nível ${currentIdx + 2}`;
    } else { // Nível Máximo
        if(xpBarFill) xpBarFill.style.width = '100%';
        if(xpProgressText) xpProgressText.textContent = `${currentXP} XP`;
        if(xpCurrentLabel) xpCurrentLabel.textContent = `Nível ${currentIdx + 1}`;
        if(xpNextLabel) xpNextLabel.textContent = 'Máximo';
    }

    const nextLevelInfo = document.getElementById('next-level-info');
    const nextLevelText = document.getElementById('next-level-text');
    
    if (nextLevelInfo && nextLevelText) {
        let msg = "";
        if (nextLevelObj) {
            const xpFaltante = nextLevelObj.min - currentXP;
            
            if (isOverview) {
                msg = `Faltam <strong>${xpFaltante} XP</strong> para ${nextLevelObj.label}`;
            } else {
                msg = `Faltam <strong>${xpFaltante} XP</strong> para o nível <strong>${nextLevelObj.label}</strong>.`;
                if (level === 'nivel_iniciante') {
                    msg += "<br>Dica: Complete seu perfil para ganhar 500 XP de uma vez!";
                } else {
                    msg += "<br>Dica: Escreva um artigo (+50 XP) ou responda dúvidas (+20 XP).";
                }
            }
        } else {
            msg = "Parabéns! Você atingiu o nível máximo de autoridade na Yelo. Mantenha seu status com conteúdos de qualidade.";
            nextLevelInfo.style.background = "#FFFDE7";
            nextLevelInfo.style.borderColor = "#FDD835";
            nextLevelInfo.style.color = "#F57F17";
        }
        nextLevelText.innerHTML = msg;
    }

    const updateBadgeCard = (elementId, badgeLevel, currentCount, thresholds) => {
        const el = document.getElementById(elementId);
        if (!el) return;
        const statusEl = el.querySelector('.badge-status');
        const progressContainer = el.querySelector('.badge-progress-container');
        const progressBar = el.querySelector('.badge-progress-bar');
        const progressText = el.querySelector('.badge-progress-text');
        
        el.classList.remove('unlocked', 'locked', 'bronze', 'prata', 'ouro', 'unico');
        
        let finalLevel = badgeLevel;
        const isMaxLevel = (level === 'nivel_mentor' || currentXP >= 15000);

        if (isMaxLevel) {
            finalLevel = thresholds ? 'ouro' : 'unico';
            if (currentCount !== null && thresholds) currentCount = Math.max(currentCount, thresholds.ouro);
        } else if (thresholds && currentCount !== null) {
            if (currentCount >= thresholds.ouro) finalLevel = 'ouro';
            else if (currentCount >= thresholds.prata) finalLevel = 'prata';
            else if (currentCount >= thresholds.bronze) finalLevel = 'bronze';
        }

        let target, progressTextStr, progressPercentage;

        if (thresholds) {
            if (finalLevel === 'ouro') {
                target = thresholds.ouro;
                progressTextStr = `${Math.min(currentCount, target)}/${target} (Máximo)`;
                progressPercentage = 100;
            } else if (finalLevel === 'prata') {
                target = thresholds.ouro;
                progressTextStr = `${currentCount}/${target} para Ouro`;
                progressPercentage = (currentCount / target) * 100;
            } else if (finalLevel === 'bronze') {
                target = thresholds.prata;
                progressTextStr = `${currentCount}/${target} para Prata`;
                progressPercentage = (currentCount / target) * 100;
            } else { // Bloqueado
                target = thresholds.bronze;
                progressTextStr = `${currentCount}/${target} para Bronze`;
                progressPercentage = (currentCount / target) * 100;
            }
        }

        if (finalLevel) {
            el.classList.add('unlocked', typeof finalLevel === 'string' ? finalLevel : 'unico');
            if(statusEl) statusEl.textContent = typeof finalLevel === 'string' ? `${finalLevel.charAt(0).toUpperCase() + finalLevel.slice(1)}` : "Conquistado";
        } else {
            el.classList.add('locked');
            if(statusEl) statusEl.textContent = "Bloqueado";
        }

        if (progressContainer && thresholds) {
            progressContainer.style.display = 'block';
            if(progressBar) progressBar.style.width = `${Math.min(100, progressPercentage)}%`;
            if(progressText) progressText.textContent = progressTextStr;
        } else if (progressContainer) {
            progressContainer.style.display = 'block';
            if(progressBar) progressBar.style.width = finalLevel ? '100%' : '0%';
            if(progressText) progressText.textContent = finalLevel ? '1/1' : '0/1';
        }
    };

    const blogCount = progress.semeador || progress.blogPostCount || 0;
    const forumCount = progress.vozAtiva || progress.forumActivityCount || 0;
    const answersCount = progress.conselheiro || progress.answerCount || 0;

    updateBadgeCard('badge-semeador', badges.semeador, blogCount, { bronze: 1, prata: 5, ouro: 15 });
    updateBadgeCard('badge-voz-ativa', badges.voz_ativa, forumCount, { bronze: 10, prata: 50, ouro: 200 });
    updateBadgeCard('badge-conselheiro', badges.conselheiro, answersCount, { bronze: 10, prata: 50, ouro: 150 });
    
    updateBadgeCard('badge-autentico', badges.autentico, null, null);
    updateBadgeCard('badge-pioneiro', badges.pioneiro, null, null);
};
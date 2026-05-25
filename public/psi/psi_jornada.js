window.inicializarPaginaJornada = async () => {

    const API_BASE_URL = window.API_BASE_URL || 'http://localhost:3001';
    const token = localStorage.getItem('Yelo_token');

    if (!token) {
        return;
    }

    // --- DEFINIÇÕES DE NÍVEIS E BADGES (espelhando o backend) ---
    const LEVELS = [
        { slug: 'nivel_iniciante',    min: 0,      label: 'Membro Iniciante', next: 500 },
        { slug: 'nivel_verificado',   min: 500,    label: 'Psicólogo Verificado', next: 1500 },
        { slug: 'nivel_ativo',        min: 1500,   label: 'Perfil Ativo', next: 5000 },
        { slug: 'nivel_especialista', min: 5000,   label: 'Especialista Yelo', next: 15000 },
        { slug: 'nivel_mentor',       min: 15000,  label: 'Mentor // Top Voice', next: 15000 }
    ];

    const BADGE_REQUIREMENTS = {
        semeador:    { bronze: 1, prata: 5, ouro: 15, label: 'Semeador' },
        voz_ativa:   { bronze: 10, prata: 50, ouro: 200, label: 'Voz Ativa' },
        conselheiro: { bronze: 10, prata: 50, ouro: 150, label: 'Conselheiro' }
    };

    // --- FUNÇÕES DE ATUALIZAÇÃO DA UI ---

    function updateXpBar(currentXp, currentLevelSlug) {
        const currentLevel = LEVELS.find(l => l.slug === currentLevelSlug) || LEVELS[0];
        const nextLevel = LEVELS.find(l => l.min > currentXp) || currentLevel;
        
        // Lógica Absoluta: A barra mostra o progresso total em relação ao teto do próximo nível.
        // Evita a frustração visual da barra "zerar" quando o psicólogo sobe de nível.
        const progressPercentage = nextLevel.min > 0 ? (currentXp / nextLevel.min) * 100 : 100;

        document.getElementById('xp-bar-fill').style.width = `${Math.min(100, progressPercentage)}%`;
        document.getElementById('xp-progress-text').textContent = `${currentXp} // ${nextLevel.min} XP`;
        document.getElementById('current-level-display').textContent = currentLevel.label;
        document.getElementById('xp-current-level-label').textContent = currentLevel.label;
        document.getElementById('xp-next-level-label').textContent = nextLevel.label;
        
        if (currentLevel.slug === nextLevel.slug) {
            document.getElementById('next-level-text').innerHTML = `🏆 Incrível! Você alcançou o nível máximo de autoridade na Yelo. Continue inspirando nossa comunidade!`;
        } else {
            document.getElementById('next-level-text').innerHTML = `Você está a apenas <strong>${Math.max(0, nextLevel.min - currentXp)} XP</strong> de conquistar o nível <strong>${nextLevel.label}</strong>!`;
        }
    }

    function updateBadgeCard(badgeId, currentCount, currentLevel) {
        // O ID no HTML usa traços (badge-voz-ativa), então substituímos o underscore
        const card = document.getElementById(`badge-${badgeId.replace('_', '-')}`);
        if (!card) return;

        const requirements = BADGE_REQUIREMENTS[badgeId];
        let target, progressText, progressPercentage;

        if (currentLevel === 'ouro') {
            target = requirements.ouro;
            progressText = `${Math.min(currentCount, target)}/${target} (Máximo)`;
            progressPercentage = 100;
        } else if (currentLevel === 'prata') {
            target = requirements.ouro;
            progressText = `${currentCount}/${target} para Ouro`;
            progressPercentage = (currentCount / target) * 100;
        } else if (currentLevel === 'bronze') {
            target = requirements.prata;
            progressText = `${currentCount}/${target} para Prata`;
            progressPercentage = (currentCount / target) * 100;
        } else { // Bloqueado
            target = requirements.bronze;
            progressText = `${currentCount}/${target} para Bronze`;
            progressPercentage = (currentCount / target) * 100;
        }

        // Atualiza UI
        card.querySelector('.badge-progress-text').textContent = progressText;
        card.querySelector('.badge-progress-bar').style.width = `${Math.min(100, progressPercentage)}%`;

        card.classList.remove('locked', 'bronze', 'prata', 'ouro');
        
        const statusEl = card.querySelector('.badge-status');
        if (currentLevel) {
            card.classList.add('unlocked', currentLevel);
            if (statusEl) statusEl.innerHTML = `Nível ${currentLevel.charAt(0).toUpperCase() + currentLevel.slice(1)}`;
        } else {
            card.classList.add('locked');
            if (badgeId === 'pioneiro' && !currentLevel) { if (statusEl) statusEl.textContent = 'Legado'; }
            else { if (statusEl) statusEl.textContent = 'Bloqueado'; }
        }
    }

    function updateBooleanBadge(badgeId, isUnlocked) {
        const card = document.getElementById(`badge-${badgeId}`);
        if (!card) return;
        
        card.classList.remove('locked', 'unlocked');
        if (isUnlocked) {
            card.classList.add('unlocked', 'unico');
            card.querySelector('.badge-status').innerHTML = 'Conquistado 🎉';
            card.querySelector('.badge-progress-bar').style.width = '100%';
            card.querySelector('.badge-progress-text').textContent = '1/1';
        } else {
            card.classList.add('locked');
            if (badgeId === 'pioneiro') { card.querySelector('.badge-status').textContent = 'Legado'; }
            else { card.querySelector('.badge-status').textContent = 'Bloqueado'; }
            card.querySelector('.badge-progress-bar').style.width = '0%';
            card.querySelector('.badge-progress-text').textContent = '0/1';
        }
    }

    // --- LÓGICA PRINCIPAL ---
    try {
        const response = await fetch(`${API_BASE_URL}/api/psychologists/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Falha ao carregar dados do perfil.');

        const data = await response.json();

        const badges = data.badges || {};
        const progress = data.gamificationProgress || { blogPostCount: 0, forumActivityCount: 0, answerCount: 0 };

        // --- 1. Atualizar Barra de XP ---
        updateXpBar(data.xp || 0, data.authority_level || 'nivel_iniciante');

        // --- 2. Atualizar Badges de Perfil/Status (Booleanas) ---
        updateBooleanBadge('autentico', badges.autentico);
        updateBooleanBadge('pioneiro', badges.pioneiro);

        // --- 3. Atualizar Badges de Progressão (Busca contagens do backend) ---
        updateBadgeCard('semeador', progress.semeador || progress.blogPostCount || 0, badges.semeador);
        updateBadgeCard('voz_ativa', progress.vozAtiva || progress.forumActivityCount || 0, badges.voz_ativa);
        updateBadgeCard('conselheiro', progress.conselheiro || progress.answerCount || 0, badges.conselheiro);


    } catch (error) {
        document.getElementById('next-level-text').innerHTML = "<span style='color: #d32f2f;'>Não foi possível carregar seu progresso. Tente atualizar a página.</span>";
    }
};
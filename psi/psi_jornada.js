document.addEventListener('DOMContentLoaded', async () => {
    // Adiciona um log para confirmar que o script começou a ser executado
    console.log("--- psi_jornada.js: SCRIPT INICIADO ---");

    const API_BASE_URL = window.API_BASE_URL || 'http://localhost:3001';
    const token = localStorage.getItem('Yelo_token');

    if (!token) {
        console.error("psi_jornada.js: Token não encontrado. Abortando.");
        return;
    }

    // --- DEFINIÇÕES DE NÍVEIS E BADGES (espelhando o backend) ---
    const LEVELS = [
        { slug: 'nivel_iniciante',    min: 0,      label: 'Membro Iniciante', next: 500 },
        { slug: 'nivel_verificado',   min: 500,    label: 'Psicólogo Verificado', next: 1500 },
        { slug: 'nivel_ativo',        min: 1500,   label: 'Perfil Ativo', next: 5000 },
        { slug: 'nivel_especialista', min: 5000,   label: 'Especialista Yelo', next: 15000 },
        { slug: 'nivel_mentor',       min: 15000,  label: 'Mentor / Top Voice', next: 15000 }
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
        
        const xpForNextLevel = nextLevel.min - currentLevel.min;
        const xpProgress = currentXp - currentLevel.min;
        const progressPercentage = xpForNextLevel > 0 ? (xpProgress / xpForNextLevel) * 100 : 100;

        document.getElementById('xp-bar-fill').style.width = `${Math.min(100, progressPercentage)}%`;
        document.getElementById('xp-progress-text').textContent = `${currentXp} / ${nextLevel.min} XP`;
        document.getElementById('current-level-display').textContent = currentLevel.label;
        document.getElementById('xp-current-level-label').textContent = currentLevel.label;
        document.getElementById('xp-next-level-label').textContent = nextLevel.label;
        document.getElementById('next-level-text').textContent = `Faltam ${Math.max(0, nextLevel.min - currentXp)} XP para alcançar o nível de ${nextLevel.label}.`;
    }

    function updateBadgeCard(badgeId, currentCount, currentLevel) {
        const card = document.getElementById(`badge-${badgeId}`);
        if (!card) return;

        const requirements = BADGE_REQUIREMENTS[badgeId];
        let target, progressText, progressPercentage;

        if (currentLevel === 'ouro') {
            target = requirements.ouro;
            progressText = `${Math.min(currentCount, target)} / ${target}`;
            progressPercentage = 100;
        } else if (currentLevel === 'prata') {
            target = requirements.ouro;
            progressText = `${currentCount} / ${target}`;
            progressPercentage = (currentCount / target) * 100;
        } else if (currentLevel === 'bronze') {
            target = requirements.prata;
            progressText = `${currentCount} / ${target}`;
            progressPercentage = (currentCount / target) * 100;
        } else { // Bloqueado
            target = requirements.bronze;
            progressText = `${currentCount} / ${target}`;
            progressPercentage = (currentCount / target) * 100;
        }

        // Atualiza UI
        card.querySelector('.badge-progress-text').textContent = progressText;
        card.querySelector('.badge-progress-bar').style.width = `${Math.min(100, progressPercentage)}%`;

        card.classList.remove('locked', 'bronze', 'prata', 'ouro');
        if (currentLevel) {
            card.classList.add('unlocked', currentLevel);
            card.querySelector('.badge-status').textContent = currentLevel.charAt(0).toUpperCase() + currentLevel.slice(1);
        } else {
            card.classList.add('locked');
            card.querySelector('.badge-status').textContent = 'Bloqueado';
        }
    }

    function updateBooleanBadge(badgeId, isUnlocked) {
        const card = document.getElementById(`badge-${badgeId}`);
        if (!card) return;
        
        card.classList.remove('locked', 'unlocked');
        if (isUnlocked) {
            card.classList.add('unlocked', 'unico');
            card.querySelector('.badge-status').textContent = 'Conquistado';
            card.querySelector('.badge-progress-bar').style.width = '100%';
            card.querySelector('.badge-progress-text').textContent = '1/1';
        } else {
            card.classList.add('locked');
            card.querySelector('.badge-status').textContent = 'Bloqueado';
            card.querySelector('.badge-progress-bar').style.width = '0%';
            card.querySelector('.badge-progress-text').textContent = '0/1';
        }
    }

    // --- LÓGICA PRINCIPAL ---
    try {
        console.log("psi_jornada.js: Buscando dados da API...");
        const response = await fetch(`${API_BASE_URL}/api/psychologists/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Falha ao carregar dados do perfil.');

        const data = await response.json();
        console.log("psi_jornada.js: Dados recebidos:", data);

        const badges = data.badges || {};
        const progress = data.gamificationProgress || { blogPostCount: 0, forumActivityCount: 0, answerCount: 0 };

        // --- DEBUG VISUAL ---
        const debugPanel = document.getElementById('debug-panel');
        const debugOutput = document.getElementById('debug-output');
        if (debugPanel && debugOutput) {
            console.log("psi_jornada.js: Painel de debug encontrado. Exibindo dados.");
            debugPanel.style.display = 'block';
            // Exibe o objeto 'data' completo recebido da API
            debugOutput.textContent = JSON.stringify(data, null, 2);
        } else {
            console.error("psi_jornada.js: Elementos do painel de debug não encontrados no DOM.");
        }
        // --- FIM DEBUG ---

        // 1. Atualiza a barra de XP
        updateXpBar(data.xp || 0, data.authority_level || 'nivel_iniciante');

        // 2. Atualiza os cards de badges de progresso
        updateBadgeCard('semeador', progress.blogPostCount, badges.semeador);
        updateBadgeCard('voz_ativa', progress.forumActivityCount, badges.voz_ativa);
        updateBadgeCard('conselheiro', progress.answerCount, badges.conselheiro);

        // 3. Atualiza os cards de badges booleanos
        updateBooleanBadge('autentico', badges.autentico);
        updateBooleanBadge('pioneiro', badges.pioneiro);

    } catch (error) {
        console.error("Erro ao inicializar página de Jornada:", error);
        // Opcional: Mostrar mensagem de erro na tela
        const debugPanel = document.getElementById('debug-panel');
        if (debugPanel) {
            debugPanel.style.display = 'block';
            document.getElementById('debug-output').textContent = `ERRO: ${error.message}\n\nVerifique o console do navegador (F12) para mais detalhes.`;
        }
    }
});
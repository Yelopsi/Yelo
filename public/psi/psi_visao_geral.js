// Arquivo: psi_visao_geral.js
// Módulo responsável pela Visão Geral (Home) do Psicólogo

(function() {
    window.inicializarVisaoGeral = async function() {
        const API_BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : 'http://localhost:3001';
        const apiFetch = window.apiFetch;
        const showToast = window.showToast;
        const psychologistData = window.getPsychologistData();

        if (!psychologistData) return;

        // 1. Saudação Hero
        const welcomeEl = document.getElementById('psi-welcome-name');
        if (welcomeEl) {
            welcomeEl.textContent = `Olá, ${psychologistData.nome.split(' ')[0]}!`;
        }

        // Animação de carregamento geral nas métricas
        const elementsToLoad = ['hero-contacts', 'hero-views', 'kpi-whatsapp-clicks', 'kpi-profile-views', 'kpi-taxa-escolha', 'kpi-artigos', 'kpi-interacoes', 'agenda-hoje', 'faturamento-mes'];
        elementsToLoad.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '<span class="loading-spinner-sm" style="display:inline-block; border-color: rgba(27,67,50,0.2); border-top-color: var(--verde-escuro);"></span>';
        });

        try {
            const resStats = await apiFetch(`${API_BASE_URL}/api/psychologists/me/stats?period=last30days&t=${new Date().getTime()}`);
            const stats = resStats.ok ? await resStats.json() : {};
            
            console.log("📊 Dados de Stats recebidos do backend:", stats);

            const profileViews = stats.profileViews || stats.profileAppearances || 0;
            const matchImpressions = stats.matchImpressions > 0 ? stats.matchImpressions : profileViews;
            const whatsappClicks = stats.whatsappClicks || 0;

            if(document.getElementById('hero-contacts')) document.getElementById('hero-contacts').innerHTML = stats.last7DaysStats?.whatsappClicks > 0 ? `+${stats.last7DaysStats.whatsappClicks}` : '<span style="font-size: 1.1rem; opacity: 0.8; font-weight: 500;">Nenhum nesta semana</span>';
            if(document.getElementById('hero-views')) document.getElementById('hero-views').innerHTML = stats.last7DaysStats?.profileViews > 0 ? `+${stats.last7DaysStats.profileViews}` : '<span style="font-size: 1.1rem; opacity: 0.8; font-weight: 500;">Nenhuma nesta semana</span>';
            
            const realScore = stats.betterThanPercentage !== undefined ? stats.betterThanPercentage : 0;
            if(document.getElementById('hero-benchmark-text')) {
                document.getElementById('hero-benchmark-text').innerHTML = `Seu crescimento esse mês:`;
            }

            // Captura os dados globais injetados na primeira carga do painel
            const globalMatches = psychologistData.globalStats?.matches30d || 0;
            const globalClicks = psychologistData.globalStats?.clicks30d || 0;

            const patientsMetricsGroup = document.querySelector('.patients-metrics-group');
            if (patientsMetricsGroup) {
                patientsMetricsGroup.style.flexWrap = 'wrap';
                patientsMetricsGroup.innerHTML = `
                    <div class="p-metric" style="min-width: 45%; margin-bottom: 15px;">
                        <div class="p-metric-val" id="kpi-whatsapp-clicks">${stats.whatsappClicks || 0}</div>
                        <div class="p-metric-label">
                            Cliques no WhatsApp
                            <span class="info-tooltip" style="margin-left: 0; width: 16px; height: 16px;" data-tooltip="Total de pacientes que clicaram para falar com você no WhatsApp." tabindex="0"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg></span>
                        </div>
                    </div>
                    <div class="p-metric" style="min-width: 45%; margin-bottom: 15px;">
                        <div class="p-metric-val" id="kpi-match-impressions">${stats.matchImpressions || 0}</div>
                        <div class="p-metric-label">
                            Aparições no match
                            <span class="info-tooltip" style="margin-left: 0; width: 16px; height: 16px;" data-tooltip="Vezes que seu perfil foi recomendado na tela de resultados após o questionário." tabindex="0"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg></span>
                        </div>
                    </div>
                    <div class="p-metric" style="min-width: 45%; border-top: 1px solid #e9ecef; padding-top: 15px;">
                        <div class="p-metric-val" id="kpi-views-match">${stats.profileViewsMatch || 0}</div>
                        <div class="p-metric-label">
                            Visualizações pelo Match
                            <span class="info-tooltip" style="margin-left: 0; width: 16px; height: 16px;" data-tooltip="Quantas vezes abriram seu perfil clicando na lista de resultados." tabindex="0"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg></span>
                        </div>
                        <div style="font-size: 0.8rem; color: #16a34a; font-weight: bold; margin-top: 4px;">Conversão: ${stats.funnelRates?.matchToProfileViewRate || 0}%</div>
                    </div>
                    <div class="p-metric" style="min-width: 45%; border-top: 1px solid #e9ecef; padding-top: 15px;">
                        <div class="p-metric-val" id="kpi-views-direct">${stats.profileViewsDirect || 0}</div>
                        <div class="p-metric-label">
                            Visualizações Diretas
                            <span class="info-tooltip" style="margin-left: 0; width: 16px; height: 16px;" data-tooltip="Quantas vezes abriram seu perfil por outros meios (Busca Orgânica, Link Direto, Comunidade, Blog)." tabindex="0"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg></span>
                        </div>
                        <div style="font-size: 0.8rem; color: #16a34a; font-weight: bold; margin-top: 4px;">Conversão p/ WhatsApp: ${stats.funnelRates?.directViewToWhatsappRate || 0}%</div>
                    </div>

                    <!-- NOVO CARD DE OPORTUNIDADE DE DEMANDA -->
                    <div class="p-metric global-stats-card" style="width: 100%; margin-top: 20px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); padding: 15px; border-radius: 12px; border: 1px solid #bbf7d0; display: flex; align-items: center; gap: 15px;">
                        <div style="font-size: 2rem; display: flex; align-items: center; justify-content: center;">🔥</div>
                        <div style="text-align: left;">
                            <div style="color: #166534; font-size: 0.9rem; font-weight: 700; margin-bottom: 4px;">Oportunidades na Yelo</div>
                            <div style="color: #14532d; font-size: 0.85rem; line-height: 1.4;">
                                Nos últimos 30 dias, geramos <strong>${globalMatches} matches</strong> e <strong>${globalClicks} cliques</strong> no WhatsApp para perfis como o seu.
                            </div>
                        </div>
                    </div>
                `;
                if (!document.getElementById('patients-metrics-style')) {
                    const style = document.createElement('style');
                    style.id = 'patients-metrics-style';
                    style.innerHTML = `.patients-metrics-group .p-metric::after { display: none !important; }`;
                    document.head.appendChild(style);
                }
                
                if (typeof window.setupMobileBadgeTooltips === 'function') {
                    document.body.dataset.tooltipsSetup = '';
                    window.setupMobileBadgeTooltips();
                }
            }

            if(document.getElementById('psi-sidebar-growth-val')) {
                const growthRate = profileViews > 0 ? '+12%' : '+0%';
                document.getElementById('psi-sidebar-growth-val').textContent = growthRate;
            }
            
            const renderFriendlyZero = (value, fallbackText) => value > 0 ? value : `<span style="font-size: 1.2rem; color: #888;">${fallbackText}</span>`;
            
            if(document.getElementById('kpi-whatsapp-clicks')) document.getElementById('kpi-whatsapp-clicks').innerHTML = renderFriendlyZero(whatsappClicks, 'Ainda não');
            if(document.getElementById('kpi-profile-views')) document.getElementById('kpi-profile-views').innerHTML = renderFriendlyZero(profileViews, 'Nenhuma');
            if(document.getElementById('kpi-match-impressions')) document.getElementById('kpi-match-impressions').innerHTML = renderFriendlyZero(matchImpressions, 'Aguardando');
            if(document.getElementById('kpi-taxa-escolha')) {
                const convRate = stats.funnelRates?.profileConversion;
                if (convRate === undefined || convRate === null) {
                    document.getElementById('kpi-taxa-escolha').innerHTML = '<span style="font-size: 1.2rem; color: #888;">Em breve</span>';
                } else {
                    document.getElementById('kpi-taxa-escolha').textContent = `${convRate}%`;
                }
            }

            const progress = stats.gamificationProgress || psychologistData.gamificationProgress || {};
            const blogCount = progress.semeador || progress.blogPostCount || stats.blogPostCount || psychologistData.blogPostCount || 0;
            const forumCount = progress.vozAtiva || progress.forumActivityCount || stats.forumActivityCount || stats.forumPosts || psychologistData.forumActivityCount || 0;
            const answersCount = progress.conselheiro || progress.answerCount || stats.answerCount || psychologistData.answerCount || 0;
            const commentCount = stats.forumComments || 0;
            const interactions = forumCount + answersCount + commentCount;

            if(document.getElementById('kpi-artigos')) document.getElementById('kpi-artigos').innerHTML = renderFriendlyZero(blogCount, 'Nenhum');
            if(document.getElementById('kpi-interacoes')) document.getElementById('kpi-interacoes').innerHTML = renderFriendlyZero(interactions, 'Nenhuma');

            // Rastreador local de interações (Frontend Fallback para datas ausentes no Backend)
            const currentCounts = { blog: blogCount, forum: forumCount, comment: commentCount, answer: answersCount };
            let localDates = JSON.parse(localStorage.getItem('yelo_interaction_dates') || '{}');
            const storedCountsStr = localStorage.getItem('yelo_interaction_counts');

            if (!storedCountsStr) {
                localStorage.setItem('yelo_interaction_counts', JSON.stringify(currentCounts));
            } else {
                const storedCounts = JSON.parse(storedCountsStr);
                let datesUpdated = false;
                if (currentCounts.blog > (storedCounts.blog || 0)) { localDates.blog = new Date().toISOString(); datesUpdated = true; }
                if (currentCounts.forum > (storedCounts.forum || 0)) { localDates.forum = new Date().toISOString(); datesUpdated = true; }
                if (currentCounts.comment > (storedCounts.comment || 0)) { localDates.comment = new Date().toISOString(); datesUpdated = true; }
                if (currentCounts.answer > (storedCounts.answer || 0)) { localDates.answer = new Date().toISOString(); datesUpdated = true; }
                
                if (datesUpdated) {
                    localStorage.setItem('yelo_interaction_counts', JSON.stringify(currentCounts));
                    localStorage.setItem('yelo_interaction_dates', JSON.stringify(localDates));
                }
            }

            const interactionReminderCard = document.getElementById('interaction-reminder-card');
            if (interactionReminderCard) {
                if (blogCount > 0 || interactions > 0) {
                    interactionReminderCard.style.display = 'none';
                } else {
                    const lastDismissed = localStorage.getItem('yelo_interaction_dismissed_at');
                    const nowMs = new Date().getTime();
                    const seteDiasEmMs = 7 * 24 * 60 * 60 * 1000;
                    
                    if (lastDismissed && (nowMs - parseInt(lastDismissed)) < seteDiasEmMs) {
                        interactionReminderCard.style.display = 'none';
                    } else {
                        interactionReminderCard.style.display = 'block';
                        const btnDismiss = document.getElementById('btn-dismiss-interaction');
                        if (btnDismiss) {
                            btnDismiss.onclick = () => {
                                interactionReminderCard.style.display = 'none';
                                localStorage.setItem('yelo_interaction_dismissed_at', new Date().getTime().toString());
                            };
                        }
                    }
                }
            }

            const actionListContainer = document.querySelector('.modern-action-list');
            if (actionListContainer) {
                const hasPhoto = psychologistData.fotoUrl && !psychologistData.fotoUrl.includes('placehold.co');
                const hasBio = psychologistData.bio && psychologistData.bio.length > 150;
                const hasForumActivity = forumCount > 0;
                const hasArticle = blogCount > 0;
                const hasCpf = psychologistData.cpf && psychologistData.cpf.replace(/\D/g, '').length >= 11;
                const hasSpecialties = psychologistData.temas_atuacao && psychologistData.temas_atuacao.length > 0;

                const phase1Steps = [
                    { title: hasPhoto ? 'Foto profissional adicionada' : 'Adicionar uma foto profissional', impact: 'Obrigatório', completed: hasPhoto, url: 'psi_meu_perfil.html' },
                    { title: hasBio ? 'Biografia otimizada' : 'Escrever biografia (mín. 150 caracteres)', impact: 'Obrigatório', completed: hasBio, url: 'psi_meu_perfil.html' },
                    { title: hasCpf ? 'Documento validado' : 'Preencher CPF/CNPJ', impact: 'Obrigatório', completed: hasCpf, url: 'psi_meu_perfil.html' },
                    { title: hasSpecialties ? 'Especialidades definidas' : 'Definir temas de atuação', impact: 'Obrigatório', completed: hasSpecialties, url: 'psi_meu_perfil.html' }
                ];

                const phase2Steps = [
                    { title: hasForumActivity ? 'Primeira participação no fórum' : 'Responder a uma dúvida na comunidade', impact: 'Maior Visibilidade', completed: hasForumActivity, url: 'psi_forum.html' },
                    { title: hasArticle ? 'Primeiro artigo publicado' : 'Publicar seu primeiro artigo', impact: 'Autoridade', completed: hasArticle, url: 'psi_blog.html' }
                ];

                const isPhase1Completed = phase1Steps.every(s => s.completed);
                const isPhase2Completed = phase2Steps.every(s => s.completed);

                let stepsToRender = [];
                let headerTitle = "";
                let isAdvancedPhase = false;

                if (!isPhase1Completed) {
                    headerTitle = "🎯 Fase 1: Primeiros passos para os matches";
                    stepsToRender = phase1Steps;
                    stepsToRender.sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));
                } else if (!isPhase2Completed) {
                    headerTitle = "🚀 Fase 2: Próximos passos para crescer";
                    stepsToRender = phase2Steps;
                    stepsToRender.sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));
                } else {
                    isAdvancedPhase = true;
                    headerTitle = "🔄 Fase 3: Manutenção de Autoridade";
                    
                    const dateBlog = stats.lastInteractions?.blog || localDates.blog;
                    const dateForum = stats.lastInteractions?.forum || localDates.forum;
                    const dateComment = stats.lastInteractions?.comment || localDates.comment;
                    const dateAnswer = stats.lastInteractions?.answer || localDates.answer;

                    let diasSemArtigo = dateBlog ? Math.floor((new Date() - new Date(dateBlog)) / (1000 * 60 * 60 * 24)) : (stats.diasDesdeUltimoArtigo !== undefined ? stats.diasDesdeUltimoArtigo : 999);
                    
                    const interacoesForum = [
                        dateForum ? new Date(dateForum) : null,
                        dateComment ? new Date(dateComment) : null,
                        dateAnswer ? new Date(dateAnswer) : null
                    ].filter(d => d !== null && !isNaN(d.getTime()));
                    
                    let lastForumDate = interacoesForum.length > 0 ? new Date(Math.max.apply(null, interacoesForum)) : null;
                    let diasSemForum = lastForumDate ? Math.floor((new Date() - lastForumDate) / (1000 * 60 * 60 * 24)) : (stats.diasDesdeUltimaInteracao !== undefined ? stats.diasDesdeUltimaInteracao : 999);

                    // Fallback inteligente: Se o backend retornar null para as datas, o front-end busca as datas dos posts reais
                    if ((!dateBlog && diasSemArtigo === 999) || (!lastForumDate && diasSemForum === 999)) {
                        try {
                            const [resBlog, resForum] = await Promise.all([
                                apiFetch(`${API_BASE_URL}/api/psychologists/me/posts?page=1&limit=1`),
                                apiFetch(`${API_BASE_URL}/api/forum/posts?filter=meus_posts&limit=1`)
                            ]);
                            
                            if (resBlog.ok) {
                                const blogPosts = await resBlog.json();
                                if (blogPosts && blogPosts.length > 0) {
                                    diasSemArtigo = Math.floor((new Date() - new Date(blogPosts[0].createdAt)) / (1000 * 60 * 60 * 24));
                                }
                            }
                            
                            if (resForum.ok) {
                                const forumPosts = await resForum.json();
                                if (forumPosts && forumPosts.length > 0) {
                                    diasSemForum = Math.floor((new Date() - new Date(forumPosts[0].createdAt)) / (1000 * 60 * 60 * 24));
                                }
                            }
                        } catch(e) {
                            console.error("Erro no fallback de datas de interações:", e);
                        }
                    }

                    const hasRecentArticle = diasSemArtigo <= 7;
                    const hasRecentForum = diasSemForum <= 7;

                    stepsToRender.push({ title: hasRecentForum ? 'Você marcou presença na comunidade recentemente!' : 'Já deu uma passada no fórum essa semana?', impact: hasRecentForum ? 'Em dia!' : 'Comunidade', completed: hasRecentForum, url: 'psi_forum.html', isRecurring: true });
                    stepsToRender.push({ title: hasRecentArticle ? 'Seu último artigo está fresquinho!' : 'Alguma ideia em mente? Que tal fazer um post no blog', impact: hasRecentArticle ? 'Em dia!' : 'Autoridade', completed: hasRecentArticle, url: 'psi_blog.html', isRecurring: true });
                    
                    const impressions = stats.matchImpressions || 0;
                    const views = stats.profileViews || 0;
                    const clicks = stats.whatsappClicks || 0;
                    const myPrice = psychologistData.valor_sessao_numero || 0;
                    const viewToClickRate = views > 0 ? (clicks / views) : 0;

                    if (impressions >= 10 && (views / impressions) < 0.15) {
                        stepsToRender.push({ title: 'Ajustar o início do seu texto de bio para melhorar a taxa de clique no seu perfil', impact: 'Maior Conversão', completed: false, url: 'psi_meu_perfil.html', isTip: true });
                    } else if (views >= 10 && viewToClickRate >= 0.25 && myPrice > 0 && myPrice < 130) {
                        stepsToRender.push({ title: 'Sua conversão está excelente! Considere reajustar o valor da sessão para valorizar sua hora clínica', impact: 'Mais Faturamento', completed: false, url: 'psi_meu_perfil.html', isTip: true });
                    } else if (views >= 10 && viewToClickRate < 0.10 && myPrice > 160) {
                        stepsToRender.push({ title: 'Muitas visitas, mas poucos contatos. Considere reduzir o valor da sessão temporariamente para atrair pacientes', impact: 'Mais Contatos', completed: false, url: 'psi_meu_perfil.html', isTip: true });
                    } else if (views >= 5 && viewToClickRate < 0.15) {
                        stepsToRender.push({ title: 'Ajustar sua página pública e foto para passar mais confiança e receber mais chamadas', impact: 'Mais Contatos', completed: false, url: 'psi_meu_perfil.html', isTip: true });
                    }

                    stepsToRender.push({ title: 'Gestão financeira e agenda revisadas', impact: 'Organização', completed: true, url: 'psi_financeiro.html', isRecurring: true });
                    
                    stepsToRender.sort((a, b) => {
                        if (a.isTip !== b.isTip) return a.isTip ? 1 : -1;
                        return a.completed === b.completed ? 0 : a.completed ? 1 : -1;
                    });
                }

                let totalTasks = 0;
                let completedForProgress = 0;
                
                const validTasks = stepsToRender.filter(s => !s.isTip && s.title !== 'Gestão financeira e agenda revisadas');
                totalTasks = validTasks.length;
                completedForProgress = validTasks.filter(s => s.completed).length;

                actionListContainer.innerHTML = '';
                
                const checklistCard = actionListContainer.closest('.modern-checklist-card');
                const titleEl = checklistCard ? checklistCard.querySelector('.checklist-title') : document.querySelector('.checklist-title');
                if (titleEl) titleEl.textContent = headerTitle;

                stepsToRender.forEach(step => {
                    const extraStyles = isAdvancedPhase && step.completed ? 'color: #888; text-decoration: none;' : '';
                    
                    const checkboxHtml = step.isTip 
                        ? `<div class="action-checkbox tip-icon" style="border: none; background: transparent; font-size: 1.2rem; display: flex; align-items: center; justify-content: center;">💡</div>`
                        : `<div class="action-checkbox">${step.completed ? '✓' : ''}</div>`;

                    const html = `
                        <a href="javascript:void(0);" data-target-url="${step.url}" class="modern-action-item ${step.completed ? 'completed' : ''} ${step.isTip ? 'tip-item' : ''}">
                            ${checkboxHtml}
                            <div class="action-content">
                                <h4 class="action-title" style="${extraStyles}">${step.title}</h4>
                                ${!step.completed || step.isTip
                                    ? `<span class="action-impact">${step.impact}</span>` 
                                    : (isAdvancedPhase ? `<p style="margin: 4px 0 0 0; font-size: 0.85rem; color: #888;">${step.impact}</p>` : '')
                                }
                            </div>
                        </a>
                    `;
                    actionListContainer.insertAdjacentHTML('beforeend', html);
                });

                if (!actionListContainer.dataset.listenerAttached) {
                    actionListContainer.dataset.listenerAttached = 'true';
                    actionListContainer.addEventListener('click', (e) => {
                        const item = e.target.closest('.modern-action-item');
                        if (item && item.dataset.targetUrl) {
                            e.preventDefault();
                            if (window.loadPage) window.loadPage(item.dataset.targetUrl);
                        }
                    });
                }

                const progressText = document.querySelector('.checklist-progress-text');
                const progressBar = document.querySelector('.checklist-progress-fill');
                if (progressText) progressText.textContent = isAdvancedPhase ? `${completedForProgress}/${totalTasks} em dia` : `${completedForProgress}/${totalTasks} concluídos`;
                if (progressBar) progressBar.style.width = `${totalTasks > 0 ? (completedForProgress / totalTasks) * 100 : 100}%`;
            }

            const feed = document.getElementById('notification-feed');
            const emptyState = document.getElementById('notifications-empty-state');
            
            if (feed) {
                const notifications = [];
                const diasInativo = stats.diasDesdeUltimaInteracao || (forumCount === 0 && blogCount === 0 ? 8 : 0);
                const novasInteracoes = stats.novasInteracoes || 0;

                if (diasInativo > 7) {
                    notifications.push({
                        type: 'reminder', icon: '🤔',
                        text: `Você não interage na comunidade há <strong>${diasInativo} dias</strong>. Que tal fortalecer sua presença?`,
                        time: 'Agora mesmo', link: 'psi_forum.html'
                    });
                }

                if (novasInteracoes > 0) {
                    notifications.push({
                        type: 'interaction', icon: '❤️',
                        text: `Suas publicações receberam <strong>${novasInteracoes} novas interações</strong>! Veja quem curtiu e respondeu.`,
                        time: 'Hoje', link: 'psi_forum.html?filter=meus_posts'
                    });
                }

                try {
                    const resAvisos = await apiFetch(`${API_BASE_URL}/api/psychologists/me/announcements?t=${new Date().getTime()}`);
                    if (resAvisos.ok) {
                        const allAvisos = await resAvisos.json();
                        const unreadAvisos = allAvisos.filter(a => !a.read).slice(0, 3);
                        
                        unreadAvisos.forEach(aviso => {
                            let icon = '🔔';
                            let type = 'interaction';
                            const lowerTitle = aviso.title.toLowerCase();
                            if (lowerTitle.includes('resposta') || lowerTitle.includes('comentário') || lowerTitle.includes('discussão')) {
                                icon = '💬';
                            } else if (lowerTitle.includes('instabilidade') || lowerTitle.includes('importante')) {
                                icon = '⚠️';
                                type = 'reminder';
                            }
                            
                            let cleanContent = aviso.content.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
                            if (cleanContent.length > 70) cleanContent = cleanContent.substring(0, 70) + '...';

                            let notifLink = 'psi_avisos.html';
                            const tempDiv = document.createElement('div');
                            tempDiv.innerHTML = aviso.content;
                            const linkDireto = tempDiv.querySelector('.aviso-link-direto');
                            if (linkDireto && linkDireto.dataset.postId) {
                                notifLink = `psi_forum.html?postId=${linkDireto.dataset.postId}`;
                            }

                            notifications.push({
                                type: type, 
                                icon: icon,
                                text: `<strong>${aviso.title}</strong><br><span style="font-size: 0.85rem; color: #666;">${cleanContent}</span>`,
                                time: new Date(aviso.createdAt).toLocaleDateString('pt-BR'),
                                link: notifLink 
                            });
                        });
                    }
                } catch (err) {}

                try {
                    const resQna = await apiFetch(`${API_BASE_URL}/api/psychologists/me/qna-unanswered-count`);
                    if (resQna.ok) {
                        const qnaData = await resQna.json();
                        if (qnaData.count > 0) {
                            notifications.push({
                                type: 'interaction', icon: '🙋🏽‍♀️',
                                text: `Existem <strong>${qnaData.count} novas perguntas</strong> da comunidade aguardando resposta.`,
                                time: 'Hoje', link: 'psi_comunidade.html'
                            });
                        }
                    }
                } catch (err) {}

                if (notifications.length > 0) {
                    if (emptyState) emptyState.style.display = 'none';
                    
                    Array.from(feed.children).forEach(child => {
                        if (child.id !== 'notifications-empty-state') child.remove();
                    });

                    notifications.forEach(notif => {
                        const item = document.createElement('a');
                        item.href = '#';
                        item.className = `notification-item type-${notif.type}`;
                        item.onclick = (e) => { e.preventDefault(); window.loadPage(notif.link); };
                        item.innerHTML = `
                            <div class="notification-icon">${notif.icon}</div>
                            <div class="notification-content">
                                <p>${notif.text}</p>
                                <span class="notification-time">${notif.time}</span>
                            </div>
                        `;
                        feed.appendChild(item);
                    });
                } else if (emptyState) {
                    emptyState.style.display = 'flex';
                }
            }

            try {
                const resAppts = await apiFetch(`${API_BASE_URL}/api/appointments`);
                if(resAppts.ok) {
                    const allAppts = await resAppts.json();
                    const todayStr = new Date().toLocaleDateString('pt-BR');
                    const todayAppts = allAppts.filter(a => new Date(a.start).toLocaleDateString('pt-BR') === todayStr && a.status !== 'available' && a.status !== 'cancelled');
                    if(document.getElementById('agenda-hoje')) {
                        document.getElementById('agenda-hoje').innerHTML = todayAppts.length > 0 ? `${todayAppts.length} atends.` : '<span style="color:#888; font-weight:normal; font-size:0.85rem;">Livre hoje</span>';
                    }
                }

                const currentMonthStr = new Date().toISOString().slice(0, 7);
                const resFin = await apiFetch(`${API_BASE_URL}/api/financials/dashboard?period=current`);
                if(resFin.ok) {
                    const finData = await resFin.json();
                    const income = (finData.appointments || []).filter(e => e.status === 'done').reduce((acc, curr) => acc + (curr.value || 0), 0);
                    if(document.getElementById('faturamento-mes')) {
                        document.getElementById('faturamento-mes').innerHTML = income > 0 ? `R$ ${income.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '<span style="color:#888; font-weight:normal; font-size:0.85rem;">Sem saldo</span>';
                    }
                }
            } catch(e) {
                if(document.getElementById('agenda-hoje')) document.getElementById('agenda-hoje').innerHTML = '<span style="color:#888; font-weight:normal; font-size:0.85rem;">Livre hoje</span>';
                if(document.getElementById('faturamento-mes')) document.getElementById('faturamento-mes').innerHTML = '<span style="color:#888; font-weight:normal; font-size:0.85rem;">Sem saldo</span>';
            }

            const patientsCardHeader = document.querySelector('.modern-patients-card .card-header-modern');
            if (patientsCardHeader && !patientsCardHeader.querySelector('.period-label')) {
                const periodLabel = document.createElement('span');
                periodLabel.className = 'period-label';
                periodLabel.style.cssText = 'font-size: 0.8rem; color: #666; margin-left: auto; align-self: center;';
                periodLabel.textContent = 'Últimos 30 dias';
                patientsCardHeader.appendChild(periodLabel);
            }

        } catch (error) {
            showToast('Não foi possível atualizar todas as métricas.', 'error');
        }
    };
})();
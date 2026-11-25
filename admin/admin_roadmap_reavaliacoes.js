// admin/admin_roadmap_reavaliacoes.js

window.initializePage = async function() {
    const baseUrl = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : 'http://localhost:3001';
    const token = localStorage.getItem('Yelo_token');
    const LOCAL_KEY = 'yelo_admin_roadmap_state_v1';

    const DEFAULT_ITEMS = [
        // --- 1. CHECKLIST DE LANÇAMENTO (JANEIRO) ---
        {
            id: 'launch-asaas-tokenize',
            group: 'launch',
            done: false,
            title: 'Habilitar Tokenização de Cartão no Asaas Produção',
            when: 'Antes do deploy (Janeiro)',
            tag: 'Crítico · Asaas',
            badgeClass: 'badge-critico',
            desc: 'Confirmar com o suporte/painel do Asaas Produção que POST /v3/creditCard/tokenizeCreditCard está habilitado na conta live para suportar os 7 dias grátis no Trimestral (3x R$ 129) e Semestral (6x R$ 99).',
            trigger: 'Sem tokenização ativa em produção, apenas o Mensal (D+7) funcionará com trial adiado.'
        },
        {
            id: 'launch-env-cutoff',
            group: 'launch',
            done: false,
            title: 'Configurar NEW_PRICING_LAUNCH_DATE nas variáveis do Render',
            when: 'Dia do deploy',
            tag: 'Crítico · Render',
            badgeClass: 'badge-lancamento',
            desc: 'Definir NEW_PRICING_LAUNCH_DATE (ex.: 2027-01-05T00:00:00Z) para distinguir assinantes legados dos novos entrantes e exibir corretamente o aviso de preço mantido.',
            trigger: 'Assinaturas anteriores à data mantêm o valor antigo no Asaas e exibem o valor real em #banner-preco.'
        },
        {
            id: 'launch-merge-webhook',
            group: 'launch',
            done: false,
            title: 'Merge feature/freemium-plan -> main e validar webhooks Asaas',
            when: 'Dia do deploy',
            tag: 'Deploy',
            badgeClass: 'badge-lancamento',
            desc: 'Publicar a branch na main, acompanhar o boot/sync no Render e verificar no log se /api/payments/webhook e o cron processTokenizedTrials() iniciaram sem erro.',
            trigger: 'Conferir GET /api/psychologists/me retornando globalStats e isLegacySubscriber.'
        },
        {
            id: 'launch-e2e-flows',
            group: 'launch',
            done: false,
            title: 'Testar os 3 fluxos do Plano Essencial em produção (Mensal, Trimestral e Semestral)',
            when: 'Dia do deploy (pós-subida)',
            tag: 'QA Produção',
            badgeClass: 'badge-lancamento',
            desc: 'Validar checkout Mensal (nextDueDate D+7), Trimestral/Semestral (tokenização trial_tok_* com zero cobrança imediata), cancelamento durante o trial e exibição para usuário Comunidade.',
            trigger: 'Garantir também que perfis Comunidade nunca apareçam nos resultados do Match.'
        },
        {
            id: 'launch-verify-legacy',
            group: 'launch',
            done: false,
            title: 'Conferir visão de um assinante legado no painel e em Minha Assinatura',
            when: 'Dia do deploy',
            tag: 'Retenção',
            badgeClass: 'badge-lancamento',
            desc: 'Validar que o assinante antigo vê #legacy-pricing-notice-banner no Dashboard, #legacy-subscriber-banner em Assinatura, preço real pago em #banner-preco e sem oferta de "7 dias grátis".',
            trigger: 'Zero surpresa ou susto com o novo valor de R$ 159 para quem já paga assinatura.'
        },

        // --- 2. AVALIAÇÕES AGENDADAS HOJE & REAVALIAÇÃO DA ESTRATÉGIA ---
        {
            id: 'rev-prod-3011-seo',
            group: 'reviews',
            done: false,
            title: '[Agendada 30/11] Revisão SEO & GSC (14 dias pós-sitemap e Blog/Perguntas)',
            when: '30/11/2026',
            targetDateIso: '2026-11-30T00:00:00-03:00',
            targetPage: 'admin_cmo_metrics.html',
            targetPageLabel: 'Abrir CMO Metrics (SEO)',
            tag: 'Agendada · 30/11',
            badgeClass: 'badge-hoje',
            desc: 'Avaliar indexação no Google Search Console (GSC), checar páginas de perguntas respondidas no sitemap e otimizar títulos do Blog e Perguntas com menor CTR.',
            trigger: 'Alertado hoje no card #card-alert-seo-review da Visão Geral.'
        },
        {
            id: 'rev-prod-0812-traffic',
            group: 'reviews',
            done: false,
            title: '[Agendada 08/12] Reavaliação Estratégica: Tráfego Pago & Motor V6.1',
            when: '08/12/2026',
            targetDateIso: '2026-12-08T00:00:00-03:00',
            targetPage: 'admin_cmo_metrics.html',
            targetPageLabel: 'Abrir CMO Metrics (Tráfego)',
            tag: 'Agendada · 08/12',
            badgeClass: 'badge-critico',
            desc: 'Avaliar impacto do Teto de CPC R$ 5,00 (Google Ads R$ 90/dia), CTA direto do WhatsApp em /resultados, Meta Ads (hold/retorno) e entrega do Motor V6.1 (100% blindado para tráfego pago).',
            trigger: 'Alertado hoje no card #card-alert-traffic-review da Visão Geral. Checar CPL Google Ads e evolução de no_contact.'
        },
        {
            id: 'rev-today-no-contact',
            group: 'reviews',
            done: false,
            title: '[Contínuo] Monitorar queda de no_contact e ghosted no WhatsApp',
            when: 'Contínuo (Nov–Dez/26)',
            targetPage: 'admin_cmo_metrics.html',
            targetPageLabel: 'Ver métricas no CMO',
            tag: 'Qualidade de Lead',
            badgeClass: 'badge-agendado',
            desc: 'Baseline observado: 30,9% de no_contact (264 de 854 registros) + 13,9% de ghosted (119). Avaliar efeito do botão direto em /resultados e remover atraso fetch/setTimeout em psi_perfil_publico.js.',
            trigger: 'Meta: derrubar no_contact de 30,9% para < 15% antes de acelerar verba em janeiro.'
        },
        {
            id: 'rev-d8-tokenization',
            group: 'reviews',
            done: false,
            title: 'Reavaliação D+8: Auditoria do 1º lote de cobrança pós-trial',
            when: 'D+8 após lançamento em Janeiro',
            tag: 'Reavaliação D+8',
            badgeClass: 'badge-agendado',
            desc: 'Analisar taxa de sucesso das cobranças geradas pelo cron processTokenizedTrials() no 8º dia, volume de cancelamentos entre D+1 e D+7 e possíveis recusas de cartão no D+8.',
            trigger: 'Se houver falhas técnicas no creditCardToken, acionar fallback e revisar mensagens antes de escalar.'
        },
        {
            id: 'rev-d30-strategy',
            group: 'reviews',
            done: false,
            title: 'Reavaliação D+30: Manter cartão no trial de 7 dias ou testar opt-in sem cartão?',
            when: 'D+30 pós-lançamento (Fevereiro)',
            tag: 'Marco Decisório · D+30',
            badgeClass: 'badge-critico',
            desc: 'Comparar conversão Trial -> Pagante contra o histórico sem cartão (~10%, 40 pagantes vs. 416 cadastros com CPF sem assinatura), share Semestral vs. Mensal, churn do 1º ciclo e payback do CAC.',
            trigger: 'Manter cartão se Trial -> Pagante >= 30–40%. Só considerar opt-in sem cartão por CPF único se o topo travar E CPL < R$ 15 + no_contact < 15%.'
        },
        {
            id: 'rev-d60-d90-scale',
            group: 'reviews',
            done: false,
            title: 'Reavaliação D+60 / D+90: Mix SEO Orgânico + Abertura do Plano Referência',
            when: 'Março–Abril (D+60 a D+90)',
            tag: 'Reavaliação Trimestral',
            badgeClass: 'badge-agendado',
            desc: 'Avaliar participação do tráfego orgânico (SEO/blog) nos cliques de WhatsApp, progresso rumo aos Marcos 70/120 pagantes e prontidão para lançar o Plano Referência (supervisão/intervisão e workshops).',
            trigger: 'Abrir pré-venda/turma piloto do Plano Referência ao estabilizar >= 70 pagantes ou forte demanda dos Essenciais ativos.'
        },

        // --- 3. IMPLEMENTAÇÕES FUTURAS ---
        {
            id: 'fut-wpp-sync-micro',
            group: 'future',
            done: false,
            title: 'Corrigir atraso no redirect do WhatsApp (psi_perfil_publico.js) + micro-compromisso',
            when: 'Próxima sprint (Pré-Janeiro)',
            tag: 'Conversão · Alta Prioridade',
            badgeClass: 'badge-futuro',
            desc: 'Remover await fetch + setTimeout(300–600ms) no clique para evitar bloqueio no iOS/in-app browser (usar sendBeacon + wa.me síncrono). Descontinuar Variante A genérica em whatsappController.js.',
            trigger: 'Reduzir desperdício imediato do investimento no Google Ads.'
        },
        {
            id: 'fut-gads-longtail',
            group: 'future',
            done: false,
            title: 'Reestruturar grupos de anúncio Google Ads para cauda longa por abordagem',
            when: 'Próxima sprint (Pré-Janeiro)',
            tag: 'Mídia Paga · Alta Prioridade',
            badgeClass: 'badge-futuro',
            desc: 'Separar grupos específicos (terapia TCC online, ansiedade, casal, psicanálise) com anúncios direcionados e teto de CPC nas head terms genéricas.',
            trigger: 'Deslocar verba dos cliques de R$ 7,50 para termos entre R$ 3,20 e R$ 6,00.'
        },
        {
            id: 'fut-plano-referencia',
            group: 'future',
            done: false,
            title: 'Construir fluxo de contratação e entrega do Plano Referência',
            when: 'Q1–Q2 (após validação do Essencial)',
            tag: 'Produto · Expansão LTV',
            badgeClass: 'badge-futuro',
            desc: 'Implementar agenda de grupos de supervisão/intervisão por abordagem, acervo gravado, workshops e rede de encaminhamentos anunciados no card #card-plano-referencia.',
            trigger: 'Aumentar ARPU médio da base sem depender apenas de novos anúncios.'
        },
        {
            id: 'fut-recovery-416',
            group: 'future',
            done: false,
            title: 'Campanha de reativação para a base histórica (416 cadastros com CPF sem assinatura)',
            when: 'Logo após o lançamento em Janeiro',
            tag: 'CRM · Caixa Rápido',
            badgeClass: 'badge-futuro',
            desc: 'Convidar os 416 profissionais inativos que já completaram perfil a usar gratuitamente o Plano Comunidade e experimentar os 7 dias do novo Essencial.',
            trigger: 'Reativar caixa com CAC praticamente zero usando e-mail + WhatsApp do Admin CRM.'
        }
    ];

    let items = [];
    let currentFilter = 'all';

    function cloneDefaults() {
        return JSON.parse(JSON.stringify(DEFAULT_ITEMS));
    }

    function setSyncStatus(label, isOk = true) {
        const el = document.getElementById('kpi-sync-status');
        const sub = document.getElementById('kpi-sync-time');
        if (el) {
            el.textContent = label;
            el.style.color = isOk ? '#166534' : '#b45309';
        }
        if (sub) {
            sub.textContent = `Atualizado às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
        }
    }

    async function loadState() {
        // 1. Tenta buscar do backend
        try {
            const res = await fetch(`${baseUrl}/api/admin/roadmap`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data.roadmapState) && data.roadmapState.length > 0) {
                    items = data.roadmapState;
                    localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
                    setSyncStatus('Sincronizado (Banco)', true);
                    return;
                }
            }
        } catch (e) {
            console.warn('Roadmap fallback local:', e.message);
        }

        // 2. Fallback localStorage ou seed inicial
        try {
            const localRaw = localStorage.getItem(LOCAL_KEY);
            if (localRaw) {
                const parsed = JSON.parse(localRaw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    items = parsed;
                    setSyncStatus('Cache local', false);
                    return;
                }
            }
        } catch (e) {}

        items = cloneDefaults();
        await saveState();
    }

    async function saveState() {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
        setSyncStatus('Salvando...', false);
        try {
            const res = await fetch(`${baseUrl}/api/admin/roadmap`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ roadmapState: items })
            });
            if (res.ok) {
                setSyncStatus('Sincronizado (Banco)', true);
            } else {
                setSyncStatus('Salvo localmente', false);
            }
        } catch (e) {
            setSyncStatus('Offline / Cache local', false);
        }
    }

    async function loadMarcosLive() {
        try {
            const res = await fetch(`${baseUrl}/api/admin/analytics/growth/health`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) return;
            const data = await res.json();
            const marcos = data?.dashboard?.marcos;
            if (!marcos) return;

            const fmt = (m, target) => m ? `${m.atual}/${target} (${m.percentual}%) · ${m.projection || ''}` : 'Indisponível';
            const e20 = document.getElementById('live-marco-20');
            const e70 = document.getElementById('live-marco-70');
            const e120 = document.getElementById('live-marco-120');
            if (e20) e20.textContent = fmt(marcos.m20, 20);
            if (e70) e70.textContent = fmt(marcos.m70, 70);
            if (e120) e120.textContent = fmt(marcos.m120, 120);
        } catch (e) {
            // Falha silenciosa caso endpoint demore
        }
    }

    function formatCountdown(isoStr) {
        if (!isoStr) return '';
        const target = new Date(isoStr);
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
        const diffDays = Math.round((startOfTarget - startOfToday) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return '🚨 É hoje!';
        if (diffDays === 1) return '⏰ Amanhã';
        if (diffDays > 1) return `Faltam ${diffDays} dias`;
        const ago = Math.abs(diffDays);
        return `⚠️ Atrasada há ${ago} ${ago === 1 ? 'dia' : 'dias'}`;
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function updateKpis() {
        const launch = items.filter(i => i.group === 'launch');
        const launchDone = launch.filter(i => i.done).length;
        const reviews = items.filter(i => i.group === 'reviews');
        const reviewsPending = reviews.filter(i => !i.done);
        const future = items.filter(i => i.group === 'future');
        const futureDone = future.filter(i => i.done).length;

        const elLaunchVal = document.getElementById('kpi-launch-progress');
        const elLaunchBar = document.getElementById('kpi-launch-bar');
        const elRevVal = document.getElementById('kpi-reviews-progress');
        const elRevNext = document.getElementById('kpi-reviews-next');
        const elFutVal = document.getElementById('kpi-future-progress');

        if (elLaunchVal) elLaunchVal.textContent = `${launchDone} / ${launch.length}`;
        if (elLaunchBar) {
            const pct = launch.length ? Math.round((launchDone / launch.length) * 100) : 0;
            elLaunchBar.style.width = `${pct}%`;
        }
        if (elRevVal) elRevVal.textContent = `${reviewsPending.length} ${reviewsPending.length === 1 ? 'pendente' : 'pendentes'}`;
        if (elRevNext) {
            elRevNext.textContent = reviewsPending.length > 0
                ? `Próxima: ${reviewsPending[0].when || 'Agendada'}`
                : 'Todas as revisões concluídas';
        }
        if (elFutVal) elFutVal.textContent = `${futureDone} / ${future.length}`;
    }

    function renderGroup(groupKey, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const groupItems = items.filter(i => i.group === groupKey);
        if (groupItems.length === 0) {
            container.innerHTML = '<p style="color:#64748b; font-size:0.9rem; margin:0;">Nenhum item cadastrado nesta seção.</p>';
            return;
        }

        container.innerHTML = groupItems.map(item => `
            <div class="roadmap-item ${item.done ? 'is-done' : ''}" data-item-id="${escapeHtml(item.id)}">
                <input type="checkbox" class="roadmap-check" ${item.done ? 'checked' : ''} aria-label="Marcar como concluído">
                <div class="roadmap-item-body">
                    <div class="roadmap-item-top">
                        <span class="roadmap-item-title">${escapeHtml(item.title)}</span>
                        ${item.tag ? `<span class="roadmap-badge ${escapeHtml(item.badgeClass || 'badge-agendado')}">${escapeHtml(item.tag)}</span>` : ''}
                    </div>
                    <p class="roadmap-item-desc">${escapeHtml(item.desc)}</p>
                    ${item.trigger ? `<div class="roadmap-trigger-box"><strong>Critério / Ação:</strong> ${escapeHtml(item.trigger)}</div>` : ''}
                    <div class="roadmap-item-meta">
                        <span>📅 <strong>Quando:</strong> ${escapeHtml(item.when || 'A definir')}${item.targetDateIso ? ` (${formatCountdown(item.targetDateIso)})` : ''}</span>
                        ${item.targetPage ? `<a href="#" onclick="if(window.navigateToPage) window.navigateToPage('${escapeHtml(item.targetPage)}'); return false;" style="color:#1B4332; font-weight:700; text-decoration:underline;">${escapeHtml(item.targetPageLabel || 'Abrir painel')} →</a>` : ''}
                        ${item.doneAt ? `<span>✅ Concluído em ${escapeHtml(item.doneAt)}</span>` : ''}
                    </div>
                </div>
                <div class="roadmap-item-actions">
                    <button type="button" class="roadmap-icon-btn btn-delete-rm" title="Remover item">🗑️</button>
                </div>
            </div>
        `).join('');

        container.querySelectorAll('.roadmap-item').forEach(row => {
            const id = row.getAttribute('data-item-id');
            const chk = row.querySelector('.roadmap-check');
            const delBtn = row.querySelector('.btn-delete-rm');

            if (chk) {
                chk.addEventListener('change', async () => {
                    const target = items.find(i => i.id === id);
                    if (!target) return;
                    target.done = chk.checked;
                    target.doneAt = chk.checked ? new Date().toLocaleDateString('pt-BR') : null;
                    renderAll();
                    await saveState();
                });
            }
            if (delBtn) {
                delBtn.addEventListener('click', async () => {
                    if (!confirm('Remover este item do checklist/roadmap?')) return;
                    items = items.filter(i => i.id !== id);
                    renderAll();
                    await saveState();
                });
            }
        });
    }

    function applyFilterVisibility() {
        document.querySelectorAll('.roadmap-section').forEach(sec => {
            const grp = sec.getAttribute('data-section-group');
            sec.style.display = (currentFilter === 'all' || currentFilter === grp) ? 'block' : 'none';
        });
        document.querySelectorAll('.roadmap-tab-btn').forEach(btn => {
            btn.classList.toggle('is-active', btn.getAttribute('data-filter') === currentFilter);
        });
    }

    function renderAll() {
        renderGroup('launch', 'list-launch');
        renderGroup('reviews', 'list-reviews');
        renderGroup('future', 'list-future');
        updateKpis();
        applyFilterVisibility();
    }

    // Tabs
    document.querySelectorAll('.roadmap-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentFilter = btn.getAttribute('data-filter') || 'all';
            applyFilterVisibility();
        });
    });

    // Resetar para o checklist padrão
    const btnReset = document.getElementById('btn-reset-roadmap');
    if (btnReset) {
        btnReset.addEventListener('click', async () => {
            if (!confirm('Restaurar o checklist padrão completo? Itens personalizados adicionados serão removidos.')) return;
            items = cloneDefaults();
            renderAll();
            await saveState();
        });
    }

    // Modal novo item
    const modalAdd = document.getElementById('modal-roadmap-add');
    const btnOpenAdd = document.getElementById('btn-novo-item-roadmap');
    const btnCancelAdd = document.getElementById('btn-cancel-roadmap-add');
    const formAdd = document.getElementById('form-roadmap-add');

    if (btnOpenAdd && modalAdd) {
        btnOpenAdd.addEventListener('click', () => {
            modalAdd.style.display = 'flex';
        });
    }
    if (btnCancelAdd && modalAdd) {
        btnCancelAdd.addEventListener('click', () => {
            modalAdd.style.display = 'none';
        });
    }
    if (formAdd) {
        formAdd.addEventListener('submit', async (e) => {
            e.preventDefault();
            const group = document.getElementById('rm-input-group').value;
            const title = document.getElementById('rm-input-title').value.trim();
            const when = document.getElementById('rm-input-when').value.trim();
            const tag = document.getElementById('rm-input-tag').value.trim();
            const desc = document.getElementById('rm-input-desc').value.trim();
            const trigger = document.getElementById('rm-input-trigger').value.trim();

            if (!title) return;

            const badgeMap = {
                launch: 'badge-lancamento',
                reviews: 'badge-agendado',
                future: 'badge-futuro'
            };

            items.push({
                id: `custom-${Date.now()}`,
                group,
                done: false,
                title,
                when: when || 'A definir',
                tag: tag || 'Personalizado',
                badgeClass: badgeMap[group] || 'badge-agendado',
                desc: desc || 'Acompanhamento estratégico adicionado pelo administrador.',
                trigger: trigger || ''
            });

            formAdd.reset();
            if (modalAdd) modalAdd.style.display = 'none';
            renderAll();
            await saveState();
        });
    }

    await Promise.all([loadState(), loadMarcosLive()]);
    renderAll();
};

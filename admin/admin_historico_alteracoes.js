(function() {
    let allChanges = [];
    let allCommits = [];
    let currentFilter = 'all';
    let searchQuery = '';
    let currentPage = 1;
    let pageSize = 10;
    let gitCurrentPage = 1;
    let gitPageSize = 10;

    function formatDate(dateStr) {
        if (!dateStr) return 'Data não informada';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return dateStr;
        }
    }

    // Aplica os dados e atualiza a interface
    function applyChangelogData(data) {
        allChanges = data.changes || [];
        allCommits = data.recentCommits || [];

        // Atualiza KPIs
        const totalKpi = document.getElementById('kpi-total-changes');
        if (totalKpi) totalKpi.textContent = allChanges.length;

        const syncEl = document.getElementById('changelog-last-sync');
        if (syncEl) syncEl.textContent = `Sincronizado às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

        // Renderiza pills com contagens atualizadas e timeline paginada
        renderCategoryPills();
        renderTimeline();
        renderGitCommits();

        const loadingEl = document.getElementById('changelog-loading');
        const timelineEl = document.getElementById('changelog-timeline');
        const emptyEl = document.getElementById('changelog-empty');

        if (loadingEl) loadingEl.style.display = 'none';
        if (allChanges.length > 0) {
            if (timelineEl) timelineEl.style.display = 'block';
        } else {
            if (emptyEl) emptyEl.style.display = 'block';
        }
    }

    async function fetchChangelog(forceRefresh = false) {
        const loadingEl = document.getElementById('changelog-loading');
        const timelineEl = document.getElementById('changelog-timeline');
        const emptyEl = document.getElementById('changelog-empty');

        // Otimização Crítica de Banda: reutiliza cache em sessionStorage para evitar requisições repetidas ao Render
        if (!forceRefresh) {
            try {
                const cachedRaw = sessionStorage.getItem('yelo_changelog_cache');
                if (cachedRaw) {
                    const cached = JSON.parse(cachedRaw);
                    const now = Date.now();
                    // Válido por 5 minutos enquanto navega pelo painel
                    if (now - (cached.timestamp || 0) < 5 * 60 * 1000 && cached.data) {
                        applyChangelogData(cached.data);
                        return;
                    }
                }
            } catch (e) {}
        }

        if (loadingEl) loadingEl.style.display = 'block';
        if (timelineEl) timelineEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'none';

        try {
            const token = localStorage.getItem('Yelo_token') || localStorage.getItem('token');
            const res = await fetch('/api/admin/system-changelog', {
                headers: {
                    'Authorization': token ? `Bearer ${token}` : '',
                    'Content-Type': 'application/json'
                }
            });

            if (!res.ok) throw new Error(`Status ${res.status}`);
            const data = await res.json();

            // Salva no sessionStorage para preservar banda do Render
            try {
                sessionStorage.setItem('yelo_changelog_cache', JSON.stringify({
                    timestamp: Date.now(),
                    data: data
                }));
            } catch (e) {}

            applyChangelogData(data);
        } catch (err) {
            console.error('Erro ao carregar histórico de alterações:', err);
            if (loadingEl) {
                loadingEl.innerHTML = `
                    <div style="color: #ef4444; padding: 20px;">
                        <span style="font-size: 2rem;">⚠️</span>
                        <p style="font-weight: 700; margin-top: 8px;">Erro ao carregar histórico de alterações.</p>
                        <p style="font-size: 0.85rem; color: #6b7280;">${err.message}</p>
                        <button onclick="window.fetchChangelog(true)" style="margin-top: 10px; padding: 8px 16px; border-radius: 50px; background: #1B4332; color: #FFEE8C; border: none; cursor: pointer; font-weight: 600;">Tentar Novamente</button>
                    </div>
                `;
            }
        }
    }

    // Renderiza pílulas de categorias dinamicamente com base nos dados reais
    function renderCategoryPills() {
        const groupEl = document.getElementById('category-filter-group');
        if (!groupEl) return;

        // Categorias base predefinidas
        const defaultCats = [
            'Planos & Trial',
            'Motor de Match',
            'CRM & Mensageria',
            'Billing & Asaas',
            'Admin & Plataforma',
            'Segurança & Infra',
            'Performance & Cache',
            'Analytics & Métricas'
        ];

        // Mapeia todas as categorias presentes nas alterações
        const catCounts = { all: allChanges.length };
        const foundCats = new Set();

        allChanges.forEach(item => {
            if (item.category) {
                catCounts[item.category] = (catCounts[item.category] || 0) + 1;
                foundCats.add(item.category);
            }
        });

        // Junta categorias ordenando as que têm itens primeiro
        const allCategoryList = ['all', ...Array.from(new Set([...defaultCats, ...Array.from(foundCats)]))];

        groupEl.innerHTML = allCategoryList.map(cat => {
            const count = catCounts[cat] || 0;
            const label = cat === 'all' ? 'Todas' : cat;
            const isActive = currentFilter === cat ? 'active' : '';

            // Não exibe pílulas sem nenhum item, a menos que seja 'all' ou a atualmente ativa
            if (cat !== 'all' && count === 0 && currentFilter !== cat) {
                return '';
            }

            return `
                <button class="cat-pill ${isActive}" data-cat="${cat}">
                    ${label} ${count > 0 ? `<span style="opacity: 0.75; font-size: 0.75rem; margin-left: 4px;">(${count})</span>` : ''}
                </button>
            `;
        }).join('');

        // Reatacha listeners das pílulas
        groupEl.querySelectorAll('.cat-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                groupEl.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilter = btn.getAttribute('data-cat');
                currentPage = 1; // Reseta para a página 1 ao filtrar
                renderTimeline();
            });
        });
    }

    // Renderiza controles de paginação reutilizáveis
    function renderPaginationControls(containerEl, current, totalPages, onPageChange) {
        if (!containerEl) return;
        if (totalPages <= 1) {
            containerEl.style.display = 'none';
            containerEl.innerHTML = '';
            return;
        }

        containerEl.style.display = 'flex';

        let buttonsHtml = '';

        // Botão Primeira Página «
        buttonsHtml += `
            <button class="page-btn" data-page="1" ${current === 1 ? 'disabled' : ''} title="Primeira Página">
                «
            </button>
        `;

        // Botão Anterior ‹
        buttonsHtml += `
            <button class="page-btn" data-page="${current - 1}" ${current === 1 ? 'disabled' : ''} title="Página Anterior">
                ‹ Anterior
            </button>
        `;

        // Lógica de páginas numeradas com reticências
        const pageNumbers = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
        } else {
            pageNumbers.push(1);
            if (current <= 4) {
                for (let i = 2; i <= 5; i++) pageNumbers.push(i);
                pageNumbers.push('...');
                pageNumbers.push(totalPages);
            } else if (current >= totalPages - 3) {
                pageNumbers.push('...');
                for (let i = totalPages - 4; i <= totalPages; i++) pageNumbers.push(i);
            } else {
                pageNumbers.push('...');
                pageNumbers.push(current - 1);
                pageNumbers.push(current);
                pageNumbers.push(current + 1);
                pageNumbers.push('...');
                pageNumbers.push(totalPages);
            }
        }

        pageNumbers.forEach(p => {
            if (p === '...') {
                buttonsHtml += `<span class="page-ellipsis">…</span>`;
            } else {
                const isActive = p === current ? 'active' : '';
                buttonsHtml += `
                    <button class="page-btn ${isActive}" data-page="${p}">
                        ${p}
                    </button>
                `;
            }
        });

        // Botão Próxima ›
        buttonsHtml += `
            <button class="page-btn" data-page="${current + 1}" ${current === totalPages ? 'disabled' : ''} title="Próxima Página">
                Próxima ›
            </button>
        `;

        // Botão Última Página »
        buttonsHtml += `
            <button class="page-btn" data-page="${totalPages}" ${current === totalPages ? 'disabled' : ''} title="Última Página">
                »
            </button>
        `;

        containerEl.innerHTML = buttonsHtml;

        // Anexa listeners de clique
        containerEl.querySelectorAll('.page-btn:not(:disabled)').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const targetPage = parseInt(btn.getAttribute('data-page'), 10);
                if (targetPage && targetPage !== current) {
                    onPageChange(targetPage);
                }
            });
        });
    }

    function renderTimeline() {
        const timelineEl = document.getElementById('changelog-timeline');
        const emptyEl = document.getElementById('changelog-empty');
        const rangeInfoEl = document.getElementById('pagination-info-range');
        const totalInfoEl = document.getElementById('pagination-info-total');
        const bottomPaginationEl = document.getElementById('changelog-pagination-bottom');

        if (!timelineEl) return;

        let filtered = allChanges.filter(item => {
            const matchesCat = currentFilter === 'all' || item.category === currentFilter;
            const q = searchQuery.toLowerCase().trim();
            const matchesSearch = !q || 
                (item.title && item.title.toLowerCase().includes(q)) ||
                (item.summary && item.summary.toLowerCase().includes(q)) ||
                (item.commit && item.commit.toLowerCase().includes(q)) ||
                (item.category && item.category.toLowerCase().includes(q));
            return matchesCat && matchesSearch;
        });

        const totalItems = filtered.length;

        // Atualiza contadores
        if (totalInfoEl) totalInfoEl.textContent = totalItems;

        if (totalItems === 0) {
            timelineEl.style.display = 'none';
            if (emptyEl) emptyEl.style.display = 'block';
            if (rangeInfoEl) rangeInfoEl.textContent = '0 - 0';
            if (bottomPaginationEl) bottomPaginationEl.style.display = 'none';
            return;
        }

        timelineEl.style.display = 'block';
        if (emptyEl) emptyEl.style.display = 'none';

        // Cálculo de Paginação
        const effectivePageSize = pageSize === 'all' ? totalItems : pageSize;
        const totalPages = Math.ceil(totalItems / effectivePageSize) || 1;

        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        const startIndex = (currentPage - 1) * effectivePageSize;
        const endIndex = pageSize === 'all' ? totalItems : Math.min(startIndex + effectivePageSize, totalItems);
        const visibleItems = filtered.slice(startIndex, endIndex);

        if (rangeInfoEl) {
            rangeInfoEl.textContent = `${startIndex + 1} - ${endIndex}`;
        }

        // Renderiza itens visíveis da página
        timelineEl.innerHTML = visibleItems.map(item => {
            const formattedDate = formatDate(item.date);
            const badgeColor = item.badgeColor || '#3b82f6';
            
            // Destaque rápido de Antes vs Depois
            let quickCompareHtml = '';
            if (item.before && item.after) {
                const beforeKeys = Object.keys(item.before);
                if (beforeKeys.length > 0) {
                    const firstKey = beforeKeys[0];
                    quickCompareHtml = `
                        <div style="margin-top: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;">
                            <div style="font-size: 0.82rem; color: #64748b;">
                                <strong style="color: #b91c1c;">Antes:</strong> ${item.before[firstKey]} 
                                <span style="margin: 0 6px; color: #94a3b8;">➔</span> 
                                <strong style="color: #15803d;">Depois:</strong> ${item.after[firstKey]}
                            </div>
                            <span style="font-size: 0.8rem; font-weight: 700; color: #1B4332; display: flex; align-items: center; gap: 4px;">
                                Ver detalhes ➔
                            </span>
                        </div>
                    `;
                }
            }

            return `
                <div class="timeline-card" data-id="${item.id}" onclick="window.openChangeDetail('${item.id}')">
                    <div class="timeline-dot" style="border-color: ${badgeColor};"></div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; margin-bottom: 8px;">
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <span style="background: ${badgeColor}18; color: ${badgeColor}; border: 1px solid ${badgeColor}33; font-size: 0.75rem; font-weight: 700; padding: 3px 10px; border-radius: 50px;">
                                ${item.category}
                            </span>
                            <span style="background: #dcfce7; color: #15803d; font-size: 0.72rem; font-weight: 600; padding: 3px 8px; border-radius: 50px;">
                                ${item.status || 'Em Produção'}
                            </span>
                            ${item.commit ? `<span style="font-family: monospace; font-size: 0.75rem; background: #f1f5f9; color: #475569; padding: 2px 7px; border-radius: 6px; border: 1px solid #e2e8f0;">#${item.commit}</span>` : ''}
                        </div>
                        
                        <div style="color: #6b7280; font-size: 0.82rem; font-weight: 500;">
                            🕒 ${formattedDate}
                        </div>
                    </div>

                    <h3 style="font-size: 1.15rem; font-weight: 800; color: #111827; margin: 0 0 8px; line-height: 1.4;">
                        ${item.title}
                    </h3>

                    <p style="color: #4b5563; font-size: 0.92rem; line-height: 1.5; margin: 0;">
                        ${item.summary}
                    </p>

                    ${quickCompareHtml}
                </div>
            `;
        }).join('');

        // Renderiza botões de página inferiores
        renderPaginationControls(bottomPaginationEl, currentPage, totalPages, (newPage) => {
            currentPage = newPage;
            renderTimeline();
            const toolbar = document.getElementById('cataloged-pagination-toolbar');
            if (toolbar) {
                toolbar.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    }

    function renderGitCommits() {
        const listEl = document.getElementById('git-commits-list');
        const rangeInfoEl = document.getElementById('git-pagination-info-range');
        const totalInfoEl = document.getElementById('git-pagination-info-total');
        const bottomPaginationEl = document.getElementById('git-pagination-bottom');

        if (!listEl) return;

        const totalCommits = allCommits.length;
        if (totalInfoEl) totalInfoEl.textContent = totalCommits;

        if (totalCommits === 0) {
            listEl.innerHTML = `
                <div style="text-align: center; padding: 30px; color: #6b7280;">
                    Nenhum commit recente detectado ou ambiente de deploy isolado.
                </div>
            `;
            if (rangeInfoEl) rangeInfoEl.textContent = '0 - 0';
            if (bottomPaginationEl) bottomPaginationEl.style.display = 'none';
            return;
        }

        const effectiveGitPageSize = gitPageSize === 'all' ? totalCommits : gitPageSize;
        const totalGitPages = Math.ceil(totalCommits / effectiveGitPageSize) || 1;

        if (gitCurrentPage > totalGitPages) gitCurrentPage = totalGitPages;
        if (gitCurrentPage < 1) gitCurrentPage = 1;

        const startIndex = (gitCurrentPage - 1) * effectiveGitPageSize;
        const endIndex = gitPageSize === 'all' ? totalCommits : Math.min(startIndex + effectiveGitPageSize, totalCommits);
        const visibleCommits = allCommits.slice(startIndex, endIndex);

        if (rangeInfoEl) {
            rangeInfoEl.textContent = `${startIndex + 1} - ${endIndex}`;
        }

        listEl.innerHTML = visibleCommits.map(c => `
            <div class="git-commit-row">
                <div style="display: flex; align-items: center; gap: 12px; flex-grow: 1;">
                    <span style="font-family: monospace; font-weight: 700; color: #1B4332; background: #e8f5e9; padding: 4px 8px; border-radius: 6px; font-size: 0.8rem;">
                        ${c.hash}
                    </span>
                    <div>
                        <div style="font-weight: 600; color: #1f2937; font-size: 0.9rem;">${c.message}</div>
                        <div style="font-size: 0.75rem; color: #6b7280; margin-top: 2px;">
                            Por <strong>${c.author}</strong> em ${formatDate(c.date)}
                        </div>
                    </div>
                </div>
                <div style="font-size: 0.75rem; color: #10b981; font-weight: 600; background: #ecfdf5; padding: 3px 8px; border-radius: 20px;">
                    DEPLOYED
                </div>
            </div>
        `).join('');

        renderPaginationControls(bottomPaginationEl, gitCurrentPage, totalGitPages, (newPage) => {
            gitCurrentPage = newPage;
            renderGitCommits();
            const toolbar = document.getElementById('git-pagination-toolbar');
            if (toolbar) {
                toolbar.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    }

    function ensureModalsInBody() {
        ['change-detail-modal', 'new-change-modal'].forEach(id => {
            const all = document.querySelectorAll(`#${id}`);
            if (all.length > 1) {
                for (let i = 0; i < all.length - 1; i++) {
                    all[i].remove();
                }
            }
            const modal = document.getElementById(id);
            if (modal && modal.parentElement !== document.body) {
                document.body.appendChild(modal);
            }
        });
    }

    function lockBodyScroll() {
        const dashboardMain = document.querySelector('.dashboard-main');
        if (dashboardMain) {
            dashboardMain.dataset.prevOverflow = dashboardMain.style.overflow || '';
            dashboardMain.style.setProperty('overflow', 'hidden', 'important');
        }
        document.body.dataset.prevOverflow = document.body.style.overflow || '';
        document.body.style.setProperty('overflow', 'hidden', 'important');
        document.documentElement.style.setProperty('overflow', 'hidden', 'important');
    }

    function unlockBodyScroll() {
        const dashboardMain = document.querySelector('.dashboard-main');
        if (dashboardMain) {
            if (dashboardMain.dataset.prevOverflow) {
                dashboardMain.style.overflow = dashboardMain.dataset.prevOverflow;
            } else {
                dashboardMain.style.removeProperty('overflow');
            }
        }
        if (document.body.dataset.prevOverflow) {
            document.body.style.overflow = document.body.dataset.prevOverflow;
        } else {
            document.body.style.removeProperty('overflow');
        }
        document.documentElement.style.removeProperty('overflow');
    }

    window.openChangeDetail = function(changeId) {
        const item = allChanges.find(c => c.id === changeId);
        if (!item) return;

        ensureModalsInBody();
        const modal = document.getElementById('change-detail-modal');
        if (!modal) return;

        // Preenche campos
        document.getElementById('modal-title').textContent = item.title;
        document.getElementById('modal-date').textContent = `📅 ${formatDate(item.date)}`;
        document.getElementById('modal-author').textContent = `👤 ${item.author || 'Anderson'}`;
        
        const catBadge = document.getElementById('modal-cat-badge');
        catBadge.textContent = item.category;
        catBadge.style.background = `${item.badgeColor || '#3b82f6'}22`;
        catBadge.style.color = item.badgeColor || '#3b82f6';

        const commitBadge = document.getElementById('modal-commit-badge');
        commitBadge.textContent = item.commit ? `#${item.commit}` : 'Deploy';

        const rationaleEl = document.getElementById('modal-rationale');
        rationaleEl.textContent = item.rationale || 'Nenhum racional informado.';

        const descEl = document.getElementById('modal-description');
        descEl.textContent = item.description || item.summary;

        // Listas de Antes e Depois
        const beforeList = document.getElementById('modal-before-list');
        const afterList = document.getElementById('modal-after-list');

        if (item.before && typeof item.before === 'object' && Object.keys(item.before).length > 0) {
            beforeList.innerHTML = Object.entries(item.before).map(([key, val]) => `
                <div style="display: flex; gap: 6px; align-items: flex-start;">
                    <span style="color: #ef4444; font-weight: 800;">•</span>
                    <div><strong>${key.replace(/_/g, ' ')}:</strong> ${val}</div>
                </div>
            `).join('');
        } else {
            beforeList.innerHTML = '<div>Sem dados anteriores registrados.</div>';
        }

        if (item.after && typeof item.after === 'object' && Object.keys(item.after).length > 0) {
            afterList.innerHTML = Object.entries(item.after).map(([key, val]) => `
                <div style="display: flex; gap: 6px; align-items: flex-start;">
                    <span style="color: #10b981; font-weight: 800;">✓</span>
                    <div><strong>${key.replace(/_/g, ' ')}:</strong> ${val}</div>
                </div>
            `).join('');
        } else {
            afterList.innerHTML = '<div>Sem dados posteriores registrados.</div>';
        }

        // Tabela de Métricas para Comparar com Hoje
        const metricsTable = document.getElementById('modal-metrics-table');
        if (item.metricsToCompare && item.metricsToCompare.length > 0) {
            metricsTable.innerHTML = `
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.88rem;">
                    <thead>
                        <tr style="background: #f1f5f9; color: #475569; font-size: 0.8rem; text-transform: uppercase;">
                            <th style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0;">Indicador / Métrica</th>
                            <th style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0;">Como Era Antes</th>
                            <th style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0;">Como Ficou Depois / Hoje</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${item.metricsToCompare.map(m => `
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                                <td style="padding: 12px 14px; font-weight: 700; color: #1e293b;">${m.name}</td>
                                <td style="padding: 12px 14px; color: #b91c1c; background: #fff5f5;">${m.before}</td>
                                <td style="padding: 12px 14px; color: #15803d; background: #f0fdf4; font-weight: 600;">${m.after}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else {
            metricsTable.innerHTML = `<div style="padding: 16px; color: #64748b; font-size: 0.85rem;">Nenhuma métrica quantitativa específica catalogada.</div>`;
        }

        // Arquivos impactados
        const filesList = document.getElementById('modal-files-list');
        if (item.filesChanged && item.filesChanged.length > 0) {
            filesList.innerHTML = item.filesChanged.map(f => `
                <span style="font-family: monospace; font-size: 0.78rem; background: #f1f5f9; color: #334155; padding: 4px 10px; border-radius: 6px; border: 1px solid #e2e8f0; display: inline-flex; align-items: center; gap: 4px;">
                    📄 ${f}
                </span>
            `).join('');
        } else {
            filesList.innerHTML = `<span style="color: #94a3b8; font-size: 0.82rem;">Nenhum arquivo especificado.</span>`;
        }

        // Reseta scroll interno para o topo
        const scrollArea = document.getElementById('modal-scrollable-area');
        if (scrollArea) scrollArea.scrollTop = 0;

        // Trava de scroll no background e exibe com pointer-events garantido
        lockBodyScroll();
        modal.classList.add('active', 'is-visible');
        modal.style.display = 'flex';
        modal.style.pointerEvents = 'auto';
    };

    function closeModal() {
        const modal = document.getElementById('change-detail-modal');
        if (modal) {
            modal.classList.remove('active', 'is-visible');
            modal.style.display = 'none';
            modal.style.pointerEvents = 'none';
        }
        unlockBodyScroll();
    }

    function closeNewChangeModal() {
        const newModal = document.getElementById('new-change-modal');
        if (newModal) {
            newModal.classList.remove('active', 'is-visible');
            newModal.style.display = 'none';
            newModal.style.pointerEvents = 'none';
        }
        unlockBodyScroll();
    }

    // Configuração de Swipe Down para fechar o Bottom Sheet no Mobile
    function setupSwipeDownToClose(modalEl, cardSelector, closeFn) {
        if (!modalEl) return;
        const card = modalEl.querySelector(cardSelector);
        if (!card) return;

        let startY = 0;
        let currentY = 0;
        let isDragging = false;

        const handle = card.querySelector('.bottom-sheet-drag-handle');

        if (handle) {
            handle.addEventListener('touchstart', (e) => {
                if (window.innerWidth > 768) return;
                startY = e.touches[0].clientY;
                isDragging = true;
                card.style.transition = 'none';
            }, { passive: true });

            handle.addEventListener('touchmove', (e) => {
                if (!isDragging) return;
                currentY = e.touches[0].clientY;
                const diff = currentY - startY;
                if (diff > 0) {
                    card.style.transform = `translateY(${diff}px)`;
                }
            }, { passive: true });

            handle.addEventListener('touchend', () => {
                if (!isDragging) return;
                isDragging = false;
                const diff = currentY - startY;
                card.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
                if (diff > 75) {
                    card.style.transform = 'translateY(100%)';
                    setTimeout(() => {
                        card.style.transform = '';
                        closeFn();
                    }, 200);
                } else {
                    card.style.transform = 'translateY(0)';
                }
            });
        }
    }

    // Inicialização dos Event Listeners
    function setupEventListeners() {
        // Delegação global no documento para fechamento infalível de modais
        document.addEventListener('click', (e) => {
            // Fechar modal de detalhes
            if (e.target.closest('#btn-close-modal') || e.target.closest('#btn-modal-close-footer')) {
                e.preventDefault();
                e.stopPropagation();
                closeModal();
                return;
            }

            // Fechar modal de novo registro
            if (e.target.closest('#btn-close-new-modal') || e.target.closest('#btn-cancel-new-change')) {
                e.preventDefault();
                e.stopPropagation();
                closeNewChangeModal();
                return;
            }

            // Clique no backdrop transparente/escuro (fora do card)
            const detailModal = document.getElementById('change-detail-modal');
            if (detailModal && (e.target === detailModal)) {
                closeModal();
                return;
            }

            const newModal = document.getElementById('new-change-modal');
            if (newModal && (e.target === newModal)) {
                closeNewChangeModal();
                return;
            }
        });

        const modalOverlay = document.getElementById('change-detail-modal');
        if (modalOverlay) {
            setupSwipeDownToClose(modalOverlay, '#detail-card-container', closeModal);
        }

        // Fechar com tecla ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeModal();
                closeNewChangeModal();
            }
        });

        // Seletor de Itens por Página (Catalogadas)
        const selectPerPage = document.getElementById('select-per-page');
        if (selectPerPage) {
            selectPerPage.addEventListener('change', (e) => {
                const val = e.target.value;
                pageSize = val === 'all' ? 'all' : parseInt(val, 10);
                currentPage = 1;
                renderTimeline();
            });
        }

        // Seletor de Itens por Página (Git Commits)
        const gitSelectPerPage = document.getElementById('git-select-per-page');
        if (gitSelectPerPage) {
            gitSelectPerPage.addEventListener('change', (e) => {
                const val = e.target.value;
                gitPageSize = val === 'all' ? 'all' : parseInt(val, 10);
                gitCurrentPage = 1;
                renderGitCommits();
            });
        }

        // Botão de Sincronizar com Git
        const btnSyncGit = document.getElementById('btn-sync-git-changelog');
        if (btnSyncGit) {
            btnSyncGit.addEventListener('click', async () => {
                const icon = document.getElementById('icon-sync-git');
                const text = document.getElementById('text-sync-git');
                btnSyncGit.disabled = true;
                if (icon) icon.style.animation = 'spin 0.8s linear infinite';
                if (text) text.textContent = 'Sincronizando...';

                try {
                    const token = localStorage.getItem('Yelo_token') || localStorage.getItem('token');
                    const res = await fetch('/api/admin/system-changelog/sync', {
                        method: 'POST',
                        headers: {
                            'Authorization': token ? `Bearer ${token}` : '',
                            'Content-Type': 'application/json'
                        }
                    });

                    const resData = await res.json();
                    await fetchChangelog(true);

                    if (window.showToast) {
                        window.showToast(resData.message || 'Sincronização com Git concluída com sucesso!', 'success');
                    } else {
                        alert(resData.message || 'Sincronização com Git concluída!');
                    }
                } catch (syncErr) {
                    console.error('Erro ao sincronizar com git:', syncErr);
                    alert(`Erro na sincronização: ${syncErr.message}`);
                } finally {
                    btnSyncGit.disabled = false;
                    if (icon) icon.style.animation = '';
                    if (text) text.textContent = 'Sincronizar Git';
                }
            });
        }

        // Busca
        const searchInput = document.getElementById('changelog-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value;
                currentPage = 1;
                renderTimeline();
            });
        }

        // Abas
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabCataloged = document.getElementById('tab-cataloged-content');
        const tabGit = document.getElementById('tab-git-content');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => {
                    b.classList.remove('active');
                    b.style.background = 'transparent';
                    b.style.color = '#6b7280';
                    b.style.boxShadow = 'none';
                });
                btn.classList.add('active');
                btn.style.background = '#fff';
                btn.style.color = '#1B4332';
                btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.06)';

                const targetTab = btn.getAttribute('data-tab');
                if (targetTab === 'cataloged') {
                    if (tabCataloged) tabCataloged.style.display = 'block';
                    if (tabGit) tabGit.style.display = 'none';
                } else {
                    if (tabCataloged) tabCataloged.style.display = 'none';
                    if (tabGit) tabGit.style.display = 'block';
                }
            });
        });

        // Modal de Novo Registro
        const btnOpenNew = document.getElementById('btn-open-new-change-modal');
        const newModal = document.getElementById('new-change-modal');
        const btnCloseNew = document.getElementById('btn-close-new-modal');
        const btnCancelNew = document.getElementById('btn-cancel-new-change');
        const formNew = document.getElementById('form-new-change');

        if (btnOpenNew && newModal) {
            btnOpenNew.addEventListener('click', () => {
                ensureModalsInBody();
                lockBodyScroll();
                newModal.classList.add('active', 'is-visible');
                newModal.style.display = 'flex';
                newModal.style.pointerEvents = 'auto';
            });
        }
        if (btnCloseNew && newModal) {
            btnCloseNew.addEventListener('click', closeNewChangeModal);
        }
        if (btnCancelNew && newModal) {
            btnCancelNew.addEventListener('click', closeNewChangeModal);
        }
        if (newModal) {
            setupSwipeDownToClose(newModal, '.modal-content-card', closeNewChangeModal);
        }

        if (formNew) {
            formNew.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitBtn = document.getElementById('btn-submit-new-change');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Salvando...';
                }

                const title = document.getElementById('new-change-title').value;
                const category = document.getElementById('new-change-category').value;
                const commit = document.getElementById('new-change-commit').value;
                const summary = document.getElementById('new-change-summary').value;
                const rationale = document.getElementById('new-change-rationale').value;
                const beforeText = document.getElementById('new-change-before').value;
                const afterText = document.getElementById('new-change-after').value;

                try {
                    const token = localStorage.getItem('Yelo_token') || localStorage.getItem('token');
                    const res = await fetch('/api/admin/system-changelog', {
                        method: 'POST',
                        headers: {
                            'Authorization': token ? `Bearer ${token}` : '',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            title,
                            category,
                            commit,
                            summary,
                            rationale,
                            before: beforeText ? { "regra_anterior": beforeText } : {},
                            after: afterText ? { "nova_regra": afterText } : {}
                        })
                    });

                    if (!res.ok) throw new Error('Falha ao registrar alteração');
                    const result = await res.json();

                    if (window.showToast) window.showToast('Alteração registrada com sucesso!', 'success');
                    closeNewChangeModal();
                    formNew.reset();
                    await fetchChangelog(true);
                } catch (err) {
                    console.error('Erro ao salvar alteração:', err);
                    alert(`Erro ao salvar: ${err.message}`);
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Salvar Registro';
                    }
                }
            });
        }
    }

    window.fetchChangelog = fetchChangelog;

    // Executa
    ensureModalsInBody();
    setupEventListeners();
    fetchChangelog();
})();

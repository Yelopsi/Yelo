(function () {
    'use strict';

    const API_BASE = window.API_BASE_URL || '';
    const TAX_REGIME_LABELS = {
        SIMPLES_NACIONAL: 'Simples Nacional',
        MEI: 'MEI',
        LUCRO_PRESUMIDO: 'Lucro Presumido',
        LUCRO_REAL: 'Lucro Real'
    };

    const PAGE_SIZE = 40;

    let state = {
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
        regime: 'accrual',
        report: null,
        chart: null,
        revPage: 1,
        collapsedGroups: new Set(),
        toastTimer: null,
        boundHandlers: []
    };

    function escapeHtml(val) {
        if (val === null || val === undefined) return '';
        return String(val)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    const SHORT_MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    function fmtMonthKeyShort(mk) {
        const parts = String(mk || '').split('-');
        if (parts.length !== 2) return mk || '—';
        const idx = Number(parts[1]) - 1;
        return SHORT_MONTHS_PT[idx] ? `${SHORT_MONTHS_PT[idx]}/${parts[0]}` : mk;
    }

    function fmtCurrency(val) {
        const num = Number(val || 0);
        return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function fmtSignedCurrency(val, sign) {
        const num = Number(val || 0);
        if (Math.abs(num) < 0.005) return fmtCurrency(0);
        if (sign === '-') return `(${fmtCurrency(Math.abs(num))})`;
        return fmtCurrency(num);
    }

    function fmtPct(val, showSign) {
        if (val === null || val === undefined || Number.isNaN(Number(val))) return '—';
        const n = Number(val);
        const prefix = showSign && n > 0 ? '+' : '';
        return `${prefix}${n.toFixed(1).replace('.', ',')}%`;
    }

    function getAuthHeaders(extra) {
        const token = localStorage.getItem('Yelo_admin_token') || localStorage.getItem('Yelo_token');
        const headers = { ...(extra || {}) };
        if (token && token !== 'cookie_auth_active') {
            headers.Authorization = `Bearer ${token}`;
        }
        return headers;
    }

    async function apiFetch(path, options) {
        const opts = {
            credentials: 'include',
            ...(options || {}),
            headers: getAuthHeaders(options && options.headers)
        };
        const res = await fetch(`${API_BASE}${path}`, opts);
        if (!res.ok) {
            let msg = `Erro HTTP ${res.status}`;
            try {
                const body = await res.json();
                if (body && body.error) msg = body.error;
            } catch (_) {}
            throw new Error(msg);
        }
        return res.json();
    }

    function showToast(msg, isError) {
        const el = document.getElementById('dre-toast');
        if (!el) return;
        el.textContent = msg;
        el.style.background = isError ? '#b91c1c' : '#0f172a';
        el.style.display = 'block';
        if (state.toastTimer) clearTimeout(state.toastTimer);
        state.toastTimer = setTimeout(() => {
            el.style.display = 'none';
        }, 3600);
    }

    function on(el, event, handler) {
        if (!el) return;
        el.addEventListener(event, handler);
        state.boundHandlers.push({ el, event, handler });
    }

    function populateSelectors(meta, dreGroupOptions) {
        const yearSel = document.getElementById('dre-year-select');
        const monthSel = document.getElementById('dre-month-select');
        const regimeSel = document.getElementById('dre-regime-select');
        const expGroupSel = document.getElementById('exp-group');
        const expFilterGroupSel = document.getElementById('exp-filter-group');
        const recGroupSel = document.getElementById('rec-group');

        if (yearSel && meta && Array.isArray(meta.availableYears)) {
            yearSel.innerHTML = meta.availableYears
                .map(y => `<option value="${Number(y)}">${Number(y)}</option>`)
                .join('');
            yearSel.value = String(meta.year);
        }
        if (monthSel && meta) monthSel.value = String(meta.selectedMonth);
        if (regimeSel && meta) regimeSel.value = meta.regime;

        if (Array.isArray(dreGroupOptions)) {
            if (expGroupSel) {
                const prev = expGroupSel.value;
                expGroupSel.innerHTML = dreGroupOptions
                    .map(opt => `<option value="${escapeHtml(opt.value)}">${escapeHtml(opt.label)}</option>`)
                    .join('');
                expGroupSel.value = prev || 'OPEX_ADMIN';
            }
            if (recGroupSel) {
                const prevRec = recGroupSel.value;
                recGroupSel.innerHTML = dreGroupOptions
                    .map(opt => `<option value="${escapeHtml(opt.value)}">${escapeHtml(opt.label)}</option>`)
                    .join('');
                recGroupSel.value = prevRec || 'OPEX_ADMIN';
            }
            if (expFilterGroupSel) {
                const prevFilter = expFilterGroupSel.value || 'ALL';
                expFilterGroupSel.innerHTML = `<option value="ALL">Todas as Contas DRE</option>` + dreGroupOptions
                    .map(opt => `<option value="${escapeHtml(opt.value)}">${escapeHtml(opt.shortLabel)}</option>`)
                    .join('');
                expFilterGroupSel.value = prevFilter;
            }
        }
    }

    function renderHeaderAndKpis(report) {
        const { meta, company, selectedMonthSummary: sel, prevMonthSummary: prev, annualSummary: ann, alerts } = report;

        const nameEl = document.getElementById('dre-company-name');
        const cnpjEl = document.getElementById('dre-company-cnpj');
        const regimeBadge = document.getElementById('dre-tax-regime-badge');
        const statusBadge = document.getElementById('dre-month-status-badge');
        const taxPill = document.getElementById('dre-tax-source-pill');
        const inlineCloseBtn = document.getElementById('dre-btn-toggle-close-inline');

        if (nameEl) nameEl.textContent = company.legalName || 'Yelo Saúde Mental Ltda';
        if (cnpjEl) cnpjEl.textContent = company.cnpj ? `CNPJ: ${company.cnpj}` : 'CNPJ não configurado';
        if (regimeBadge) regimeBadge.textContent = TAX_REGIME_LABELS[company.taxRegime] || company.taxRegime || 'Simples Nacional';

        const isClosed = Boolean(sel.taxConfig && sel.taxConfig.isClosed);
        if (statusBadge) {
            statusBadge.textContent = isClosed ? `🔒 Fechado (${meta.selectedMonthKey})` : `🔓 Mês Aberto (${meta.selectedMonthKey})`;
            statusBadge.className = `dre-badge ${isClosed ? 'status-closed' : 'status-open'}`;
        }
        if (inlineCloseBtn) {
            inlineCloseBtn.textContent = isClosed ? '🔓 Reabrir Mês' : '🔒 Fechar Mês';
        }
        if (taxPill) {
            const varRate = sel.taxConfig && sel.taxConfig.variableRate !== null
                ? `${(sel.taxConfig.variableRate * 100).toFixed(2).replace('.', ',')}%`
                : '0%';
            const fixedTax = sel.taxConfig && sel.taxConfig.fixedMonthly ? fmtCurrency(sel.taxConfig.fixedMonthly) : 'R$ 0,00';
            const srcLabel = (sel.taxConfig?.taxSource === 'MONTHLY_SNAPSHOT' || sel.taxConfig?.taxSource === 'MONTH_SNAPSHOT')
                ? 'Mês'
                : ((sel.taxConfig?.taxSource === 'GLOBAL_SETTING' || sel.taxConfig?.taxSource === 'SYSTEM_DEFAULT') ? 'Padrão' : 'Não config.');
            taxPill.textContent = `Regra Fiscal (${srcLabel}): ${varRate} + ${fixedTax}`;
        }

        const printComp = document.getElementById('dre-print-company');
        const printMeta = document.getElementById('dre-print-meta');
        const printSign = document.getElementById('dre-print-sign-company');
        if (printComp) printComp.textContent = `${company.legalName || 'Yelo'} ${company.cnpj ? `— CNPJ: ${company.cnpj}` : ''} (${TAX_REGIME_LABELS[company.taxRegime] || ''})`;
        if (printMeta) printMeta.textContent = `Exercício: ${meta.year} | Competência Ref.: ${meta.selectedMonthLabel}/${meta.year} | ${meta.regimeLabel}`;
        if (printSign) printSign.textContent = company.legalName || 'Representante Legal';

        const alertsEl = document.getElementById('dre-alerts');
        if (alertsEl) {
            alertsEl.innerHTML = (alerts || []).map(a => `
                <div class="dre-alert ${escapeHtml(a.type || 'info')}">
                    <div>
                        <strong>${escapeHtml(a.title)}:</strong> ${escapeHtml(a.message)}
                    </div>
                    ${a.code === 'MISSING_TAX_CONFIG'
                        ? '<button type="button" class="dre-btn dre-btn-outline dre-alert-cfg-btn">Configurar agora</button>'
                        : ''}
                </div>
            `).join('');
            const cfgBtn = alertsEl.querySelector('.dre-alert-cfg-btn');
            if (cfgBtn) cfgBtn.addEventListener('click', openFiscalModal);
        }

        const prevLabel = meta.prevMonthKey || 'mês ant.';
        const cmp = report.kpiComparison || null;
        const isPaceMode = cmp && cmp.mode === 'PACE_PROJECTION';
        const cmpSuffix = isPaceMode ? 'ritmo' : 'm/m';
        const cmpProj = cmp && cmp.projected ? cmp.projected : {};
        const cmpPrev = cmp && cmp.previous ? cmp.previous : {};

        const formatKpiTrend = (metricKey, currFallback, previousFallback, isReversed = false) => {
            const curNum = Number(isPaceMode && cmpProj[metricKey] !== undefined ? cmpProj[metricKey] : currFallback || 0);
            const prevNum = Number(cmpPrev[metricKey] !== undefined ? cmpPrev[metricKey] : previousFallback || 0);

            const tooltipText = isPaceMode
                ? `Comparação justa (mês parcial: ${cmp.daysElapsed} de ${cmp.daysInMonth} dias). Projeção no ritmo atual: ${fmtCurrency(curNum)}/mês (variáveis proporcionais + fixos 1x) vs ${escapeHtml(prevLabel)} completo (${fmtCurrency(prevNum)}).`
                : `Mês anterior (${escapeHtml(prevLabel)}): ${fmtCurrency(prevNum)}`;
            const titleAttr = `title="${tooltipText}"`;

            if (Math.abs(prevNum) < 0.01) {
                if (Math.abs(curNum) < 0.01) {
                    return `<span class="dre-trend-badge neutral" ${titleAttr}>▬ 0,0% ${cmpSuffix}</span>`;
                }
                const isUp = curNum > 0;
                const icon = isUp ? '▲' : '▼';
                const isGood = isReversed ? !isUp : isUp;
                const tone = isGood ? 'pos' : 'neg';
                return `<span class="dre-trend-badge ${tone}" ${titleAttr}>${icon} Novo</span>`;
            }

            const pct = ((curNum - prevNum) / Math.abs(prevNum)) * 100;
            if (Math.abs(pct) < 0.05) {
                return `<span class="dre-trend-badge neutral" ${titleAttr}>▬ 0,0% ${cmpSuffix}</span>`;
            }

            const isUp = pct > 0;
            const icon = isUp ? '▲' : '▼';
            const isGood = isReversed ? !isUp : isUp;
            const tone = isGood ? 'pos' : 'neg';
            return `<span class="dre-trend-badge ${tone}" ${titleAttr}>${icon} ${fmtPct(pct, true)} ${cmpSuffix}</span>`;
        };

        document.getElementById('kpi-paid-count').textContent = `${sel.paidCount || 0} pgtos`;
        document.getElementById('kpi-gross-rev').textContent = fmtCurrency(sel.grossRevenue);
        document.getElementById('kpi-gross-rev-year').textContent = fmtCurrency(ann.grossRevenue);
        document.getElementById('kpi-gross-delta').innerHTML = formatKpiTrend('grossRevenue', sel.grossRevenue, prev.grossRevenue, false);

        const rateTxt = sel.taxConfig && sel.taxConfig.variableRate !== null
            ? `${(sel.taxConfig.variableRate * 100).toFixed(1).replace('.', ',')}%`
            : '0%';
        document.getElementById('kpi-tax-rate').textContent = `Alíq. ${rateTxt}`;
        document.getElementById('kpi-deductions').textContent = fmtCurrency(sel.totalDeductions);
        document.getElementById('kpi-deductions-delta').innerHTML = formatKpiTrend('totalDeductions', sel.totalDeductions, prev.totalDeductions, true);
        document.getElementById('kpi-refunds').textContent = fmtCurrency(sel.refunds);
        document.getElementById('kpi-taxes').textContent = fmtCurrency(sel.taxesOnRevenue);

        document.getElementById('kpi-net-rev').textContent = fmtCurrency(sel.netRevenue);
        document.getElementById('kpi-net-rev-year').textContent = fmtCurrency(ann.netRevenue);
        document.getElementById('kpi-net-delta').innerHTML = formatKpiTrend('netRevenue', sel.netRevenue, prev.netRevenue, false);

        const selCostsOpex = (sel.totalCogs || 0) + (sel.totalOpex || 0);
        const prevCostsOpex = (prev.totalCogs || 0) + (prev.totalOpex || 0);
        document.getElementById('kpi-costs-opex').textContent = fmtCurrency(selCostsOpex);
        document.getElementById('kpi-costs-delta').innerHTML = formatKpiTrend('costsPlusOpex', selCostsOpex, prevCostsOpex, true);
        document.getElementById('kpi-cogs').textContent = fmtCurrency(sel.totalCogs);
        document.getElementById('kpi-opex').textContent = fmtCurrency(sel.totalOpex);

        document.getElementById('kpi-ebitda').textContent = fmtCurrency(sel.ebitda);
        document.getElementById('kpi-ebitda-margin').textContent = `Mg ${fmtPct(sel.ebitdaMarginPct)}`;
        document.getElementById('kpi-ebitda-year').textContent = fmtCurrency(ann.ebitda);
        document.getElementById('kpi-ebitda-delta').innerHTML = formatKpiTrend('ebitda', sel.ebitda, prev.ebitda, false);

        const netIncomeCard = document.getElementById('kpi-net-income-card');
        if (netIncomeCard) {
            netIncomeCard.classList.toggle('highlight', sel.netIncome >= 0);
            netIncomeCard.classList.toggle('highlight-negative', sel.netIncome < 0);
        }
        document.getElementById('kpi-net-income').textContent = fmtCurrency(sel.netIncome);
        document.getElementById('kpi-net-margin').textContent = `Mg ${fmtPct(sel.netMarginPct)}`;
        document.getElementById('kpi-net-income-year').textContent = fmtCurrency(ann.netIncome);
        document.getElementById('kpi-net-income-delta').innerHTML = formatKpiTrend('netIncome', sel.netIncome, prev.netIncome, false);
    }

    function getDreChildCountMap(dreRows) {
        const counts = new Map();
        (dreRows || []).forEach(r => {
            const codeStr = String(r.code || '');
            if (codeStr.includes('.')) {
                const parent = codeStr.split('.')[0];
                counts.set(parent, (counts.get(parent) || 0) + 1);
            }
        });
        return counts;
    }

    function applyGroupCollapseState() {
        const allGroups = new Set();
        document.querySelectorAll('#dre-monthly-tbody tr[data-group-code], #dre-annual-tbody tr[data-group-code]').forEach(tr => {
            const code = tr.getAttribute('data-group-code');
            allGroups.add(code);
            tr.classList.toggle('is-collapsed', state.collapsedGroups.has(code));
        });
        document.querySelectorAll('#dre-monthly-tbody tr[data-parent-group], #dre-annual-tbody tr[data-parent-group]').forEach(tr => {
            const parent = tr.getAttribute('data-parent-group');
            tr.classList.toggle('dre-row-hidden', state.collapsedGroups.has(parent));
        });

        const toggleAllBtn = document.getElementById('dre-btn-toggle-collapse-all');
        if (toggleAllBtn) {
            const allCollapsed = allGroups.size > 0 && Array.from(allGroups).every(g => state.collapsedGroups.has(g));
            toggleAllBtn.textContent = allCollapsed ? '↕️ Expandir Grupos' : '↕️ Recolher Grupos';
        }
    }

    function toggleGroupCollapse(groupCode) {
        if (!groupCode) return;
        if (state.collapsedGroups.has(groupCode)) {
            state.collapsedGroups.delete(groupCode);
        } else {
            state.collapsedGroups.add(groupCode);
        }
        applyGroupCollapseState();
    }

    function bindGroupRowClicks(container) {
        if (!container) return;
        container.querySelectorAll('tr.dre-group-row').forEach(tr => {
            tr.addEventListener('click', () => {
                toggleGroupCollapse(tr.getAttribute('data-group-code'));
            });
        });
    }

    function renderMonthlyDreTable(report) {
        const { meta, dreRows } = report;
        document.getElementById('dre-mensal-title').textContent = `Demonstração do Resultado — ${meta.selectedMonthLabel} / ${meta.year} (${meta.regimeLabel})`;
        document.getElementById('th-sel-month').textContent = `${meta.selectedMonthLabel.slice(0, 3)}/${meta.year}`;
        document.getElementById('th-prev-month').textContent = fmtMonthKeyShort(meta.prevMonthKey);
        document.getElementById('th-year-total').textContent = `Total ${meta.year}`;

        const childCounts = getDreChildCountMap(dreRows);
        const tbody = document.getElementById('dre-monthly-tbody');
        tbody.innerHTML = (dreRows || []).map(row => {
            const codeStr = String(row.code || '');
            const isChild = codeStr.includes('.');
            const parentCode = isChild ? codeStr.split('.')[0] : '';
            const childCount = !isChild ? (childCounts.get(codeStr) || 0) : 0;
            const isGroupHeader = childCount > 0;

            let ahClass = '';
            if (row.ahPct !== null && Math.abs(row.ahPct) > 0.05) {
                const isUp = row.ahPct > 0;
                const isGood = row.sign === '-' ? !isUp : isUp;
                ahClass = isGood ? 'dre-val-pos' : 'dre-val-neg';
            }
            const valClass = row.sign === '-' && row.selectedValue > 0 ? 'dre-val-neg' : (row.rowType === 'grand_total' ? (row.selectedValue >= 0 ? 'dre-val-pos' : 'dre-val-neg') : '');

            const rowClasses = [`row-${escapeHtml(row.rowType)}`];
            if (isGroupHeader) rowClasses.push('dre-group-row');

            const groupAttrs = isGroupHeader
                ? `data-group-code="${escapeHtml(codeStr)}" title="Clique para recolher/expandir subcontas"`
                : (isChild ? `data-parent-group="${escapeHtml(parentCode)}"` : '');

            const labelHtml = isGroupHeader
                ? `<span class="dre-collapse-chevron" aria-hidden="true">▾</span>${escapeHtml(row.label)}<span class="dre-collapsed-badge">${childCount} subconta${childCount > 1 ? 's' : ''}</span>`
                : escapeHtml(row.label);

            return `
                <tr class="${rowClasses.join(' ')}" ${groupAttrs}>
                    <td><strong>${escapeHtml(row.code)}</strong></td>
                    <td>${labelHtml}</td>
                    <td class="num ${valClass}">${escapeHtml(fmtSignedCurrency(row.selectedValue, row.sign))}</td>
                    <td class="num">${escapeHtml(fmtPct(row.selectedAvPct))}</td>
                    <td class="num">${escapeHtml(fmtSignedCurrency(row.prevMonthValue, row.sign))}</td>
                    <td class="num ${ahClass}">${escapeHtml(row.ahPct === null ? '—' : fmtPct(row.ahPct, true))}</td>
                    <td class="num">${escapeHtml(fmtSignedCurrency(row.annualTotal, row.sign))}</td>
                    <td class="num">${escapeHtml(fmtPct(row.annualAvPct))}</td>
                </tr>
            `;
        }).join('');

        bindGroupRowClicks(tbody);
        applyGroupCollapseState();
    }

    function renderAnnualMatrixTable(report) {
        const { meta, dreRows } = report;
        document.getElementById('dre-annual-title').textContent = `Matriz Contábil Anual — Exercício ${meta.year} (${meta.regimeLabel})`;
        const childCounts = getDreChildCountMap(dreRows);
        const tbody = document.getElementById('dre-annual-tbody');
        tbody.innerHTML = (dreRows || []).map(row => {
            const codeStr = String(row.code || '');
            const isChild = codeStr.includes('.');
            const parentCode = isChild ? codeStr.split('.')[0] : '';
            const childCount = !isChild ? (childCounts.get(codeStr) || 0) : 0;
            const isGroupHeader = childCount > 0;

            const rowClasses = [`row-${escapeHtml(row.rowType)}`];
            if (isGroupHeader) rowClasses.push('dre-group-row');

            const groupAttrs = isGroupHeader
                ? `data-group-code="${escapeHtml(codeStr)}"`
                : (isChild ? `data-parent-group="${escapeHtml(parentCode)}"` : '');

            const labelHtml = isGroupHeader
                ? `<span class="dre-collapse-chevron" aria-hidden="true">▾</span>${escapeHtml(row.label)}<span class="dre-collapsed-badge">${childCount}</span>`
                : escapeHtml(row.label);

            const monthCells = (row.months || []).map(val => {
                const cls = row.sign === '-' && val > 0 ? 'dre-val-neg' : '';
                return `<td class="num ${cls}">${escapeHtml(fmtSignedCurrency(val, row.sign))}</td>`;
            }).join('');
            return `
                <tr class="${rowClasses.join(' ')}" ${groupAttrs}>
                    <td class="sticky-col">${labelHtml}</td>
                    ${monthCells}
                    <td class="num"><strong>${escapeHtml(fmtSignedCurrency(row.annualTotal, row.sign))}</strong></td>
                    <td class="num">${escapeHtml(fmtPct(row.annualAvPct))}</td>
                </tr>
            `;
        }).join('');

        bindGroupRowClicks(tbody);
        applyGroupCollapseState();
    }

    function renderEvolutionChart(report) {
        const canvas = document.getElementById('dre-evolution-chart');
        if (!canvas || typeof window.Chart === 'undefined') return;

        if (state.chart) {
            state.chart.destroy();
            state.chart = null;
        }
        if (typeof window.Chart.getChart === 'function') {
            const existing = window.Chart.getChart(canvas);
            if (existing) existing.destroy();
        }

        const series = report.monthlySeries || [];
        const labels = series.map(m => m.monthFullLabel || m.monthLabel);
        const netRevData = series.map(m => Number(m.netRevenue || 0));
        const totalOutData = series.map(m => Number(((m.totalCogs || 0) + (m.totalOpex || 0)).toFixed(2)));
        const netIncomeData = series.map(m => Number(m.netIncome || 0));

        // Compensa CSS `zoom: 0.88` do body administrativo para que o hover X/Y bata exatamente com cada coluna
        const zoomCoordFixPlugin = {
            id: 'zoomCoordFix',
            beforeEvent(chart, args) {
                const e = args && args.event;
                const native = e && e.native;
                if (!native || !chart || !chart.canvas || !chart.width || !chart.height) return;
                const src = (native.touches && native.touches[0])
                    || (native.changedTouches && native.changedTouches[0])
                    || native;
                if (!Number.isFinite(src.clientX) || !Number.isFinite(src.clientY)) return;
                const rect = chart.canvas.getBoundingClientRect();
                if (rect.width <= 0 || rect.height <= 0) return;
                e.x = Math.round(((src.clientX - rect.left) / rect.width) * chart.width);
                e.y = Math.round(((src.clientY - rect.top) / rect.height) * chart.height);
                args.inChartArea = chart.isPointInArea(e);
            }
        };

        state.chart = new window.Chart(canvas.getContext('2d'), {
            type: 'bar',
            plugins: [zoomCoordFixPlugin],
            data: {
                labels: series.map(m => m.monthLabel),
                datasets: [
                    {
                        label: 'Receita Líquida',
                        data: netRevData,
                        backgroundColor: 'rgba(27, 67, 50, 0.85)',
                        hoverBackgroundColor: 'rgba(27, 67, 50, 1)',
                        borderRadius: 6,
                        order: 2
                    },
                    {
                        label: 'Custos + OPEX',
                        data: totalOutData,
                        backgroundColor: 'rgba(239, 68, 68, 0.72)',
                        hoverBackgroundColor: 'rgba(239, 68, 68, 0.92)',
                        borderRadius: 6,
                        order: 2
                    },
                    {
                        type: 'line',
                        label: 'Lucro Líquido',
                        data: netIncomeData,
                        borderColor: '#2563eb',
                        backgroundColor: '#2563eb',
                        pointBackgroundColor: '#ffffff',
                        pointBorderColor: '#2563eb',
                        pointBorderWidth: 2,
                        borderWidth: 2.5,
                        tension: 0.25,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        pointHitRadius: 12,
                        order: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                events: ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'],
                interaction: {
                    mode: 'index',
                    axis: 'x',
                    intersect: false
                },
                layout: {
                    padding: { top: 12, right: 12, left: 6, bottom: 4 }
                },
                plugins: {
                    legend: { position: 'top' },
                    tooltip: {
                        enabled: true,
                        mode: 'index',
                        axis: 'x',
                        intersect: false,
                        backgroundColor: 'rgba(15, 23, 42, 0.94)',
                        titleColor: '#ffffff',
                        bodyColor: '#f8fafc',
                        footerColor: '#cbd5e1',
                        padding: 12,
                        cornerRadius: 10,
                        displayColors: true,
                        callbacks: {
                            title: (items) => {
                                if (!items || !items.length) return '';
                                const idx = items[0].dataIndex;
                                return `${labels[idx] || items[0].label} / ${report.meta.year}`;
                            },
                            label: (ctx) => ` ${ctx.dataset.label}: ${fmtCurrency(ctx.parsed.y)}`,
                            footer: (items) => {
                                if (!items || !items.length) return '';
                                const idx = items[0].dataIndex;
                                const m = series[idx];
                                if (!m) return '';
                                return `Margem Líq.: ${fmtPct(m.netMarginPct)} • ${m.paidCount || 0} pgto(s)`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        ticks: {
                            callback: (val) => fmtCurrency(val)
                        }
                    }
                }
            }
        });
    }

    function renderExpensesSection(report) {
        const { meta, ledger, selectedMonthSummary } = report;
        const isClosed = Boolean(selectedMonthSummary.taxConfig && selectedMonthSummary.taxConfig.isClosed);

        const defaultExpDate = document.getElementById('exp-date');
        if (defaultExpDate && !document.getElementById('exp-edit-id').value) {
            defaultExpDate.value = `${meta.selectedMonthKey}-01`;
        }

        const copyBtn = document.getElementById('dre-btn-copy-prev');
        const saveExpBtn = document.getElementById('dre-btn-save-expense');
        if (copyBtn) copyBtn.disabled = isClosed;
        if (saveExpBtn) saveExpBtn.disabled = isClosed;

        const scope = document.getElementById('exp-filter-scope').value;
        const groupFilter = document.getElementById('exp-filter-group').value;
        const search = (document.getElementById('exp-filter-search').value || '').trim().toLowerCase();

        const list = (ledger.expenses || []).filter(exp => {
            if (scope === 'month' && exp.monthYear !== meta.selectedMonthKey) return false;
            if (groupFilter !== 'ALL' && exp.dreGroup !== groupFilter) return false;
            if (search) {
                const hay = `${exp.name || ''} ${exp.category || ''} ${exp.documentNumber || ''} ${exp.notes || ''}`.toLowerCase();
                if (!hay.includes(search)) return false;
            }
            return true;
        });

        const totalFiltered = list.reduce((acc, item) => acc + Number(item.amount || 0), 0);
        document.getElementById('dre-expenses-count-sub').textContent =
            `${list.length} lançamento(s) exibido(s) • Total filtrado: ${fmtCurrency(totalFiltered)}`;

        const tbody = document.getElementById('dre-expenses-tbody');
        if (list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#64748b; padding:24px;">Nenhum lançamento encontrado para os filtros atuais.</td></tr>`;
            return;
        }

        tbody.innerHTML = list.map(exp => {
            let originBadge = `<span class="dre-pill pill-gray">${escapeHtml(exp.entryMethod || 'MANUAL')}</span>`;
            if (exp.isVirtual) {
                originBadge = `<span class="dre-pill pill-blue" title="Consolidado automaticamente de ManualAdMetrics">Auto Ads</span>`;
            } else if (exp.entryMethod === 'API') {
                originBadge = `<span class="dre-pill pill-blue" title="Sincronizado automaticamente via API">Auto API</span>`;
            } else if (exp.entryMethod === 'SYSTEM') {
                originBadge = `<span class="dre-pill pill-green" title="Custo fixo recorrente automático">Auto Fixo</span>`;
            }

            const lockBadge = exp.isClosedMonth ? `<span class="dre-pill pill-amber">Fechado</span>` : '';

            const actionsHtml = exp.isVirtual
                ? `<span style="font-size:0.75rem; color:#64748b;">Automático</span>`
                : `<div style="display:flex; gap:6px; justify-content:flex-end;">
                        <button type="button" class="dre-btn dre-btn-outline dre-exp-edit-btn" data-id="${escapeHtml(exp.id)}" ${exp.isClosedMonth ? 'disabled' : ''}>Editar</button>
                        <button type="button" class="dre-btn dre-btn-danger dre-exp-del-btn" data-id="${escapeHtml(exp.id)}" ${exp.isClosedMonth ? 'disabled' : ''}>Excluir</button>
                   </div>`;

            return `
                <tr>
                    <td>${escapeHtml(exp.monthYear)} ${lockBadge}</td>
                    <td>${escapeHtml(exp.expenseDate || '—')}</td>
                    <td>
                        <strong>${escapeHtml(exp.name)}</strong>
                        ${exp.notes ? `<div style="font-size:0.76rem; color:#64748b;">${escapeHtml(exp.notes)}</div>` : ''}
                    </td>
                    <td><span class="dre-pill pill-gray">${escapeHtml(exp.dreGroupLabel || exp.dreGroup)}</span></td>
                    <td>${originBadge}</td>
                    <td>${escapeHtml(exp.documentNumber || '—')}</td>
                    <td class="num"><strong>${escapeHtml(fmtCurrency(exp.amount))}</strong></td>
                    <td class="num">${actionsHtml}</td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.dre-exp-edit-btn').forEach(btn => {
            btn.addEventListener('click', () => startEditExpense(btn.getAttribute('data-id')));
        });
        tbody.querySelectorAll('.dre-exp-del-btn').forEach(btn => {
            btn.addEventListener('click', () => deleteExpense(btn.getAttribute('data-id')));
        });
    }

    function renderTaxAuditAndLedger(report) {
        const { meta, taxAudit, ledger, selectedMonthSummary } = report;

        const taxTbody = document.getElementById('dre-tax-audit-tbody');
        taxTbody.innerHTML = (taxAudit || []).map(row => {
            const statusPill = row.isClosed
                ? `<span class="dre-pill pill-green">Fechado</span>`
                : `<span class="dre-pill pill-amber">Aberto</span>`;
            const closeBtn = row.isClosed
                ? `<button type="button" class="dre-btn dre-btn-outline dre-audit-toggle-btn" data-mk="${escapeHtml(row.monthKey)}" data-action="reopen">Reabrir</button>`
                : `<button type="button" class="dre-btn dre-btn-primary dre-audit-toggle-btn" data-mk="${escapeHtml(row.monthKey)}" data-action="close">Fechar Mês</button>`;

            return `
                <tr ${row.monthKey === meta.selectedMonthKey ? 'style="background:#f0fdf4;"' : ''}>
                    <td><strong>${escapeHtml(row.monthLabel)}</strong> <span style="color:#64748b; font-size:0.76rem;">(${escapeHtml(row.monthKey)})</span></td>
                    <td class="num">${escapeHtml(fmtCurrency(row.grossRevenue))}</td>
                    <td class="num dre-val-neg">${escapeHtml(fmtCurrency(row.refunds))}</td>
                    <td class="num">${escapeHtml(fmtCurrency(row.taxableBase))}</td>
                    <td class="num">${row.variableRatePct !== null ? `${Number(row.variableRatePct).toFixed(2).replace('.', ',')}%` : '—'}</td>
                    <td class="num">${escapeHtml(fmtCurrency(row.fixedMonthly))}</td>
                    <td class="num"><strong>${escapeHtml(fmtCurrency((row.taxesOnRevenue || 0) + (row.profitTaxes || 0)))}</strong></td>
                    <td class="num ${row.netIncome >= 0 ? 'dre-val-pos' : 'dre-val-neg'}"><strong>${escapeHtml(fmtCurrency(row.netIncome))}</strong></td>
                    <td>${statusPill}</td>
                    <td class="num">${closeBtn}</td>
                </tr>
            `;
        }).join('');

        taxTbody.querySelectorAll('.dre-audit-toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                toggleMonthLock(btn.getAttribute('data-mk'), btn.getAttribute('data-action'));
            });
        });

        const openRec = selectedMonthSummary.openReceivables || { pendingCount: 0, pendingTotal: 0, overdueCount: 0, overdueTotal: 0 };
        document.getElementById('dre-open-receivables-note').textContent =
            `Nota Extra-DRE (${meta.selectedMonthKey}): ${openRec.pendingCount} pendente(s) (${fmtCurrency(openRec.pendingTotal)}) • ${openRec.overdueCount} vencido(s) (${fmtCurrency(openRec.overdueTotal)})`;

        renderRevenueLedgerRows(report);
    }

    function renderRevenueLedgerRows(report) {
        const { meta, ledger } = report;
        const scope = document.getElementById('rev-filter-scope').value;
        const search = (document.getElementById('rev-filter-search').value || '').trim().toLowerCase();

        const filtered = (ledger.revenues || []).filter(r => {
            if (scope === 'month' && r.monthKey !== meta.selectedMonthKey) return false;
            if (search) {
                const hay = `${r.psiNome || ''} ${r.id || ''} ${r.plano || ''} ${r.billingType || ''}`.toLowerCase();
                if (!hay.includes(search)) return false;
            }
            return true;
        });

        const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
        if (state.revPage > totalPages) state.revPage = totalPages;
        const start = (state.revPage - 1) * PAGE_SIZE;
        const pageItems = filtered.slice(start, start + PAGE_SIZE);

        const tbody = document.getElementById('dre-revenues-tbody');
        if (pageItems.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:#64748b; padding:24px;">Nenhuma receita ou estorno encontrado neste filtro.</td></tr>`;
        } else {
            tbody.innerHTML = pageItems.map(r => {
                const typeBadge = r.type === 'ESTORNO'
                    ? `<span class="dre-pill pill-red">ESTORNO</span>`
                    : (r.type === 'TAXA_MENSAGERIA'
                        ? `<span class="dre-pill pill-amber">MENSAGERIA</span>`
                        : `<span class="dre-pill pill-green">RECEITA</span>`);
                const feeNote = r.feeEstimated ? ' <span title="Taxa estimada" style="color:#d97706;">(est.)</span>' : '';
                return `
                    <tr>
                        <td>${escapeHtml(r.eventDate || r.paymentDate || '—')}</td>
                        <td>${typeBadge}</td>
                        <td style="font-family:monospace; font-size:0.78rem;">${escapeHtml(r.id)}</td>
                        <td>${escapeHtml(r.psiNome)}</td>
                        <td>${escapeHtml(r.plano)}</td>
                        <td>${escapeHtml(r.billingType)}</td>
                        <td class="num ${r.grossAmount < 0 ? 'dre-val-neg' : ''}">${escapeHtml(fmtCurrency(r.grossAmount))}</td>
                        <td class="num">${escapeHtml(fmtCurrency(r.feeAmount))}${feeNote}</td>
                        <td class="num"><strong>${escapeHtml(fmtCurrency(r.netAmount))}</strong></td>
                    </tr>
                `;
            }).join('');
        }

        document.getElementById('dre-rev-page-info').textContent =
            `Exibindo ${filtered.length === 0 ? 0 : start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)} de ${filtered.length} registro(s) • Página ${state.revPage} de ${totalPages}`;
        document.getElementById('dre-rev-prev').disabled = state.revPage <= 1;
        document.getElementById('dre-rev-next').disabled = state.revPage >= totalPages;
    }

    function renderRecurringRules(report) {
        const listEl = document.getElementById('dre-recurring-list');
        if (!listEl) return;
        const rules = report.autoRecurringExpenses || [];
        if (rules.length === 0) {
            listEl.innerHTML = `<span style="font-size:0.82rem; color:#64748b;">Nenhuma automação fixa ativa ainda. Cadastre serviços recorrentes (como Render Cloud R$ 81,98) acima.</span>`;
            return;
        }

        listEl.innerHTML = rules.map(rule => `
            <div style="display:inline-flex; align-items:center; gap:8px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:999px; padding:6px 12px; font-size:0.82rem; color:#14532d;">
                <strong>${escapeHtml(rule.name)}</strong>
                <span>${escapeHtml(fmtCurrency(rule.amount))}/mês</span>
                <span style="color:#475569;">(desde ${escapeHtml(rule.startMonth)})</span>
                <button type="button" class="dre-rec-del-btn" data-id="${escapeHtml(rule.id)}" title="Remover automação" style="background:#dcfce7; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer; font-weight:700; color:#166534;">×</button>
            </div>
        `).join('');

        listEl.querySelectorAll('.dre-rec-del-btn').forEach(btn => {
            btn.addEventListener('click', () => removeRecurringRule(btn.getAttribute('data-id')));
        });
    }

    async function saveRecurringRulesList(nextRules, toastMsg) {
        const res = await apiFetch('/api/admin/dre/recurring-rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rules: nextRules, targetYear: state.year })
        });
        showToast(toastMsg || `Automação salva (${res.appliedCount || 0} lançamento(s) aplicado(s)).`);
        await loadDreData();
    }

    async function handleRecurringSubmit(e) {
        e.preventDefault();
        if (!state.report) return;
        const name = document.getElementById('rec-name').value.trim();
        const amount = Number(document.getElementById('rec-amount').value);
        const dreGroup = document.getElementById('rec-group').value;
        const provider = document.getElementById('rec-provider').value;
        const startMonth = document.getElementById('rec-start-month').value;
        if (!name || !Number.isFinite(amount) || amount <= 0 || !startMonth) return;

        const currentRules = Array.isArray(state.report.autoRecurringExpenses)
            ? [...state.report.autoRecurringExpenses]
            : [];
        currentRules.push({
            id: `rule-${Date.now()}`,
            name,
            amount,
            dreGroup,
            category: provider === 'RENDER' ? 'Cloud / Infraestrutura' : name,
            provider,
            startMonth,
            active: true
        });

        try {
            await saveRecurringRulesList(currentRules, `Automação "${name}" (${fmtCurrency(amount)}/mês) ativada!`);
            document.getElementById('dre-recurring-form').reset();
            document.getElementById('rec-start-month').value = startMonth;
        } catch (err) {
            showToast(err.message || 'Erro ao salvar automação fixa.', true);
        }
    }

    async function removeRecurringRule(ruleId) {
        if (!state.report || !window.confirm('Desativar esta automação mensal para os próximos meses? (Lançamentos antigos permanecem salvos.)')) return;
        const currentRules = (state.report.autoRecurringExpenses || []).filter(r => r.id !== ruleId);
        try {
            await saveRecurringRulesList(currentRules, 'Automação recorrente removida.');
        } catch (err) {
            showToast(err.message || 'Erro ao remover automação.', true);
        }
    }

    async function loadDreData(forceRefresh) {
        try {
            const qs = new URLSearchParams({
                year: String(state.year),
                month: String(state.month),
                regime: state.regime
            });
            if (forceRefresh) qs.set('refresh', '1');
            const report = await apiFetch(`/api/admin/dre?${qs.toString()}`);
            state.report = report;
            state.year = report.meta.year;
            state.month = report.meta.selectedMonth;
            state.regime = report.meta.regime;

            populateSelectors(report.meta, report.dreGroupOptions);
            renderHeaderAndKpis(report);
            renderMonthlyDreTable(report);
            renderAnnualMatrixTable(report);
            renderEvolutionChart(report);
            renderRecurringRules(report);
            renderExpensesSection(report);
            renderTaxAuditAndLedger(report);
        } catch (err) {
            console.error('[DRE] Falha ao carregar:', err);
            showToast(err.message || 'Erro ao carregar DRE contábil.', true);
        }
    }

    function startEditExpense(id) {
        if (!state.report) return;
        const exp = (state.report.ledger.expenses || []).find(item => String(item.id) === String(id));
        if (!exp || exp.isVirtual) return;

        document.getElementById('exp-edit-id').value = String(exp.id);
        document.getElementById('exp-name').value = exp.name || '';
        document.getElementById('exp-amount').value = Number(exp.amount || 0).toFixed(2);
        document.getElementById('exp-group').value = exp.dreGroup || 'OPEX_ADMIN';
        document.getElementById('exp-date').value = exp.expenseDate || `${exp.monthYear}-01`;
        document.getElementById('exp-category').value = exp.category || '';
        document.getElementById('exp-provider').value = exp.provider || 'OTHER';
        document.getElementById('exp-doc').value = exp.documentNumber || '';
        document.getElementById('exp-notes').value = exp.notes || '';
        document.getElementById('exp-repeat-wrap').style.display = 'none';
        document.getElementById('dre-btn-cancel-edit').style.display = 'inline-flex';
        document.getElementById('dre-expense-form-title').textContent = `Editando Lançamento #${exp.id} (${exp.monthYear})`;
        document.getElementById('dre-btn-save-expense').textContent = '💾 Atualizar Lançamento';
        document.getElementById('dre-expense-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function resetExpenseForm() {
        document.getElementById('dre-expense-form').reset();
        document.getElementById('exp-edit-id').value = '';
        document.getElementById('exp-repeat-wrap').style.display = '';
        document.getElementById('dre-btn-cancel-edit').style.display = 'none';
        document.getElementById('dre-expense-form-title').textContent = 'Novo Lançamento Contábil / Despesa';
        document.getElementById('dre-btn-save-expense').textContent = '💾 Salvar Lançamento';
        if (state.report && state.report.meta) {
            document.getElementById('exp-date').value = `${state.report.meta.selectedMonthKey}-01`;
        }
    }

    async function handleExpenseSubmit(e) {
        e.preventDefault();
        if (!state.report) return;
        const editId = document.getElementById('exp-edit-id').value;
        const payload = {
            name: document.getElementById('exp-name').value.trim(),
            amount: Number(document.getElementById('exp-amount').value),
            dreGroup: document.getElementById('exp-group').value,
            expenseDate: document.getElementById('exp-date').value || `${state.report.meta.selectedMonthKey}-01`,
            category: document.getElementById('exp-category').value.trim(),
            provider: document.getElementById('exp-provider').value,
            documentNumber: document.getElementById('exp-doc').value.trim(),
            notes: document.getElementById('exp-notes').value.trim(),
            monthYear: state.report.meta.selectedMonthKey,
            repeatMonths: Number(document.getElementById('exp-repeat').value || 1)
        };

        try {
            if (editId) {
                await apiFetch(`/api/admin/dre/expenses/${encodeURIComponent(editId)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                showToast('Lançamento atualizado com sucesso!');
            } else {
                const res = await apiFetch('/api/admin/dre/expenses', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const msg = res.skippedClosed && res.skippedClosed.length > 0
                    ? `${res.createdCount} criado(s). Ignorados (fechados): ${res.skippedClosed.join(', ')}`
                    : `${res.createdCount || 1} lançamento(s) registrado(s) na DRE!`;
                showToast(msg);
            }
            resetExpenseForm();
            await loadDreData();
        } catch (err) {
            showToast(err.message || 'Erro ao salvar despesa.', true);
        }
    }

    async function deleteExpense(id) {
        if (!window.confirm('Deseja realmente excluir este lançamento contábil?')) return;
        try {
            await apiFetch(`/api/admin/dre/expenses/${encodeURIComponent(id)}`, { method: 'DELETE' });
            showToast('Lançamento removido.');
            await loadDreData();
        } catch (err) {
            showToast(err.message || 'Erro ao excluir lançamento.', true);
        }
    }

    async function handleCopyPreviousFixed() {
        if (!state.report) return;
        try {
            const res = await apiFetch('/api/admin/dre/expenses/copy-previous', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ monthYear: state.report.meta.selectedMonthKey })
            });
            showToast(res.message || `${res.copiedCount || 0} despesa(s) fixa(s) copiada(s).`);
            await loadDreData();
        } catch (err) {
            showToast(err.message || 'Erro ao copiar despesas fixas.', true);
        }
    }

    async function handleSyncAds() {
        if (!state.report) return;
        const btn = document.getElementById('dre-btn-sync-ads');
        if (btn) btn.disabled = true;
        try {
            await loadDreData(true);
            const synced = (state.report?.autoSync?.synced || []);
            const info = synced.length > 0
                ? `Atualizado (${synced.length} lançamento(s) sincronizado(s))`
                : 'Dados e APIs atualizados!';
            showToast(info);
        } catch (err) {
            showToast(err.message || 'Erro ao atualizar sincronização.', true);
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    function openFiscalModal() {
        if (!state.report) return;
        const { company, meta, selectedMonthSummary } = state.report;
        const cfg = selectedMonthSummary.taxConfig || {};

        document.getElementById('cfg-legal-name').value = company.legalName || '';
        document.getElementById('cfg-cnpj').value = company.cnpj || '';
        document.getElementById('cfg-tax-regime').value = company.taxRegime || 'SIMPLES_NACIONAL';
        document.getElementById('cfg-default-var-tax').value = company.defaultTaxVariableRate !== null && company.defaultTaxVariableRate !== undefined
            ? (Number(company.defaultTaxVariableRate) * 100).toFixed(2)
            : '';
        document.getElementById('cfg-default-fixed-tax').value = company.defaultTaxFixedMonthly !== null && company.defaultTaxFixedMonthly !== undefined
            ? Number(company.defaultTaxFixedMonthly).toFixed(2)
            : '';

        document.getElementById('cfg-month-label').textContent = `${meta.selectedMonthLabel}/${meta.year}`;
        document.getElementById('cfg-month-var-tax').value = cfg.taxSource === 'MONTH_SNAPSHOT' && cfg.variableRate !== null
            ? (Number(cfg.variableRate) * 100).toFixed(2)
            : '';
        document.getElementById('cfg-month-fixed-tax').value = cfg.taxSource === 'MONTH_SNAPSHOT' && cfg.fixedMonthly !== null
            ? Number(cfg.fixedMonthly).toFixed(2)
            : '';
        document.getElementById('cfg-month-profit-tax').value = cfg.profitTaxRate
            ? (Number(cfg.profitTaxRate) * 100).toFixed(2)
            : '';
        document.getElementById('cfg-month-notes').value = cfg.notes || '';

        const saveCloseBtn = document.getElementById('dre-btn-save-and-close-month');
        if (saveCloseBtn) {
            saveCloseBtn.style.display = cfg.isClosed ? 'none' : 'inline-flex';
        }
        document.getElementById('dre-fiscal-modal').classList.add('open');
    }

    function closeFiscalModal() {
        document.getElementById('dre-fiscal-modal').classList.remove('open');
    }

    async function submitFiscalConfig(action) {
        if (!state.report) return;
        const pctToDecimal = (val) => {
            if (val === '' || val === null || val === undefined) return '';
            return Number(val) / 100;
        };

        const payload = {
            companyLegalName: document.getElementById('cfg-legal-name').value.trim(),
            companyCnpj: document.getElementById('cfg-cnpj').value.trim(),
            taxRegime: document.getElementById('cfg-tax-regime').value,
            defaultTaxVariableRate: pctToDecimal(document.getElementById('cfg-default-var-tax').value),
            defaultTaxFixedMonthly: document.getElementById('cfg-default-fixed-tax').value,
            monthYear: state.report.meta.selectedMonthKey,
            monthTaxVariableRate: pctToDecimal(document.getElementById('cfg-month-var-tax').value),
            monthTaxFixedMonthly: document.getElementById('cfg-month-fixed-tax').value,
            monthProfitTaxRate: pctToDecimal(document.getElementById('cfg-month-profit-tax').value),
            monthNotes: document.getElementById('cfg-month-notes').value.trim(),
            action: action || 'save'
        };

        try {
            const res = await apiFetch('/api/admin/dre/fiscal-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            showToast(res.message || 'Configurações fiscais atualizadas!');
            closeFiscalModal();
            await loadDreData();
        } catch (err) {
            showToast(err.message || 'Erro ao salvar configuração fiscal.', true);
        }
    }

    async function toggleMonthLock(monthYear, action) {
        const promptMsg = action === 'close'
            ? `Fechar contabilmente ${monthYear}? Lançamentos e edições ficarão travados até reabertura.`
            : `Reabrir o mês contábil ${monthYear} para novos lançamentos/ajustes?`;
        if (!window.confirm(promptMsg)) return;

        try {
            const res = await apiFetch('/api/admin/dre/fiscal-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ monthYear, action })
            });
            showToast(res.message || 'Status do mês atualizado.');
            await loadDreData();
        } catch (err) {
            showToast(err.message || 'Erro ao alterar fechamento mensal.', true);
        }
    }

    async function downloadProtectedExport(url, fallbackFilename) {
        try {
            const res = await fetch(`${API_BASE}${url}`, {
                credentials: 'include',
                headers: getAuthHeaders()
            });
            if (!res.ok) {
                throw new Error(`Falha ao exportar (HTTP ${res.status})`);
            }
            const blob = await res.blob();
            const disposition = res.headers.get('Content-Disposition') || '';
            const match = disposition.match(/filename="?([^"]+)"?/i);
            const filename = match ? match[1] : fallbackFilename;

            const objectUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = objectUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(objectUrl);
            showToast(`Arquivo ${filename} exportado!`);
        } catch (err) {
            showToast(err.message || 'Erro ao gerar arquivo de exportação.', true);
        }
    }

    function handleExportAction(type) {
        const menu = document.getElementById('dre-export-menu');
        if (menu) menu.classList.remove('open');

        const qs = `year=${encodeURIComponent(state.year)}&month=${encodeURIComponent(state.month)}&regime=${encodeURIComponent(state.regime)}`;
        if (type === 'excel') {
            downloadProtectedExport(`/api/admin/dre/export/excel?${qs}`, `DRE_Contabil_Yelo_${state.year}.xls`);
        } else if (type === 'csv-annual') {
            downloadProtectedExport(`/api/admin/dre/export/csv?${qs}&type=annual`, `DRE_Anual_${state.year}.csv`);
        } else if (type === 'csv-monthly') {
            downloadProtectedExport(`/api/admin/dre/export/csv?${qs}&type=monthly`, `DRE_Mensal_${state.year}_${state.month}.csv`);
        } else if (type === 'csv-revenues') {
            downloadProtectedExport(`/api/admin/dre/export/csv?${qs}&type=ledger_revenues`, `Razao_Receitas_${state.year}.csv`);
        } else if (type === 'csv-expenses') {
            downloadProtectedExport(`/api/admin/dre/export/csv?${qs}&type=ledger_expenses`, `Razao_Despesas_${state.year}.csv`);
        } else if (type === 'print') {
            window.print();
        }
    }

    window.initializePage = async function () {
        const yearSel = document.getElementById('dre-year-select');
        const monthSel = document.getElementById('dre-month-select');
        const regimeSel = document.getElementById('dre-regime-select');
        const exportToggle = document.getElementById('dre-btn-export-toggle');
        const exportMenu = document.getElementById('dre-export-menu');

        on(yearSel, 'change', () => {
            state.year = Number(yearSel.value);
            state.revPage = 1;
            loadDreData();
        });
        on(monthSel, 'change', () => {
            state.month = Number(monthSel.value);
            state.revPage = 1;
            loadDreData();
        });
        on(regimeSel, 'change', () => {
            state.regime = regimeSel.value;
            state.revPage = 1;
            loadDreData();
        });

        const viewDropdown = document.getElementById('dre-view-dropdown');
        const viewTrigger = document.getElementById('dre-view-trigger');
        const viewLabel = document.getElementById('dre-view-trigger-label');
        const closeViewDropdown = () => {
            if (!viewDropdown) return;
            viewDropdown.classList.remove('open');
            if (viewTrigger) viewTrigger.setAttribute('aria-expanded', 'false');
        };

        on(exportToggle, 'click', (e) => {
            e.stopPropagation();
            closeViewDropdown();
            if (exportMenu) exportMenu.classList.toggle('open');
        });
        on(document, 'click', (e) => {
            if (exportMenu && !exportMenu.contains(e.target) && e.target !== exportToggle) {
                exportMenu.classList.remove('open');
            }
            if (viewDropdown && !viewDropdown.contains(e.target)) {
                closeViewDropdown();
            }
        });
        document.querySelectorAll('.dre-export-item').forEach(btn => {
            on(btn, 'click', () => handleExportAction(btn.getAttribute('data-export')));
        });

        if (viewTrigger && viewDropdown) {
            on(viewTrigger, 'click', (e) => {
                e.stopPropagation();
                if (exportMenu) exportMenu.classList.remove('open');
                const isOpen = viewDropdown.classList.toggle('open');
                viewTrigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            });
        }
        on(document, 'keydown', (e) => {
            if (e.key === 'Escape') closeViewDropdown();
        });

        document.querySelectorAll('.dre-tab-btn').forEach(btn => {
            on(btn, 'click', () => {
                const target = btn.getAttribute('data-tab');
                document.querySelectorAll('.dre-tab-btn').forEach(b => {
                    const isActive = b === btn;
                    b.classList.toggle('active', isActive);
                    b.setAttribute('aria-selected', isActive ? 'true' : 'false');
                });
                document.querySelectorAll('.dre-tab-pane').forEach(p => p.classList.toggle('active', p.id === target));
                if (viewLabel) {
                    const labelSpan = btn.querySelector('span:first-child');
                    viewLabel.textContent = (labelSpan ? labelSpan.textContent : btn.textContent).trim();
                }
                closeViewDropdown();
            });
        });

        on(document.getElementById('dre-btn-fiscal'), 'click', openFiscalModal);
        on(document.getElementById('dre-btn-sync-ads'), 'click', handleSyncAds);
        on(document.getElementById('dre-btn-copy-prev'), 'click', handleCopyPreviousFixed);
        on(document.getElementById('dre-btn-cancel-edit'), 'click', resetExpenseForm);
        on(document.getElementById('dre-expense-form'), 'submit', handleExpenseSubmit);
        on(document.getElementById('dre-recurring-form'), 'submit', handleRecurringSubmit);
        on(document.getElementById('dre-btn-quick-render'), 'click', () => {
            document.getElementById('rec-name').value = 'Render Cloud';
            document.getElementById('rec-amount').value = '81.98';
            document.getElementById('rec-group').value = 'OPEX_ADMIN';
            document.getElementById('rec-provider').value = 'RENDER';
            document.getElementById('rec-start-month').focus();
            showToast('Campos preenchidos! Confira o Mês Início e clique em "Ativar Automação".');
        });

        on(document.getElementById('dre-btn-toggle-collapse-all'), 'click', () => {
            if (!state.report) return;
            const childCounts = getDreChildCountMap(state.report.dreRows);
            const allGroups = Array.from(childCounts.keys());
            const allCollapsed = allGroups.length > 0 && allGroups.every(g => state.collapsedGroups.has(g));
            if (allCollapsed) {
                state.collapsedGroups.clear();
            } else {
                allGroups.forEach(g => state.collapsedGroups.add(g));
            }
            applyGroupCollapseState();
        });

        document.querySelectorAll('.dre-th-tip').forEach(tip => {
            on(tip, 'click', (e) => {
                e.stopPropagation();
                const wasOpen = tip.classList.contains('tip-open');
                document.querySelectorAll('.dre-th-tip.tip-open').forEach(t => t.classList.remove('tip-open'));
                if (!wasOpen) tip.classList.add('tip-open');
            });
        });
        on(document, 'click', () => {
            document.querySelectorAll('.dre-th-tip.tip-open').forEach(t => t.classList.remove('tip-open'));
        });

        on(document.getElementById('dre-btn-toggle-close-inline'), 'click', () => {
            if (!state.report) return;
            const isClosed = Boolean(state.report.selectedMonthSummary.taxConfig?.isClosed);
            toggleMonthLock(state.report.meta.selectedMonthKey, isClosed ? 'reopen' : 'close');
        });

        on(document.getElementById('exp-filter-scope'), 'change', () => state.report && renderExpensesSection(state.report));
        on(document.getElementById('exp-filter-group'), 'change', () => state.report && renderExpensesSection(state.report));
        on(document.getElementById('exp-filter-search'), 'input', () => state.report && renderExpensesSection(state.report));

        on(document.getElementById('rev-filter-scope'), 'change', () => {
            state.revPage = 1;
            if (state.report) renderRevenueLedgerRows(state.report);
        });
        on(document.getElementById('rev-filter-search'), 'input', () => {
            state.revPage = 1;
            if (state.report) renderRevenueLedgerRows(state.report);
        });
        on(document.getElementById('dre-rev-prev'), 'click', () => {
            if (state.revPage > 1) {
                state.revPage -= 1;
                if (state.report) renderRevenueLedgerRows(state.report);
            }
        });
        on(document.getElementById('dre-rev-next'), 'click', () => {
            state.revPage += 1;
            if (state.report) renderRevenueLedgerRows(state.report);
        });

        on(document.getElementById('dre-modal-close'), 'click', closeFiscalModal);
        on(document.getElementById('dre-modal-cancel'), 'click', closeFiscalModal);
        on(document.getElementById('dre-fiscal-form'), 'submit', (e) => {
            e.preventDefault();
            submitFiscalConfig('save');
        });
        on(document.getElementById('dre-btn-save-and-close-month'), 'click', () => {
            if (window.confirm('Salvar configurações fiscais e FECHAR contabilmente este mês?')) {
                submitFiscalConfig('close');
            }
        });

        await loadDreData();
    };

    window.cleanupPage = function () {
        if (state.chart) {
            state.chart.destroy();
            state.chart = null;
        }
        if (state.toastTimer) {
            clearTimeout(state.toastTimer);
            state.toastTimer = null;
        }
        state.boundHandlers.forEach(({ el, event, handler }) => {
            try { el.removeEventListener(event, handler); } catch (_) {}
        });
        state.boundHandlers = [];
        state.report = null;
    };
})();

const fetch = require('node-fetch');
const db = require('../models');
const metaAdsService = require('./metaAdsService');
const googleAdsService = require('./googleAdsService');
const reconciliationService = require('./reconciliationService');

const VALID_DRE_GROUPS = [
    'DEDUCTION_TAX',
    'COGS',
    'OPEX_MARKETING',
    'OPEX_PERSONNEL',
    'OPEX_ADMIN',
    'FINANCIAL_INCOME',
    'FINANCIAL_EXPENSE',
    'PROFIT_TAX'
];

const DRE_GROUP_META = {
    DEDUCTION_TAX: {
        label: 'Deduções / Tributos sobre Receita (Extras)',
        shortLabel: 'Tributos s/ Receita',
        nature: 'VARIABLE',
        purpose: 'OPERATION',
        sign: -1
    },
    COGS: {
        label: '4.2 Custos Diretos dos Serviços (CSP / APIs / IA)',
        shortLabel: 'Custos Diretos (CSP)',
        nature: 'VARIABLE',
        purpose: 'OPERATION',
        sign: -1
    },
    OPEX_MARKETING: {
        label: '6.1 Despesas Comerciais & Marketing (Ads)',
        shortLabel: 'Comercial & Marketing',
        nature: 'VARIABLE',
        purpose: 'GROWTH',
        sign: -1
    },
    OPEX_PERSONNEL: {
        label: '6.2 Despesas com Pessoal / Pró-Labore / Terceiros',
        shortLabel: 'Pessoal & Pró-Labore',
        nature: 'FIXED',
        purpose: 'OPERATION',
        sign: -1
    },
    OPEX_ADMIN: {
        label: '6.3 Despesas Administrativas, Cloud & Contabilidade (OPEX Fixo)',
        shortLabel: 'Admin, Cloud & Contab.',
        nature: 'FIXED',
        purpose: 'OPERATION',
        sign: -1
    },
    FINANCIAL_INCOME: {
        label: 'Receitas Financeiras / Rendimentos',
        shortLabel: 'Receitas Financeiras',
        nature: 'VARIABLE',
        purpose: 'OPERATION',
        sign: 1
    },
    FINANCIAL_EXPENSE: {
        label: 'Despesas Financeiras / Juros / Tarifas Bancárias',
        shortLabel: 'Despesas Financeiras',
        nature: 'VARIABLE',
        purpose: 'OPERATION',
        sign: -1
    },
    PROFIT_TAX: {
        label: 'Tributos sobre o Lucro (IRPJ / CSLL)',
        shortLabel: 'IRPJ / CSLL',
        nature: 'VARIABLE',
        purpose: 'OPERATION',
        sign: -1
    }
};

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MONTH_FULL_LABELS = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

let schemaChecked = false;
async function ensureRenderMovedToOpexAdmin() {
    try {
        const settingsRow = await db.SystemSetting.findOne();
        if (settingsRow && settingsRow.auto_recurring_expenses) {
            const parsed = parseRecurringRules(settingsRow.auto_recurring_expenses);
            let changed = false;
            const migrated = parsed.map(rule => {
                const isRender = rule.provider === 'RENDER' || /\brender\b/i.test(rule.name || '');
                if (isRender && rule.dreGroup === 'COGS') {
                    changed = true;
                    return {
                        ...rule,
                        provider: 'RENDER',
                        dreGroup: 'OPEX_ADMIN',
                        category: (!rule.category || rule.category === 'Infra / Fixo') ? 'Cloud / Infraestrutura' : rule.category
                    };
                }
                return rule;
            });
            if (changed) {
                await settingsRow.update({ auto_recurring_expenses: JSON.stringify(migrated) });
            }
        }

        const { Op } = db.Sequelize;
        const cogsRenderRows = await db.YeloExpense.findAll({
            where: {
                dreGroup: 'COGS',
                [Op.or]: [
                    { provider: 'RENDER' },
                    { name: { [Op.iLike]: '%render%' } }
                ]
            }
        });
        if (cogsRenderRows.length > 0) {
            const closedRows = await db.YeloMonthlyFinance.findAll({
                where: { isClosed: true },
                attributes: ['monthYear'],
                raw: true
            });
            const closedSet = new Set(closedRows.map(r => r.monthYear));
            const opexMeta = DRE_GROUP_META.OPEX_ADMIN;
            for (const row of cogsRenderRows) {
                if (closedSet.has(row.monthYear)) continue;
                await row.update({
                    dreGroup: 'OPEX_ADMIN',
                    nature: opexMeta.nature,
                    purpose: opexMeta.purpose,
                    provider: 'RENDER'
                });
            }
        }
    } catch (err) {
        console.warn('[DRE] Aviso ao migrar Render COGS -> OPEX_ADMIN:', err.message);
    }
}

async function ensureDreSchema() {
    if (schemaChecked) return;
    const queries = [
        `ALTER TABLE "YeloExpenses" ADD COLUMN IF NOT EXISTS "dreGroup" VARCHAR(40);`,
        `ALTER TABLE "YeloExpenses" ADD COLUMN IF NOT EXISTS "expenseDate" DATE;`,
        `ALTER TABLE "YeloExpenses" ADD COLUMN IF NOT EXISTS "documentNumber" VARCHAR(100);`,
        `ALTER TABLE "YeloExpenses" ADD COLUMN IF NOT EXISTS "notes" TEXT;`,
        `ALTER TABLE "YeloMonthlyFinances" ADD COLUMN IF NOT EXISTS "appliedProfitTaxRate" DECIMAL(5,4);`,
        `ALTER TABLE "YeloMonthlyFinances" ADD COLUMN IF NOT EXISTS "notes" TEXT;`,
        `ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "company_legal_name" VARCHAR(255);`,
        `ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "company_cnpj" VARCHAR(32);`,
        `ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "tax_regime" VARCHAR(40) DEFAULT 'SIMPLES_NACIONAL';`,
        `ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "auto_recurring_expenses" TEXT;`,
        `ALTER TABLE "Payments" ADD COLUMN IF NOT EXISTS "nfIssuedAt" TIMESTAMPTZ;`,
        `ALTER TABLE "Payments" ADD COLUMN IF NOT EXISTS "nfNumber" VARCHAR(80);`
    ];
    for (const sql of queries) {
        try {
            await db.sequelize.query(sql);
        } catch (_) {
            // Não interrompe caso ambiente utilize permissões restritas (migração já está em dbFixes.js)
        }
    }
    await ensureRenderMovedToOpexAdmin();
    schemaChecked = true;
}

const adSyncCooldown = new Map();
const adSyncWarnings = new Map();
const providerAuthErrors = new Map();
const CURRENT_MONTH_SYNC_TTL_MS = 15 * 60 * 1000;
const PAST_MONTH_SYNC_TTL_MS = 12 * 60 * 60 * 1000;
const AUTH_ERROR_TTL_MS = 10 * 60 * 1000;

function isAuthErrorMsg(msg) {
    return /token|session|expired|oauth|unauthorized|auth_failed/i.test(String(msg || ''));
}

function parseRecurringRules(raw) {
    if (!raw) return [];
    try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter(r => r && typeof r === 'object' && r.name && Number(r.amount) > 0)
            .map(r => ({
                id: String(r.id || `rule-${String(r.name).toLowerCase().replace(/[^a-z0-9]/g, '')}`),
                name: String(r.name).trim().slice(0, 120),
                amount: round2(r.amount),
                dreGroup: VALID_DRE_GROUPS.includes(r.dreGroup) ? r.dreGroup : 'OPEX_ADMIN',
                category: String(r.category || 'Infra / Fixo').trim().slice(0, 80),
                provider: ['GOOGLE', 'META', 'ASAAS', 'RENDER', 'OPENAI', 'WHATSAPP', 'ACCOUNTING', 'OTHER'].includes(r.provider) ? r.provider : 'OTHER',
                startMonth: /^\d{4}-(0[1-9]|1[0-2])$/.test(r.startMonth || '') ? r.startMonth : '2026-01',
                active: r.active !== false
            }));
    } catch (_) {
        return [];
    }
}

function monthRangeDates(monthYear) {
    const [y, m] = monthYear.split('-').map(Number);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return {
        dateStart: `${monthYear}-01`,
        dateEnd: `${monthYear}-${String(lastDay).padStart(2, '0')}`
    };
}

async function syncSingleMonth({ monthYear, settings = null, isClosed = false, force = false }) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthYear) || isClosed) {
        return { monthYear, synced: [], skipped: [], warnings: [] };
    }

    const todayIso = toIsoDateBRT(new Date());
    const nowMonthKey = todayIso.slice(0, 7);
    if (monthYear > nowMonthKey) {
        return { monthYear, synced: [], skipped: [], warnings: [] };
    }

    const sys = settings || (await db.SystemSetting.findOne({ raw: true })) || {};
    const rules = parseRecurringRules(sys.auto_recurring_expenses);
    const monthExpenses = await db.YeloExpense.findAll({ where: { monthYear } });

    const synced = [];
    const skipped = [];
    const warnings = [];

    // 1. Aplica despesas fixas recorrentes automáticas (ex: Render R$ 81,98)
    for (const rule of rules) {
        if (!rule.active || monthYear < rule.startMonth) continue;

        const normRuleName = rule.name.toLowerCase();
        const manualOverride = monthExpenses.find(e =>
            e.entryMethod !== 'SYSTEM' && (
                (rule.provider !== 'OTHER' && e.provider === rule.provider) ||
                String(e.name || '').toLowerCase() === normRuleName
            )
        );
        if (manualOverride) continue;

        const existingSys = monthExpenses.find(e =>
            e.entryMethod === 'SYSTEM' && (
                (rule.provider !== 'OTHER' && e.provider === rule.provider) ||
                String(e.name || '').toLowerCase() === normRuleName
            )
        );
        const groupMeta = DRE_GROUP_META[rule.dreGroup] || DRE_GROUP_META.OPEX_ADMIN;
        if (existingSys) {
            if (Math.abs(Number(existingSys.amount) - rule.amount) > 0.009 || existingSys.dreGroup !== rule.dreGroup || existingSys.nature !== groupMeta.nature) {
                await existingSys.update({
                    name: rule.name,
                    amount: rule.amount,
                    category: rule.category,
                    dreGroup: rule.dreGroup,
                    nature: groupMeta.nature,
                    purpose: groupMeta.purpose,
                    provider: rule.provider
                });
                synced.push({ provider: rule.provider, label: rule.name, amount: rule.amount, kind: 'RECURRING' });
            }
        } else {
            const createdRow = await db.YeloExpense.create({
                name: rule.name,
                amount: rule.amount,
                monthYear,
                category: rule.category,
                nature: groupMeta.nature,
                purpose: groupMeta.purpose,
                provider: rule.provider,
                entryMethod: 'SYSTEM',
                dreGroup: rule.dreGroup,
                expenseDate: `${monthYear}-01`,
                notes: 'Recorrência fixa mensal automática'
            });
            monthExpenses.push(createdRow);
            synced.push({ provider: rule.provider, label: rule.name, amount: rule.amount, kind: 'RECURRING' });
        }
    }

    // 2. Sincroniza Google Ads e Meta Ads sem sobrescrever lançamentos manuais
    const { dateStart, dateEnd } = monthRangeDates(monthYear);
    const effectiveEnd = monthYear === nowMonthKey ? todayIso : dateEnd;
    const isPastMonth = monthYear < nowMonthKey;
    const ttlMs = isPastMonth ? PAST_MONTH_SYNC_TTL_MS : CURRENT_MONTH_SYNC_TTL_MS;

    const syncAdProvider = async (providerKey, label, isReadyFn, fetchFn) => {
        const hasManual = monthExpenses.some(e => {
            if (e.entryMethod === 'API') return false;
            const prov = String(e.provider || '').toUpperCase();
            const cat = String(e.category || '').toLowerCase();
            if (providerKey === 'GOOGLE') return prov === 'GOOGLE' || cat.includes('google');
            return prov === 'META' || cat.includes('meta') || cat.includes('facebook');
        });
        if (hasManual) {
            skipped.push(`${label} (preservado lançamento manual)`);
            return;
        }

        const existingApi = monthExpenses.find(e => e.entryMethod === 'API' && e.provider === providerKey);
        const cacheKey = `${monthYear}::${providerKey}`;
        const lastAttemptAt = adSyncCooldown.get(cacheKey) || 0;
        const alreadyFinalizedPast = isPastMonth && existingApi && new Date(existingApi.updatedAt) > new Date(`${dateEnd}T23:59:59Z`);

        if (!force && (alreadyFinalizedPast || (Date.now() - lastAttemptAt < ttlMs))) {
            return;
        }

        const authErrState = providerAuthErrors.get(providerKey);
        if (!force && authErrState && (Date.now() - authErrState.at < AUTH_ERROR_TTL_MS)) {
            warnings.push({ provider: providerKey, label, message: authErrState.message });
            return;
        }
        if (force) {
            providerAuthErrors.delete(providerKey);
        }

        if (!isReadyFn()) {
            adSyncCooldown.set(cacheKey, Date.now());
            skipped.push(`${label} (credenciais não configuradas)`);
            return;
        }

        try {
            if (force && typeof metaAdsService.cache?.clear === 'function' && providerKey === 'META') {
                metaAdsService.cache.clear();
            }
            if (force && typeof googleAdsService.cache?.clear === 'function' && providerKey === 'GOOGLE') {
                googleAdsService.cache.clear();
            }
            const res = await fetchFn(dateStart, effectiveEnd);
            adSyncCooldown.set(cacheKey, Date.now());

            if (res && res.error) {
                if (isAuthErrorMsg(res.error)) {
                    providerAuthErrors.set(providerKey, { at: Date.now(), message: res.error });
                }
                warnings.push({ provider: providerKey, label, message: res.error });
                skipped.push(`${label} (${res.error})`);
                return;
            }
            providerAuthErrors.delete(providerKey);

            const amt = round2(res?.spend || 0);
            if (amt <= 0) {
                skipped.push(`${label} (R$ 0,00)`);
                return;
            }

            if (existingApi) {
                await existingApi.update({
                    amount: amt,
                    dreGroup: 'OPEX_MARKETING',
                    nature: 'VARIABLE',
                    purpose: 'GROWTH',
                    expenseDate: effectiveEnd,
                    notes: `Sincronizado automaticamente (${dateStart} a ${effectiveEnd})`
                });
            } else {
                await db.YeloExpense.create({
                    name: `${label} (Automático API)`,
                    amount: amt,
                    monthYear,
                    category: label,
                    nature: 'VARIABLE',
                    purpose: 'GROWTH',
                    provider: providerKey,
                    entryMethod: 'API',
                    dreGroup: 'OPEX_MARKETING',
                    expenseDate: effectiveEnd,
                    notes: `Sincronizado automaticamente (${dateStart} a ${effectiveEnd})`
                });
            }
            synced.push({ provider: providerKey, label, amount: amt, kind: 'ADS_API' });
        } catch (err) {
            adSyncCooldown.set(cacheKey, Date.now());
            const msg = err?.response?.data?.error?.message || err.message;
            if (isAuthErrorMsg(msg)) {
                providerAuthErrors.set(providerKey, { at: Date.now(), message: msg });
            }
            warnings.push({ provider: providerKey, label, message: msg });
            skipped.push(`${label} (${msg})`);
        }
    };

    await Promise.all([
        syncAdProvider(
            'META',
            'Meta Ads',
            () => Boolean(metaAdsService.accessToken && metaAdsService.accessToken !== 'MOCK_META_TOKEN' && metaAdsService.adAccountId && metaAdsService.adAccountId !== 'MOCK_ACCOUNT_ID'),
            (s, e) => metaAdsService.getAccountSpend(s, e)
        ),
        syncAdProvider(
            'GOOGLE',
            'Google Ads',
            () => Boolean(googleAdsService.isConfigured && googleAdsService.isConfigured()),
            (s, e) => googleAdsService.getAccountSpend(s, e)
        )
    ]);

    if (warnings.length > 0) {
        adSyncWarnings.set(monthYear, warnings);
    } else {
        adSyncWarnings.delete(monthYear);
    }

    return { monthYear, synced, skipped, warnings };
}

async function fetchAsaasPaginated(endpoint, apiKey, maxPages = 40) {
    const baseUrl = reconciliationService.getAsaasApiUrl();
    const out = [];
    let offset = 0;

    for (let page = 0; page < maxPages; page++) {
        const sep = endpoint.includes('?') ? '&' : '?';
        const url = `${baseUrl}${endpoint}${sep}limit=100&offset=${offset}`;
        const res = await fetch(url, {
            headers: {
                access_token: apiKey,
                'Content-Type': 'application/json'
            }
        });
        if (!res.ok) {
            throw new Error(`Asaas API ${res.status} em ${endpoint}`);
        }
        const data = await res.json();
        const items = Array.isArray(data?.data) ? data.data : [];
        if (items.length === 0) break;
        out.push(...items);
        if (!data.hasMore) break;
        offset += 100;
    }

    return out;
}

/**
 * Sincroniza pagamentos pagos/estornados e taxas de mensageria (PAYMENT_MESSAGING_NOTIFICATION_FEE)
 * da API do Asaas para Payments + PaymentFinancialEvents no exercício alvo.
 */
async function syncAsaasLedgerForYear({ year, force = false }) {
    const apiKey = process.env.ASAAS_API_KEY ? process.env.ASAAS_API_KEY.trim() : '';
    if (!apiKey || apiKey.startsWith('MOCK') || process.env.NODE_ENV === 'test') {
        return { synced: [], warnings: [] };
    }

    const targetYear = Math.min(Math.max(parseInt(year, 10) || new Date().getFullYear(), 2020), 2100);
    const cacheKey = `ASAAS::${targetYear}`;
    const lastAttemptAt = adSyncCooldown.get(cacheKey) || 0;
    if (!force && (Date.now() - lastAttemptAt < CURRENT_MONTH_SYNC_TTL_MS)) {
        return { synced: [], warnings: [] };
    }

    const todayIso = toIsoDateBRT(new Date());
    const yearStart = `${targetYear}-01-01`;
    const yearEnd = todayIso < `${targetYear}-12-31` ? todayIso : `${targetYear}-12-31`;
    if (yearEnd < yearStart) {
        return { synced: [], warnings: [] };
    }

    try {
        const [asaasPayments, finTxs] = await Promise.all([
            fetchAsaasPaginated('/payments', apiKey),
            fetchAsaasPaginated(`/financialTransactions?startDate=${yearStart}&finishDate=${yearEnd}`, apiKey)
        ]);
        adSyncCooldown.set(cacheKey, Date.now());
        providerAuthErrors.delete('ASAAS');

        const notifTxs = finTxs.filter(t => t && t.type === 'PAYMENT_MESSAGING_NOTIFICATION_FEE' && t.paymentId);
        const notifPaymentIds = new Set(notifTxs.map(t => t.paymentId));

        const PAID_OR_NEG_STATUSES = new Set([
            'RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH',
            'REFUNDED', 'REFUND_IN_PROGRESS',
            'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE', 'AWAITING_CHARGEBACK_REVERSAL'
        ]);
        const dateInTargetScope = (raw) => {
            const s = String(raw || '').slice(0, 7);
            return s.startsWith(`${targetYear}-`) || s === `${targetYear - 1}-12`;
        };

        const relevantPayments = asaasPayments.filter(p => {
            if (!p || !p.id) return false;
            if (notifPaymentIds.has(p.id)) return true;
            if (!PAID_OR_NEG_STATUSES.has(p.status)) return false;
            const hasRefundInYear = Array.isArray(p.refunds) && p.refunds.some(r => dateInTargetScope(r?.dateCreated));
            return (
                hasRefundInYear ||
                dateInTargetScope(p.confirmedDate) ||
                dateInTargetScope(p.clientPaymentDate) ||
                dateInTargetScope(p.paymentDate) ||
                dateInTargetScope(p.creditDate) ||
                dateInTargetScope(p.dueDate)
            );
        });

        const [psychRows, subRows, existingPayRows, existingEventRows] = await Promise.all([
            db.Psychologist.findAll({ attributes: ['id', 'subscriptionId'], raw: true }),
            db.Subscription.findAll({ attributes: ['id'], raw: true }),
            db.Payment.findAll({ attributes: ['id', 'status', 'paymentDate', 'dueDate'], raw: true }),
            db.PaymentFinancialEvent.findAll({
                attributes: ['id', 'paymentId', 'eventType', 'externalEventId', 'feeAmount', 'sourceMetadata'],
                raw: true
            })
        ]);

        const validPsychIds = new Set(psychRows.map(r => Number(r.id)));
        const subToPsych = new Map();
        for (const r of psychRows) {
            if (r.subscriptionId) subToPsych.set(r.subscriptionId, Number(r.id));
        }
        const validSubIds = new Set(subRows.map(s => s.id));

        const existingPayMap = new Map(existingPayRows.map(p => [p.id, p]));
        const eventCompositeKeys = new Set();
        const eventPaymentTypeKeys = new Set();
        const refundCountByPayment = new Map();
        const confRowsNeedingFee = new Map();

        for (const ev of existingEventRows) {
            eventCompositeKeys.add(`${ev.paymentId}::${ev.eventType}::${ev.externalEventId}`);
            eventPaymentTypeKeys.add(`${ev.paymentId}::${ev.eventType}`);
            if (ev.eventType === 'REFUND') {
                refundCountByPayment.set(ev.paymentId, (refundCountByPayment.get(ev.paymentId) || 0) + 1);
            }
            if (ev.eventType === 'PAYMENT_CONFIRMED' && ev.feeAmount === null) {
                const meta = typeof ev.sourceMetadata === 'string'
                    ? (() => { try { return JSON.parse(ev.sourceMetadata); } catch (_) { return null; } })()
                    : ev.sourceMetadata;
                if (!meta || meta.netValue === undefined || meta.netValue === null) {
                    confRowsNeedingFee.set(ev.paymentId, { id: ev.id, meta });
                }
            }
        }

        let createdPayments = 0;
        let updatedPayments = 0;
        let createdEvents = 0;

        for (const p of relevantPayments) {
            const rawPayDate = p.confirmedDate || p.clientPaymentDate || p.paymentDate || null;
            const parsedExtId = p.externalReference ? Number(p.externalReference) : NaN;
            const psiId = Number.isInteger(parsedExtId) && validPsychIds.has(parsedExtId)
                ? parsedExtId
                : (p.subscription ? (subToPsych.get(p.subscription) || null) : null);
            const subId = p.subscription && validSubIds.has(p.subscription) ? p.subscription : null;

            const existingPay = existingPayMap.get(p.id);
            if (!existingPay) {
                try {
                    await db.Payment.create({
                        id: p.id,
                        subscriptionId: subId,
                        psychologistId: psiId,
                        status: p.status,
                        value: round2(p.value),
                        billingType: p.billingType || 'UNDEFINED',
                        dueDate: (p.dueDate || rawPayDate || `${targetYear}-01-01`).slice(0, 10),
                        paymentDate: rawPayDate ? new Date(rawPayDate) : null
                    });
                    existingPayMap.set(p.id, { id: p.id, status: p.status, paymentDate: rawPayDate });
                    createdPayments++;
                } catch (err) {
                    if (err.name !== 'SequelizeUniqueConstraintError') throw err;
                }
            } else if (existingPay.status !== p.status || (!existingPay.paymentDate && rawPayDate)) {
                await db.Payment.update(
                    {
                        status: p.status,
                        paymentDate: existingPay.paymentDate || (rawPayDate ? new Date(rawPayDate) : null)
                    },
                    { where: { id: p.id } }
                );
                updatedPayments++;
            }

            if (!PAID_OR_NEG_STATUSES.has(p.status)) continue;

            const confDateStr = p.confirmedDate || p.clientPaymentDate || p.paymentDate;
            const feeObs = (p.netValue !== undefined && p.netValue !== null)
                ? round2(Math.max(0, Number(p.value) - Number(p.netValue)))
                : null;

            if (confDateStr && !eventPaymentTypeKeys.has(`${p.id}::PAYMENT_CONFIRMED`)) {
                try {
                    await db.PaymentFinancialEvent.create({
                        paymentId: p.id,
                        externalEventId: p.id,
                        eventType: 'PAYMENT_CONFIRMED',
                        grossAmount: round2(p.value),
                        feeAmount: feeObs,
                        netCashAmount: null,
                        cashDeltaAmount: null,
                        eventDate: String(confDateStr).slice(0, 10),
                        sourceMetadata: {
                            id: p.id,
                            status: p.status,
                            billingType: p.billingType,
                            confirmedDate: p.confirmedDate || null,
                            clientPaymentDate: p.clientPaymentDate || null,
                            expectedCreditDate: p.creditDate || p.estimatedCreditDate || null,
                            value: p.value,
                            netValue: p.netValue,
                            source: 'asaas_dre_sync'
                        }
                    });
                    eventPaymentTypeKeys.add(`${p.id}::PAYMENT_CONFIRMED`);
                    createdEvents++;
                } catch (err) {
                    if (err.name !== 'SequelizeUniqueConstraintError') throw err;
                }
            } else if (feeObs !== null && confRowsNeedingFee.has(p.id)) {
                const entry = confRowsNeedingFee.get(p.id);
                await db.PaymentFinancialEvent.update(
                    {
                        feeAmount: feeObs,
                        sourceMetadata: { ...(entry.meta || {}), value: p.value, netValue: p.netValue }
                    },
                    { where: { id: entry.id } }
                );
            }

            if (['RECEIVED', 'RECEIVED_IN_CASH'].includes(p.status) && p.creditDate && !eventPaymentTypeKeys.has(`${p.id}::PAYMENT_CREDITED`)) {
                const netVal = p.netValue !== undefined && p.netValue !== null ? round2(p.netValue) : round2(p.value);
                const credFee = round2(Math.max(0, Number(p.value) - netVal));
                try {
                    await db.PaymentFinancialEvent.create({
                        paymentId: p.id,
                        externalEventId: p.id,
                        eventType: 'PAYMENT_CREDITED',
                        grossAmount: round2(p.value),
                        feeAmount: credFee,
                        netCashAmount: netVal,
                        cashDeltaAmount: netVal,
                        eventDate: String(p.creditDate).slice(0, 10),
                        sourceMetadata: {
                            id: p.id,
                            status: p.status,
                            billingType: p.billingType,
                            creditDate: p.creditDate,
                            value: p.value,
                            netValue: p.netValue,
                            source: 'asaas_dre_sync'
                        }
                    });
                    eventPaymentTypeKeys.add(`${p.id}::PAYMENT_CREDITED`);
                    createdEvents++;
                } catch (err) {
                    if (err.name !== 'SequelizeUniqueConstraintError') throw err;
                }
            }

            if (['REFUNDED', 'REFUND_IN_PROGRESS'].includes(p.status) && Array.isArray(p.refunds) && p.refunds.length > 0) {
                const existingRefCount = refundCountByPayment.get(p.id) || 0;
                if (existingRefCount < p.refunds.length) {
                    for (const ref of p.refunds) {
                        const extId = ref.id || `ref_${p.id}_${ref.dateCreated}_${ref.value}`;
                        const compKey = `${p.id}::REFUND::${extId}`;
                        if (eventCompositeKeys.has(compKey)) continue;
                        try {
                            await db.PaymentFinancialEvent.create({
                                paymentId: p.id,
                                externalEventId: extId,
                                eventType: 'REFUND',
                                grossAmount: round2(ref.value || p.value),
                                feeAmount: null,
                                netCashAmount: null,
                                cashDeltaAmount: null,
                                eventDate: String(ref.dateCreated || confDateStr || todayIso).slice(0, 10),
                                eventOccurredAt: ref.dateCreated ? new Date(ref.dateCreated) : null,
                                sourceMetadata: {
                                    id: p.id,
                                    status: p.status,
                                    billingType: p.billingType,
                                    refundId: ref.id || null,
                                    reason: ref.reason || null,
                                    value: ref.value || p.value,
                                    originalPaymentId: p.id,
                                    source: 'asaas_dre_sync'
                                }
                            });
                            eventCompositeKeys.add(compKey);
                            createdEvents++;
                        } catch (err) {
                            if (err.name !== 'SequelizeUniqueConstraintError') throw err;
                        }
                    }
                }
            }
        }

        let createdNotifFees = 0;
        for (const tx of notifTxs) {
            if (!existingPayMap.has(tx.paymentId)) continue;
            const compKey = `${tx.paymentId}::GATEWAY_CASH_MOVEMENT::${tx.id}`;
            if (eventCompositeKeys.has(compKey)) continue;
            const absFee = round2(Math.abs(Number(tx.value || 0)));
            if (absFee <= 0 || !tx.date) continue;

            try {
                await db.PaymentFinancialEvent.create({
                    paymentId: tx.paymentId,
                    externalEventId: tx.id,
                    eventType: 'GATEWAY_CASH_MOVEMENT',
                    grossAmount: absFee,
                    feeAmount: absFee,
                    netCashAmount: null,
                    cashDeltaAmount: round2(Number(tx.value || 0)),
                    eventDate: String(tx.date).slice(0, 10),
                    eventOccurredAt: null,
                    sourceMetadata: {
                        id: tx.paymentId,
                        transactionId: tx.id,
                        transactionType: 'PAYMENT_MESSAGING_NOTIFICATION_FEE',
                        value: tx.value,
                        balance: tx.balance,
                        description: tx.description ? String(tx.description).slice(0, 120) : null,
                        source: 'asaas_dre_sync'
                    }
                });
                eventCompositeKeys.add(compKey);
                createdNotifFees++;
            } catch (err) {
                if (err.name !== 'SequelizeUniqueConstraintError') throw err;
            }
        }

        const synced = [];
        if (createdPayments || updatedPayments || createdEvents || createdNotifFees) {
            synced.push({
                provider: 'ASAAS',
                label: 'Asaas Ledger & Mensageria',
                kind: 'ASAAS_SYNC',
                createdPayments,
                updatedPayments,
                createdEvents,
                createdNotifFees
            });
        }
        return { synced, warnings: [] };
    } catch (err) {
        adSyncCooldown.set(cacheKey, Date.now());
        const msg = err?.message || 'Falha ao consultar Asaas';
        return { synced: [], warnings: [{ provider: 'ASAAS', label: 'Asaas API', message: msg }] };
    }
}

async function autoSyncForYear({ year, selectedMonth, force = false }) {
    await ensureDreSchema();
    const targetYear = Math.min(Math.max(parseInt(year, 10) || new Date().getFullYear(), 2020), 2100);
    const todayIso = toIsoDateBRT(new Date());
    const nowMonthKey = todayIso.slice(0, 7);
    const settings = (await db.SystemSetting.findOne({ raw: true })) || {};

    const yearMonthKeys = Array.from({ length: 12 }, (_, i) => `${targetYear}-${String(i + 1).padStart(2, '0')}`)
        .filter(mk => mk <= nowMonthKey);

    if (yearMonthKeys.length === 0) return { synced: [], warnings: [] };

    const asaasSyncPromise = syncAsaasLedgerForYear({ year: targetYear, force });

    const mfRows = await db.YeloMonthlyFinance.findAll({
        where: { monthYear: yearMonthKeys },
        raw: true
    });
    const closedSet = new Set(mfRows.filter(m => m.isClosed).map(m => m.monthYear));

    // Garante que o mês selecionado e os meses abertos do exercício sejam sincronizados
    const selMk = `${targetYear}-${String(Math.min(Math.max(parseInt(selectedMonth, 10) || 1, 1), 12)).padStart(2, '0')}`;
    const monthsToSync = yearMonthKeys.filter(mk => !closedSet.has(mk));

    const results = [];
    if (monthsToSync.includes(selMk)) {
        results.push(await syncSingleMonth({
            monthYear: selMk,
            settings,
            isClosed: false,
            force: Boolean(force)
        }));
    }
    const restMonths = monthsToSync.filter(mk => mk !== selMk);
    if (restMonths.length > 0) {
        const restResults = await Promise.all(
            restMonths.map(mk => syncSingleMonth({
                monthYear: mk,
                settings,
                isClosed: false,
                force: false
            }))
        );
        results.push(...restResults);
    }

    const asaasRes = await asaasSyncPromise;
    const allSynced = [
        ...(asaasRes.synced || []).map(s => ({ monthYear: `${targetYear}`, ...s })),
        ...results.flatMap(r => r.synced.map(s => ({ monthYear: r.monthYear, ...s })))
    ];
    const allWarnings = [
        ...(asaasRes.warnings || []).map(w => ({ monthYear: `${targetYear}`, ...w })),
        ...results.flatMap(r => r.warnings.map(w => ({ monthYear: r.monthYear, ...w })))
    ];
    return { synced: allSynced, warnings: allWarnings };
}

function round2(n) {
    return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
}

function toMonthKeyBRT(rawDate) {
    if (!rawDate) return null;
    if (typeof rawDate === 'string' && /^\d{4}-\d{2}/.test(rawDate)) {
        if (rawDate.length === 10 || !rawDate.includes('T')) {
            return rawDate.slice(0, 7);
        }
    }
    const d = new Date(rawDate);
    if (Number.isNaN(d.getTime())) return null;
    const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit'
    }).format(d);
    return fmt.slice(0, 7);
}

function toIsoDateBRT(rawDate) {
    if (!rawDate) return null;
    if (typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
        return rawDate;
    }
    const d = new Date(rawDate);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(d);
}

function classifyPlanBucket(plano) {
    const raw = String(plano || '').toLowerCase();
    if (raw.includes('essenc') || raw.includes('essent')) return 'essential';
    if (raw.includes('clínic') || raw.includes('clinic')) return 'clinical';
    if (raw.includes('sol') || raw.includes('refer')) return 'reference';
    return 'other';
}

function inferDreGroup(exp) {
    if (exp.dreGroup && VALID_DRE_GROUPS.includes(exp.dreGroup)) {
        return exp.dreGroup;
    }
    const provider = String(exp.provider || '').toUpperCase();
    const purpose = String(exp.purpose || '').toUpperCase();
    const nature = String(exp.nature || '').toUpperCase();
    const cat = String(exp.category || '').toLowerCase();
    const name = String(exp.name || '').toLowerCase();

    if (
        purpose === 'GROWTH' ||
        provider === 'GOOGLE' ||
        provider === 'META' ||
        cat.includes('ads') ||
        cat.includes('marketing') ||
        cat.includes('tráfego') ||
        cat.includes('trafego')
    ) {
        return 'OPEX_MARKETING';
    }
    if (
        cat.includes('pró-labore') ||
        cat.includes('pro-labore') ||
        cat.includes('pro labore') ||
        cat.includes('salár') ||
        cat.includes('salar') ||
        cat.includes('pessoal') ||
        cat.includes('folha') ||
        name.includes('pró-labore') ||
        name.includes('pro-labore')
    ) {
        return 'OPEX_PERSONNEL';
    }
    if (
        cat.includes('financeir') ||
        cat.includes('juros') ||
        cat.includes('tarifa banc') ||
        name.includes('iof') ||
        name.includes('juros')
    ) {
        return 'FINANCIAL_EXPENSE';
    }
    if (cat.includes('irpj') || cat.includes('csll')) {
        return 'PROFIT_TAX';
    }
    if (cat.includes('impost') || cat.includes('das') || cat.includes('iss') || cat.includes('tributo')) {
        return 'DEDUCTION_TAX';
    }
    if (
        (nature === 'VARIABLE' && purpose === 'OPERATION') ||
        provider === 'OPENAI' ||
        provider === 'WHATSAPP' ||
        provider === 'ASAAS'
    ) {
        return 'COGS';
    }
    return 'OPEX_ADMIN';
}

function estimateGatewayFee(value, billingType, observedCreditCardRate = null) {
    const val = Number(value || 0);
    if (val <= 0) return 0;
    const method = String(billingType || '').toUpperCase();
    if (method === 'CREDIT_CARD') {
        const rate = observedCreditCardRate !== null ? observedCreditCardRate : 0.0299;
        return round2(Math.min(val, val * rate + 0.49));
    }
    // PIX / BOLETO padrão Asaas
    return round2(Math.min(val, 1.99));
}

async function getAvailableYears() {
    const currentYear = Number(
        new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric' }).format(new Date())
    );
    const yearsSet = new Set([currentYear]);

    const queries = [
        `SELECT DISTINCT EXTRACT(YEAR FROM COALESCE("paymentDate", "dueDate"::timestamp, "createdAt"))::int AS yr FROM "Payments" WHERE status IN ('RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'REFUNDED')`,
        `SELECT DISTINCT EXTRACT(YEAR FROM "eventDate")::int AS yr FROM "PaymentFinancialEvents"`,
        `SELECT DISTINCT SUBSTRING("monthYear", 1, 4)::int AS yr FROM "YeloExpenses" WHERE "monthYear" ~ '^\\d{4}-\\d{2}$'`
    ];
    for (const q of queries) {
        try {
            const rows = await db.sequelize.query(q, { type: db.sequelize.QueryTypes.SELECT });
            rows.forEach(r => {
                if (r.yr && r.yr >= 2020 && r.yr <= currentYear + 1) yearsSet.add(Number(r.yr));
            });
        } catch (_) {}
    }

    return Array.from(yearsSet).sort((a, b) => b - a);
}

function formatCnpjStr(digits) {
    const clean = String(digits || '').replace(/\D/g, '');
    if (clean.length !== 14) return clean;
    return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

async function getCnpjNfQueue() {
    await ensureDreSchema();
    const rows = await db.sequelize.query(
        `SELECT p."id", p."subscriptionId", p."psychologistId", p."status", p."value",
                p."billingType", p."dueDate", p."paymentDate", p."createdAt",
                p."nfIssuedAt", p."nfNumber",
                psi."nome" AS "psiNome", psi."email" AS "psiEmail", psi."plano" AS "psiPlano",
                psi."razao_social" AS "razaoSocial", psi."cpf" AS "psiCpf", psi."cnpj" AS "psiCnpj",
                psi."cep", psi."rua", psi."numero", psi."bairro", psi."complemento", psi."cidade", psi."estado"
         FROM "Payments" p
         JOIN "Psychologists" psi ON psi."id" = p."psychologistId"
         WHERE p."status" IN ('RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH')
           AND p."value" > 0
           AND (
               LENGTH(REGEXP_REPLACE(COALESCE(psi."cpf", ''), '[^0-9]', '', 'g')) = 14
               OR LENGTH(REGEXP_REPLACE(COALESCE(psi."cnpj", ''), '[^0-9]', '', 'g')) = 14
           )
         ORDER BY COALESCE(p."paymentDate", p."dueDate"::timestamp, p."createdAt") DESC`,
        { type: db.sequelize.QueryTypes.SELECT }
    ).catch(() => []);

    const nowMs = Date.now();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const items = [];
    let readyCount = 0;
    let readyAmount = 0;
    let waitingCount = 0;
    let waitingAmount = 0;
    let issuedCount = 0;
    let nextReadyMs = null;

    for (const r of rows) {
        const docCnpj = String(r.psiCnpj || '').replace(/\D/g, '');
        const docCpf = String(r.psiCpf || '').replace(/\D/g, '');
        const cnpj = docCnpj.length === 14 ? docCnpj : docCpf;
        if (cnpj.length !== 14) continue;

        const paidAtRaw = r.paymentDate || r.dueDate || r.createdAt;
        const paidAtDate = new Date(paidAtRaw);
        const paidAtMs = Number.isFinite(paidAtDate.getTime()) ? paidAtDate.getTime() : nowMs;
        const eligibleMs = paidAtMs + SEVEN_DAYS_MS;
        const eligibleDateObj = new Date(eligibleMs);

        const isIssued = Boolean(r.nfIssuedAt);
        const nfStatus = isIssued ? 'ISSUED' : (nowMs >= eligibleMs ? 'READY' : 'WAITING_7D');
        const val = round2(r.value);
        const daysRemaining = nfStatus === 'WAITING_7D'
            ? Math.max(1, Math.ceil((eligibleMs - nowMs) / (24 * 60 * 60 * 1000)))
            : 0;

        if (nfStatus === 'READY') {
            readyCount += 1;
            readyAmount = round2(readyAmount + val);
        } else if (nfStatus === 'WAITING_7D') {
            waitingCount += 1;
            waitingAmount = round2(waitingAmount + val);
            if (nextReadyMs === null || eligibleMs < nextReadyMs) {
                nextReadyMs = eligibleMs;
            }
        } else {
            issuedCount += 1;
        }

        const addrParts = [r.rua, r.numero, r.complemento, r.bairro].filter(Boolean);
        const hasFullAddress = Boolean(
            String(r.cep || '').trim()
            && String(r.rua || '').trim()
            && String(r.numero || '').trim()
            && String(r.bairro || '').trim()
            && String(r.cidade || '').trim()
            && String(r.estado || '').trim()
        );

        items.push({
            id: r.id,
            paymentId: r.id,
            psiId: r.psychologistId,
            psiNome: r.psiNome || 'Psicólogo',
            razaoSocial: r.razaoSocial || null,
            psiEmail: r.psiEmail || null,
            cnpj,
            cnpjFormatted: formatCnpjStr(cnpj),
            plano: r.psiPlano || 'Essencial',
            billingType: r.billingType || 'CREDIT_CARD',
            value: val,
            paidDate: toIsoDateBRT(paidAtDate),
            eligibleDate: toIsoDateBRT(eligibleDateObj),
            daysRemaining,
            nfStatus,
            nfIssuedAt: r.nfIssuedAt ? toIsoDateBRT(r.nfIssuedAt) : null,
            nfNumber: r.nfNumber || null,
            cep: r.cep || null,
            addressLine: addrParts.join(', '),
            cityState: [r.cidade, r.estado].filter(Boolean).join('/'),
            hasFullAddress
        });
    }

    const orderWeight = { READY: 0, WAITING_7D: 1, ISSUED: 2 };
    items.sort((a, b) => {
        const wDiff = orderWeight[a.nfStatus] - orderWeight[b.nfStatus];
        if (wDiff !== 0) return wDiff;
        if (a.nfStatus === 'ISSUED') return String(b.paidDate).localeCompare(String(a.paidDate));
        return String(a.eligibleDate).localeCompare(String(b.eligibleDate));
    });

    return {
        summary: {
            readyCount,
            readyAmount,
            waitingCount,
            waitingAmount,
            issuedCount,
            totalCount: items.length,
            nextReadyDate: nextReadyMs ? toIsoDateBRT(new Date(nextReadyMs)) : null
        },
        items
    };
}

async function markCnpjNfStatus(paymentId, { issued = true, nfNumber = null } = {}) {
    await ensureDreSchema();
    const cleanId = String(paymentId || '').trim();
    if (!cleanId) return null;

    const payment = await db.Payment.findByPk(cleanId);
    if (!payment) return null;

    const cleanStatus = String(payment.status || '').toUpperCase();
    if (!['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(cleanStatus)) {
        return null;
    }

    const psi = payment.psychologistId
        ? await db.Psychologist.findByPk(payment.psychologistId, { attributes: ['id', 'cpf', 'cnpj'] })
        : null;
    if (!psi) return null;

    const hasCnpj = String(psi.cnpj || '').replace(/\D/g, '').length === 14
        || String(psi.cpf || '').replace(/\D/g, '').length === 14;
    if (!hasCnpj) return null;

    const cleanNfNum = issued && nfNumber ? String(nfNumber).trim().slice(0, 80) : null;
    const issuedAt = issued ? new Date() : null;
    await db.sequelize.query(
        `UPDATE "Payments" SET "nfIssuedAt" = :nfIssuedAt, "nfNumber" = :nfNumber WHERE id = :id`,
        {
            replacements: { nfIssuedAt: issuedAt, nfNumber: cleanNfNum || null, id: payment.id },
            type: db.sequelize.QueryTypes.UPDATE
        }
    );

    return {
        paymentId: payment.id,
        nfIssuedAt: issuedAt ? toIsoDateBRT(issuedAt) : null,
        nfNumber: cleanNfNum || null,
        nfStatus: issued ? 'ISSUED' : 'READY'
    };
}

/**
 * Carrega e consolida todas as transações de receita, estorno, taxas, despesas e configurações
 * para o exercício solicitado (e dezembro anterior para cálculo de AH% em Janeiro).
 */
async function buildDreReport({ year, month = null, regime = 'accrual' }) {
    await ensureDreSchema();

    const nowBRT = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
    const currentYear = Number(nowBRT.slice(0, 4));
    const currentMonth = Number(nowBRT.slice(5, 7));

    const currentDay = Number(nowBRT.slice(8, 10));

    const targetYear = Math.min(Math.max(2020, parseInt(year, 10) || currentYear), currentYear + 1);
    const selectedMonth = month ? Math.min(Math.max(1, parseInt(month, 10) || 1), 12) : (targetYear === currentYear ? currentMonth : 12);
    const cleanRegime = regime === 'cash' ? 'cash' : 'accrual';
    const selectedMkTarget = `${targetYear}-${String(selectedMonth).padStart(2, '0')}`;

    const prevDecMonthKey = `${targetYear - 1}-12`;
    const rangeStartDate = `${targetYear - 1}-12-01`;
    const rangeEndDate = `${targetYear}-12-31`;

    // 1. Configurações globais & snapshots mensais
    let settings = await db.SystemSetting.findOne({ raw: true });
    if (!settings) settings = {};

    const monthKeys = [prevDecMonthKey];
    for (let m = 1; m <= 12; m++) {
        monthKeys.push(`${targetYear}-${String(m).padStart(2, '0')}`);
    }

    const monthlyFinances = await db.YeloMonthlyFinance.findAll({
        where: { monthYear: monthKeys },
        raw: true
    });
    const mfByMonth = {};
    monthlyFinances.forEach(mf => {
        mfByMonth[mf.monthYear] = mf;
    });

    // 2. PaymentFinancialEvents (Ledger Asaas real)
    let pfeRows = [];
    try {
        pfeRows = await db.sequelize.query(
            `SELECT e.*, p."billingType", p."psychologistId", p."dueDate", p."paymentDate",
                    psi."nome" AS "psiNome", psi."email" AS "psiEmail", psi."plano" AS "psiPlano"
             FROM "PaymentFinancialEvents" e
             LEFT JOIN "Payments" p ON p."id" = e."paymentId"
             LEFT JOIN "Psychologists" psi ON psi."id" = p."psychologistId"
             WHERE e."eventDate" >= :rangeStart AND e."eventDate" <= :rangeEnd
             ORDER BY e."eventDate" ASC`,
            { replacements: { rangeStart: rangeStartDate, rangeEnd: rangeEndDate }, type: db.sequelize.QueryTypes.SELECT }
        );
    } catch (_) {
        pfeRows = [];
    }

    // Taxa efetiva histórica de cartão observada em PaymentFinancialEvents (para fallback mais fiel)
    let observedCardRate = null;
    try {
        const [rateRow] = await db.sequelize.query(
            `SELECT COUNT(*) AS cnt, SUM(e."grossAmount") AS gross, SUM(e."feeAmount") AS fees
             FROM "PaymentFinancialEvents" e
             JOIN "Payments" p ON p."id" = e."paymentId"
             WHERE e."eventType" = 'PAYMENT_CREDITED'
               AND p."billingType" = 'CREDIT_CARD'
               AND e."grossAmount" > 0 AND e."feeAmount" >= 0`,
            { type: db.sequelize.QueryTypes.SELECT }
        );
        if (rateRow && Number(rateRow.gross) > 0 && Number(rateRow.fees) >= 0) {
            const cnt = Number(rateRow.cnt || 0);
            const variableFees = Math.max(0, Number(rateRow.fees) - cnt * 0.49);
            observedCardRate = variableFees / Number(rateRow.gross);
        }
    } catch (_) {}

    // 3. Todos os pagamentos do período (para cobrir histórico sem PaymentFinancialEvents e compor Razão)
    const payRows = await db.sequelize.query(
        `SELECT p."id", p."subscriptionId", p."psychologistId", p."status", p."value", p."billingType",
                p."dueDate", p."paymentDate", p."createdAt",
                psi."nome" AS "psiNome", psi."email" AS "psiEmail", psi."plano" AS "psiPlano"
         FROM "Payments" p
         LEFT JOIN "Psychologists" psi ON psi."id" = p."psychologistId"
         WHERE COALESCE(p."paymentDate", p."dueDate"::timestamp, p."createdAt") >= :tsStart
           AND COALESCE(p."createdAt", p."dueDate"::timestamp, p."paymentDate") <= :tsEnd`,
        {
            replacements: {
                tsStart: `${targetYear - 1}-11-25T00:00:00Z`,
                tsEnd: `${targetYear + 1}-01-05T23:59:59Z`
            },
            type: db.sequelize.QueryTypes.SELECT
        }
    );

    // Agrupa PaymentFinancialEvents por paymentId
    const pfeByPaymentId = new Map();
    pfeRows.forEach(ev => {
        if (!pfeByPaymentId.has(ev.paymentId)) pfeByPaymentId.set(ev.paymentId, []);
        pfeByPaymentId.get(ev.paymentId).push(ev);
    });

    // Estrutura mensal vazia
    const createEmptyMonthBucket = (mk) => ({
        monthKey: mk,
        revenue: {
            essential: 0,
            clinical: 0,
            reference: 0,
            other: 0,
            grossTotal: 0,
            paidCount: 0
        },
        openReceivables: {
            pendingAmount: 0,
            overdueAmount: 0,
            openCount: 0
        },
        deductions: {
            refunds: 0,
            refundCount: 0,
            calculatedTaxes: 0,
            extraDeductionTaxes: 0,
            totalDeductions: 0
        },
        gateway: {
            observedFees: 0,
            estimatedFees: 0,
            notificationFees: 0,
            cashAdjustments: 0,
            totalFees: 0
        },
        expensesByGroup: {
            DEDUCTION_TAX: 0,
            COGS: 0,
            OPEX_MARKETING: 0,
            OPEX_PERSONNEL: 0,
            OPEX_ADMIN: 0,
            FINANCIAL_INCOME: 0,
            FINANCIAL_EXPENSE: 0,
            PROFIT_TAX: 0
        },
        expensesCount: 0,
        unclassifiedExpensesCount: 0,
        taxConfig: {
            variableRate: null,
            fixedMonthly: 0,
            profitTaxRate: 0,
            taxSource: 'NONE',
            isClosed: false,
            closedAt: null,
            notes: null
        },
        flags: {
            hasEstimatedFees: false,
            hasMissingTaxConfig: false,
            unclassifiedCount: 0
        }
    });

    const buckets = {};
    monthKeys.forEach(mk => {
        buckets[mk] = createEmptyMonthBucket(mk);
    });

    const parseEventMeta = (ev) => {
        if (!ev || ev.sourceMetadata == null) return null;
        if (typeof ev.sourceMetadata === 'string') {
            try { return JSON.parse(ev.sourceMetadata); } catch (_) { return null; }
        }
        return typeof ev.sourceMetadata === 'object' ? ev.sourceMetadata : null;
    };

    const extractObservedFeeFromEvents = ({ credEvent, primaryRevEvent, confEvent }, gross) => {
        for (const ev of [credEvent, primaryRevEvent, confEvent]) {
            if (ev && ev.feeAmount !== null && ev.feeAmount !== undefined && ev.feeAmount !== '') {
                const parsed = Number(ev.feeAmount);
                if (Number.isFinite(parsed) && parsed >= 0) return round2(parsed);
            }
        }
        for (const ev of [credEvent, primaryRevEvent, confEvent]) {
            const meta = parseEventMeta(ev);
            if (!meta || meta.netValue === undefined || meta.netValue === null || meta.netValue === '') continue;
            const netVal = Number(meta.netValue);
            const baseVal = Number(meta.value !== undefined && meta.value !== null && meta.value !== '' ? meta.value : gross);
            if (Number.isFinite(netVal) && Number.isFinite(baseVal) && baseVal >= netVal && (baseVal - netVal) >= 0) {
                return round2(baseVal - netVal);
            }
        }
        return null;
    };

    const revenueLedger = [];

    // 3A. Processa pagamentos cobertos por PaymentFinancialEvents
    const handledPaymentIds = new Set();
    for (const [paymentId, events] of pfeByPaymentId.entries()) {
        handledPaymentIds.add(paymentId);

        const confEvent = events.find(e => e.eventType === 'PAYMENT_CONFIRMED');
        const credEvent = events.find(e => e.eventType === 'PAYMENT_CREDITED');
        const negEvents = events.filter(e => e.eventType === 'REFUND' || e.eventType === 'CHARGEBACK');
        const adjEvents = events.filter(e => e.eventType === 'GATEWAY_CASH_MOVEMENT');

        const primaryRevEvent = cleanRegime === 'cash' ? (credEvent || confEvent) : (confEvent || credEvent);
        if (primaryRevEvent && (cleanRegime !== 'cash' || credEvent || confEvent)) {
            const mk = toMonthKeyBRT(primaryRevEvent.eventDate);
            if (mk && buckets[mk]) {
                const gross = round2(primaryRevEvent.grossAmount);
                const planBucket = classifyPlanBucket(primaryRevEvent.psiPlano);
                buckets[mk].revenue[planBucket] = round2(buckets[mk].revenue[planBucket] + gross);
                buckets[mk].revenue.grossTotal = round2(buckets[mk].revenue.grossTotal + gross);
                buckets[mk].revenue.paidCount += 1;

                const feeObs = extractObservedFeeFromEvents({ credEvent, primaryRevEvent, confEvent }, gross);

                let feeUsed = 0;
                let feeIsEstimated = false;
                if (feeObs !== null) {
                    feeUsed = feeObs;
                    buckets[mk].gateway.observedFees = round2(buckets[mk].gateway.observedFees + feeObs);
                } else {
                    feeUsed = estimateGatewayFee(gross, primaryRevEvent.billingType, observedCardRate);
                    feeIsEstimated = true;
                    buckets[mk].gateway.estimatedFees = round2(buckets[mk].gateway.estimatedFees + feeUsed);
                    buckets[mk].flags.hasEstimatedFees = true;
                }

                revenueLedger.push({
                    id: paymentId,
                    monthKey: mk,
                    type: 'RECEITA',
                    sourceType: feeIsEstimated ? 'LEDGER_PARTIAL' : 'LEDGER_REAL',
                    eventDate: primaryRevEvent.eventDate,
                    dueDate: primaryRevEvent.dueDate || null,
                    paymentDate: toIsoDateBRT(primaryRevEvent.paymentDate) || primaryRevEvent.eventDate,
                    psiId: primaryRevEvent.psychologistId || null,
                    psiNome: primaryRevEvent.psiNome || 'Psicólogo',
                    psiEmail: primaryRevEvent.psiEmail || null,
                    plano: primaryRevEvent.psiPlano || 'Outro',
                    billingType: primaryRevEvent.billingType || 'N/A',
                    status: 'PAID',
                    grossAmount: gross,
                    feeAmount: feeUsed,
                    feeEstimated: feeIsEstimated,
                    netAmount: round2(gross - feeUsed)
                });
            }
        }

        for (const neg of negEvents) {
            const mk = toMonthKeyBRT(neg.eventDate);
            if (mk && buckets[mk]) {
                const amt = round2(Math.abs(Number(neg.grossAmount || 0)));
                buckets[mk].deductions.refunds = round2(buckets[mk].deductions.refunds + amt);
                buckets[mk].deductions.refundCount += 1;

                revenueLedger.push({
                    id: `${paymentId}-${neg.id}`,
                    monthKey: mk,
                    type: 'ESTORNO',
                    sourceType: 'LEDGER_REAL',
                    eventDate: neg.eventDate,
                    dueDate: neg.dueDate || null,
                    paymentDate: neg.eventDate,
                    psiId: neg.psychologistId || null,
                    psiNome: neg.psiNome || 'Psicólogo',
                    psiEmail: neg.psiEmail || null,
                    plano: neg.psiPlano || 'Outro',
                    billingType: neg.billingType || 'N/A',
                    status: neg.eventType,
                    grossAmount: -amt,
                    feeAmount: 0,
                    feeEstimated: false,
                    netAmount: -amt
                });
            }
        }

        for (const adj of adjEvents) {
            const mk = toMonthKeyBRT(adj.eventDate);
            if (!mk || !buckets[mk]) continue;
            const meta = parseEventMeta(adj);
            if (meta?.transactionType === 'PAYMENT_MESSAGING_NOTIFICATION_FEE') {
                const notifFee = round2(Math.abs(Number(adj.feeAmount ?? adj.cashDeltaAmount ?? adj.grossAmount ?? 0)));
                if (notifFee > 0) {
                    buckets[mk].gateway.observedFees = round2(buckets[mk].gateway.observedFees + notifFee);
                    buckets[mk].gateway.notificationFees = round2(buckets[mk].gateway.notificationFees + notifFee);
                    revenueLedger.push({
                        id: `${paymentId}-${adj.externalEventId || adj.id}`,
                        monthKey: mk,
                        type: 'TAXA_MENSAGERIA',
                        sourceType: 'LEDGER_REAL',
                        eventDate: adj.eventDate,
                        dueDate: adj.dueDate || null,
                        paymentDate: adj.eventDate,
                        psiId: adj.psychologistId || null,
                        psiNome: adj.psiNome || 'Asaas Mensageria',
                        psiEmail: adj.psiEmail || null,
                        plano: adj.psiPlano || 'Taxa Asaas',
                        billingType: 'NOTIFICATION_FEE',
                        status: 'FEE',
                        grossAmount: 0,
                        feeAmount: notifFee,
                        feeEstimated: false,
                        netAmount: -notifFee
                    });
                }
            } else {
                const delta = round2(adj.cashDeltaAmount || 0);
                buckets[mk].gateway.cashAdjustments = round2(buckets[mk].gateway.cashAdjustments + delta);
            }
        }
    }

    // 3B. Processa pagamentos históricos em "Payments" sem PaymentFinancialEvent
    for (const p of payRows) {
        if (handledPaymentIds.has(p.id)) continue;

        const status = String(p.status || '').toUpperCase();
        const refDateRaw = p.paymentDate || p.dueDate || p.createdAt;
        const mk = toMonthKeyBRT(refDateRaw);
        if (!mk || !buckets[mk]) continue;

        const gross = round2(p.value);
        if (['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(status)) {
            const planBucket = classifyPlanBucket(p.psiPlano);
            buckets[mk].revenue[planBucket] = round2(buckets[mk].revenue[planBucket] + gross);
            buckets[mk].revenue.grossTotal = round2(buckets[mk].revenue.grossTotal + gross);
            buckets[mk].revenue.paidCount += 1;

            const estFee = estimateGatewayFee(gross, p.billingType, observedCardRate);
            buckets[mk].gateway.estimatedFees = round2(buckets[mk].gateway.estimatedFees + estFee);
            buckets[mk].flags.hasEstimatedFees = true;

            revenueLedger.push({
                id: p.id,
                monthKey: mk,
                type: 'RECEITA',
                sourceType: 'PAYMENT_FALLBACK',
                eventDate: toIsoDateBRT(refDateRaw),
                dueDate: p.dueDate || null,
                paymentDate: toIsoDateBRT(p.paymentDate || p.dueDate || p.createdAt),
                psiId: p.psychologistId || null,
                psiNome: p.psiNome || 'Psicólogo',
                psiEmail: p.psiEmail || null,
                plano: p.psiPlano || 'Outro',
                billingType: p.billingType || 'N/A',
                status,
                grossAmount: gross,
                feeAmount: estFee,
                feeEstimated: true,
                netAmount: round2(gross - estFee)
            });
        } else if (['REFUNDED', 'REFUND_REQUESTED', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE'].includes(status)) {
            // Reconhece o bruto original em 1.1 para manter simetria com Deduções 2.1 (evita desconto duplo)
            const planBucket = classifyPlanBucket(p.psiPlano);
            buckets[mk].revenue[planBucket] = round2(buckets[mk].revenue[planBucket] + gross);
            buckets[mk].revenue.grossTotal = round2(buckets[mk].revenue.grossTotal + gross);
            buckets[mk].revenue.paidCount += 1;

            const estFee = estimateGatewayFee(gross, p.billingType, observedCardRate);
            buckets[mk].gateway.estimatedFees = round2(buckets[mk].gateway.estimatedFees + estFee);
            buckets[mk].flags.hasEstimatedFees = true;

            revenueLedger.push({
                id: p.id,
                monthKey: mk,
                type: 'RECEITA',
                sourceType: 'PAYMENT_FALLBACK',
                eventDate: toIsoDateBRT(refDateRaw),
                dueDate: p.dueDate || null,
                paymentDate: toIsoDateBRT(p.paymentDate || p.dueDate || p.createdAt),
                psiId: p.psychologistId || null,
                psiNome: p.psiNome || 'Psicólogo',
                psiEmail: p.psiEmail || null,
                plano: p.psiPlano || 'Outro',
                billingType: p.billingType || 'N/A',
                status,
                grossAmount: gross,
                feeAmount: estFee,
                feeEstimated: true,
                netAmount: round2(gross - estFee)
            });

            buckets[mk].deductions.refunds = round2(buckets[mk].deductions.refunds + gross);
            buckets[mk].deductions.refundCount += 1;

            revenueLedger.push({
                id: `${p.id}-estorno`,
                monthKey: mk,
                type: 'ESTORNO',
                sourceType: 'PAYMENT_FALLBACK',
                eventDate: toIsoDateBRT(refDateRaw),
                dueDate: p.dueDate || null,
                paymentDate: toIsoDateBRT(p.paymentDate || p.dueDate || p.createdAt),
                psiId: p.psychologistId || null,
                psiNome: p.psiNome || 'Psicólogo',
                psiEmail: p.psiEmail || null,
                plano: p.psiPlano || 'Outro',
                billingType: p.billingType || 'N/A',
                status,
                grossAmount: -gross,
                feeAmount: 0,
                feeEstimated: false,
                netAmount: -gross
            });
        } else if (status === 'PENDING') {
            buckets[mk].openReceivables.pendingAmount = round2(buckets[mk].openReceivables.pendingAmount + gross);
            buckets[mk].openReceivables.openCount += 1;
        } else if (status === 'OVERDUE') {
            buckets[mk].openReceivables.overdueAmount = round2(buckets[mk].openReceivables.overdueAmount + gross);
            buckets[mk].openReceivables.openCount += 1;
        }
    }

    // 4. Despesas & Lançamentos em YeloExpenses + ManualAdMetrics (sem duplicar Ads)
    const yeloExpenses = await db.YeloExpense.findAll({
        where: { monthYear: monthKeys },
        order: [['monthYear', 'DESC'], ['createdAt', 'DESC']],
        raw: true
    });

    const coveredAdProvidersByMonth = {}; // { '2026-10': Set(['GOOGLE', 'META']) }
    const expenseLedger = [];
    const selExpSplit = { fixed: {}, variable: {} };
    const trackSelectedSplit = (mk, group, nature, amt) => {
        if (mk !== selectedMkTarget) return;
        const isFixed = String(nature || '').toUpperCase() === 'FIXED';
        const bucket = isFixed ? selExpSplit.fixed : selExpSplit.variable;
        bucket[group] = round2((bucket[group] || 0) + amt);
    };

    for (const exp of yeloExpenses) {
        const mk = exp.monthYear;
        if (!buckets[mk]) continue;

        const group = inferDreGroup(exp);
        const amt = round2(exp.amount);
        buckets[mk].expensesByGroup[group] = round2((buckets[mk].expensesByGroup[group] || 0) + amt);
        buckets[mk].expensesCount += 1;
        trackSelectedSplit(mk, group, exp.nature, amt);

        if (!exp.dreGroup && (exp.nature === 'UNCLASSIFIED' || exp.purpose === 'UNCLASSIFIED')) {
            buckets[mk].unclassifiedExpensesCount += 1;
            buckets[mk].flags.unclassifiedCount += 1;
        }

        const prov = String(exp.provider || '').toUpperCase();
        const catLow = String(exp.category || '').toLowerCase();
        if (!coveredAdProvidersByMonth[mk]) coveredAdProvidersByMonth[mk] = new Set();
        if (prov === 'GOOGLE' || catLow.includes('google')) coveredAdProvidersByMonth[mk].add('GOOGLE');
        if (prov === 'META' || catLow.includes('meta') || catLow.includes('facebook')) coveredAdProvidersByMonth[mk].add('META');

        expenseLedger.push({
            id: exp.id,
            monthYear: mk,
            expenseDate: exp.expenseDate || `${mk}-01`,
            name: exp.name,
            amount: amt,
            category: exp.category || 'Outros',
            dreGroup: group,
            dreGroupLabel: DRE_GROUP_META[group]?.shortLabel || group,
            nature: exp.nature,
            purpose: exp.purpose,
            provider: exp.provider,
            entryMethod: exp.entryMethod || 'MANUAL',
            documentNumber: exp.documentNumber || null,
            notes: exp.notes || null,
            isVirtual: false,
            isClosedMonth: Boolean(mfByMonth[mk]?.isClosed)
        });
    }

    // Fallback automático de ManualAdMetric se não existir despesa de Google/Meta no mês
    try {
        const manualAds = await db.ManualAdMetric.findAll({ raw: true });
        for (const ad of manualAds) {
            const mk = toMonthKeyBRT(ad.dateStart || ad.dateEnd);
            if (!mk || !buckets[mk]) continue;
            const prov = String(ad.platform || '').toUpperCase().includes('META') ? 'META' : 'GOOGLE';
            if (coveredAdProvidersByMonth[mk] && coveredAdProvidersByMonth[mk].has(prov)) continue;

            const amt = round2(ad.spend);
            if (amt <= 0) continue;

            buckets[mk].expensesByGroup.OPEX_MARKETING = round2(buckets[mk].expensesByGroup.OPEX_MARKETING + amt);
            buckets[mk].expensesCount += 1;
            trackSelectedSplit(mk, 'OPEX_MARKETING', 'VARIABLE', amt);

            expenseLedger.push({
                id: `admetric-${ad.id}`,
                monthYear: mk,
                expenseDate: ad.dateStart || `${mk}-01`,
                name: `${prov === 'META' ? 'Meta Ads' : 'Google Ads'} (${ad.campaignName || 'Campanha Manual'})`,
                amount: amt,
                category: prov === 'META' ? 'Meta Ads' : 'Google Ads',
                dreGroup: 'OPEX_MARKETING',
                dreGroupLabel: DRE_GROUP_META.OPEX_MARKETING.shortLabel,
                nature: 'VARIABLE',
                purpose: 'GROWTH',
                provider: prov,
                entryMethod: 'IMPORT',
                documentNumber: null,
                notes: 'Consolidado automaticamente de ManualAdMetrics',
                isVirtual: true,
                isClosedMonth: Boolean(mfByMonth[mk]?.isClosed)
            });
        }
    } catch (_) {}

    // 5. Fecha cálculos contábeis por mês (incluindo impostos & fechamento)
    const fallbackVarTax = settings.tax_variable_rate !== null && settings.tax_variable_rate !== undefined
        ? Number(settings.tax_variable_rate)
        : (settings.cmo_sim_tax_rate !== null && settings.cmo_sim_tax_rate !== undefined ? Number(settings.cmo_sim_tax_rate) : null);
    const fallbackFixedTax = settings.tax_fixed_monthly !== null && settings.tax_fixed_monthly !== undefined
        ? Number(settings.tax_fixed_monthly)
        : 0;

    const computedByMonth = {};
    for (const mk of monthKeys) {
        const b = buckets[mk];
        const mf = mfByMonth[mk] || null;

        const varRate = mf && mf.appliedTaxVariableRate !== null && mf.appliedTaxVariableRate !== undefined
            ? Number(mf.appliedTaxVariableRate)
            : fallbackVarTax;
        const fixMonthly = mf && mf.appliedTaxFixedMonthly !== null && mf.appliedTaxFixedMonthly !== undefined
            ? Number(mf.appliedTaxFixedMonthly)
            : fallbackFixedTax;
        const profitTaxRate = mf && mf.appliedProfitTaxRate !== null && mf.appliedProfitTaxRate !== undefined
            ? Number(mf.appliedProfitTaxRate)
            : 0;

        b.taxConfig = {
            variableRate: varRate,
            fixedMonthly: fixMonthly,
            profitTaxRate,
            taxSource: mf && (mf.appliedTaxVariableRate !== null || mf.appliedTaxFixedMonthly !== null)
                ? 'MONTHLY_SNAPSHOT'
                : (varRate !== null || fixMonthly > 0 ? 'GLOBAL_SETTING' : 'NONE'),
            isClosed: Boolean(mf?.isClosed),
            closedAt: mf?.closedAt || null,
            notes: mf?.notes || null
        };

        const grossRevenue = b.revenue.grossTotal;
        const refunds = b.deductions.refunds;
        const taxableBase = Math.max(0, round2(grossRevenue - refunds));
        const hasActivity = grossRevenue > 0 || b.expensesCount > 0;

        const varTaxAmt = varRate !== null ? round2(taxableBase * varRate) : 0;
        const fixTaxAmt = (mf || hasActivity || fixMonthly > 0) && grossRevenue > 0 ? round2(fixMonthly) : (mf && mf.appliedTaxFixedMonthly !== null ? round2(fixMonthly) : 0);
        const calculatedTaxes = round2(varTaxAmt + fixTaxAmt);
        const extraDeductionTaxes = round2(b.expensesByGroup.DEDUCTION_TAX || 0);
        const totalTaxesOnRevenue = round2(calculatedTaxes + extraDeductionTaxes);

        const hasExplicitMonthTax = Boolean(mf && (mf.appliedTaxVariableRate !== null || mf.appliedTaxFixedMonthly !== null));
        if (!hasExplicitMonthTax && (!varRate || varRate === 0) && (!fixMonthly || fixMonthly === 0) && grossRevenue > 0) {
            b.flags.hasMissingTaxConfig = true;
        }

        b.deductions.calculatedTaxes = calculatedTaxes;
        b.deductions.extraDeductionTaxes = extraDeductionTaxes;
        b.deductions.totalDeductions = round2(refunds + totalTaxesOnRevenue);

        const netRevenue = round2(grossRevenue - b.deductions.totalDeductions);

        const gatewayFees = round2(b.gateway.observedFees + b.gateway.estimatedFees);
        b.gateway.totalFees = gatewayFees;
        const directCogs = round2(b.expensesByGroup.COGS || 0);
        const totalCogs = round2(gatewayFees + directCogs);

        const grossProfit = round2(netRevenue - totalCogs);
        const grossMarginPct = netRevenue > 0 ? round2((grossProfit / netRevenue) * 100) : 0;

        const opexMarketing = round2(b.expensesByGroup.OPEX_MARKETING || 0);
        const opexPersonnel = round2(b.expensesByGroup.OPEX_PERSONNEL || 0);
        const opexAdmin = round2(b.expensesByGroup.OPEX_ADMIN || 0);
        const totalOpex = round2(opexMarketing + opexPersonnel + opexAdmin);

        const ebitda = round2(grossProfit - totalOpex);
        const ebitdaMarginPct = netRevenue > 0 ? round2((ebitda / netRevenue) * 100) : 0;

        const financialIncome = round2(b.expensesByGroup.FINANCIAL_INCOME || 0);
        const financialExpense = round2(b.expensesByGroup.FINANCIAL_EXPENSE || 0);
        const gatewayAdjustments = round2(b.gateway.cashAdjustments || 0);
        const netFinancialResult = round2(financialIncome - financialExpense + gatewayAdjustments);

        const lair = round2(ebitda + netFinancialResult);
        const extraProfitTax = round2(b.expensesByGroup.PROFIT_TAX || 0);
        const rateProfitTax = lair > 0 && profitTaxRate > 0 ? round2(lair * profitTaxRate) : 0;
        const totalProfitTax = round2(extraProfitTax + rateProfitTax);

        const netIncome = round2(lair - totalProfitTax);
        const netMarginPct = netRevenue > 0 ? round2((netIncome / netRevenue) * 100) : 0;

        computedByMonth[mk] = {
            ...b,
            summary: {
                grossRevenue,
                taxableBase,
                refunds,
                taxesOnRevenue: totalTaxesOnRevenue,
                calculatedTaxes,
                extraDeductionTaxes,
                totalDeductions: b.deductions.totalDeductions,
                netRevenue,
                gatewayFees,
                gatewayFeesObserved: round2(b.gateway.observedFees),
                gatewayFeesEstimated: round2(b.gateway.estimatedFees),
                gatewayNotificationFees: round2(b.gateway.notificationFees),
                directCogs,
                totalCogs,
                grossProfit,
                grossMarginPct,
                opexMarketing,
                opexPersonnel,
                opexAdmin,
                totalOpex,
                ebitda,
                ebitdaMarginPct,
                financialIncome,
                financialExpense,
                netFinancialResult,
                lair,
                profitTaxes: totalProfitTax,
                netIncome,
                netMarginPct
            }
        };
    }

    // 6. Matriz Anual (12 meses do targetYear)
    const yearMonthKeys = Array.from({ length: 12 }, (_, i) => `${targetYear}-${String(i + 1).padStart(2, '0')}`);
    const monthlySeries = yearMonthKeys.map((mk, idx) => ({
        monthIndex: idx + 1,
        monthLabel: MONTH_LABELS[idx],
        monthFullLabel: MONTH_FULL_LABELS[idx],
        ...computedByMonth[mk]
    }));

    const sumField = (getter) => round2(monthlySeries.reduce((acc, m) => acc + Number(getter(m) || 0), 0));
    const annualNetRev = sumField(m => m.summary.netRevenue);
    const annualGrossProfit = sumField(m => m.summary.grossProfit);
    const annualEbitda = sumField(m => m.summary.ebitda);
    const annualNetIncome = sumField(m => m.summary.netIncome);

    const annualSummary = {
        grossRevenue: sumField(m => m.summary.grossRevenue),
        essentialRevenue: sumField(m => m.revenue.essential),
        clinicalRevenue: sumField(m => m.revenue.clinical),
        referenceRevenue: sumField(m => m.revenue.reference),
        otherRevenue: sumField(m => m.revenue.other),
        taxableBase: sumField(m => m.summary.taxableBase),
        refunds: sumField(m => m.summary.refunds),
        taxesOnRevenue: sumField(m => m.summary.taxesOnRevenue),
        totalDeductions: sumField(m => m.summary.totalDeductions),
        netRevenue: annualNetRev,
        gatewayFees: sumField(m => m.summary.gatewayFees),
        gatewayFeesObserved: sumField(m => m.summary.gatewayFeesObserved),
        gatewayFeesEstimated: sumField(m => m.summary.gatewayFeesEstimated),
        gatewayNotificationFees: sumField(m => m.summary.gatewayNotificationFees),
        directCogs: sumField(m => m.summary.directCogs),
        totalCogs: sumField(m => m.summary.totalCogs),
        grossProfit: annualGrossProfit,
        grossMarginPct: annualNetRev > 0 ? round2((annualGrossProfit / annualNetRev) * 100) : 0,
        opexMarketing: sumField(m => m.summary.opexMarketing),
        opexPersonnel: sumField(m => m.summary.opexPersonnel),
        opexAdmin: sumField(m => m.summary.opexAdmin),
        totalOpex: sumField(m => m.summary.totalOpex),
        ebitda: annualEbitda,
        ebitdaMarginPct: annualNetRev > 0 ? round2((annualEbitda / annualNetRev) * 100) : 0,
        financialIncome: sumField(m => m.summary.financialIncome),
        financialExpense: sumField(m => m.summary.financialExpense),
        netFinancialResult: sumField(m => m.summary.netFinancialResult),
        lair: sumField(m => m.summary.lair),
        profitTaxes: sumField(m => m.summary.profitTaxes),
        netIncome: annualNetIncome,
        netMarginPct: annualNetRev > 0 ? round2((annualNetIncome / annualNetRev) * 100) : 0,
        paidCount: monthlySeries.reduce((acc, m) => acc + m.revenue.paidCount, 0),
        refundCount: monthlySeries.reduce((acc, m) => acc + m.deductions.refundCount, 0)
    };

    // 7. Montagem das linhas estruturadas da DRE (Mensal + Anual)
    const selectedMk = `${targetYear}-${String(selectedMonth).padStart(2, '0')}`;
    const prevMk = selectedMonth === 1
        ? prevDecMonthKey
        : `${targetYear}-${String(selectedMonth - 1).padStart(2, '0')}`;
    const selData = computedByMonth[selectedMk];
    const prevData = computedByMonth[prevMk];

    const avBaseSelected = selData.summary.netRevenue > 0 ? selData.summary.netRevenue : selData.summary.grossRevenue;
    const avBaseAnnual = annualSummary.netRevenue > 0 ? annualSummary.netRevenue : annualSummary.grossRevenue;

    const ROW_DEFS = [
        { code: '1', label: '1. RECEITA OPERACIONAL BRUTA', level: 0, rowType: 'subtotal', sign: '+', get: m => m.summary.grossRevenue },
        { code: '1.1', label: 'Assinaturas — Plano Essencial', level: 1, rowType: 'item', sign: '+', get: m => m.revenue.essential },
        { code: '1.2', label: 'Assinaturas — Plano Clínico', level: 1, rowType: 'item', sign: '+', get: m => m.revenue.clinical },
        { code: '1.3', label: 'Assinaturas — Plano Sol / Referência', level: 1, rowType: 'item', sign: '+', get: m => m.revenue.reference },
        { code: '1.4', label: 'Outras Receitas / Planos Avulsos', level: 1, rowType: 'item', sign: '+', get: m => m.revenue.other },

        { code: '2', label: '2. (-) DEDUÇÕES DA RECEITA BRUTA', level: 0, rowType: 'subtotal', sign: '-', get: m => m.summary.totalDeductions },
        { code: '2.1', label: '(-) Estornos, Cancelamentos e Chargebacks', level: 1, rowType: 'item', sign: '-', get: m => m.summary.refunds },
        { code: '2.2', label: '(-) Impostos sobre Faturamento (DAS / Simples / ISS)', level: 1, rowType: 'item', sign: '-', get: m => m.summary.taxesOnRevenue },

        { code: '3', label: '3. (=) RECEITA OPERACIONAL LÍQUIDA', level: 0, rowType: 'total', sign: '=', get: m => m.summary.netRevenue },

        { code: '4', label: '4. (-) CUSTOS DOS SERVIÇOS PRESTADOS (CSP / CMV)', level: 0, rowType: 'subtotal', sign: '-', get: m => m.summary.totalCogs },
        { code: '4.1', label: '(-) Taxas de Gateway e Meios de Pagamento (Asaas)', level: 1, rowType: 'item', sign: '-', get: m => m.summary.gatewayFees },
        { code: '4.2', label: '(-) Custos Diretos Operacionais (APIs / IA / Infra Variável)', level: 1, rowType: 'item', sign: '-', dreGroup: 'COGS', get: m => m.summary.directCogs },

        { code: '5', label: '5. (=) LUCRO BRUTO', level: 0, rowType: 'total', sign: '=', get: m => m.summary.grossProfit },

        { code: '6', label: '6. (-) DESPESAS OPERACIONAIS (OPEX)', level: 0, rowType: 'subtotal', sign: '-', get: m => m.summary.totalOpex },
        { code: '6.1', label: '(-) Despesas Comerciais & Marketing (Tráfego Pago)', level: 1, rowType: 'item', sign: '-', dreGroup: 'OPEX_MARKETING', get: m => m.summary.opexMarketing },
        { code: '6.2', label: '(-) Despesas com Pessoal, Pró-Labore e Terceiros', level: 1, rowType: 'item', sign: '-', dreGroup: 'OPEX_PERSONNEL', get: m => m.summary.opexPersonnel },
        { code: '6.3', label: '(-) Despesas Administrativas, Cloud & Contabilidade', level: 1, rowType: 'item', sign: '-', dreGroup: 'OPEX_ADMIN', get: m => m.summary.opexAdmin },

        { code: '7', label: '7. (=) RESULTADO OPERACIONAL (EBITDA)', level: 0, rowType: 'total', sign: '=', get: m => m.summary.ebitda },

        { code: '8', label: '8. (+/-) RESULTADO FINANCEIRO', level: 0, rowType: 'subtotal', sign: '+/-', get: m => m.summary.netFinancialResult },
        { code: '8.1', label: '(+) Receitas Financeiras / Rendimentos / Ajustes', level: 1, rowType: 'item', sign: '+', dreGroup: 'FINANCIAL_INCOME', get: m => round2(m.summary.financialIncome + (m.gateway?.cashAdjustments || 0)) },
        { code: '8.2', label: '(-) Despesas Financeiras / Juros / Tarifas Bancárias', level: 1, rowType: 'item', sign: '-', dreGroup: 'FINANCIAL_EXPENSE', get: m => m.summary.financialExpense },

        { code: '9', label: '9. (=) LAIR (Lucro Antes do IRPJ / CSLL)', level: 0, rowType: 'subtotal', sign: '=', get: m => m.summary.lair },
        { code: '10', label: '10. (-) Tributos sobre o Lucro (IRPJ / CSLL)', level: 1, rowType: 'item', sign: '-', dreGroup: 'PROFIT_TAX', get: m => m.summary.profitTaxes },
        { code: '11', label: '11. (=) LUCRO / PREJUÍZO LÍQUIDO DO EXERCÍCIO', level: 0, rowType: 'grand_total', sign: '=', get: m => m.summary.netIncome }
    ];

    const dreRows = ROW_DEFS.map(def => {
        const months = monthlySeries.map(m => round2(def.get(m)));
        const annualTotal = round2(months.reduce((a, v) => a + v, 0));
        const selectedVal = round2(def.get(selData));
        const prevVal = round2(def.get(prevData));
        const selectedAvPct = avBaseSelected > 0 ? round2((selectedVal / avBaseSelected) * 100) : 0;
        const annualAvPct = avBaseAnnual > 0 ? round2((annualTotal / avBaseAnnual) * 100) : 0;
        let ahPct = null;
        if (Math.abs(prevVal) > 0.009) {
            ahPct = round2(((selectedVal - prevVal) / Math.abs(prevVal)) * 100);
        }

        return {
            code: def.code,
            label: def.label,
            level: def.level,
            rowType: def.rowType,
            sign: def.sign,
            dreGroup: def.dreGroup || null,
            selectedValue: selectedVal,
            selectedAvPct,
            prevMonthValue: prevVal,
            ahPct,
            months,
            annualTotal,
            annualAvPct
        };
    });

    // 8. Alertas de auditoria e integridade contábil
    const alerts = [];
    const cnpjNf = await getCnpjNfQueue();
    if (cnpjNf.summary.readyCount > 0) {
        const amtFmt = cnpjNf.summary.readyAmount.toFixed(2).replace('.', ',');
        alerts.push({
            type: 'warning',
            code: 'PENDING_CNPJ_NF',
            title: `NFS-e MEI pendente: ${cnpjNf.summary.readyCount} pagamento(s) CNPJ liberado(s)`,
            message: `Total de R$ ${amtFmt} já completou 7 dias após pagamento e aguarda emissão manual no Emissor Nacional (nfse.gov.br).`
        });
    }
    if (selData.flags.hasMissingTaxConfig || (annualSummary.grossRevenue > 0 && annualSummary.taxesOnRevenue === 0)) {
        alerts.push({
            type: 'warning',
            code: 'MISSING_TAX_CONFIG',
            title: 'Alíquota fiscal ainda não configurada',
            message: 'Configure a alíquota de imposto (Simples Nacional / DAS MEI) em "Config. Fiscal & CNPJ" para que a Receita Líquida e a Apuração Fiscal reflitam os tributos reais.'
        });
    }
    if (selData.flags.hasEstimatedFees) {
        alerts.push({
            type: 'info',
            code: 'ESTIMATED_GATEWAY_FEES',
            title: 'Taxas de gateway estimadas no histórico legado',
            message: `No mês selecionado, ${selData.summary.gatewayFeesEstimated > 0 ? 'parte das tarifas Asaas' : 'tarifas'} veio da tabela Payments sem evento financeiro no ledger e foi estimada por método de pagamento.`
        });
    }
    if (selData.flags.unclassifiedCount > 0) {
        alerts.push({
            type: 'warning',
            code: 'UNCLASSIFIED_EXPENSES',
            title: `${selData.flags.unclassifiedCount} despesa(s) sem classificação DRE explícita`,
            message: 'Esses lançamentos foram inferidos automaticamente pelo provedor/categoria. Revise na aba "Despesas & Lançamentos" se desejar ajustar.'
        });
    }

    const monthSyncWarnings = new Map();
    for (const w of (adSyncWarnings.get(selectedMk) || [])) {
        monthSyncWarnings.set(w.provider, `${w.label}: ${w.message}`);
    }
    for (const [provKey, errObj] of providerAuthErrors.entries()) {
        if (Date.now() - errObj.at < AUTH_ERROR_TTL_MS && !monthSyncWarnings.has(provKey)) {
            monthSyncWarnings.set(provKey, `${provKey}: ${errObj.message}`);
        }
    }
    if (monthSyncWarnings.size > 0) {
        alerts.push({
            type: 'warning',
            code: 'SYNC_WARNING',
            title: 'Aviso na sincronização automática de Ads',
            message: Array.from(monthSyncWarnings.values()).join(' | ')
        });
    }

    const availableYears = await getAvailableYears();
    const yearRevenueLedger = revenueLedger
        .filter(r => r.monthKey.startsWith(`${targetYear}-`))
        .sort((a, b) => String(b.eventDate || '').localeCompare(String(a.eventDate || '')));
    const yearExpenseLedger = expenseLedger
        .filter(e => e.monthYear.startsWith(`${targetYear}-`))
        .sort((a, b) => String(b.expenseDate || '').localeCompare(String(a.expenseDate || '')));

    const taxAudit = monthlySeries.map(m => ({
        monthKey: m.monthKey,
        monthLabel: m.monthFullLabel,
        grossRevenue: m.summary.grossRevenue,
        refunds: m.summary.refunds,
        taxableBase: m.summary.taxableBase,
        variableRatePct: m.taxConfig.variableRate !== null ? round2(m.taxConfig.variableRate * 100) : null,
        fixedMonthly: m.taxConfig.fixedMonthly,
        taxesOnRevenue: m.summary.taxesOnRevenue,
        profitTaxes: m.summary.profitTaxes,
        netRevenue: m.summary.netRevenue,
        netIncome: m.summary.netIncome,
        isClosed: m.taxConfig.isClosed,
        closedAt: m.taxConfig.closedAt
    }));

    const daysInSelectedMonth = new Date(targetYear, selectedMonth, 0).getDate();
    const isCurrentPartialMonth = (targetYear === currentYear && selectedMonth === currentMonth && currentDay < daysInSelectedMonth);
    const prevParts = String(prevMk).split('-').map(Number);
    const prevDaysInMonth = (prevParts.length === 2 && prevParts[0] && prevParts[1]) ? new Date(prevParts[0], prevParts[1], 0).getDate() : 30;

    const buildKpiSnapshot = (s) => ({
        grossRevenue: round2(s.grossRevenue),
        totalDeductions: round2(s.totalDeductions),
        netRevenue: round2(s.netRevenue),
        totalCogs: round2(s.totalCogs),
        totalOpex: round2(s.totalOpex),
        costsPlusOpex: round2((s.totalCogs || 0) + (s.totalOpex || 0)),
        ebitda: round2(s.ebitda),
        netIncome: round2(s.netIncome)
    });

    let kpiComparison = {
        mode: 'FULL_MONTH',
        daysElapsed: daysInSelectedMonth,
        daysInMonth: daysInSelectedMonth,
        prevDaysInMonth,
        projected: buildKpiSnapshot(selData.summary),
        previous: buildKpiSnapshot(prevData.summary)
    };

    if (isCurrentPartialMonth) {
        const paceFactor = daysInSelectedMonth / Math.max(1, currentDay);
        const selSum = selData.summary;
        const grossPace = round2(selSum.grossRevenue * paceFactor);
        const refundsPace = round2(selSum.refunds * paceFactor);
        const taxableBasePace = Math.max(0, round2(grossPace - refundsPace));
        const varTaxRate = selData.taxConfig.variableRate !== null ? selData.taxConfig.variableRate : 0;
        const fixTaxOnce = round2(selSum.calculatedTaxes > 0 || selData.taxConfig.fixedMonthly > 0 ? (selData.taxConfig.fixedMonthly || 0) : 0);
        const extraDedPace = round2((selExpSplit.fixed.DEDUCTION_TAX || 0) + (selExpSplit.variable.DEDUCTION_TAX || 0) * paceFactor);
        const totalDeductionsPace = round2(refundsPace + round2(taxableBasePace * varTaxRate) + fixTaxOnce + extraDedPace);
        const netRevPace = round2(grossPace - totalDeductionsPace);

        const gatewayPace = round2(selSum.gatewayFees * paceFactor);
        const directCogsPace = round2((selExpSplit.fixed.COGS || 0) + (selExpSplit.variable.COGS || 0) * paceFactor);
        const totalCogsPace = round2(gatewayPace + directCogsPace);

        const opexFixedTotal = round2(
            (selExpSplit.fixed.OPEX_MARKETING || 0) +
            (selExpSplit.fixed.OPEX_PERSONNEL || 0) +
            (selExpSplit.fixed.OPEX_ADMIN || 0)
        );
        const opexVarTotal = round2(
            (selExpSplit.variable.OPEX_MARKETING || 0) +
            (selExpSplit.variable.OPEX_PERSONNEL || 0) +
            (selExpSplit.variable.OPEX_ADMIN || 0)
        );
        const totalOpexPace = round2(opexFixedTotal + opexVarTotal * paceFactor);
        const ebitdaPace = round2((netRevPace - totalCogsPace) - totalOpexPace);

        const finIncomePace = round2((selExpSplit.fixed.FINANCIAL_INCOME || 0) + (selExpSplit.variable.FINANCIAL_INCOME || 0) * paceFactor);
        const finExpensePace = round2((selExpSplit.fixed.FINANCIAL_EXPENSE || 0) + (selExpSplit.variable.FINANCIAL_EXPENSE || 0) * paceFactor);
        const adjPace = round2((selData.gateway.cashAdjustments || 0) * paceFactor);
        const lairPace = round2(ebitdaPace + finIncomePace - finExpensePace + adjPace);

        const profitTaxRate = selData.taxConfig.profitTaxRate || 0;
        const profitTaxPace = round2(
            (lairPace > 0 && profitTaxRate > 0 ? lairPace * profitTaxRate : 0) +
            (selExpSplit.fixed.PROFIT_TAX || 0) +
            (selExpSplit.variable.PROFIT_TAX || 0) * paceFactor
        );
        const netIncomePace = round2(lairPace - profitTaxPace);

        kpiComparison = {
            mode: 'PACE_PROJECTION',
            daysElapsed: currentDay,
            daysInMonth: daysInSelectedMonth,
            prevDaysInMonth,
            projected: {
                grossRevenue: grossPace,
                totalDeductions: totalDeductionsPace,
                netRevenue: netRevPace,
                totalCogs: totalCogsPace,
                totalOpex: totalOpexPace,
                costsPlusOpex: round2(totalCogsPace + totalOpexPace),
                ebitda: ebitdaPace,
                netIncome: netIncomePace
            },
            previous: buildKpiSnapshot(prevData.summary)
        };
    }

    return {
        meta: {
            year: targetYear,
            selectedMonth,
            selectedMonthKey: selectedMk,
            selectedMonthLabel: MONTH_FULL_LABELS[selectedMonth - 1],
            prevMonthKey: prevMk,
            regime: cleanRegime,
            regimeLabel: cleanRegime === 'cash' ? 'Regime de Caixa' : 'Regime de Competência',
            availableYears,
            generatedAt: new Date().toISOString()
        },
        company: {
            legalName: settings.company_legal_name || 'Yelo Saúde Mental Ltda',
            cnpj: settings.company_cnpj || '',
            taxRegime: settings.tax_regime || 'SIMPLES_NACIONAL',
            defaultTaxVariableRate: fallbackVarTax,
            defaultTaxFixedMonthly: fallbackFixedTax
        },
        selectedMonthSummary: {
            ...selData.summary,
            revenueByPlan: selData.revenue,
            openReceivables: selData.openReceivables,
            taxConfig: selData.taxConfig,
            paidCount: selData.revenue.paidCount,
            refundCount: selData.deductions.refundCount
        },
        prevMonthSummary: prevData.summary,
        annualSummary,
        kpiComparison,
        monthlySeries: monthlySeries.map(m => ({
            monthIndex: m.monthIndex,
            monthKey: m.monthKey,
            monthLabel: m.monthLabel,
            monthFullLabel: m.monthFullLabel,
            isClosed: m.taxConfig.isClosed,
            ...m.summary,
            paidCount: m.revenue.paidCount
        })),
        dreRows,
        taxAudit,
        alerts,
        cnpjNf,
        ledger: {
            revenues: yearRevenueLedger,
            expenses: yearExpenseLedger
        },
        dreGroupOptions: Object.entries(DRE_GROUP_META).map(([key, val]) => ({
            value: key,
            label: val.label,
            shortLabel: val.shortLabel,
            nature: val.nature,
            purpose: val.purpose
        })),
        autoRecurringExpenses: parseRecurringRules(settings.auto_recurring_expenses)
    };
}

function sanitizeCsvCell(value) {
    if (value === null || value === undefined) return '';
    let str = String(value).replace(/[\r\n]+/g, ' ').trim();
    if (/^[=+\-@\t]/.test(str)) {
        str = `'${str}`;
    }
    if (str.includes(';') || str.includes('"')) {
        str = `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function formatNumberCsv(n) {
    return round2(n).toFixed(2).replace('.', ',');
}

function buildCsvExport(dre, type = 'annual') {
    const lines = [];
    const headerEmpresa = `${dre.company.legalName}${dre.company.cnpj ? ` - CNPJ ${dre.company.cnpj}` : ''}`;

    if (type === 'monthly') {
        lines.push(`DRE MENSAL - ${dre.meta.selectedMonthLabel.toUpperCase()} / ${dre.meta.year}`);
        lines.push(`Empresa;${sanitizeCsvCell(headerEmpresa)};Regime;${sanitizeCsvCell(dre.meta.regimeLabel)}`);
        lines.push(`Código;Conta Contábil;${dre.meta.selectedMonthLabel} (R$);AV %;Mês Anterior (R$);AH %;Acumulado ${dre.meta.year} (R$)`);
        dre.dreRows.forEach(r => {
            lines.push([
                sanitizeCsvCell(r.code),
                sanitizeCsvCell(r.label),
                formatNumberCsv(r.selectedValue),
                `${formatNumberCsv(r.selectedAvPct)}%`,
                formatNumberCsv(r.prevMonthValue),
                r.ahPct !== null ? `${formatNumberCsv(r.ahPct)}%` : '-',
                formatNumberCsv(r.annualTotal)
            ].join(';'));
        });
    } else if (type === 'ledger_revenues') {
        lines.push(`LIVRO RAZÃO DE RECEITAS E ESTORNOS - EXERCÍCIO ${dre.meta.year}`);
        lines.push(`ID Transação;Competência;Data Pagamento;Mês Ref.;Tipo;Origem;Psicólogo;Plano;Meio Pagamento;Status;Valor Bruto (R$);Taxa Gateway (R$);Taxa Estimada?;Valor Líquido (R$)`);
        dre.ledger.revenues.forEach(r => {
            lines.push([
                sanitizeCsvCell(r.id),
                sanitizeCsvCell(r.eventDate),
                sanitizeCsvCell(r.paymentDate),
                sanitizeCsvCell(r.monthKey),
                sanitizeCsvCell(r.type),
                sanitizeCsvCell(r.sourceType),
                sanitizeCsvCell(r.psiNome),
                sanitizeCsvCell(r.plano),
                sanitizeCsvCell(r.billingType),
                sanitizeCsvCell(r.status),
                formatNumberCsv(r.grossAmount),
                formatNumberCsv(r.feeAmount),
                r.feeEstimated ? 'Sim' : 'Não',
                formatNumberCsv(r.netAmount)
            ].join(';'));
        });
    } else if (type === 'ledger_expenses') {
        lines.push(`LIVRO RAZÃO DE DESPESAS E CUSTOS - EXERCÍCIO ${dre.meta.year}`);
        lines.push(`ID;Mês/Ano;Data Doc.;Descrição;Grupo DRE;Categoria;Natureza;Finalidade;Provedor;Origem;Nº Documento;Valor (R$);Observações`);
        dre.ledger.expenses.forEach(e => {
            lines.push([
                sanitizeCsvCell(e.id),
                sanitizeCsvCell(e.monthYear),
                sanitizeCsvCell(e.expenseDate),
                sanitizeCsvCell(e.name),
                sanitizeCsvCell(e.dreGroupLabel),
                sanitizeCsvCell(e.category),
                sanitizeCsvCell(e.nature),
                sanitizeCsvCell(e.purpose),
                sanitizeCsvCell(e.provider),
                sanitizeCsvCell(e.entryMethod),
                sanitizeCsvCell(e.documentNumber || ''),
                formatNumberCsv(e.amount),
                sanitizeCsvCell(e.notes || '')
            ].join(';'));
        });
    } else {
        // annual
        lines.push(`DRE ANUAL CONSOLIDADA - EXERCÍCIO ${dre.meta.year}`);
        lines.push(`Empresa;${sanitizeCsvCell(headerEmpresa)};Regime;${sanitizeCsvCell(dre.meta.regimeLabel)}`);
        lines.push(`Código;Conta Contábil;${MONTH_LABELS.join(';')};Total ${dre.meta.year} (R$);AV %`);
        dre.dreRows.forEach(r => {
            lines.push([
                sanitizeCsvCell(r.code),
                sanitizeCsvCell(r.label),
                ...r.months.map(v => formatNumberCsv(v)),
                formatNumberCsv(r.annualTotal),
                `${formatNumberCsv(r.annualAvPct)}%`
            ].join(';'));
        });
    }

    return '\uFEFF' + lines.join('\r\n');
}

function escapeXml(val) {
    return String(val ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Gera planilha Excel nativa multi-abas (.xls SpreadsheetML XML),
 * abrindo diretamente no Microsoft Excel, LibreOffice e Google Sheets.
 */
function buildExcelWorkbookXml(dre) {
    const strCell = (v, style = 'Default') =>
        `<Cell ss:StyleID="${style}"><Data ss:Type="String">${escapeXml(v)}</Data></Cell>`;
    const numCell = (v, style = 'Money') =>
        `<Cell ss:StyleID="${style}"><Data ss:Type="Number">${round2(v)}</Data></Cell>`;
    const pctCell = (v, style = 'Percent') =>
        `<Cell ss:StyleID="${style}"><Data ss:Type="Number">${round2(v) / 100}</Data></Cell>`;

    const rowStyleFor = (r) => {
        if (r.rowType === 'grand_total') return { text: 'GrandTotalText', money: 'GrandTotalMoney', pct: 'GrandTotalPct' };
        if (r.rowType === 'total') return { text: 'TotalText', money: 'TotalMoney', pct: 'TotalPct' };
        if (r.rowType === 'subtotal') return { text: 'SubtotalText', money: 'SubtotalMoney', pct: 'SubtotalPct' };
        return { text: 'ItemText', money: 'Money', pct: 'Percent' };
    };

    // Aba 1: DRE Anual
    const annualRowsXml = dre.dreRows.map(r => {
        const st = rowStyleFor(r);
        return `<Row>${strCell(r.code, st.text)}${strCell(r.label, st.text)}${r.months.map(v => numCell(v, st.money)).join('')}${numCell(r.annualTotal, st.money)}${pctCell(r.annualAvPct, st.pct)}</Row>`;
    }).join('\n');

    // Aba 2: DRE Mensal
    const monthlyRowsXml = dre.dreRows.map(r => {
        const st = rowStyleFor(r);
        return `<Row>${strCell(r.code, st.text)}${strCell(r.label, st.text)}${numCell(r.selectedValue, st.money)}${pctCell(r.selectedAvPct, st.pct)}${numCell(r.prevMonthValue, st.money)}${r.ahPct !== null ? pctCell(r.ahPct, st.pct) : strCell('-', st.text)}${numCell(r.annualTotal, st.money)}</Row>`;
    }).join('\n');

    // Aba 3: Razão Receitas
    const revRowsXml = dre.ledger.revenues.map(r => (
        `<Row>${strCell(r.id)}${strCell(r.eventDate)}${strCell(r.paymentDate)}${strCell(r.monthKey)}${strCell(r.type)}${strCell(r.psiNome)}${strCell(r.plano)}${strCell(r.billingType)}${strCell(r.status)}${numCell(r.grossAmount)}${numCell(r.feeAmount)}${strCell(r.feeEstimated ? 'Estimada' : 'Observada')}${numCell(r.netAmount)}</Row>`
    )).join('\n');

    // Aba 4: Razão Despesas
    const expRowsXml = dre.ledger.expenses.map(e => (
        `<Row>${strCell(e.id)}${strCell(e.monthYear)}${strCell(e.expenseDate)}${strCell(e.name)}${strCell(e.dreGroupLabel)}${strCell(e.category)}${strCell(e.provider)}${strCell(e.entryMethod)}${strCell(e.documentNumber || '')}${numCell(e.amount)}${strCell(e.notes || '')}</Row>`
    )).join('\n');

    // Aba 5: Apuração Fiscal
    const taxRowsXml = dre.taxAudit.map(t => (
        `<Row>${strCell(t.monthKey)}${strCell(t.monthLabel)}${numCell(t.grossRevenue)}${numCell(t.refunds)}${numCell(t.taxableBase)}${t.variableRatePct !== null ? pctCell(t.variableRatePct) : strCell('N/C')}${numCell(t.fixedMonthly)}${numCell(t.taxesOnRevenue)}${numCell(t.netRevenue)}${numCell(t.netIncome)}${strCell(t.isClosed ? 'Fechado' : 'Aberto')}</Row>`
    )).join('\n');

    const titleInfo = `${dre.company.legalName}${dre.company.cnpj ? ` | CNPJ: ${dre.company.cnpj}` : ''} | ${dre.meta.regimeLabel} | Exercício ${dre.meta.year}`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal"><Font ss:FontName="Calibri" ss:Size="10" ss:Color="#1E293B"/></Style>
  <Style ss:ID="Title"><Font ss:FontName="Calibri" ss:Size="13" ss:Bold="1" ss:Color="#1B4332"/></Style>
  <Style ss:ID="Subtitle"><Font ss:FontName="Calibri" ss:Size="10" ss:Italic="1" ss:Color="#475569"/></Style>
  <Style ss:ID="Header"><Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1B4332" ss:Pattern="Solid"/></Style>
  <Style ss:ID="SubtotalText"><Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#0F172A"/><Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/></Style>
  <Style ss:ID="SubtotalMoney"><Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#0F172A"/><Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/><NumberFormat ss:Format="R$ #,##0.00;[Red]-R$ #,##0.00"/></Style>
  <Style ss:ID="SubtotalPct"><Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#475569"/><Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/><NumberFormat ss:Format="0.0%"/></Style>
  <Style ss:ID="TotalText"><Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#1B4332"/><Interior ss:Color="#ECFDF5" ss:Pattern="Solid"/></Style>
  <Style ss:ID="TotalMoney"><Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#1B4332"/><Interior ss:Color="#ECFDF5" ss:Pattern="Solid"/><NumberFormat ss:Format="R$ #,##0.00;[Red]-R$ #,##0.00"/></Style>
  <Style ss:ID="TotalPct"><Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#1B4332"/><Interior ss:Color="#ECFDF5" ss:Pattern="Solid"/><NumberFormat ss:Format="0.0%"/></Style>
  <Style ss:ID="GrandTotalText"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1B4332" ss:Pattern="Solid"/></Style>
  <Style ss:ID="GrandTotalMoney"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1B4332" ss:Pattern="Solid"/><NumberFormat ss:Format="R$ #,##0.00;[Red]-R$ #,##0.00"/></Style>
  <Style ss:ID="GrandTotalPct"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1B4332" ss:Pattern="Solid"/><NumberFormat ss:Format="0.0%"/></Style>
  <Style ss:ID="ItemText"><Font ss:FontName="Calibri" ss:Size="10" ss:Color="#334155"/></Style>
  <Style ss:ID="Money"><Font ss:FontName="Calibri" ss:Size="10" ss:Color="#1E293B"/><NumberFormat ss:Format="R$ #,##0.00;[Red]-R$ #,##0.00"/></Style>
  <Style ss:ID="Percent"><Font ss:FontName="Calibri" ss:Size="10" ss:Color="#64748B"/><NumberFormat ss:Format="0.0%"/></Style>
 </Styles>
 <Worksheet ss:Name="DRE_Anual">
  <Table>
   <Column ss:Width="50"/><Column ss:Width="290"/>
   ${Array.from({ length: 13 }, () => '<Column ss:Width="92"/>').join('')}
   <Column ss:Width="65"/>
   <Row><Cell ss:StyleID="Title"><Data ss:Type="String">DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO (DRE ANUAL) - ${dre.meta.year}</Data></Cell></Row>
   <Row><Cell ss:StyleID="Subtitle"><Data ss:Type="String">${escapeXml(titleInfo)}</Data></Cell></Row>
   <Row><Cell ss:StyleID="Header"><Data ss:Type="String">Cód.</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Conta Contábil</Data></Cell>${MONTH_LABELS.map(m => strCell(`${m}/${dre.meta.year}`, 'Header')).join('')}${strCell(`Total ${dre.meta.year}`, 'Header')}${strCell('AV %', 'Header')}</Row>
   ${annualRowsXml}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="DRE_Mensal">
  <Table>
   <Column ss:Width="50"/><Column ss:Width="310"/><Column ss:Width="115"/><Column ss:Width="75"/><Column ss:Width="115"/><Column ss:Width="75"/><Column ss:Width="120"/>
   <Row><Cell ss:StyleID="Title"><Data ss:Type="String">DRE MENSAL - ${escapeXml(dre.meta.selectedMonthLabel.toUpperCase())} / ${dre.meta.year}</Data></Cell></Row>
   <Row><Cell ss:StyleID="Subtitle"><Data ss:Type="String">${escapeXml(titleInfo)}</Data></Cell></Row>
   <Row>${['Cód.', 'Conta Contábil', `${dre.meta.selectedMonthLabel}/${dre.meta.year}`, 'AV %', 'Mês Anterior', 'AH %', `Acumulado ${dre.meta.year}`].map(h => strCell(h, 'Header')).join('')}</Row>
   ${monthlyRowsXml}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="Razao_Receitas">
  <Table>
   <Column ss:Width="130"/><Column ss:Width="85"/><Column ss:Width="85"/><Column ss:Width="65"/><Column ss:Width="70"/><Column ss:Width="180"/><Column ss:Width="100"/><Column ss:Width="95"/><Column ss:Width="85"/><Column ss:Width="95"/><Column ss:Width="90"/><Column ss:Width="80"/><Column ss:Width="95"/>
   <Row><Cell ss:StyleID="Title"><Data ss:Type="String">LIVRO RAZÃO DE RECEITAS E ESTORNOS (${dre.meta.year})</Data></Cell></Row>
   <Row>${['ID Asaas', 'Competência', 'Pagamento', 'Mês', 'Tipo', 'Psicólogo', 'Plano', 'Meio', 'Status', 'Bruto', 'Taxa', 'Tipo Taxa', 'Líquido'].map(h => strCell(h, 'Header')).join('')}</Row>
   ${revRowsXml}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="Razao_Despesas">
  <Table>
   <Column ss:Width="75"/><Column ss:Width="65"/><Column ss:Width="85"/><Column ss:Width="210"/><Column ss:Width="150"/><Column ss:Width="115"/><Column ss:Width="85"/><Column ss:Width="80"/><Column ss:Width="90"/><Column ss:Width="95"/><Column ss:Width="180"/>
   <Row><Cell ss:StyleID="Title"><Data ss:Type="String">LIVRO RAZÃO DE DESPESAS E CUSTOS (${dre.meta.year})</Data></Cell></Row>
   <Row>${['ID', 'Mês', 'Data Doc.', 'Descrição', 'Grupo DRE', 'Categoria', 'Provedor', 'Origem', 'Nº Doc/NF', 'Valor', 'Observações'].map(h => strCell(h, 'Header')).join('')}</Row>
   ${expRowsXml}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="Apuracao_Fiscal">
  <Table>
   <Column ss:Width="70"/><Column ss:Width="95"/><Column ss:Width="105"/><Column ss:Width="95"/><Column ss:Width="105"/><Column ss:Width="75"/><Column ss:Width="95"/><Column ss:Width="105"/><Column ss:Width="105"/><Column ss:Width="105"/><Column ss:Width="75"/>
   <Row><Cell ss:StyleID="Title"><Data ss:Type="String">APURAÇÃO FISCAL MENSAL (${dre.meta.year})</Data></Cell></Row>
   <Row>${['Mês/Ano', 'Mês', 'Receita Bruta', 'Estornos', 'Base Tributável', 'Alíquota %', 'Imposto Fixo', 'Total Impostos', 'Receita Líquida', 'Lucro Líquido', 'Status'].map(h => strCell(h, 'Header')).join('')}</Row>
   ${taxRowsXml}
  </Table>
 </Worksheet>
</Workbook>`;
}

module.exports = {
    DRE_GROUP_META,
    VALID_DRE_GROUPS,
    buildDreReport,
    getCnpjNfQueue,
    markCnpjNfStatus,
    buildCsvExport,
    buildExcelWorkbookXml,
    ensureDreSchema,
    autoSyncForYear,
    syncSingleMonth,
    parseRecurringRules
};

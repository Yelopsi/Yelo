const db = require('../models');
const dreService = require('../services/dreService');

const MONTH_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function addMonthsToKey(monthYear, offset) {
    const [y, m] = monthYear.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1 + offset, 1));
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
}

exports.getDre = async (req, res) => {
    try {
        const { year, month, regime, refresh } = req.query;
        const autoSync = await dreService.autoSyncForYear({
            year,
            selectedMonth: month,
            force: refresh === '1'
        });
        const report = await dreService.buildDreReport({ year, month, regime });
        res.json({ success: true, ...report, autoSync });
    } catch (error) {
        console.error('[DRE] Erro ao gerar DRE:', error);
        res.status(500).json({ error: 'Erro ao calcular DRE contábil.' });
    }
};

exports.createExpense = async (req, res) => {
    try {
        await dreService.ensureDreSchema();
        const {
            name,
            amount,
            monthYear,
            dreGroup,
            category,
            nature,
            purpose,
            provider,
            expenseDate,
            documentNumber,
            notes,
            repeatMonths
        } = req.body;

        if (!name || !String(name).trim()) {
            return res.status(400).json({ error: 'Descrição da despesa é obrigatória.' });
        }
        const parsedAmount = Number(amount);
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ error: 'Valor inválido. Informe um valor positivo.' });
        }
        if (!monthYear || !MONTH_KEY_RE.test(monthYear)) {
            return res.status(400).json({ error: 'Mês/Ano inválido. Use o formato YYYY-MM.' });
        }

        const cleanGroup = dreService.VALID_DRE_GROUPS.includes(dreGroup) ? dreGroup : 'OPEX_ADMIN';
        const meta = dreService.DRE_GROUP_META[cleanGroup];
        const repeatCount = Math.min(Math.max(1, parseInt(repeatMonths, 10) || 1), 12);

        const created = [];
        const skippedClosed = [];

        for (let i = 0; i < repeatCount; i++) {
            const targetMk = addMonthsToKey(monthYear, i);
            const mf = await db.YeloMonthlyFinance.findOne({ where: { monthYear: targetMk }, raw: true });
            if (mf && mf.isClosed) {
                skippedClosed.push(targetMk);
                continue;
            }

            const expDate = expenseDate && i === 0
                ? expenseDate
                : (expenseDate && /^\d{4}-\d{2}-\d{2}$/.test(expenseDate)
                    ? `${targetMk}-${expenseDate.slice(8, 10)}`
                    : `${targetMk}-01`);

            const row = await db.YeloExpense.create({
                name: String(name).trim().slice(0, 255),
                amount: parsedAmount,
                monthYear: targetMk,
                category: (category && String(category).trim()) || meta.shortLabel,
                nature: ['FIXED', 'VARIABLE', 'UNCLASSIFIED'].includes(nature) ? nature : meta.nature,
                purpose: ['OPERATION', 'GROWTH', 'UNCLASSIFIED'].includes(purpose) ? purpose : meta.purpose,
                provider: ['GOOGLE', 'META', 'ASAAS', 'RENDER', 'OPENAI', 'WHATSAPP', 'ACCOUNTING', 'OTHER'].includes(provider) ? provider : 'OTHER',
                entryMethod: 'MANUAL',
                dreGroup: cleanGroup,
                expenseDate: expDate,
                documentNumber: documentNumber ? String(documentNumber).trim().slice(0, 100) : null,
                notes: notes ? String(notes).trim().slice(0, 1000) : null
            });
            created.push(row);
        }

        if (created.length === 0 && skippedClosed.length > 0) {
            return res.status(403).json({ error: `O mês ${skippedClosed[0]} está fechado e não aceita novos lançamentos.` });
        }

        res.status(201).json({ success: true, createdCount: created.length, skippedClosed, items: created });
    } catch (error) {
        console.error('[DRE] Erro ao criar despesa:', error);
        res.status(500).json({ error: 'Erro ao salvar lançamento contábil.' });
    }
};

exports.updateExpense = async (req, res) => {
    try {
        await dreService.ensureDreSchema();
        const expenseId = parseInt(req.params.id, 10);
        if (!Number.isInteger(expenseId) || expenseId <= 0) {
            return res.status(400).json({ error: 'ID de lançamento inválido.' });
        }
        const expense = await db.YeloExpense.findByPk(expenseId); // Rota protegida por protect + admin (entidade contábil da empresa)
        if (!expense) {
            return res.status(404).json({ error: 'Lançamento não encontrado.' });
        }

        const mf = await db.YeloMonthlyFinance.findOne({ where: { monthYear: expense.monthYear }, raw: true });
        if (mf && mf.isClosed) {
            return res.status(403).json({ error: `O mês ${expense.monthYear} está fechado para alterações.` });
        }

        const {
            name,
            amount,
            dreGroup,
            category,
            nature,
            purpose,
            provider,
            expenseDate,
            documentNumber,
            notes
        } = req.body;

        const updates = {};
        if (name !== undefined && String(name).trim()) updates.name = String(name).trim().slice(0, 255);
        if (amount !== undefined) {
            const parsedAmount = Number(amount);
            if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
                return res.status(400).json({ error: 'Valor inválido.' });
            }
            updates.amount = parsedAmount;
        }
        if (dreGroup !== undefined && dreService.VALID_DRE_GROUPS.includes(dreGroup)) {
            updates.dreGroup = dreGroup;
            const meta = dreService.DRE_GROUP_META[dreGroup];
            if (nature === undefined) updates.nature = meta.nature;
            if (purpose === undefined) updates.purpose = meta.purpose;
        }
        if (category !== undefined) updates.category = String(category).trim() || 'Outros';
        if (['FIXED', 'VARIABLE', 'UNCLASSIFIED'].includes(nature)) updates.nature = nature;
        if (['OPERATION', 'GROWTH', 'UNCLASSIFIED'].includes(purpose)) updates.purpose = purpose;
        if (['GOOGLE', 'META', 'ASAAS', 'RENDER', 'OPENAI', 'WHATSAPP', 'ACCOUNTING', 'OTHER'].includes(provider)) {
            updates.provider = provider;
        }
        if (expenseDate !== undefined) updates.expenseDate = expenseDate || null;
        if (documentNumber !== undefined) updates.documentNumber = documentNumber ? String(documentNumber).trim().slice(0, 100) : null;
        if (notes !== undefined) updates.notes = notes ? String(notes).trim().slice(0, 1000) : null;
        if (expense.entryMethod === 'SYSTEM' || expense.entryMethod === 'API') {
            updates.entryMethod = 'MANUAL';
        }

        await expense.update(updates);
        res.json({ success: true, expense });
    } catch (error) {
        console.error('[DRE] Erro ao atualizar lançamento:', error);
        res.status(500).json({ error: 'Erro ao atualizar lançamento contábil.' });
    }
};

exports.deleteExpense = async (req, res) => {
    try {
        const expenseId = parseInt(req.params.id, 10);
        if (!Number.isInteger(expenseId) || expenseId <= 0) {
            return res.status(400).json({ error: 'ID de lançamento inválido.' });
        }
        const expense = await db.YeloExpense.findByPk(expenseId); // Rota protegida por protect + admin (entidade contábil da empresa)
        if (!expense) {
            return res.status(404).json({ error: 'Lançamento não encontrado.' });
        }

        const mf = await db.YeloMonthlyFinance.findOne({ where: { monthYear: expense.monthYear }, raw: true });
        if (mf && mf.isClosed) {
            return res.status(403).json({ error: `O mês ${expense.monthYear} está fechado e não permite exclusão.` });
        }

        await expense.destroy();
        res.json({ success: true, message: 'Lançamento removido.' });
    } catch (error) {
        console.error('[DRE] Erro ao excluir lançamento:', error);
        res.status(500).json({ error: 'Erro ao remover lançamento contábil.' });
    }
};

exports.copyPreviousFixedExpenses = async (req, res) => {
    try {
        await dreService.ensureDreSchema();
        const { monthYear } = req.body;
        if (!monthYear || !MONTH_KEY_RE.test(monthYear)) {
            return res.status(400).json({ error: 'monthYear inválido (YYYY-MM).' });
        }

        const mf = await db.YeloMonthlyFinance.findOne({ where: { monthYear }, raw: true });
        if (mf && mf.isClosed) {
            return res.status(403).json({ error: `O mês ${monthYear} está fechado.` });
        }

        const prevMk = addMonthsToKey(monthYear, -1);
        const prevExpenses = await db.YeloExpense.findAll({
            where: { monthYear: prevMk, nature: 'FIXED' },
            raw: true
        });

        if (prevExpenses.length === 0) {
            return res.json({ success: true, copiedCount: 0, message: `Nenhuma despesa fixa encontrada em ${prevMk}.` });
        }

        const existingTarget = await db.YeloExpense.findAll({
            where: { monthYear },
            raw: true
        });
        const existingKeys = new Set(existingTarget.map(e => `${e.name.toLowerCase()}::${e.dreGroup || ''}::${Number(e.amount).toFixed(2)}`));

        let copiedCount = 0;
        for (const prev of prevExpenses) {
            const sig = `${prev.name.toLowerCase()}::${prev.dreGroup || ''}::${Number(prev.amount).toFixed(2)}`;
            if (existingKeys.has(sig)) continue;

            await db.YeloExpense.create({
                name: prev.name,
                amount: prev.amount,
                monthYear,
                category: prev.category,
                nature: prev.nature,
                purpose: prev.purpose,
                provider: prev.provider,
                entryMethod: 'SYSTEM',
                dreGroup: prev.dreGroup || null,
                expenseDate: `${monthYear}-01`,
                documentNumber: null,
                notes: `Replicado de ${prevMk}`
            });
            copiedCount++;
        }

        res.json({
            success: true,
            copiedCount,
            message: copiedCount > 0
                ? `${copiedCount} despesa(s) fixa(s) copiada(s) de ${prevMk} para ${monthYear}.`
                : `Todas as despesas fixas de ${prevMk} já estão lançadas em ${monthYear}.`
        });
    } catch (error) {
        console.error('[DRE] Erro ao copiar despesas fixas:', error);
        res.status(500).json({ error: 'Erro ao copiar despesas fixas do mês anterior.' });
    }
};

exports.syncAdsSpend = async (req, res) => {
    try {
        await dreService.ensureDreSchema();
        const { monthYear, year } = req.body;
        if (monthYear && !MONTH_KEY_RE.test(monthYear)) {
            return res.status(400).json({ error: 'monthYear inválido (YYYY-MM).' });
        }

        if (monthYear) {
            const mf = await db.YeloMonthlyFinance.findOne({ where: { monthYear }, raw: true });
            if (mf && mf.isClosed) {
                return res.status(403).json({ error: `O mês ${monthYear} está fechado.` });
            }
            const result = await dreService.syncSingleMonth({ monthYear, isClosed: false, force: true });
            return res.json({ success: true, ...result });
        }

        const targetYear = parseInt(year, 10) || new Date().getFullYear();
        const result = await dreService.autoSyncForYear({ year: targetYear, selectedMonth: new Date().getMonth() + 1, force: true });
        res.json({ success: true, year: targetYear, ...result });
    } catch (error) {
        console.error('[DRE] Erro ao sincronizar Ads:', error);
        res.status(500).json({ error: 'Erro ao sincronizar gastos de Ads e recorrências.' });
    }
};

exports.saveRecurringRules = async (req, res) => {
    try {
        await dreService.ensureDreSchema();
        const { rules, targetYear } = req.body;
        if (!Array.isArray(rules)) {
            return res.status(400).json({ error: 'Formato inválido para regras recorrentes.' });
        }

        const sanitizedRules = dreService.parseRecurringRules(rules);
        let settings = await db.SystemSetting.findOne();
        if (!settings) settings = await db.SystemSetting.create({});

        await settings.update({ auto_recurring_expenses: JSON.stringify(sanitizedRules) });

        const yr = parseInt(targetYear, 10) || new Date().getFullYear();
        const syncRes = await dreService.autoSyncForYear({
            year: yr,
            selectedMonth: new Date().getMonth() + 1,
            force: false
        });

        res.json({
            success: true,
            rules: sanitizedRules,
            appliedCount: (syncRes.synced || []).filter(s => s.kind === 'RECURRING').length
        });
    } catch (error) {
        console.error('[DRE] Erro ao salvar despesas recorrentes:', error);
        res.status(500).json({ error: 'Erro ao salvar regras recorrentes.' });
    }
};

exports.saveFiscalConfig = async (req, res) => {
    try {
        await dreService.ensureDreSchema();
        const {
            companyLegalName,
            companyCnpj,
            taxRegime,
            defaultTaxVariableRate,
            defaultTaxFixedMonthly,
            monthYear,
            monthTaxVariableRate,
            monthTaxFixedMonthly,
            monthProfitTaxRate,
            monthNotes,
            action
        } = req.body;

        // 1. Atualiza configurações globais da empresa quando fornecidas
        let settings = await db.SystemSetting.findOne();
        if (!settings) settings = await db.SystemSetting.create({});

        const sysUpdates = {};
        if (companyLegalName !== undefined) sysUpdates.company_legal_name = String(companyLegalName).trim() || null;
        if (companyCnpj !== undefined) sysUpdates.company_cnpj = String(companyCnpj).trim().slice(0, 32) || null;
        if (taxRegime !== undefined) sysUpdates.tax_regime = String(taxRegime).trim() || 'SIMPLES_NACIONAL';
        if (defaultTaxVariableRate !== undefined) {
            if (defaultTaxVariableRate === '' || defaultTaxVariableRate === null) {
                sysUpdates.tax_variable_rate = null;
            } else {
                const r = Number(defaultTaxVariableRate);
                if (!Number.isFinite(r) || r < 0 || r > 1) {
                    return res.status(400).json({ error: 'Alíquota padrão inválida (deve estar entre 0% e 100%).' });
                }
                sysUpdates.tax_variable_rate = r;
            }
        }
        if (defaultTaxFixedMonthly !== undefined) {
            if (defaultTaxFixedMonthly === '' || defaultTaxFixedMonthly === null) {
                sysUpdates.tax_fixed_monthly = null;
            } else {
                const f = Number(defaultTaxFixedMonthly);
                if (!Number.isFinite(f) || f < 0) {
                    return res.status(400).json({ error: 'Imposto fixo mensal inválido.' });
                }
                sysUpdates.tax_fixed_monthly = f;
            }
        }
        if (Object.keys(sysUpdates).length > 0) {
            await settings.update(sysUpdates);
        }

        // 2. Atualiza snapshot mensal (ou fecha / reabre mês contábil)
        let snapshot = null;
        if (monthYear) {
            if (!MONTH_KEY_RE.test(monthYear)) {
                return res.status(400).json({ error: 'monthYear inválido (YYYY-MM).' });
            }
            snapshot = await db.YeloMonthlyFinance.findOne({ where: { monthYear } });

            if (action === 'reopen') {
                if (snapshot) {
                    await snapshot.update({ isClosed: false, closedAt: null });
                }
                return res.json({ success: true, message: `Mês ${monthYear} reaberto para edição contábil.`, snapshot });
            }

            if (snapshot && snapshot.isClosed && action !== 'reopen') {
                return res.status(403).json({ error: `O mês ${monthYear} já está fechado. Reabra-o primeiro para editar.` });
            }

            const mfData = {};
            if (monthTaxVariableRate !== undefined) {
                mfData.appliedTaxVariableRate = (monthTaxVariableRate === '' || monthTaxVariableRate === null)
                    ? null
                    : Number(monthTaxVariableRate);
            }
            if (monthTaxFixedMonthly !== undefined) {
                mfData.appliedTaxFixedMonthly = (monthTaxFixedMonthly === '' || monthTaxFixedMonthly === null)
                    ? null
                    : Number(monthTaxFixedMonthly);
            }
            if (monthProfitTaxRate !== undefined) {
                mfData.appliedProfitTaxRate = (monthProfitTaxRate === '' || monthProfitTaxRate === null)
                    ? null
                    : Number(monthProfitTaxRate);
            }
            if (monthNotes !== undefined) {
                mfData.notes = monthNotes ? String(monthNotes).trim().slice(0, 2000) : null;
            }

            if (action === 'close') {
                mfData.isClosed = true;
                mfData.closedAt = new Date();
                mfData.opexIsComplete = true;
            }

            if (snapshot) {
                await snapshot.update(mfData);
            } else {
                snapshot = await db.YeloMonthlyFinance.create({ monthYear, ...mfData });
            }
        }

        res.json({ success: true, settings, snapshot });
    } catch (error) {
        console.error('[DRE] Erro ao salvar configuração fiscal:', error);
        res.status(500).json({ error: 'Erro ao salvar configuração fiscal.' });
    }
};

exports.exportCsv = async (req, res) => {
    try {
        const { year, month, regime, type = 'annual' } = req.query;
        const dre = await dreService.buildDreReport({ year, month, regime });
        const csvContent = dreService.buildCsvExport(dre, type);

        const safeType = ['annual', 'monthly', 'ledger_revenues', 'ledger_expenses'].includes(type) ? type : 'annual';
        const fileName = `yelo_dre_${safeType}_${dre.meta.year}${safeType === 'monthly' ? `_${String(dre.meta.selectedMonth).padStart(2, '0')}` : ''}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.send(csvContent);
    } catch (error) {
        console.error('[DRE] Erro ao exportar CSV:', error);
        res.status(500).json({ error: 'Erro ao exportar CSV da DRE.' });
    }
};

exports.exportExcel = async (req, res) => {
    try {
        const { year, month, regime } = req.query;
        const dre = await dreService.buildDreReport({ year, month, regime });
        const xml = dreService.buildExcelWorkbookXml(dre);

        const fileName = `yelo_dre_contabil_${dre.meta.year}.xls`;
        res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.send(xml);
    } catch (error) {
        console.error('[DRE] Erro ao exportar Excel:', error);
        res.status(500).json({ error: 'Erro ao gerar planilha Excel contábil.' });
    }
};

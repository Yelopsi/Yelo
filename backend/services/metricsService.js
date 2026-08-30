const { Op } = require('sequelize');
const db = require('../models');

class MetricsService {
    static getValidStatuses() {
        return ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];
    }

    static hasPaidCustomer(psyId, paymentsByPsy) {
        const payments = paymentsByPsy[psyId] || [];
        return payments.some(p => this.getValidStatuses().includes(p.status));
    }

    static getFirstPaidAt(psyId, paymentsByPsy) {
        const payments = paymentsByPsy[psyId] || [];
        const valid = payments.filter(p => this.getValidStatuses().includes(p.status))
                              .sort((a, b) => new Date(a.paymentDate || a.dateCreated) - new Date(b.paymentDate || b.dateCreated));
        return valid.length > 0 ? new Date(valid[0].paymentDate || valid[0].dateCreated) : null;
    }

    static isCurrentlyPaying(psy, paymentsByPsy) {
        if (!this.hasPaidCustomer(psy.id, paymentsByPsy)) return false;
        
        // Se cancelou voluntariamente
        if (psy.canceledAt && new Date(psy.canceledAt) <= new Date() && !psy.reactivatedAt) {
            return false;
        }

        // Se o plano expirou e o status caiu para inactive (Inadimplência)
        if (psy.status === 'inactive') {
            return false;
        }

        return true;
    }

    static wasEffectivelyPayingAt(psy, date, paymentsByPsy) {
        if (!this.hasPaidCustomer(psy.id, paymentsByPsy)) return false;
        
        const firstPaid = this.getFirstPaidAt(psy.id, paymentsByPsy);
        if (!firstPaid || firstPaid > date) return false;
        
        if (psy.canceledAt && new Date(psy.canceledAt) <= date) {
            if (psy.reactivatedAt && new Date(psy.reactivatedAt) <= date) {
                return true; 
            }
            return false;
        }
        
        return true;
    }

    static getMonthlyCohortDates(start, end) {
        let current = new Date(start.getFullYear(), start.getMonth(), 1);
        const limit = new Date(end.getFullYear(), end.getMonth(), 1);
        const months = [];
        while (current <= limit) {
            months.push(new Date(current));
            current.setMonth(current.getMonth() + 1);
        }
        return months;
    }

    static async getMetrics(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        const allPsychologists = await db.Psychologist.findAll({ paranoid: false, raw: true });
        const allPayments = await db.Payment.findAll({ raw: true });

        const paymentsByPsy = {};
        for (const p of allPayments) {
            if (!paymentsByPsy[p.psychologistId]) paymentsByPsy[p.psychologistId] = [];
            paymentsByPsy[p.psychologistId].push(p);
        }

        let settings = {};
        try { settings = await db.SystemSetting.findOne() || {}; } catch(e) { }

        const priceEssencial = settings.price_Essencial > 0 ? settings.price_Essencial : 99.00;
        const priceClinico = settings.price_Clínico > 0 ? settings.price_Clínico : 159.00;
        const priceReference = settings.price_sol > 0 ? settings.price_sol : 259.00;
        const planPrices = { 'essencial': priceEssencial, 'essential': priceEssencial, 'clínico': priceClinico, 'clinical': priceClinico, 'sol': priceReference, 'reference': priceReference };

        let mrrTotal = 0;
        let payingActiveCount = 0;
        let inadimplentesCount = 0;
        
        for (const psy of allPsychologists) {
            if (this.isCurrentlyPaying(psy, paymentsByPsy)) {
                payingActiveCount++;
                const pName = (psy.plano || '').toLowerCase();
                mrrTotal += planPrices[pName] || 0;
            } else if (this.hasPaidCustomer(psy.id, paymentsByPsy) && psy.status === 'inactive' && !psy.canceledAt) {
                inadimplentesCount++;
            }
        }
        
        const arpu = payingActiveCount > 0 ? (mrrTotal / payingActiveCount) : 0;
        const ticketMedio = arpu > 0 ? arpu : priceEssencial;

        let novosCount = 0;
        let reactivatedCount = 0;
        
        let totalGrossRevenueFromChurned = 0;
        let totalNetRevenueFromChurned = 0;
        let totalHistoricalPaidChurned = 0;
        
        let trialChurnCountTotal = 0;

        for (const psy of allPsychologists) {
            const hasPaid = this.hasPaidCustomer(psy.id, paymentsByPsy);
            const firstPaid = this.getFirstPaidAt(psy.id, paymentsByPsy);

            // Novos Pagantes no período
            if (hasPaid && firstPaid >= start && firstPaid <= end) {
                novosCount++;
            }

            if (psy.reactivatedAt) {
                const reactivated = new Date(psy.reactivatedAt);
                if (reactivated >= start && reactivated <= end) reactivatedCount++;
            }
            
            const isCanceled = psy.canceledAt && new Date(psy.canceledAt) <= new Date();
            
            if (isCanceled && !psy.reactivatedAt) {
                if (hasPaid) {
                    totalHistoricalPaidChurned++;
                    const validPys = paymentsByPsy[psy.id].filter(p => this.getValidStatuses().includes(p.status));
                    totalGrossRevenueFromChurned += validPys.reduce((acc, p) => acc + parseFloat(p.value || 0), 0);
                    totalNetRevenueFromChurned += validPys.reduce((acc, p) => acc + parseFloat(p.netValue || p.value || 0), 0);
                } else {
                    trialChurnCountTotal++;
                }
            }
        }

        const ltvObservadoBruto = totalHistoricalPaidChurned > 0 ? (totalGrossRevenueFromChurned / totalHistoricalPaidChurned) : 0;
        const ltvObservadoLiquido = totalHistoricalPaidChurned > 0 ? (totalNetRevenueFromChurned / totalHistoricalPaidChurned) : 0;
        
        const months = this.getMonthlyCohortDates(start, end);
        let paidChurnCountNoPeriodo = 0;
        let trialChurnCountNoPeriodo = 0;

        for (const psy of allPsychologists) {
            if (psy.canceledAt) {
                const canceled = new Date(psy.canceledAt);
                if (canceled >= start && canceled <= end && canceled <= new Date()) {
                    if (this.hasPaidCustomer(psy.id, paymentsByPsy)) {
                        paidChurnCountNoPeriodo++;
                    } else {
                        trialChurnCountNoPeriodo++;
                    }
                }
            }
        }

        let somaDeChurnRates = 0;
        let somaBaseInicial = 0;
        let somaPaidChurns = 0;
        let mesesValidos = 0;
        let ultimaBaseInicial = 0;
        let historyLog = {};

        // Exposição Corrigida Mês a Mês
        for (const monthStart of months) {
            let baseInicial = 0;
            let churnNoMes = 0;
            const monthExactStart = new Date(monthStart);
            const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59);

            if (monthExactStart > new Date()) continue;

            for (const psy of allPsychologists) {
                if (this.wasEffectivelyPayingAt(psy, monthExactStart, paymentsByPsy)) {
                    baseInicial++;
                    if (psy.canceledAt) {
                        const canceled = new Date(psy.canceledAt);
                        if (canceled >= monthStart && canceled <= monthEnd && canceled <= new Date()) {
                            churnNoMes++;
                        }
                    }
                }
            }
            if (baseInicial > 0) {
                const monthChurnRate = churnNoMes / baseInicial;
                somaDeChurnRates += monthChurnRate;
                somaBaseInicial += baseInicial;
                somaPaidChurns += churnNoMes;
                mesesValidos++;
                ultimaBaseInicial = baseInicial;
            }
            historyLog[monthStart.toISOString().split('T')[0]] = { startBase: baseInicial, churns: churnNoMes };
        }
        
        let baseInicialDoPeriodo = 0;
        for (const psy of allPsychologists) {
            if (this.wasEffectivelyPayingAt(psy, start, paymentsByPsy)) {
                baseInicialDoPeriodo++;
            }
        }

        const churnRateMedioMensal = mesesValidos > 0 ? (somaDeChurnRates / mesesValidos) : 0;
        const weightedChurnRate = somaBaseInicial > 0 ? (somaPaidChurns / somaBaseInicial) : 0;
        
        // Teto de segurança (Cap) dinâmico baseado na maturidade da base
        let capSeguranca = 12; 
        if (payingActiveCount >= 50) capSeguranca = 24;
        if (payingActiveCount >= 150) capSeguranca = 36;
        if (payingActiveCount >= 500) capSeguranca = 60;

        let projectedLifetimeMonths = capSeguranca; 
        if (weightedChurnRate > 0) {
            const calculatedLifetime = 1 / weightedChurnRate;
            // Se a matemática ultrapassar o teto, travamos no limite seguro para o tamanho atual da empresa.
            projectedLifetimeMonths = Math.min(calculatedLifetime, capSeguranca);
        }

        const ltvProjetado = ticketMedio * projectedLifetimeMonths;
        const cacMock = 150; 
        const cacPaybackMonths = ticketMedio > 0 ? (cacMock / ticketMedio) : 0;

        return {
            mrrTotal,
            arpu: ticketMedio,
            payingActiveCount,
            inadimplentesCount,
            novosCount,
            reactivatedCount,
            paidChurnCount: paidChurnCountNoPeriodo,
            trialChurnCount: trialChurnCountNoPeriodo,
            churnRateMedioMensal: churnRateMedioMensal * 100,
            weightedChurnRate: weightedChurnRate * 100,
            ltvObservado: ltvObservadoBruto,
            ltvObservadoBruto,
            ltvObservadoLiquido,
            ltvProjetado,
            projectedLifetimeMonths,
            cacPaybackMonths,
            ultimaBaseInicial,
            sampleData: {
                totalCustomersAnalyzed: allPsychologists.length,
                totalHistoricalPaidChurned,
                totalHistoricalTrialChurned: trialChurnCountTotal,
                mesesAnalisados: mesesValidos,
                somaBaseInicial,
                baseInicialDoPeriodo,
                historyLog,
                baseFinal: payingActiveCount
            }
        };
    }
}
module.exports = MetricsService;

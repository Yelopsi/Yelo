const db = require('../models');
const { Op } = require('sequelize');
const subscriptionRevenue = require('../utils/subscriptionRevenue');

class CashFlowService {
    async buildCashFlowData() {
        try {
            // 1. Busca todos os pagamentos confirmados ou recebidos no banco local + taxas reais e assinaturas
            const [localPayments, financialEvents, subscriptions] = await Promise.all([
                db.Payment.findAll({
                    where: {
                        status: {
                            [Op.in]: ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH']
                        }
                    },
                    raw: true
                }),
                db.PaymentFinancialEvent
                    ? db.PaymentFinancialEvent.findAll({
                        where: { eventType: 'PAYMENT_CREDITED' },
                        attributes: ['paymentId', 'grossAmount', 'feeAmount', 'netCashAmount'],
                        raw: true
                    }).catch(() => [])
                    : Promise.resolve([]),
                db.Subscription
                    ? db.Subscription.findAll({
                        attributes: ['id', 'psychologistId', 'plan', 'currentPeriodStart', 'currentPeriodEnd'],
                        raw: true
                    }).catch(() => [])
                    : Promise.resolve([])
            ]);

            const netByPaymentId = new Map();
            const feeByPaymentId = new Map();
            for (const ev of (financialEvents || [])) {
                if (!ev.paymentId) continue;
                const netCash = Number(ev.netCashAmount);
                const feeAmt = Number(ev.feeAmount);
                const grossAmt = Number(ev.grossAmount);
                if (Number.isFinite(netCash) && netCash > 0) {
                    netByPaymentId.set(ev.paymentId, netCash);
                } else if (Number.isFinite(grossAmt) && Number.isFinite(feeAmt) && feeAmt >= 0) {
                    netByPaymentId.set(ev.paymentId, subscriptionRevenue.round2(grossAmt - feeAmt));
                }
                if (Number.isFinite(feeAmt) && feeAmt >= 0) {
                    feeByPaymentId.set(ev.paymentId, feeAmt);
                }
            }

            const subById = new Map();
            const subByPsi = new Map();
            for (const s of (subscriptions || [])) {
                if (s.id) subById.set(s.id, s);
                if (s.psychologistId) subByPsi.set(s.psychologistId, s);
            }

            const mergedPayments = {};
            
            // Insere os pagamentos locais no dicionário
            localPayments.forEach(p => {
                mergedPayments[p.id] = p;
            });

            // 2. Tenta buscar o histórico diretamente do Asaas para preencher pagamentos antigos 
            // (antes da implementação da tabela local) e netValue real do gateway
            try {
                const fetchAsaas = async (endpoint) => {
                    const url = `${process.env.ASAAS_API_URL || 'https://www.asaas.com/api/v3'}${endpoint}`;
                    const response = await fetch(url, {
                        headers: { 'access_token': process.env.ASAAS_API_KEY }
                    });
                    if (!response.ok) return { data: [] };
                    return await response.json();
                };

                const dataConfirmed = await fetchAsaas('/payments?status=CONFIRMED&limit=100');
                const dataReceived = await fetchAsaas('/payments?status=RECEIVED&limit=100');
                const dataReceivedInCash = await fetchAsaas('/payments?status=RECEIVED_IN_CASH&limit=100');

                const asaasPayments = [
                    ...(dataConfirmed.data || []),
                    ...(dataReceived.data || []),
                    ...(dataReceivedInCash.data || [])
                ];

                asaasPayments.forEach(p => {
                    const asaasDate = p.clientPaymentDate || p.confirmedDate || p.paymentDate || p.creditDate || p.dateCreated;
                    if (!mergedPayments[p.id]) {
                        mergedPayments[p.id] = {
                            id: p.id,
                            value: p.value,
                            netValue: p.netValue,
                            paymentDate: asaasDate,
                            dueDate: p.dueDate,
                            status: p.status,
                            subscriptionId: p.subscription || null
                        };
                    } else {
                        if (asaasDate) {
                            mergedPayments[p.id].paymentDate = asaasDate;
                        }
                        if (p.status) {
                            mergedPayments[p.id].status = p.status;
                        }
                        if (p.netValue !== undefined && p.netValue !== null) {
                            mergedPayments[p.id].netValue = p.netValue;
                        }
                        if (!mergedPayments[p.id].subscriptionId && p.subscription) {
                            mergedPayments[p.id].subscriptionId = p.subscription;
                        }
                    }
                });
            } catch (asaasErr) {
                console.error("Aviso: Falha ao buscar histórico do Asaas, usando apenas banco local.", asaasErr);
            }

            const allPayments = Object.values(mergedPayments);

            const cashFlowByMonth = {};
            const weeklyData = {};

            allPayments.forEach(payment => {
                // Prioriza a data de pagamento
                let dateObj = payment.paymentDate || payment.dueDate || payment.createdAt;
                if (!dateObj) return;

                let monthYear = '';
                let day = 1;
                
                // Se for string no formato YYYY-MM-DD ou ISO, pega os primeiros 7 caracteres diretamente para evitar bug de fuso horário
                if (typeof dateObj === 'string' && dateObj.length >= 7) {
                    monthYear = dateObj.substring(0, 7);
                    if (dateObj.length >= 10) {
                        day = parseInt(dateObj.substring(8, 10), 10);
                    }
                } else if (dateObj instanceof Date) {
                    // Se for objeto Date, converte para string local (considerando fuso) ou padroniza YYYY-MM
                    const year = dateObj.getFullYear();
                    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                    monthYear = `${year}-${month}`;
                    day = dateObj.getDate();
                } else {
                    return; // Formato inválido
                }

                if (!cashFlowByMonth[monthYear]) {
                    cashFlowByMonth[monthYear] = {
                        monthYear,
                        grossValue: 0,
                        netValue: 0,
                        count: 0,
                        avgTicket: 0,
                        multiMonthCount: 0,
                        nonStandardPayments: [],
                        distinctValues: new Set()
                    };
                }

                if (!weeklyData[monthYear]) {
                    weeklyData[monthYear] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
                }

                const grossVal = parseFloat(payment.value) || 0;
                const ledgerNet = netByPaymentId.get(payment.id);
                const asaasNet = payment.netValue !== undefined && payment.netValue !== null ? Number(payment.netValue) : NaN;
                const netVal = Number.isFinite(ledgerNet)
                    ? ledgerNet
                    : (Number.isFinite(asaasNet) && asaasNet > 0 ? asaasNet : (grossVal > 1.99 ? grossVal - 1.99 : grossVal));

                const sub = (payment.subscriptionId && subById.get(payment.subscriptionId)) || (payment.psychologistId && subByPsi.get(payment.psychologistId)) || null;
                let monthsCovered = 1;
                if (sub?.currentPeriodStart && sub?.currentPeriodEnd) {
                    const pTime = new Date(dateObj).getTime();
                    const sStart = new Date(sub.currentPeriodStart).getTime();
                    const sEnd = new Date(sub.currentPeriodEnd).getTime();
                    if (!Number.isNaN(pTime) && pTime >= (sStart - 3 * 86400000) && pTime <= sEnd) {
                        monthsCovered = subscriptionRevenue.computeMonthsFromDates(sub.currentPeriodStart, sub.currentPeriodEnd);
                    }
                }

                const bucket = cashFlowByMonth[monthYear];
                bucket.grossValue += grossVal;
                bucket.netValue += netVal > 0 ? netVal : grossVal;
                bucket.count += 1;
                bucket.distinctValues.add(subscriptionRevenue.round2(grossVal));

                if (monthsCovered > 1 && grossVal > 100) {
                    bucket.multiMonthCount += 1;
                    bucket.nonStandardPayments.push({ value: subscriptionRevenue.round2(grossVal), monthsCovered });
                } else if (Math.abs(grossVal - 99) >= 1 && grossVal > 99) {
                    bucket.nonStandardPayments.push({ value: subscriptionRevenue.round2(grossVal), monthsCovered });
                }

                const weekNum = Math.min(Math.ceil(day / 7), 5); // 1 a 5
                if (weekNum >= 1 && weekNum <= 5) {
                    weeklyData[monthYear][weekNum] += 1;
                }
            });

            // Finaliza métricas auxiliares e resume notas de transparência para o painel
            const result = Object.values(cashFlowByMonth)
                .map(bucket => {
                    const grossValue = subscriptionRevenue.round2(bucket.grossValue);
                    const netValue = subscriptionRevenue.round2(bucket.netValue);
                    const avgTicket = bucket.count > 0 ? subscriptionRevenue.round2(grossValue / bucket.count) : 0;

                    let summaryHint = '';
                    if (bucket.nonStandardPayments.length > 0) {
                        const grouped = new Map();
                        for (const item of bucket.nonStandardPayments) {
                            const key = `${item.value}|${item.monthsCovered}`;
                            grouped.set(key, (grouped.get(key) || 0) + 1);
                        }
                        const parts = Array.from(grouped.entries()).map(([key, qty]) => {
                            const [valStr, monthsStr] = key.split('|');
                            const valFmt = subscriptionRevenue.formatMoneyCompact(Number(valStr));
                            const monthsNum = Number(monthsStr);
                            return monthsNum > 1 ? `${qty}× R$ ${valFmt} (${monthsNum}m)` : `${qty}× R$ ${valFmt}`;
                        });
                        summaryHint = `Inclui ${parts.join(', ')} · Ticket R$ ${subscriptionRevenue.formatMoneyCompact(avgTicket)}`;
                    } else if (bucket.distinctValues.size > 1 && bucket.count > 1) {
                        summaryHint = `Ticket médio R$ ${subscriptionRevenue.formatMoneyCompact(avgTicket)}`;
                    }

                    return {
                        monthYear: bucket.monthYear,
                        grossValue,
                        netValue,
                        count: bucket.count,
                        avgTicket,
                        multiMonthCount: bucket.multiMonthCount,
                        summaryHint
                    };
                })
                .sort((a, b) => b.monthYear.localeCompare(a.monthYear));

            return { monthly: result, weekly: weeklyData };
        } catch (error) {
            console.error("Erro no buildCashFlowData:", error);
            throw error;
        }
    }
    async getAsaasMRR() {
        const fetch = require('node-fetch');
        try {
            const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';
            const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
            
            let allSubscriptions = [];
            let offset = 0;
            const limit = 100;
            let hasMore = true;

            while (hasMore) {
                const res = await fetch(`${ASAAS_API_URL}/subscriptions?limit=${limit}&offset=${offset}&status=ACTIVE`, {
                    headers: { 'access_token': ASAAS_API_KEY }
                });
                const data = await res.json();
                if (data && data.data) {
                    allSubscriptions = allSubscriptions.concat(data.data);
                    hasMore = data.hasMore;
                    offset += limit;
                } else {
                    hasMore = false;
                }
            }
            
            let overdueSubscriptions = new Set();
            let offsetOverdue = 0;
            let hasMoreOverdue = true;

            while (hasMoreOverdue) {
                const res = await fetch(`${ASAAS_API_URL}/payments?status=OVERDUE&limit=100&offset=${offsetOverdue}`, {
                    headers: { 'access_token': ASAAS_API_KEY }
                });
                const data = await res.json();
                if (data && data.data) {
                    data.data.forEach(p => {
                        if (p.subscription) overdueSubscriptions.add(p.subscription);
                    });
                    hasMoreOverdue = data.hasMore;
                    offsetOverdue += 100;
                } else {
                    hasMoreOverdue = false;
                }
            }
            
            let mrr = 0;
            allSubscriptions.forEach(sub => {
                if (!overdueSubscriptions.has(sub.id)) {
                    mrr += sub.value;
                }
            });
            return mrr;
        } catch (error) {
            console.error("Erro ao buscar MRR no Asaas:", error);
            return 0;
        }
    }
}

module.exports = new CashFlowService();

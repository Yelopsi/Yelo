exports.getFinancials = async (req, res) => {
    try {
        const { Op } = require('sequelize'); // Ensure Op is available if not globally scoped
        const planPrices = { 
            'essential': 99.00, 'clinical': 159.00, 'reference': 259.00,
            'essencial': 99.00, 'clínico': 159.00, 'sol': 259.00 
        };

        const activePsychologists = await db.Psychologist.findAll({
            where: { plano: { [Op.ne]: null }, status: 'active' },
            attributes: ['id', 'nome', 'plano', 'updatedAt', 'is_exempt', 'planExpiresAt', 'stripeSubscriptionId', 'subscriptionId', 'createdAt'] 
        });

        const mrr = activePsychologists.reduce((acc, psy) => {
            if (psy.is_exempt) return acc;
            const hasSub = !!(psy.stripeSubscriptionId || psy.subscriptionId);
            if (!hasSub) return acc;
            const planoKey = (psy.plano || '').toLowerCase();
            return acc + (planPrices[planoKey] || 0);
        }, 0);

        const { startDate, endDate } = req.query;
        let dateCondition = {};
        let prevDateCondition = {};
        
        let start, end;
        if (startDate && endDate) {
            start = new Date(`${startDate}T00:00:00-03:00`);
            end = new Date(`${endDate}T23:59:59-03:00`);
            dateCondition = { [Op.between]: [start, end] };
            
            const msDiff = end.getTime() - start.getTime();
            const prevStart = new Date(start.getTime() - msDiff);
            const prevEnd = new Date(start.getTime() - 1);
            prevDateCondition = { [Op.between]: [prevStart, prevEnd] };
        } else {
            end = new Date();
            start = new Date(new Date().setDate(end.getDate() - 30));
            dateCondition = { [Op.gte]: start };
            
            const sixtyDaysAgo = new Date(new Date().setDate(end.getDate() - 60));
            prevDateCondition = { [Op.between]: [sixtyDaysAgo, start] };
        }

        // Current Period Data
        const churnedUsers = await db.Psychologist.findAll({
            where: { status: 'inactive', updatedAt: dateCondition },
            attributes: ['updatedAt']
        });
        const churnedCount = churnedUsers.length;
        
        const newUsers = await db.Psychologist.findAll({
            where: { status: 'active', createdAt: dateCondition },
            attributes: ['createdAt']
        });
        const newUsersCount = newUsers.length;

        // Previous Period Data
        const prevChurnedCount = await db.Psychologist.count({
            where: { status: 'inactive', updatedAt: prevDateCondition }
        });
        const prevNewUsersCount = await db.Psychologist.count({
            where: { status: 'active', createdAt: prevDateCondition }
        });

        const totalActiveCount = activePsychologists.length;
        const payingActiveCount = activePsychologists.filter(psy => !psy.is_exempt).length;
        const arpu = payingActiveCount > 0 ? mrr / payingActiveCount : 0;
        
        const totalUsersAtStartOfMonth = totalActiveCount + churnedCount - newUsersCount;
        const baseForChurn = totalUsersAtStartOfMonth > 0 ? totalUsersAtStartOfMonth : 1;
        const churnRate = (churnedCount / baseForChurn) * 100;
        const ltv = churnRate > 0 ? arpu / (churnRate / 100) : (arpu * 24);
        
        // Previous KPIs Approximation
        const netGrowth = newUsersCount - churnedCount;
        const prevTotalActiveCount = totalUsersAtStartOfMonth;
        const prevBaseForChurn = (prevTotalActiveCount + prevChurnedCount - prevNewUsersCount) || 1;
        const prevChurnRate = (prevChurnedCount / prevBaseForChurn) * 100;
        const prevMrr = mrr - (newUsersCount * arpu) + (churnedCount * arpu); 
        const prevLtv = prevChurnRate > 0 ? arpu / (prevChurnRate / 100) : (arpu * 24);

        const growthRate = totalActiveCount > 0 ? (netGrowth / totalActiveCount) : 0;
        const proj30 = mrr * (1 + growthRate);
        const proj60 = mrr * Math.pow(1 + growthRate, 2);
        const proj90 = mrr * Math.pow(1 + growthRate, 3);
        
        // Sparklines Generation (10 points max)
        const generateSparkline = (dates, type = 'count') => {
            const points = 10;
            const msStep = (end.getTime() - start.getTime()) / points;
            let result = Array(points).fill(0);
            
            dates.forEach(dateStr => {
                const d = new Date(dateStr).getTime();
                if (d >= start.getTime() && d <= end.getTime()) {
                    let index = Math.floor((d - start.getTime()) / msStep);
                    if (index >= points) index = points - 1;
                    result[index]++;
                }
            });
            return result;
        };

        const sparkNewUsers = generateSparkline(newUsers.map(u => u.createdAt));
        const sparkChurns = generateSparkline(churnedUsers.map(u => u.updatedAt));
        
        // Approximate MRR sparkline (Start MRR + cumulative net growth)
        let currentSparkMrr = prevMrr;
        const sparkMrr = [];
        for(let i=0; i<10; i++) {
            currentSparkMrr += (sparkNewUsers[i] * arpu) - (sparkChurns[i] * arpu);
            sparkMrr.push(Math.max(0, currentSparkMrr));
        }

        const kpis = {
            mrr: { current: mrr, previous: prevMrr },
            churnRate: { current: churnRate, previous: prevChurnRate },
            ltv: { current: ltv, previous: prevLtv },
            arpu: { current: arpu, previous: arpu }, // ARPU is mostly constant for this approximation
            proj30, proj60, proj90
        };

        // Insights Generator
        const insights = [];
        const mrrGrowth = mrr > prevMrr ? ((mrr - prevMrr)/prevMrr*100) : (prevMrr > 0 ? ((mrr - prevMrr)/prevMrr*100) : 0);
        if (mrrGrowth > 0) insights.push({ type: 'positive', text: `Receita MRR cresceu ${mrrGrowth.toFixed(1)}% no período.` });
        else if (mrrGrowth < 0) insights.push({ type: 'negative', text: `Receita MRR retraiu ${Math.abs(mrrGrowth).toFixed(1)}% no período.` });
        
        if (churnRate > 5) insights.push({ type: 'negative', text: `Churn (${churnRate.toFixed(1)}%) está acima da zona saudável (< 5%).` });
        else insights.push({ type: 'positive', text: `Churn controlado e saudável.` });

        if (newUsersCount > churnedCount) insights.push({ type: 'positive', text: `Mais assinantes entraram (${newUsersCount}) do que saíram (${churnedCount}).` });
        else if (churnedCount > newUsersCount) insights.push({ type: 'warning', text: `Alerta: Base de assinantes está encolhendo.` });

        // Invoices 
        let recentInvoices = [];
        if (process.env.ASAAS_API_KEY) {
            try {
                const response = await fetch(`${process.env.ASAAS_API_URL}/payments?limit=30&order=desc`, {
                    headers: { 'access_token': process.env.ASAAS_API_KEY }
                });
                if (response.ok) {
                    const data = await response.json();
                    if (data.data) {
                        const filteredData = data.data.filter(p => p.status !== 'PENDING').slice(0, 8);
                        
                        let overdueCount = 0;
                        recentInvoices = await Promise.all(filteredData.map(async (payment) => {
                            if (payment.status === 'OVERDUE') overdueCount++;
                            let psiName = 'Cliente Externo';
                            let psiId = null;
                            if (payment.externalReference) {
                                const psi = await db.Psychologist.findByPk(payment.externalReference, { attributes: ['id', 'nome'] });
                                if (psi) { psiName = psi.nome; psiId = psi.id; }
                            }
                            
                            let translatedStatus = 'Pendente';
                            if (['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(payment.status)) translatedStatus = 'Paga';
                            else if (payment.status === 'OVERDUE') translatedStatus = 'Atrasada';
                            else if (['REFUNDED', 'CHARGEBACK_REQUESTED'].includes(payment.status)) translatedStatus = 'Cancelada';

                            return {
                                psychologistName: psiName,
                                psiId: psiId,
                                date: payment.paymentDate || payment.dueDate || payment.dateCreated,
                                dueDate: payment.dueDate,
                                amount: payment.value,
                                status: translatedStatus
                            };
                        }));
                        if (overdueCount > 0) insights.push({ type: 'warning', text: `Existem ${overdueCount} faturas recentes atrasadas.` });
                    }
                }
            } catch (err) {}
        }

        let activePlans = activePsychologists.map(psy => {
            const hasSub = !!(psy.stripeSubscriptionId || psy.subscriptionId);
            const planKey = (psy.plano || '').toLowerCase();
            return {
                psychologistName: psy.nome,
                planName: psy.is_exempt ? `${psy.plano} (VIP)` : (!hasSub ? `${psy.plano} (Trial)` : psy.plano),
                mrr: (psy.is_exempt || !hasSub) ? 0 : (planPrices[planKey] || 0),
                nextBilling: psy.is_exempt ? null : (psy.planExpiresAt ? new Date(psy.planExpiresAt) : new Date(new Date(psy.updatedAt).setMonth(new Date(psy.updatedAt).getMonth() + 1))) 
            };
        });
        
        // Sort active plans by nearest nextBilling (to populate upcoming payments table)
        activePlans.sort((a,b) => {
            if(!a.nextBilling) return 1; if(!b.nextBilling) return -1;
            return a.nextBilling.getTime() - b.nextBilling.getTime();
        });

        res.json({ 
            kpis, 
            recentInvoices, 
            activePlans: activePlans.slice(0, 10), // Limit upcoming payments to 10
            sparklines: { newUsers: sparkNewUsers, churns: sparkChurns, mrr: sparkMrr },
            insights,
            planDistribution: activePsychologists.reduce((acc, p) => {
                const pk = p.plano || 'Desconhecido';
                acc[pk] = (acc[pk] || 0) + 1;
                return acc;
            }, {})
        });
    } catch (error) {
        console.error("Erro no relatorio financeiro:", error);
        res.status(500).json({ error: error.message });
    }
};

const db = require('../models');
const { Op } = require('sequelize');

class CashFlowService {
    async buildCashFlowData() {
        try {
            // 1. Busca todos os pagamentos confirmados ou recebidos no banco de dados local
            const localPayments = await db.Payment.findAll({
                where: {
                    status: {
                        [Op.in]: ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH']
                    }
                },
                raw: true
            });

            const mergedPayments = {};
            
            // Insere os pagamentos locais no dicionário
            localPayments.forEach(p => {
                mergedPayments[p.id] = p;
            });

            // 2. Tenta buscar o histórico diretamente do Asaas para preencher pagamentos antigos 
            // (antes da implementação da tabela local)
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
                    if (!mergedPayments[p.id]) {
                        mergedPayments[p.id] = {
                            id: p.id,
                            value: p.value,
                            paymentDate: p.clientPaymentDate || p.confirmedDate || p.paymentDate || p.creditDate || p.dateCreated,
                            dueDate: p.dueDate,
                            status: p.status
                        };
                    }
                });
            } catch (asaasErr) {
                console.error("Aviso: Falha ao buscar histórico do Asaas, usando apenas banco local.", asaasErr);
            }

            const allPayments = Object.values(mergedPayments);

            // Agrupar por mês
            const cashFlowByMonth = {};

            allPayments.forEach(payment => {
                // Prioriza a data de pagamento
                let dateObj = payment.paymentDate || payment.dueDate || payment.createdAt;
                if (!dateObj) return;

                let monthYear = '';
                
                // Se for string no formato YYYY-MM-DD ou ISO, pega os primeiros 7 caracteres diretamente para evitar bug de fuso horário
                if (typeof dateObj === 'string' && dateObj.length >= 7) {
                    monthYear = dateObj.substring(0, 7);
                } else if (dateObj instanceof Date) {
                    // Se for objeto Date, converte para string local (considerando fuso) ou padroniza YYYY-MM
                    const year = dateObj.getFullYear();
                    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                    monthYear = `${year}-${month}`;
                } else {
                    return; // Formato inválido
                }

                if (!cashFlowByMonth[monthYear]) {
                    cashFlowByMonth[monthYear] = {
                        monthYear,
                        grossValue: 0,
                        netValue: 0,
                        count: 0
                    };
                }

                // Converter os valores que podem vir como string do banco
                const grossVal = parseFloat(payment.value) || 0;
                const netVal = grossVal - 1.99; // Estimativa de taxa Asaas

                cashFlowByMonth[monthYear].grossValue += grossVal;
                cashFlowByMonth[monthYear].netValue += netVal > 0 ? netVal : grossVal;
                cashFlowByMonth[monthYear].count += 1;
            });

            // Converter para array e ordenar (mais recente primeiro)
            const result = Object.values(cashFlowByMonth).sort((a, b) => b.monthYear.localeCompare(a.monthYear));

            return result;
        } catch (error) {
            console.error("Erro no buildCashFlowData:", error);
            throw error;
        }
    }
}

module.exports = new CashFlowService();

import re

with open('backend/services/growthService.js', 'r') as f:
    code = f.read()

# Replace attributes of pagantesAtivos to include createdAt
code = code.replace("attributes: ['id', 'valor_mensal_numero', 'plano', 'planExpiresAt', 'cancelAtPeriodEnd']",
                    "attributes: ['id', 'valor_mensal_numero', 'plano', 'planExpiresAt', 'cancelAtPeriodEnd', 'createdAt']")

# Find the loop that calculates pagantesComDemandaCount
old_loop = """        for (const p of pagantesAtivos) {
            if (p.cancelAtPeriodEnd && p.planExpiresAt && new Date(p.planExpiresAt) < now) continue;
            
            let valor = 0;
            if (p.plano === 'ESSENTIAL' || p.plano === 'Essencial') valor = Number(priceEssencial);
            else if (p.plano === 'CLINICAL' || p.plano === 'Clínico') valor = Number(priceClinico);
            else if (p.plano === 'REFERENCE' || p.plano === 'Sol' || p.plano === 'SOL') valor = Number(priceReference);

            if (setPsiComDemanda.has(p.id)) {
                pagantesComDemandaCount++;
                mrrComDemanda += valor;
            } else {
                mrrSemDemanda += valor;
            }
        }"""

new_loop = """        let pagantesSemDemandaCount = 0;

        for (const p of pagantesAtivos) {
            if (p.cancelAtPeriodEnd && p.planExpiresAt && new Date(p.planExpiresAt) < now) continue;
            
            let valor = 0;
            if (p.plano === 'ESSENTIAL' || p.plano === 'Essencial') valor = Number(priceEssencial);
            else if (p.plano === 'CLINICAL' || p.plano === 'Clínico') valor = Number(priceClinico);
            else if (p.plano === 'REFERENCE' || p.plano === 'Sol' || p.plano === 'SOL') valor = Number(priceReference);

            if (setPsiComDemanda.has(p.id)) {
                pagantesComDemandaCount++;
                mrrComDemanda += valor;
            } else {
                // Só considera alerta "sem demanda" se o psicólogo tem mais de 14 dias de plataforma
                const diasDePlataforma = (now - new Date(p.createdAt)) / (1000 * 60 * 60 * 24);
                if (diasDePlataforma >= 14) {
                    pagantesSemDemandaCount++;
                    mrrSemDemanda += valor;
                }
            }
        }"""

code = code.replace(old_loop, new_loop)

# Export the new variable
old_return = """        return {
            mrrTotal,
            totalAtivos,
            novosPagantes,
            churnPagantes,
            taxaChurnPagantes,
            trialsAtivos,
            trialConversionRate,
            pagantesComDemandaCount,
            pctDemanda,
            mrrAdicionado,
            mrrPerdido,
            netNewMrr,
            ltvProjetado,
            mrrSemDemanda
        };"""

new_return = """        return {
            mrrTotal,
            totalAtivos,
            novosPagantes,
            churnPagantes,
            taxaChurnPagantes,
            trialsAtivos,
            trialConversionRate,
            pagantesComDemandaCount,
            pagantesSemDemandaCount,
            pctDemanda,
            mrrAdicionado,
            mrrPerdido,
            netNewMrr,
            ltvProjetado,
            mrrSemDemanda
        };"""

code = code.replace(old_return, new_return)

with open('backend/services/growthService.js', 'w') as f:
    f.write(code)


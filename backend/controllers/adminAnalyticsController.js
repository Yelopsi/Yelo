const db = require('../models');

exports.getQuestionnaireAnalytics = async (req, res) => {
    try {
        const formatObj = (rows) => {
            const obj = {};
            rows.forEach(r => { if (r.label) obj[r.label] = parseInt(r.value, 10); });
            return obj;
        };

        const [totalPatients] = await db.sequelize.query(`SELECT COUNT(*) as count FROM "DemandSearches"`);
        const getPatientStat = async (key) => {
            const [rows] = await db.sequelize.query(`SELECT "searchParams"->>'${key}' as label, COUNT(*) as value FROM "DemandSearches" WHERE "searchParams"->>'${key}' IS NOT NULL GROUP BY 1 ORDER BY value DESC LIMIT 10`);
            return formatObj(rows);
        };
        const patientAnalytics = {
            total: parseInt(totalPatients[0]?.count || 0, 10),
            idade: await getPatientStat('faixa_etaria'),
            identidade_genero: await getPatientStat('genero'),
            pref_genero_prof: await getPatientStat('preferencia_genero'),
            motivacao: await getPatientStat('motivo'),
            temas: await getPatientStat('temas'),
            terapia_anterior: await getPatientStat('terapia_anterior'),
            experiencia_desejada: await getPatientStat('experiencia_desejada'),
            caracteristicas_prof: await getPatientStat('caracteristicas'),
            faixa_valor: await getPatientStat('valor'),
            modalidade_atendimento: await getPatientStat('modalidade')
        };

        const [totalPsis] = await db.sequelize.query(`SELECT COUNT(*) as count FROM "Psychologists"`);
        const getPsiStat = async (col) => {
            try {
                const [rows] = await db.sequelize.query(`SELECT "${col}"::text as label, COUNT(*) as value FROM "Psychologists" WHERE "${col}" IS NOT NULL GROUP BY 1 ORDER BY value DESC LIMIT 10`);
                return formatObj(rows);
            } catch (e) { return {}; }
        };
        const psiAnalytics = {
            total: parseInt(totalPsis[0]?.count || 0, 10),
            modalidade: await getPsiStat('modalidade'),
            genero_identidade: await getPsiStat('genero_identidade'),
            valor_sessao_faixa: {},
            temas_atuacao: await getPsiStat('temas_atuacao'),
            abordagens_tecnicas: await getPsiStat('abordagens_tecnicas'),
            praticas_vivencias: await getPsiStat('praticas_inclusivas')
        };

        const [total30d] = await db.sequelize.query(`SELECT COUNT(*) as count FROM "DemandSearches" WHERE "createdAt" >= NOW() - INTERVAL '30 days'`);
        const total30 = parseInt(total30d[0]?.count || 0, 10);
        const getTopStat30d = async (key) => {
            if (total30 === 0) return null;
            const [rows] = await db.sequelize.query(`SELECT "searchParams"->>'${key}' as label, COUNT(*) as value FROM "DemandSearches" WHERE "createdAt" >= NOW() - INTERVAL '30 days' AND "searchParams"->>'${key}' IS NOT NULL GROUP BY 1 ORDER BY value DESC LIMIT 1`);
            if (rows.length > 0) return { label: rows[0].label, percentage: Math.round((parseInt(rows[0].value, 10) / total30) * 100) };
            return null;
        };
        const summary30d = {
            total: total30,
            stats: {
                idade: await getTopStat30d('faixa_etaria'),
                identidade_genero: await getTopStat30d('genero'),
                pref_genero_prof: await getTopStat30d('preferencia_genero'),
                motivacao: await getTopStat30d('motivo'),
                temas: await getTopStat30d('temas'),
                terapia_anterior: await getTopStat30d('terapia_anterior'),
                experiencia_desejada: await getTopStat30d('experiencia_desejada'),
                caracteristicas_prof: await getTopStat30d('caracteristicas'),
                faixa_valor: await getTopStat30d('valor'),
                modalidade_atendimento: await getTopStat30d('modalidade')
            }
        };

        res.json({ patientAnalytics, psiAnalytics, summary30d });
    } catch (error) { console.error("Erro em questionnaire-analytics:", error); res.json({ patientAnalytics: { total: 0, idade: {} }, psiAnalytics: { total: 0, modalidade: {} }, summary30d: { total: 0, stats: {} } }); }
};

exports.getPwaStats = async (req, res) => {
    try {
        const [totalResult] = await db.sequelize.query(`SELECT COUNT(*) as count FROM "PwaInstallLogs"`);
        const [byPlatform] = await db.sequelize.query(`SELECT platform, COUNT(*) as count FROM "PwaInstallLogs" GROUP BY platform`);
        res.json({ total: parseInt(totalResult[0]?.count || 0, 10), byPlatform });
    } catch (error) { res.json({ total: 0, byPlatform: [] }); }
};

exports.getRemarketingStatus = async (req, res) => {
    try {
        const pendingPsis = await db.Psychologist.findAll({ where: { status: { [db.Sequelize.Op.ne]: 'active' }, is_exempt: { [db.Sequelize.Op.not]: true } }, attributes: ['id', 'nome', 'email', 'createdAt', 'whatsapp_clicks'] });
        const now = new Date(); const funnel = { passo1_hoje: [], passo2_hoje: [], passo3_hoje: [], passo4_hoje: [], aguardando_proxima_janela: [] };
        pendingPsis.forEach(p => {
            const hoursSince = (now - new Date(p.createdAt)) / (1000 * 60 * 60);
            const psiData = { id: p.id, nome: p.nome, email: p.email, horas_desde_cadastro: Math.round(hoursSince), cliques: p.whatsapp_clicks || 0 };
            if (hoursSince >= 24 && hoursSince <= 48) funnel.passo1_hoje.push(psiData);
            else if (hoursSince >= 72 && hoursSince <= 96) funnel.passo2_hoje.push(psiData);
            else if (hoursSince >= 168 && hoursSince <= 192) funnel.passo3_hoje.push(psiData);
            else if (hoursSince >= 336 && hoursSince <= 360 && psiData.cliques > 0) funnel.passo4_hoje.push(psiData);
            else funnel.aguardando_proxima_janela.push(psiData);
        });
        res.json({ resumo_envios_de_hoje: { total_cadastros_inativos: pendingPsis.length, recebem_passo_1_hoje: funnel.passo1_hoje.length, recebem_passo_2_hoje: funnel.passo2_hoje.length, recebem_passo_3_hoje: funnel.passo3_hoje.length, recebem_passo_4_hoje: funnel.passo4_hoje.length }, detalhes: funnel });
    } catch (error) { res.status(500).json({ error: "Erro ao gerar relatório" }); }
};
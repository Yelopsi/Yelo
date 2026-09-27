const fs = require('fs');
let code = fs.readFileSync('backend/routes/cmoRoutes.js', 'utf8');

// 1. Calculate prevGlobalChurned
let target1 = `        const [globalChurnRes] = await sequelize.query(globalChurnQuery, {
            replacements: { dateStart, dateEnd: dateEnd + ' 23:59:59' }, type: sequelize.QueryTypes.SELECT
        });
        const globalChurned = parseInt(globalChurnRes.churned || 0);`;

let replacement1 = `        const [globalChurnRes] = await sequelize.query(globalChurnQuery, {
            replacements: { dateStart, dateEnd: dateEnd + ' 23:59:59' }, type: sequelize.QueryTypes.SELECT
        });
        const globalChurned = parseInt(globalChurnRes.churned || 0);
        
        const [prevGlobalChurnRes] = await sequelize.query(globalChurnQuery, {
            replacements: { dateStart: prevDateStart, dateEnd: prevDateEnd + ' 23:59:59' }, type: sequelize.QueryTypes.SELECT
        });
        const prevGlobalChurned = parseInt(prevGlobalChurnRes.churned || 0);`;

code = code.replace(target1, replacement1);

// 2. Calculate prev churn rates and add them to prevPlatform
let target2 = `        const metaChurnRate = metaPagantes > 0 ? (metaChurned / (metaPagantes + metaChurned)) : 0.05;`;

let replacement2 = `        const prevMetaChurned = parseInt(prevMetaMetricsRes.churned || 0);
        const metaChurnRate = metaPagantes > 0 ? (metaChurned / (metaPagantes + metaChurned)) : 0.05;
        const prevMetaChurnRate = prevMetaPagantes > 0 ? (prevMetaChurned / (prevMetaPagantes + prevMetaChurned)) : 0.05;
        const prevGlobalChurnRate = (totalActive + prevGlobalChurned) > 0 ? (prevGlobalChurned / (totalActive + prevGlobalChurned)) : 0;`;

code = code.replace(target2, replacement2);

// 3. Add to prevPlatform output
let target3 = `            prevPlatform: {
                b2b: { active: prevMetaPagantes, trials: prevMetaTrials },
                b2c: { wpp_clicks: prevGoogleWppClicks, total_deals: prevGoogleDeals }
            },`;

let replacement3 = `            prevPlatform: {
                b2b: { active: prevMetaPagantes, trials: prevMetaTrials, meta_churn_rate: prevMetaChurnRate, global_churn_rate: prevGlobalChurnRate },
                b2c: { wpp_clicks: prevGoogleWppClicks, total_deals: prevGoogleDeals }
            },`;

code = code.replace(target3, replacement3);

// 4. Calculate prevPaybackMonths
let target4 = `        const metaPaybackMonths = metaCac > 0 ? (metaCac / arpu) : 0;`;

let replacement4 = `        const metaPaybackMonths = metaCac > 0 ? (metaCac / arpu) : 0;
        const prevMetaPaybackMonths = prevMetaCac > 0 ? (prevMetaCac / arpu) : 0;`;

code = code.replace(target4, replacement4);

// 5. Output prevDecisionEngineMeta
let target5 = `            decisionEngineMeta,`;

let replacement5 = `            decisionEngineMeta,
            prevDecisionEngineMeta: { paybackMonths: prevMetaPaybackMonths },`;

code = code.replace(target5, replacement5);

fs.writeFileSync('backend/routes/cmoRoutes.js', code);
console.log('Patched cmoRoutes.js');

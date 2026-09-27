const fs = require('fs');
let code = fs.readFileSync('admin/admin_cmo_metrics.js', 'utf8');

// Change text
code = code.replace(
    `<span style="color: #64748b; font-size: 0.75rem;">Histórico: <strong style="color: #1e293b; font-size: 1.05rem;">\${histVal}</strong></span>`,
    `<span style="color: #64748b; font-size: 0.75rem;">Período Anterior: <strong style="color: #1e293b; font-size: 1.05rem;">\${histVal}</strong></span>`
);

// Replace the setDbgHist block
let targetBlock = `        setDbgHist('dbg-meta-spend',    data.historical?.meta?.spend || 0, data.ads?.meta?.spend || 0, 'currency', true);
        setDbgHist('dbg-meta-trials',   data.historical?.platform?.b2b?.trials || 0, data.platform.b2b?.trials || 0, 'number', false);
        setDbgHist('dbg-meta-pagantes', data.historical?.platform?.b2b?.active || 0, data.platform.b2b?.active || 0, 'number', false);
        setDbgHist('dbg-meta-cac',      data.historical?.meta?.cac || 0, data.ads?.meta?.cac || 0, 'currency', true);
        setDbgHist('dbg-meta-payback',  data.historical?.meta?.paybackMonths || 0, data.decisionEngineMeta?.paybackMonths || 0, 'months', true);
        
        setDbgHist('dbg-meta-churn',    data.historical?.meta?.churn_rate || 0, data.platform.b2b?.meta_churn_rate || 0, 'percent', true);
        setDbgHist('dbg-global-churn',  data.historical?.platform?.b2b?.global_churn_rate || 0, data.platform.b2b?.global_churn_rate || 0, 'percent', true);
        
        setDbgHist('dbg-google-spend',  data.historical?.google?.spend || 0, data.ads?.google?.spend || 0, 'currency', true);
        setDbgHist('dbg-google-clicks', data.historical?.platform?.b2c?.wpp_clicks || 0, data.platform.b2c?.wpp_clicks || 0, 'number', false);
        setDbgHist('dbg-google-deals',  data.historical?.platform?.b2c?.total_deals || 0, data.platform.b2c?.total_deals || 0, 'number', false);
        setDbgHist('dbg-google-cpl',    data.historical?.google?.cpl || 0, data.ads?.google?.cpl || 0, 'currency', true);`;

let replacementBlock = `        setDbgHist('dbg-meta-spend',    data.prevAds?.meta?.spend || 0, data.ads?.meta?.spend || 0, 'currency', true);
        setDbgHist('dbg-meta-trials',   data.prevPlatform?.b2b?.trials || 0, data.platform.b2b?.trials || 0, 'number', false);
        setDbgHist('dbg-meta-pagantes', data.prevPlatform?.b2b?.active || 0, data.platform.b2b?.active || 0, 'number', false);
        setDbgHist('dbg-meta-cac',      data.prevAds?.meta?.cac || 0, data.ads?.meta?.cac || 0, 'currency', true);
        setDbgHist('dbg-meta-payback',  data.prevDecisionEngineMeta?.paybackMonths || 0, data.decisionEngineMeta?.paybackMonths || 0, 'months', true);
        
        setDbgHist('dbg-meta-churn',    data.prevPlatform?.b2b?.meta_churn_rate || 0, data.platform.b2b?.meta_churn_rate || 0, 'percent', true);
        setDbgHist('dbg-global-churn',  data.prevPlatform?.b2b?.global_churn_rate || 0, data.platform.b2b?.global_churn_rate || 0, 'percent', true);
        
        setDbgHist('dbg-google-spend',  data.prevAds?.google?.spend || 0, data.ads?.google?.spend || 0, 'currency', true);
        setDbgHist('dbg-google-clicks', data.prevPlatform?.b2c?.wpp_clicks || 0, data.platform.b2c?.wpp_clicks || 0, 'number', false);
        setDbgHist('dbg-google-deals',  data.prevPlatform?.b2c?.total_deals || 0, data.platform.b2c?.total_deals || 0, 'number', false);
        setDbgHist('dbg-google-cpl',    data.prevAds?.google?.cpl || 0, data.ads?.google?.cpl || 0, 'currency', true);`;

code = code.replace(targetBlock, replacementBlock);
fs.writeFileSync('admin/admin_cmo_metrics.js', code);
console.log('Patched admin_cmo_metrics.js');

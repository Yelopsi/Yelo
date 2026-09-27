const fs = require('fs');
let code = fs.readFileSync('admin/admin_cmo_metrics.js', 'utf8');

const targetStr = `        // Eficiência Comercial B2C KPIs
        if (data.efficiency) {
            document.getElementById('cmo-global-effort').textContent = data.efficiency.globalEffort || 'N/A';
            document.getElementById('cmo-channel-efficiency').textContent = \`Ads: \${data.efficiency.adsEffort || 'N/A'} | Org: \${data.efficiency.orgEffort || 'N/A'}\`;
            document.getElementById('cmo-top-ticket').textContent = (data.efficiency.topTicket === 'N/A' || !data.efficiency.topTicket) ? 'N/A' : \`R$ \${data.efficiency.topTicket}\`;
            if (data.efficiency.ttfcData) {
                document.getElementById('cmo-ttfc-median').textContent = data.efficiency.ttfcData.median !== 'N/A' ? \`\${data.efficiency.ttfcData.median} d\` : 'N/A';
                document.getElementById('cmo-ttfc-sub').textContent = \`Média: \${data.efficiency.ttfcData.mean} dias · amostra: \${data.efficiency.ttfcData.sample} profissionais\`;
            }
            if (data.efficiency.ttvData) {
                document.getElementById('cmo-ttv-median').textContent = data.efficiency.ttvData.median !== 'N/A' ? \`\${data.efficiency.ttvData.median} d\` : 'N/A';
                document.getElementById('cmo-ttv-sub').textContent = \`Média: \${data.efficiency.ttvData.mean} dias · amostra: \${data.efficiency.ttvData.sample} profissionais (PROXY)\`;
            }
        }`;

const replacement = `        // Eficiência Comercial B2C KPIs
        if (data.efficiency) {
            const parseFloatOrNA = (val) => val === 'N/A' || !val ? 'N/A' : parseFloat(val);
            
            const currGlobal = parseFloatOrNA(data.efficiency.globalEffort);
            const prevGlobal = parseFloatOrNA(data.prevEfficiency?.globalEffort);
            setKpiValueAndTrend('cmo-global-effort', currGlobal, prevGlobal, true, 'decimal');

            const topTicketStr = data.efficiency.topTicket === 'N/A' || !data.efficiency.topTicket ? 'N/A' : \`R$ \${data.efficiency.topTicket}\`;
            const prevTopTicketStr = data.prevEfficiency?.topTicket === 'N/A' || !data.prevEfficiency?.topTicket ? 'N/A' : \`R$ \${data.prevEfficiency?.topTicket}\`;
            // For top ticket, it's currency and higher is better.
            const currTopTicket = data.efficiency.topTicket === 'N/A' || !data.efficiency.topTicket ? 'N/A' : parseFloat(data.efficiency.topTicket);
            const prevTopTicket = data.prevEfficiency?.topTicket === 'N/A' || !data.prevEfficiency?.topTicket ? 'N/A' : parseFloat(data.prevEfficiency.topTicket);
            setKpiValueAndTrend('cmo-top-ticket', currTopTicket, prevTopTicket, false, 'currency');

            if (data.efficiency.ttfcData) {
                const currTtfc = parseFloatOrNA(data.efficiency.ttfcData.median);
                const prevTtfc = parseFloatOrNA(data.prevEfficiency?.ttfcData?.median);
                setKpiValueAndTrend('cmo-ttfc-median', currTtfc, prevTtfc, true, 'days');
                document.getElementById('cmo-ttfc-sub').textContent = \`Média: \${data.efficiency.ttfcData.mean} dias · amostra: \${data.efficiency.ttfcData.sample} profissionais\`;
            }
            if (data.efficiency.ttvData) {
                const currTtv = parseFloatOrNA(data.efficiency.ttvData.median);
                const prevTtv = parseFloatOrNA(data.prevEfficiency?.ttvData?.median);
                setKpiValueAndTrend('cmo-ttv-median', currTtv, prevTtv, true, 'days');
                document.getElementById('cmo-ttv-sub').textContent = \`Média: \${data.efficiency.ttvData.mean} dias · amostra: \${data.efficiency.ttvData.sample} profissionais (PROXY)\`;
            }
            
            // Channel Efficiency (Ads / Org)
            const elCh = document.getElementById('cmo-channel-efficiency');
            if (elCh) {
                const currAds = parseFloatOrNA(data.efficiency.adsEffort);
                const prevAds = parseFloatOrNA(data.prevEfficiency?.adsEffort);
                const currOrg = parseFloatOrNA(data.efficiency.orgEffort);
                const prevOrg = parseFloatOrNA(data.prevEfficiency?.orgEffort);
                
                const calcPct = (c, p) => {
                    if (typeof c === 'number' && typeof p === 'number') {
                        if (p > 0) return ((c - p) / p) * 100;
                        if (c > 0) return 100;
                    }
                    return null;
                };
                
                const getArrow = (pct) => {
                    if (pct === null) return '';
                    if (pct > 0) return \` <span style="color:#ef4444;font-size:0.85rem">↑\${Math.abs(pct).toFixed(1)}%</span>\`;
                    if (pct < 0) return \` <span style="color:#10b981;font-size:0.85rem">↓\${Math.abs(pct).toFixed(1)}%</span>\`;
                    return \` <span style="color:#64748b;font-size:0.85rem">−0%</span>\`;
                };

                const strAds = currAds !== 'N/A' ? currAds.toFixed(1) : 'N/A';
                const strOrg = currOrg !== 'N/A' ? currOrg.toFixed(1) : 'N/A';
                elCh.innerHTML = \`Ads: \${strAds}\${getArrow(calcPct(currAds, prevAds))} | Org: \${strOrg}\${getArrow(calcPct(currOrg, prevOrg))}\`;
            }
        }`;

const startIdx = code.indexOf(targetStr);
if (startIdx === -1) {
    console.error("Target string not found!");
    process.exit(1);
}

code = code.substring(0, startIdx) + replacement + code.substring(startIdx + targetStr.length);
fs.writeFileSync('admin/admin_cmo_metrics.js', code);
console.log('Patched JS successfully!');

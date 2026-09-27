const fs = require('fs');
const path = '/Users/andehrson/SITES/Yelo/admin/admin_cmo_metrics.js';
let content = fs.readFileSync(path, 'utf8');

const warningElHtml = `const warningEl = document.getElementById('sim-res-warning');
        warningEl.style.display = 'block';

        if (!isSimulationPossible) {
            warningEl.style.backgroundColor = '#fef2f2';
            warningEl.style.color = '#991b1b';
            warningEl.innerHTML = \`⚠️ <b>Atenção:</b> O simulador requer dados reais de CAC, Trial e Churn para projetar. Os dados históricos atuais não são qualificados matematicamente (PROXY/UNKNOWN). O Motor está pausado até termos dados observados da coorte.\`;
            
            // Zerar os resultados do card
            document.getElementById('sim-res-mrr-12m').textContent = formatBRL(0);
            document.getElementById('sim-res-subs-12m').textContent = '0';
            document.getElementById('sim-res-meta-budget-12m').textContent = formatBRL(0);
            document.getElementById('sim-res-google-budget-12m').textContent = formatBRL(0);
            
            return;
        }

        if (metaBudgetAt12 <= 0) {`;

content = content.replace(/const warningEl = document\.getElementById\('sim-res-warning'\);\s*warningEl\.style\.display = 'block';\s*if \(metaBudgetAt12 <= 0\) \{/g, warningElHtml);

fs.writeFileSync(path, content);
console.log('Fixed loop');

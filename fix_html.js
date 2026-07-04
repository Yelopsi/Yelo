const fs = require('fs');

const oldHtml = fs.readFileSync('tmp_old_html.html', 'utf-8');
let newHtml = fs.readFileSync('admin/admin_crm_analytics.html', 'utf-8');

// Extrair a div tab-desempenho do HTML antigo
const startTab = oldHtml.indexOf('<div id="tab-desempenho" class="analytics-tab-content">');
const endTab = oldHtml.indexOf('<!-- ABA 2: FINANCEIRO', startTab);
let tabContent = '';
if (startTab > -1 && endTab > -1) {
    tabContent = oldHtml.substring(startTab, endTab).trim();
}

// Substituir a div tab-desempenho mockada no HTML novo
const newStart = newHtml.indexOf('<div id="tab-desempenho"');
const newEnd = newHtml.indexOf('<!-- ABA 2: FINANCEIRO', newStart);

if (newStart > -1 && newEnd > -1 && tabContent) {
    newHtml = newHtml.substring(0, newStart) + tabContent + '\n\n    ' + newHtml.substring(newEnd);
}

// Corrigir o Header para ficar verde
newHtml = newHtml.replace('.saas-header { display: flex;', '.saas-header { display: flex; background: linear-gradient(135deg, #1B4332 0%, #0f2b20 100%); border-radius: 16px; margin: 20px 40px; color: white;');
newHtml = newHtml.replace('.saas-header h1 { font-size: 1.5rem; font-weight: 700; color: var(--saas-text);', '.saas-header h1 { font-size: 1.5rem; font-weight: 700; color: white;');
newHtml = newHtml.replace('.saas-header p { font-size: 0.9rem; color: var(--saas-muted);', '.saas-header p { font-size: 0.9rem; color: rgba(255,255,255,0.8);');
newHtml = newHtml.replace('.last-updated { font-size: 0.8rem; color: var(--saas-muted); }', '.last-updated { font-size: 0.8rem; color: rgba(255,255,255,0.8); }');

// E vou ocultar o tab-desempenho por padrão (adicionar display: none)
newHtml = newHtml.replace('<div id="tab-desempenho" class="analytics-tab-content">', '<div id="tab-desempenho" class="analytics-tab-content" style="display: none;">');

fs.writeFileSync('admin/admin_crm_analytics.html', newHtml);
console.log('HTML corrigido!');

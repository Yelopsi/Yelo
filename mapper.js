const fs = require('fs');
const path = require('path');

const adminDir = path.join(__dirname, 'admin');
const files = fs.readdirSync(adminDir);

const htmlFiles = files.filter(f => f.endsWith('.html'));
const jsFiles = files.filter(f => f.endsWith('.js'));
const cssFiles = files.filter(f => f.endsWith('.css'));

let markdown = `# Mapeamento Técnico do Dashboard Admin

## 1. Arquitetura atual

- **Ponto de entrada:** \`admin.html\` e \`admin.js\`
- **Tipo de Arquitetura:** SPA Híbrida (Single Page Application simulada). As páginas são injetadas no \`#main-content\` do \`admin.html\` via a função \`loadPage(url)\` definida no \`admin.js\`. O JavaScript de cada página injetada é carregado dinamicamente criando um elemento \`<script>\` e anexado ao body.
- **Navegação:** Controlada por menus laterais e bottom nav. A URL não muda (SPA hash-based ou memory-based, gerida via \`data-page\` e \`sessionStorage\`).
- **Hubs/Containers:** A arquitetura categoriza as telas em grandes "Hubs" (ex: CRM Hub, Conteúdo Hub, Dados Hub, Ajustes). Apenas os Hubs principais aparecem no menu principal, e as subpáginas são acessadas através de menus/cards dentro desses hubs.

## 2. Mapa completo de navegação e 3. Inventário de páginas

`;

const pages = [];

for (const htmlFile of htmlFiles) {
    if (htmlFile === 'login.html' || htmlFile === 'mensagens.html') continue; // Not admin dashboard pages

    const jsFile = htmlFile.replace('.html', '.js');
    const hasJs = jsFiles.includes(jsFile);
    
    const contentHtml = fs.readFileSync(path.join(adminDir, htmlFile), 'utf-8');
    const contentJs = hasJs ? fs.readFileSync(path.join(adminDir, jsFile), 'utf-8') : '';

    // Extract metrics/KPIs roughly
    const kpis = [];
    const kpiMatches = contentHtml.matchAll(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi);
    for (const match of kpiMatches) {
        let text = match[1].replace(/<[^>]+>/g, '').trim();
        if (text && text.length < 30 && !text.includes('Yelo')) {
            // kpis.push(text);
        }
    }

    // Extract APIs
    const apis = new Set();
    const fetchMatches = contentJs.matchAll(/fetch\s*\(\s*[`'"]([^`'"]+)[`'"]/gi);
    for (const match of fetchMatches) {
        apis.add(match[1].replace('${API_BASE_URL}', ''));
    }

    pages.push({
        name: htmlFile,
        js: hasJs ? jsFile : null,
        apis: Array.from(apis)
    });
}

markdown += "### Lista de Páginas Identificadas\n\n";
for (const p of pages) {
    markdown += `- **${p.name}**\n`;
    if (p.js) markdown += `  - JS Relacionado: ${p.js}\n`;
    if (p.apis.length > 0) markdown += `  - APIs Usadas: ${p.apis.join(', ')}\n`;
}

markdown += `\n\n## 4. Inventário de APIs (Resumo)

`;

const allApis = new Set();
pages.forEach(p => p.apis.forEach(api => allApis.add(api)));
allApis.forEach(api => {
    markdown += `- \`${api}\`\n`;
});

// Write to a temporary markdown file to avoid token limits in the script itself
fs.writeFileSync(path.join(__dirname, 'admin_mapper_temp.md'), markdown);
console.log("Mapping basic structure saved to admin_mapper_temp.md");

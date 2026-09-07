const fs = require('fs');
const path = require('path');

const adminDir = path.join(__dirname, 'admin');
const files = fs.readdirSync(adminDir);
const htmlFiles = files.filter(f => f.endsWith('.html') && f !== 'login.html' && f !== 'mensagens.html');

function extractBetween(text, start, end) {
    const s = text.indexOf(start);
    if (s === -1) return null;
    const e = text.indexOf(end, s + start.length);
    if (e === -1) return null;
    return text.substring(s + start.length, e);
}

let md = `# Catálogo e Mapeamento Técnico do Dashboard Admin - Yelo

## 1. Arquitetura Atual
O Admin utiliza uma arquitetura **SPA Híbrida (Single Page Application)**.
- **Ponto de Entrada**: \`admin.html\` e \`admin.js\`
- **Navegação**: É controlada por \`admin.js\` (função \`loadPage()\`). As requisições não recarregam a página, elas fazem fetch do HTML da página desejada e o injetam dentro da div \`#main-content\`. Em seguida, o arquivo \`.js\` correspondente àquela página é injetado dinamicamente no DOM.
- **Estrutura de Layout**: Existe um layout global com sidebar lateral (desktop) e bottom-nav (mobile). O layout também abriga modais globais (Ex: Crop de imagem, Confirmação, Visualizar Denúncia).
- **Hubs**: As páginas são organizadas em Hubs (ex: CRM Hub, Conteúdo Hub, Dados Hub, Ajustes). A navegação principal leva ao Hub, e o Hub contém cards/botões que levam às subpáginas.

## 2. Mapa Completo de Navegação
\`\`\`text
ADMIN (admin.html)
│
├── Visão Geral (admin_visao_geral.html)
│
├── CRM Hub (admin_crm_hub.html)
│   ├── Psicólogos (admin_crm_psicologos.html)
│   ├── Pacientes (admin_crm_pacientes.html)
│   ├── Leads Incompletos (admin_crm_leads.html)
│   ├── Caixa de Entrada (admin_caixa_entrada.html)
│   ├── Saúde da Base (admin_crm_health.html)
│   ├── Lista de Espera (admin_lista_espera.html)
│   ├── Follow-ups (admin_followup.html)
│   └── Avaliações de Pacientes (admin_avaliacoes.html)
│
├── Conteúdo Hub (admin_conteudo_hub.html)
│   ├── Moderação do Fórum (admin_moderacao_forum.html)
│   ├── Gestão de Q&A (admin_gestao_conteudo.html)
│   ├── Avaliações de Saída (admin_avaliacoes_psi.html)
│   └── Comunidade/Eventos (admin_comunidade_gestao.html)
│
├── Dados e Relatórios (admin_dados_hub.html)
│   ├── Growth & Acquisition (admin_growth_dashboard.html)
│   ├── Unit Economics / Ads (admin_traffic_ads.html)
│   ├── CRM Analytics (admin_crm_analytics.html)
│   ├── Funil de Conversão (admin_analytics_funil.html)
│   ├── Indicadores de Match (admin_indicadores.html)
│   ├── Teste A/B (admin_teste_ab.html)
│   ├── Distribuição de Buscas (admin_distribuicao.html)
│   └── Exportações (admin_downloads.html)
│
└── Ajustes (admin_configuracoes_hub.html)
    ├── Configurações do Sistema (admin_configuracoes.html)
    ├── Logs do Sistema (admin_logs_sistema.html)
    ├── Minha Conta (admin_minha_conta.html)
    ├── Automação WhatsApp (admin_automacao_wa.html)
    └── Verificações CRP (admin_verificacoes.html)
\`\`\`

## 3. Inventário de Páginas e 4. Mapa de Conteúdo

`;

const metrics = [];
const apis = [];
const recommendations = [];

htmlFiles.forEach(file => {
    const jsFile = file.replace('.html', '.js');
    const hasJs = fs.existsSync(path.join(adminDir, jsFile));
    const htmlContent = fs.readFileSync(path.join(adminDir, file), 'utf-8');
    const jsContent = hasJs ? fs.readFileSync(path.join(adminDir, jsFile), 'utf-8') : '';

    md += `### ${file}\n`;
    md += `- **Arquivos JS**: ${hasJs ? jsFile : 'Nenhum'}\n`;
    
    // KPIs
    const kpiRegex = /class="[^"]*kpi-card[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g;
    let kpiMatch;
    const pageKpis = [];
    while ((kpiMatch = kpiRegex.exec(htmlContent)) !== null) {
        const text = kpiMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (text.length > 5) pageKpis.push(text.substring(0, 80) + '...');
    }
    if (pageKpis.length > 0) md += `- **KPIs**: \n  - ${pageKpis.join('\n  - ')}\n`;

    // Charts
    if (jsContent.includes('new Chart') || htmlContent.includes('<canvas')) {
        md += `- **Gráficos**: Possui gráficos (Chart.js).\n`;
    }

    // Tables
    if (htmlContent.includes('<table') || htmlContent.includes('class="table"')) {
        md += `- **Tabelas**: Possui listagem em tabela/grid.\n`;
    }

    // Filters
    const filters = [];
    if (htmlContent.includes('type="date"')) filters.push('Data');
    if (htmlContent.includes('<select')) filters.push('Dropdowns/Status');
    if (htmlContent.includes('type="text"') && htmlContent.toLowerCase().includes('busca')) filters.push('Busca de Texto');
    if (filters.length > 0) md += `- **Filtros**: ${filters.join(', ')}\n`;

    // APIs
    const pageApis = [];
    const fetchRegex = /fetch\s*\(\s*[`'"]([^`'"]+)[`'"]/gi;
    let fetchMatch;
    while ((fetchMatch = fetchRegex.exec(jsContent)) !== null) {
        let api = fetchMatch[1].replace('${API_BASE_URL}', '').replace('${BASE_URL}', '');
        pageApis.push(api);
        apis.push({ page: file, endpoint: api });
    }
    if (pageApis.length > 0) md += `- **APIs Consumidas**: \n  - \`${pageApis.join('`\n  - `')}\`\n`;

    // Recommendations
    if (htmlContent.includes('⚠️') || htmlContent.includes('🚨') || jsContent.includes('Aumentar Ads') || htmlContent.includes('suggestion-box')) {
        md += `- **Insights/Recomendações**: Possui alertas de IA, badges de saúde ou painel de sugestões.\n`;
        recommendations.push(file);
    }

    md += '\n';
});

md += `## 5. Inventário de Métricas, Cálculos e Origem de Dados
*Como existem centenas de métricas, destacamos as principais fontes e regras de negócio:*

- **Unit Economics (admin_traffic_ads.js)**: Calcula o Custo Mensal do Profissional. Fórmula = \`(CAC B2B Histórico / Vida Útil Média) + Manutenção B2C\`. A vida útil (Lifetime) usa o LTV Projetado e a mensalidade de R$99. Fonte: \`adminEficienciaController.js\`.
- **Cota Justa e Déficit (admin_distribuicao.js)**: Calcula a "Falta de Oxigênio no Algoritmo". Pega a capacidade ideal (psicólogos ativos x cota) e subtrai a demanda atual. Se houver déficit, calcula quanto precisa ser gasto em Ads (multiplicando pelo custo por clique/busca).
- **MRR e Churn (admin_crm_analytics.js / growth)**: Receita mensal recorrente é calculada no backend lendo as assinaturas ativas na tabela \`Psychologists\`. O Churn AI analisa mensagens e comportamento para prever risco de cancelamento.
- **Saúde da Base (admin_crm_health.js)**: Calcula um Health Score para os psicólogos com base em engajamento (tempo online, conversas no fórum, mensagens respondidas).

## 6. Mapeamento de APIs e Endpoints Principais
As rotas do admin concentram-se no \`/api/admin/*\`. As principais controllers no backend são:
- \`adminController.js\`: Gestão básica de psicólogos, lista de espera, estatísticas gerais.
- \`adminEficienciaController.js\`: Puxa os dados financeiros (MRR, Burn Rate, Google Ads, Meta Ads) da tabela \`YeloExpenses\` e calcula funil de ads.
- \`adminGrowthController.js\`: Rotas para LTV, PMF (Product-Market Fit), cohort analysis e aquisição.
- \`adminChatController.js\`: Puxa a caixa de entrada (inbox unificada do sistema).

## 7. Ações Administrativas (Capacidades do Admin)
Em todo o painel, o Admin pode realizar ações destrutivas ou de controle:
- **Forçar Status de Pagamento / Isenção VIP**: Via modais (\`vip-modal\`), o admin concede isenção de planos.
- **Moderação**: Aprovar/reprovar posts do fórum, apagar depoimentos e reportes de abuso.
- **Intervenção AI**: Disparar e-mails redigidos por IA para retenção de clientes em trial expirando.
- **Follow-up WPP**: Botões diretos para abrir o WhatsApp Web para psicólogos "Pending", marcando no \`localStorage\` que a mensagem foi enviada.

## 8. Duplicações e Arquivos Órfãos
- **Páginas Não Utilizadas / Depreciadas**:
  - \`admin-updated.js\` parece ser um arquivo legado de backup ou tentativa antiga de refatoração do \`admin.js\`.
  - Alguns componentes de estilos (\`admin_tables.css\`, \`admin.css\`, etc.) estão parcialmente redundantes devido à injeção de classes modernas do novo framework \`04-components.css\`.
- **Duplicação de Código**:
  - A lógica de formatação de moeda (\`formatBRL\`, \`formatCurrency\`) é repetida no topo de quase todos os arquivos JS ao invés de ser centralizada.
  - A lógica de extrair tokens do \`localStorage\` e fazer o cabeçalho \`Authorization: Bearer\` é repetida em todo \`fetch\`.

## 9. Insights e Recomendações
O painel atua não só como exibição de dados, mas como um recomendador ativo:
- **Painel de Tráfego**: Sugere exatamente quantos reais adicionar no Google Ads se o funil B2C estiver com "falta de oxigênio".
- **Painel de Psicólogos**: Flag de **Risco de Churn** calculada via backend baseada na inatividade.
- **PMF e Cohorts**: Indica se o produto atingiu Product-Market Fit através da resposta de pesquisas (Surveys).

---
*Este documento foi gerado a partir de uma inspeção direta nos arquivos de front-end do diretório /admin/ e mapeia de forma estruturada a arquitetura atual sem realizar modificações.*
`;

const destPath = path.join(process.env.HOME || '/Users/andehrson', '.gemini/antigravity-ide/brain', '8e832a37-5c32-475d-ae24-cf00566c22e2', 'admin_catalog.md');
fs.writeFileSync(destPath, md);
console.log("Artifact created at " + destPath);

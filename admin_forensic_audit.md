# AUDITORIA FORENSE DO ADMIN YELO — FASE 3

> **Nota Metodológica:** Esta auditoria foi conduzida através da leitura direta (AST/String Parsing e inspeção manual) dos arquivos-fonte do frontend (`admin/*.html`, `admin/*.js`) e backend (`backend/controllers/*.js`, `backend/routes/*.js`). Todas as informações abaixo possuem lastro no código-fonte em produção, sem suposições. O foco inicial foi direcionado aos módulos críticos de tomada de decisão (Unit Economics, Distribuição e Growth).

---

## PARTE 1 — ARQUITETURA REAL

O Admin Yelo é uma **SPA Simulada**.
- **Entrada Principal:** `admin.html`.
- **Roteador Customizado:** A função `window.loadPage()` localizada em `admin.js` intercepta cliques na `sidebar-nav`. Ela injeta o HTML bruto (ex: `admin_traffic_ads.html`) dentro da `<div id="main-content">` via `fetch()`. Em seguida, destrói e recria a tag `<script id="dynamic-page-script">` para rodar a lógica (ex: `admin_traffic_ads.js`), chamando a função `initializePage()`.
- **Autenticação:** Baseada em um token JWT (`Yelo_token` no localStorage). Proteção em `admin.js` via `/api/admin/me`.
- **Backend:** Padrão REST sobre Express.js (ex: `adminRoutes.js`).

---

## PARTE 2 e 3 — FLUXO DE DADOS E MÉTRICAS CRÍTICAS

### 1. Custo Mensal por Psicólogo Ativo (Manutenção B2C)
*Permite decidir se o orçamento do Google Ads está escalando corretamente com a base de psicólogos.*

- **Elemento HTML:** `h4 id="kpi-maintenance-cost"` (`admin_traffic_ads.html`)
- **Alimentado por:** `admin_traffic_ads.js` na função `renderEngine()`
- **Fórmula no Frontend:** `maintenanceCost = googleSpend / totalGeralAtivos`
- **Origem dos Dados (`googleSpend`):** 
  - Chamada `fetch('${API_BASE}/api/admin/efficiency')`
  - Backend: `adminEficienciaController.js`, função `getEfficiencyDashboard()`
  - Tabela: `YeloExpense`. Soma onde `category = 'Google Ads'` filtrado pelo mês.
- **Origem dos Dados (`totalGeralAtivos`):**
  - Mesma API. Vem da tabela `Psychologists`, através do count onde `status = 'active' AND "subscriptionId" IS NOT NULL`.

### 2. CAC B2B Amortizado (Meta Ads)
*Ajuda a entender qual fatia do lucro de cada mês vai para pagar a aquisição daquele profissional.*

- **Elemento HTML:** `strong id="kpi-amortized-cac"` (`admin_traffic_ads.html`)
- **Fórmula no Frontend (`admin_traffic_ads.js`):** `avgMetaCac / lifetimeMonths`
  - *Detalhe Forense:* O `avgMetaCac` não é o CAC do mês atual, mas sim a **média dos últimos 6 meses** (`sumMetaAdsHist / sumMetaPagHist`). Isso resolve o problema de divisão por zero em meses sem novas vendas.
  - *Lifetime:* Calculado como `Math.max(ltv / 99, 1)`. O LTV vem da rota `/api/admin/growth/overview?days=30` (`adminGrowthController.js`).
- **Endpoint:** Misto entre `/efficiency` e `/growth/overview`.

### 3. Cota Justa e Déficit de Buscas (Falta de Oxigênio)
*Decisão central sobre Distribuição: Quantas buscas precisamos injetar via Google Ads para suprir a base atual?*

- **Elemento HTML:** `<div id="suggestion-box">` (`admin_distribuicao.html`)
- **Função:** `fetchData()` em `admin_distribuicao.js`
- **Endpoint:** `/api/admin/analytics/visibility?startDate=...`
- **Controller:** `adminVisibilityController.js` (Função `getVisibilityMetrics`)
- **Fórmula (Calculada 100% no Backend):**
  1. `totalLeads`: Conta registros na tabela `WhatsAppClickLogs` no período.
  2. `conversionRate`: `totalLeads / totalDemand`. (Total Demand = Count na tabela `DemandSearches`). Se 0, assume fallback de `5%`.
  3. `leadAuthenticityRate`: (Histórico) Feedbacks positivos divididos pelo total de feedbacks. (Exclui ghost_leads que são `no_contact` ou `wpp_issue`).
  4. `TARGET_REAL_LEADS_MONTHLY`: Meta dinâmica gerada por `avgClicksPerPsy30 * leadAuthenticityRate`.
  5. `idealCapacity`: `(activePsyCount * periodTargetClicks) / conversionRate`
  6. **Decisão/Alerta:** Se `totalDemand < idealCapacity * 0.8`, o sistema dispara o status `warning` com a sugestão de **Aumentar Ads**.
- **Transformação no Frontend (`admin_distribuicao.js`):** O frontend pega o `deficit = idealCapacity - totalDemand` e multiplica por **R$ 2,24** (custo de busca hardcoded) para recomendar o exato valor a investir no Google Ads.

### 4. Receita Recorrente Mensal (MRR)
*Métrica principal de saúde do negócio.*

- **Controller Responsável:** `adminGrowthController.js` e `adminEficienciaController.js` possuem duplicação lógica.
- **Fórmula no Banco:**
  O sistema busca `Psychologist.findAll` onde `status = 'active' AND plano IS NOT NULL`.
  Ele itera o array no Node.js somando valores hardcoded em um dicionário:
  ```javascript
  const planPrices = { 
      'essential': 99.00, 'clinical': 159.00, 'reference': 259.00,
      'essencial': 99.00, 'clínico': 159.00, 'sol': 259.00 
  };
  ```
  Ignora profissionais com flag `is_exempt = true` ou sem `subscriptionId`.

---

## PARTE 4 — REGRAS E MOTORES DE DECISÃO (Forense)

### A. Motor Global de Decisão B2B e B2C (Ads)
**Onde:** `admin_traffic_ads.js` -> `generateDecisionEngine()`
**Decisão: Devo aumentar ou reduzir Ads?**

**Fluxo Matemático:**
1. **Regra de Pausa Imediata (Desperdício):** Se `totalPagantes === 0` E `totalSpend > cacTolerado * 3`. Resulta em **⛔ PAUSAR**.
2. **Matriz Estatística:** Se total de assinantes > 10 e gasto > 100 = "ALTA".
3. **Matriz Econômica:** Analisa a relação LTV / CAC. 
   - Ratio >= 3: FAVORÁVEL.
   - Ratio >= 1.5: ACEITÁVEL.
   - Menor: PERIGOSA.
4. **Matriz Tendência:** Calcula o CAC atual em relação à média móvel de 3 meses. Se piorou mais de 15% nos últimos 2 meses seguidos, ativa flag `isPioraPersistente = true`.
5. **Veredito:** Cruza as 3 matrizes. Exemplo: "FAVORÁVEL + ALTA + PIORA RECENTE" resulta em **🟡 OTIMIZAR**.

### B. Motor de Diagnóstico (Company Health)
**Onde:** `adminGrowthController.js` -> `getCompanyHealthDashboard()`
**Decisão: Onde focar o esforço da empresa (Bottleneck)?**

- **Regra de Gargalo (Bottleneck):**
  - Se `novosPagantes == 0` E `hasMarketingSpend`: "Conversão de Vendas" (Atrai mas não assina).
  - Se `taxaChurnPagantes > 10.0`: "Retenção" (A evasão anula vendas).
  - Padrão: "Atração (Topo de Funil)".

---

## PARTE 5 — IA COMPROVADA (EVIDÊNCIAS NO CÓDIGO)

### 1. Insight Semanal Financeiro (Growth/Efficiency)
- **Arquivo:** `adminEficienciaController.js`, Linha ~260
- **Implementação:** Utiliza o SDK `@google/generative-ai` com o modelo `gemini-3.1-flash-lite`.
- **Trigger:** Rota `POST /api/admin/efficiency`.
- **Comportamento:** A IA não atua autonomamente. Ela envia os dados brutos (Gastos, Impressões, Cliques, Trials de Meta e Google das últimas 4 semanas) num prompt configurado para assumir o papel de "CFO e Diretor de Growth Senior".
- **Decisão:** A IA APENAS resume e interpreta (Diagnóstica). O resultado entra na coluna de "Insight" no banco e é exibido na interface.

### 2. Probabilidade de Fechamento de Trial
- **Arquivo:** `adminGrowthController.js` -> `getUpcomingTrials()`, Linha ~520
- **Trigger:** Carregamento de psicólogos no fim do trial.
- **Comportamento:** O sistema pede para `seoService.generateTrialProbabilities()` analisar os clientes baseados na completude do perfil (fotos, bio) e no volume de cliques de WhatsApp recebidos (`clickCount`).
- **Fallback (Regra Determinística):** Se a IA falhar (ou demorar), o código aplica heurísticas matemáticas explícitas (+40% se mais de 5 cliques, +20% se tem foto) para sugerir a probabilidade, comprovando um sistema robusto de failsafe.

---

## PARTE 6 — DUPLICAÇÕES E CONFLITOS MATEMÁTICOS IDENTIFICADOS

1. **Cálculo de MRR (Conflito de Origem):**
   A fórmula que varre `Psychologist.findAll` e mapeia valores fixos (`essential: 99`) está completamente duplicada linha por linha em:
   - `adminEficienciaController.js` (linha 73)
   - `adminGrowthController.js` (linha 161)
   *Implicação:* Se a tabela de preços for alterada no futuro, e apenas um arquivo for atualizado, o dashboard de Ads e o Dashboard de Growth mostrarão MRRs divergentes.

2. **Formatadores Frontend (Duplicação Trivial):**
   As funções `formatBRL()` e `formatDate()` estão explicitamente copiadas dentro do cabeçalho de múltiplos scripts isolados, como `admin_traffic_ads.js`, `admin_distribuicao.js`, sem herdar de um `utils.js`.

---

## PARTE 7 — MAPA DE DEPENDÊNCIAS

- **YeloExpense (Despesas Google/Meta)**
  ├── Dashboard Tráfego Pago (`/efficiency`) -> Converte em CAC e Custo Manutenção
  ├── Dashboard Growth (`/growth/overview`) -> Usado para abater o MRR e mostrar o Net Profit
  └── Dashboard de Saúde (`/growth/health`) -> Usado para gerar recomendação baseada em Payback
- **WhatsAppClickLogs (Cliques no WhatsApp)**
  ├── Funil B2C (`/efficiency`) -> Define a eficácia do Google Ads
  ├── Motor de Distribuição (`/analytics/visibility`) -> Controla a métrica "Falta de Oxigênio"
  └── Churn Forecast IA (`/growth/upcoming-trials`) -> Usado para calcular probabilidade de cancelamento.

---

## PARTE 8 — TABELAS (Análise Forense de 1 Tabela Vital)

**Tabela: Distribuição de Visibilidade (admin_distribuicao.html)**
- **Endpoint:** `/api/admin/analytics/visibility`
- **Colunas no DOM e Origem Backend:**
  - `Nome / Dias Ativo`: Tabela `Psychologist`, campo `nome` e `createdAt` (calculado hoje - criado).
  - `Matches`: Campo pre-computado `profile_appearances`.
  - `Visitas Perfil`: Query `COUNT()` na tabela `ProfileAppearanceLogs` no período.
  - `Cliques WPP`: Query `COUNT()` na tabela `WhatsAppClickLogs` no período.
  - `Em Negociação`: Query filtrada `WhatsAppClickLogs` com `dealClosed = 'talking'`.
  - `Conversões`: Query filtrada com `dealClosed = 'started'` ou `'yes'`.
  - `Índice Visibilidade (Fairness)`: Score interno calculado como `(velocity / safeAvg) * 100`.

---

## CONCLUSÃO DA AUDITORIA

O Admin não é apenas um painel de visualização (Analítico); grande parte do seu core é **Diagnóstico e Decisório**. Ele cruza os dados do Banco Primário PostgreSQL para sugerir investimentos exatos (em Reais) e recomendar pausar campanhas, funcionando como um "Diretor Financeiro Algorítmico". As lógicas estão altamente concentradas nos Controllers (Backend) ou via JS Injetado na View, evidenciando uma oportunidade perfeita para arquitetar a futura versão com Componentes Reutilizáveis baseados puramente nas Decisões.

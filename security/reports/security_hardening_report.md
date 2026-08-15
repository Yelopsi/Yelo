# 🛡️ SECURITY SCORECARD: APPLICATION HARDENING (FASE 5)
*Gerado por: Antigravity Security Lead | Data: 2026-08-15 | Status: Auditoria Adversarial Final*

Este documento consolida as intervenções defensivas aplicadas à camada de aplicação do Yelo, focando em mitigação de abusos HTTP, manipulação de payloads, exfiltração de dados por log e falsificação de uploads.

A taxonomia deste scorecard reflete a realidade testada no Security Gate e na infraestrutura.

---

## ✅ PASS (Implementado, Testado e Acoplado ao Gate)

### 1. PROTEÇÕES DE BORDAS E HEADERS
- **Helmet Strict HSTS:** Adicionado HSTS Preload (`max-age=31536000; includeSubDomains; preload`).
- **CSP Zero-Eval:** Remoção de `'unsafe-eval'` e injeção de nonces. Arquivos estáticos (`.html`) recebem política adaptada `unsafe-inline` para não quebrar a UI, mantendo proteção máxima nas views EJS.
- **Teste Acoplado:** `security_headers.test.js`

### 2. RATE LIMITING MULTICAMADAS
- **Fix de IP Spoofing:** Restrito `trust proxy` para apenas IPs locais/balanceadores (`loopback, linklocal, uniquelocal`).
- **Identidade Autenticada:** Limite "Expensive" associado ao User ID da sessão, anulando ataques de proxy rotativo.
- **Camada Auth:** Limite estrito de 10 tentativas / 15m para rotas de login/cadastro (respostas HTTP 429 consistentes).
- **Teste Acoplado:** `rate_limit.test.js`

### 3. PAYLOAD HARDENING & LOG SECURITY
- **JSON Bomb Protection:** Redução do limite de `10MB` para `100KB`, impedindo travamento do Event Loop.
- **Log Sanitization:** Monkey-patch de `console.log` oculta `password`, `jwt`, e `cpf` com `[REDACTED]`.
- **Teste Acoplado:** `payload_hardening.test.js` e `log_sanitization.test.js`

### 4. UPLOAD SECURITY & MAGIC BYTES
- **Buffer Inspect:** Injetado `magicBytesValidator` nos controllers para verificar cabeçalhos binários.
- **Auditoria Adversarial:** Bloqueia ativamente: SVG ativo, extensões falsificadas (`.png` com payload de PHP), arquivos truncados e payloads zerados.
- **Teste Acoplado:** `upload_security.test.js`

### 5. WEBHOOK IDEMPOTENCY
- **Inbox Pattern:** Webhooks do Asaas são salvos na tabela `WebhookInbox` antes de serem processados. Isso previne Replay Attacks e garante que retries massivos da operadora sejam ignorados via Constraint do Banco de Dados.

---

## ⚠️ ACCEPTED RISK (Conhecido, Não Mitigado, Aceito)

### 1. PRIVILÉGIOS DDL NO POSTGRESQL (DATABASE HARDENING)
- **Descoberta:** O banco de dados exige SSL estritamente em Produção (Verificado). No entanto, dezenas de controllers em produção executam queries `ALTER TABLE` nativamente para auto-migração (ex: `matchController.js`, `qnaController.js`).
- **Risco:** O usuário do banco (Yelo App) necessita de privilégios de **DDL** (Data Definition Language). Em caso de SQLi ou RCE, um atacante pode dropar colunas ou o schema inteiro.
- **Justificativa de Aceite:** Separar os papéis (Usuário de Migration vs Usuário de Leitura/Escrita) quebraria as funcionalidades de growth/analytics que geram tabelas dinâmicas no atual estágio do SaaS. O risco foi documentado e aceito.

---

## ❓ UNTESTED (Falta de Evidências Suficientes)

### 1. PROTEÇÃO L4/L3 NO PROXY DE FRONT (CLOUDFLARE/RENDER)
- **Motivo:** O backend garante limitação na camada de aplicação HTTP (L7). Porém, um DDoS volumétrico ou flood de TCP/UDP não pode ser bloqueado pelo RateLimiter do Node.js sem estourar o limite de conexões ativas. Assumimos que o provedor (Render) ou CDN está roteando este tráfego malicioso antes de bater na aplicação, mas sem acesso à infra, o status é "Untested".

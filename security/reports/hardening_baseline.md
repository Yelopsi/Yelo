# 🔍 HARDENING BASELINE REPORT (FASE 5.0)
*Data da Auditoria: 2026-08-15*

Este documento contém o mapeamento prévio de controles e defesas ativas (ou ausentes) na camada de aplicação do Yelo, focando em Headers, Rate Limiting HTTP, Payload Hardening, Logs e CORS, conforme exigido antes de se iniciar qualquer mutação massiva no código da Fase 5.

---

## 1. Security Headers (Helmet / CSP)

| Requisito | Status | Implementação Atual | Teste Executável | Conectado ao Gate |
|---|---|---|---|---|
| **Helmet** | Parcial | `server.js` (L46). Helmet ativo, mas com `contentSecurityPolicy: false` e `crossOriginOpenerPolicy: false`. | NENHUM | NÃO |
| **CSP** | Vulnerável | `securityMiddleware.js`. A CSP manual possui `unsafe-inline` e `unsafe-eval`, sendo totalmente permissiva a injeções XSS. | NENHUM | NÃO |

- **Bypass Conhecido:** Qualquer input persistido que retorne para o Frontend pode executar JavaScript irrestrito no browser do cliente, uma vez que `unsafe-eval` anula a CSP.

---

## 2. Rate Limiting HTTP

| Requisito | Status | Implementação Atual | Teste Executável | Conectado ao Gate |
|---|---|---|---|---|
| **Limites Globais** | Ativo | `apiLimiter` em `server.js` (300 reqs / 15m) p/ rotas `/api/`. | NENHUM | NÃO |
| **Rotas Autenticação/Admin** | Ausente | Login e senhas sem limites estritos. Usa a cota global (300). | NENHUM | NÃO |
| **Bypass de IP** | Vulnerável | `app.set('trust proxy', 1)` sem restrição de IP da CDN, permitindo spoofing de `X-Forwarded-For`. | NENHUM | NÃO |

- **Falso Positivo:** Usuários de uma mesma rede corporativa (mesmo IP) esgotam o limite de 300 requisições facilmente.
- **Bypass Conhecido:** Como a origem do Proxy não é validada, enviar o header `X-Forwarded-For: 123.123.123.123` burla instantaneamente o Rate Limiter atual.

---

## 3. Payload Hardening

| Requisito | Status | Implementação Atual | Teste Executável | Conectado ao Gate |
|---|---|---|---|---|
| **JSON Parser** | Vulnerável | `express.json({ limit: '10mb' })`. | NENHUM | NÃO |
| **Camada Estrutural** | Ausente | Não há validação de profundidade (JSON depth), arrays, ou tipos em grande parte das rotas. | NENHUM | NÃO |

- **Falso Negativo:** O limite de 10MB é gigantesco para JSON textuais. Permite "JSON Bombs" ou ataques de "Prototype Pollution", travando o Event Loop (DoS local).

---

## 4. Log Security & Error Handling

| Requisito | Status | Implementação Atual | Teste Executável | Conectado ao Gate |
|---|---|---|---|---|
| **Logging Centralizado** | Ausente | Padrão difuso de `console.log()` espalhado pelo backend inteiro. | NENHUM | NÃO |
| **Vazamento PII** | Vulnerável | Nenhuma camada de sanitização de PII ou senhas antes do print em console. | NENHUM | NÃO |
| **Error Handler** | Parcial | `errorHandler.js` trata o erro de limite de upload 413, mas loga cruamente 500 para qualquer outra exceção via `console.error`. Não vaza stacktraces para o browser (bom), mas não filtra o log interno. | NENHUM | NÃO |

---

## 5. CORS e Autenticação/Sessão

| Requisito | Status | Implementação Atual | Teste Executável | Conectado ao Gate |
|---|---|---|---|---|
| **CORS** | Vulnerável | `!origin` retorna `true`, permitindo bypass direto via cURL ou ferramentas como Postman. Permitido globalmente em modo não produção sem checks estritos. | NENHUM | NÃO |
| **Cookies** | Parcial | JWT trafega via Header HTTP/Cookies (cookie-parser). Configurações de `HttpOnly`, `SameSite` e `Secure` não aplicadas globalmente ou não uniformes. | NENHUM | NÃO |

---

## 🛑 CONCLUSÃO DO BASELINE

A camada de Hardening (Fase 5) atual é essencialmente **nula**. Quase todas as proteções dependem de infraestrutura de borda (que muitas vezes não barra payloads) e os limites de Rate Limiting da aplicação são rudimentares, globais e contornáveis. 

A maior ameaça de Falso-PASS neste momento é a dependência cega no `X-Forwarded-For` para as cotas de IP, e a CSP insegura abrindo a porta para sequestro de sessão e XSS.

**NENHUM teste dinâmico de headers, JSON Bombs, ou Rate Limiting Bypass existe ou está acoplado ao Gate atualmente.**

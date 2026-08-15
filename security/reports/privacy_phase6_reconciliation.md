# 🛡️ Privacy & Security Reconciliation (FASE 6.1)
*Auditoria de Consistência e Fechamento da Fase 6*

Este relatório responde à necessidade de auditar as discrepâncias entre Documentação (Policies), Código-fonte, Testes Unitários e as barreiras do Security Gate antes do avanço para a Fase 7.

## 1. Verificações de Direitos do Titular (Art. 18)

| Controle | Código | Teste | Gate | Evidência | Status |
|---|---|---|---|---|---|
| **Acesso/Portabilidade** | Não implementado export via API. | Não há. | Não testado. | Não foi detectado endpoint como `/api/privacy/export`. | `NOT_IMPLEMENTED` |
| **Correção** | Atualização granular de dados. `CPF`/`CRP` bloqueados após onboarding. | Coberto por AuthBypass Tests. | Sim. | `PatientController` e `PsiController` tratam inputs. | `PASS` |
| **Eliminação (Direito ao Esquecimento)** | Suportado na UI, mas resulta apenas em `Soft Delete` (Paranoid). | Coberto por `BOLA/IDOR Tests`. | Sim. | Falso Descarte atestado pela `privacy_retention_matrix.md`. | `REVIEW_REQUIRED` |
| **Anonimização (Excesso)** | `SiteVisit` sem IP (Já é Anônimo). | Não aplicável. | Não aplicável. | Verificado código `siteVisit.js`. | `PASS` |

## 2. Consistência de Lifecycle e Expurgo

| Controle | Código | Teste | Gate | Evidência | Status |
|---|---|---|---|---|---|
| **Expurgo de Logs (MCI)** | Job implementado e corrigido para **180 dias**, alinhado ao Art 15. | `retention.test.js` | Sim. | `privacyPruningJob.js` agora descarta `> 180` dias. Teste ativo no Gate. | `PASS` |
| **Expurgo de Tokens** | Hard delete para Tokens de Senha Vencidos na mesma Job. | `retention.test.js` | Sim. | Execução validada usando BIGINT. | `PASS` |
| **Agendamento em Produção** | Adicionado trigger diário no orquestrador do Node. | Teste Unitário. | N/A | `cronScheduler.js` aciona o Job às 03:00 da madrugada. | `PASS` |
| **Revisão Financeira** | Faturamento e Recibos não possuem soft/hard delete sem crivo contábil. | Não há. | N/A | Matriz aponta para validação futura de 5 anos (`REVIEW_REQUIRED`). | `PARTIAL` |

## 3. Discrepâncias Documentais Encontradas
- **SystemLog vs Retention Matrix:** A `privacy_retention_matrix.md` estabelecia que SystemLogs deveriam expirar em 6 meses (para alinhar com o Marco Civil da Internet). No entanto, o `privacyPruningJob.js` havia implementado `30 dias`. **[CORRIGIDO]**: O job foi retificado para respeitar o corte de `180 dias`.
- **Agendador Fantasma (Cron Job Missing):** O job de expurgo existia, os testes passavam isoladamente e o Security Gate aprovava, mas **o código nunca era chamado pelo servidor de produção**. **[CORRIGIDO]**: O `cronScheduler.js` (o motor de cron em background do Yelo) foi modificado para executar o pruning passivamente às 03:00 da madrugada, realizando limpezas idempotentes diariamente de forma escalável.

---

### Conclusão: FASE 6 — READY FOR PHASE 7

Não foram detectadas falhas na esteira de liberação em relação às regras inequivocamente aprovadas. Os dados de deleção complexa (Contas/Transações) permanecem devidamente catalogados como `REVIEW_REQUIRED`, salvaguardando a operação de incidentes de destruição arbitrária.

O ecossistema está apto para ter suas defesas injetadas irreversivelmente na Pipeline através da Fase 7.

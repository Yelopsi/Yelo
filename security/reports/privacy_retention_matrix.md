# ⏳ Privacy Retention Matrix (LGPD)
*Matriz de Ciclo de Vida e Bases Legais*

## Categorias de Ação:
- 🟢 **Manter**: Há finalidade/base legal clara.
- 🟡 **Minimizar**: Existe justificativa, mas há excesso.
- 🟠 **Anonimizar**: Precisa preservar estatística/histórico sem identificação.
- 🔴 **Expurgar**: Não há mais finalidade ou obrigação de retenção.
- ⚪ **Revisão Jurídica**: Não dá para determinar retenção/base legal apenas pelo código.

---

| Entidade / Escopo | Base Legal Inferida | Prazo de Retenção Sugerido | Ação Técnica a Implementar | Status / Classificação |
| :--- | :--- | :--- | :--- | :--- |
| **Transações / Assinaturas (`Payment`, `Subscription`)** | Obrigação Legal (Fiscal/Contábil) | 5 Anos após o encerramento do vínculo (Art. 173 CTN). | Travar exclusão direta. Inativar (Soft Delete) até prescrever. | ⚪ **REVISÃO JURÍDICA** (Validar prazo de 5 anos com contador) |
| **Saúde / Matching (`DemandSearch`, `Patient` quizzes)** | Consentimento Livre e Inequívoco | Até o término do atendimento ou pedido de exclusão. | Deleção em Cascata (Hard Delete) ao apagar a conta do paciente. | 🟡 **MINIMIZAR** (Garantir exclusão de respostas órfãs) |
| **Prontuários Virtuais (`Message`, `Appointment`)** | Obrigação Legal (CFP - Conselhos de Psicologia) | *Prazo Indeterminado / Mínimo 5 anos conforme Resolução CFP*. | Transferir custódia para o Psicólogo. O Yelo *não* deve apagar mensagens ativas. | ⚪ **REVISÃO JURÍDICA** (Definir responsabilidade de guarda de chat) |
| **Analytics e Visitas (`SiteVisit`, `WhatsAppClickLog`)** | Legítimo Interesse | 24 meses (Histórico e Growth). | Job Idempotente para Anonimizar (Zerar IP e IDs) após 24 meses. | 🟠 **ANONIMIZAR** (Aplicável via Cron Job futura) |
| **Logs de Sistema (`SystemLog`)** | Obrigação Legal (Marco Civil da Internet) | 6 Meses (Art. 15 MCI). | Script de Expurgo (Drop de registros > 6 meses). | 🔴 **EXPURGAR** (Candidato a automatização na Etapa 3) |
| **Tokens Expirados (Recuperação de Senha / JWT)** | Legítimo Interesse (Segurança) | 7 a 30 dias após uso/expiração. | Script de Expurgo via Cron. | 🔴 **EXPURGAR** (Candidato a automatização na Etapa 3) |
| **Contas Inativas de Pacientes (Sem acesso > 2 anos)** | Consentimento (Extinto por inércia) | 2 anos após o último login. | Notificação prévia -> Expurgo da Conta. | ⚪ **REVISÃO JURÍDICA** |
| **Fila de Espera Comercial (`WaitingList`, `Lead`)** | Legítimo Interesse / Consentimento | 12 meses sem conversão. | Limpeza automática de e-mails antigos. | 🔴 **EXPURGAR** |

> [!WARNING]
> **Identificação de Órfãos e Soft Deletes:** Vários modelos possuem `deletedAt` (Paranoid = true). Atualmente o sistema acumula "Lixo Digital". O expurgo definitivo (Hard Delete) de dados marcados com Soft Delete requer definição jurídica para os prazos estipulados acima.

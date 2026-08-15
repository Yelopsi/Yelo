# 🛡️ Privacy & Data Lifecycle: Matriz de Retenção e Inventário (Fase 6)
*Gerado via Automação de Discovery | Data: 2026-08-15*

Este artefato classifica os 41 modelos do banco de dados segundo as diretrizes de ciclo de vida da LGPD.

## Legenda de Classificação
- 🟢 **Manter**: Há finalidade e base legal clara.
- 🟡 **Minimizar**: Existe justificativa, mas há excesso.
- 🟠 **Anonimizar**: Precisa preservar estatística/histórico sem identificação.
- 🔴 **Expurgar**: Não há mais finalidade ou obrigação de retenção.
- ⚪ **Revisão Jurídica**: Não é possível determinar retenção/base legal apenas pelo código.

---

| Entidade | Finalidade Inferida | Retenção / Destino | Categoria LGPD | Classificação |
| :--- | :--- | :--- | :--- | :--- |
| **CommunityEvent** <br>  | Suporte à plataforma | Hard Delete ou Retenção Perpétua | Rastro Comportamental (Analytics) | 🟠 Anonimizar / 🔴 Expurgar (Dados temporários/comportamentais) |
| **CommunityResource** <br>  | Suporte à plataforma | Hard Delete ou Retenção Perpétua | Dado Pessoal (Cadastro/Interação) | ⚪ Revisão Jurídica |
| **ExitSurvey** <br>  | Suporte à plataforma | Hard Delete ou Retenção Perpétua | Dado Pessoal (Cadastro/Interação) | ⚪ Revisão Jurídica |
| **ForumComment** <br>  | Suporte à plataforma | Hard Delete ou Retenção Perpétua | Dado Pessoal (Cadastro/Interação) | ⚪ Revisão Jurídica |
| **ForumCommentVote** <br>  | Suporte à plataforma | Hard Delete ou Retenção Perpétua | Dado Pessoal (Cadastro/Interação) | ⚪ Revisão Jurídica |
| **ForumPost** <br>  | Suporte à plataforma | Hard Delete ou Retenção Perpétua | Dado Pessoal (Cadastro/Interação) | ⚪ Revisão Jurídica |
| **ForumReport** <br>  | Suporte à plataforma | Hard Delete ou Retenção Perpétua | Dado Pessoal (Cadastro/Interação) | ⚪ Revisão Jurídica |
| **ForumVote** <br>  | Suporte à plataforma | Hard Delete ou Retenção Perpétua | Dado Pessoal (Cadastro/Interação) | ⚪ Revisão Jurídica |
| **GamificationLog** <br>  | Suporte à plataforma | Hard Delete ou Retenção Perpétua | Rastro Comportamental (Analytics) | 🟠 Anonimizar / 🔴 Expurgar (Dados temporários/comportamentais) |
| **Payment** <br>  | Suporte à plataforma | Hard Delete ou Retenção Perpétua | Dado Pessoal (Financeiro) | ⚪ Revisão Jurídica (Obrigação Financeira/Fiscal) |
| **Post** <br>  | Suporte à plataforma | Hard Delete ou Retenção Perpétua | Dado Pessoal (Cadastro/Interação) | ⚪ Revisão Jurídica |
| **QuestionIgnore** <br>  | Suporte à plataforma | Hard Delete ou Retenção Perpétua | Dado Pessoal (Cadastro/Interação) | ⚪ Revisão Jurídica |
| **Subscription** <br>  | Suporte à plataforma | Hard Delete ou Retenção Perpétua | Dado Pessoal (Financeiro) | ⚪ Revisão Jurídica (Obrigação Financeira/Fiscal) |
| **SubscriptionIntent** <br>  | Suporte à plataforma | Hard Delete ou Retenção Perpétua | Dado Pessoal (Financeiro) | ⚪ Revisão Jurídica (Obrigação Financeira/Fiscal) |
| **SupportMessage** <br>  | Suporte à plataforma | Hard Delete ou Retenção Perpétua | Dado Pessoal (Cadastro/Interação) | 🟡 Minimizar (Verificar expurgo após término de serviço) |
| **SystemSetting** <br>  | Suporte à plataforma | Hard Delete ou Retenção Perpétua | Dado Pessoal (Cadastro/Interação) | ⚪ Revisão Jurídica |
| **WebhookInbox** <br>  | Suporte à plataforma | Hard Delete ou Retenção Perpétua | Dado Pessoal (Cadastro/Interação) | ⚪ Revisão Jurídica |
| **WhatsAppClickLog** <br>  | Suporte à plataforma | Hard Delete ou Retenção Perpétua | Rastro Comportamental (Analytics) | 🟠 Anonimizar / 🔴 Expurgar (Dados temporários/comportamentais) |
| **AiQuestionDraft** <br>  | Suporte à plataforma | Hard Delete ou Retenção Perpétua | Dado Pessoal (Cadastro/Interação) | ⚪ Revisão Jurídica |
| **Answer** <br>  | Suporte à plataforma | Hard Delete ou Retenção Perpétua | Dado Pessoal (Cadastro/Interação) | ⚪ Revisão Jurídica |
| **Appointment** <br>  | Suporte à plataforma | Hard Delete ou Retenção Perpétua | Dado Pessoal Sensível (Saúde) | 🟡 Minimizar (Verificar expurgo após término de serviço) |
| **Aviso** <br>  | Suporte à plataforma | Hard Delete ou Retenção Perpétua | Dado Pessoal (Cadastro/Interação) | ⚪ Revisão Jurídica |
| **AvisoLido** <br>  | Suporte à plataforma | Hard Delete ou Retenção Perpétua | Dado Pessoal (Cadastro/Interação) | ⚪ Revisão Jurídica |
| **Conversation** <br>  | Suporte à plataforma | Hard Delete ou Retenção Perpétua | Dado Pessoal (Cadastro/Interação) | ⚪ Revisão Jurídica |
| **DemandSearch** <br>  | Suporte à plataforma | Soft Delete | Dado Pessoal Sensível (Saúde) | ⚪ Revisão Jurídica |
| **Expense** <br>  | Suporte à plataforma | Hard Delete ou Retenção Perpétua | Dado Pessoal (Cadastro/Interação) | ⚪ Revisão Jurídica |
| **Lead** <br> *(Campos sensíveis: telefone)* | Suporte à plataforma | Hard Delete ou Retenção Perpétua | Dado Pessoal (Cadastro/Interação) | ⚪ Revisão Jurídica |
| **MatchEvent** <br>  | Suporte à plataforma | Hard Delete ou Retenção Perpétua | Rastro Comportamental (Analytics) | 🟠 Anonimizar / 🔴 Expurgar (Dados temporários/comportamentais) |
| **Message** <br>  | Suporte à plataforma | Hard Delete ou Retenção Perpétua | Dado Pessoal (Cadastro/Interação) | 🟡 Minimizar (Verificar expurgo após término de serviço) |
| **Patient** <br> *(Campos sensíveis: email, senha, telefone, identidade_genero)* | Suporte à plataforma | Soft Delete | Dado Pessoal Sensível (Saúde) | ⚪ Revisão Jurídica (Soft Delete detectado. Qual o limite real?) |
| **Psychologist** <br> *(Campos sensíveis: email, senha, telefone, cpf)* | Suporte à plataforma | Soft Delete | Rastro Comportamental (Analytics) | 🟠 Anonimizar / 🔴 Expurgar (Dados temporários/comportamentais) |
| **Question** <br>  | Suporte à plataforma | Hard Delete ou Retenção Perpétua | Dado Pessoal (Cadastro/Interação) | ⚪ Revisão Jurídica |
| **ReconciliationAudit** <br>  | Suporte à plataforma | Hard Delete ou Retenção Perpétua | Dado Pessoal (Cadastro/Interação) | ⚪ Revisão Jurídica (Obrigação Financeira/Fiscal) |
| **Review** <br>  | Suporte à plataforma | Hard Delete ou Retenção Perpétua | Dado Pessoal (Cadastro/Interação) | ⚪ Revisão Jurídica |
| **SiteVisit** <br>  | Suporte à plataforma | Hard Delete ou Retenção Perpétua | Rastro Comportamental (Analytics) | 🟠 Anonimizar / 🔴 Expurgar (Dados temporários/comportamentais) |
| **SystemLog** <br>  | Suporte à plataforma | Hard Delete ou Retenção Perpétua | Rastro Comportamental (Analytics) | 🟠 Anonimizar / 🔴 Expurgar (Dados temporários/comportamentais) |
| **WaitingList** <br> *(Campos sensíveis: email, telefone)* | Suporte à plataforma | Hard Delete ou Retenção Perpétua | Dado Pessoal (Cadastro/Interação) | ⚪ Revisão Jurídica |
| **WeeklyEfficiency** <br>  | Suporte à plataforma | Hard Delete ou Retenção Perpétua | Dado Pessoal (Cadastro/Interação) | ⚪ Revisão Jurídica |
| **YeloExpense** <br>  | Suporte à plataforma | Hard Delete ou Retenção Perpétua | Dado Pessoal (Cadastro/Interação) | ⚪ Revisão Jurídica |

# 📋 Privacy Data Inventory (LGPD)
*Mapeamento exaustivo dos 41 Modelos de Banco de Dados do Yelo*

## 1. Dados Pessoais Sensíveis (Art. 5º, II - LGPD)
Dados sobre saúde, vida sexual, biometria ou que revelem origem racial/étnica.

| Modelo / Tabela | Campos Coletados | Justificativa de Coleta |
| :--- | :--- | :--- |
| `Patient` | `idade`, `faixa_etaria`, `identidade_genero`, `modalidade_preferida` | Necessários para o motor de Matching Terapêutico (AI). |
| `DemandSearch` | `search_query`, `answers` (respostas do quiz) | Input do paciente sobre seu estado emocional/demanda psicológica. |
| `Appointment` | `status`, `notes` (se houver) | Agendamento de sessões de psicoterapia. |
| `Message` / `Conversation` | `content` (texto livre) | Chat entre paciente e psicólogo. Potencial trânsito de dados de saúde não estruturados. |

## 2. Dados Pessoais (Identificação Direta)
Dados que identificam ou tornam identificável uma pessoa natural.

| Modelo / Tabela | Campos Coletados | Justificativa de Coleta |
| :--- | :--- | :--- |
| `Patient` | `nome`, `email`, `telefone` | Autenticação, Contato e Notificações (WhatsApp). |
| `Psychologist` | `nome`, `email`, `telefone`, `cpf`, `crp`, `data_nascimento` | Autenticação, Validação Profissional (CRP) e Faturamento (Asaas). |
| `Lead` / `WaitingList` | `nome`, `email`, `telefone` | Captação comercial e fila de espera. |

## 3. Dados Financeiros (Obrigações Contratuais e Fiscais)
| Modelo / Tabela | Campos Coletados | Justificativa de Coleta |
| :--- | :--- | :--- |
| `Payment` | `value`, `status`, `billingType`, `dueDate` | Histórico transacional de faturamento do psicólogo. |
| `Subscription` | `plan`, `asaasCustomerId`, `status` | Gestão de assinatura do SaaS. |
| `SubscriptionIntent`| `idempotencyKey`, `planId` | Prevenção de duplicidade em pagamentos. |
| `Expense` / `YeloExpense` | Dados de despesas | Fluxo de caixa interno / Reconciliação. |

## 4. Dados Comportamentais e Telemetria (Analytics/Tracking)
Rastros de navegação e uso da plataforma.

| Modelo / Tabela | Campos Coletados | Justificativa de Coleta |
| :--- | :--- | :--- |
| `SiteVisit` | `ip`, `userAgent`, `referrer`, `page` | Analytics nativo de tráfego. |
| `SystemLog` | `level`, `message`, `meta` | Debugging e auditoria técnica. |
| `WhatsAppClickLog`| `psychologistId`, `patientId`, `source` | Gamification/Estatísticas de conversão no perfil público. |
| `GamificationLog` | `actionType`, `points` | Sistema de engajamento do psicólogo. |

## 5. Dados de Interação Social / Fórum Público
| Modelo / Tabela | Campos Coletados | Justificativa de Coleta |
| :--- | :--- | :--- |
| `ForumPost` / `Comment`| `title`, `content`, `isAnonymous` | Comunidade de psicólogos. Risco de exposição não estruturada se o usuário colar PII no texto. |
| `Review` / `Post` | `conteudo`, `rating` | Avaliações e blog posts públicos. |

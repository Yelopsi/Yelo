# 🤝 Privacy Third-Party Processors (LGPD)
*Mapeamento de Compartilhamento de Dados com Terceiros (Operadores)*

O Yelo atua como Controlador dos dados, mas delega processamento para terceiros. Abaixo, o fluxo de transferência, finalidade e risco de cada um.

## 1. Asaas (Gateway de Pagamento)
- **Dados Compartilhados:** `nome`, `email`, `cpf`, `cartão de crédito` (tokenizado), dados de faturamento.
- **Finalidade:** Processamento de assinaturas e split de pagamentos (Marketplace).
- **Base Legal:** Execução de Contrato e Obrigação Legal (Fiscal).
- **Risco LGPD:** Baixo/Médio. O Asaas é uma IF certificada pelo BACEN.
- **Ação Técnica:** Manter ID de cliente do Asaas associado à Subscription, mas evitar logs de requisições financeiras contendo payloads literais no nosso backend (Já mitigado pela Sanitização de Logs da Fase 5).

## 2. Cloudinary (Hospedagem de Imagens)
- **Dados Compartilhados:** Arquivos de imagem (Foto de Perfil, CRP).
- **Finalidade:** Armazenamento estático em CDN.
- **Base Legal:** Execução de Contrato.
- **Risco LGPD:** Alto (No caso de CRPs ou laudos trocados no Chat).
- **Ação Técnica:** Fotos de perfil são públicas. Documentos sensíveis (CRP, laudos) não deveriam ser hospedados com links públicos adivinháveis. 
- **Status:** ⚪ **REVISÃO JURÍDICA / ARQUITETURAL** (Verificar se os uploads do Chat são assinados/privados no Cloudinary).

## 3. Gemini / OpenAI (LLMs de Inteligência Artificial)
- **Dados Compartilhados:** Respostas do questionário do paciente (`answers`), perfil do psicólogo (`bio`, `abordagem`).
- **Finalidade:** Processamento para gerar Matching Terapêutico e otimização de perfis.
- **Base Legal:** Consentimento (Garantido no Termo de Uso).
- **Risco LGPD:** Alto (Trânsito de dados de saúde e PII para provedor de IA internacional).
- **Ação Técnica:** O Yelo **NÃO** deve enviar Nomes, Emails ou Telefones para a API do Gemini. Apenas os metadados do questionário (Idade, Queixa, Modalidade).
- **Status:** 🟡 **MINIMIZAR** (Auditar o payload enviado para o Gemini para garantir exclusão de PIIs diretos).

## 4. WhatsApp Web JS (Notificações)
- **Dados Compartilhados:** Número de `telefone`, `nome` do paciente/psicólogo.
- **Finalidade:** Notificações transacionais (Agendamento, Lembrete, Matches).
- **Base Legal:** Execução de Contrato.
- **Risco LGPD:** Médio (Mensagens não criptografadas end-to-end se interceptadas na sessão rodando no servidor).
- **Ação Técnica:** Não enviar dados clínicos ou laudos via notificação de WhatsApp automatizada.
- **Status:** 🟢 **MANTER** (O fluxo atual envia apenas mensagens transacionais padronizadas).

---

> [!CAUTION]
> **Data Processing Agreements (DPA):** O Yelo precisa confirmar juridicamente que Cloudinary, Asaas e Google Cloud (Gemini) possuem DPAs assinados e que não usam os dados dos usuários para treinar seus próprios modelos globais sem restrições.

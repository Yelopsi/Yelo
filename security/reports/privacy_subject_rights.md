# ⚖️ Privacy Subject Rights (Direitos do Titular - LGPD)
*Mapeamento do atendimento aos direitos previstos no Art. 18 da LGPD*

O Yelo, como Controlador de dados de pacientes e psicólogos, deve garantir os seguintes direitos automatizados ou via requisição.

## 1. Confirmação e Acesso aos Dados (Right to Access)
- **Status Atual:** O usuário tem acesso aos próprios dados através dos painéis (`/dashboard` e `/perfil`). As comunicações no fórum e no chat estão acessíveis visualmente.
- **GAP Identificado:** Não há um botão "Baixar Meus Dados" que exporte um JSON consolidado de toda a atividade (necessário para total compliance).
- **Ação Técnica:** ⚪ **REVISÃO JURÍDICA / IMPLEMENTAÇÃO FUTURA** (Criar endpoint `/api/privacy/export`).

## 2. Correção de Dados Incompletos/Inexatos
- **Status Atual:** O sistema de onboarding e o `perfil_publico.js` permitem edições granulares por parte do psicólogo e do paciente.
- **GAP Identificado:** O `CPF` e o `CRP` do psicólogo são preenchidos no cadastro e ficam travados por motivos de compliance com o gateway de pagamento.
- **Ação Técnica:** 🟢 **MANTER** (O bloqueio de edição de PIIs fortes é uma medida antifraude legítima. Correções nestes campos devem passar pelo Suporte Humano).

## 3. Anonimização, Bloqueio ou Eliminação (Direito ao Esquecimento)
- **Status Atual:** A exclusão de contas geralmente aciona a constraint `deletedAt` (Soft Delete) mantendo os registros no BD. Pacientes podem deletar a própria conta. Psicólogos podem cancelar a assinatura, mas o perfil físico persiste no banco.
- **GAP Identificado:** A exclusão de um psicólogo inativo ou paciente não apaga as mensagens trocadas (`Messages`). O Hard Delete não foi propagado em cascata.
- **Ação Técnica:** 🟡 **MINIMIZAR** (Implementar deleção ou anonimização profunda para usuários que solicitarem deleção completa, ressalvada a retenção de log financeiro).

## 4. Portabilidade dos Dados
- **Status Atual:** Inexistente.
- **Ação Técnica:** Pode ser suprida pelo mesmo endpoint do item 1 (`/api/privacy/export`).

## 5. Informação das Entidades Compartilhadas
- **Status Atual:** O Yelo deve explicitar na Política de Privacidade que dados transitam para Asaas, Cloudinary e Google/Gemini.
- **Ação Técnica:** 🟢 **MANTER** (Apenas assegurar que a política legal de uso do sistema reflete a Matriz de Terceiros).

---

> [!IMPORTANT]
> **Automação vs. Manual:** Na Fase 7, deve ser construído um Painel de Privacidade (`/privacy`) no perfil do usuário, onde ele possa solicitar seu Arquivo de Dados (Takeout) e clicar em "Encerrar e Apagar Conta". O Job assíncrono processará o pedido conforme a Matriz de Retenção estipulada.

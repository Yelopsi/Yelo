---
description: Garante paridade obrigatória entre a versão Web e a versão Mobile (Expo) em toda alteração de funcionalidade, regra ou interface.
---

# Paridade Obrigatória Web ↔ App Mobile (Yelo)

Sempre que qualquer ajuste for feito em uma tela ou fluxo voltado ao psicólogo, paciente ou administrador, **verifique e aplique o equivalente nas duas plataformas (Web e Mobile)** antes de concluir a tarefa.

## 1. Mapa Oficial de Espelhamento Web ↔ Mobile

| Área / Fluxo | Versão Web | Versão Mobile (`mobile/src/`) |
| :--- | :--- | :--- |
| Assinatura & Checkout | `public/psi/psi_assinatura.html`, `public/psi/psi_assinatura.js`, `public/psi/psi_dashboard.html` | `mobile/src/app/(tabs)/assinatura.tsx` |
| Blog & Editor | `public/psi/psi_blog.html`, `public/psi/psi_blog.js` | `mobile/src/app/(tabs)/blog.tsx` |
| Fórum da Comunidade | `public/psi/psi_forum.html`, `public/psi/psi_forum.js` | `mobile/src/app/(tabs)/forum.tsx`, `mobile/src/components/forum/` |
| Jornada / XP / Badges | `public/psi/psi_jornada.html`, `public/psi/psi_jornada.js` | `mobile/src/app/(tabs)/jornada.tsx` |
| Novidades da Plataforma | `public/psi/psi_novidades.html` | `mobile/src/app/(tabs)/novidades.tsx` |
| Meu Perfil (Psi) | `public/psi/psi_meu_perfil.html`, `public/psi/psi_meu_perfil.js`, `public/psi/psi_perfil_form.js` | `mobile/src/app/(tabs)/meu_perfil.tsx` |
| Perfil Público / Avaliações | `views/perfil_psicologo.ejs`, `public/js/perfil_psicologo.js` | `mobile/src/app/[slug].tsx` |
| Questionário / Resultados | `public/js/questionario.js`, `public/js/resultados.js` | `mobile/src/app/questionario.tsx`, `mobile/src/app/resultados.tsx` |
| Admin CRM & Detalhes | `admin/admin_crm_psicologos.*`, `admin/admin_detalhes_psicologo.*` | `mobile/src/app/(admin)/crm-modulo/psicologos.tsx`, `mobile/src/app/(admin)/crm-modulo/detalhes-psicologo.tsx` |
| Admin Financeiro / Receita | `admin/admin_financeiro.*`, `admin/admin_cmo_metrics.*` | `mobile/src/app/(admin)/crm-modulo/receita.tsx`, `mobile/src/app/(admin)/crm-modulo/` |
| Bottom Nav & Subpáginas | `public/psi/psi_dashboard.*`, `admin/admin.*` | `mobile/src/app/(tabs)/_layout.tsx`, `mobile/src/app/(admin)/_layout.tsx` |

## 2. Boas Práticas Obrigatórias
1. **Fonte Única no Backend:** Sempre que possível, coloque regras de negócio, validações (ex.: elegibilidade, limites diários, CPF/CNPJ, estados de discussão) e textos dinâmicos no Backend (`backend/`) para que Web e Mobile consumam a mesma API.
2. **Checagem Pós-Edição:** Após qualquer mudança em arquivos da tabela acima, rode:
   - `npm run parity:check` para conferir se algum par Web ↔ Mobile ficou descoberto no diff;
   - `cd mobile && npx tsc --noEmit` sempre que arquivos `.ts`/`.tsx` forem alterados.
3. **Sincronização entre Branches Sem Misturar Deploys:**
   - **Nunca misturar nem fazer merge completo da branch do app (`feat/mobile-app`) dentro da branch de deploy web** (e vice-versa) quando uma delas estiver com funcionalidades exclusivas em andamento.
   - Aplique o ajuste espelhado apenas nos arquivos equivalentes da outra plataforma (`mobile/src/` ↔ `public/` + `admin/`) mantendo os deploys independentes.
4. **Atualização Automática de Changelog Público (`psi_novidades.html`):**
   - Exiba **exclusivamente** melhorias reais percebidas pelo psicólogo na versão já publicada, nunca commits internos (`crm`, `admin`, `ads`, `black-friday`, `security`) ou ajustes exclusivos do App Mobile antes do lançamento oficial do app.


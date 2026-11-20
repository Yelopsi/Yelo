const assert = require('assert');
const { extractLogReferences, formatSystemLog } = require('../../backend/utils/systemLogFormatter');

console.log('🧪 INICIANDO SUÍTE DE TESTES: SYSTEM LOG FORMATTER');
console.log('===============================================================');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ PASS: ${name}`);
        passed++;
    } catch (err) {
        console.log(`  ❌ FAIL: ${name} -> ${err.message}`);
        failed++;
    }
}

test('01. [BF2026_SENT] resolve nome do psi, normaliza e-mail, traduz onda e preserva rawMessage', () => {
    const rawLog = {
        id: 6200,
        level: 'info',
        message: '[BF2026_SENT] wave2_trial_warm_1click | psi:933 | email:sagarana.psi@gmail.com',
        meta: { wave: 'wave2_trial_warm_1click', email: 'sagarana.psi@gmail.com', psychologistId: 933 },
        createdAt: '2026-11-19T11:30:09.000Z'
    };

    const refs = extractLogReferences([rawLog]);
    assert.deepStrictEqual(refs.psychologistIds, [933]);
    assert.deepStrictEqual(refs.emails, ['sagarana.psi@gmail.com']);

    const lookup = {
        byId: { 933: { id: 933, nome: 'Dra. Sagarana Psicóloga', email: 'sagarana.psi@gmail.com' } },
        byEmail: {}
    };

    const formatted = formatSystemLog(rawLog, lookup);
    assert.strictEqual(formatted.category, 'campaign');
    assert.strictEqual(formatted.categoryLabel, '📣 Black Friday');
    assert.strictEqual(formatted.actorLabel, 'Dra. Sagarana Psicóloga');
    assert.strictEqual(formatted.actorEmail, 'sagarana.psi@gmail.com');
    assert.strictEqual(formatted.meta.userEmail, 'sagarana.psi@gmail.com');
    assert.strictEqual(formatted.rawMessage, rawLog.message);
    assert.ok(formatted.message.includes('Onda 2 (em teste com 1 contato no WhatsApp)'));
});

test('02. [BF2026_OFFER_GRANTED] e [BF2026_AUTO_RUN] traduzem ondas, validade, ações do Google Ads e valor em R$', () => {
    const granted = formatSystemLog({
        id: 1,
        level: 'info',
        message: '[BF2026_OFFER_GRANTED] psi:933 | email:sagarana.psi@gmail.com | wave:wave2_trial_warm_1click',
        meta: { wave: 'wave2_trial_warm_1click', expiresAt: '2026-12-01T02:59:59.000Z', psychologistId: 933 }
    });
    assert.ok(granted.message.includes('Oferta Black Friday 2026 liberada na conta'));
    assert.ok(granted.message.includes('Onda 2 (em teste com 1 contato no WhatsApp)'));
    assert.ok(granted.message.includes('30/11/2026'));

    const autoRun = formatSystemLog({
        id: 2,
        level: 'info',
        message: '[BF2026_AUTO_RUN] 2026-11-20',
        meta: { date: '2026-11-20', googleAdsAction: 'HOLD_CPL_SPIKE', emailsDispatchedCount: 0, recommendedBudgetReais: 115.73 }
    });
    assert.strictEqual(autoRun.actorLabel, 'Automação Black Friday');
    assert.ok(autoRun.message.includes('20/11/2026'));
    assert.ok(autoRun.message.includes('Pausar escala (custo por lead elevado)'));
    assert.ok(autoRun.message.includes('R$ 115,73/dia'));
});

test('03. [FORUM_MEDIATOR_REVIEWED] traduz ação da moderação e expõe reasonSummary em details', () => {
    const dup = formatSystemLog({
        id: 3,
        level: 'info',
        message: '[FORUM_MEDIATOR_REVIEWED] post:795 | action:REDIRECT_DUPLICATE',
        meta: {
            action: 'REDIRECT_DUPLICATE',
            postId: 795,
            targetPostId: 22,
            reasonSummary: 'O tema já está sendo discutido no tópico Questões financeiras.'
        }
    });
    assert.strictEqual(dup.category, 'forum');
    assert.strictEqual(dup.actorLabel, 'Moderador do Fórum');
    assert.ok(dup.message.includes('post #795'));
    assert.ok(dup.message.includes('tópico #22'));
    assert.strictEqual(dup.details, 'O tema já está sendo discutido no tópico Questões financeiras.');

    const app = formatSystemLog({
        id: 4,
        level: 'info',
        message: '[FORUM_MEDIATOR_REVIEWED] post:796 | action:APPROVE',
        meta: { action: 'APPROVE', postId: 796 }
    });
    assert.ok(app.message.includes('Aprovou a publicação'));
});

test('04. [REMARKETING_SENT] e [EMAIL_FAIL] traduzem etapas e erros SMTP amigavelmente', () => {
    const rm = formatSystemLog({
        id: 5,
        level: 'info',
        message: '[REMARKETING_SENT] E-mail passo 4 enviado para alinepereira2918@gmail.com',
        meta: { step: 4, email: 'alinepereira2918@gmail.com', psychologistId: 3304 }
    });
    assert.strictEqual(rm.category, 'email');
    assert.ok(rm.message.includes('Etapa 4 (fim do período de teste — com contatos)'));

    const failTimeout = formatSystemLog({
        id: 6,
        level: 'error',
        message: '[EMAIL_FAIL] Falha ao enviar para danibarraconi@yahoo.com.br: Connection timeout'
    });
    assert.ok(failTimeout.message.includes('Tempo limite de conexão esgotado'));

    const failUndef = formatSystemLog({
        id: 7,
        level: 'error',
        message: '[EMAIL_FAIL] Falha ao enviar para undefined: No recipients defined'
    });
    assert.strictEqual(failUndef.actorEmail, null);
    assert.ok(failUndef.message.includes('destinatário sem endereço cadastrado'));
});

test('05. Eventos Asaas, Webhooks, Saque automático e Promoções ficam em PT-BR claro', () => {
    const wh = formatSystemLog({
        id: 'wh_1',
        level: 'info',
        message: '[ASAAS WEBHOOK] PAYMENT_CONFIRMED - Proc: DONE',
        meta: { userEmail: 'cus_0001', event: 'PAYMENT_CONFIRMED', webhookStatus: 'DONE', value: 99 }
    });
    assert.strictEqual(wh.category, 'payment');
    assert.ok(wh.message.includes('Pagamento confirmado'));
    assert.ok(wh.message.includes('R$ 99,00'));
    assert.ok(wh.message.includes('Processado'));

    const saque = formatSystemLog({
        id: 8,
        level: 'info',
        message: 'Saque automático Asaas realizado com sucesso: R$ 189.12'
    });
    assert.strictEqual(saque.category, 'finance');
    assert.ok(saque.message.includes('R$ 189,12'));

    const promo = formatSystemLog({
        id: 9,
        level: 'info',
        message: '[PROMO_CONSUMED] BF2026_3X2_198 | psi:3090 | email:psic.larissals@gmail.com | sub:sub_9k8xy7xczoct22nh'
    });
    assert.strictEqual(promo.category, 'campaign');
    assert.ok(promo.message.includes('Black Friday 2026 (3 meses por R$ 198)'));

    const confirm = formatSystemLog({
        id: 10,
        level: 'info',
        message: '[ASAAS] Pagamento Confirmado: lucasnp@protonmail.com (Plano ESSENTIAL)'
    });
    assert.ok(confirm.message.includes('Plano Essencial'));
});

test('06. Logs de Auth, Copilot 503, Admin e fallback desconhecido funcionam sem erro', () => {
    const login = formatSystemLog({
        id: 11,
        level: 'info',
        message: 'Login bem-sucedido: lucasnp@protonmail.com'
    });
    assert.strictEqual(login.category, 'auth');
    assert.strictEqual(login.actorEmail, 'lucasnp@protonmail.com');
    assert.strictEqual(login.message, 'Entrou na plataforma com sucesso.');

    const copilot503 = formatSystemLog({
        id: 12,
        level: 'error',
        message: '[Copilot] Falha ao gerar resposta IA: [GoogleGenerativeAI Error]: [503 Service Unavailable] This model is currently experiencing high demand.'
    });
    assert.strictEqual(copilot503.category, 'copilot');
    assert.ok(copilot503.message.includes('Serviço de IA temporariamente sobrecarregado'));

    const adminLog = formatSystemLog({
        id: 13,
        level: 'info',
        message: '[ADMIN] Assinatura de Vanessa Toyama cancelada'
    });
    assert.strictEqual(adminLog.category, 'admin');
    assert.strictEqual(adminLog.message, 'Assinatura de Vanessa Toyama cancelada');

    const unknown = formatSystemLog({
        id: 14,
        level: 'info',
        message: '[CUSTOM_JOB] Execução concluída sem falhas'
    });
    assert.strictEqual(unknown.category, 'system');
    assert.strictEqual(unknown.message, 'Execução concluída sem falhas');
});

console.log('\n===============================================================');
console.log(`Resultado: ${passed} PASS | ${failed} FAIL`);
process.exit(failed > 0 ? 1 : 0);

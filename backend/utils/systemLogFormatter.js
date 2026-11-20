// backend/utils/systemLogFormatter.js
// Traduz logs técnicos do SystemLogs e WebhookInbox para mensagens amigáveis em PT-BR na leitura,
// preservando os registros brutos no banco de dados.

const BF_WAVE_LABELS = {
    wave1_ex_payer: 'Onda 1 (ex-assinantes)',
    wave1_trial_hot_2plus: 'Onda 1 (em teste com 2+ contatos no WhatsApp)',
    wave2_trial_warm_1click: 'Onda 2 (em teste com 1 contato no WhatsApp)',
    wave3_trial_cold_ready: 'Onda 3 (em teste com perfil pronto)',
    bf_last_call: 'Última chamada'
};

const ADS_ACTION_LABELS = {
    SCALE_UP: 'Aumentar orçamento',
    SCALE_DOWN: 'Reduzir orçamento',
    HOLD: 'Manter orçamento atual',
    HOLD_CPL_SPIKE: 'Pausar escala (custo por lead elevado)'
};

const REMARKETING_STEP_LABELS = {
    '1': 'Etapa 1 (24h após cadastro)',
    '2': 'Etapa 2 (3 dias após cadastro)',
    '3': 'Etapa 3 (7 dias após cadastro)',
    '4': 'Etapa 4 (fim do período de teste — com contatos)'
};

const FORUM_ACTION_LABELS = {
    APPROVE: 'Aprovou a publicação',
    MOVE_CATEGORY: 'Moveu para a categoria mais adequada',
    REDIRECT_DUPLICATE: 'Indicou tópico já existente (duplicado)',
    CLOSE_OFF_SCOPE: 'Encerrou por estar fora do escopo do fórum'
};

const ASAAS_EVENT_LABELS = {
    PAYMENT_CONFIRMED: 'Pagamento confirmado',
    PAYMENT_RECEIVED: 'Pagamento recebido',
    PAYMENT_OVERDUE: 'Cobrança vencida (em atraso)',
    PAYMENT_UPDATED: 'Cobrança atualizada',
    PAYMENT_CREATED: 'Cobrança criada',
    PAYMENT_DELETED: 'Cobrança removida',
    PAYMENT_REFUNDED: 'Pagamento estornado',
    PAYMENT_PARTIALLY_REFUNDED: 'Pagamento parcialmente estornado',
    PAYMENT_CHARGEBACK_REQUESTED: 'Contestação (chargeback) solicitada',
    PAYMENT_CREDIT_CARD_CAPTURE_REFUSED: 'Cartão de crédito recusado',
    PAYMENT_REPROVED_BY_RISK_ANALYSIS: 'Pagamento reprovado na análise de risco',
    PAYMENT_AWAITING_RISK_ANALYSIS: 'Pagamento em análise de risco',
    PAYMENT_ANTICIPATED: 'Recebimento antecipado',
    SUBSCRIPTION_CREATED: 'Assinatura criada',
    SUBSCRIPTION_UPDATED: 'Assinatura atualizada',
    SUBSCRIPTION_DELETED: 'Assinatura cancelada'
};

const WEBHOOK_STATUS_LABELS = {
    PROCESSED: 'Processado',
    DONE: 'Processado',
    PENDING: 'Aguardando processamento',
    ERROR: 'Falha no processamento',
    FAILED: 'Falha no processamento'
};

const PROMO_LABELS = {
    BF2026_EMAIL: 'Black Friday 2026 (2 meses por R$ 99)',
    BF2026_3X2_198: 'Black Friday 2026 (3 meses por R$ 198)'
};

const PLAN_LABELS = {
    ESSENTIAL: 'Essencial',
    ESSENCIAL: 'Essencial',
    CLINICAL: 'Clínico',
    CLÍNICO: 'Clínico',
    SOL: 'Sol'
};

function isValidEmailStr(val) {
    if (!val || typeof val !== 'string') return false;
    const trimmed = val.trim();
    if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function formatDateBr(input) {
    if (!input) return null;
    const str = String(input).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        const [y, m, d] = str.split('-');
        return `${d}/${m}/${y}`;
    }
    const d = new Date(str);
    if (Number.isNaN(d.getTime())) return null;
    try {
        return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    } catch (_) {
        return d.toISOString().slice(0, 10);
    }
}

function formatBrlCurrency(val) {
    const num = Number(String(val).replace(',', '.'));
    if (!Number.isFinite(num)) return String(val);
    return `R$ ${num.toFixed(2).replace('.', ',')}`;
}

function humanizeTechnicalError(errMsg) {
    const raw = String(errMsg || '').trim();
    if (!raw) return 'Erro inesperado';
    if (/connection timeout|etimedout|timed out/i.test(raw)) {
        return 'Tempo limite de conexão esgotado com o servidor de e-mail';
    }
    if (/no recipients defined/i.test(raw)) {
        return 'Destinatário sem endereço de e-mail cadastrado';
    }
    if (/econnrefused|connection refused/i.test(raw)) {
        return 'Servidor recusou a conexão';
    }
    if (/503 service unavailable|high demand/i.test(raw)) {
        return 'Serviço de IA temporariamente sobrecarregado (tente novamente em instantes)';
    }
    if (/value too long for type character varying/i.test(raw)) {
        return 'Um dos campos informados ultrapassou o limite de caracteres';
    }
    if (/validation error/i.test(raw)) {
        return 'Dados inválidos ou campos obrigatórios ausentes';
    }
    if (/column\s+"[^"]+"\s+does not exist/i.test(raw)) {
        return 'Campo ausente na estrutura do banco de dados';
    }
    return raw.length > 220 ? `${raw.slice(0, 217)}...` : raw;
}

function translatePlanLabel(rawPlan) {
    if (!rawPlan) return '';
    const key = String(rawPlan).trim().toUpperCase();
    return PLAN_LABELS[key] || String(rawPlan).trim();
}

function extractActorMetadata(log) {
    const msg = String(log?.message || '');
    const meta = (log?.meta && typeof log.meta === 'object') ? log.meta : {};

    let psychologistId = null;
    const metaPsiId = Number(meta.psychologistId || meta.psiId);
    if (Number.isSafeInteger(metaPsiId) && metaPsiId > 0 && metaPsiId < 2147483647) {
        psychologistId = metaPsiId;
    } else {
        const psiMatch = msg.match(/\bpsi:(\d+)\b/i) || msg.match(/\brecebido para (\d+)\b/i) || msg.match(/\(ID (\d+)\)/i);
        if (psiMatch) {
            const parsed = Number(psiMatch[1]);
            if (Number.isSafeInteger(parsed) && parsed > 0 && parsed < 2147483647) {
                psychologistId = parsed;
            }
        }
    }

    let email = null;
    if (isValidEmailStr(meta.userEmail)) {
        email = meta.userEmail.trim().toLowerCase();
    } else if (isValidEmailStr(meta.email)) {
        email = meta.email.trim().toLowerCase();
    } else {
        const taggedEmail = msg.match(/\bemail:([^\s|]+)/i);
        if (taggedEmail && isValidEmailStr(taggedEmail[1])) {
            email = taggedEmail[1].trim().toLowerCase();
        } else {
            const anyEmails = msg.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
            if (anyEmails && anyEmails.length > 0) {
                const candidate = anyEmails.find(e => isValidEmailStr(e));
                if (candidate) email = candidate.toLowerCase();
            }
        }
    }

    return { psychologistId, email };
}

function extractLogReferences(logs = []) {
    const idSet = new Set();
    const emailSet = new Set();

    for (const log of logs) {
        const { psychologistId, email } = extractActorMetadata(log);
        if (psychologistId) idSet.add(psychologistId);
        if (email) emailSet.add(email);
    }

    return {
        psychologistIds: Array.from(idSet),
        emails: Array.from(emailSet)
    };
}

function defaultOriginForCategory(category, meta = {}) {
    switch (category) {
        case 'campaign': return 'Automação Black Friday';
        case 'forum': return 'Moderador do Fórum';
        case 'copilot': return 'Copilot WhatsApp';
        case 'payment':
        case 'finance': {
            const rawCustomer = meta.userEmail;
            if (rawCustomer && typeof rawCustomer === 'string' && rawCustomer.startsWith('cus_')) {
                return `Cliente Asaas (${rawCustomer})`;
            }
            return 'Financeiro (Asaas)';
        }
        case 'admin': return 'Painel Admin';
        default: return 'Sistema';
    }
}

function interpretLogMessage(log, actorEmail) {
    const raw = String(log?.message || '').trim();
    const meta = (log?.meta && typeof log.meta === 'object') ? log.meta : {};

    let category = 'system';
    let categoryLabel = '⚙️ Sistema';
    let message = raw;
    let details = log?.details || null;

    // 1. Black Friday 2026
    if (raw.startsWith('[BF2026_SENT]')) {
        category = 'campaign';
        categoryLabel = '📣 Black Friday';
        const waveMatch = raw.match(/^\[BF2026_SENT\]\s+([^\s|]+)/);
        const waveKey = meta.wave || (waveMatch ? waveMatch[1] : '');
        const waveLabel = BF_WAVE_LABELS[waveKey] || waveKey;
        message = waveLabel
            ? `E-mail da campanha Black Friday 2026 enviado — ${waveLabel}.`
            : 'E-mail da campanha Black Friday 2026 enviado.';
    } else if (raw.startsWith('[BF2026_OFFER_GRANTED]')) {
        category = 'campaign';
        categoryLabel = '📣 Black Friday';
        const waveMatch = raw.match(/\bwave:([^\s|]+)/);
        const waveKey = meta.wave || (waveMatch ? waveMatch[1] : '');
        const waveLabel = BF_WAVE_LABELS[waveKey] || waveKey;
        const expBr = meta.expiresAt ? formatDateBr(meta.expiresAt) : null;
        const expText = expBr ? ` (válida até ${expBr})` : '';
        message = `Oferta Black Friday 2026 liberada na conta${waveLabel ? ` — ${waveLabel}` : ''}${expText}.`;
    } else if (raw.startsWith('[BF2026_AUTO_RUN]')) {
        category = 'campaign';
        categoryLabel = '📣 Black Friday';
        const dateBr = formatDateBr(meta.date || raw.replace('[BF2026_AUTO_RUN]', '').trim());
        const emailsCount = Number(meta.emailsDispatchedCount ?? 0);
        const adsAction = meta.googleAdsAction ? (ADS_ACTION_LABELS[meta.googleAdsAction] || meta.googleAdsAction) : null;
        const budget = meta.recommendedBudgetReais != null ? formatBrlCurrency(meta.recommendedBudgetReais) : null;
        const parts = [`${emailsCount} ${emailsCount === 1 ? 'e-mail enviado' : 'e-mails enviados'}`];
        if (adsAction) parts.push(`Google Ads: ${adsAction}`);
        if (budget) parts.push(`Orçamento sugerido: ${budget}/dia`);
        message = `Rotina diária da Black Friday executada${dateBr ? ` em ${dateBr}` : ''}: ${parts.join(' • ')}.`;
    } else if (raw.startsWith('[PROMO_SUB_PENDING]')) {
        category = 'campaign';
        categoryLabel = '🎁 Promoção';
        const codeMatch = raw.match(/^\[PROMO_SUB_PENDING\]\s+([^\s|]+)/);
        const code = codeMatch ? codeMatch[1] : '';
        const offerLabel = PROMO_LABELS[code] || code || 'Oferta promocional';
        message = `Assinatura promocional iniciada (${offerLabel}), aguardando confirmação de pagamento.`;
    } else if (raw.startsWith('[PROMO_CONSUMED]')) {
        category = 'campaign';
        categoryLabel = '🎁 Promoção';
        const codeMatch = raw.match(/^\[PROMO_CONSUMED\]\s+([^\s|]+)/);
        const code = codeMatch ? codeMatch[1] : '';
        const offerLabel = PROMO_LABELS[code] || code || 'Oferta promocional';
        message = `Oferta promocional ativada com sucesso na assinatura (${offerLabel}).`;

    // 2. Remarketing & E-mail
    } else if (raw.startsWith('[REMARKETING_SENT]')) {
        category = 'email';
        categoryLabel = '📧 Remarketing';
        const stepMatch = raw.match(/\bpasso\s+(\d+)/i);
        const stepKey = String(meta.step || (stepMatch ? stepMatch[1] : '')).trim();
        const stepLabel = REMARKETING_STEP_LABELS[stepKey] || (stepKey ? `Etapa ${stepKey}` : 'E-mail automático');
        message = `E-mail automático de remarketing enviado — ${stepLabel}.`;
    } else if (raw.startsWith('[EMAIL_FAIL]')) {
        category = 'email';
        categoryLabel = '✉️ E-mail';
        const failMatch = raw.match(/^\[EMAIL_FAIL\]\s*Falha ao enviar para\s*([^:]+):\s*(.*)$/i);
        if (failMatch) {
            const dest = failMatch[1].trim();
            const friendlyReason = humanizeTechnicalError(failMatch[2]);
            if (!dest || dest === 'undefined' || dest === 'null') {
                message = 'Não foi possível enviar o e-mail: destinatário sem endereço cadastrado.';
            } else {
                message = `Falha ao enviar e-mail para ${dest}: ${friendlyReason}.`;
            }
        } else {
            message = `Falha ao enviar e-mail: ${humanizeTechnicalError(raw.replace('[EMAIL_FAIL]', ''))}.`;
        }

    // 3. Fórum (IA)
    } else if (raw.startsWith('[FORUM_MEDIATOR_REVIEWED]')) {
        category = 'forum';
        categoryLabel = '💬 Fórum (IA)';
        const postMatch = raw.match(/\bpost:(\d+)/i);
        const actionMatch = raw.match(/\baction:([A-Z_]+)/i);
        const postId = meta.postId || (postMatch ? postMatch[1] : '?');
        const actionCode = meta.action || (actionMatch ? actionMatch[1] : '');
        const actionLabel = FORUM_ACTION_LABELS[actionCode] || 'Revisou a publicação';
        let extra = '';
        if (actionCode === 'REDIRECT_DUPLICATE' && meta.targetPostId) {
            extra = ` (tópico #${meta.targetPostId})`;
        } else if (actionCode === 'MOVE_CATEGORY' && meta.targetCategory) {
            extra = ` (categoria: ${meta.targetCategory})`;
        }
        message = `Moderação automática no post #${postId}: ${actionLabel}${extra}.`;
        if (!details && meta.reasonSummary) {
            details = String(meta.reasonSummary);
        }

    // 4. Pagamentos, Webhooks e Financeiro (Asaas)
    } else if (raw.startsWith('[ASAAS WEBHOOK]')) {
        category = 'payment';
        categoryLabel = '💳 Webhook Asaas';
        const whMatch = raw.match(/^\[ASAAS WEBHOOK\]\s*([^\s-]+)\s*-\s*Proc:\s*(.*)$/i);
        const eventCode = meta.event || (whMatch ? whMatch[1].trim() : '');
        const procCode = meta.webhookStatus || (whMatch ? whMatch[2].trim() : '');
        const eventLabel = ASAAS_EVENT_LABELS[eventCode] || eventCode || 'Atualização de cobrança';
        const procLabel = WEBHOOK_STATUS_LABELS[procCode] || procCode;
        const valText = meta.value != null ? ` (${formatBrlCurrency(meta.value)})` : '';
        message = `Notificação do Asaas: ${eventLabel}${valText}${procLabel ? ` — ${procLabel}` : ''}.`;
        if (!details && meta.error) {
            details = `Motivo técnico: ${humanizeTechnicalError(meta.error)}`;
        }
    } else if (raw.startsWith('[ASAAS WEBHOOK BRUTO]')) {
        category = 'payment';
        categoryLabel = '💳 Webhook Asaas';
        const evMatch = raw.match(/Evento recebido:\s*([^\s]+)/i);
        const eventCode = evMatch ? evMatch[1] : '';
        const eventLabel = ASAAS_EVENT_LABELS[eventCode] || eventCode || 'Atualização de cobrança';
        message = `Notificação de cobrança recebida do Asaas: ${eventLabel}.`;
    } else if (raw.startsWith('[ASAAS] Pagamento Confirmado:')) {
        category = 'payment';
        categoryLabel = '💳 Pagamento';
        const planMatch = raw.match(/\(Plano\s+([^)]+)\)/i);
        const planText = planMatch ? ` (Plano ${translatePlanLabel(planMatch[1])})` : '';
        message = `Pagamento confirmado e assinatura ativada${planText}.`;
    } else if (raw.startsWith('[ASAAS] Evento de Cobrança:')) {
        category = 'payment';
        categoryLabel = '💳 Cobrança';
        const evMatch = raw.match(/Evento de Cobrança:\s*([A-Z_]+)/i);
        const eventCode = evMatch ? evMatch[1] : '';
        const eventLabel = ASAAS_EVENT_LABELS[eventCode] || eventCode || 'Atualização';
        message = `Evento de cobrança no Asaas: ${eventLabel}.`;
    } else if (raw.startsWith('[ASAAS] Acesso Suspenso via Evento Negativo')) {
        category = 'payment';
        categoryLabel = '💳 Cobrança';
        const evMatch = raw.match(/\(([A-Z_]+)\)/);
        const eventCode = evMatch ? evMatch[1] : '';
        const eventLabel = ASAAS_EVENT_LABELS[eventCode] || eventCode;
        message = eventLabel
            ? `Acesso da conta suspenso após: ${eventLabel.toLowerCase()}.`
            : 'Acesso da conta suspenso após evento negativo de pagamento.';
    } else if (raw.startsWith('[ASAAS] Evento Negativo processado')) {
        category = 'payment';
        categoryLabel = '💳 Cobrança';
        const evMatch = raw.match(/\(([A-Z_]+)\)/);
        const eventCode = evMatch ? evMatch[1] : '';
        const eventLabel = ASAAS_EVENT_LABELS[eventCode] || eventCode;
        message = eventLabel
            ? `Evento negativo processado (${eventLabel}); validade do plano verificada.`
            : 'Evento negativo de pagamento processado; validade do plano verificada.';
    } else if (raw.startsWith('[ASAAS] Pagamento Falhou/Venceu:')) {
        category = 'payment';
        categoryLabel = '💳 Cobrança';
        message = 'Pagamento venceu ou foi recusado — acesso da conta suspenso.';
    } else if (raw.startsWith('[ASAAS] Pagamento Estornado/Cancelado:')) {
        category = 'payment';
        categoryLabel = '💳 Cobrança';
        message = 'Pagamento estornado ou cobrança cancelada no Asaas.';
    } else if (/^Saque automático Asaas realizado com sucesso:/i.test(raw)) {
        category = 'finance';
        categoryLabel = '🏦 Financeiro';
        const valMatch = raw.match(/R\$\s*([\d.,]+)/i);
        message = valMatch
            ? `Transferência automática da conta Asaas concluída: ${formatBrlCurrency(valMatch[1])}.`
            : 'Transferência automática da conta Asaas concluída com sucesso.';
    } else if (/^Falha na rotina de saque automático do Asaas/i.test(raw)) {
        category = 'finance';
        categoryLabel = '🏦 Financeiro';
        message = 'Falha ao executar a rotina de transferência automática no Asaas.';
    } else if (raw.startsWith('[AJUSTE_FATURAMENTO]')) {
        category = 'finance';
        categoryLabel = '💳 Faturamento';
        message = raw.replace(/^\[AJUSTE_FATURAMENTO\]\s*/, '').trim();

    // 5. Copilot WhatsApp
    } else if (raw.startsWith('[Copilot]')) {
        category = 'copilot';
        categoryLabel = '🤖 Copilot IA';
        if (/resposta gerada/i.test(raw)) {
            message = 'Sugestão de resposta gerada com sucesso pelo Copilot.';
        } else if (/falha ao gerar resposta/i.test(raw)) {
            const errPart = raw.replace(/^\[Copilot\]\s*Falha ao gerar resposta IA:\s*/i, '');
            message = `Não foi possível gerar resposta no Copilot: ${humanizeTechnicalError(errPart)}.`;
        } else {
            message = raw.replace(/^\[Copilot\]\s*/, '').trim();
        }

    // 6. Acesso, Cadastros e Segurança
    } else if (/^Login de administrador bem-sucedido:/i.test(raw)) {
        category = 'admin';
        categoryLabel = '🛡️ Acesso Admin';
        message = 'Acessou o painel administrativo com sucesso.';
    } else if (/^Login de Psicólogo bem-sucedido:/i.test(raw)) {
        category = 'auth';
        categoryLabel = '🔐 Acesso';
        message = 'Psicólogo(a) entrou na plataforma com sucesso.';
    } else if (/^Login de Paciente bem-sucedido:/i.test(raw)) {
        category = 'auth';
        categoryLabel = '🔐 Acesso';
        message = 'Paciente entrou na plataforma com sucesso.';
    } else if (/^Login bem-sucedido:/i.test(raw)) {
        category = 'auth';
        categoryLabel = '🔐 Acesso';
        message = 'Entrou na plataforma com sucesso.';
    } else if (/^\[Auth\] Login Google bem-sucedido:/i.test(raw)) {
        category = 'auth';
        categoryLabel = '🔐 Acesso Google';
        message = 'Entrou na plataforma usando a conta Google.';
    } else if (/^(?:\[Auth\]\s*)?Novo [Pp]aciente via Google:/i.test(raw)) {
        category = 'auth';
        categoryLabel = '✨ Novo Cadastro';
        message = 'Novo(a) paciente se cadastrou usando a conta Google.';
    } else if (/^Novo Paciente Cadastrado:/i.test(raw)) {
        category = 'auth';
        categoryLabel = '✨ Novo Cadastro';
        message = 'Novo(a) paciente se cadastrou na plataforma.';
    } else if (/^(?:Falha de login Admin|Tentativa de login falha \(senha incorreta\) para admin)/i.test(raw)) {
        category = 'security';
        categoryLabel = '🔒 Segurança Admin';
        message = 'Tentativa de acesso administrativo recusada — senha incorreta.';
    } else if (/^Falha de login Paciente \(Credenciais inválidas\):/i.test(raw)) {
        category = 'security';
        categoryLabel = '🔒 Segurança';
        message = 'Tentativa de login de paciente recusada — e-mail ou senha inválidos.';
    } else if (/^Falha de login \(Senha incorreta\):/i.test(raw)) {
        category = 'security';
        categoryLabel = '🔒 Segurança';
        message = 'Tentativa de login recusada — senha incorreta.';
    } else if (/^\[Auth\] Falha na autenticação com Google:/i.test(raw)) {
        category = 'security';
        categoryLabel = '🔒 Acesso Google';
        const reason = raw.replace(/^\[Auth\] Falha na autenticação com Google:\s*/i, '').trim();
        message = reason
            ? `Não foi possível entrar com a conta Google: ${humanizeTechnicalError(reason)}.`
            : 'Não foi possível concluir o login com a conta Google.';
    } else if (/^Erro no registro de Psicólogo:/i.test(raw)) {
        category = 'auth';
        categoryLabel = '⚠️ Cadastro Psi';
        const reason = raw.replace(/^Erro no registro de Psicólogo:\s*/i, '');
        message = `Não foi possível concluir o cadastro do(a) psicólogo(a): ${humanizeTechnicalError(reason)}.`;
    } else if (/^Erro no registro de Paciente:/i.test(raw)) {
        category = 'auth';
        categoryLabel = '⚠️ Cadastro Paciente';
        const reason = raw.replace(/^Erro no registro de Paciente:\s*/i, '');
        message = `Não foi possível concluir o cadastro do(a) paciente: ${humanizeTechnicalError(reason)}.`;

    // 7. Ações Manuais Admin & Fallback Genérico
    } else if (raw.startsWith('[ADMIN]')) {
        category = 'admin';
        categoryLabel = '🛠️ Ação Admin';
        message = raw.replace(/^\[ADMIN\]\s*/, '').trim();
    } else {
        const stripped = raw.replace(/^\[[A-Z0-9_\s]+\]\s*/, '').trim();
        message = stripped || raw;
        if (actorEmail && message.endsWith(`: ${actorEmail}`)) {
            message = `${message.slice(0, -(`: ${actorEmail}`).length).trim()}.`;
        }
    }

    return { category, categoryLabel, message, details };
}

function formatSystemLog(log, lookup = { byId: {}, byEmail: {} }) {
    const plainLog = (log && typeof log.toJSON === 'function') ? log.toJSON() : { ...log };
    const meta = (plainLog.meta && typeof plainLog.meta === 'object') ? { ...plainLog.meta } : {};
    const byId = lookup?.byId || {};
    const byEmail = lookup?.byEmail || {};

    const { psychologistId, email: extractedEmail } = extractActorMetadata({ ...plainLog, meta });

    const person =
        (psychologistId && byId[psychologistId]) ||
        (extractedEmail && byEmail[extractedEmail]) ||
        null;

    const actorEmail = extractedEmail || (person?.email ? String(person.email).trim().toLowerCase() : null);
    if (actorEmail && !isValidEmailStr(meta.userEmail)) {
        meta.userEmail = actorEmail;
    }

    const { category, categoryLabel, message, details } = interpretLogMessage({ ...plainLog, meta }, actorEmail);

    const actorLabel =
        (person?.nome ? String(person.nome).trim() : null) ||
        actorEmail ||
        defaultOriginForCategory(category, meta);

    return {
        ...plainLog,
        meta,
        rawMessage: plainLog.message || '',
        message,
        details: details || plainLog.details || null,
        category,
        categoryLabel,
        actorLabel,
        actorEmail: actorEmail || null
    };
}

module.exports = {
    BF_WAVE_LABELS,
    ADS_ACTION_LABELS,
    REMARKETING_STEP_LABELS,
    FORUM_ACTION_LABELS,
    ASAAS_EVENT_LABELS,
    WEBHOOK_STATUS_LABELS,
    PROMO_LABELS,
    extractLogReferences,
    formatSystemLog,
    humanizeTechnicalError
};

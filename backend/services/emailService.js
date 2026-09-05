// backend/services/emailService.js
const db = require('../models');
const nodemailer = require('nodemailer');

// Mapeamento de variáveis (Suporta tanto EMAIL_ quanto SMTP_)
const host = process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.gmail.com';
const port = process.env.EMAIL_PORT || process.env.SMTP_PORT || 587;
const user = process.env.EMAIL_USER || process.env.SMTP_USER;
const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS;

if (!user || !pass) {
    console.error("⚠️ [EMAIL] ATENÇÃO: Credenciais de e-mail (SMTP_USER/PASS) não estão definidas no .env");
}

const transporter = nodemailer.createTransport({
    host: host,
    port: port,
    secure: parseInt(port) === 465, // true para 465, false para outras portas
    auth: {
        user: user || '',
        pass: pass || ''
    },
    debug: process.env.NODE_ENV !== 'production', // Desativa em produção
    logger: process.env.NODE_ENV !== 'production' // Desativa em produção
});

// ============================================================================
// O SEGREDO: TEMPLATE BASE ÚNICO (Evita a necessidade de arquivos .html)
// ============================================================================
const getBaseTemplate = (title, content) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f5f7; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
        .wrapper { width: 100%; table-layout: fixed; background-color: #f4f5f7; padding: 40px 0; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.04); }
        .header { background-color: #1B4332; padding: 35px 20px; text-align: center; }
        .header img { max-width: 140px; }
        .content { padding: 40px 35px; color: #333333; line-height: 1.6; font-size: 16px; }
        .content h2 { color: #1B4332; margin-top: 0; font-size: 22px; font-weight: 600; letter-spacing: -0.5px; }
        .content p { margin: 16px 0; color: #4a5568; }
        .footer { background-color: #f8f9fa; padding: 25px; text-align: center; color: #a0aec0; font-size: 13px; border-top: 1px solid #edf2f7; }
        .btn { display: inline-block; padding: 14px 32px; background-color: #F59E0B; color: #ffffff !important; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 15px; margin-top: 10px; text-align: center; }
        .btn-container { text-align: center; margin: 30px 0 10px 0; }
        .highlight-box { background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center; }
        .highlight-code { font-family: monospace; font-size: 15px; color: #166534; word-break: break-all; margin-top: 10px; font-weight: bold; background: #fff; padding: 10px; border-radius: 4px; border: 1px dashed #86efac; }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="container">
            <div class="header">
                <img src="${process.env.FRONTEND_URL || 'https://www.yelopsi.com.br'}/assets/logos/logo-branca.png" alt="Yelo">
            </div>
            <div class="content">
                <h2>${title}</h2>
                ${content}
            </div>
            <div class="footer">
                <p>Você está recebendo este e-mail porque está cadastrado na Yelo.</p>
                <p>© ${new Date().getFullYear()} Yelo - Apoio Psicológico. Todos os direitos reservados.</p>
            </div>
        </div>
    </div>
</body>
</html>
`;

// Função genérica de envio
const sendEmail = async (to, subject, html) => {
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_FROM || '"Yelo Saúde Mental" <nao-responda@yelopsi.com.br>', 
            to,
            subject,
            html
        });
        console.log(`📧 E-mail enviado para ${to}: ${subject}`);
    } catch (error) {
        console.error(`❌ Erro ao enviar e-mail para ${to}:`, error.message);
        try {
            if (db.SystemLog) {
                await db.SystemLog.create({
                    level: 'error',
                    message: `[EMAIL_FAIL] Falha ao enviar para ${to}: ${error.message}`,
                    meta: { subject, error: error.stack }
                });
            }
        } catch (e) { console.error("Falha ao salvar log de email:", e.message); }

        throw error;
    }
};

exports.sendEmail = sendEmail;

exports.sendBillCreatedEmail = async (user, payment) => {
    const valor = parseFloat(payment.value).toFixed(2).replace('.', ',');
    const vencimento = payment.dueDate.split('-').reverse().join('/');
    const title = 'Sua nova fatura da Yelo está disponível';
    const psiName = user.nome ? user.nome.split(' ')[0] : 'Profissional';
    const content = `
        <p>Olá, <strong>${psiName}</strong>! Tudo bem?</p>
        <p>A sua fatura referente ao uso da plataforma Yelo já foi gerada e está disponível para pagamento.</p>
        <div style="background-color: #f7fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Valor:</strong> R$ ${valor}</p>
            <p style="margin: 5px 0;"><strong>Vencimento:</strong> ${vencimento}</p>
        </div>
        <p>Para visualizar os detalhes ou realizar o pagamento, basta acessar o link seguro abaixo:</p>
        <div class="btn-container"><a href="${payment.invoiceUrl}" class="btn">Acessar Minha Fatura</a></div>
    `;
    await sendEmail(user.email, 'Sua nova fatura da Yelo está disponível', getBaseTemplate(title, content));
};

exports.sendDueDateWarningEmail = async (user, payment) => {
    const valor = parseFloat(payment.value).toFixed(2).replace('.', ',');
    const vencimento = payment.dueDate.split('-').reverse().join('/');
    const title = 'Sua fatura da Yelo vence HOJE ⚠️';
    const psiName = user.nome ? user.nome.split(' ')[0] : 'Profissional';
    const content = `
        <p>Olá, <strong>${psiName}</strong>.</p>
        <p>Este é um lembrete de que o vencimento da sua fatura de <strong>R$ ${valor}</strong> é HOJE.</p>
        <p>Para facilitar o seu dia, você pode utilizar o link abaixo para efetuar o pagamento e manter seu perfil ativo:</p>
        <div class="btn-container"><a href="${payment.invoiceUrl}" class="btn">Acessar Fatura</a></div>
    `;
    await sendEmail(user.email, 'Sua fatura da Yelo vence HOJE ⚠️', getBaseTemplate(title, content));
};

exports.sendDigitableLineEmail = async (user, payment) => {
    let linha = payment.pixTransaction || payment.nossoNumero || "Acesse sua fatura para ver o código de pagamento";
    const valor = parseFloat(payment.value).toFixed(2).replace('.', ',');
    const title = 'Sua fatura da Yelo vence HOJE ⚠️';
    const psiName = user.nome ? user.nome.split(' ')[0] : 'Profissional';
    
    let highlightHtml = '';
    if (payment.billingType === 'PIX' || payment.billingType === 'BOLETO') {
        if (payment.billingType === 'PIX') {
            try {
                const fetch = require('node-fetch');
                let ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/v3';
                ASAAS_API_URL = ASAAS_API_URL.trim().replace(/\/+$/, '');
                if (ASAAS_API_URL.includes('sandbox.asaas.com') && !ASAAS_API_URL.includes('/api')) {
                    ASAAS_API_URL = ASAAS_API_URL.replace('sandbox.asaas.com', 'sandbox.asaas.com/api');
                }
                const ASAAS_API_KEY = process.env.ASAAS_API_KEY ? process.env.ASAAS_API_KEY.trim() : '';
                const qrRes = await fetch(`${ASAAS_API_URL}/payments/${payment.id}/pixQrCode`, { headers: { 'access_token': ASAAS_API_KEY } });
                const qrData = await qrRes.json();
                if (qrData.payload) linha = qrData.payload;
            } catch(e) {}
        }
        
        highlightHtml = `
            <div class="highlight-box">
                <p style="margin: 0; color: #166534; font-size: 14px;">Copie o código abaixo e cole no seu banco:</p>
                <div class="highlight-code">${linha}</div>
            </div>
        `;
    }

    const content = `
        <p>Olá, <strong>${psiName}</strong>.</p>
        <p>Este é um lembrete amigável de que o vencimento da sua fatura de <strong>R$ ${valor}</strong> é <strong>HOJE</strong>.</p>
        <p>Para facilitar o seu dia, você pode utilizar o link ou código abaixo para efetuar o pagamento e manter seu perfil ativo:</p>
        ${highlightHtml}
        <div class="btn-container"><a href="${payment.invoiceUrl}" class="btn">Pagar Agora</a></div>
    `;
    await sendEmail(user.email, 'Sua fatura da Yelo vence HOJE ⚠️', getBaseTemplate(title, content));
};

exports.sendOverdueEmail = async (user, payment) => {
    const valor = parseFloat(payment.value).toFixed(2).replace('.', ',');
    const vencimento = payment.dueDate.split('-').reverse().join('/');
    const title = 'Ação Necessária: Fatura Yelo em atraso';
    const psiName = user.nome ? user.nome.split(' ')[0] : 'Profissional';
    const content = `
        <p>Olá, <strong>${psiName}</strong>.</p>
        <p>Ainda não identificamos o pagamento da sua fatura de <strong>R$ ${valor}</strong>, que venceu no dia <strong>${vencimento}</strong>.</p>
        <p>Para evitar a suspensão automática do seu perfil nas buscas da plataforma e garantir que você continue recebendo pacientes, por favor, regularize sua assinatura o quanto antes.</p>
        <p style="font-size: 13px; color: #718096; margin-top: 15px;"><em>(Se a fatura PIX estiver expirada no link, o sistema gerará um novo código automaticamente ao acessar a tela de assinatura ou trocar a forma de pagamento).</em></p>
        <div class="btn-container"><a href="${payment.invoiceUrl}" class="btn">Regularizar Assinatura</a></div>
    `;
    await sendEmail(user.email, 'Ação Necessária: Fatura Yelo em atraso', getBaseTemplate(title, content));
};

exports.sendBillUpdatedEmail = async (user, payment) => {
    const valor = parseFloat(payment.value).toFixed(2).replace('.', ',');
    const vencimento = payment.dueDate.split('-').reverse().join('/');
    const title = 'Atualização na sua fatura da Yelo';
    const psiName = user.nome ? user.nome.split(' ')[0] : 'Profissional';
    const content = `
        <p>Olá, <strong>${psiName}</strong>.</p>
        <p>Informamos que houve uma atualização na sua fatura (nova data de vencimento ou reajuste de valor).</p>
        <div style="background-color: #f7fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Novo Valor:</strong> R$ ${valor}</p>
            <p style="margin: 5px 0;"><strong>Novo Vencimento:</strong> ${vencimento}</p>
        </div>
        <p>Acesse o link abaixo para conferir a fatura atualizada:</p>
        <div class="btn-container"><a href="${payment.invoiceUrl}" class="btn">Ver Fatura Atualizada</a></div>
    `;
    await sendEmail(user.email, 'Atualização na sua fatura da Yelo', getBaseTemplate(title, content));
};

exports.sendInvitationEmail = async (candidate, invitationLink) => {
    const title = 'Seu convite chegou! 🎉';
    const content = `
        <p>Olá, <strong>${candidate.nome || 'Profissional'}</strong>!</p>
        <p>Uma vaga foi liberada para você na plataforma Yelo. Clique no botão abaixo para concluir o seu cadastro e preparar seu consultório.</p>
        <center><a href="${invitationLink}" class="btn">Concluir Cadastro</a></center>
    `;
    await sendEmail(candidate.email, 'Seu convite para a Yelo chegou!', getBaseTemplate(title, content));
};

exports.sendPaymentConfirmationEmail = async (user, planType, value) => {
    const valor = parseFloat(value).toFixed(2).replace('.', ',');
    const plano = planType || 'Ecossistema Yelo';
    const title = 'Pagamento Confirmado! ✅';
    const psiName = user.nome ? user.nome.split(' ')[0] : 'Profissional';
    const content = `
        <p>Olá, <strong>${psiName}</strong>!</p>
        <p>Seu pagamento de <strong>R$ ${valor}</strong> foi processado e confirmado com sucesso.</p>
        <p>Seu perfil continua ativo e visível na Yelo, pronto para conectar você a novos pacientes. Agradecemos por fazer parte da nossa comunidade!</p>
        <div class="btn-container"><a href="${process.env.FRONTEND_URL || 'https://www.yelopsi.com.br'}/login" class="btn">Acessar Yelo</a></div>
    `;
    await sendEmail(user.email, 'Pagamento Confirmado - Yelo', getBaseTemplate(title, content));
};

exports.sendPaymentFailedEmail = async (user, invoiceUrl) => {
    const link = invoiceUrl || ((process.env.FRONTEND_URL || 'https://www.yelopsi.com.br') + '/login');
    const title = 'Ação Necessária: Falha no Pagamento';
    const content = `
        <p>Olá, <strong>${user.nome}</strong>.</p>
        <p>Infelizmente, houve uma falha ao processar o pagamento da sua assinatura. O seu perfil foi temporariamente pausado.</p>
        <p>Por favor, acesse o link abaixo para atualizar sua forma de pagamento ou tentar novamente.</p>
        <center><a href="${link}" class="btn">Tentar Novamente</a></center>
    `;
    await sendEmail(user.email, 'Ação Necessária: Falha no Pagamento', getBaseTemplate(title, content));
};

exports.sendSubscriptionCancelledEmail = async (user) => {
    const title = 'Assinatura Cancelada 😢';
    const content = `
        <p>Olá, <strong>${user.nome}</strong>,</p>
        <p>Sua assinatura foi cancelada com sucesso e seu perfil não aparecerá mais nas buscas. Se quiser voltar a expandir seus atendimentos, estamos de portas abertas.</p>
        
        <div style="background-color: #f3f4f6; padding: 15px; border-left: 4px solid #f59e0b; border-radius: 4px; color: #4b5563; font-size: 0.95em; margin: 20px 0;">
            <strong>Como foi sua experiência?</strong><br>
            Sua opinião é fundamental para a evolução da Yelo. Leva menos de 1 minuto para nos contar o motivo da sua pausa:
            <br><br>
            <a href="${process.env.FRONTEND_URL || 'https://www.yelopsi.com.br'}/feedback?psiId=${user.id}" style="color: #b45309; font-weight: bold; text-decoration: underline;">👉 Deixar meu Feedback Rápido</a>
        </div>
        
        <center><a href="${process.env.FRONTEND_URL || 'https://www.yelopsi.com.br'}/login" class="btn">Reativar Assinatura</a></center>
    `;
    await sendEmail(user.email, 'Assinatura Cancelada - Yelo', getBaseTemplate(title, content));
};

exports.sendWelcomeEmail = async (user, type) => {
    if (type === 'psychologist') {
        const title = 'Bem-vindo(a) à Yelo Psi! 💛';
        const content = `
            <p>Olá, <strong>${user.nome.split(' ')[0]}</strong>!</p>
            <p>Estamos muito felizes em ter você conosco. Sua conta está criada. Agora, configure seu perfil completo para começar a receber pacientes na plataforma.</p>
            <center><a href="${process.env.FRONTEND_URL || 'https://www.yelopsi.com.br'}/login" class="btn">Acessar meu Consultório</a></center>
        `;
        await sendEmail(user.email, title, getBaseTemplate(title, content));
    } else {
        const title = 'Bem-vindo(a) à Yelo! 💛';
        const content = `
            <p>Olá, <strong>${user.nome.split(' ')[0]}</strong>!</p>
            <p>Criamos um espaço seguro e sigiloso para você. Acesse seu painel e responda ao questionário rápido para encontrarmos o psicólogo ideal para o seu momento.</p>
            <center><a href="${process.env.FRONTEND_URL || 'https://www.yelopsi.com.br'}/questionario" class="btn">Encontrar meu Psicólogo</a></center>
        `;
        await sendEmail(user.email, title, getBaseTemplate(title, content));
    }
};

exports.sendPasswordResetEmail = async (user, resetLink) => {
    const title = 'Redefinição de Senha';
    const content = `
        <p>Olá, <strong>${user.nome}</strong>!</p>
        <p>Recebemos um pedido para redefinir a sua senha na Yelo. Se não foi você, ignore este e-mail.</p>
        <p>Para criar uma nova senha, clique no botão abaixo:</p>
        <center><a href="${resetLink}" class="btn">Redefinir Minha Senha</a></center>
    `;
    await sendEmail(user.email, 'Redefinição de Senha - Yelo', getBaseTemplate(title, content));
};

exports.sendRemarketingEmail = async (user, step) => {
    let titulo = '';
    let msg = '';
    
    if (step === 1) {
        titulo = 'Seu perfil na Yelo está quase pronto! 🚀';
        msg = 'Notamos que você se cadastrou, mas ainda não ativou sua assinatura. Finalize seu perfil agora para não perder pacientes que buscam exatamente por sua especialidade.';
    } else if (step === 2) {
        titulo = 'Por que escolher a Yelo? 💛';
        msg = 'Com a Yelo, conectamos você a pacientes reais através da nossa inteligência de match. Investimos ativamente em anúncios para garantir que nossa comunidade de psicólogos tenha uma agenda saudável. Assine hoje e apareça nas buscas.';
    } else if (step === 3) {
        titulo = 'Último lembrete: Faça parte da Yelo ⏰';
        msg = 'Esta é uma ótima oportunidade para expandir seus atendimentos com uma plataforma feita com cuidado e ética. Ative sua assinatura agora e desfrute de todos os recursos da nossa comunidade.';
    } else if (step === 4) {
        titulo = `Você tem ${user.whatsapp_clicks || 1} paciente(s) tentando falar com você! 💛`;
        msg = `Notamos que o seu perfil atraiu interessados e você recebeu cliques no seu WhatsApp recentemente! Como seu período de teste terminou e sua assinatura está inativa, sua agenda pública foi bloqueada e os pacientes não conseguem mais entrar em contato. Ative sua assinatura Premium agora para desbloquear seu WhatsApp e voltar a receber novos pacientes sem limites.`;
    }

    const content = `
        <p>Olá, <strong>${user.nome.split(' ')[0]}</strong>!</p>
        <p>${msg}</p>
        <center><a href="${process.env.FRONTEND_URL || 'https://www.yelopsi.com.br'}/login" class="btn">Acessar Plataforma</a></center>
    `;
    await sendEmail(user.email, titulo, getBaseTemplate(titulo, content));
};

exports.sendFirstLeadEmail = async (user) => {
    const title = '🎉 Você recebeu seu primeiro contato!';
    const content = `
        <p>Ótimas notícias, <strong>${user.nome.split(' ')[0]}</strong>!</p>
        <p>Um paciente acabou de clicar no botão de WhatsApp no seu perfil da Yelo. Isso significa que sua apresentação está atraindo interessados. Acesse sua conta agora para acompanhar seus acessos e aproveitar ao máximo a plataforma.</p>
        <center><a href="${process.env.FRONTEND_URL || 'https://www.yelopsi.com.br'}/login" class="btn">Acessar meu Painel</a></center>
    `;
    await sendEmail(user.email, title, getBaseTemplate(title, content));
};

exports.sendLimitReachedEmail = async (user, maxClicks) => {
    const title = '⚠️ Seu limite de contatos gratuitos foi atingido!';
    const content = `
        <p>Incrível, <strong>${user.nome.split(' ')[0]}</strong>!</p>
        <p>Você acabou de receber seu <strong>${maxClicks}º contato</strong> através da Yelo. Isso mostra que seu perfil atrai muito interesse.</p>
        <p>Como seu limite de contatos gratuitos do período de teste foi atingido, seu botão de WhatsApp ficará indisponível para novos pacientes a partir de agora. Assine o plano Premium para desbloquear seu perfil e continuar recebendo pacientes!</p>
        <center><a href="${process.env.FRONTEND_URL || 'https://www.yelopsi.com.br'}/login" class="btn">Desbloquear meu Perfil</a></center>
    `;
    await sendEmail(user.email, 'Seu limite de contatos gratuitos foi atingido! 🚀', getBaseTemplate(title, content));
};

exports.sendEvaluationEmail = async (user) => {
    const title = 'Como foi sua experiência na Yelo? 💛';
    const content = `
        <p>Olá, <strong>${user.nome.split(' ')[0]}</strong>!</p>
        <p>Notamos que o seu período na Yelo chegou ao fim recentemente. Nosso maior objetivo é construir uma plataforma que realmente faça a diferença na prática clínica dos profissionais de psicologia, e a sua opinião é a peça mais importante para nós.</p>
        <p>Gostaríamos muito de saber como foi a sua jornada conosco. O que funcionou bem? O que poderia ser melhor? Leva apenas um minutinho e nos ajuda a evoluir cada vez mais!</p>
        <center>
            <a href="${process.env.FRONTEND_URL || 'https://www.yelopsi.com.br'}/feedback?psiId=${user.id}" class="btn" style="background-color: #1B4332; color: #ffffff !important; padding: 14px 28px; text-decoration: none; border-radius: 50px; font-weight: bold; display: inline-block; margin-bottom: 20px;">Avaliar a Plataforma</a>
        </center>
        <div style="background-color: #f3f4f6; padding: 15px; border-left: 4px solid #1B4332; border-radius: 4px; color: #4b5563; font-size: 0.95em;">
            Seja para compartilhar um elogio, uma crítica construtiva ou uma sugestão de nova funcionalidade, nós estamos ouvindo.
        </div>
        <p>E lembre-se: as portas da nossa comunidade estarão sempre abertas para você.</p>
    `;
    await sendEmail(user.email, title, getBaseTemplate(title, content));
};

exports.sendFeedbackRequestEmail = async (user, guestName) => {
    const title = 'Acompanhe o andamento desse contato';
    const patientText = (guestName === 'um paciente') 
        ? '<strong>Um paciente</strong> demonstrou interesse' 
        : `O paciente <strong>${guestName}</strong> demonstrou interesse`;

    const content = `
        <p>Olá, <strong>${user.nome}</strong>!</p>
        <p>${patientText} no seu perfil e iniciou um contato pelo WhatsApp.</p>
        <p>Agora, queremos saber como essa conexão evoluiu.</p>
        <p>Sua resposta leva menos de 30 segundos e ajuda a Yelo a entender quais indicações estão gerando atendimentos, tornando as próximas recomendações cada vez mais precisas.</p>
        <p>👉 Basta acessar seu painel e atualizar o status desse contato.</p>
        <center><a href="${process.env.FRONTEND_URL || 'https://www.yelopsi.com.br'}/psi/psi_dashboard" class="btn">Atualizar atendimento</a></center>
    `;
    await sendEmail(user.email, 'Um paciente demonstrou interesse no seu perfil 👋', getBaseTemplate(title, content));
};

exports.sendWeeklyPerformanceEmail = async (user, matchesCount, profileViewsCount, topTheme) => {
    const title = '📊 Veja o desempenho do seu perfil na Yelo nesta semana!';
    const destaqueText = topTheme 
        ? `Seu perfil esteve em alta nas buscas por <strong>${topTheme}</strong>.` 
        : `Seu perfil esteve em evidência na nossa rede de buscas.`;

    const content = `
        <p>Olá, <strong>${user.nome.split(' ')[0]}</strong>, tudo bem?</p>
        <p>Acreditamos que a gestão do seu consultório precisa ser transparente. Por isso, reunimos os dados de visibilidade do seu perfil na Yelo nos últimos 7 dias.</p>
        <p>Mesmo quando o WhatsApp não toca, a plataforma continua trabalhando para posicionar o seu nome para os pacientes certos.</p>
        
        <p><strong>Seus números desta semana:</strong></p>
        
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <p style="margin-top: 0; margin-bottom: 15px;">🎯 <strong>${matchesCount} Matches Inteligentes:</strong> Vezes em que o algoritmo cruzou a dor de um paciente com a sua especialidade.</p>
            <p style="margin-top: 0; margin-bottom: 15px;">👀 <strong>${profileViewsCount} Visualizações de Perfil:</strong> Pessoas que abriram a sua página para ler a sua biografia e formação.</p>
            <p style="margin-bottom: 0;">⭐ <strong>Destaque:</strong> ${destaqueText}</p>
        </div>

        <p><strong>O que fazer com esses números?</strong></p>
        <p>Se você teve boas visualizações, mas poucos contatos, o paciente pode estar em dúvida. Para quebrar essa barreira, experimente responder a uma pergunta anônima no nosso Fórum. Isso constrói autoridade instantânea e deixa o seu perfil em evidência para toda a comunidade.</p>
        
        <center><a href="${process.env.FRONTEND_URL || 'https://www.yelopsi.com.br'}/psi/psi_dashboard?page=psi_forum.html" class="btn">Acessar meu Hub de Evolução</a></center>
        
        <p style="margin-top: 30px;">Um abraço,<br>Equipe Yelo</p>
    `;
    await sendEmail(user.email, title, getBaseTemplate(title, content));
};

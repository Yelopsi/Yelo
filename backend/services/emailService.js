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
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8f9fa; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
        .header { background-color: #1B4332; padding: 30px 20px; text-align: center; }
        .header img { max-width: 150px; }
        .content { padding: 40px 30px; color: #333333; line-height: 1.6; font-size: 16px; }
        .footer { background-color: #f1f1f1; padding: 20px; text-align: center; color: #777777; font-size: 12px; }
        .btn { display: inline-block; padding: 14px 28px; background-color: #1B4332; color: #ffffff !important; text-decoration: none; border-radius: 50px; font-weight: bold; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="${process.env.FRONTEND_URL || 'https://www.yelopsi.com.br'}/assets/logos/logo-clara.png" alt="Yelo">
        </div>
        <div class="content">
            <h2 style="color: #1B4332; margin-top: 0;">${title}</h2>
            ${content}
        </div>
        <div class="footer">
            <p>Você está recebendo este e-mail porque está cadastrado na Yelo.</p>
            <p>© ${new Date().getFullYear()} Yelo - Apoio Psicológico. Todos os direitos reservados.</p>
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
    const title = 'Nova Fatura Disponível';
    const content = `
        <p>Olá, <strong>${user.nome}</strong>!</p>
        <p>Uma nova fatura no valor de <strong>R$ ${valor}</strong> foi gerada e o vencimento é dia <strong>${vencimento}</strong>.</p>
        <center><a href="${payment.invoiceUrl}" class="btn">Visualizar Fatura</a></center>
    `;
    await sendEmail(user.email, 'Nova Fatura Disponível - Yelo', getBaseTemplate(title, content));
};

exports.sendDueDateWarningEmail = async (user, payment) => {
    const valor = parseFloat(payment.value).toFixed(2).replace('.', ',');
    const vencimento = payment.dueDate.split('-').reverse().join('/');
    const title = 'Sua fatura vence em breve';
    const content = `
        <p>Olá, <strong>${user.nome}</strong>!</p>
        <p>Apenas um lembrete de que sua fatura de <strong>R$ ${valor}</strong> vence no dia <strong>${vencimento}</strong>.</p>
        <center><a href="${payment.invoiceUrl}" class="btn">Pagar Fatura</a></center>
    `;
    await sendEmail(user.email, 'Lembrete: Sua fatura vence em breve', getBaseTemplate(title, content));
};

exports.sendDigitableLineEmail = async (user, payment) => {
    const linha = payment.nossoNumero || "Acesse sua fatura para ver o código copia e cola"; 
    const valor = parseFloat(payment.value).toFixed(2).replace('.', ',');
    const title = 'Sua fatura vence hoje';
    const content = `
        <p>Olá, <strong>${user.nome}</strong>.</p>
        <p>Sua fatura no valor de <strong>R$ ${valor}</strong> vence hoje. Para facilitar, aqui está o código copia e cola:</p>
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 14px; margin: 15px 0; word-break: break-all; text-align: center; border: 1px dashed #ccc;">
            <strong>${linha}</strong>
        </div>
        <center><a href="${payment.invoiceUrl}" class="btn">Visualizar Fatura</a></center>
    `;
    await sendEmail(user.email, 'Sua fatura vence hoje - Yelo', getBaseTemplate(title, content));
};

exports.sendOverdueEmail = async (user, payment) => {
    const title = 'Aviso de Fatura em Aberto';
    const content = `
        <p>Olá, <strong>${user.nome}</strong>.</p>
        <p>Não identificamos o pagamento da sua última fatura. Para evitar a suspensão do seu perfil nas buscas da plataforma, regularize sua situação o quanto antes.</p>
        <center><a href="${payment.invoiceUrl}" class="btn">Regularizar Pagamento</a></center>
    `;
    await sendEmail(user.email, 'Aviso de Fatura em Aberto - Yelo', getBaseTemplate(title, content));
};

exports.sendBillUpdatedEmail = async (user, payment) => {
    const valor = parseFloat(payment.value).toFixed(2).replace('.', ',');
    const title = 'Atualização na sua Fatura';
    const content = `
        <p>Sua fatura foi atualizada para o valor de <strong>R$ ${valor}</strong>.</p>
        <center><a href="${payment.invoiceUrl}" class="btn">Visualizar Alterações</a></center>
    `;
    await sendEmail(user.email, 'Atualização na sua Fatura - Yelo', getBaseTemplate(title, content));
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
    const content = `
        <p>Olá, <strong>${user.nome}</strong>!</p>
        <p>Seu pagamento de <strong>R$ ${valor}</strong> referente ao plano <strong>${plano}</strong> foi confirmado com sucesso.</p>
        <p>Seu perfil já está ativo e visível nas buscas de pacientes da Yelo.</p>
        <center><a href="${process.env.FRONTEND_URL || 'https://www.yelopsi.com.br'}/login" class="btn">Acessar Meu Painel</a></center>
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

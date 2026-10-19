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
// O SEGREDO: TEMPLATE BASE MODERNO YELO (Design Editorial & Acolhedor 2026)
// ============================================================================
const getBaseTemplate = (title, content, options = {}) => {
    const frontendUrl = process.env.FRONTEND_URL || 'https://www.yelopsi.com.br';
    const tagText = options.tagText || '';
    const preheader = options.preheader || title;
    const year = new Date().getFullYear();

    return `<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>${title}</title>
    <!--[if mso]>
    <style>
        table {border-collapse:collapse;border-spacing:0;margin:0;}
        div, td {padding:0;}
        div {margin:0 !important;}
    </style>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
            <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->
    <style>
        html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: 100% !important;
            width: 100% !important;
            background-color: #FAF8F5 !important;
            -webkit-text-size-adjust: 100%;
            -ms-text-size-adjust: 100%;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        }
        table, td {
            mso-table-lspace: 0pt;
            mso-table-rspace: 0pt;
        }
        img {
            border: 0;
            height: auto;
            line-height: 100%;
            outline: none;
            text-decoration: none;
            -ms-interpolation-mode: bicubic;
        }
        .email-title {
            font-family: Georgia, 'New Kansas', 'Times New Roman', serif !important;
            color: #1B4332 !important;
            font-size: 25px !important;
            line-height: 1.3 !important;
            font-weight: 700 !important;
            margin: 0 0 18px 0 !important;
            letter-spacing: -0.3px !important;
        }
        .email-body p, .content p, p {
            color: #4A5568 !important;
            font-size: 15px !important;
            line-height: 1.68 !important;
            margin: 0 0 16px 0 !important;
        }
        .tag-pill {
            display: inline-block;
            background-color: #F0FDF4;
            color: #166534;
            border: 1px solid #BBF7D0;
            padding: 5px 14px;
            border-radius: 50px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.4px;
            text-transform: uppercase;
            margin-bottom: 16px;
        }
        .btn, .btn-yelo {
            display: inline-block !important;
            padding: 14px 34px !important;
            background-color: #1B4332 !important;
            color: #FFFFFF !important;
            text-decoration: none !important;
            border-radius: 50px !important;
            font-weight: 600 !important;
            font-size: 15px !important;
            text-align: center !important;
            box-shadow: 0 4px 14px rgba(27, 67, 50, 0.18) !important;
            mso-padding-alt: 0;
        }
        .btn:hover, .btn-yelo:hover {
            background-color: #2D6A4F !important;
        }
        .btn-container {
            text-align: center;
            margin: 28px 0 16px 0;
        }
        .highlight-box {
            background-color: #F8FAF7;
            border: 1px solid #E2EADF;
            border-radius: 16px;
            padding: 20px;
            margin: 24px 0;
        }
        .highlight-code {
            font-family: monospace;
            font-size: 13px;
            color: #1B4332;
            word-break: break-all;
            margin-top: 10px;
            font-weight: bold;
            background: #FFFFFF;
            padding: 12px 14px;
            border-radius: 8px;
            border: 1px solid #CBD5E1;
        }
        @media only screen and (max-width: 600px) {
            .email-container {
                width: 100% !important;
                max-width: 100% !important;
                border-radius: 0 !important;
                border-left: none !important;
                border-right: none !important;
            }
            .content-padding {
                padding: 26px 18px !important;
            }
            .email-title {
                font-size: 22px !important;
            }
            .btn, .btn-yelo {
                display: block !important;
                width: 100% !important;
                box-sizing: border-box !important;
                padding: 14px 18px !important;
            }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #FAF8F5;">

    <div style="display: none; font-size: 1px; color: #FAF8F5; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
        ${preheader}
    </div>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #FAF8F5; table-layout: fixed;">
        <tr>
            <td align="center" style="padding: 35px 12px;">
                
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-container" style="max-width: 600px; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; border: 1px solid #EAE5DC; box-shadow: 0 10px 30px rgba(27, 67, 50, 0.04);">
                    
                    <tr>
                        <td style="height: 5px; background: linear-gradient(90deg, #1B4332 0%, #2D6A4F 65%, #FFEE8C 100%); font-size: 0; line-height: 0;">&nbsp;</td>
                    </tr>

                    <tr>
                        <td align="center" style="padding: 30px 35px 18px 35px; border-bottom: 1px solid #F5F1EB;">
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td align="left">
                                        <img src="${frontendUrl}/assets/logos/logo-escura.png" alt="Yelo" width="112" style="display: block; max-width: 112px; height: auto;" />
                                    </td>
                                    <td align="right">
                                        <span style="font-size: 11px; font-weight: 600; color: #8C8275; letter-spacing: 0.5px; text-transform: uppercase;">Apoio Psicológico</span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <tr>
                        <td class="content-padding" style="padding: 34px 35px 28px 35px;">
                            ${tagText ? `<div><span class="tag-pill">${tagText}</span></div>` : ''}
                            <h1 class="email-title">${title}</h1>
                            <div class="email-body" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                                ${content}
                            </div>

                            <div style="margin-top: 32px; padding-top: 22px; border-top: 1px solid #F5F1EB;">
                                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                    <tr>
                                        <td>
                                            <p style="margin: 0; font-size: 14px; color: #1B4332; font-weight: 600;">Com carinho,</p>
                                            <p style="margin: 2px 0 0 0; font-size: 13px; color: #718096;">Equipe Yelo • Apoio ao Psicólogo</p>
                                        </td>
                                        <td align="right">
                                            <span style="font-size: 20px;">💛</span>
                                        </td>
                                    </tr>
                                </table>
                            </div>
                        </td>
                    </tr>

                    <tr>
                        <td style="background-color: #FAF8F5; padding: 24px 35px; text-align: center; border-top: 1px solid #EAE5DC;">
                            <p style="margin: 0 0 12px 0; font-size: 12px; color: #718096; font-weight: 500;">
                                <a href="${frontendUrl}/login" style="color: #1B4332; text-decoration: underline; font-weight: 600;">Meu Consultório</a> &nbsp;&bull;&nbsp;
                                <a href="${frontendUrl}/psi/psi_dashboard?page=psi_forum.html" style="color: #1B4332; text-decoration: underline; font-weight: 600;">Fórum de Psicólogos</a> &nbsp;&bull;&nbsp;
                                <a href="${frontendUrl}/ajuda" style="color: #1B4332; text-decoration: underline; font-weight: 600;">Central de Ajuda</a>
                            </p>
                            <p style="margin: 0 0 6px 0; font-size: 12px; color: #A0AEC0; line-height: 1.5;">
                                Você está recebendo este e-mail porque possui cadastro profissional na Yelo.
                            </p>
                            <p style="margin: 0; font-size: 11px; color: #CBD5E1;">
                                &copy; ${year} Yelo &bull; Apoio Psicológico e Saúde Mental. Todos os direitos reservados.
                            </p>
                        </td>
                    </tr>

                </table>

            </td>
        </tr>
    </table>
</body>
</html>`;
};

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
exports.getBaseTemplate = getBaseTemplate;

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
    const title = 'Veja como o seu perfil repercutiu nesta semana ✨';
    const destaqueText = topTheme 
        ? `Seu consultório esteve em destaque em buscas por <strong>${topTheme}</strong>.` 
        : `Seu consultório esteve em evidência nas buscas qualificadas da nossa rede.`;

    const content = `
        <p>Olá, <strong>${user.nome.split(' ')[0]}</strong>, tudo bem?</p>
        <p>Acreditamos que a gestão do seu consultório precisa ser transparente e leve. Por isso, reunimos os dados de posicionamento do seu perfil na Yelo nos últimos 7 dias.</p>
        <p>Mesmo quando o WhatsApp não toca imediatamente, a plataforma continua trabalhando ativamente para conectar seu nome aos pacientes certos.</p>
        
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 22px 0 16px 0;">
            <tr>
                <td width="48%" style="background-color: #F8FAF7; border: 1px solid #E2EADF; border-radius: 14px; padding: 16px 18px; vertical-align: top;">
                    <span style="font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">🎯 Matches Inteligentes</span>
                    <div style="font-size: 28px; font-weight: 800; color: #1B4332; margin: 6px 0 2px 0;">${matchesCount}</div>
                    <p style="margin: 0; font-size: 12px; color: #64748B; line-height: 1.4;">Pacientes cujo momento clínico combinou com sua especialidade.</p>
                </td>
                <td width="4%">&nbsp;</td>
                <td width="48%" style="background-color: #F8FAF7; border: 1px solid #E2EADF; border-radius: 14px; padding: 16px 18px; vertical-align: top;">
                    <span style="font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">👀 Visualizações</span>
                    <div style="font-size: 28px; font-weight: 800; color: #1B4332; margin: 6px 0 2px 0;">${profileViewsCount}</div>
                    <p style="margin: 0; font-size: 12px; color: #64748B; line-height: 1.4;">Acessos completos à sua página profissional e horários.</p>
                </td>
            </tr>
        </table>

        <div style="background-color: #FEF9EE; border: 1px solid #FDE68A; border-radius: 12px; padding: 14px 18px; margin-bottom: 24px;">
            <p style="margin: 0; font-size: 13px; color: #92400E; font-weight: 500;">
                ⭐ <strong>Destaque da semana:</strong> ${destaqueText}
            </p>
        </div>

        <p style="font-weight: 600; color: #1B4332; margin-bottom: 8px;">Dica para impulsionar suas conexões:</p>
        <p>Se você teve boas visualizações, responder a perguntas de pacientes ou colegas no Fórum constrói autoridade instantânea e deixa o seu perfil em evidência para toda a comunidade.</p>
        
        <div class="btn-container">
            <a href="${process.env.FRONTEND_URL || 'https://www.yelopsi.com.br'}/psi/psi_dashboard?page=psi_forum.html" class="btn">Acessar Meu Hub de Evolução &rarr;</a>
        </div>
    `;
    await sendEmail(user.email, '📊 Veja o desempenho do seu perfil na Yelo nesta semana!', getBaseTemplate(title, content, { tagText: '● Relatório Semanal' }));
};

exports.sendQuestionAnsweredEmail = async (email, slug) => {
    const title = "Sua dúvida foi respondida! 🎉";
    const linkDaResposta = `${process.env.FRONTEND_URL || 'https://www.yelopsi.com.br'}/perguntas/${slug}`;
    const content = `
        <p>Olá,</p>
        <p>Um de nossos especialistas acabou de responder a sua pergunta na comunidade Yelo.</p>
        <p>Você pode conferir a resposta completa e o perfil do profissional clicando no botão abaixo:</p>
        <center><a href="${linkDaResposta}" class="btn">Ver a resposta</a></center>
        <p style="margin-top: 30px;">Esperamos que isso te ajude. Obrigado por participar da nossa comunidade!</p>
        <p>Com carinho,<br>Equipe Yelo</p>
    `;
    await sendEmail(email, title, getBaseTemplate(title, content));
};

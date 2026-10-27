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
    const tagColor = options.tagColor || '#F0FDF4';
    const preheader = options.preheader || title;
    const year = new Date().getFullYear();
    const toEmail = options.toEmail || '';
    const unsubUrl = toEmail ? `${frontendUrl}/unsubscribe?email=${encodeURIComponent(toEmail)}` : `${frontendUrl}/unsubscribe`;
    const subUrl = toEmail ? `${frontendUrl}/subscribe?email=${encodeURIComponent(toEmail)}` : `${frontendUrl}/subscribe`;

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
        .outer-cell {
            padding: 28px 12px 28px 12px;
        }
        @media only screen and (max-width: 600px) {
            .outer-cell {
                padding: 16px 8px 16px 8px !important;
            }
            .email-container {
                width: 100% !important;
                max-width: 100% !important;
                border-radius: 16px !important;
            }
            .content-padding {
                padding: 24px 16px !important;
            }
            .email-title {
                font-size: 22px !important;
            }
            .kpi-table, .kpi-table tbody, .kpi-row {
                display: block !important;
                width: 100% !important;
            }
            .kpi-col {
                display: block !important;
                width: 100% !important;
                box-sizing: border-box !important;
                margin-bottom: 12px !important;
            }
            .kpi-spacer {
                display: none !important;
                width: 0 !important;
                height: 0 !important;
                font-size: 0 !important;
                line-height: 0 !important;
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
            <td align="center" class="outer-cell">
                
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
                            ${tagText ? `<div><span class="tag-pill" style="background-color: ${tagColor}; border-color: ${tagColor === '#FEF3C7' ? '#FDE68A' : '#BBF7D0'}; color: ${tagColor === '#FEF3C7' ? '#92400E' : '#166534'};">${tagText}</span></div>` : ''}
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
                        <td style="background-color: #FAF8F5; padding: 22px 28px; text-align: center; border-top: 1px solid #EAE5DC;">
                            <p style="margin: 0 0 12px 0; font-size: 12px; color: #718096; font-weight: 500;">
                                <a href="${frontendUrl}/login" target="_blank" rel="noopener noreferrer" style="color: #1B4332; text-decoration: underline; font-weight: 600;">Meu Consultório</a> &nbsp;&bull;&nbsp;
                                <a href="${frontendUrl}/psi/psi_dashboard?page=psi_forum.html" target="_blank" rel="noopener noreferrer" style="color: #1B4332; text-decoration: underline; font-weight: 600;">Fórum de Psicólogos</a> &nbsp;&bull;&nbsp;
                                <a href="${frontendUrl}/ajuda" target="_blank" rel="noopener noreferrer" style="color: #1B4332; text-decoration: underline; font-weight: 600;">Central de Ajuda</a>
                            </p>
                            <p style="margin: 0 0 6px 0; font-size: 12px; color: #A0AEC0; line-height: 1.5;">
                                Você está recebendo este e-mail porque possui cadastro profissional na plataforma Yelo.
                            </p>
                            <p style="margin: 0 0 12px 0; font-size: 11px; color: #718096; line-height: 1.5;">
                                Deseja pausar notificações ou cancelar o recebimento? 
                                <a href="${unsubUrl}" target="_blank" rel="noopener noreferrer" style="color: #1B4332; text-decoration: underline; font-weight: 600;">Cancelar inscrição (Unsubscribe)</a>
                                &nbsp;&bull;&nbsp;
                                <a href="${subUrl}" target="_blank" rel="noopener noreferrer" style="color: #1B4332; text-decoration: underline; font-weight: 600;">Gerenciar Inscrição (Subscribe)</a>
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
        const frontendUrl = process.env.FRONTEND_URL || 'https://www.yelopsi.com.br';
        const unsubUrl = `${frontendUrl}/unsubscribe?email=${encodeURIComponent(to)}`;
        await transporter.sendMail({
            from: process.env.EMAIL_FROM || '"Yelo Saúde Mental" <contato@yelopsi.com.br>', 
            to,
            subject,
            html,
            headers: {
                'List-Unsubscribe': `<${unsubUrl}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
            }
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

const emailCtaBtn = (url, label) => `
        <div class="btn-container">
            <a href="${url}" target="_blank" rel="noopener noreferrer" class="btn" style="display: inline-block; padding: 14px 34px; background-color: #1B4332; color: #FFFFFF !important; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 15px;">${label} &rarr;</a>
        </div>
`;
exports.emailCtaBtn = emailCtaBtn;

const getPsiFirstName = (userOrName) => {
    const raw = typeof userOrName === 'string' ? userOrName : (userOrName?.nome || '');
    if (!raw) return 'Profissional';
    const cleaned = raw.trim().replace(/^(dr\(a\)\.?|dra?\.?)\s+/i, '');
    return cleaned.split(' ')[0] || 'Profissional';
};

exports.sendBillCreatedEmail = async (user, payment) => {
    const valor = parseFloat(payment.value || 99).toFixed(2).replace('.', ',');
    const vencimento = payment.dueDate ? payment.dueDate.split('-').reverse().join('/') : 'Em aberto';
    const title = 'Sua fatura da Yelo está disponível 💳';
    const psiName = getPsiFirstName(user);
    const invoiceUrl = payment.invoiceUrl || `${process.env.FRONTEND_URL || 'https://www.yelopsi.com.br'}/login`;
    
    let pixBlock = '';
    const pixCode = payment.pixTransaction || payment.payload;
    if (pixCode) {
        pixBlock = `
            <div style="margin-top: 18px; padding-top: 16px; border-top: 1px dashed #CBD5E1;">
                <p style="margin: 0 0 8px 0; font-size: 12px; color: #475569; font-weight: 600;">Código PIX Copia e Cola:</p>
                <div style="background: #FFFFFF; border: 1px solid #CBD5E1; border-radius: 8px; padding: 10px 14px; font-family: monospace; font-size: 12px; color: #1B4332; word-break: break-all;">
                    ${pixCode}
                </div>
            </div>
        `;
    }

    const content = `
        <p>Olá, <strong>${psiName}</strong>!</p>
        <p>A sua fatura mensal referente à assinatura do ecossistema Yelo já foi gerada e está pronta para pagamento seguro.</p>
        <p>Mantendo sua assinatura em dia, seu perfil continua ativo nas buscas e com acesso completo ao Fórum exclusivo de psicólogos.</p>
        
        <div style="background-color: #FAF8F5; border: 1px solid #EAE5DC; border-radius: 16px; padding: 22px; margin: 24px 0;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                    <td>
                        <span style="font-size: 12px; font-weight: 600; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px;">Valor da Mensalidade</span>
                        <div style="font-size: 32px; font-weight: 800; color: #1B4332; margin: 4px 0;">R$ ${valor}</div>
                    </td>
                    <td align="right" style="vertical-align: middle;">
                        <span style="background-color: #FEF3C7; color: #92400E; font-size: 12px; font-weight: 700; padding: 6px 14px; border-radius: 50px; display: inline-block; white-space: nowrap;">
                            Vence em ${vencimento}
                        </span>
                    </td>
                </tr>
            </table>
            ${pixBlock}
        </div>

        ${emailCtaBtn(invoiceUrl, 'Visualizar e Pagar Fatura')}
    `;
    await sendEmail(user.email, '💳 Sua fatura da Yelo está disponível', getBaseTemplate(title, content, {
        tagText: '● Fatura Disponível',
        tagColor: '#F1F5F9',
        toEmail: user.email
    }));
};

exports.sendDueDateWarningEmail = async (user, payment) => {
    const valor = parseFloat(payment.value || 99).toFixed(2).replace('.', ',');
    const vencimento = payment.dueDate ? payment.dueDate.split('-').reverse().join('/') : 'Hoje';
    const title = 'Sua fatura da Yelo vence hoje ⚠️';
    const psiName = getPsiFirstName(user);
    const invoiceUrl = payment.invoiceUrl || `${process.env.FRONTEND_URL || 'https://www.yelopsi.com.br'}/login`;

    const content = `
        <p>Olá, <strong>${psiName}</strong>!</p>
        <p>Este é um lembrete amigável de que o vencimento da sua mensalidade referente à assinatura da Yelo é <strong>hoje</strong>.</p>
        <p>Mantendo sua assinatura regular, seu consultório permanece em destaque nas buscas inteligentes e conectado a novos pacientes.</p>

        <div style="background-color: #FAF8F5; border: 1px solid #EAE5DC; border-radius: 16px; padding: 22px; margin: 24px 0;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                    <td>
                        <span style="font-size: 12px; font-weight: 600; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px;">Valor da Mensalidade</span>
                        <div style="font-size: 32px; font-weight: 800; color: #1B4332; margin: 4px 0;">R$ ${valor}</div>
                    </td>
                    <td align="right" style="vertical-align: middle;">
                        <span style="background-color: #FEF3C7; color: #92400E; font-size: 12px; font-weight: 700; padding: 6px 14px; border-radius: 50px; display: inline-block; white-space: nowrap;">
                            Vence Hoje (${vencimento})
                        </span>
                    </td>
                </tr>
            </table>
        </div>

        ${emailCtaBtn(invoiceUrl, 'Visualizar e Pagar Fatura')}
    `;
    await sendEmail(user.email, '⚠️ Sua fatura da Yelo vence HOJE', getBaseTemplate(title, content, {
        tagText: '● Vence Hoje',
        tagColor: '#FEF3C7',
        toEmail: user.email
    }));
};

exports.sendDigitableLineEmail = async (user, payment) => {
    let linha = payment.pixTransaction || payment.nossoNumero || "Acesse sua fatura para ver o código de pagamento";
    const valor = parseFloat(payment.value || 99).toFixed(2).replace('.', ',');
    const vencimento = payment.dueDate ? payment.dueDate.split('-').reverse().join('/') : 'Hoje';
    const title = 'Código para pagamento da sua fatura Yelo 💳';
    const psiName = getPsiFirstName(user);
    const invoiceUrl = payment.invoiceUrl || `${process.env.FRONTEND_URL || 'https://www.yelopsi.com.br'}/login`;
    
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

    const isPix = payment.billingType === 'PIX';
    const codeLabel = isPix ? 'Código PIX Copia e Cola' : 'Linha Digitável do Boleto';

    const content = `
        <p>Olá, <strong>${psiName}</strong>!</p>
        <p>Para facilitar o seu dia a dia, preparamos o código direto para pagamento da sua fatura que vence <strong>hoje</strong>.</p>
        
        <div style="background-color: #FAF8F5; border: 1px solid #EAE5DC; border-radius: 16px; padding: 22px; margin: 24px 0;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                    <td>
                        <span style="font-size: 12px; font-weight: 600; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px;">Valor a Pagar</span>
                        <div style="font-size: 32px; font-weight: 800; color: #1B4332; margin: 4px 0;">R$ ${valor}</div>
                    </td>
                    <td align="right" style="vertical-align: middle;">
                        <span style="background-color: #FEF3C7; color: #92400E; font-size: 12px; font-weight: 700; padding: 6px 14px; border-radius: 50px; display: inline-block; white-space: nowrap;">
                            Vence Hoje (${vencimento})
                        </span>
                    </td>
                </tr>
            </table>

            <div style="margin-top: 18px; padding-top: 16px; border-top: 1px dashed #CBD5E1;">
                <p style="margin: 0 0 8px 0; font-size: 12px; color: #475569; font-weight: 600;">${codeLabel}:</p>
                <div class="highlight-code">
                    ${linha}
                </div>
            </div>
        </div>

        <p style="font-size: 13px; color: #64748B; text-align: center;">Copie o código acima e cole diretamente no aplicativo do seu banco.</p>

        ${emailCtaBtn(invoiceUrl, 'Abrir Fatura Completa')}
    `;
    await sendEmail(user.email, '💳 Código de Pagamento: Sua fatura Yelo vence hoje', getBaseTemplate(title, content, {
        tagText: isPix ? '● PIX Vence Hoje' : '● Boleto Vence Hoje',
        tagColor: '#FEF3C7',
        toEmail: user.email
    }));
};

exports.sendOverdueEmail = async (user, payment) => {
    const valor = parseFloat(payment.value || 99).toFixed(2).replace('.', ',');
    const vencimento = payment.dueDate ? payment.dueDate.split('-').reverse().join('/') : 'Em atraso';
    const title = 'Ação Necessária: Fatura Yelo em atraso ⚠️';
    const psiName = getPsiFirstName(user);
    const invoiceUrl = payment.invoiceUrl || `${process.env.FRONTEND_URL || 'https://www.yelopsi.com.br'}/login`;

    const content = `
        <p>Olá, <strong>${psiName}</strong>.</p>
        <p>Ainda não identificamos a compensação da sua fatura mensal referente à assinatura do seu consultório na Yelo.</p>
        
        <div style="background-color: #FEF2F2; border: 1px solid #FECACA; border-radius: 16px; padding: 22px; margin: 24px 0;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                    <td>
                        <span style="font-size: 12px; font-weight: 600; color: #991B1B; text-transform: uppercase; letter-spacing: 0.5px;">Fatura Pendente</span>
                        <div style="font-size: 32px; font-weight: 800; color: #7F1D1D; margin: 4px 0;">R$ ${valor}</div>
                    </td>
                    <td align="right" style="vertical-align: middle;">
                        <span style="background-color: #FEE2E2; color: #991B1B; font-size: 12px; font-weight: 700; padding: 6px 14px; border-radius: 50px; display: inline-block; white-space: nowrap;">
                            Venceu em ${vencimento}
                        </span>
                    </td>
                </tr>
            </table>
            <p style="margin: 14px 0 0 0; font-size: 13px; color: #991B1B; line-height: 1.5;">
                Para evitar a pausa temporária do seu perfil nas buscas públicas e garantir que você continue recebendo contatos de pacientes, por favor regularize sua assinatura pelo botão abaixo.
            </p>
        </div>

        <p style="font-size: 13px; color: #64748B;"><em>(Se a cobrança PIX estiver expirada no link, o sistema gerará um novo código imediatamente ao acessar a tela de assinatura ou trocar a forma de pagamento).</em></p>

        ${emailCtaBtn(invoiceUrl, 'Regularizar Assinatura Agora')}
    `;
    await sendEmail(user.email, 'Ação Necessária: Fatura Yelo em atraso', getBaseTemplate(title, content, {
        tagText: '● Regularização Pendente',
        tagColor: '#FEF2F2',
        toEmail: user.email
    }));
};

exports.sendBillUpdatedEmail = async (user, payment) => {
    const valor = parseFloat(payment.value || 99).toFixed(2).replace('.', ',');
    const vencimento = payment.dueDate ? payment.dueDate.split('-').reverse().join('/') : 'Atualizado';
    const title = 'Atualização na sua fatura da Yelo ✨';
    const psiName = getPsiFirstName(user);
    const invoiceUrl = payment.invoiceUrl || `${process.env.FRONTEND_URL || 'https://www.yelopsi.com.br'}/login`;

    const content = `
        <p>Olá, <strong>${psiName}</strong>.</p>
        <p>Informamos que os dados da sua fatura foram atualizados no sistema (novo vencimento ou ajuste de valor).</p>
        
        <div style="background-color: #FAF8F5; border: 1px solid #EAE5DC; border-radius: 16px; padding: 22px; margin: 24px 0;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                    <td>
                        <span style="font-size: 12px; font-weight: 600; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px;">Novo Valor</span>
                        <div style="font-size: 32px; font-weight: 800; color: #1B4332; margin: 4px 0;">R$ ${valor}</div>
                    </td>
                    <td align="right" style="vertical-align: middle;">
                        <span style="background-color: #F1F5F9; color: #334155; font-size: 12px; font-weight: 700; padding: 6px 14px; border-radius: 50px; display: inline-block; white-space: nowrap;">
                            Novo Vencimento: ${vencimento}
                        </span>
                    </td>
                </tr>
            </table>
        </div>

        <p>Acesse o link seguro abaixo para conferir os detalhes e efetuar o pagamento atualizado:</p>

        ${emailCtaBtn(invoiceUrl, 'Visualizar Fatura Atualizada')}
    `;
    await sendEmail(user.email, 'Atualização na sua fatura da Yelo', getBaseTemplate(title, content, {
        tagText: '● Fatura Atualizada',
        tagColor: '#F1F5F9',
        toEmail: user.email
    }));
};

exports.sendInvitationEmail = async (candidate, invitationLink) => {
    const title = 'Uma vaga foi liberada para o seu consultório 🎉';
    const candidateName = candidate.nome ? candidate.nome.split(' ')[0] : 'Profissional';

    const content = `
        <p>Olá, <strong>${candidateName}</strong>!</p>
        <p>Temos uma excelente notícia para você: uma vaga foi aberta para a sua especialidade clínica no ecossistema da Yelo Psi.</p>
        <p>Nossa plataforma conecta você a pacientes qualificados através de um algoritmo ético de afinidade terapêutica, além de dar acesso ao Fórum exclusivo de psicólogos.</p>
        
        <div style="background-color: #F8FAF7; border: 1px solid #E2EADF; border-radius: 16px; padding: 22px; margin: 24px 0;">
            <strong style="color: #1B4332; font-size: 14px; display: block; margin-bottom: 8px;">O que te espera na Yelo:</strong>
            <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.6;">
                • Perfil público otimizado com biografia, abordagem e horários.<br>
                • Contatos diretos de pacientes sem comissões intermediárias.<br>
                • Comunidade exclusiva de discussão e troca clínica.
            </p>
        </div>

        <p>O seu link de acesso exclusivo é válido por 7 dias. Clique abaixo para concluir o seu cadastro:</p>

        ${emailCtaBtn(invitationLink, 'Concluir Meu Cadastro')}
    `;
    await sendEmail(candidate.email, '🎉 Seu convite para a Yelo chegou!', getBaseTemplate(title, content, {
        tagText: '🎉 Convite Exclusivo',
        tagColor: '#F0FDF4',
        toEmail: candidate.email
    }));
};

exports.sendPaymentConfirmationEmail = async (user, planType, value) => {
    const valor = parseFloat(value || 99).toFixed(2).replace('.', ',');
    const plano = planType || 'Ecossistema Yelo';
    const title = 'Pagamento Confirmado com Sucesso! ✅';
    const psiName = getPsiFirstName(user);
    const loginUrl = `${process.env.FRONTEND_URL || 'https://www.yelopsi.com.br'}/login`;

    const content = `
        <p>Olá, <strong>${psiName}</strong>!</p>
        <p>Confirmamos o recebimento do pagamento da sua assinatura. Muito obrigado pela confiança e por fazer parte da comunidade Yelo.</p>
        
        <div style="background-color: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 16px; padding: 22px; margin: 24px 0;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                    <td>
                        <span style="font-size: 12px; font-weight: 600; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">Assinatura Ativa</span>
                        <div style="font-size: 30px; font-weight: 800; color: #1B4332; margin: 4px 0;">R$ ${valor}</div>
                        <p style="margin: 4px 0 0 0; font-size: 13px; color: #166534; font-weight: 600;">Plano ${plano}</p>
                    </td>
                    <td align="right" style="vertical-align: middle;">
                        <span style="background-color: #DCFCE7; color: #15803D; font-size: 12px; font-weight: 700; padding: 6px 14px; border-radius: 50px; display: inline-block;">
                            ● Perfil Ativo
                        </span>
                    </td>
                </tr>
            </table>
        </div>

        <p>O seu perfil segue 100% ativo e visível nas buscas de pacientes, e suas ferramentas de gestão de consultório estão liberadas.</p>

        ${emailCtaBtn(loginUrl, 'Acessar Meu Consultório')}
    `;
    await sendEmail(user.email, '✅ Pagamento Confirmado - Yelo', getBaseTemplate(title, content, {
        tagText: '✅ Assinatura Confirmada',
        tagColor: '#F0FDF4',
        toEmail: user.email
    }));
};

exports.sendPaymentFailedEmail = async (user, invoiceUrl) => {
    const link = invoiceUrl || `${process.env.FRONTEND_URL || 'https://www.yelopsi.com.br'}/login`;
    const title = 'Ação Necessária: Falha no processamento da assinatura ⚠️';
    const psiName = getPsiFirstName(user);

    const content = `
        <p>Olá, <strong>${psiName}</strong>.</p>
        <p>Houve uma falha ao tentar processar a cobrança da sua mensalidade no cartão de crédito cadastrado.</p>
        
        <div style="background-color: #FEF2F2; border: 1px solid #FECACA; border-radius: 16px; padding: 22px; margin: 24px 0;">
            <p style="margin: 0; font-size: 14px; color: #991B1B; font-weight: 600;">
                O que acontece agora?
            </p>
            <p style="margin: 8px 0 0 0; font-size: 13px; color: #7F1D1D; line-height: 1.5;">
                Para que sua visibilidade para novos pacientes não seja interrompida, por favor acesse o link abaixo para atualizar os dados do cartão ou efetuar o pagamento via PIX.
            </p>
        </div>

        ${emailCtaBtn(link, 'Atualizar Cartão ou Pagar')}
    `;
    await sendEmail(user.email, 'Ação Necessária: Falha no Pagamento da Assinatura', getBaseTemplate(title, content, {
        tagText: '⚠️ Falha no Pagamento',
        tagColor: '#FEF2F2',
        toEmail: user.email
    }));
};

exports.sendSubscriptionCancelledEmail = async (user) => {
    const title = 'Sua assinatura foi pausada 💛';
    const psiName = getPsiFirstName(user);
    const feedbackUrl = `${process.env.FRONTEND_URL || 'https://www.yelopsi.com.br'}/feedback?psiId=${user.id}`;
    const reactivateUrl = `${process.env.FRONTEND_URL || 'https://www.yelopsi.com.br'}/login`;

    const content = `
        <p>Olá, <strong>${psiName}</strong>,</p>
        <p>Confirmamos o cancelamento da renovação automática da sua assinatura. Seu perfil deixará de ser exibido nas buscas ao término do período vigente já pago.</p>
        
        <div style="background-color: #F8FAF7; border: 1px solid #E2EADF; border-radius: 16px; padding: 22px; margin: 24px 0;">
            <strong style="color: #1B4332; font-size: 14px; display: block; margin-bottom: 6px;">Como foi sua experiência?</strong>
            <p style="margin: 0 0 14px 0; font-size: 13px; color: #475569; line-height: 1.5;">
                Sua percepção é muito valiosa para continuarmos aprimorando a Yelo para toda a comunidade. Leva menos de 1 minuto para nos contar o que podemos melhorar:
            </p>
            <a href="${feedbackUrl}" target="_blank" rel="noopener noreferrer" style="color: #166534; font-weight: 700; text-decoration: underline; font-size: 13px;">👉 Deixar meu Feedback Rápido</a>
        </div>

        <p>Se em qualquer momento você desejar voltar a expandir seus atendimentos conosco, nossas portas estarão sempre abertas.</p>

        ${emailCtaBtn(reactivateUrl, 'Reativar Meu Consultório')}
    `;
    await sendEmail(user.email, 'Sua Assinatura na Yelo foi Cancelada', getBaseTemplate(title, content, {
        tagText: '● Assinatura Pausada',
        tagColor: '#F1F5F9',
        toEmail: user.email
    }));
};

exports.sendWelcomeEmail = async (user, type) => {
    if (type === 'psychologist' || !type) {
        const psiName = getPsiFirstName(user);
        const title = 'Seu consultório na Yelo está pronto para nascer ✨';
        const content = `
            <p>Olá, <strong>${psiName}</strong>!</p>
            <p>Estamos muito felizes em receber você no ecossistema Yelo Psi. Nosso compromisso é conectar a sua prática clínica a pacientes que realmente valorizam seu método e abordagem terapêutica.</p>
            <p>Para que o nosso algoritmo de match inteligente comece a direcionar pacientes qualificados para a sua agenda, o primeiro passo é concluir o preenchimento do seu perfil profissional.</p>
            
            <div style="background-color: #F8FAF7; border: 1px solid #E2EADF; border-radius: 16px; padding: 22px; margin: 24px 0;">
                <strong style="color: #1B4332; font-size: 14px; display: block; margin-bottom: 12px;">Próximos passos recomendados:</strong>
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                        <td width="26" style="vertical-align: top; font-size: 14px;">1.</td>
                        <td style="font-size: 13px; color: #475569; padding-bottom: 8px;"><strong>Foto acolhedora:</strong> Perfis com fotos humanizadas recebem até 3.2x mais contatos.</td>
                    </tr>
                    <tr>
                        <td width="26" style="vertical-align: top; font-size: 14px;">2.</td>
                        <td style="font-size: 13px; color: #475569; padding-bottom: 8px;"><strong>Biografia clara:</strong> Destaque suas especialidades e como você conduz suas sessões.</td>
                    </tr>
                    <tr>
                        <td width="26" style="vertical-align: top; font-size: 14px;">3.</td>
                        <td style="font-size: 13px; color: #475569;"><strong>Conheça o Fórum:</strong> Interaja com outros profissionais em nossa sala de debates clínicos.</td>
                    </tr>
                </table>
            </div>

            ${emailCtaBtn(`${process.env.FRONTEND_URL || 'https://www.yelopsi.com.br'}/login`, 'Configurar Meu Consultório')}
        `;
        await sendEmail(user.email, '🎉 Seja Muito Bem-vindo(a) à Yelo Psi!', getBaseTemplate(title, content, {
            tagText: '🎉 Seja Muito Bem-vindo(a)',
            tagColor: '#F0FDF4',
            toEmail: user.email
        }));
    } else {
        const title = 'Boas-vindas à Yelo! 💛';
        const patientName = user.nome ? user.nome.split(' ')[0] : '';
        const questionarioUrl = `${process.env.FRONTEND_URL || 'https://www.yelopsi.com.br'}/questionario`;

        const content = `
            <p>Olá, <strong>${patientName}</strong>!</p>
            <p>Criamos a Yelo para ser um espaço seguro, acolhedor e humanizado na sua busca pelo profissional ideal.</p>
            
            <div style="background-color: #F8FAF7; border: 1px solid #E2EADF; border-radius: 16px; padding: 22px; margin: 24px 0;">
                <strong style="color: #1B4332; font-size: 14px; display: block; margin-bottom: 8px;">Encontre o psicólogo certo para você:</strong>
                <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.6;">
                    Nosso questionário rápido analisa suas preferências de abordagem, valores de consulta e formato de atendimento para conectar você a quem realmente entende seu momento de vida.
                </p>
            </div>

            ${emailCtaBtn(questionarioUrl, 'Encontrar Meu Psicólogo')}
        `;
        await sendEmail(user.email, '💛 Boas-vindas à Yelo!', getBaseTemplate(title, content, {
            tagText: '💛 Boas-vindas à Yelo',
            tagColor: '#FEF3C7',
            toEmail: user.email
        }));
    }
};

exports.sendPasswordResetEmail = async (user, resetLink) => {
    const title = 'Redefinição de Senha 🔒';
    const userName = user.nome ? user.nome.split(' ')[0] : 'Usuário';

    const content = `
        <p>Olá, <strong>${userName}</strong>!</p>
        <p>Recebemos uma solicitação para redefinir a senha de acesso da sua conta na plataforma Yelo.</p>
        
        <div style="background-color: #F8FAF7; border: 1px solid #E2EADF; border-radius: 16px; padding: 20px; margin: 24px 0;">
            <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.5;">
                Por motivos de segurança, este link é temporário. Se você não solicitou a redefinição, nenhuma ação é necessária e sua senha atual continuará válida.
            </p>
        </div>

        ${emailCtaBtn(resetLink, 'Redefinir Minha Senha')}
    `;
    await sendEmail(user.email, '🔒 Redefinição de Senha - Yelo', getBaseTemplate(title, content, {
        tagText: '🔒 Segurança da Conta',
        tagColor: '#F1F5F9',
        toEmail: user.email
    }));
};

exports.sendRemarketingEmail = async (user, step) => {
    let titulo = '';
    let msg = '';
    let tagText = '● Consultório Yelo';
    let tagColor = '#F0FDF4';
    const psiName = getPsiFirstName(user);
    const loginUrl = `${process.env.FRONTEND_URL || 'https://www.yelopsi.com.br'}/login`;
    
    if (step === 1) {
        titulo = 'Seu consultório na Yelo está quase pronto! 🚀';
        tagText = '🚀 Ativação de Consultório';
        tagColor = '#F0FDF4';
        msg = 'Notamos que você realizou seu cadastro profissional, mas ainda não concluiu a ativação da sua assinatura. Pacientes realizam buscas terapêuticas em nossa plataforma todos os dias procurando por abordagens como a sua. Conclua seu perfil agora para não perder nenhuma conexão qualificada.';
    } else if (step === 2) {
        titulo = 'Por que escolher a Yelo? 💛';
        tagText = '💛 Ecossistema Clínico';
        tagColor = '#FEF3C7';
        msg = 'Com a Yelo, conectamos sua abordagem terapêutica a pacientes reais através da nossa inteligência de match e de investimento contínuo em tráfego qualificado. Assine hoje mesmo e apareça nas buscas ativas do nosso ecossistema.';
    } else if (step === 3) {
        titulo = 'Última oportunidade: Faça parte da Yelo ⏰';
        tagText = '⏰ Última Chamada';
        tagColor = '#FEF3C7';
        msg = 'Construímos um espaço com propósito e ética para acolher a sua prática clínica. Queremos muito ver seu perfil em destaque conectando você a novas histórias. Ative sua assinatura para desbloquear todos os recursos da comunidade.';
    } else if (step === 4) {
        const clicks = user.whatsapp_clicks || 1;
        titulo = `Você tem ${clicks} paciente(s) aguardando contato! 💛`;
        tagText = '💛 Pacientes Interessados';
        tagColor = '#FEF3C7';
        msg = `O seu perfil atraiu interessados e você recebeu ${clicks} clique(s) no seu WhatsApp recentemente! Como seu período de teste terminou e sua assinatura está inativa, sua agenda pública foi temporariamente pausada. Ative sua assinatura para desbloquear seu WhatsApp e voltar a receber novos pacientes sem limites.`;
    }

    const content = `
        <p>Olá, <strong>${psiName}</strong>!</p>
        <p>${msg}</p>

        <div style="background-color: #F8FAF7; border: 1px solid #E2EADF; border-radius: 16px; padding: 20px; margin: 24px 0;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                    <td width="36" style="vertical-align: top; font-size: 20px;">✨</td>
                    <td style="padding-left: 10px; font-size: 13px; color: #475569; line-height: 1.5;">
                        Acesso completo ao Fórum exclusivo, algoritmo de match inteligente e contatos diretos no seu WhatsApp sem intermediações.
                    </td>
                </tr>
            </table>
        </div>

        ${emailCtaBtn(loginUrl, 'Ativar Meu Consultório')}
    `;
    await sendEmail(user.email, titulo, getBaseTemplate(titulo, content, {
        tagText,
        tagColor,
        toEmail: user.email
    }));
};

exports.sendFirstLeadEmail = async (user) => {
    const psiName = getPsiFirstName(user);
    const title = 'Um paciente iniciou contato com você 👋';
    const content = `
        <p>Olá, <strong>${psiName}</strong>!</p>
        <p>Temos ótimas notícias para o seu consultório: um paciente acaba de clicar no seu botão de WhatsApp após ler o seu perfil na Yelo.</p>
        <p>Isso indica que sua abordagem clínica e apresentação ressoaram fortemente com o momento de vida dessa pessoa.</p>
        
        <div style="background-color: #F8FAF7; border: 1px solid #E2EADF; border-radius: 16px; padding: 20px 22px; margin: 24px 0;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                    <td width="48" style="vertical-align: top;">
                        <div style="width: 44px; height: 44px; background-color: #E6F4EA; color: #1B4332; border-radius: 50%; font-size: 20px; text-align: center; line-height: 44px;">
                            💬
                        </div>
                    </td>
                    <td style="padding-left: 14px; vertical-align: top;">
                        <strong style="font-size: 15px; color: #1B4332; display: block; margin-bottom: 4px;">Atendimento em Andamento</strong>
                        <p style="margin: 0; font-size: 13px; color: #64748B; line-height: 1.5;">
                            Fique atento às notificações do seu WhatsApp. Assim que conversar com o paciente, você poderá atualizar o status desse atendimento no seu painel para refinarmos suas próximas indicações.
                        </p>
                    </td>
                </tr>
            </table>
        </div>

        ${emailCtaBtn(`${process.env.FRONTEND_URL || 'https://www.yelopsi.com.br'}/psi/psi_dashboard`, 'Acessar Painel do Consultório')}
    `;
    await sendEmail(user.email, '💛 Novo Paciente Interessado: Um paciente iniciou contato com você 👋', getBaseTemplate(title, content, {
        tagText: '💛 Novo Paciente Interessado',
        tagColor: '#FEF3C7',
        toEmail: user.email
    }));
};

exports.sendEvaluationEmail = async (user) => {
    const title = 'Como foi sua experiência na Yelo? 💛';
    const psiName = getPsiFirstName(user);
    const feedbackUrl = `${process.env.FRONTEND_URL || 'https://www.yelopsi.com.br'}/feedback?psiId=${user.id}`;

    const content = `
        <p>Olá, <strong>${psiName}</strong>!</p>
        <p>Notamos que o seu período na Yelo chegou ao fim recentemente. Nosso maior objetivo é construir uma plataforma que realmente faça a diferença na prática clínica dos profissionais de psicologia, e a sua percepção é a parte mais valiosa dessa construção.</p>
        
        <div style="background-color: #F8FAF7; border: 1px solid #E2EADF; border-radius: 16px; padding: 22px; margin: 24px 0;">
            <strong style="color: #1B4332; font-size: 14px; display: block; margin-bottom: 6px;">Leva menos de 1 minuto:</strong>
            <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.5;">
                O que funcionou bem na sua jornada? O que poderíamos aprimorar? Seja para compartilhar um elogio, uma crítica ou sugestão de recurso, nós estamos prontos para ouvir.
            </p>
        </div>

        ${emailCtaBtn(feedbackUrl, 'Avaliar Minha Experiência')}

        <p style="font-size: 13px; color: #718096; text-align: center;">E lembre-se: as portas da nossa comunidade estarão sempre abertas para você.</p>
    `;
    await sendEmail(user.email, '💛 Sua opinião é fundamental: Como foi sua experiência na Yelo?', getBaseTemplate(title, content, {
        tagText: '💛 Sua Opinião Importa',
        tagColor: '#FEF3C7',
        toEmail: user.email
    }));
};

exports.sendFeedbackRequestEmail = async (user, guestName) => {
    const title = 'Acompanhe a evolução desse contato 👋';
    const psiName = getPsiFirstName(user);
    const patientText = (guestName === 'um paciente') 
        ? 'Um paciente' 
        : `O paciente <strong>${guestName}</strong>`;
    const dashboardUrl = `${process.env.FRONTEND_URL || 'https://www.yelopsi.com.br'}/psi/psi_dashboard`;

    const content = `
        <p>Olá, <strong>${psiName}</strong>!</p>
        <p>${patientText} iniciou contato com você pelo WhatsApp recentemente através da plataforma Yelo.</p>
        
        <div style="background-color: #F8FAF7; border: 1px solid #E2EADF; border-radius: 16px; padding: 20px 22px; margin: 24px 0;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                    <td width="42" style="vertical-align: top;">
                        <div style="width: 38px; height: 38px; background-color: #E6F4EA; color: #1B4332; border-radius: 50%; font-size: 18px; text-align: center; line-height: 38px;">
                            💬
                        </div>
                    </td>
                    <td style="padding-left: 12px; vertical-align: top;">
                        <strong style="font-size: 14px; color: #1B4332; display: block; margin-bottom: 4px;">Atualização Rápida de Atendimento</strong>
                        <p style="margin: 0; font-size: 13px; color: #64748B; line-height: 1.5;">
                            Leva menos de 30 segundos: informar se esse contato evoluiu para consulta ajuda nosso algoritmo a refinar e direcionar indicações cada vez mais precisas.
                        </p>
                    </td>
                </tr>
            </table>
        </div>

        ${emailCtaBtn(dashboardUrl, 'Atualizar Status do Atendimento')}
    `;
    await sendEmail(user.email, 'Um paciente demonstrou interesse no seu perfil 👋', getBaseTemplate(title, content, {
        tagText: '💬 Contato de Paciente',
        tagColor: '#FEF3C7',
        toEmail: user.email
    }));
};

exports.sendWeeklyPerformanceEmail = async (user, matchesCount, profileViewsCount, topTheme) => {
    const title = 'Veja como o seu perfil repercutiu nesta semana ✨';
    const psiName = getPsiFirstName(user);
    const destaqueText = topTheme 
        ? `Seu consultório esteve em destaque em buscas por <strong>${topTheme}</strong>.` 
        : `Seu consultório esteve em evidência nas buscas qualificadas da nossa rede.`;

    const content = `
        <p>Olá, <strong>${psiName}</strong>, tudo bem?</p>
        <p>Acreditamos que a gestão do seu consultório precisa ser transparente e leve. Por isso, reunimos os dados de posicionamento do seu perfil na Yelo nos últimos 7 dias.</p>
        <p>Mesmo quando o WhatsApp não toca imediatamente, a plataforma continua trabalhando ativamente para conectar seu nome aos pacientes certos.</p>
        
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="kpi-table" style="margin: 22px 0 16px 0;">
            <tr class="kpi-row">
                <td class="kpi-col" width="48%" valign="top" style="background-color: #F8FAF7; border: 1px solid #E2EADF; border-radius: 14px; padding: 16px 18px; vertical-align: top; box-sizing: border-box;">
                    <span style="font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">🎯 Matches Inteligentes</span>
                    <div style="font-size: 28px; font-weight: 800; color: #1B4332; margin: 6px 0 2px 0; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">${matchesCount}</div>
                    <p style="margin: 0; font-size: 12px; color: #64748B; line-height: 1.4;">Pacientes cujo momento clínico combinou com sua abordagem.</p>
                </td>
                <td class="kpi-spacer" width="4%" style="width: 4%; font-size: 0; line-height: 0;">&nbsp;</td>
                <td class="kpi-col" width="48%" valign="top" style="background-color: #F8FAF7; border: 1px solid #E2EADF; border-radius: 14px; padding: 16px 18px; vertical-align: top; box-sizing: border-box;">
                    <span style="font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">👀 Visualizações</span>
                    <div style="font-size: 28px; font-weight: 800; color: #1B4332; margin: 6px 0 2px 0; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">${profileViewsCount}</div>
                    <p style="margin: 0; font-size: 12px; color: #64748B; line-height: 1.4;">Visitas completas à sua biografia, formação e horários.</p>
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
        
        ${emailCtaBtn(`${process.env.FRONTEND_URL || 'https://www.yelopsi.com.br'}/psi/psi_dashboard?page=psi_forum.html`, 'Acessar Meu Hub de Evolução')}
    `;
    await sendEmail(user.email, '📊 Veja o desempenho do seu perfil na Yelo nesta semana!', getBaseTemplate(title, content, { 
        tagText: '● Relatório Semanal',
        toEmail: user.email
    }));
};

exports.sendQuestionAnsweredEmail = async (email, slug) => {
    const title = 'Sua dúvida na Yelo foi respondida! 🎉';
    const linkDaResposta = `${process.env.FRONTEND_URL || 'https://www.yelopsi.com.br'}/perguntas/${slug}`;

    const content = `
        <p>Olá!</p>
        <p>Um dos profissionais de psicologia da rede Yelo acabou de responder à pergunta que você enviou em nossa comunidade pública.</p>
        
        <div style="background-color: #F8FAF7; border: 1px solid #E2EADF; border-radius: 16px; padding: 22px; margin: 24px 0;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                    <td width="42" style="vertical-align: top;">
                        <div style="width: 38px; height: 38px; background-color: #FEF3C7; color: #92400E; border-radius: 50%; font-size: 18px; text-align: center; line-height: 38px;">
                            💡
                        </div>
                    </td>
                    <td style="padding-left: 12px; vertical-align: top;">
                        <strong style="font-size: 14px; color: #1B4332; display: block; margin-bottom: 4px;">Orientação Profissional Disponível</strong>
                        <p style="margin: 0; font-size: 13px; color: #64748B; line-height: 1.5;">
                            Você pode conferir a resposta completa, reflexões do especialista e o perfil profissional de quem respondeu.
                        </p>
                    </td>
                </tr>
            </table>
        </div>

        ${emailCtaBtn(linkDaResposta, 'Ver Resposta Completa')}
    `;
    await sendEmail(email, '💡 Sua dúvida foi respondida na Comunidade Yelo!', getBaseTemplate(title, content, {
        tagText: '💡 Dúvida Respondida',
        tagColor: '#FEF3C7',
        toEmail: email
    }));
};

exports.sendForumReplyEmail = async (targetUser, senderName, commentContent, postId) => {
    const frontendUrl = process.env.FRONTEND_URL || 'https://www.yelopsi.com.br';
    const postLink = `${frontendUrl}/psi/psi_dashboard?page=psi_forum.html&postId=${postId}`;
    const title = 'Novo comentário na sua discussão ✨';
    const snippet = commentContent && commentContent.length > 180 ? `${commentContent.substring(0, 180)}...` : (commentContent || '');
    const psiName = getPsiFirstName(targetUser);

    const content = `
        <p>Olá, <strong>${psiName}</strong>!</p>
        <p><strong>${senderName}</strong> respondeu a uma publicação sua no Fórum de Psicólogos da Yelo:</p>
        
        <div style="background-color: #F8FAF7; border: 1px solid #E2EADF; border-radius: 16px; padding: 20px 22px; margin: 24px 0;">
            <span style="font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">💬 Resposta da Comunidade</span>
            <p style="margin: 10px 0 0 0; font-size: 14px; color: #1B4332; font-style: italic; line-height: 1.6;">
                "${snippet}"
            </p>
        </div>

        <p>Para ler a resposta na íntegra e continuar a discussão com os colegas, acesse agora pelo seu painel:</p>
        
        ${emailCtaBtn(postLink, 'Ver Discussão no Fórum')}
    `;

    await sendEmail(targetUser.email, `💬 ${senderName} respondeu no Fórum da Yelo`, getBaseTemplate(title, content, {
        tagText: '● Fórum Yelo Psi',
        tagColor: '#F0FDF4',
        toEmail: targetUser.email
    }));
};


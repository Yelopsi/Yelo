// backend/services/emailService.js

const nodemailer = require('nodemailer');

// --- DIAGNÓSTICO DE CONFIGURAÇÃO ---
if (!process.env.SMTP_HOST) {
    console.error("❌ ERRO CRÍTICO: SMTP_HOST não definido. O sistema tentará conectar em localhost (127.0.0.1) e falhará no Render.");
    console.error("👉 Adicione as variáveis de ambiente (SMTP_HOST, SMTP_USER, SMTP_PASS) no painel do Render.");
}

// Configuração do Transporter (O carteiro)
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false, // true para 465, false para outras portas
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    },
    // --- FIX: Melhora compatibilidade com provedores estritos (GoDaddy/Office365) ---
    tls: {
        rejectUnauthorized: false
    }
});

// Verifica se a conexão está OK ao iniciar
transporter.verify(function (error, success) {
    if (error) {
        console.error('❌ Erro na configuração de E-mail (SMTP):', error.message);
        console.error('   Dica: Verifique as variáveis SMTP_ no seu arquivo .env');
    } else {
        console.log('✅ Serviço de E-mail (SMTP) pronto para envio.');
    }
});

// --- FIX GLOBAL: Define o remetente seguro ---
// Usa EMAIL_FROM se existir, senão usa o usuário autenticado (SMTP_USER), senão um padrão.
const getSender = () => process.env.EMAIL_FROM || process.env.SMTP_USER || 'nao-responda@yelopsi.com.br';

/**
 * Envia e-mail de redefinição de senha
 */
exports.sendPasswordResetEmail = async (user, resetLink) => {
    const baseUrl = process.env.FRONTEND_URL || 'https://www.yelopsi.com.br';
    const logoUrl = `${baseUrl}/assets/logos/logo-branca.png`;

    const mailOptions = {
        from: getSender(),
        to: user.email,
        subject: 'Redefinição de Senha - Yelo',
        html: `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                    body, td, input, textarea, select { font-family: 'Inter', Helvetica, Arial, sans-serif; }
                </style>
            </head>
            <body style="margin: 0; padding: 0; background-color: #fdfaf6; color: #555555;">
            <div style="background-color: #fdfaf6; padding: 40px 0; width: 100%;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border: 1px solid #e9ecef;">
                    
                    <div style="background-color: #1B4332; padding: 40px 30px; text-align: center;">
                        <img src="${logoUrl}" alt="Yelo" width="120" style="width: 120px; height: auto; display: block; margin: 0 auto; border: 0;">
                    </div>

                    <div style="padding: 40px 30px; line-height: 1.6;">
                        <h2 style="color: #1B4332; margin-top: 0; font-family: 'New Kansas', 'Georgia', 'Times New Roman', serif; font-size: 24px; font-weight: 600; margin-bottom: 20px;">Olá, ${user.nome.split(' ')[0]}!</h2>
                        <p style="font-size: 16px; margin-bottom: 20px;">Recebemos uma solicitação para redefinir a senha da sua conta na Yelo.</p>
                        <p style="font-size: 16px; margin-bottom: 30px;">Para criar uma nova senha e recuperar seu acesso, clique no botão abaixo:</p>
                        
                        <div style="text-align: center; margin: 35px 0;">
                            <a href="${resetLink}" style="background-color: #FFEE8C; color: #1B4332; padding: 16px 32px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 15px rgba(255, 238, 140, 0.4);">Redefinir Minha Senha</a>
                        </div>
                        
                        <p style="font-size: 14px; color: #666; margin-top: 30px;">Ou copie e cole o link abaixo no seu navegador:</p>
                        <p style="font-size: 12px; color: #888; word-break: break-all; background: #f8f9fa; padding: 15px; border-radius: 8px; font-family: monospace; border: 1px solid #eee;">${resetLink}</p>
                        
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
                        <p style="font-size: 12px; color: #999; text-align: center;">Se você não solicitou essa alteração, ignore este e-mail. Sua conta permanece segura.</p>
                    </div>
                    <div style="background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee;">
                        <p style="margin: 0;">&copy; ${new Date().getFullYear()} Yelo. Todos os direitos reservados.</p>
                    </div>
                </div>
            </div>
            </body>
            </html>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 E-mail de recuperação enviado para: ${user.email}`);
    } catch (error) {
        console.error('Erro ao enviar e-mail de recuperação:', error);
        throw new Error('Falha ao enviar e-mail. Verifique os logs do servidor.');
    }
};

/**
 * Envia e-mail de convite (Lista de Espera)
 */
exports.sendInvitationEmail = async (candidate, invitationLink) => {
    const baseUrl = process.env.FRONTEND_URL || 'https://www.yelopsi.com.br';
    const logoUrl = `${baseUrl}/assets/logos/logo-branca.png`;

    const mailOptions = {
        from: getSender(),
        to: candidate.email,
        subject: 'Convite Exclusivo - Yelo',
        html: `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <body style="margin: 0; padding: 0; background-color: #fdfaf6; color: #555555; font-family: 'Inter', Helvetica, Arial, sans-serif;">
            <div style="background-color: #fdfaf6; padding: 40px 0; width: 100%;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border: 1px solid #e9ecef;">
                    <div style="background-color: #1B4332; padding: 40px 30px; text-align: center;">
                        <img src="${logoUrl}" alt="Yelo" width="120" style="width: 120px; height: auto; display: block; margin: 0 auto; border: 0;">
                    </div>
                    <div style="padding: 40px 30px; line-height: 1.6;">
                        <h2 style="color: #1B4332; margin-top: 0; font-family: 'New Kansas', 'Georgia', 'Times New Roman', serif; font-size: 24px; font-weight: 600;">Parabéns, ${candidate.nome}!</h2>
                        <p style="font-size: 16px; margin-bottom: 20px;">Sua vaga na Yelo foi liberada. Estamos muito felizes em ter você conosco.</p>
                        <p style="font-size: 16px; margin-bottom: 30px;">Clique abaixo para completar seu cadastro e ativar seu perfil:</p>
                        <div style="text-align: center; margin: 35px 0;">
                            <a href="${invitationLink}" style="background-color: #FFEE8C; color: #1B4332; padding: 16px 32px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 15px rgba(255, 238, 140, 0.4);">Ativar Meu Perfil</a>
                        </div>
                    </div>
                </div>
            </div>
            </body>
            </html>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Erro ao enviar convite:', error);
    }
};

/**
 * Envia e-mail de confirmação de pagamento (Substitui o do Asaas)
 */
exports.sendPaymentConfirmationEmail = async (user, planType, amount) => {
    const baseUrl = process.env.FRONTEND_URL || 'https://www.yelopsi.com.br';
    const logoUrl = `${baseUrl}/assets/logos/logo-branca.png`;
    
    // Formata valor
    const valorFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
    
    // Traduz plano
    const nomesPlanos = { 'ESSENTIAL': 'Essencial', 'CLINICAL': 'Clínico', 'REFERENCE': 'Referência' };
    const nomePlano = nomesPlanos[planType] || planType;

    const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: user.email,
        subject: 'Pagamento Confirmado - Yelo',
        html: `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                    body, td, input, textarea, select { font-family: 'Inter', Helvetica, Arial, sans-serif; }
                </style>
            </head>
            <body style="margin: 0; padding: 0; background-color: #fdfaf6; color: #555555;">
            <div style="background-color: #fdfaf6; padding: 40px 0; width: 100%;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border: 1px solid #e9ecef;">
                    <div style="background-color: #1B4332; padding: 40px 30px; text-align: center;">
                        <img src="${logoUrl}" alt="Yelo" width="120" style="width: 120px; height: auto; display: block; margin: 0 auto; border: 0;">
                    </div>
                    <div style="padding: 40px 30px; line-height: 1.6;">
                        <h2 style="color: #1B4332; margin-top: 0; font-family: 'New Kansas', 'Georgia', 'Times New Roman', serif; font-size: 24px; font-weight: 600; margin-bottom: 20px;">Pagamento Confirmado!</h2>
                        <p style="font-size: 16px; margin-bottom: 20px;">Olá, ${user.nome.split(' ')[0]}!</p>
                        <p style="font-size: 16px; margin-bottom: 30px;">Recebemos a confirmação do seu pagamento. Sua assinatura do <strong>Plano ${nomePlano}</strong> está ativa.</p>
                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; border: 1px solid #eee;">
                            <p style="margin: 0 0 10px 0;"><strong>Valor:</strong> ${valorFormatado}</p>
                            <p style="margin: 0;"><strong>Status:</strong> Pago</p>
                        </div>
                        <div style="text-align: center; margin: 35px 0;">
                            <a href="${baseUrl}/psi/psi_dashboard.html" style="background-color: #FFEE8C; color: #1B4332; padding: 16px 32px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 15px rgba(255, 238, 140, 0.4);">Acessar Painel</a>
                        </div>
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
                        <p style="font-size: 12px; color: #999; text-align: center;">Se você tiver alguma dúvida, entre em contato com nosso suporte.</p>
                    </div>
                    <div style="background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee;">
                        <p style="margin: 0;">&copy; ${new Date().getFullYear()} Yelo. Todos os direitos reservados.</p>
                    </div>
                </div>
            </div>
            </body>
            </html>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 E-mail de pagamento enviado para: ${user.email}`);
    } catch (error) {
        console.error('Erro ao enviar e-mail de pagamento:', error);
    }
};

/**
 * Envia e-mail de Assinatura Cancelada / Estorno
 */
exports.sendSubscriptionCancelledEmail = async (user) => {
    const baseUrl = process.env.FRONTEND_URL || 'https://www.yelopsi.com.br';
    const logoUrl = `${baseUrl}/assets/logos/logo-branca.png`;

    const mailOptions = {
        from: getSender(),
        to: user.email,
        subject: 'Atualização sobre sua Assinatura - Yelo',
        html: `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                    body, td, input, textarea, select { font-family: 'Inter', Helvetica, Arial, sans-serif; }
                </style>
            </head>
            <body style="margin: 0; padding: 0; background-color: #fdfaf6; color: #555555;">
            <div style="background-color: #fdfaf6; padding: 40px 0; width: 100%;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border: 1px solid #e9ecef;">
                    <div style="background-color: #1B4332; padding: 40px 30px; text-align: center;">
                        <img src="${logoUrl}" alt="Yelo" width="120" style="width: 120px; height: auto; display: block; margin: 0 auto; border: 0;">
                    </div>
                    <div style="padding: 40px 30px; line-height: 1.6;">
                        <h2 style="color: #1B4332; margin-top: 0; font-family: 'New Kansas', 'Georgia', 'Times New Roman', serif; font-size: 24px; font-weight: 600; margin-bottom: 20px;">Assinatura Cancelada</h2>
                        <p style="font-size: 16px; margin-bottom: 20px;">Olá, ${user.nome.split(' ')[0]}!</p>
                        <p style="font-size: 16px; margin-bottom: 30px;">Confirmamos o cancelamento da sua assinatura ou o estorno do seu pagamento. Seu acesso aos recursos premium foi encerrado.</p>
                        <div style="background-color: #fff5f5; padding: 20px; border-radius: 8px; margin-bottom: 30px; border: 1px solid #fed7d7; color: #c53030;">
                            <p style="margin: 0;">Esperamos ver você de volta em breve!</p>
                        </div>
                        <div style="text-align: center; margin: 35px 0;">
                            <a href="${baseUrl}/psi/psi_assinatura.html" style="background-color: #1B4332; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 15px rgba(27, 67, 50, 0.2);">Reativar Plano</a>
                        </div>
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
                        <p style="font-size: 12px; color: #999; text-align: center;">Se isso foi um engano, entre em contato com nosso suporte.</p>
                    </div>
                </div>
            </div>
            </body>
            </html>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 E-mail de cancelamento enviado para: ${user.email}`);
    } catch (error) {
        console.error('Erro ao enviar e-mail de cancelamento:', error);
        throw error; // Lança o erro para ser capturado pela rota de teste
    }
};

/**
 * Envia e-mail de Falha no Pagamento
 */
exports.sendPaymentFailedEmail = async (user, invoiceUrl) => {
    const baseUrl = process.env.FRONTEND_URL || 'https://www.yelopsi.com.br';
    const logoUrl = `${baseUrl}/assets/logos/logo-branca.png`;

    const mailOptions = {
        from: getSender(),
        to: user.email,
        subject: 'Falha no Pagamento - Yelo',
        html: `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                    body, td, input, textarea, select { font-family: 'Inter', Helvetica, Arial, sans-serif; }
                </style>
            </head>
            <body style="margin: 0; padding: 0; background-color: #fdfaf6; color: #555555;">
            <div style="background-color: #fdfaf6; padding: 40px 0; width: 100%;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border: 1px solid #e9ecef;">
                    <div style="background-color: #1B4332; padding: 40px 30px; text-align: center;">
                        <img src="${logoUrl}" alt="Yelo" width="120" style="width: 120px; height: auto; display: block; margin: 0 auto; border: 0;">
                    </div>
                    <div style="padding: 40px 30px; line-height: 1.6;">
                        <h2 style="color: #c53030; margin-top: 0; font-family: 'New Kansas', 'Georgia', 'Times New Roman', serif; font-size: 24px; font-weight: 600; margin-bottom: 20px;">Não conseguimos processar seu pagamento</h2>
                        <p style="font-size: 16px; margin-bottom: 20px;">Olá, ${user.nome.split(' ')[0]}!</p>
                        <p style="font-size: 16px; margin-bottom: 30px;">Houve um problema com a renovação da sua assinatura. Para evitar a interrupção do seu acesso, por favor, verifique seus dados de pagamento.</p>
                        
                        <div style="text-align: center; margin: 35px 0;">
                            <a href="${invoiceUrl || baseUrl + '/psi/psi_assinatura.html'}" style="background-color: #E63946; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 15px rgba(230, 57, 70, 0.3);">Atualizar Pagamento</a>
                        </div>
                        
                        <p style="font-size: 14px; color: #666; margin-top: 30px;">Se você já realizou o pagamento, desconsidere este e-mail.</p>
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
                        <p style="font-size: 12px; color: #999; text-align: center;">Precisa de ajuda? Responda este e-mail.</p>
                    </div>
                </div>
            </div>
            </body>
            </html>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 E-mail de falha de pagamento enviado para: ${user.email}`);
    } catch (error) {
        console.error('Erro ao enviar e-mail de falha:', error);
        throw error;
    }
};

/**
 * Envia e-mail de Boas-vindas (Cadastro)
 */
exports.sendWelcomeEmail = async (user, type) => {
    const baseUrl = process.env.FRONTEND_URL || 'https://www.yelopsi.com.br';
    const logoUrl = `${baseUrl}/assets/logos/logo-branca.png`;
    const dashboardLink = type === 'psychologist' ? `${baseUrl}/psi/psi_dashboard.html` : `${baseUrl}/patient/patient_dashboard`;
    const welcomeText = type === 'psychologist' 
        ? 'Estamos muito felizes em ter você como parceiro na Yelo. Complete seu perfil para começar a receber pacientes.'
        : 'Seja bem-vindo(a) à Yelo! Estamos aqui para te ajudar a encontrar o profissional ideal para sua jornada.';

    const mailOptions = {
        from: getSender(),
        to: user.email,
        subject: 'Bem-vindo(a) à Yelo!',
        html: `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                    body, td, input, textarea, select { font-family: 'Inter', Helvetica, Arial, sans-serif; }
                </style>
            </head>
            <body style="margin: 0; padding: 0; background-color: #fdfaf6; color: #555555;">
            <div style="background-color: #fdfaf6; padding: 40px 0; width: 100%;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border: 1px solid #e9ecef;">
                    <div style="background-color: #1B4332; padding: 40px 30px; text-align: center;">
                        <img src="${logoUrl}" alt="Yelo" width="120" style="width: 120px; height: auto; display: block; margin: 0 auto; border: 0;">
                    </div>
                    <div style="padding: 40px 30px; line-height: 1.6;">
                        <h2 style="color: #1B4332; margin-top: 0; font-family: 'New Kansas', 'Georgia', 'Times New Roman', serif; font-size: 24px; font-weight: 600; margin-bottom: 20px;">Olá, ${user.nome.split(' ')[0]}!</h2>
                        <p style="font-size: 16px; margin-bottom: 30px;">${welcomeText}</p>
                        
                        <div style="text-align: center; margin: 35px 0;">
                            <a href="${dashboardLink}" style="background-color: #FFEE8C; color: #1B4332; padding: 16px 32px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 15px rgba(255, 238, 140, 0.4);">Acessar Minha Conta</a>
                        </div>
                        
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
                        <p style="font-size: 12px; color: #999; text-align: center;">Se tiver dúvidas, nossa equipe está à disposição.</p>
                    </div>
                </div>
            </div>
            </body>
            </html>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 E-mail de boas-vindas enviado para: ${user.email}`);
    } catch (error) {
        console.error('Erro ao enviar e-mail de boas-vindas:', error);
        // Não lançamos erro aqui para não bloquear o cadastro se o e-mail falhar
    }
};

/**
 * Envia e-mail de Assinatura Cancelada / Estorno
 */
exports.sendSubscriptionCancelledEmail = async (user) => {
    const baseUrl = process.env.FRONTEND_URL || 'https://www.yelopsi.com.br';
    const logoUrl = `${baseUrl}/assets/logos/logo-branca.png`;

    const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: user.email,
        subject: 'Atualização sobre sua Assinatura - Yelo',
        html: `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                    body, td, input, textarea, select { font-family: 'Inter', Helvetica, Arial, sans-serif; }
                </style>
            </head>
            <body style="margin: 0; padding: 0; background-color: #fdfaf6; color: #555555;">
            <div style="background-color: #fdfaf6; padding: 40px 0; width: 100%;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border: 1px solid #e9ecef;">
                    <div style="background-color: #1B4332; padding: 40px 30px; text-align: center;">
                        <img src="${logoUrl}" alt="Yelo" width="120" style="width: 120px; height: auto; display: block; margin: 0 auto; border: 0;">
                    </div>
                    <div style="padding: 40px 30px; line-height: 1.6;">
                        <h2 style="color: #1B4332; margin-top: 0; font-family: 'New Kansas', 'Georgia', 'Times New Roman', serif; font-size: 24px; font-weight: 600; margin-bottom: 20px;">Assinatura Cancelada</h2>
                        <p style="font-size: 16px; margin-bottom: 20px;">Olá, ${user.nome.split(' ')[0]}!</p>
                        <p style="font-size: 16px; margin-bottom: 30px;">Confirmamos o cancelamento da sua assinatura ou o estorno do seu pagamento. Seu acesso aos recursos premium foi encerrado.</p>
                        <div style="background-color: #fff5f5; padding: 20px; border-radius: 8px; margin-bottom: 30px; border: 1px solid #fed7d7; color: #c53030;">
                            <p style="margin: 0;">Esperamos ver você de volta em breve!</p>
                        </div>
                        <div style="text-align: center; margin: 35px 0;">
                            <a href="${baseUrl}/psi/psi_assinatura.html" style="background-color: #1B4332; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 15px rgba(27, 67, 50, 0.2);">Reativar Plano</a>
                        </div>
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
                        <p style="font-size: 12px; color: #999; text-align: center;">Se isso foi um engano, entre em contato com nosso suporte.</p>
                    </div>
                </div>
            </div>
            </body>
            </html>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 E-mail de cancelamento enviado para: ${user.email}`);
    } catch (error) {
        console.error('Erro ao enviar e-mail de cancelamento:', error);
    }
};

/**
 * Envia e-mail de Falha no Pagamento
 */
exports.sendPaymentFailedEmail = async (user, invoiceUrl) => {
    const baseUrl = process.env.FRONTEND_URL || 'https://www.yelopsi.com.br';
    const logoUrl = `${baseUrl}/assets/logos/logo-branca.png`;

    const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: user.email,
        subject: 'Falha no Pagamento - Yelo',
        html: `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                    body, td, input, textarea, select { font-family: 'Inter', Helvetica, Arial, sans-serif; }
                </style>
            </head>
            <body style="margin: 0; padding: 0; background-color: #fdfaf6; color: #555555;">
            <div style="background-color: #fdfaf6; padding: 40px 0; width: 100%;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border: 1px solid #e9ecef;">
                    <div style="background-color: #1B4332; padding: 40px 30px; text-align: center;">
                        <img src="${logoUrl}" alt="Yelo" width="120" style="width: 120px; height: auto; display: block; margin: 0 auto; border: 0;">
                    </div>
                    <div style="padding: 40px 30px; line-height: 1.6;">
                        <h2 style="color: #c53030; margin-top: 0; font-family: 'New Kansas', 'Georgia', 'Times New Roman', serif; font-size: 24px; font-weight: 600; margin-bottom: 20px;">Não conseguimos processar seu pagamento</h2>
                        <p style="font-size: 16px; margin-bottom: 20px;">Olá, ${user.nome.split(' ')[0]}!</p>
                        <p style="font-size: 16px; margin-bottom: 30px;">Houve um problema com a renovação da sua assinatura. Para evitar a interrupção do seu acesso, por favor, verifique seus dados de pagamento.</p>
                        
                        <div style="text-align: center; margin: 35px 0;">
                            <a href="${invoiceUrl || baseUrl + '/psi/psi_assinatura.html'}" style="background-color: #E63946; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 15px rgba(230, 57, 70, 0.3);">Atualizar Pagamento</a>
                        </div>
                        
                        <p style="font-size: 14px; color: #666; margin-top: 30px;">Se você já realizou o pagamento, desconsidere este e-mail.</p>
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
                        <p style="font-size: 12px; color: #999; text-align: center;">Precisa de ajuda? Responda este e-mail.</p>
                    </div>
                </div>
            </div>
            </body>
            </html>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 E-mail de falha de pagamento enviado para: ${user.email}`);
    } catch (error) {
        console.error('Erro ao enviar e-mail de falha:', error);
    }
};
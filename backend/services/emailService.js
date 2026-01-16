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

/**
 * Envia e-mail de redefinição de senha
 */
exports.sendPasswordResetEmail = async (user, resetLink) => {
    const baseUrl = process.env.FRONTEND_URL || 'https://www.yelopsi.com.br';
    const logoUrl = `${baseUrl}/assets/logos/logo-branca.png`;

    const mailOptions = {
        from: process.env.EMAIL_FROM,
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
        from: process.env.EMAIL_FROM,
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
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
    const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: user.email,
        subject: 'Redefinição de Senha - Yelo',
        html: `
            <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f9f9f9; padding: 40px 0;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                    <div style="background-color: #1B4332; padding: 30px; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0; font-family: 'Georgia', serif; font-weight: normal; letter-spacing: 1px;">Yelo</h1>
                    </div>
                    <div style="padding: 40px 30px; color: #333333; line-height: 1.6;">
                        <h2 style="color: #1B4332; margin-top: 0;">Olá, ${user.nome.split(' ')[0]}!</h2>
                        <p style="font-size: 16px;">Recebemos uma solicitação para redefinir a senha da sua conta na Yelo.</p>
                        <p style="font-size: 16px;">Para criar uma nova senha e recuperar seu acesso, clique no botão abaixo:</p>
                        
                        <div style="text-align: center; margin: 35px 0;">
                            <a href="${resetLink}" style="background-color: #1B4332; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(27, 67, 50, 0.2);">Redefinir Minha Senha</a>
                        </div>
                        
                        <p style="font-size: 14px; color: #666;">Ou copie e cole o link abaixo no seu navegador:</p>
                        <p style="font-size: 12px; color: #888; word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 8px;">${resetLink}</p>
                        
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
                        <p style="font-size: 12px; color: #999; text-align: center;">Se você não solicitou essa alteração, ignore este e-mail. Sua conta permanece segura.</p>
                    </div>
                    <div style="background-color: #f0f0f0; padding: 20px; text-align: center; font-size: 12px; color: #888;">
                        <p style="margin: 0;">&copy; ${new Date().getFullYear()} Yelo. Todos os direitos reservados.</p>
                    </div>
                </div>
            </div>
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
    const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: candidate.email,
        subject: 'Convite Exclusivo - Yelo',
        html: `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2 style="color: #1B4332;">Parabéns, ${candidate.nome}!</h2>
                <p>Sua vaga na Yelo foi liberada. Estamos muito felizes em ter você conosco.</p>
                <p>Clique abaixo para completar seu cadastro e ativar seu perfil:</p>
                <br>
                <a href="${invitationLink}" style="background-color: #1B4332; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Ativar Meu Perfil</a>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Erro ao enviar convite:', error);
    }
};
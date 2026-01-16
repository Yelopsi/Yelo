// backend/services/emailService.js

const nodemailer = require('nodemailer');

// Configuração do Transporter (O carteiro)
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false, // true para 465, false para outras portas
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
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
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1B4332;">Olá, ${user.nome.split(' ')[0]}!</h2>
                <p>Recebemos uma solicitação para redefinir a senha da sua conta na Yelo.</p>
                <p>Se foi você, clique no botão abaixo para criar uma nova senha:</p>
                <br>
                <a href="${resetLink}" style="background-color: #1B4332; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Redefinir Minha Senha</a>
                <br><br>
                <p style="font-size: 14px; color: #666;">Ou copie e cole o link abaixo no seu navegador:</p>
                <p style="font-size: 12px; color: #888; word-break: break-all;">${resetLink}</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 12px; color: #999;">Se você não solicitou essa alteração, ignore este e-mail. Sua senha permanecerá a mesma.</p>
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
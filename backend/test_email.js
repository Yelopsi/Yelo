const nodemailer = require('nodemailer');
require('dotenv').config({ path: '../.env' });

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtpout.secureserver.net',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true para 465, false para outras portas
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

const sendTestEmail = async () => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM || '"Anderson da Yelo" <contato@yelopsi.com.br>',
            to: 'anderson@yelopsi.com.br',
            subject: 'Novo conteúdo para você na Yelo: Como precificar suas sessões?',
            html: `
                <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #1B4332; padding: 20px; text-align: center;">
                        <img src="cid:logoYelo" alt="Yelo" style="height: 40px; margin-bottom: 10px;">
                    </div>
                    <div style="padding: 30px;">
                        <h2 style="color: #1B4332; margin-top: 0;">Olá, Anderson!</h2>
                        <p>Temos novidades fresquinhas na Yelo. Um novo conteúdo acabou de ser publicado e achamos que você vai gostar de conferir.</p>
                        
                        <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #F59E0B; margin: 20px 0;">
                            <p style="margin: 0 0 5px 0;"><strong>📄 Tipo:</strong> Post no Blog</p>
                            <p style="margin: 0;"><strong>📌 Título:</strong> Como precificar suas sessões da forma correta?</p>
                        </div>
                        
                        <p>Para ler o conteúdo completo e interagir com outros profissionais, acesse o seu dashboard.</p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="https://www.yelopsi.com.br/login" style="background-color: #1B4332; color: #ffffff; text-decoration: none; padding: 12px 25px; border-radius: 50px; font-weight: bold; font-size: 16px; display: inline-block;">Acessar Conteúdo</a>
                        </div>
                        
                        <p style="font-size: 14px; color: #777;">
                            Um abraço,<br>
                            <strong>Equipe Yelo</strong>
                        </p>
                    </div>
                    <div style="background-color: #f1f1f1; padding: 15px; text-align: center; font-size: 12px; color: #888;">
                        <p style="margin: 0;">Este é um e-mail automático enviado pela plataforma Yelo.</p>
                        <p style="margin: 5px 0 0 0;">Se você não deseja mais receber essas notificações, ajuste as configurações no seu perfil.</p>
                    </div>
                </div>
            `,
            attachments: [
                {
                    filename: 'logo-branca.png',
                    path: '../public/assets/logos/logo-branca.png',
                    cid: 'logoYelo' // same cid value as in the html img src
                }
            ]
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Test email sent: ' + info.messageId);
    } catch (error) {
        console.error('Error sending email:', error);
    }
};

sendTestEmail();

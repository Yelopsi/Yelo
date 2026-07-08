const db = require('../models');
const { Op } = require('sequelize');
const nodemailer = require('nodemailer');
require('dotenv').config({ path: '../.env' }); // Certificando-se que pega da raiz

// Configuração do transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtpout.secureserver.net',
    port: process.env.SMTP_PORT || 587,
    secure: false, 
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

/**
 * Envia notificação sobre um novo post para todos os psicólogos ativos.
 * Cria um Aviso no dashboard e dispara e-mail.
 * @param {Object} post Objeto do Post criado
 * @param {String} type Tipo do post: 'forum' ou 'blog'
 */
const notifyNewPost = async (post, type) => {
    try {
        console.log(`[NotificationService] Iniciando notificação de novo post no ${type}. ID: ${post.id}`);

        // 1. Criar o Aviso no Dashboard (Aviso Global - psychologistId: null)
        const tituloAviso = type === 'blog' ? `Novo Artigo no Blog: ${post.titulo || post.title}` : `Novo Tópico no Fórum: ${post.titulo || post.title}`;
        const conteudoAviso = `Ei! Acabamos de publicar um conteúdo novo que pode te interessar. Vá dar uma olhada e interaja com a comunidade!`;
        
        if (db.Aviso) {
            await db.Aviso.create({
                title: tituloAviso,
                content: conteudoAviso,
                author: 'Equipe Yelo',
                status: 'published',
                psychologistId: null // Aviso global
            });
            console.log(`[NotificationService] Aviso global criado com sucesso no dashboard.`);
        }

        // 2. Buscar todos os psicólogos ativos (trial ou pago)
        // Consideramos ativos aqueles com status 'active'
        const activePsis = await db.Psychologist.findAll({
            where: { status: 'active' },
            attributes: ['id', 'email', 'nome']
        });

        if (!activePsis.length) {
            console.log('[NotificationService] Nenhum psicólogo ativo encontrado para envio de e-mail.');
            return;
        }

        console.log(`[NotificationService] Preparando para enviar e-mails para ${activePsis.length} psicólogos ativos.`);

        // 3. Montar e disparar e-mails
        const frontendUrl = process.env.FRONTEND_URL || 'https://www.yelopsi.com.br';
        const link = `${frontendUrl}/login`;
        
        for (const psi of activePsis) {
            const psiName = psi.nome.split(' ')[0] || 'Psicólogo(a)';
            
            const htmlEmail = `
                <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #1B4332; padding: 20px; text-align: center;">
                        <img src="cid:logoYelo" alt="Yelo" style="height: 40px; margin-bottom: 10px;">
                    </div>
                    <div style="padding: 30px;">
                        <h2 style="color: #1B4332; margin-top: 0;">Olá, ${psiName}!</h2>
                        <p>Temos novidades fresquinhas na Yelo. Um novo conteúdo acabou de ser publicado e achamos que você vai gostar de conferir.</p>
                        
                        <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #F59E0B; margin: 20px 0;">
                            <p style="margin: 0 0 5px 0;"><strong>📄 Tipo:</strong> ${type === 'blog' ? 'Post no Blog' : 'Tópico no Fórum'}</p>
                            <p style="margin: 0;"><strong>📌 Título:</strong> ${post.titulo || post.title}</p>
                        </div>
                        
                        <p>Para ler o conteúdo completo e interagir com outros profissionais, acesse agora mesmo.</p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${link}" style="background-color: #1B4332; color: #ffffff; text-decoration: none; padding: 12px 25px; border-radius: 50px; font-weight: bold; font-size: 16px; display: inline-block;">Acessar Conteúdo</a>
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
            `;

            const mailOptions = {
                from: process.env.EMAIL_FROM || '"Yelo" <contato@yelopsi.com.br>',
                to: psi.email,
                subject: `Novo conteúdo para você na Yelo: ${post.titulo || post.title}`,
                html: htmlEmail,
                attachments: [
                    {
                        filename: 'logo-branca.png',
                        path: '../public/assets/logos/logo-branca.png',
                        cid: 'logoYelo' // same cid value as in the html img src
                    }
                ]
            };

            // Disparo não-blocante (assíncrono em background por psicólogo)
            transporter.sendMail(mailOptions).catch(err => {
                console.error(`[NotificationService] Falha ao enviar e-mail para ${psi.email}:`, err.message);
            });
        }

        console.log(`[NotificationService] Disparo de e-mails concluído.`);

    } catch (error) {
        console.error('[NotificationService] Erro na notificação de novo post:', error);
    }
};

module.exports = {
    notifyNewPost
};

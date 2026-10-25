const db = require('../models');
const { Op } = require('sequelize');
const nodemailer = require('nodemailer');
const { getBaseTemplate } = require('./emailService');
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

        const authorId = post.PsychologistId || post.psychologistId || post.authorId || null;

        // 1. Criar o Aviso no Dashboard (Aviso Global - psychologistId: null)
        const tituloAviso = type === 'blog' ? `Novo Artigo no Blog: ${post.titulo || post.title}` : `Novo Tópico no Fórum: ${post.titulo || post.title}`;
        let conteudoAviso = `Ei! Acabamos de publicar um conteúdo novo que pode te interessar. Vá dar uma olhada e interaja com a comunidade!`;
        
        if (type === 'blog') {
            const blogIdentifier = post.slug || post.id;
            conteudoAviso += `<br><br><a href="/blog/post/${blogIdentifier}" target="_blank" class="aviso-link-direto" data-blog-id="${post.id}" data-author-id="${authorId || ''}" style="color: #1B4332; font-weight: bold; text-decoration: underline;">Clique aqui para ler o artigo</a>.`;
        } else if (type === 'forum') {
            conteudoAviso += `<br><br><a href="#" class="aviso-link-direto" data-post-id="${post.id}" data-author-id="${authorId || ''}" onclick="window.loadPage('psi_forum.html?postId=${post.id}'); return false;" style="color: #1B4332; font-weight: bold; text-decoration: underline;">Clique aqui para acessar o tópico</a>.`;
        }
        
        if (db.Aviso) {
            const novoAviso = await db.Aviso.create({
                title: tituloAviso,
                content: conteudoAviso,
                author: 'Equipe Yelo',
                status: 'published',
                psychologistId: null // Aviso global
            });
            console.log(`[NotificationService] Aviso global criado com sucesso no dashboard.`);

            // Marca previamente como lido para o autor
            if (authorId && db.AvisoLido) {
                await db.AvisoLido.findOrCreate({
                    where: { avisoId: novoAviso.id, psychologistId: authorId }
                }).catch(() => {});
            }
        }

        // 2. Bloqueio de e-mail para Blog a pedido do usuário (redução de custos)
        if (type === 'blog') {
            console.log('[NotificationService] Envio de e-mail para blog desativado para redução de custos.');
            return;
        }

        // 3. Buscar todos os psicólogos ativos (trial ou pago) para envios do fórum
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
        let link;
        if (type === 'blog') {
            link = `${frontendUrl}/blog/post/${post.slug}`;
        } else {
            link = `${frontendUrl}/psi/psi_dashboard?postId=${post.id}`;
        }
        
        for (const psi of activePsis) {
            // Não envia notificação de novo post para o próprio psicólogo que o publicou
            if (authorId && psi.id === authorId) {
                continue;
            }

            const psiName = psi.nome.split(' ')[0] || 'Psicólogo(a)';
            
            const title = `Novo conteúdo na Comunidade Yelo Psi ✨`;
            const contentTypeLabel = type === 'blog' ? '📄 Artigo Clínico' : '💬 Debate no Fórum';
            const content = `
                <p>Olá, <strong>${psiName}</strong>!</p>
                <p>Temos novidades fresquinhas na nossa rede. Um novo conteúdo acabou de ser publicado na comunidade e achamos que você vai gostar de conferir:</p>
                
                <div style="background-color: #F8FAF7; border: 1px solid #E2EADF; border-radius: 14px; padding: 18px 20px; margin: 22px 0;">
                    <span style="font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">${contentTypeLabel}</span>
                    <h3 style="color: #1B4332; font-size: 17px; margin: 6px 0 0 0; font-weight: 700;">
                        ${post.titulo || post.title}
                    </h3>
                </div>
                
                <p>Para ler a publicação completa e interagir com outros psicólogos, acesse agora pelo seu painel:</p>
                
                <div class="btn-container">
                    <a href="${link}" target="_blank" rel="noopener noreferrer" class="btn" style="display: inline-block; padding: 14px 34px; background-color: #1B4332; color: #FFFFFF !important; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 15px;">Acessar Conteúdo &rarr;</a>
                </div>
            `;

            const htmlEmail = getBaseTemplate(title, content, {
                tagText: type === 'blog' ? '● Blog Yelo' : '● Fórum Yelo Psi',
                preheader: `Novo conteúdo na Yelo: ${post.titulo || post.title}`
            });

            const mailOptions = {
                from: process.env.EMAIL_FROM || '"Yelo" <contato@yelopsi.com.br>',
                to: psi.email,
                subject: `Novo conteúdo para você na Yelo: ${post.titulo || post.title}`,
                html: htmlEmail
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

// backend/services/emailService.js

require('dotenv').config();

// Em um ambiente de produção, você usaria um SDK como @sendgrid/mail
// const sgMail = require('@sendgrid/mail');
// sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
 * Envia um e-mail de convite para um psicólogo na lista de espera.
 * @param {object} psychologist - O objeto do psicólogo da tabela WaitingList.
 * @param {string} invitationLink - O link de convite único.
 */
async function sendInvitationEmail(psychologist, invitationLink) {
    const { nome, email, valor_sessao_faixa } = psychologist;

    const emailContent = {
        to: email,
        from: 'nao-responda@jano.com', // Use um e-mail verificado no seu serviço
        subject: 'Uma oportunidade para você na Jano!',
        html: `
            <div style="font-family: sans-serif; line-height: 1.6;">
                <h2>Olá, ${nome},</h2>
                <p>Temos ótimas notícias!</p>
                <p>Uma vaga para um profissional com seu perfil (atuando na faixa de <strong>${valor_sessao_faixa}</strong>) acaba de ser aberta em nossa plataforma, devido à alta demanda de pacientes.</p>
                <p>Estamos felizes em te convidar para finalizar seu cadastro e se juntar à nossa comunidade.</p>
                <p>Para garantir sua vaga, por favor, complete seu cadastro através do link abaixo. <strong>Este convite exclusivo é válido por 7 dias.</strong></p>
                <a href="${invitationLink}" style="background-color: #FFEE8C; color: #1B4332; padding: 15px 25px; text-decoration: none; border-radius: 30px; font-weight: bold; display: inline-block; margin: 20px 0;">Completar Cadastro Agora</a>
                <p>Após esse período, o convite expirará e a oportunidade será oferecida ao próximo profissional da lista.</p>
                <p>Estamos ansiosos para ter você conosco!</p>
                <p>Atenciosamente,<br>Equipe Jano</p>
            </div>
        `,
    };

    try {
        // Em produção, você descomentaria a linha abaixo:
        // await sgMail.send(emailContent);
        console.log(`[SIMULAÇÃO] E-mail de convite enviado para ${email}. Link: ${invitationLink}`);
    } catch (error) {
        console.error(`Erro ao enviar e-mail para ${email}:`, error);
    }
}

async function sendPasswordResetEmail(user, resetLink) {
    const { nome, email } = user;

    const emailContent = {
        to: email,
        from: 'nao-responda@jano.com',
        subject: 'Redefinição de Senha - Jano',
        html: `
            <div style="font-family: sans-serif; line-height: 1.6;">
                <h2>Olá, ${nome},</h2>
                <p>Recebemos uma solicitação para redefinir sua senha na plataforma Jano.</p>
                <p>Se foi você, clique no botão abaixo para criar uma nova senha. Este link é válido por 1 hora.</p>
                <a href="${resetLink}" style="background-color: #FFEE8C; color: #1B4332; padding: 15px 25px; text-decoration: none; border-radius: 30px; font-weight: bold; display: inline-block; margin: 20px 0;">Redefinir Minha Senha</a>
                <p>Se você não solicitou esta alteração, pode ignorar este e-mail com segurança.</p>
                <p>Atenciosamente,<br>Equipe Jano</p>
            </div>
        `,
    };

    try {
        // Em produção, você usaria um serviço real
        // await sgMail.send(emailContent);
        console.log(`[SIMULAÇÃO] E-mail de redefinição de senha enviado para ${email}. Link: ${resetLink}`);
    } catch (error) {
        console.error(`Erro ao enviar e-mail de redefinição para ${email}:`, error);
    }
}

/**
 * Envia um e-mail informando o psicólogo sobre a rejeição do seu cadastro.
 * @param {object} psychologist - O objeto do psicólogo.
 * @param {string} reason - O motivo da rejeição.
 */
async function sendRejectionEmail(psychologist, reason) {
    const { nome, email } = psychologist;

    const emailContent = {
        to: email,
        from: 'nao-responda@jano.com',
        subject: 'Atualização sobre seu cadastro na Jano',
        html: `
            <div style="font-family: sans-serif; line-height: 1.6;">
                <h2>Olá, ${nome},</h2>
                <p>Agradecemos seu interesse em fazer parte da comunidade Jano.</p>
                <p>Após análise, seu cadastro não pôde ser aprovado neste momento pelo seguinte motivo:</p>
                <div style="background-color: #f8f9fa; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
                    <p style="margin: 0;"><em>${reason}</em></p>
                </div>
                <p>Se você acredita que isso foi um erro ou pode corrigir a pendência, por favor, entre em contato com nosso suporte.</p>
                <p>Atenciosamente,<br>Equipe Jano</p>
            </div>
        `,
    };

    console.log(`[SIMULAÇÃO] E-mail de rejeição enviado para ${email}. Motivo: ${reason}`);
    // Em produção: await sgMail.send(emailContent);
}

/**
 * Envia um e-mail de boas-vindas para um psicólogo aprovado.
 * @param {object} psychologist - O objeto do psicólogo.
 */
async function sendApprovalEmail(psychologist) {
    const { nome, email } = psychologist;

    const emailContent = {
        to: email,
        from: 'nao-responda@jano.com',
        subject: 'Seu perfil na Jano foi aprovado!',
        html: `
            <div style="font-family: sans-serif; line-height: 1.6;">
                <h2>Parabéns, ${nome}!</h2>
                <p>Temos o prazer de informar que seu cadastro na plataforma Jano foi <strong>aprovado</strong> por nossa equipe!</p>
                <p>Seu perfil já está ativo e pode ser recomendado para pacientes que buscam um profissional com suas qualificações.</p>
                <p>Sugerimos os seguintes próximos passos:</p>
                <ul>
                    <li>Acesse seu painel para revisar e completar todas as informações do seu perfil.</li>
                    <li>Explore os recursos disponíveis, como a comunidade de profissionais (em breve).</li>
                </ul>
                <a href="http://127.0.0.1:5500/login.html" style="background-color: #FFEE8C; color: #1B4332; padding: 15px 25px; text-decoration: none; border-radius: 30px; font-weight: bold; display: inline-block; margin: 20px 0;">Acessar meu Painel</a>
                <p>Seja bem-vindo(a) à nossa comunidade!</p>
                <p>Atenciosamente,<br>Equipe Jano</p>
            </div>
        `,
    };

    console.log(`[SIMULAÇÃO] E-mail de aprovação enviado para ${email}.`);
    // Em produção: await sgMail.send(emailContent);
}

module.exports = { sendInvitationEmail, sendPasswordResetEmail, sendRejectionEmail, sendApprovalEmail };
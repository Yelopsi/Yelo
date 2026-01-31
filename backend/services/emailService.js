// backend/services/emailService.js
const db = require('../models');
const nodemailer = require('nodemailer');

// Mapeamento de variáveis (Suporta tanto EMAIL_ quanto SMTP_)
const host = process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.gmail.com';
const port = process.env.EMAIL_PORT || process.env.SMTP_PORT || 587;
const user = process.env.EMAIL_USER || process.env.SMTP_USER;
const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS;

// --- DIAGNÓSTICO: Verifica se as variáveis existem ---
if (!user || !pass) {
    console.error("⚠️ [EMAIL] ATENÇÃO: Credenciais de e-mail (SMTP_USER/PASS) não estão definidas no .env");
}

// Configuração do Transporter (Use suas credenciais reais aqui)
// Se usar Gmail, precisa de "Senha de App". Se usar Resend/SendGrid, use as credenciais SMTP deles.
const transporter = nodemailer.createTransport({
    host: host,
    port: port,
    secure: false, // true para 465, false para outras portas
    auth: {
        // Usa string vazia como fallback para evitar o erro "Missing credentials for PLAIN"
        user: user || '',
        pass: pass || ''
    },
    debug: true, // Ativa logs detalhados do SMTP
    logger: true // Loga no console do servidor
});

/**
 * TEMPLATE BASE YELO (HTML/CSS)
 * Substitui {{variaveis}} pelo conteúdo real.
 */
const getHtmlTemplate = (titulo, nomeCliente, corpoMensagem, dadosExtras = {}) => {
    const { valor, vencimento, linkAcao, textoBotao, linhaDigitavel } = dadosExtras;

    // Variáveis de Cor do Design System
    const corVerde = '#1B4332';
    const corAmarela = '#FFEE8C';
    const corFundo = '#fdfaf6';

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Yelo Saúde Mental</title>
    <style>
        body { margin: 0; padding: 0; background-color: ${corFundo}; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #555555; line-height: 1.6; }
        .container { max-width: 600px; margin: 20px auto; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
        .header { background-color: ${corVerde}; padding: 40px 20px; text-align: center; }
        .header h1 { color: #FFFFFF; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -0.5px; }
        .content { padding: 40px 30px; text-align: center; }
        .titulo-acao { color: ${corVerde}; font-size: 22px; font-weight: bold; margin-bottom: 20px; font-family: 'Georgia', serif; }
        .texto-principal { font-size: 16px; color: #333333; margin-bottom: 30px; }
        .box-destaque { background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center; }
        .valor { font-size: 28px; font-weight: bold; color: ${corVerde}; }
        .btn-cta { display: inline-block; background-color: ${corAmarela}; color: ${corVerde}; text-decoration: none; padding: 15px 35px; border-radius: 50px; font-weight: bold; font-size: 16px; margin-top: 20px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1); }
        .footer { background-color: ${corFundo}; padding: 20px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee; }
        .linha-digitavel { margin-top: 30px; font-size: 12px; color: #777; word-break: break-all; background: #eee; padding: 10px; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Yelo Saúde Mental</h1>
        </div>
        <div class="content">
            <div class="titulo-acao">${titulo}</div>
            <p class="texto-principal">
                Olá, <strong>${nomeCliente}</strong>.<br>
                ${corpoMensagem}
            </p>

            ${valor ? `
            <div class="box-destaque">
                <div style="font-size: 14px; color: #777; margin-bottom: 5px;">Valor da Fatura</div>
                <div class="valor">R$ ${parseFloat(valor).toFixed(2).replace('.', ',')}</div>
                ${vencimento ? `<div style="font-size: 14px; color: #777; margin-top: 5px;">Vencimento: ${vencimento.split('-').reverse().join('/')}</div>` : ''}
            </div>
            ` : ''}

            ${linkAcao ? `<a href="${linkAcao}" class="btn-cta">${textoBotao || 'Ver Fatura'}</a>` : ''}
            
            ${linhaDigitavel ? `
            <div class="linha-digitavel">
                Linha digitável (copie e cole no seu banco):<br>
                <strong>${linhaDigitavel}</strong>
            </div>
            ` : ''}
        </div>
        <div class="footer">
            Enviado com carinho por <strong>Yelo Saúde Mental</strong><br>
            Este é um e-mail automático, por favor não responda.
        </div>
    </div>
</body>
</html>
    `;
};

// Função genérica de envio
const sendEmail = async (to, subject, html) => {
    try {
        await transporter.sendMail({
            // Usa variável de ambiente ou fallback, garantindo que o remetente bata com a autenticação se necessário
            from: process.env.EMAIL_FROM || '"Yelo Saúde Mental" <nao-responda@yelopsi.com.br>', 
            to,
            subject,
            html
        });
        console.log(`📧 E-mail enviado para ${to}: ${subject}`);
    } catch (error) {
        console.error(`❌ Erro ao enviar e-mail para ${to}:`, error.message);
        
        // Loga o erro no banco para o KPI do Dashboard
        try {
            if (db.SystemLog) {
                await db.SystemLog.create({
                    level: 'error',
                    message: `[EMAIL_FAIL] Falha ao enviar para ${to}: ${error.message}`,
                    meta: { subject, error: error.stack }
                });
            }
        } catch (e) { console.error("Falha ao salvar log de email:", e.message); }

        throw error; // Relança para que o controller saiba que falhou
    }
};

// --- FUNÇÕES DE NOTIFICAÇÃO (Mapeadas do Asaas) ---

exports.sendBillCreatedEmail = async (user, payment) => {
    const html = getHtmlTemplate(
        'Sua fatura já está disponível',
        user.nome,
        'Sua nova fatura da Yelo foi gerada. Você pode realizar o pagamento clicando no botão abaixo ou usando a linha digitável.',
        {
            valor: payment.value,
            vencimento: payment.dueDate,
            linkAcao: payment.invoiceUrl,
            textoBotao: 'Pagar Fatura',
            linhaDigitavel: payment.bankSlipUrl ? null : null // O Asaas nem sempre manda a linha no payload de criação, melhor focar no link
        }
    );
    await sendEmail(user.email, 'Nova Fatura Disponível - Yelo', html);
};

exports.sendDueDateWarningEmail = async (user, payment) => {
    const html = getHtmlTemplate(
        'Lembrete de Vencimento',
        user.nome,
        'Passando para lembrar que sua fatura vence em breve. Mantenha sua assinatura ativa para continuar atendendo seus pacientes.',
        {
            valor: payment.value,
            vencimento: payment.dueDate,
            linkAcao: payment.invoiceUrl,
            textoBotao: 'Acessar Fatura'
        }
    );
    await sendEmail(user.email, 'Lembrete: Sua fatura vence em breve', html);
};

exports.sendDigitableLineEmail = async (user, payment) => {
    // Tenta pegar a linha digitável se vier no payload, senão manda o link
    const linha = payment.nossoNumero || "Acesse o link para ver a linha digitável"; 
    
    const html = getHtmlTemplate(
        'Sua fatura vence hoje!',
        user.nome,
        'Hoje é o dia do vencimento da sua fatura. Para facilitar, aqui está o link direto.',
        {
            valor: payment.value,
            vencimento: payment.dueDate,
            linkAcao: payment.invoiceUrl,
            textoBotao: 'Pagar Agora'
        }
    );
    await sendEmail(user.email, 'Sua fatura vence hoje - Yelo', html);
};

exports.sendOverdueEmail = async (user, payment) => {
    const html = getHtmlTemplate(
        'Fatura em Aberto',
        user.nome,
        'Identificamos que sua fatura ainda não foi compensada. Caso já tenha pago, desconsidere este aviso. Se não, clique abaixo para regularizar.',
        {
            valor: payment.value,
            vencimento: payment.dueDate,
            linkAcao: payment.invoiceUrl,
            textoBotao: 'Regularizar Pagamento'
        }
    );
    await sendEmail(user.email, 'Aviso de Fatura em Aberto', html);
};

exports.sendBillUpdatedEmail = async (user, payment) => {
    const html = getHtmlTemplate(
        'Fatura Atualizada',
        user.nome,
        'Houve uma atualização nos dados da sua fatura (valor ou data de vencimento). Confira os novos detalhes abaixo.',
        {
            valor: payment.value,
            vencimento: payment.dueDate,
            linkAcao: payment.invoiceUrl,
            textoBotao: 'Ver Fatura Atualizada'
        }
    );
    await sendEmail(user.email, 'Atualização na sua Fatura', html);
};

// --- FUNÇÕES EXISTENTES (Mantidas e Atualizadas para o novo Template) ---

exports.sendPaymentConfirmationEmail = async (user, planType, value) => {
    const html = getHtmlTemplate(
        'Pagamento Confirmado! 🎉',
        user.nome,
        `Recebemos o pagamento da sua assinatura do plano <strong>${planType}</strong>. Seu perfil está ativo e pronto para receber pacientes.`,
        {
            valor: value,
            linkAcao: 'https://www.yelopsi.com.br/psi/dashboard',
            textoBotao: 'Acessar Dashboard'
        }
    );
    await sendEmail(user.email, 'Pagamento Confirmado - Yelo', html);
};

exports.sendPaymentFailedEmail = async (user, invoiceUrl) => {
    const html = getHtmlTemplate(
        'Falha no Pagamento',
        user.nome,
        'Não conseguimos processar o pagamento da sua assinatura. Por favor, verifique seus dados de pagamento ou tente outro cartão.',
        {
            linkAcao: invoiceUrl,
            textoBotao: 'Tentar Novamente'
        }
    );
    await sendEmail(user.email, 'Ação Necessária: Falha no Pagamento', html);
};

exports.sendSubscriptionCancelledEmail = async (user) => {
    const html = getHtmlTemplate(
        'Assinatura Cancelada',
        user.nome,
        'Sua assinatura foi cancelada e seu perfil não aparecerá mais nas buscas. Esperamos te ver de volta em breve!',
        {
            linkAcao: 'https://www.yelopsi.com.br/psi/assinatura',
            textoBotao: 'Reativar Assinatura'
        }
    );
    await sendEmail(user.email, 'Assinatura Cancelada - Yelo', html);
};

exports.sendWelcomeEmail = async (user, type) => {
    const titulo = type === 'psychologist' ? 'Bem-vindo(a) à Yelo Psi!' : 'Bem-vindo(a) à Yelo!';
    const msg = type === 'psychologist' 
        ? 'Estamos muito felizes em ter você conosco. Complete seu perfil para começar a aparecer nas buscas.'
        : 'Obrigado por se cadastrar. Encontre o profissional ideal para você agora mesmo.';
    
    const link = type === 'psychologist' 
        ? 'https://www.yelopsi.com.br/psi/login' 
        : 'https://www.yelopsi.com.br/login';

    const html = getHtmlTemplate(titulo, user.nome, msg, { linkAcao: link, textoBotao: 'Acessar Minha Conta' });
    await sendEmail(user.email, titulo, html);
};

exports.sendPasswordResetEmail = async (user, resetLink) => {
    const html = getHtmlTemplate(
        'Recuperação de Senha',
        user.nome,
        'Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo para criar uma nova senha.',
        {
            linkAcao: resetLink,
            textoBotao: 'Redefinir Senha'
        }
    );
    await sendEmail(user.email, 'Redefinição de Senha - Yelo', html);
};

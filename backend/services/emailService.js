// backend/services/emailService.js
const db = require('../models');
const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');

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
    debug: process.env.NODE_ENV !== 'production', // Desativa em produção
    logger: process.env.NODE_ENV !== 'production' // Desativa em produção
});

const templateCache = {};

/**
 * Lê e renderiza um template HTML substituindo as tags.
 */
async function renderTemplate(templateName, variables) {
    if (!templateCache[templateName] || process.env.NODE_ENV !== 'production') {
        // Como os arquivos HTML foram salvos na mesma pasta deste serviço (backend/services)
        const filePath = path.join(__dirname, `${templateName}.html`);
        try {
            templateCache[templateName] = await fs.readFile(filePath, 'utf-8');
        } catch (error) {
            console.error(`[EMAIL] Erro ao ler template ${templateName}:`, error);
            return `<p>Aviso da plataforma Yelo</p>`;
        }
    }

    let html = templateCache[templateName];
    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        html = html.replace(regex, value || '');
    }
    return html;
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

// Exporta a função genérica para poder ser usada na nova rota de suporte
exports.sendEmail = sendEmail;

// --- FUNÇÕES DE NOTIFICAÇÃO (Mapeadas do Asaas) ---

exports.sendBillCreatedEmail = async (user, payment) => {
    const html = await renderTemplate('fatura_gerada', {
        nome: user.nome,
        valor: parseFloat(payment.value).toFixed(2).replace('.', ','),
        vencimento: payment.dueDate.split('-').reverse().join('/'),
        linkAcao: payment.invoiceUrl
    });
    await sendEmail(user.email, 'Nova Fatura Disponível - Yelo', html);
};

exports.sendDueDateWarningEmail = async (user, payment) => {
    const html = await renderTemplate('vencimento_proximo', {
        nome: user.nome,
        valor: parseFloat(payment.value).toFixed(2).replace('.', ','),
        vencimento: payment.dueDate.split('-').reverse().join('/'),
        linkAcao: payment.invoiceUrl
    });
    await sendEmail(user.email, 'Lembrete: Sua fatura vence em breve', html);
};

exports.sendDigitableLineEmail = async (user, payment) => {
    const linha = payment.nossoNumero || "Acesse sua fatura para ver o código copia e cola"; 
    const html = await renderTemplate('linha_digitavel', {
        nome: user.nome,
        valor: parseFloat(payment.value).toFixed(2).replace('.', ','),
        linhaDigitavel: linha,
        linkAcao: payment.invoiceUrl
    });
    await sendEmail(user.email, 'Sua fatura vence hoje - Yelo', html);
};

exports.sendOverdueEmail = async (user, payment) => {
    // Usando o modelo de falha de pagamento para fatura atrasada também
    const html = await renderTemplate('falha_pagamento', {
        nome: user.nome,
        linkAcao: payment.invoiceUrl
    });
    await sendEmail(user.email, 'Aviso de Fatura em Aberto', html);
};

exports.sendBillUpdatedEmail = async (user, payment) => {
    // Reutilizando fatura_gerada para atualização
    const html = await renderTemplate('fatura_gerada', {
        nome: user.nome,
        valor: parseFloat(payment.value).toFixed(2).replace('.', ','),
        vencimento: payment.dueDate.split('-').reverse().join('/'),
        linkAcao: payment.invoiceUrl
    });
    await sendEmail(user.email, 'Atualização na sua Fatura', html);
};

exports.sendInvitationEmail = async (candidate, invitationLink) => {
    const html = await renderTemplate('convite_lista_espera', {
        nome: candidate.nome || 'Profissional',
        linkAcao: invitationLink
    });
    await sendEmail(candidate.email, 'Seu convite para a Yelo chegou!', html);
};

exports.sendPaymentConfirmationEmail = async (user, planType, value) => {
    const html = await renderTemplate('pagamento_confirmado', {
        nome: user.nome,
        plano: planType || 'Ecossistema Yelo',
        valor: parseFloat(value).toFixed(2).replace('.', ','),
        linkAcao: (process.env.FRONTEND_URL || 'https://www.yelopsi.com.br') + '/login'
    });
    await sendEmail(user.email, 'Pagamento Confirmado - Yelo', html);
};

exports.sendPaymentFailedEmail = async (user, invoiceUrl) => {
    const html = await renderTemplate('falha_pagamento', {
        nome: user.nome,
        linkAcao: invoiceUrl || ((process.env.FRONTEND_URL || 'https://www.yelopsi.com.br') + '/login')
    });
    await sendEmail(user.email, 'Ação Necessária: Falha no Pagamento', html);
};

exports.sendSubscriptionCancelledEmail = async (user) => {
    const html = await renderTemplate('remarketing', {
        titulo: 'Assinatura Cancelada 😢',
        nome: user.nome,
        mensagem: 'Sua assinatura foi cancelada com sucesso e seu perfil não aparecerá mais nas buscas. Se quiser voltar a expandir seus atendimentos, estamos de portas abertas.',
        linkAcao: (process.env.FRONTEND_URL || 'https://www.yelopsi.com.br') + '/login'
    });
    await sendEmail(user.email, 'Assinatura Cancelada - Yelo', html);
};

exports.sendWelcomeEmail = async (user, type) => {
    if (type === 'psychologist') {
        const html = await renderTemplate('boas_vindas_psicologo', {
            nome: user.nome,
            linkAcao: (process.env.FRONTEND_URL || 'https://www.yelopsi.com.br') + '/login',
            textoBotao: 'Acessar meu Consultório'
        });
        await sendEmail(user.email, 'Bem-vindo(a) à Yelo Psi! 💛', html);
    } else {
        const html = await renderTemplate('boas_vindas_paciente', {
            nome: user.nome,
            linkAcao: (process.env.FRONTEND_URL || 'https://www.yelopsi.com.br') + '/questionario',
            textoBotao: 'Encontrar meu Psicólogo'
        });
        await sendEmail(user.email, 'Bem-vindo(a) à Yelo! 💛', html);
    }
};

exports.sendPasswordResetEmail = async (user, resetLink) => {
    // Como podemos enviar para psicólogos ou pacientes, podemos checar se o resetLink contém "type=psychologist"
    const templateName = resetLink.includes('type=psychologist') ? 'recuperacao_senha_psicologo' : 'recuperacao_senha_paciente';
    const html = await renderTemplate(templateName, {
        nome: user.nome,
        linkAcao: resetLink
    });
    await sendEmail(user.email, 'Redefinição de Senha - Yelo', html);
};

exports.sendRemarketingEmail = async (user, step) => {
    let titulo = '';
    let msg = '';
    
    if (step === 1) {
        titulo = 'Seu perfil na Yelo está quase pronto! 🚀';
        msg = 'Notamos que você se cadastrou, mas ainda não ativou sua assinatura. Finalize seu perfil agora para não perder pacientes que buscam exatamente por sua especialidade.';
    } else if (step === 2) {
        titulo = 'Por que escolher a Yelo? 💛';
        msg = 'Com a Yelo, conectamos você a pacientes reais através da nossa inteligência de match. Investimos ativamente em anúncios para garantir que nossa comunidade de psicólogos tenha uma agenda saudável. Assine hoje e apareça nas buscas.';
    } else if (step === 3) {
        titulo = 'Último lembrete: Faça parte da Yelo ⏰';
        msg = 'Esta é uma ótima oportunidade para expandir seus atendimentos com uma plataforma feita com cuidado e ética. Ative sua assinatura agora e desfrute de todos os recursos da nossa comunidade.';
    } else if (step === 4) {
        titulo = `Você tem ${user.whatsapp_clicks || 1} paciente(s) tentando falar com você! 💛`;
        msg = `Notamos que o seu perfil atraiu interessados e você recebeu cliques no seu WhatsApp recentemente! Como seu período de teste terminou e sua assinatura está inativa, sua agenda pública foi bloqueada e os pacientes não conseguem mais entrar em contato. Ative sua assinatura Premium agora para desbloquear seu WhatsApp e voltar a receber novos pacientes sem limites.`;
    }

    const html = await renderTemplate('remarketing', {
        titulo: titulo,
        nome: user.nome,
        mensagem: msg,
        linkAcao: (process.env.FRONTEND_URL || 'https://www.yelopsi.com.br') + '/login'
    });
    await sendEmail(user.email, titulo, html);
};

exports.sendFirstLeadEmail = async (user) => {
    const html = await renderTemplate('remarketing', {
        titulo: '🎉 Você recebeu seu primeiro contato!',
        nome: user.nome,
        mensagem: 'Ótimas notícias! Um paciente acabou de clicar no botão de WhatsApp no seu perfil da Yelo. Isso significa que sua apresentação está atraindo interessados. Acesse sua conta agora para acompanhar seus acessos e aproveitar ao máximo a plataforma.',
        linkAcao: (process.env.FRONTEND_URL || 'https://www.yelopsi.com.br') + '/login'
    });
    await sendEmail(user.email, 'Você recebeu um novo contato! 🎉', html);
};

exports.sendLimitReachedEmail = async (user, maxClicks) => {
    const html = await renderTemplate('remarketing', {
        titulo: '⚠️ Seu limite de contatos gratuitos foi atingido!',
        nome: user.nome,
        mensagem: `Incrível! Você acabou de receber seu ${maxClicks}º contato através da Yelo. Isso mostra que seu perfil atrai muito interesse. Como seu limite de contatos gratuitos do período de teste foi atingido, seu botão de WhatsApp ficará indisponível para novos pacientes a partir de agora. Assine o plano Premium para desbloquear seu perfil e continuar recebendo pacientes!`,
        linkAcao: (process.env.FRONTEND_URL || 'https://www.yelopsi.com.br') + '/login'
    });
    await sendEmail(user.email, 'Seu limite de contatos gratuitos foi atingido! 🚀', html);
};

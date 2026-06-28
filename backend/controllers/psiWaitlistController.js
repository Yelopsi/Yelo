const db = require('../models');
const { Op } = require('sequelize');
const crypto = require('crypto');

// Função auxiliar
const parsePriceRange = (rangeString) => {
    if (!rangeString || typeof rangeString !== 'string') return { min: 0, max: 9999 };
    const numbers = rangeString.match(/\d+/g);
    if (!numbers || numbers.length === 0) return { min: 0, max: 9999 };
    const min = parseInt(numbers[0], 10);
    const max = numbers.length > 1 ? parseInt(numbers[1], 10) : min;
    return { min, max };
};

// ----------------------------------------------------------------------
// Rota: POST /api/psychologists/check-demand
// ----------------------------------------------------------------------
exports.checkDemand = async (req, res) => {    
    try {
        // --- LÓGICA DE VERIFICAÇÃO DE DEMANDA (CORRIGIDA) ---
        const DEMAND_TARGET = 0; 
        // REGRA DE NEGÓCIO: Aprovar todos os cadastros no momento atual.
        // "nenhum psicólogo em hipótese nenhuma deve ser privado de se cadastrar na plataforma."
        return res.status(200).json({ status: 'approved', message: 'Há demanda para este perfil.' });
    } catch (error) {
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

// ----------------------------------------------------------------------
// Rota: POST /api/psychologists/add-to-waitlist
// ----------------------------------------------------------------------
exports.addToWaitlist = async (req, res) => {
    try {
        const { nome, email, telefone, crp, genero_identidade, valor_sessao_faixa, temas_atuacao, praticas_afirmativas, abordagens_tecnicas, utm_source, utm_medium, utm_campaign } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'O e-mail é obrigatório para entrar na lista de espera.' });
        }

        // Verifica se já é um Psicólogo cadastrado e ativo (Evita colocar quem já tem conta na lista)
        const isRegistered = await db.Psychologist.findOne({ where: { email: { [Op.iLike]: email } } });
        if (isRegistered) {
            return res.status(200).json({ message: 'Usuário já registrado. Ignorando lista de espera.' });
        }

        let waitlistEntry = await db.WaitingList.findOne({ where: { email } });
        
        const payload = {
            nome, telefone, crp, genero_identidade, valor_sessao_faixa,
            temas_atuacao, praticas_afirmativas, abordagens_tecnicas,
            utm_source, utm_medium, utm_campaign, status: 'pending'
        };

        if (waitlistEntry) {
            // Se já tentou antes, atualiza com os dados mais recentes de UTM
            await waitlistEntry.update(payload);
        } else {
            waitlistEntry = await db.WaitingList.create({ email, ...payload });
        }

        res.status(201).json({ message: 'E-mail adicionado à lista de espera com sucesso.' });
    } catch (error) {
        res.status(500).json({ error: 'Erro interno no servidor ao salvar na lista de espera.' });
    }
};

// ----------------------------------------------------------------------
// Rota: GET /api/psychologists/waiting-list (Rota Protegida)
// ----------------------------------------------------------------------
exports.getWaitingList = async (req, res) => {
    try {
        const waitingList = await db.WaitingList.findAll({
            where: { status: 'pending' },
            order: [['createdAt', 'DESC']]
        });
        res.status(200).json(waitingList);
    } catch (error) {
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

// ----------------------------------------------------------------------
// Rota: POST /api/psychologists/waiting-list/invite
// ----------------------------------------------------------------------
exports.inviteFromWaitlist = async (req, res) => {
    try {
        const { waitingListId } = req.body;

        if (!waitingListId) {
            return res.status(400).json({ error: 'ID do candidato na lista de espera é obrigatório.' });
        }

        const candidate = await db.WaitingList.findOne({
            where: { id: waitingListId, status: { [Op.in]: ['pending', 'invited'] } }
        });

        if (!candidate) {
            return res.status(404).json({ error: 'Candidato não encontrado.' });
        }

        const invitationToken = crypto.randomBytes(32).toString('hex');
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + 7); // Expira em 7 dias

        await candidate.update({
            status: 'invited',
            invitationToken: invitationToken,
            invitationExpiresAt: expirationDate,
        });

        const frontendUrl = process.env.FRONTEND_URL || 'https://www.yelopsi.com.br';
        const invitationLink = `${frontendUrl}/psi-registro?token=${invitationToken}&email=${encodeURIComponent(candidate.email)}`;
        
        const emailService = require('../services/emailService');
        const htmlContent = `<h2>Olá, ${candidate.nome}!</h2><p>Temos uma ótima notícia: uma vaga foi liberada para você na Yelo!</p><p>Clique no link abaixo para concluir seu cadastro e começar a atender pacientes:</p><a href="${invitationLink}" style="display:inline-block; padding:10px 20px; background:#1B4332; color:#fff; text-decoration:none; border-radius:5px;">Concluir Cadastro</a><p>Seja bem-vindo(a)!</p>`;
        
        try {
            if (typeof emailService.sendInvitationEmail === 'function') {
                await emailService.sendInvitationEmail(candidate, invitationLink);
            } else if (typeof emailService.sendEmail === 'function') {
                await emailService.sendEmail(candidate.email, "Seu convite para a Yelo chegou! 🎉", htmlContent);
            }
            res.status(200).json({ message: `Convite enviado com sucesso para ${candidate.email}.` });
        } catch (emailErr) {
            res.status(200).json({ message: `Status atualizado, mas houve uma falha ao disparar o e-mail via SMTP para ${candidate.email}. O Link de cadastro manual é: ${invitationLink}` });
        }
    } catch (error) {
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

// ----------------------------------------------------------------------
// Rota: DELETE /api/psychologists/waiting-list/:id
// ----------------------------------------------------------------------
exports.deleteFromWaitlist = async (req, res) => {
    try {
        const { id } = req.params;
        const lead = await db.WaitingList.findByPk(id);
        
        if (!lead) {
            return res.status(404).json({ error: 'Lead não encontrado na lista de espera.' });
        }

        await lead.destroy();
        res.status(200).json({ message: 'Lead excluído com sucesso.' });
    } catch (error) {
        console.error('Erro ao excluir lead da lista de espera:', error);
        res.status(500).json({ error: 'Erro ao excluir lead da lista de espera.' });
    }
};
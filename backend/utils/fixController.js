const db = require('../models');
const { Op, DataTypes } = require('sequelize');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

exports.activatePsis = async (req, res) => { /* ... */ };

exports.fixDbColumns = async (req, res) => { /* ... */ };

exports.fixVipAll = async (req, res) => { /* ... */ };

exports.fixResetPayment = async (req, res) => { /* ... */ };

exports.debugJuliana = async (req, res) => {
    try {
        const email = req.query.email || 'psijulianachumbo@gmail.com';
        const psy = await db.Psychologist.findOne({ where: { email } });
        if (!psy) return res.json({ error: 'Conta não encontrada no banco.' });
        
        const agora = new Date();
        const isVip = psy.is_exempt === true || String(psy.is_exempt).toLowerCase() === 'true' || psy.is_exempt === 1;
        const validade = psy.planExpiresAt ? new Date(psy.planExpiresAt) : null;
        const daysSinceCreation = (agora - new Date(psy.createdAt)) / (1000 * 60 * 60 * 24);
        
        let motivo = "NÃO DEVERIA APARECER";
        if (isVip) motivo = "PASSOU PORQUE É VIP (is_exempt = true)";
        else if (psy.status === 'pending' && daysSinceCreation <= 14) motivo = "PASSOU PORQUE ESTÁ NO TRIAL (pending <= 14 dias)";
        else if (validade && validade > agora) motivo = "PASSOU PORQUE A DATA DE VENCIMENTO ESTÁ NO FUTURO";
        
        res.json({
            DADOS_DO_BANCO: { email: psy.email, status: psy.status, is_exempt: psy.is_exempt, planExpiresAt: psy.planExpiresAt, createdAt: psy.createdAt, stripeSubscriptionId: psy.stripeSubscriptionId, plano: psy.plano },
            LEITURA_DO_SISTEMA: { considerado_vip: isVip, dias_desde_criacao: daysSinceCreation, vencimento_maior_que_hoje: validade && validade > agora },
            CONCLUSAO: motivo
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.cleanSoftDeleted = async (req, res) => {
    try {
        const psisNaLixeira = await db.sequelize.query(`
            SELECT id FROM "Psychologists" WHERE "deletedAt" IS NOT NULL;
        `, { type: db.sequelize.QueryTypes.SELECT });

        const ids = psisNaLixeira.map(p => p.id);

        if (ids.length > 0) {
            const tabelasComPsychologistId = [
                '"GamificationLogs"', '"WhatsappClickLogs"', '"ProfileAppearanceLogs"',
                '"MatchEvents"', '"Appointments"', '"Expenses"', '"ExitSurveys"',
                '"Reviews"', '"Conversations"', '"Answers"', '"QuestionIgnores"'
            ];

            for (const tabela of tabelasComPsychologistId) {
                try { await db.sequelize.query(`DELETE FROM ${tabela} WHERE "psychologistId" IN (:ids)`, { replacements: { ids } }); } catch(e) { }
            }

            const tabelasComPsychologistIdMaiusculo = [
                '"ForumVotes"', '"ForumCommentVotes"', '"ForumComments"', '"ForumPosts"'
            ];
            for (const tabela of tabelasComPsychologistIdMaiusculo) {
                try { await db.sequelize.query(`DELETE FROM ${tabela} WHERE "PsychologistId" IN (:ids)`, { replacements: { ids } }); } catch(e) { }
            }

            try { await db.sequelize.query(`DELETE FROM posts WHERE psychologist_id IN (:ids)`, { replacements: { ids } }); } catch(e) {}
            try { await db.sequelize.query(`DELETE FROM "ForumReports" WHERE "reporterId" IN (:ids)`, { replacements: { ids } }); } catch(e) {}
            try { await db.sequelize.query(`DELETE FROM "Messages" WHERE "senderId" IN (:ids) AND "senderType" = 'psychologist'`, { replacements: { ids } }); } catch(e) {}
            try { await db.sequelize.query(`DELETE FROM "Messages" WHERE "recipientId" IN (:ids) AND "recipientType" = 'psychologist'`, { replacements: { ids } }); } catch(e) {}
        }

        const [results] = await db.sequelize.query(`
            DELETE FROM "Psychologists" 
            WHERE "deletedAt" IS NOT NULL 
            RETURNING id;
        `);

        res.send(`<div style="font-family:sans-serif; padding:40px;">
                    <h2 style="color:#1B4332;">Limpeza Concluída! 🧹</h2>
                    <p><strong>${results.length}</strong> profissionais que estavam na lixeira (Soft Delete) e todos os seus registros associados foram apagados permanentemente.</p>
                  </div>`);
    } catch (error) {
        console.error("Erro no hard delete:", error);
        res.status(500).send("Erro ao limpar base: " + error.message);
    }
};

exports.runInviteAllWaitlist = async (req, res) => {
    try {
        const waitlist = await db.WaitingList.findAll({ where: { status: 'pending' } });
        if (waitlist.length === 0) return res.send("A lista de espera já está vazia!");

        const emailService = require('../services/emailService');
        let sentCount = 0;

        for (const candidate of waitlist) {
            const invitationToken = crypto.randomBytes(32).toString('hex');
            const expirationDate = new Date();
            expirationDate.setDate(expirationDate.getDate() + 7);

            await candidate.update({ status: 'invited', invitationToken, invitationExpiresAt: expirationDate });

            const link = `${process.env.FRONTEND_URL || 'https://www.yelopsi.com.br'}/psi-registro?token=${invitationToken}&email=${encodeURIComponent(candidate.email)}`;
            const htmlContent = `<h2>Olá, ${candidate.nome}!</h2><p>Uma vaga foi liberada para você na Yelo!</p><a href="${link}" style="display:inline-block; padding:10px 20px; background:#1B4332; color:#fff; text-decoration:none; border-radius:5px;">Concluir Cadastro</a>`;

            try {
                if (typeof emailService.sendInvitationEmail === 'function') await emailService.sendInvitationEmail(candidate, link);
                else if (typeof emailService.sendEmail === 'function') await emailService.sendEmail(candidate.email, "Seu convite para a Yelo chegou! 🎉", htmlContent);
                sentCount++;
            } catch(e) { console.error(`Erro email para ${candidate.email}:`, e.message); }
        }
        res.send(`<h2>✅ Sucesso!</h2><p>${sentCount} psicólogos foram convidados e a lista de espera foi esvaziada.</p>`);
    } catch (error) { res.status(500).send("Erro: " + error.message); }
};

exports.runClearWaitlist = async (req, res) => {
    try {
        const count = await db.WaitingList.count();
        await db.WaitingList.destroy({ where: {} });
        res.send(`<div style="font-family: sans-serif; padding: 20px;"><h2>✅ Sucesso!</h2><p>A lista de espera foi completamente esvaziada. <b>${count}</b> registros foram removidos do banco de dados.</p></div>`);
    } catch (error) { 
        res.status(500).send("Erro ao limpar a lista: " + error.message); 
    }
};

exports.resetFailedInvites = async (req, res) => {
    try {
        const failedInvites = await db.WaitingList.findAll({ where: { status: 'invited' } });
        
        if (failedInvites.length === 0) {
            return res.send("<div style='font-family: sans-serif; padding: 20px;'><h2>Tudo limpo!</h2><p>Não há ninguém com status 'invited' precisando de reenvio.</p></div>");
        }

        const details = failedInvites.map(u => `<li>${u.nome || 'Sem Nome'} - <b>${u.email}</b></li>`).join('');

        await db.WaitingList.update(
            { status: 'pending' },
            { where: { status: 'invited' } }
        );

        res.send(`
            <div style="font-family: sans-serif; padding: 20px; line-height: 1.6;">
                <h2 style="color:#1B4332;">✅ Sucesso! ${failedInvites.length} psicólogos foram resetados.</h2>
                <p>Eles estavam marcados como "Convidados" no banco de dados, mas o e-mail de convite havia falhado por conta daquele erro antigo de senha. Agora eles voltaram para o status <b>Pendente</b>.</p>
                <h3>Quem são eles?</h3>
                <ul>${details}</ul>
                <br>
                <p>Como a senha do e-mail já foi corrigida, você pode clicar no botão abaixo para disparar os e-mails novamente (agora com sucesso):</p>
                <a href="/api/run-invite-all-waitlist" style="display:inline-block; padding:12px 24px; background:#1B4332; color:#fff; text-decoration:none; border-radius:5px; font-weight: bold; margin-top: 10px;">Reenviar Convites Agora</a>
            </div>
        `);
    } catch (error) { res.status(500).send("Erro: " + error.message); }
};

exports.runNotifyTrial = async (req, res) => {
    try {
        const psis = await db.Psychologist.findAll({
            where: {
                [db.Sequelize.Op.or]: [
                    { status: 'pending' },
                    { status: 'inactive' },
                    { status: 'active', plano: 'Essencial' }
                ],
                is_exempt: { [db.Sequelize.Op.not]: true },
                stripeSubscriptionId: null,
                subscriptionId: null
            }
        });

        if (psis.length === 0) return res.send("Nenhum psicólogo encontrado nestas condições.");

        let sentCount = 0;
        
        for (const psi of psis) {
            const trialEndDate = new Date();
            trialEndDate.setDate(trialEndDate.getDate() + 14);

            await db.sequelize.query(
                `UPDATE "Psychologists" SET status = 'active', plano = 'Essencial', "planExpiresAt" = :trialEndDate WHERE id = :id`,
                { replacements: { trialEndDate, id: psi.id } }
            );
            
            sentCount++;
        }
        res.send(`<div style="font-family: sans-serif; padding: 20px;"><h2>✅ Ajuste Concluído!</h2><p>O acesso de 14 dias foi ativado no banco para ${sentCount} profissionais.<br><br><b>Nenhum e-mail foi enviado nesta execução.</b></p></div>`);
    } catch (error) { res.status(500).send("Erro: " + error.message); }
};

exports.dispararErrataTrial = async (req, res) => {
    try {
        const psis = await db.Psychologist.findAll({
            where: {
                status: 'active',
                plano: 'Essencial',
                is_exempt: { [db.Sequelize.Op.not]: true },
                stripeSubscriptionId: null
            }
        });

        if (psis.length === 0) return res.send("Nenhum psicólogo elegível para receber a errata.");

        const emailService = require('../services/emailService');
        let sentCount = 0;
        
        for (const psi of psis) {
            const htmlContent = `
                <div style="font-family: sans-serif; color: #333; line-height: 1.6;">
                    <h2 style="color: #1B4332;">Oops! Corrigimos um pequeno bug, ${psi.nome.split(' ')[0]}! 🛠️</h2>
                    <p>Aqui é o Anderson, da Yelo.</p>
                    <p>Recentemente, liberamos o seu acesso Premium de 14 dias. Porém, devido a uma falha no nosso sistema, o seu painel pode ter exibido a mensagem de "Expirado" ou "Bloqueado" de forma incorreta logo após o seu login.</p>
                    <p><strong>A boa notícia: já resolvemos isso! ✅</strong></p>
                    <p>O seu período de teste de 14 dias está 100% ativo a partir de agora. Você já pode acessar a plataforma normalmente, configurar seu perfil completo e explorar todas as ferramentas sem nenhum bloqueio.</p>
                    <p>Pedimos desculpas pela confusão e agradecemos imensamente a paciência!</p>
                    <a href="${process.env.FRONTEND_URL || 'https://www.yelopsi.com.br'}/login" style="display: inline-block; padding: 12px 24px; background-color: #1B4332; color: #fff; text-decoration: none; border-radius: 50px; font-weight: bold; margin-top: 15px;">Acessar meu Painel</a>
                </div>
            `;
            try { await emailService.sendEmail(psi.email, "Correção: Seu acesso de 14 dias está liberado! ✅", htmlContent); sentCount++; } 
            catch(e) { console.error(`Erro ao enviar errata para ${psi.email}:`, e.message); }
        }
        res.send(`<div style="font-family: sans-serif; padding: 20px;"><h2>✅ Errata Enviada!</h2><p>E-mails de correção enviados com sucesso para ${sentCount} profissionais.</p></div>`);
    } catch (error) { res.status(500).send("Erro: " + error.message); }
};

exports.runInadimplentes = async (req, res) => {
    try {
        let ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/v3';
        ASAAS_API_URL = ASAAS_API_URL.trim().replace(/\/+$/, '');
        if (ASAAS_API_URL.includes('sandbox.asaas.com') && !ASAAS_API_URL.includes('/api')) {
            ASAAS_API_URL = ASAAS_API_URL.replace('sandbox.asaas.com', 'sandbox.asaas.com/api');
        }
        const ASAAS_API_KEY = process.env.ASAAS_API_KEY ? process.env.ASAAS_API_KEY.trim() : '';

        const psis = await db.Psychologist.findAll({
            order: [['createdAt', 'DESC']]
        });

        let html = `
        <div style="font-family:sans-serif; padding:20px; max-width: 1200px; margin: 0 auto;">
            <h2 style="color:#1B4332;">Relatório de Auditoria e Pagamentos</h2>
            <p>Veja o diagnóstico completo de comunicação com o Asaas.</p>
            <table border="1" cellpadding="10" style="border-collapse: collapse; width: 100%; text-align: left; font-size: 14px;">
                <tr style="background:#f0fdf4; color:#1B4332;">
                    <th>E-mail</th>
                    <th>Status Local</th>
                    <th>Isento?</th>
                    <th>ID Assinatura</th>
                    <th>Status no Asaas</th>
                    <th>Ação Realizada Agora</th>
                </tr>`;

        for (const psi of psis) {
            if (psi.isAdmin) continue; 

            let acao = '-';
            let asaasInfo = '-';
            const subId = psi.stripeSubscriptionId || psi.subscriptionId;
            
            if ((psi.status === 'active' || (psi.plano && psi.plano.trim() !== '')) && psi.is_exempt !== true) {
                if (!subId) {
                    const isTrial = psi.planExpiresAt && new Date(psi.planExpiresAt) > new Date();
                    if (isTrial) {
                        acao = '<span style="color:blue; font-weight:bold;">Mantido (Trial de 14 dias ativo)</span>';
                    } else {
                        await psi.update({ status: 'inactive', plano: null, planExpiresAt: new Date(0) });
                        acao = '<span style="color:red; font-weight:bold;">Revogado (Sem ID de Assinatura e Trial Vencido)</span>';
                    }
                } else {
                    const asaasRes = await fetch(`${ASAAS_API_URL}/subscriptions/${subId}/payments`, {
                        headers: { 'access_token': ASAAS_API_KEY }
                    });

                    if (asaasRes.ok) {
                        const paymentsData = await asaasRes.json();
                        
                        if (paymentsData.data && paymentsData.data.length > 0) {
                            const statuses = paymentsData.data.map(p => p.status).join(', ');
                            asaasInfo = `Encontrados: <b>${statuses}</b>`;

                            const hasOverdue = paymentsData.data.some(p => p.status === 'OVERDUE');
                            const hasPaid = paymentsData.data.some(p => ['CONFIRMED', 'RECEIVED'].includes(p.status));

                            if (hasOverdue) {
                                await psi.update({ status: 'inactive', planExpiresAt: new Date(0) });
                                acao = '<span style="color:red; font-weight:bold;">Revogado (Fatura Vencida)</span>';
                            } else if (!hasPaid) {
                                const isTrial = psi.planExpiresAt && new Date(psi.planExpiresAt) > new Date();
                                if (isTrial) {
                                    acao = '<span style="color:blue; font-weight:bold;">Mantido (Trial // Aguardando 1ª Cobrança)</span>';
                                } else {
                                    await psi.update({ status: 'inactive', plano: null, planExpiresAt: new Date(0), stripeSubscriptionId: null });
                                    acao = '<span style="color:red; font-weight:bold;">Revogado (Nenhum pagamento e Trial Expirado)</span>';
                                }
                            } else {
                                if (psi.status !== 'active') {
                                    await psi.update({ status: 'active' });
                                    acao = '<span style="color:green; font-weight:bold;">Regularizado (Ativado)</span>';
                                } else {
                                acao = '<span style="color:green; font-weight:bold;">Regular (Pago)</span>';
                                }
                            }
                        } else {
                            asaasInfo = '<span style="color:orange;">Nenhuma cobrança gerada ainda</span>';
                            await psi.update({ status: 'inactive', plano: null, planExpiresAt: new Date(0), stripeSubscriptionId: null });
                            acao = '<span style="color:red; font-weight:bold;">Revogado (Sem Cobranças)</span>';
                        }
                    } else {
                        asaasInfo = `<span style="color:red;">Erro API Asaas: ${asaasRes.status}</span>`;
                        if (asaasRes.status === 404) {
                            await psi.update({ status: 'inactive', plano: null, planExpiresAt: new Date(0), stripeSubscriptionId: null });
                            acao = '<span style="color:red; font-weight:bold;">Revogado (Assinatura Excluída no Asaas)</span>';
                        } else {
                            acao = 'Pulado (Falha de comunicação)';
                        }
                    }
                }
            } else {
                if (psi.is_exempt === true) acao = 'Ignorado (É VIP)';
                else acao = 'Ignorado (Sem plano e Inativo/Pendente)';
            }

            html += `<tr>
                <td>${psi.email}</td>
                <td>${psi.status}</td>
                <td>${psi.is_exempt === true ? 'Sim' : 'Não'}</td>
                <td>${subId || '<i style="color:#999">Nenhum</i>'}</td>
                <td>${asaasInfo}</td>
                <td>${acao}</td>
            </tr>`;
        }

        html += '</table></div>';
        res.send(html);
    } catch (err) { res.status(500).send("Erro: " + err.message); }
};

exports.addCnpjColumn = async (req, res) => {
    try {
        await db.sequelize.query('ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "cnpj" VARCHAR(255) UNIQUE;');
        res.send("Sucesso! Coluna CNPJ criada no banco de dados.");
    } catch (error) {
        res.status(500).send("Erro ao criar coluna: " + error.message);
    }
};

exports.addModalidadeColumn = async (req, res) => {
    try {
        await db.sequelize.query('ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "modalidade" JSONB DEFAULT \'[]\';');
        res.send("Sucesso! Coluna 'modalidade' criada no banco de dados.");
    } catch (error) {
        res.status(500).send("Erro ao criar coluna: " + error.message);
    }
};

exports.extendPlan = async (req, res) => {
    try {
        const email = req.query.email;
        const dias = parseInt(req.query.dias) || 30;
        const subId = req.query.subId;
        const plano = req.query.plano || 'ESSENTIAL';

        if (!email) return res.status(400).send("Informe o email na URL: ?email=psicologa@email.com&dias=30");

        const psychologist = await db.Psychologist.findOne({ where: { email } });
        
        if (!psychologist) return res.status(404).send("Usuário não encontrado.");

        const novaData = new Date();
        novaData.setDate(novaData.getDate() + dias);

        const updateData = { planExpiresAt: novaData, status: 'active', plano };
        if (subId) updateData.stripeSubscriptionId = subId;

        await psychologist.update(updateData);
        
        res.send(`✅ Sucesso! Assinatura de ${psychologist.nome} estendida para ${novaData.toLocaleDateString('pt-BR')}.`);
    } catch (error) {
        res.status(500).send("Erro: " + error.message);
    }
};

exports.makeContentCreator = async (req, res) => {
    try {
        const email = req.query.email;
        if (!email) return res.status(400).send("Informe o email na URL: ?email=exemplo@yelopsi.com.br");

        const [updated] = await db.Psychologist.update({ status: 'creator' }, { where: { email } });
        
        if (updated) res.send(`Sucesso! O usuário ${email} agora é um Criador de Conteúdo (Invisível no match/perfil).`);
        else res.status(404).send("Usuário não encontrado.");
    } catch (error) {
        res.status(500).send("Erro: " + error.message);
    }
};

exports.createKpiTables = async (req, res) => {
    try {
        await db.sequelize.query(`
            CREATE TABLE IF NOT EXISTS "ProfileAppearanceLogs" (
                "id" SERIAL PRIMARY KEY,
                "psychologistId" INTEGER,
                "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await db.sequelize.query(`
            CREATE TABLE IF NOT EXISTS "MatchEvents" (
                "id" SERIAL PRIMARY KEY,
                "psychologistId" INTEGER,
                "matchTags" TEXT[], 
                "matchScore" INTEGER,
                "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        res.send("✅ Sucesso! Tabelas de KPI (Dashboard) criadas.");
    } catch (error) {
        res.status(500).send("Erro ao criar tabelas: " + error.message);
    }
};

exports.addIsExemptColumn = async (req, res) => {
    try {
        await db.sequelize.query('ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "is_exempt" BOOLEAN DEFAULT FALSE;');
        res.send("Sucesso! Coluna 'is_exempt' criada no banco de dados.");
    } catch (error) {
        res.status(500).send("Erro ao criar coluna: " + error.message);
    }
};

exports.addFotoUrl = async (req, res) => {
    try {
        await db.sequelize.query('ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "fotoUrl" VARCHAR(500);');
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "fotoUrl" VARCHAR(500);');
        res.send("✅ Sucesso! Coluna 'fotoUrl' criada no banco de dados para Psicólogos e Pacientes.");
    } catch (error) {
        res.status(500).send("❌ Erro ao criar coluna: " + error.message);
    }
};

exports.addConversationStatus = async (req, res) => {
    try {
        await db.sequelize.query(`ALTER TABLE "Conversations" ADD COLUMN IF NOT EXISTS "status" VARCHAR(255) DEFAULT 'active';`);
        res.send("Sucesso! Coluna 'status' criada em Conversations.");
    } catch (error) {
        res.status(500).send("Erro: " + error.message);
    }
};

exports.addMessageStatus = async (req, res) => {
    try {
        await db.sequelize.query(`ALTER TABLE "Messages" ADD COLUMN IF NOT EXISTS "status" VARCHAR(255) DEFAULT 'sent';`);
        res.send("Sucesso! Coluna 'status' criada em Messages.");
    } catch (error) {
        res.status(500).send("Erro: " + error.message);
    }
};

exports.fixStatusCompleted = async (req, res) => {
    try {
        await db.DemandSearch.update(
            { status: 'completed' },
            { where: { status: 'started' } }
        );
        res.send("Histórico corrigido! Atualize o dashboard.");
    } catch (error) {
        res.status(500).send("Erro: " + error.message);
    }
};

exports.addAnalyticsColumns = async (req, res) => {
    try {
        await db.sequelize.query('ALTER TABLE "SiteVisits" ADD COLUMN IF NOT EXISTS "url" VARCHAR(255);');
        await db.sequelize.query('ALTER TABLE "SiteVisits" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;');
        await db.sequelize.query('ALTER TABLE "SiteVisits" ADD COLUMN IF NOT EXISTS "referrer" TEXT;');
        res.send("Sucesso! Colunas de Analytics criadas.");
    } catch (error) {
        res.status(500).send("Erro ao criar colunas: " + error.message);
    }
};

exports.jsonToJsonb = async (req, res) => {
    try {
        await db.sequelize.query('ALTER TABLE "DemandSearches" ALTER COLUMN "searchParams" TYPE JSONB USING "searchParams"::text::jsonb;');
        res.send("Sucesso! A coluna 'searchParams' foi convertida para JSONB. Agora você pode criar o índice GIN.");
    } catch (error) {
        console.error("Erro ao converter JSON para JSONB:", error.message);
        res.status(500).send(`Erro ao converter JSON para JSONB: ${error.message}. Se a mensagem for "column is already of type jsonb", ignore e prossiga para a criação do índice.`);
    }
};

exports.addJsonbIndexes = async (req, res) => {
    try {
        await db.sequelize.query('CREATE INDEX IF NOT EXISTS idx_gin_demandsearches_searchparams ON "DemandSearches" USING GIN ("searchParams");');
        res.send("Sucesso! Índices GIN para colunas JSONB foram criados/verificados. A página de Analytics de Questionários ficará muito mais rápida.");
    } catch (error) {
        console.error("Erro detalhado ao criar índice GIN:", error);
        res.status(500).send(`Erro ao criar índices GIN: ${error.message}. Verifique se a coluna 'searchParams' é do tipo JSONB. Se não for, acesse a rota /api/fix-json-to-jsonb primeiro.`);
    }
};

exports.fixPatientAudit = async (req, res) => {
    try {
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "ip_registro" VARCHAR(45);');
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "termos_aceitos" BOOLEAN DEFAULT FALSE;');
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "marketing_aceito" BOOLEAN DEFAULT FALSE;');
        res.send("Sucesso! Colunas de auditoria (IP, Termos, Marketing) criadas em Patients.");
    } catch (error) {
        res.status(500).send("Erro ao criar colunas: " + error.message);
    }
};

exports.fixPasswordColumns = async (req, res) => {
    try {
        console.log("Executando correção manual de colunas de senha...");
        await db.sequelize.query('ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "resetPasswordToken" VARCHAR(255);');
        await db.sequelize.query('ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "resetPasswordExpires" BIGINT;');
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "resetPasswordToken" VARCHAR(255);');
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "resetPasswordExpires" BIGINT;');
        res.send("✅ Sucesso! Colunas de recuperação de senha criadas.");
    } catch (error) {
        console.error("Erro na correção manual:", error);
        res.status(500).send("Erro ao criar colunas: " + error.message);
    }
};

exports.fixAdminTable = async (req, res) => {
    try {
        await db.sequelize.query('ALTER TABLE "Admins" ADD COLUMN IF NOT EXISTS "telefone" VARCHAR(255);');
        await db.sequelize.query('ALTER TABLE "Admins" ADD COLUMN IF NOT EXISTS "fotoUrl" VARCHAR(255);');
        res.send("Sucesso! Colunas 'telefone' e 'fotoUrl' adicionadas à tabela Admins.");
    } catch (error) {
        res.status(500).send("Erro ao alterar tabela: " + error.message);
    }
};

exports.assignPioneerBadges = async (req, res) => {
    try {
        const gamificationService = require('../services/gamificationService');
        const PIONEER_BADGE_LIMIT = 100;

        const currentPioneerCount = await db.Psychologist.count({
            where: { 'badges.pioneiro': true }
        });

        const slotsAvailable = PIONEER_BADGE_LIMIT - currentPioneerCount;

        if (slotsAvailable <= 0) {
            return res.send('Todos os 100 badges de Pioneiro já foram distribuídos.');
        }

        const candidates = await db.Psychologist.findAll({
            where: {
                status: 'active',
                [Op.or]: [
                    { is_exempt: true },
                    { planExpiresAt: { [Op.gt]: new Date() } }
                ],
                [Op.or]: [
                    { badges: { [Op.is]: null } },
                    { 'badges.pioneiro': { [Op.not]: true } }
                ]
            },
            order: [['createdAt', 'ASC']],
            limit: slotsAvailable 
        });

        if (candidates.length === 0) {
            return res.send('Nenhum novo candidato elegível para a badge de Pioneiro encontrado.');
        }

        let assignedCount = 0;
        for (const candidate of candidates) {
            await gamificationService.assignPioneerBadge(candidate.id);
            assignedCount++;
        }

        res.send(`<h2>Atribuição de Badges Concluída!</h2>
                  <p><strong>${assignedCount}</strong> novos badges de "Pioneiro" foram atribuídos.</p>
                  <p>Total de pioneiros agora: ${currentPioneerCount + assignedCount}/${PIONEER_BADGE_LIMIT}.</p>`);

    } catch (error) {
        console.error("Erro ao atribuir badges de pioneiro:", error);
        res.status(500).send("Erro: " + error.message);
    }
};

exports.addLikesColumn = async (req, res) => {
    try {
        await db.sequelize.query('ALTER TABLE posts ADD COLUMN IF NOT EXISTS curtidas INTEGER DEFAULT 0;');
        res.send("Sucesso! Coluna 'curtidas' criada no banco de dados.");
    } catch (error) {
        res.status(500).send("Erro ao criar coluna: " + error.message);
    }
};

exports.debugCheckSchema = async (req, res) => {
    try {
        const [results] = await db.sequelize.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'Psychologists'
            ORDER BY column_name;
        `);
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.addNewsletterTable = async (req, res) => {
    try {
        await db.sequelize.query(`
            CREATE TABLE IF NOT EXISTS "NewsletterSubscriptions" (
                "id" SERIAL PRIMARY KEY,
                "email" VARCHAR(255) UNIQUE NOT NULL,
                "origin" VARCHAR(255),
                "ipAddress" VARCHAR(45),
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
            );`);
        res.send("Sucesso! Tabela 'NewsletterSubscriptions' criada/verificada.");
    } catch (error) {
        res.status(500).send("Erro ao criar tabela de newsletter: " + error.message);
    }
};

exports.createLeadsTable = async (req, res) => {
    try {
        await db.Lead.sync({ alter: true });
        res.send("✅ Sucesso! Tabela 'Leads' criada/atualizada no banco de produção.");
    } catch (error) {
        res.status(500).send("Erro ao criar tabela Leads: " + error.message);
    }
};

exports.addPostIndex = async (req, res) => {
    try {
        await db.sequelize.query('CREATE INDEX IF NOT EXISTS idx_posts_psychologist_id ON posts ("psychologist_id");');
        res.send("Sucesso! Índice criado na tabela de posts. A página 'Meus Artigos' ficará mais rápida.");
    } catch (error) {
        console.error("Erro ao criar índice em posts:", error.message);
        res.status(500).send(`Erro ao criar índice: ${error.message}.`);
    }
};

exports.clearContent = async (req, res) => {
    try {
        await db.Post.destroy({ where: {} });
        if (db.ForumVote) await db.ForumVote.destroy({ where: {} });
        if (db.ForumCommentVote) await db.ForumCommentVote.destroy({ where: {} });
        if (db.ForumComment) await db.ForumComment.destroy({ where: {} });
        if (db.ForumPost) await db.ForumPost.destroy({ where: {} });

        res.send("Limpeza concluída! Todos os posts do Blog e Fórum (e interações) foram removidos.");
    } catch (error) {
        console.error("Erro ao limpar conteúdo:", error);
        res.status(500).send("Erro ao limpar: " + error.message);
    }
};

exports.clearQna = async (req, res) => {
    try {
        if (db.Answer) await db.Answer.destroy({ where: {} });
        if (db.Question) await db.Question.destroy({ where: {} });
        if (db.QuestionIgnore) await db.QuestionIgnore.destroy({ where: {} });

        res.send("Limpeza concluída! Todas as perguntas e respostas da comunidade foram removidas.");
    } catch (error) {
        console.error("Erro ao limpar Q&A:", error);
        res.status(500).send("Erro ao limpar: " + error.message);
    }
};

exports.resetGamification = async (req, res) => {
    try {
        await db.sequelize.query('DELETE FROM "GamificationLogs"');
        await db.Psychologist.update({ xp: 0, authority_level: 'nivel_iniciante', badges: {} }, { where: {} });

        res.send("Sucesso! Progresso de gamificação de todos os usuários foi reiniciado.");
    } catch (error) {
        console.error("Erro ao resetar gamificação:", error);
        res.status(500).send("Erro ao resetar: " + error.message);
    }
};

exports.testEmail = async (req, res) => {
    try {
        const emailService = require('../services/emailService');
        const emailDestino = req.query.email || 'admin@yelopsi.com.br'; 
        const type = req.query.type; 
        
        if (type === 'payment') {
            await emailService.sendPaymentConfirmationEmail(
                { email: emailDestino, nome: 'Usuário Teste' }, 'CLINICAL', 159.90
            );
            res.send(`✅ E-mail de PAGAMENTO enviado para: ${emailDestino}. Verifique a caixa de entrada.`);
        } else if (type === 'cancel') {
             await emailService.sendSubscriptionCancelledEmail({ email: emailDestino, nome: 'Usuário Teste' });
            res.send(`✅ E-mail de CANCELAMENTO enviado para: ${emailDestino}.`);
        } else if (type === 'failed') {
             await emailService.sendPaymentFailedEmail({ email: emailDestino, nome: 'Usuário Teste' }, 'https://www.yelopsi.com.br/login');
            res.send(`✅ E-mail de FALHA enviado para: ${emailDestino}.`);
        } else if (type === 'welcome') {
             await emailService.sendWelcomeEmail({ email: emailDestino, nome: 'Usuário Teste' }, 'psychologist');
            res.send(`✅ E-mail de BOAS-VINDAS enviado para: ${emailDestino}.`);
        } else if (type === 'bill_created') {
            await emailService.sendBillCreatedEmail(
                { email: emailDestino, nome: 'Usuário Teste' },
                { value: 159.90, dueDate: '2026-02-10', invoiceUrl: 'https://sandbox.asaas.com/i/teste', bankSlipUrl: null }
            );
            res.send(`✅ E-mail de COBRANÇA CRIADA enviado para: ${emailDestino}.`);
        } else if (type === 'due_date') {
            await emailService.sendDueDateWarningEmail(
                { email: emailDestino, nome: 'Usuário Teste' },
                { value: 159.90, dueDate: '2026-02-10', invoiceUrl: 'https://sandbox.asaas.com/i/teste' }
            );
            res.send(`✅ E-mail de AVISO DE VENCIMENTO enviado para: ${emailDestino}.`);
        } else if (type === 'overdue') {
            await emailService.sendOverdueEmail(
                { email: emailDestino, nome: 'Usuário Teste' },
                { value: 159.90, dueDate: '2026-02-01', invoiceUrl: 'https://sandbox.asaas.com/i/teste' }
            );
            res.send(`✅ E-mail de COBRANÇA VENCIDA enviado para: ${emailDestino}.`);
        } else if (type === 'updated') {
            await emailService.sendBillUpdatedEmail(
                { email: emailDestino, nome: 'Usuário Teste' },
                { value: 159.90, dueDate: '2026-02-15', invoiceUrl: 'https://sandbox.asaas.com/i/teste' }
            );
            res.send(`✅ E-mail de COBRANÇA ATUALIZADA enviado para: ${emailDestino}.`);
        } else if (type === 'digitable') {
            await emailService.sendDigitableLineEmail(
                { email: emailDestino, nome: 'Usuário Teste' },
                { value: 159.90, dueDate: '2026-02-10', invoiceUrl: 'https://sandbox.asaas.com/i/teste', nossoNumero: '34191.79001 01043.51004 7 9102012000' }
            );
            res.send(`✅ E-mail de LINHA DIGITÁVEL enviado para: ${emailDestino}.`);
        } else if (type === 'remarketing') {
            const step = parseInt(req.query.step) || 1;
            await emailService.sendRemarketingEmail({ email: emailDestino, nome: 'Usuário Teste', whatsapp_clicks: 2 }, step);
            res.send(`✅ E-mail de REMARKETING (Passo ${step}) enviado para: ${emailDestino}.`);
        } else if (type === 'first_lead') {
            await emailService.sendFirstLeadEmail({ email: emailDestino, nome: 'Usuário Teste' });
            res.send(`✅ E-mail de PRIMEIRO LEAD enviado para: ${emailDestino}.`);
        } else if (type === 'limit_reached') {
            await emailService.sendLimitReachedEmail({ email: emailDestino, nome: 'Usuário Teste' }, 3);
            res.send(`✅ E-mail de LIMITE ATINGIDO enviado para: ${emailDestino}.`);
        } else {
            await emailService.sendPasswordResetEmail({ email: emailDestino, nome: 'Teste Admin' }, 'https://www.yelopsi.com.br/teste-link');
            res.send(`✅ E-mail de RECUPERAÇÃO enviado para: ${emailDestino}. <br>Dica: Adicione <code>&type=payment</code> na URL para testar o de pagamento.`);
        }
    } catch (error) {
        console.error(error);
        res.status(500).send("❌ Erro ao enviar e-mail: " + error.message);
    }
};

exports.fixPatientsSchemaManual = async (req, res) => {
    try {
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "sessionValue" FLOAT DEFAULT 0;');
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "status" VARCHAR(255) DEFAULT \'active\';');
        res.send("✅ Colunas sessionValue e status criadas com sucesso na tabela Patients.");
    } catch (error) {
        res.status(500).send("Erro ao criar colunas: " + error.message);
    }
};

exports.fixEmailNull = async (req, res) => {
    try {
        await db.sequelize.query('ALTER TABLE "Patients" ALTER COLUMN "email" DROP NOT NULL;');
        res.send("✅ Sucesso! Coluna 'email' da tabela Patients agora aceita valores nulos (vazio). Tente cadastrar o paciente novamente.");
    } catch (error) {
        res.status(500).send("Erro ao alterar coluna: " + error.message);
    }
};

exports.fixFinancialTables = async (req, res) => {
    try {
        await db.sequelize.query(`CREATE TABLE IF NOT EXISTS "Expenses" ( "id" SERIAL PRIMARY KEY, "description" VARCHAR(255), "value" FLOAT, "date" DATE, "psychologistId" INTEGER, "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP );`);
        await db.sequelize.query(`CREATE TABLE IF NOT EXISTS "Appointments" ( "id" SERIAL PRIMARY KEY, "title" VARCHAR(255), "start" TIMESTAMP WITH TIME ZONE, "end" TIMESTAMP WITH TIME ZONE, "status" VARCHAR(255) DEFAULT 'scheduled', "value" FLOAT DEFAULT 0, "psychologistId" INTEGER, "patientId" INTEGER, "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP );`);
        try { await db.sequelize.query('ALTER TABLE "Appointments" ADD COLUMN IF NOT EXISTS "patientId" INTEGER;'); } catch (e) {}
        await db.sequelize.query('ALTER TABLE "Expenses" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;');
        await db.sequelize.query('ALTER TABLE "Expenses" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;');
        res.send("✅ Tabelas Financeiras verificadas e corrigidas.");
    } catch (error) { res.status(500).send("Erro ao criar tabelas: " + error.message); }
};

exports.fixPatientTable = async (req, res) => {
    try {
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "status" VARCHAR(255) DEFAULT \'active\';');
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "sessionValue" FLOAT DEFAULT 0;');
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "resetPasswordToken" VARCHAR(255);');
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "resetPasswordExpires" BIGINT;');
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "ip_registro" VARCHAR(45);');
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "termos_aceitos" BOOLEAN DEFAULT FALSE;');
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "marketing_aceito" BOOLEAN DEFAULT FALSE;');
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "valor_sessao_faixa" VARCHAR(255);');
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "temas_buscados" JSONB DEFAULT \'[]\';');
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "identidade_genero" VARCHAR(255);');
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "recebe_mensagens" BOOLEAN DEFAULT TRUE;');
        res.send("✅ Tabela de Pacientes verificada e corrigida.");
    } catch (error) { res.status(500).send("Erro: " + error.message); }
};

exports.addDisqualificationColumns = async (req, res) => {
    try {
        await db.sequelize.query('ALTER TABLE "DemandSearches" ADD COLUMN IF NOT EXISTS "is_disqualified" BOOLEAN DEFAULT FALSE;');
        await db.sequelize.query('ALTER TABLE "DemandSearches" ADD COLUMN IF NOT EXISTS "disqualification_reason" VARCHAR(255);');
        res.send("✅ Sucesso! Colunas 'is_disqualified' e 'disqualification_reason' criadas na tabela DemandSearches.");
    } catch (error) {
        res.status(500).send("Erro ao criar colunas: " + error.message);
    }
};

exports.addSeoColumns = async (req, res) => {
    try {
        // Tenta adicionar na tabela (com fallback de case sensitivity para Postgres)
        await db.sequelize.query('ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "meta_description" TEXT;').catch(() => db.sequelize.query('ALTER TABLE "Posts" ADD COLUMN IF NOT EXISTS "meta_description" TEXT;'));
        await db.sequelize.query('ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "tags" JSONB DEFAULT \'[]\';').catch(() => db.sequelize.query('ALTER TABLE "Posts" ADD COLUMN IF NOT EXISTS "tags" JSONB DEFAULT \'[]\';'));
        
        // NOVO: Coluna para otimizar os Perfis Públicos
        await db.sequelize.query('ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "meta_description" TEXT;');
        
        res.send("✅ Sucesso! Colunas de SEO criadas na tabela de posts e Psicólogos.");
    } catch (error) {
        res.status(500).send("Erro ao criar colunas de SEO: " + error.message);
    }
};

exports.addGoogleIdColumn = async (req, res) => {
    try {
        await db.sequelize.query('ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "googleId" VARCHAR(255);');
        await db.sequelize.query('ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "googleId" VARCHAR(255);');
        res.send("✅ Sucesso! Coluna 'googleId' criada com sucesso na tabela Psychologists.");
    } catch (error) {
        res.status(500).send("Erro ao criar coluna googleId: " + error.message);
    }
};
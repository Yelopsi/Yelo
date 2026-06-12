const db = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs').promises;
const gamificationService = require('../services/gamificationService'); // Importa o serviço
const subscriptionController = require('./subscriptionController');

// --- CONFIGURAÇÃO DO CLOUDINARY ---
const cloudinary = require('cloudinary').v2;
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// ----------------------------------------------------------------------
// Rota: GET /api/psychologists/me (Rota Protegida)
// ----------------------------------------------------------------------
exports.getAuthenticatedPsychologistProfile = async (req, res) => {
    try {
        // 'req.psychologist' é anexado pelo seu middleware 'protect'
        if (!req.psychologist || !req.psychologist.id) {
            return res.status(401).json({ error: 'Psicólogo não autenticado.' });
        }

        const psychologistId = req.psychologist.id;

        const psychologist = await db.Psychologist.findByPk(psychologistId, {
            // Agora permitimos o CPF, pois é o próprio usuário vendo seus dados
            attributes: { 
                    exclude: ['senha', 'resetPasswordToken', 'resetPasswordExpires']
            }
        });

        if (!psychologist) {
            return res.status(404).json({ error: 'Perfil do psicólogo não encontrado.' });
        }

        // --- CORREÇÃO V2: Busca contagens com Fallback Duplo do ORM ---
        let blogPostCount = 0, forumPostCount = 0, forumCommentCount = 0, answerCount = 0;
        
        if (db.Post) blogPostCount = await db.Post.count({ where: { psychologistId } }).catch(async () => await db.Post.count({ where: { psychologist_id: psychologistId } }).catch(() => 0));
        
        if (db.ForumPost) forumPostCount = await db.ForumPost.count({ where: { PsychologistId: psychologistId } }).catch(async () => await db.ForumPost.count({ where: { psychologistId } }).catch(() => 0));
        
        if (db.ForumComment) forumCommentCount = await db.ForumComment.count({ where: { PsychologistId: psychologistId } }).catch(async () => await db.ForumComment.count({ where: { psychologistId } }).catch(() => 0));
        
        if (db.Answer) answerCount = await db.Answer.count({ where: { psychologistId } }).catch(() => 0);

        // --- NOVO: VERIFICA AVALIAÇÃO DA PLATAFORMA ---
        const platformReviewCountResult = await db.sequelize.query(
            `SELECT COUNT(*) as count FROM "PlatformReviews" WHERE "psychologistId" = :id`,
            { replacements: { id: psychologistId }, type: db.sequelize.QueryTypes.SELECT }
        ).catch(() => [{ count: 0 }]);
        const hasPlatformReview = parseInt(platformReviewCountResult[0]?.count || 0, 10) > 0;

        // --- NOVO: DADOS REAIS DE OPORTUNIDADE (MATCHES E CLIQUES GLOBAIS) ---
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const globalMatchesResult = await db.sequelize.query(
            `SELECT COUNT(*) as count FROM "DemandSearches" WHERE "createdAt" >= :thirtyDaysAgo`,
            { replacements: { thirtyDaysAgo }, type: db.sequelize.QueryTypes.SELECT }
        ).catch(() => [{ count: 0 }]);
        
        const globalClicksResult = await db.sequelize.query(
            `SELECT COUNT(*) as count FROM "WhatsappClickLogs" WHERE "createdAt" >= :thirtyDaysAgo`,
            { replacements: { thirtyDaysAgo }, type: db.sequelize.QueryTypes.SELECT }
        ).catch(() => [{ count: 0 }]);

        // Monta o objeto de resposta
        const responseData = psychologist.toJSON();
        responseData.hasPlatformReview = hasPlatformReview;

        // --- AVISO DE QUALIDADE (PERFIL EM BRANCO) ---
        const hasPhoto = !!psychologist.fotoUrl;
        const hasBio = !!(psychologist.bio && psychologist.bio.trim().length >= 10);
        responseData.isProfileComplete = hasPhoto && hasBio;
        responseData.profileWarning = responseData.isProfileComplete 
            ? null 
            : "⚠️ Atenção: Seu perfil não aparecerá nos Matches para os pacientes enquanto não tiver uma Foto de Perfil e uma Biografia. Complete seus dados para receber contatos.";

        // --- NOVO: LÓGICA PARA O BANNER DE TRIAL PREMIUM (CPF) ---
        const hasValidCpf = !!(psychologist.cpf && psychologist.cpf.replace(/\D/g, '').length >= 11);
        responseData.showTrialBanner = (psychologist.status === 'pending' && !hasValidCpf);
        responseData.trialBannerMessage = responseData.showTrialBanner
            ? "Complete seu CPF no perfil para liberar seus 14 dias Premium grátis."
            : null;

        responseData.globalStats = {
            matches30d: parseInt(globalMatchesResult[0]?.count || 0, 10),
            clicks30d: parseInt(globalClicksResult[0]?.count || 0, 10)
        };

        responseData.gamificationProgress = {
            blogPostCount, // Para Semeador
            forumActivityCount: forumPostCount + forumCommentCount, // Para Voz Ativa
            answerCount, // Para Conselheiro
            // Fallbacks de segurança para garantir que o front leia a chave certa
            semeador: blogPostCount,
            vozAtiva: forumPostCount + forumCommentCount,
            conselheiro: answerCount
        };
        
        // Fallback direto na raiz (se o frontend ler solto)
        responseData.blogPostCount = blogPostCount;
        responseData.forumActivityCount = forumPostCount + forumCommentCount;
        responseData.answerCount = answerCount;
        
        res.status(200).json(responseData);

    } catch (error) {
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
};

// ==============================================================================
// 2. ATUALIZAÇÃO (Permite personalizar o Link e corrige dados faltantes)
// ==============================================================================
exports.updatePsychologistProfile = async (req, res) => {
    try {
        if (!req.psychologist || !req.psychologist.id) {
            return res.status(401).json({ error: 'Não autorizado.' });
        }

        const psychologist = await db.Psychologist.findByPk(req.psychologist.id);
        if (!psychologist) {
            return res.status(404).json({ error: 'Psicólogo não encontrado' });
        }

        // Extrai os dados enviados pelo Dashboard
        let {
            nome, telefone, bio, crp, cep, cidade, estado,
            temas_atuacao, abordagens_tecnicas, modalidade,
            publico_alvo, estilo_terapia, praticas_inclusivas, // NOVOS CAMPOS
            valor_sessao_numero, disponibilidade_periodo, genero_identidade, // CORRIGIDO
            dailySummaryTime, reminderHoursBefore, // NOVOS CAMPOS DE NOTIFICAÇÃO
            linkedin_url, instagram_url, facebook_url, tiktok_url, x_url,
            slug, // <--- AGORA ESTAMOS LENDO O CAMPO SLUG QUE VEM DO FORMULÁRIO
            cpf, // <--- ADICIONADO: Extraindo o CPF enviado pelo frontend
            formacao_nivel, formacao_desc,
            tipo_cobranca, valor_mensal_numero,
            ano_inicio_experiencia,
            razao_social,
            data_nascimento
        } = req.body;

        // --- FALLBACK PARA CAMPOS LEGADOS (Especialidades/Temas) ---
        if (!temas_atuacao) {
            if (req.body.temas) temas_atuacao = req.body.temas;
            else if (req.body.especialidades) temas_atuacao = req.body.especialidades;
        }

        // --- CORREÇÃO ROBUSTA DE ARRAYS ---
        // Garante que qualquer campo que deva ser array, SEJA array, mesmo se vier como string JSON.
        const parseArrayField = (fieldValue) => {
            if (fieldValue === undefined) return undefined; // IGNORA se não foi enviado (não apaga o banco)
            if (!fieldValue) return [];
            
            // Se já for array, verifica se os itens dentro não são strings JSON (ex: ['["Online"]'])
            if (Array.isArray(fieldValue)) {
                return fieldValue.map(item => {
                    if (typeof item === 'string' && item.trim().startsWith('[')) {
                        try { 
                            const parsed = JSON.parse(item);
                            return Array.isArray(parsed) ? parsed[0] : parsed; 
                        } catch(e) { return item; }
                    }
                    return item;
                });
            }

            // Se for string, tenta parsear
            if (typeof fieldValue === 'string') {
                try {
                    if (fieldValue.trim().startsWith('[')) return JSON.parse(fieldValue);
                    return [fieldValue]; // Se for string solta, encapsula
                } catch (e) { return []; }
            }
            return [fieldValue];
        };

        // Aplica a correção em TODOS os campos de lista
        modalidade = parseArrayField(modalidade);
        temas_atuacao = parseArrayField(temas_atuacao);
        abordagens_tecnicas = parseArrayField(abordagens_tecnicas);
        publico_alvo = parseArrayField(publico_alvo);
        estilo_terapia = parseArrayField(estilo_terapia);
        praticas_inclusivas = parseArrayField(praticas_inclusivas);
        disponibilidade_periodo = parseArrayField(disponibilidade_periodo);
        

        // --- LÓGICA DE PERSONALIZAÇÃO DO LINK (SLUG) ---
        let finalSlug = psychologist.slug; // Padrão: Mantém o atual

        // Cenário A: Usuário quer mudar o link (digitou algo novo no input 'slug')
        if (slug && slug.trim() !== '' && slug !== psychologist.slug) {
            // Sanitiza o que o usuário digitou (para não quebrar a URL)
            finalSlug = slug
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '') // Remove tudo que não for letra, número ou traço
                .replace(/\s+/g, '-');
            
            // Verifica se esse link já existe (para evitar duplicidade)
            const slugExiste = await db.Psychologist.findOne({ 
                where: { 
                    slug: finalSlug, 
                    id: { [Op.ne]: psychologist.id } // Ignora o próprio usuário
                } 
            });

            if (slugExiste) {
                return res.status(400).json({ error: 'Este link personalizado já está em uso. Escolha outro.' });
            }
        }
        
        // Cenário B: Usuário não tem link (Correção de legado) e não enviou um novo
        else if (!finalSlug && nome) {
            finalSlug = nome.toLowerCase().replace(/\s+/g, '-') + `-${Math.floor(Math.random()*1000)}`;
        }

        // --- ATUALIZAÇÃO VIA ORM (MODERNA E DEFINITIVA) ---
        // Graças ao patch no server.js, o Sequelize agora trata esses campos como JSONB nativo.
        const updatePayload = {};
        if (finalSlug !== undefined) updatePayload.slug = finalSlug;
        if (nome !== undefined) updatePayload.nome = nome;
        if (telefone !== undefined) updatePayload.telefone = telefone;
        if (bio !== undefined) updatePayload.bio = bio;
        if (crp !== undefined) updatePayload.crp = crp;
        if (cep !== undefined) updatePayload.cep = cep;
        if (cidade !== undefined) updatePayload.cidade = cidade;
        if (estado !== undefined) updatePayload.estado = estado;
        if (formacao_nivel !== undefined) updatePayload.formacao_nivel = formacao_nivel;
        if (formacao_desc !== undefined) updatePayload.formacao_desc = formacao_desc;
        if (tipo_cobranca !== undefined) updatePayload.tipo_cobranca = tipo_cobranca;
        if (valor_mensal_numero !== undefined) updatePayload.valor_mensal_numero = valor_mensal_numero ? parseFloat(valor_mensal_numero) : null;
        if (valor_sessao_numero !== undefined) updatePayload.valor_sessao_numero = valor_sessao_numero ? parseFloat(valor_sessao_numero) : null;
        if (genero_identidade !== undefined) updatePayload.genero_identidade = genero_identidade;
        if (cpf !== undefined) updatePayload.cpf = cpf;
        if (razao_social !== undefined) updatePayload.razao_social = razao_social;
        if (ano_inicio_experiencia !== undefined) updatePayload.ano_inicio_experiencia = ano_inicio_experiencia ? parseInt(ano_inicio_experiencia, 10) : null;
        if (data_nascimento !== undefined) updatePayload.data_nascimento = data_nascimento || null;
        if (dailySummaryTime !== undefined) updatePayload.dailySummaryTime = dailySummaryTime || '08:00';
        if (reminderHoursBefore !== undefined) updatePayload.reminderHoursBefore = reminderHoursBefore ? parseInt(reminderHoursBefore) : 24;
        if (linkedin_url !== undefined) updatePayload.linkedin_url = linkedin_url;
        if (instagram_url !== undefined) updatePayload.instagram_url = instagram_url;
        if (facebook_url !== undefined) updatePayload.facebook_url = facebook_url;
        if (tiktok_url !== undefined) updatePayload.tiktok_url = tiktok_url;
        if (x_url !== undefined) updatePayload.x_url = x_url;

        // Passamos os Arrays JS diretamente. O Sequelize fará a serialização correta para JSONB.
        if (temas_atuacao !== undefined) updatePayload.temas_atuacao = temas_atuacao;
        if (abordagens_tecnicas !== undefined) updatePayload.abordagens_tecnicas = abordagens_tecnicas;
        if (modalidade !== undefined) updatePayload.modalidade = modalidade;
        if (publico_alvo !== undefined) updatePayload.publico_alvo = publico_alvo;
        if (estilo_terapia !== undefined) updatePayload.estilo_terapia = estilo_terapia;
        if (praticas_inclusivas !== undefined) {
            updatePayload.praticas_inclusivas = praticas_inclusivas;
            updatePayload.praticas_vivencias = praticas_inclusivas; // Fallback que sobrescreve rastros legados
        }
        if (disponibilidade_periodo !== undefined) updatePayload.disponibilidade_periodo = disponibilidade_periodo;

        await psychologist.update(updatePayload);

        // --- ATIVAÇÃO DO TRIAL PÓS-CADASTRO (ANTI-ABUSO) ---
        // Se o perfil estava pendente e o profissional preencheu um CPF válido agora, ativa os 14 dias
        if (psychologist.status === 'pending' && cpf && cpf.replace(/\D/g, '').length >= 11) {
            const trialEndDate = new Date();
            trialEndDate.setDate(trialEndDate.getDate() + 14);
            await psychologist.update({
                status: 'active',
                plano: 'Essencial',
                planExpiresAt: trialEndDate
            });
        }

        // --- GAMIFICATION HOOK (BADGE AUTÊNTICO) ---
        await gamificationService.checkProfileCompletion(psychologist.id);

        res.json({
            id: psychologist.id,
            slug: finalSlug, // Retorna o novo slug para atualizar a tela
            nome: psychologist.nome,
            email: psychologist.email,
            status: psychologist.status, // Adicionado
            modalidade: psychologist.modalidade,
            plano: psychologist.plano, // Adicionado
            fotoUrl: psychologist.fotoUrl
        });

    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            // Mapeia o campo técnico para uma mensagem amigável
            const field = error.fields ? Object.keys(error.fields)[0] : 'desconhecido';
            let userMessage = 'Este dado já está em uso por outra conta.';
            if (field === 'slug') {
                userMessage = 'Este link personalizado já está em uso. Por favor, escolha outro.';
            } else if (field === 'crp') {
                userMessage = 'Este CRP já está cadastrado em outra conta.';
            } else if (field === 'cpf') {
                userMessage = 'Este CPF já está cadastrado em outra conta.';
            } else if (field === 'email') {
                userMessage = 'Este e-mail já está em uso por outra conta.';
            }
            return res.status(400).json({ error: userMessage });
        }
        res.status(500).json({ error: 'Erro ao atualizar perfil' });
    }
};

// ----------------------------------------------------------------------
// Rota: PUT /api/psychologists/me/password
// ----------------------------------------------------------------------
exports.updatePsychologistPassword = async (req, res) => {
    try {
        const { senha_atual, nova_senha } = req.body;

        if (!senha_atual || !nova_senha) {
            return res.status(400).json({ error: 'Todos os campos de senha são obrigatórios.' });
        }

        const psychologistWithPassword = await db.Psychologist.findByPk(req.psychologist.id);

        const isMatch = await bcrypt.compare(senha_atual, psychologistWithPassword.senha);
        if (!isMatch) {
            return res.status(401).json({ error: 'A senha atual está incorreta.' });
        }

        psychologistWithPassword.senha = await bcrypt.hash(nova_senha, 10);
        await psychologistWithPassword.save();

        res.status(200).json({ message: 'Senha alterada com sucesso!' });
    } catch (error) {
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

// ----------------------------------------------------------------------
// Rota: PUT /api/psychologists/me/complete-profile
// ----------------------------------------------------------------------
exports.completeSocialProfile = async (req, res) => {
    try {
        const psychologist = req.psychologist;

        if (!psychologist) {
            return res.status(404).json({ error: 'Psicólogo não encontrado ou não autenticado.' });
        }

        if (psychologist.crp) {
            return res.status(400).json({ error: 'Este perfil já está completo.' });
        }

        const { crp, telefone } = req.body;

        if (!crp) {
            return res.status(400).json({ error: 'O número do CRP é obrigatório.' });
        }

        await psychologist.update({
            crp,
            telefone,
            status: 'active' 
        });

        res.status(200).json({ message: 'Perfil completado com sucesso!' });
    } catch (error) {
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

// ----------------------------------------------------------------------
// Rota: GET /api/psychologists/me/unread-count
// ----------------------------------------------------------------------
exports.getUnreadMessageCount = async (req, res) => {
    try {
        const psychologistId = req.psychologist.id;

        const count = await db.Message.count({
            where: { 
                recipientId: psychologistId, 
                recipientType: 'psychologist',
                isRead: false 
            }
        });
        res.status(200).json({ count });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar contagem de mensagens.' });
    }
};

exports.updateProfilePhoto = async (req, res) => {
    try {
        // 1. Validação
        if (!req.psychologist || !req.psychologist.id) {
            return res.status(401).json({ error: 'Não autorizado, psicólogo não identificado.' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhum arquivo de imagem foi enviado.' });
        }

        const psychologistToUpdate = await db.Psychologist.findByPk(req.psychologist.id);
        if (!psychologistToUpdate) {
            return res.status(404).json({ error: 'Psicólogo não encontrado no banco de dados.' });
        }

        // 2. Upload para o Cloudinary
        // O arquivo está em req.file.path (salvo temporariamente pelo multer)
        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'yelo/profiles', // Pasta no Cloudinary
            public_id: `profile-${psychologistToUpdate.id}`, // ID fixo para substituir a foto antiga automaticamente
            overwrite: true,
            transformation: [
                { width: 500, height: 500, crop: 'fill', gravity: 'face' }, // Foca no rosto e corta quadrado
                { quality: 'auto' }, // Otimização automática de qualidade
                { fetch_format: 'auto' } // Converte para WebP/AVIF se o navegador suportar
            ]
        });

        // 3. Atualiza o banco com a URL segura do Cloudinary
        await psychologistToUpdate.update({ fotoUrl: result.secure_url });

        // --- GAMIFICATION HOOK (BADGE AUTÊNTICO) ---
        await gamificationService.checkProfileCompletion(psychologistToUpdate.id);

        // 4. Limpeza: Remove o arquivo local temporário
        try {
            await fs.unlink(req.file.path);
        } catch (e) { }

        // 5. Resposta
        res.status(200).json({
            message: 'Foto atualizada com sucesso!',
            fotoUrl: result.secure_url
        });

    } catch (error) {
        res.status(500).json({ error: 'Erro interno no servidor ao fazer upload da foto.' });
    }
};


// ----------------------------------------------------------------------
// Rota: DELETE /api/psychologists/me (BLINDADA CONTRA COBRANÇA INDEVIDA)
// ----------------------------------------------------------------------
exports.deletePsychologistAccount = subscriptionController.deletePsychologistAccount;

// ----------------------------------------------------------------------
// Rota: GET /api/psychologists/me/qna-unanswered-count (NOVA ROTA)
// Descrição: Busca a contagem de perguntas da comunidade que o psicólogo logado ainda não respondeu.
// ----------------------------------------------------------------------
exports.getUnansweredQuestionsCount = async (req, res) => {
    try {
        if (!req.psychologist || !req.psychologist.id) return res.status(200).json({ count: 0 });
        
        const psychologistId = req.psychologist.id;

        // Prevenção: Garante que as tabelas existem antes de buscar
        if (!db.Question || !db.Answer || !db.Answer.findAll || !db.Question.count) {
            return res.status(200).json({ count: 0 });
        }

        // 1. Pega os IDs de todas as perguntas que este psicólogo JÁ respondeu
        const answeredQuestionIds = await db.Answer.findAll({
            where: { psychologistId: psychologistId },
            attributes: ['questionId'],
            raw: true
        }).catch(() => []);
        
        const answeredIds = answeredQuestionIds.map(a => a.questionId);

        // 2. Conta todas as perguntas que estão 'approved' ou 'answered'
        //    E que NÃO ESTÃO na lista de perguntas já respondidas por este psicólogo
        const whereClause = {
            status: { [Op.in]: ['approved', 'answered'] }
        };

        if (answeredIds.length > 0) {
            whereClause.id = { [Op.notIn]: answeredIds };
        }

        const count = await db.Question.count({
            where: whereClause
        }).catch(() => 0);

        res.status(200).json({ count });

    } catch (error) {
        // Em vez de retornar 500 e poluir o console, retorna 0 silenciosamente
        res.status(200).json({ count: 0 });
    }
};

// ----------------------------------------------------------------------
// Rota: GET /api/my-patients (Para evitar erro 500 no dashboard)
// ----------------------------------------------------------------------
exports.getMyPatients = async (req, res) => {
    try {
        if (!req.psychologist || !req.psychologist.id) {
            return res.status(200).json([]);
        }
        // Como os modelos variam, garantimos um retorno vazio e seguro
        // se a lógica de consultas do psicólogo não estiver finalizada.
        if (!db.Appointment) {
            return res.status(200).json([]);
        }
        // Pode implementar a busca real de pacientes aqui no futuro.
        res.status(200).json([]);
    } catch (error) {
        res.status(200).json([]);
    }
};
// ... (código existente) ...

/**
 * Salva a pesquisa de saída do Psicólogo
 */
exports.saveExitSurvey = async (req, res) => {
    try {
        const { motivo, avaliacao, sugestao } = req.body;
        // Tenta pegar o ID do psi logado (se o middleware de auth estiver ativo)
        const psychologistId = req.user ? req.user.id : null; 

        await db.sequelize.query(`
            INSERT INTO "ExitSurveys" ("psychologistId", "motivo", "avaliacao", "sugestao", "createdAt", "updatedAt")
            VALUES (:uid, :mot, :aval, :sug, NOW(), NOW())
        `, {
            replacements: { 
                uid: psychologistId, 
                mot: motivo, 
                aval: avaliacao ? parseInt(avaliacao) : null, 
                sug: sugestao 
            },
            type: db.sequelize.QueryTypes.INSERT
        });

        res.json({ message: "Feedback salvo." });
    } catch (error) {
        // Não retorna erro 500 para não travar a exclusão da conta
        res.json({ message: "Seguindo..." }); 
    }
};

// ----------------------------------------------------------------------
// Rota: POST /api/psychologists/me/cancel-subscription (CORRIGIDO V2)
// ----------------------------------------------------------------------
exports.cancelSubscription = subscriptionController.cancelSubscription;

// ----------------------------------------------------------------------
// Rota: POST /api/psychologists/me/reactivate-subscription
// Descrição: Remove o agendamento de cancelamento no Stripe e mantém o plano ativo.
// ----------------------------------------------------------------------
exports.reactivateSubscription = subscriptionController.reactivateSubscription;
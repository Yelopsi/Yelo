const db = require('../models');
const { Op } = require('sequelize');
const seoService = require('../services/seoService'); // Importa a Inteligência Artificial

// --- ÁREA PÚBLICA (PACIENTE) ---

// 1. Paciente envia pergunta
exports.createQuestion = async (req, res) => {
    try {
        const { conteudo } = req.body;
        
        if (!conteudo || conteudo.length < 10) {
            return res.status(400).json({ error: "Conteúdo muito curto." });
        }
        
        // 1. Tenta gerar um Título Inteligente e Otimizado para SEO com a IA
        let title = conteudo.substring(0, 60).trim();
        if (conteudo.length > 60) title += '...';
        let metaDescription = null;

        const seoData = await seoService.generatePatientQuestionSEO(conteudo);
        if (seoData && seoData.title) {
            title = seoData.title;
            metaDescription = seoData.meta_description || null;
        }

        // 2. Gera o Slug Base
        let baseSlug = title
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // Remove acentuações (é -> e)
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '') // Remove interrogações, exclamações, etc.
            .trim()
            .replace(/\s+/g, '-'); // Troca espaços por hifens

        // 3. Adiciona um hash aleatório para unicidade no banco
        const crypto = require('crypto');
        const hashUnico = crypto.randomBytes(2).toString('hex');
        const slugFinal = `${baseSlug}-${hashUnico}`;

        // FIX: Busca inclusive o paciente anônimo se ele estiver deletado (paranoid: false)
        // Isso evita o erro de "Unique Constraint" ao tentar recriar o e-mail
        let patient = await db.Patient.findOne({ 
            where: { email: 'anonimo@yelopsi.com.br' },
            paranoid: false 
        });

        if (patient && patient.deletedAt) {
            await patient.restore();
        }

        if (!patient) {
            patient = await db.Patient.create({
                nome: "Anônimo",
                email: "anonimo@yelopsi.com.br",
                senha: "123",
                telefone: "00000000000"
            });
        }

        // AUTO-FIX: Garante colunas no banco antes de gravar
        const qTable = db.Question.tableName;
        try {
            await db.sequelize.query(`ALTER TABLE "${qTable}" ADD COLUMN IF NOT EXISTS "title" VARCHAR(255);`);
            await db.sequelize.query(`ALTER TABLE "${qTable}" ADD COLUMN IF NOT EXISTS "slug" VARCHAR(255);`);
            await db.sequelize.query(`ALTER TABLE "${qTable}" ADD COLUMN IF NOT EXISTS "meta_description" TEXT;`);
        } catch(e) {}

        const newQ = await db.Question.create({
            title: title,
            slug: slugFinal,
            content: conteudo,
            status: "approved",
            PatientId: patient.id,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        // FORÇA A GRAVAÇÃO POR FORA DO SEQUELIZE (Bypass de Modelo)
        await db.sequelize.query(
            `UPDATE "${qTable}" SET "title" = :title, "slug" = :slug, "meta_description" = :meta WHERE id = :id`,
            { replacements: { title, slug: slugFinal, meta: metaDescription, id: newQ.id } }
        );

        // FIX: Garante que o slug seja retornado na resposta da API, mesmo que o modelo não esteja 100% sincronizado
        const responseData = newQ.toJSON();
        if (!responseData.slug) responseData.slug = slugFinal;

        res.json({ success: true, message: "Pergunta enviada com sucesso!", data: responseData });

    } catch (error) {
        console.error("Erro ao criar pergunta:", error);
        const errorMessage = process.env.NODE_ENV === 'production' 
            ? "Ocorreu um erro interno ao processar sua pergunta. Tente novamente mais tarde." 
            : "Erro interno ao salvar: " + (error.original ? error.original.message : error.message);
        res.status(500).json({ error: errorMessage });
    }
};

// 2. Listar perguntas para o público
exports.getPublicQuestions = async (req, res) => {
    try {
        const questions = await db.Question.findAll({
            include: [
                {
                    model: db.Answer,
                    as: 'answers',
                    required: false,
                    include: [
                        { 
                            model: db.Psychologist, 
                            as: 'psychologist', 
                            attributes: ['nome', 'fotoUrl', 'crp', 'slug', 'status', 'planExpiresAt', 'is_exempt'] 
                        }
                    ]
                }
            ],
            order: [['createdAt', 'DESC']],
            limit: 20
        });

        const agora = new Date();
        const formattedQuestions = questions.map(q => {
            const qData = q.toJSON ? q.toJSON() : { ...q };
            if (qData.answers) {
                qData.answers = qData.answers.map(ans => {
                    if (ans.psychologist) {
                        let isActive = ans.psychologist.status === 'active';
                        const isVip = ans.psychologist.is_exempt === true || String(ans.psychologist.is_exempt).toLowerCase() === 'true' || ans.psychologist.is_exempt === 1;
                        
                        if (!isVip && (!ans.psychologist.planExpiresAt || new Date(ans.psychologist.planExpiresAt) <= agora)) {
                            isActive = false;
                        }
                        
                        if (!isActive) ans.psychologist.slug = null;
                    }
                    return ans;
                });
            }
            return qData;
        });

        res.json(formattedQuestions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao buscar perguntas." });
    }
};

// 3. Exibir Pergunta Única (Página SEO)
exports.getQuestionBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        
        // AUTO-FIX: Garante que as colunas existem antes de tentar buscar
        const qTable = db.Question.tableName;
        try {
            await db.sequelize.query(`ALTER TABLE "${qTable}" ADD COLUMN IF NOT EXISTS "title" VARCHAR(255);`);
            await db.sequelize.query(`ALTER TABLE "${qTable}" ADD COLUMN IF NOT EXISTS "slug" VARCHAR(255);`);
            await db.sequelize.query(`ALTER TABLE "${qTable}" ADD COLUMN IF NOT EXISTS "meta_description" TEXT;`);
        } catch(e) {}

        // 1. Busca o ID da pergunta usando SQL puro para evitar erro de modelo desatualizado no Sequelize
        const rawResults = await db.sequelize.query(
            `SELECT id, title, slug, meta_description FROM "${qTable}" WHERE "slug" = :slug LIMIT 1`,
            { replacements: { slug }, type: db.sequelize.QueryTypes.SELECT }
        );

        // Se não encontrar o slug, renderiza a página de erro 404
        if (!rawResults || rawResults.length === 0) {
            res.status(404);
            return res.render('404', { url: req.originalUrl });
        }

        // 2. Com o ID em mãos, usamos o ORM para buscar a pergunta e todas as associações com segurança
        const question = await db.Question.findByPk(rawResults[0].id, {
            include: [
                { model: db.Patient, required: false, attributes: ['nome'] },
                {
                    model: db.Answer,
                    as: 'answers',
                    required: false,
                    include: [
                        { model: db.Psychologist, as: 'psychologist', attributes: ['nome', 'fotoUrl', 'crp', 'slug', 'status', 'planExpiresAt', 'is_exempt'] }
                    ]
                }
            ]
        });

        // 1. Converte a instância bruta do Sequelize para um objeto JavaScript puro (Evita erros no EJS)
        const questionData = question.toJSON();

         // 1.5. Injeta os dados do SQL puro que o modelo do Sequelize teimou em ignorar
        questionData.title = rawResults[0].title;
        questionData.slug = rawResults[0].slug;
        questionData.meta_description = rawResults[0].meta_description;

        const agora = new Date();
        if (questionData.answers) {
            questionData.answers = questionData.answers.map(ans => {
                if (ans.psychologist) {
                    let isActive = ans.psychologist.status === 'active';
                    const isVip = ans.psychologist.is_exempt === true || String(ans.psychologist.is_exempt).toLowerCase() === 'true' || ans.psychologist.is_exempt === 1;
                    
                    if (!isVip && (!ans.psychologist.planExpiresAt || new Date(ans.psychologist.planExpiresAt) <= agora)) {
                        isActive = false;
                    }
                    
                    if (!isActive) ans.psychologist.slug = null;
                }
                return ans;
            });
        }

        // 2. Ordena as respostas da mais recente para a mais antiga via JavaScript
        if (questionData.answers && questionData.answers.length > 0) {
            questionData.answers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
        
        // 3. Garante que a capitalização do paciente não quebre a tela
        if (!questionData.Patient && questionData.patient) questionData.Patient = questionData.patient;

        // Renderiza o arquivo pergunta_unica.ejs injetando a variável question
        res.render('pergunta_unica', { question: questionData });
    } catch (error) {
        console.error("Erro ao buscar pergunta por slug:", error);
        res.status(500).send(`
            <div style="padding: 40px; font-family: sans-serif; color: #333;">
                <h2 style="color: #E63946;">Erro Interno (500)</h2>
                <p>Ocorreu um erro. Por favor, copie o texto abaixo e envie de volta para o Gemini:</p>
                <pre style="background: #f4f4f4; padding: 20px; border-radius: 8px; overflow-x: auto; font-size: 14px; border: 1px solid #ddd;">${error.stack}</pre>
            </div>
        `);
    }
};

// 4. Gerar Sitemap XML Dinâmico (SEO)
exports.generateSitemap = async (req, res) => {
    try {
        const qTable = db.Question.tableName;
        // AUTO-FIX
        try {
            await db.sequelize.query(`ALTER TABLE "${qTable}" ADD COLUMN IF NOT EXISTS "slug" VARCHAR(255);`);
        } catch(e) {}

        // Usa SQL puro para buscar os slugs e evitar falhas de cache do modelo
        const questions = await db.sequelize.query(
            `SELECT slug, "updatedAt" FROM "${qTable}" WHERE slug IS NOT NULL ORDER BY "updatedAt" DESC`,
            { type: db.sequelize.QueryTypes.SELECT }
        );

        // Busca os psicólogos ativos
        const psyTable = db.Psychologist ? db.Psychologist.tableName : 'Psychologists';
        let psychologists = [];
        try {
            psychologists = await db.sequelize.query(
                `SELECT slug, "updatedAt" FROM "${psyTable}" 
                 WHERE status = 'active' AND "deletedAt" IS NULL AND slug IS NOT NULL 
                 AND (is_exempt = true OR is_exempt = 'true' OR is_exempt = '1' OR "planExpiresAt" > NOW())`,
                { type: db.sequelize.QueryTypes.SELECT }
            );
        } catch(e) { console.error("Erro ao buscar psicólogos para o sitemap:", e.message); }

        // Busca os posts do blog
        const postTable = db.Post ? db.Post.tableName : 'Posts';
        let posts = [];
        try {
            posts = await db.sequelize.query(
                `SELECT id, "updatedAt" FROM "${postTable}"`,
                { type: db.sequelize.QueryTypes.SELECT }
            );
        } catch(e) {
            try {
                posts = await db.sequelize.query(`SELECT id, "updatedAt" FROM "posts"`, { type: db.sequelize.QueryTypes.SELECT });
            } catch(e2) { console.error("Erro ao buscar posts para o sitemap:", e2.message); }
        }

        const frontendUrl = process.env.FRONTEND_URL || 'https://www.yelopsi.com.br';

        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

        // Páginas estáticas principais
        const staticPages = ['', '/comunidade', '/ajuda', '/contato', '/questionario', '/blog', '/sobre', '/sobre_psis', '/faq'];
        staticPages.forEach(page => {
            xml += `  <url>\n    <loc>${frontendUrl}${page}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
        });

        // Páginas dinâmicas das perguntas
        questions.forEach(q => {
            xml += `  <url>\n    <loc>${frontendUrl}/perguntas/${q.slug}</loc>\n    <lastmod>${new Date(q.updatedAt).toISOString()}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>\n`;
        });

        // Páginas de perfil dos Psicólogos
        psychologists.forEach(p => {
            xml += `  <url>\n    <loc>${frontendUrl}/${p.slug}</loc>\n    <lastmod>${new Date(p.updatedAt).toISOString()}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
        });

        // Páginas de Posts do Blog
        posts.forEach(post => {
            xml += `  <url>\n    <loc>${frontendUrl}/blog/post/${post.id}</loc>\n    <lastmod>${new Date(post.updatedAt).toISOString()}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
        });

        xml += '</urlset>';

        res.header('Content-Type', 'application/xml');
        res.send(xml);
    } catch (error) {
        console.error("Erro ao gerar sitemap:", error);
        res.status(500).end();
    }
};

// --- ÁREA PRIVADA (PSICÓLOGO) ---

exports.getQuestions = async (req, res) => {
    try {
        const userObj = req.psychologist || req.user;
        const psychologistId = userObj ? userObj.id : null;
        const { page = 1, limit = 15 } = req.query; // Adiciona paginação
        const offset = (page - 1) * limit;

        // 1. Busca lista negra
        const ignoredList = await db.QuestionIgnore.findAll({
            where: { psychologistId: psychologistId },
            attributes: ['questionId']
        });
        const ignoredIds = ignoredList.map(item => item.questionId);

        // 2. Otimização: Busca em duas etapas para evitar subqueries complexas do Sequelize
        // Etapa A: Encontra os IDs das perguntas corretas com paginação
        const questionIds = await db.Question.findAll({
            where: { id: { [Op.notIn]: ignoredIds } },
            attributes: ['id'],
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: offset
        });

        if (questionIds.length === 0) {
            return res.json([]);
        }
        const idsToFetch = questionIds.map(q => q.id);

        // Etapa B: Busca os dados completos apenas para os IDs selecionados
        const questions = await db.Question.findAll({
            where: { id: { [Op.in]: idsToFetch } },
            include: [
                { model: db.Patient, required: false, attributes: ['nome'] },
                { model: db.Answer, as: 'answers', required: false,
                  include: [{ model: db.Psychologist, as: 'psychologist', required: false, attributes: ['nome', 'fotoUrl'] }]
                }
            ],
            order: [['createdAt', 'DESC']] // Reordena para garantir a consistência
        });

        // Formatação (mantém a lógica anterior)
        const formatted = questions.map(q => {
            const qJson = q.toJSON(); 
            return {
                id: q.id,
                titulo: q.title, // Mantido para compatibilidade, se necessário
                conteudo: q.content,
                Patient: qJson.Patient || { nome: "Anônimo" }, 
                createdAt: q.createdAt,
                status: q.status,
                respondedByMe: qJson.answers?.some(a => a.psychologistId === psychologistId) || false,
                answers: qJson.answers || []
            };
        });

        res.json(formatted);
    } catch (error) { res.status(500).json({ error: 'Erro interno.' }); }
};

exports.answerQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        const { conteudo } = req.body; 
        const psychologistId = req.psychologist.id; 

        const question = await db.Question.findByPk(id);
        if (!question) return res.status(404).json({ error: 'Pergunta não encontrada.' });
        
        const newAnswer = await db.Answer.create({
            content: conteudo,
            questionId: id,
            psychologistId: psychologistId
        });

        // --- GAMIFICATION HOOK ---
        const gamificationService = require('../services/gamificationService');
        gamificationService.processAction(psychologistId, 'qna_answer').catch(err => console.error("Gamification hook error (answerQuestion):", err));
        
        if (question.status !== 'rejected') {
            question.status = 'answered';
            await question.save();
        }
        
        // --- GERAÇÃO AUTOMÁTICA DE SEO PARA A PERGUNTA (Em segundo plano) ---
        seoService.generateQuestionSEO(question.title || 'Dúvida Psicológica', question.content, conteudo).then(async (seoData) => {
            if (seoData && seoData.meta_description) {
                try {
                    const qTable = db.Question.tableName;
                    await db.sequelize.query(`ALTER TABLE "${qTable}" ADD COLUMN IF NOT EXISTS "meta_description" TEXT;`).catch(() => {});
                    await db.sequelize.query(
                        `UPDATE "${qTable}" SET "meta_description" = :meta WHERE "id" = :id`,
                        { replacements: { meta: seoData.meta_description, id: question.id } }
                    );
                } catch (err) { console.error("Erro SEO Q&A:", err.message); }
            }
        });

        res.json({ success: true, message: 'Resposta enviada!', answerId: newAnswer.id });

    } catch (error) {
        console.error('Erro ao responder:', error);
        res.status(500).json({ error: 'Erro ao salvar resposta.' });
    }
};

exports.editAnswer = async (req, res) => {
    try {
        const { answerId } = req.params;
        const { conteudo } = req.body; 
        const psychologistId = req.psychologist.id; 

        const answer = await db.Answer.findByPk(answerId);
        if (!answer) return res.status(404).json({ error: 'Resposta não encontrada.' });
        if (answer.psychologistId !== psychologistId && answer.PsychologistId !== psychologistId) {
            return res.status(403).json({ error: 'Você só pode editar suas próprias respostas.' });
        }

        const timeDiff = Date.now() - new Date(answer.createdAt).getTime();
        if (timeDiff > 15 * 60 * 1000) {
            return res.status(403).json({ error: 'O tempo limite de 15 minutos para edição expirou.' });
        }

        answer.content = conteudo;
        await answer.save();

        try {
            const ansTable = db.Answer.tableName;
            await db.sequelize.query(`ALTER TABLE "${ansTable}" ADD COLUMN IF NOT EXISTS "isEdited" BOOLEAN DEFAULT false;`).catch(() => {});
            await db.sequelize.query(
                `UPDATE "${ansTable}" SET "isEdited" = true WHERE id = :id`,
                { replacements: { id: answer.id } }
            );
        } catch (e) {}

        res.json({ success: true, message: 'Resposta atualizada com sucesso!' });
    } catch (error) {
        console.error('Erro ao editar resposta:', error);
        res.status(500).json({ error: 'Erro ao editar resposta.' });
    }
};

// --- ÁREA ADMIN (Adicionada para evitar crash no adminRoutes.js) ---

exports.getPendingQuestions = async (req, res) => {
    try {
        const questions = await db.Question.findAll({
            where: { status: 'pending_review' },
            order: [['createdAt', 'DESC']]
        });
        res.json(questions);
    } catch (error) {
        res.status(500).json({ error: "Erro admin" });
    }
};

exports.getAllQuestions = async (req, res) => {
    try {
        const questions = await db.Question.findAll({ order: [['createdAt', 'DESC']] });
        res.json(questions);
    } catch (error) {
        res.status(500).json({ error: "Erro admin" });
    }
};

exports.moderateQuestion = async (req, res) => {
    res.json({ success: true, message: "Função placeholder" });
};

exports.deleteQuestion = async (req, res) => {
    try {
        await db.Question.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Erro ao deletar" });
    }
};

exports.ignoreQuestion = async (req, res) => {
    try {
        await db.QuestionIgnore.create({
            questionId: req.params.id,
            psychologistId: req.psychologist.id
        });
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: "Erro ao ignorar." }); }
};
// controllers/blogController.js
const db = require('../models');
const Post = db.Post; 
// Precisamos do modelo Psychologist para saber quem escreveu
// Tenta carregar com maiúscula ou minúscula para evitar erro no Linux/Render
const Psychologist = db.Psychologist || db.psychologist || db.Sequelize.models.Psychologist;
const gamificationService = require('../services/gamificationService');
const seoService = require('../services/seoService'); // Importa o serviço de IA
const fs = require('fs').promises;

const cloudinary = require('cloudinary').v2;
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Função auxiliar para formatar URL da imagem (mesma lógica do frontend)
const formatImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    let cleanPath = path.replace(/\\/g, '/');
    if (cleanPath.includes('uploads/')) cleanPath = cleanPath.substring(cleanPath.lastIndexOf('uploads/'));
    if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;
    return cleanPath;
};

const generateSlug = (text) => {
    if (!text) return '';
    return text.toString().toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // remove acentos
        .replace(/\s+/g, '-') // espaços por hífen
        .replace(/[^\w\-]+/g, '') // remove não alfanuméricos
        .replace(/\-\-+/g, '-') // hifens múltiplos
        .replace(/^-+/, '') // trim início
        .replace(/-+$/, ''); // trim fim
};

const getOp = () => (db.Sequelize && db.Sequelize.Op) || require('sequelize').Op;

const UNPUBLISHED_STATUSES = ['draft', 'scheduled'];
const isUnpublishedStatus = (status) => UNPUBLISHED_STATUSES.includes(status);

const getBrtDateYmd = (date = new Date()) => {
    const d = date instanceof Date ? date : new Date(date);
    try {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Sao_Paulo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(d);
    } catch (_) {
        return d.toISOString().slice(0, 10);
    }
};

const addDaysBrtYmd = (baseDate = new Date(), days = 1) => {
    const baseYmd = getBrtDateYmd(baseDate);
    const [y, m, d] = baseYmd.split('-').map(Number);
    // Usa 12:00 UTC para evitar qualquer virada de fuso ao somar dias no calendário BRT
    const target = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
    return getBrtDateYmd(target);
};

const buildBrtPublishDate = (ymd) => new Date(`${ymd}T03:00:00.000Z`);

const formatDateBrFromDate = (dateInput) => {
    if (!dateInput) return null;
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (Number.isNaN(d.getTime())) return null;
    try {
        return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    } catch (_) {
        const ymd = getBrtDateYmd(d);
        const [y, m, day] = ymd.split('-');
        return `${day}/${m}/${y}`;
    }
};

async function getDailyPublishQuota(userId, isEditorialExempt = false, now = new Date()) {
    const Op = getOp();

    if (isEditorialExempt) {
        const draftCount = await Post.count({
            where: {
                psychologistId: userId,
                status: { [Op.in]: UNPUBLISHED_STATUSES }
            }
        });
        return {
            canPublishToday: true,
            isEditorialExempt: true,
            postsPublishedToday: 0,
            draftCount,
            nextPublishDate: null,
            nextPublishDateIso: null,
            nextPublishDateBr: null
        };
    }

    const startOfDayBRT = gamificationService.getStartOfDayBRT(now);

    const [postsPublishedToday, draftCount] = await Promise.all([
        Post.count({
            where: {
                psychologistId: userId,
                status: 'published',
                createdAt: { [Op.gte]: startOfDayBRT }
            }
        }),
        Post.count({
            where: {
                psychologistId: userId,
                status: { [Op.in]: UNPUBLISHED_STATUSES }
            }
        })
    ]);

    if (postsPublishedToday === 0) {
        return {
            canPublishToday: true,
            isEditorialExempt: false,
            postsPublishedToday: 0,
            draftCount,
            nextPublishDate: null,
            nextPublishDateIso: null,
            nextPublishDateBr: null
        };
    }

    const tomorrowYmd = addDaysBrtYmd(now, 1);
    const nextPublishDate = buildBrtPublishDate(tomorrowYmd);
    return {
        canPublishToday: false,
        isEditorialExempt: false,
        postsPublishedToday,
        draftCount,
        nextPublishDate,
        nextPublishDateIso: tomorrowYmd,
        nextPublishDateBr: formatDateBrFromDate(nextPublishDate)
    };
}

module.exports = {
    // --- ÁREA RESTRITA (DASHBOARD) ---
    obterCotaPublicacao: async (req, res) => {
        try {
            const userId = req.psychologist?.id || req.user?.id || req.userId;
            if (!userId) {
                return res.status(401).json({ error: 'Usuário não autenticado.' });
            }
            const isEditorialExempt = Boolean(
                req.psychologist?.isAdmin ||
                req.user?.isAdmin ||
                req.psychologist?.status === 'content_creator'
            );
            const quota = await getDailyPublishQuota(userId, isEditorialExempt, new Date());
            return res.json(quota);
        } catch (error) {
            console.error('Erro ao consultar cota editorial do blog:', error);
            return res.status(500).json({ error: 'Erro ao consultar cota de publicação.' });
        }
    },

    listarMeusPosts: async (req, res) => {
        try {
            const { page = 1, limit = 10 } = req.query;
            const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
            
            // [CORREÇÃO] Obtém o ID corretamente (suporta req.psychologist do middleware)
            const userId = req.psychologist?.id || req.user?.id || req.userId;

            const order = (db.sequelize && typeof db.sequelize.literal === 'function')
                ? [[db.sequelize.literal("CASE WHEN status = 'published' THEN 1 ELSE 0 END"), 'ASC'], ['createdAt', 'DESC']]
                : [['createdAt', 'DESC']];

            // Uso padrão do Sequelize (O modelo Post.js já mapeia created_at para createdAt)
            const posts = await Post.findAll({
                where: { psychologistId: userId },
                order,
                limit: parseInt(limit, 10),
                offset: offset
            });
            
            // Garante que a coluna tags seja enviada como Array e normaliza status de rascunhos salvos
            const formattedPosts = posts.map(p => {
                const pData = p.toJSON ? p.toJSON() : { ...p };
                if (typeof pData.tags === 'string') {
                    try { pData.tags = JSON.parse(pData.tags); } catch(e) { pData.tags = []; }
                }
                if (!Array.isArray(pData.tags)) pData.tags = [];
                pData.status = isUnpublishedStatus(pData.status) ? 'draft' : (pData.status || 'published');
                pData.scheduledFor = null;
                return pData;
            });
            return res.json(formattedPosts);
        } catch (error) {
            console.error("Erro ao listar posts:", error);
            res.status(500).json({ error: "Erro interno ao listar posts." });
        }
    },

    criarPost: async (req, res) => {
        try {
            let { titulo, conteudo, imagem_url } = req.body;
            if (!titulo || !conteudo) {
                if (req.file) try { await fs.unlink(req.file.path); } catch(e){}
                return res.status(400).json({ error: "Título/Conteúdo obrigatórios." });
            }

            // [NOVO] Bloqueio para perfis pendentes
            if (req.psychologist?.status === 'pending' || req.user?.status === 'pending') {
                if (req.file) try { await fs.unlink(req.file.path); } catch(e){}
                return res.status(403).json({ error: "Você precisa preencher seu CPF no perfil para publicar no blog." });
            }

            // Validação editorial: mínimo de 300 caracteres úteis no corpo do artigo
            const plainContent = String(conteudo)
                .replace(/<[^>]*>?/gm, ' ')
                .replace(/&nbsp;/gi, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            if (plainContent.length < 300) {
                if (req.file) try { await fs.unlink(req.file.path); } catch(e){}
                return res.status(400).json({ error: "Escreva um artigo com pelo menos 300 caracteres de conteúdo para publicar no blog." });
            }

            const userId = req.psychologist?.id || req.user?.id || req.userId;

            // Ritmo editorial: 1 publicação por dia (fuso de Brasília); se já publicou hoje, salva como rascunho para o psi publicar manualmente depois
            const isEditorialExempt = Boolean(req.psychologist?.isAdmin || req.user?.isAdmin || req.psychologist?.status === 'content_creator');
            const quota = await getDailyPublishQuota(userId, isEditorialExempt, new Date());
            const isDraft = !quota.canPublishToday;
            const postStatus = isDraft ? 'draft' : 'published';

            let finalImageUrl = imagem_url;

            if (req.file) {
                // --- VALIDAÇÃO MAGIC BYTES ---
                const buffer = await fs.readFile(req.file.path, { encoding: null, length: 12 });
                const hex = buffer.toString('hex').toUpperCase();
                const isJpeg = hex.startsWith('FFD8FF');
                const isPng = hex.startsWith('89504E47');
                const isWebp = hex.startsWith('52494646') && hex.substring(16, 24) === '57454250'; // RIFF....WEBP

                if (!isJpeg && !isPng && !isWebp) {
                    try { await fs.unlink(req.file.path); } catch(e){}
                    return res.status(400).json({ error: "Arquivo com assinatura inválida (Magic Bytes)." });
                }

                // --- UPLOAD CLOUDINARY ---
                try {
                    const result = await cloudinary.uploader.upload(req.file.path, {
                        folder: 'yelo/blog',
                        transformation: [{ width: 1000, crop: 'limit' }, { quality: 'auto' }, { fetch_format: 'auto' }]
                    });
                    finalImageUrl = result.secure_url;
                } catch (cloudErr) {
                    throw new Error("Erro no upload da imagem");
                } finally {
                    try { await fs.unlink(req.file.path); } catch (e) {} // Limpa temp
                }
            }

            let baseSlug = generateSlug(titulo);
            let finalSlug = baseSlug;
            let counter = 1;
            while(await Post.findOne({ where: { slug: finalSlug } })) {
                finalSlug = `${baseSlug}-${counter}`;
                counter++;
            }

            const novoPost = await Post.create({
                titulo,
                conteudo,
                imagem_url: finalImageUrl,
                slug: finalSlug,
                psychologistId: userId,
                status: postStatus,
                scheduledFor: null
            });

            // --- GERAÇÃO AUTOMÁTICA DE SEO COM IA (Gemini) ---
            seoService.generateSEO(conteudo, titulo).then(async (seoData) => {
                try {
                    await Post.update(
                        { 
                            seo_title: seoData.seo_title,
                            meta_description: seoData.meta_description,
                            tags: JSON.stringify(seoData.tags)
                        },
                        { where: { id: novoPost.id } }
                    );
                } catch (seoErr) { 
                    console.error(`Erro ao persistir SEO gerado para o post ${novoPost.id}:`, seoErr.message); 
                }
            }).catch(err => {
                console.error("Falha ao contatar seoService.generateSEO:", err.message);
            });

            const novoPostJson = novoPost.toJSON ? novoPost.toJSON() : { ...novoPost };

            if (isDraft) {
                return res.status(201).json({
                    ...novoPostJson,
                    status: 'draft',
                    savedAsDraft: true,
                    scheduled: false,
                    availableFromBr: quota.nextPublishDateBr,
                    message: `Seu artigo foi salvo como rascunho! Acesse novamente a partir de ${quota.nextPublishDateBr || 'amanhã'} para publicá-lo no Blog.`
                });
            }

            // --- NOTIFICATION HOOK & GAMIFICATION (somente quando publicado imediatamente) ---
            const notificationService = require('../services/notificationService');
            notificationService.notifyNewPost(novoPost, 'blog').catch(err => console.error("Notification hook error (blog create):", err));

            gamificationService.processAction(userId, 'blog_post', { postId: novoPost.id }).catch(err => console.error("Gamification hook error:", err));

            return res.status(201).json({
                ...novoPostJson,
                status: 'published',
                savedAsDraft: false,
                scheduled: false
            });
        } catch (error) {
            console.error("Erro criarPost:", error);
            if (req.file) try { await fs.unlink(req.file.path); } catch(e){}
            res.status(500).json({ error: "Erro ao salvar." });
        }
    },

    atualizarPost: async (req, res) => {
        try {
            const { id } = req.params;
            const { titulo, conteudo, imagem_url } = req.body;
            const userId = req.psychologist?.id || req.user?.id || req.userId;
            
            const post = await Post.findOne({ where: { id, psychologistId: userId } });

            if (!post) {
                try { if (req.file) await fs.unlink(req.file.path); } catch (e) {}
                return res.status(404).json({ error: "Não encontrado ou sem permissão." });
            }

            let finalImageUrl = imagem_url;

            if (req.file) {
                // --- VALIDAÇÃO MAGIC BYTES ---
                const buffer = await fs.readFile(req.file.path, { encoding: null, length: 12 });
                const hex = buffer.toString('hex').toUpperCase();
                const isJpeg = hex.startsWith('FFD8FF');
                const isPng = hex.startsWith('89504E47');
                const isWebp = hex.startsWith('52494646') && hex.substring(16, 24) === '57454250'; // RIFF....WEBP

                if (!isJpeg && !isPng && !isWebp) {
                    try { await fs.unlink(req.file.path); } catch(e){}
                    return res.status(400).json({ error: "Arquivo com assinatura inválida (Magic Bytes)." });
                }

                // --- UPLOAD CLOUDINARY ---
                try {
                    const result = await cloudinary.uploader.upload(req.file.path, {
                        folder: 'yelo/blog',
                        transformation: [{ width: 1000, crop: 'limit' }, { quality: 'auto' }, { fetch_format: 'auto' }]
                    });
                    finalImageUrl = result.secure_url;
                } catch (cloudErr) {
                    throw new Error("Erro no upload da imagem");
                } finally {
                    try { await fs.unlink(req.file.path); } catch (e) {} // Limpa temp
                }
            }

            let baseSlug = generateSlug(titulo);
            let finalSlug = baseSlug;
            let counter = 1;
            const Op = db.Sequelize.Op;
            while(await Post.findOne({ where: { slug: finalSlug, id: { [Op.ne]: id } } })) {
                finalSlug = `${baseSlug}-${counter}`;
                counter++;
            }

            await post.update({ titulo, conteudo, imagem_url: finalImageUrl, slug: finalSlug });

            // --- REGERA O SEO COM IA (Em segundo plano) ---
            seoService.generateSEO(conteudo, titulo).then(async (seoData) => {
                try {
                    await Post.update(
                        { 
                            seo_title: seoData.seo_title,
                            meta_description: seoData.meta_description,
                            tags: JSON.stringify(seoData.tags)
                        },
                        { where: { id: post.id } }
                    );
                } catch (seoErr) { 
                    console.error(`Erro ao persistir SEO gerado para o post ${post.id}:`, seoErr.message); 
                }
            }).catch(err => {
                console.error("Falha ao contatar seoService.generateSEO (update):", err.message);
            });
            
            res.json({ message: "Atualizado!", post });
        } catch (error) {
            try { if (req.file) await fs.unlink(req.file.path); } catch (e) {}
            res.status(500).json({ error: "Erro ao atualizar." });
        }
    },

    deletarPost: async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.psychologist?.id || req.user?.id || req.userId;

            const existingPost = await Post.findOne({ where: { id, psychologistId: userId } });
            if (!existingPost) return res.status(404).json({ error: "Post não encontrado ou não excluído." });

            const wasUnpublished = isUnpublishedStatus(existingPost.status);
            const deleted = await Post.destroy({ where: { id, psychologistId: userId } });
            if (!deleted) return res.status(404).json({ error: "Post não encontrado ou não excluído." });
            
            // --- GAMIFICATION ROLLBACK (apenas posts publicados geraram XP) ---
            let pointsDeducted = 0;
            if (!wasUnpublished) {
                try {
                    const rollbackResult = await gamificationService.rollbackAction(userId, 'blog_post', id);
                    if (rollbackResult && rollbackResult.pointsDeducted) {
                        pointsDeducted = rollbackResult.pointsDeducted;
                    }
                } catch (err) {
                    console.error("Gamification rollback error:", err);
                }
            }

            res.json({ message: "Excluído.", pointsDeducted });
        } catch (error) {
            res.status(500).json({ error: "Erro ao excluir." });
        }
    },

    /**
     * Publica manualmente um post salvo como rascunho quando o psicólogo retorna com cota diária disponível.
     */
    publicarPostSalvo: async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.psychologist?.id || req.user?.id || req.userId;
            if (!userId) {
                return res.status(401).json({ error: 'Usuário não autenticado.' });
            }

            if (req.psychologist?.status === 'pending' || req.user?.status === 'pending') {
                return res.status(403).json({ error: 'Você precisa preencher seu CPF no perfil para publicar no blog.' });
            }

            const post = await Post.findOne({ where: { id, psychologistId: userId } });
            if (!post) {
                return res.status(404).json({ error: 'Post não encontrado ou sem permissão.' });
            }

            if (!isUnpublishedStatus(post.status)) {
                return res.status(400).json({ error: 'Este post já está publicado no Blog.' });
            }

            const plainContent = String(post.conteudo || '')
                .replace(/<[^>]*>?/gm, ' ')
                .replace(/&nbsp;/gi, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            if (plainContent.length < 300) {
                return res.status(400).json({ error: 'Escreva um artigo com pelo menos 300 caracteres de conteúdo para publicar no blog.' });
            }

            const isEditorialExempt = Boolean(
                req.psychologist?.isAdmin ||
                req.user?.isAdmin ||
                req.psychologist?.status === 'content_creator'
            );
            const quota = await getDailyPublishQuota(userId, isEditorialExempt, new Date());
            if (!quota.canPublishToday) {
                return res.status(429).json({
                    error: `Você já publicou seu artigo de hoje. Acesse novamente a partir de ${quota.nextPublishDateBr || 'amanhã'} para publicar este post.`,
                    nextPublishDateBr: quota.nextPublishDateBr
                });
            }

            const now = new Date();
            const Op = getOp();
            const [affectedCount] = await Post.update(
                { status: 'published', scheduledFor: null, createdAt: now, updatedAt: now },
                {
                    where: {
                        id: post.id,
                        psychologistId: userId,
                        status: { [Op.in]: UNPUBLISHED_STATUSES }
                    }
                }
            );
            if (affectedCount === 0) {
                return res.status(409).json({ error: 'Este post já foi publicado.' });
            }

            const notificationService = require('../services/notificationService');
            notificationService.notifyNewPost(post, 'blog').catch(err => console.error('Notification hook error (manual draft publish):', err));
            gamificationService.processAction(userId, 'blog_post', { postId: post.id }).catch(err => console.error('Gamification hook error (manual draft publish):', err));

            const postJson = post.toJSON ? post.toJSON() : { ...post };
            return res.json({
                ...postJson,
                status: 'published',
                scheduledFor: null,
                createdAt: now,
                updatedAt: now,
                message: 'Post publicado com sucesso no Blog!'
            });
        } catch (error) {
            console.error('Erro ao publicar post salvo:', error);
            return res.status(500).json({ error: 'Erro ao publicar post salvo.' });
        }
    },

    // ÁREA PÚBLICA: Lista do Blog
    exibirBlogPublico: async (req, res) => {
        try {
            // Ordenação estritamente cronológica para respeitar a flag "MAIS RECENTE"
            let queryOptions = { 
                where: { status: 'published' },
                order: [
                    ['createdAt', 'DESC']
                ] 
            };
            if (Psychologist) {
                queryOptions.include = [{ model: Psychologist, as: 'autor', attributes: ['nome', 'fotoUrl', 'slug', 'status', 'planExpiresAt', 'is_exempt'] }];
            }

            // CORREÇÃO: Usa .scope(null) para remover qualquer escopo padrão que possa estar
            // ocultando o campo 'conteudo' da consulta.
            const postModel = typeof Post.scope === 'function' ? Post.scope(null) : Post;
            let posts = await postModel.findAll(queryOptions);
            
            const agora = new Date();
            posts = posts.map(post => {
                const postData = post.toJSON ? post.toJSON() : { ...post };
                
                // FIX: Garante que as tags sejam um array válido (Resolve o erro 500 do EJS)
                if (typeof postData.tags === 'string') {
                    try { postData.tags = JSON.parse(postData.tags); } catch(e) { postData.tags = []; }
                }
                if (!Array.isArray(postData.tags)) postData.tags = [];

                if (postData.autor) {
                    let isActive = postData.autor.status === 'active';
                    const isVip = postData.autor.is_exempt === true || String(postData.autor.is_exempt).toLowerCase() === 'true' || postData.autor.is_exempt === 1;
                    
                    if (!isVip && (!postData.autor.planExpiresAt || new Date(postData.autor.planExpiresAt) <= agora)) {
                        isActive = false;
                    }
                    
                    if (!isActive) postData.autor.slug = null;
                }
                return postData;
            });

            res.render('blog', { 
                posts: posts, 
                formatImageUrl: formatImageUrl
            });
        } catch (error) {
            console.error("Erro blog público:", error);
            res.render('blog', { posts: [], formatImageUrl: formatImageUrl, error: "Erro." });
        }
    },

    // ÁREA PÚBLICA: Post Único (Com Sidebar)
    exibirPostUnico: async (req, res) => {
        try {
            const { id } = req.params;
            
            // --- PREVENÇÃO DE CACHE DE NAVEGADOR ---
            // Garante que ao editar um post e clicar para ver, o navegador busque a versão fresca do servidor
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.set('Pragma', 'no-cache');
            res.set('Expires', '0');
            res.set('Surrogate-Control', 'no-store');

            let queryOptions = {};
            if (Psychologist) {
                queryOptions.include = [{
                    model: Psychologist,
                    as: 'autor',
                    attributes: ['nome', 'fotoUrl', 'slug', 'status', 'planExpiresAt', 'is_exempt']
                }];
            }
            // CORREÇÃO: Usa .scope(null) para garantir que o campo 'conteudo' seja incluído,
            // ignorando qualquer escopo padrão do modelo que possa o estar excluindo.
            const isNumeric = /^\d+$/.test(id);
            const postModel = typeof Post.scope === 'function' ? Post.scope(null) : Post;
            let post = await postModel.findOne({
                where: isNumeric ? { id, status: 'published' } : { slug: id, status: 'published' },
                ...queryOptions
            });

            // REDIRECT 301: Se a busca foi por ID numérico e o post possui slug válido,
            // força o redirecionamento permanente para consolidar a URL (SEO).
            if (post && isNumeric && post.slug) {
                return res.redirect(301, `/blog/post/${post.slug}`);
            }

            if (!post) {
                // CORREÇÃO DE SOFT 404: Renderizar a página oficial 404 em vez de redirecionar para a home do blog
                res.status(404);
                return res.render('404', { url: req.originalUrl });
            }
            
            const agora = new Date();
            const postData = post.toJSON ? post.toJSON() : { ...post };
            if (postData.autor) {
                let isActive = postData.autor.status === 'active';
                const isVip = postData.autor.is_exempt === true || String(postData.autor.is_exempt).toLowerCase() === 'true' || postData.autor.is_exempt === 1;
                
                if (!isVip && (!postData.autor.planExpiresAt || new Date(postData.autor.planExpiresAt) <= agora)) {
                    isActive = false;
                }
                
                if (!isActive) postData.autor.slug = null;
            }

            // 2. Busca posts recentes para a Sidebar (excluindo o atual)
            // Usamos db.Sequelize.Op para fazer a exclusão "Not Equal" (ne)
            const Op = getOp(); 
            const recentes = await Post.findAll({
                where: { id: { [Op.ne]: post.id }, status: 'published' }, // Exclui o ID atual e posts agendados
                limit: 3, // Traz 3 sugestões
                order: [['createdAt', 'DESC']]
            });

            // Garante o parse das tags também para as sugestões da sidebar
            const recentesData = recentes.map(r => {
                const rData = r.toJSON ? r.toJSON() : { ...r };
                if (typeof rData.tags === 'string') {
                    try { rData.tags = JSON.parse(rData.tags); } catch(e) { rData.tags = []; }
                }
                if (!Array.isArray(rData.tags)) rData.tags = [];
                return rData;
            });

            res.render('post_completo', { 
                post: postData, 
                recentes: recentesData, // Enviamos a lista para a lateral
                formatImageUrl: formatImageUrl
            });

        } catch (error) {
            console.error("Erro ao abrir post único:", error);
            res.redirect('/blog');
        }
    },

    // Dar Like ou Deslike (Toggle)
    curtirPost: async (req, res) => {
        try {
            const { id } = req.params;
            const { action } = req.body; // Recebe 'like' ou 'unlike' do frontend

            if (action === 'unlike') {
                // Se for descurtir, subtrai 1 (mas não deixa ficar negativo)
                await Post.decrement('curtidas', { where: { id: id } });
                // Garante que não ficou negativo (segurança extra)
                await db.sequelize.query('UPDATE posts SET curtidas = 0 WHERE curtidas < 0 AND id = :id', { replacements: { id } });
            } else {
                // Padrão: Soma 1
                await Post.increment('curtidas', { where: { id: id } });
            }
            
            const postAtualizado = await Post.findByPk(id, { attributes: ['curtidas'] });
            res.json({ success: true, curtidas: postAtualizado.curtidas });
        } catch (error) {
            console.error("Erro ao dar like:", error);
            res.status(500).json({ error: "Erro ao processar like." });
        }
    }
};
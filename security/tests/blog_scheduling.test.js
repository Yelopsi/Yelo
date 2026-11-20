const assert = require('assert');
const path = require('path');
const Module = require('module');
const { Op } = require('sequelize');

console.log('🧪 INICIANDO SUÍTE DE TESTES: BLOG SCHEDULING & CORS BLINDAGEM');
console.log('===============================================================');

let passed = 0;
let failed = 0;

async function test(name, fn) {
    try {
        await fn();
        console.log(`  ✅ PASS: ${name}`);
        passed++;
    } catch (err) {
        console.log(`  ❌ FAIL: ${name} -> ${err.message}`);
        failed++;
    }
}

function getBrtYmd(d) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date(d));
}

function makeRes() {
    return {
        statusCode: 200,
        body: null,
        rendered: null,
        redirectedTo: null,
        headers: {},
        set(k, v) { this.headers[k] = v; return this; },
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
        render(view, data) { this.rendered = { view, data }; return this; },
        redirect(code, url) { this.statusCode = code; this.redirectedTo = url; return this; }
    };
}

function loadBlogControllerWithMocks({ initialPosts = [] } = {}) {
    const store = initialPosts.map(p => ({ ...p }));
    let nextId = store.reduce((acc, p) => Math.max(acc, p.id || 0), 0) + 1;

    const actions = {
        gamificationProcess: [],
        gamificationRollback: [],
        notifications: [],
        findAllQueries: []
    };

    const wrapPost = (row) => ({
        ...row,
        toJSON() { return { ...row }; },
        async update(patch) {
            Object.assign(row, patch);
            return this;
        }
    });

    const matchesWhere = (row, where = {}) => {
        for (const [k, v] of Object.entries(where)) {
            if (v && typeof v === 'object') {
                if (v[Op.gte] !== undefined) {
                    if (!(new Date(row[k]) >= new Date(v[Op.gte]))) return false;
                } else if (v[Op.lte] !== undefined) {
                    if (!(new Date(row[k]) <= new Date(v[Op.lte]))) return false;
                } else if (v[Op.ne] !== undefined) {
                    if (row[k] === v[Op.ne]) return false;
                } else if (v[Op.in] !== undefined) {
                    if (!Array.isArray(v[Op.in]) || !v[Op.in].includes(row[k])) return false;
                }
            } else {
                if (row[k] !== v) return false;
            }
        }
        return true;
    };

    const PostMock = {
        scope() { return PostMock; },
        async count({ where = {} } = {}) {
            return store.filter(r => matchesWhere(r, where)).length;
        },
        async findAll({ where = {}, limit } = {}) {
            actions.findAllQueries.push({ where });
            let out = store.filter(r => matchesWhere(r, where));
            if (limit) out = out.slice(0, limit);
            return out.map(wrapPost);
        },
        async findOne({ where = {} } = {}) {
            const found = store.find(r => matchesWhere(r, where));
            return found ? wrapPost(found) : null;
        },
        async create(data) {
            const now = data.createdAt || new Date();
            const row = {
                id: nextId++,
                titulo: data.titulo,
                conteudo: data.conteudo,
                imagem_url: data.imagem_url || null,
                slug: data.slug,
                psychologistId: data.psychologistId,
                status: data.status || 'published',
                scheduledFor: data.scheduledFor || null,
                curtidas: 0,
                createdAt: now,
                updatedAt: now
            };
            store.push(row);
            return wrapPost(row);
        },
        async update(patch, { where = {} } = {}) {
            let count = 0;
            for (const row of store) {
                if (matchesWhere(row, where)) {
                    Object.assign(row, patch);
                    count++;
                }
            }
            return [count];
        },
        async destroy({ where = {} } = {}) {
            const before = store.length;
            for (let i = store.length - 1; i >= 0; i--) {
                if (matchesWhere(store[i], where)) {
                    store.splice(i, 1);
                }
            }
            return before - store.length;
        }
    };

    const mockDb = {
        Post: PostMock,
        Psychologist: {},
        Sequelize: { Op, models: { Psychologist: {} } },
        sequelize: {
            query: async () => [[]]
        }
    };

    const mockGamification = {
        getStartOfDayBRT(ref = new Date()) {
            const ymd = getBrtYmd(ref);
            return new Date(`${ymd}T00:00:00-03:00`);
        },
        async processAction(psiId, actionType, meta) {
            actions.gamificationProcess.push({ psiId, actionType, meta });
            return { points: 50 };
        },
        async rollbackAction(psiId, actionType, id) {
            actions.gamificationRollback.push({ psiId, actionType, id });
            return { pointsDeducted: 50 };
        }
    };

    const mockNotification = {
        async notifyNewPost(post, type) {
            actions.notifications.push({ postId: post.id, type });
        }
    };

    const mockSeo = {
        async generateSEO() {
            return { seo_title: 'SEO Title', meta_description: 'Desc', tags: ['terapia'] };
        }
    };

    const controllerPath = path.resolve(__dirname, '../../backend/controllers/blogController.js');
    const notifPath = path.resolve(__dirname, '../../backend/services/notificationService.js');
    delete require.cache[controllerPath];
    delete require.cache[notifPath];
    require.cache[notifPath] = {
        id: notifPath,
        filename: notifPath,
        loaded: true,
        exports: mockNotification
    };

    const originalLoad = Module._load;
    Module._load = function (reqPath, parent, isMain) {
        if (reqPath === '../models') return mockDb;
        if (reqPath === '../services/gamificationService') return mockGamification;
        if (reqPath === '../services/seoService') return mockSeo;
        if (reqPath === '../services/notificationService') return mockNotification;
        return originalLoad.call(this, reqPath, parent, isMain);
    };

    let blogController;
    try {
        blogController = require(controllerPath);
    } finally {
        Module._load = originalLoad;
    }

    return { blogController, store, actions };
}

(async () => {
    const validBody = {
        titulo: 'Ansiedade no trabalho',
        conteudo: '<p>' + 'Texto clínico reflexivo sobre saúde mental e rotina de atendimentos. '.repeat(8) + '</p>',
        imagem_url: ''
    };

    await test('01. 1º post do dia publica na hora; 2º e 3º salvam como rascunho sem XP nem notificação', async () => {
        const { blogController, store, actions } = loadBlogControllerWithMocks();
        const reqUser = { psychologist: { id: 10, status: 'active', isAdmin: false } };

        // 1º post -> published imediatamente
        const res1 = makeRes();
        await blogController.criarPost({ ...reqUser, body: { ...validBody, titulo: 'Post 1 Hoje' } }, res1);
        assert.strictEqual(res1.statusCode, 201);
        assert.strictEqual(res1.body.savedAsDraft, false);
        assert.strictEqual(res1.body.status, 'published');
        assert.strictEqual(actions.gamificationProcess.length, 1);
        assert.strictEqual(actions.notifications.length, 1);

        // Consulta cota após 1º post -> canPublishToday: false, draftCount: 0, próximo dia = amanhã
        const quotaRes1 = makeRes();
        await blogController.obterCotaPublicacao(reqUser, quotaRes1);
        assert.strictEqual(quotaRes1.statusCode, 200);
        assert.strictEqual(quotaRes1.body.canPublishToday, false);
        assert.strictEqual(quotaRes1.body.draftCount, 0);
        assert.ok(quotaRes1.body.nextPublishDateBr);

        // 2º post no mesmo dia -> status 'draft', sem XP/notificação
        const res2 = makeRes();
        await blogController.criarPost({ ...reqUser, body: { ...validBody, titulo: 'Post 2 Rascunho' } }, res2);
        assert.strictEqual(res2.statusCode, 201);
        assert.strictEqual(res2.body.savedAsDraft, true);
        assert.strictEqual(res2.body.scheduled, false);
        assert.strictEqual(res2.body.status, 'draft');
        assert.strictEqual(res2.body.scheduledFor, null);
        assert.strictEqual(res2.body.availableFromBr, quotaRes1.body.nextPublishDateBr);
        assert.strictEqual(actions.gamificationProcess.length, 1, 'Rascunho não deve dar XP na criação');
        assert.strictEqual(actions.notifications.length, 1, 'Rascunho não deve notificar antes de publicar');

        // 3º post no mesmo dia -> também salva como rascunho
        const res3 = makeRes();
        await blogController.criarPost({ ...reqUser, body: { ...validBody, titulo: 'Post 3 Rascunho' } }, res3);
        assert.strictEqual(res3.statusCode, 201);
        assert.strictEqual(res3.body.savedAsDraft, true);
        assert.strictEqual(res3.body.status, 'draft');
        assert.strictEqual(store.length, 3);

        const quotaRes2 = makeRes();
        await blogController.obterCotaPublicacao(reqUser, quotaRes2);
        assert.strictEqual(quotaRes2.body.draftCount, 2);
    });

    await test('02. publicarPostSalvo bloqueia no mesmo dia (429), protege contra BOLA (404) e oculta rascunho no feed público', async () => {
        const today = new Date();
        const { blogController, store } = loadBlogControllerWithMocks({
            initialPosts: [
                { id: 1, psychologistId: 10, titulo: 'Publicado Hoje', conteudo: validBody.conteudo, slug: 'pub-hoje', status: 'published', scheduledFor: null, createdAt: today },
                { id: 2, psychologistId: 10, titulo: 'Rascunho Salvo', conteudo: validBody.conteudo, slug: 'rascunho-salvo', status: 'draft', scheduledFor: null, createdAt: today },
                { id: 3, psychologistId: 10, titulo: 'Legado Agendado', conteudo: validBody.conteudo, slug: 'legado-agendado', status: 'scheduled', scheduledFor: null, createdAt: today }
            ]
        });

        // Feed público não exibe posts não publicados (draft nem legacy scheduled)
        const resPub = makeRes();
        await blogController.exibirBlogPublico({}, resPub);
        assert.strictEqual(resPub.rendered.data.posts.length, 1);
        assert.strictEqual(resPub.rendered.data.posts[0].id, 1);

        // Post único de rascunho retorna 404 público
        const resSingleDraft = makeRes();
        await blogController.exibirPostUnico({ params: { id: 'rascunho-salvo' } }, resSingleDraft);
        assert.strictEqual(resSingleDraft.statusCode, 404);

        // Mesmo dia -> publicarPostSalvo rejeita com 429
        const resSameDay = makeRes();
        await blogController.publicarPostSalvo({ psychologist: { id: 10, status: 'active' }, params: { id: 2 } }, resSameDay);
        assert.strictEqual(resSameDay.statusCode, 429);
        assert.strictEqual(store.find(p => p.id === 2).status, 'draft');

        // Outro psicólogo (BOLA) -> rejeita com 404
        const resBola = makeRes();
        await blogController.publicarPostSalvo({ psychologist: { id: 99, status: 'active' }, params: { id: 2 } }, resBola);
        assert.strictEqual(resBola.statusCode, 404);
    });

    await test('03. No dia seguinte publicarPostSalvo publica manualmente o rascunho, dispara XP/notificação uma vez e cronScheduler não publica sozinho', async () => {
        const yesterday = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
        const { blogController, store, actions } = loadBlogControllerWithMocks({
            initialPosts: [
                { id: 1, psychologistId: 10, titulo: 'Ontem', conteudo: validBody.conteudo, slug: 'ontem', status: 'published', scheduledFor: null, createdAt: yesterday },
                { id: 2, psychologistId: 10, titulo: 'Rascunho 2', conteudo: validBody.conteudo, slug: 'rascunho-2', status: 'draft', scheduledFor: null, createdAt: yesterday },
                { id: 3, psychologistId: 10, titulo: 'Rascunho 3', conteudo: validBody.conteudo, slug: 'rascunho-3', status: 'draft', scheduledFor: null, createdAt: yesterday }
            ]
        });

        const reqUser = { psychologist: { id: 10, status: 'active' } };

        // Publica rascunho #2 manualmente
        const resPub2 = makeRes();
        await blogController.publicarPostSalvo({ ...reqUser, params: { id: 2 } }, resPub2);
        assert.strictEqual(resPub2.statusCode, 200);
        assert.strictEqual(store.find(p => p.id === 2).status, 'published');
        assert.strictEqual(actions.gamificationProcess.length, 1);
        assert.strictEqual(actions.notifications.length, 1);

        // Tentar republicar #2 não duplica XP nem notificação
        const resDup2 = makeRes();
        await blogController.publicarPostSalvo({ ...reqUser, params: { id: 2 } }, resDup2);
        assert.ok(resDup2.statusCode === 400 || resDup2.statusCode === 409);
        assert.strictEqual(actions.gamificationProcess.length, 1);
        assert.strictEqual(actions.notifications.length, 1);

        // Tentar publicar #3 no mesmo dia bloqueia com 429
        const resPub3 = makeRes();
        await blogController.publicarPostSalvo({ ...reqUser, params: { id: 3 } }, resPub3);
        assert.strictEqual(resPub3.statusCode, 429);
        assert.strictEqual(store.find(p => p.id === 3).status, 'draft');

        // Confirma que não há publicação automática no cronScheduler
        const fs = require('fs');
        const cronSource = fs.readFileSync(path.resolve(__dirname, '../../backend/jobs/cronScheduler.js'), 'utf8');
        assert.strictEqual(cronSource.includes('publishDueScheduledPosts'), false, 'cronScheduler não deve publicar artigos automaticamente');
        assert.strictEqual(blogController.publishDueScheduledPosts, undefined, 'publishDueScheduledPosts não deve existir');
    });

    await test('04. Excluir rascunho (draft ou scheduled legado) não faz rollback de XP; excluir publicado mantém rollback', async () => {
        const { blogController, actions } = loadBlogControllerWithMocks({
            initialPosts: [
                { id: 11, psychologistId: 10, titulo: 'Rascunho', slug: 'rascunho', status: 'draft', scheduledFor: null, createdAt: new Date() },
                { id: 12, psychologistId: 10, titulo: 'Legado', slug: 'legado', status: 'scheduled', scheduledFor: new Date(), createdAt: new Date() },
                { id: 13, psychologistId: 10, titulo: 'Publicado', slug: 'publicado', status: 'published', scheduledFor: null, createdAt: new Date() }
            ]
        });

        const resDelDraft = makeRes();
        await blogController.deletarPost({ psychologist: { id: 10 }, params: { id: 11 } }, resDelDraft);
        assert.strictEqual(resDelDraft.statusCode, 200);
        assert.strictEqual(actions.gamificationRollback.length, 0, 'Rascunho não deve descontar XP');

        const resDelSched = makeRes();
        await blogController.deletarPost({ psychologist: { id: 10 }, params: { id: 12 } }, resDelSched);
        assert.strictEqual(resDelSched.statusCode, 200);
        assert.strictEqual(actions.gamificationRollback.length, 0, 'Rascunho legado não deve descontar XP');

        const resDelPub = makeRes();
        await blogController.deletarPost({ psychologist: { id: 10 }, params: { id: 13 } }, resDelPub);
        assert.strictEqual(resDelPub.statusCode, 200);
        assert.strictEqual(actions.gamificationRollback.length, 1, 'Post publicado deve acionar rollback de XP');
    });

    await test('05. CORS aceita domínio com e sem www da Yelo em produção e bloqueia domínio externo', async () => {
        const prevEnv = process.env.NODE_ENV;
        const prevFront = process.env.FRONTEND_URL;
        process.env.NODE_ENV = 'production';
        process.env.FRONTEND_URL = 'https://www.yelopsi.com.br';

        try {
            const secPath = path.resolve(__dirname, '../../backend/middlewares/securityMiddleware.js');
            delete require.cache[secPath];
            const { corsConfig } = require(secPath);

            const checkOrigin = (origin) => new Promise((resolve) => {
                const req = { method: 'POST', headers: { origin } };
                const res = {
                    headers: {},
                    setHeader(k, v) { this.headers[k] = v; },
                    getHeader(k) { return this.headers[k]; }
                };
                corsConfig(req, res, (err) => resolve({ err, acao: res.headers['Access-Control-Allow-Origin'] }));
            });

            const wwwRes = await checkOrigin('https://www.yelopsi.com.br');
            assert.strictEqual(wwwRes.err, undefined);
            assert.strictEqual(wwwRes.acao, 'https://www.yelopsi.com.br');

            const apexRes = await checkOrigin('https://yelopsi.com.br');
            assert.strictEqual(apexRes.err, undefined);
            assert.strictEqual(apexRes.acao, 'https://yelopsi.com.br');

            const evilRes = await checkOrigin('https://evil.example.com');
            assert.ok(evilRes.err instanceof Error, 'Origem de terceiro deve continuar bloqueada');
        } finally {
            process.env.NODE_ENV = prevEnv;
            process.env.FRONTEND_URL = prevFront;
        }
    });

    console.log('\n===============================================================');
    console.log(`Resultado: ${passed} PASS | ${failed} FAIL`);
    process.exit(failed > 0 ? 1 : 0);
})();

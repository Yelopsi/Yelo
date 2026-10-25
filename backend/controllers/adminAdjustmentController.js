/**
 * adminAdjustmentController.js
 * Controlador da Central de Ajustes e Backlog do Admin.
 * Permite capturar tarefas em linguagem natural, categorizar automaticamente
 * por página/arquivo (Notion-like) e gerenciar status no banco de dados.
 */

const fs = require('fs');
const path = require('path');
const db = require('../models');
const AdminAdjustmentParserService = require('../services/adminAdjustmentParserService');

// Garante a existência da tabela e colunas caso o servidor ainda não tenha reiniciado
async function ensureTableExists() {
    try {
        await db.sequelize.query(`
            CREATE TABLE IF NOT EXISTS "AdminAdjustments" (
                "id" SERIAL PRIMARY KEY,
                "title" TEXT NOT NULL,
                "target_page" VARCHAR(255) NOT NULL DEFAULT 'Geral',
                "file_path" VARCHAR(255),
                "category" VARCHAR(100) NOT NULL DEFAULT 'Melhoria',
                "environment" VARCHAR(50) NOT NULL DEFAULT 'geral',
                "device" VARCHAR(50) NOT NULL DEFAULT 'todos',
                "image_url" TEXT,
                "priority" VARCHAR(50) NOT NULL DEFAULT 'media',
                "status" VARCHAR(50) NOT NULL DEFAULT 'pendente',
                "notes" TEXT,
                "order" INTEGER DEFAULT 0,
                "completedAt" TIMESTAMP WITH TIME ZONE,
                "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await db.sequelize.query(`ALTER TABLE "AdminAdjustments" ADD COLUMN IF NOT EXISTS "environment" VARCHAR(50) NOT NULL DEFAULT 'geral';`);
        await db.sequelize.query(`ALTER TABLE "AdminAdjustments" ADD COLUMN IF NOT EXISTS "device" VARCHAR(50) NOT NULL DEFAULT 'todos';`);
        await db.sequelize.query(`ALTER TABLE "AdminAdjustments" ADD COLUMN IF NOT EXISTS "image_url" TEXT;`);
    } catch (e) {
        console.warn("Aviso ao verificar tabela AdminAdjustments:", e.message);
    }
}

// Inicializa a tabela silenciosamente
ensureTableExists();

exports.getAdjustments = async (req, res) => {
    try {
        await ensureTableExists();

        const { status, page, category, environment, device, search } = req.query;

        let whereClauses = [];
        let replacements = {};

        if (status && status !== 'all') {
            whereClauses.push(`"status" = :status`);
            replacements.status = status;
        }

        if (page && page !== 'all') {
            whereClauses.push(`"target_page" = :page`);
            replacements.page = page;
        }

        if (category && category !== 'all') {
            whereClauses.push(`"category" = :category`);
            replacements.category = category;
        }

        if (environment && environment !== 'all') {
            whereClauses.push(`"environment" = :environment`);
            replacements.environment = environment;
        }

        if (device && device !== 'all') {
            whereClauses.push(`"device" = :device`);
            replacements.device = device;
        }

        if (search && search.trim()) {
            whereClauses.push(`("title" ILIKE :search OR "target_page" ILIKE :search OR "notes" ILIKE :search)`);
            replacements.search = `%${search.trim()}%`;
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const [adjustments] = await db.sequelize.query(`
            SELECT *
            FROM "AdminAdjustments"
            ${whereSql}
            ORDER BY 
                CASE 
                    WHEN "status" = 'pendente' THEN 1
                    WHEN "status" = 'em_andamento' THEN 2
                    ELSE 3
                END ASC,
                "target_page" ASC,
                "order" ASC,
                "createdAt" DESC;
        `, { replacements });

        // Cálculo de estatísticas gerais
        const [stats] = await db.sequelize.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN "status" = 'pendente' THEN 1 END) as pending,
                COUNT(CASE WHEN "status" = 'em_andamento' THEN 1 END) as in_progress,
                COUNT(CASE WHEN "status" = 'concluido' THEN 1 END) as completed,
                COUNT(DISTINCT "target_page") as pages_count,
                COUNT(CASE WHEN "priority" = 'alta' AND "status" != 'concluido' THEN 1 END) as high_priority,
                COUNT(CASE WHEN "environment" = 'admin' THEN 1 END) as count_admin,
                COUNT(CASE WHEN "environment" = 'psicologo' THEN 1 END) as count_psicologo,
                COUNT(CASE WHEN "environment" = 'paciente' THEN 1 END) as count_paciente,
                COUNT(CASE WHEN "environment" = 'publico' THEN 1 END) as count_publico,
                COUNT(CASE WHEN "device" = 'mobile' THEN 1 END) as count_mobile,
                COUNT(CASE WHEN "device" = 'desktop' THEN 1 END) as count_desktop,
                COUNT(CASE WHEN "image_url" IS NOT NULL AND "image_url" != '' THEN 1 END) as count_with_image
            FROM "AdminAdjustments";
        `);

        // Lista de páginas distintas para agrupamento e filtros
        const [pagesSummary] = await db.sequelize.query(`
            SELECT 
                "target_page",
                MAX("file_path") as file_path,
                MAX("environment") as environment,
                COUNT(*) as total,
                COUNT(CASE WHEN "status" = 'concluido' THEN 1 END) as completed,
                COUNT(CASE WHEN "status" != 'concluido' THEN 1 END) as remaining
            FROM "AdminAdjustments"
            GROUP BY "target_page"
            ORDER BY remaining DESC, "target_page" ASC;
        `);

        // Agrupamento por página para renderização estilo Notion
        const groupedByPage = {};
        adjustments.forEach(item => {
            const p = item.target_page || 'Geral';
            if (!groupedByPage[p]) {
                groupedByPage[p] = {
                    pageName: p,
                    filePath: item.file_path,
                    environment: item.environment || 'geral',
                    total: 0,
                    completed: 0,
                    remaining: 0,
                    items: []
                };
            }
            groupedByPage[p].items.push(item);
            groupedByPage[p].total++;
            if (item.status === 'concluido') {
                groupedByPage[p].completed++;
            } else {
                groupedByPage[p].remaining++;
            }
        });

        res.json({
            success: true,
            stats: stats[0] || {},
            pagesSummary: pagesSummary || [],
            grouped: Object.values(groupedByPage),
            items: adjustments
        });
    } catch (err) {
        console.error("Erro ao listar ajustes:", err);
        res.status(500).json({ error: "Erro ao buscar ajustes no banco de dados." });
    }
};

exports.createAdjustment = async (req, res) => {
    try {
        await ensureTableExists();

        const { text, target_page, file_path, category, environment, device, image_url, priority, notes } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({ error: "O texto do ajuste é obrigatório." });
        }

        // Se o usuário selecionou explicitamente a página no seletor (diferente de 'auto')
        let explicitPage = null;
        let explicitFilePath = file_path || null;
        let explicitEnvironment = environment;

        if (target_page && target_page.trim() && target_page.trim() !== 'auto') {
            explicitPage = target_page.trim();
            const known = AdminAdjustmentParserService.findKnownPage(explicitPage);
            if (known) {
                if (!explicitFilePath) explicitFilePath = known.filePath;
                if (!explicitEnvironment || explicitEnvironment === 'geral') explicitEnvironment = known.environment;
            }
        }

        const lines = AdminAdjustmentParserService.splitMultipleAdjustments(text);

        // Se o usuário enviou múltiplos ajustes de uma vez (quebras de linha ou lista)
        if (lines.length > 1) {
            const createdList = [];
            for (const singleLine of lines) {
                const parsed = AdminAdjustmentParserService.parseAdjustmentText(singleLine);
                const finalTitle = parsed.title;
                const finalPage = explicitPage || parsed.target_page || 'Geral';
                const finalFilePath = explicitFilePath || parsed.file_path || null;
                const finalCategory = (category && category.trim()) || parsed.category || 'Melhoria';
                const finalEnvironment = (explicitEnvironment && explicitEnvironment !== 'geral') ? explicitEnvironment : parsed.environment;
                const finalDevice = (device && device !== 'todos') ? device : parsed.device;
                const finalPriority = (priority && priority !== 'media') ? priority : parsed.priority;

                const [created] = await db.sequelize.query(`
                    INSERT INTO "AdminAdjustments"
                    ("title", "target_page", "file_path", "category", "environment", "device", "image_url", "priority", "status", "notes", "order", "createdAt", "updatedAt")
                    VALUES (:title, :target_page, :file_path, :category, :environment, :device, :image_url, :priority, 'pendente', :notes, 0, NOW(), NOW())
                    RETURNING *;
                `, {
                    replacements: {
                        title: finalTitle,
                        target_page: finalPage,
                        file_path: finalFilePath,
                        category: finalCategory,
                        environment: finalEnvironment,
                        device: finalDevice,
                        image_url: image_url || null,
                        priority: finalPriority,
                        notes: notes || null
                    }
                });
                createdList.push(created[0]);
            }

            return res.status(201).json({
                success: true,
                batch: true,
                count: createdList.length,
                adjustments: createdList
            });
        }

        // Análise automática de item único
        const parsed = AdminAdjustmentParserService.parseAdjustmentText(text);

        const finalTitle = parsed.title;
        const finalPage = explicitPage || parsed.target_page || 'Geral';
        const finalFilePath = explicitFilePath || parsed.file_path || null;
        const finalCategory = (category && category.trim()) || parsed.category || 'Melhoria';
        const finalEnvironment = (explicitEnvironment && explicitEnvironment.trim() && explicitEnvironment !== 'geral') ? explicitEnvironment : parsed.environment;
        const finalDevice = (device && device.trim()) || parsed.device || 'todos';
        const finalImageUrl = image_url || null;
        const finalPriority = (priority && priority.trim()) || parsed.priority || 'media';
        const finalNotes = notes || null;

        const [createdRecord] = await db.sequelize.query(`
            INSERT INTO "AdminAdjustments"
            ("title", "target_page", "file_path", "category", "environment", "device", "image_url", "priority", "status", "notes", "order", "createdAt", "updatedAt")
            VALUES (:title, :target_page, :file_path, :category, :environment, :device, :image_url, :priority, 'pendente', :notes, 0, NOW(), NOW())
            RETURNING *;
        `, {
            replacements: {
                title: finalTitle,
                target_page: finalPage,
                file_path: finalFilePath,
                category: finalCategory,
                environment: finalEnvironment,
                device: finalDevice,
                image_url: finalImageUrl,
                priority: finalPriority,
                notes: finalNotes
            }
        });

        res.status(201).json({
            success: true,
            batch: false,
            adjustment: createdRecord[0],
            parsed
        });
    } catch (err) {
        console.error("Erro ao criar ajuste:", err);
        res.status(500).json({ error: "Falha ao salvar ajuste no banco de dados." });
    }
};

exports.previewCategorization = (req, res) => {
    try {
        const { text } = req.body;
        const lines = AdminAdjustmentParserService.splitMultipleAdjustments(text || '');
        if (lines.length > 1) {
            const batchPreviews = lines.map(l => AdminAdjustmentParserService.parseAdjustmentText(l));
            return res.json({ success: true, batch: true, count: lines.length, items: batchPreviews });
        }
        const parsed = AdminAdjustmentParserService.parseAdjustmentText(text || '');
        res.json({ success: true, batch: false, parsed });
    } catch (err) {
        res.status(500).json({ error: "Falha ao analisar texto." });
    }
};

exports.uploadScreenshot = async (req, res) => {
    try {
        let fileBuffer = null;
        let mimeType = 'image/png';

        if (req.file) {
            fileBuffer = req.file.buffer;
            mimeType = req.file.mimetype;
        } else if (req.body && req.body.imageBase64) {
            const matches = req.body.imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (!matches || matches.length !== 3) {
                return res.status(400).json({ error: "Formato de imagem base64 inválido." });
            }
            mimeType = matches[1];
            fileBuffer = Buffer.from(matches[2], 'base64');
        }

        if (!fileBuffer || fileBuffer.length === 0) {
            return res.status(400).json({ error: "Nenhum arquivo ou imagem foi enviado." });
        }

        if (fileBuffer.length > 15 * 1024 * 1024) {
            return res.status(400).json({ error: "O print excede o limite de 15MB." });
        }

        let imageUrl = null;

        // 1. Tenta Cloudinary se configurado
        if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
            try {
                const cloudinary = require('cloudinary').v2;
                cloudinary.config({
                    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
                    api_key: process.env.CLOUDINARY_API_KEY,
                    api_secret: process.env.CLOUDINARY_API_SECRET
                });

                imageUrl = await new Promise((resolve, reject) => {
                    const uploadStream = cloudinary.uploader.upload_stream(
                        {
                            folder: 'yelo/adjustments',
                            public_id: `adjustment-print-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                            resource_type: 'image'
                        },
                        (error, result) => {
                            if (error) reject(error);
                            else resolve(result.secure_url);
                        }
                    );
                    uploadStream.end(fileBuffer);
                });
            } catch (cErr) {
                console.warn("[Upload] Cloudinary falhou, salvando localmente:", cErr.message);
            }
        }

        // 2. Se não usou Cloudinary ou falhou, salva no disco local em /uploads/adjustments/
        if (!imageUrl) {
            const ext = mimeType.includes('png') ? '.png' : (mimeType.includes('webp') ? '.webp' : '.jpg');
            const fileName = `adjust_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`;
            const targetDir = path.join(__dirname, '../../uploads/adjustments');
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }
            const filePath = path.join(targetDir, fileName);
            fs.writeFileSync(filePath, fileBuffer);
            imageUrl = `/uploads/adjustments/${fileName}`;
        }

        return res.json({ success: true, url: imageUrl });
    } catch (err) {
        console.error("Erro no upload de print do ajuste:", err);
        return res.status(500).json({ error: "Falha ao salvar print." });
    }
};

exports.updateAdjustment = async (req, res) => {
    try {
        await ensureTableExists();
        const { id } = req.params;
        const { title, target_page, file_path, category, environment, device, image_url, priority, status, notes, order } = req.body;

        const isCompleted = status === 'concluido';

        const [updated] = await db.sequelize.query(`
            UPDATE "AdminAdjustments"
            SET 
                "title" = COALESCE(:title, "title"),
                "target_page" = COALESCE(:target_page, "target_page"),
                "file_path" = :file_path,
                "category" = COALESCE(:category, "category"),
                "environment" = COALESCE(:environment, "environment"),
                "device" = COALESCE(:device, "device"),
                "image_url" = :image_url,
                "priority" = COALESCE(:priority, "priority"),
                "status" = COALESCE(:status, "status"),
                "notes" = :notes,
                "order" = COALESCE(:order, "order"),
                "completedAt" = CASE WHEN :status = 'concluido' THEN NOW() ELSE "completedAt" END,
                "updatedAt" = NOW()
            WHERE "id" = :id
            RETURNING *;
        `, {
            replacements: {
                id,
                title: title || null,
                target_page: target_page || null,
                file_path: file_path !== undefined ? file_path : null,
                category: category || null,
                environment: environment || null,
                device: device || null,
                image_url: image_url !== undefined ? image_url : null,
                priority: priority || null,
                status: status || null,
                notes: notes !== undefined ? notes : null,
                order: order !== undefined ? order : null
            }
        });

        if (!updated || updated.length === 0) {
            return res.status(404).json({ error: "Ajuste não encontrado." });
        }

        res.json({ success: true, adjustment: updated[0] });
    } catch (err) {
        console.error("Erro ao atualizar ajuste:", err);
        res.status(500).json({ error: "Erro ao atualizar ajuste." });
    }
};

exports.toggleStatus = async (req, res) => {
    try {
        await ensureTableExists();
        const { id } = req.params;
        const { status } = req.body;

        let nextStatus = status;
        if (!nextStatus) {
            // Alterna automaticamente se não foi especificado
            const [current] = await db.sequelize.query(`SELECT "status" FROM "AdminAdjustments" WHERE "id" = :id;`, { replacements: { id } });
            if (!current || current.length === 0) return res.status(404).json({ error: "Ajuste não encontrado." });
            nextStatus = current[0].status === 'concluido' ? 'pendente' : 'concluido';
        }

        const [updated] = await db.sequelize.query(`
            UPDATE "AdminAdjustments"
            SET 
                "status" = :status,
                "completedAt" = CASE WHEN :status = 'concluido' THEN NOW() ELSE NULL END,
                "updatedAt" = NOW()
            WHERE "id" = :id
            RETURNING *;
        `, { replacements: { id, status: nextStatus } });

        res.json({ success: true, adjustment: updated[0] });
    } catch (err) {
        console.error("Erro ao alternar status do ajuste:", err);
        res.status(500).json({ error: "Erro ao alternar status." });
    }
};

exports.deleteAdjustment = async (req, res) => {
    try {
        await ensureTableExists();
        const { id } = req.params;

        await db.sequelize.query(`
            DELETE FROM "AdminAdjustments" WHERE "id" = :id;
        `, { replacements: { id } });

        res.json({ success: true, message: "Ajuste excluído com sucesso." });
    } catch (err) {
        console.error("Erro ao excluir ajuste:", err);
        res.status(500).json({ error: "Erro ao excluir ajuste." });
    }
};

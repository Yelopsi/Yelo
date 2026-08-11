const db = require('../models');

// 1. Listar rascunhos pendentes da IA
exports.getAiDrafts = async (req, res) => {
    try {
        const drafts = await db.AiQuestionDraft.findAll({
            where: { status: 'pending' },
            order: [['createdAt', 'DESC']]
        });
        res.json(drafts);
    } catch (error) {
        console.error('Erro ao buscar rascunhos da IA:', error);
        res.status(500).json({ error: 'Erro interno no servidor' });
    }
};

// 2. Aprovar Rascunho da IA
exports.approveDraft = async (req, res) => {
    try {
        const draftId = req.params.id;
        
        // 1. Encontra o rascunho
        const draft = await db.AiQuestionDraft.findByPk(draftId);
        if (!draft) return res.status(404).json({ error: 'Rascunho não encontrado.' });
        if (draft.status !== 'pending') return res.status(400).json({ error: 'Rascunho não está pendente.' });

        // Aceita a edição do frontend, se enviada
        if (req.body.content) {
            draft.content = req.body.content;
        }

        // 2. Garante o paciente Anônimo
        let patient = await db.Patient.findOne({ where: { email: 'anonimo@yelopsi.com.br' }, paranoid: false });
        if (patient && patient.deletedAt) await patient.restore();
        if (!patient) {
            patient = await db.Patient.create({
                nome: "Anônimo", email: "anonimo@yelopsi.com.br", senha: "123", telefone: "00000000000"
            });
        }

        const seoService = require('../services/seoService');
        
        let finalTitle = draft.title;
        let finalMeta = draft.meta_description;
        
        // Se a pergunta tem conteúdo suficiente, gera um título de SEO focado
        if (draft.content && draft.content.length > 10) {
            const seoData = await seoService.generatePatientQuestionSEO(draft.content);
            if (seoData && seoData.title) {
                finalTitle = seoData.title;
                finalMeta = seoData.meta_description || null;
            } else {
                finalTitle = draft.content.substring(0, 60).trim() + (draft.content.length > 60 ? '...' : '');
            }
        }

        // 3. Gera o slug baseado no título gerado
        const baseSlug = (finalTitle || draft.content.substring(0, 30))
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
        const crypto = require('crypto');
        const hashUnico = crypto.randomBytes(2).toString('hex');
        const slugFinal = `${baseSlug}-${hashUnico}`;

        // 4. Cria a pergunta oficial
        const question = await db.Question.create({
            title: finalTitle,
            content: draft.content,
            PatientId: patient.id,
            status: 'approved', 
            meta_description: finalMeta,
            slug: slugFinal
        });

        // 5. Deleta o rascunho
        await draft.destroy();
        
        res.json({ message: 'Pergunta aprovada e publicada!', question });
    } catch (error) {
        console.error('Erro ao aprovar rascunho da IA:', error);
        res.status(500).json({ error: 'Erro interno ao aprovar.' });
    }
};

// 3. Rejeitar Rascunho da IA
exports.rejectDraft = async (req, res) => {
    try {
        const draftId = req.params.id;
        const draft = await db.AiQuestionDraft.findByPk(draftId);
        if (!draft) return res.status(404).json({ error: 'Rascunho não encontrado.' });
        
        await draft.destroy(); // Apaga permanentemente
        res.json({ message: 'Rascunho rejeitado e deletado.' });
    } catch (error) {
        console.error('Erro ao rejeitar rascunho:', error);
        res.status(500).json({ error: 'Erro interno ao rejeitar.' });
    }
};

// 4. Disparar job manualmente (para testes)
exports.generateNow = async (req, res) => {
    try {
        const generateAiQuestionV2 = require('../jobs/generateAiQuestionV2');
        await generateAiQuestionV2(); // Executa e espera terminar
        res.json({ message: 'Rotina de geração de IA concluída! Verifique a lista de rascunhos.' });
    } catch (error) {
        console.error('Erro ao chamar rotina da IA:', error);
        res.status(500).json({ error: 'Erro ao chamar rotina.' });
    }
};

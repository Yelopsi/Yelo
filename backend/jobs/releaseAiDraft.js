const db = require('../models');
const crypto = require('crypto');
const seoService = require('../services/seoService');

async function releaseAiDraft() {
    try {
        console.log('🤖 [CRON IA] Procurando rascunhos de IA pendentes para publicação gradual...');
        
        // 1. Encontra o rascunho mais antigo pendente
        const draft = await db.AiQuestionDraft.findOne({
            where: { status: 'pending' },
            order: [['createdAt', 'ASC']]
        });
        
        if (!draft) {
            console.log('🤖 [CRON IA] Nenhum rascunho de IA pendente encontrado. A fila está vazia.');
            return;
        }

        console.log(`🤖 [CRON IA] Aprovando e publicando rascunho ID: ${draft.id}`);

        // 2. Garante o paciente Anônimo
        let patient = await db.Patient.findOne({ where: { email: 'anonimo@yelopsi.com.br' }, paranoid: false });
        if (patient && patient.deletedAt) await patient.restore();
        if (!patient) {
            patient = await db.Patient.create({
                nome: "Anônimo", 
                email: "anonimo@yelopsi.com.br", 
                senha: "123", 
                telefone: "00000000000"
            });
        }
        
        let finalTitle = draft.title;
        let finalMeta = draft.meta_description;
        
        // 3. Se a pergunta tem conteúdo suficiente, gera um título de SEO focado
        if (draft.content && draft.content.length > 10) {
            const seoData = await seoService.generatePatientQuestionSEO(draft.content);
            if (seoData && seoData.title) {
                finalTitle = seoData.title;
                finalMeta = seoData.meta_description || null;
            } else {
                finalTitle = draft.content.substring(0, 60).trim() + (draft.content.length > 60 ? '...' : '');
            }
        }

        // 4. Gera o slug baseado no título gerado
        const baseSlug = (finalTitle || draft.content.substring(0, 30))
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
        
        const hashUnico = crypto.randomBytes(2).toString('hex');
        const slugFinal = `${baseSlug}-${hashUnico}`;

        // 5. Cria a pergunta oficial
        const question = await db.Question.create({
            title: finalTitle,
            content: draft.content,
            PatientId: patient.id,
            status: 'approved', 
            meta_description: finalMeta,
            slug: slugFinal
        });

        // 6. Deleta o rascunho
        await draft.destroy();
        
        console.log(`✅ [CRON IA] Dúvida publicada no Fórum! Slug: ${question.slug}`);

    } catch (error) {
        console.error('❌ [CRON IA] Erro ao liberar rascunho:', error);
    }
}

module.exports = releaseAiDraft;

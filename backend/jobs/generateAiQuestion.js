const db = require('../models');
const seoService = require('../services/seoService');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const crypto = require('crypto');

async function generateAiQuestion() {
    console.log('🤖 [AI-QNA] Iniciando geração de pergunta orgânica...');
    
    try {
        if (!process.env.GEMINI_API_KEY) {
            console.error('❌ [AI-QNA] Erro: GEMINI_API_KEY não configurada no .env');
            return;
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

        const prompt = `Atue como um sistema de automação responsável por gerar posts anônimos e realistas para a plataforma "Yelo", com o objetivo de engajar psicólogos e profissionais de saúde mental através de relatos autênticos de usuários.

### Diretrizes de Conteúdo e Tom:
* **Tom**: Informal, cru, genuíno e coloquial (sem saudações formais, cumprimentos ou assinaturas).
* **Tamanho**: Entre 15 e 60 palavras.
* **Restrições**: Proibido incluir diagnósticos clínicos, terminologia médica formal ou prescrições.
* **Finalidade**: O post deve soar como um desabafo cru, uma dúvida angustiante ou uma reflexão íntima pronta para receber acolhimento e engajamento profissional.

### Matriz de Variedade (Mix Randômico):
Alterne de forma totalmente orgânica e imprevisível entre diferentes formatos textuais, evitando padrões rígidos ou repetições consecutivas. Utilize aleatoriamente:
* Perguntas diretas (com "?") voltadas a compreender dilemas ou buscar respostas.
* Desabafos declarativos focados em sentimentos de exaustão, isolamento ou sobrecarga.
* Afirmações secas ou autoquestionamentos reflexivos sobre a rotina, relações ou trabalho.
* Relatos focados em personas diversas (idade, gênero, contexto social, profissional ou acadêmico) lidando com dilemas cotidianos como burnout, TDAH, síndrome do impostor, isolamento ou ansiedade social.

### Saída:
Gere apenas o texto do post atual, mantendo o formato totalmente imprevisível em relação à iteração anterior.`;

        const result = await model.generateContent(prompt);
        let conteudo = result.response.text().trim();
        
        // Remove aspas se o modelo retornar com aspas no início/fim
        if (conteudo.startsWith('"') && conteudo.endsWith('"')) {
            conteudo = conteudo.substring(1, conteudo.length - 1);
        }

        console.log(`🤖 [AI-QNA] Pergunta gerada: "${conteudo.substring(0, 50)}..."`);

        // 1. Gera o título usando a IA focada em SEO que já existe no projeto
        let title = conteudo.substring(0, 60).trim();
        if (conteudo.length > 60) title += '...';
        let metaDescription = null;

        const seoData = await seoService.generatePatientQuestionSEO(conteudo);
        if (seoData && seoData.title) {
            title = seoData.title;
            metaDescription = seoData.meta_description || null;
        }

        // 2. Cria o Slug
        let baseSlug = title
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-');

        const hashUnico = crypto.randomBytes(2).toString('hex');
        const slugFinal = `${baseSlug}-${hashUnico}`;

        // 3. Garante o paciente Anônimo
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

        // 4. Salva a pergunta no banco como pending_review
        const qTable = db.Question.tableName;
        
        // Assegura que as colunas existem
        try {
            await db.sequelize.query(`ALTER TABLE "${qTable}" ADD COLUMN IF NOT EXISTS "title" VARCHAR(255);`);
            await db.sequelize.query(`ALTER TABLE "${qTable}" ADD COLUMN IF NOT EXISTS "slug" VARCHAR(255);`);
            await db.sequelize.query(`ALTER TABLE "${qTable}" ADD COLUMN IF NOT EXISTS "meta_description" TEXT;`);
        } catch(e) {}

        const newQ = await db.Question.create({
            title: title,
            slug: slugFinal,
            content: conteudo,
            status: "pending_review",
            PatientId: patient.id,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        // Grava no BD ignorando restrições do modelo
        await db.sequelize.query(
            `UPDATE "${qTable}" SET "title" = :title, "slug" = :slug, "meta_description" = :meta WHERE id = :id`,
            { replacements: { title, slug: slugFinal, meta: metaDescription, id: newQ.id } }
        );

        console.log(`✅ [AI-QNA] Pergunta salva com sucesso na fila de moderação (ID: ${newQ.id})`);

    } catch (error) {
        console.error('❌ [AI-QNA] Erro ao gerar pergunta:', error.message);
    }
}

module.exports = { generateAiQuestion };

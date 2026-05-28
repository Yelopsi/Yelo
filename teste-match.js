const db = require('./backend/models');
const matchService = require('./backend/services/matchService');

async function simularSistemaDeMatch() {
    console.log("🚀 Iniciando Simulação de Stress do Motor Yelo...");
    
    // --- FIX: Garante que a nova coluna existe antes de iniciar a simulação ---
    try {
        await db.sequelize.query(`ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "last_shown_match_at" TIMESTAMP WITH TIME ZONE;`);
    } catch (e) {
        // Ignora erros silenciosamente se a coluna já existir
    }


    // 1. Mock: Simulando as respostas exatas de um paciente no questionário
    const pacienteMock = {
        valor_sessao_faixa: "100 a 200",
        temas_buscados: ["Ansiedade", "Autoconhecimento"], // Escolha temas que vários profissionais tenham
        modalidade_preferida: "Online",
        genero_profissional: "Indiferente"
    };

    // 2. Loop de Simulação (O paciente fazendo 5 buscas seguidas)
    for (let rodada = 1; rodada <= 5; rodada++) {
        console.log(`--- Buscando Recomendações: Rodada ${rodada} ---`);
        
        // Roda o serviço principal
        const matchResult = await matchService.calculateMatches(pacienteMock);
        
        if (!matchResult.results || matchResult.results.length === 0) {
            console.log("Nenhum profissional encontrado para esse filtro.");
            break;
        }

        // Extrai os IDs e as pontuações internas para vermos a matemática crua
        const vencedores = matchResult.results.map(psi => ({
            id: psi.id,
            nome: psi.nome.split(' ')[0],
            nota_exibicao: psi.matchScore,
            nota_interna_real: psi.finalScore.toFixed(2), // <--- O score com UCB e Cooldown
            impressoes: psi.profile_appearances
        }));

        console.log(`🏆 Top 3 Exibidos (de ${matchResult.results.length} avaliados):`, vencedores);

        // 3. Simula a ação do Controller: Atualiza o banco aplicando o Cooldown
        const idsExibidos = vencedores.map(v => v.id);
        await db.sequelize.query(
            `UPDATE "Psychologists" 
             SET profile_appearances = profile_appearances + 1, 
                 last_shown_match_at = NOW() 
             WHERE id IN (:ids)`,
            { 
                replacements: { ids: idsExibidos }, 
                type: db.sequelize.QueryTypes.UPDATE 
            }
        );
        
        console.log("🕒 Cooldown aplicado aos IDs:", idsExibidos.join(', '));
        console.log("--------------------------------------------------\n");
    }

    console.log("✅ Simulação finalizada com sucesso.");
    process.exit(0);
}

// Executa a função
simularSistemaDeMatch().catch(err => {
    console.error("❌ Erro na simulação:", err);
    process.exit(1);
});
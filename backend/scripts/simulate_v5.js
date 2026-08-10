const db = require('../models');
const matchService = require('../services/matchService');
const seoService = require('../services/seoService');

(async () => {
    console.log("🚀 Iniciando Simulação de 100 Psicólogos no Motor V5...");

    // Backup
    const originalPsyFindAll = db.Psychologist.findAll;
    const originalLogFindAll = db.WhatsAppClickLog.findAll;
    const originalGenerateCopy = seoService.generateMatchCopy;

    // Gerar 100 psicólogos mock
    const mockPsychologists = [];
    for (let i = 1; i <= 100; i++) {
        mockPsychologists.push({
            id: i,
            nome: `Dr(a). Teste ${i}`,
            status: 'active',
            bio: 'Bio de teste longa o suficiente para passar.',
            fotoUrl: 'https://placehold.co/100',
            planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 
            is_exempt: true,
            cpf: '111',
            // Pares são especialistas em Ansiedade
            temas_atuacao: i % 2 === 0 ? ['Ansiedade'] : ['Carreira'],
            modalidade: 'Online',
            valor_sessao_numero: 100,
            tipo_cobranca: 'sessao',
            // Dr 10 e Dr 12 apareceram 1 minuto atrás (Cooldown test)
            last_shown_match_at: (i === 10 || i === 12) ? new Date(Date.now() - 60000) : null,
            toJSON: function() { return this; }
        });
    }

    // Gerar CRM Logs
    const mockLogs = [];
    
    // ID 2 (Monopolizador de Vendas): 30 leads, 5 fechamentos
    for(let i=0; i<30; i++) mockLogs.push({ psychologistId: 2, dealClosed: i < 5 ? 'closed' : 'open' });
    
    // ID 4 (Desperdiçador): 10 leads, 0 fechamentos (Vai sofrer penalidade de 40%)
    for(let i=0; i<10; i++) mockLogs.push({ psychologistId: 4, dealClosed: 'open' });
    
    // ID 6 (Ocioso/Fome Total): 0 leads, 0 fechamentos (Vai ganhar +50 pontos de Justiça)
    
    // IDs 8 a 20 (Psicólogos Normais que bateram a cota): 2 leads, 1 fechamento
    for(let id=8; id<=20; id++) {
        mockLogs.push({ psychologistId: id, dealClosed: 'closed' });
        mockLogs.push({ psychologistId: id, dealClosed: 'open' });
    }

    db.Psychologist.findAll = async () => mockPsychologists;
    db.WhatsAppClickLog.findAll = async () => mockLogs;
    seoService.generateMatchCopy = async () => ({});

    // Preferências: Busca por Ansiedade
    const preferences = {
        temas: 'Ansiedade', 
        faixa_valor: 'Até R$ 150',
        modalidade_atendimento: 'Online',
        pref_genero_prof: 'Indiferente',
        caracteristicas_prof: 'Indiferente'
    };

    try {
        const result = await matchService.calculateMatches(preferences);
        console.log("\n========================================================");
        console.log("🎯 RESULTADO FINAL DO SORTEIO DA IA (V5 FAIRNESS)");
        console.log("========================================================");
        
        const nomesVagas = ["🥇 Vaga 1 (Mérito Clínico Absoluto)", "⚖️ Vaga 2 (Justiça Social / Ocioso)", "🎲 Vaga 3 (Sorteio Justo s/ Cooldown)"];

        result.results.forEach((r, i) => {
            console.log(`\n${nomesVagas[i]}: ${r.nome} (ID: ${r.id})`);
            console.log(`   - Score Clínico Base: ${r.rawMatchScore.toFixed(2)}`);
            console.log(`   - Score Final (com Multiplicadores V5): ${r.finalScore.toFixed(2)}`);
            console.log(`   - Desempenho CRM: Leads: ${r.leads30d} | Conversões: ${r.conversoes30d}`);
            if (r.conversoes30d === 0) console.log(`   - Recebeu Bônus de Fome Máximo (+50 pts)`);
            if (r.leads30d >= 7 && r.conversoes30d === 0) console.log(`   - Sofreu Penalidade de Desperdício (-40%)`);
        });
        
    } catch (e) {
        console.error("Erro na simulação:", e);
    } finally {
        db.Psychologist.findAll = originalPsyFindAll;
        db.WhatsAppClickLog.findAll = originalLogFindAll;
        seoService.generateMatchCopy = originalGenerateCopy;
        process.exit(0);
    }
})();

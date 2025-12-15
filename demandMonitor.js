// backend/cron/demandMonitor.js

const { Op } = require('sequelize');
const db = require('../models');
const { sendInvitationEmail } = require('../services/emailService');
const crypto = require('crypto');

const LIQUIDITY_TARGET = 8; // Número-alvo de profissionais por nicho
const MINIMUM_SEARCHES_FOR_NICHE = 5; // Um nicho só é considerado relevante se for buscado pelo menos 5 vezes.
const MAX_INVITATIONS_PER_RUN = 3; // Limite de convites a serem enviados por execução do CRON.
const SENIORITY_THRESHOLD_DAYS = 90; // Profissionais esperando há mais de 90 dias são priorizados.

/**
 * NOVA LÓGICA: Identifica os "bolsões de demanda" com base nas buscas reais dos pacientes.
 */
async function findDemandGaps() {
    console.log('CRON: Iniciando verificação de gaps de demanda...');

    // 1. Busca todas as buscas de demanda dos últimos 30 dias
    const recentSearches = await db.DemandSearch.findAll({
        where: {
            createdAt: {
                [Op.gte]: new Date(new Date() - 30 * 24 * 60 * 60 * 1000) // 30 dias atrás
            }
        }
    });

    if (recentSearches.length === 0) {
        console.log('CRON: Nenhuma busca de demanda recente encontrada. Encerrando.');
        return;
    }

    // 2. Agrega as buscas para encontrar os nichos mais populares
    const nicheFrequency = new Map();
    recentSearches.forEach(search => {
        const params = search.searchParams;
        if (params && params.faixa_valor && params.temas) {
            // Cria uma chave única para o nicho de busca do paciente
            const nicheKey = [
                params.faixa_valor,
                [...(params.temas || [])].sort().join(','),
                params.pref_genero_prof || 'Indiferente',
                [...(params.caracteristicas_prof || [])].sort().join(',')
            ].join('|');

            nicheFrequency.set(nicheKey, (nicheFrequency.get(nicheKey) || 0) + 1);
        }
    });

    // 3. Filtra e ordena os nichos por popularidade
    const popularNiches = Array.from(nicheFrequency.entries())
        .filter(([key, count]) => count >= MINIMUM_SEARCHES_FOR_NICHE)
        .sort((a, b) => b[1] - a[1]);

    console.log(`CRON: Encontrados ${popularNiches.length} nichos de demanda relevantes.`);

    let invitationsSent = 0;

    // FASE 1: Itera sobre os nichos populares e convida com base na demanda
    for (const [nicheKey, searchCount] of popularNiches) {
        const [faixa_valor, temas_str, pref_genero_prof, caracteristicas_prof_str] = nicheKey.split('|');
        const temas = temas_str ? temas_str.split(',') : [];
        const caracteristicas_prof = caracteristicas_prof_str ? caracteristicas_prof_str.split(',') : [];

        // Constrói a query para encontrar psicólogos que atendem a este nicho
        const whereClause = {
            status: 'active',
            valor_sessao_faixa: faixa_valor,
            temas_atuacao: { [Op.overlap]: temas }
        };
        if (pref_genero_prof !== 'Indiferente') {
            whereClause.genero_identidade = pref_genero_prof;
        }
        if (caracteristicas_prof.length > 0) {
            whereClause.praticas_vivencias = { [Op.overlap]: caracteristicas_prof };
        }

        const activePsychologistsCount = await db.Psychologist.count({
            where: whereClause
        });

        console.log(`CRON: Nicho [${faixa_valor}] - Buscas: ${searchCount} | Psicólogos Ativos: ${activePsychologistsCount} | Alvo: ${LIQUIDITY_TARGET}`);

        // Se a oferta de psicólogos for menor que o alvo, há um gap de demanda.
        if (activePsychologistsCount < LIQUIDITY_TARGET) {
            console.log(`CRON: Gap de liquidez encontrado! Iniciando processo de convite.`);
            
            const wasInvited = await inviteNextInLine({ faixa_valor, temas, pref_genero_prof, caracteristicas_prof });

            if (wasInvited) {
                invitationsSent++;
            }

            if (invitationsSent >= MAX_INVITATIONS_PER_RUN) {
                console.log(`CRON: Limite de ${MAX_INVITATIONS_PER_RUN} convites por execução atingido. Encerrando.`);
                break;
            }
        }
    }

    // FASE 2: Se ainda houver "vagas" para convite, convida os profissionais mais antigos na fila.
    if (invitationsSent < MAX_INVITATIONS_PER_RUN) {
        console.log('CRON: Verificando candidatos por senioridade (tempo de espera)...');
        const remainingSlots = MAX_INVITATIONS_PER_RUN - invitationsSent;

        const seniorCandidates = await db.WaitingList.findAll({
            where: {
                status: 'pending',
                createdAt: {
                    [Op.lt]: new Date(new Date() - SENIORITY_THRESHOLD_DAYS * 24 * 60 * 60 * 1000)
                }
            },
            order: [['createdAt', 'ASC']], // Os mais antigos primeiro
            limit: remainingSlots
        });

        if (seniorCandidates.length > 0) {
            console.log(`CRON: Encontrados ${seniorCandidates.length} candidatos por senioridade.`);
            for (const candidate of seniorCandidates) {
                // Para convidar, precisamos "recriar" os critérios do nicho a partir do perfil do candidato
                const nicheCriteria = {
                    faixa_valor: candidate.valor_sessao_faixa,
                    temas: candidate.temas_atuacao || [],
                    pref_genero_prof: candidate.genero_identidade || 'Indiferente',
                    caracteristicas_prof: candidate.praticas_afirmativas || []
                };
                const wasInvited = await inviteNextInLine(nicheCriteria, candidate.id); // Passa o ID para garantir que estamos convidando a pessoa certa
                if (wasInvited) {
                    invitationsSent++;
                }
            }
        }
    }

    console.log('CRON: Verificação de gaps de demanda finalizada.');
}

/**
 * Encontra o próximo profissional na fila para um nicho específico e envia o convite.
 * @param {object} nicheCriteria - Os critérios do nicho com gap de demanda.
 * @returns {Promise<boolean>} - Retorna true se um convite foi enviado, false caso contrário.
 * @param {number} [specificCandidateId=null] - O ID de um candidato específico a ser convidado (usado pela lógica de senioridade).
 */
async function inviteNextInLine(nicheCriteria, specificCandidateId = null) {
    // Constrói a query para encontrar o melhor candidato na lista de espera
    const whereClause = {
        status: 'pending',
        valor_sessao_faixa: nicheCriteria.faixa_valor,
        temas_atuacao: { [Op.overlap]: nicheCriteria.temas },
    };
    if (nicheCriteria.pref_genero_prof !== 'Indiferente') {
        whereClause.genero_identidade = nicheCriteria.pref_genero_prof;
    }
    if (nicheCriteria.caracteristicas_prof.length > 0) {
        whereClause.praticas_afirmativas = { [Op.overlap]: nicheCriteria.caracteristicas_prof };
    }

    // Se um ID específico foi passado (pela lógica de senioridade), adiciona à query.
    if (specificCandidateId) {
        whereClause.id = specificCandidateId;
    }

    const candidate = await db.WaitingList.findOne({
        where: whereClause,
        order: [['createdAt', 'ASC']] // First-In
    });

    if (candidate) {
        const invitationToken = crypto.randomBytes(32).toString('hex');
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + 7); // Expira em 7 dias

        await candidate.update({
            status: 'invited',
            invitationToken: invitationToken,
            invitationExpiresAt: expirationDate,
        });

        const invitationLink = `http://127.0.0.1:5500/psi_registro.html?token=${invitationToken}&email=${candidate.email}`;
        await sendInvitationEmail(candidate, invitationLink);
        console.log(`CRON: Convite enviado para ${candidate.email}.`);
        return true;
    } else {
        console.log(`CRON: Nenhum candidato encontrado na lista de espera para o nicho ou com ID ${specificCandidateId}.`);
        return false;
    }
}

// Exporta a função principal para que possa ser chamada pelo agendador
module.exports = { findDemandGaps };
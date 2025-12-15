require('dotenv').config({ path: '../.env' }); // Carrega as variáveis de ambiente
const db = require('../models');
const bcrypt = require('bcryptjs');

// Função Auxiliar para gerar slugs, garantindo consistência
const generateSlug = (name) => {
    return name
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-');
};

async function seedTestData() {
    try {
        // --- 1. Criar um Paciente de Teste ---
        const patientPassword = await bcrypt.hash('password123', 10);
        const patientData = {
            nome: "Paciente Teste",
            email: "paciente.teste@jano.com",
            senha: patientPassword,
            telefone: "(11) 98765-4321",
            valor_sessao_faixa: "R$ 91 - R$ 150", // Para match de preço
            temas_buscados: ["Ansiedade", "Estresse", "Relacionamentos"], // Para match de temas
            abordagem_desejada: ["Psicanálise", "Terapia Humanista"], // Para match de abordagem
            genero_profissional: "Feminino", // Para match de gênero
            praticas_afirmativas: ["Que tenha uma perspectiva feminista", "Que faça parte da comunidade LGBTQIAPN+"], // Para match de práticas
            disponibilidade_periodo: ["Manhã", "Noite"]
        };

        await db.Patient.create(patientData);
        console.log("Paciente de teste criado:", patientData.email);

        // --- 2. Criar um Psicólogo de Teste ---
        const psychologistPassword = await bcrypt.hash('password123', 10);
        const psychologistData = {
            nome: "Dra. Ana Psicóloga",
            crp: "06/123456",
            email: "ana.psicologa@girassol.com",
            senha: psychologistPassword,
            telefone: "11999998888", // CAMPO ADICIONADO
            slug: generateSlug("Dra. Ana Psicóloga"),
            valor_sessao_numero: 120.00, // Dentro da faixa do paciente
            temas_atuacao: ["Ansiedade", "Estresse", "Depressão", "Relacionamentos"], // Inclui temas do paciente
            abordagens_tecnicas: "Psicanálise", // CORRIGIDO: Agora é uma string única
            genero_identidade: "Feminino", // Corresponde ao gênero preferido do paciente
            praticas_vivencias: ["Feminista", "LGBTQIAPN+ friendly", "Antirracista"], // Inclui práticas do paciente
            status: 'active', // Garante que o perfil seja público e encontrável
            disponibilidade_periodo: ["Manhã", "Tarde", "Noite"],
            bio: "Psicóloga com foco em terapia individual para adultos, oferecendo um espaço de escuta e acolhimento.",
            fotoUrl: "https://images.pexels.com/photos/3769021/pexels-photo-3769021.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1"
        };

        await db.Psychologist.create(psychologistData);
        console.log("Psicólogo de teste criado:", psychologistData.email);

        // --- 3. Criar um segundo Psicólogo (menos compatível) ---
        const psychologist2Data = {
            nome: "Dr. Carlos Terapeuta",
            crp: "06/654321",
            email: "carlos.terapeuta@girassol.com",
            senha: await bcrypt.hash('password123', 10),
            telefone: "11977776666", // CAMPO ADICIONADO
            slug: generateSlug("Dr. Carlos Terapeuta"),
            valor_sessao_numero: 70.00, // Fora da faixa principal do paciente, mas pode ser um "near match"
            temas_atuacao: ["Carreira", "Estresse"], // Apenas um tema em comum
            abordagens_tecnicas: "Terapia Cognitivo-Comportamental", // CORRIGIDO: Agora é uma string única
            genero_identidade: "Masculino", // Não corresponde ao gênero preferido
            praticas_vivencias: [], // Nenhuma prática afirmativa em comum
            disponibilidade_periodo: ["Tarde"],
            bio: "Terapeuta focado em desenvolvimento de carreira e gestão de estresse.",
            fotoUrl: "https://images.pexels.com/photos/3769021/pexels-photo-3769021.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1"
        };

        await db.Psychologist.create(psychologist2Data);
        console.log("Segundo psicólogo de teste criado:", psychologist2Data.email);

        console.log("Dados de teste criados/atualizados com sucesso!");

    } catch (error) {
        console.error("Erro ao popular o banco de dados:", error);
    }
}

module.exports = seedTestData;
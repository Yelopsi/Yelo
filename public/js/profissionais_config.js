/**
 * Arquivo: profissionais_config.js
 * Responsabilidade: Armazenar a estrutura de dados e etapas do questionário de psicólogos.
 */
window.ProfissionaisConfig = {
    getQuestions: () => [
        // Etapa 1: Boas-vindas e Captura de Lead (IMEDIATA)
        { id: 'lead-capture', type: 'lead-capture', question: "Boas-vindas à Yelo, colega.", subtitle: "Para iniciarmos sua triagem de demanda e perfil, informe seus dados básicos de contato.", buttonText: "Avançar", required: true },
        // Etapas de Definição do Nicho
        { id: 'modalidade', type: 'choice', question: "Como você prefere atender, [NOME]?", choices: ["Apenas Online", "Apenas Presencial", "Híbrido (Online e Presencial)"], required: true },
        { id: 'cep', type: 'text', question: "Qual o CEP do seu local de atendimento?", placeholder: "CEP (ex: 12345-678)", required: true, inputMode: 'numeric' },
        { id: 'nicho-intro', type: 'info', question: "Entendendo sua Prática e Especialidades", subtitle: "[NOME], suas respostas aqui são cruciais. Elas definem seu 'nicho de mercado' e nos permitem verificar se há uma demanda ativa de pacientes para o seu perfil." },
        { id: 'genero_identidade', question: "Com qual gênero você se identifica?", type: 'choice', choices: ["Feminino", "Masculino", "Não-binário", "Outro"], required: true },
        { id: 'valor_sessao_faixa', question: "Em qual faixa de preço você pretende atender?", type: 'choice', choices: ["Até R$ 50", "R$ 51 - R$ 90", "R$ 91 - R$ 150", "Acima de R$ 150"], required: true },
        { id: 'temas_atuacao', question: "Quais são seus principais temas de atuação?", type: 'multiple-choice', scrollable: true, choices: ["Ansiedade", "Estresse", "Depressão", "Tristeza", "Relacionamentos", "Carreira", "Trabalho", "Autoestima", "Luto", "Traumas", "TDAH", "Sexualidade", "Autoconhecimento"], required: true },
        { id: 'abordagens_tecnicas', question: "Qual a sua principal abordagem teórica?", type: 'choice', scrollable: true, choices: ["Psicanálise", "Terapia Cognitivo-Comportamental (TCC)", "Humanista // Centrada na Pessoa", "Gestalt-terapia", "Análise do Comportamento (ABA)", "Outra"], required: true },
        { id: 'praticas_afirmativas', question: "Sua prática é afirmativa para quais comunidades ou perspectivas?", type: 'multiple-choice', scrollable: true, choices: ["LGBTQIAPN+ Friendly 🏳️‍🌈", "Faz parte da comunidade LGBTQIAPN+ / Afirmativa", "Pessoa não-branca // Prática Antirracista", "Perspectiva Feminista", "Neurodiversidade (TDAH, Autismo)", "Nenhuma específica"], required: true, buttonText: "Verificar Demanda" },
        // Telas de Resultado Dinâmico
        { id: 'loading', type: 'loading', question: "Analisando a demanda...", subtitle: "Estamos cruzando seus dados com as buscas de nossos pacientes. Só um instante." },
        { id: 'approved', type: 'approved', question: "Ótima notícia, [NOME]!<br>Há uma grande procura por seu perfil." },
        { id: 'waitlisted', type: 'waitlisted', question: "Agradecemos seu interesse na Yelo, [NOME]!", subtitle: "No momento, a busca por profissionais com seu perfil já está bem atendida. Para garantir que todos tenham sucesso, adicionamos seu perfil à lista de espera e te avisaremos no contato informado assim que surgir uma nova oportunidade.", buttonText: "Finalizar" },
        { id: 'error', type: 'error', question: "Oops! Ocorreu um problema.", subtitle: "Não foi possível conectar ao servidor para verificar a demanda. Por favor, tente novamente em alguns instantes.", buttonText: "Tentar Novamente" }
    ]
};
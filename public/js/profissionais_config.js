/**
 * Arquivo: profissionais_config.js
 * Responsabilidade: Armazenar a estrutura de dados e etapas do questionário de psicólogos.
 */
window.ProfissionaisConfig = {
    getQuestions: () => [
        // 0. Boas-vindas e Propósito
        {
            id: 'boas-vindas',
            type: 'welcome',
            question: "Olá, colega! Boas-vindas à Yelo 👋",
            subtitle: "Para conectarmos você aos pacientes ideais, preparamos algumas perguntas rápidas sobre o seu perfil e especialidades.<br><br><b>Por que isso é importante?</b><br>Nós operamos sob demanda controlada. Esse mapeamento garante que sempre exista um equilíbrio perfeito entre a quantidade de pacientes buscando ajuda e o número de psicólogos ativos, garantindo uma prática clínica saudável para você."
        },

        // 1. Início sem atrito (Apenas cliques)
        { id: 'modalidade', type: 'choice', question: "Como você prefere atender, colega?", choices: ["Apenas Online", "Apenas Presencial", "Híbrido (Online e Presencial)"], required: true },

        // 2. CEP com regra condicional
        { id: 'cep', type: 'text', question: "Qual o CEP do seu local de atendimento?", placeholder: "CEP (ex: 12345-678)", required: true, inputMode: 'numeric', condition: "answers.modalidade !== 'Apenas Online'" },

        // 3. Perguntas de engajamento (Mantidas iguais)
        { id: 'nicho-intro', type: 'info', question: "Entendendo sua Prática e Especialidades", subtitle: "Suas respostas aqui são cruciais. Elas definem seu 'nicho de mercado' e nos permitem verificar se há uma demanda ativa de pacientes para o seu perfil." },
        { id: 'genero_identidade', question: "Com qual gênero você se identifica?", type: 'choice', choices: ["Feminino", "Masculino", "Não-binário", "Outro"], required: true },
        { id: 'valor_sessao_faixa', question: "Em qual faixa de preço você pretende atender?", type: 'choice', choices: ["Até R$ 50", "R$ 51 - R$ 90", "R$ 91 - R$ 150", "Acima de R$ 150"], required: true },
        { id: 'temas_atuacao', question: "Quais são seus principais temas de atuação?", type: 'multiple-choice', scrollable: true, choices: ["Ansiedade ou Estresse", "Depressão ou Tristeza", "Relacionamentos", "Carreira e Trabalho", "Autoestima", "Luto ou Traumas", "Sexualidade", "Autoconhecimento", "Outro"], required: true },
        { id: 'abordagens_tecnicas', question: "Qual a sua principal abordagem teórica?", type: 'choice', scrollable: true, choices: ["Psicanálise", "Terapia Cognitivo-Comportamental (TCC)", "Humanista / Centrada na Pessoa", "Gestalt-terapia", "Análise do Comportamento (ABA)", "Outra"], required: true },
        { id: 'praticas_afirmativas', question: "Sua prática é afirmativa para quais comunidades ou perspectivas?", type: 'multiple-choice', scrollable: true, choices: ["LGBTQIAPN+ Friendly 🏳️‍🌈", "Faz parte da comunidade LGBTQIAPN+", "Pessoa não-branca ou prática antirracista", "Perspectiva Feminista", "Especialista em Neurodiversidade (TDAH, Autismo)", "Nenhuma específica"], required: true },

        // 4. Captura de Lead no final da jornada
        { id: 'lead-capture', type: 'lead-capture', question: "Quase lá! Preencha seus dados para ver o resultado", subtitle: "Precisamos apenas de algumas informações básicas para finalizar o cruzamento do seu perfil com a nossa base de pacientes.", buttonText: "Verificar Demanda", required: true },

        // 5. Telas de Resultado (Mantidas iguais)
        { id: 'loading', type: 'loading', question: "Analisando a demanda...", subtitle: "Estamos cruzando seus dados com as buscas de nossos pacientes. Só um instante." },
        {
            id: 'approved',
            type: 'approved',
            question: "Ótima notícia!<br>Há uma grande procura por seu perfil.",
            subtitle: "Nos últimos 30 dias tivemos <b>[X]</b> cliques de contato em perfis similares ao seu e <b>[X]%</b> de taxa de conversão de contatos em pacientes."
        },
        { id: 'waitlisted', type: 'waitlisted', question: "Agradecemos seu interesse na Yelo!", subtitle: "No momento, a busca por profissionais com seu perfil já está bem atendida. Para garantir que todos tenham sucesso, adicionamos seu perfil à lista de espera e te avisaremos no contato informado assim que surgir uma nova oportunidade.", buttonText: "Finalizar" },
        { id: 'error', type: 'error', question: "Oops! Ocorreu um problema.", subtitle: "Não foi possível conectar ao servidor para verificar a demanda. Por favor, tente novamente em alguns instantes.", buttonText: "Tentar Novamente" }
    ]
};
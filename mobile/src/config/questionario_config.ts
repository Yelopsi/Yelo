export type QuestionType = 'choice' | 'multiple-choice' | 'text' | 'final' | 'error';

export interface QuestionData {
  id: string;
  question: string;
  subtitle?: string;
  type: QuestionType;
  choices?: string[];
  required?: boolean;
  placeholder?: string;
  inputMode?: 'text' | 'numeric' | 'email' | 'tel';
  buttonText?: string;
  scrollable?: boolean;
}

export const patientQuestions: QuestionData[] = [
  {
    id: 'idade',
    question: "Para começarmos, qual a sua faixa etária?",
    type: 'choice',
    choices: ["Menor de 18 anos", "18-24 anos", "25-34 anos", "35-44 anos", "45-54 anos", "55+ anos"],
    required: true
  },
  {
    id: 'responsavel_menor',
    question: "Você é o responsável legal por este paciente?",
    subtitle: "Atendimentos para menores de idade exigem o acompanhamento ou autorização de um responsável (pai, mãe ou tutor legal).",
    type: 'choice',
    choices: ["Sim, sou o responsável legal", "Não, sou o próprio menor"],
    required: true
  },
  {
    id: 'pref_genero_prof',
    question: "Você tem preferência pelo gênero do(a) profissional?",
    subtitle: "Sua segurança e conforto são a nossa prioridade.",
    type: 'choice',
    choices: ["Indiferente", "Masculino", "Feminino", "Não-binário"],
    required: true
  },
  {
    id: 'temas',
    question: "O que te motivou a procurar terapia agora?",
    subtitle: "Selecione os temas que você gostaria de explorar.",
    type: 'multiple-choice',
    scrollable: true,
    choices: ["Ansiedade ou Estresse", "Depressão ou Tristeza", "Relacionamentos", "Carreira e Trabalho", "Autoestima", "Luto ou Traumas", "Autoconhecimento", "Outro"],
    required: true
  },
  {
    id: 'caracteristicas_prof',
    question: "Existem características importantes para você no profissional?",
    subtitle: "A identidade de quem te escuta pode fazer diferença.",
    type: 'multiple-choice',
    choices: ["LGBTQIAPN+ Friendly 🏳️‍🌈", "Que faça parte da comunidade LGBTQIAPN+", "Pessoa não-branca ou com prática antirracista", "Que tenha uma perspectiva feminista", "Especialista em Neurodiversidade (TDAH, Autismo)", "Indiferente"],
    required: true
  },
  {
    id: 'faixa_valor',
    question: "Qual a faixa de valor que você pode investir por sessão?",
    subtitle: "Para conectarmos você a profissionais dentro do seu orçamento.",
    type: 'choice',
    choices: ["Até R$ 50", "R$ 51 - R$ 90", "R$ 91 - R$ 150", "Acima de R$ 150"],
    required: true
  },
  {
    id: 'modalidade_atendimento',
    question: "Como você prefere ser atendido(a)?",
    type: 'choice',
    choices: ["Online", "Presencial", "Indiferente (Online ou Presencial)"],
    required: true
  },
  {
    id: 'cep',
    question: "Qual o seu CEP?",
    subtitle: "Para encontrarmos profissionais perto de você.",
    type: 'text',
    placeholder: "00000-000",
    required: true,
    inputMode: 'numeric'
  },
  {
    id: 'nome',
    question: "Para finalizar, como podemos te chamar? (Opcional)",
    subtitle: "Isso nos ajuda a entregar uma experiência personalizada para você.",
    type: 'text',
    placeholder: "Digite o seu nome ou apelido",
    required: false
  },
  {
    id: 'final',
    type: 'final',
    question: "Tudo pronto, [NOME]!",
    subtitle: "Estamos cruzando as suas respostas para encontrar as conexões mais significativas. Em instantes, você verá as suas recomendações."
  },
  {
    id: 'erro-idade',
    type: 'error',
    question: "Atenção",
    subtitle: "A plataforma Yelo é destinada apenas para maiores de 18 anos...",
    buttonText: "Entendi e Sair"
  }
];

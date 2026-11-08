export type QuestionType = 'choice' | 'multiple-choice' | 'text' | 'final' | 'error' | 'abordagem';

export interface AbordagemOption {
  title: string;
  description: string;
  value: string[];
}

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
    subtitle: "Precisamos saber sua idade para garantir que a sua experiência seja a mais adequada e segura para o seu momento de vida.",
    type: 'choice',
    choices: ["Menor de 18 anos", "18-24 anos", "25-34 anos", "35-44 anos", "45-54 anos", "55+ anos"],
    required: true
  },
  {
    id: 'responsavel_menor',
    question: "Você é o responsável legal por este paciente?",
    subtitle: "Para cuidarmos de você da melhor forma, o atendimento de menores requer o acompanhamento ou autorização de um adulto responsável.",
    type: 'choice',
    choices: ["Sim, sou o responsável legal", "Não, sou o próprio menor"],
    required: true
  },
  {
    id: 'pref_genero_prof',
    question: "Você tem preferência pelo gênero do(a) profissional?",
    subtitle: "Queremos que você se sinta em um ambiente totalmente seguro e à vontade. Escolha o que te deixa mais confortável.",
    type: 'choice',
    choices: ["Indiferente", "Masculino", "Feminino", "Não-binário"],
    required: true
  },
  {
    id: 'temas',
    question: "O que te motivou a procurar terapia agora?",
    subtitle: "Entender o que te traz aqui nos ajuda a encontrar o(a) profissional com a experiência certa para te apoiar neste momento.",
    type: 'choice',
    choices: [
      "Ansiedade, Estresse ou Tristeza",
      "Amor, Relacionamentos e Sexualidade",
      "Autoconhecimento e Autoestima",
      "Carreira e Trabalho",
      "Luto ou Traumas",
      "Outro"
    ],
    required: true
  },
  {
    id: 'abordagem_ideal',
    question: "Pensando nisso...",
    subtitle: "Cada pessoa se adapta melhor a um estilo de terapia. Vamos descobrir qual jeito de conduzir a sessão mais combina com você.",
    type: 'abordagem',
    required: true
  },
  {
    id: 'caracteristicas_prof',
    question: "Existem características importantes para você no profissional?",
    subtitle: "Sabemos que a identificação com o profissional é fundamental para criar um espaço de confiança e empatia.",
    type: 'multiple-choice',
    choices: [
      "LGBTQIAPN+ Friendly 🏳️‍🌈",
      "Faz parte da comunidade LGBTQIAPN+",
      "Pessoa não-branca ou prática antirracista",
      "Perspectiva Feminista",
      "Especialista em Neurodiversidade (TDAH, Autismo)",
      "Indiferente"
    ],
    required: true
  },
  {
    id: 'faixa_valor',
    question: "Qual a faixa de valor que você pode investir por sessão?",
    subtitle: "Acreditamos que o cuidado com a saúde mental deve caber no seu bolso. Vamos focar em opções dentro da sua realidade.",
    type: 'choice',
    choices: ["Até R$ 50", "R$ 51 - R$ 90", "R$ 91 - R$ 150", "Acima de R$ 150"],
    required: true
  },
  {
    id: 'modalidade_atendimento',
    question: "Como você prefere ser atendido(a)?",
    subtitle: "Você pode escolher o conforto da sua casa ou o ambiente acolhedor do consultório. O que funciona melhor para você?",
    type: 'choice',
    choices: ["Online", "Presencial", "Indiferente (Online ou Presencial)"],
    required: true
  },
  {
    id: 'cep',
    question: "Qual o seu CEP?",
    subtitle: "Usaremos essa informação com todo o cuidado apenas para sugerir profissionais pertinho de você.",
    type: 'text',
    placeholder: "00000-000",
    required: true,
    inputMode: 'numeric'
  },
  {
    id: 'final',
    type: 'final',
    question: "Tudo pronto!",
    subtitle: "Nossa inteligência está analisando com carinho as suas respostas. Em instantes, apresentaremos as melhores conexões para você."
  },
  {
    id: 'erro-idade',
    type: 'error',
    question: "Atenção",
    subtitle: "A plataforma Yelo é destinada apenas para maiores de 18 anos ou menores acompanhados de um responsável legal.",
    buttonText: "Entendi e Sair"
  }
];

export function getAbordagemConfig(tema?: string | string[]): {
  question: string;
  subtitle: string;
  options: AbordagemOption[];
} {
  const temasSelecionados = Array.isArray(tema) ? tema : (tema ? [tema] : []);
  const temasSintomas = ["Ansiedade, Estresse ou Tristeza", "Luto ou Traumas"];
  const temasRelacionais = ["Amor, Relacionamentos e Sexualidade"];

  let categoria = "desenvolvimento";
  if (temasSelecionados.length === 1 && temasSelecionados[0] === "Outro") {
    categoria = "outro";
  } else if (temasSelecionados.some(t => temasSintomas.includes(t))) {
    categoria = "sintomas";
  } else if (temasSelecionados.some(t => temasRelacionais.includes(t))) {
    categoria = "relacional";
  }

  const valTCC = [
    "Terapia Cognitivo-Comportamental (TCC)",
    "Análise do Comportamento",
    "ACT - Terapia de Aceitação e Compromisso"
  ];
  const valPsi = ["Psicanálise", "Jungiana"];
  const valPsiOnly = ["Psicanálise"];
  const valHum = ["Humanista", "Gestalt-terapia"];
  const valSis = ["Sistêmica", "Psicologia Histórico-Cultural"];
  const valIndiferente = ["Indiferente"];

  if (categoria === "sintomas") {
    return {
      question: "Lidando com essas questões, como o terapeuta poderia te ajudar melhor?",
      subtitle: "Cada pessoa se adapta melhor a um estilo de terapia. Escolha o que mais faz sentido para o seu momento.",
      options: [
        {
          title: "Foco Prático",
          description: "Quero ferramentas e exercícios para mudar meus hábitos no dia a dia.",
          value: valTCC
        },
        {
          title: "Foco Profundo",
          description: "Quero um espaço livre para investigar a raiz dos meus problemas.",
          value: valPsiOnly
        },
        {
          title: "Acolhimento",
          description: "Quero focar em entender e aceitar meus sentimentos no presente.",
          value: valHum
        },
        {
          title: "Foco no Ambiente",
          description: "Quero entender como as pessoas ao meu redor influenciam o que sinto.",
          value: valSis
        },
        {
          title: "Não sei escolher",
          description: "Pode me recomendar a melhor opção",
          value: valIndiferente
        }
      ]
    };
  } else if (categoria === "relacional") {
    return {
      question: "Ao focar nas suas relações e intimidade, qual dinâmica de terapia te atrai mais?",
      subtitle: "Cada pessoa se adapta melhor a um estilo de terapia. Escolha o que mais faz sentido para o seu momento.",
      options: [
        {
          title: "Dinâmica Familiar",
          description: "Quero entender como a minha família molda meus relacionamentos.",
          value: valSis
        },
        {
          title: "Explorar o Passado",
          description: "Quero entender de onde vêm os meus padrões de relacionamento.",
          value: valPsi
        },
        {
          title: "Estratégias",
          description: "Gostaria de dicas diretas para me comunicar melhor e mudar atitudes.",
          value: valTCC
        },
        {
          title: "Expressão Autêntica",
          description: "Quero focar na forma como eu me sinto e me expresso na relação agora.",
          value: valHum
        },
        {
          title: "Não sei escolher",
          description: "Pode me recomendar a melhor opção",
          value: valIndiferente
        }
      ]
    };
  } else if (categoria === "outro") {
    return {
      question: "Independentemente do motivo que te trouxe aqui, como você prefere conduzir a sessão?",
      subtitle: "Cada pessoa se adapta melhor a um estilo de terapia. Escolha o que mais faz sentido para o seu momento.",
      options: [
        {
          title: "Foco Prático",
          description: "Quero ferramentas e exercícios para mudar meus hábitos no dia a dia.",
          value: valTCC
        },
        {
          title: "Foco Profundo",
          description: "Gosto da ideia de investigar a raiz das questões e o meu inconsciente.",
          value: valPsi
        },
        {
          title: "Acolhimento",
          description: "Quero um espaço focado na minha autoaceitação livre de julgamentos.",
          value: valHum
        },
        {
          title: "Foco no Ambiente",
          description: "Quero entender como o meu convívio social influencia quem eu sou.",
          value: valSis
        },
        {
          title: "Não sei escolher",
          description: "Pode me recomendar a melhor opção",
          value: valIndiferente
        }
      ]
    };
  } else {
    return {
      question: "Buscando desenvolvimento pessoal, como você prefere conduzir a sessão?",
      subtitle: "Cada pessoa se adapta melhor a um estilo de terapia. Escolha o que mais faz sentido para o seu momento.",
      options: [
        {
          title: "Metas Claras",
          description: "Quero descobrir quais hábitos me travam e agir para mudá-los.",
          value: valTCC
        },
        {
          title: "Mergulho Interior",
          description: "Gosto da ideia de analisar meus sonhos e o meu inconsciente.",
          value: valPsi
        },
        {
          title: "Potencial Humano",
          description: "Quero focar na minha autoaceitação livre de julgamentos.",
          value: valHum
        },
        {
          title: "Padrões Sociais",
          description: "Quero entender as expectativas que a sociedade colocou em mim.",
          value: valSis
        },
        {
          title: "Não sei escolher",
          description: "Pode me recomendar a melhor opção",
          value: valIndiferente
        }
      ]
    };
  }
}

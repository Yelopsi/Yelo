const db = require('./backend/models');

async function seed() {
    try {
        console.log('Fetching a psychologist...');
        const psi = await db.Psychologist.findOne();
        if (!psi) {
            console.error('No psychologists found in DB!');
            process.exit(1);
        }

        const categories = [
            "Discussão de Casos (Intervisão)",
            "Burocracia e Legislação (CRP/CFP)",
            "Indicações e Encaminhamentos",
            "Ferramentas e Referências",
            "Marketing e Carreira",
            "Sala de Café (Off-topic)"
        ];

        const posts = [
            {
                title: 'Dúvida sobre contrato terapêutico para adolescentes',
                content: 'Olá pessoal, estou com uma dúvida sobre como estruturar o contrato terapêutico com os pais de um adolescente de 15 anos. Vocês costumam deixar claro o limite do sigilo logo na primeira sessão? Até que ponto compartilham o que é discutido?',
                category: categories[1],
                votes: 45,
                isAnonymous: false,
                PsychologistId: psi.id
            },
            {
                title: 'Paciente com resistência extrema à intervenção',
                content: 'Estou atendendo um paciente há 4 meses (TCC) e sinto que não avançamos. Toda tentativa de reestruturação cognitiva é rebatida com cinismo. Ele não falta e paga em dia, mas não sai do lugar. Dicas?',
                category: categories[0],
                votes: 32,
                isAnonymous: true,
                PsychologistId: psi.id
            },
            {
                title: 'Indicação: Psiquiatra de confiança em São Paulo (Capital)',
                content: 'Alguém tem contato de um psiquiatra bom em SP que tenha um olhar mais integrativo e não foque apenas em medicalização rápida? Preciso encaminhar um caso de TAG severa.',
                category: categories[2],
                votes: 18,
                isAnonymous: false,
                PsychologistId: psi.id
            },
            {
                title: 'Quais ferramentas de gestão vocês recomendam?',
                content: 'Atualmente uso planilha do Excel para controlar pagamentos e agendamentos, mas está ficando insustentável. Vale a pena assinar um software de gestão para consultório? Qual vocês indicam?',
                category: categories[3],
                votes: 89,
                isAnonymous: false,
                PsychologistId: psi.id
            },
            {
                title: 'Como vocês lidam com a produção de conteúdo no Instagram?',
                content: 'Odeio fazer dancinha ou posts genéricos, mas sinto que estou ficando para trás. Como vocês conseguem captar pacientes pela internet mantendo a postura clínica?',
                category: categories[4],
                votes: 112,
                isAnonymous: false,
                PsychologistId: psi.id
            },
            {
                title: 'Dica de série que ilustra bem narcisismo',
                content: 'Pessoal, assistam "Succession". É uma aula magistral sobre famílias disfuncionais, traços narcisistas e trauma intergeracional. Alguém mais acompanhou?',
                category: categories[5],
                votes: 67,
                isAnonymous: false,
                PsychologistId: psi.id
            },
            {
                title: 'Anotações em sessão: papel, tablet ou computador?',
                content: 'Sempre fui do papel e caneta, mas a quantidade de cadernos acumulados está absurda. Tentei digitar mas sinto que perco o rapport. Como vocês fazem?',
                category: categories[3],
                votes: 24,
                isAnonymous: false,
                PsychologistId: psi.id
            },
            {
                title: 'Encaminhamento para Neurologista Infantil',
                content: 'Preciso de indicações de neuro pediatra focado em TEA que atenda por telemedicina. De preferência alguém com agenda não tão lotada.',
                category: categories[2],
                votes: 12,
                isAnonymous: false,
                PsychologistId: psi.id
            },
            {
                title: 'Cobrança de falta: regras rígidas ou flexibilidade?',
                content: 'Até hoje eu perdoava faltas justificadas, mas estou tendo um prejuízo enorme com isso. Pensando em passar a cobrar a sessão integral se não avisar com 24h. Isso espanta pacientes?',
                category: categories[4],
                votes: 156,
                isAnonymous: false,
                PsychologistId: psi.id
            },
            {
                title: 'Abordando o luto animal no consultório',
                content: 'Tenho percebido um aumento enorme de demandas de luto pela perda de pets, e muitas vezes o paciente sente vergonha de sofrer tanto. Quais leituras vocês indicam sobre esse tema?',
                category: categories[0],
                votes: 41,
                isAnonymous: false,
                PsychologistId: psi.id
            }
        ];

        console.log('Inserting posts...');
        await db.ForumPost.bulkCreate(posts);
        console.log('Successfully inserted 10 posts!');
        process.exit(0);
    } catch (err) {
        console.error('Error seeding posts:', err);
        process.exit(1);
    }
}

seed();

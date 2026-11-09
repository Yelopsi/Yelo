/**
 * ARQUIVO: psi_guia_contextual.js
 * INSPIRAÇÃO: Airbnb (hospitalidade, modais fluidos, cápsulas e acolhimento) + Notion (callouts, clareza editorial)
 * RESPONSABILIDADE: Prover micro-guias e explicações contextuais para TODAS as telas do painel do psicólogo.
 */
(function() {
    // 1. BANCO DE CONTEÚDO CONTEXTUAL (AIRBNB + NOTION STYLE)
    const GUIAS_POR_TELA = {
        'psi_visao_geral.html': {
            icone: '📊',
            titulo: 'Visão Geral & Métricas do Consultório',
            subtitulo: 'Acompanhe em tempo real a procura pelo seu consultório e a resposta de novos pacientes.',
            proposito: {
                titulo: 'Por que esta tela existe?',
                texto: 'Esta é a central de comando da sua clínica. Ela existe para você visualizar com clareza o volume real de pessoas que encontram seu perfil e avançam para o seu WhatsApp, tirando você do escuro e mostrando a resposta do mercado à sua apresentação.'
            },
            dicas: [
                'Acompanhe a relação entre visitas e cliques: se muitas pessoas entram na sua vitrine mas poucas clicam no WhatsApp, vale revisar sua foto e biografia para torná-las mais acolhedoras.',
                'Atenda aos contatos recebidos com presteza: responder nos primeiros 15 minutos acolhe o paciente no momento exato em que ele reuniu coragem para pedir ajuda.'
            ],
            algoritmo: 'O algoritmo monitora sua velocidade média de retorno no WhatsApp e a taxa de feedback pós-contato. Perfis ágeis e atenciosos ganham destaque contínuo no questionário de triagem.'
        },

        'psi_pacientes.html': {
            icone: '👥',
            titulo: 'Meus Pacientes & Prontuários Clínicos',
            subtitulo: 'Gestão clínica confidencial, sem papéis e em estrita conformidade com o CFP.',
            proposito: {
                titulo: 'Por que esta tela existe?',
                texto: 'Prontuários em papel ou anotações dispersas trazem risco ético, perda de histórico e vulnerabilidade jurídica. Esta tela existe para oferecer um ambiente protegido por criptografia ponta a ponta, onde você registra evoluções de sessão com total sigilo e atende às exigências do CFP e da LGPD.'
            },
            dicas: [
                'Registre a evolução logo após o término de cada sessão: anotações imediatas capturam nuances do discurso do paciente e mantêm sua rotina clínica sempre em dia.',
                'Utilize os status clínicos (Em Tratamento, Em Pausa, Alta Terapêutica) para mensurar com precisão quantos horários vagos você tem disponíveis na semana.'
            ],
            algoritmo: 'Ao manter sua capacidade de atendimento organizada, você evita sobrecarga e permite que o sistema direcione novos pacientes apenas quando você realmente tiver disponibilidade para acolhê-los.'
        },

        'psi_financeiro.html': {
            icone: '💰',
            titulo: 'Gestão Financeira & Honorários Particulares',
            subtitulo: 'Controle suas receitas com 100% dos seus honorários diretamente no seu bolso.',
            proposito: {
                titulo: 'Por que esta tela existe?',
                texto: 'Muitos psicólogos sofrem com inadimplência ou perdem o controle do que receberam no Pix. Esta tela existe para que você acompanhe sessões pagas, mensalidades e previsões financeiras sem intermediários — lembrando que a Yelo não cobra nenhuma porcentagem sobre suas consultas.'
            },
            dicas: [
                'Alinhe a forma de pagamento (por sessão avulsa ou pacote mensal pré-pago) já na primeira sessão de acolhimento para evitar desencontros financeiros.',
                'Registre os recebimentos do Pix imediatamente após o paciente pagar para manter seu fluxo de caixa mensal sempre consolidado.'
            ],
            algoritmo: 'A clareza financeira permite que você mantenha sua agenda estável e aberta a longo prazo, sinalizando consistência para o ecossistema de captação da Yelo.'
        },

        'psi_calculadora_honorarios.html': {
            icone: '🧮',
            titulo: 'Calculadora de Honorários Clínicos',
            subtitulo: 'Precificação justa e sustentável, sem trabalhar até a exaustão.',
            proposito: {
                titulo: 'Por que esta tela existe?',
                texto: 'A maioria dos psicólogos cobra "o que acha que o mercado paga" e termina o mês trabalhando 30 horas semanais sem conseguir cobrir os custos com folga. Esta ferramenta calcula matematicamente o valor ideal da sua sessão considerando custos fixos, supervisão, impostos, férias remuneradas e sua meta de remuneração líquida.'
            },
            dicas: [
                'Lembre-se de que a sua hora clínica não paga apenas os 50 minutos de sessão, mas também suas horas de estudo de caso, supervisão e descanso indispensável.',
                'Não caia no erro de baixar seu preço por insegurança: na Yelo, os pacientes buscam acolhimento profissional qualificado e segurança ética, não leilão de consultas baratas.'
            ],
            algoritmo: 'O algoritmo cruza a sua faixa de honorários cadastrada com o orçamento informado pelo paciente na triagem, garantindo que cheguem até você pessoas preparadas para pagar pelo seu valor.'
        },

        'psi_blog.html': {
            icone: '✍️',
            titulo: 'Meus Artigos & Presença no Google',
            subtitulo: 'Construa autoridade duradoura no Google sem depender de redes sociais efêmeras.',
            proposito: {
                titulo: 'Por que esta tela existe?',
                texto: 'Postagens em redes sociais duram apenas 24 horas e exigem exposição excessiva. Esta tela existe para você publicar artigos educativos e reflexões clínicas no Blog oficial da Yelo, que permanecem indexados no Google por meses e anos, atraindo pacientes que buscam ajuda para problemas específicos.'
            },
            dicas: [
                'Escreva com foco na dor do leigo: responda às perguntas reais que você mais ouve na clínica (ex: "Como saber se minha ansiedade passou dos limites?").',
                'Use títulos claros e acolhedores em vez de termos técnicos complicados para facilitar que pessoas em sofrimento encontrem seu texto nas buscas.'
            ],
            algoritmo: 'Psicólogos que produzem artigos com regularidade recebem pontuação destacada de autoridade no ecossistema, aumentando a frequência com que o perfil é recomendado nas buscas orgânicas da plataforma.'
        },

        'psi_forum.html': {
            icone: '💬',
            titulo: 'Fórum Clínico & Intervisão entre Pares',
            subtitulo: 'Uma comunidade segura e exclusiva para romper o isolamento do consultório particular.',
            proposito: {
                titulo: 'Por que esta tela existe?',
                texto: 'A prática clínica autônoma pode ser solitária e desafiadora. Esta tela existe para conectar você a outros psicólogos verificados, criando um espaço protegido para discussão de casos clínicos (sob rigoroso sigilo ético), troca de artigos e encaminhamentos mútuos.'
            },
            dicas: [
                'Proteja sempre o sigilo dos seus pacientes ao debater vinhetas clínicas (altere dados biográficos, idades e detalhes identificáveis).',
                'Interaja nos tópicos de colegas de outras abordagens: criar essa rede de apoio é a melhor forma de receber indicações de pacientes que não se encaixam no nicho deles.'
            ],
            algoritmo: 'A participação ativa no fórum demonstra comprometimento profissional com a comunidade e eleva o seu índice de engajamento no ranking ético da Yelo.'
        },

        'psi_meu_perfil.html': {
            icone: '⚙️',
            titulo: 'Minha Vitrine & Configurações do Consultório',
            subtitulo: 'Sua apresentação profissional para o mundo, desenhada para inspirar confiança.',
            proposito: {
                titulo: 'Por que esta tela existe?',
                texto: 'O seu perfil é a primeira coisa que um paciente em sofrimento vê antes de decidir te procurar. Esta tela existe para você calibrar sua apresentação: foto profissional, número de CRP ativo, abordagens terapêuticas, temas atendidos e conexão com suas avaliações do Google Maps.'
            },
            dicas: [
                'Adote uma fotografia com luz natural, olhar direto e expressão acolhedora: ela quebra a barreira do medo e gera 3,8x mais cliques no WhatsApp.',
                'Escreva sua biografia pensando no sofrimento de quem lê: explique com sensibilidade como seu acompanhamento ajuda a aliviar as angústias do paciente.'
            ],
            algoritmo: 'Perfis com Saúde em 100% e ficha do Google Meu Negócio conectada têm prioridade máxima de exibição no questionário de triagem da plataforma.'
        },

        'psi_historico_contatos.html': {
            icone: '📱',
            titulo: 'Contatos Recebidos & Retroalimentação do Algoritmo',
            subtitulo: 'Acompanhe quem demonstrou interesse e ensine o sistema a refinar seus pacientes.',
            proposito: {
                titulo: 'Por que esta tela existe?',
                texto: 'Esta tela registra cada paciente que clicou para falar no seu WhatsApp a partir da Yelo. Ela existe para dar a você controle total sobre as solicitações de atendimento e permitir que você dê o retorno confidencial sobre o desfecho de cada contato.'
            },
            dicas: [
                'Responda à pergunta de feedback pós-contato: sinalizar se o paciente agendou ou se desistiu leva apenas 5 segundos e refina todo o seu fluxo futuro.',
                'Utilize os roteiros do Manual de Acolhimento para manter uma comunicação empática e ética desde a primeira mensagem trocada.'
            ],
            algoritmo: 'Este é o ponto mais crucial da inteligência da Yelo. Quando você confirma um agendamento, o algoritmo aprende as características daquele paciente e passa a priorizar casos semelhantes para você.'
        },

        'psi_manual_conversao.html': {
            icone: '📘',
            titulo: 'Manual de Acolhimento no WhatsApp',
            subtitulo: 'Roteiros práticos e postura ética para transformar o primeiro contato em vínculo.',
            proposito: {
                titulo: 'Por que esta tela existe?',
                texto: 'O primeiro "olá" de um paciente na internet é repleto de medo e hesitação. Esta tela existe para oferecer roteiros prontos e orientações éticas sobre como responder com acolhimento, desmistificar o processo terapêutico e apresentar seus honorários com tranquilidade.'
            },
            dicas: [
                'Priorize a escuta atenta antes de enviar qualquer valor: um acolhimento breve à queixa do paciente faz com que ele se sinta cuidado, e não vendido.',
                'Ofereça opções claras de dias e horários (ex: "Tenho disponível terça às 14h ou quinta às 18h") para reduzir o esforço cognitivo de quem já está sobrecarregado.'
            ],
            algoritmo: 'Psicólogos que conduzem um acolhimento inicial empático convertem muito mais contatos em sessões contínuas, retroalimentando o algoritmo de forma positiva.'
        },

        'psi_assinatura.html': {
            icone: '⭐',
            titulo: 'Minha Assinatura & Planos Yelo',
            subtitulo: 'Transparência absoluta: assinatura fixa, sem surpresas e com 100% dos honorários seus.',
            proposito: {
                titulo: 'Por que esta tela existe?',
                texto: 'Esta tela existe para que você gerencie sua conta na Yelo com total autonomia. Ao contrário de plataformas tradicionais que cobram comissões por consulta e retêm seu dinheiro, a Yelo opera por assinatura fixa: todo o valor pago pelos seus pacientes vai direto para a sua conta bancária.'
            },
            dicas: [
                'Mantenha seu método de pagamento regularizado para assegurar que seu perfil permaneça indexado e visível 24 horas por dia nas buscas.',
                'Qualquer dúvida sobre cobranças ou alteração de planos pode ser tratada diretamente com o nosso suporte humanizado no WhatsApp.'
            ],
            algoritmo: 'Perfis com assinatura ativa mantêm sua presença ininterrupta no ar, garantindo que o algoritmo continue direcionando pacientes sem pausas de indexação.'
        }
    };

    // 2. INJEÇÃO DOS ESTILOS CSS (AIRBNB + NOTION)
    const estiloCSS = `
        /* --- BOTÃO COMO FUNCIONA (ESTILO CÁPSULA AIRBNB) --- */
        .yelo-btn-como-funciona {
            background: rgba(255, 255, 255, 0.95);
            border: 1.5px solid #cbd5e1;
            border-radius: 50px;
            padding: 8px 18px;
            font-size: 0.88rem;
            font-weight: 700;
            color: var(--verde-escuro, #1B4332);
            display: inline-flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            user-select: none;
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
        }
        .yelo-btn-como-funciona:hover {
            background: #ffffff;
            border-color: var(--verde-escuro, #1B4332);
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(27, 67, 50, 0.12);
        }
        .yelo-btn-como-funciona:active {
            transform: scale(0.97);
        }
        .yelo-cf-icon {
            font-size: 1.05rem;
            line-height: 1;
        }

        /* --- NOTION-STYLE INLINE CALLOUT (DISCRETO) --- */
        .yelo-notion-inline-callout {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-left: 4px solid var(--verde-escuro, #1B4332);
            border-radius: 14px;
            padding: 12px 18px;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 14px;
            font-size: 0.88rem;
            color: #334155;
            box-shadow: 0 1px 3px rgba(0,0,0,0.02);
            animation: yeloFadeIn 0.3s ease forwards;
        }
        .yelo-notion-callout-content {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-grow: 1;
            line-height: 1.45;
        }
        .yelo-notion-callout-link {
            color: var(--verde-escuro, #1B4332);
            font-weight: 700;
            cursor: pointer;
            text-decoration: underline;
            white-space: nowrap;
        }
        .yelo-notion-callout-close {
            background: transparent;
            border: none;
            color: #94a3b8;
            font-size: 1.1rem;
            cursor: pointer;
            padding: 2px 6px;
            line-height: 1;
            transition: color 0.2s;
        }
        .yelo-notion-callout-close:hover {
            color: #1e293b;
        }

        /* --- OVERLAY DO SHEET/MODAL (AIRBNB STYLE BACKDROP) --- */
        .yelo-guia-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(15, 23, 42, 0.48);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            z-index: 100050;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .yelo-guia-overlay.ativo {
            opacity: 1;
            pointer-events: auto;
        }

        /* --- CONTAINER DO BOTTOM SHEET (MOBILE) / MODAL (DESKTOP) --- */
        .yelo-guia-container {
            background: #ffffff;
            width: 100%;
            max-width: 660px;
            border-radius: 28px 28px 0 0;
            padding: 16px 28px 36px 28px;
            box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.15);
            max-height: 88vh;
            overflow-y: auto;
            transform: translateY(100%);
            transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
            position: relative;
            box-sizing: border-box;
            font-family: var(--font-principal, 'Inter', sans-serif);
        }
        .yelo-guia-overlay.ativo .yelo-guia-container {
            transform: translateY(0);
        }

        @media (min-width: 768px) {
            .yelo-guia-overlay {
                align-items: center;
                padding: 20px;
            }
            .yelo-guia-container {
                border-radius: 24px;
                transform: scale(0.95) translateY(15px);
                max-height: 85vh;
                box-shadow: 0 25px 60px -15px rgba(27, 67, 50, 0.3);
            }
            .yelo-guia-overlay.ativo .yelo-guia-container {
                transform: scale(1) translateY(0);
            }
        }

        /* Puxador tátil mobile */
        .yelo-guia-drag-handle {
            width: 44px;
            height: 5px;
            background: #cbd5e1;
            border-radius: 10px;
            margin: 0 auto 18px auto;
        }

        /* Topo do Guia */
        .yelo-guia-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 20px;
            padding-bottom: 16px;
            border-bottom: 1px solid #f1f5f9;
        }
        .yelo-guia-title-box {
            display: flex;
            align-items: center;
            gap: 14px;
        }
        .yelo-guia-avatar {
            width: 52px;
            height: 52px;
            border-radius: 16px;
            background: linear-gradient(135deg, #e8f5e9 0%, #d1f3d1 100%);
            color: #1B4332;
            font-size: 1.6rem;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            box-shadow: 0 4px 12px rgba(27,67,50,0.1);
        }
        .yelo-guia-title {
            font-family: var(--font-titulos, 'New Kansas', serif);
            font-size: 1.5rem;
            color: var(--verde-escuro, #1B4332);
            margin: 0 0 4px 0;
            line-height: 1.25;
            font-weight: 700;
        }
        .yelo-guia-sub {
            margin: 0;
            font-size: 0.9rem;
            color: #64748b;
            line-height: 1.45;
        }
        .yelo-guia-close-btn {
            background: #f1f5f9;
            border: none;
            width: 34px;
            height: 34px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1rem;
            color: #64748b;
            cursor: pointer;
            transition: all 0.2s;
            flex-shrink: 0;
        }
        .yelo-guia-close-btn:hover {
            background: #e2e8f0;
            color: #0f172a;
        }

        /* --- NOTION-STYLE CALLOUT BLOCKS (BLOCO 1, 2, 3) --- */
        .yelo-callouts-stack {
            display: flex;
            flex-direction: column;
            gap: 14px;
            margin-bottom: 24px;
        }
        .yelo-notion-block {
            border-radius: 16px;
            padding: 16px 18px;
            display: flex;
            align-items: flex-start;
            gap: 14px;
            transition: transform 0.2s;
        }
        .yelo-notion-block.neutral {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
        }
        .yelo-notion-block.gold {
            background: #fefce8;
            border: 1px solid #fef08a;
        }
        .yelo-notion-block.green {
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
        }
        .yelo-notion-icon {
            font-size: 1.3rem;
            line-height: 1;
            flex-shrink: 0;
            margin-top: 2px;
        }
        .yelo-notion-body h4 {
            margin: 0 0 4px 0;
            font-size: 0.98rem;
            font-weight: 800;
        }
        .yelo-notion-block.neutral h4 { color: #1e293b; }
        .yelo-notion-block.green h4 { color: #166534; }
        .yelo-notion-block.gold h4 { color: #854d0e; }
        
        .yelo-notion-body p {
            margin: 0;
            font-size: 0.88rem;
            line-height: 1.5;
            color: #475569;
        }
        .yelo-notion-body ul {
            margin: 4px 0 0 0;
            padding-left: 18px;
            font-size: 0.88rem;
            color: #475569;
            line-height: 1.5;
        }
        .yelo-notion-body li {
            margin-bottom: 4px;
        }

        /* Ações do Rodapé do Guia */
        .yelo-guia-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 12px;
            padding-top: 16px;
            border-top: 1px solid #f1f5f9;
        }
        .yelo-btn-entendi {
            background: var(--verde-escuro, #1B4332);
            color: #ffffff;
            border: none;
            padding: 12px 28px;
            border-radius: 50px;
            font-size: 0.94rem;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 4px 14px rgba(27,67,50,0.22);
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }
        .yelo-btn-entendi:hover {
            background: #2D6A4F;
            transform: translateY(-2px);
        }
        .yelo-btn-ver-tudo {
            background: transparent;
            border: none;
            color: #64748b;
            font-size: 0.88rem;
            font-weight: 600;
            cursor: pointer;
            text-decoration: underline;
            padding: 8px 12px;
        }
        .yelo-btn-ver-tudo:hover {
            color: var(--verde-escuro, #1B4332);
        }

        @keyframes yeloFadeIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
        }
    `;

    // 3. INSERE ESTILOS NO DOCUMENTO
    const styleTag = document.createElement('style');
    styleTag.id = 'yelo-guia-contextual-styles';
    styleTag.innerHTML = estiloCSS;
    document.head.appendChild(styleTag);

    // 4. CRIA ESTRUTURA DO MODAL / BOTTOM SHEET (AIRBNB STYLE)
    let overlayEl = null;

    function criarEstruturaModal() {
        if (overlayEl) return;
        overlayEl = document.createElement('div');
        overlayEl.className = 'yelo-guia-overlay';
        overlayEl.id = 'yelo-guia-modal-overlay';
        overlayEl.innerHTML = `
            <div class="yelo-guia-container" onclick="event.stopPropagation()">
                <div class="yelo-guia-drag-handle"></div>
                <div class="yelo-guia-header">
                    <div class="yelo-guia-title-box">
                        <div class="yelo-guia-avatar" id="yelo-modal-icone">💡</div>
                        <div>
                            <h3 class="yelo-guia-title" id="yelo-modal-titulo">Como funciona esta tela</h3>
                            <p class="yelo-guia-sub" id="yelo-modal-subtitulo">Guia rápido de uso e impacto na sua clínica.</p>
                        </div>
                    </div>
                    <button class="yelo-guia-close-btn" onclick="window.fecharGuiaContextual()" title="Fechar">✕</button>
                </div>

                <div class="yelo-callouts-stack" id="yelo-modal-callouts">
                    <!-- Callouts são renderizados dinamicamente -->
                </div>

                <div class="yelo-guia-footer">
                    <button class="yelo-btn-entendi" onclick="window.fecharGuiaContextual()">
                        <span>Entendi, continuar</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </button>
                    <button class="yelo-btn-ver-tudo" onclick="window.fecharGuiaContextual(); if(window.loadPage) window.loadPage('psi_comece_aqui.html')">
                        Ver Guia Geral da Yelo →
                    </button>
                </div>
            </div>
        `;

        overlayEl.addEventListener('click', (e) => {
            if (e.target === overlayEl) window.fecharGuiaContextual();
        });

        document.body.appendChild(overlayEl);
    }

    // 5. FUNÇÕES PÚBLICAS
    window.fecharGuiaContextual = function() {
        if (overlayEl) {
            overlayEl.classList.remove('ativo');
        }
    };

    window.abrirGuiaContextual = function(telaOpcional) {
        criarEstruturaModal();

        // Identifica qual tela está aberta
        let telaAtual = telaOpcional;
        if (!telaAtual) {
            const lastPage = sessionStorage.getItem('yelo_last_psi_page') || '';
            const match = Object.keys(GUIAS_POR_TELA).find(k => lastPage.includes(k));
            telaAtual = match || 'psi_visao_geral.html';
        }

        const guia = GUIAS_POR_TELA[telaAtual] || GUIAS_POR_TELA['psi_visao_geral.html'];

        // Atualiza textos
        document.getElementById('yelo-modal-icone').textContent = guia.icone;
        document.getElementById('yelo-modal-titulo').textContent = guia.titulo;
        document.getElementById('yelo-modal-subtitulo').textContent = guia.subtitulo;

        // Renderiza blocos estilo Notion
        const stack = document.getElementById('yelo-modal-callouts');
        stack.innerHTML = `
            <!-- Bloco 1: Por que esta tela existe? -->
            <div class="yelo-notion-block neutral">
                <div class="yelo-notion-icon">🎯</div>
                <div class="yelo-notion-body">
                    <h4>${guia.proposito.titulo}</h4>
                    <p>${guia.proposito.texto}</p>
                </div>
            </div>

            <!-- Bloco 2: Como ela te ajuda a melhorar? -->
            <div class="yelo-notion-block green">
                <div class="yelo-notion-icon">💡</div>
                <div class="yelo-notion-body">
                    <h4>Como esta tela te ajuda a melhorar sua clínica</h4>
                    <ul>
                        ${guia.dicas.map(d => `<li>${d}</li>`).join('')}
                    </ul>
                </div>
            </div>

            <!-- Bloco 3: Impacto no Algoritmo de Match -->
            <div class="yelo-notion-block gold">
                <div class="yelo-notion-icon">⚙️</div>
                <div class="yelo-notion-body">
                    <h4>Como ela impacta o algoritmo da Yelo a seu favor</h4>
                    <p>${guia.algoritmo}</p>
                </div>
            </div>
        `;

        overlayEl.classList.add('ativo');
    };

    // 6. INJEÇÃO AUTOMÁTICA DO BOTÃO NO CABEÇALHO DA TELA
    window.atualizarGuiaContextual = function(urlCarregada) {
        const url = urlCarregada || sessionStorage.getItem('yelo_last_psi_page') || '';
        
        // Se estiver na própria página do Comece Aqui, não precisa injetar botão duplicado
        if (url.includes('psi_comece_aqui')) return;

        // Aguarda micro-tick para garantir que o DOM da tela filha foi injetado
        setTimeout(() => {
            const header = document.querySelector('.main-header') || document.querySelector('.modern-hero-header');
            if (header && !header.querySelector('.yelo-btn-como-funciona')) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'yelo-btn-como-funciona';
                btn.innerHTML = `
                    <span class="yelo-cf-icon">💡</span>
                    <span>Como funciona</span>
                `;
                btn.onclick = () => window.abrirGuiaContextual(url);
                
                // Insere elegantemente no header
                header.appendChild(btn);
            }
        }, 120);
    };

    // Inicialização ao carregar
    document.addEventListener('DOMContentLoaded', () => {
        criarEstruturaModal();
        const lastPage = sessionStorage.getItem('yelo_last_psi_page') || '';
        window.atualizarGuiaContextual(lastPage);
    });

})();


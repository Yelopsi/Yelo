/**
 * adminAdjustmentParserService.js
 * Responsável pela análise em linguagem natural e categorização inteligente
 * de solicitações de ajustes por página/arquivo, no estilo Notion / Linear.
 */

const KNOWN_PAGES = [
    {
        name: 'Perfil Público do Psicólogo',
        filePath: 'views/psi_perfil_publico.ejs',
        environment: 'publico',
        keywords: ['perfil publico', 'perfil público', 'pagina pública', 'página pública', 'bio do psi', 'depoimentos no perfil', 'avaliacoes no perfil']
    },
    {
        name: 'CRM Hub / Funil de Pacientes',
        filePath: 'admin/admin_crm_hub.html',
        environment: 'admin',
        keywords: ['crm', 'funil', 'follow-up', 'follow up', 'leads crm', 'pipeline']
    },
    {
        name: 'Copilot WhatsApp AI',
        filePath: 'admin/admin_copilot_wpp.html',
        environment: 'admin',
        keywords: ['copilot', 'whatsapp', 'wpp', 'conversa whatsapp', 'chat wpp', 'colar conversa']
    },
    {
        name: 'Fórum da Comunidade',
        filePath: 'public/psi/psi_forum.html',
        environment: 'psicologo',
        keywords: ['forum', 'fórum', 'discussao', 'discussão', 'comunidade', 'post fixado', 'comentarios do forum']
    },
    {
        name: 'Financeiro & Honorários',
        filePath: 'public/psi/psi_financeiro.html',
        environment: 'psicologo',
        keywords: ['financeiro', 'honorarios', 'honorários', 'despesas', 'calculadora', 'faturamento']
    },
    {
        name: 'Assinatura & Planos (Stripe/VIP)',
        filePath: 'public/psi/psi_assinatura.html',
        environment: 'psicologo',
        keywords: ['assinatura', 'plano', 'planos', 'vip', 'stripe', 'mensalidade', 'isencao', 'isenção']
    },
    {
        name: 'Gestão de Pacientes & Prontuário',
        filePath: 'public/psi/psi_pacientes.html',
        environment: 'psicologo',
        keywords: ['pacientes', 'prontuario', 'prontuário', 'evolucoes', 'evoluções', 'agenda', 'consultas']
    },
    {
        name: 'Visão Geral (Psicólogo)',
        filePath: 'public/psi/psi_dashboard.html',
        environment: 'psicologo',
        keywords: [
            'dashboard psi', 'dashboard do psicólogo', 'dashboard do psicologo', 'dashboard psicologo', 
            'visao geral psi', 'visão geral psi', 'visao geral psicologo', 'visão geral psicólogo',
            'visao geral', 'visão geral', 'home psi', 'tela do psi', 'tela do psicologo', 'tela do psicólogo',
            'métrica', 'métricas', 'metrica', 'metricas', 'étrica', 'étricas', 'gráfico', 'gráficos', 'grafico', 'graficos', 'conversão', 'conversao'
        ]
    },
    {
        name: 'Portal do Paciente',
        filePath: 'patient/patient_dashboard.ejs',
        environment: 'paciente',
        keywords: ['portal paciente', 'portal do paciente', 'area do paciente', 'área do paciente', 'dashboard paciente', 'dashboard do paciente', 'tela do paciente', 'painel do paciente', 'meu psicologo']
    },
    {
        name: 'Questionário de Match',
        filePath: 'views/questionario.ejs',
        environment: 'publico',
        keywords: ['questionario', 'questionário', 'triagem', 'match', 'perguntas match', 'formulario match']
    },
    {
        name: 'Landing Page / Institucional',
        filePath: 'index.html',
        environment: 'publico',
        keywords: ['landing page', 'landing', 'home', 'pagina inicial', 'hero', 'quem somos']
    },
    {
        name: 'Histórico de Alterações',
        filePath: 'admin/admin_historico_alteracoes.html',
        environment: 'admin',
        keywords: ['changelog', 'historico de alteracoes', 'histórico de alterações', 'novidades', 'notas de versao']
    },
    {
        name: 'Configurações Globais Admin',
        filePath: 'admin/admin_configuracoes.html',
        environment: 'admin',
        keywords: ['configuracoes', 'configurações', 'ajustes globais', 'manutencao', 'manutenção', 'precos admin']
    },
    {
        name: 'Visão Geral (Admin)',
        filePath: 'admin/admin_visao_geral.html',
        environment: 'admin',
        keywords: ['dashboard admin', 'visao geral admin', 'visão geral admin', 'raio x admin', 'home admin']
    },
    {
        name: 'CRM Psicólogos (Lista de Profissionais)',
        filePath: 'admin/admin_crm_psicologos.html',
        environment: 'admin',
        keywords: [
            'admin_crm_psicologos', 'crm psicologos', 'crm psicólogos', 'crm psicologo', 'crm psicólogo',
            'lista de profissionais', 'lista os profissionais', 'onde lista os profissionais', 'onde lista profissionais',
            'lista de psicologos', 'lista de psicólogos', 'tabela de psicólogos', 'tabela de psicologos', 'profissionais sem foto'
        ]
    },
    {
        name: 'CRM Pacientes (Admin)',
        filePath: 'admin/admin_crm_pacientes.html',
        environment: 'admin',
        keywords: ['crm pacientes', 'lista de pacientes admin', 'admin_crm_pacientes', 'leads pacientes']
    },
    {
        name: 'Blog & Gestão de Conteúdo',
        filePath: 'public/psi/psi_blog.html',
        environment: 'publico',
        keywords: ['blog', 'artigos', 'postagem', 'qna', 'conteudo', 'conteúdo']
    }
];

class AdminAdjustmentParserService {

    /**
     * Divide múltiplos ajustes inseridos juntos (por quebras de linha ou marcadores de lista)
     */
    static splitMultipleAdjustments(rawText) {
        if (!rawText || typeof rawText !== 'string') return [];
        
        const lines = rawText.split(/\r?\n/);
        const results = [];

        for (let l of lines) {
            let clean = l.trim();
            // Remove marcadores de lista como "1. ", "1) ", "- ", "* ", "• "
            clean = clean.replace(/^(?:[-*•\d\.\)\-–—]|\d+\.|\d+\))\s*/, '').trim();
            if (clean.length >= 4) {
                results.push(clean);
            }
        }

        return results;
    }

    /**
     * Analisa o texto bruto de um ajuste e retorna a página alvo, arquivo, categoria, ambiente, dispositivo e prioridade.
     */
    static parseAdjustmentText(rawText) {
        if (!rawText || typeof rawText !== 'string') {
            return {
                title: '',
                target_page: 'Geral',
                file_path: null,
                category: 'Melhoria',
                environment: 'geral',
                device: 'todos',
                priority: 'media'
            };
        }

        const text = rawText.trim();
        const lower = text.toLowerCase();

        // 1. Extração de Página / Arquivo
        let detectedPage = null;
        let detectedFilePath = null;
        let detectedPageEnvironment = null;

        // 0. Menção explícita com @ (ex: @admin_crm_psicologos, @psi_forum, etc.)
        const atMentionMatch = text.match(/@([a-zA-Z0-9_\-\.]+)/);
        if (atMentionMatch) {
            const rawMention = atMentionMatch[1].toLowerCase().replace(/\.(html|js|ejs|css)$/, '');
            for (const page of KNOWN_PAGES) {
                const baseName = (page.filePath ? page.filePath.split('/').pop().replace(/\.(html|js|ejs|css)$/, '') : '').toLowerCase();
                if (baseName === rawMention || (page.filePath && page.filePath.toLowerCase().includes(rawMention)) || page.keywords.some(k => k.toLowerCase() === rawMention)) {
                    detectedPage = page.name;
                    detectedFilePath = page.filePath;
                    detectedPageEnvironment = page.environment;
                    break;
                }
            }
            if (!detectedPage) {
                detectedPage = `Módulo: @${atMentionMatch[1]}`;
                detectedFilePath = atMentionMatch[1].includes('.') ? atMentionMatch[1] : `${atMentionMatch[1]}.html`;
            }
        }

        // A. Primeiro verifica correspondência ponderada na base de páginas/módulos conhecidos do sistema
        if (!detectedPage) {
            let bestPage = null;
            let bestScore = 0;

            for (const page of KNOWN_PAGES) {
                let score = 0;
                // Menção direta ao arquivo
                if (page.filePath && lower.includes(page.filePath.toLowerCase())) {
                    score += 50;
                } else if (page.filePath) {
                    const base = page.filePath.split('/').pop().toLowerCase();
                    if (lower.includes(base)) score += 40;
                }

                for (const kw of page.keywords) {
                    const kwLower = kw.toLowerCase();
                    if (lower.includes(kwLower)) {
                        const words = kwLower.split(/\s+/).length;
                        score += (words >= 2 ? 16 : 8);
                    }
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestPage = page;
                }
            }

            if (bestPage && bestScore >= 8) {
                detectedPage = bestPage.name;
                detectedFilePath = bestPage.filePath;
                detectedPageEnvironment = bestPage.environment;
            }
        }

        // B. Se não é página do sistema, verifica padrões explícitos como "pagina X", "p[agina X", "tela W", "arquivo Z"
        if (!detectedPage) {
            const stopWords = ['no', 'na', 'nos', 'nas', 'em', 'do', 'da', 'dos', 'das', 'de', 'para', 'com', 'ao', 'aos', 'pelo', 'pela', 'pelos', 'pelas', 'um', 'uma', 'que', 'quando', 'onde', 'lista', 'tem', 'fica', 'esta', 'está', 'vejo', 'mostra', 'e', 'ou'];
            const cleanText = text.replace(/p\[agina/gi, 'pagina').replace(/p\[ágina/gi, 'página');
            const explicitPageRegex = /(?:p[aá]gina|tela|arquivo|m[oó]dulo|componente|view)\s+([A-Za-z0-9_\-\.\/]+(?:\s+[A-Za-z0-9_\-\.\/]+)?)/i;
            const explicitMatch = cleanText.match(explicitPageRegex);
            
            if (explicitMatch && explicitMatch[1]) {
                let parts = explicitMatch[1].trim().split(/\s+/);
                if (parts.length > 1 && stopWords.includes(parts[1].toLowerCase())) {
                    parts = [parts[0]];
                }
                let rawIdentifier = parts.join(' ').replace(/[.,;:!?)]+$/, '');
                if (!stopWords.includes(rawIdentifier.toLowerCase()) && !stopWords.includes(parts[0].toLowerCase())) {
                    detectedPage = `Página ${rawIdentifier.toUpperCase().length <= 3 ? rawIdentifier.toUpperCase() : capitalize(rawIdentifier)}`;
                }
            }
        }

        // C. Fallback se mencionou nome de arquivo diretamente (ex: index.html, psi_forum.js, etc.)
        if (!detectedPage) {
            const fileRegex = /([a-zA-Z0-9_\-]+\.(?:html|ejs|js|css))/i;
            const fileMatch = text.match(fileRegex);
            if (fileMatch) {
                detectedFilePath = fileMatch[1];
                detectedPage = `Arquivo: ${fileMatch[1]}`;
                if (detectedFilePath.startsWith('admin/')) detectedPageEnvironment = 'admin';
                else if (detectedFilePath.startsWith('public/psi/') || detectedFilePath.includes('psi_')) detectedPageEnvironment = 'psicologo';
                else if (detectedFilePath.includes('patient')) detectedPageEnvironment = 'paciente';
                else if (detectedFilePath === 'index.html' || detectedFilePath.includes('views/')) detectedPageEnvironment = 'publico';
            }
        }

        // Se ainda assim não encontrou nenhuma página específica:
        if (!detectedPage) {
            detectedPage = 'Geral / A Definir';
        }

        // 2. Extração de Ambiente / Contexto
        let environment = null;
        if (hasAny(lower, ['admin', 'administrador', 'painel admin', 'dashboard admin', 'crm', 'copilot', 'relatorio admin', 'visao geral admin'])) {
            environment = 'admin';
        } else if (hasAny(lower, ['psicologo', 'psicólogo', 'painel do psi', 'dashboard do psi', 'dashboard psi', 'dashboard psicologo', 'dashboard do psicologo', 'area do psi', 'área do psi', 'portal do psi'])) {
            environment = 'psicologo';
        } else if (hasAny(lower, ['paciente', 'portal do paciente', 'área do paciente', 'area do paciente', 'dashboard paciente', 'meu psicologo'])) {
            environment = 'paciente';
        } else if (hasAny(lower, ['fora do acesso', 'sem login', 'deslogado', 'deslogada', 'publica', 'pública', 'pagina publica', 'página pública', 'landing', 'landing page', 'institucional', 'site publico', 'site público', 'visitante', 'home publica'])) {
            environment = 'publico';
        }

        if (!environment && detectedPageEnvironment) {
            environment = detectedPageEnvironment;
        }
        if (!environment) {
            environment = 'geral';
        }

        // 3. Extração de Dispositivo / Plataforma
        let device = 'todos';
        if (hasAny(lower, ['mobile', 'celular', 'iphone', 'ios', 'android', 'safari mobile', 'smartphone', 'tela pequena', 'notch', 'bottom nav', 'responsivo mobile', 'touch'])) {
            device = 'mobile';
        } else if (hasAny(lower, ['desktop', 'computador', 'pc', 'macbook', 'notebook', 'laptop', 'tela grande', 'sidebar desktop', 'mouse', 'hover', 'resolução grande', 'resolucao grande'])) {
            device = 'desktop';
        }

        // 4. Extração de Categoria
        let category = 'Melhoria';
        if (hasAny(lower, ['bug', 'erro', 'arrumar', 'consertar', 'quebrado', 'corrigir', 'travando', 'sumiu', 'falha', 'crash', 'não funciona', 'nao funciona', '500', '404'])) {
            category = 'Bug & Correção';
        } else if (hasAny(lower, ['scroll', 'rolagem', 'lento', 'lentidao', 'lentidão', 'performance', 'velocidade', 'cache', 'trava', 'otimizar', 'viewport'])) {
            category = 'Performance & Mobile';
        } else if (hasAny(lower, ['cor', 'cores', 'botao', 'botão', 'cta', 'layout', 'css', 'estilo', 'fonte', 'tipografia', 'espaçamento', 'margem', 'alinhamento', 'sombra', 'ícone', 'icone', 'tema', 'banner', 'card', 'visual', 'estética'])) {
            category = 'Design & UI';
        } else if (hasAny(lower, ['incluir', 'adicionar', 'criar', 'nova funcao', 'nova função', 'funcionalidade', 'implementar', 'novo recurso', 'permitir', 'fluxo', 'integrar'])) {
            category = 'Nova Funcionalidade';
        } else if (hasAny(lower, ['texto', 'frase', 'palavra', 'mensagem', 'copy', 'descrição', 'titulo', 'título', 'ortografia', 'português', 'digitação', 'termo'])) {
            category = 'Texto & Copy';
        }

        // 5. Extração de Prioridade
        let priority = 'media';
        if (hasAny(lower, ['urgente', 'critico', 'crítico', 'quebrado', 'asap', 'hoje', 'grave', 'prioridade alta', 'imediato'])) {
            priority = 'alta';
        } else if (hasAny(lower, ['quando der', 'melhoria futura', 'baixa prioridade', 'ideia', 'depois', 'futuro', 'detalhe', 'opcional'])) {
            priority = 'baixa';
        }

        return {
            title: text,
            target_page: detectedPage,
            file_path: detectedFilePath,
            environment,
            device,
            category,
            priority
        };
    }

    static getKnownPages() {
        return KNOWN_PAGES;
    }

    static findKnownPage(pageName) {
        if (!pageName || typeof pageName !== 'string') return null;
        const lower = pageName.toLowerCase().trim();
        return KNOWN_PAGES.find(p => p.name.toLowerCase() === lower || p.name.toLowerCase().includes(lower)) || null;
    }
}

function hasAny(text, keywords) {
    return keywords.some(k => text.includes(k));
}

function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = AdminAdjustmentParserService;

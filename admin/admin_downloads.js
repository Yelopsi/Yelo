// admin/admin_downloads.js

window.initializePage = function() {
    console.log("Inicializando página de Downloads...");
    const token = localStorage.getItem('Yelo_token');
    const API_BASE_URL = window.API_BASE_URL || 'http://localhost:3001';

    const btnDownloadPatients = document.getElementById('btn-download-patients');
    const btnDownloadPsychologists = document.getElementById('btn-download-psychologists');
    const btnDownloadFollowups = document.getElementById('btn-download-followups');

    if (!token) {
        console.error("Token não encontrado.");
        return;
    }

    /**
     * Converte um array de objetos JSON para uma string CSV.
     * @param {Array<Object>} jsonArray - O array de dados.
     * @returns {string} - A string formatada em CSV.
     */
    function convertToCSV(jsonArray) {
        if (!jsonArray || jsonArray.length === 0) {
            return '';
        }
        const headers = Object.keys(jsonArray[0]);
        const csvRows = [];
        // Adiciona o cabeçalho
        csvRows.push(headers.join(';')); // Usa ponto e vírgula para compatibilidade com Excel BR

        // Adiciona as linhas
        for (const row of jsonArray) {
            const values = headers.map(header => {
                const escaped = ('' + (row[header] || '')).replace(/"/g, '""'); // Escapa aspas duplas
                return `"${escaped}"`;
            });
            csvRows.push(values.join(';'));
        }

        return csvRows.join('\n');
    }

    /**
     * Inicia o download de um arquivo CSV/XLS.
     * @param {string} csvString - O conteúdo do arquivo.
     * @param {string} filename - O nome do arquivo a ser baixado.
     */
    function downloadCSV(csvString, filename) {
        const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' }); // BOM para Excel entender acentos
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Inicia o download de um arquivo de texto.
     * @param {string} textContent - O conteúdo do arquivo.
     * @param {string} filename - O nome do arquivo a ser baixado.
     */
    function downloadTXT(textContent, filename) {
        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Função genérica para buscar dados e iniciar o download.
     * @param {HTMLButtonElement} button - O botão que foi clicado.
     * @param {string} endpoint - A rota da API para buscar os dados.
     * @param {string} filename - O nome do arquivo final.
     */
    async function handleDownload(button, endpoint, filename) {
        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = 'Gerando...';

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Falha ao buscar dados.');

            const data = await response.json();
            const csv = convertToCSV(data);
            downloadCSV(csv, filename);
        } catch (error) {
            console.error(`Erro ao baixar ${filename}:`, error);
            alert(`Não foi possível gerar o arquivo: ${error.message}`);
        } finally {
            button.disabled = false;
            button.textContent = originalText;
        }
    }

    if (btnDownloadPatients) {
        btnDownloadPatients.addEventListener('click', () => handleDownload(btnDownloadPatients, '/api/admin/export/patients', 'pacientes_yelo.xls'));
    }

    if (btnDownloadPsychologists) {
        btnDownloadPsychologists.addEventListener('click', () => handleDownload(btnDownloadPsychologists, '/api/admin/export/psychologists', 'psicologos_yelo.xls'));
    }

    // --- Lógica Específica para Follow-up (Camada 1 - Mock/Simulação) ---
    // Gera dados brutos para análise imediata no Excel/Sheets
    function getMockFollowUpData() {
        return [
            {
                patient_id: "pat_8888",
                psychologist_id: "psi_55",
                psychologist_name: "Dra. Ana Silva",
                clicked_at: "2023-10-20T14:30:00Z",
                message_sent_at: "2023-10-27T09:00:00Z",
                final_status: "contact_ok",
                resolved_at: "2023-10-27T10:15:00Z"
            },
            {
                patient_id: "pat_6666",
                psychologist_id: "psi_60",
                psychologist_name: "Dr. Carlos Oliveira",
                clicked_at: "2023-10-21T10:00:00Z",
                message_sent_at: "2023-10-28T11:00:00Z",
                final_status: "contact_fail", // Psicólogo não respondeu
                resolved_at: "2023-10-29T09:00:00Z"
            },
            {
                patient_id: "pat_4444",
                psychologist_id: "psi_60", // Mesmo psi falhando de novo (padrão detectável no Excel)
                psychologist_name: "Dr. Carlos Oliveira",
                clicked_at: "2023-10-22T16:45:00Z",
                message_sent_at: "",
                final_status: "not_tried", // Timing: ainda não deu 7 dias ou admin não viu
                resolved_at: ""
            },
            {
                patient_id: "pat_2222",
                psychologist_id: "psi_22",
                psychologist_name: "Psi. Marcos",
                clicked_at: "2023-10-23T08:20:00Z",
                message_sent_at: "",
                final_status: "opt_out", // Atrito
                resolved_at: "2023-10-23T08:25:00Z"
            }
        ];
    }

    const instructionsText = `1. O que extrair desse arquivo (KPIs que importam)

Com essas colunas, foque só no que gera decisão.

🔹 1. Performance por psicólogo (obrigatório)

Agrupe por psychologist_id / psychologist_name e calcule:
- Total de cliques recebidos
- % contact_ok → respondeu e houve contato
- % contact_fail → paciente tentou, psicólogo não respondeu
- Tempo médio de resposta (resolved_at - message_sent_at)

👉 Isso responde objetivamente: “Esse profissional responde ou só ocupa espaço na vitrine?”

🔹 2. Taxa de desperdício do funil

Use final_status:
- not_tried
- opt_out
- contact_fail

Perguntas que você responde fácil:
- Quanto interesse morre antes de virar conversa?
- O problema é timing, qualidade do perfil ou psicólogo ausente?

🔹 3. SLA invisível (mas decisivo)

Calcule:
- Tempo entre clique e mensagem enviada (message_sent_at - clicked_at)

Se isso passar de 24–48h:
- o problema não é o psicólogo
- é follow-up lento da plataforma

2. Como interpretar (sem autoengano)

📉 Muito contact_fail em um psi?
➡️ Psicólogo não responde.
- Ou é desorganizado
- Ou não quer novos pacientes
- Ou está usando a plataforma só como vitrine
Ação futura: ranking interno ou despriorização automática.

⏳ Muito not_tried?
➡️ Timing errado.
- 7 dias pode ser tarde
- Ou o CTA não é forte
- Ou o paciente resolveu por fora
Insight: esse status não é falha, é termômetro de urgência.

🚪 Muito opt_out?
➡️ Comunicação mal posicionada.
- Mensagem invasiva
- Texto errado
- Ou excesso de contato
Aqui você ajusta copy, não produto.

3. O que você consegue provar com esse CSV

Com 1 mês de dados você já consegue:
- Identificar psicólogos “fantasmas”
- Saber quem converte interesse em contato
- Ajustar o timing do follow-up
- Justificar corte ou destaque de profissionais
- Mostrar valor real da plataforma (não achismo)

E o mais importante:
Você para de discutir opinião e passa a discutir comportamento real.

Visão mais à frente (sem fazer agora)
Quando isso escalar, esse CSV vira:
- Dashboard automático
- Score de confiabilidade do psicólogo
- Critério de ranqueamento no marketplace
- Argumento comercial (“quem responde aparece mais”)
`;

    if (btnDownloadFollowups) {
        btnDownloadFollowups.addEventListener('click', () => {
            // Em produção, trocar getMockFollowUpData() por fetch('/api/admin/export/followups')
            const data = getMockFollowUpData();
            const csv = convertToCSV(data);
            downloadCSV(csv, 'followups_yelo_analise.csv');

            // Baixa o arquivo de texto com as instruções
            downloadTXT(instructionsText, 'COMO_ANALISAR_FOLLOWUPS.txt');
        });
    }
};
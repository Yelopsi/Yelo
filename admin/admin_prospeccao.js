// admin/admin_prospeccao.js

// Dicionário Inteligente de Copys
window.copysOutbound = {
    intro: `Olá, [PRIMEIRO NOME], como vai? \uD83D\uDE42\n\nMeu nome é *Anderson Costa*, também atuo como Psicólogo Clínico.\n\nVi que você faz atendimentos clínicos e fiquei curioso: como você tem sido a captação de clientes e a organização das burocracias da clínica no dia a dia?\n\nPergunto porque sei o quanto é desgastante equilibrar os atendimentos com a gestão da agenda, confirmações das sessões, a busca por novos pacientes, ter a formação em dia — coisas que a gente não aprende direito na graduação e acabam tomando tempo precioso do que mais gostamos: _clinicar_.\n\nPor ter passado por isso, criei a *Yelo*, uma plataforma pensada para criar uma *comunidade* e ajudar colegas psicólogos/as a atrair mais pacientes, organizar melhor a rotina e trocar mais experiências valiosas.\n\nSe fizer sentido pra você, te explico rapidamente por aqui mesmo como funciona. Pode ser?`,
    
    pitch: `Maravilha, [PRIMEIRO NOME]! \n\nBom, serei bem direto, porque eu sei que a vida é corrida. A Yelo não é uma daquelas listas genéricas de profissionais.\n\nNós construímos um Hub completo: O paciente responde a um questionário simplificado e nosso algoritmo faz o Match Inteligente direcionando-o para a sua especialidade.\n\nAlém disso, a plataforma também oferece várias ferramentas de gestão e troca de saberes \uD83E\uDD1D\n\nAlgumas funcionalidades:\n\uD83E\uDDE0 Fórum privado para discussões\n\u270D\uFE0F Blog para escrever aos usuários\n\u2753 Espaço de dúvidas para interação com o público\n\uD83D\uDCCA Gestão financeira\n\uD83D\uDCC8 Métricas de mercado\n\uD83C\uDF10 Página pública com endereço personalizado (tipo site pessoal)\n\nE ainda estamos finalizando:\n\uD83D\uDCE9 Envio de mensagens automáticas\n\uD83D\uDC65 Criação de grupos de supervisão e intervisão\n\nNa Yelo você tem total autonomia: você define seus horários, valores, edita seu perfil, usa as ferramentas de análise para se posicionar melhor no mercado, etc.\n\nDá uma olhada no nosso site. Como estamos selecionando profissionais referência para esta fase, liberei 14 dias de acesso gratuito para você testar na prática. O que acha?\n\nwww.yelopsi.com.br/profissionais`,
    
    followup1: `Oi, [PRIMEIRO NOME], tudo bem?\n\nConseguiu dar uma olhada no link da Yelo que te enviei recentemente?\n\nGostaria muito de ter um colega com a sua visão na nossa rede. Nossos primeiros 14 dias são totalmente sem custo justamente para você sentir como a nossa gestão e o nosso algoritmo podem te ajudar na prática, além de participar do nosso fórum de intervisão.\n\nQualquer dúvida na configuração, estou à disposição!`,
    
    followup2: `Olá, [PRIMEIRO NOME]!\n\nSei perfeitamente como a rotina de consultório é engolida por sessões, então não quero tomar seu tempo.\n\nEstou passando rapidinho só para deixar nosso convite em aberto. Nosso objetivo com a Yelo é eliminar o ruído burocrático para você.\nSe fizer sentido conversar depois e testar a plataforma, me dá um alô por aqui ou vem nos conhecer em www.yelopsi.com.br/profissionais\n\nBons atendimentos!`
};

// Guarda o lead selecionado para o Modal
window.leadAlvoAtual = null;

// Injetando estilos modernos para os botões de ação (App-Like / Mobile-First)
if (!document.getElementById('lead-actions-style')) {
    const style = document.createElement('style');
    style.id = 'lead-actions-style';
    style.innerHTML = `
        .lead-actions-wrapper {
            display: flex;
            gap: 8px;
            justify-content: center;
            align-items: center;
            flex-wrap: wrap;
        }
        .lead-action-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border: none;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            flex-shrink: 0;
        }
        .lead-action-btn:hover { transform: scale(1.15) translateY(-2px); }
        
        .lead-action-btn.btn-zap {
            background-color: #dcfce7; color: #166534;
            padding: 8px 16px; border-radius: 50px;
            font-weight: 700; font-size: 0.85rem; gap: 6px;
            box-shadow: 0 2px 5px rgba(22, 101, 52, 0.1);
        }
        .lead-action-btn.btn-zap:hover { background-color: #bbf7d0; box-shadow: 0 6px 12px rgba(22, 101, 52, 0.2); }
        
        .lead-action-btn.btn-pause { background-color: #fef3c7; color: #d97706; width: 38px; height: 38px; border-radius: 50%; box-shadow: 0 2px 5px rgba(217, 119, 6, 0.1); }
        .lead-action-btn.btn-pause:hover { background-color: #fde68a; box-shadow: 0 6px 12px rgba(217, 119, 6, 0.2); }
        
        .lead-action-btn.btn-convert { background-color: #e0f2fe; color: #0369a1; width: 38px; height: 38px; border-radius: 50%; box-shadow: 0 2px 5px rgba(3, 105, 161, 0.1); }
        .lead-action-btn.btn-convert:hover { background-color: #bae6fd; box-shadow: 0 6px 12px rgba(3, 105, 161, 0.2); }
        
        .lead-action-btn.btn-delete { background-color: #fee2e2; color: #b91c1c; width: 38px; height: 38px; border-radius: 50%; box-shadow: 0 2px 5px rgba(185, 28, 28, 0.1); }
        .lead-action-btn.btn-delete:hover { background-color: #fecaca; box-shadow: 0 6px 12px rgba(185, 28, 28, 0.2); }
        
        @media (max-width: 1024px) {
            .lead-actions-wrapper { justify-content: flex-end; }
            .lead-action-btn.btn-zap { flex-grow: 1; }
        }
    `;
    document.head.appendChild(style);
}

window.allLeads = [];
window.currentLeadPage = 1;
const LEADS_PER_PAGE = 20;

window.carregarLeads = async function() {
    const filtroFunil = document.getElementById('filtro-funil');
    const listaLeadsBody = document.getElementById('lista-leads-body');
    
    if (!filtroFunil || !listaLeadsBody) return;
    
    try {
        listaLeadsBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 30px; color: #888;">Carregando leads...</td></tr>`;
        
        const filtro = filtroFunil.value;
        const BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : '';
        const token = localStorage.getItem('Yelo_token');
        
        const response = await fetch(`${BASE_URL}/api/admin/leads?filtro=${filtro}`, {
            method: 'GET',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Falha ao buscar leads');
        }
        
        const result = await response.json();
        
        // Atualiza os KPIs
        document.getElementById('kpi-pendentes').textContent = result.kpis.pendentes;
        document.getElementById('kpi-contatados').textContent = result.kpis.contatados;
        document.getElementById('kpi-aguardando').textContent = result.kpis.aguardando;
        document.getElementById('kpi-cadastrados').textContent = result.kpis.cadastrados;

        window.allLeads = result.leads || [];
        window.currentLeadPage = 1;
        window.renderizarPaginaAtual();

    } catch (error) {
        console.error('Erro ao carregar leads:', error);
        listaLeadsBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #E63946;">${error.message || 'Erro ao carregar leads. Tente novamente.'}</td></tr>`;
    }
};

window.renderizarPaginaAtual = function() {
    const start = (window.currentLeadPage - 1) * LEADS_PER_PAGE;
    const end = start + LEADS_PER_PAGE;
    const leadsPage = window.allLeads.slice(start, end);
    
    window.renderizarLeads(leadsPage);
    window.renderizarPaginacao();
};

window.renderizarPaginacao = function() {
    const paginationContainer = document.getElementById('leads-pagination');
    if (!paginationContainer) return;

    const totalPages = Math.ceil(window.allLeads.length / LEADS_PER_PAGE);
    
    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    let html = '';
    html += `<button class="pagination-btn" ${window.currentLeadPage === 1 ? 'disabled' : ''} onclick="window.mudarPaginaLeads(${window.currentLeadPage - 1})">Anterior</button>`;
    
    let startPage = Math.max(1, window.currentLeadPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);

    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="pagination-btn ${i === window.currentLeadPage ? 'active' : ''}" onclick="window.mudarPaginaLeads(${i})">${i}</button>`;
    }

    html += `<button class="pagination-btn" ${window.currentLeadPage === totalPages ? 'disabled' : ''} onclick="window.mudarPaginaLeads(${window.currentLeadPage + 1})">Próxima</button>`;
    paginationContainer.innerHTML = html;
};

window.mudarPaginaLeads = function(newPage) {
    const totalPages = Math.ceil(window.allLeads.length / LEADS_PER_PAGE);
    if (newPage >= 1 && newPage <= totalPages) {
        window.currentLeadPage = newPage;
        window.renderizarPaginaAtual();
    }
};

window.renderizarLeads = function(leads) {
    const listaLeadsBody = document.getElementById('lista-leads-body');
    if (leads.length === 0) {
        listaLeadsBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 30px; color: #888; font-style: italic;">Nenhum lead encontrado para este filtro.</td></tr>`;
        return;
    }

    listaLeadsBody.innerHTML = leads.map(lead => {
        let origemCurta = lead.origem_url;
        try { origemCurta = new URL(lead.origem_url).hostname; } catch(e) {}

        // FIX: Evita quebra do HTML caso o nome do psicólogo contenha aspas simples (ex: D'Avila)
        const safeNome = lead.nome ? lead.nome.replace(/'/g, "\\'").replace(/"/g, "&quot;") : 'Colega';

        let badgeStatus = `<span class="status status-pending">Pendente</span>`;
        if (lead.status_funil === 'Contatado') badgeStatus = `<span class="status" style="background: #e0f2fe; color: #0284c7;">Contatado</span>`;
        else if (lead.status_funil === 'Aguardando') badgeStatus = `<span class="status status-aviso">Aguardando</span>`;
        else if (lead.status_funil === 'Cadastrado') badgeStatus = `<span class="status" style="background: #d1fae5; color: #059669;">Cadastrado</span>`;

        // BÔNUS: Semáforo Inteligente de Follow-up (SLA)
        let semaforo = '';
        if (lead.status_funil === 'Contatado' && lead.data_ultimo_contato) {
            const diasAtraso = Math.floor((new Date() - new Date(lead.data_ultimo_contato)) / (1000 * 60 * 60 * 24));
            if (diasAtraso >= 5) {
                semaforo = `<span title="Mais de 5 dias sem contato! Mande a Despedida." style="display:inline-block; width:10px; height:10px; border-radius:50%; background-color:#ef4444; box-shadow:0 0 5px #ef4444; margin-right:8px; animation: pulse 2s infinite;"></span>`;
            } else if (diasAtraso >= 2) {
                semaforo = `<span title="Passou de 2 dias! Mande o Follow-up 1." style="display:inline-block; width:10px; height:10px; border-radius:50%; background-color:#f59e0b; margin-right:8px;"></span>`;
            } else {
                semaforo = `<span title="Contato recente (Menos de 2 dias)." style="display:inline-block; width:10px; height:10px; border-radius:50%; background-color:#10b981; margin-right:8px;"></span>`;
            }
        }

        return `
            <tr id="lead-row-${lead.id}">
                <td data-label="Nome" style="font-weight: 600; color: #333; display: flex; align-items: center;">${semaforo}${lead.nome}</td>
                <td data-label="Telefone">${window.mascaraTelefoneLeads(lead.telefone)}</td>
                <td data-label="Status">${badgeStatus}</td>
                <td data-label="Origem">
                    <a href="${lead.origem_url}" target="_blank" style="color: #1B4332; font-size: 0.85rem;">
                        ${origemCurta || 'Desconhecida'}
                    </a>
                </td>
                <td data-label="Ações">
                    <div class="lead-actions-wrapper">
                        <!-- Botão Principal: Whatsapp -->
                        <button class="lead-action-btn btn-zap" onclick="window.abrirModalZap('${lead.id}', '${lead.telefone}', '${safeNome}')" title="Enviar Mensagem">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                            <span>Chamar</span>
                        </button>
                        
                        <!-- Botões Rápidos de Gestão -->
                        <button class="lead-action-btn btn-pause" onclick="window.alterarStatusLead('${lead.id}', 'Aguardando')" title="Colocar em Espera">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        </button>
                        <button class="lead-action-btn btn-convert" onclick="window.alterarStatusLead('${lead.id}', 'Cadastrado')" title="Marcar como Convertido">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>
                        </button>
                        <button class="lead-action-btn btn-delete" onclick="window.excluirLead('${lead.id}', '${safeNome}')" title="Remover / Recusou">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"></path><path d="M6 6l12 12"></path></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
};

window.abrirModalZap = function(id, telefone, nome) {
    window.leadAlvoAtual = { id, telefone, nome };
    document.getElementById('modal-zap-nome').textContent = (nome || 'Colega').split(' ')[0];
    
    const modal = document.getElementById('modal-copy-whatsapp');
    if (modal) {
        modal.classList.add('is-visible');
        modal.style.display = 'flex'; // Garantia para sobrepor outras classes
    }
};

window.fecharModalZap = function() {
    const modal = document.getElementById('modal-copy-whatsapp');
    if (modal) {
        modal.classList.remove('is-visible');
        setTimeout(() => { modal.style.display = 'none'; }, 300); // Aguarda o fade out visual
    }
    window.leadAlvoAtual = null;
};

window.enviarWhatsAppCopy = async function(tipoCopy) {
    if (!window.leadAlvoAtual) return;
    
    const { id, telefone, nome } = window.leadAlvoAtual;
    window.fecharModalZap(); // Fecha o modal imediatamente

    try {
        let telefoneNum = telefone.replace(/\D/g, '');
        if (telefoneNum.length === 10 || telefoneNum.length === 11) { telefoneNum = '55' + telefoneNum; }

        // Pega apenas o primeiro nome e evita que a variável fique "Psicólogo(a)"
        let primeiroNome = nome.trim().split(' ')[0];
        if (primeiroNome.includes('Psicólogo')) primeiroNome = 'colega';
        
        // Cria o Link Mágico Rastreável (UTMs para o Funil de Marketing)
        // Passamos o telefone como Campanha para que o painel de Ads saiba exatamente de qual Lead veio a conversão
        const linkMagico = `yelopsi.com.br/profissionais?utm_source=outbound&utm_medium=whatsapp&utm_campaign=${telefoneNum}`;

        // Pega a copy exata selecionada, injeta o nome e substitui a URL genérica pelo Link Mágico
        const msgSelecionada = window.copysOutbound[tipoCopy];
        const msgFinal = msgSelecionada
            .replace(/\[PRIMEIRO NOME\]/g, primeiroNome)
            .replace(/\[Nome\]/g, primeiroNome)
            .replace(/\[NOME\]/g, primeiroNome)
            .replace(/www\.yelopsi\.com\.br\/profissionais/g, linkMagico);
        
        window.open(`https://wa.me/${telefoneNum}?text=${encodeURIComponent(msgFinal)}`, '_blank');

        const BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : '';
        const token = localStorage.getItem('Yelo_token');
        
        const req = await fetch(`${BASE_URL}/api/admin/leads/${id}/contato`, { 
            method: 'PUT', 
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            } 
        });

        if (req.ok) {
            const row = document.getElementById(`lead-row-${id}`);
            if (row && document.getElementById('filtro-funil').value === 'pendentes') {
                // Remove o lead da memória e recarrega a página atual suavemente
                window.allLeads = window.allLeads.filter(l => String(l.id) !== String(id));
                row.style.opacity = '0'; 
                row.style.transition = 'opacity 0.3s ease'; 
                setTimeout(() => window.renderizarPaginaAtual(), 300);
            } else { 
                window.carregarLeads(); 
            }
        }
    } catch (error) { console.error("Erro:", error); alert("Erro ao atualizar status do lead no sistema."); }
};

// Função para Mudar o Status Manualmente (Espera / Sucesso)
window.alterarStatusLead = async function(id, novoStatus) {
    try {
        const BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : '';
        const req = await fetch(`${BASE_URL}/api/admin/leads/${id}/status`, { 
            method: 'PUT', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('Yelo_token')}` },
            body: JSON.stringify({ status: novoStatus })
        });

        if (req.ok) {
            if (window.showToast) window.showToast(`Lead movido para: ${novoStatus}`);
            window.carregarLeads(); // Recarrega para atualizar tabela e KPIs
        }
    } catch (e) {
        console.error(e);
        alert("Erro ao atualizar o status do Lead.");
    }
};

// Função para Excluir Lead (Recusa / Lixeira)
window.excluirLead = async function(id, nome) {
    if (!confirm(`Tem certeza que deseja excluir o lead de ${nome}?\nUse isso para casos de recusa ou dados inválidos.`)) return;

    try {
        const BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : '';
        const req = await fetch(`${BASE_URL}/api/admin/leads/${id}`, { 
            method: 'DELETE', 
            headers: { 'Authorization': `Bearer ${localStorage.getItem('Yelo_token')}` }
        });

        if (req.ok) {
            if (window.showToast) window.showToast('Lead removido da base.', 'success');
            window.carregarLeads(); // Recarrega para atualizar tabela e KPIs
        }
    } catch (e) {
        console.error(e);
        alert("Erro ao excluir o Lead.");
    }
};

window.mascaraTelefoneLeads = function(tel) {
    if (!tel) return '';
    let r = tel.replace(/\D/g, "");
    if (r.length === 11) return r.replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3");
    else if (r.length === 10) return r.replace(/^(\d{2})(\d{4})(\d{4}).*/, "($1) $2-$3");
    return tel;
};

window.exportarLeadsCSV = function() {
    const tabela = document.getElementById('tabela-leads');
    const linhas = tabela.querySelectorAll('tr');
    let csvContent = "data:text/csv;charset=utf-8,Nome,Telefone,Status,Origem\n";

    linhas.forEach((linha, index) => {
        // Pula o cabeçalho ou mensagens de "Carregando"
        if (index === 0 || linha.cells.length < 4) return; 
        
        const nome = linha.cells[0].innerText.replace(/,/g, ''); // Remove vírgulas para não quebrar o CSV
        const telefone = linha.cells[1].innerText;
        const status = linha.cells[2].innerText;
        const origem = linha.cells[3].innerText.replace(/,/g, '');

        csvContent += `${nome},${telefone},${status},${origem}\n`;
    });

    // Cria o link de download invisível e clica nele
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `leads_yelo_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// Inicia automaticamente ao carregar
setTimeout(() => { if (document.getElementById('lista-leads-body')) window.carregarLeads(); }, 100);
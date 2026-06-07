// admin/admin_prospeccao.js

// Dicionário Inteligente de Copys
window.copysOutbound = {
    intro: `Olá, [PRIMEIRO NOME], como vai? Meu nome é *Anderson Costa*, também sou Psicólogo Clínico.\n\nVi que você faz atendimentos e fiquei curioso: como tem sido a captação de novos pacientes e a organização da sua rotina?\n\nPergunto porque sei o quanto é desgastante equilibrar os atendimentos com a gestão da agenda, a busca por pacientes, ter a formação em dia — coisas que a gente não aprende na graduação e que tomam um tempo precioso do que mais gostamos: _clinicar_.\n\nPor ter passado por isso, criei a *Yelo*, uma plataforma pensada para criar uma *comunidade* e ajudar colegas psicólogos/as a atrair mais pacientes e organizar melhor a rotina.\n\nSe fizer sentido pra você, te explico rapidamente por aqui mesmo (em duas mensagens) como funciona. Pode ser?`,
    
    pitch: `Maravilha, [PRIMEIRO NOME]! Serei bem direto, porque sei que a vida é corrida.\n\nA Yelo não é uma daquelas listas genéricas de profissionais. Nós construímos um Hub completo: o paciente responde a um questionário e nosso algoritmo faz o Match Inteligente, direcionando-o para a sua especialidade.\n\nAlém disso, a plataforma oferece ferramentas de gestão e troca de saberes ${String.fromCodePoint(0x1F91D)}:\n${String.fromCodePoint(0x1F9E0)} Fórum privado para discussões\n${String.fromCodePoint(0x270D, 0xFE0F)} Blog para escrever aos usuários\n${String.fromCodePoint(0x1F4CA)} Gestão financeira\n${String.fromCodePoint(0x1F310)} Página pública com endereço personalizado\n\nNa Yelo você tem total autonomia: define seus horários, valores, edita seu perfil, etc.\n\nComo estamos selecionando profissionais referência para esta fase, liberei **14 dias de acesso gratuito para você testar na prática, sem precisar cadastrar nenhum cartão**. O que acha?\n\nwww.yelopsi.com.br/profissionais`,
    
    followup1: `Oi, [PRIMEIRO NOME], tudo bem?\n\nConseguiu dar uma olhada no link da Yelo que te enviei?\n\nGostaria muito de ter um colega com a sua visão na nossa rede. Nossos primeiros 14 dias são totalmente sem custo **(e sem pedir cartão)** para você sentir como nossa gestão e nosso algoritmo podem te ajudar na prática, além de participar do nosso fórum de intervisão.\n\nQualquer dúvida, estou à disposição!`,
    
    followup2: `Olá, [PRIMEIRO NOME]!\n\nSei perfeitamente como a rotina de consultório é engolida por sessões, então não quero tomar seu tempo.\n\nEstou passando rapidinho só para deixar nosso convite em aberto. Nosso objetivo com a Yelo é eliminar o ruído burocrático para você.\nSe fizer sentido conversar depois e testar a plataforma, me dá um alô por aqui ou vem nos conhecer em www.yelopsi.com.br/profissionais\n\nBons atendimentos!`
};

// Guarda o lead selecionado para o Modal
window.leadAlvoAtual = null;

// Injetando estilos modernos para os botões de ação (App-Like // Mobile-First)
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

        // Calculando e exibindo a conversão
        const totalLeads = result.kpis.pendentes + result.kpis.contatados + result.kpis.aguardando + result.kpis.cadastrados;
        const kpiConversao = document.getElementById('kpi-conversao');
        if (kpiConversao) {
            const taxa = totalLeads > 0 ? ((result.kpis.cadastrados / totalLeads) * 100).toFixed(1) : 0;
            kpiConversao.textContent = `${taxa}%`;
        }

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

        const isPendente = lead.status_funil === 'Pendente';
        const mainAction = isPendente 
            ? `window.enviarWhatsAppCopy('${lead.id}', '${lead.telefone}', '${safeNome}', 'intro')`
            : `window.abrirModalZap('${lead.id}', '${lead.telefone}', '${safeNome}')`;
        const buttonText = isPendente ? 'Chamar' : 'Follow-up';
        const buttonTitle = isPendente ? 'Enviar 1º Contato (Intro)' : 'Enviar Follow-up';

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
                        <button class="lead-action-btn btn-zap" onclick="${mainAction}" title="${buttonTitle}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                            <span>${buttonText}</span>
                        </button>
                        
                        <!-- Botões Rápidos de Gestão -->
                        <button class="lead-action-btn btn-pause" onclick="window.alterarStatusLead('${lead.id}', 'Aguardando')" title="Colocar em Espera">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        </button>
                        <button class="lead-action-btn btn-convert" onclick="window.alterarStatusLead('${lead.id}', 'Cadastrado')" title="Marcar como Convertido">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>
                        </button>
                        <button class="lead-action-btn btn-delete" onclick="window.excluirLead('${lead.id}', '${safeNome}')" title="Remover // Recusou">
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

window.enviarCopiaDoModal = function(tipoCopy) {
    if (!window.leadAlvoAtual) return;
    const { id, telefone, nome } = window.leadAlvoAtual;
    window.enviarWhatsAppCopy(id, telefone, nome, tipoCopy);
    window.fecharModalZap();
};

window.enviarWhatsAppCopy = async function(id, telefone, nome, tipoCopy) {
    if (!id || !telefone || !nome || !tipoCopy) return;

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
        
        // NOVO: Previne a aba em branco ao voltar e força o WA Business no Android
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const isAndroid = /Android/i.test(navigator.userAgent);

        let whatsappUrl = `https://wa.me/${telefoneNum}?text=${encodeURIComponent(msgFinal)}`;

        if (isAndroid) {
            // Intent super restrito: Sem barra extra e sem fallback genérico para forçar o Business
            whatsappUrl = `intent://send?phone=${telefoneNum}&text=${encodeURIComponent(msgFinal)}#Intent;package=com.whatsapp.w4b;scheme=whatsapp;end`;
        }

        if (isMobile) {
            window.location.href = whatsappUrl;
        } else {
            window.open(whatsappUrl, '_blank');
        }

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
            if (window.showToast) window.showToast(`Mensagem para ${nome.split(' ')[0]} aberta no WhatsApp.`, 'success');
            window.carregarLeads(); // Recarrega a lista para refletir o novo status
        } else {
            if (window.showToast) window.showToast("Erro ao atualizar status do lead no sistema.", "error");
        }
    } catch (error) { console.error("Erro:", error); if (window.showToast) window.showToast("Erro ao abrir WhatsApp.", "error"); }
};

// Função para Mudar o Status Manualmente (Otimista - Sem Pop-up)
window.alterarStatusLead = async function(id, novoStatus) {
    const currentFilter = document.getElementById('filtro-funil').value;
    const row = document.getElementById(`lead-row-${id}`);

    // 1. UI Otimista (Atualiza a interface na hora sem recarregar)
    if (row) {
        if (currentFilter === 'pendentes' && novoStatus !== 'Pendente') {
            window.allLeads = window.allLeads.filter(l => String(l.id) !== String(id));
            row.style.opacity = '0'; 
            row.style.transition = 'opacity 0.3s ease'; 
            setTimeout(() => window.renderizarPaginaAtual(), 300);
        } else {
            const badgeCell = row.querySelector('[data-label="Status"]');
            if (badgeCell) {
                let badgeStatus = `<span class="status status-pending">Pendente</span>`;
                if (novoStatus === 'Contatado') badgeStatus = `<span class="status" style="background: #e0f2fe; color: #0284c7;">Contatado</span>`;
                else if (novoStatus === 'Aguardando') badgeStatus = `<span class="status status-aviso">Aguardando</span>`;
                else if (novoStatus === 'Cadastrado') badgeStatus = `<span class="status" style="background: #d1fae5; color: #059669;">Cadastrado</span>`;
                badgeCell.innerHTML = badgeStatus;
            }
            const lead = window.allLeads.find(l => String(l.id) === String(id));
            if (lead) lead.status_funil = novoStatus;
        }
        if (window.showToast) window.showToast(`Lead movido para: ${novoStatus}`);
    }

    // 2. Executa a chamada no servidor silenciosamente no background
    try {
        const BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : '';
        const req = await fetch(`${BASE_URL}/api/admin/leads/${id}/status`, { 
            method: 'PUT', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('Yelo_token')}` },
            body: JSON.stringify({ status: novoStatus })
        });

        if (!req.ok) {
            if (window.showToast) window.showToast("Erro ao confirmar status no servidor.", "warning");
        }
    } catch (e) {
        console.error(e);
        if (window.showToast) window.showToast("Erro de conexão com o servidor.", "error");
    }
};

// Função para Excluir Lead com botão "Desfazer"
window.excluirLead = function(id, nome) {
    const row = document.getElementById(`lead-row-${id}`);
    if (!row) return;

    // 1. UI Otimista (Esconde a linha suavemente na hora)
    row.style.opacity = '0';
    row.style.transform = 'translateX(-20px)';
    row.style.transition = 'all 0.3s ease';
    setTimeout(() => row.style.display = 'none', 300);

    let cancelado = false;
    
    // 2. Prepara o Toast de "Desfazer"
    let container = document.getElementById('pill-notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'pill-notification-container';
        document.body.appendChild(container);
    }

    const pill = document.createElement('div');
    pill.className = `pill-notification info`;
    pill.style.cssText = "display: flex; justify-content: space-between; align-items: center; gap: 15px; pointer-events: auto; min-width: 250px; background: rgba(27, 67, 50, 0.95); color: white; padding: 12px 20px; border-radius: 50px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); animation: slideUpToast 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; z-index: 999999;";
    
    pill.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
            <span class="icon">ℹ️</span> <span>Lead <strong>${nome.split(' ')[0]}</strong> excluído.</span>
        </div>
        <button id="btn-undo-${id}" style="background: rgba(255,255,255,0.2); color: #fff; border: 1px solid rgba(255,255,255,0.4); padding: 5px 14px; border-radius: 20px; cursor: pointer; font-weight: bold; font-size: 0.85rem; transition: background 0.2s;">Desfazer</button>
    `;
    
    container.appendChild(pill);

    // 3. Ação de Desfazer
    const undoBtn = pill.querySelector(`#btn-undo-${id}`);
    undoBtn.onclick = () => {
        cancelado = true;
        row.style.display = '';
        setTimeout(() => {
            row.style.opacity = '1';
            row.style.transform = 'none';
        }, 10);
        
        pill.style.opacity = '0';
        pill.style.transform = 'translateY(20px) scale(0.9)';
        setTimeout(() => pill.remove(), 300);
    };

    // 4. Timer para efetivar a exclusão no Backend após 4.5 segundos
    setTimeout(() => {
        if (pill.parentNode) {
            pill.style.opacity = '0';
            pill.style.transform = 'translateY(20px) scale(0.9)';
            setTimeout(() => pill.remove(), 300);
        }
        if (!cancelado) {
            window.allLeads = window.allLeads.filter(l => String(l.id) !== String(id));
            window.renderizarPaginaAtual(); // Recalcula a paginação
            
            const BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : '';
            fetch(`${BASE_URL}/api/admin/leads/${id}`, { 
                method: 'DELETE', 
                headers: { 'Authorization': `Bearer ${localStorage.getItem('Yelo_token')}` }
            }).catch(e => console.error("Erro ao excluir no backend:", e));
        }
    }, 4500);
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

// --- LÓGICA DO ROBÔ SCRAPER (MANUAL) ---
window.iniciarRoboScraper = async function() {
    const btn = document.getElementById('btn-cacar-leads');
    if (!btn) return;
    
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner-sm" style="margin-right: 5px; border-color: rgba(255,255,255,0.3); border-top-color: #fff;"></span> Caçando...';

    try {
        const BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : '';
        
        // Envia o comando POST para a controladora disparar o scraper no backend
        const req = await fetch(`${BASE_URL}/api/admin/leads/scrape`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('Yelo_token')}` }
        });

        const result = await req.json();

        if (req.ok) {
            if (window.showToast) window.showToast(result.message || 'Robô iniciado em segundo plano. Aguarde...', 'info');
            
            // Fallback de segurança: Reabilita o botão e recarrega a página após 2 minutos caso o WebSocket falhe
            setTimeout(() => {
                if (btn.disabled) {
                    btn.disabled = false;
                    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 5px;"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8" y2="16"></line><line x1="16" y1="16" x2="16" y2="16"></line></svg> Caçar Leads`;
                    window.carregarLeads(); 
                }
            }, 120000);
        } else {
            throw new Error(result.error || 'Erro ao iniciar robô.');
        }
    } catch (error) {
        console.error(error);
        if (window.showToast) window.showToast(error.message, 'error');
        btn.disabled = false;
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 5px;"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8" y2="16"></line><line x1="16" y1="16" x2="16" y2="16"></line></svg> Caçar Leads`;
    }
};

// Inicia automaticamente ao carregar
setTimeout(() => { 
    if (document.getElementById('lista-leads-body')) window.carregarLeads(); 
    
    // Escuta o evento do Socket.io do backend informando que a prospecção acabou
    if (window.adminSocket) {
        window.adminSocket.off('scraper_finished'); // Evita duplicação de listeners
        window.adminSocket.on('scraper_finished', (data) => {
            const btn = document.getElementById('btn-cacar-leads');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 5px;"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8" y2="16"></line><line x1="16" y1="16" x2="16" y2="16"></line></svg> Caçar Leads`;
            }

            if (data.success) {
                if (window.showToast) window.showToast(data.message, 'success');
                window.carregarLeads(); // Recarrega a tabela para mostrar os novos leads
            } else {
                if (window.showToast) window.showToast('Erro no robô: ' + data.message, 'error');
            }
        });
    }
}, 100);
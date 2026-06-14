window.initializePage = function() {
    // Dicionário Inteligente de Copys (Adequado para fechamento B2B)
    window.copysOutbound = {
        intro: `Olá, [PRIMEIRO NOME], como vai? Meu nome é *Anderson Costa*, também sou Psicólogo Clínico.\n\nVi que você faz atendimentos e fiquei curioso: como tem sido a captação de novos pacientes e a organização da sua rotina?\n\nPergunto porque sei o quanto é desgastante equilibrar os atendimentos com a gestão da agenda, a busca por pacientes, ter a formação em dia — coisas que a gente não aprende na graduação e que tomam um tempo precioso do que mais gostamos: _clinicar_.\n\nPor ter passado por isso, criei a *Yelo*, uma plataforma pensada para criar uma *comunidade* e ajudar colegas psicólogos/as a atrair mais pacientes e organizar melhor a rotina.\n\nSe fizer sentido pra você, te explico rapidamente por aqui mesmo (em duas mensagens) como funciona. Pode ser?`,
        
        pitch: `Maravilha, [PRIMEIRO NOME]! Serei bem direto, porque sei que a vida é corrida.\n\nA Yelo não é uma daquelas listas genéricas de profissionais. Nós construímos um Hub completo: o paciente responde a um questionário e nosso algoritmo faz o Match Inteligente, direcionando-o para a sua especialidade.\n\nAlém disso, a plataforma oferece ferramentas de gestão e troca de saberes 🤝:\n🧠 Fórum privado para discussões\n✍️ Blog para escrever aos usuários\n📊 Gestão financeira\n🌐 Página pública com endereço personalizado\n\nNa Yelo você tem total autonomia: define seus horários, valores, edita seu perfil, etc.\n\nComo estamos selecionando profissionais referência para esta fase, liberei **14 dias de acesso Premium gratuito para você testar na prática, sem precisar cadastrar nenhum cartão**. O que acha?\n\nwww.yelopsi.com.br/profissionais`,
        
        followup1: `Oi, [PRIMEIRO NOME], tudo bem?\n\nConseguiu dar uma olhada no link da Yelo que te enviei?\n\nGostaria muito de ter um colega com a sua visão na nossa rede. Nossos primeiros 14 dias Premium são totalmente sem custo **(e sem pedir cartão)** para você sentir como nossa gestão e nosso algoritmo podem te ajudar na captação de pacientes de forma ética.\n\nQualquer dúvida, estou à disposição!`,
        
        followup2: `Olá, [PRIMEIRO NOME]!\n\nSei perfeitamente como a rotina de consultório é engolida por sessões, então não quero tomar seu tempo.\n\nEstou passando rapidinho só para deixar nosso convite em aberto. Nosso objetivo com a Yelo é eliminar o ruído de marketing e burocracia para você focar no atendimento.\nSe fizer sentido conversar depois e testar a plataforma, me dá um alô por aqui ou vem nos conhecer em www.yelopsi.com.br/profissionais\n\nBons atendimentos!`
    };

    window.leadAlvoAtual = null;
    window.allLeads = [];
    window.currentLeadPage = 1;
    const LEADS_PER_PAGE = 20;

    // Estilos do painel injetados via JS de forma limpa
    if (!document.getElementById('lead-actions-style')) {
        const style = document.createElement('style');
        style.id = 'lead-actions-style';
        style.innerHTML = `
            .lead-actions-wrapper { display: flex; gap: 8px; justify-content: flex-end; align-items: center; flex-wrap: wrap; }
            .lead-action-btn { display: inline-flex; align-items: center; justify-content: center; border: none; cursor: pointer; transition: all 0.2s; flex-shrink: 0; }
            .lead-action-btn:hover { transform: scale(1.1) translateY(-2px); }
            .lead-action-btn.btn-zap { background-color: #dcfce7; color: #166534; padding: 8px 16px; border-radius: 50px; font-weight: 700; font-size: 0.85rem; gap: 6px; }
            .lead-action-btn.btn-zap:hover { background-color: #bbf7d0; }
            .lead-action-btn.btn-pause { background-color: #fef3c7; color: #d97706; width: 34px; height: 34px; border-radius: 50%; }
            .lead-action-btn.btn-convert { background-color: #e0f2fe; color: #0369a1; width: 34px; height: 34px; border-radius: 50%; }
            .lead-action-btn.btn-delete { background-color: #fee2e2; color: #b91c1c; width: 34px; height: 34px; border-radius: 50%; }
        `;
        document.head.appendChild(style);
    }

    // Inicializa Filtros em Formato de Pílula (CRM Tabs)
    document.querySelectorAll('.crm-pill').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.crm-pill').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const hiddenInput = document.getElementById('filtro-funil');
            if (hiddenInput) { hiddenInput.value = e.target.dataset.filter; window.carregarLeads(); }
        });
    });

    window.carregarLeads = async function() {
        const filtroFunil = document.getElementById('filtro-funil');
        const listaLeadsBody = document.getElementById('lista-leads-body');
        if (!filtroFunil || !listaLeadsBody) return;
        
        try {
            listaLeadsBody.innerHTML = `<tr><td colspan="5" class="loading-row" style="text-align: center; padding: 40px;"><span class="loading-spinner-sm"></span> Carregando Pipeline...</td></tr>`;
            
            const filtro = filtroFunil.value;
            const BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : '';
            const token = localStorage.getItem('Yelo_token');
            
            const response = await fetch(`${BASE_URL}/api/admin/leads?filtro=${filtro}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Falha ao buscar leads');
            const result = await response.json();
            
            // KPIs de Venda B2B
            document.getElementById('kpi-pendentes').textContent = result.kpis.pendentes;
            document.getElementById('kpi-contatados').textContent = result.kpis.contatados;
            document.getElementById('kpi-aguardando').textContent = result.kpis.aguardando;
            document.getElementById('kpi-cadastrados').textContent = result.kpis.cadastrados;

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
            listaLeadsBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--coral-quente); padding: 40px;">${error.message || 'Erro ao carregar pipeline. Tente novamente.'}</td></tr>`;
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
        if (totalPages <= 1) { paginationContainer.innerHTML = ''; return; }

        let html = `<button class="pagination-btn" ${window.currentLeadPage === 1 ? 'disabled' : ''} onclick="window.mudarPaginaLeads(${window.currentLeadPage - 1})">&laquo;</button>`;
        let startPage = Math.max(1, window.currentLeadPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);

        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="pagination-btn ${i === window.currentLeadPage ? 'active' : ''}" onclick="window.mudarPaginaLeads(${i})">${i}</button>`;
        }
        html += `<button class="pagination-btn" ${window.currentLeadPage === totalPages ? 'disabled' : ''} onclick="window.mudarPaginaLeads(${window.currentLeadPage + 1})">&raquo;</button>`;
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
            listaLeadsBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--cinza-texto);">Nenhum prospecto encontrado neste filtro.</td></tr>`;
            return;
        }

        listaLeadsBody.innerHTML = leads.map(lead => {
            let origemCurta = lead.origem_url;
            try { origemCurta = new URL(lead.origem_url).hostname; } catch(e) {}
            const safeNome = lead.nome ? lead.nome.replace(/'/g, "\\'").replace(/"/g, "&quot;") : 'Colega';

            let badgeStatus = `<span class="status status-pendente">Oportunidade Fria</span>`;
            if (lead.status_funil === 'Contatado') badgeStatus = `<span class="status" style="background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd;">Contatado</span>`;
            else if (lead.status_funil === 'Aguardando') badgeStatus = `<span class="status" style="background: #f3e8ff; color: #7e22ce; border: 1px solid #d8b4fe;">Em Negociação</span>`;
            else if (lead.status_funil === 'Cadastrado') badgeStatus = `<span class="status status-ativo">Assinante Confirmado</span>`;

            // Semáforo SLA de Atendimento
            let semaforo = '';
            if (lead.status_funil === 'Contatado' && lead.data_ultimo_contato) {
                const diasAtraso = Math.floor((new Date() - new Date(lead.data_ultimo_contato)) / (1000 * 60 * 60 * 24));
                if (diasAtraso >= 5) semaforo = `<span title="Mais de 5 dias sem contato! Mande a Despedida." style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:#ef4444; margin-right:8px; animation: pulse 2s infinite;"></span>`;
                else if (diasAtraso >= 2) semaforo = `<span title="Passou de 2 dias! Mande o Follow-up 1." style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:#f59e0b; margin-right:8px;"></span>`;
                else semaforo = `<span title="Contato recente." style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:#10b981; margin-right:8px;"></span>`;
            }

            const isPendente = lead.status_funil === 'Pendente';
            const mainAction = isPendente ? `window.enviarWhatsAppCopy('${lead.id}', '${lead.telefone}', '${safeNome}', 'intro')` : `window.abrirModalZap('${lead.id}', '${lead.telefone}', '${safeNome}')`;
            const buttonText = isPendente ? '1º Contato' : 'Fazer Follow-up';

            return `
                <tr id="lead-row-${lead.id}">
                    <td data-label="Prospecto" style="font-weight: 600; color: var(--verde-escuro); display: flex; align-items: center;">${semaforo}${lead.nome}</td>
                    <td data-label="Contato">${window.mascaraTelefoneLeads(lead.telefone)}</td>
                    <td data-label="Estágio">${badgeStatus}</td>
                    <td data-label="Origem"><a href="${lead.origem_url}" target="_blank" style="color: #666; font-size: 0.85rem;">${origemCurta || 'Desconhecida'}</a></td>
                    <td data-label="Ações B2B">
                        <div class="lead-actions-wrapper">
                            <button class="lead-action-btn btn-zap" onclick="${mainAction}" title="Acionar por WhatsApp">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                                <span>${buttonText}</span>
                            </button>
                            <button class="lead-action-btn btn-pause" onclick="window.alterarStatusLead('${lead.id}', 'Aguardando')" title="Mover para Negociação">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                            </button>
                            <button class="lead-action-btn btn-convert" onclick="window.alterarStatusLead('${lead.id}', 'Cadastrado')" title="Marcar como Convertido (Assinante)">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>
                            </button>
                            <button class="lead-action-btn btn-delete" onclick="window.excluirLead('${lead.id}', '${safeNome}')" title="Descartar (Perda)">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"></path><path d="M6 6l12 12"></path></svg>
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
        if (modal) { modal.classList.add('is-visible'); modal.style.display = 'flex'; }
    };

    window.fecharModalZap = function() {
        const modal = document.getElementById('modal-copy-whatsapp');
        if (modal) { modal.classList.remove('is-visible'); setTimeout(() => modal.style.display = 'none', 300); }
        window.leadAlvoAtual = null;
    };

    window.enviarCopiaDoModal = function(tipoCopy) {
        if (!window.leadAlvoAtual) return;
        window.enviarWhatsAppCopy(window.leadAlvoAtual.id, window.leadAlvoAtual.telefone, window.leadAlvoAtual.nome, tipoCopy);
        window.fecharModalZap();
    };

    window.enviarWhatsAppCopy = async function(id, telefone, nome, tipoCopy) {
        if (!id || !telefone || !nome || !tipoCopy) return;
        try {
            let telefoneNum = telefone.replace(/\D/g, '');
            if (telefoneNum.length === 10 || telefoneNum.length === 11) telefoneNum = '55' + telefoneNum;

            let primeiroNome = nome.trim().split(' ')[0];
            if (primeiroNome.includes('Psicólogo')) primeiroNome = 'colega';
            
            // URL com UTMs para rastrear a adesão B2B do psicólogo via WhatsApp do Admin
            const linkMagico = `yelopsi.com.br/profissionais?utm_source=crm_outbound&utm_medium=whatsapp&utm_campaign=${telefoneNum}`;
            const msgFinal = window.copysOutbound[tipoCopy].replace(/\[PRIMEIRO NOME\]/g, primeiroNome).replace(/www\.yelopsi\.com\.br\/profissionais/g, linkMagico);
            
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            let whatsappUrl = `https://wa.me/${telefoneNum}?text=${encodeURIComponent(msgFinal)}`;
            if (/Android/i.test(navigator.userAgent)) whatsappUrl = `intent://send?phone=${telefoneNum}&text=${encodeURIComponent(msgFinal)}#Intent;package=com.whatsapp.w4b;scheme=whatsapp;end`;

            if (isMobile) window.location.href = whatsappUrl;
            else window.open(whatsappUrl, '_blank');

            const req = await fetch(`${window.API_BASE_URL || ''}/api/admin/leads/${id}/contato`, { 
                method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('Yelo_token')}` } 
            });
            if (req.ok) {
                if (window.showToast) window.showToast('Registrado no CRM. Contato iniciado.', 'success');
                window.carregarLeads();
            }
        } catch (error) { if (window.showToast) window.showToast("Erro de comunicação.", "error"); }
    };

    window.alterarStatusLead = async function(id, novoStatus) {
        const row = document.getElementById(`lead-row-${id}`);
        if (row) {
            const badgeCell = row.querySelector('[data-label="Estágio"]');
            if (badgeCell) badgeCell.innerHTML = `<span class="status status-aviso">Atualizando...</span>`;
        }
        try {
            const req = await fetch(`${window.API_BASE_URL || ''}/api/admin/leads/${id}/status`, { 
                method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('Yelo_token')}` }, body: JSON.stringify({ status: novoStatus })
            });
            if (req.ok) {
                if (window.showToast) window.showToast(`Lead movido para: ${novoStatus}`);
                window.carregarLeads();
            }
        } catch (e) { if (window.showToast) window.showToast("Erro de conexão.", "error"); }
    };

    window.excluirLead = function(id, nome) {
        const row = document.getElementById(`lead-row-${id}`);
        if (!row) return;
        row.style.opacity = '0';
        row.style.transform = 'translateX(-20px)';
        row.style.transition = 'all 0.3s ease';
        setTimeout(() => row.style.display = 'none', 300);

        let cancelado = false;
        let container = document.getElementById('pill-notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'pill-notification-container';
            document.body.appendChild(container);
        }
        const pill = document.createElement('div');
        pill.style.cssText = "display: flex; justify-content: space-between; align-items: center; gap: 15px; position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: #1B4332; color: white; padding: 12px 25px; border-radius: 50px; z-index: 999999;";
        pill.innerHTML = `<div>❌ Lead <strong>${nome.split(' ')[0]}</strong> descartado.</div><button id="btn-undo-${id}" style="background: rgba(255,255,255,0.2); color: white; border: none; padding: 5px 15px; border-radius: 20px; cursor: pointer;">Desfazer</button>`;
        container.appendChild(pill);

        pill.querySelector(`#btn-undo-${id}`).onclick = () => {
            cancelado = true;
            row.style.display = '';
            setTimeout(() => { row.style.opacity = '1'; row.style.transform = 'none'; }, 10);
            pill.remove();
        };

        setTimeout(() => {
            if (pill.parentNode) pill.remove();
            if (!cancelado) {
                fetch(`${window.API_BASE_URL || ''}/api/admin/leads/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('Yelo_token')}` } })
                .then(() => { window.carregarLeads(); });
            }
        }, 4000);
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
        let csvContent = "\uFEFFProfissional;Contato;Estágio;Origem\n";
        linhas.forEach((linha, index) => {
            if (index === 0 || linha.cells.length < 4) return; 
            const nome = linha.cells[0].innerText.replace(/;/g, '');
            const telefone = linha.cells[1].innerText;
            const status = linha.cells[2].innerText;
            const origem = linha.cells[3].innerText.replace(/;/g, '');
            csvContent += `"${nome}";"${telefone}";"${status}";"${origem}"\n`;
        });
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.setAttribute("href", URL.createObjectURL(blob));
        link.setAttribute("download", `pipeline_leads_b2b_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    window.iniciarRoboScraper = async function() {
        const btn = document.getElementById('btn-cacar-leads');
        if (!btn) return;
        btn.disabled = true;
        btn.innerHTML = '<span class="loading-spinner-sm" style="margin-right: 5px;"></span> Capturando...';

        try {
            const req = await fetch(`${window.API_BASE_URL || ''}/api/admin/leads/scrape`, { 
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('Yelo_token')}` }
            });
            if (req.ok) {
                if (window.showToast) window.showToast('Robô de aquisição iniciado em segundo plano.', 'info');
                setTimeout(() => { if (btn.disabled) { btn.disabled = false; btn.innerHTML = `Caçar Prospectos`; window.carregarLeads(); } }, 60000);
            } else throw new Error();
        } catch (e) {
            if (window.showToast) window.showToast("Falha ao iniciar robô scraper.", "error");
            btn.disabled = false; btn.innerHTML = `Caçar Prospectos`;
        }
    };

    // Execução inicial
    setTimeout(() => { window.carregarLeads(); }, 100);
};
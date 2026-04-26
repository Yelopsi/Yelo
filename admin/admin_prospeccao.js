// admin/admin_prospeccao.js

// Mensagem padrão de prospecção
window.mensagemPadrao = `Olá, [PRIMEIRO NOME], como vai? 🙂

Meu nome é *Anderson Costa*, também atuo como Psicólogo Clínico.

Vi que você faz atendimentos clínicos e fiquei curioso: como você tem sido a captação de clientes e a organização das burocracias da clínica no dia a dia?

Pergunto porque sei o quanto é desgastante equilibrar os atendimentos com a gestão da agenda, confirmações das sessões, a busca por novos pacientes, ter a formação em dia — coisas que a gente não aprende direito na graduação e acabam tomando tempo precioso do que mais gostamos: _clinicar_.

Por ter passado por isso, criei a *Yelo*, uma plataforma pensada para criar uma *comunidade* e ajudar colegas psicólogos/as a atrair mais pacientes, organizar melhor a rotina e trocar mais experiências valiosas.

Se fizer sentido pra você, te explico rapidamente por aqui mesmo como funciona. Pode ser?`;

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
        
        const leads = await response.json();
        window.renderizarLeads(leads);

    } catch (error) {
        console.error('Erro ao carregar leads:', error);
        listaLeadsBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #E63946;">${error.message || 'Erro ao carregar leads. Tente novamente.'}</td></tr>`;
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

        let badgeStatus = `<span class="status status-pending">Pendente</span>`;
        if (lead.status_funil === 'Contatado') badgeStatus = `<span class="status" style="background: #e0f2fe; color: #0284c7;">Contatado</span>`;
        else if (lead.status_funil === 'Aguardando') badgeStatus = `<span class="status status-aviso">Aguardando</span>`;

        return `
            <tr id="lead-row-${lead.id}">
                <td data-label="Nome" style="font-weight: 600; color: #333;">${lead.nome}</td>
                <td data-label="Telefone">${window.mascaraTelefoneLeads(lead.telefone)}</td>
                <td data-label="Status">${badgeStatus}</td>
                <td data-label="Origem">
                    <a href="${lead.origem_url}" target="_blank" style="color: #1B4332; font-size: 0.85rem;">
                        ${origemCurta || 'Desconhecida'}
                    </a>
                </td>
                <td data-label="Ações">
                    <button class="btn btn-primario btn-sm" onclick="enviarWhatsApp('${lead.id}', '${lead.telefone}', '${lead.nome}')" style="display: flex; align-items: center; gap: 5px; margin: 0 auto;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                        Enviar WhatsApp
                    </button>
                </td>
            </tr>
        `;
    }).join('');
};

window.enviarWhatsApp = async function(id, telefoneRaw, nome) {
    try {
        let telefoneNum = telefoneRaw.replace(/\D/g, '');
        if (telefoneNum.length === 10 || telefoneNum.length === 11) { telefoneNum = '55' + telefoneNum; }

        // Pega apenas o primeiro nome e evita que a variável fique "Psicólogo(a)"
        let primeiroNome = nome.trim().split(' ')[0];
        if (primeiroNome.includes('Psicólogo')) primeiroNome = 'colega';
        
        const msgFinal = window.mensagemPadrao.replace('[PRIMEIRO NOME]', primeiroNome);
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
                row.style.opacity = '0'; row.style.transition = 'opacity 0.3s ease'; setTimeout(() => row.remove(), 300);
            } else { window.carregarLeads(); }
        }
    } catch (error) { console.error("Erro:", error); alert("Erro ao atualizar status do lead no sistema."); }
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
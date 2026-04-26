// admin/admin_prospeccao.js

// Mensagem padrão de prospecção
window.mensagemPadrao = encodeURIComponent(
    "Olá, tudo bem? Sou da Yelo Saúde Mental e vi o seu perfil profissional. Acredito que a sua abordagem combina muito com os pacientes que buscam ajuda na nossa plataforma. Gostaria de apresentar a Yelo para você. Tem um minutinho?"
);

window.carregarLeads = async function() {
    const filtroFunil = document.getElementById('filtro-funil');
    const listaLeadsBody = document.getElementById('lista-leads-body');
    
    if (!filtroFunil || !listaLeadsBody) return;
    
    try {
        listaLeadsBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 30px; color: #888;">Carregando leads...</td></tr>`;
        
        const filtro = filtroFunil.value;
        const BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : '';
        
        const response = await fetch(`${BASE_URL}/api/admin/leads?filtro=${filtro}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) throw new Error('Falha ao buscar leads');
        
        const leads = await response.json();
        window.renderizarLeads(leads);

    } catch (error) {
        console.error('Erro ao carregar leads:', error);
        listaLeadsBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #E63946;">Erro ao carregar leads. Tente novamente.</td></tr>`;
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

        window.open(`https://wa.me/${telefoneNum}?text=${window.mensagemPadrao}`, '_blank');

        const BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : '';
        const req = await fetch(`${BASE_URL}/api/admin/leads/${id}/contato`, { method: 'PUT', headers: { 'Content-Type': 'application/json' } });

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

// Inicia automaticamente ao carregar
setTimeout(() => { if (document.getElementById('lista-leads-body')) window.carregarLeads(); }, 100);
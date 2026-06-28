// Lógica para a página de Lista de Espera

window.initializePage = function() {
    const tableBody = document.getElementById('waiting-list-body');
    const rowTemplate = document.getElementById('waiting-list-row-template');
    const token = localStorage.getItem('Yelo_token'); 

    if (!tableBody || !rowTemplate || !token) {
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="6" class="error-row">Erro ao carregar a página. Faça login novamente.</td></tr>';
        return;
    }

    let allData = [];
    const statusInput = document.getElementById('crm-status-espera');
    const searchInput = document.getElementById('search-input');

    // Inicializa Filtros em Formato de Pílula
    document.querySelectorAll('.crm-pill').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.crm-pill').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            if (statusInput) statusInput.value = e.target.dataset.filter;
            renderList();
        });
    });

    if (searchInput) {
        searchInput.addEventListener('keyup', renderList);
    }

    // Função para mostrar notificações (toast)
    function showToast(message, type = 'success') {
        if (window.showToast) window.showToast(message, type);
    }

    // Função para buscar e renderizar a lista
    async function fetchWaitingList() {
        try {
            const response = await fetch('/api/psychologists/waiting-list', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Falha ao buscar dados da lista de espera.');
            }

            allData = await response.json();
            renderList();

        } catch (error) {
            console.error(error);
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--coral-quente);">${error.message}</td></tr>`;
        }
    }

    function renderList() {
        tableBody.innerHTML = ''; 

        const search = searchInput ? searchInput.value.toLowerCase() : '';
        const filter = statusInput ? statusInput.value : 'all';

        const filteredList = allData.filter(c => {
            if (filter !== 'all' && c.status !== filter) return false;
            if (search) {
                const searchStr = search.toLowerCase();
                const nome = c.nome ? c.nome.toLowerCase() : '';
                const email = c.email ? c.email.toLowerCase() : '';
                if (!nome.includes(searchStr) && !email.includes(searchStr)) return false;
            }
            return true;
        });

        if (filteredList.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--cinza-texto);">Nenhum lead encontrado com estes filtros.</td></tr>';
            return;
        }

        filteredList.forEach(candidate => {
                const row = rowTemplate.content.cloneNode(true).querySelector('tr');
                row.querySelector('[data-label="Nome"]').innerHTML = `
                    <div style="font-weight: 600; color: var(--verde-escuro); display: flex; align-items: center; gap: 8px;">
                        <div style="width: 32px; height: 32px; border-radius: 50%; background-color: #f0fdf4; color: var(--verde-escuro); display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.85rem;">
                            ${candidate.nome.charAt(0).toUpperCase()}
                        </div>
                        <span>${candidate.nome}</span>
                    </div>
                `;
                row.querySelector('[data-label="Email"]').innerHTML = `<span style="color: #555;">${candidate.email}</span>`;
                row.querySelector('[data-label="CRP"]').innerHTML = `<span style="color: #666; font-size: 0.9rem;">${candidate.crp || 'N/A'}</span>`;
                
                const statusBadge = row.querySelector('.status-badge');
                statusBadge.textContent = candidate.status === 'pending' ? 'Pendente' : (candidate.status === 'invited' ? 'Convidado' : candidate.status);
                statusBadge.className = `status status-${candidate.status === 'invited' ? 'ativo' : 'pendente'}`;

                row.querySelector('[data-label="Data de Entrada"]').innerHTML = `<span style="color: #666; font-size: 0.9rem;">${new Date(candidate.createdAt).toLocaleDateString('pt-BR')}</span>`;

                const actionsCell = row.querySelector('[data-label="Ações"]');
                if (candidate.status === 'pending' || candidate.status === 'invited') {
                    const firstName = candidate.nome ? candidate.nome.split(' ')[0] : 'Profissional';
                    const text = `Olá ${firstName}! Tudo bem? Aqui é da equipe da Yelo. Vimos que você iniciou o seu cadastro na plataforma mas acabou não finalizando. Ficou alguma dúvida ou teve alguma dificuldade? Estamos à disposição para ajudar!`;
                    let phone = candidate.telefone ? candidate.telefone.replace(/\D/g, '') : '';
                    
                    if (phone && (phone.length === 10 || phone.length === 11)) { phone = '55' + phone; }
                    const url = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : '#';

                    const whatsappButton = document.createElement('button');
                    whatsappButton.className = 'btn-tabela btn-fixar';
                    
                    // Estilos focados também na usabilidade Mobile (App-like)
                    whatsappButton.style.display = 'inline-flex';
                    whatsappButton.style.alignItems = 'center';
                    whatsappButton.style.justifyContent = 'center';
                    whatsappButton.style.gap = '6px';
                    whatsappButton.style.padding = '8px 16px';
                    whatsappButton.style.borderRadius = '50px';
                    whatsappButton.style.border = 'none';
                    whatsappButton.style.cursor = 'pointer';
                    whatsappButton.style.fontWeight = '600';
                    whatsappButton.style.whiteSpace = 'nowrap'; // Impede o texto de quebrar linha
                    
                    // Verifica se a mensagem já foi enviada usando a memória local do navegador (criado no admin.js)
                    const foiEnviado = window.verificarWppEnviado && window.verificarWppEnviado(candidate.id);
                    if (foiEnviado || candidate.status === 'invited') {
                        whatsappButton.style.backgroundColor = '#dcfce7';
                        whatsappButton.style.color = '#166534';
                        whatsappButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Enviado`;
                    } else {
                        whatsappButton.style.backgroundColor = '#e0f2fe';
                        whatsappButton.style.color = '#0369a1';
                        whatsappButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg> WhatsApp`;
                    }

                    whatsappButton.onclick = async (event) => {
                        event.preventDefault();
                        if (!phone) {
                            showToast('Telefone não disponível ou inválido para este profissional.', 'error');
                            return;
                        }
                        
                        // Registra na memória sem bloquear o clique nativo do <a> (Evita bloqueadores de pop-up no mobile)
                        let sent = JSON.parse(localStorage.getItem('yelo_wpp_sent_pending') || '[]');
                        if (!sent.includes(String(candidate.id))) {
                            sent.push(String(candidate.id));
                            localStorage.setItem('yelo_wpp_sent_pending', JSON.stringify(sent));
                        }
                        
                        try {
                            await fetch(`/api/admin/waiting-list/${candidate.id}/status`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                body: JSON.stringify({ status: 'invited' })
                            });
                            candidate.status = 'invited';
                        } catch(e) {}

                        // Atualização visual imediata
                        whatsappButton.style.backgroundColor = '#dcfce7';
                        whatsappButton.style.color = '#166534';
                        whatsappButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Enviado`;
                        
                        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                        if (isMobile) window.location.href = url;
                        else window.open(url, '_blank');
                    };
                    actionsCell.appendChild(whatsappButton);
                    
                    // Botão de Excluir
                    const deleteButton = document.createElement('button');
                    deleteButton.className = 'btn-tabela btn-fixar';
                    deleteButton.style.display = 'inline-flex';
                    deleteButton.style.alignItems = 'center';
                    deleteButton.style.justifyContent = 'center';
                    deleteButton.style.gap = '6px';
                    deleteButton.style.padding = '8px 16px';
                    deleteButton.style.borderRadius = '50px';
                    deleteButton.style.border = 'none';
                    deleteButton.style.cursor = 'pointer';
                    deleteButton.style.fontWeight = '600';
                    deleteButton.style.whiteSpace = 'nowrap';
                    deleteButton.style.backgroundColor = '#fee2e2';
                    deleteButton.style.color = '#b91c1c';
                    deleteButton.style.marginLeft = '8px';
                    deleteButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg> Excluir`;
                    
                    deleteButton.onclick = async (e) => {
                        e.preventDefault();
                        if (confirm('Tem certeza que deseja excluir este lead? Essa ação não pode ser desfeita.')) {
                            try {
                                const res = await fetch(`/api/psychologists/waiting-list/${candidate.id}`, {
                                    method: 'DELETE',
                                    headers: { 'Authorization': `Bearer ${token}` }
                                });
                                if (res.ok) {
                                    showToast('Lead excluído com sucesso', 'success');
                                    fetchWaitingList(); // recarrega a lista
                                } else {
                                    showToast('Erro ao excluir lead', 'error');
                                }
                            } catch(err) {
                                showToast('Erro ao excluir lead', 'error');
                            }
                        }
                    };
                    actionsCell.appendChild(deleteButton);
                } else {
                    actionsCell.innerHTML = '<span style="color: #999; font-size: 0.85rem;">Já cadastrado</span>';
                }

                tableBody.appendChild(row);
            });
    }

    fetchWaitingList();
};
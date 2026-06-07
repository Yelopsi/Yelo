// Lógica para a página de Lista de Espera

window.initializePage = function() {
    const tableBody = document.getElementById('waiting-list-body');
    const rowTemplate = document.getElementById('waiting-list-row-template');
    const token = localStorage.getItem('Yelo_token'); // Supondo que o token de admin esteja salvo

    if (!tableBody || !rowTemplate || !token) {
        console.error("Elementos essenciais ou token não encontrados para a página da lista de espera.");
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="6" class="error-row">Erro ao carregar a página. Faça login novamente.</td></tr>';
        return;
    }

    // Função para mostrar notificações (toast)
    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const template = document.getElementById('toast-template');
        if (!container || !template) return;

        const toast = template.content.cloneNode(true).querySelector('.toast');
        toast.textContent = message;
        toast.classList.add(`toast-${type}`);
        container.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 4500);
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

            const waitingList = await response.json();
            tableBody.innerHTML = ''; // Limpa o estado de "carregando"

            if (waitingList.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="6" class="empty-row">A lista de espera está vazia.</td></tr>';
                return;
            }

            waitingList.forEach(candidate => {
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

                    // Usando a tag de link <a> para o navegador abrir a aba do WhatsApp sozinho
                    const whatsappButton = document.createElement('a');
                    whatsappButton.className = 'btn-tabela btn-fixar';
                    whatsappButton.href = url;
                    if (phone) whatsappButton.target = '_blank';
                    
                    // Estilos focados também na usabilidade Mobile (App-like)
                    whatsappButton.style.display = 'inline-flex';
                    whatsappButton.style.alignItems = 'center';
                    whatsappButton.style.justifyContent = 'center';
                    whatsappButton.style.gap = '6px';
                    whatsappButton.style.padding = '8px 16px';
                    whatsappButton.style.borderRadius = '20px';
                    whatsappButton.style.border = 'none';
                    whatsappButton.style.cursor = 'pointer';
                    whatsappButton.style.textDecoration = 'none';
                    whatsappButton.style.fontWeight = '600';
                    whatsappButton.style.whiteSpace = 'nowrap'; // Impede o texto de quebrar linha
                    
                    // Verifica se a mensagem já foi enviada usando a memória local do navegador (criado no admin.js)
                    const foiEnviado = window.verificarWppEnviado && window.verificarWppEnviado(candidate.id);
                    if (foiEnviado) {
                        whatsappButton.style.backgroundColor = '#d1fae5';
                        whatsappButton.style.color = '#059669';
                        whatsappButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Enviado`;
                    } else {
                        whatsappButton.style.backgroundColor = '#128C7E';
                        whatsappButton.style.color = '#fff';
                        whatsappButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg> WhatsApp`;
                    }

                    whatsappButton.onclick = (event) => {
                        if (!phone) {
                            event.preventDefault();
                            showToast('Telefone não disponível ou inválido para este profissional.', 'error');
                            return;
                        }
                        
                        // Registra na memória sem bloquear o clique nativo do <a> (Evita bloqueadores de pop-up no mobile)
                        let sent = JSON.parse(localStorage.getItem('yelo_wpp_sent_pending') || '[]');
                        if (!sent.includes(String(candidate.id))) {
                            sent.push(String(candidate.id));
                            localStorage.setItem('yelo_wpp_sent_pending', JSON.stringify(sent));
                        }
                        
                        // Atualização visual imediata
                        whatsappButton.style.backgroundColor = '#d1fae5';
                        whatsappButton.style.color = '#059669';
                        whatsappButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Enviado`;
                    };
                    actionsCell.appendChild(whatsappButton);
                } else {
                    actionsCell.innerHTML = '<span style="color: #999; font-size: 0.85rem;">Já cadastrado</span>';
                }

                tableBody.appendChild(row);
            });

        } catch (error) {
            console.error(error);
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--coral-quente);">${error.message}</td></tr>`;
        }
    }

    fetchWaitingList();
};
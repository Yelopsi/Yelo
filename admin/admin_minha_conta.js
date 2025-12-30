window.initializePage = function() {
    const token = localStorage.getItem('Yelo_token');

    const formDados = document.getElementById('form-dados-admin');
    const formSenha = document.getElementById('form-senha-admin');

    const nomeInput = document.getElementById('admin-nome');
    const emailInput = document.getElementById('admin-email');
    const telefoneInput = document.getElementById('admin-telefone');
    const photoPreview = document.getElementById('admin-profile-photo-preview');
    const photoUploadInput = document.getElementById('admin-photo-upload');

    // --- 1. CONFIGURAÇÃO INICIAL (ESTADO BLOQUEADO) ---
    const inputsDados = [nomeInput, emailInput, telefoneInput, photoUploadInput];
    const btnDados = formDados ? formDados.querySelector('button[type="submit"]') : null;
    
    const inputsSenha = [
        document.getElementById('admin-senha-atual'),
        document.getElementById('admin-nova-senha'),
        document.getElementById('admin-confirmar-senha')
    ];
    const btnSenha = formSenha ? formSenha.querySelector('button[type="submit"]') : null;

    // Desabilita campos de dados e ajusta botão
    inputsDados.forEach(input => { if(input) input.disabled = true; });
    if (btnDados) { btnDados.textContent = 'Alterar Dados'; }

    // Desabilita campos de senha e ajusta botão
    inputsSenha.forEach(input => { if(input) input.disabled = true; });
    if (btnSenha) { btnSenha.textContent = 'Alterar Senha'; }
    // --------------------------------------------------

    if (!formDados || !formSenha || !token) {
        console.error("Elementos do formulário ou token não encontrados.");
        return;
    }

    // Aplica máscara de telefone
    if (window.IMask && telefoneInput) {
        IMask(telefoneInput, { mask: '(00) 00000-0000' });
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

        setTimeout(() => toast.remove(), 4500);
    }

    // Busca e preenche os dados do admin
    async function fetchAdminData() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Falha ao buscar dados do administrador.');

            const admin = await response.json();
            nomeInput.value = admin.nome || '';
            emailInput.value = admin.email || '';
            telefoneInput.value = admin.telefone || '';
            if (admin.fotoUrl) {
                // A URL da imagem agora é relativa à origem
                photoPreview.src = `${API_BASE_URL}${admin.fotoUrl}`;
            }

        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    // Evento para salvar dados pessoais
    formDados.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = formDados.querySelector('button[type="submit"]');
        
        // LÓGICA DE ALTERNAR (HABILITAR EDIÇÃO)
        if (nomeInput.disabled) {
            inputsDados.forEach(input => { if(input) input.disabled = false; });
            button.textContent = 'Salvar Alterações';
            return; // Interrompe aqui para o usuário editar
        }

        button.disabled = true;
        button.textContent = 'Salvando...';

        const payload = {
            nome: nomeInput.value,
            email: emailInput.value,
            telefone: telefoneInput.value
        };

        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/me`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);

            showToast(result.message, 'success');

            // SUCESSO: Bloqueia os campos e reverte o botão
            inputsDados.forEach(input => { if(input) input.disabled = true; });
            button.textContent = 'Alterar Dados';

            // Recarrega os dados do servidor para confirmar visualmente que o valor foi salvo
            await fetchAdminData();

            // Dispara um evento customizado para notificar outras partes da UI (como o header)
            // Enviando o novo nome para que o admin.js possa atualizar a sidebar.
            window.dispatchEvent(new CustomEvent('adminDataUpdated', { detail: { nome: nomeInput.value } }));

        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            button.disabled = false;
            // Se ocorreu erro (campos ainda abertos), mantém texto de salvar
            if (!nomeInput.disabled) button.textContent = 'Salvar Alterações';
        }
    });

    // Evento para alterar senha
    formSenha.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = formSenha.querySelector('button[type="submit"]');

        // LÓGICA DE ALTERNAR (HABILITAR EDIÇÃO)
        if (inputsSenha[0].disabled) {
            inputsSenha.forEach(input => { if(input) input.disabled = false; });
            button.textContent = 'Salvar Nova Senha';
            return;
        }

        button.disabled = true;
        button.textContent = 'Alterando...';

        const senhaAtual = document.getElementById('admin-senha-atual').value;
        const novaSenha = document.getElementById('admin-nova-senha').value;
        const confirmarSenha = document.getElementById('admin-confirmar-senha').value;

        if (novaSenha !== confirmarSenha) {
            showToast('A nova senha e a confirmação não coincidem.', 'error');
            button.disabled = false;
            button.textContent = 'Salvar Nova Senha';
            return;
        }

        const payload = {
            senha_atual: senhaAtual,
            nova_senha: novaSenha
        };

        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/me/password`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);

            showToast(result.message, 'success');
            formSenha.reset();

            // SUCESSO: Bloqueia novamente
            inputsSenha.forEach(input => { if(input) input.disabled = true; });
            button.textContent = 'Alterar Senha';

        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            button.disabled = false;
            if (!inputsSenha[0].disabled) button.textContent = 'Salvar Nova Senha';
        }
    });

    // Evento para lidar com a seleção de nova foto
    photoUploadInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Mostra um preview instantâneo da imagem selecionada
        const reader = new FileReader();
        reader.onload = (event) => {
            photoPreview.src = event.target.result;
        };
        reader.readAsDataURL(file);

        // Envia a imagem para o backend
        const formData = new FormData();
        formData.append('profilePhoto', file);

        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/me/photo`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData // Não defina 'Content-Type', o browser faz isso automaticamente para FormData
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error);

            showToast(result.message, 'success');
            // Atualiza a foto no menu lateral também
            const sidebarPhoto = document.querySelector('#admin-avatar');
            if (sidebarPhoto) {
                sidebarPhoto.src = `${API_BASE_URL}${result.fotoUrl}`;
            }

        } catch (error) {
            showToast(error.message, 'error');
        }
    });

    // Inicia a página buscando os dados
    fetchAdminData();
};
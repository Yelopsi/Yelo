window.initializePage = async function() {
    const token = localStorage.getItem('Yelo_token');
    const API_BASE_URL = window.API_BASE_URL || 'http://localhost:3001';

    // Elementos do DOM
    const nomeInput = document.getElementById('psi-nome');
    const emailInput = document.getElementById('psi-email');
    const telefoneInput = document.getElementById('psi-telefone');
    const crpInput = document.getElementById('psi-crp');
    const cidadeInput = document.getElementById('psi-cidade');
    const estadoInput = document.getElementById('psi-estado');
    const bioInput = document.getElementById('psi-bio');
    const photoPreview = document.getElementById('psi-photo-preview');
    const photoInput = document.getElementById('profilePhotoInput');

    // 1. Carregar Dados do Psicólogo
    try {
        const response = await fetch(`${API_BASE_URL}/api/psychologists/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // Preenche os campos
            nomeInput.value = data.nome || '';
            emailInput.value = data.email || '';
            telefoneInput.value = data.telefone || '';
            crpInput.value = data.crp || '';
            cidadeInput.value = data.cidade || '';
            estadoInput.value = data.estado || '';
            bioInput.value = data.bio || '';

            if (data.fotoUrl) {
                photoPreview.src = data.fotoUrl;
            }

            // Aplica máscara no telefone se disponível
            if (window.IMask) {
                IMask(telefoneInput, { mask: '(00) 00000-0000' });
            }
        }
    } catch (error) {
        console.error("Erro ao carregar perfil:", error);
        if(window.showToast) window.showToast('Erro ao carregar dados.', 'error');
    }

    // 2. Upload de Foto
    photoInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('profilePhoto', file); // Nome do campo esperado pelo Multer

        // Feedback visual imediato
        photoPreview.style.opacity = '0.5';

        try {
            const res = await fetch(`${API_BASE_URL}/api/psychologists/me/photo`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (res.ok) {
                const data = await res.json();
                photoPreview.src = data.fotoUrl; // Atualiza com a URL retornada
                if(window.showToast) window.showToast('Foto atualizada com sucesso!', 'success');
                
                // Atualiza a foto na sidebar também (se existir)
                const sidebarPhoto = document.getElementById('psi-sidebar-photo');
                if(sidebarPhoto) sidebarPhoto.src = data.fotoUrl;
            } else {
                throw new Error('Falha no upload');
            }
        } catch (error) {
            console.error(error);
            if(window.showToast) window.showToast('Erro ao enviar foto.', 'error');
        } finally {
            photoPreview.style.opacity = '1';
        }
    });

    // 3. Salvar Dados do Perfil
    document.getElementById('form-perfil-psi').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        const originalText = btn.textContent;
        btn.textContent = 'Salvando...';
        btn.disabled = true;

        try {
            const payload = {
                nome: nomeInput.value,
                email: emailInput.value,
                telefone: telefoneInput.value,
                cidade: cidadeInput.value,
                estado: estadoInput.value,
                bio: bioInput.value
            };

            const res = await fetch(`${API_BASE_URL}/api/psychologists/me`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                if(window.showToast) window.showToast('Perfil atualizado com sucesso!', 'success');
                // Atualiza nome na sidebar
                const sidebarName = document.getElementById('psi-sidebar-name');
                if(sidebarName) sidebarName.textContent = payload.nome;
            } else {
                const err = await res.json();
                if(window.showToast) window.showToast(err.error || 'Erro ao atualizar.', 'error');
            }
        } catch (error) {
            if(window.showToast) window.showToast('Erro de conexão.', 'error');
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    });

    // 4. Alterar Senha
    document.getElementById('form-senha-psi').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nova = document.getElementById('nova-senha').value;
        const confirm = document.getElementById('confirmar-senha').value;

        if (nova !== confirm) {
            return window.showToast ? window.showToast('As senhas não coincidem.', 'error') : alert('Senhas não conferem');
        }

        try {
            const res = await fetch(`${API_BASE_URL}/api/psychologists/me/password`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ senha: nova })
            });

            if (res.ok) {
                if(window.showToast) window.showToast('Senha alterada com sucesso!', 'success');
                e.target.reset();
            } else {
                if(window.showToast) window.showToast('Erro ao alterar senha.', 'error');
            }
        } catch (error) {
            if(window.showToast) window.showToast('Erro de conexão.', 'error');
        }
    });

    // 5. Excluir Conta
    document.getElementById('btn-excluir-conta').addEventListener('click', () => {
        if (confirm('Tem certeza absoluta? Esta ação é irreversível e apagará todos os seus dados.')) {
            fetch(`${API_BASE_URL}/api/psychologists/me`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            }).then(() => {
                alert('Sua conta foi excluída.');
                window.location.href = '/login.html';
            });
        }
    });
};
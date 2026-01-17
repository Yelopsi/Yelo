window.initializePage = async function() {
    const token = localStorage.getItem('Yelo_token');
    const API_BASE_URL = window.API_BASE_URL || 'http://localhost:3001';

    // Elementos
    const nomeInput = document.getElementById('admin-nome');
    const emailInput = document.getElementById('admin-email');
    const telefoneInput = document.getElementById('admin-telefone');
    const photoPreview = document.getElementById('admin-photo-preview');
    const photoInput = document.getElementById('profilePhoto');

    // 1. Carregar Dados
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            nomeInput.value = data.nome || '';
            emailInput.value = data.email || '';
            telefoneInput.value = data.telefone || '';
            if (data.fotoUrl) photoPreview.src = data.fotoUrl;
        }
    } catch (error) {
        console.error("Erro ao carregar perfil:", error);
    }

    // 2. Salvar Dados Básicos
    document.getElementById('form-perfil-admin').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        const originalText = btn.textContent;
        btn.textContent = 'Salvando...';
        btn.disabled = true;

        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/me`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    nome: nomeInput.value,
                    email: emailInput.value,
                    telefone: telefoneInput.value
                })
            });

            if (res.ok) {
                window.showToast('Perfil atualizado com sucesso!', 'success');
                // Atualiza o nome no menu lateral globalmente
                window.dispatchEvent(new CustomEvent('adminDataUpdated', { detail: { nome: nomeInput.value } }));
            } else {
                const err = await res.json();
                window.showToast(err.error || 'Erro ao atualizar.', 'error');
            }
        } catch (error) {
            window.showToast('Erro de conexão.', 'error');
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    });

    // 3. Alterar Senha
    document.getElementById('form-senha-admin').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nova = document.getElementById('nova-senha').value;
        const confirm = document.getElementById('confirmar-senha').value;

        if (nova !== confirm) {
            return window.showToast('As senhas não coincidem.', 'error');
        }

        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/me/password`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ senha: nova })
            });

            if (res.ok) {
                window.showToast('Senha alterada com sucesso!', 'success');
                e.target.reset();
            } else {
                window.showToast('Erro ao alterar senha.', 'error');
            }
        } catch (error) {
            window.showToast('Erro de conexão.', 'error');
        }
    });
};
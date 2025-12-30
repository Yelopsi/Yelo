// admin/admin_configuracoes.js

window.initializePage = async function() {
    const form = document.getElementById('form-configuracoes');
    
    // Configuração da API
    const baseUrl = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : 'http://localhost:3001';
    const token = localStorage.getItem('Yelo_token');

    if (!token) {
        console.error("Token não encontrado.");
        return;
    }

    // 1. Carregar Configurações Atuais
    async function loadSettings() {
        try {
            // Nota: Esta rota será criada no backend no próximo passo
            const response = await fetch(`${baseUrl}/api/admin/settings`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                // Se a tabela ainda não existir, apenas loga o erro silencioso
                if(response.status === 404) return console.warn("Configurações ainda não inicializadas no DB.");
                throw new Error('Erro ao buscar configurações');
            }

            const settings = await response.json();

            // Popula Checkboxes (Toggles)
            if(settings.maintenance_mode !== undefined) 
                document.getElementById('maintenance_mode').checked = settings.maintenance_mode;
            
            if(settings.allow_registrations !== undefined) 
                document.getElementById('allow_registrations').checked = settings.allow_registrations;

            // Popula Preços
            if(settings.price_Essencial) document.getElementById('price_Essencial').value = settings.price_Essencial;
            if(settings.price_Clínico) document.getElementById('price_Clínico').value = settings.price_Clínico;
            if(settings.price_sol) document.getElementById('price_sol').value = settings.price_sol;

            // Popula Contatos
            if(settings.whatsapp_support) document.getElementById('whatsapp_support').value = settings.whatsapp_support;
            if(settings.email_support) document.getElementById('email_support').value = settings.email_support;

        } catch (error) {
            console.error("Erro ao carregar settings:", error);
            // Opcional: Mostrar toast de erro
        }
    }

    // 2. Salvar Configurações
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btnSalvar = document.getElementById('btn-salvar-config');
        const textoOriginal = btnSalvar.innerHTML;
        btnSalvar.disabled = true;
        btnSalvar.innerHTML = '⏳ Salvando...';

        // Captura dados do form
        const formData = {
            maintenance_mode: document.getElementById('maintenance_mode').checked,
            allow_registrations: document.getElementById('allow_registrations').checked,
            price_Essencial: parseFloat(document.getElementById('price_Essencial').value) || 0,
            price_Clínico: parseFloat(document.getElementById('price_Clínico').value) || 0,
            price_sol: parseFloat(document.getElementById('price_sol').value) || 0,
            whatsapp_support: document.getElementById('whatsapp_support').value,
            email_support: document.getElementById('email_support').value
        };

        try {
            const response = await fetch(`${baseUrl}/api/admin/settings`, {
                method: 'POST', // ou PUT, decidiremos no backend
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) throw new Error('Falha ao salvar');

            alert('Configurações atualizadas com sucesso!'); // Idealmente trocar por um Toast no futuro

        } catch (error) {
            console.error(error);
            alert('Erro ao salvar alterações.');
        } finally {
            btnSalvar.disabled = false;
            btnSalvar.innerHTML = textoOriginal;
        }
    });

    // Inicia carregamento
    loadSettings();
};
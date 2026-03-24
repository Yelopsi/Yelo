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

    // --- INÍCIO: INJEÇÃO DA SEÇÃO DE NOTIFICAÇÕES (WEB PUSH) ---
    const configContainer = form ? form.parentElement : document.getElementById('main-content');
    if (configContainer && !document.getElementById('push-notification-section')) {
        const pushSection = document.createElement('div');
        pushSection.id = 'push-notification-section';
        pushSection.className = 'form-secao';
        pushSection.innerHTML = `
            <h2>Notificações do Sistema</h2>
            <div class="config-item" style="display: flex; justify-content: space-between; align-items: center; padding: 15px 0;">
                <div class="config-infos">
                    <strong style="display: block; font-size: 16px; color: var(--verde-escuro); margin-bottom: 4px;">Alertas no Navegador / Celular</strong>
                    <p class="desc" style="font-size: 13px; color: var(--cinza-texto); margin: 0;">Receba um aviso sonoro/visual quando um novo psicólogo se cadastrar.</p>
                </div>
                <button id="btn-push-subscribe" type="button" class="btn btn-secundario" style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem;">
                    🔔 Ativar Notificações
                </button>
            </div>
        `;
        
        if (form) {
            form.parentNode.insertBefore(pushSection, form);
        } else {
            configContainer.appendChild(pushSection);
        }

        const btnPush = document.getElementById('btn-push-subscribe');
        btnPush.addEventListener('click', async () => {
            try {
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') {
                    if(window.showToast) window.showToast('Permissão negada. Ative nas configurações do seu navegador.', 'error');
                    return;
                }
                
                const res = await fetch(`${baseUrl}/api/admin/push/vapid-public-key`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const vapidPublicKey = await res.text();
                if (!vapidPublicKey) { 
                    if(window.showToast) window.showToast('Chaves VAPID não configuradas no servidor.', 'warning'); 
                    return; 
                }

                const reg = await navigator.serviceWorker.ready;
                const padding = '='.repeat((4 - vapidPublicKey.length % 4) % 4);
                const base64 = (vapidPublicKey + padding).replace(/\-/g, '+').replace(/_/g, '/');
                const rawData = window.atob(base64);
                const outputArray = new Uint8Array(rawData.length);
                for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }

                const sub = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: outputArray
                });

                await fetch(`${baseUrl}/api/admin/push/subscribe`, { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
                    body: JSON.stringify(sub) 
                });
                
                if(window.showToast) window.showToast('Notificações ativadas neste aparelho!', 'success');
                
                btnPush.innerHTML = '✅ Notificações Ativas';
                btnPush.disabled = true;
                btnPush.style.opacity = '0.7';

            } catch (e) {
                console.error('Erro no Push:', e);
                if(window.showToast) window.showToast('Erro ao ativar notificações. Requer HTTPS.', 'error');
            }
        });
        
        // Verifica se já tem permissão para atualizar o botão visualmente (se já ativou antes)
        if (window.Notification && Notification.permission === 'granted') {
            navigator.serviceWorker.ready.then(async (reg) => {
                const sub = await reg.pushManager.getSubscription();
                if (sub) {
                    btnPush.innerHTML = '✅ Notificações Ativas';
                    btnPush.disabled = true;
                    btnPush.style.opacity = '0.7';
                }
            });
        }
    }
    // --- FIM: INJEÇÃO DA SEÇÃO DE NOTIFICAÇÕES ---

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

            if(window.showToast) window.showToast('Configurações atualizadas com sucesso!', 'success');

        } catch (error) {
            console.error(error);
            if(window.showToast) window.showToast('Erro ao salvar alterações.', 'error');
        } finally {
            btnSalvar.disabled = false;
            btnSalvar.innerHTML = textoOriginal;
        }
    });

    // Inicia carregamento
    loadSettings();
};
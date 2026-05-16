window.initializePage = function() {
    const statusBadge = document.getElementById('wa-status-badge');
    const qrContainer = document.getElementById('wa-qr-container');
    const qrImage = document.getElementById('wa-qr-image');
    const connectedContainer = document.getElementById('wa-connected-container');
    const btnDisconnect = document.getElementById('btn-wa-disconnect');

    function updateStatus(status, qr = null) {
        if (!statusBadge) return;

        if (status === 'CONNECTED') {
            statusBadge.textContent = '🟢 Conectado e Operacional';
            statusBadge.style.background = '#d1fae5';
            statusBadge.style.color = '#059669';
            qrContainer.style.display = 'none';
            connectedContainer.style.display = 'block';
        } else if (status === 'QR_READY') {
            statusBadge.textContent = '🟡 Aguardando Leitura do QR Code';
            statusBadge.style.background = '#fef3c7';
            statusBadge.style.color = '#d97706';
            if (qr) qrImage.src = qr;
            qrContainer.style.display = 'block';
            connectedContainer.style.display = 'none';
        } else if (status === 'DISCONNECTED') {
            statusBadge.textContent = '🔴 Desconectado';
            statusBadge.style.background = '#fee2e2';
            statusBadge.style.color = '#b91c1c';
            qrContainer.style.display = 'none';
            connectedContainer.style.display = 'none';
        } else {
            statusBadge.textContent = '⏳ Inicializando Navegador do Robô...';
            statusBadge.style.background = '#f1f3f5';
            statusBadge.style.color = '#666';
            qrContainer.style.display = 'none';
            connectedContainer.style.display = 'none';
        }
    }

    if (window.adminSocket) {
        window.adminSocket.emit('wa_request_status');
        window.adminSocket.off('wa_status'); // Limpa listeners antigos para não duplicar
        window.adminSocket.on('wa_status', (data) => updateStatus(data.status, data.qr));
    }

    if (btnDisconnect) {
        btnDisconnect.onclick = () => {
            if (confirm("Tem certeza que deseja desconectar? O robô irá parar de funcionar até você ler o QR Code novamente.")) {
                if (window.adminSocket) {
                    btnDisconnect.textContent = "Desconectando...";
                    window.adminSocket.emit('wa_disconnect');
                }
            }
        };
    }

    const btnTest = document.getElementById('btn-wa-test');
    if (btnTest) {
        btnTest.onclick = async () => {
            const phone = document.getElementById('wa-test-phone').value;
            const msgEl = document.getElementById('wa-test-msg');
            if (!phone) return;
            
            btnTest.disabled = true;
            btnTest.textContent = 'Enviando...';
            msgEl.textContent = '';
            
            try {
                const token = localStorage.getItem('Yelo_token');
                const BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : '';
                const res = await fetch(`${BASE_URL}/api/admin/whatsapp/test`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ phone })
                });
                const data = await res.json();
                
                if (res.ok) {
                    msgEl.style.color = '#10b981';
                    msgEl.textContent = '✅ Mensagem enviada! Cheque seu celular.';
                } else {
                    msgEl.style.color = '#E63946';
                    msgEl.textContent = data.error || 'Erro ao enviar.';
                }
            } catch (err) {
                msgEl.style.color = '#E63946';
                msgEl.textContent = 'Erro de conexão com o servidor.';
            } finally {
                btnTest.disabled = false;
                btnTest.textContent = 'Enviar Teste';
            }
        };
    }

    const btnBatch = document.getElementById('btn-wa-batch');
    if (btnBatch) {
        btnBatch.onclick = async () => {
            const msgEl = document.getElementById('wa-batch-msg');
            
            btnBatch.disabled = true;
            btnBatch.textContent = 'Iniciando Robô...';
            msgEl.textContent = '';
            
            try {
                const token = localStorage.getItem('Yelo_token');
                const BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : '';
                const res = await fetch(`${BASE_URL}/api/admin/whatsapp/test-batch`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                
                if (res.ok) {
                    msgEl.textContent = '✅ Lote ativado! Acompanhe o progresso no terminal (logs do Node.js).';
                } else {
                    msgEl.textContent = data.error || 'Erro ao iniciar lote.';
                }
            } catch (err) {
                msgEl.textContent = 'Erro de conexão com o servidor.';
            }
        };
    }
};
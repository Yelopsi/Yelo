/**
 * Arquivo: admin_broadcast.js
 * Responsabilidade: Controlar o fluxo do modal e envio de Mensagem em Massa (Broadcast)
 */
window.AdminBroadcast = (function() {
    const API_BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : 'http://localhost:3001';
    let broadcastModal, closeBroadcastBtn, cancelBroadcastBtn, sendBroadcastBtn, broadcastTarget, broadcastMessage, btnNewChat;
    
    const handleEscKey = (e) => {
        if (e.key === 'Escape' && broadcastModal && broadcastModal.style.display === 'flex') {
            closeBroadcast();
            e.stopPropagation(); // Evita conflitos com outros modais se houver
        }
    };

    function closeBroadcast() {
        if (broadcastModal) broadcastModal.style.display = 'none';
    }

    return {
        init: function() {
            broadcastModal = document.getElementById('broadcast-modal');
            closeBroadcastBtn = document.getElementById('close-broadcast-modal');
            cancelBroadcastBtn = document.getElementById('btn-cancel-broadcast');
            sendBroadcastBtn = document.getElementById('btn-send-broadcast');
            broadcastTarget = document.getElementById('broadcast-target');
            broadcastMessage = document.getElementById('broadcast-message');
            btnNewChat = document.getElementById('btn-new-chat');

            // Move para o escopo global de Z-Index
            if (broadcastModal && broadcastModal.parentNode !== document.body) {
                document.body.appendChild(broadcastModal);
            }

            // Bindings de Evento
            if (btnNewChat) {
                btnNewChat.addEventListener('click', this.openBroadcast);
            }
            
            if (closeBroadcastBtn) closeBroadcastBtn.addEventListener('click', closeBroadcast);
            if (cancelBroadcastBtn) cancelBroadcastBtn.addEventListener('click', closeBroadcast);
            if (sendBroadcastBtn) sendBroadcastBtn.addEventListener('click', (e) => this.sendBroadcast(e));

            document.addEventListener('keydown', handleEscKey);
        },
        
        openBroadcast: function(e) {
            if (e) e.preventDefault();
            if (broadcastModal) {
                if (broadcastModal.parentNode !== document.body) {
                    document.body.appendChild(broadcastModal);
                }
                broadcastModal.style.display = 'flex';
                broadcastModal.style.opacity = '1';
                broadcastModal.style.visibility = 'visible';
                if (broadcastTarget) broadcastTarget.value = "";
                if (broadcastMessage) broadcastMessage.value = "";
            }
        },

        sendBroadcast: async function(e) {
            if (e) e.preventDefault();
            
            const target = broadcastTarget.value;
            const content = broadcastMessage.value.trim();

            if (!target) return window.showToast ? window.showToast("⚠️ Selecione um grupo de destinatários.") : alert("Selecione um grupo.");
            if (!content) return window.showToast ? window.showToast("⚠️ Digite uma mensagem para enviar.") : alert("Digite uma mensagem.");

            const targetText = broadcastTarget.options[broadcastTarget.selectedIndex].text;
            closeBroadcast();

            const executeBroadcast = async () => {
                const originalText = sendBroadcastBtn.innerText;
                sendBroadcastBtn.innerText = "Enviando...";
                sendBroadcastBtn.disabled = true;

                try {
                    const token = localStorage.getItem('Yelo_token');
                    const response = await fetch(`${API_BASE_URL}/api/admin/broadcast`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ target, content })
                    });

                    const result = await response.json();

                    if (response.ok) {
                        if (window.showToast) window.showToast("✅ Mensagem em massa enviada com sucesso!");
                        // Emite o gatilho para a view de conversas reagir dinamicamente
                        window.dispatchEvent(new CustomEvent('admin:reload_conversations'));
                    } else {
                        throw new Error(result.error || 'Erro ao enviar mensagem.');
                    }
                } catch (error) {
                    if (window.showToast) window.showToast("❌ Erro: " + error.message);
                } finally {
                    sendBroadcastBtn.innerText = originalText;
                    sendBroadcastBtn.disabled = false;
                }
            };

            if (window.openConfirmationModal) {
                window.openConfirmationModal(
                    "Confirmar Envio em Massa",
                    `Você está prestes a enviar uma mensagem para <strong>${targetText}</strong>.<br><br>Esta ação não pode ser desfeita. Deseja continuar?`,
                    executeBroadcast
                );
            } else {
                if (confirm(`Enviar para ${targetText}?`)) executeBroadcast();
            }
        },

        cleanup: function() {
            document.removeEventListener('keydown', handleEscKey);
            if (btnNewChat) btnNewChat.removeEventListener('click', this.openBroadcast);
            if (closeBroadcastBtn) closeBroadcastBtn.removeEventListener('click', closeBroadcast);
            if (cancelBroadcastBtn) cancelBroadcastBtn.removeEventListener('click', closeBroadcast);
            
            const modal = document.getElementById('broadcast-modal');
            if (modal) modal.remove();
        }
    };
})();
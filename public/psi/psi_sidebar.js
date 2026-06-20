/**
 * Arquivo: psi_sidebar.js
 * Responsabilidade: Isolar o controle do Menu Mobile (Sidebar) e lógica de Cropper da foto de perfil.
 */
window.PsiSidebar = (function() {
    return {
        initMenu: function() {
            const toggleBtn = document.getElementById('toggleSidebar');
            const sidebar = document.querySelector('.dashboard-sidebar');
            
            if (toggleBtn && sidebar) {
                toggleBtn.addEventListener('click', () => {
                    sidebar.classList.toggle('is-open');
                });
                
                // Fecha ao clicar fora
                document.addEventListener('click', (e) => {
                    if (window.innerWidth <= 992 && 
                        sidebar.classList.contains('is-open') && 
                        !sidebar.contains(e.target) && 
                        !toggleBtn.contains(e.target)) {
                        sidebar.classList.remove('is-open');
                    }
                });
            }
        },

        initUpload: function() {
            const sidebarTrigger = document.getElementById('sidebar-photo-trigger');
            const sidebarInput = document.getElementById('sidebar-photo-input');
            
            // Elementos do Cropper
            const cropModal = document.getElementById('crop-modal');
            const imageElement = document.getElementById('image-to-crop');
            const btnCancelCrop = document.getElementById('btn-cancel-crop');
            const btnConfirmCrop = document.getElementById('btn-confirm-crop');
            let cropper = null;

            if (sidebarTrigger && sidebarInput) {
                // Ao clicar na área, aciona o input invisível
                sidebarTrigger.onclick = () => {
                    sidebarInput.click();
                };
                // Impede que o clique suba e o navegador bloqueie a janela por segurança
                sidebarInput.onclick = (e) => e.stopPropagation();

                sidebarInput.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        // Validação prévia de tamanho (10MB)
                        if (file.size > 10 * 1024 * 1024) {
                            if (window.showToast) window.showToast('Arquivo muito grande. Limite máximo: 10MB.', 'error');
                            sidebarInput.value = '';
                            return;
                        }

                        const reader = new FileReader();
                        reader.onload = (event) => {
                            if (cropModal) cropModal.style.display = 'flex';
                            if (imageElement) {
                                imageElement.src = event.target.result;
                                if (cropper) cropper.destroy();
                                if (typeof Cropper !== 'undefined') {
                                    cropper = new Cropper(imageElement, {
                                        aspectRatio: 1, // Quadrado perfeito
                                        viewMode: 1,
                                        autoCropArea: 1,
                                    });
                                }
                            }
                        };
                        reader.readAsDataURL(file);
                    }
                };

                if (btnCancelCrop) {
                    btnCancelCrop.onclick = () => {
                        if (cropModal) cropModal.style.display = 'none';
                        if (cropper) cropper.destroy();
                        sidebarInput.value = '';
                    };
                }

                if (btnConfirmCrop) {
                    btnConfirmCrop.onclick = () => {
                        if (!cropper) return;
                        
                        cropper.getCroppedCanvas({ width: 1080, height: 1080 }).toBlob(async (blob) => {
                            if (!blob) return;
                            if (cropModal) cropModal.style.display = 'none';
                            
                            const fd = new FormData();
                            fd.append('foto', blob, 'profile.jpg');
                            if (window.showToast) window.showToast('Enviando foto...', 'info');

                            try {
                                const API_BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : 'http://localhost:3001';
                                const apiFetch = window.apiFetch || fetch; // Fallback

                                const res = await apiFetch(`${API_BASE_URL}/api/psychologists/me/foto`, { method: 'POST', body: fd });
                                if (res.ok) {
                                    const d = await res.json();
                                    
                                    // Usa a API de estado já exportada no arquivo pai (psi_dashboard.js)
                                    const psiData = typeof window.getPsychologistData === 'function' ? window.getPsychologistData() : null;
                                    if (psiData) psiData.fotoUrl = d.fotoUrl;
                                    if (typeof window.atualizarInterfaceLateral === 'function') window.atualizarInterfaceLateral();
                                    
                                    if (window.showToast) window.showToast('Foto atualizada!', 'success');
                                } else {
                                    const errData = await res.json().catch(() => ({}));
                                    throw new Error(errData.error || 'Erro ao enviar foto.');
                                }
                            } catch (err) {
                                if (window.showToast) window.showToast(err.message, 'error');
                            } finally {
                                if (cropper) cropper.destroy();
                                sidebarInput.value = '';
                            }
                        }, 'image/jpeg', 0.95);
                    };
                }
            }
        }
    };
})();
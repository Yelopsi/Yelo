// admin/admin_modais.js
(function() {
    window.setupConfirmationModal = function() {
        const modal = document.getElementById('confirmation-modal');
        if (!modal) {
            console.warn("Modal HTML não encontrado em admin.html");
            return;
        }
        const confirmBtn = document.getElementById('modal-confirm-btn');
        const cancelBtn = document.getElementById('modal-cancel-btn');
        let confirmCallback = null;
        const closeModal = () => {
            modal.style.display = 'none';
            confirmCallback = null;
        };
        window.openConfirmationModal = (title, body, onConfirm) => {
            const titleEl = document.getElementById('modal-title');
            const bodyEl = document.getElementById('modal-body');
            if(titleEl) titleEl.textContent = title;
            if(bodyEl) bodyEl.innerHTML = body;
            if(confirmBtn) confirmBtn.disabled = false;
            confirmCallback = onConfirm;
            modal.style.display = 'flex';
        };
        if(confirmBtn) confirmBtn.onclick = () => {
            if (typeof confirmCallback === 'function') confirmCallback();
            closeModal();
        };
        if(cancelBtn) cancelBtn.onclick = closeModal;
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };
    };

    window.setupVipModal = function() {
        const modal = document.getElementById('vip-modal');
        if (!modal) return;
        const confirmBtn = document.getElementById('vip-modal-confirm-btn');
        const cancelBtn = document.getElementById('vip-modal-cancel-btn');
        let currentPsyId = null;
        const closeModal = () => { modal.style.display = 'none'; currentPsyId = null; };
        cancelBtn.onclick = closeModal;
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };
        confirmBtn.onclick = async () => {
            const selectedPlanInput = modal.querySelector('input[name="vip_plan"]:checked');
            if (!selectedPlanInput) {
                if (window.showToast) window.showToast('Por favor, selecione uma opção.', 'error');
                return;
            }
            const planValue = selectedPlanInput.value;
            confirmBtn.disabled = true; confirmBtn.textContent = 'Salvando...';
            try {
                const token = localStorage.getItem('Yelo_token');
                const headers = { 'Content-Type': 'application/json' };
                if (token) headers['Authorization'] = `Bearer ${token}`;
                const API_BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : '';
                const response = await fetch(`${API_BASE_URL}/api/admin/psychologists/${currentPsyId}/vip`, {
                    method: 'PATCH', headers: headers, body: JSON.stringify({ plan: planValue === 'none' ? null : planValue })
                });
                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.error || 'Falha ao atualizar status VIP.');
                }
                const data = await response.json();
                if(window.showToast) window.showToast(data.message, 'success');
                closeModal();
                window.dispatchEvent(new CustomEvent('vipStatusUpdated'));
            } catch (error) {
                if(window.showToast) window.showToast(error.message, 'error');
            } finally {
                confirmBtn.disabled = false; confirmBtn.textContent = 'Confirmar Alteração';
            }
        };
        window.openVipModal = (psychologist) => {
            currentPsyId = psychologist.id;
            const title = document.getElementById('vip-modal-title');
            if (title) title.innerHTML = `Gerenciar Isenção: <span style="font-weight: normal;">${psychologist.nome}</span>`;
            const currentPlan = psychologist.is_exempt ? (psychologist.plano || 'none') : 'none';
            modal.querySelectorAll('input[name="vip_plan"]').forEach(radio => radio.checked = (radio.value === currentPlan));
            modal.style.display = 'flex';
        };
    };

    window.setupReportModal = function() {
        const modal = document.getElementById('report-modal');
        if (!modal) return;
        const closeBtn = document.getElementById('report-modal-close-btn');
        const actionBtn = document.getElementById('report-modal-action-btn');
        let actionCallback = null;
        const closeModal = () => { modal.style.display = 'none'; actionCallback = null; };
        window.openReportModal = (data) => {
            document.getElementById('report-modal-title').textContent = data.title || 'Detalhes da Denúncia';
            document.getElementById('report-author').textContent = data.author || 'Anônimo';
            document.getElementById('report-reason').textContent = data.reason || 'Não especificado';
            document.getElementById('report-count').textContent = data.count || 1;
            const contentEl = document.getElementById('report-content-area');
            if (data.isHtml) contentEl.innerHTML = data.content; else contentEl.textContent = data.content;
            if (actionBtn) {
                actionBtn.textContent = data.actionLabel || 'Remover Conteúdo';
                actionBtn.onclick = () => { if (typeof data.onAction === 'function') data.onAction(); closeModal(); };
            }
            modal.style.display = 'flex';
        };
        if (closeBtn) closeBtn.onclick = closeModal;
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };
    };

    window.setupAdminPhotoUpload = function() {
        const sidebarTrigger = document.getElementById('admin-photo-trigger');
        const mobileTrigger = document.getElementById('mobile-avatar-trigger');
        const photoInput = document.getElementById('admin-photo-input');
        const cropModal = document.getElementById('crop-modal');
        const imageElement = document.getElementById('image-to-crop');
        const btnCancelCrop = document.getElementById('btn-cancel-crop');
        const btnConfirmCrop = document.getElementById('btn-confirm-crop');
        let cropper = null;
        const openFileInput = () => { if (photoInput) photoInput.click(); };
        if (sidebarTrigger) sidebarTrigger.onclick = openFileInput;
        if (mobileTrigger) mobileTrigger.onclick = openFileInput;
        if (photoInput) {
            photoInput.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    if (file.size > 10 * 1024 * 1024) { if(window.showToast) window.showToast('Arquivo muito grande. Limite máximo: 10MB.', 'error'); photoInput.value = ''; return; }
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        if (cropModal) cropModal.style.display = 'flex';
                        if (imageElement) { imageElement.src = event.target.result; if (cropper) cropper.destroy(); cropper = new Cropper(imageElement, { aspectRatio: 1, viewMode: 1, autoCropArea: 1 }); }
                    };
                    reader.readAsDataURL(file);
                }
            };
        }
        if (btnCancelCrop) {
            btnCancelCrop.onclick = () => { if (cropModal) cropModal.style.display = 'none'; if (cropper) cropper.destroy(); if (photoInput) photoInput.value = ''; };
        }
        if (btnConfirmCrop) {
            btnConfirmCrop.onclick = () => {
                if (!cropper) return;
                cropper.getCroppedCanvas({ width: 1080, height: 1080 }).toBlob(async (blob) => {
                    if (!blob) return;
                    if (cropModal) cropModal.style.display = 'none';
                    const fd = new FormData(); fd.append('foto', blob, 'profile.jpg');
                    if (window.showToast) window.showToast('Enviando foto...', 'info');
                    try { const token = localStorage.getItem('Yelo_token'); const API_BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : ''; const res = await fetch(`${API_BASE_URL}/api/admin/me/photo`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` }, body: fd }); if (res.ok) { const d = await res.json(); const sidebarPhoto = document.getElementById('admin-sidebar-photo'); const mobilePhoto = document.getElementById('admin-mobile-photo'); if (sidebarPhoto) sidebarPhoto.src = d.fotoUrl; if (mobilePhoto) mobilePhoto.src = d.fotoUrl; if(window.showToast) window.showToast('Foto atualizada!', 'success'); } else { throw new Error('Erro ao enviar foto.'); } } catch (err) { if(window.showToast) window.showToast(err.message || 'Erro ao enviar foto.', 'error'); } finally { if (cropper) cropper.destroy(); if (photoInput) photoInput.value = ''; }
                }, 'image/jpeg', 0.95);
            };
        }
    };
})();
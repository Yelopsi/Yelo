// public/js/utils/ui-helpers.js

window.showToast = function(message, type = 'success') {
    let container = document.getElementById('pill-notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'pill-notification-container';
        document.body.appendChild(container);
    }
    const pill = document.createElement('div');
    pill.className = `pill-notification ${type}`;
    
    let iconHtml = '';
    if (type === 'success') iconHtml = '<span class="icon">✅</span>';
    else if (type === 'error') iconHtml = '<span class="icon">❌</span>';
    else if (type === 'info') iconHtml = '<span class="icon">ℹ️</span>';
    
    pill.innerHTML = `${iconHtml}<span>${message}</span>`;
    container.appendChild(pill);
    setTimeout(() => pill.remove(), 4500);
};

window.formatImageUrl = function(path) {
    if (!path) return 'https://placehold.co/70x70/1B4332/FFFFFF?text=Psi';
    if (path.startsWith('http')) return path; 
    let cleanPath = path.replace(/\\/g, '/');
    if (cleanPath.includes('uploads/')) cleanPath = cleanPath.substring(cleanPath.lastIndexOf('uploads/'));
    if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;
    return `${window.API_BASE_URL || ''}${cleanPath}`;
};

window.abrirModalConfirmacaoPersonalizado = function(titulo, mensagem, onConfirm) {
    const overlay = document.createElement('div');
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px;";
    const modalBox = document.createElement('div');
    modalBox.style.cssText = "background:#fff; width:100%; max-width:500px; border-radius:12px; overflow:hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.2); animation: fadeIn 0.2s ease-out;";
    
    modalBox.innerHTML = `
        <div style="background: #1B4332; color: #fff; padding: 15px 20px; font-family: 'New Kansas', sans-serif; font-size: 1.2rem;">${titulo}</div>
        <div style="padding: 25px 20px; color: #333; font-size: 1rem; line-height: 1.5;">${mensagem}</div>
        <div style="padding: 15px 20px; background: #f9f9f9; display:flex; justify-content:flex-end; gap:10px; border-top:1px solid #eee;">
            <button class="btn-cancelar" style="padding: 10px 20px; border: 1px solid #ccc; background:#fff; color:#666; border-radius:25px; cursor:pointer; font-weight:bold;">Cancelar</button>
            <button class="btn-confirmar" style="padding: 10px 20px; border: none; background:#1B4332; color:#fff; border-radius:25px; cursor:pointer; font-weight:bold;">Confirmar</button>
        </div>
    `;
    
    modalBox.querySelector('.btn-cancelar').onclick = () => document.body.removeChild(overlay);
    overlay.onclick = (e) => { if(e.target === overlay) document.body.removeChild(overlay); };
    modalBox.querySelector('.btn-confirmar').onclick = () => { document.body.removeChild(overlay); onConfirm(); };
    overlay.appendChild(modalBox);
    document.body.appendChild(overlay);
};
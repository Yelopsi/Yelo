// public/js/utils/ui-helpers.js

window.showToast = function(message, type = 'success', duration = 4500) {
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
    setTimeout(() => pill.remove(), duration);
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
    if (!document.getElementById('yelo-confirm-modal-styles')) {
        const style = document.createElement('style');
        style.id = 'yelo-confirm-modal-styles';
        style.textContent = `
            @keyframes fadeInConfirm {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes fadeOutConfirm {
                from { opacity: 1; }
                to { opacity: 0; }
            }
            @keyframes slideUpSheetConfirm {
                from { transform: translateY(100%); }
                to { transform: translateY(0); }
            }
            @keyframes slideDownSheetConfirm {
                from { transform: translateY(0); }
                to { transform: translateY(100%); }
            }
            .yelo-confirm-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(15, 23, 42, 0.65);
                backdrop-filter: blur(4px);
                -webkit-backdrop-filter: blur(4px);
                z-index: 99999;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                box-sizing: border-box;
                animation: fadeInConfirm 0.2s ease-out;
            }
            .yelo-confirm-box {
                background: #FFFFFF;
                width: 100%;
                max-width: 480px;
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                animation: fadeInConfirm 0.22s ease-out;
            }
            .yelo-confirm-header {
                background: #1B4332;
                color: #FFFFFF;
                padding: 16px 20px;
                font-family: 'New Kansas', 'Outfit', sans-serif;
                font-size: 1.15rem;
                font-weight: 700;
                display: flex;
                flex-direction: column;
                position: relative;
            }
            .yelo-confirm-header.danger {
                background: #991B1B;
            }
            .yelo-confirm-body {
                padding: 22px 20px;
                color: #334155;
                font-size: 0.96rem;
                line-height: 1.55;
                font-family: 'Inter', -apple-system, sans-serif;
            }
            .yelo-confirm-footer {
                padding: 14px 20px 16px 20px;
                background: #F8FAFC;
                display: flex;
                justify-content: flex-end;
                gap: 12px;
                border-top: 1px solid #E2E8F0;
            }
            .yelo-confirm-btn-cancelar {
                padding: 10px 22px;
                border: 1.5px solid #CBD5E1;
                background: #FFFFFF;
                color: #64748B;
                border-radius: 50px;
                cursor: pointer;
                font-weight: 700;
                font-size: 0.92rem;
                transition: all 0.2s ease;
                font-family: inherit;
            }
            .yelo-confirm-btn-cancelar:hover {
                background: #F1F5F9;
                color: #334155;
            }
            .yelo-confirm-btn-confirmar {
                padding: 10px 24px;
                border: none;
                background: #1B4332;
                color: #FFFFFF;
                border-radius: 50px;
                cursor: pointer;
                font-weight: 700;
                font-size: 0.92rem;
                transition: all 0.2s ease;
                font-family: inherit;
            }
            .yelo-confirm-btn-confirmar.danger {
                background: #DC2626;
            }
            .yelo-confirm-btn-confirmar:hover {
                opacity: 0.92;
                transform: translateY(-1px);
            }
            .yelo-confirm-drag-handle {
                display: none;
            }

            /* --- PADRÃO MOBILE BOTTOM-SHEET / WALL DE BAIXO PARA CIMA --- */
            @media (max-width: 768px), (max-width: 991px) and (orientation: portrait) {
                .yelo-confirm-overlay {
                    align-items: flex-end !important;
                    justify-content: center !important;
                    padding: 0 !important;
                    z-index: 100005 !important;
                }
                .yelo-confirm-box {
                    border-radius: 24px 24px 0 0 !important;
                    max-width: 100% !important;
                    width: 100% !important;
                    margin: 0 !important;
                    animation: slideUpSheetConfirm 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
                    box-shadow: 0 -10px 35px rgba(0, 0, 0, 0.35) !important;
                }
                .yelo-confirm-header {
                    padding: 12px 20px 16px 20px !important;
                    text-align: center !important;
                    align-items: center !important;
                }
                .yelo-confirm-drag-handle {
                    display: block !important;
                    width: 44px !important;
                    height: 5px !important;
                    background: rgba(255, 255, 255, 0.45) !important;
                    border-radius: 999px !important;
                    margin-bottom: 10px !important;
                }
                .yelo-confirm-body {
                    padding: 24px 20px 18px 20px !important;
                    font-size: 1rem !important;
                    text-align: center !important;
                    line-height: 1.55 !important;
                }
                .yelo-confirm-footer {
                    padding: 14px 20px calc(24px + env(safe-area-inset-bottom, 0px)) 20px !important;
                    display: flex !important;
                    gap: 12px !important;
                    width: 100% !important;
                    box-sizing: border-box !important;
                }
                .yelo-confirm-btn-cancelar,
                .yelo-confirm-btn-confirmar {
                    flex: 1 !important;
                    min-height: 48px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    font-size: 0.96rem !important;
                    border-radius: 50px !important;
                    font-weight: 700 !important;
                }
            }
            body.yelo-confirm-modal-open .bottom-nav,
            body.yelo-confirm-modal-open .mobile-bottom-nav {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    const isDanger = titulo.toLowerCase().includes('excluir') || titulo.toLowerCase().includes('remover');

    const overlay = document.createElement('div');
    overlay.className = 'yelo-confirm-overlay';
    overlay.style.zIndex = '100005';

    const modalBox = document.createElement('div');
    modalBox.className = 'yelo-confirm-box';

    modalBox.innerHTML = `
        <div class="yelo-confirm-header ${isDanger ? 'danger' : ''}">
            <div class="yelo-confirm-drag-handle"></div>
            <span>${titulo}</span>
        </div>
        <div class="yelo-confirm-body">${mensagem}</div>
        <div class="yelo-confirm-footer">
            <button type="button" class="yelo-confirm-btn-cancelar">Cancelar</button>
            <button type="button" class="yelo-confirm-btn-confirmar ${isDanger ? 'danger' : ''}">Confirmar</button>
        </div>
    `;

    document.body.classList.add('yelo-confirm-modal-open');

    const fechar = () => {
        const isMobile = window.innerWidth <= 768 || (window.innerWidth <= 991 && window.innerHeight > window.innerWidth);
        if (isMobile) {
            modalBox.style.animation = 'slideDownSheetConfirm 0.22s ease-in forwards';
            overlay.style.animation = 'fadeOutConfirm 0.22s ease-in forwards';
            setTimeout(() => { 
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                document.body.classList.remove('yelo-confirm-modal-open');
            }, 210);
        } else {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            document.body.classList.remove('yelo-confirm-modal-open');
        }
    };

    modalBox.querySelector('.yelo-confirm-btn-cancelar').onclick = fechar;
    overlay.onclick = (e) => { if (e.target === overlay) fechar(); };
    modalBox.querySelector('.yelo-confirm-btn-confirmar').onclick = () => {
        fechar();
        if (typeof onConfirm === 'function') onConfirm();
    };

    overlay.appendChild(modalBox);
    document.body.appendChild(overlay);
};
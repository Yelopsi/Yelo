// public/js/utils/ui-helpers.js

window.showToast = function(message, type = 'success', duration = 4500) {
    let container = document.getElementById('pill-notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'pill-notification-container';
        document.body.appendChild(container);
    }
    const existing = container.querySelectorAll('.pill-notification');
    for (const t of existing) {
        if (t.textContent.includes(message)) return;
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

window.abrirModalConfirmacaoPersonalizado = function(titulo, mensagem, onConfirm, opcoes = {}) {
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
            @keyframes scaleUpConfirm {
                from { opacity: 0; transform: scale(0.94) translateY(8px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
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
                background: rgba(15, 23, 42, 0.62);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                z-index: 100005 !important;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                box-sizing: border-box;
                animation: fadeInConfirm 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            }

            .yelo-confirm-box {
                background: #FFFFFF;
                width: 100%;
                max-width: 440px;
                border-radius: 24px;
                border: 1px solid rgba(226, 232, 240, 0.9);
                box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.03);
                position: relative;
                padding: 32px 28px 26px 28px;
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
                animation: scaleUpConfirm 0.24s cubic-bezier(0.16, 1, 0.3, 1);
            }

            .yelo-confirm-close-btn {
                position: absolute;
                top: 18px;
                right: 18px;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                background: #F1F5F9;
                border: 1px solid #E2E8F0;
                color: #64748B;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.2s ease;
                padding: 0;
            }
            .yelo-confirm-close-btn:hover {
                background: #E2E8F0;
                color: #0F172A;
                transform: rotate(90deg);
            }

            .yelo-confirm-drag-handle {
                display: none;
                width: 38px;
                height: 4px;
                background: #CBD5E1;
                border-radius: 999px;
                margin: 0 auto 18px auto;
            }

            .yelo-confirm-icon-badge {
                width: 58px;
                height: 58px;
                border-radius: 50%;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 18px;
                flex-shrink: 0;
                transition: transform 0.2s ease;
            }
            .yelo-confirm-icon-badge.danger {
                background: #FEE2E2;
                border: 1.5px solid #FECACA;
                color: #DC2626;
                box-shadow: 0 4px 14px rgba(220, 38, 38, 0.15);
            }
            .yelo-confirm-icon-badge.report,
            .yelo-confirm-icon-badge.warning {
                background: #FEF3C7;
                border: 1.5px solid #FDE68A;
                color: #D97706;
                box-shadow: 0 4px 14px rgba(217, 119, 6, 0.15);
            }
            .yelo-confirm-icon-badge.primary {
                background: #E8F5E9;
                border: 1.5px solid #C8E6C9;
                color: #1B4332;
                box-shadow: 0 4px 14px rgba(27, 67, 50, 0.15);
            }

            .yelo-confirm-title {
                font-family: var(--font-titulos, 'Outfit', -apple-system, sans-serif);
                font-size: 1.32rem;
                font-weight: 800;
                color: #0F172A;
                letter-spacing: -0.3px;
                margin: 0 0 8px 0;
                line-height: 1.3;
            }

            .yelo-confirm-body {
                font-family: var(--font-principal, 'Inter', -apple-system, sans-serif);
                font-size: 0.95rem;
                color: #64748B;
                line-height: 1.55;
                margin: 0 0 16px 0;
                padding: 0;
            }

            .yelo-confirm-notice {
                display: flex;
                align-items: flex-start;
                gap: 10px;
                border-radius: 14px;
                padding: 12px 14px;
                margin-bottom: 22px;
                text-align: left;
                width: 100%;
                box-sizing: border-box;
                font-size: 0.88rem;
                line-height: 1.45;
                font-weight: 500;
            }
            .yelo-confirm-notice.danger {
                background: #FEF2F2;
                border: 1px solid #FECACA;
                color: #991B1B;
            }
            .yelo-confirm-notice.report {
                background: #F0FDF4;
                border: 1px solid #BBF7D0;
                color: #166534;
            }
            .yelo-confirm-notice .notice-icon {
                flex-shrink: 0;
                margin-top: 2px;
            }

            .yelo-confirm-footer {
                display: flex;
                align-items: center;
                gap: 12px;
                width: 100%;
                box-sizing: border-box;
                padding: 0;
                background: transparent;
                border-top: none;
            }

            .yelo-confirm-btn-cancelar {
                flex: 1;
                padding: 11px 20px;
                border: 1.5px solid #CBD5E1;
                background: #FFFFFF;
                color: #64748B;
                border-radius: 50px;
                cursor: pointer;
                font-weight: 700;
                font-size: 0.92rem;
                transition: all 0.2s ease;
                font-family: inherit;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .yelo-confirm-btn-cancelar:hover {
                background: #F8FAFC;
                color: #334155;
                border-color: #94A3B8;
            }

            .yelo-confirm-btn-confirmar {
                flex: 1;
                padding: 11px 20px;
                border: none;
                border-radius: 50px;
                cursor: pointer;
                font-weight: 700;
                font-size: 0.92rem;
                transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                font-family: inherit;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
            }
            .yelo-confirm-btn-confirmar.danger {
                background: #DC2626;
                color: #FFFFFF;
                box-shadow: 0 4px 14px rgba(220, 38, 38, 0.28);
            }
            .yelo-confirm-btn-confirmar.danger:hover {
                background: #B91C1C;
                transform: translateY(-1px);
                box-shadow: 0 6px 18px rgba(220, 38, 38, 0.35);
            }
            .yelo-confirm-btn-confirmar.report {
                background: #1B4332;
                color: #FFFFFF;
                box-shadow: 0 4px 14px rgba(27, 67, 50, 0.28);
            }
            .yelo-confirm-btn-confirmar.report:hover {
                background: #143527;
                transform: translateY(-1px);
                box-shadow: 0 6px 18px rgba(27, 67, 50, 0.35);
            }
            .yelo-confirm-btn-confirmar.primary {
                background: #1B4332;
                color: #FFFFFF;
                box-shadow: 0 4px 14px rgba(27, 67, 50, 0.25);
            }
            .yelo-confirm-btn-confirmar.primary:hover {
                background: #143527;
                transform: translateY(-1px);
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
                    border-radius: 28px 28px 0 0 !important;
                    max-width: 100% !important;
                    width: 100% !important;
                    margin: 0 !important;
                    padding: 16px 22px calc(24px + env(safe-area-inset-bottom, 0px)) 22px !important;
                    animation: slideUpSheetConfirm 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
                    box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.35) !important;
                    border-bottom: none !important;
                }
                .yelo-confirm-drag-handle {
                    display: block !important;
                }
                .yelo-confirm-icon-badge {
                    width: 52px !important;
                    height: 52px !important;
                    margin-bottom: 14px !important;
                }
                .yelo-confirm-title {
                    font-size: 1.25rem !important;
                }
                .yelo-confirm-body {
                    font-size: 0.92rem !important;
                    margin-bottom: 14px !important;
                }
                .yelo-confirm-notice {
                    padding: 10px 12px !important;
                    font-size: 0.84rem !important;
                    margin-bottom: 18px !important;
                }
                .yelo-confirm-footer {
                    gap: 10px !important;
                }
                .yelo-confirm-btn-cancelar,
                .yelo-confirm-btn-confirmar {
                    min-height: 48px !important;
                    font-size: 0.95rem !important;
                }
            }
            body.yelo-confirm-modal-open .bottom-nav,
            body.yelo-confirm-modal-open .mobile-bottom-nav {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    const tituloStr = (titulo || '').toString();
    const isDanger = opcoes.danger || tituloStr.toLowerCase().includes('excluir') || tituloStr.toLowerCase().includes('remover') || tituloStr.toLowerCase().includes('apagar');
    const isReport = opcoes.report || tituloStr.toLowerCase().includes('denunciar') || tituloStr.toLowerCase().includes('report');

    let badgeClass = 'primary';
    let iconSvg = '';
    let btnConfirmarClass = 'primary';
    let btnConfirmarTexto = opcoes.confirmText || 'Confirmar';
    let btnCancelarTexto = opcoes.cancelText || 'Cancelar';
    let noticeHtml = '';

    if (isDanger) {
        badgeClass = 'danger';
        btnConfirmarClass = 'danger';
        if (!opcoes.confirmText) {
            btnConfirmarTexto = tituloStr.toLowerCase().includes('comentário') ? 'Excluir comentário' : 'Excluir discussão';
        }
        iconSvg = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
        
        const noticeText = opcoes.notice || 'Esta ação é irreversível. O conteúdo será apagado permanentemente da comunidade.';
        noticeHtml = `
            <div class="yelo-confirm-notice danger">
                <svg class="notice-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                <span>${noticeText}</span>
            </div>
        `;
    } else if (isReport) {
        badgeClass = 'report';
        btnConfirmarClass = 'report';
        btnConfirmarTexto = opcoes.confirmText || 'Enviar denúncia';
        btnCancelarTexto = opcoes.cancelText || 'Voltar';
        iconSvg = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>`;
        
        const noticeText = opcoes.notice || 'Sua denúncia é 100% anônima e será avaliada com prioridade pela moderação da Yelo.';
        noticeHtml = `
            <div class="yelo-confirm-notice report">
                <svg class="notice-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                <span>${noticeText}</span>
            </div>
        `;
    } else {
        badgeClass = 'primary';
        btnConfirmarClass = 'primary';
        iconSvg = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="m9 12 2 2 4-4"></path></svg>`;
        if (opcoes.notice) {
            noticeHtml = `
                <div class="yelo-confirm-notice report">
                    <span>${opcoes.notice}</span>
                </div>
            `;
        }
    }

    const overlay = document.createElement('div');
    overlay.className = 'yelo-confirm-overlay';
    overlay.style.zIndex = '100005';

    const modalBox = document.createElement('div');
    modalBox.className = 'yelo-confirm-box';

    modalBox.innerHTML = `
        <div class="sheet-drag-handle yelo-confirm-drag-handle"></div>
        <button type="button" class="yelo-confirm-close-btn" title="Fechar" aria-label="Fechar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
        <div class="yelo-confirm-icon-badge ${badgeClass}">
            ${iconSvg}
        </div>
        <h3 class="yelo-confirm-title">${titulo}</h3>
        <p class="yelo-confirm-body">${mensagem}</p>
        ${noticeHtml}
        <div class="yelo-confirm-footer">
            <button type="button" class="yelo-confirm-btn-cancelar">${btnCancelarTexto}</button>
            <button type="button" class="yelo-confirm-btn-confirmar ${btnConfirmarClass}">${btnConfirmarTexto}</button>
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

    const closeBtn = modalBox.querySelector('.yelo-confirm-close-btn');
    if (closeBtn) closeBtn.onclick = fechar;
    modalBox.querySelector('.yelo-confirm-btn-cancelar').onclick = fechar;
    overlay.onclick = (e) => { if (e.target === overlay) fechar(); };
    modalBox.querySelector('.yelo-confirm-btn-confirmar').onclick = () => {
        fechar();
        if (typeof onConfirm === 'function') onConfirm();
    };

    overlay.appendChild(modalBox);
    document.body.appendChild(overlay);
};
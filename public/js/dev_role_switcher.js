// public/js/dev_role_switcher.js
// Troca rápida LOCAL entre painel Admin e painel Psicólogo (equivalente ao switcher do app mobile).
// Nunca é exibido nem executado em produção (yelopsi.com.br ou domínios públicos).
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.YeloDevRoleSwitcher = factory();
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const DEV_SESSIONS_KEY = 'Yelo_dev_sessions';
    const PRIVATE_IPV4_PATTERNS = [
        /^192\.168\.\d{1,3}\.\d{1,3}$/,
        /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
        /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/
    ];

    function isLocalDevHost(hostnameOverride) {
        const raw = typeof hostnameOverride === 'string'
            ? hostnameOverride
            : (typeof window !== 'undefined' && window.location ? window.location.hostname : '');
        const host = String(raw || '').trim().toLowerCase();
        if (!host) return false;
        if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]') {
            return true;
        }
        return PRIVATE_IPV4_PATTERNS.some((re) => re.test(host));
    }

    function readDevSessions() {
        if (!isLocalDevHost() || typeof localStorage === 'undefined') return {};
        try {
            const raw = localStorage.getItem(DEV_SESSIONS_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (e) {
            return {};
        }
    }

    function writeDevSessions(sessions) {
        if (!isLocalDevHost() || typeof localStorage === 'undefined') return;
        try {
            localStorage.setItem(DEV_SESSIONS_KEY, JSON.stringify(sessions));
        } catch (e) {
            // Ignora erro de quota
        }
    }

    function recordSession(role, userObj) {
        if (!isLocalDevHost() || typeof localStorage === 'undefined') return;
        if (role !== 'admin' && role !== 'psychologist') return;
        const token = localStorage.getItem('Yelo_token');
        if (!token) return;

        const sessions = readDevSessions();
        sessions[role] = {
            token,
            id: userObj?.id ?? null,
            nome: userObj?.nome || '',
            email: userObj?.email || '',
            isAdmin: Boolean(userObj?.isAdmin || role === 'admin'),
            savedAt: Date.now()
        };
        writeDevSessions(sessions);
    }

    function applyClientSessionState(targetRole, token, userObj) {
        if (typeof localStorage === 'undefined') return;
        if (token) localStorage.setItem('Yelo_token', token);
        localStorage.setItem('Yelo_user_type', targetRole);
        localStorage.setItem('yelo_known_pro', targetRole);
        if (userObj) {
            try {
                localStorage.setItem('Yelo_user', JSON.stringify({
                    id: userObj.id ?? null,
                    nome: userObj.nome || '',
                    email: userObj.email || '',
                    isAdmin: Boolean(userObj.isAdmin)
                }));
            } catch (e) {
                // Ignora erro de serialização
            }
        }
        if (targetRole === 'psychologist') {
            localStorage.removeItem('yelo_last_psi_page');
        }
    }

    async function canAccessEndpointWithToken(endpoint, token) {
        if (!token || typeof fetch !== 'function') return false;
        try {
            const baseUrl = (typeof window !== 'undefined' && window.API_BASE_URL) ? window.API_BASE_URL : '';
            const res = await fetch(`${baseUrl}${endpoint}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return res.ok;
        } catch (e) {
            return false;
        }
    }

    async function clearHttpOnlyCookie() {
        if (typeof fetch !== 'function') return;
        try {
            await fetch('/logout', { method: 'GET', credentials: 'include' });
        } catch (e) {
            // Melhor esforço para limpar cookie HttpOnly antes de trocar token
        }
    }

    async function switchToRole(targetRole, buttonEl) {
        if (!isLocalDevHost()) return;
        if (targetRole !== 'admin' && targetRole !== 'psychologist') return;

        const currentRole = targetRole === 'admin' ? 'psychologist' : 'admin';
        const endpoint = targetRole === 'admin' ? '/api/admin/me' : '/api/psychologists/me';
        const targetPath = targetRole === 'admin' ? '/admin' : '/psi/psi_dashboard.html';

        const labelTarget = buttonEl ? (buttonEl.querySelector('.dev-switch-label') || buttonEl) : null;
        const prevLabel = labelTarget ? labelTarget.textContent : '';
        if (buttonEl) {
            buttonEl.disabled = true;
            if (labelTarget) labelTarget.textContent = 'Trocando...';
        }

        try {
            const currentToken = typeof localStorage !== 'undefined' ? localStorage.getItem('Yelo_token') : null;
            if (currentToken && typeof localStorage !== 'undefined') {
                const rawUser = localStorage.getItem('Yelo_user');
                let parsedUser = null;
                try { parsedUser = rawUser ? JSON.parse(rawUser) : null; } catch (e) { parsedUser = null; }
                const sessions = readDevSessions();
                if (!sessions[currentRole] || sessions[currentRole].token !== currentToken) {
                    recordSession(currentRole, parsedUser || {});
                }
            }

            // 1. Verifica se o token atual já autoriza o papel de destino (ex.: Psicólogo com isAdmin: true)
            if (await canAccessEndpointWithToken(endpoint, currentToken)) {
                applyClientSessionState(targetRole, currentToken, null);
                window.location.href = targetPath;
                return;
            }

            // 2. Caso contrário, usa a sessão local salva do papel de destino (conta separada)
            const sessions = readDevSessions();
            const savedTarget = sessions[targetRole];
            if (savedTarget && savedTarget.token && savedTarget.token !== currentToken) {
                await clearHttpOnlyCookie();
                applyClientSessionState(targetRole, savedTarget.token, savedTarget);
                window.location.href = targetPath;
                return;
            }

            // 3. Se não há sessão válida nem token salvo para o destino, envia ao login real mantendo o redirect
            window.location.href = `/login?redirect=${encodeURIComponent(targetPath)}`;
        } catch (err) {
            if (buttonEl) {
                buttonEl.disabled = false;
                if (labelTarget) labelTarget.textContent = prevLabel;
            }
        }
    }

    function buildSwitchPill({ id, label, title, compact, targetRole }) {
        const btn = document.createElement('button');
        btn.id = id;
        btn.type = 'button';
        btn.title = title;
        btn.textContent = label;
        btn.style.cssText = compact
            ? 'display:inline-flex;align-items:center;gap:4px;padding:4px 9px;border-radius:999px;border:1px dashed #15803d;background:#ecfdf5;color:#14532d;font-size:0.72rem;font-weight:700;cursor:pointer;line-height:1.1;white-space:nowrap;'
            : 'display:inline-flex;align-items:center;justify-content:center;gap:6px;width:100%;margin-top:8px;padding:7px 10px;border-radius:10px;border:1px dashed #16a34a;background:#f0fdf4;color:#14532d;font-size:0.78rem;font-weight:700;cursor:pointer;transition:background-color 0.15s ease;';

        btn.addEventListener('click', () => {
            switchToRole(targetRole, btn);
        });
        return btn;
    }

    function initAdminUI(adminUser) {
        if (!isLocalDevHost() || typeof document === 'undefined') return;
        recordSession('admin', adminUser || {});

        const sidebarProfile = document.querySelector('.sidebar-profile-modern');
        if (sidebarProfile && !document.getElementById('yelo-dev-switch-sidebar-admin')) {
            sidebarProfile.appendChild(buildSwitchPill({
                id: 'yelo-dev-switch-sidebar-admin',
                label: '⇄ Conta Psicólogo (Local)',
                title: 'Troca rápida local para o painel de Psicólogo',
                compact: false,
                targetRole: 'psychologist'
            }));
        }

        const mobileBadgeGroup = document.querySelector('.mobile-header > div[style*="flex-grow"]');
        if (mobileBadgeGroup && !document.getElementById('yelo-dev-switch-mobile-admin')) {
            mobileBadgeGroup.appendChild(buildSwitchPill({
                id: 'yelo-dev-switch-mobile-admin',
                label: '⇄ Psi',
                title: 'Troca rápida local para conta de Psicólogo',
                compact: true,
                targetRole: 'psychologist'
            }));
        }
    }

    function initPsiUI(psiUser) {
        if (!isLocalDevHost() || typeof document === 'undefined') return;
        recordSession('psychologist', psiUser || {});

        const sidebarProfile = document.querySelector('.sidebar-profile-modern');
        if (sidebarProfile && !document.getElementById('yelo-dev-switch-sidebar-psi')) {
            sidebarProfile.appendChild(buildSwitchPill({
                id: 'yelo-dev-switch-sidebar-psi',
                label: '⇄ Conta Admin (Local)',
                title: 'Troca rápida local para o painel Admin / Copilot',
                compact: false,
                targetRole: 'admin'
            }));
        }

        const mobileBadgeGroup = document.querySelector('.mobile-header > div[style*="flex-grow"]');
        if (mobileBadgeGroup && !document.getElementById('yelo-dev-switch-mobile-psi')) {
            mobileBadgeGroup.appendChild(buildSwitchPill({
                id: 'yelo-dev-switch-mobile-psi',
                label: '⇄ Admin',
                title: 'Troca rápida local para conta Admin',
                compact: true,
                targetRole: 'admin'
            }));
        }
    }

    function initCopilotButton() {
        if (typeof document === 'undefined') return;
        const btn = document.getElementById('btn-dev-switch-psi');
        if (!btn) return;
        if (!isLocalDevHost()) {
            btn.style.display = 'none';
            return;
        }
        btn.style.display = 'inline-flex';
        if (btn.dataset.devSwitcherBound === '1') return;
        btn.dataset.devSwitcherBound = '1';
        btn.addEventListener('click', () => {
            switchToRole('psychologist', btn);
        });
    }

    return {
        isLocalDevHost,
        readDevSessions,
        recordSession,
        switchToRole,
        initAdminUI,
        initPsiUI,
        initCopilotButton
    };
}));

/**
 * Arquivo: questionario_services.js
 * Responsabilidade: Isolar chamadas de API e lógicas de Tracking/Analytics do Questionário.
 */
window.QuestionarioService = (function() {
    const getBaseUrl = () => (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : 'http://localhost:3001';

    const getSessionMeta = () => {
        const rawType = String(localStorage.getItem('Yelo_user_type') || '').trim().toLowerCase();
        const rawKnownPro = String(localStorage.getItem('yelo_known_pro') || '').trim().toLowerCase();
        const hasKnownCookie = document.cookie.includes('yelo_known_pro=');

        let respondentType = 'patient';
        if (rawType === 'admin') respondentType = 'admin_logged';
        else if (rawType === 'psychologist' || rawType === 'psi') respondentType = 'psychologist_logged';
        else if (rawKnownPro === 'admin') respondentType = 'admin_unlogged';
        else if (rawKnownPro === 'psychologist' || rawKnownPro === 'psi' || hasKnownCookie) respondentType = 'psychologist_unlogged';

        const rawToken = localStorage.getItem('Yelo_token');
        const token = (rawToken && rawToken !== 'cookie_auth_active' && rawToken !== 'null' && rawToken !== 'undefined')
            ? rawToken
            : null;
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (rawType) headers['X-Yelo-User-Type'] = rawType;
        if (rawKnownPro) headers['X-Yelo-Known-Pro'] = rawKnownPro;
        return { respondentType, rawType, rawKnownPro, headers, isNonPatient: respondentType !== 'patient' };
    };

    return {
        startSearch: async function() {
            try {
                const { respondentType, rawType, rawKnownPro, headers } = getSessionMeta();
                const res = await fetch(`${getBaseUrl()}/api/demand/start`, {
                    method: 'POST',
                    credentials: 'include',
                    headers,
                    body: JSON.stringify({
                        respondent_type: respondentType,
                        user_type: rawType || undefined,
                        known_pro: rawKnownPro || undefined
                    })
                });
                const data = await res.json();
                return data.searchId;
            } catch(e) {
                return null;
            }
        },
        
        saveAnswers: async function(demandAnswers) {
            try {
                const { respondentType, rawType, rawKnownPro, headers } = getSessionMeta();
                const payload = Object.assign({}, demandAnswers || {});
                if (!payload.respondent_type) {
                    payload.respondent_type = respondentType;
                }
                if (rawType && !payload.user_type) payload.user_type = rawType;
                if (rawKnownPro && !payload.known_pro) payload.known_pro = rawKnownPro;
                await fetch(`${getBaseUrl()}/api/demand/searches`, {
                    method: 'POST',
                    credentials: 'include',
                    headers,
                    body: JSON.stringify(payload)
                });
            } catch(e) {
                // Erro silencioso ao salvar métricas para não travar UX
            }
        },
        
        fetchMatch: async function(userAnswers) {
            const res = await fetch(`${getBaseUrl()}/api/psychologists/match`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userAnswers),
            });
            if (!res.ok) throw new Error("Falha ao buscar recomendações");
            return await res.json();
        },

        trackStep: function(stepIndex, questionId, searchId) {
            // Trava para não rastrear psicólogos/admins (logados ou conhecidos) nos pixels e drop-offs do funil B2C
            const { isNonPatient, headers, rawType, rawKnownPro } = getSessionMeta();
            if (isNonPatient) {
                return;
            }

            try {
                if (typeof window.gtag === 'function') {
                    window.gtag('event', 'questionario_step', { 'step_id': questionId, 'numero_pergunta': stepIndex });
                }
                if (typeof window.fbq === 'function') {
                    window.fbq('trackCustom', 'QuestionarioStep', { step_id: questionId, passo: stepIndex });
                }
            } catch (err) {}

            if (searchId) {
                try {
                    const globalUtms = JSON.parse(localStorage.getItem('yelo_global_utms') || '{}');
                    fetch(`${getBaseUrl()}/api/tracking/questionario-step`, {
                        method: 'POST',
                        credentials: 'include',
                        headers,
                        body: JSON.stringify({
                            searchId: searchId,
                            step: questionId,
                            utms: globalUtms,
                            user_type: rawType || undefined,
                            known_pro: rawKnownPro || undefined
                        })
                    }).catch(() => {});
                } catch(e) {}
            }
        },
        
        trackMatchCompleted: function() {
            try {
                if (typeof window.gtag === 'function') {
                    window.gtag('event', 'conversion', {'send_to': 'AW-11236864912/hOYjCPO1lqAcEJDnk-4p'});
                    window.gtag('event', 'match_concluido');
                }
            } catch (err) {}
        }
    };
})();
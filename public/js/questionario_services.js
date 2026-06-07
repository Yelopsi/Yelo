/**
 * Arquivo: questionario_services.js
 * Responsabilidade: Isolar chamadas de API e lógicas de Tracking/Analytics do Questionário.
 */
window.QuestionarioService = (function() {
    const getBaseUrl = () => (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : 'http://localhost:3001';

    return {
        startSearch: async function() {
            try {
                const res = await fetch(`${getBaseUrl()}/api/demand/start`, { method: 'POST' });
                const data = await res.json();
                return data.searchId;
            } catch(e) {
                return null;
            }
        },
        
        saveAnswers: async function(demandAnswers) {
            try {
                await fetch(`${getBaseUrl()}/api/demand/searches`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(demandAnswers)
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
            try {
                if (typeof window.gtag === 'function') {
                    window.gtag('event', 'passo_questionario', { 'numero_pergunta': stepIndex, 'nome_pergunta': questionId });
                }
                if (typeof window.fbq === 'function') {
                    window.fbq('trackCustom', 'PassoQuestionario', { passo: stepIndex, nome_pergunta: questionId });
                }
            } catch (err) {}

            if (searchId) {
                try {
                    const globalUtms = JSON.parse(localStorage.getItem('yelo_global_utms') || '{}');
                    fetch(`${getBaseUrl()}/api/tracking/questionario-step`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ searchId: searchId, step: questionId, utms: globalUtms })
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
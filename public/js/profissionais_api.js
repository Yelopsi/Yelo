/**
 * Arquivo: profissionais_api.js
 * Responsabilidade: Isolar as chamadas HTTP (Fetch) do questionário.
 */
window.ProfissionaisAPI = {
    checkDemand: async (userAnswers, baseUrl) => {
        const response = await fetch(`${baseUrl}/api/psychologists/check-demand`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userAnswers)
        });
        if (!response.ok) throw new Error('API Error');
        return response.json();
    },

    submitToWaitlist: async (userAnswers, baseUrl) => {
        const response = await fetch(`${baseUrl}/api/psychologists/add-to-waitlist`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userAnswers)
        });
        if (!response.ok) throw new Error('API Error');
        return response.json();
    },

    captureLeadSilent: (leadData, baseUrl) => {
        fetch(`${baseUrl}/api/psychologists/add-to-waitlist`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(leadData) 
        }).catch(() => {});
    }
};
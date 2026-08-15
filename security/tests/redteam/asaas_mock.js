// Mock do fetch global para interceptar chamadas ao Asaas durante os testes Red Team
const originalFetch = global.fetch;

exports.setup = () => {
    global.fetch = async (url, options) => {
        if (url.includes('asaas.com')) {
            // Simula latência de rede realista (Race condition window)
            await new Promise(resolve => setTimeout(resolve, 50));
            
            if (url.includes('/customers') && options.method === 'POST') {
                return {
                    ok: true,
                    json: async () => ({ id: 'cus_mocked123' })
                };
            }
            if (url.includes('/customers') && options.method === 'GET') {
                return {
                    ok: true,
                    text: async () => JSON.stringify({ data: [] })
                };
            }
            if (url.includes('/subscriptions') && options.method === 'POST') {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ id: 'sub_mocked123', status: 'ACTIVE' })
                };
            }
            
            return {
                ok: true,
                status: 200,
                json: async () => ({})
            };
        }
        // Fallback for other fetches
        if (originalFetch) return originalFetch(url, options);
        return { ok: true, json: async () => ({}) };
    };
};

exports.teardown = () => {
    global.fetch = originalFetch;
};

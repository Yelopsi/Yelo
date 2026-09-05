const fetch = require('node-fetch');

class MeasurementProtocolService {
    constructor() {
        // Obter as variáveis de ambiente
        this.apiSecret = process.env.GA_API_SECRET;
        this.measurementId = process.env.GA_MEASUREMENT_ID; // ex: G-XXXXXXXXXX
        this.enabled = !!(this.apiSecret && this.measurementId);
    }

    /**
     * Envia um evento server-side para o Google Analytics 4
     * @param {string} clientId O identificador único do usuário (ou gerado)
     * @param {string} eventName Nome do evento (ex: 'psychologist_approved', 'purchase')
     * @param {object} eventParams Parâmetros adicionais do evento
     * @param {object} userProperties Propriedades do usuário (ex: utm_source, utm_medium)
     */
    async sendEvent(clientId, eventName, eventParams = {}, userProperties = {}) {
        if (!this.enabled) {
            console.log(`[GA4 Server] Evento ${eventName} ignorado: Credenciais GA não configuradas.`);
            return false;
        }

        try {
            const endpoint = `https://www.google-analytics.com/mp/collect?measurement_id=${this.measurementId}&api_secret=${this.apiSecret}`;

            // Prepara o payload conforme as especificações do GA4
            const payload = {
                client_id: clientId || 'server_default_client',
                events: [{
                    name: eventName,
                    params: eventParams
                }]
            };

            // Adiciona user_properties se houver
            if (Object.keys(userProperties).length > 0) {
                payload.user_properties = {};
                for (const [key, value] of Object.entries(userProperties)) {
                    if (value) {
                        payload.user_properties[key] = { value: String(value) };
                    }
                }
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                console.error(`[GA4 Server] Erro ao enviar evento ${eventName} para GA4: HTTP ${response.status}`);
                return false;
            }

            console.log(`[GA4 Server] Evento ${eventName} enviado com sucesso para clientId ${clientId}`);
            return true;

        } catch (error) {
            console.error(`[GA4 Server] Falha ao enviar evento ${eventName}:`, error);
            return false;
        }
    }
}

module.exports = new MeasurementProtocolService();

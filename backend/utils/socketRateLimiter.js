// ============================================================================
// SOCKET.IO IN-MEMORY RATE LIMITER (FLOOD PROTECTION)
// ============================================================================
// Atenção: Esta é uma solução in-memory (Não distribuída).
// Em um cenário multi-instância (ex: cluster Kubernetes com N réplicas Node.js),
// isso deve ser trocado por um Redis Store ou similar.
// Como o Yelo roda em instância única atualmente, o in-memory atende à demanda.

class SocketRateLimiter {
    constructor() {
        // limiters será um Map de stores. Ex: limiters.get('connection_ip') => Map<IP, Record>
        this.limiters = new Map();
        
        // Cleanup global de memória a cada 60 segundos
        setInterval(() => this.cleanup(), 60 * 1000).unref();
    }

    /**
     * Limpa chaves expiradas para evitar Memory Leaks (Crescimento contínuo de Map)
     */
    cleanup() {
        const now = Date.now();
        for (const [storeName, store] of this.limiters.entries()) {
            for (const [key, record] of store.entries()) {
                if (now > record.resetTime) {
                    store.delete(key);
                }
            }
        }
    }

    /**
     * Verifica e consome cota do limite.
     * @param {string} storeName Nome do bucket (ex: 'connection_ip', 'event_message')
     * @param {string} key Identificador único (IP, UserId, SocketId)
     * @param {number} limit Máximo de requisições permitidas
     * @param {number} windowMs Janela de tempo em milissegundos
     * @returns {boolean} True se permitiu (ALLOW), False se bloqueou (DENY)
     */
    consume(storeName, key, limit, windowMs) {
        if (!this.limiters.has(storeName)) {
            this.limiters.set(storeName, new Map());
        }

        const store = this.limiters.get(storeName);
        const now = Date.now();
        const record = store.get(key);

        if (!record || now > record.resetTime) {
            // Cria um novo record
            store.set(key, { count: 1, resetTime: now + windowMs });
            return true; // ALLOW
        }

        if (record.count >= limit) {
            // Estourou o limite (DENY)
            // Atualizamos o resetTime (Punição: Sliding Window) para desencorajar abuse contínuo
            record.resetTime = now + windowMs;
            return false; 
        }

        // ALLOW (mas incrementa)
        record.count++;
        return true;
    }
}

const limiterInstance = new SocketRateLimiter();

// ============================================================================
// CONFIGURAÇÕES DE LIMITES POR CATEGORIA
// ============================================================================

// Camada A: Limitador de Conexão (Previne ataque de recusa de serviço via Handshake flood)
exports.checkConnectionRateLimit = (ip, next) => {
    // 30 conexões por IP a cada 10 segundos
    const allowed = limiterInstance.consume('connection_ip', ip, 30, 10000);
    if (!allowed) {
        return next(new Error('Rate limit exceeded: Too many connection attempts'));
    }
    next();
};

// Camada B: Limitador de Eventos (Previne abuso de features internas)
exports.checkEventRateLimit = (socket, eventName) => {
    // Definimos uma Key segura. Usamos o ID do User se autenticado, senão o Socket ID.
    const userKey = socket.user?.id ? `user_${socket.user.id}` : `socket_${socket.id}`;
    
    // Regras por categoria de evento
    let limit = 20; // Default
    let windowMs = 5000; // 5 segundos

    // Eventos Administrativos (Restritos)
    if (eventName === 'admin_sent_message' || eventName === 'admin_action') {
        limit = 5;
        windowMs = 5000; 
    } 
    // Eventos Sensíveis / Pesados (Mensagens, Recibos de Leitura)
    else if (eventName === 'messages_read' || eventName === 'message_delivered') {
        limit = 30;
        windowMs = 5000;
    }
    // Alta frequência (Typing, Presence - Limites flexíveis)
    else if (eventName === 'typing' || eventName === 'ping') {
        limit = 100;
        windowMs = 5000;
    }

    const allowed = limiterInstance.consume(`event_${eventName}`, userKey, limit, windowMs);
    
    // Se o evento for barrado repetidamente, podemos adicionar logica de force disconnect
    // Para simplificar a mitigação de Memory e CPU, nós apenas dropamos.
    return allowed;
};

// Expondo a instância caso precise ser debuggada/limpa via testes
exports.limiterInstance = limiterInstance;

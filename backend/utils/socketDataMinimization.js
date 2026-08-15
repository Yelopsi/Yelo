// ============================================================================
// SOCKET DATA MINIMIZATION (ALLOWLIST CENTRALIZADA)
// ============================================================================
// Política de segurança: NENHUM objeto de banco de dados deve ser jogado 
// cru no Socket.io. Apenas campos explicitamente definidos nestes DTOs 
// podem trafegar. Qualquer bypass quebra o Security Gate.

const prohibitedFields = [
    'senha', 'password', 'token', 'resetToken', 'hash', 'API_KEY', 'secret',
    'cpf', 'clinical_data', 'internal_id', 'ip', 'cookies'
];

/**
 * Filtra ativamente qualquer tentativa de bypass em objetos rasos
 */
const ensureNoProhibitedFields = (payload) => {
    if (!payload || typeof payload !== 'object') return payload;
    for (const key of Object.keys(payload)) {
        if (prohibitedFields.some(prohibited => key.toLowerCase().includes(prohibited))) {
            throw new Error(`SOCKET SECURITY VIOLATION: Tentativa de envio de campo sensível '${key}' bloqueada.`);
        }
    }
    return payload;
};

// ============================================================================
// DATA TRANSFER OBJECTS (DTOs)
// ============================================================================

/**
 * DTO para Mensagens de Chat (Usado em receiveMessage e conversationUpdated)
 */
exports.dtoMessage = (msg) => {
    if (!msg) return null;
    const safePayload = {
        id: msg.id,
        content: msg.content,
        senderId: msg.senderId,
        senderType: msg.senderType,
        conversationId: msg.conversationId,
        createdAt: msg.createdAt,
        status: msg.status || 'sent',
        // Se a mensagem contiver anexo ou tipo (imagem, audio), permitimos
        type: msg.type || 'text',
        fileUrl: msg.fileUrl || null
    };
    return ensureNoProhibitedFields(safePayload);
};

/**
 * DTO para Status de Mensagem (Usado em message_status_updated)
 */
exports.dtoMessageStatus = (messageId, status) => {
    return ensureNoProhibitedFields({ messageId, status });
};

/**
 * DTO para Avisos Administrativos (Usado em new_announcement)
 */
exports.dtoAnnouncement = (aviso) => {
    if (!aviso) return null;
    return ensureNoProhibitedFields({
        id: aviso.id,
        title: aviso.title,
        content: aviso.content,
        author: aviso.author,
        status: aviso.status,
        createdAt: aviso.createdAt
    });
};

/**
 * DTO para Resultado de Scraper (Usado em scraper_finished)
 */
exports.dtoScraperResult = (success, total, message) => {
    return ensureNoProhibitedFields({ success, total, message });
};

const errorHandler = (err, req, res, next) => {
    // 1. Tratamento de Arquivos Grandes (Multer)
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'Arquivo muito grande. Limite máximo atingido.' });
    }

    // 2. Tratamento de Payload JSON Bomb/Oversized (Express Body Parser)
    if (err.type === 'entity.too.large') {
        // Silenciamos o console.error para não poluir os logs em ataques de flood
        return res.status(413).json({ error: 'Payload size exceeded.' });
    }

    // 3. Fallback Genérico
    console.error("[SERVER ERROR]", err);
    res.status(500).json({ error: 'Erro interno no servidor.' });
};

module.exports = errorHandler;
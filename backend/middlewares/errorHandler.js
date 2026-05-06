const errorHandler = (err, req, res, next) => {
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'Arquivo muito grande. Limite máximo: 10MB.' });
    }
    console.error("[SERVER ERROR]", err);
    res.status(500).json({ error: 'Erro interno no servidor.' });
};

module.exports = errorHandler;
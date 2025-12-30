const db = require('../models');

// Regex simples para validar o formato do e-mail
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.subscribe = async (req, res) => {
    const { email, origin } = req.body;
    // Pega o IP correto, mesmo se o servidor estiver atrás de um proxy como o do Render
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    if (!email || !emailRegex.test(email)) {
        return res.status(400).json({ message: 'Por favor, forneça um e-mail válido.' });
    }

    try {
        // Usamos SQL puro com ON CONFLICT para inserir o e-mail apenas se ele não existir.
        // É mais eficiente que buscar e depois inserir (findOrCreate).
        const [subscription, created] = await db.sequelize.query(
            `INSERT INTO "NewsletterSubscriptions" ("email", "origin", "ipAddress", "createdAt", "updatedAt")
             VALUES (:email, :origin, :ipAddress, NOW(), NOW())
             ON CONFLICT ("email") DO NOTHING
             RETURNING "id"`, // RETURNING "id" nos diz se uma nova linha foi inserida
            {
                replacements: { email: email.toLowerCase(), origin: origin || 'desconhecida', ipAddress },
                type: db.sequelize.QueryTypes.INSERT
            }
        );

        // Se 'created' for maior que 0, significa que um novo registro foi criado.
        if (created > 0) {
            // TODO: Integrar com serviço de e-mail marketing (Brevo, Mailchimp, etc.)
            // Ex: await addToBrevoList(email);
            return res.status(201).json({ message: 'Inscrição realizada com sucesso!' });
        } else {
            return res.status(200).json({ message: 'Você já está inscrito!' });
        }

    } catch (error) {
        console.error('Erro ao inscrever na newsletter:', error);
        return res.status(500).json({ message: 'Ocorreu um erro no servidor. Tente novamente.' });
    }
};
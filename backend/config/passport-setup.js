const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('../models');
const crypto = require('crypto'); // Adicionado para gerar senhas aleatórias

passport.serializeUser((user, done) => {
    // Salva o ID do usuário e o tipo na sessão
    done(null, { id: user.id, type: user.type });
});

passport.deserializeUser(async (sessionData, done) => {
    // Busca o usuário no banco de dados com base no ID e tipo salvos na sessão
    try {
        let user;
        if (sessionData.type === 'patient') {
            user = await db.Patient.findByPk(sessionData.id);
        } else if (sessionData.type === 'psychologist') {
            user = await db.Psychologist.findByPk(sessionData.id);
        }
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

passport.use(
    new GoogleStrategy({
        // Opções para a estratégia do Google
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/api/auth/google/callback', // A rota que o Google redirecionará após o login
        passReqToCallback: true // Permite passar o objeto 'req' para o callback
    },
    async (req, accessToken, refreshToken, profile, done) => {
        // Esta função é chamada quando o Google autentica o usuário com sucesso
        const userType = req.session.userType; // Pega o tipo de usuário salvo na sessão
        const email = profile.emails[0].value;
        const nome = profile.displayName;

        const model = userType === 'patient' ? db.Patient : db.Psychologist;

        try {
            let [user, created] = await model.findOrCreate({
                where: { email: email },
                defaults: { 
                    nome: nome, 
                    email: email,
                    // Gera uma senha aleatória e segura para novos usuários sociais.
                    // Esta senha não será usada para login, mas satisfaz a regra do banco de dados.
                    senha: crypto.randomBytes(32).toString('hex')
                }
            });
            user.type = userType; // Adiciona o tipo ao objeto do usuário para a sessão
            done(null, user);
        } catch (error) {
            done(error, null);
        }
    })
);
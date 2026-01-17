// backend/config/passport.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('../models');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/api/auth/google/callback",
    passReqToCallback: true // Necessário para ler req.session.registerType
},
async (req, accessToken, refreshToken, profile, done) => {
    try {
        const email = profile.emails[0].value;
        const nome = profile.displayName;
        const registerType = req.session.registerType; // 'psychologist' ou undefined

        // 1. Verifica se é ADMIN
        const admins = await db.sequelize.query(
            'SELECT * FROM "Admins" WHERE email = :email LIMIT 1',
            { replacements: { email }, type: db.sequelize.QueryTypes.SELECT }
        );
        
        if (admins && admins.length > 0) {
            const adminUser = admins[0];
            adminUser.type = 'admin'; // Define o tipo manualmente
            return done(null, adminUser);
        }

        // 2. Verifica se é PSICÓLOGO
        const psi = await db.Psychologist.findOne({ where: { email } });
        if (psi) {
            psi.dataValues.type = 'psychologist';
            return done(null, psi);
        }

        // 3. Verifica se é PACIENTE
        let patient = await db.Patient.findOne({ where: { email } });
        if (patient) {
            patient.dataValues.type = 'patient';
            return done(null, patient);
        }

        // 4. Se não existe, CRIA NOVO USUÁRIO
        const randomPassword = crypto.randomBytes(16).toString('hex');
        const hashedPassword = await bcrypt.hash(randomPassword, 10);
        
        if (registerType === 'psychologist') {
            // Cria Psicólogo (sem CRP por enquanto, será pedido no onboarding)
            const newPsi = await db.Psychologist.create({
                nome,
                email,
                senha: hashedPassword,
                status: 'pending_docs', // Status pendente
                xp: 500 // Bônus inicial
            });
            newPsi.dataValues.type = 'psychologist';
            return done(null, newPsi);
        } else {
            // Padrão: Cria Paciente
            const newPatient = await db.Patient.create({
                nome,
                email,
                senha: hashedPassword,
                termos_aceitos: true,
                marketing_aceito: false,
                ip_registro: 'google-oauth'
            });
            newPatient.dataValues.type = 'patient';
            return done(null, newPatient);
        }
    } catch (err) {
        return done(err, null);
    }
}));

module.exports = passport;

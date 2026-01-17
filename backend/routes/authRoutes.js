const router = require('express').Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');

// Função para gerar o token (similar às que você já tem)
const generateToken = (id, type) => {
    return jwt.sign({ id, type }, process.env.JWT_SECRET || 'secreto_yelo_dev', { expiresIn: '30d' });
};

// Rota de entrada para autenticação com Google
router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email']
}));

// Rota específica para cadastro de PSICÓLOGO via Google
router.get('/google/psychologist', (req, res, next) => {
    req.session.registerType = 'psychologist'; // Define intenção de cadastro
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

// Rota de callback que o Google chama após o login
router.get('/google/callback', 
    passport.authenticate('google', { failureRedirect: '/login?error=google_auth_failed', session: false }),
    (req, res) => {
        // Se a autenticação foi bem-sucedida, o usuário está em req.user
        const user = req.user;
        
        // O tipo vem do passport.js (admin, psychologist ou patient)
        const userType = user.type || (user.dataValues && user.dataValues.type) || 'patient';

        // Gera um token JWT para o usuário
        const token = generateToken(user.id, userType);
        const userName = user.nome;

        // Define o destino com base no tipo
        let dashboardPath = '/patient/patient_dashboard'; // Padrão
        
        if (userType === 'admin') {
            dashboardPath = '/admin';
        } else if (userType === 'psychologist') {
            dashboardPath = '/psi/psi_dashboard.html';
            // Lógica de Onboarding para Psicólogos (se não tiver CRP)
            if (!user.crp) {
                dashboardPath = '/psi/completar-perfil'; 
            }
        }

        // Redireciona para uma view intermediária que salva o token no localStorage
        // Codificamos os parâmetros para passar na URL
        res.redirect(`/auth-callback?token=${token}&type=${userType}&name=${encodeURIComponent(userName)}&redirect=${dashboardPath}`);
    }
);

module.exports = router;
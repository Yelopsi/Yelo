const router = require('express').Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');

// Função para gerar o token (similar às que você já tem)
const generateToken = (id, type) => {
    return jwt.sign({ id, type }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// Rota de entrada para autenticação com Google
// Ex: GET /api/auth/google?userType=patient
router.get('/google', (req, res, next) => {
    // Salva o tipo de usuário na sessão para usar no callback
    req.session.userType = req.query.userType;
    passport.authenticate('google', {
        scope: ['profile', 'email'] // Pede ao Google o perfil e o e-mail do usuário
    })(req, res, next);
});

// Rota de callback que o Google chama após o login
router.get('/google/callback', passport.authenticate('google', {
    failureRedirect: '/login.html?error=auth_failed', // Redireciona se o usuário cancelar
    session: false // Não vamos usar sessões persistentes, apenas para o fluxo OAuth
}), (req, res) => {
    // Se a autenticação foi bem-sucedida, o usuário está em req.user
    const user = req.user;
    const userType = req.session.userType;

    // Gera um token JWT para o usuário
    const token = generateToken(user.id, userType);

    let dashboardPath = userType === 'patient' ? '/patient/patient_dashboard.html' : '/psi/psi_dashboard.html';

    // **NOVO**: Lógica de Onboarding para Psicólogos
    // Se for um psicólogo e o campo CRP estiver nulo/vazio, redireciona para a página de completar perfil.
    if (userType === 'psychologist' && !user.crp) {
        dashboardPath = '/psi_completar_perfil.html';
    }

    // Redireciona o usuário para uma página intermediária no front-end
    // que irá salvar o token e redirecionar para o dashboard correto.
    res.redirect(`http://127.0.0.1:5500/auth_callback.html?token=${token}&dashboard=${dashboardPath}`);
});

module.exports = router;
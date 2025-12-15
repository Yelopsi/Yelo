const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');
const { protect } = require('../middleware/authMiddleware'); // Importa o Middleware

// Rota de Registro: /api/patients/register (Acesso Público)
router.post('/register', patientController.registerPatient);

// Rota de Login: /api/patients/login (Acesso Público)
router.post('/login', patientController.loginPatient);

// Rota de Dados do Paciente Logado: /api/patients/me (Acesso PRIVADO)
// O middleware 'protect' é executado ANTES do controller. 
// Ele garante que o token JWT seja válido.
router.get('/me', protect, patientController.getPatientData);

// Rota para SALVAR as respostas do questionário (Acesso PRIVADO)
router.put('/answers', protect, patientController.updatePatientAnswers);

// Rota para ATUALIZAR os dados do paciente (Acesso PRIVADO)
router.put('/me', protect, patientController.updatePatientDetails);

// Rota para buscar as avaliações do paciente logado (Acesso PRIVADO)
router.get('/me/reviews', protect, patientController.getPatientReviews);

// Rota para buscar os favoritos do paciente logado (Acesso PRIVADO)
router.get('/me/favorites', protect, patientController.getFavorites);

// Rota para adicionar/remover um favorito (Acesso PRIVADO) - Método alterado para PUT
router.put('/me/favorites', protect, patientController.toggleFavorite);

// Rota para alterar a senha do paciente (Acesso PRIVADO)
router.put('/me/password', protect, patientController.updatePatientPassword);

// Rota para EXCLUIR a conta do paciente (Acesso PRIVADO)
router.delete('/me', protect, patientController.deletePatientAccount);

module.exports = router;

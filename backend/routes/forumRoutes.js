const express = require('express');
const router = express.Router();
const forumController = require('../controllers/forumController');
const { protect } = require('../middleware/authMiddleware'); // Corrigido o caminho e o import

// Todas as rotas são protegidas
router.use(protect);

router.get('/posts', forumController.getAllPosts);
router.post('/posts', forumController.createPost);
router.put('/posts/:id', forumController.updatePost); // Rota de edição de post
router.get('/posts/:id', forumController.getPostDetails);
router.get('/posts/:id/comments', forumController.getComments);
router.post('/posts/:id/comments', forumController.createComment);
router.put('/comments/:id', forumController.updateComment); // Rota de edição de comentário
router.post('/posts/:id/vote', forumController.toggleVote);
router.post('/report', forumController.reportContent);
router.delete('/posts/:id', forumController.deletePost); // Nova rota de exclusão
router.delete('/comments/:id', forumController.deleteComment); // Rota para excluir comentários
router.post('/comments/:id/vote', forumController.toggleCommentVote); // <-- NOVA ROTA

// Rotas de Admin (Idealmente deveriam ter middleware de admin, mas usaremos o protect por enquanto)
router.get('/admin/reports', forumController.getReports);
router.post('/admin/reports/:id/resolve', forumController.resolveReport);

module.exports = router;

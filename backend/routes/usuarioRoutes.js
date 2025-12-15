// c:/Users/Anderson/Desktop/Girassol-web/backend/routes/usuarioRoutes.js
const express = require("express");
const router = express.Router();

// Rota de exemplo: GET /api/usuarios/
router.get("/", (req, res) => {
  res.json({ message: "Rota de usuários funcionando!" });
});

module.exports = router;
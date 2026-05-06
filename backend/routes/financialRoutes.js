const express = require('express');
const router = express.Router();
const db = require('../models');
const { Op } = require('sequelize');
const { verifyTokenLocal } = require('../middlewares/localAuth');

router.get('/dashboard', verifyTokenLocal, async (req, res) => {
    try {
        const decoded = req.userDecoded;
        const { month } = req.query;
        let startDate, endDate;
        
        if (month) {
            startDate = new Date(`${month}-01`);
            endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
        } else {
            const now = new Date();
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        }

        const appointments = await db.Appointment.findAll({
            where: {
                psychologistId: decoded.id,
                start: { [Op.between]: [startDate, endDate] }
            }
        });

        const expenses = await db.Expense.findAll({
            where: {
                psychologistId: decoded.id,
                date: { [Op.between]: [startDate, endDate] }
            }
        });

        res.json({ appointments, expenses });
    } catch (error) {
        console.error("Erro financeiro:", error);
        res.status(500).json({ error: 'Erro ao buscar dados financeiros.' });
    }
});

router.post('/expenses', verifyTokenLocal, async (req, res) => {
    try {
        const decoded = req.userDecoded;
        const { description, value, date } = req.body;
        const expense = await db.Expense.create({ description, value, date, psychologistId: decoded.id });
        res.json(expense);
    } catch (error) {
        console.error("Erro detalhado ao salvar despesa:", error);
        res.status(500).json({ error: 'Erro ao salvar despesa: ' + error.message });
    }
});

router.delete('/expenses/:id', verifyTokenLocal, async (req, res) => {
    try {
        const decoded = req.userDecoded;
        await db.Expense.destroy({ where: { id: req.params.id, psychologistId: decoded.id } });
        res.json({ success: true });
    } catch (error) {
        console.error("Erro em DELETE /api/financials/expenses/:id :", error);
        res.status(500).json({ error: 'Erro ao excluir despesa.' });
    }
});

module.exports = router;
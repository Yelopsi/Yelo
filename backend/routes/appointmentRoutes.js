const express = require('express');
const router = express.Router();
const db = require('../models');
const { Op } = require('sequelize');
const { verifyTokenLocal } = require('../middlewares/localAuth');

router.get('/', verifyTokenLocal, async (req, res) => {
    try {
        const decoded = req.userDecoded;
        const psiId = decoded && (decoded.id || decoded._id);
        
        if (!psiId) {
            console.error("Token sem ID em /api/appointments:", decoded);
            return res.json([]);
        }

        const appointments = await db.Appointment.findAll({
            where: { psychologistId: psiId }
        });
        const events = appointments.map(a => {
            const app = typeof a.toJSON === 'function' ? a.toJSON() : a;
            let color = '#3788d8';
            if (app.status === 'confirmed') color = '#1B4332';
            else if (app.status === 'available') color = '#FFC107';
            else if (app.status === 'done' || app.status === 'completed') color = '#9e9e9e';
            else if (app.status === 'missed' || app.status === 'absent') color = '#d32f2f';
            return { ...app, backgroundColor: color, borderColor: color };
        });
        res.json(events);
    } catch (error) {
        console.error("Erro em GET /api/appointments:", error);
        res.status(500).json({ error: 'Erro ao buscar agenda.' });
    }
});

router.get('/available', verifyTokenLocal, async (req, res) => {
    try {
        const decoded = req.userDecoded;
        const slots = await db.Appointment.findAll({
            where: {
                psychologistId: decoded.id,
                status: 'available',
                start: { [Op.gt]: new Date() }
            },
            order: [['start', 'ASC']]
        });
        res.json(slots);
    } catch (error) {
        console.error("Erro em GET /api/appointments/available:", error);
        res.status(500).json({ error: 'Erro ao buscar horários disponíveis.' });
    }
});

router.post('/', verifyTokenLocal, async (req, res) => {
    try {
        const decoded = req.userDecoded;
        const { title, start, end, patientId, phone, status } = req.body;

        const appt = await db.Appointment.create({
            title, start: start, end: end, patientId,
            psychologistId: decoded.id,
            status: status || 'scheduled',
            value: 0
        });
        res.json(appt);
    } catch (error) {
        console.error("Erro detalhado ao criar agendamento:", error);
        res.status(500).json({ error: 'Erro ao agendar: ' + error.message });
    }
});

router.put('/:id', verifyTokenLocal, async (req, res) => {
    try {
        const { status, start, end, value, phone, title } = req.body;
        const appt = await db.Appointment.findByPk(req.params.id);
        
        if (!appt) return res.status(404).json({ error: 'Agendamento não encontrado' });
        
        await appt.update({ status, start: start, end: end, value });

        if (status === 'cancelled') {
            const exists = await db.Appointment.findOne({
                where: { psychologistId: appt.psychologistId, start: appt.start, status: 'available' }
            });
            if (!exists) {
                await db.Appointment.create({
                    title: 'Disponível', start: appt.start, end: appt.end,
                    psychologistId: appt.psychologistId, status: 'available', value: 0
                });
            }
        }
        res.json(appt);
    } catch (error) {
        console.error("Erro em PUT /api/appointments/:id :", error);
        res.status(500).json({ error: 'Erro ao atualizar agendamento.' });
    }
});

router.post('/:id/remind', verifyTokenLocal, async (req, res) => {
    try {
        res.json({ success: true, message: 'Funcionalidade em configuração. Lembrete simulado com sucesso!' });
    } catch (error) {
        console.error("Erro ao enviar lembrete manual:", error);
        res.status(500).json({ error: 'Erro ao enviar lembrete.' });
    }
});

router.delete('/:id', verifyTokenLocal, async (req, res) => {
    try {
        await db.Appointment.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (error) {
        console.error("Erro em DELETE /api/appointments/:id :", error);
        res.status(500).json({ error: 'Erro ao excluir.' });
    }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const db = require('../models');
const bcrypt = require('bcryptjs');
const { verifyTokenLocal } = require('../middlewares/localAuth');

router.get('/', verifyTokenLocal, async (req, res) => {
    try {
        const decoded = req.userDecoded;
        if (!db.Patient) {
            console.error("Erro: db.Patient não está definido.");
            return res.status(500).json({ error: 'Modelo de pacientes não encontrado.' });
        }
        const patients = await db.Patient.findAll({
            where: { psychologistId: decoded.id },
            attributes: ['id', 'nome', 'telefone', 'email', 'status', 'sessionValue', 'observacoes', 'recebe_mensagens', 'createdAt']
        }); 
        res.json(patients);
    } catch (error) {
        console.error("Erro em GET /api/my-patients:", error);
        res.status(500).json({ error: 'Erro ao buscar pacientes.' });
    }
});

router.get('/:id', verifyTokenLocal, async (req, res) => {
    try {
        const decoded = req.userDecoded;
        const { id } = req.params;
        const patient = await db.Patient.findOne({ 
            where: { id, psychologistId: decoded.id },
            attributes: ['id', 'nome', 'telefone', 'email', 'status', 'sessionValue', 'observacoes', 'recebe_mensagens', 'createdAt']
        });
        if (!patient) return res.status(404).json({ error: 'Paciente não encontrado' });
        res.json(patient);
    } catch (error) {
        console.error("Erro em GET /api/my-patients/:id :", error);
        res.status(500).json({ error: 'Erro ao buscar detalhes do paciente.' });
    }
});

router.post('/', verifyTokenLocal, async (req, res) => {
    try {
        const decoded = req.userDecoded;

        const { name, phone, email, status, sessionValue, observacoes, recebeMensagens } = req.body;
        const patient = await db.Patient.create({
            nome: name,
            email: email || null,
            telefone: phone,
            status: status || 'ativo',
            sessionValue: sessionValue || 0,
            observacoes: observacoes || '',
            recebe_mensagens: recebeMensagens !== undefined ? recebeMensagens : true,
            senha: null,
            is_ghost_profile: true,
            psychologistId: decoded.id
        });
        res.json(patient);
    } catch (error) {
        console.error("Erro ao criar paciente:", error);
        const errorMessage = process.env.NODE_ENV === 'production' 
            ? 'Erro interno ao salvar dados do paciente no banco.' 
            : 'Erro ao criar paciente: ' + (error.original?.message || error.message);
        res.status(500).json({ error: errorMessage });
    }
});

router.put('/:id', verifyTokenLocal, async (req, res) => {
    try {
        const decoded = req.userDecoded;
        const { id } = req.params;

        const { name, phone, email, status, sessionValue, observacoes, recebeMensagens } = req.body;
        
        const patient = await db.Patient.findOne({ where: { id, psychologistId: decoded.id } });
        if (!patient) return res.status(404).json({ error: 'Paciente não encontrado' });
        
        const updateData = {
            nome: name, telefone: phone, status: status, sessionValue: sessionValue,
            observacoes: observacoes || '', recebe_mensagens: recebeMensagens !== undefined ? recebeMensagens : true
        };

        if (email && email.trim() !== '' && email !== 'undefined') updateData.email = email;

        await patient.update(updateData);
        res.json(patient);
    } catch (error) {
        console.error("Erro ao atualizar paciente:", error);
        const errorMessage = process.env.NODE_ENV === 'production' 
            ? 'Erro interno ao atualizar dados do paciente.' 
            : 'Erro ao atualizar paciente: ' + (error.original?.message || error.message);
        res.status(500).json({ error: errorMessage });
    }
});

router.delete('/:id', verifyTokenLocal, async (req, res) => {
    try {
        const decoded = req.userDecoded;
        const { id } = req.params;
        const patient = await db.Patient.findOne({ where: { id, psychologistId: decoded.id } });
        
        if (!patient) return res.status(404).json({ error: 'Paciente não encontrado' });
        
        await patient.destroy();
        res.json({ success: true, message: 'Paciente excluído com sucesso.' });
    } catch (error) {
        console.error("Erro em DELETE /api/my-patients/:id :", error);
        res.status(500).json({ error: 'Erro ao excluir paciente.' });
    }
});

module.exports = router;
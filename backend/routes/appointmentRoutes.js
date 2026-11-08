const express = require('express');
const router = express.Router();
const db = require('../models');
const { Op } = require('sequelize');
const { verifyTokenLocal } = require('../middlewares/localAuth');
const {
    toBrtISODate,
    startOfDayBrt,
    endOfDayBeforeBrt,
    parseExceptions,
    serializeExceptions,
    isRecurringRule,
    parseAppointmentTargetId,
    buildSingleOccurrenceForDate,
    expandAppointmentsInRange,
} = require('../utils/recurrenceExpander');

function decorateEventColor(raw) {
    const app = typeof raw.toJSON === 'function' ? raw.toJSON() : { ...raw };
    let color = '#3788d8';
    if (app.status === 'confirmed') color = '#1B4332';
    else if (app.status === 'available') color = '#FFC107';
    else if (app.status === 'done' || app.status === 'completed') color = '#9e9e9e';
    else if (app.status === 'missed' || app.status === 'absent') color = '#d32f2f';
    return { ...app, backgroundColor: color, borderColor: color };
}

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

        // Modo compacto para o App Mobile: retorna apenas as regras base (1 linha por série infinita)
        if (req.query.mode === 'rules') {
            return res.json(appointments.map(decorateEventColor));
        }

        // Modo expandido (Web FullCalendar, Home, Perfil do Paciente, Notificações)
        const now = new Date();
        let rangeStart;
        let rangeEnd;

        if (req.query.upcoming === 'true') {
            rangeStart = now;
            rangeEnd = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
        } else {
            rangeStart = req.query.from
                ? new Date(req.query.from)
                : new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            rangeEnd = req.query.to
                ? new Date(req.query.to)
                : new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
        }

        const expanded = expandAppointmentsInRange(appointments, rangeStart, rangeEnd);
        res.json(expanded.map(decorateEventColor));
    } catch (error) {
        console.error("Erro em GET /api/appointments:", error);
        res.status(500).json({ error: 'Erro ao buscar agenda.' });
    }
});

router.get('/available', verifyTokenLocal, async (req, res) => {
    try {
        const decoded = req.userDecoded;
        const now = new Date();
        const horizon = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
        const rows = await db.Appointment.findAll({
            where: {
                psychologistId: decoded.id,
                status: 'available',
            },
            order: [['start', 'ASC']]
        });
        const slots = expandAppointmentsInRange(rows, now, horizon).sort(
            (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
        );
        res.json(slots);
    } catch (error) {
        console.error("Erro em GET /api/appointments/available:", error);
        res.status(500).json({ error: 'Erro ao buscar horários disponíveis.' });
    }
});

router.post('/', verifyTokenLocal, async (req, res) => {
    try {
        const decoded = req.userDecoded;
        const { title, start, end, patientId, status, value, recurrence } = req.body;

        if (patientId) {
            const validPatient = await db.Patient.findOne({
                where: { id: patientId, psychologistId: decoded.id }
            });
            if (!validPatient) {
                return res.status(403).json({ error: 'Paciente inválido ou não pertence a você.' });
            }
        }

        const validRecurrence = ['none', 'weekly', 'biweekly', 'monthly'].includes(recurrence)
            ? recurrence
            : 'none';

        const appt = await db.Appointment.create({
            title,
            start,
            end,
            patientId: patientId || null,
            psychologistId: decoded.id,
            status: status || 'scheduled',
            value: Number(value) || 0,
            recurrence: validRecurrence,
            recurrenceUntil: null,
            recurrenceExceptions: '[]',
            seriesId: null
        });
        res.json(appt);
    } catch (error) {
        console.error("Erro detalhado ao criar agendamento:", error);
        res.status(500).json({ error: 'Erro ao agendar: ' + error.message });
    }
});

router.post('/bulk', verifyTokenLocal, async (req, res) => {
    try {
        const decoded = req.userDecoded;
        const { appointments } = req.body;
        
        if (!appointments || !Array.isArray(appointments)) {
            return res.status(400).json({ error: 'Formato inválido. Esperado um array de agendamentos.' });
        }

        const apptsToCreate = appointments.map(appt => ({
            title: appt.title,
            start: appt.start,
            end: appt.end,
            patientId: appt.patientId || null,
            psychologistId: decoded.id,
            status: appt.status || 'scheduled',
            value: appt.value || 0,
            recurrence: 'none',
            recurrenceUntil: null,
            recurrenceExceptions: '[]'
        }));

        const createdAppts = await db.Appointment.bulkCreate(apptsToCreate);
        res.json({ success: true, count: createdAppts.length });
    } catch (error) {
        console.error("Erro detalhado ao criar agendamentos em lote:", error);
        res.status(500).json({ error: 'Erro ao agendar em lote: ' + error.message });
    }
});

router.put('/:id', verifyTokenLocal, async (req, res) => {
    try {
        const decoded = req.userDecoded;
        const parsed = parseAppointmentTargetId(req.params.id);
        const {
            status,
            start,
            end,
            value,
            title,
            patientId,
            recurrence,
            occurrenceDate: bodyOccurrenceDate,
            scope = 'single'
        } = req.body;

        const appt = await db.Appointment.findOne({
            where: { id: parsed.id, psychologistId: decoded.id }
        });
        
        if (!appt) return res.status(404).json({ error: 'Agendamento não encontrado' });

        if (patientId) {
            const validPatient = await db.Patient.findOne({
                where: { id: patientId, psychologistId: decoded.id }
            });
            if (!validPatient) {
                return res.status(403).json({ error: 'Paciente inválido ou não pertence a você.' });
            }
        }

        // Caso o registro alvo seja uma REGRA RECORRENTE INFINITA
        if (isRecurringRule(appt)) {
            const masterPlain = appt.toJSON();
            const masterStartISO = toBrtISODate(masterPlain.start);
            const targetOccISO = parsed.occurrenceDate || bodyOccurrenceDate || masterStartISO;

            if (scope === 'future') {
                const nextRecurrence = ['none', 'weekly', 'biweekly', 'monthly'].includes(recurrence)
                    ? recurrence
                    : masterPlain.recurrence;

                if (targetOccISO <= masterStartISO) {
                    const updateData = {};
                    if (status !== undefined) updateData.status = status;
                    if (start !== undefined) updateData.start = start;
                    if (end !== undefined) updateData.end = end;
                    if (value !== undefined) updateData.value = value;
                    if (title !== undefined) updateData.title = title;
                    if (patientId !== undefined) updateData.patientId = patientId;
                    updateData.recurrence = nextRecurrence;
                    await appt.update(updateData);
                    return res.json(appt);
                } else {
                    // Encerra a regra antiga no dia anterior e inicia nova regra daqui em diante
                    await appt.update({ recurrenceUntil: endOfDayBeforeBrt(targetOccISO) });
                    const { occStart, occEnd } = buildSingleOccurrenceForDate(masterPlain, targetOccISO);
                    const newMaster = await db.Appointment.create({
                        title: title !== undefined ? title : masterPlain.title,
                        start: start !== undefined ? start : occStart,
                        end: end !== undefined ? end : occEnd,
                        patientId: patientId !== undefined ? patientId : masterPlain.patientId,
                        psychologistId: decoded.id,
                        status: status !== undefined ? status : masterPlain.status,
                        value: value !== undefined ? value : masterPlain.value,
                        recurrence: nextRecurrence,
                        recurrenceUntil: null,
                        recurrenceExceptions: '[]',
                        seriesId: null
                    });
                    return res.json(newMaster);
                }
            }

            // Escopo 'single': destaca apenas este dia específico como linha individual e registra exceção na regra
            const exceptions = parseExceptions(masterPlain.recurrenceExceptions);
            if (!exceptions.includes(targetOccISO)) {
                exceptions.push(targetOccISO);
                await appt.update({ recurrenceExceptions: serializeExceptions(exceptions) });
            }

            const { occStart, occEnd } = buildSingleOccurrenceForDate(masterPlain, targetOccISO);
            const finalStart = start !== undefined ? start : occStart;
            const finalEnd = end !== undefined ? end : occEnd;
            const finalStatus = status !== undefined ? status : masterPlain.status;

            const detached = await db.Appointment.create({
                title: title !== undefined ? title : masterPlain.title,
                start: finalStart,
                end: finalEnd,
                patientId: patientId !== undefined ? patientId : masterPlain.patientId,
                psychologistId: decoded.id,
                status: finalStatus,
                value: value !== undefined ? value : masterPlain.value,
                recurrence: 'none',
                recurrenceUntil: null,
                recurrenceExceptions: '[]',
                seriesId: appt.id
            });

            if (finalStatus === 'cancelled') {
                const exists = await db.Appointment.findOne({
                    where: { psychologistId: appt.psychologistId, start: finalStart, status: 'available' }
                });
                if (!exists) {
                    await db.Appointment.create({
                        title: 'Disponível',
                        start: finalStart,
                        end: finalEnd,
                        psychologistId: appt.psychologistId,
                        status: 'available',
                        value: 0,
                        recurrence: 'none'
                    });
                }
            }

            return res.json(detached);
        }

        // Caso normal (evento único ou ocorrência já materializada)
        const updateData = {};
        if (status !== undefined) updateData.status = status;
        if (start !== undefined) updateData.start = start;
        if (end !== undefined) updateData.end = end;
        if (value !== undefined) updateData.value = value;
        if (title !== undefined) updateData.title = title;
        if (patientId !== undefined) updateData.patientId = patientId;
        if (recurrence !== undefined && ['none', 'weekly', 'biweekly', 'monthly'].includes(recurrence)) {
            updateData.recurrence = recurrence;
        }
        
        await appt.update(updateData);

        if (status === 'cancelled') {
            const exists = await db.Appointment.findOne({
                where: { psychologistId: appt.psychologistId, start: appt.start, status: 'available' }
            });
            if (!exists) {
                await db.Appointment.create({
                    title: 'Disponível', start: appt.start, end: appt.end,
                    psychologistId: appt.psychologistId, status: 'available', value: 0, recurrence: 'none'
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

router.delete('/bulk', verifyTokenLocal, async (req, res) => {
    try {
        const decoded = req.userDecoded;
        const { ids } = req.body;
        
        if (!ids || !Array.isArray(ids)) {
            return res.status(400).json({ error: 'Formato inválido. Esperado um array de IDs.' });
        }

        const numericIds = ids
            .map(raw => parseAppointmentTargetId(raw).id)
            .filter(n => Number.isFinite(n) && n > 0);

        if (numericIds.length > 0) {
            await db.Appointment.destroy({ 
                where: { 
                    id: { [Op.in]: numericIds },
                    psychologistId: decoded.id 
                } 
            });
        }
        res.json({ success: true });
    } catch (error) {
        console.error("Erro em DELETE /api/appointments/bulk :", error);
        res.status(500).json({ error: 'Erro ao excluir em lote.' });
    }
});

router.delete('/:id', verifyTokenLocal, async (req, res) => {
    try {
        const decoded = req.userDecoded;
        const parsed = parseAppointmentTargetId(req.params.id);
        const scope = req.query.scope || (req.body && req.body.scope) || 'single';
        const queryOccDate = req.query.occurrenceDate || (req.body && req.body.occurrenceDate);

        const appt = await db.Appointment.findOne({
            where: { id: parsed.id, psychologistId: decoded.id }
        });

        if (!appt) {
            return res.json({ success: true });
        }

        if (isRecurringRule(appt)) {
            const masterPlain = appt.toJSON();
            const masterStartISO = toBrtISODate(masterPlain.start);
            const targetOccISO = parsed.occurrenceDate || queryOccDate || masterStartISO;

            if (scope === 'future') {
                const cutoffStart = startOfDayBrt(targetOccISO);
                // Remove ocorrências materializadas desta série a partir desta data
                await db.Appointment.destroy({
                    where: {
                        seriesId: appt.id,
                        psychologistId: decoded.id,
                        start: { [Op.gte]: cutoffStart }
                    }
                });

                if (targetOccISO <= masterStartISO) {
                    await appt.destroy();
                } else {
                    await appt.update({ recurrenceUntil: endOfDayBeforeBrt(targetOccISO) });
                }
                return res.json({ success: true });
            }

            // Escopo 'single': adiciona apenas esta data às exceções da regra infinita
            const exceptions = parseExceptions(masterPlain.recurrenceExceptions);
            if (!exceptions.includes(targetOccISO)) {
                exceptions.push(targetOccISO);
                await appt.update({ recurrenceExceptions: serializeExceptions(exceptions) });
            }
            return res.json({ success: true });
        }

        // Caso seja uma ocorrência materializada pertencente a uma série e o psicólogo escolha excluir os futuros
        if (scope === 'future' && appt.seriesId) {
            const targetOccISO = toBrtISODate(appt.start);
            const cutoffStart = startOfDayBrt(targetOccISO);
            const master = await db.Appointment.findOne({
                where: { id: appt.seriesId, psychologistId: decoded.id }
            });
            if (master) {
                const masterStartISO = toBrtISODate(master.start);
                if (targetOccISO <= masterStartISO) {
                    await master.destroy();
                } else {
                    await master.update({ recurrenceUntil: endOfDayBeforeBrt(targetOccISO) });
                }
            }
            await db.Appointment.destroy({
                where: {
                    seriesId: appt.seriesId,
                    psychologistId: decoded.id,
                    start: { [Op.gte]: cutoffStart }
                }
            });
            await appt.destroy();
            return res.json({ success: true });
        }

        await appt.destroy();
        res.json({ success: true });
    } catch (error) {
        console.error("Erro em DELETE /api/appointments/:id :", error);
        res.status(500).json({ error: 'Erro ao excluir.' });
    }
});

module.exports = router;

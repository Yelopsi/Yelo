const db = require('../models');
const { Op } = require('sequelize');

const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'yelo_webhook_123';

exports.verifyWebhook = (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
        console.log('✅ [WHATSAPP] Webhook verificado pela Meta!');
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
};

exports.handleMessage = async (req, res) => {
    try {
        const body = req.body;
        if (body.object === 'whatsapp_business_account') {
            for (const entry of body.entry) {
                for (const change of entry.changes) {
                    const value = change.value;
                    if (value.messages && value.messages[0]) {
                        const message = value.messages[0];
                        const phone = message.from;
                        if (message.type === 'interactive' && message.interactive.type === 'button_reply') {
                            const buttonText = message.interactive.button_reply.title.toUpperCase();
                            console.log(`📱 [WHATSAPP] Paciente ${phone} clicou em: [${buttonText}]`);
                            const phoneSuffix = phone.startsWith('55') ? phone.substring(2) : phone;
                            const patient = await db.Patient.findOne({ where: { telefone: { [Op.like]: `%${phoneSuffix}%` } } });
                            if (patient) {
                                const appointment = await db.Appointment.findOne({ where: { patientId: patient.id, status: 'scheduled' }, order: [['start', 'ASC']] });
                                if (appointment) {
                                    if (buttonText.includes('CONFIRMAR') || buttonText.includes('SIM')) await appointment.update({ status: 'confirmed' });
                                    else if (buttonText.includes('CANCELAR') || buttonText.includes('NÃO')) { await appointment.update({ status: 'cancelled' }); await db.Appointment.create({ title: 'Disponível', start: appointment.start, end: appointment.end, psychologistId: appointment.psychologistId, status: 'available', value: 0 }); }
                                    else if (buttonText.includes('REAGENDAR') || buttonText.includes('TROCAR')) await appointment.update({ status: 'rescheduled' });
                                }
                            }
                        } else if (message.type === 'text') {
                            console.log(`📱 [WHATSAPP] Texto recebido de ${phone}: ${message.text.body}`);
                        }
                    }
                }
            }
            res.status(200).send('EVENT_RECEIVED');
        } else res.sendStatus(404);
    } catch (error) { console.error("❌ [WHATSAPP] Erro no webhook:", error); res.sendStatus(500); }
};
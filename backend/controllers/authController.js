const db = require('../models');
const jwt = require('jsonwebtoken');
const https = require('https');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { sendWelcomeEmail } = require('../services/emailService');

// Função Auxiliar: Gera Token JWT
const generateToken = (id, type) => {
    return jwt.sign({ id, type }, process.env.JWT_SECRET || 'secreto_yelo_dev', {
        expiresIn: '30d',
    });
};

// Função Auxiliar: Verifica Token do Google
exports.verifyGoogleToken = (token) => {
    return new Promise((resolve, reject) => {
        https.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`, (resp) => {
            let data = '';
            resp.on('data', (chunk) => data += chunk);
            resp.on('end', () => {
                if (resp.statusCode === 200) {
                    resolve(JSON.parse(data));
                } else {
                    reject(new Error('Token do Google inválido'));
                }
            });
        }).on('error', (err) => reject(err));
    });
};

exports.unifiedGoogleLogin = async (req, res) => {
    try {
        const { token, targetRole } = req.body;
        if (!token) return res.status(400).json({ error: 'Token do Google obrigatório.' });

        const googleUser = await exports.verifyGoogleToken(token);
        const { email, name, sub: googleId, picture } = googleUser;

        console.log(`[AUTH] Tentativa de login Google: ${email}`);

        // 1. Verifica Psicólogo
        let psychologist = await db.Psychologist.findOne({ where: { email } });
        
        if (psychologist) {
            if (psychologist.status !== 'active' && psychologist.status !== 'content_creator') {
                return res.status(403).json({ error: 'Esta conta de psicólogo está inativa.' });
            }
            if (!psychologist.fotoUrl && picture) {
                await psychologist.update({ fotoUrl: picture });
            }

            const tokenJwt = generateToken(psychologist.id, psychologist.isAdmin ? 'admin' : 'psychologist');
            
            return res.status(200).json({
                user: {
                    id: psychologist.id,
                    nome: psychologist.nome,
                    email: psychologist.email,
                    type: psychologist.isAdmin ? 'admin' : 'psychologist',
                    fotoUrl: psychologist.fotoUrl,
                    slug: psychologist.slug
                },
                token: tokenJwt,
                redirect: psychologist.isAdmin ? '/admin/admin.html' : '/psi/psi_dashboard.html'
            });
        }

        // 2. Se o objetivo é registrar como PSICÓLOGO e não existe conta (passou pelo check acima),
        // retorna dados para o form, MESMO QUE já seja paciente.
        if (targetRole === 'psychologist') {
            // [RESTRIÇÃO] Verifica se já é paciente
            const existingPatient = await db.Patient.findOne({ where: { email } });
            if (existingPatient) {
                return res.status(400).json({ error: 'Este e-mail já está cadastrado como Paciente. Use outro e-mail para sua conta profissional.' });
            }

            return res.status(200).json({
                isNewUser: true,
                googleData: { email, name, picture, googleId }
            });
        }

        // 3. Verifica Paciente
        let patient = await db.Patient.findOne({ where: { email } });

        if (patient) {
            const tokenJwt = generateToken(patient.id, 'patient');
            return res.status(200).json({
                user: { id: patient.id, nome: patient.nome, email: patient.email, type: 'patient' },
                token: tokenJwt,
                redirect: '/paciente/dashboard.html'
            });
        }

        // 4. Cria Novo Paciente (Padrão para novos logins via Google sem role específica)
        const randomPassword = crypto.randomBytes(16).toString('hex');
        const hashedPassword = await bcrypt.hash(randomPassword, 10);
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '0.0.0.0';

        const newPatient = await db.Patient.create({
            nome: name,
            email: email,
            senha: hashedPassword,
            ip_registro: ip,
            termos_aceitos: true,
            marketing_aceito: false
        });

        await sendWelcomeEmail(newPatient, 'patient');
        const newToken = generateToken(newPatient.id, 'patient');

        return res.status(201).json({
            user: { id: newPatient.id, nome: newPatient.nome, email: newPatient.email, type: 'patient' },
            token: newToken,
            redirect: '/paciente/dashboard.html',
            isNewUser: true
        });

    } catch (error) {
        console.error('Erro no Login Unificado Google:', error);
        res.status(401).json({ error: 'Falha na autenticação com Google.' });
    }
};
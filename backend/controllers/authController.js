const db = require('../models');
const jwt = require('jsonwebtoken');
const https = require('https');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { sendWelcomeEmail } = require('../services/emailService');
const { Op } = require('sequelize');

// Função Auxiliar: Gera Token JWT
const generateToken = (id, type) => {
    return jwt.sign({ id, type }, process.env.JWT_SECRET || '***REMOVED_JWT_SECRET***', {
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
        const userEmailForLog = email;

        console.log(`[AUTH] Tentativa de login Google: ${email}`);

        // 1. Verifica Psicólogo
        let psychologist = await db.Psychologist.findOne({ where: { email } });
        
        if (psychologist) {
            // FIX: Permite login de TODOS (ativos, inativos, pendentes) pelo Google.
            // O frontend (Dashboard) cuidará de bloquear as abas e exigir o pagamento se necessário.
            if (!psychologist.fotoUrl && picture) {
                await psychologist.update({ fotoUrl: picture });
            }

            const tokenJwt = generateToken(psychologist.id, psychologist.isAdmin ? 'admin' : 'psychologist');
            
            // LOG DE SUCESSO
            if (db.SystemLog) {
                db.SystemLog.create({
                    level: 'info',
                    message: `[Auth] Login Google bem-sucedido: ${psychologist.email}`,
                    meta: { userEmail: psychologist.email, type: psychologist.isAdmin ? 'admin' : 'psychologist' }
                }).catch(e => console.error("Log write error:", e));
            }
            
            res.cookie('token', tokenJwt, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 30 * 24 * 60 * 60 * 1000
            });

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
                // LOG DE ERRO
                if (db.SystemLog) {
                    db.SystemLog.create({
                        level: 'error',
                        message: `[Auth] Tentativa de registro de psicólogo com e-mail de paciente: ${email}`,
                        meta: { userEmail: email, type: 'psychologist_registration_conflict' }
                    }).catch(e => console.error("Log write error:", e));
                }
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
            
            // LOG DE SUCESSO
            if (db.SystemLog) {
                db.SystemLog.create({
                    level: 'info',
                    message: `[Auth] Login Google bem-sucedido: ${patient.email}`,
                    meta: { userEmail: patient.email, type: 'patient' }
                }).catch(e => console.error("Log write error:", e));
            }
            
            res.cookie('token', tokenJwt, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 30 * 24 * 60 * 60 * 1000
            });

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

        // LOG DE SUCESSO (NOVO CADASTRO)
        if (db.SystemLog) {
            db.SystemLog.create({
                level: 'info',
                message: `[Auth] Novo paciente via Google: ${newPatient.email}`,
                meta: { userEmail: newPatient.email, type: 'patient', isNew: true }
            }).catch(e => console.error("Log write error:", e));
        }

        // FIX: Envio assíncrono
        sendWelcomeEmail(newPatient, 'patient').catch(err => console.error("Erro envio email boas-vindas (Google):", err));
        const newToken = generateToken(newPatient.id, 'patient');

        res.cookie('token', newToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 30 * 24 * 60 * 60 * 1000
        });

        return res.status(201).json({
            user: { id: newPatient.id, nome: newPatient.nome, email: newPatient.email, type: 'patient' },
            token: newToken,
            redirect: '/paciente/dashboard.html',
            isNewUser: true
        });

    } catch (error) {
        console.error('Erro no Login Unificado Google:', error);
        // LOG DE ERRO GERAL
        if (db.SystemLog) {
            db.SystemLog.create({
                level: 'error',
                message: `[Auth] Falha na autenticação com Google: ${error.message}`,
                meta: { userEmail: req.body.email || 'unknown', error: error.stack }
            }).catch(e => console.error("Log write error:", e));
        }
        res.status(401).json({ error: 'Falha na autenticação com Google.' });
    }
};

/**
 * Rota: POST /api/auth/login (EXEMPLO PARA LOGIN COM SENHA)
 * Descrição: Autentica um usuário (paciente ou psicólogo) com email e senha,
 *            incluindo logging detalhado para o seu novo dashboard.
 * @example
 * // Você deve integrar esta lógica aos seus controllers existentes
 * // (ex: psychologistController.js, patientController.js)
 */
exports.loginWithPassword = async (req, res) => {
    const { email, password, userType } = req.body; // userType: 'psychologist' ou 'patient'

    try {
        if (!email || !password || !userType) {
            return res.status(400).json({ error: 'Email, senha e tipo de usuário são obrigatórios.' });
        }

        const Model = userType === 'psychologist' ? db.Psychologist : db.Patient;
        const user = await Model.findOne({ where: { email: { [Op.iLike]: email } } });

        if (!user) {
            if (db.SystemLog) {
                db.SystemLog.create({
                    level: 'error',
                    message: `[Auth] Falha de login (usuário não encontrado): ${email}`,
                    meta: { userEmail: email, type: userType }
                }).catch(e => console.error("Log write error:", e));
            }
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }

        const isMatch = await bcrypt.compare(password, user.senha);

        if (!isMatch) {
            if (db.SystemLog) {
                db.SystemLog.create({
                    level: 'error',
                    message: `[Auth] Falha de login (senha incorreta): ${email}`,
                    meta: { userEmail: email, type: userType }
                }).catch(e => console.error("Log write error:", e));
            }
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }

        // Sucesso
        if (db.SystemLog) {
            db.SystemLog.create({
                level: 'info',
                message: `[Auth] Login com senha bem-sucedido: ${email}`,
                meta: { userEmail: email, type: userType }
            }).catch(e => console.error("Log write error:", e));
        }

        const token = generateToken(user.id, userType);
        res.status(200).json({ token, user, type: userType });

    } catch (error) {
        console.error('Erro no login com senha:', error);
        if (db.SystemLog) {
            db.SystemLog.create({
                level: 'error',
                message: `[Auth] Erro interno no login: ${error.message}`,
                meta: { userEmail: email, type: userType, error: error.stack }
            }).catch(e => console.error("Log write error:", e));
        }
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
};
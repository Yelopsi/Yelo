const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

let client;
let currentStatus = 'INITIALIZING';
let currentQR = null;

exports.initWhatsApp = (io) => {
    console.log('🤖 [WhatsApp Bot] Iniciando serviço...');
    
    client = new Client({
        authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
        puppeteer: {
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    });

    client.on('qr', async (qr) => {
        currentStatus = 'QR_READY';
        currentQR = await qrcode.toDataURL(qr);
        console.log('📱 [WhatsApp Bot] Novo QR Code gerado. Aguardando leitura no painel...');
        io.emit('wa_status', { status: currentStatus, qr: currentQR });
    });

    client.on('ready', () => {
        currentStatus = 'CONNECTED';
        currentQR = null;
        console.log('✅ [WhatsApp Bot] Cliente Conectado e Pronto para disparos!');
        io.emit('wa_status', { status: currentStatus });
    });

    client.on('authenticated', () => {
        console.log('🔐 [WhatsApp Bot] Sessão autenticada e salva com sucesso.');
    });

    client.on('auth_failure', msg => {
        console.error('❌ [WhatsApp Bot] Falha na Autenticação:', msg);
        currentStatus = 'DISCONNECTED';
        io.emit('wa_status', { status: currentStatus });
    });

    client.on('disconnected', (reason) => {
        console.log('🔴 [WhatsApp Bot] Cliente Desconectado:', reason);
        currentStatus = 'DISCONNECTED';
        currentQR = null;
        io.emit('wa_status', { status: currentStatus });
        client.initialize(); // Tenta reiniciar a instância para gerar novo QR
    });

    // Ouve os pedidos do painel admin pelo status atual
    io.on('connection', (socket) => {
        socket.on('wa_request_status', () => socket.emit('wa_status', { status: currentStatus, qr: currentQR }));
        socket.on('wa_disconnect', async () => { 
            if (client) {
                try { 
                    console.log('🔴 [WhatsApp Bot] Forçando logout...');
                    await client.logout(); 
                } catch(e) {
                    console.error('❌ [WhatsApp Bot] Erro no logout. Destruindo cliente:', e.message);
                    try { await client.destroy(); } catch(err) {}
                } finally {
                    const fs = require('fs');
                    try { fs.rmSync('./.wwebjs_auth', { recursive: true, force: true }); } catch(err) {}
                    currentStatus = 'DISCONNECTED';
                    currentQR = null;
                    io.emit('wa_status', { status: currentStatus });
                    client.initialize(); 
                }
            } 
        });
    });

    client.initialize();
};

exports.getWhatsAppClient = () => client;
exports.getWhatsAppStatus = () => currentStatus;

exports.sendMessage = async (phone, message) => {
    if (!client || currentStatus !== 'CONNECTED') {
        throw new Error('WhatsApp não está conectado.');
    }
    // Formata o número para o padrão do WhatsApp (55 + DDD + Numero + @c.us)
    let formattedNumber = phone.replace(/\D/g, '');
    if (formattedNumber.length === 10 || formattedNumber.length === 11) {
        formattedNumber = '55' + formattedNumber;
    }
    formattedNumber = `${formattedNumber}@c.us`;
    
    return await client.sendMessage(formattedNumber, message);
};
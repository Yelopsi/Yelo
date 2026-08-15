const assert = require('assert');
const io = require('socket.io-client');
const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');

// Para testes puros, inicializamos um mini-servidor com o nosso socket real
const { initSocket } = require('../../../backend/config/socket');

console.log('🔴 INICIANDO DEEP RED TEAM: SOCKET.IO AUTH & BOLA/ROOM ESCAPE 🔴\n');

const MOCK_SECRET = 'deep_red_team_socket_secret';
process.env.JWT_SECRET = MOCK_SECRET;

const app = express();
const server = http.createServer(app);

// Inicia o socket no servidor de teste (é o código original real)
initSocket(server);

// Mock DB
const db = require('../../../backend/models');
db.Message = { 
    update: async () => [1],
    findAll: async () => [{ id: 101 }, { id: 102 }] 
};
db.sequelize = { query: async () => [] };

let port;

const runTests = async () => {
    return new Promise((resolve) => {
        server.listen(0, async () => {
            port = server.address().port;
            
            try {
                await testAnonymousConnection();
                await testRoomEscape();
                
                console.log('\n✅ SOCKET.IO RED TEAM CONCLUÍDO (Todos os bypasses foram mitigados).');
                server.close();
                process.exit(0);
            } catch (err) {
                console.error('\n❌ SECURITY FAILURE SOCKET: ' + err.message);
                server.close();
                process.exit(1);
            }
        });
    });
};

const testAnonymousConnection = () => {
    return new Promise((resolve, reject) => {
        console.log('[RED TEAM] Teste A: Conexão Anônima (Sem Token)');
        
        const client = io(`http://localhost:${port}`, {
            auth: { token: null },
            reconnection: false
        });

        // Se o socket conectar com sucesso (connect_error não disparou e connect sim), falhou o teste de Auth
        client.on('connect', () => {
            reject(new Error('Conexão Anônima foi PERMITIDA. Faltou o middleware io.use(...)'));
        });

        client.on('connect_error', (err) => {
            console.log('   ✅ PASSOU: Conexão Anônima bloqueada com erro: ' + err.message);
            client.close();
            resolve();
        });
        
        // Timeout para garantir que testamos rapidamente
        setTimeout(() => {
            if (client.connected) reject(new Error('Conexão estabelecida sem token'));
        }, 500);
    });
};

const testRoomEscape = () => {
    return new Promise((resolve, reject) => {
        console.log('[RED TEAM] Teste B: Room Escape & Admin Broadcast Injection');
        
        // Usuário Atacante (Paciente 99)
        const tokenAtacante = jwt.sign({ id: 99, role: 'patient', type: 'patient' }, MOCK_SECRET);
        
        const client = io(`http://localhost:${port}`, {
            auth: { token: tokenAtacante },
            reconnection: false
        });

        client.on('connect', () => {
            
            // Tenta enviar uma mensagem como se fosse Admin (Isso deveria falhar no backend)
            client.emit('admin_sent_message', { 
                targetUserId: 99, 
                content: 'Hacked by Patient' 
            });

            // Se o backend não travar, ele emitirá 'receiveMessage'. Se escutarmos, falhou.
            client.on('receiveMessage', (msg) => {
                if (msg.content === 'Hacked by Patient') {
                    reject(new Error('BOLA (Admin Broadcast): Paciente conseguiu forjar evento admin_sent_message'));
                }
            });

            // Espera meio segundo para ver se algo deu errado
            setTimeout(() => {
                console.log('   ✅ PASSOU: Room Escape / Emissão Falsa mitigada (Nenhum evento vazou).');
                client.close();
                resolve();
            }, 500);

        });

        client.on('connect_error', (err) => {
            // Pode ser que passe se consertarmos a auth primeiro, e ele exigir algo. Mas o atacante tem token válido.
            reject(new Error('Erro inesperado na conexão do atacante válido: ' + err.message));
        });
    });
};

runTests();

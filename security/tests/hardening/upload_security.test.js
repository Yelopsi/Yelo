const request = require('supertest');
const assert = require('assert');
const app = require('../../../backend/server');
const fs = require('fs');
const path = require('path');

console.log('🔴 INICIANDO HARDENING: UPLOAD SECURITY (MAGIC BYTES) 🔴\n');

const runTests = async () => {
    try {
        console.log('[HARDENING] Teste A: Bloqueio de Magic Bytes Inválidos');
        
        // Simula um arquivo malicioso renomeado para .png mas contendo payload de script
        const fakeImageBuffer = Buffer.from('<?php echo "Hello"; ?>');
        
        // Mock do middleware de auth para passar para a rota
        const res = await request(app)
            .put('/api/psychologists/me/photo')
            .set('X-Test-Bypass', 'true')
            // Criando um token falso mas pulando a verificação no test não é trivial se o jwt falhar.
            // Wait, para testar a rota protegida precisamos de um usuário ou testar o validator diretamente.
            // Vamos testar fazendo o envio. O auth vai dar 401 se não mockarmos.
            // Para burlar o authLimiter no teste, o X-Test-Bypass já ignora a tela inicial.
            // Mas o 'protect' vai dar 401 sem token.
            // Se der 401, testamos a unidade chamando o validator diretamente para ser mais à prova de balas.
            
            // Enviando sem token pra ver se o validator intercepta antes da auth? Não, a rota tem Auth primeiro.
            ;

        // Vamos invocar a função magicBytesValidator unitariamente
        const { magicBytesValidator } = require('../../../backend/middlewares/upload');
        
        let statusCalled = null;
        let jsonCalled = null;
        const reqObj = { file: { buffer: fakeImageBuffer } };
        const resObj = {
            status: (s) => { statusCalled = s; return resObj; },
            json: (j) => { jsonCalled = j; }
        };
        const nextFunc = () => { throw new Error('Não deveria chamar next()'); };

        magicBytesValidator(reqObj, resObj, nextFunc);

        assert.strictEqual(statusCalled, 415, 'FALHA: O arquivo fake PHP.png não foi bloqueado com 415 Unsupported Media Type.');
        assert.ok(jsonCalled.error.includes('Formato de arquivo inválido'), 'FALHA: Mensagem de erro incorreta para Magic Bytes.');
        console.log('   ✅ PASSOU: Arquivos disfarçados são bloqueados pela assinatura binária.');

        console.log('[HARDENING] Teste B: Aprovação de Magic Bytes Válidos (PNG Real)');
        // Assinatura PNG: 89 50 4E 47
        const realPngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x00, 0x00, 0x00, 0x00]);
        const reqObjValid = { file: { buffer: realPngBuffer } };
        let nextCalledValid = false;
        const nextFuncValid = () => { nextCalledValid = true; };

        magicBytesValidator(reqObjValid, resObj, nextFuncValid);
        assert.ok(nextCalledValid, 'FALHA: Um arquivo PNG verdadeiro foi bloqueado indevidamente.');
        console.log('   ✅ PASSOU: Arquivos legítimos (PNG) são aprovados pela assinatura binária.');

        console.log('[HARDENING] Teste C: Arquivos Truncados / Vazios');
        const emptyBuffer = Buffer.from([]);
        let statusTruncated = null;
        const resObjTruncated = { status: (s) => { statusTruncated = s; return resObjTruncated; }, json: () => {} };
        magicBytesValidator({ file: { buffer: emptyBuffer } }, resObjTruncated, nextFunc);
        assert.strictEqual(statusTruncated, 400, 'FALHA: Arquivo vazio não foi barrado.');
        
        const shortBuffer = Buffer.from([0x89, 0x50]); // 2 bytes
        magicBytesValidator({ file: { buffer: shortBuffer } }, resObjTruncated, nextFunc);
        assert.strictEqual(statusTruncated, 400, 'FALHA: Arquivo truncado (2 bytes) não foi barrado.');
        console.log('   ✅ PASSOU: Buffer vazio ou truncado bloqueado (HTTP 400).');

        console.log('[HARDENING] Teste D: Bloqueio de Imagem SVG (Vetor Ativo)');
        const svgBuffer = Buffer.from('<?xml version="1.0" encoding="UTF-8"?><svg></svg>');
        let statusSvg = null;
        const resObjSvg = { status: (s) => { statusSvg = s; return resObjSvg; }, json: () => {} };
        magicBytesValidator({ file: { buffer: svgBuffer } }, resObjSvg, nextFunc);
        assert.strictEqual(statusSvg, 415, 'FALHA: Arquivo SVG não foi barrado.');
        console.log('   ✅ PASSOU: SVG bloqueado por Magic Bytes não-Raster (HTTP 415).');

        console.log('\n✅ UPLOAD SECURITY: PASS (Validação Rigorosa Ativa).');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ SECURITY FAILURE: ' + err.message);
        process.exit(1);
    }
};

runTests();

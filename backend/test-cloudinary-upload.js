require('dotenv').config({ path: '../.env' });
const express = require('express');
const request = require('supertest');
const { uploadProfilePhoto } = require('./middlewares/upload');
const psychologistController = require('./controllers/psychologistController');
const patientController = require('./controllers/patientController');
const adminController = require('./controllers/adminController');
const db = require('./models');

const app = express();
app.use(express.json());

app.put('/psi/foto', 
    (req, res, next) => { req.psychologist = { id: 1 }; next(); }, 
    uploadProfilePhoto.single('foto'), 
    psychologistController.updateProfilePhoto
);
app.use((err, req, res, next) => {
    res.status(400).json({ error: err.message });
});

async function run() {
    const Buffer = require('buffer').Buffer;
    
    // Transparent 1x1 PNG for valid upload test
    const validPngHex = "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082";
    const validPngBuffer = Buffer.from(validPngHex, 'hex');

    const resPng = await request(app)
        .put('/psi/foto')
        .attach('foto', validPngBuffer, { filename: 'test.png', contentType: 'image/png' });
    console.log('2. PNG Válido:', resPng.status, resPng.body);

    const resSvg = await request(app)
        .put('/psi/foto')
        .attach('foto', Buffer.from('<svg></svg>'), { filename: 'test.svg', contentType: 'image/svg+xml' });
    console.log('4. SVG Rejeitado:', resSvg.status, resSvg.body);

    const resFakePng = await request(app)
        .put('/psi/foto')
        .attach('foto', Buffer.from('<svg><script>alert(1)</script></svg>'), { filename: 'test.png', contentType: 'image/png' });
    console.log('5. MIME adulterado:', resFakePng.status, resFakePng.body);

    process.exit(0);
}
run();

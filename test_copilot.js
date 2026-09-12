const jwt = require('jsonwebtoken');
require('dotenv').config({ path: __dirname + '/.env' });

const token = jwt.sign({ id: 1, type: 'psychologist' }, process.env.JWT_SECRET);

fetch('http://localhost:3001/api/psychologists/ai-message-assistant', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ prompt: 'Estou atendendo um paciente com fortes traços borderline e ele ameaçou suicídio após o término do namoro. Qual a melhor técnica da TCC para lidar com isso agora?' })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);

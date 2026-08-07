const fs = require('fs');
const path = '/Users/andehrson/Yelo/backend/server.js';
let content = fs.readFileSync(path, 'utf8');

const injectionStr = "await db.sequelize.query('ALTER TABLE \"Psychologists\" ADD COLUMN IF NOT EXISTS \"evaluationEmailSent\" BOOLEAN DEFAULT false;');";
const newStr = injectionStr + "\n            await db.sequelize.query('ALTER TABLE \"Psychologists\" ADD COLUMN IF NOT EXISTS \"msg_paid_churn_sent_at\" TIMESTAMP WITH TIME ZONE NULL;');";

content = content.replace(injectionStr, newStr);
fs.writeFileSync(path, content, 'utf8');
console.log('Injected');

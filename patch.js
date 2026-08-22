const fs = require('fs');
const path = './backend/models/psychologist.js';
let content = fs.readFileSync(path, 'utf8');

const associationString = `
      if (models.Payment) {
          this.hasMany(models.Payment, {
              foreignKey: 'psychologistId',
              as: 'payments'
          });
      }
`;

if (!content.includes('this.hasMany(models.Payment')) {
    content = content.replace('static associate(models) {', 'static associate(models) {' + associationString);
    fs.writeFileSync(path, content);
    console.log('Association added!');
} else {
    console.log('Association already exists');
}

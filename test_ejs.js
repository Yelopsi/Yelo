const ejs = require('ejs');
const fs = require('fs');

const str = fs.readFileSync('views/psi_perfil_publico.ejs', 'utf8');

try {
  ejs.compile(str);
  console.log("Compile successful");
} catch(e) {
  console.log("Compile error:", e.message);
}

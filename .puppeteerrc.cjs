const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Força o Puppeteer a salvar o Chrome dentro da pasta do projeto
  // Assim o Render não apaga o navegador entre o build e a execução na nuvem.
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
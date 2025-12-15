const db = require('../models');
const SystemSetting = db.SystemSetting;

module.exports = {
  // GET: Busca as configurações atuais
  getSettings: async (req, res) => {
    try {
      // Tenta buscar a primeira configuração encontrada
      let settings = await SystemSetting.findOne();

      // Se não existir nenhuma, cria a padrão (Seed automático)
      if (!settings) {
        settings = await SystemSetting.create({
          maintenance_mode: false,
          allow_registrations: true
        });
      }

      return res.status(200).json(settings);
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
      return res.status(500).json({ error: 'Erro interno ao buscar configurações.' });
    }
  },

  // POST/PUT: Atualiza as configurações
  updateSettings: async (req, res) => {
    try {
      const data = req.body;
      
      // Busca a configuração existente
      let settings = await SystemSetting.findOne();

      if (settings) {
        // Atualiza a existente
        await settings.update(data);
      } else {
        // Caso raro: cria se não existir
        settings = await SystemSetting.create(data);
      }

      return res.status(200).json({ message: 'Configurações atualizadas com sucesso!', settings });
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      return res.status(500).json({ error: 'Erro ao salvar alterações.' });
    }
  }
};
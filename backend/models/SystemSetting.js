module.exports = (sequelize, DataTypes) => {
  const SystemSetting = sequelize.define('SystemSetting', {
    // Estado do Sistema
    maintenance_mode: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    allow_registrations: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    // Precificação (Decimal para precisão financeira)
    price_Essencial: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00
    },
    price_Clínico: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00
    },
    price_sol: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00
    },
    // Contatos
    whatsapp_support: {
      type: DataTypes.STRING,
      defaultValue: ''
    },
    email_support: {
      type: DataTypes.STRING,
      defaultValue: ''
    },
    // Easter Egg: Recorde Histórico de Assinantes
    max_subscribers_record: {
      type: DataTypes.INTEGER,
      defaultValue: 16
    },
    // CMO Simulator: Meta persistida no banco
    cmo_sim_target_subs: {
      type: DataTypes.INTEGER,
      defaultValue: 70
    },
    cmo_sim_target_months: {
      type: DataTypes.INTEGER,
      defaultValue: 3
    },
    cmo_sim_mode: {
      type: DataTypes.STRING,
      defaultValue: 'acelerador'
    },
    cmo_sim_max_budget: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 2000.00
    }
  });

  return SystemSetting;
};
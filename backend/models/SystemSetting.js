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
    }
  });

  return SystemSetting;
};
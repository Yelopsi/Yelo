'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PaymentFinancialEvent extends Model {
    /**
     * === REGRA SEMÂNTICA DOS EVENTOS FINANCEIROS ===
     * 1. PAYMENT_RECEIVED: Só pode existir quando o Asaas comprovar que o pagamento foi efetivamente confirmado/recebido.
     *    - É PROIBIDO criar PAYMENT_RECEIVED apenas por existir uma linha na tabela Payments.
     *    - Cobranças PENDING, OVERDUE, CANCELED, DELETED não geram evento positivo.
     *    - grossAmount = valor bruto
     *    - feeAmount = taxa de processamento observada
     *    - netCashAmount = netValue observado
     *    - cashDeltaAmount = entrada líquida observada
     * 
     * 2. EVENTOS NEGATIVOS (REFUND / CHARGEBACK):
     *    - Não invente cashDeltaAmount ou deduza taxas ocultas.
     *    - Se o Asaas comprovar somente o principal do refund, mas não a movimentação líquida/taxa:
     *      * grossAmount = principal
     *      * feeAmount = NULL
     *      * netCashAmount = NULL
     *      * cashDeltaAmount = NULL
     *    - Estes campos permanecem como NULL até que o extrato comprove a movimentação real.
     * 
     * 3. SANITIZAÇÃO DO sourceMetadata:
     *    - NÃO persista automaticamente o payload completo retornado pelo Asaas.
     *    - Retenha SOMENTE metadados necessários à auditoria financeira (ex: ids externos, gateway status, billingType, relevant event dates, values, reference fields para deduplicação).
     *    - REMOVA dados pessoais/desnecessários do cliente.
     */
    static associate(models) {
      this.belongsTo(models.Payment, {
        foreignKey: 'paymentId',
        as: 'payment'
      });
    }
  }
  PaymentFinancialEvent.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    paymentId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    externalEventId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    eventType: {
      type: DataTypes.ENUM('PAYMENT_CONFIRMED', 'PAYMENT_CREDITED', 'REFUND', 'CHARGEBACK', 'GATEWAY_CASH_MOVEMENT'),
      allowNull: false
    },
    grossAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    feeAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true
    },
    netCashAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true
    },
    cashDeltaAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true
    },
    eventDate: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    eventOccurredAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    sourceMetadata: {
      type: DataTypes.JSONB,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'PaymentFinancialEvent',
    tableName: 'PaymentFinancialEvents',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['paymentId', 'externalEventId', 'eventType'],
        name: 'unique_payment_financial_event'
      },
      {
        fields: ['paymentId']
      },
      {
        fields: ['eventDate']
      },
      {
        fields: ['eventType']
      }
    ]
  });
  return PaymentFinancialEvent;
};

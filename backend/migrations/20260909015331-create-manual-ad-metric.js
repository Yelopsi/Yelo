'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ManualAdMetrics', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      dateStart: {
        type: Sequelize.DATEONLY
      },
      dateEnd: {
        type: Sequelize.DATEONLY
      },
      platform: {
        type: Sequelize.STRING
      },
      campaignName: {
        type: Sequelize.STRING
      },
      spend: {
        type: Sequelize.DECIMAL
      },
      impressions: {
        type: Sequelize.INTEGER
      },
      clicks: {
        type: Sequelize.INTEGER
      },
      conversions: {
        type: Sequelize.INTEGER
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    await queryInterface.addIndex('ManualAdMetrics', ['dateStart', 'dateEnd', 'platform'], {
      unique: true,
      name: 'unique_manual_ad_metric'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('ManualAdMetrics');
  }
};
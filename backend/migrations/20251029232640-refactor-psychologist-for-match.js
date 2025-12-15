'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Remove os campos antigos que estão sendo refatorados
    try {
      await queryInterface.removeColumn('Psychologists', 'abordagem'); // Campo antigo
      await queryInterface.removeColumn('Psychologists', 'especialidades'); // Campo antigo
      await queryInterface.removeColumn('Psychologists', 'cidade'); // Campo antigo
      await queryInterface.removeColumn('Psychologists', 'online'); // Campo antigo
    } catch (error) {
      console.log('Ignorando erro ao remover colunas antigas do Profissional. Prosseguindo.');
    }

    // 2. Adiciona os novos campos do Questionário para o Profissional
    await queryInterface.addColumn('Psychologists', 'valor_sessao_numero', {
      type: Sequelize.FLOAT, // Usamos FLOAT para armazenar o valor exato, não a faixa
      allowNull: true,
      comment: 'Valor por sessão informado pelo profissional (R$)'
    });
    await queryInterface.addColumn('Psychologists', 'temas_atuacao', {
      type: Sequelize.ARRAY(Sequelize.STRING), // Múltiplos temas de atuação
      allowNull: true,
      comment: 'Lista de temas em que o profissional atua (Tela 3 do paciente)'
    });
    await queryInterface.addColumn('Psychologists', 'abordagens_tecnicas', {
      type: Sequelize.ARRAY(Sequelize.STRING), // Múltiplas abordagens técnicas
      allowNull: true,
      comment: 'Lista de abordagens técnicas do profissional (Tela 4 do paciente)'
    });
    await queryInterface.addColumn('Psychologists', 'genero_identidade', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Gênero/Identidade do profissional (Tela 5 do paciente)'
    });
    await queryInterface.addColumn('Psychologists', 'praticas_vivencias', {
      type: Sequelize.ARRAY(Sequelize.STRING), // Múltiplas práticas afirmativas
      allowNull: true,
      comment: 'Lista de vivências e práticas afirmativas (Tela 5 do paciente)'
    });
    await queryInterface.addColumn('Psychologists', 'disponibilidade_periodo', {
      type: Sequelize.ARRAY(Sequelize.STRING), // Múltiplos períodos de disponibilidade
      allowNull: true,
      comment: 'Disponibilidade de horários do profissional (Tela 6 do paciente)'
    });
  },

  async down(queryInterface, Sequelize) {
    // Reverte a ação em caso de necessidade
    await queryInterface.removeColumn('Psychologists', 'valor_sessao_numero');
    await queryInterface.removeColumn('Psychologists', 'temas_atuacao');
    await queryInterface.removeColumn('Psychologists', 'abordagens_tecnicas');
    await queryInterface.removeColumn('Psychologists', 'genero_identidade');
    await queryInterface.removeColumn('Psychologists', 'praticas_vivencias');
    await queryInterface.removeColumn('Psychologists', 'disponibilidade_periodo');
    // Você pode querer re-adicionar as colunas antigas aqui, mas para simplificar, apenas removemos as novas.
  }
};
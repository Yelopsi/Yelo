'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Remove os campos de filtro antigos (se existirem)
    try {
      await queryInterface.removeColumn('Patients', 'cidade');
      await queryInterface.removeColumn('Patients', 'abordagemDesejada');
    } catch (error) {
      // Ignora se as colunas já foram removidas ou nunca existiram
      console.log('Ignorando erro ao remover colunas antigas. Prosseguindo.');
    }

    // 2. Adiciona os novos campos do Questionário
    await queryInterface.addColumn('Patients', 'valor_sessao_faixa', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Faixa de valor da sessão escolhida (Tela 6)'
    });
    await queryInterface.addColumn('Patients', 'temas_buscados', {
      type: Sequelize.ARRAY(Sequelize.STRING), // Armazenar múltiplos temas
      allowNull: true,
      comment: 'Temas selecionados pelo paciente (Tela 3)'
    });
    await queryInterface.addColumn('Patients', 'abordagem_desejada', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Mapeamento da escolha de estilo de terapia (Tela 4)'
    });
    await queryInterface.addColumn('Patients', 'genero_profissional', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Preferência de gênero do profissional (Tela 5)'
    });
    await queryInterface.addColumn('Patients', 'praticas_afirmativas', {
      type: Sequelize.ARRAY(Sequelize.STRING), // Armazenar múltiplas vivências/práticas
      allowNull: true,
      comment: 'Preferência por vivências afirmativas do profissional (Tela 5)'
    });
    await queryInterface.addColumn('Patients', 'disponibilidade_periodo', {
      type: Sequelize.ARRAY(Sequelize.STRING), // Armazenar múltiplos períodos
      allowNull: true,
      comment: 'Disponibilidade de horários do paciente (Tela 6)'
    });
  },

  async down(queryInterface, Sequelize) {
    // Reverte a ação em caso de necessidade
    await queryInterface.removeColumn('Patients', 'valor_sessao_faixa');
    await queryInterface.removeColumn('Patients', 'temas_buscados');
    await queryInterface.removeColumn('Patients', 'abordagem_desejada');
    await queryInterface.removeColumn('Patients', 'genero_profissional');
    await queryInterface.removeColumn('Patients', 'praticas_afirmativas');
    await queryInterface.removeColumn('Patients', 'disponibilidade_periodo');
  }
};
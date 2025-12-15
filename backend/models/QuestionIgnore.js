module.exports = (sequelize, DataTypes) => {
    const QuestionIgnore = sequelize.define("QuestionIgnore", {
        psychologistId: DataTypes.INTEGER,
        questionId: DataTypes.INTEGER
    });
    return QuestionIgnore;
};
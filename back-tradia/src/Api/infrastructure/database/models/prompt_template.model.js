const { DataTypes } = require("sequelize");
const sequelize =
  require("../connections/sequelize.connection").getInstance().getConnection();

const PromptTemplate = sequelize.define(
  "PromptTemplate",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    key: {
      type: DataTypes.STRING(100),
      unique: true,
      allowNull: false,
    },
    label: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    prompt: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    glossary: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    style_guidance: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    examples: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
  },
  {
    tableName: "prompt_templates",
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["key"],
      },
    ],
  },
);

module.exports = PromptTemplate;

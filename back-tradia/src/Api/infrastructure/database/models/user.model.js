const { DataTypes } = require("sequelize");
const sequelize = require("../connections/sequelize.connection").getInstance().getConnection();

const User = sequelize.define(
  "user",
  {
    googleId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    displayName: DataTypes.STRING,
    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    timestamps: true,
    tableName: "user",
  }
);

module.exports = User;

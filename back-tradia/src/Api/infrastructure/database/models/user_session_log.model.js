const { DataTypes } = require("sequelize");
const sequelize =
  require("../connections/sequelize.connection").getInstance().getConnection();

const UserSessionLog = sequelize.define(
  "user_session_log",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    username: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    event: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    success: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    ip_address: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: "user_session_logs",
    underscored: true,
    timestamps: true,
    updatedAt: false,
  },
);

const User = require("./user.model");
UserSessionLog.belongsTo(User, { foreignKey: "user_id", as: "user" });

module.exports = UserSessionLog;

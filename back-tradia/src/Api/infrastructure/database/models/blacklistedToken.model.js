const { DataTypes } = require("sequelize");
const DatabaseConnection = require("../connections/sequelize.connection");
const sequelize = DatabaseConnection.getInstance().getConnection();

const BlacklistedToken = sequelize.define(
	"BlacklistedToken",
	{
		token: {
			type: DataTypes.TEXT,
			allowNull: false,
			unique: true,
		},
		expiresAt: {
			type: DataTypes.DATE,
			allowNull: false,
		},
	},
	{
		tableName: "blacklisted_tokens",
		timestamps: false,
	}
);

module.exports = BlacklistedToken;

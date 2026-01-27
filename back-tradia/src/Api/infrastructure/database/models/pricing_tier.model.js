const { DataTypes } = require("sequelize");
const sequelize = require("../connections/sequelize.connection")
	.getInstance()
	.getConnection();

const PricingTier = sequelize.define(
	"PricingTier",
	{
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true,
			allowNull: false,
		},
		label: {
			type: DataTypes.STRING(120),
			allowNull: true,
		},
		minWords: {
			type: DataTypes.INTEGER,
			allowNull: false,
			field: "min_words",
			defaultValue: 0,
		},
		maxWords: {
			type: DataTypes.INTEGER,
			allowNull: true,
			field: "max_words",
		},
		pricePerWord: {
			type: DataTypes.DECIMAL(10, 4),
			allowNull: false,
			field: "price_per_word",
		},
		currency: {
			type: DataTypes.STRING(3),
			allowNull: false,
			defaultValue: "USD",
		},
		isActive: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: true,
			field: "is_active",
		},
	},
	{
		tableName: "pricing_tiers",
		timestamps: true,
		underscored: true,
		indexes: [
			{
				name: "idx_pricing_tiers_active",
				fields: ["is_active"],
			},
			{
				name: "idx_pricing_tiers_range",
				fields: ["min_words", "max_words"],
			},
		],
	},
);

module.exports = PricingTier;

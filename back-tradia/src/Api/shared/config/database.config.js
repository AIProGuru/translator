const constants = require("./constants");

module.exports = {
	development: {
		database: constants.DATABASE.name,
		username: constants.DATABASE.username,
		password: constants.DATABASE.password,
		host: constants.DATABASE.host,
		dialect: constants.DATABASE.dialect,
		storage: constants.DATABASE.storage,
		logging: false,
	},
};

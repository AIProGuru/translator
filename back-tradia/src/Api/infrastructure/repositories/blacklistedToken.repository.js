const BlacklistedToken = require("../database/models/blacklistedToken.model");

class BlacklistedTokenRepository {
	async isTokenBlacklisted(token) {
		if (!token) {
			return true;
		}
		try {
			const found = await BlacklistedToken.findOne({ where: { token } });
			return !!found;
		} catch (error) {
			console.error("Error al verificar blacklist:", error);
			return true;
		}
	}

	async addToBlacklist(token, expiresAt) {
		try {
			const blacklistedToken = await BlacklistedToken.create({
				token,
				expiresAt,
			});
			return blacklistedToken;
		} catch (error) {
			console.error("Error general en procesamiento:", error);
			throw new Error(
				`Error al agregar token a la blacklist: ${error.message}`
			);
		}
	}
}

module.exports = BlacklistedTokenRepository;

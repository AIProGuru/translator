const BlacklistedTokenRepository = require("../../../Api/infrastructure/repositories/blacklistedToken.repository");
const blacklistedTokenRepository = new BlacklistedTokenRepository();

async function blacklistToken(token, ttlMinutes = 60) {
	await blacklistedTokenRepository.addToBlacklist(token, ttlMinutes);
}

async function isBlacklisted(token) {
	return await blacklistedTokenRepository.isTokenBlacklisted(token);
}

module.exports = { blacklistToken, isBlacklisted };

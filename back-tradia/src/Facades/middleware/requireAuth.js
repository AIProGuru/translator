const jwt = require("jsonwebtoken");
const { isBlacklisted } = require("../../Facades/services/auth/tokenService");

module.exports = async function (req, res, next) {
	const token = req.cookies.token;

	if (await isBlacklisted(token)) {
		return res.status(401).json({ message: "Token revocado" });
	}

	

	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		req.user = decoded;
		req.token = token;
		next();
	} catch (err) {
		return res.status(401).json({ message: "Token inválido o expirado" });
	}
};

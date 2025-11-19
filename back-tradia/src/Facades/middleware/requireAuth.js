const jwt = require("jsonwebtoken");
const { isBlacklisted } = require("../../Facades/services/auth/tokenService");

module.exports = async function (req, res, next) {
	let token = req.cookies.token;

	// Allow token via Authorization: Bearer <token> header (useful for test mode / APIs)
	if (!token && req.headers.authorization) {
		const [scheme, value] = req.headers.authorization.split(" ");
		if (scheme === "Bearer" && value) {
			token = value;
		}
	}

	// Also allow token via query param (useful for SSE/EventSource)
	if (!token && req.query && req.query.token) {
		token = req.query.token;
	}

	if (!token) {
		return res.status(401).json({ message: "Token inválido o expirado" });
	}

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

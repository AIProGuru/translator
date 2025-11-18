const jwt = require("../utils/jwt");

module.exports = (req, res, next) => {
	const authHeader = req.headers.authorization;

	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return res.status(401).json({ message: "Token requerido" });
	}

	const token = authHeader.split(" ")[1];

	try {
		const decoded = jwt.verifyToken(token);
		req.user = decoded;
		next();
	} catch (err) {
		res.status(403).json({ message: "Token inválido o expirado" });
	}
};

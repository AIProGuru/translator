const jwt = require("jsonwebtoken");
const { FRONT_HOST } = require("../../Api/shared/config/constants");
exports.handleGoogleCallback = async (req, res) => {
	try {
		const user = req.user;

		const token = jwt.sign(
			{
				id: user.id,
				email: user.email,
				name: user.displayName,
			},
			process.env.JWT_SECRET,
			{ expiresIn: "1h" }
		);

		res.cookie("token", token, {
			httpOnly: true,
			secure: false,
			sameSite: "Lax",
			maxAge: 86400000,
			path: "/",
		});

		res.redirect(`${FRONT_HOST}/dashboard`);
	} catch (err) {
		console.error("Google callback error:", err);
		res.status(500).send("Error en el inicio de sesión con Google");
	}
};

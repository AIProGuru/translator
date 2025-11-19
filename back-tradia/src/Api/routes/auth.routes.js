const express = require("express");
const passport = require("passport");
const jwt = require("jsonwebtoken");
const router = express.Router();
const authController = require("../../Facades/controller/auth.controller");
const { blacklistToken } = require("../../Facades/services/auth/tokenService");
const requireAuth = require("../../Facades/middleware/requireAuth");
const User = require("../infrastructure/database/models/user.model");

router.get(
	"/google",
	passport.authenticate("google", {
		scope: ["profile", "email"],
		prompt: "select_account",
	})
);

router.get(
	"/google/callback",
	passport.authenticate("google", { session: false }),
	authController.handleGoogleCallback
);

router.get("/me", requireAuth, (req, res) => {
	res.json({ user: req.user });
});

router.get("/ping", (req, res) => {
	res.status(200).send("pong");
  });

// TEST-ONLY: simple login endpoint that bypasses Google OAuth.
// It ensures there is a dummy user in the database and issues a JWT cookie for it.
router.post("/test-login", async (req, res) => {
	try {
		const TEST_GOOGLE_ID = "test-google-id";

		let user = await User.findOne({ where: { googleId: TEST_GOOGLE_ID } });

		if (!user) {
			user = await User.create({
				googleId: TEST_GOOGLE_ID,
				displayName: "Test User",
				email: "test@example.com",
			});
		}

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

		res.json({
			user: {
				id: user.id,
				email: user.email,
				name: user.displayName,
			},
		});
	} catch (error) {
		console.error("Test login error:", error);
		res.status(500).json({ message: "Error in test login" });
	}
});

router.post("/logout", requireAuth, async (req, res) => {
	try {
		await blacklistToken(req.token);
		res.clearCookie("token", {
			httpOnly: true,
			secure: false,
			sameSite: "Lax",
			path: "/",
		  });
		res.status(200).json({ message: "Sesión cerrada" });
	} catch (error) {
		res.status(500).json({
			message: `Error al cerrar sesión: ${error.message}`,
		});
	}
});

module.exports = router;

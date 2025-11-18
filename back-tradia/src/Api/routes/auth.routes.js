const express = require("express");
const passport = require("passport");
const router = express.Router();
const authController = require("../../Facades/controller/auth.controller");
const { blacklistToken } = require("../../Facades/services/auth/tokenService");
const requireAuth = require("../../Facades/middleware/requireAuth");

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

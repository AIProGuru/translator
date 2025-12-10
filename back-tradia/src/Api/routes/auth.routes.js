const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
const passport = require("passport");
const { blacklistToken } = require("../../Facades/services/auth/tokenService");
const requireAuth = require("../../Facades/middleware/requireAuth");
const { loginRateLimiter } = require("../../Facades/middleware/rateLimiter");
const userService = require("../../Facades/services/users");
const constants = require("../shared/config/constants");
const { GOOGLE_SCOPES } = require("../shared/config/passport.config");

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "Lax",
  path: "/",
};

const TOKEN_TTL = process.env.JWT_EXPIRES_IN || "1h";
const GOOGLE_SUCCESS_REDIRECT =
  process.env.GOOGLE_SUCCESS_REDIRECT || `${constants.FRONT_HOST}/dashboard`;
const GOOGLE_FAILURE_REDIRECT =
  process.env.GOOGLE_FAILURE_REDIRECT ||
  `${constants.FRONT_HOST}/?auth=google_failed`;
const GOOGLE_AUTH_ENABLED =
  Boolean(process.env.GOOGLE_CLIENT_ID) &&
  Boolean(process.env.GOOGLE_CLIENT_SECRET) &&
  Boolean(process.env.GOOGLE_CALLBACK_URL);

function signToken(payload) {
  return jwt.sign(
    {
      id: payload.id,
      username: payload.username,
      role: payload.role,
      timestamp: new Date().toISOString(),
    },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_TTL },
  );
}

function attachAuthResponse(res, user) {
  const token = signToken(user);
  res.cookie("token", token, {
    ...COOKIE_OPTIONS,
    maxAge: 60 * 60 * 1000,
  });
  return token;
}

router.get("/ping", (req, res) => {
  res.status(200).send("pong");
});

function buildGoogleFailureRedirect(message) {
  try {
    const url = new URL(GOOGLE_FAILURE_REDIRECT);
    if (!url.searchParams.get("auth")) {
      url.searchParams.set("auth", "google_failed");
    }
    if (message) {
      url.searchParams.set("message", message);
    }
    return url.toString();
  } catch (error) {
    console.error("Invalid GOOGLE_FAILURE_REDIRECT:", error);
    return `${constants.FRONT_HOST}/?auth=google_failed`;
  }
}

router.post("/login", loginRateLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required." });
  }

  try {
    const { user, requiresPasswordChange } = await userService.authenticate(
      username,
      password,
      { ip: req.ip, userAgent: req.get("user-agent") },
    );

    const token = attachAuthResponse(res, user);

    return res.json({
      token,
      user,
      requiresPasswordChange,
    });
  } catch (error) {
    return res.status(401).json({ message: error.message || "Invalid credentials." });
  }
});

router.post("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res
      .status(400)
      .json({ message: "Current password and new password are required." });
  }

  try {
    const updatedUser = await userService.changePassword(
      req.user.id,
      currentPassword,
      newPassword,
    );
    const token = attachAuthResponse(res, updatedUser);
    return res.json({
      token,
      user: updatedUser,
      requiresPasswordChange: false,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.post("/logout", requireAuth, async (req, res) => {
  try {
    if (req.token) {
      await blacklistToken(req.token);
    }
    res.clearCookie("token", COOKIE_OPTIONS);
    await userService.logSessionEvent({
      userId: req.user.id,
      username: req.user.username,
      event: "logout",
      success: true,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });
    res.status(200).json({ message: "Session closed." });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Unable to logout." });
  }
});

router.get("/google", (req, res, next) => {
  if (!GOOGLE_AUTH_ENABLED) {
    return res.redirect(
      buildGoogleFailureRedirect("Google authentication is disabled."),
    );
  }
  passport.authenticate("google", {
    scope: GOOGLE_SCOPES || ["profile", "email"],
    session: false,
    prompt: "select_account",
  })(req, res, next);
});

router.get("/google/callback", (req, res, next) => {
  if (!GOOGLE_AUTH_ENABLED) {
    return res.redirect(
      buildGoogleFailureRedirect("Google authentication is disabled."),
    );
  }
  passport.authenticate("google", { session: false }, async (err, user) => {
    if (err || !user) {
      console.error("Google login failed:", err?.message || err);
      return res.redirect(
        buildGoogleFailureRedirect(
          err?.message || "Unable to complete Google login.",
        ),
      );
    }
    try {
      attachAuthResponse(res, user);
      await userService.logSessionEvent({
        userId: user.id,
        username: user.username,
        event: "login",
        success: true,
        ip: req.ip,
        userAgent: req.get("user-agent"),
        metadata: { provider: "google" },
      });
      return res.redirect(GOOGLE_SUCCESS_REDIRECT);
    } catch (error) {
      console.error("Error finalizing Google login:", error);
      return res.redirect(
        buildGoogleFailureRedirect("Unable to finalize Google login."),
      );
    }
  })(req, res, next);
});

module.exports = router;

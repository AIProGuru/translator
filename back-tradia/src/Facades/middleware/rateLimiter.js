const rateLimit = require("express-rate-limit");

const loginRateLimiter = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.AUTH_RATE_MAX || 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many login attempts. Try again in a few minutes.",
  },
});

module.exports = {
  loginRateLimiter,
};

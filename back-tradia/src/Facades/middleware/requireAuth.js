const jwt = require("jsonwebtoken");
const {
  isBlacklisted,
} = require("../../Facades/services/auth/tokenService");
const UserRepository = require("../../Api/infrastructure/repositories/user.repository");

const userRepository = new UserRepository();

module.exports = async function (req, res, next) {
  let token = req.cookies.token;

  if (!token && req.headers.authorization) {
    const [scheme, value] = req.headers.authorization.split(" ");
    if (scheme === "Bearer" && value) {
      token = value;
    }
  }

  if (!token && req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ message: "Authentication required." });
  }

  if (await isBlacklisted(token)) {
    return res.status(401).json({ message: "Session revoked." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await userRepository.findById(decoded.id);
    if (!user || user.status !== "active") {
      return res
        .status(401)
        .json({ message: "User disabled or no longer exists." });
    }

    req.user = {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      status: user.status,
      mustResetPassword: user.must_reset_password,
    };
    req.token = token;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err.message);
    return res.status(401).json({ message: "Token invalid or expired." });
  }
};

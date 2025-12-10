module.exports = function requireRole(allowedRoles = []) {
  const normalized = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required." });
    }
    if (
      normalized.length > 0 &&
      !normalized.includes(req.user.role || req.user.role)
    ) {
      return res
        .status(403)
        .json({ message: "You do not have permission to perform this action." });
    }
    return next();
  };
};

const express = require("express");
const router = express.Router();
const requireAuth = require("../../Facades/middleware/requireAuth");
const requireRole = require("../../Facades/middleware/requireRole");
const userService = require("../../Facades/services/users");

router.use(requireAuth);
router.use(requireRole(["administrator"]));

router.get("/users", async (req, res) => {
  const { status, search, excludeSelf } = req.query || {};
  try {
    const users = await userService.listUsers({
      status,
      search,
      excludeId: excludeSelf === "true" ? req.user.id : undefined,
    });
    res.json(users);
  } catch (error) {
    console.error("Error listing users:", error);
    res.status(500).json({ message: "Unable to list users." });
  }
});

router.get("/session-logs", async (req, res) => {
  try {
    const logs = await userService.listSessionLogs({
      limit: req.query?.limit,
      userId: req.query?.userId || req.query?.user_id,
      username: req.query?.username,
      event: req.query?.event,
      success:
        req.query?.success === undefined ? undefined : req.query.success,
    });
    res.json(logs);
  } catch (error) {
    console.error("Error fetching session logs:", error);
    res.status(500).json({ message: "Unable to fetch session logs." });
  }
});

router.post("/users", async (req, res) => {
  const { username, fullName, email, role, status, password } = req.body || {};
  try {
    const user = await userService.createUser({
      username,
      fullName,
      email,
      role,
      status,
      password,
      mustResetPassword: true,
    });
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put("/users/:id", async (req, res) => {
  try {
    const user = await userService.updateUser(req.params.id, req.body || {});
    res.json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post("/users/:id/reset-password", async (req, res) => {
  const { newPassword } = req.body || {};
  if (!newPassword) {
    return res.status(400).json({ message: "New password is required." });
  }
  try {
    await userService.adminResetPassword(req.params.id, newPassword);
    res.json({ message: "Password reset successfully." });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;

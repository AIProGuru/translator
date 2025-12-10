const argon2 = require("argon2");
const crypto = require("crypto");
const UserRepository = require("../../../Api/infrastructure/repositories/user.repository");
const UserSessionLogRepository = require("../../../Api/infrastructure/repositories/userSessionLog.repository");
const UserModel = require("../../../Api/infrastructure/database/models/user.model");

const userRepository = new UserRepository();
const sessionLogRepository = new UserSessionLogRepository();

const PASSWORD_MIN_LENGTH = Number(process.env.PASSWORD_MIN_LENGTH || 10);
const PASSWORD_MAX_AGE_DAYS = Number(
  process.env.PASSWORD_MAX_AGE_DAYS || 90,
);
const AUTH_MAX_FAILED_ATTEMPTS = Number(
  process.env.AUTH_MAX_FAILED_ATTEMPTS || 5,
);
const AUTH_LOCKOUT_MINUTES = Number(
  process.env.AUTH_LOCKOUT_MINUTES || 15,
);

const ROLE_LABELS = {
  administrator: "Administrator",
  translator: "Translator",
  supervisor: "Supervisor",
  auditor: "Auditor",
};

function sanitizeUsername(username = "") {
  return username.trim().toLowerCase();
}

function normalizeEmail(email = "") {
  return email.trim().toLowerCase();
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

async function hashPassword(password) {
  return argon2.hash(password, { type: argon2.argon2id });
}

async function verifyPassword(hash, password) {
  if (!hash) return false;
  return argon2.verify(hash, password);
}

function assertPasswordStrength(password = "") {
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`,
    );
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password)) {
    throw new Error(
      "Password must include uppercase and lowercase characters.",
    );
  }
  if (!/[0-9]/.test(password)) {
    throw new Error("Password must include at least one number.");
  }
  if (!/[!@#$%^&*(),.?\":{}|<>]/.test(password)) {
    throw new Error("Password must include at least one special character.");
  }
}

function generateRandomPassword() {
  const random = crypto.randomUUID().replace(/-/g, "");
  return `${random}Aa!1`;
}

async function generateUniqueUsername(seed = "") {
  const base =
    sanitizeUsername(seed.replace(/[^a-z0-9]/gi, "")) || `user${Date.now()}`;
  let candidate = base;
  let suffix = 1;
  while (await userRepository.findByUsername(candidate)) {
    candidate = `${base}${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function serializeUser(user) {
  const plain = user?.toJSON ? user.toJSON() : user;
  if (!plain) return null;
  return {
    id: plain.id,
    username: plain.username,
    fullName: plain.full_name,
    email: plain.email,
    role: plain.role,
    roleLabel: ROLE_LABELS[plain.role] || plain.role,
    status: plain.status,
    mustResetPassword: plain.must_reset_password,
    passwordExpiresAt: plain.password_expires_at,
    lastLoginAt: plain.last_login_at,
    lastLoginIp: plain.last_login_ip,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}

function serializeSessionLog(entry) {
  const plain = entry?.toJSON ? entry.toJSON() : entry;
  if (!plain) return null;
  return {
    id: plain.id,
    userId: plain.user_id,
    username: plain.username || plain.user?.username || null,
    fullName: plain.user?.full_name || null,
    event: plain.event,
    success: Boolean(plain.success),
    ipAddress: plain.ip_address,
    userAgent: plain.user_agent,
    metadata: plain.metadata,
    createdAt: plain.createdAt || plain.created_at,
  };
}

async function logSessionEvent({
  userId,
  username,
  event,
  success = true,
  ip,
  userAgent,
  metadata,
}) {
  try {
    await sessionLogRepository.create({
      user_id: userId || null,
      username: username || null,
      event,
      success,
      ip_address: ip,
      user_agent: userAgent?.slice(0, 250),
      metadata: metadata || null,
    });
  } catch (error) {
    console.error("Error logging session event:", error);
  }
}

async function createUser(payload = {}) {
  const username = sanitizeUsername(payload.username || "");
  if (!username) {
    throw new Error("Username is required.");
  }
  if (!payload.fullName) {
    throw new Error("Full name is required.");
  }
  const role = payload.role || "translator";
  if (!UserModel.ROLES.includes(role)) {
    throw new Error("Invalid role provided.");
  }

  const status = payload.status || "active";
  if (!UserModel.STATUS.includes(status)) {
    throw new Error("Invalid status provided.");
  }

  if (!payload.password) {
    throw new Error("Password is required.");
  }

  assertPasswordStrength(payload.password);

  const existing = await userRepository.findByUsername(username);
  if (existing) {
    throw new Error("A user with that username already exists.");
  }

  const passwordHash = await hashPassword(payload.password);
  const passwordExpiresAt = payload.passwordExpiresAt
    ? new Date(payload.passwordExpiresAt)
    : addDays(new Date(), PASSWORD_MAX_AGE_DAYS);

  const user = await userRepository.create({
    username,
    full_name: payload.fullName.trim(),
    email: payload.email ? normalizeEmail(payload.email) : null,
    role,
    status,
    password_hash: passwordHash,
    must_reset_password:
      payload.mustResetPassword === undefined
        ? true
        : Boolean(payload.mustResetPassword),
    password_expires_at: passwordExpiresAt,
  });

  return serializeUser(user);
}

async function findOrCreateGoogleUser(profile = {}) {
  const googleId = profile.id;
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Google authentication is not configured.");
  }

  if (!googleId) {
    throw new Error("Invalid Google response.");
  }

  const primaryEmail = profile.emails?.[0]?.value
    ? normalizeEmail(profile.emails[0].value)
    : null;

  let user =
    (await userRepository.findByGoogleId(googleId)) ||
    (primaryEmail ? await userRepository.findByEmail(primaryEmail) : null);

  if (user) {
    if (user.status !== "active") {
      await logSessionEvent({
        userId: user.id,
        username: user.username,
        event: "login",
        success: false,
        metadata: { provider: "google", reason: "USER_DISABLED" },
      });
      throw new Error("Your account is disabled. Contact an administrator.");
    }
    if (!user.googleId) {
      await userRepository.update(user.id, {
        googleId,
        displayName: user.displayName || profile.displayName || null,
      });
    }
    return serializeUser(await userRepository.findById(user.id));
  }

  const usernameSeed = primaryEmail
    ? primaryEmail.split("@")[0]
    : profile.username || profile.displayName || "google-user";
  const username = await generateUniqueUsername(usernameSeed);
  const password = generateRandomPassword();
  const fullName =
    profile.displayName ||
    [profile.name?.givenName, profile.name?.familyName]
      .filter(Boolean)
      .join(" ") ||
    username;

  const newUser = await userRepository.create({
    username,
    full_name: fullName,
    email: primaryEmail,
    role: "translator",
    status: "active",
    password_hash: await hashPassword(password),
    must_reset_password: false,
    password_expires_at: addDays(new Date(), PASSWORD_MAX_AGE_DAYS),
    googleId,
    displayName: fullName,
  });

  return serializeUser(newUser);
}

async function updateUser(id, payload = {}) {
  const user = await userRepository.findById(id);
  if (!user) {
    throw new Error("User not found.");
  }

  const updates = {};

  if (payload.fullName) {
    updates.full_name = payload.fullName.trim();
  }
  if (payload.email !== undefined) {
    updates.email = payload.email ? normalizeEmail(payload.email) : null;
  }
  if (payload.role) {
    if (!UserModel.ROLES.includes(payload.role)) {
      throw new Error("Invalid role.");
    }
    updates.role = payload.role;
  }
  if (payload.status) {
    if (!UserModel.STATUS.includes(payload.status)) {
      throw new Error("Invalid status.");
    }
    updates.status = payload.status;
  }
  if (payload.mustResetPassword !== undefined) {
    updates.must_reset_password = Boolean(payload.mustResetPassword);
  }
  if (payload.passwordExpiresAt) {
    updates.password_expires_at = new Date(payload.passwordExpiresAt);
  }

  await userRepository.update(id, updates);
  const refreshed = await userRepository.findById(id);
  return serializeUser(refreshed);
}

async function adminResetPassword(id, newPassword) {
  const user = await userRepository.findById(id);
  if (!user) {
    throw new Error("User not found.");
  }
  assertPasswordStrength(newPassword);
  const password_hash = await hashPassword(newPassword);
  await userRepository.update(id, {
    password_hash,
    must_reset_password: true,
    password_expires_at: addDays(new Date(), PASSWORD_MAX_AGE_DAYS),
    failed_attempts: 0,
    locked_until: null,
  });
  return true;
}

async function changePassword(userId, currentPassword, newPassword) {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new Error("User not found.");
  }

  const isValid = await verifyPassword(user.password_hash, currentPassword);
  if (!isValid) {
    throw new Error("Current password is incorrect.");
  }
  assertPasswordStrength(newPassword);
  const password_hash = await hashPassword(newPassword);
  await userRepository.update(userId, {
    password_hash,
    must_reset_password: false,
    password_expires_at: addDays(new Date(), PASSWORD_MAX_AGE_DAYS),
    failed_attempts: 0,
    locked_until: null,
  });
  return serializeUser(await userRepository.findById(userId));
}

async function authenticate(username, password, context = {}) {
  const normalizedUsername = sanitizeUsername(username);
  const user = await userRepository.findByUsername(normalizedUsername);

  if (!user) {
    await logSessionEvent({
      username: normalizedUsername,
      event: "login",
      success: false,
      ip: context.ip,
      userAgent: context.userAgent,
      metadata: { reason: "USER_NOT_FOUND" },
    });
    throw new Error("Invalid credentials.");
  }

  if (user.status !== "active") {
    await logSessionEvent({
      userId: user.id,
      username: user.username,
      event: "login",
      success: false,
      ip: context.ip,
      userAgent: context.userAgent,
      metadata: { reason: "USER_DISABLED" },
    });
    throw new Error("User is disabled. Contact an administrator.");
  }

  if (user.locked_until && user.locked_until > new Date()) {
    throw new Error("Account temporarily locked due to failed attempts.");
  }

  const passwordMatches = await verifyPassword(
    user.password_hash,
    password || "",
  );

  if (!passwordMatches) {
    const updates = {
      failed_attempts: user.failed_attempts + 1,
    };
    if (updates.failed_attempts >= AUTH_MAX_FAILED_ATTEMPTS) {
      updates.locked_until = addDays(new Date(), 0);
      updates.locked_until.setMinutes(
        updates.locked_until.getMinutes() + AUTH_LOCKOUT_MINUTES,
      );
      updates.failed_attempts = 0;
    }
    await userRepository.update(user.id, updates);
    await logSessionEvent({
      userId: user.id,
      username: user.username,
      event: "login",
      success: false,
      ip: context.ip,
      userAgent: context.userAgent,
      metadata: { reason: "BAD_PASSWORD" },
    });
    throw new Error("Invalid credentials.");
  }

  await userRepository.update(user.id, {
    failed_attempts: 0,
    locked_until: null,
    last_login_at: new Date(),
    last_login_ip: context.ip || null,
  });

  const requiresPasswordChange =
    Boolean(user.must_reset_password) ||
    (user.password_expires_at &&
      new Date(user.password_expires_at) < new Date());

  await logSessionEvent({
    userId: user.id,
    username: user.username,
    event: "login",
    success: true,
    ip: context.ip,
    userAgent: context.userAgent,
  });

  return {
    user: serializeUser(await userRepository.findById(user.id)),
    requiresPasswordChange,
  };
}

async function listUsers(filters = {}) {
  const users = await userRepository.findAll(filters);
  return users.map((u) => serializeUser(u));
}

async function listSessionLogs(filters = {}) {
  const normalized = {
    limit: Math.min(
      Math.max(Number(filters.limit) || 200, 1),
      Number(process.env.SESSION_LOG_MAX || 500),
    ),
    userId: filters.userId || filters.user_id || null,
    username: filters.username || filters.user || null,
    event: filters.event || null,
    success:
      filters.success === undefined
        ? undefined
        : ["true", "1", true].includes(filters.success),
  };

  const entries = await sessionLogRepository.list(normalized);
  return entries.map((entry) => serializeSessionLog(entry));
}

async function ensureAdminAccount() {
  const countAdmins = await userRepository.findAll({
    status: "active",
  });
  const exists = countAdmins.some((user) => user.role === "administrator");
  if (exists) return;

  const username =
    sanitizeUsername(
      process.env.DEFAULT_ADMIN_USERNAME || "admin",
    ) || "admin";
  const password =
    process.env.DEFAULT_ADMIN_PASSWORD ||
    crypto.randomUUID().replace(/-/g, "").slice(0, 16) + "Aa!";

  try {
    const created = await createUser({
      username,
      fullName: "System Administrator",
      email: process.env.DEFAULT_ADMIN_EMAIL || null,
      role: "administrator",
      status: "active",
      password,
      mustResetPassword: true,
    });

    console.log(
      `Created fallback administrator '${created.username}'. Please change the password immediately.`,
    );
    console.log(`Temporary password: ${password}`);
  } catch (error) {
    console.error("Failed to create fallback administrator:", error);
  }
}

module.exports = {
  ROLE_LABELS,
  sanitizeUsername,
  normalizeEmail,
  serializeUser,
  serializeSessionLog,
  createUser,
  updateUser,
  adminResetPassword,
  changePassword,
  authenticate,
  listUsers,
  listSessionLogs,
  ensureAdminAccount,
  logSessionEvent,
  findOrCreateGoogleUser,
};

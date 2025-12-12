const { QueryTypes, DataTypes } = require("sequelize");
const argon2 = require("argon2");
const crypto = require("crypto");

function slugify(value = "") {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function generateUsername(row, existing) {
  const candidates = [];
  if (row.username) {
    candidates.push(slugify(row.username));
  }
  if (row.email) {
    candidates.push(slugify(row.email.split("@")[0]));
  }
  if (row.full_name) {
    candidates.push(slugify(row.full_name.replace(/\s+/g, "-")));
  }
  if (row.displayName) {
    candidates.push(slugify(row.displayName.replace(/\s+/g, "-")));
  }
  candidates.push(`user-${row.id || Date.now()}`);

  for (const candidate of candidates) {
    const base = candidate || "user";
    let username = base;
    let suffix = 1;
    while (existing.has(username) || !username) {
      username = `${base}${suffix}`;
      suffix += 1;
    }
    if (!existing.has(username)) {
      existing.add(username);
      return username;
    }
  }
  const fallback = `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  existing.add(fallback);
  return fallback;
}

module.exports = async function ensureUserSchema(sequelize) {
  const queryInterface = sequelize.getQueryInterface();

  let tableDescription;
  try {
    tableDescription = await queryInterface.describeTable("user");
  } catch (error) {
    if (
      error?.message?.includes('No description found for "user"') ||
      error?.original?.code === "SQLITE_ERROR"
    ) {
      return;
    }
    throw error;
  }

  if (tableDescription.username) {
    return;
  }

  const backupTable = `user_backup_${Date.now()}`;
  console.warn(
    `[DB] legacy 'user' table detected (missing username). Rebuilding automatically as ${backupTable}...`,
  );

  await queryInterface.renameTable("user", backupTable);
  await queryInterface.createTable("user", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    username: {
      type: DataTypes.STRING(80),
      allowNull: false,
      unique: true,
    },
    password_hash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    full_name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    role: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "translator",
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "active",
    },
    must_reset_password: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    password_expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_login_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_login_ip: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    failed_attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    locked_until: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    googleId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    displayName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });

  const legacyRows = await sequelize.query(`SELECT * FROM \`${backupTable}\``, {
    type: QueryTypes.SELECT,
  });

  if (legacyRows.length) {
    const seen = new Set();
    const rows = [];
    for (const row of legacyRows) {
      let passwordHash = row.password_hash;
      if (!passwordHash) {
        const randomPassword =
          crypto.randomUUID().replace(/-/g, "").slice(0, 16) + "Aa!";
        passwordHash = await argon2.hash(randomPassword, {
          type: argon2.argon2id,
        });
      }

      rows.push({
        id: row.id,
        username: generateUsername(row, seen),
        password_hash: passwordHash,
        full_name:
          row.full_name || row.displayName || row.email || "Unnamed User",
        email: row.email || null,
        role: row.role || "translator",
        status: row.status || "active",
        must_reset_password:
          row.must_reset_password === undefined
            ? true
            : Boolean(row.must_reset_password),
        password_expires_at: row.password_expires_at || null,
        last_login_at: row.last_login_at || null,
        last_login_ip: row.last_login_ip || null,
        failed_attempts: row.failed_attempts || 0,
        locked_until: row.locked_until || null,
        googleId: row.googleId || null,
        displayName: row.displayName || null,
        createdAt: row.createdAt || new Date(),
        updatedAt: row.updatedAt || new Date(),
      });
    }

    await queryInterface.bulkInsert("user", rows);
  }

  await queryInterface.dropTable(backupTable);
  console.log("[DB] user table upgraded with username column.");
};

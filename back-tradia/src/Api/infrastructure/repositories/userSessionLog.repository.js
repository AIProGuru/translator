const { Op } = require("sequelize");
const UserSessionLog = require("../database/models/user_session_log.model");
const User = require("../database/models/user.model");

class UserSessionLogRepository {
  async create(payload) {
    return UserSessionLog.create(payload);
  }

  async list({ limit = 200, userId, username, event, success } = {}) {
    const where = {};
    if (userId) {
      where.user_id = userId;
    }
    if (username) {
      where.username = {
        [Op.like]: `%${username}%`,
      };
    }
    if (event) {
      where.event = event;
    }
    if (typeof success === "boolean") {
      where.success = success;
    }

    return UserSessionLog.findAll({
      where,
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "username", "full_name"],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit,
    });
  }
}

module.exports = UserSessionLogRepository;

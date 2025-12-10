const { Op } = require("sequelize");
const User = require("../database/models/user.model");

class UserRepository {
  async findAll({ status, excludeId, search } = {}) {
    const where = {};
    if (status) {
      where.status = status;
    }
    if (excludeId) {
      where.id = { [Op.ne]: excludeId };
    }
    if (search && search.trim()) {
      const pattern = `%${search.trim()}%`;
      where[Op.or] = [
        { username: { [Op.like]: pattern } },
        { full_name: { [Op.like]: pattern } },
        { email: { [Op.like]: pattern } },
      ];
    }
    return User.findAll({
      where,
      order: [
        ["role", "ASC"],
        ["full_name", "ASC"],
      ],
    });
  }

  async findById(id) {
    if (!id) return null;
    return User.findByPk(id);
  }

  async findByUsername(username) {
    if (!username) return null;
    return User.findOne({
      where: { username },
    });
  }

  async findByEmail(email) {
    if (!email) return null;
    return User.findOne({
      where: {
        email,
      },
    });
  }

  async findByGoogleId(googleId) {
    if (!googleId) return null;
    return User.findOne({
      where: { googleId },
    });
  }

  async create(data) {
    return User.create(data);
  }

  async update(id, data) {
    const user = await this.findById(id);
    if (!user) {
      throw new Error("User not found");
    }
    return user.update(data);
  }
}

module.exports = UserRepository;

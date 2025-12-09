const PromptTemplate = require("../database/models/prompt_template.model");

class PromptTemplateRepository {
  async findAll() {
    return PromptTemplate.findAll({
      order: [["label", "ASC"]],
    });
  }

  async findById(id) {
    return PromptTemplate.findByPk(id);
  }

  async findByKey(key) {
    if (!key) return null;
    return PromptTemplate.findOne({ where: { key } });
  }

  async create(data) {
    return PromptTemplate.create(data);
  }

  async update(id, data) {
    const template = await this.findById(id);
    if (!template) {
      throw new Error("Prompt template not found");
    }
    return template.update(data);
  }

  async delete(id) {
    const template = await this.findById(id);
    if (!template) {
      throw new Error("Prompt template not found");
    }
    await template.destroy();
    return true;
  }

  async deleteAll() {
    return PromptTemplate.destroy({
      where: {},
      truncate: true,
      cascade: true,
    });
  }
}

module.exports = PromptTemplateRepository;

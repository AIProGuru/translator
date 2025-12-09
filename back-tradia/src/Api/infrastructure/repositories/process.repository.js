const Process = require("../database/models/process.model");


class ProcessRepository {
	async findAll(options = {}) {
		try {
			return await Process.findAll({
				...options,
				order: [["created_at", "DESC"]],
			});
		} catch (error) {
			console.error("Error general en procesamiento:", error);
			throw new Error(`Error al obtener los procesos: ${error.message}`);
		}
	}

	async findById(id, userId) {
		try {
			const process = await Process.findOne({
					where: {
						id: id,
						userId: userId
					},
				});
			return process;
		} catch (error) {
			console.error("Error al obtener el proceso:", error);
			throw new Error(`Error al obtener el proceso: ${error.message}`);
		}
	}

	async create(data) {
		try {
			const newProcess = await Process.create({
				slug: data.slug || `process-${Date.now()}`,
				status: data.status || "pending",
				message: data.message || null,
				startTime: data.startTime || new Date(),
				config: data.config || {},
				userId: data.userId,
			});

			return newProcess;
		} catch (error) {
			throw new Error(`Error al crear el proceso: ${error.message}`);
		}
	}
	

	async update(id, data) {
		try {
			const process = await Process.findByPk(id);
			if (!process) {
				throw new Error("Proceso no encontrado");
			}

			const allowedFields = [
				"name",
				"description",
				"status",
				"config",
				"html",
				"pages_info",
                "message"
			];
			const updateData = {};

			allowedFields.forEach((field) => {
				if (data[field] !== undefined) {
					updateData[field] = data[field];
				}
			});

			await process.update(updateData);
			return process;
		} catch (error) {
			throw new Error(`Error al actualizar el proceso: ${error.message}`);
		}
	}

	async delete(id) {
		try {
			const process = await Process.findByPk(id);
			if (!process) {
				throw new Error("Proceso no encontrado");
			}
			await process.destroy();
			return true;
		} catch (error) {
			throw new Error(`Error al eliminar el proceso: ${error.message}`);
		}
	}
}

module.exports = ProcessRepository;

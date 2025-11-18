const ProcessRepository = require("../../../Api/infrastructure/repositories/process.repository");
const { Op } = require('sequelize');

class ProcessFacade {
	constructor() {
		this.runningTasks = new Map();
		this.processResources = new Map();
		this.processingStates = new Map();
		this.processRepository = new ProcessRepository();
	}

	async getAllProcesses(userId) {
		return await this.processRepository.findAll({
			where: { user_id: userId },
		});
	}

	async getProcessById(id, userId) {
		const process = await this.processRepository.findById(id, userId);
		if (!process) {
			throw new Error("process not found");
		}
		return process;
	}

	async createProcess(processData) {
		return await this.processRepository.create({
			name: processData.name,
			description: processData.description,
			status: "pending",
			userId: processData.userId,
		});
	}

	async updateProcess(id, data, userId) {
		const currentProcess = await this.processRepository.findById(
			id,
			userId
		);
		const mergedData = {
			...currentProcess,
			...data,
		};
		const updatedProcess = await this.processRepository.update(id, data);
		updatedProcess.updated_at = new Date();
		if (global.sseConnections && global.sseConnections[id]) {
			const status = mergedData.status || currentProcess.status;
			const message =
				typeof mergedData.message === "string" &&
				mergedData.message.trim() !== ""
					? mergedData.message
					: `Current status: ${status || "desconocido"}`;

			const progress =
				typeof mergedData.progress === "number"
					? mergedData.progress
					: currentProcess.progress ?? null;

			global.sseConnections[id]({
				processId: id,
				status,
				message,
				progress,
			});
		}

		return updatedProcess;
	}

	async deleteProcess(id, userId) {
		const process = await this.processRepository.findById(id, userId);

		if (!process) {
			throw new Error(
				"El proceso no existe o no pertenece al usuario actual."
			);
		}
		return await this.processRepository.delete(id);
	}
	async getAllProcessingProcesses() {
        try {
            const processes = await this.processRepository.findAll({
                where: {
					status: {
						[Op.in]: ['pending', 'upload', 'processing', 'translating'],
					},
				},
                attributes: ['id', 'status', 'updated_at'],
            });

            return processes;
        } catch (error) {
            console.error('Error al obtener procesos en estado "processing":', error);
            throw new Error('No se pudo obtener los procesos.');
        }
    }
}

module.exports = ProcessFacade;

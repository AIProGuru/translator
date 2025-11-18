const express = require("express");
const ProcessFacade = require("../../Facades/services/process");
const requireAuth = require("../../Facades/middleware/requireAuth");

const router = express.Router();
const processFacade = new ProcessFacade();

router.get(
	"/processes",
	requireAuth,
	async (req, res) => {
		try {
			const userId = req.user.id;
			
			const processes = await processFacade.getAllProcesses(userId);
			res.json(processes);
		} catch (error) {
			res.status(500).json({
				error: "Error al obtener los procesos",
				details: error.message,
			});
		}
	}
);

router.post("/processes", async (req, res) => {
	try {
		const process = await processFacade.createProcess(req.body);
		res.status(201).json(process);
	} catch (error) {
		res.status(400).json({
			error: "Error al crear el proceso",
			details: error.message,
		});
	}
});

router.delete("/processes/:id", requireAuth, async (req, res) => {
	try {
		const userId = req.user.id;
		const id = req.params.id;
		await processFacade.deleteProcess(id,userId);
		console.log("Intentando eliminar proceso con ID:", id);
		res.json({ message: "Proceso eliminado correctamente" });
	} catch (error) {
		res.status(400).json({
			error: "Error al eliminar el proceso",
			details: error.message,
		});
	}
});

module.exports = router;

const ProcessRepository = require('../../../Api/infrastructure/repositories/process.repository');
const ProcessFacade = require('../process');

class ProcessWatcher {
  constructor() {
    this.processRepository = new ProcessRepository();
    this.processFacades = new ProcessFacade
    this.MAX_PROCESS_TIME = 10 * 60 * 1000; 
    this.CHECK_INTERVAL = 60 * 1000;
  }

  async checkStaleProcesses(immediate = false) {
    const activeStatuses = new Set(["pending", "upload", "processing", "translating"]);
    try {
      const currentTime = Date.now();
      const processes = await this.processFacades.getAllProcessingProcesses();

      for (const process of processes) {
        if (activeStatuses.has(process.status) &&
            (immediate || currentTime - new Date(process.updated_at).getTime() > this.MAX_PROCESS_TIME)) {
          await this._handleStaledProcess(process, immediate);
        }
      }
    } catch (error) {
      console.error('Error en ProcessWatcher:', error);
    }
  }

  async _handleStaledProcess(process, immediate) {
    const errorMessage = immediate 
      ? "Error services"
      : "Error Timeout wait";
    
    await this.processRepository.update(process.id, {
      status: "error",
      message: errorMessage
    });

    if (global.sseConnections?.[process.id]) {
      global.sseConnections[process.id]({
        processId: process.id,
        status: "error",
        message: errorMessage,
        progress: null
      });
    }
  }

  start() {
    this.checkStaleProcesses(true);
    setInterval(() => this.checkStaleProcesses(false), this.CHECK_INTERVAL);
  }
}

module.exports = new ProcessWatcher();

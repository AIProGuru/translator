const ProcessFacade = require("../../Facades/services/process");
const constants = require("../../Api/shared/config/constants");

class ErrorHandler {
    constructor() {
        this._processFacade = new ProcessFacade();
    }

    async handleProcessError(processId, error, userId) { 
        const error_default = "Unknown error"
        const error_msg = error?.message || error_default
        await this._processFacade.updateProcess(processId, {
            status: constants.PROCESS_STATUS.ERROR,
            message: error_msg,
            error: error.message,
        }, userId);
    }
}

module.exports = ErrorHandler;

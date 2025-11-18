const clients = new Map();
const lastStates = new Map(); 

function addClient(processId, res) {
    clients.set(processId, res);
    lastStates.set(processId, null);
}

function removeClient(processId) {
    clients.delete(processId);
    lastStates.delete(processId);
}

function sendEvent(processId, data) {
    const res = clients.get(processId);
    if (!res) return;

    const lastState = lastStates.get(processId);

    if (
        !lastState || 
        lastState.status !== data.status || 
        lastState.message !== data.message
    ) {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        lastStates.set(processId, {
            status: data.status,
            message: data.message
        });
    }
}

module.exports = {
    addClient,
    removeClient,
    sendEvent
};


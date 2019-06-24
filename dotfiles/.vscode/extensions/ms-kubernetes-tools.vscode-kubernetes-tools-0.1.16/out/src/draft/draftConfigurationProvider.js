"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Net = require("net");
const debugDebug_1 = require("./debugDebug");
class DraftConfigurationProvider {
    constructor() {
    }
    resolveDebugConfiguration(folder, config, token) {
        if (!this.server) {
            this.server = Net.createServer((socket) => {
                const session = new debugDebug_1.DraftDebugSession();
                session.config = config;
                session.setRunAsServer(true);
                session.start(socket, socket);
            }).listen(0);
        }
        config.debugServer = this.server.address().port;
        return config;
    }
    dispose() {
        if (this.server) {
            this.server.close();
        }
    }
}
exports.DraftConfigurationProvider = DraftConfigurationProvider;
//# sourceMappingURL=draftConfigurationProvider.js.map
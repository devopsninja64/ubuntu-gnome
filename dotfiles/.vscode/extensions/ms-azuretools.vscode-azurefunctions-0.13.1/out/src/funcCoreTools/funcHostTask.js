"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const localize_1 = require("../localize");
let isFuncHostRunning = false;
exports.funcHostTaskLabel = 'runFunctionsHost';
exports.funcHostCommand = 'func host start';
exports.funcHostNameRegEx = /run\s*functions\s*host/i;
exports.stopFuncHostPromise = Promise.resolve();
function isFuncHostTask(task) {
    // task.name resolves to the task's id (deprecated https://github.com/Microsoft/vscode/issues/57707), then label
    return exports.funcHostNameRegEx.test(task.name);
}
exports.isFuncHostTask = isFuncHostTask;
function registerFuncHostTaskEvents() {
    vscode_azureextensionui_1.registerEvent('azureFunctions.onDidStartTask', vscode.tasks.onDidStartTask, function (e) {
        return __awaiter(this, void 0, void 0, function* () {
            this.suppressErrorDisplay = true;
            this.suppressTelemetry = true;
            if (isFuncHostTask(e.execution.task)) {
                isFuncHostRunning = true;
            }
        });
    });
    vscode_azureextensionui_1.registerEvent('azureFunctions.onDidEndTask', vscode.tasks.onDidEndTask, function (e) {
        return __awaiter(this, void 0, void 0, function* () {
            this.suppressErrorDisplay = true;
            this.suppressTelemetry = true;
            if (isFuncHostTask(e.execution.task)) {
                isFuncHostRunning = false;
            }
        });
    });
    vscode_azureextensionui_1.registerEvent('azureFunctions.onDidTerminateDebugSession', vscode.debug.onDidTerminateDebugSession, stopFuncTaskIfRunning);
}
exports.registerFuncHostTaskEvents = registerFuncHostTaskEvents;
function stopFuncTaskIfRunning() {
    return __awaiter(this, void 0, void 0, function* () {
        this.suppressErrorDisplay = true;
        this.suppressTelemetry = true;
        const funcExecution = vscode.tasks.taskExecutions.find((te) => isFuncHostTask(te.task));
        if (funcExecution && isFuncHostRunning) {
            this.suppressTelemetry = false; // only track telemetry if it's actually the func task
            exports.stopFuncHostPromise = new Promise((resolve, reject) => {
                const listener = vscode.tasks.onDidEndTask((e) => {
                    if (isFuncHostTask(e.execution.task)) {
                        resolve();
                        listener.dispose();
                    }
                });
                const timeoutInSeconds = 30;
                const timeoutError = new Error(localize_1.localize('failedToFindFuncHost', 'Failed to stop previous running Functions host within "{0}" seconds. Make sure the task has stopped before you debug again.', timeoutInSeconds));
                setTimeout(() => { reject(timeoutError); }, timeoutInSeconds * 1000);
            });
            funcExecution.terminate();
            yield exports.stopFuncHostPromise;
        }
    });
}
//# sourceMappingURL=funcHostTask.js.map
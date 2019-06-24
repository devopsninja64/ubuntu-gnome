"use strict";
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
const shell_1 = require("./shell");
exports.host = {
    showErrorMessage: showErrorMessage,
    showWarningMessage: showWarningMessage,
    showInformationMessage: showInformationMessage,
    showQuickPick: showQuickPickAny,
    withProgress: withProgress,
    getConfiguration: getConfiguration,
    createTerminal: createTerminal,
    onDidCloseTerminal: onDidCloseTerminal,
    onDidChangeConfiguration: onDidChangeConfiguration,
    showInputBox: showInputBox,
    activeDocument: activeDocument,
    showDocument: showDocument,
    readDocument: readDocument
};
function showInputBox(options, token) {
    return vscode.window.showInputBox(options, token);
}
function showErrorMessage(message, ...items) {
    return vscode.window.showErrorMessage(message, ...items);
}
function showWarningMessage(message, ...items) {
    return vscode.window.showWarningMessage(message, ...items);
}
function showInformationMessage(message, ...items) {
    return vscode.window.showInformationMessage(message, ...items);
}
function showQuickPickStr(items, options) {
    return vscode.window.showQuickPick(items, options);
}
function showQuickPickT(items, options) {
    return vscode.window.showQuickPick(items, options);
}
function showQuickPickAny(items, options) {
    if (!Array.isArray(items)) {
        throw 'unexpected type passed to showQuickPick';
    }
    if (items.length === 0) {
        return showQuickPickStr(items, options);
    }
    const item = items[0];
    if (typeof item === 'string' || item instanceof String) {
        return showQuickPickStr(items, options);
    }
    else {
        return showQuickPickT(items, options);
    }
}
function withProgress(task) {
    return vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, task);
}
function getConfiguration(key) {
    return vscode.workspace.getConfiguration(key);
}
function createTerminal(name, shellPath, shellArgs) {
    const terminalOptions = {
        name: name,
        shellPath: shellPath,
        shellArgs: shellArgs,
        env: shell_1.shellEnvironment(process.env)
    };
    return vscode.window.createTerminal(terminalOptions);
}
function onDidCloseTerminal(listener) {
    return vscode.window.onDidCloseTerminal(listener);
}
function onDidChangeConfiguration(listener) {
    return vscode.workspace.onDidChangeConfiguration(listener);
}
function activeDocument() {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
        return activeEditor.document;
    }
    return undefined;
}
function showDocument(uri) {
    return __awaiter(this, void 0, void 0, function* () {
        const document = yield vscode.workspace.openTextDocument(uri);
        if (document) {
            yield vscode.window.showTextDocument(document);
        }
        return document;
    });
}
function readDocument(uri) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield vscode.workspace.openTextDocument(uri);
    });
}
//# sourceMappingURL=host.js.map
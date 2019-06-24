'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const util_1 = require("./util");
const cp = require("child_process");
const path = require("path");
const goInstallTools_1 = require("./goInstallTools");
const goMain_1 = require("./goMain");
let runner;
function goLiveErrorsEnabled() {
    const goConfig = vscode.workspace.getConfiguration('go', vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document.uri : null)['liveErrors'];
    if (goConfig === null || goConfig === undefined || !goConfig.enabled) {
        return false;
    }
    const files = vscode.workspace.getConfiguration('files');
    const autoSave = files['autoSave'];
    const autoSaveDelay = files['autoSaveDelay'];
    if (autoSave !== null && autoSave !== undefined &&
        autoSave === 'afterDelay' && autoSaveDelay < goConfig.delay * 1.5) {
        return false;
    }
    return goConfig.enabled;
}
exports.goLiveErrorsEnabled = goLiveErrorsEnabled;
// parseLiveFile runs the gotype command in live mode to check for any syntactic or
// semantic errors and reports them immediately
function parseLiveFile(e) {
    if (e.document.isUntitled) {
        return;
    }
    if (e.document.languageId !== 'go') {
        return;
    }
    if (!goLiveErrorsEnabled()) {
        return;
    }
    if (runner != null) {
        clearTimeout(runner);
    }
    runner = setTimeout(() => {
        processFile(e);
        runner = null;
    }, vscode.workspace.getConfiguration('go', e.document.uri)['liveErrors']['delay']);
}
exports.parseLiveFile = parseLiveFile;
// processFile does the actual work once the timeout has fired
function processFile(e) {
    const gotypeLive = util_1.getBinPath('gotype-live');
    if (!path.isAbsolute(gotypeLive)) {
        return goInstallTools_1.promptForMissingTool('gotype-live');
    }
    const fileContents = e.document.getText();
    const fileName = e.document.fileName;
    const args = ['-e', '-a', '-lf=' + fileName, path.dirname(fileName)];
    const env = util_1.getToolsEnvVars();
    const p = cp.execFile(gotypeLive, args, { env }, (err, stdout, stderr) => {
        if (err && err.code === 'ENOENT') {
            goInstallTools_1.promptForMissingTool('gotype-live');
            return;
        }
        goMain_1.buildDiagnosticCollection.clear();
        if (err) {
            // we want to take the error path here because the command we are calling
            // returns a non-zero exit status if the checks fail
            const diagnosticMap = new Map();
            stderr.split('\n').forEach(error => {
                if (error === null || error.length === 0) {
                    return;
                }
                // extract the line, column and error message from the gotype output
                const [_, file, line, column, message] = /^(.+):(\d+):(\d+):\s+(.+)/.exec(error);
                // get canonical file path
                const canonicalFilePath = vscode.Uri.file(file).toString();
                const range = new vscode.Range(+line - 1, +column, +line - 1, +column);
                const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Error);
                diagnostic.source = 'go';
                const diagnostics = diagnosticMap.get(canonicalFilePath) || [];
                diagnostics.push(diagnostic);
                diagnosticMap.set(canonicalFilePath, diagnostics);
            });
            diagnosticMap.forEach((diagnostics, file) => {
                goMain_1.buildDiagnosticCollection.set(vscode.Uri.parse(file), diagnostics);
            });
        }
    });
    if (p.pid) {
        p.stdin.end(fileContents);
    }
}
//# sourceMappingURL=goLiveErrors.js.map
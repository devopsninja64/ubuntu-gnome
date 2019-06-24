'use strict';
var vscode = require('vscode');
var os = require('os');
var path = require('path');
function activate(context) {
    var disposable = vscode.commands.registerCommand('terminalHere.create', function () {
        var editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        var document = editor.document;
        if (!document) {
            return;
        }
        var uri = document.uri;
        if (!uri) {
            return;
        }
        var dir = path.dirname(uri.fsPath);
        var terminal = vscode.window.createTerminal();
        terminal.show(false);
        switch (kindOfShell(vscode.workspace.getConfiguration('terminal'))) {
            case "wslbash":
                // c:\workspace\foo to /mnt/c/workspace/foo
                dir = dir.replace(/(\w):/, '/mnt/$1').replace(/\\/g, '/');
                break;
            case "cmd":
                // send 1st two characters (drive letter and colon) to the terminal
                // so that drive letter is updated before running cd
                terminal.sendText(dir.slice(0, 2));
        }
        terminal.sendText("cd \"" + dir + "\"");
    });
    context.subscriptions.push(disposable);
}
exports.activate = activate;
function deactivate() {
}
exports.deactivate = deactivate;
function kindOfShell(terminalSettings) {
    if (os.platform() !== 'win32') {
        return;
    }
    var windowsShellPath = terminalSettings.integrated.shell.windows;
    if (!windowsShellPath) {
        return undefined;
    }
    // Detect WSL bash according to the implementation of VS Code terminal.
    // For more details, refer to https://goo.gl/AuwULb
    var is32ProcessOn64Windows = process.env.hasOwnProperty('PROCESSOR_ARCHITEW6432');
    var system32 = is32ProcessOn64Windows ? 'Sysnative' : 'System32';
    var shellKindByPath = {};
    shellKindByPath[path.join(process.env.windir, system32, 'bash.exe').toLowerCase()] = "wslbash";
    shellKindByPath[path.join(process.env.windir, system32, 'cmd.exe').toLowerCase()] = "cmd";
    // %windir% can give WINDOWS instead of Windows
    return shellKindByPath[windowsShellPath.toLowerCase()];
}
//# sourceMappingURL=extension.js.map
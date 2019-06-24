"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const dictionary_1 = require("../../utils/dictionary");
class DescribePanel {
    constructor(panel, content, resource) {
        this.panel = panel;
        this.disposables = [];
        this.content = content;
        this.resource = resource;
        this.update();
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        this.panel.onDidChangeViewState((e) => {
            if (this.panel.visible) {
                this.update();
            }
        }, null, this.disposables);
    }
    static createOrShow(content, resource) {
        const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;
        // If we already have a panel, show it.
        const currentPanel = DescribePanel.currentPanels[resource];
        if (currentPanel) {
            currentPanel.setInfo(content, resource);
            currentPanel.update();
            currentPanel.panel.reveal(column);
            return;
        }
        const panel = vscode.window.createWebviewPanel(DescribePanel.viewType, "Kubernetes Describe", column || vscode.ViewColumn.One, {
            enableScripts: false,
            // And restrict the webview to only loading content from our extension's `media` directory.
            localResourceRoots: []
        });
        DescribePanel.currentPanels[resource] = new DescribePanel(panel, content, resource);
    }
    setInfo(content, resource) {
        this.content = content;
        this.resource = resource;
    }
    dispose() {
        delete DescribePanel.currentPanels[this.resource];
        this.panel.dispose();
        while (this.disposables.length) {
            const x = this.disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
    update() {
        this.panel.title = `Kubernetes describe ${this.resource}`;
        this.panel.webview.html = `
    <!doctype html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Kubernetes describe ${this.resource}</title>
    </head>
    <body>
        <code>
            <pre>${this.content}</pre>
        </code>
    </body>
    </html>`;
    }
}
DescribePanel.viewType = 'vscodeKubernetesDescribe';
DescribePanel.currentPanels = dictionary_1.Dictionary.of();
exports.DescribePanel = DescribePanel;
//# sourceMappingURL=describeWebview.js.map
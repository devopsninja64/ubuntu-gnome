'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
// Standard node imports
const os = require("os");
const path = require("path");
const fs_1 = require("./fs");
// External dependencies
const yaml = require("js-yaml");
const dockerfileParse = require("dockerfile-parse");
const tmp = require("tmp");
const clipboard = require("clipboardy");
const lodash_1 = require("lodash");
// Internal dependencies
const host_1 = require("./host");
const configMap_1 = require("./configMap");
const explainer = require("./explainer");
const shell_1 = require("./shell");
const configmaps = require("./configMap");
const describeWebview_1 = require("./components/describe/describeWebview");
const kuberesources = require("./kuberesources");
const namespace_1 = require("./components/kubectl/namespace");
const events_1 = require("./components/kubectl/events");
const docker = require("./docker");
const kubeChannel_1 = require("./kubeChannel");
const kubectl_1 = require("./kubectl");
const kubectlUtils = require("./kubectlUtils");
const explorer = require("./explorer");
const helmRepoExplorer = require("./helm.repoExplorer");
const draft_1 = require("./draft/draft");
const minikube_1 = require("./components/clusterprovider/minikube/minikube");
const logger = require("./logger");
const helm = require("./helm");
const helmexec = require("./helm.exec");
const helmauthoring = require("./helm.authoring");
const helm_requirementsCodeLens_1 = require("./helm.requirementsCodeLens");
const helm_hoverProvider_1 = require("./helm.hoverProvider");
const helm_documentProvider_1 = require("./helm.documentProvider");
const helm_completionProvider_1 = require("./helm.completionProvider");
const telemetry_1 = require("./telemetry");
const telemetry = require("./telemetry-helper");
const dashboard_1 = require("./components/kubectl/dashboard");
const port_forward_1 = require("./components/kubectl/port-forward");
const logs_1 = require("./components/kubectl/logs");
const errorable_1 = require("./errorable");
const git_1 = require("./components/git/git");
const debugSession_1 = require("./debug/debugSession");
const providerRegistry_1 = require("./debug/providerRegistry");
const config = require("./components/config/config");
const yaml_schema_1 = require("./yaml-support/yaml-schema");
const clusterproviderregistry = require("./components/clusterprovider/clusterproviderregistry");
const azureclusterprovider = require("./components/clusterprovider/azure/azureclusterprovider");
const minikubeclusterprovider = require("./components/clusterprovider/minikube/minikubeclusterprovider");
const explorer_1 = require("./components/clusterprovider/common/explorer");
const yaml_snippet_1 = require("./yaml-support/yaml-snippet");
const hostutils_1 = require("./hostutils");
const draftConfigurationProvider_1 = require("./draft/draftConfigurationProvider");
const installer_1 = require("./components/installer/installer");
const kuberesources_virtualfs_1 = require("./kuberesources.virtualfs");
const kuberesources_linkprovider_1 = require("./kuberesources.linkprovider");
const kuberesources_objectmodel_1 = require("./kuberesources.objectmodel");
const config_1 = require("./components/config/config");
const helm_symbolProvider_1 = require("./helm.symbolProvider");
const yaml_navigation_1 = require("./yaml-support/yaml-navigation");
const linters_1 = require("./components/lint/linters");
const clusterproviderserver_1 = require("./components/clusterprovider/clusterproviderserver");
let explainActive = false;
let swaggerSpecPromise = null;
const kubernetesDiagnostics = vscode.languages.createDiagnosticCollection("Kubernetes");
const kubectl = kubectl_1.create(host_1.host, fs_1.fs, shell_1.shell, installDependencies);
const draft = draft_1.create(host_1.host, fs_1.fs, shell_1.shell, installDependencies);
const minikube = minikube_1.create(host_1.host, fs_1.fs, shell_1.shell, installDependencies);
const clusterProviderRegistry = clusterproviderregistry.get();
const configMapProvider = new configmaps.ConfigMapTextProvider(kubectl);
const git = new git_1.Git(shell_1.shell);
exports.overwriteMessageItems = [
    {
        title: "Overwrite"
    },
    {
        title: "Cancel",
        isCloseAffordance: true
    }
];
exports.deleteMessageItems = [
    {
        title: "Delete"
    },
    {
        title: "Cancel",
        isCloseAffordance: true
    }
];
// Filters for different Helm file types.
// TODO: Consistently apply these to the providers registered.
exports.HELM_MODE = { language: "helm", scheme: "file" };
exports.HELM_REQ_MODE = { language: "helm", scheme: "file", pattern: "**/requirements.yaml" };
exports.HELM_CHART_MODE = { language: "helm", scheme: "file", pattern: "**/Chart.yaml" };
exports.HELM_TPL_MODE = { language: "helm", scheme: "file", pattern: "**/templates/*.*" };
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    return __awaiter(this, void 0, void 0, function* () {
        kubectl.checkPresent(kubectl_1.CheckPresentMessageMode.Activation);
        const treeProvider = explorer.create(kubectl, host_1.host);
        const helmRepoTreeProvider = helmRepoExplorer.create(host_1.host);
        const resourceDocProvider = new kuberesources_virtualfs_1.KubernetesResourceVirtualFileSystemProvider(kubectl, host_1.host, vscode.workspace.rootPath);
        const resourceLinkProvider = new kuberesources_linkprovider_1.KubernetesResourceLinkProvider();
        const previewProvider = new helm_documentProvider_1.HelmTemplatePreviewDocumentProvider();
        const inspectProvider = new helm_documentProvider_1.HelmInspectDocumentProvider();
        const dependenciesProvider = new helm_documentProvider_1.HelmDependencyDocumentProvider();
        const helmSymbolProvider = new helm_symbolProvider_1.HelmDocumentSymbolProvider();
        const completionProvider = new helm_completionProvider_1.HelmTemplateCompletionProvider();
        const completionFilter = [
            "helm",
            { pattern: "**/templates/NOTES.txt" }
        ];
        const draftDebugProvider = new draftConfigurationProvider_1.DraftConfigurationProvider();
        let draftDebugSession;
        minikube.checkUpgradeAvailable();
        const subscriptions = [
            // Commands - Kubernetes
            registerCommand('extension.vsKubernetesCreate', maybeRunKubernetesCommandForActiveWindow.bind(this, 'create', "Kubernetes Creating...")),
            registerCommand('extension.vsKubernetesDelete', (explorerNode) => { deleteKubernetes(KubernetesDeleteMode.Graceful, explorerNode); }),
            registerCommand('extension.vsKubernetesDeleteNow', (explorerNode) => { deleteKubernetes(KubernetesDeleteMode.Now, explorerNode); }),
            registerCommand('extension.vsKubernetesApply', applyKubernetes),
            registerCommand('extension.vsKubernetesExplain', explainActiveWindow),
            registerCommand('extension.vsKubernetesLoad', loadKubernetes),
            registerCommand('extension.vsKubernetesGet', getKubernetes),
            registerCommand('extension.vsKubernetesRun', runKubernetes),
            registerCommand('extension.vsKubernetesShowLogs', (explorerNode) => { logs_1.logsKubernetes(kubectl, explorerNode, logs_1.LogsDisplayMode.Show); }),
            registerCommand('extension.vsKubernetesFollowLogs', (explorerNode) => { logs_1.logsKubernetes(kubectl, explorerNode, logs_1.LogsDisplayMode.Follow); }),
            registerCommand('extension.vsKubernetesExpose', exposeKubernetes),
            registerCommand('extension.vsKubernetesDescribe', describeKubernetes),
            registerCommand('extension.vsKubernetesSync', syncKubernetes),
            registerCommand('extension.vsKubernetesExec', execKubernetes),
            registerCommand('extension.vsKubernetesTerminal', terminalKubernetes),
            registerCommand('extension.vsKubernetesDiff', diffKubernetes),
            registerCommand('extension.vsKubernetesScale', scaleKubernetes),
            registerCommand('extension.vsKubernetesDebug', debugKubernetes),
            registerCommand('extension.vsKubernetesRemoveDebug', removeDebugKubernetes),
            registerCommand('extension.vsKubernetesDebugAttach', debugAttachKubernetes),
            registerCommand('extension.vsKubernetesConfigureFromCluster', configureFromClusterKubernetes),
            registerCommand('extension.vsKubernetesCreateCluster', createClusterKubernetes),
            registerCommand('extension.vsKubernetesRefreshExplorer', () => treeProvider.refresh()),
            registerCommand('extension.vsKubernetesRefreshHelmRepoExplorer', () => helmRepoTreeProvider.refresh()),
            registerCommand('extension.vsKubernetesUseContext', useContextKubernetes),
            registerCommand('extension.vsKubernetesUseKubeconfig', useKubeconfigKubernetes),
            registerCommand('extension.vsKubernetesClusterInfo', clusterInfoKubernetes),
            registerCommand('extension.vsKubernetesDeleteContext', deleteContextKubernetes),
            registerCommand('extension.vsKubernetesUseNamespace', (explorerNode) => { namespace_1.useNamespaceKubernetes(kubectl, explorerNode); }),
            registerCommand('extension.vsKubernetesDashboard', () => { dashboard_1.dashboardKubernetes(kubectl); }),
            registerCommand('extension.vsMinikubeStop', () => minikube.stop()),
            registerCommand('extension.vsMinikubeStart', () => minikube.start({})),
            registerCommand('extension.vsMinikubeStatus', () => __awaiter(this, void 0, void 0, function* () {
                try {
                    const status = yield minikube.status();
                    const isRunning = status.running ? "running" : "stopped";
                    vscode.window.showInformationMessage(`Minikube is ${isRunning}`);
                }
                catch (err) {
                    vscode.window.showErrorMessage(`Error getting status ${err}`);
                }
            })),
            registerCommand('extension.vsKubernetesCopy', copyKubernetes),
            registerCommand('extension.vsKubernetesPortForward', (explorerNode) => { port_forward_1.portForwardKubernetes(kubectl, explorerNode); }),
            registerCommand('extension.vsKubernetesLoadConfigMapData', configmaps.loadConfigMapData),
            registerCommand('extension.vsKubernetesDeleteFile', (explorerNode) => { configMap_1.deleteKubernetesConfigFile(kubectl, explorerNode, treeProvider); }),
            registerCommand('extension.vsKubernetesAddFile', (explorerNode) => { configMap_1.addKubernetesConfigFile(kubectl, explorerNode, treeProvider); }),
            registerCommand('extension.vsKubernetesShowEvents', (explorerNode) => { events_1.getEvents(kubectl, events_1.EventDisplayMode.Show, explorerNode); }),
            registerCommand('extension.vsKubernetesFollowEvents', (explorerNode) => { events_1.getEvents(kubectl, events_1.EventDisplayMode.Follow, explorerNode); }),
            // Commands - Helm
            registerCommand('extension.helmVersion', helmexec.helmVersion),
            registerCommand('extension.helmTemplate', helmexec.helmTemplate),
            registerCommand('extension.helmTemplatePreview', helmexec.helmTemplatePreview),
            registerCommand('extension.helmLint', helmexec.helmLint),
            registerCommand('extension.helmInspectValues', helmexec.helmInspectValues),
            registerCommand('extension.helmInspectChart', helmexec.helmInspectChart),
            registerCommand('extension.helmDryRun', helmexec.helmDryRun),
            registerCommand('extension.helmDepUp', helmexec.helmDepUp),
            registerCommand('extension.helmInsertReq', helmexec.insertRequirement),
            registerCommand('extension.helmCreate', helmexec.helmCreate),
            registerCommand('extension.helmGet', helmexec.helmGet),
            registerCommand('extension.helmPackage', helmexec.helmPackage),
            registerCommand('extension.helmFetch', helmexec.helmFetch),
            registerCommand('extension.helmInstall', (o) => helmexec.helmInstall(kubectl, o)),
            registerCommand('extension.helmDependencies', helmexec.helmDependencies),
            registerCommand('extension.helmConvertToTemplate', helmConvertToTemplate),
            registerCommand('extension.helmParameterise', helmParameterise),
            // Commands - Draft
            registerCommand('extension.draftVersion', execDraftVersion),
            registerCommand('extension.draftCreate', execDraftCreate),
            registerCommand('extension.draftUp', execDraftUp),
            // Draft debug configuration provider
            vscode.debug.registerDebugConfigurationProvider('draft', draftDebugProvider),
            // HTML renderers
            vscode.workspace.registerTextDocumentContentProvider(helm.PREVIEW_SCHEME, previewProvider),
            vscode.workspace.registerTextDocumentContentProvider(helm.INSPECT_VALUES_SCHEME, inspectProvider),
            vscode.workspace.registerTextDocumentContentProvider(helm.INSPECT_CHART_SCHEME, inspectProvider),
            vscode.workspace.registerTextDocumentContentProvider(helm.DEPENDENCIES_SCHEME, dependenciesProvider),
            // Completion providers
            vscode.languages.registerCompletionItemProvider(completionFilter, completionProvider),
            vscode.languages.registerCompletionItemProvider('yaml', new yaml_snippet_1.KubernetesCompletionProvider()),
            // Symbol providers
            vscode.languages.registerDocumentSymbolProvider({ language: 'helm' }, helmSymbolProvider),
            // Hover providers
            vscode.languages.registerHoverProvider({ language: 'json' }, { provideHover: provideHoverJson }),
            vscode.languages.registerHoverProvider({ language: 'yaml' }, { provideHover: provideHoverYaml }),
            vscode.languages.registerHoverProvider(exports.HELM_MODE, new helm_hoverProvider_1.HelmTemplateHoverProvider()),
            // Tree data providers
            vscode.window.registerTreeDataProvider('extension.vsKubernetesExplorer', treeProvider),
            vscode.window.registerTreeDataProvider('extension.vsKubernetesHelmRepoExplorer', helmRepoTreeProvider),
            // Temporarily loaded resource providers
            vscode.workspace.registerFileSystemProvider(kuberesources_virtualfs_1.K8S_RESOURCE_SCHEME, resourceDocProvider, { /* TODO: case sensitive? */}),
            // Link from resources to referenced resources
            vscode.languages.registerDocumentLinkProvider({ scheme: kuberesources_virtualfs_1.K8S_RESOURCE_SCHEME }, resourceLinkProvider),
            // Code lenses
            vscode.languages.registerCodeLensProvider(exports.HELM_REQ_MODE, new helm_requirementsCodeLens_1.HelmRequirementsCodeLensProvider()),
            // Telemetry
            registerTelemetry(context)
        ];
        telemetry.invalidateClusterType(undefined, kubectl);
        yield azureclusterprovider.init(clusterProviderRegistry, { shell: shell_1.shell, fs: fs_1.fs });
        yield minikubeclusterprovider.init(clusterProviderRegistry, { shell: shell_1.shell, minikube: minikube });
        // On save, refresh the Helm YAML preview.
        vscode.workspace.onDidSaveTextDocument((e) => {
            if (!editorIsActive()) {
                if (helm.hasPreviewBeenShown()) {
                    logger.helm.log("WARNING: No active editor during save. Helm preview was not updated.");
                }
                return;
            }
            if (e === vscode.window.activeTextEditor.document) {
                const doc = vscode.window.activeTextEditor.document;
                if (doc.uri.scheme !== "file") {
                    return;
                }
                const u = vscode.Uri.parse(helm.PREVIEW_URI);
                previewProvider.update(u);
            }
            // if there is an active Draft debugging session, restart the cycle
            if (draftDebugSession !== undefined) {
                const session = vscode.debug.activeDebugSession;
                // TODO - how do we make sure this doesn't affect all other debugging sessions?
                // TODO - maybe check to see if `draft.toml` is present in the workspace
                // TODO - check to make sure we enable this only when Draft is installed
                if (session !== undefined) {
                    draftDebugSession.customRequest('evaluate', { restart: true });
                }
            }
        });
        vscode.debug.onDidTerminateDebugSession((e) => {
            // if there is an active Draft debugging session, restart the cycle
            if (draftDebugSession !== undefined) {
                const session = vscode.debug.activeDebugSession;
                // TODO - how do we make sure this doesn't affect all other debugging sessions?
                // TODO - maybe check to see if `draft.toml` is present in the workspace
                // TODO - check to make sure we enable this only when Draft is installed
                if (session !== undefined) {
                    draftDebugSession.customRequest('evaluate', { stop: true });
                }
            }
        });
        // On editor change, refresh the Helm YAML preview
        vscode.window.onDidChangeActiveTextEditor((e) => {
            if (!editorIsActive()) {
                return;
            }
            const doc = vscode.window.activeTextEditor.document;
            if (doc.uri.scheme !== "file") {
                return;
            }
            const u = vscode.Uri.parse(helm.PREVIEW_URI);
            previewProvider.update(u);
        });
        vscode.debug.onDidChangeActiveDebugSession((e) => {
            if (e !== undefined) {
                // keep a copy of the initial Draft debug session
                if (e.name.indexOf('Draft') >= 0) {
                    draftDebugSession = e;
                }
            }
        });
        vscode.workspace.onDidOpenTextDocument(kubernetesLint);
        vscode.workspace.onDidChangeTextDocument((e) => kubernetesLint(e.document)); // TODO: we could use the change hint
        vscode.workspace.onDidSaveTextDocument(kubernetesLint);
        vscode.workspace.onDidCloseTextDocument((d) => kubernetesDiagnostics.delete(d.uri));
        vscode.workspace.textDocuments.forEach(kubernetesLint);
        subscriptions.forEach((element) => {
            context.subscriptions.push(element);
        }, this);
        yield yaml_schema_1.registerYamlSchemaSupport();
        vscode.workspace.registerTextDocumentContentProvider(configmaps.uriScheme, configMapProvider);
        return {
            apiVersion: '0.1',
            clusterProviderRegistry: clusterProviderRegistry
        };
    });
}
exports.activate = activate;
// this method is called when your extension is deactivated
exports.deactivate = () => { };
function registerCommand(command, callback) {
    const wrappedCallback = telemetry.telemetrise(command, kubectl, callback);
    return vscode.commands.registerCommand(command, wrappedCallback);
}
function registerTelemetry(context) {
    return new telemetry_1.Reporter(context);
}
function provideHover(document, position, token, syntax) {
    return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
        if (!explainActive) {
            resolve(null);
            return;
        }
        const body = document.getText();
        let obj = {};
        try {
            obj = syntax.parse(body);
        }
        catch (err) {
            // Bad document, return nothing
            // TODO: at least verbose log here?
            resolve(null);
            return;
        }
        // Not a k8s object.
        if (!obj.kind) {
            resolve(null);
            return;
        }
        const property = findProperty(document.lineAt(position.line));
        let field = syntax.parse(property), parentLine = syntax.findParent(document, position.line);
        while (parentLine !== -1) {
            const parentProperty = findProperty(document.lineAt(parentLine));
            field = `${syntax.parse(parentProperty)}.${field}`;
            parentLine = syntax.findParent(document, parentLine);
        }
        if (field === 'kind') {
            field = '';
        }
        explain(obj, field).then((msg) => resolve(new vscode.Hover(msg)), (err) => reject(err));
    }));
}
function provideHoverJson(document, position, token) {
    const syntax = {
        parse: (text) => JSON.parse(text),
        findParent: (document, parentLine) => findParentJson(document, parentLine - 1)
    };
    return provideHover(document, position, token, syntax);
}
function provideHoverYaml(document, position, token) {
    const syntax = {
        parse: (text) => yaml.safeLoad(text),
        findParent: (document, parentLine) => yaml_navigation_1.findParentYaml(document, parentLine)
    };
    return provideHover(document, position, token, syntax);
}
function findProperty(line) {
    const ix = line.text.indexOf(':');
    return line.text.substring(line.firstNonWhitespaceCharacterIndex, ix);
}
function findParentJson(document, line) {
    let count = 1;
    while (line >= 0) {
        const txt = document.lineAt(line);
        if (txt.text.indexOf('}') !== -1) {
            count = count + 1;
        }
        if (txt.text.indexOf('{') !== -1) {
            count = count - 1;
            if (count === 0) {
                break;
            }
        }
        line = line - 1;
    }
    while (line >= 0) {
        const txt = document.lineAt(line);
        if (txt.text.indexOf(':') !== -1) {
            return line;
        }
        line = line - 1;
    }
    return line;
}
function explain(obj, field) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve) => {
            if (!obj.kind) {
                vscode.window.showErrorMessage("Not a Kubernetes API Object!");
                resolve(null);
            }
            let ref = obj.kind;
            if (field && field.length > 0) {
                ref = `${ref}.${field}`;
            }
            if (!swaggerSpecPromise) {
                swaggerSpecPromise = explainer.readSwagger();
            }
            swaggerSpecPromise.then((s) => {
                resolve(explainer.readExplanation(s, ref));
            }, (err) => {
                vscode.window.showErrorMessage(`Explain failed: ${err}`);
                swaggerSpecPromise = null;
                resolve(null);
            });
        });
    });
}
function explainActiveWindow() {
    const editor = vscode.window.activeTextEditor;
    const bar = initStatusBar();
    if (!editor) {
        vscode.window.showErrorMessage('No active editor!');
        bar.hide();
        return; // No open text editor
    }
    explainActive = !explainActive;
    if (explainActive) {
        vscode.window.showInformationMessage('Kubernetes API explain activated.');
        bar.show();
        if (!swaggerSpecPromise) {
            swaggerSpecPromise = explainer.readSwagger();
        }
    }
    else {
        vscode.window.showInformationMessage('Kubernetes API explain deactivated.');
        bar.hide();
    }
}
let statusBarItem = undefined;
function initStatusBar() {
    if (!statusBarItem) {
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        statusBarItem.text = 'kubernetes-api-explain';
    }
    return statusBarItem;
}
// Runs a command for the text in the active window.
// Expects that it can append a filename to 'command' to create a complete kubectl command.
//
// @parameter command string The command to run
function maybeRunKubernetesCommandForActiveWindow(command, progressMessage) {
    let text;
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('This command operates on the open document. Open your Kubernetes resource file, and try again.');
        return false; // No open text editor
    }
    const namespace = config.getConfiguredNamespace();
    if (namespace) {
        command = `${command} --namespace ${namespace} `;
    }
    const isKubernetesSyntax = (editor.document.languageId === 'json' || editor.document.languageId === 'yaml');
    const resultHandler = isKubernetesSyntax ? undefined /* default handling */ :
        (code, stdout, stderr) => {
            if (code === 0) {
                vscode.window.showInformationMessage(stdout);
            }
            else {
                vscode.window.showErrorMessage(`Kubectl command failed. The open document might not be a valid Kubernetes resource.  Details: ${stderr}`);
            }
        };
    if (editor.selection) {
        text = editor.document.getText(editor.selection);
        if (text.length > 0) {
            kubectlViaTempFile(command, text, progressMessage, resultHandler);
            return true;
        }
    }
    if (editor.document.isUntitled) {
        text = editor.document.getText();
        if (text.length > 0) {
            kubectlViaTempFile(command, text, progressMessage, resultHandler);
            return true;
        }
        return false;
    }
    // TODO: unify these paths now we handle non-file URIs
    if (editor.document.isDirty) {
        // TODO: I18n this?
        const confirm = "Save";
        const promise = vscode.window.showWarningMessage("You have unsaved changes!", confirm);
        promise.then((value) => {
            if (value && value === confirm) {
                editor.document.save().then((ok) => {
                    if (!ok) {
                        vscode.window.showErrorMessage("Save failed.");
                        return;
                    }
                    kubectlTextDocument(command, editor.document, progressMessage, resultHandler);
                }, (err) => {
                    vscode.window.showErrorMessage(`Error saving: ${err}`);
                });
            }
        }, (err) => vscode.window.showErrorMessage(`Error confirming save: ${err}`));
    }
    else {
        kubectlTextDocument(command, editor.document, progressMessage, resultHandler);
    }
    return true;
}
function convertWindowsToWSL(filePath) {
    const drive = filePath[0].toLowerCase();
    const path = filePath.substring(2).replace(/\\/g, '/');
    return `/mnt/${drive}/${path}`;
}
function kubectlTextDocument(command, document, progressMessage, resultHandler) {
    if (document.uri.scheme === 'file') {
        let fileName = document.fileName;
        if (config.getUseWsl()) {
            fileName = convertWindowsToWSL(fileName);
        }
        const fullCommand = `${command} -f "${fileName}"`;
        kubectl.invokeWithProgress(fullCommand, progressMessage, resultHandler);
    }
    else {
        kubectlViaTempFile(command, document.getText(), progressMessage, resultHandler);
    }
}
function kubectlViaTempFile(command, fileContent, progressMessage, handler) {
    const tmpobj = tmp.fileSync();
    fs_1.fs.writeFileSync(tmpobj.name, fileContent);
    let fileName = tmpobj.name;
    if (config.getUseWsl()) {
        fileName = convertWindowsToWSL(fileName);
    }
    kubectl.invokeWithProgress(`${command} -f ${fileName}`, progressMessage, handler);
}
/**
 * Gets the text content (in the case of unsaved or selections), or the filename
 *
 * @param callback function(text, filename)
 */
function getTextForActiveWindow(callback) {
    let text;
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor!');
        callback(null, null);
        return;
    }
    if (editor.selection) {
        text = editor.document.getText(editor.selection);
        if (text.length > 0) {
            callback(text, null);
            return;
        }
    }
    if (editor.document.isUntitled) {
        text = editor.document.getText();
        if (text.length === 0) {
            return;
        }
        callback(text, null);
        return;
    }
    if (editor.document.isDirty) {
        // TODO: I18n this?
        const confirm = 'Save';
        const promise = vscode.window.showWarningMessage('You have unsaved changes!', confirm);
        promise.then((value) => {
            if (!value) {
                return;
            }
            if (value !== confirm) {
                return;
            }
            editor.document.save().then((ok) => {
                if (!ok) {
                    vscode.window.showErrorMessage('Save failed.');
                    callback(null, null);
                    return;
                }
                callback(null, editor.document.uri);
            });
            return;
        }, (err) => vscode.window.showErrorMessage(`Error saving changes: ${err}`));
    }
    callback(null, editor.document.uri);
    return;
}
function loadKubernetes(explorerNode) {
    if (explorerNode) {
        loadKubernetesCore(explorerNode.namespace, explorerNode.resourceId);
    }
    else {
        promptKindName(kuberesources.commonKinds, "load", { nameOptional: true }, (value) => {
            loadKubernetesCore(null, value);
        });
    }
}
function loadKubernetesCore(namespace, value) {
    const outputFormat = config.getOutputFormat();
    const uri = kuberesources_virtualfs_1.kubefsUri(namespace, value, outputFormat);
    vscode.workspace.openTextDocument(uri).then((doc) => {
        if (doc) {
            vscode.window.showTextDocument(doc);
        }
    }, (err) => vscode.window.showErrorMessage(`Error loading document: ${err}`));
}
function exposeKubernetes() {
    findKindNameOrPrompt(kuberesources.exposableKinds, 'expose', { nameOptional: false }, (kindName) => {
        if (!kindName) {
            vscode.window.showErrorMessage('couldn\'t find a relevant type to expose.');
            return;
        }
        let cmd = `expose ${kindName}`;
        const ports = getPorts();
        if (ports && ports.length > 0) {
            cmd += ' --port=' + ports[0];
        }
        kubectl.invokeWithProgress(cmd, "Kubernetes Exposing...");
    });
}
function getKubernetes(explorerNode) {
    if (explorerNode) {
        const resourceNode = explorerNode;
        const id = resourceNode.resourceId || resourceNode.id;
        const nsarg = resourceNode.namespace ? `--namespace ${resourceNode.namespace}` : '';
        kubectl.invokeInSharedTerminal(`get ${id} ${nsarg} -o wide`);
    }
    else {
        findKindNameOrPrompt(kuberesources.commonKinds, 'get', { nameOptional: true }, (value) => {
            kubectl.invokeInSharedTerminal(` get ${value} -o wide`);
        });
    }
}
function findVersion() {
    return {
        then: findVersionInternal
    };
}
function findVersionInternal(fn) {
    // No .git dir, use 'latest'
    // TODO: use 'git rev-parse' to detect upstream directories
    if (!fs_1.fs.existsSync(path.join(vscode.workspace.rootPath, '.git'))) {
        fn('latest');
        return;
    }
    shell_1.shell.execCore('git describe --always --dirty', shell_1.shell.execOpts()).then(({ code, stdout, stderr }) => {
        if (code !== 0) {
            vscode.window.showErrorMessage('git log returned: ' + code);
            console.log(stderr);
            fn('error');
            return;
        }
        fn(stdout);
    }, (err) => {
        fn('error');
        vscode.window.showErrorMessage(`git describe failed: ${err}`);
    });
}
function findAllPods() {
    return __awaiter(this, void 0, void 0, function* () {
        return yield findPodsCore('');
    });
}
exports.findAllPods = findAllPods;
function findPodsByLabel(labelQuery) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield findPodsCore(`-l ${labelQuery}`);
    });
}
function findPodsCore(findPodCmdOptions) {
    return __awaiter(this, void 0, void 0, function* () {
        const podList = yield kubectl.asJson(` get pods -o json ${findPodCmdOptions}`);
        if (errorable_1.failed(podList)) {
            vscode.window.showErrorMessage('Kubectl command failed: ' + podList.error[0]);
            return { succeeded: false, pods: [] };
        }
        try {
            return { succeeded: true, pods: podList.result.items };
        }
        catch (ex) {
            console.log(ex);
            vscode.window.showErrorMessage('unexpected error: ' + ex);
            return { succeeded: false, pods: [] };
        }
    });
}
function findPodsForApp() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!vscode.workspace.rootPath) {
            return { succeeded: true, pods: [] };
        }
        const appName = path.basename(vscode.workspace.rootPath);
        return yield findPodsByLabel(`run=${appName}`);
    });
}
function findDebugPodsForApp() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!vscode.workspace.rootPath) {
            return { succeeded: true, pods: [] };
        }
        const appName = path.basename(vscode.workspace.rootPath);
        return yield findPodsByLabel(`run=${appName}-debug`);
    });
}
function findNameAndImage() {
    return {
        then: _findNameAndImageInternal
    };
}
function _findNameAndImageInternal(fn) {
    if (vscode.workspace.rootPath === undefined) {
        vscode.window.showErrorMessage('This command requires an open folder.');
        return;
    }
    const folderName = path.basename(vscode.workspace.rootPath);
    const name = docker.sanitiseTag(folderName);
    findVersion().then((version) => {
        let image = `${name}:${version}`;
        const user = vscode.workspace.getConfiguration().get("vsdocker.imageUser", null);
        if (user) {
            image = `${user}/${image}`;
        }
        fn(name.trim(), image.trim());
    });
}
function scaleKubernetes() {
    findKindNameOrPrompt(kuberesources.scaleableKinds, 'scale', {}, (kindName) => {
        promptScaleKubernetes(kindName);
    });
}
function promptScaleKubernetes(kindName) {
    vscode.window.showInputBox({ prompt: `How many replicas would you like to scale ${kindName} to?` }).then((value) => {
        if (value) {
            const replicas = parseFloat(value);
            if (Number.isInteger(replicas) && replicas >= 0) {
                invokeScaleKubernetes(kindName, replicas);
            }
            else {
                vscode.window.showErrorMessage('Replica count must be a non-negative integer');
            }
        }
    }, (err) => vscode.window.showErrorMessage(`Error getting scale input: ${err}`));
}
function invokeScaleKubernetes(kindName, replicas) {
    kubectl.invokeWithProgress(`scale --replicas=${replicas} ${kindName}`, "Kubernetes Scaling...");
}
function runKubernetes() {
    buildPushThenExec((name, image) => {
        kubectl.invokeWithProgress(`run ${name} --image=${image}`, "Creating a Deployment...");
    });
}
function diagnosePushError(exitCode, error) {
    if (error.includes("denied")) {
        const user = vscode.workspace.getConfiguration().get("vsdocker.imageUser", null);
        if (user) {
            return "Failed to push to Docker Hub. Try running docker login.";
        }
        else {
            return "Failed to push to Docker Hub. Try setting vsdocker.imageUser.";
        }
    }
    return 'Image push failed.';
}
function buildPushThenExec(fn) {
    findNameAndImage().then((name, image) => {
        vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, (p) => __awaiter(this, void 0, void 0, function* () {
            p.report({ message: "Docker Building..." });
            const buildResult = yield shell_1.shell.exec(`docker build -t ${image} .`);
            if (buildResult.code === 0) {
                vscode.window.showInformationMessage(image + ' built.');
                p.report({ message: "Docker Pushing..." });
                const pushResult = yield shell_1.shell.exec('docker push ' + image);
                if (pushResult.code === 0) {
                    vscode.window.showInformationMessage(image + ' pushed.');
                    fn(name, image);
                }
                else {
                    const diagnostic = diagnosePushError(pushResult.code, pushResult.stderr);
                    vscode.window.showErrorMessage(`${diagnostic} See Output window for docker push error message.`);
                    kubeChannel_1.kubeChannel.showOutput(pushResult.stderr, 'Docker');
                }
            }
            else {
                vscode.window.showErrorMessage('Image build failed. See Output window for details.');
                kubeChannel_1.kubeChannel.showOutput(buildResult.stderr, 'Docker');
                console.log(buildResult.stderr);
            }
        }));
    });
}
function tryFindKindNameFromEditor() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return { succeeded: false, error: ['No open editor'] }; // No open text editor
    }
    const text = editor.document.getText();
    return findKindNameForText(text);
}
exports.tryFindKindNameFromEditor = tryFindKindNameFromEditor;
function findKindNameForText(text) {
    const kindNames = findKindNamesForText(text);
    if (!errorable_1.succeeded(kindNames)) {
        return { succeeded: false, error: kindNames.error };
    }
    if (kindNames.result.length > 1) {
        return { succeeded: false, error: ['the open document contains multiple Kubernetes resources'] };
    }
    return { succeeded: true, result: kindNames.result[0] };
}
function findKindNamesForText(text) {
    try {
        const objs = yaml.safeLoadAll(text);
        if (objs.some((o) => !kuberesources_objectmodel_1.isKubernetesResource(o))) {
            if (objs.length === 1) {
                return { succeeded: false, error: ['the open document is not a Kubernetes resource'] };
            }
            return { succeeded: false, error: ['the open document contains an item which is not a Kubernetes resource'] };
        }
        const kindNames = objs
            .map((o) => o)
            .map((obj) => ({
            kind: obj.kind.toLowerCase(),
            resourceName: obj.metadata.name,
            namespace: obj.metadata.namespace
        }));
        return { succeeded: true, result: kindNames };
    }
    catch (ex) {
        console.log(ex);
        return { succeeded: false, error: [ex] };
    }
}
function findKindNameOrPrompt(resourceKinds, descriptionVerb, opts, handler) {
    const kindObject = tryFindKindNameFromEditor();
    if (errorable_1.failed(kindObject)) {
        promptKindName(resourceKinds, descriptionVerb, opts, handler);
    }
    else {
        handler(`${kindObject.result.kind}/${kindObject.result.resourceName}`);
    }
}
exports.findKindNameOrPrompt = findKindNameOrPrompt;
function promptKindName(resourceKinds, descriptionVerb, opts, handler) {
    let placeHolder = 'Empty string to be prompted';
    let prompt = `What resource do you want to ${descriptionVerb}?`;
    if (opts) {
        placeHolder = opts.placeHolder || placeHolder;
        prompt = opts.prompt || prompt;
    }
    vscode.window.showInputBox({ prompt, placeHolder }).then((resource) => {
        if (resource === '') {
            quickPickKindName(resourceKinds, opts, handler);
        }
        else if (resource === undefined) {
            return;
        }
        else {
            handler(resource);
        }
    }, (err) => vscode.window.showErrorMessage(`Error getting kind input: ${err}`));
}
exports.promptKindName = promptKindName;
function quickPickKindName(resourceKinds, opts, handler) {
    if (resourceKinds.length === 1) {
        quickPickKindNameFromKind(resourceKinds[0], opts, handler);
        return;
    }
    vscode.window.showQuickPick(resourceKinds).then((resourceKind) => {
        if (resourceKind) {
            quickPickKindNameFromKind(resourceKind, opts, handler);
        }
    }, (err) => vscode.window.showErrorMessage(`Error picking resource kind: ${err}`));
}
exports.quickPickKindName = quickPickKindName;
function quickPickKindNameFromKind(resourceKind, opts, handler) {
    const kind = resourceKind.abbreviation;
    kubectl.invoke("get " + kind, (code, stdout, stderr) => {
        if (code !== 0) {
            vscode.window.showErrorMessage(stderr);
            return;
        }
        let names = parseNamesFromKubectlLines(stdout);
        if (names.length === 0) {
            vscode.window.showInformationMessage(`No resources of type ${resourceKind.displayName} in cluster`);
            return;
        }
        if (opts) {
            names = lodash_1.pullAll(names, opts.filterNames) || names;
        }
        if (opts && opts.nameOptional) {
            names.push('(all)');
            vscode.window.showQuickPick(names).then((name) => {
                if (name) {
                    let kindName;
                    if (name === '(all)') {
                        kindName = kind;
                    }
                    else {
                        kindName = `${kind}/${name}`;
                    }
                    handler(kindName);
                }
            }),
                (err) => vscode.window.showErrorMessage(`Error picking name: ${err}`);
        }
        else {
            vscode.window.showQuickPick(names).then((name) => {
                if (name) {
                    const kindName = `${kind}/${name}`;
                    handler(kindName);
                }
            }, (err) => vscode.window.showErrorMessage(`Error picking name: ${err}`));
        }
    });
}
function containsName(kindName) {
    if (kindName) {
        return kindName.indexOf('/') > 0;
    }
    return false;
}
function parseNamesFromKubectlLines(text) {
    const lines = text.split('\n');
    lines.shift();
    const names = lines.filter((line) => {
        return line.length > 0;
    }).map((line) => {
        return parseName(line);
    });
    return names;
}
function parseName(line) {
    return line.split(' ')[0];
}
function getContainers(pod) {
    return __awaiter(this, void 0, void 0, function* () {
        const q = shell_1.shell.isWindows() ? `'` : `"`;
        const lit = (l) => `{${q}${l}${q}}`;
        const query = `${lit("NAME\\tIMAGE\\n")}{range .spec.containers[*]}{.name}${lit("\\t")}{.image}${lit("\\n")}{end}`;
        const queryArg = shell_1.shell.isWindows() ? `"${query}"` : `'${query}'`;
        let cmd = `get pod/${pod.name} -o jsonpath=${queryArg}`;
        if (pod.namespace && pod.namespace.length > 0) {
            cmd += ' --namespace=' + pod.namespace;
        }
        const containers = yield kubectl.asLines(cmd);
        if (errorable_1.failed(containers)) {
            vscode.window.showErrorMessage("Failed to get containers in pod: " + containers.error[0]);
            return undefined;
        }
        const containersEx = containers.result.map((s) => {
            const bits = s.split('\t');
            return { name: bits[0], image: bits[1] };
        });
        return containersEx;
    });
}
var PodSelectionFallback;
(function (PodSelectionFallback) {
    PodSelectionFallback[PodSelectionFallback["None"] = 0] = "None";
    PodSelectionFallback[PodSelectionFallback["AnyPod"] = 1] = "AnyPod";
})(PodSelectionFallback || (PodSelectionFallback = {}));
var PodSelectionScope;
(function (PodSelectionScope) {
    PodSelectionScope[PodSelectionScope["App"] = 0] = "App";
    PodSelectionScope[PodSelectionScope["All"] = 1] = "All";
})(PodSelectionScope || (PodSelectionScope = {}));
function selectPod(scope, fallback) {
    return __awaiter(this, void 0, void 0, function* () {
        const findPodsResult = scope === PodSelectionScope.App ? yield findPodsForApp() : yield findAllPods();
        if (!findPodsResult.succeeded) {
            return null;
        }
        const podList = findPodsResult.pods;
        if (podList.length === 0) {
            if (fallback === PodSelectionFallback.AnyPod) {
                return selectPod(PodSelectionScope.All, PodSelectionFallback.None);
            }
            const scopeMessage = scope === PodSelectionScope.App ? "associated with this app" : "in the cluster";
            vscode.window.showErrorMessage(`Couldn't find any pods ${scopeMessage}.`);
            return null;
        }
        if (podList.length === 1) {
            return podList[0];
        }
        const pickItems = podList.map((element) => {
            return {
                label: `${element.metadata.namespace || "default"}/${element.metadata.name}`,
                description: '',
                pod: element
            };
        });
        const value = yield vscode.window.showQuickPick(pickItems);
        if (!value) {
            return null;
        }
        return value.pod;
    });
}
function getPorts() {
    const file = vscode.workspace.rootPath + '/Dockerfile';
    if (!fs_1.fs.existsSync(file)) {
        return null;
    }
    try {
        const data = fs_1.fs.readFileSync(file, 'utf-8');
        const obj = dockerfileParse(data);
        return obj.expose;
    }
    catch (ex) {
        console.log(ex);
        return null;
    }
}
function describeKubernetes(explorerNode) {
    return __awaiter(this, void 0, void 0, function* () {
        if (explorerNode) {
            const nsarg = explorerNode.namespace ? `--namespace ${explorerNode.namespace}` : '';
            const result = yield kubectl.invokeAsync(`describe ${explorerNode.resourceId} ${nsarg}`);
            describeWebview_1.DescribePanel.createOrShow(result.stdout, explorerNode.resourceId);
        }
        else {
            findKindNameOrPrompt(kuberesources.commonKinds, 'describe', { nameOptional: true }, (value) => __awaiter(this, void 0, void 0, function* () {
                const result = yield kubectl.invokeAsync(`describe ${value}`);
                describeWebview_1.DescribePanel.createOrShow(result.stdout, value);
            }));
        }
    });
}
function summary(pod) {
    return {
        name: pod.metadata.name,
        namespace: pod.metadata.namespace,
        spec: pod.spec
    };
}
function selectContainerForPod(pod) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!pod) {
            return null;
        }
        const containers = (pod.spec && pod.spec.containers) ? pod.spec.containers : yield getContainers(pod);
        if (!containers) {
            return null;
        }
        if (containers.length === 1) {
            return containers[0];
        }
        const pickItems = containers.map((element) => {
            return {
                label: element.name,
                description: '',
                detail: element.image,
                container: element
            };
        });
        const value = yield vscode.window.showQuickPick(pickItems, { placeHolder: "Select container" });
        if (!value) {
            return null;
        }
        return value.container;
    });
}
exports.selectContainerForPod = selectContainerForPod;
function execKubernetes() {
    execKubernetesCore(false);
}
function terminalKubernetes(explorerNode) {
    return __awaiter(this, void 0, void 0, function* () {
        if (explorerNode) {
            const namespace = explorerNode.namespace;
            const podSummary = { name: explorerNode.id, namespace: namespace };
            const container = yield selectContainerForPod(podSummary);
            if (container) {
                // For those images (e.g. built from Busybox) where bash may not be installed by default, use sh instead.
                const suggestedShell = yield suggestedShellForContainer(podSummary.name, podSummary.namespace, container.name);
                execTerminalOnContainer(podSummary.name, podSummary.namespace, container.name, suggestedShell);
            }
        }
        else {
            execKubernetesCore(true);
        }
    });
}
function execKubernetesCore(isTerminal) {
    return __awaiter(this, void 0, void 0, function* () {
        const opts = { prompt: 'Please provide a command to execute' };
        if (isTerminal) {
            opts.value = 'bash';
        }
        const cmd = yield vscode.window.showInputBox(opts);
        if (!cmd || cmd.length === 0) {
            return;
        }
        const pod = yield selectPod(PodSelectionScope.App, PodSelectionFallback.AnyPod);
        if (!pod || !pod.metadata) {
            return;
        }
        const container = yield selectContainerForPod(summary(pod));
        if (!container) {
            return;
        }
        if (isTerminal) {
            execTerminalOnContainer(pod.metadata.name, pod.metadata.namespace, container.name, cmd);
            return;
        }
        const execCmd = `exec ${pod.metadata.name} -c ${container.name} -- ${cmd}`;
        kubectl.invokeInSharedTerminal(execCmd);
    });
}
function execTerminalOnContainer(podName, podNamespace, containerName, terminalCmd) {
    const terminalExecCmd = ['exec', '-it', podName];
    if (podNamespace) {
        terminalExecCmd.push('--namespace', podNamespace);
    }
    if (containerName) {
        terminalExecCmd.push('--container', containerName);
    }
    terminalExecCmd.push('--', terminalCmd);
    const terminalName = `${terminalCmd} on ${podName}` + (containerName ? `/${containerName}` : '');
    kubectl.runAsTerminal(terminalExecCmd, terminalName);
}
function isBashOnContainer(podName, podNamespace, containerName) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield kubectl.invokeAsync(`exec ${podName} -c ${containerName} -- ls -la /bin/bash`);
        return !result.code;
    });
}
function suggestedShellForContainer(podName, podNamespace, containerName) {
    return __awaiter(this, void 0, void 0, function* () {
        if (yield isBashOnContainer(podName, podNamespace, containerName)) {
            return 'bash';
        }
        return 'sh';
    });
}
function syncKubernetes() {
    return __awaiter(this, void 0, void 0, function* () {
        const pod = yield selectPod(PodSelectionScope.App, PodSelectionFallback.None);
        if (!pod) {
            return;
        }
        const container = yield selectContainerForPod(summary(pod));
        if (!container) {
            return;
        }
        const pieces = container.image.split(':');
        if (pieces.length !== 2) {
            vscode.window.showErrorMessage(`Sync requires image tag to have a version which is a Git commit ID. Actual image tag was ${container.image}`);
            return;
        }
        const commitId = pieces[1];
        const whenCreated = yield git.whenCreated(commitId);
        const versionMessage = whenCreated ?
            `The Git commit deployed to the cluster is  ${commitId} (created ${whenCreated.trim()} ago). This will check out that commit.` :
            `The image version deployed to the cluster is ${commitId}. This will look for a Git commit with that name/ID and check it out.`;
        const choice = yield vscode.window.showInformationMessage(versionMessage, 'OK');
        if (choice === 'OK') {
            const checkoutResult = yield git.checkout(commitId);
            if (errorable_1.failed(checkoutResult)) {
                vscode.window.showErrorMessage(`Error checking out commit ${commitId}: ${checkoutResult.error[0]}`);
            }
        }
    });
}
function reportDeleteResult(resourceId, shellResult) {
    return __awaiter(this, void 0, void 0, function* () {
        if (shellResult.code !== 0) {
            yield vscode.window.showErrorMessage(`Failed to delete resource '${resourceId}': ${shellResult.stderr}`);
            return;
        }
        yield vscode.window.showInformationMessage(shellResult.stdout);
        explorer_1.refreshExplorer();
    });
}
function deleteKubernetes(delMode, explorerNode) {
    return __awaiter(this, void 0, void 0, function* () {
        const delModeArg = delMode === KubernetesDeleteMode.Now ? ' --now' : '';
        if (explorerNode) {
            const answer = yield vscode.window.showWarningMessage(`Do you want to delete the resource '${explorerNode.resourceId}'?`, ...exports.deleteMessageItems);
            if (answer.isCloseAffordance) {
                return;
            }
            const nsarg = explorerNode.namespace ? `--namespace ${explorerNode.namespace}` : '';
            const shellResult = yield kubectl.invokeAsyncWithProgress(`delete ${explorerNode.resourceId} ${nsarg} ${delModeArg}`, `Deleting ${explorerNode.resourceId}...`);
            yield reportDeleteResult(explorerNode.resourceId, shellResult);
        }
        else {
            promptKindName(kuberesources.commonKinds, 'delete', { nameOptional: true }, (kindName) => __awaiter(this, void 0, void 0, function* () {
                if (kindName) {
                    let commandArgs = kindName;
                    if (!containsName(kindName)) {
                        commandArgs = kindName + " --all";
                    }
                    const shellResult = yield kubectl.invokeAsyncWithProgress(`delete ${commandArgs} ${delModeArg}`, `Deleting ${kindName}...`);
                    yield reportDeleteResult(kindName, shellResult);
                }
            }));
        }
    });
}
var KubernetesDeleteMode;
(function (KubernetesDeleteMode) {
    KubernetesDeleteMode[KubernetesDeleteMode["Graceful"] = 0] = "Graceful";
    KubernetesDeleteMode[KubernetesDeleteMode["Now"] = 1] = "Now";
})(KubernetesDeleteMode || (KubernetesDeleteMode = {}));
var DiffResultKind;
(function (DiffResultKind) {
    DiffResultKind[DiffResultKind["Succeeded"] = 0] = "Succeeded";
    DiffResultKind[DiffResultKind["NoEditor"] = 1] = "NoEditor";
    DiffResultKind[DiffResultKind["NoKindName"] = 2] = "NoKindName";
    DiffResultKind[DiffResultKind["NoClusterResource"] = 3] = "NoClusterResource";
    DiffResultKind[DiffResultKind["GetFailed"] = 4] = "GetFailed";
    DiffResultKind[DiffResultKind["NothingToDiff"] = 5] = "NothingToDiff";
})(DiffResultKind || (DiffResultKind = {}));
function confirmOperation(prompt, message, confirmVerb, operation) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield prompt(message, confirmVerb);
        if (result === confirmVerb) {
            operation();
        }
    });
}
const applyKubernetes = () => {
    diffKubernetesCore((r) => {
        switch (r.result) {
            case DiffResultKind.Succeeded:
                confirmOperation(vscode.window.showInformationMessage, 'Do you wish to apply this change?', 'Apply', () => maybeRunKubernetesCommandForActiveWindow('apply', "Kubernetes Applying..."));
                return;
            case DiffResultKind.NoEditor:
                vscode.window.showErrorMessage("No active editor - the Apply command requires an open document");
                return;
            case DiffResultKind.NoKindName:
                confirmOperation(vscode.window.showWarningMessage, `Can't show what changes will be applied (${r.reason}). Apply anyway?`, 'Apply', () => maybeRunKubernetesCommandForActiveWindow('apply', "Kubernetes Applying..."));
                return;
            case DiffResultKind.NoClusterResource:
                confirmOperation(vscode.window.showWarningMessage, `Resource ${r.resourceName} does not exist - this will create a new resource.`, 'Create', () => maybeRunKubernetesCommandForActiveWindow('create', "Kubernetes Creating..."));
                return;
            case DiffResultKind.GetFailed:
                confirmOperation(vscode.window.showWarningMessage, `Can't show what changes will be applied - error getting existing resource (${r.stderr}). Apply anyway?`, 'Apply', () => maybeRunKubernetesCommandForActiveWindow('apply', "Kubernetes Applying..."));
                return;
            case DiffResultKind.NothingToDiff:
                vscode.window.showInformationMessage("Nothing to apply");
                return;
        }
    });
};
const handleError = (err) => {
    if (err) {
        vscode.window.showErrorMessage(err.message);
    }
};
function diffKubernetes() {
    diffKubernetesCore((r) => {
        switch (r.result) {
            case DiffResultKind.Succeeded:
                return;
            case DiffResultKind.NoEditor:
                vscode.window.showErrorMessage("No active editor - the Diff command requires an open document");
                return;
            case DiffResultKind.NoKindName:
                vscode.window.showErrorMessage(`Can't diff - ${r.reason}`);
                return;
            case DiffResultKind.NoClusterResource:
                vscode.window.showInformationMessage(`Can't diff - ${r.resourceName} doesn't exist in the cluster`);
                return;
            case DiffResultKind.GetFailed:
                vscode.window.showErrorMessage(`Can't diff - error getting existing resource: ${r.stderr}`);
                return;
            case DiffResultKind.NothingToDiff:
                vscode.window.showInformationMessage("Nothing to diff");
                return;
        }
    });
}
function diffKubernetesCore(callback) {
    getTextForActiveWindow((data, file) => {
        console.log(data, file);
        let kindName = null;
        let kindObject = undefined;
        let fileUri = null;
        let fileFormat = "json";
        if (data) {
            fileFormat = (data.trim().length > 0 && data.trim()[0] === '{') ? "json" : "yaml";
            kindObject = findKindNameForText(data);
            if (errorable_1.failed(kindObject)) {
                callback({ result: DiffResultKind.NoKindName, reason: kindObject.error[0] });
                return;
            }
            kindName = `${kindObject.result.kind}/${kindObject.result.resourceName}`;
            const filePath = path.join(os.tmpdir(), `local.${fileFormat}`);
            fs_1.fs.writeFile(filePath, data, handleError);
            fileUri = shell_1.shell.fileUri(filePath);
        }
        else if (file) {
            if (!vscode.window.activeTextEditor) {
                callback({ result: DiffResultKind.NoEditor });
                return; // No open text editor
            }
            kindObject = tryFindKindNameFromEditor();
            if (errorable_1.failed(kindObject)) {
                callback({ result: DiffResultKind.NoKindName, reason: kindObject.error[0] });
                return;
            }
            kindName = `${kindObject.result.kind}/${kindObject.result.resourceName}`;
            fileUri = file;
            if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document) {
                const langId = vscode.window.activeTextEditor.document.languageId.toLowerCase();
                if (langId === "yaml" || langId === "helm") {
                    fileFormat = "yaml";
                }
            }
        }
        else {
            callback({ result: DiffResultKind.NothingToDiff });
            return;
        }
        if (!kindName) {
            callback({ result: DiffResultKind.NoKindName, reason: 'Could not find a valid API object' });
            return;
        }
        kubectl.invoke(` get -o ${fileFormat} ${kindName}`, (result, stdout, stderr) => {
            if (result === 1 && stderr.indexOf('NotFound') >= 0) {
                callback({ result: DiffResultKind.NoClusterResource, resourceName: kindName });
                return;
            }
            else if (result !== 0) {
                callback({ result: DiffResultKind.GetFailed, stderr: stderr });
                return;
            }
            const serverFile = path.join(os.tmpdir(), `server.${fileFormat}`);
            fs_1.fs.writeFile(serverFile, stdout, handleError);
            vscode.commands.executeCommand('vscode.diff', shell_1.shell.fileUri(serverFile), fileUri).then((result) => {
                console.log(result);
                callback({ result: DiffResultKind.Succeeded });
            }, (err) => vscode.window.showErrorMessage(`Error running command: ${err}`));
        });
    });
}
const debugKubernetes = () => __awaiter(this, void 0, void 0, function* () {
    const workspaceFolder = yield hostutils_1.showWorkspaceFolderPick();
    if (workspaceFolder) {
        const legacySupportedDebuggers = ["node"]; // legacy code support node debugging.
        const providerSupportedDebuggers = providerRegistry_1.getSupportedDebuggerTypes();
        const supportedDebuggers = providerSupportedDebuggers.concat(legacySupportedDebuggers);
        const debuggerType = yield vscode.window.showQuickPick(supportedDebuggers, {
            placeHolder: "Select the environment"
        });
        if (!debuggerType) {
            return;
        }
        const debugProvider = providerRegistry_1.getDebugProviderOfType(debuggerType);
        if (debugProvider) {
            new debugSession_1.DebugSession(kubectl).launch(workspaceFolder, debugProvider);
        }
        else {
            buildPushThenExec(debugInternal);
        }
    }
});
const debugAttachKubernetes = (explorerNode) => __awaiter(this, void 0, void 0, function* () {
    const workspaceFolder = yield hostutils_1.showWorkspaceFolderPick();
    if (workspaceFolder) {
        new debugSession_1.DebugSession(kubectl).attach(workspaceFolder, explorerNode ? explorerNode.id : null, explorerNode ? explorerNode.namespace : undefined);
    }
});
const debugInternal = (name, image) => {
    // TODO: optionalize/customize the '-debug'
    // TODO: make this smarter.
    vscode.window.showInputBox({
        prompt: 'Debug command for your container:',
        placeHolder: 'Example: node debug server.js'
    }).then((cmd) => {
        if (!cmd) {
            return;
        }
        doDebug(name, image, cmd);
    }, (err) => vscode.window.showErrorMessage(`Error getting input: ${err}`));
};
const doDebug = (name, image, cmd) => __awaiter(this, void 0, void 0, function* () {
    const deploymentName = `${name}-debug`;
    const runCmd = `run ${deploymentName} --image=${image} -i --attach=false -- ${cmd}`;
    console.log(runCmd);
    const sr = yield kubectl.invokeAsync(runCmd);
    if (sr.code !== 0) {
        vscode.window.showErrorMessage('Failed to start debug container: ' + sr.stderr);
        return;
    }
    const findPodsResult = yield findDebugPodsForApp();
    if (!findPodsResult.succeeded) {
        return;
    }
    const podList = findPodsResult.pods;
    if (podList.length === 0) {
        vscode.window.showErrorMessage('Failed to find debug pod.');
        return;
    }
    const podName = podList[0].metadata.name;
    vscode.window.showInformationMessage('Debug pod running as: ' + podName);
    waitForRunningPod(podName, () => {
        kubectl.invoke(` port-forward ${podName} 5858:5858 8000:8000`);
        const debugConfiguration = {
            type: 'node',
            request: 'attach',
            name: 'Attach to Process',
            port: 5858,
            localRoot: vscode.workspace.rootPath,
            remoteRoot: '/'
        };
        vscode.debug.startDebugging(undefined, debugConfiguration).then(() => {
            vscode.window.showInformationMessage('Debug session established', 'Expose Service').then((opt) => {
                if (opt !== 'Expose Service') {
                    return;
                }
                vscode.window.showInputBox({ prompt: 'Expose on which port?', placeHolder: '80' }).then((port) => {
                    if (!port) {
                        return;
                    }
                    const exposeCmd = `expose deployment ${deploymentName} --type=LoadBalancer --port=${port}`;
                    kubectl.invoke(exposeCmd, (result, stdout, stderr) => {
                        if (result !== 0) {
                            vscode.window.showErrorMessage('Failed to expose deployment: ' + stderr);
                            return;
                        }
                        vscode.window.showInformationMessage(`Deployment exposed. Run Kubernetes Get > service ${deploymentName} for IP address`);
                    });
                });
            }, (err) => vscode.window.showErrorMessage(`Error getting port info: ${err}`));
        }, (err) => vscode.window.showErrorMessage(`Error getting expose info: ${err.message}`));
    });
});
const waitForRunningPod = (name, callback) => {
    kubectl.invoke(` get pods ${name} -o jsonpath --template="{.status.phase}"`, (result, stdout, stderr) => {
        if (result !== 0) {
            vscode.window.showErrorMessage(`Failed to run command (${result}) ${stderr}`);
            return;
        }
        if (stdout === 'Running') {
            callback();
            return;
        }
        setTimeout(() => waitForRunningPod(name, callback), 1000);
    });
};
function exists(kind, name, handler) {
    kubectl.invoke(`get ${kind} ${name}`, (result) => {
        handler(result === 0);
    });
}
function deploymentExists(deploymentName, handler) {
    exists('deployments', deploymentName, handler);
}
function serviceExists(serviceName, handler) {
    exists('services', serviceName, handler);
}
function removeDebugKubernetes() {
    findNameAndImage().then((name, image) => {
        const deploymentName = name + '-debug';
        deploymentExists(deploymentName, (deployment) => {
            serviceExists(deploymentName, (service) => {
                if (!deployment && !service) {
                    vscode.window.showInformationMessage(deploymentName + ': nothing to clean up');
                    return;
                }
                const toDelete = deployment ? ('deployment' + (service ? ' and service' : '')) : 'service';
                vscode.window.showWarningMessage(`This will delete ${toDelete} ${deploymentName}`, 'Delete').then((opt) => {
                    if (opt !== 'Delete') {
                        return;
                    }
                    if (service) {
                        kubectl.invoke('delete service ' + deploymentName);
                    }
                    if (deployment) {
                        kubectl.invoke('delete deployment ' + deploymentName);
                    }
                }, (err) => vscode.window.showErrorMessage(`Error getting confirmation of delete: ${err}`));
            });
        });
    });
}
function configureFromClusterKubernetes() {
    return __awaiter(this, void 0, void 0, function* () {
        clusterproviderserver_1.runClusterWizard('Add Existing Cluster', 'configure');
    });
}
function createClusterKubernetes() {
    return __awaiter(this, void 0, void 0, function* () {
        clusterproviderserver_1.runClusterWizard('Create Kubernetes Cluster', 'create');
    });
}
const ADD_NEW_KUBECONFIG_PICK = "+ Add new kubeconfig";
function useKubeconfigKubernetes(kubeconfig) {
    return __awaiter(this, void 0, void 0, function* () {
        const kc = yield getKubeconfigSelection(kubeconfig);
        if (!kc) {
            return;
        }
        yield config_1.setActiveKubeconfig(kc);
        telemetry.invalidateClusterType(undefined, kubectl);
    });
}
function getKubeconfigSelection(kubeconfig) {
    return __awaiter(this, void 0, void 0, function* () {
        if (kubeconfig) {
            return kubeconfig;
        }
        const knownKubeconfigs = config_1.getKnownKubeconfigs();
        const picks = [ADD_NEW_KUBECONFIG_PICK, ...knownKubeconfigs];
        const pick = yield vscode.window.showQuickPick(picks);
        if (pick === ADD_NEW_KUBECONFIG_PICK) {
            const kubeconfigUris = yield vscode.window.showOpenDialog({});
            if (kubeconfigUris && kubeconfigUris.length === 1) {
                const kubeconfigPath = kubeconfigUris[0].fsPath;
                yield config_1.addKnownKubeconfig(kubeconfigPath);
                return kubeconfigPath;
            }
            return undefined;
        }
        return pick;
    });
}
function useContextKubernetes(explorerNode) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!explorerNode || !explorerNode.metadata) {
            return;
        }
        const contextObj = explorerNode.metadata;
        const targetContext = contextObj.contextName;
        const shellResult = yield kubectl.invokeAsync(`config use-context ${targetContext}`);
        if (shellResult.code === 0) {
            telemetry.invalidateClusterType(targetContext);
            explorer_1.refreshExplorer();
        }
        else {
            vscode.window.showErrorMessage(`Failed to set '${targetContext}' as current cluster: ${shellResult.stderr}`);
        }
    });
}
function clusterInfoKubernetes(explorerNode) {
    return __awaiter(this, void 0, void 0, function* () {
        kubectl.invokeInSharedTerminal("cluster-info");
    });
}
function deleteContextKubernetes(explorerNode) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!explorerNode || !explorerNode.metadata) {
            return;
        }
        const contextObj = explorerNode.metadata;
        const answer = yield vscode.window.showWarningMessage(`Do you want to delete the cluster '${contextObj.contextName}' from the kubeconfig?`, ...exports.deleteMessageItems);
        if (answer.isCloseAffordance) {
            return;
        }
        if (yield kubectlUtils.deleteCluster(kubectl, contextObj)) {
            explorer_1.refreshExplorer();
        }
    });
}
function copyKubernetes(explorerNode) {
    clipboard.writeSync(explorerNode.id);
}
// TODO: having to export this is untidy - unpick dependencies and move
function installDependencies() {
    return __awaiter(this, void 0, void 0, function* () {
        // TODO: gosh our binchecking is untidy
        const gotKubectl = yield kubectl.checkPresent(kubectl_1.CheckPresentMessageMode.Silent);
        const gotHelm = helmexec.ensureHelm(helmexec.EnsureMode.Silent);
        const gotDraft = yield draft.checkPresent(draft_1.CheckPresentMode.Silent);
        const gotMinikube = yield minikube.checkPresent(minikube_1.CheckPresentMode.Silent);
        const installPromises = [
            installDependency("kubectl", gotKubectl, installer_1.installKubectl),
            installDependency("Helm", gotHelm, installer_1.installHelm),
            installDependency("Draft", gotDraft, installer_1.installDraft),
        ];
        if (!config.getUseWsl()) {
            // TODO: Install Win32 Minikube
            installPromises.push(installDependency("Minikube", gotMinikube, (shell) => {
                return installer_1.installMinikube(shell, null);
            }));
        }
        yield Promise.all(installPromises);
        kubeChannel_1.kubeChannel.showOutput("Done");
    });
}
exports.installDependencies = installDependencies;
function installDependency(name, alreadyGot, installFunc) {
    return __awaiter(this, void 0, void 0, function* () {
        if (alreadyGot) {
            kubeChannel_1.kubeChannel.showOutput(`Already got ${name}...`);
        }
        else {
            kubeChannel_1.kubeChannel.showOutput(`Installing ${name}...`);
            const result = yield installFunc(shell_1.shell);
            if (errorable_1.failed(result)) {
                kubeChannel_1.kubeChannel.showOutput(`Unable to install ${name}: ${result.error[0]}`);
            }
        }
    });
}
function execDraftVersion() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(yield draft.checkPresent(draft_1.CheckPresentMode.Alert))) {
            return;
        }
        const dvResult = yield draft.version();
        if (errorable_1.succeeded(dvResult)) {
            host_1.host.showInformationMessage(dvResult.result);
        }
        else if (dvResult.error[0]) {
            host_1.host.showErrorMessage(dvResult.error[0]);
        }
    });
}
function execDraftCreate() {
    return __awaiter(this, void 0, void 0, function* () {
        if (vscode.workspace.rootPath === undefined) {
            vscode.window.showErrorMessage('This command requires an open folder.');
            return;
        }
        if (draft.isFolderMapped(vscode.workspace.rootPath)) {
            vscode.window.showInformationMessage('This folder is already configured for draft. Run draft up to deploy.');
            return;
        }
        if (!(yield draft.checkPresent(draft_1.CheckPresentMode.Alert))) {
            return;
        }
        const proposedAppName = path.basename(vscode.workspace.rootPath);
        const appName = yield vscode.window.showInputBox({ value: proposedAppName, prompt: "Choose a name for the Helm release" });
        if (appName) {
            yield execDraftCreateApp(appName, undefined);
        }
    });
}
var DraftCreateResult;
(function (DraftCreateResult) {
    DraftCreateResult[DraftCreateResult["Succeeded"] = 0] = "Succeeded";
    DraftCreateResult[DraftCreateResult["Fatal"] = 1] = "Fatal";
    DraftCreateResult[DraftCreateResult["NeedsPack"] = 2] = "NeedsPack";
})(DraftCreateResult || (DraftCreateResult = {}));
function execDraftCreateApp(appName, pack) {
    return __awaiter(this, void 0, void 0, function* () {
        const packOpt = pack ? ` -p ${pack}` : '';
        const dcResult = yield draft.create(appName, pack, vscode.workspace.rootPath);
        switch (draftCreateResult(dcResult, !!pack)) {
            case DraftCreateResult.Succeeded:
                host_1.host.showInformationMessage("draft " + dcResult.stdout);
                return;
            case DraftCreateResult.Fatal:
                host_1.host.showErrorMessage(`draft failed: ${dcResult.stderr}`);
                return;
            case DraftCreateResult.NeedsPack:
                const packs = yield draft.packs();
                if (packs && packs.length > 0) {
                    const packSel = yield host_1.host.showQuickPick(packs, { placeHolder: `Choose the Draft starter pack for ${appName}` });
                    if (packSel) {
                        yield execDraftCreateApp(appName, packSel);
                    }
                }
                else {
                    host_1.host.showErrorMessage("Unable to determine starter pack, and no starter packs found to choose from.");
                }
                return;
        }
    });
}
function draftCreateResult(sr, hadPack) {
    if (sr.code === 0) {
        return DraftCreateResult.Succeeded;
    }
    if (!hadPack && draftErrorMightBeSolvedByChoosingPack(sr.stderr)) {
        return DraftCreateResult.NeedsPack;
    }
    return DraftCreateResult.Fatal;
}
function draftErrorMightBeSolvedByChoosingPack(draftError) {
    return draftError.indexOf('Unable to select a starter pack') >= 0
        || draftError.indexOf('Error: no languages were detected') >= 0;
}
function execDraftUp() {
    return __awaiter(this, void 0, void 0, function* () {
        if (vscode.workspace.rootPath === undefined) {
            vscode.window.showErrorMessage('This command requires an open folder.');
            return;
        }
        if (!draft.isFolderMapped(vscode.workspace.rootPath)) {
            vscode.window.showInformationMessage('This folder is not configured for draft. Run draft create to configure it.');
            return;
        }
        yield draft.up();
    });
}
function editorIsActive() {
    // force type coercion
    return (vscode.window.activeTextEditor) ? true : false;
}
function helmConvertToTemplate(arg) {
    return __awaiter(this, void 0, void 0, function* () {
        const workspace = yield hostutils_1.showWorkspaceFolderPick();
        if (!workspace) {
            return;
        }
        helmauthoring.convertToTemplate(fs_1.fs, host_1.host, workspace.uri.fsPath, arg);
    });
}
function helmParameterise() {
    return __awaiter(this, void 0, void 0, function* () {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            return;
        }
        const document = activeEditor.document;
        if (!document) {
            return;
        }
        const selection = activeEditor.selection;
        if (!selection) {
            return;
        }
        const convertResult = yield helmauthoring.convertToParameter(fs_1.fs, host_1.host, document, selection);
        if (errorable_1.succeeded(convertResult)) {
            const editor = yield vscode.window.showTextDocument(convertResult.result.document);
            const edit = convertResult.result.edit;
            editor.revealRange(edit.range);
            editor.selection = new vscode.Selection(edit.range.start, edit.range.end); // TODO: this isn't quite right because it gives us the insert-at selection not the resultant edit
        }
        else {
            vscode.window.showErrorMessage(convertResult.error[0]);
        }
    });
}
function isLintable(document) {
    return document.languageId === 'yaml' || document.languageId === 'json' || document.languageId === 'helm';
}
function linterDisabled(disabledLinters, name) {
    return (disabledLinters || []).some((l) => l === name);
}
function kubernetesLint(document) {
    return __awaiter(this, void 0, void 0, function* () {
        if (config.getDisableLint()) {
            return;
        }
        // Is it a Kubernetes document?
        if (!isLintable(document)) {
            return;
        }
        const disabledLinters = config.getDisabledLinters();
        const linterPromises = linters_1.linters
            .filter((l) => !linterDisabled(disabledLinters, l.name()))
            .map((l) => l.lint(document));
        const linterResults = yield Promise.all(linterPromises);
        const diagnostics = [].concat(...linterResults);
        kubernetesDiagnostics.set(document.uri, diagnostics);
    });
}
//# sourceMappingURL=extension.js.map
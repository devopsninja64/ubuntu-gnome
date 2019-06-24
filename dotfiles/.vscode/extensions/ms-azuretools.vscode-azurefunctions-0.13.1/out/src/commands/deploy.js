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
const fse = require("fs-extra");
// tslint:disable-next-line:no-require-imports
const opn = require("opn");
const os = require("os");
const path = require("path");
const vscode = require("vscode");
const appservice = require("vscode-azureappservice");
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const constants_1 = require("../constants");
const errors_1 = require("../errors");
const extensionVariables_1 = require("../extensionVariables");
const getLocalFuncCoreToolsVersion_1 = require("../funcCoreTools/getLocalFuncCoreToolsVersion");
const FunctionConfig_1 = require("../FunctionConfig");
const localize_1 = require("../localize");
const ProjectSettings_1 = require("../ProjectSettings");
const FunctionsTreeItem_1 = require("../tree/FunctionsTreeItem");
const FunctionTreeItem_1 = require("../tree/FunctionTreeItem");
const ProductionSlotTreeItem_1 = require("../tree/ProductionSlotTreeItem");
const fs_1 = require("../utils/fs");
const getCliFeedJson_1 = require("../utils/getCliFeedJson");
const mavenUtils_1 = require("../utils/mavenUtils");
const workspaceUtil = require("../utils/workspace");
const startStreamingLogs_1 = require("./logstream/startStreamingLogs");
// tslint:disable-next-line:max-func-body-length
function deploy(target, functionAppId) {
    return __awaiter(this, void 0, void 0, function* () {
        getLocalFuncCoreToolsVersion_1.addLocalFuncTelemetry(this);
        const telemetryProperties = this.properties;
        let deployFsPath;
        const newNodes = [];
        let node;
        if (target instanceof vscode.Uri) {
            deployFsPath = yield appendDeploySubpathSetting(target.fsPath);
        }
        else if (typeof target === 'string') {
            deployFsPath = yield appendDeploySubpathSetting(target);
        }
        else {
            deployFsPath = yield getDeployFsPath();
            node = target;
        }
        const folderOpenWarning = localize_1.localize('folderOpenWarning', 'Failed to deploy because the folder is not open in a workspace. Open in a workspace and try again.');
        const workspaceFsPath = yield workspaceUtil.ensureFolderIsOpen(deployFsPath, this, folderOpenWarning, true /* allowSubFolder */);
        const onNodeCreatedFromQuickPickDisposable = extensionVariables_1.ext.tree.onTreeItemCreate((newNode) => {
            // event is fired from azure-extensionui if node was created during deployment
            newNodes.push(newNode);
        });
        try {
            if (!node) {
                if (!functionAppId || typeof functionAppId !== 'string') {
                    node = (yield extensionVariables_1.ext.tree.showTreeItemPicker(ProductionSlotTreeItem_1.ProductionSlotTreeItem.contextValue));
                }
                else {
                    const functionAppNode = yield extensionVariables_1.ext.tree.findTreeItem(functionAppId);
                    if (functionAppNode) {
                        node = functionAppNode;
                    }
                    else {
                        throw new Error(localize_1.localize('noMatchingFunctionApp', 'Failed to find a function app matching id "{0}".', functionAppId));
                    }
                }
            }
        }
        finally {
            onNodeCreatedFromQuickPickDisposable.dispose();
        }
        // if the node selected for deployment is the same newly created nodes, stifle the confirmDeployment dialog
        const confirmDeployment = !newNodes.some((newNode) => !!node && newNode.fullId === node.fullId);
        const client = node.root.client;
        const language = yield ProjectSettings_1.getProjectLanguage(deployFsPath, extensionVariables_1.ext.ui);
        telemetryProperties.projectLanguage = language;
        const runtime = yield ProjectSettings_1.getProjectRuntime(language, deployFsPath, extensionVariables_1.ext.ui);
        telemetryProperties.projectRuntime = runtime;
        if (language === constants_1.ProjectLanguage.Python && !node.isLinuxPreview) {
            throw new Error(localize_1.localize('pythonNotAvailableOnWindows', 'Python projects are not supported on Windows Function apps.  Deploy to a Linux Consumption app.'));
        }
        yield verifyWebContentSettings(node, telemetryProperties);
        if (language === constants_1.ProjectLanguage.Java) {
            deployFsPath = yield getJavaFolderPath(this, extensionVariables_1.ext.outputChannel, deployFsPath, extensionVariables_1.ext.ui, telemetryProperties);
        }
        yield verifyRuntimeIsCompatible(runtime, extensionVariables_1.ext.ui, extensionVariables_1.ext.outputChannel, client, telemetryProperties);
        const siteConfig = yield client.getSiteConfig();
        const isZipDeploy = siteConfig.scmType !== constants_1.ScmType.LocalGit && siteConfig !== constants_1.ScmType.GitHub;
        if (confirmDeployment && isZipDeploy) {
            const warning = localize_1.localize('confirmDeploy', 'Are you sure you want to deploy to "{0}"? This will overwrite any previous deployment and cannot be undone.', client.fullName);
            telemetryProperties.cancelStep = 'confirmDestructiveDeployment';
            const deployButton = { title: localize_1.localize('deploy', 'Deploy') };
            yield extensionVariables_1.ext.ui.showWarningMessage(warning, { modal: true }, deployButton, vscode_azureextensionui_1.DialogResponses.cancel);
            telemetryProperties.cancelStep = '';
        }
        yield runPreDeployTask(deployFsPath, telemetryProperties, language, isZipDeploy, runtime);
        if (siteConfig.scmType === constants_1.ScmType.LocalGit) {
            // preDeploy tasks are not required for LocalGit so subpath may not exist
            deployFsPath = workspaceFsPath;
        }
        yield node.runWithTemporaryDescription(localize_1.localize('deploying', 'Deploying...'), () => __awaiter(this, void 0, void 0, function* () {
            try {
                // Stop function app here to avoid *.jar file in use on server side.
                // More details can be found: https://github.com/Microsoft/vscode-azurefunctions/issues/106
                if (language === constants_1.ProjectLanguage.Java) {
                    extensionVariables_1.ext.outputChannel.appendLine(localize_1.localize('stopFunctionApp', 'Stopping Function App: {0} ...', client.fullName));
                    yield client.stop();
                }
                yield appservice.deploy(client, deployFsPath, constants_1.extensionPrefix, telemetryProperties);
            }
            finally {
                if (language === constants_1.ProjectLanguage.Java) {
                    extensionVariables_1.ext.outputChannel.appendLine(localize_1.localize('startFunctionApp', 'Starting Function App: {0} ...', client.fullName));
                    yield client.start();
                }
            }
        }));
        const deployComplete = localize_1.localize('deployComplete', 'Deployment to "{0}" completed.', client.fullName);
        extensionVariables_1.ext.outputChannel.appendLine(deployComplete);
        const viewOutput = { title: localize_1.localize('viewOutput', 'View Output') };
        const streamLogs = { title: localize_1.localize('streamLogs', 'Stream Logs') };
        // Don't wait
        vscode.window.showInformationMessage(deployComplete, streamLogs, viewOutput).then((result) => __awaiter(this, void 0, void 0, function* () {
            if (result === viewOutput) {
                extensionVariables_1.ext.outputChannel.show();
            }
            else if (result === streamLogs) {
                yield startStreamingLogs_1.startStreamingLogs(node);
            }
        }));
        yield listHttpTriggerUrls(node, this);
    });
}
exports.deploy = deploy;
function listHttpTriggerUrls(node, actionContext) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const children = yield node.getCachedChildren();
            const functionsNode = children.find((n) => n instanceof FunctionsTreeItem_1.FunctionsTreeItem);
            yield node.treeDataProvider.refresh(functionsNode);
            const functions = yield functionsNode.getCachedChildren();
            const anonFunctions = functions.filter((f) => f instanceof FunctionTreeItem_1.FunctionTreeItem && f.config.isHttpTrigger && f.config.authLevel === FunctionConfig_1.HttpAuthLevel.anonymous);
            if (anonFunctions.length > 0) {
                extensionVariables_1.ext.outputChannel.appendLine(localize_1.localize('anonymousFunctionUrls', 'HTTP Trigger Urls:'));
                for (const func of anonFunctions) {
                    extensionVariables_1.ext.outputChannel.appendLine(`  ${func.label}: ${func.triggerUrl}`);
                }
            }
            if (functions.find((f) => f instanceof FunctionTreeItem_1.FunctionTreeItem && f.config.isHttpTrigger && f.config.authLevel !== FunctionConfig_1.HttpAuthLevel.anonymous)) {
                extensionVariables_1.ext.outputChannel.appendLine(localize_1.localize('nonAnonymousWarning', 'WARNING: Some http trigger urls cannot be displayed in the output window because they require an authentication token. Instead, you may copy them from the Azure Functions explorer.'));
            }
        }
        catch (error) {
            // suppress error notification and instead display a warning in the output. We don't want it to seem like the deployment failed.
            actionContext.suppressErrorDisplay = true;
            extensionVariables_1.ext.outputChannel.appendLine(localize_1.localize('failedToList', 'WARNING: Deployment succeeded, but failed to list http trigger urls.'));
            throw error;
        }
    });
}
/**
 * If there is only one workspace and it has 'deploySubPath' set - return that value. Otherwise, prompt the user
 */
function getDeployFsPath() {
    return __awaiter(this, void 0, void 0, function* () {
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length === 1) {
            const folderPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
            const deploySubpath = ProjectSettings_1.getFuncExtensionSetting(constants_1.deploySubpathSetting, folderPath);
            if (deploySubpath) {
                return path.join(folderPath, deploySubpath);
            }
        }
        const workspaceMessage = localize_1.localize('azFunc.selectZipDeployFolder', 'Select the folder to zip and deploy');
        return yield workspaceUtil.selectWorkspaceFolder(extensionVariables_1.ext.ui, workspaceMessage, (f) => ProjectSettings_1.getFuncExtensionSetting(constants_1.deploySubpathSetting, f.uri.fsPath));
    });
}
/**
 * Appends the deploySubpath setting if the target path matches the root of a workspace folder
 * If the targetPath is a sub folder instead of the root, leave the targetPath as-is and assume they want that exact folder used
 */
function appendDeploySubpathSetting(targetPath) {
    return __awaiter(this, void 0, void 0, function* () {
        if (vscode.workspace.workspaceFolders) {
            const deploySubPath = ProjectSettings_1.getFuncExtensionSetting(constants_1.deploySubpathSetting, targetPath);
            if (deploySubPath) {
                if (vscode.workspace.workspaceFolders.some((f) => fs_1.isPathEqual(f.uri.fsPath, targetPath))) {
                    return path.join(targetPath, deploySubPath);
                }
                else {
                    const folder = vscode.workspace.workspaceFolders.find((f) => fs_1.isSubpath(f.uri.fsPath, targetPath));
                    if (folder) {
                        const fsPathWithSetting = path.join(folder.uri.fsPath, deploySubPath);
                        if (!fs_1.isPathEqual(fsPathWithSetting, targetPath)) {
                            const settingKey = 'showDeploySubpathWarning';
                            if (ProjectSettings_1.getFuncExtensionSetting(settingKey)) {
                                const selectedFolder = path.relative(folder.uri.fsPath, targetPath);
                                const message = localize_1.localize('mismatchDeployPath', 'Deploying "{0}" instead of selected folder "{1}". Use "{2}.{3}" to change this behavior.', deploySubPath, selectedFolder, constants_1.extensionPrefix, constants_1.deploySubpathSetting);
                                // don't wait
                                // tslint:disable-next-line:no-floating-promises
                                extensionVariables_1.ext.ui.showWarningMessage(message, { title: localize_1.localize('ok', 'OK') }, vscode_azureextensionui_1.DialogResponses.dontWarnAgain).then((result) => __awaiter(this, void 0, void 0, function* () {
                                    if (result === vscode_azureextensionui_1.DialogResponses.dontWarnAgain) {
                                        yield ProjectSettings_1.updateGlobalSetting(settingKey, false);
                                    }
                                }));
                            }
                        }
                        return fsPathWithSetting;
                    }
                }
            }
        }
        return targetPath;
    });
}
function getJavaFolderPath(actionContext, outputChannel, basePath, ui, telemetryProperties) {
    return __awaiter(this, void 0, void 0, function* () {
        yield mavenUtils_1.mavenUtils.validateMavenInstalled(actionContext, basePath);
        outputChannel.show();
        yield mavenUtils_1.mavenUtils.executeMvnCommand(telemetryProperties, outputChannel, basePath, 'clean', 'package', '-B');
        const pomLocation = path.join(basePath, 'pom.xml');
        const functionAppName = yield mavenUtils_1.mavenUtils.getFunctionAppNameInPom(pomLocation);
        const targetFolder = functionAppName ? path.join(basePath, 'target', 'azure-functions', functionAppName) : '';
        if (functionAppName && (yield fse.pathExists(targetFolder))) {
            return targetFolder;
        }
        else {
            const message = localize_1.localize('azFunc.cannotFindPackageFolder', 'Cannot find the packaged function folder, would you like to specify the folder location?');
            yield ui.showWarningMessage(message, vscode_azureextensionui_1.DialogResponses.yes, vscode_azureextensionui_1.DialogResponses.cancel);
            return (yield ui.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                defaultUri: vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0 ? vscode.workspace.workspaceFolders[0].uri : undefined,
                openLabel: localize_1.localize('select', 'Select')
            }))[0].fsPath;
        }
    });
}
function verifyRuntimeIsCompatible(localRuntime, ui, outputChannel, client, telemetryProperties) {
    return __awaiter(this, void 0, void 0, function* () {
        const appSettings = yield client.listApplicationSettings();
        if (!appSettings.properties) {
            throw new errors_1.ArgumentError(appSettings);
        }
        else {
            const rawAzureRuntime = appSettings.properties.FUNCTIONS_EXTENSION_VERSION;
            const azureRuntime = ProjectSettings_1.convertStringToRuntime(rawAzureRuntime);
            // If we can't recognize the Azure runtime (aka it's undefined), just assume it's compatible
            if (azureRuntime !== undefined && azureRuntime !== localRuntime) {
                const message = localize_1.localize('incompatibleRuntime', 'The remote runtime "{0}" is not compatible with your local runtime "{1}".', rawAzureRuntime, localRuntime);
                const updateRemoteRuntime = { title: localize_1.localize('updateRemoteRuntime', 'Update remote runtime') };
                const result = yield ui.showWarningMessage(message, { modal: true }, updateRemoteRuntime, vscode_azureextensionui_1.DialogResponses.learnMore, vscode_azureextensionui_1.DialogResponses.cancel);
                if (result === vscode_azureextensionui_1.DialogResponses.learnMore) {
                    yield opn('https://aka.ms/azFuncRuntime');
                    telemetryProperties.cancelStep = 'learnMoreRuntime';
                    throw new vscode_azureextensionui_1.UserCancelledError();
                }
                else {
                    const newAppSettings = yield getCliFeedJson_1.getCliFeedAppSettings(localRuntime);
                    for (const key of Object.keys(newAppSettings)) {
                        const value = newAppSettings[key];
                        outputChannel.appendLine(localize_1.localize('updateFunctionRuntime', 'Updating "{0}" to "{1}"...', key, value));
                        appSettings.properties[key] = value;
                    }
                    yield client.updateApplicationSettings(appSettings);
                }
            }
        }
    });
}
function runPreDeployTask(deployFsPath, telemetryProperties, language, isZipDeploy, runtime) {
    return __awaiter(this, void 0, void 0, function* () {
        const taskName = ProjectSettings_1.getFuncExtensionSetting(constants_1.preDeployTaskSetting, deployFsPath);
        if (!isZipDeploy) {
            // We don't run pre deploy tasks for non-zipdeploy since that stuff should be handled by kudu
            if (taskName) {
                // We only need to warn if they have the setting defined
                extensionVariables_1.ext.outputChannel.appendLine(localize_1.localize('ignoringPreDeployTask', 'WARNING: Ignoring preDeployTask "{0}" for non-zip deploy.', taskName));
            }
            return;
        }
        telemetryProperties.preDeployTask = taskName;
        let workspaceFolderPath;
        let preDeployTask;
        if (taskName) {
            const tasks = yield vscode.tasks.fetchTasks();
            for (const task of tasks) {
                if (task.name.toLowerCase() === taskName.toLowerCase() && task.scope !== undefined) {
                    const workspaceFolder = task.scope;
                    if (workspaceFolder.uri && (fs_1.isPathEqual(workspaceFolder.uri.fsPath, deployFsPath) || fs_1.isSubpath(workspaceFolder.uri.fsPath, deployFsPath))) {
                        preDeployTask = task;
                        workspaceFolderPath = workspaceFolder.uri.fsPath;
                        break;
                    }
                }
            }
        }
        if (preDeployTask) {
            telemetryProperties.foundPreDeployTask = 'true';
            yield vscode.tasks.executeTask(preDeployTask);
            // tslint:disable-next-line:no-non-null-assertion
            yield waitForPreDeployTask(preDeployTask, telemetryProperties, workspaceFolderPath);
        }
        else {
            telemetryProperties.foundPreDeployTask = 'false';
            const messageLines = [];
            // If the task name was specified in the user's settings, we will throw an error and block the user's deploy if we can't find that task
            // If the task name was _not_ specified, we will display a warning and let the deployment continue. (The preDeployTask isn't _always_ necessary and we don't want to block old projects that never had this setting)
            if (taskName) {
                messageLines.push(localize_1.localize('noPreDeployTaskError', 'Did not find preDeploy task "{0}". Change the "{1}.{2}" setting, manually edit your task.json, or re-initialize your VS Code config with the following steps:', taskName, constants_1.extensionPrefix, constants_1.preDeployTaskSetting));
                const fullMessage = getFullPreDeployMessage(messageLines);
                throw new Error(fullMessage);
            }
            else {
                const recommendedTaskName = getRecommendedTaskName(language, runtime);
                if (recommendedTaskName) {
                    messageLines.push(localize_1.localize('noPreDeployTaskWarning', 'WARNING: Did not find recommended preDeploy task "{0}". The deployment will continue, but the selected folder may not reflect your latest changes.', recommendedTaskName));
                    messageLines.push(localize_1.localize('howToAddPreDeploy', 'In order to ensure that you always deploy your latest changes, add a preDeploy task with the following steps:'));
                    const fullMessage = getFullPreDeployMessage(messageLines);
                    extensionVariables_1.ext.outputChannel.show(true);
                    extensionVariables_1.ext.outputChannel.appendLine(fullMessage);
                }
            }
        }
    });
}
function getFullPreDeployMessage(messageLines) {
    messageLines.push(localize_1.localize('howToAddPreDeploy1', '1. Open Command Palette (View -> Command Palette...)'));
    messageLines.push(localize_1.localize('howToAddPreDeploy2', '2. Search for "Azure Functions" and run command "Initialize Project for Use with VS Code"'));
    messageLines.push(localize_1.localize('howToAddPreDeploy3', '3. Select "Yes" to overwrite your tasks.json file when prompted'));
    return messageLines.join(os.EOL);
}
function getRecommendedTaskName(language, runtime) {
    switch (language) {
        case constants_1.ProjectLanguage.CSharp:
            return constants_1.publishTaskId;
        case constants_1.ProjectLanguage.JavaScript:
            // "func extensions install" is only supported on v2
            return runtime === constants_1.ProjectRuntime.v1 ? undefined : constants_1.installExtensionsId;
        case constants_1.ProjectLanguage.Python:
            return constants_1.funcPackId;
        default:
            return undefined; // preDeployTask not needed
    }
}
function waitForPreDeployTask(preDeployTask, telemetryProperties, workspaceFolderPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const exitCode = yield new Promise((resolve) => {
            const listener = vscode.tasks.onDidEndTaskProcess((e) => {
                if (e.execution.task === preDeployTask) {
                    listener.dispose();
                    resolve(e.exitCode);
                }
            });
        });
        telemetryProperties.preDeployTaskExitCode = String(exitCode);
        if (exitCode !== 0) {
            const message = localize_1.localize('taskFailed', 'Pre-deploy task "{0}" failed with exit code "{1}".', preDeployTask.name, exitCode);
            const deployAnyway = { title: localize_1.localize('deployAnyway', 'Deploy Anyway') };
            const viewSettings = { title: localize_1.localize('viewSettings', 'View Settings') };
            const result = yield vscode.window.showErrorMessage(message, { modal: true }, deployAnyway, viewSettings);
            if (result === deployAnyway) {
                telemetryProperties.preDeployTaskResponse = 'deployAnyway';
            }
            else if (result === viewSettings) {
                telemetryProperties.preDeployTaskResponse = 'viewSettings';
                const settingsJsonPath = path.join(workspaceFolderPath, constants_1.vscodeFolderName, constants_1.settingsFileName);
                yield vscode.window.showTextDocument(yield vscode.workspace.openTextDocument(vscode.Uri.file(settingsJsonPath)));
                throw new vscode_azureextensionui_1.UserCancelledError();
            }
            else {
                telemetryProperties.preDeployTaskResponse = 'cancel';
                throw new vscode_azureextensionui_1.UserCancelledError();
            }
        }
    });
}
function verifyWebContentSettings(node, telemetryProperties) {
    return __awaiter(this, void 0, void 0, function* () {
        if (node.isLinuxPreview) {
            // we need this check due to this issue: https://github.com/Microsoft/vscode-azurefunctions/issues/625
            const client = node.root.client;
            const applicationSettings = yield client.listApplicationSettings();
            const WEBSITE_CONTENTAZUREFILECONNECTIONSTRING = 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING';
            const WEBSITE_CONTENTSHARE = 'WEBSITE_CONTENTSHARE';
            if (applicationSettings.properties && (applicationSettings.properties[WEBSITE_CONTENTAZUREFILECONNECTIONSTRING] || applicationSettings.properties[WEBSITE_CONTENTSHARE])) {
                telemetryProperties.webContentSettingsRemoved = 'false';
                yield extensionVariables_1.ext.ui.showWarningMessage(localize_1.localize('notConfiguredForDeploy', 'The selected app is not configured for deployment through VS Code. Remove app settings "{0}" and "{1}"?', WEBSITE_CONTENTAZUREFILECONNECTIONSTRING, WEBSITE_CONTENTSHARE), { modal: true }, vscode_azureextensionui_1.DialogResponses.yes, vscode_azureextensionui_1.DialogResponses.cancel);
                delete applicationSettings.properties[WEBSITE_CONTENTAZUREFILECONNECTIONSTRING];
                delete applicationSettings.properties[WEBSITE_CONTENTSHARE];
                telemetryProperties.webContentSettingsRemoved = 'true';
                yield client.updateApplicationSettings(applicationSettings);
                // if the user cancels the deployment, the app settings node doesn't reflect the deleted settings
                yield node.appSettingsTreeItem.refresh();
            }
        }
    });
}
//# sourceMappingURL=deploy.js.map
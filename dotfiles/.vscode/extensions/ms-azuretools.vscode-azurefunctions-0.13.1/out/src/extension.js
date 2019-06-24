/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
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
const loadStartTime = Date.now();
let loadEndTime;
const vscode = require("vscode");
const vscode_azureappservice_1 = require("vscode-azureappservice");
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const decryptLocalSettings_1 = require("./commands/appSettings/decryptLocalSettings");
const downloadAppSettings_1 = require("./commands/appSettings/downloadAppSettings");
const encryptLocalSettings_1 = require("./commands/appSettings/encryptLocalSettings");
const uploadAppSettings_1 = require("./commands/appSettings/uploadAppSettings");
const configureDeploymentSource_1 = require("./commands/configureDeploymentSource");
const copyFunctionUrl_1 = require("./commands/copyFunctionUrl");
const createChildNode_1 = require("./commands/createChildNode");
const createFunction_1 = require("./commands/createFunction/createFunction");
const createFunctionApp_1 = require("./commands/createFunctionApp");
const createNewProject_1 = require("./commands/createNewProject/createNewProject");
const initProjectForVSCode_1 = require("./commands/createNewProject/initProjectForVSCode");
const validateFunctionProjects_1 = require("./commands/createNewProject/validateFunctionProjects");
const deleteNode_1 = require("./commands/deleteNode");
const deploy_1 = require("./commands/deploy");
const connectToGitHub_1 = require("./commands/deployments/connectToGitHub");
const disconnectRepo_1 = require("./commands/deployments/disconnectRepo");
const redeployDeployment_1 = require("./commands/deployments/redeployDeployment");
const viewDeploymentLogs_1 = require("./commands/deployments/viewDeploymentLogs");
const editAppSetting_1 = require("./commands/editAppSetting");
const startStreamingLogs_1 = require("./commands/logstream/startStreamingLogs");
const stopStreamingLogs_1 = require("./commands/logstream/stopStreamingLogs");
const openInPortal_1 = require("./commands/openInPortal");
const pickFuncProcess_1 = require("./commands/pickFuncProcess");
const remoteDebugFunctionApp_1 = require("./commands/remoteDebugFunctionApp");
const renameAppSetting_1 = require("./commands/renameAppSetting");
const restartFunctionApp_1 = require("./commands/restartFunctionApp");
const startFunctionApp_1 = require("./commands/startFunctionApp");
const stopFunctionApp_1 = require("./commands/stopFunctionApp");
const swapSlot_1 = require("./commands/swapSlot");
const extensionVariables_1 = require("./extensionVariables");
const funcHostTask_1 = require("./funcCoreTools/funcHostTask");
const installOrUpdateFuncCoreTools_1 = require("./funcCoreTools/installOrUpdateFuncCoreTools");
const uninstallFuncCoreTools_1 = require("./funcCoreTools/uninstallFuncCoreTools");
const validateFuncCoreToolsIsLatest_1 = require("./funcCoreTools/validateFuncCoreToolsIsLatest");
const TemplateProvider_1 = require("./templates/TemplateProvider");
const FunctionAppProvider_1 = require("./tree/FunctionAppProvider");
const FunctionTreeItem_1 = require("./tree/FunctionTreeItem");
const ProductionSlotTreeItem_1 = require("./tree/ProductionSlotTreeItem");
const ProxyTreeItem_1 = require("./tree/ProxyTreeItem");
const SlotsTreeItem_1 = require("./tree/SlotsTreeItem");
function activate(context) {
    return __awaiter(this, void 0, void 0, function* () {
        extensionVariables_1.ext.context = context;
        extensionVariables_1.ext.reporter = vscode_azureextensionui_1.createTelemetryReporter(context);
        extensionVariables_1.ext.outputChannel = vscode.window.createOutputChannel('Azure Functions');
        context.subscriptions.push(extensionVariables_1.ext.outputChannel);
        extensionVariables_1.ext.ui = new vscode_azureextensionui_1.AzureUserInput(context.globalState);
        vscode_azureextensionui_1.registerUIExtensionVariables(extensionVariables_1.ext);
        vscode_azureappservice_1.registerAppServiceExtensionVariables(extensionVariables_1.ext);
        yield vscode_azureextensionui_1.callWithTelemetryAndErrorHandling('azureFunctions.activate', function () {
            return __awaiter(this, void 0, void 0, function* () {
                this.properties.isActivationEvent = 'true';
                this.measurements.mainFileLoad = (loadEndTime - loadStartTime) / 1000;
                // tslint:disable-next-line:no-floating-promises
                validateFuncCoreToolsIsLatest_1.validateFuncCoreToolsIsLatest();
                extensionVariables_1.ext.tree = new vscode_azureextensionui_1.AzureTreeDataProvider(FunctionAppProvider_1.FunctionAppProvider, 'azureFunctions.loadMore');
                context.subscriptions.push(extensionVariables_1.ext.tree);
                context.subscriptions.push(vscode.window.registerTreeDataProvider('azureFunctionsExplorer', extensionVariables_1.ext.tree));
                const validateEventId = 'azureFunctions.validateFunctionProjects';
                // tslint:disable-next-line:no-floating-promises
                vscode_azureextensionui_1.callWithTelemetryAndErrorHandling(validateEventId, function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield validateFunctionProjects_1.validateFunctionProjects(this, vscode.workspace.workspaceFolders);
                    });
                });
                vscode_azureextensionui_1.registerEvent(validateEventId, vscode.workspace.onDidChangeWorkspaceFolders, function (event) {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield validateFunctionProjects_1.validateFunctionProjects(this, event.added);
                    });
                });
                extensionVariables_1.ext.templateProviderTask = TemplateProvider_1.getTemplateProvider();
                vscode_azureextensionui_1.registerCommand('azureFunctions.selectSubscriptions', () => vscode.commands.executeCommand('azure-account.selectSubscriptions'));
                vscode_azureextensionui_1.registerCommand('azureFunctions.refresh', (node) => __awaiter(this, void 0, void 0, function* () { return yield extensionVariables_1.ext.tree.refresh(node); }));
                vscode_azureextensionui_1.registerCommand('azureFunctions.pickProcess', pickFuncProcess_1.pickFuncProcess);
                vscode_azureextensionui_1.registerCommand('azureFunctions.loadMore', (node) => __awaiter(this, void 0, void 0, function* () { return yield extensionVariables_1.ext.tree.loadMore(node); }));
                vscode_azureextensionui_1.registerCommand('azureFunctions.openInPortal', openInPortal_1.openInPortal);
                vscode_azureextensionui_1.registerCommand('azureFunctions.createFunction', function (functionAppPath, templateId, functionName, functionSettings) {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield createFunction_1.createFunction(this, functionAppPath, templateId, functionName, functionSettings);
                    });
                });
                vscode_azureextensionui_1.registerCommand('azureFunctions.createNewProject', function (functionAppPath, language, runtime, openFolder, templateId, functionName, functionSettings) {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield createNewProject_1.createNewProject(this, functionAppPath, language, runtime, openFolder, templateId, functionName, functionSettings);
                    });
                });
                vscode_azureextensionui_1.registerCommand('azureFunctions.initProjectForVSCode', function () {
                    return __awaiter(this, void 0, void 0, function* () { yield initProjectForVSCode_1.initProjectForVSCode(this); });
                });
                vscode_azureextensionui_1.registerCommand('azureFunctions.createFunctionApp', createFunctionApp_1.createFunctionApp);
                vscode_azureextensionui_1.registerCommand('azureFunctions.startFunctionApp', startFunctionApp_1.startFunctionApp);
                vscode_azureextensionui_1.registerCommand('azureFunctions.stopFunctionApp', stopFunctionApp_1.stopFunctionApp);
                vscode_azureextensionui_1.registerCommand('azureFunctions.restartFunctionApp', restartFunctionApp_1.restartFunctionApp);
                vscode_azureextensionui_1.registerCommand('azureFunctions.deleteFunctionApp', (node) => __awaiter(this, void 0, void 0, function* () { return yield deleteNode_1.deleteNode(ProductionSlotTreeItem_1.ProductionSlotTreeItem.contextValue, node); }));
                vscode_azureextensionui_1.registerCommand('azureFunctions.deploy', deploy_1.deploy);
                vscode_azureextensionui_1.registerCommand('azureFunctions.configureDeploymentSource', configureDeploymentSource_1.configureDeploymentSource);
                vscode_azureextensionui_1.registerCommand('azureFunctions.copyFunctionUrl', copyFunctionUrl_1.copyFunctionUrl);
                vscode_azureextensionui_1.registerCommand('azureFunctions.startStreamingLogs', startStreamingLogs_1.startStreamingLogs);
                vscode_azureextensionui_1.registerCommand('azureFunctions.stopStreamingLogs', stopStreamingLogs_1.stopStreamingLogs);
                vscode_azureextensionui_1.registerCommand('azureFunctions.deleteFunction', (node) => __awaiter(this, void 0, void 0, function* () { return yield deleteNode_1.deleteNode(FunctionTreeItem_1.FunctionTreeItem.contextValue, node); }));
                vscode_azureextensionui_1.registerCommand('azureFunctions.appSettings.add', (node) => __awaiter(this, void 0, void 0, function* () { return yield createChildNode_1.createChildNode(vscode_azureappservice_1.AppSettingsTreeItem.contextValue, node); }));
                vscode_azureextensionui_1.registerCommand('azureFunctions.appSettings.download', downloadAppSettings_1.downloadAppSettings);
                vscode_azureextensionui_1.registerCommand('azureFunctions.appSettings.upload', uploadAppSettings_1.uploadAppSettings);
                vscode_azureextensionui_1.registerCommand('azureFunctions.appSettings.edit', editAppSetting_1.editAppSetting);
                vscode_azureextensionui_1.registerCommand('azureFunctions.appSettings.rename', renameAppSetting_1.renameAppSetting);
                vscode_azureextensionui_1.registerCommand('azureFunctions.appSettings.decrypt', decryptLocalSettings_1.decryptLocalSettings);
                vscode_azureextensionui_1.registerCommand('azureFunctions.appSettings.encrypt', encryptLocalSettings_1.encryptLocalSettings);
                vscode_azureextensionui_1.registerCommand('azureFunctions.appSettings.delete', (node) => __awaiter(this, void 0, void 0, function* () { return yield deleteNode_1.deleteNode(vscode_azureappservice_1.AppSettingTreeItem.contextValue, node); }));
                vscode_azureextensionui_1.registerCommand('azureFunctions.debugFunctionAppOnAzure', remoteDebugFunctionApp_1.remoteDebugFunctionApp);
                vscode_azureextensionui_1.registerCommand('azureFunctions.deleteProxy', (node) => __awaiter(this, void 0, void 0, function* () { return yield deleteNode_1.deleteNode(ProxyTreeItem_1.ProxyTreeItem.contextValue, node); }));
                vscode_azureextensionui_1.registerCommand('azureFunctions.installOrUpdateFuncCoreTools', installOrUpdateFuncCoreTools_1.installOrUpdateFuncCoreTools);
                vscode_azureextensionui_1.registerCommand('azureFunctions.uninstallFuncCoreTools', uninstallFuncCoreTools_1.uninstallFuncCoreTools);
                vscode_azureextensionui_1.registerCommand('azureFunctions.redeploy', redeployDeployment_1.redeployDeployment);
                vscode_azureextensionui_1.registerCommand('azureFunctions.viewDeploymentLogs', viewDeploymentLogs_1.viewDeploymentLogs);
                vscode_azureextensionui_1.registerCommand('azureFunctions.connectToGitHub', connectToGitHub_1.connectToGitHub);
                vscode_azureextensionui_1.registerCommand('azureFunctions.disconnectRepo', disconnectRepo_1.disconnectRepo);
                vscode_azureextensionui_1.registerCommand('azureFunctions.swapSlot', swapSlot_1.swapSlot);
                vscode_azureextensionui_1.registerCommand('azureFunctions.createSlot', (node) => __awaiter(this, void 0, void 0, function* () { return yield createChildNode_1.createChildNode(SlotsTreeItem_1.SlotsTreeItem.contextValue, node); }));
                funcHostTask_1.registerFuncHostTaskEvents();
            });
        });
        return vscode_azureextensionui_1.createApiProvider([]);
    });
}
exports.activate = activate;
// tslint:disable-next-line:no-empty
function deactivate() {
}
exports.deactivate = deactivate;
loadEndTime = Date.now();
//# sourceMappingURL=extension.js.map
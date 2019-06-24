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
const azure_arm_website_1 = require("azure-arm-website");
const vscode_azureappservice_1 = require("vscode-azureappservice");
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const constants_1 = require("../constants");
const tryGetLocalRuntimeVersion_1 = require("../funcCoreTools/tryGetLocalRuntimeVersion");
const localize_1 = require("../localize");
const ProjectSettings_1 = require("../ProjectSettings");
const getCliFeedJson_1 = require("../utils/getCliFeedJson");
const ProductionSlotTreeItem_1 = require("./ProductionSlotTreeItem");
class FunctionAppProvider extends vscode_azureextensionui_1.SubscriptionTreeItem {
    constructor() {
        super(...arguments);
        this.childTypeLabel = localize_1.localize('azFunc.FunctionApp', 'Function App');
    }
    hasMoreChildrenImpl() {
        return this._nextLink !== undefined;
    }
    loadMoreChildrenImpl(clearCache) {
        return __awaiter(this, void 0, void 0, function* () {
            if (clearCache) {
                this._nextLink = undefined;
            }
            const client = vscode_azureextensionui_1.createAzureClient(this.root, azure_arm_website_1.WebSiteManagementClient);
            let webAppCollection;
            try {
                webAppCollection = this._nextLink === undefined ?
                    yield client.webApps.list() :
                    yield client.webApps.listNext(this._nextLink);
            }
            catch (error) {
                if (vscode_azureextensionui_1.parseError(error).errorType.toLowerCase() === 'notfound') {
                    // This error type means the 'Microsoft.Web' provider has not been registered in this subscription
                    // In that case, we know there are no function apps, so we can return an empty array
                    // (The provider will be registered automatically if the user creates a new function app)
                    return [];
                }
                else {
                    throw error;
                }
            }
            this._nextLink = webAppCollection.nextLink;
            return yield vscode_azureextensionui_1.createTreeItemsWithErrorHandling(this, webAppCollection, 'azFuncInvalidFunctionApp', (site) => __awaiter(this, void 0, void 0, function* () {
                const siteClient = new vscode_azureappservice_1.SiteClient(site, this.root);
                if (siteClient.isFunctionApp) {
                    const asp = yield siteClient.getAppServicePlan();
                    const isLinuxPreview = siteClient.kind.toLowerCase().includes('linux') && !!asp && !!asp.sku && !!asp.sku.tier && asp.sku.tier.toLowerCase() === 'dynamic';
                    return new ProductionSlotTreeItem_1.ProductionSlotTreeItem(this, siteClient, isLinuxPreview);
                }
                return undefined;
            }), (site) => {
                return site.name;
            });
        });
    }
    createChildImpl(showCreatingTreeItem, userOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            // Ideally actionContext should always be defined, but there's a bug with the NodePicker. Create a 'fake' actionContext until that bug is fixed
            // https://github.com/Microsoft/vscode-azuretools/issues/120
            // tslint:disable-next-line:strict-boolean-expressions
            const actionContext = userOptions ? userOptions.actionContext : { properties: {}, measurements: {} };
            const resourceGroup = userOptions ? userOptions.resourceGroup : undefined;
            const runtime = yield getDefaultRuntime(actionContext);
            const language = ProjectSettings_1.getFuncExtensionSetting(constants_1.projectLanguageSetting);
            const createOptions = {
                resourceGroup,
                createFunctionAppSettings: (context) => __awaiter(this, void 0, void 0, function* () { return yield createFunctionAppSettings(context, runtime, language); })
            };
            // There are two things in preview right now:
            // 1. Python support
            // 2. Linux support
            // Python only works on Linux, so we have to use Linux when creating a function app. For other languages, we will stick with Windows until Linux GA's
            if (language === constants_1.ProjectLanguage.Python) {
                createOptions.os = 'linux';
                createOptions.runtime = 'python';
            }
            else {
                createOptions.os = 'windows';
            }
            const site = yield vscode_azureappservice_1.createFunctionApp(actionContext, this.root, createOptions, showCreatingTreeItem);
            return new ProductionSlotTreeItem_1.ProductionSlotTreeItem(this, new vscode_azureappservice_1.SiteClient(site, this.root), createOptions.os === 'linux' /* isLinuxPreview */);
        });
    }
}
exports.FunctionAppProvider = FunctionAppProvider;
function getDefaultRuntime(actionContext) {
    return __awaiter(this, void 0, void 0, function* () {
        // Try to get VS Code setting for runtime (aka if they have a project open)
        let runtime = ProjectSettings_1.convertStringToRuntime(ProjectSettings_1.getFuncExtensionSetting(constants_1.projectRuntimeSetting));
        actionContext.properties.runtimeSource = 'VSCodeSetting';
        if (!runtime) {
            // Try to get the runtime that matches their local func cli version
            runtime = yield tryGetLocalRuntimeVersion_1.tryGetLocalRuntimeVersion();
            actionContext.properties.runtimeSource = 'LocalFuncCli';
        }
        if (!runtime) {
            // Default to v2 if all else fails
            runtime = constants_1.ProjectRuntime.v2;
            actionContext.properties.runtimeSource = 'Backup';
        }
        actionContext.properties.projectRuntime = runtime;
        return runtime;
    });
}
function createFunctionAppSettings(context, projectRuntime, projectLanguage) {
    return __awaiter(this, void 0, void 0, function* () {
        const appSettings = [];
        const cliFeedAppSettings = yield getCliFeedJson_1.getCliFeedAppSettings(projectRuntime);
        for (const key of Object.keys(cliFeedAppSettings)) {
            appSettings.push({
                name: key,
                value: cliFeedAppSettings[key]
            });
        }
        appSettings.push({
            name: 'AzureWebJobsStorage',
            value: context.storageConnectionString
        });
        // This setting only applies for v1 https://github.com/Microsoft/vscode-azurefunctions/issues/640
        if (projectRuntime === constants_1.ProjectRuntime.v1) {
            appSettings.push({
                name: 'AzureWebJobsDashboard',
                value: context.storageConnectionString
            });
        }
        // These settings only apply for Windows https://github.com/Microsoft/vscode-azurefunctions/issues/625
        if (context.os === 'windows') {
            appSettings.push({
                name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING',
                value: context.storageConnectionString
            });
            appSettings.push({
                name: 'WEBSITE_CONTENTSHARE',
                value: context.fileShareName
            });
        }
        if (context.runtime) {
            appSettings.push({
                name: 'FUNCTIONS_WORKER_RUNTIME',
                value: context.runtime
            });
        }
        // This setting is not required, but we will set it since it has many benefits https://docs.microsoft.com/en-us/azure/azure-functions/run-functions-from-deployment-package
        // That being said, it doesn't work on v1 C# Script https://github.com/Microsoft/vscode-azurefunctions/issues/684
        // It also doesn't apply for Python, which has its own custom deploy logic in the the vscode-azureappservice package
        if (projectLanguage !== constants_1.ProjectLanguage.Python && !(projectLanguage === constants_1.ProjectLanguage.CSharpScript && projectRuntime === constants_1.ProjectRuntime.v1)) {
            appSettings.push({
                name: 'WEBSITE_RUN_FROM_PACKAGE',
                value: '1'
            });
        }
        return appSettings;
    });
}
//# sourceMappingURL=FunctionAppProvider.js.map
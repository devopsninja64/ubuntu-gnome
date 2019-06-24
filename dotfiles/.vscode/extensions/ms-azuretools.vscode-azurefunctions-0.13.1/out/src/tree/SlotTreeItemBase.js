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
const vscode_azureappservice_1 = require("vscode-azureappservice");
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const localize_1 = require("../localize");
const nodeUtils_1 = require("../utils/nodeUtils");
const FunctionsTreeItem_1 = require("./FunctionsTreeItem");
const FunctionTreeItem_1 = require("./FunctionTreeItem");
const ProxiesTreeItem_1 = require("./ProxiesTreeItem");
const ProxyTreeItem_1 = require("./ProxyTreeItem");
class SlotTreeItemBase extends vscode_azureextensionui_1.AzureParentTreeItem {
    constructor(parent, client, isLinuxPreview) {
        super(parent);
        this.logStreamPath = '';
        this._root = Object.assign({}, parent.root, { client });
        this._state = client.initialState;
        this._functionsTreeItem = new FunctionsTreeItem_1.FunctionsTreeItem(this);
        this.appSettingsTreeItem = new vscode_azureappservice_1.AppSettingsTreeItem(this);
        this._proxiesTreeItem = new ProxiesTreeItem_1.ProxiesTreeItem(this);
        this.isLinuxPreview = isLinuxPreview;
    }
    // overrides ISubscriptionRoot with an object that also has SiteClient
    get root() {
        return this._root;
    }
    get logStreamLabel() {
        return this.root.client.fullName;
    }
    get id() {
        return this.root.client.id;
    }
    get description() {
        const stateDescription = this._state && this._state.toLowerCase() !== 'running' ? this._state : undefined;
        const previewDescription = this.isLinuxPreview ? localize_1.localize('linuxPreview', 'Linux Preview') : undefined;
        if (stateDescription && previewDescription) {
            return `${previewDescription} - ${stateDescription}`;
        }
        else {
            return stateDescription || previewDescription;
        }
    }
    get iconPath() {
        return nodeUtils_1.nodeUtils.getIconPath(this.contextValue);
    }
    hasMoreChildrenImpl() {
        return false;
    }
    refreshLabelImpl() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this._state = yield this.root.client.getState();
            }
            catch (_a) {
                this._state = 'Unknown';
            }
        });
    }
    loadMoreChildrenImpl() {
        return __awaiter(this, void 0, void 0, function* () {
            const siteConfig = yield this.root.client.getSiteConfig();
            this.deploymentsNode = new vscode_azureappservice_1.DeploymentsTreeItem(this, siteConfig, 'azureFunctions.connectToGitHub');
            return [this._functionsTreeItem, this.appSettingsTreeItem, this._proxiesTreeItem, this.deploymentsNode];
        });
    }
    pickTreeItemImpl(expectedContextValue) {
        switch (expectedContextValue) {
            case FunctionsTreeItem_1.FunctionsTreeItem.contextValue:
            case FunctionTreeItem_1.FunctionTreeItem.contextValue:
                return this._functionsTreeItem;
            case vscode_azureappservice_1.AppSettingsTreeItem.contextValue:
            case vscode_azureappservice_1.AppSettingTreeItem.contextValue:
                return this.appSettingsTreeItem;
            case ProxiesTreeItem_1.ProxiesTreeItem.contextValue:
            case ProxyTreeItem_1.ProxyTreeItem.contextValue:
                return this._proxiesTreeItem;
            case vscode_azureappservice_1.DeploymentsTreeItem.contextValueConnected:
            case vscode_azureappservice_1.DeploymentsTreeItem.contextValueUnconnected:
            case vscode_azureappservice_1.DeploymentTreeItem.contextValue:
                return this.deploymentsNode;
            default:
                return undefined;
        }
    }
    deleteTreeItemImpl() {
        return __awaiter(this, void 0, void 0, function* () {
            yield vscode_azureappservice_1.deleteSite(this.root.client);
        });
    }
}
exports.SlotTreeItemBase = SlotTreeItemBase;
//# sourceMappingURL=SlotTreeItemBase.js.map
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
const localize_1 = require("../localize");
const nodeUtils_1 = require("../utils/nodeUtils");
const SlotTreeItem_1 = require("./SlotTreeItem");
class SlotsTreeItem extends vscode_azureextensionui_1.AzureParentTreeItem {
    constructor(parent) {
        super(parent);
        this.contextValue = SlotsTreeItem.contextValue;
        this.label = localize_1.localize('slots', 'Slots');
        this.description = localize_1.localize('preview', 'Preview');
        this.childTypeLabel = localize_1.localize('slot', 'Slot');
    }
    get id() {
        return 'slots';
    }
    get iconPath() {
        return nodeUtils_1.nodeUtils.getIconPath(this.contextValue);
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
            const webAppCollection = this._nextLink === undefined ?
                yield client.webApps.listSlots(this.root.client.resourceGroup, this.root.client.siteName) :
                yield client.webApps.listSlotsNext(this._nextLink);
            this._nextLink = webAppCollection.nextLink;
            return yield vscode_azureextensionui_1.createTreeItemsWithErrorHandling(this, webAppCollection, 'azFuncInvalidSlot', (site) => __awaiter(this, void 0, void 0, function* () {
                const siteClient = new vscode_azureappservice_1.SiteClient(site, this.root);
                return new SlotTreeItem_1.SlotTreeItem(this, siteClient, this.parent.isLinuxPreview);
            }), (site) => {
                return site.name;
            });
        });
    }
    createChildImpl(showCreatingTreeItem) {
        return __awaiter(this, void 0, void 0, function* () {
            const existingSlots = yield this.getCachedChildren();
            const newSite = yield vscode_azureappservice_1.createSlot(this.root, existingSlots, showCreatingTreeItem);
            return new SlotTreeItem_1.SlotTreeItem(this, new vscode_azureappservice_1.SiteClient(newSite, this.root), this.parent.isLinuxPreview);
        });
    }
}
SlotsTreeItem.contextValue = 'azFuncSlots';
exports.SlotsTreeItem = SlotsTreeItem;
//# sourceMappingURL=SlotsTreeItem.js.map
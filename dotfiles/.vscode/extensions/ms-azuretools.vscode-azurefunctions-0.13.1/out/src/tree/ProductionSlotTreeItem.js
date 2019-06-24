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
const ProjectSettings_1 = require("../ProjectSettings");
const SlotsTreeItem_1 = require("./SlotsTreeItem");
const SlotTreeItem_1 = require("./SlotTreeItem");
const SlotTreeItemBase_1 = require("./SlotTreeItemBase");
class ProductionSlotTreeItem extends SlotTreeItemBase_1.SlotTreeItemBase {
    constructor(parent, client, isLinuxPreview) {
        super(parent, client, isLinuxPreview);
        this.contextValue = ProductionSlotTreeItem.contextValue;
        this._slotsTreeItem = new SlotsTreeItem_1.SlotsTreeItem(this);
    }
    get label() {
        return this.root.client.fullName;
    }
    loadMoreChildrenImpl() {
        const _super = name => super[name];
        return __awaiter(this, void 0, void 0, function* () {
            const children = yield _super("loadMoreChildrenImpl").call(this);
            if (ProjectSettings_1.getFuncExtensionSetting('enableSlots')) {
                children.push(this._slotsTreeItem);
            }
            return children;
        });
    }
    pickTreeItemImpl(expectedContextValue) {
        switch (expectedContextValue) {
            case SlotsTreeItem_1.SlotsTreeItem.contextValue:
            case SlotTreeItem_1.SlotTreeItem.contextValue:
                return this._slotsTreeItem;
            default:
                return super.pickTreeItemImpl(expectedContextValue);
        }
    }
}
ProductionSlotTreeItem.contextValue = 'azFuncProductionSlot';
exports.ProductionSlotTreeItem = ProductionSlotTreeItem;
//# sourceMappingURL=ProductionSlotTreeItem.js.map
"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const SlotTreeItemBase_1 = require("./SlotTreeItemBase");
class SlotTreeItem extends SlotTreeItemBase_1.SlotTreeItemBase {
    constructor(parent, client, isLinuxPreview) {
        super(parent, client, isLinuxPreview);
        this.contextValue = SlotTreeItem.contextValue;
    }
    get label() {
        // tslint:disable-next-line:no-non-null-assertion
        return this.root.client.slotName;
    }
}
SlotTreeItem.contextValue = 'azFuncSlot';
exports.SlotTreeItem = SlotTreeItem;
//# sourceMappingURL=SlotTreeItem.js.map
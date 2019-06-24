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
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const extensionVariables_1 = require("../extensionVariables");
const nodeUtils_1 = require("../utils/nodeUtils");
function createFunctionApp(subscription, resourceGroup) {
    return __awaiter(this, void 0, void 0, function* () {
        let node;
        if (typeof subscription === 'string') {
            node = yield nodeUtils_1.nodeUtils.getSubscriptionNode(extensionVariables_1.ext.tree, subscription);
        }
        else if (!subscription) {
            node = (yield extensionVariables_1.ext.tree.showTreeItemPicker(vscode_azureextensionui_1.SubscriptionTreeItem.contextValue));
        }
        else {
            node = subscription;
        }
        const funcAppNode = yield node.createChild({ actionContext: this, resourceGroup });
        return funcAppNode.fullId;
    });
}
exports.createFunctionApp = createFunctionApp;
//# sourceMappingURL=createFunctionApp.js.map
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
const clipboardy = require("clipboardy");
const extensionVariables_1 = require("../extensionVariables");
const localize_1 = require("../localize");
const FunctionTreeItem_1 = require("../tree/FunctionTreeItem");
function copyFunctionUrl(node) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!node) {
            node = (yield extensionVariables_1.ext.tree.showTreeItemPicker(FunctionTreeItem_1.FunctionTreeItem.contextValue));
        }
        if (node.config.isHttpTrigger) {
            yield clipboardy.write(node.triggerUrl);
        }
        else {
            throw new Error(localize_1.localize('CopyFailedForNonHttp', 'Function URLs can only be used for HTTP triggers.'));
        }
    });
}
exports.copyFunctionUrl = copyFunctionUrl;
//# sourceMappingURL=copyFunctionUrl.js.map
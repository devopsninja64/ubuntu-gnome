"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Namespace for common variables used throughout the extension. They must be initialized in the activate() method of extension.ts
 */
var ext;
(function (ext) {
    ext.funcCliPath = 'func';
})(ext = exports.ext || (exports.ext = {}));
var TemplateSource;
(function (TemplateSource) {
    TemplateSource["Backup"] = "Backup";
    TemplateSource["CliFeed"] = "CliFeed";
    TemplateSource["StagingCliFeed"] = "StagingCliFeed";
})(TemplateSource = exports.TemplateSource || (exports.TemplateSource = {}));
//# sourceMappingURL=extensionVariables.js.map
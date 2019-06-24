"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("../../constants");
const localize_1 = require("../../localize");
const ScriptProjectCreatorBase_1 = require("./ScriptProjectCreatorBase");
class CSharpScriptProjectCreator extends ScriptProjectCreatorBase_1.ScriptProjectCreatorBase {
    constructor() {
        super(...arguments);
        this.templateFilter = constants_1.TemplateFilter.Core;
        this.deploySubpath = '.';
    }
    getLaunchJson() {
        return {
            version: '0.2.0',
            configurations: [
                {
                    name: localize_1.localize('azFunc.attachToNetCoreFunc', "Attach to C# Script Functions"),
                    type: 'coreclr',
                    request: 'attach',
                    processId: '\${command:azureFunctions.pickProcess}'
                }
            ]
        };
    }
    getRecommendedExtensions() {
        return super.getRecommendedExtensions().concat(['ms-vscode.csharp']);
    }
}
exports.CSharpScriptProjectCreator = CSharpScriptProjectCreator;
//# sourceMappingURL=CSharpScriptProjectCreator.js.map
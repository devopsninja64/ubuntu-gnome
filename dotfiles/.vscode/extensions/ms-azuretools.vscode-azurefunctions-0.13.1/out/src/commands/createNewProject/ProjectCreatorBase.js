"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
class ProjectCreatorBase {
    constructor(functionAppPath, actionContext, runtime) {
        this.deploySubpath = '';
        this.preDeployTask = '';
        this.excludedFiles = '';
        this.otherSettings = {};
        this.functionAppPath = functionAppPath;
        this.actionContext = actionContext;
        this.runtime = runtime;
    }
    getLaunchJson() {
        // By default languages do not support attaching on F5. Each language that supports F5'ing will have to overwrite this method in the subclass
        return undefined;
    }
    getRecommendedExtensions() {
        return ['ms-azuretools.vscode-azurefunctions'];
    }
}
exports.ProjectCreatorBase = ProjectCreatorBase;
exports.funcWatchProblemMatcher = '$func-watch';
//# sourceMappingURL=ProjectCreatorBase.js.map
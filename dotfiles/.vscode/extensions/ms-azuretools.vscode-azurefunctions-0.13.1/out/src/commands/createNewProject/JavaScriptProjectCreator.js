"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("../../constants");
const funcHostTask_1 = require("../../funcCoreTools/funcHostTask");
const localize_1 = require("../../localize");
const ProjectCreatorBase_1 = require("./ProjectCreatorBase");
const ScriptProjectCreatorBase_1 = require("./ScriptProjectCreatorBase");
exports.funcNodeDebugArgs = '--inspect=5858';
exports.funcNodeDebugEnvVar = 'languageWorkers__node__arguments';
class JavaScriptProjectCreator extends ScriptProjectCreatorBase_1.ScriptProjectCreatorBase {
    constructor() {
        super(...arguments);
        this.templateFilter = constants_1.TemplateFilter.Verified;
        this.deploySubpath = '.';
        // "func extensions install" task creates C# build artifacts that should be hidden
        // See issue: https://github.com/Microsoft/vscode-azurefunctions/pull/699
        this.excludedFiles = ['obj', 'bin'];
        this.functionsWorkerRuntime = 'node';
    }
    getLaunchJson() {
        return {
            version: '0.2.0',
            configurations: [
                {
                    name: localize_1.localize('azFunc.attachToJavaScriptFunc', 'Attach to JavaScript Functions'),
                    type: 'node',
                    request: 'attach',
                    port: 5858,
                    preLaunchTask: funcHostTask_1.funcHostTaskLabel
                }
            ]
        };
    }
    getTasksJson() {
        let options;
        // tslint:disable-next-line:no-any
        const funcTask = {
            label: funcHostTask_1.funcHostTaskLabel,
            type: 'shell',
            command: funcHostTask_1.funcHostCommand,
            isBackground: true,
            problemMatcher: ProjectCreatorBase_1.funcWatchProblemMatcher
        };
        const installExtensionsTask = {
            label: constants_1.installExtensionsId,
            command: 'func extensions install',
            type: 'shell'
        };
        // tslint:disable-next-line:no-unsafe-any
        const tasks = [funcTask];
        if (this.runtime !== constants_1.ProjectRuntime.v1) {
            options = {};
            options.env = {};
            options.env[exports.funcNodeDebugEnvVar] = exports.funcNodeDebugArgs;
            // tslint:disable-next-line:no-unsafe-any
            funcTask.options = options;
            // tslint:disable-next-line:no-unsafe-any
            funcTask.dependsOn = constants_1.installExtensionsId;
            this.preDeployTask = constants_1.installExtensionsId;
            tasks.push(installExtensionsTask);
        }
        return {
            version: '2.0.0',
            tasks: tasks
        };
    }
}
exports.JavaScriptProjectCreator = JavaScriptProjectCreator;
//# sourceMappingURL=JavaScriptProjectCreator.js.map
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
const fse = require("fs-extra");
const path = require("path");
const constants_1 = require("../../constants");
const funcHostTask_1 = require("../../funcCoreTools/funcHostTask");
const fs_1 = require("../../utils/fs");
const ProjectCreatorBase_1 = require("./ProjectCreatorBase");
// tslint:disable-next-line:no-multiline-string
const gitignore = `bin
obj
csx
.vs
edge
Publish

*.user
*.suo
*.cscfg
*.Cache
project.lock.json

/packages
/TestResults

/tools/NuGet.exe
/App_Data
/secrets
/data
.secrets
appsettings.json
local.settings.json

node_modules
`;
/**
 * Base class for all projects based on a simple script (i.e. JavaScript, C# Script, Bash, etc.) that don't require compilation
 */
class ScriptProjectCreatorBase extends ProjectCreatorBase_1.ProjectCreatorBase {
    constructor() {
        super(...arguments);
        // Default template filter to 'All' since preview languages have not been 'verified'
        this.templateFilter = constants_1.TemplateFilter.All;
    }
    getTasksJson() {
        return {
            version: '2.0.0',
            tasks: [
                {
                    label: funcHostTask_1.funcHostTaskLabel,
                    type: 'shell',
                    command: funcHostTask_1.funcHostCommand,
                    isBackground: true,
                    problemMatcher: ProjectCreatorBase_1.funcWatchProblemMatcher
                }
            ]
        };
    }
    onCreateNewProject() {
        return __awaiter(this, void 0, void 0, function* () {
            const hostJsonPath = path.join(this.functionAppPath, constants_1.hostFileName);
            if (yield fs_1.confirmOverwriteFile(hostJsonPath)) {
                const hostJson = {
                    version: '2.0'
                };
                yield fs_1.writeFormattedJson(hostJsonPath, hostJson);
            }
            const localSettingsJsonPath = path.join(this.functionAppPath, constants_1.localSettingsFileName);
            if (yield fs_1.confirmOverwriteFile(localSettingsJsonPath)) {
                const localSettingsJson = {
                    IsEncrypted: false,
                    Values: {
                        AzureWebJobsStorage: ''
                    }
                };
                if (this.functionsWorkerRuntime) {
                    // tslint:disable-next-line:no-non-null-assertion
                    localSettingsJson.Values.FUNCTIONS_WORKER_RUNTIME = this.functionsWorkerRuntime;
                }
                yield fs_1.writeFormattedJson(localSettingsJsonPath, localSettingsJson);
            }
            const proxiesJsonPath = path.join(this.functionAppPath, constants_1.proxiesFileName);
            if (yield fs_1.confirmOverwriteFile(proxiesJsonPath)) {
                const proxiesJson = {
                    // tslint:disable-next-line:no-http-string
                    $schema: 'http://json.schemastore.org/proxies',
                    proxies: {}
                };
                yield fs_1.writeFormattedJson(proxiesJsonPath, proxiesJson);
            }
            const gitignorePath = path.join(this.functionAppPath, constants_1.gitignoreFileName);
            if (yield fs_1.confirmOverwriteFile(gitignorePath)) {
                yield fse.writeFile(gitignorePath, gitignore);
            }
        });
    }
    onInitProjectForVSCode() {
        return __awaiter(this, void 0, void 0, function* () {
            // nothing to do here
        });
    }
}
ScriptProjectCreatorBase.defaultRuntime = constants_1.ProjectRuntime.v1;
exports.ScriptProjectCreatorBase = ScriptProjectCreatorBase;
//# sourceMappingURL=ScriptProjectCreatorBase.js.map
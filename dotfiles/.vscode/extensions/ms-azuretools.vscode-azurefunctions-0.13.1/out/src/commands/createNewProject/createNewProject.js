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
const vscode_1 = require("vscode");
const constants_1 = require("../../constants");
const extensionVariables_1 = require("../../extensionVariables");
const getLocalFuncCoreToolsVersion_1 = require("../../funcCoreTools/getLocalFuncCoreToolsVersion");
const validateFuncCoreToolsInstalled_1 = require("../../funcCoreTools/validateFuncCoreToolsInstalled");
const localize_1 = require("../../localize");
const ProjectSettings_1 = require("../../ProjectSettings");
const gitUtils_1 = require("../../utils/gitUtils");
const workspaceUtil = require("../../utils/workspace");
const createFunction_1 = require("../createFunction/createFunction");
const CSharpProjectCreator_1 = require("./CSharpProjectCreator");
const CSharpScriptProjectCreator_1 = require("./CSharpScriptProjectCreator");
const initProjectForVSCode_1 = require("./initProjectForVSCode");
const JavaProjectCreator_1 = require("./JavaProjectCreator");
const JavaScriptProjectCreator_1 = require("./JavaScriptProjectCreator");
const PythonProjectCreator_1 = require("./PythonProjectCreator");
const ScriptProjectCreatorBase_1 = require("./ScriptProjectCreatorBase");
function createNewProject(actionContext, functionAppPath, language, runtime, openFolder = true, templateId, functionName, caseSensitiveFunctionSettings) {
    return __awaiter(this, void 0, void 0, function* () {
        getLocalFuncCoreToolsVersion_1.addLocalFuncTelemetry(actionContext);
        if (functionAppPath === undefined) {
            functionAppPath = yield workspaceUtil.selectWorkspaceFolder(extensionVariables_1.ext.ui, localize_1.localize('azFunc.selectFunctionAppFolderNew', 'Select the folder that will contain your function app'));
        }
        yield fse.ensureDir(functionAppPath);
        if (!language) {
            language = ProjectSettings_1.getGlobalFuncExtensionSetting(constants_1.projectLanguageSetting);
            if (!language) {
                const previewDescription = localize_1.localize('previewDescription', '(Preview)');
                // Only display 'supported' languages that can be debugged in VS Code
                const languagePicks = [
                    { label: constants_1.ProjectLanguage.JavaScript, description: '' },
                    { label: constants_1.ProjectLanguage.CSharp, description: '' },
                    { label: constants_1.ProjectLanguage.Python, description: previewDescription },
                    { label: constants_1.ProjectLanguage.Java, description: previewDescription }
                ];
                const options = { placeHolder: localize_1.localize('azFunc.selectFuncTemplate', 'Select a language for your function project') };
                language = (yield extensionVariables_1.ext.ui.showQuickPick(languagePicks, options)).label;
            }
        }
        actionContext.properties.projectLanguage = language;
        yield vscode_1.window.withProgress({ location: vscode_1.ProgressLocation.Notification, title: localize_1.localize('creating', 'Creating new project...') }, () => __awaiter(this, void 0, void 0, function* () {
            // tslint:disable-next-line:no-non-null-assertion
            functionAppPath = functionAppPath;
            // tslint:disable-next-line:no-non-null-assertion
            language = language;
            const projectCreator = getProjectCreator(language, functionAppPath, actionContext, ProjectSettings_1.convertStringToRuntime(runtime));
            yield projectCreator.onCreateNewProject();
            yield initProjectForVSCode_1.initProjectForVSCode(actionContext, functionAppPath, language, projectCreator);
            if ((yield gitUtils_1.gitUtils.isGitInstalled(functionAppPath)) && !(yield gitUtils_1.gitUtils.isInsideRepo(functionAppPath))) {
                yield gitUtils_1.gitUtils.gitInit(extensionVariables_1.ext.outputChannel, functionAppPath);
            }
            if (templateId) {
                yield createFunction_1.createFunction(actionContext, functionAppPath, templateId, functionName, caseSensitiveFunctionSettings, language, projectCreator.runtime);
            }
        }));
        // don't wait
        vscode_1.window.showInformationMessage(localize_1.localize('finishedCreating', 'Finished creating project.'));
        // don't wait
        // tslint:disable-next-line:no-floating-promises
        validateFuncCoreToolsInstalled_1.validateFuncCoreToolsInstalled();
        if (openFolder) {
            yield workspaceUtil.ensureFolderIsOpen(functionAppPath, actionContext);
        }
    });
}
exports.createNewProject = createNewProject;
function getProjectCreator(language, functionAppPath, actionContext, runtime) {
    let projectCreatorType;
    switch (language) {
        case constants_1.ProjectLanguage.Java:
            projectCreatorType = JavaProjectCreator_1.JavaProjectCreator;
            break;
        case constants_1.ProjectLanguage.JavaScript:
            projectCreatorType = JavaScriptProjectCreator_1.JavaScriptProjectCreator;
            break;
        case constants_1.ProjectLanguage.CSharp:
            projectCreatorType = CSharpProjectCreator_1.CSharpProjectCreator;
            break;
        case constants_1.ProjectLanguage.CSharpScript:
            projectCreatorType = CSharpScriptProjectCreator_1.CSharpScriptProjectCreator;
            break;
        case constants_1.ProjectLanguage.Python:
            projectCreatorType = PythonProjectCreator_1.PythonProjectCreator;
            break;
        default:
            projectCreatorType = ScriptProjectCreatorBase_1.ScriptProjectCreatorBase;
            break;
    }
    return new projectCreatorType(functionAppPath, actionContext, runtime);
}
exports.getProjectCreator = getProjectCreator;
//# sourceMappingURL=createNewProject.js.map
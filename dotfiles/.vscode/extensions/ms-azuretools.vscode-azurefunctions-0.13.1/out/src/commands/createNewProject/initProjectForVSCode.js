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
const extensionVariables_1 = require("../../extensionVariables");
const tryGetLocalRuntimeVersion_1 = require("../../funcCoreTools/tryGetLocalRuntimeVersion");
const localize_1 = require("../../localize");
const ProjectSettings_1 = require("../../ProjectSettings");
const fs_1 = require("../../utils/fs");
const workspaceUtil = require("../../utils/workspace");
const createNewProject_1 = require("./createNewProject");
const detectProjectLanguage_1 = require("./detectProjectLanguage");
function initProjectForVSCode(actionContext, functionAppPath, language, projectCreator) {
    return __awaiter(this, void 0, void 0, function* () {
        const telemetryProperties = actionContext.properties;
        if (functionAppPath === undefined) {
            functionAppPath = yield workspaceUtil.selectWorkspaceFolder(extensionVariables_1.ext.ui, localize_1.localize('azFunc.selectFunctionAppFolderNew', 'Select the folder to initialize for use with VS Code'));
        }
        yield fse.ensureDir(functionAppPath);
        if (!language) {
            // tslint:disable-next-line:strict-boolean-expressions
            language = ProjectSettings_1.getGlobalFuncExtensionSetting(constants_1.projectLanguageSetting) || (yield detectProjectLanguage_1.detectProjectLanguage(functionAppPath)) || (yield ProjectSettings_1.promptForProjectLanguage(extensionVariables_1.ext.ui));
        }
        telemetryProperties.projectLanguage = language;
        extensionVariables_1.ext.outputChannel.appendLine(localize_1.localize('usingLanguage', 'Using "{0}" as the project language...', language));
        if (!projectCreator) {
            const defaultRuntime = ProjectSettings_1.getGlobalFuncExtensionSetting(constants_1.projectRuntimeSetting);
            projectCreator = createNewProject_1.getProjectCreator(language, functionAppPath, actionContext, ProjectSettings_1.convertStringToRuntime(defaultRuntime));
        }
        yield projectCreator.onInitProjectForVSCode();
        if (projectCreator.runtime === undefined) {
            // tslint:disable-next-line:strict-boolean-expressions
            projectCreator.runtime = (yield tryGetLocalRuntimeVersion_1.tryGetLocalRuntimeVersion()) || (yield ProjectSettings_1.promptForProjectRuntime());
        }
        extensionVariables_1.ext.outputChannel.appendLine(localize_1.localize('usingRuntime', 'Using "{0}" as the project runtime...', projectCreator.runtime));
        telemetryProperties.projectRuntime = projectCreator.runtime;
        // tslint:disable-next-line:strict-boolean-expressions
        const templateFilter = ProjectSettings_1.getGlobalFuncExtensionSetting(constants_1.templateFilterSetting) || projectCreator.templateFilter;
        extensionVariables_1.ext.outputChannel.appendLine(localize_1.localize('usingTemplateFilter', 'Using "{0}" as the project templateFilter...', templateFilter));
        telemetryProperties.templateFilter = templateFilter;
        const vscodePath = path.join(functionAppPath, '.vscode');
        yield fse.ensureDir(vscodePath);
        extensionVariables_1.ext.outputChannel.appendLine(localize_1.localize('writingDebugConfig', 'Writing project debug configuration...'));
        yield writeDebugConfiguration(projectCreator, vscodePath);
        extensionVariables_1.ext.outputChannel.appendLine(localize_1.localize('writingSettings', 'Writing project settings...'));
        yield writeVSCodeSettings(projectCreator, vscodePath, language, templateFilter);
        extensionVariables_1.ext.outputChannel.appendLine(localize_1.localize('writingRecommendations', 'Writing extension recommendations...'));
        yield writeExtensionRecommendations(projectCreator, vscodePath);
        // Remove '.vscode' from gitignore if applicable
        const gitignorePath = path.join(functionAppPath, constants_1.gitignoreFileName);
        if (yield fse.pathExists(gitignorePath)) {
            extensionVariables_1.ext.outputChannel.appendLine(localize_1.localize('gitignoreVSCode', 'Verifying ".vscode" is not listed in gitignore...'));
            let gitignoreContents = (yield fse.readFile(gitignorePath)).toString();
            gitignoreContents = gitignoreContents.replace(/^\.vscode\s*$/gm, '');
            yield fse.writeFile(gitignorePath, gitignoreContents);
        }
        extensionVariables_1.ext.outputChannel.appendLine(localize_1.localize('finishedInitializing', 'Finished initializing for use with VS Code.'));
        return projectCreator;
    });
}
exports.initProjectForVSCode = initProjectForVSCode;
function writeDebugConfiguration(projectCreator, vscodePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const tasksJsonPath = path.join(vscodePath, 'tasks.json');
        if (yield fs_1.confirmOverwriteFile(tasksJsonPath)) {
            yield fs_1.writeFormattedJson(tasksJsonPath, projectCreator.getTasksJson());
        }
        const launchJson = projectCreator.getLaunchJson();
        if (launchJson) {
            const launchJsonPath = path.join(vscodePath, 'launch.json');
            if (yield fs_1.confirmOverwriteFile(launchJsonPath)) {
                yield fs_1.writeFormattedJson(launchJsonPath, launchJson);
            }
        }
    });
}
function writeVSCodeSettings(projectCreator, vscodePath, language, templateFilter) {
    return __awaiter(this, void 0, void 0, function* () {
        const settingsJsonPath = path.join(vscodePath, 'settings.json');
        yield fs_1.confirmEditJsonFile(settingsJsonPath, (data) => {
            data[`${constants_1.extensionPrefix}.${constants_1.projectRuntimeSetting}`] = projectCreator.runtime;
            data[`${constants_1.extensionPrefix}.${constants_1.projectLanguageSetting}`] = language;
            data[`${constants_1.extensionPrefix}.${constants_1.templateFilterSetting}`] = templateFilter;
            if (projectCreator.deploySubpath) {
                data[`${constants_1.extensionPrefix}.${constants_1.deploySubpathSetting}`] = projectCreator.deploySubpath;
            }
            if (projectCreator.preDeployTask) {
                data[`${constants_1.extensionPrefix}.${constants_1.preDeployTaskSetting}`] = projectCreator.preDeployTask;
            }
            if (projectCreator.excludedFiles) {
                data[constants_1.filesExcludeSetting] = addToFilesExcludeSetting(projectCreator.excludedFiles, data);
            }
            for (const key of Object.keys(projectCreator.otherSettings)) {
                data[key] = projectCreator.otherSettings[key];
            }
            // We want the terminal to be open after F5, not the debug console (Since http triggers are printed in the terminal)
            data['debug.internalConsoleOptions'] = 'neverOpen';
            return data;
        });
    });
}
function writeExtensionRecommendations(projectCreator, vscodePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const extensionsJsonPath = path.join(vscodePath, 'extensions.json');
        yield fs_1.confirmEditJsonFile(extensionsJsonPath, (data) => {
            let recommendations = projectCreator.getRecommendedExtensions();
            if (data.recommendations) {
                recommendations = recommendations.concat(data.recommendations);
            }
            // de-dupe array
            data.recommendations = recommendations.filter((rec, index) => recommendations.indexOf(rec) === index);
            return data;
        });
    });
}
function addToFilesExcludeSetting(filesToExclude, data) {
    // tslint:disable-next-line:no-unsafe-any
    const workspaceExcludedFiles = data[constants_1.filesExcludeSetting] ? data[constants_1.filesExcludeSetting] : {};
    // if multiple directories were passed in, iterate over and include to files.exclude
    if (Array.isArray(filesToExclude)) {
        for (const file of filesToExclude) {
            workspaceExcludedFiles[file] = true;
        }
    }
    else {
        workspaceExcludedFiles[filesToExclude] = true;
    }
    return workspaceExcludedFiles;
}
//# sourceMappingURL=initProjectForVSCode.js.map
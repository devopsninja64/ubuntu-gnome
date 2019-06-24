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
const assert = require("assert");
const fse = require("fs-extra");
const os = require("os");
const path = require("path");
const semver = require("semver");
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const constants_1 = require("../../constants");
const extensionVariables_1 = require("../../extensionVariables");
const funcHostTask_1 = require("../../funcCoreTools/funcHostTask");
const validateFuncCoreToolsInstalled_1 = require("../../funcCoreTools/validateFuncCoreToolsInstalled");
const LocalAppSettings_1 = require("../../LocalAppSettings");
const localize_1 = require("../../localize");
const ProjectSettings_1 = require("../../ProjectSettings");
const cpUtils_1 = require("../../utils/cpUtils");
const fsUtil = require("../../utils/fs");
const ProjectCreatorBase_1 = require("./ProjectCreatorBase");
const ScriptProjectCreatorBase_1 = require("./ScriptProjectCreatorBase");
exports.pythonVenvSetting = 'pythonVenv';
const fullPythonVenvSetting = `${constants_1.extensionPrefix}.${exports.pythonVenvSetting}`;
const minPythonVersion = '3.6.0';
const maxPythonVersion = '3.7.0';
const minPythonVersionLabel = '3.6.x'; // Use invalid semver as the label to make it more clear that any patch version is allowed
class PythonProjectCreator extends ScriptProjectCreatorBase_1.ScriptProjectCreatorBase {
    constructor(functionAppPath, actionContext, runtime) {
        super(functionAppPath, actionContext, runtime);
        this.templateFilter = constants_1.TemplateFilter.Verified;
        this.preDeployTask = constants_1.funcPackId;
        // "func extensions install" task creates C# build artifacts that should be hidden
        // See issue: https://github.com/Microsoft/vscode-azurefunctions/pull/699
        this.excludedFiles = ['obj', 'bin'];
        assert.notEqual(runtime, constants_1.ProjectRuntime.v1, localize_1.localize('noV1', 'Python does not support runtime "{0}".', constants_1.ProjectRuntime.v1));
        this.runtime = constants_1.ProjectRuntime.v2;
    }
    getLaunchJson() {
        return {
            version: '0.2.0',
            configurations: [
                {
                    name: localize_1.localize('azFunc.attachToJavaScriptFunc', 'Attach to Python Functions'),
                    type: 'python',
                    request: 'attach',
                    port: 9091,
                    host: 'localhost',
                    preLaunchTask: funcHostTask_1.funcHostTaskLabel
                }
            ]
        };
    }
    onCreateNewProject() {
        return __awaiter(this, void 0, void 0, function* () {
            const funcCoreRequired = localize_1.localize('funcCoreRequired', 'Azure Functions Core Tools must be installed to create, debug, and deploy local Python Functions projects.');
            if (!(yield validateFuncCoreToolsInstalled_1.validateFuncCoreToolsInstalled(true /* forcePrompt */, funcCoreRequired))) {
                throw new vscode_azureextensionui_1.UserCancelledError();
            }
            this._venvName = yield this.ensureVenv();
            yield runPythonCommandInVenv(this._venvName, this.functionAppPath, `${extensionVariables_1.ext.funcCliPath} init ./ --worker-runtime python`);
        });
    }
    onInitProjectForVSCode() {
        return __awaiter(this, void 0, void 0, function* () {
            this.deploySubpath = `${path.basename(this.functionAppPath)}.zip`;
            if (!this._venvName) {
                this._venvName = yield this.ensureVenv();
            }
            yield makeVenvDebuggable(this._venvName, this.functionAppPath);
            yield this.ensureVenvInFuncIgnore(this._venvName);
            yield this.ensureGitIgnoreContents(this._venvName);
            yield this.ensureAzureWebJobsStorage();
        });
    }
    getTasksJson() {
        const funcPackCommand = 'func pack';
        const funcExtensionsCommand = 'func extensions install';
        const pipInstallCommand = 'pip install -r requirements.txt';
        const venvSettingReference = `\${config:${fullPythonVenvSetting}}`;
        return {
            version: '2.0.0',
            tasks: [
                {
                    label: funcHostTask_1.funcHostTaskLabel,
                    type: 'shell',
                    osx: {
                        command: convertToVenvCommand(venvSettingReference, constants_1.Platform.MacOS, funcExtensionsCommand, pipInstallCommand, funcHostTask_1.funcHostCommand)
                    },
                    windows: {
                        command: convertToVenvCommand(venvSettingReference, constants_1.Platform.Windows, funcExtensionsCommand, pipInstallCommand, funcHostTask_1.funcHostCommand)
                    },
                    linux: {
                        command: convertToVenvCommand(venvSettingReference, constants_1.Platform.Linux, funcExtensionsCommand, pipInstallCommand, funcHostTask_1.funcHostCommand)
                    },
                    isBackground: true,
                    options: {
                        env: {
                            languageWorkers__python__arguments: '-m ptvsd --host 127.0.0.1 --port 9091'
                        }
                    },
                    problemMatcher: ProjectCreatorBase_1.funcWatchProblemMatcher
                },
                {
                    label: constants_1.funcPackId,
                    type: 'shell',
                    osx: {
                        command: convertToVenvCommand(venvSettingReference, constants_1.Platform.MacOS, funcPackCommand)
                    },
                    windows: {
                        command: convertToVenvCommand(venvSettingReference, constants_1.Platform.Windows, funcPackCommand)
                    },
                    linux: {
                        command: convertToVenvCommand(venvSettingReference, constants_1.Platform.Linux, funcPackCommand)
                    },
                    isBackground: true
                }
            ]
        };
    }
    getRecommendedExtensions() {
        return super.getRecommendedExtensions().concat(['ms-python.python']);
    }
    ensureGitIgnoreContents(venvName) {
        return __awaiter(this, void 0, void 0, function* () {
            // .gitignore is created by `func init`
            const gitignorePath = path.join(this.functionAppPath, constants_1.gitignoreFileName);
            if (yield fse.pathExists(gitignorePath)) {
                let writeFile = false;
                let gitignoreContents = (yield fse.readFile(gitignorePath)).toString();
                function ensureInGitIgnore(newLine) {
                    if (!gitignoreContents.includes(newLine)) {
                        extensionVariables_1.ext.outputChannel.appendLine(localize_1.localize('gitAddNewLine', 'Adding "{0}" to .gitignore...', newLine));
                        gitignoreContents = gitignoreContents.concat(`${os.EOL}${newLine}`);
                        writeFile = true;
                    }
                }
                ensureInGitIgnore(venvName);
                ensureInGitIgnore('.python_packages');
                ensureInGitIgnore('__pycache__');
                ensureInGitIgnore(`${path.basename(this.functionAppPath)}.zip`);
                if (writeFile) {
                    yield fse.writeFile(gitignorePath, gitignoreContents);
                }
            }
        });
    }
    ensureAzureWebJobsStorage() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!constants_1.isWindows) {
                // Make sure local settings isn't using Storage Emulator for non-windows
                // https://github.com/Microsoft/vscode-azurefunctions/issues/583
                const localSettingsPath = path.join(this.functionAppPath, constants_1.localSettingsFileName);
                const localSettings = yield LocalAppSettings_1.getLocalSettings(localSettingsPath);
                // tslint:disable-next-line:strict-boolean-expressions
                localSettings.Values = localSettings.Values || {};
                localSettings.Values[LocalAppSettings_1.azureWebJobsStorageKey] = '';
                yield fsUtil.writeFormattedJson(localSettingsPath, localSettings);
            }
        });
    }
    ensureVenvInFuncIgnore(venvName) {
        return __awaiter(this, void 0, void 0, function* () {
            const funcIgnorePath = path.join(this.functionAppPath, '.funcignore');
            let funcIgnoreContents;
            if (yield fse.pathExists(funcIgnorePath)) {
                funcIgnoreContents = (yield fse.readFile(funcIgnorePath)).toString();
                if (funcIgnoreContents && !funcIgnoreContents.includes(venvName)) {
                    funcIgnoreContents = funcIgnoreContents.concat(`${os.EOL}${venvName}`);
                }
            }
            if (!funcIgnoreContents) {
                funcIgnoreContents = venvName;
            }
            yield fse.writeFile(funcIgnorePath, funcIgnoreContents);
        });
    }
    /**
     * Checks for an existing venv (based on the existence of the activate script). Creates one if none exists and prompts the user if multiple exist
     * @returns the venv name
     */
    ensureVenv() {
        return __awaiter(this, void 0, void 0, function* () {
            const venvs = [];
            const fsPaths = yield fse.readdir(this.functionAppPath);
            yield Promise.all(fsPaths.map((venvName) => __awaiter(this, void 0, void 0, function* () {
                const stat = yield fse.stat(path.join(this.functionAppPath, venvName));
                if (stat.isDirectory()) {
                    const venvActivatePath = getVenvActivatePath(venvName);
                    if (yield fse.pathExists(path.join(this.functionAppPath, venvActivatePath))) {
                        venvs.push(venvName);
                    }
                }
            })));
            let result;
            if (venvs.length === 0) {
                result = '.env'; // default name
                yield createVirtualEnviornment(result, this.functionAppPath);
            }
            else if (venvs.length === 1) {
                result = venvs[0];
            }
            else {
                const picks = venvs.map((venv) => { return { label: venv }; });
                const options = {
                    placeHolder: localize_1.localize('multipleVenv', 'Detected multiple virtual environments. Select one to use for your project.'),
                    suppressPersistence: true
                };
                result = (yield extensionVariables_1.ext.ui.showQuickPick(picks, options)).label;
            }
            this.otherSettings[fullPythonVenvSetting] = result;
            return result;
        });
    }
}
exports.PythonProjectCreator = PythonProjectCreator;
/**
 * Returns undefined if valid or an error message if not
 */
function validatePythonAlias(pyAlias, validateMaxVersion = false) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const result = yield cpUtils_1.cpUtils.tryExecuteCommand(undefined /*don't display output*/, undefined /*default to cwd*/, `${pyAlias} --version`);
            if (result.code !== 0) {
                return localize_1.localize('failValidate', 'Failed to validate version: {0}', result.cmdOutputIncludingStderr);
            }
            const matches = result.cmdOutputIncludingStderr.match(/^Python (\S*)/i);
            if (matches === null || !matches[1]) {
                return localize_1.localize('failedParse', 'Failed to parse version: {0}', result.cmdOutputIncludingStderr);
            }
            else {
                const pyVersion = matches[1];
                if (semver.lt(pyVersion, minPythonVersion)) {
                    return localize_1.localize('tooLowVersion', 'Python version "{0}" is below minimum version of "{1}".', pyVersion, minPythonVersion);
                }
                else if (validateMaxVersion && semver.gte(pyVersion, maxPythonVersion)) {
                    return localize_1.localize('tooHighVersion', 'Python version "{0}" is greater than or equal to the maximum version of "{1}".', pyVersion, maxPythonVersion);
                }
                else {
                    return undefined;
                }
            }
        }
        catch (error) {
            return vscode_azureextensionui_1.parseError(error).message;
        }
    });
}
function convertToVenvCommand(venvName, platform, ...commands) {
    return cpUtils_1.cpUtils.joinCommands(platform, getVenvActivateCommand(venvName, platform), ...commands);
}
function getVenvActivatePath(venvName, platform = process.platform) {
    switch (platform) {
        case constants_1.Platform.Windows:
            return path.join('.', venvName, 'Scripts', 'activate');
        default:
            return path.join('.', venvName, 'bin', 'activate');
    }
}
function getVenvActivateCommand(venvName, platform) {
    const venvActivatePath = getVenvActivatePath(venvName, platform);
    switch (platform) {
        case constants_1.Platform.Windows:
            return venvActivatePath;
        default:
            return `. ${venvActivatePath}`;
    }
}
function getPythonAlias() {
    return __awaiter(this, void 0, void 0, function* () {
        const aliasesToTry = ['python3.6', 'py -3.6', 'python3', 'python', 'py'];
        const globalPythonPathSetting = ProjectSettings_1.getGlobalFuncExtensionSetting('pythonPath', 'python');
        if (globalPythonPathSetting) {
            aliasesToTry.unshift(globalPythonPathSetting);
        }
        for (const alias of aliasesToTry) {
            // Validate max version when silently picking the alias for the user
            const errorMessage = yield validatePythonAlias(alias, true /* validateMaxVersion */);
            if (!errorMessage) {
                return alias;
            }
        }
        const prompt = localize_1.localize('pyAliasPlaceholder', 'Enter the alias or full path of the Python "{0}" executable to use.', minPythonVersionLabel);
        // Don't validate max version when prompting (because the Functions team will assumably support 3.7+ at some point and we don't want to block people from using that)
        return yield extensionVariables_1.ext.ui.showInputBox({ prompt, validateInput: validatePythonAlias });
    });
}
function createVirtualEnviornment(venvName, functionAppPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const pythonAlias = yield getPythonAlias();
        yield cpUtils_1.cpUtils.executeCommand(extensionVariables_1.ext.outputChannel, functionAppPath, pythonAlias, '-m', 'venv', venvName);
    });
}
exports.createVirtualEnviornment = createVirtualEnviornment;
function makeVenvDebuggable(venvName, functionAppPath) {
    return __awaiter(this, void 0, void 0, function* () {
        // install ptvsd - required for debugging in VS Code
        yield runPythonCommandInVenv(venvName, functionAppPath, 'pip install ptvsd');
        // install pylint - helpful for debugging in VS Code
        yield runPythonCommandInVenv(venvName, functionAppPath, 'pip install pylint');
    });
}
exports.makeVenvDebuggable = makeVenvDebuggable;
function runPythonCommandInVenv(venvName, folderPath, command) {
    return __awaiter(this, void 0, void 0, function* () {
        // executeCommand always uses Linux '&&' separator, even on Windows
        const fullCommand = cpUtils_1.cpUtils.joinCommands(constants_1.Platform.Linux, getVenvActivateCommand(venvName, process.platform), command);
        yield cpUtils_1.cpUtils.executeCommand(extensionVariables_1.ext.outputChannel, folderPath, fullCommand);
    });
}
exports.runPythonCommandInVenv = runPythonCommandInVenv;
//# sourceMappingURL=PythonProjectCreator.js.map
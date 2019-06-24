"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const extension_1 = require("../../extension");
const kuberesources_objectmodel_1 = require("../../kuberesources.objectmodel");
const kuberesources = require("../../kuberesources");
const yaml = require("js-yaml");
const kubectlUtils = require("../../kubectlUtils");
var LogsDisplayMode;
(function (LogsDisplayMode) {
    LogsDisplayMode[LogsDisplayMode["Show"] = 0] = "Show";
    LogsDisplayMode[LogsDisplayMode["Follow"] = 1] = "Follow";
})(LogsDisplayMode = exports.LogsDisplayMode || (exports.LogsDisplayMode = {}));
/**
 * Fetches logs for a Pod. Handles use cases for fetching pods
 * from an open document, or from the current namespace.
 */
function logsKubernetes(kubectl, explorerNode, displayMode) {
    return __awaiter(this, void 0, void 0, function* () {
        if (explorerNode) {
            return yield getLogsForExplorerPod(kubectl, explorerNode, displayMode);
        }
        return logsForPod(kubectl, displayMode);
    });
}
exports.logsKubernetes = logsKubernetes;
/**
 * Fetch logs from a Pod, when selected from the Explorer.
 */
function getLogsForExplorerPod(kubectl, explorerNode, displayMode) {
    return __awaiter(this, void 0, void 0, function* () {
        const namespace = explorerNode.namespace;
        const podSummary = { name: explorerNode.id, namespace: namespace };
        return yield getLogsForPod(kubectl, podSummary, displayMode);
    });
}
/**
 * Fetches logs for a pod. If there are more than one containers,
 * prompts the user for which container to fetch logs for.
 */
function getLogsForPod(kubectl, podSummary, displayMode) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!podSummary) {
            vscode.window.showErrorMessage('Can\'t find a pod!');
            return;
        }
        const container = yield extension_1.selectContainerForPod(podSummary);
        if (!container) {
            return;
        }
        getLogsForContainer(kubectl, podSummary, container.name, displayMode);
    });
}
/**
 * Gets the logs for a container in a provided pod, in a provided namespace, in a provided container.
 */
function getLogsForContainer(kubectl, podSummary, containerName, displayMode) {
    let cmd = `logs ${podSummary.name}`;
    if (podSummary.namespace) {
        cmd = `${cmd} --namespace=${podSummary.namespace}`;
    }
    if (containerName) {
        cmd = `${cmd} --container=${containerName}`;
    }
    if (displayMode === LogsDisplayMode.Follow) {
        cmd = `${cmd} -f`;
        kubectl.invokeInNewTerminal(cmd, `${podSummary.name}-${containerName}`);
        return;
    }
    kubectl.invokeInSharedTerminal(cmd);
}
/**
 * Searches for a pod yaml spec from the open document
 * or from the currently selected namespace.
 */
function logsForPod(kubectl, displayMode) {
    return __awaiter(this, void 0, void 0, function* () {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            return yield logsForPodFromOpenDocument(kubectl, editor, displayMode);
        }
        return yield logsForPodFromCurrentNamespace(kubectl, displayMode);
    });
}
/**
 * Finds a Pod from the open editor.
 */
function logsForPodFromOpenDocument(kubectl, editor, displayMode) {
    return __awaiter(this, void 0, void 0, function* () {
        const text = editor.document.getText();
        try {
            const obj = yaml.safeLoad(text);
            if (kuberesources_objectmodel_1.isPod(obj)) {
                // document describes a pod.
                const podSummary = {
                    name: obj.metadata.name,
                    namespace: obj.metadata.namespace
                };
                return yield getLogsForPod(kubectl, podSummary, displayMode);
            }
        }
        catch (ex) {
            // pass
        }
        return yield logsForPodFromCurrentNamespace(kubectl, displayMode);
    });
}
/**
 * Alerts the user on pods available in the current namespace.
 */
function logsForPodFromCurrentNamespace(kubectl, displayMode) {
    return __awaiter(this, void 0, void 0, function* () {
        const namespace = yield kubectlUtils.currentNamespace(kubectl);
        extension_1.quickPickKindName([kuberesources.allKinds.pod], { nameOptional: false }, (pod) => __awaiter(this, void 0, void 0, function* () {
            const podSummary = {
                name: pod.split('/')[1],
                namespace: namespace // should figure out how to handle namespaces.
            };
            yield getLogsForPod(kubectl, podSummary, displayMode);
        }));
    });
}
//# sourceMappingURL=logs.js.map
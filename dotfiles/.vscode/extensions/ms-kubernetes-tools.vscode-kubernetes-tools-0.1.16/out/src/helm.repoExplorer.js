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
const path = require("path");
const vscode = require("vscode");
const _ = require("lodash");
const helm = require("./helm.exec");
const helm_1 = require("./helm");
const errorable_1 = require("./errorable");
const outputUtils_1 = require("./outputUtils");
const config_1 = require("./components/config/config");
function create(host) {
    return new HelmRepoExplorer(host);
}
exports.create = create;
var RepoExplorerObjectKind;
(function (RepoExplorerObjectKind) {
    RepoExplorerObjectKind[RepoExplorerObjectKind["Repo"] = 0] = "Repo";
    RepoExplorerObjectKind[RepoExplorerObjectKind["Chart"] = 1] = "Chart";
    RepoExplorerObjectKind[RepoExplorerObjectKind["ChartVersion"] = 2] = "ChartVersion";
    RepoExplorerObjectKind[RepoExplorerObjectKind["Error"] = 3] = "Error";
})(RepoExplorerObjectKind = exports.RepoExplorerObjectKind || (exports.RepoExplorerObjectKind = {}));
function isHelmRepo(o) {
    return o && o.kind === RepoExplorerObjectKind.Repo;
}
exports.isHelmRepo = isHelmRepo;
function isHelmRepoChart(o) {
    return o && o.kind === RepoExplorerObjectKind.Chart;
}
exports.isHelmRepoChart = isHelmRepoChart;
function isHelmRepoChartVersion(o) {
    return o && o.kind === RepoExplorerObjectKind.ChartVersion;
}
exports.isHelmRepoChartVersion = isHelmRepoChartVersion;
class HelmRepoExplorer {
    constructor(host) {
        this.host = host;
        this.onDidChangeTreeDataEmitter = new vscode.EventEmitter();
        this.onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
        host.onDidChangeConfiguration((change) => {
            if (config_1.affectsUs(change)) {
                this.refresh();
            }
        });
    }
    getTreeItem(element) {
        return element.getTreeItem();
    }
    getChildren(parent) {
        if (parent) {
            return parent.getChildren();
        }
        return this.getHelmRepos();
    }
    getHelmRepos() {
        return __awaiter(this, void 0, void 0, function* () {
            const repos = yield listHelmRepos();
            if (errorable_1.failed(repos)) {
                return [new HelmError('Unable to list Helm repos', repos.error[0])];
            }
            return repos.result;
        });
    }
    refresh() {
        return __awaiter(this, void 0, void 0, function* () {
            yield helm.helmExecAsync('repo update');
            this.onDidChangeTreeDataEmitter.fire();
        });
    }
}
exports.HelmRepoExplorer = HelmRepoExplorer;
class HelmError {
    constructor(text, detail) {
        this.text = text;
        this.detail = detail;
    }
    get kind() { return RepoExplorerObjectKind.Error; }
    getTreeItem() {
        const treeItem = new vscode.TreeItem(this.text);
        treeItem.tooltip = this.detail;
        return treeItem;
    }
    getChildren() {
        return __awaiter(this, void 0, void 0, function* () {
            return [];
        });
    }
}
class HelmRepoImpl {
    constructor(name, url) {
        this.name = name;
        this.url = url;
    }
    get kind() { return RepoExplorerObjectKind.Repo; }
    getTreeItem() {
        const treeItem = new vscode.TreeItem(this.name, vscode.TreeItemCollapsibleState.Collapsed);
        treeItem.iconPath = {
            light: vscode.Uri.file(path.join(__dirname, "../../images/light/helm-blue-vector.svg")),
            dark: vscode.Uri.file(path.join(__dirname, "../../images/dark/helm-white-vector.svg")),
        };
        treeItem.contextValue = 'vsKubernetes.repo';
        return treeItem;
    }
    getChildren() {
        return __awaiter(this, void 0, void 0, function* () {
            const charts = yield listHelmRepoCharts(this.name, this.url);
            if (errorable_1.failed(charts)) {
                return [new HelmError('Error fetching charts', charts.error[0])];
            }
            return charts.result;
        });
    }
}
class HelmRepoChartImpl {
    constructor(repoName, id, content) {
        this.id = id;
        this.versions = content.map((e) => new HelmRepoChartVersionImpl(id, e['chart version'], e['app version'], e.description));
        this.name = id.substring(repoName.length + 1);
    }
    get kind() { return RepoExplorerObjectKind.Chart; }
    getTreeItem() {
        const treeItem = new vscode.TreeItem(this.name, vscode.TreeItemCollapsibleState.Collapsed);
        treeItem.contextValue = 'vsKubernetes.chart';
        return treeItem;
    }
    getChildren() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.versions;
        });
    }
}
class HelmRepoChartVersionImpl {
    constructor(id, version, appVersion, description) {
        this.id = id;
        this.version = version;
        this.appVersion = appVersion;
        this.description = description;
    }
    get kind() { return RepoExplorerObjectKind.ChartVersion; }
    getTreeItem() {
        const treeItem = new vscode.TreeItem(this.version);
        treeItem.tooltip = this.tooltip();
        treeItem.command = {
            command: "extension.helmInspectChart",
            title: "Inspect",
            arguments: [this]
        };
        treeItem.contextValue = 'vsKubernetes.chartversion';
        return treeItem;
    }
    getChildren() {
        return __awaiter(this, void 0, void 0, function* () {
            return [];
        });
    }
    tooltip() {
        const tooltipLines = [this.description ? this.description : 'No description available'];
        if (this.appVersion) {
            tooltipLines.push(`App version: ${this.appVersion}`);
        }
        return tooltipLines.join('\n');
    }
}
function listHelmRepos() {
    return __awaiter(this, void 0, void 0, function* () {
        const sr = yield helm.helmExecAsync("repo list");
        // TODO: prompt to run 'helm init' here if needed...
        if (sr.code !== 0) {
            return { succeeded: false, error: [sr.stderr] };
        }
        const repos = sr.stdout.split('\n')
            .slice(1)
            .map((l) => l.trim())
            .filter((l) => l.length > 0)
            .map((l) => l.split('\t').map((bit) => bit.trim()))
            .map((bits) => new HelmRepoImpl(bits[0], bits[1]));
        return { succeeded: true, result: repos };
    });
}
function listHelmRepoCharts(repoName, repoUrl) {
    return __awaiter(this, void 0, void 0, function* () {
        const sr = yield helm.helmExecAsync(`search ${repoName}/ -l`);
        if (sr.code !== 0) {
            return { succeeded: false, error: [sr.stderr] };
        }
        const lines = sr.stdout.split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 0);
        const entries = outputUtils_1.parseLineOutput(lines, helm_1.HELM_OUTPUT_COLUMN_SEPARATOR);
        const charts = _.chain(entries)
            .groupBy((e) => e.name)
            .toPairs()
            .map((p) => new HelmRepoChartImpl(repoName, p[0], p[1]))
            .value();
        return { succeeded: true, result: charts };
    });
}
//# sourceMappingURL=helm.repoExplorer.js.map
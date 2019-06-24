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
// tslint:disable-next-line:no-require-imports
const request = require("request-promise");
const semver = require("semver");
const constants_1 = require("../constants");
const localize_1 = require("../localize");
const npmRegistryUri = 'https://aka.ms/AA2qmnu';
function getNpmDistTag(runtime) {
    return __awaiter(this, void 0, void 0, function* () {
        const packageMetadata = JSON.parse(yield request(npmRegistryUri));
        let majorVersion;
        switch (runtime) {
            case constants_1.ProjectRuntime.v1:
                majorVersion = '1';
                break;
            case constants_1.ProjectRuntime.v2:
                majorVersion = '2';
                break;
            default:
                throw new RangeError(localize_1.localize('invalidRuntime', 'Invalid runtime "{0}".', runtime));
        }
        const validVersions = Object.keys(packageMetadata.versions).filter((v) => !!semver.valid(v));
        const maxVersion = semver.maxSatisfying(validVersions, majorVersion);
        if (!maxVersion) {
            throw new Error(localize_1.localize('noDistTag', 'Failed to retrieve NPM tag for runtime "{0}".', runtime));
        }
        return { tag: majorVersion, value: maxVersion };
    });
}
exports.getNpmDistTag = getNpmDistTag;
//# sourceMappingURL=getNpmDistTag.js.map
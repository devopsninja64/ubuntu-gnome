"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sysfs = require("fs");
exports.fs = {
    existsSync: (path) => sysfs.existsSync(path),
    readFile: (filename, encoding, callback) => sysfs.readFile(filename, encoding, callback),
    readFileSync: (filename, encoding) => sysfs.readFileSync(filename, encoding),
    readFileToBufferSync: (filename) => sysfs.readFileSync(filename),
    writeFile: (filename, data, callback) => sysfs.writeFile(filename, data, callback),
    writeFileSync: (filename, data) => sysfs.writeFileSync(filename, data),
    dirSync: (path) => sysfs.readdirSync(path),
    unlinkAsync: (path) => {
        return new Promise((resolve, reject) => {
            sysfs.unlink(path, (error) => {
                if (error) {
                    reject();
                    return;
                }
                resolve();
            });
        });
    },
    existsAsync: (path) => {
        return new Promise((resolve) => {
            sysfs.exists(path, (exists) => {
                resolve(exists);
            });
        });
    },
    openAsync: (path, flags) => {
        return new Promise((resolve, reject) => {
            sysfs.open(path, flags, (error, fd) => {
                if (error) {
                    reject();
                    return;
                }
                resolve();
            });
        });
    },
    statSync: (path) => sysfs.statSync(path)
};
//# sourceMappingURL=fs.js.map
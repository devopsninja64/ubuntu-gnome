"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function flatten(...arrays) {
    return Array.of().concat(...arrays);
}
exports.flatten = flatten;
if (!Array.prototype.choose) {
    Array.prototype.choose = function (f) {
        return this.map(f).filter((o) => !!o).map((o) => o);
    };
}
//# sourceMappingURL=array.js.map
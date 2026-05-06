/**
 * Allow `require("server-only")` when running one-off Node scripts (tsx).
 * Next replaces this in the bundle; plain Node hits the package and throws.
 */
const Module = require("module");
const orig = Module.prototype.require;
Module.prototype.require = function patchServerOnly(id, ...rest) {
  if (id === "server-only") return {};
  return orig.apply(this, [id, ...rest]);
};

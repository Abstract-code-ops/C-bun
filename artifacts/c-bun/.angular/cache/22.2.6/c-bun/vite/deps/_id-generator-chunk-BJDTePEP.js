import { Wi as setClassMetadata, dl as inject, dr as Service, pc as APP_ID, so as ɵɵdefineService } from "./core-Drq8OHIF.js";
// ../../node_modules/.pnpm/@angular+cdk@22.2.7_31575fdcd76c2461da240d509d191da3/node_modules/@angular/cdk/fesm2022/keycodes.mjs
function hasModifierKey(event, ...modifiers) {
	if (modifiers.length) return modifiers.some((modifier) => event[modifier]);
	return event.altKey || event.shiftKey || event.ctrlKey || event.metaKey;
}
// ../../node_modules/.pnpm/@angular+cdk@22.2.7_31575fdcd76c2461da240d509d191da3/node_modules/@angular/cdk/fesm2022/_id-generator-chunk.mjs
var counters = /* @__PURE__ */ new Map();
var _IdGenerator = class _IdGenerator {
	_appId = inject(APP_ID);
	static _infix = `a${Math.floor(Math.random() * 1e5).toString()}`;
	getId(prefix, randomize = false) {
		if (this._appId !== "ng") prefix += this._appId;
		let count = counters.get(prefix);
		if (count === void 0) count = 0;
		else count++;
		counters.set(prefix, count);
		return `${prefix}${randomize ? _IdGenerator._infix + "-" : ""}${count}`;
	}
	static ɵfac = function _IdGenerator_Factory(__ngFactoryType__) {
		return new (__ngFactoryType__ || _IdGenerator)();
	};
	static ɵprov = /*@__PURE__*/ ɵɵdefineService({
		token: _IdGenerator,
		factory: _IdGenerator.ɵfac
	});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(_IdGenerator, [{ type: Service }], null, null);
})();
export { hasModifierKey as n, _IdGenerator as t };

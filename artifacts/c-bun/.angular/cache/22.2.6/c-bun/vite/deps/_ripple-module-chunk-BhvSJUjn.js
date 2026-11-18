import { ua as ɵɵdefineInjector } from "./_resource-chunk-CQPGmI6B.js";
import { t as BidiModule } from "./bidi-BldOeCYw.js";
import { Ai as setClassMetadata, Ga as ɵɵdefineNgModule, Nn as NgModule } from "./core-DpE0Bu0A.js";
import { n as MatRipple } from "./_ripple-chunk-iZuaX-ng.js";
// ../../node_modules/.pnpm/@angular+material@22.2.7_4f6723b46a482e1b97215c4fcb9843d2/node_modules/@angular/material/fesm2022/_ripple-module-chunk.mjs
var MatRippleModule = class MatRippleModule {
	static ɵfac = function MatRippleModule_Factory(__ngFactoryType__) {
		return new (__ngFactoryType__ || MatRippleModule)();
	};
	static ɵmod = /*@__PURE__*/ ɵɵdefineNgModule({
		type: MatRippleModule,
		imports: [MatRipple],
		exports: [MatRipple, BidiModule]
	});
	static ɵinj = /*@__PURE__*/ ɵɵdefineInjector({ imports: [BidiModule] });
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(MatRippleModule, [{
		type: NgModule,
		args: [{
			imports: [MatRipple],
			exports: [MatRipple, BidiModule]
		}]
	}], null, null);
})();
export { MatRippleModule as t };

import { t as BidiModule } from "./bidi-BmqnMbM4.js";
import { Wi as setClassMetadata, ao as ɵɵdefineNgModule, jl as ɵɵdefineInjector, qn as NgModule } from "./core-Drq8OHIF.js";
import { n as MatRipple } from "./_ripple-chunk-DCp1nURb.js";
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

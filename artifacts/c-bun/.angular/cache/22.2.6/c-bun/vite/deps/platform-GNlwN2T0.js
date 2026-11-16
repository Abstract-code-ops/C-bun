import { Wi as setClassMetadata, ao as ɵɵdefineNgModule, jl as ɵɵdefineInjector, qn as NgModule } from "./core-Drq8OHIF.js";
// ../../node_modules/.pnpm/@angular+cdk@22.2.7_31575fdcd76c2461da240d509d191da3/node_modules/@angular/cdk/fesm2022/platform.mjs
var PlatformModule = class PlatformModule {
	static ɵfac = function PlatformModule_Factory(__ngFactoryType__) {
		return new (__ngFactoryType__ || PlatformModule)();
	};
	static ɵmod = /*@__PURE__*/ ɵɵdefineNgModule({ type: PlatformModule });
	static ɵinj = /*@__PURE__*/ ɵɵdefineInjector({});
};
(() => {
	(typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(PlatformModule, [{
		type: NgModule,
		args: [{}]
	}], null, null);
})();
var supportedInputTypes;
var candidateInputTypes = [
	"color",
	"button",
	"checkbox",
	"date",
	"datetime-local",
	"email",
	"file",
	"hidden",
	"image",
	"month",
	"number",
	"password",
	"radio",
	"range",
	"reset",
	"search",
	"submit",
	"tel",
	"text",
	"time",
	"url",
	"week"
];
function getSupportedInputTypes() {
	if (supportedInputTypes) return supportedInputTypes;
	if (typeof document !== "object" || !document) {
		supportedInputTypes = new Set(candidateInputTypes);
		return supportedInputTypes;
	}
	let featureTestInput = document.createElement("input");
	supportedInputTypes = new Set(candidateInputTypes.filter((value) => {
		featureTestInput.setAttribute("type", value);
		return featureTestInput.type === value;
	}));
	return supportedInputTypes;
}
export { getSupportedInputTypes as t };

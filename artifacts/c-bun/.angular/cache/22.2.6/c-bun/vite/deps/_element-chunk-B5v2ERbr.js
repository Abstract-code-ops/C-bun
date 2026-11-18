import { fn as ElementRef } from "./core-DpE0Bu0A.js";
// ../../node_modules/.pnpm/@angular+cdk@22.2.7_31575fdcd76c2461da240d509d191da3/node_modules/@angular/cdk/fesm2022/_element-chunk.mjs
function coerceNumberProperty(value, fallbackValue = 0) {
	if (_isNumberValue(value)) return Number(value);
	return arguments.length === 2 ? fallbackValue : 0;
}
function _isNumberValue(value) {
	return !isNaN(parseFloat(value)) && !isNaN(Number(value));
}
function coerceElement(elementOrRef) {
	return elementOrRef instanceof ElementRef ? elementOrRef.nativeElement : elementOrRef;
}
export { coerceElement as n, coerceNumberProperty as r, _isNumberValue as t };

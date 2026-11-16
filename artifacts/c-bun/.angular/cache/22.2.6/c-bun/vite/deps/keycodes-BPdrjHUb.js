// ../../node_modules/.pnpm/@angular+cdk@22.2.7_31575fdcd76c2461da240d509d191da3/node_modules/@angular/cdk/fesm2022/keycodes.mjs
function hasModifierKey(event, ...modifiers) {
	if (modifiers.length) return modifiers.some((modifier) => event[modifier]);
	return event.altKey || event.shiftKey || event.ctrlKey || event.metaKey;
}
export { hasModifierKey as t };

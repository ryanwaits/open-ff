import { a as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { t as cn } from "./utils-B7rbOnud.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/input-Da9nFsco.js
var import_jsx_runtime = require_jsx_runtime();
function Input({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
		className: cn("h-11 w-full rounded-md bg-raised px-3 text-sm text-fg shadow-[var(--shadow-border)] placeholder:text-faint", "transition-[box-shadow] duration-150 ease-out", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40", className),
		...props
	});
}
//#endregion
export { Input as t };

import { a as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { t as cn } from "./utils-B7rbOnud.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/badge-DJUSvdKs.js
var import_jsx_runtime = require_jsx_runtime();
function Badge({ className, tone = "default", ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("inline-flex items-center rounded-full px-2 py-0.5 font-mono text-xs tracking-wide", tone === "default" && "bg-raised text-muted", tone === "win" && "bg-win/15 text-win", tone === "loss" && "bg-loss/15 text-loss", tone === "live" && "bg-live/15 text-live", tone === "muted" && "text-faint", className),
		...props
	});
}
//#endregion
export { Badge as t };

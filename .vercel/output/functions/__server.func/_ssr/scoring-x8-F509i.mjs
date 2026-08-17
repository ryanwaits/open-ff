import { t as __exportAll } from "./rolldown-runtime-D7D4PA-g.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/scoring-x8-F509i.js
var scoring_exports = /* @__PURE__ */ __exportAll({
	SCORING_FIELDS: () => SCORING_FIELDS,
	applyBook: () => applyBook,
	bookFromPreset: () => bookFromPreset,
	fromSleeperSettings: () => fromSleeperSettings,
	isClassicPreset: () => isClassicPreset,
	parseBook: () => parseBook,
	presetOf: () => presetOf,
	scoringLabel: () => scoringLabel
});
var SCORING_FIELDS = [
	{
		key: "pass_yd",
		group: "Passing",
		label: "Passing yards",
		step: .01
	},
	{
		key: "pass_td",
		group: "Passing",
		label: "Passing TD",
		step: 1
	},
	{
		key: "pass_int",
		group: "Passing",
		label: "Interception",
		step: 1
	},
	{
		key: "pass_2pt",
		group: "Passing",
		label: "Passing 2-pt",
		step: 1
	},
	{
		key: "rush_yd",
		group: "Rushing",
		label: "Rushing yards",
		step: .01
	},
	{
		key: "rush_td",
		group: "Rushing",
		label: "Rushing TD",
		step: 1
	},
	{
		key: "rush_2pt",
		group: "Rushing",
		label: "Rushing 2-pt",
		step: 1
	},
	{
		key: "rec",
		group: "Receiving",
		label: "Reception",
		step: .1
	},
	{
		key: "rec_yd",
		group: "Receiving",
		label: "Receiving yards",
		step: .01
	},
	{
		key: "rec_td",
		group: "Receiving",
		label: "Receiving TD",
		step: 1
	},
	{
		key: "rec_2pt",
		group: "Receiving",
		label: "Receiving 2-pt",
		step: 1
	},
	{
		key: "fum_lost",
		group: "Turnovers",
		label: "Fumble lost",
		step: 1
	},
	{
		key: "fgm_0_19",
		group: "Kicking",
		label: "FG 0–19",
		step: 1
	},
	{
		key: "fgm_20_29",
		group: "Kicking",
		label: "FG 20–29",
		step: 1
	},
	{
		key: "fgm_30_39",
		group: "Kicking",
		label: "FG 30–39",
		step: 1
	},
	{
		key: "fgm_40_49",
		group: "Kicking",
		label: "FG 40–49",
		step: 1
	},
	{
		key: "fgm_50p",
		group: "Kicking",
		label: "FG 50+",
		step: 1
	},
	{
		key: "xpm",
		group: "Kicking",
		label: "PAT made",
		step: 1
	},
	{
		key: "fgmiss",
		group: "Kicking",
		label: "FG missed",
		step: 1
	},
	{
		key: "xpmiss",
		group: "Kicking",
		label: "PAT missed",
		step: 1
	},
	{
		key: "sack",
		group: "Defense",
		label: "Sack",
		step: .5
	},
	{
		key: "int",
		group: "Defense",
		label: "DEF INT",
		step: 1
	},
	{
		key: "fum_rec",
		group: "Defense",
		label: "Fumble recovery",
		step: 1
	},
	{
		key: "def_td",
		group: "Defense",
		label: "DEF TD",
		step: 1
	},
	{
		key: "safe",
		group: "Defense",
		label: "Safety",
		step: 1
	},
	{
		key: "blk_kick",
		group: "Defense",
		label: "Blocked kick",
		step: 1
	},
	{
		key: "pts_allow_0",
		group: "Points allowed",
		label: "0 points",
		step: 1
	},
	{
		key: "pts_allow_1_6",
		group: "Points allowed",
		label: "1–6",
		step: 1
	},
	{
		key: "pts_allow_7_13",
		group: "Points allowed",
		label: "7–13",
		step: 1
	},
	{
		key: "pts_allow_14_20",
		group: "Points allowed",
		label: "14–20",
		step: 1
	},
	{
		key: "pts_allow_21_27",
		group: "Points allowed",
		label: "21–27",
		step: 1
	},
	{
		key: "pts_allow_28_34",
		group: "Points allowed",
		label: "28–34",
		step: 1
	},
	{
		key: "pts_allow_35p",
		group: "Points allowed",
		label: "35+",
		step: 1
	}
];
var CLASSIC = {
	pass_yd: .04,
	pass_td: 4,
	pass_int: -1,
	pass_2pt: 2,
	rush_yd: .1,
	rush_td: 6,
	rush_2pt: 2,
	rec: 1,
	rec_yd: .1,
	rec_td: 6,
	rec_2pt: 2,
	fum_lost: -2,
	fgm_0_19: 3,
	fgm_20_29: 3,
	fgm_30_39: 3,
	fgm_40_49: 4,
	fgm_50p: 5,
	xpm: 1,
	fgmiss: -1,
	xpmiss: -1,
	sack: 1,
	int: 2,
	fum_rec: 2,
	def_td: 6,
	safe: 2,
	blk_kick: 2,
	pts_allow_0: 10,
	pts_allow_1_6: 7,
	pts_allow_7_13: 4,
	pts_allow_14_20: 1,
	pts_allow_21_27: 0,
	pts_allow_28_34: -1,
	pts_allow_35p: -4
};
function bookFromPreset(preset) {
	return {
		...CLASSIC,
		rec: preset === "ppr" ? 1 : preset === "half" ? .5 : 0
	};
}
function presetOf(book) {
	const rec = book.rec ?? 0;
	if (rec >= .9) return "ppr";
	if (rec >= .4) return "half";
	return "std";
}
function scoringLabel(book) {
	const rec = presetOf(book);
	return [rec === "ppr" ? "PPR" : rec === "half" ? "Half PPR" : "Standard", book.pass_td === 6 ? "6pt pass TD" : book.pass_td === 4 ? "4pt pass TD" : null].filter(Boolean).join(" · ");
}
function fromSleeperSettings(raw) {
	const book = bookFromPreset("ppr");
	if (!raw) return book;
	for (const [k, v] of Object.entries(raw)) if (typeof v === "number" && Number.isFinite(v)) book[k] = v;
	if (book.fgm_50p == null && typeof book.fgm_50_59 === "number") book.fgm_50p = book.fgm_50_59;
	return book;
}
var LINEAR_SKIP = /* @__PURE__ */ new Set([
	"pts_allow_0",
	"pts_allow_1_6",
	"pts_allow_7_13",
	"pts_allow_14_20",
	"pts_allow_21_27",
	"pts_allow_28_34",
	"pts_allow_35p"
]);
function dstAllow(book, allowed) {
	if (typeof allowed !== "number") return 0;
	if (allowed <= 0) return book.pts_allow_0 ?? 0;
	if (allowed <= 6) return book.pts_allow_1_6 ?? 0;
	if (allowed <= 13) return book.pts_allow_7_13 ?? 0;
	if (allowed <= 20) return book.pts_allow_14_20 ?? 0;
	if (allowed <= 27) return book.pts_allow_21_27 ?? 0;
	if (allowed <= 34) return book.pts_allow_28_34 ?? 0;
	return book.pts_allow_35p ?? 0;
}
function applyBook(book, stats) {
	if (!stats) return 0;
	let pts = 0;
	for (const [k, w] of Object.entries(book)) {
		if (typeof w !== "number" || LINEAR_SKIP.has(k)) continue;
		const v = stats[k];
		if (typeof v === "number") pts += w * v;
	}
	if (typeof stats.pts_allow === "number") pts += dstAllow(book, stats.pts_allow);
	if ((book.bonus_pass_yd_300 ?? 0) && (stats.pass_yd ?? 0) >= 300) pts += book.bonus_pass_yd_300;
	if ((book.bonus_rush_yd_100 ?? 0) && (stats.rush_yd ?? 0) >= 100) pts += book.bonus_rush_yd_100;
	if ((book.bonus_rec_yd_100 ?? 0) && (stats.rec_yd ?? 0) >= 100) pts += book.bonus_rec_yd_100;
	if (typeof stats.fgm_50_59 === "number" && book.fgm_50p && stats.fgm_50p == null) pts += book.fgm_50p * stats.fgm_50_59;
	if (typeof stats.fgm_60p === "number" && book.fgm_50p) pts += book.fgm_50p * stats.fgm_60p;
	return Math.round(pts * 100) / 100;
}
function isClassicPreset(book) {
	const base = bookFromPreset(presetOf(book));
	for (const { key } of SCORING_FIELDS) if ((book[key] ?? 0) !== (base[key] ?? 0)) return false;
	return true;
}
function parseBook(raw, fallback) {
	if (raw) try {
		const v = JSON.parse(raw);
		if (v && typeof v === "object") return v;
	} catch {}
	return bookFromPreset(fallback);
}
//#endregion
export { parseBook as a, scoring_exports as c, isClassicPreset as i, applyBook as n, presetOf as o, bookFromPreset as r, scoringLabel as s, SCORING_FIELDS as t };

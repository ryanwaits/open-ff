//#region node_modules/.nitro/vite/services/ssr/assets/teams-DHGI6_jF.js
var TEAMS = {
	ARI: {
		abbr: "ARI",
		city: "Arizona",
		nick: "Cardinals",
		espn: "ari"
	},
	ATL: {
		abbr: "ATL",
		city: "Atlanta",
		nick: "Falcons",
		espn: "atl"
	},
	BAL: {
		abbr: "BAL",
		city: "Baltimore",
		nick: "Ravens",
		espn: "bal"
	},
	BUF: {
		abbr: "BUF",
		city: "Buffalo",
		nick: "Bills",
		espn: "buf"
	},
	CAR: {
		abbr: "CAR",
		city: "Carolina",
		nick: "Panthers",
		espn: "car"
	},
	CHI: {
		abbr: "CHI",
		city: "Chicago",
		nick: "Bears",
		espn: "chi"
	},
	CIN: {
		abbr: "CIN",
		city: "Cincinnati",
		nick: "Bengals",
		espn: "cin"
	},
	CLE: {
		abbr: "CLE",
		city: "Cleveland",
		nick: "Browns",
		espn: "cle"
	},
	DAL: {
		abbr: "DAL",
		city: "Dallas",
		nick: "Cowboys",
		espn: "dal"
	},
	DEN: {
		abbr: "DEN",
		city: "Denver",
		nick: "Broncos",
		espn: "den"
	},
	DET: {
		abbr: "DET",
		city: "Detroit",
		nick: "Lions",
		espn: "det"
	},
	GB: {
		abbr: "GB",
		city: "Green Bay",
		nick: "Packers",
		espn: "gb"
	},
	HOU: {
		abbr: "HOU",
		city: "Houston",
		nick: "Texans",
		espn: "hou"
	},
	IND: {
		abbr: "IND",
		city: "Indianapolis",
		nick: "Colts",
		espn: "ind"
	},
	JAX: {
		abbr: "JAX",
		city: "Jacksonville",
		nick: "Jaguars",
		espn: "jax"
	},
	KC: {
		abbr: "KC",
		city: "Kansas City",
		nick: "Chiefs",
		espn: "kc"
	},
	LV: {
		abbr: "LV",
		city: "Las Vegas",
		nick: "Raiders",
		espn: "lv"
	},
	LAC: {
		abbr: "LAC",
		city: "Los Angeles",
		nick: "Chargers",
		espn: "lac"
	},
	LAR: {
		abbr: "LAR",
		city: "Los Angeles",
		nick: "Rams",
		espn: "lar"
	},
	MIA: {
		abbr: "MIA",
		city: "Miami",
		nick: "Dolphins",
		espn: "mia"
	},
	MIN: {
		abbr: "MIN",
		city: "Minnesota",
		nick: "Vikings",
		espn: "min"
	},
	NE: {
		abbr: "NE",
		city: "New England",
		nick: "Patriots",
		espn: "ne"
	},
	NO: {
		abbr: "NO",
		city: "New Orleans",
		nick: "Saints",
		espn: "no"
	},
	NYG: {
		abbr: "NYG",
		city: "New York",
		nick: "Giants",
		espn: "nyg"
	},
	NYJ: {
		abbr: "NYJ",
		city: "New York",
		nick: "Jets",
		espn: "nyj"
	},
	PHI: {
		abbr: "PHI",
		city: "Philadelphia",
		nick: "Eagles",
		espn: "phi"
	},
	PIT: {
		abbr: "PIT",
		city: "Pittsburgh",
		nick: "Steelers",
		espn: "pit"
	},
	SF: {
		abbr: "SF",
		city: "San Francisco",
		nick: "49ers",
		espn: "sf"
	},
	SEA: {
		abbr: "SEA",
		city: "Seattle",
		nick: "Seahawks",
		espn: "sea"
	},
	TB: {
		abbr: "TB",
		city: "Tampa Bay",
		nick: "Buccaneers",
		espn: "tb"
	},
	TEN: {
		abbr: "TEN",
		city: "Tennessee",
		nick: "Titans",
		espn: "ten"
	},
	WAS: {
		abbr: "WAS",
		city: "Washington",
		nick: "Commanders",
		espn: "wsh"
	}
};
function teamLogo(abbr) {
	if (!abbr) return null;
	return `https://a.espncdn.com/i/teamlogos/nfl/500/${TEAMS[abbr.toUpperCase()]?.espn ?? abbr.toLowerCase()}.png`;
}
function playerHeadshot(playerId, espnId) {
	if (espnId) return `https://a.espncdn.com/i/headshots/nfl/players/full/${espnId}.png`;
	return `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`;
}
function sleeperAvatar(avatar) {
	if (!avatar) return null;
	if (avatar.startsWith("http")) return avatar;
	return `https://sleepercdn.com/avatars/thumbs/${avatar}`;
}
var SLOT_LABEL = {
	QB: "QB",
	RB: "RB",
	WR: "WR",
	TE: "TE",
	FLEX: "FLX",
	SUPER_FLEX: "SF",
	WRRB_FLEX: "W/R",
	REC_FLEX: "W/T",
	IDP_FLEX: "IDP",
	K: "K",
	DEF: "DST",
	DL: "DL",
	LB: "LB",
	DB: "DB",
	BN: "BN",
	IR: "IR",
	TAXI: "TAXI"
};
function slotLabel(slot) {
	return SLOT_LABEL[slot] ?? slot;
}
var START_SLOTS = /* @__PURE__ */ new Set([
	"QB",
	"RB",
	"WR",
	"TE",
	"FLEX",
	"SUPER_FLEX",
	"WRRB_FLEX",
	"REC_FLEX",
	"IDP_FLEX",
	"K",
	"DEF",
	"DL",
	"LB",
	"DB"
]);
//#endregion
export { teamLogo as a, slotLabel as i, playerHeadshot as n, sleeperAvatar as r, START_SLOTS as t };

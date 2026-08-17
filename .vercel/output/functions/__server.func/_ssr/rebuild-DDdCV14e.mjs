//#region node_modules/.nitro/vite/services/ssr/assets/rebuild-DDdCV14e.js
var SAMPLE_REBUILD = `Masthead | Ryan | 8-6 | 1541.2 | 1490.4
Josh Allen
Saquon Barkley
CeeDee Lamb
Ja'Marr Chase
Travis Kelce
Breece Hall
Nico Collins
Brandon Aubrey
Bills D/ST

Night Desk | Alex | 7-7 | 1488.0 | 1502.1
Lamar Jackson
Bijan Robinson
Amon-Ra St. Brown
A.J. Brown
George Kittle
Kyren Williams
Jayden Reed
Ka'imi Fairbairn
Ravens D/ST

Copy Chiefs | Maya | 9-5 | 1602.6 | 1471.8
Jalen Hurts
Derrick Henry
Justin Jefferson
Puka Nacua
Sam LaPorta
James Cook
Tee Higgins
Cameron Dicker
Eagles D/ST

Widowmakers | Chris | 6-8 | 1410.3 | 1522.0
Joe Burrow
Jahmyr Gibbs
Tyreek Hill
DK Metcalf
Trey McBride
Alvin Kamara
Chris Olave
Jake Bates
Vikings D/ST`;
function parseRecord(raw) {
	const m = raw.trim().match(/^(\d+)\s*[-–]\s*(\d+)(?:\s*[-–]\s*(\d+))?$/);
	if (!m) return null;
	return {
		w: Number(m[1]),
		l: Number(m[2]),
		t: Number(m[3] ?? 0)
	};
}
function parseHeader(line) {
	const parts = line.split("|").map((p) => p.trim()).filter(Boolean);
	if (!parts.length) return null;
	const teamName = parts[0];
	if (teamName.length < 2) return null;
	let manager = "Manager";
	let wins = null;
	let losses = null;
	let ties = null;
	let pf = null;
	let pa = null;
	const rest = parts.slice(1);
	for (const bit of rest) {
		const rec = parseRecord(bit);
		if (rec) {
			wins = rec.w;
			losses = rec.l;
			ties = rec.t;
			continue;
		}
		if (/^\d+(\.\d+)?$/.test(bit)) {
			if (pf == null) pf = Number(bit);
			else if (pa == null) pa = Number(bit);
			continue;
		}
		if (manager === "Manager") manager = bit;
	}
	return {
		teamName: teamName.slice(0, 40),
		manager: manager.slice(0, 32),
		wins,
		losses,
		ties,
		pf,
		pa
	};
}
function parseRebuildPaste(raw) {
	const lines = raw.replace(/\r/g, "").split("\n");
	const teams = [];
	let current = null;
	const flush = () => {
		if (current && current.teamName) teams.push(current);
		current = null;
	};
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || /^-+$/.test(trimmed)) {
			if (trimmed.startsWith("---")) flush();
			continue;
		}
		if (trimmed.includes("|") || trimmed.startsWith("#")) {
			flush();
			const header = parseHeader(trimmed.replace(/^#\s*/, ""));
			if (header) current = {
				...header,
				names: []
			};
			continue;
		}
		if (!current) {
			const header = parseHeader(trimmed);
			if (header) {
				current = {
					...header,
					names: []
				};
				continue;
			}
		}
		if (current) for (const bit of trimmed.split(/[,;]+/)) {
			const name = bit.trim();
			if (name) current.names.push(name);
		}
	}
	flush();
	return teams;
}
//#endregion
export { SAMPLE_REBUILD, parseRebuildPaste };

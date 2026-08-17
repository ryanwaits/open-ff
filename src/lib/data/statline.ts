/** Compact unofficial Sleeper week-stat line for a fantasy roster row. */
export function formatStatLine(
  pos: string | null | undefined,
  s: Record<string, number> | null | undefined,
): string | null {
  if (!s) return null;
  const bits: string[] = [];
  const n = (k: string) => (typeof s[k] === "number" ? s[k]! : 0);

  const passYd = n("pass_yd");
  const rushYd = n("rush_yd");
  const recYd = n("rec_yd");
  const rec = n("rec");
  const isQb = pos === "QB" || passYd >= 20;
  const isK = pos === "K";
  const isDef = pos === "DEF" || pos === "DST";

  if (isQb) {
    const cmp = n("pass_cmp");
    const att = cmp + n("pass_inc");
    if (att || passYd) bits.push(`${cmp}/${att || 0}, ${Math.round(passYd)} yds`);
    if (n("pass_td")) bits.push(`${n("pass_td")} TD`);
    if (n("pass_int")) bits.push(`${n("pass_int")} INT`);
    if (rushYd) bits.push(`${Math.round(rushYd)} rush`);
    if (n("rush_td")) bits.push(`${n("rush_td")} rush TD`);
  } else if (isK) {
    const made =
      n("fgm") ||
      n("fgm_0_19") + n("fgm_20_29") + n("fgm_30_39") + n("fgm_40_49") + n("fgm_50p");
    const xp = n("xpm");
    if (made) bits.push(`${made} FG`);
    if (xp) bits.push(`${xp} XP`);
    if (n("fgmiss")) bits.push(`${n("fgmiss")} miss`);
  } else if (isDef) {
    if (n("sack")) bits.push(`${n("sack")} sack`);
    if (n("int")) bits.push(`${n("int")} INT`);
    if (n("fum_rec")) bits.push(`${n("fum_rec")} FR`);
    if (n("def_td")) bits.push(`${n("def_td")} TD`);
    if (n("pts_allow") || n("pts_allow") === 0) bits.push(`${n("pts_allow")} PA`);
  } else {
    if (n("rush_att") || rushYd) {
      bits.push(`${n("rush_att") || 0} car, ${Math.round(rushYd)} yds`);
      if (n("rush_td")) bits.push(`${n("rush_td")} TD`);
    }
    if (rec || recYd) {
      bits.push(`${rec} rec, ${Math.round(recYd)} yds`);
      if (n("rec_td")) bits.push(`${n("rec_td")} TD`);
    }
    if (n("kr_yd")) bits.push(`${Math.round(n("kr_yd"))} KR`);
    if (n("pr_yd")) bits.push(`${Math.round(n("pr_yd"))} PR`);
    if (n("kr_td") || n("pr_td") || n("st_td")) {
      bits.push(`${n("kr_td") + n("pr_td") + n("st_td")} ret TD`);
    }
  }

  if (!bits.length) return null;
  return bits.join(" · ");
}

import{i as e,t}from"./react-SIfiwpqq.js";import{d as n,n as r}from"./preload-helper-C_yO7rdd.js";import{n as i,t as a}from"./useNavigate-J8rp16ba.js";import{n as o,s,t as c}from"./shell-DEzVuYkl.js";import{b as l,h as u,k as d,m as f,p,x as m,y as h}from"./fns-BF30Fcdj.js";import{h as g}from"./index-C9MjrtuF.js";import{t as _}from"./utils-CVDigqcy.js";import{t as v}from"./button-Ds-Zdr87.js";import{t as y}from"./input-B6Ho99K2.js";var b=e(t()),x=`Masthead | Ryan | 8-6 | 1541.2 | 1490.4
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
Vikings D/ST`,S=n();function C(){let{user:e,isPending:t}=s(),n=i(),C=o(e=>e.remember),[w,T]=(0,b.useState)(`rebuild`),[E,D]=(0,b.useState)(``),[O,k]=(0,b.useState)(``),[A,j]=(0,b.useState)(`2025`),[M,N]=(0,b.useState)(`ppr`),[P,F]=(0,b.useState)(``),[I,L]=(0,b.useState)(``),[R,z]=(0,b.useState)(``),[B,V]=(0,b.useState)(null),[H,U]=(0,b.useState)(null),W=d({mutationFn:async()=>w===`rebuild`?m({data:{paste:P,name:O.trim()||`Rebuilt league`,season:A,scoring:M}}):w===`espn`?h({data:{leagueId:E.trim(),season:A,swid:I.trim()||void 0,espnS2:R.trim()||void 0}}):l({data:{sleeperId:E.trim()}}),onError:e=>g(e instanceof Error?e.message:`Could not read that.`),onSuccess:e=>{U(e),V(e.teams[0]?.rosterId??null)}}),G=d({mutationFn:async()=>w===`rebuild`?u({data:{paste:P,name:O.trim()||H?.name||`Rebuilt league`,season:A,scoring:M,claimRosterId:B}}):w===`espn`?p({data:{leagueId:E.trim(),season:A,claimRosterId:B,swid:I.trim()||void 0,espnS2:R.trim()||void 0}}):f({data:{sleeperId:E.trim(),claimRosterId:B}}),onSuccess:e=>{C({leagueId:e.leagueId,name:H?.name??(O.trim()||`Imported league`),season:H?.season??A}),g(`Imported · invite ${e.inviteCode}`),n({to:`/league/$leagueId`,params:{leagueId:e.leagueId}})},onError:e=>{let t=e instanceof Error?e.message:`Import failed.`;if(t===`Unauthorized`){n({to:`/login`,search:{redirect:`/import`}});return}g(t)}});return t?(0,S.jsx)(c,{children:(0,S.jsx)(`div`,{className:`h-40 animate-pulse rounded-xl bg-surface`})}):e?(0,S.jsxs)(c,{children:[(0,S.jsx)(`p`,{className:`font-mono text-[11px] uppercase tracking-[0.18em] text-faint`,children:`Bring a league over`}),(0,S.jsx)(`h1`,{className:`mt-2 font-display text-4xl tracking-tight`,children:`Rebuild`}),(0,S.jsx)(`p`,{className:`mt-2 max-w-xl text-sm text-muted`,children:`Paste teams, records, and rosters. No ESPN cookies. Friends claim a seat here and never need the old app.`}),(0,S.jsx)(`div`,{className:`mt-8 flex flex-wrap gap-1`,children:[[`rebuild`,`Paste`],[`sleeper`,`Sleeper`],[`espn`,`ESPN`]].map(([e,t])=>(0,S.jsx)(`button`,{type:`button`,onClick:()=>{T(e),U(null)},className:_(`h-10 rounded-sm px-4 font-mono text-sm`,w===e?`bg-accent text-accent-fg`:`bg-raised text-muted`),children:t},e))}),(0,S.jsxs)(`form`,{className:`mt-6 max-w-2xl space-y-4`,onSubmit:e=>{e.preventDefault(),W.mutate()},children:[w===`rebuild`?(0,S.jsxs)(S.Fragment,{children:[(0,S.jsxs)(`div`,{className:`grid gap-3 sm:grid-cols-[1fr_auto]`,children:[(0,S.jsxs)(`label`,{className:`block`,children:[(0,S.jsx)(`span`,{className:`font-mono text-[11px] uppercase tracking-[0.16em] text-faint`,children:`League name`}),(0,S.jsx)(y,{className:`mt-1.5`,value:O,onChange:e=>k(e.target.value),placeholder:`Thursday Night Lights`})]}),(0,S.jsxs)(`div`,{children:[(0,S.jsx)(`p`,{className:`font-mono text-[11px] uppercase tracking-[0.16em] text-faint`,children:`Season`}),(0,S.jsx)(`div`,{className:`mt-1.5 flex gap-1`,children:[`2025`,`2026`].map(e=>(0,S.jsx)(`button`,{type:`button`,onClick:()=>j(e),className:_(`h-10 min-w-16 rounded-sm px-3 font-mono text-sm`,A===e?`bg-accent text-accent-fg`:`bg-raised text-muted`),children:e},e))})]})]}),(0,S.jsxs)(`div`,{children:[(0,S.jsx)(`p`,{className:`font-mono text-[11px] uppercase tracking-[0.16em] text-faint`,children:`Scoring`}),(0,S.jsx)(`div`,{className:`mt-1.5 flex flex-wrap gap-1`,children:[[`ppr`,`PPR`],[`half`,`Half`],[`std`,`Std`]].map(([e,t])=>(0,S.jsx)(`button`,{type:`button`,onClick:()=>N(e),className:_(`h-10 rounded-sm px-3 font-mono text-sm`,M===e?`bg-accent text-accent-fg`:`bg-raised text-muted`),children:t},e))})]}),(0,S.jsxs)(`label`,{className:`block`,children:[(0,S.jsxs)(`span`,{className:`flex items-center justify-between gap-3`,children:[(0,S.jsx)(`span`,{className:`font-mono text-[11px] uppercase tracking-[0.16em] text-faint`,children:`Teams · one block each`}),(0,S.jsx)(`button`,{type:`button`,className:`font-mono text-[11px] uppercase text-muted hover:text-fg`,onClick:()=>F(x),children:`Load sample`})]}),(0,S.jsx)(`textarea`,{className:`mt-1.5 min-h-64 w-full rounded-md border-0 bg-raised px-3 py-2 font-mono text-xs leading-relaxed text-fg outline-none ring-0 placeholder:text-faint`,value:P,onChange:e=>F(e.target.value),placeholder:`Masthead | Ryan | 8-6 | 1541.2 | 1490
Josh Allen
Saquon Barkley
…

Night Desk | Alex | 7-7 | 1488
Lamar Jackson`,required:!0})]}),(0,S.jsxs)(`p`,{className:`text-xs leading-relaxed text-muted`,children:[`Header line is `,(0,S.jsx)(`span`,{className:`font-mono text-fg`,children:`Team | Manager | W-L | PF | PA`}),`. Players underneath, one name per line. Blank line between teams. Records are optional — leave them off to start a fresh season.`]})]}):null,w===`sleeper`?(0,S.jsxs)(`label`,{className:`block max-w-lg`,children:[(0,S.jsx)(`span`,{className:`font-mono text-[11px] uppercase tracking-[0.16em] text-faint`,children:`Sleeper league ID`}),(0,S.jsx)(y,{className:`mt-1.5`,value:E,onChange:e=>D(e.target.value),placeholder:`1180228818907533312`,required:!0})]}):null,w===`espn`?(0,S.jsxs)(`div`,{className:`max-w-lg space-y-4`,children:[(0,S.jsxs)(`label`,{className:`block`,children:[(0,S.jsx)(`span`,{className:`font-mono text-[11px] uppercase tracking-[0.16em] text-faint`,children:`ESPN league ID or URL`}),(0,S.jsx)(y,{className:`mt-1.5`,value:E,onChange:e=>D(e.target.value),placeholder:`fantasy.espn.com/football/league?leagueId=…`,required:!0})]}),(0,S.jsxs)(`div`,{children:[(0,S.jsx)(`p`,{className:`font-mono text-[11px] uppercase tracking-[0.16em] text-faint`,children:`Season`}),(0,S.jsx)(`div`,{className:`mt-1.5 flex gap-1`,children:[`2025`,`2026`].map(e=>(0,S.jsx)(`button`,{type:`button`,onClick:()=>j(e),className:_(`h-10 min-w-16 rounded-sm px-3 font-mono text-sm`,A===e?`bg-accent text-accent-fg`:`bg-raised text-muted`),children:e},e))})]}),(0,S.jsx)(`p`,{className:`text-xs text-muted`,children:`Private leagues need SWID + espn_s2, or flip the league public for one minute. Paste is simpler if you just want the names and scores.`}),(0,S.jsxs)(`label`,{className:`block`,children:[(0,S.jsx)(`span`,{className:`font-mono text-[11px] uppercase tracking-[0.16em] text-faint`,children:`SWID`}),(0,S.jsx)(y,{className:`mt-1.5`,value:I,onChange:e=>L(e.target.value),autoComplete:`off`})]}),(0,S.jsxs)(`label`,{className:`block`,children:[(0,S.jsx)(`span`,{className:`font-mono text-[11px] uppercase tracking-[0.16em] text-faint`,children:`espn_s2`}),(0,S.jsx)(y,{className:`mt-1.5`,value:R,onChange:e=>z(e.target.value),autoComplete:`off`})]})]}):null,(0,S.jsx)(v,{type:`submit`,variant:`outline`,disabled:W.isPending,children:W.isPending?`Reading…`:`Preview`})]}),H?(0,S.jsxs)(`section`,{className:`mt-10 max-w-2xl`,children:[(0,S.jsxs)(`p`,{className:`font-mono text-[11px] uppercase tracking-[0.16em] text-faint`,children:[H.season,` · `,H.teamCount,` teams · `,H.scoringLabel]}),(0,S.jsx)(`h2`,{className:`mt-1 font-display text-3xl`,children:H.name}),(0,S.jsx)(`p`,{className:`mt-3 text-sm text-muted`,children:`Claim your seat. Everyone else stays open.`}),(0,S.jsx)(`ul`,{className:`mt-4 divide-y divide-line rounded-xl bg-surface shadow-[var(--shadow-border)]`,children:H.teams.map(e=>(0,S.jsx)(`li`,{children:(0,S.jsxs)(`button`,{type:`button`,onClick:()=>V(e.rosterId),className:_(`flex w-full items-center justify-between gap-3 px-4 py-3 text-left`,B===e.rosterId&&`bg-raised`),children:[(0,S.jsxs)(`span`,{children:[(0,S.jsx)(`span`,{className:`block text-sm`,children:e.teamName}),(0,S.jsxs)(`span`,{className:`font-mono text-[11px] text-faint`,children:[e.manager,e.record?` · ${e.record}`:``,` · `,e.players,` matched`,e.unmatched?.length?` · ${e.unmatched.length} missed`:``]}),e.unmatched?.length?(0,S.jsxs)(`span`,{className:`mt-1 block text-[11px] text-muted`,children:[`Couldn’t match: `,e.unmatched.join(`, `)]}):null]}),(0,S.jsx)(`span`,{className:`font-mono text-[11px] uppercase text-faint`,children:B===e.rosterId?`Yours`:`Open`})]})},e.rosterId))}),(0,S.jsxs)(`div`,{className:`mt-5 flex items-center gap-3`,children:[(0,S.jsx)(v,{type:`button`,onClick:()=>G.mutate(),disabled:G.isPending,children:G.isPending?`Importing…`:`Create league`}),(0,S.jsx)(r,{to:`/`,className:`text-sm text-muted hover:text-fg`,children:`Cancel`})]})]}):null]}):(0,S.jsx)(a,{to:`/login`,search:{redirect:`/import`}})}export{C as component};
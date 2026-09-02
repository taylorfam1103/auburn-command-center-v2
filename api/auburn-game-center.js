const CFBD='https://api.collegefootballdata.com';
const AUBURN_ID='2';

function headers(){return{Authorization:`Bearer ${process.env.CFBD_API_KEY}`}}
function n(v){const x=Number(v);return Number.isFinite(x)?x:0}
function clean(v){return String(v??'').trim()}
function round(v,d=2){const x=Number(v);return Number.isFinite(x)?Number(x.toFixed(d)):null}

async function live(gameId){
const url=new URL(`${CFBD}/live/plays`);
url.searchParams.set('gameId',gameId);
const response=await fetch(url,{headers:headers()});
if(!response.ok)throw new Error(`LIVE PLAYS ${response.status}`);
const payload=await response.json();
return Array.isArray(payload)?payload[0]:payload;
}

function emptyPlayer(name){
return{name,passing:{completions:0,attempts:0,yards:0,touchdowns:0,interceptions:0,long:0},rushing:{attempts:0,yards:0,touchdowns:0,long:0},receiving:{receptions:0,targets:0,yards:0,touchdowns:0,long:0}}
}

function playersFromPlays(plays){
const people=new Map();
const player=name=>{const key=clean(name).replace(/\s+/g,' ').replace(/[,.]$/,'');if(!key)return null;if(!people.has(key))people.set(key,emptyPlayer(key));return people.get(key)};

for(const play of plays){
if(String(play.teamId)!==AUBURN_ID)continue;
const text=clean(play.playText);
if(!text)continue;
let m=text.match(/^(.+?)\s+pass(?:es)?\s+(complete|incomplete|intercepted)(?:\s+to\s+(.+?))?(?:\s+for\s+(-?\d+)\s+yards?)?/i);
if(m){
const qb=player(m[1]),result=clean(m[2]).toLowerCase(),receiverName=m[3],yards=m[4]!==undefined?Number(m[4]):0;
if(qb){
qb.passing.attempts++;
if(result==='complete'){qb.passing.completions++;qb.passing.yards+=yards;qb.passing.long=Math.max(qb.passing.long,yards)}
if(result==='intercepted')qb.passing.interceptions++;
if(/touchdown/i.test(text))qb.passing.touchdowns++;
}
if(receiverName){
const r=player(receiverName);
if(r){r.receiving.targets++;if(result==='complete'){r.receiving.receptions++;r.receiving.yards+=yards;r.receiving.long=Math.max(r.receiving.long,yards);if(/touchdown/i.test(text))r.receiving.touchdowns++}}
}
}
m=text.match(/^(.+?)\s+(?:run|rush)(?:es)?\s+for\s+(-?\d+)\s+yards?/i);
if(m){
const r=player(m[1]),yards=Number(m[2]);
if(r){r.rushing.attempts++;r.rushing.yards+=yards;r.rushing.long=Math.max(r.rushing.long,yards);if(/touchdown/i.test(text))r.rushing.touchdowns++}
}
}
const all=[...people.values()];
return{
passing:[...all].filter(p=>p.passing.attempts>0).sort((a,b)=>b.passing.yards-a.passing.yards).map(p=>({name:p.name,...p.passing})),
rushing:[...all].filter(p=>p.rushing.attempts>0).sort((a,b)=>b.rushing.yards-a.rushing.yards).map(p=>({name:p.name,...p.rushing})),
receiving:[...all].filter(p=>p.receiving.targets>0||p.receiving.receptions>0).sort((a,b)=>b.receiving.yards-a.receiving.yards).map(p=>({name:p.name,...p.receiving}))
};
}

function converted(play,down){
if(n(play.down)!==down)return false;
const distance=n(play.distance),yards=n(play.yardsGained),text=clean(play.playText).toLowerCase();
return distance>0&&(yards>=distance||text.includes('first down')||text.includes('touchdown'));
}

function derived(plays,teamId){
const teamPlays=plays.filter(p=>String(p.teamId)===String(teamId));
let rushingYards=0,passingYards=0,rushAttempts=0,passAttempts=0,firstDowns=0,turnovers=0,thirdAttempts=0,thirdMade=0,fourthAttempts=0,fourthMade=0;
for(const p of teamPlays){
const type=clean(p.rushPass).toLowerCase(),text=clean(p.playText).toLowerCase(),yards=n(p.yardsGained),distance=n(p.distance);
if(type==='rush'){rushAttempts++;rushingYards+=yards}
if(type==='pass'){passAttempts++;passingYards+=Math.max(0,yards)}
if(distance>0&&(yards>=distance||text.includes('first down')||text.includes('touchdown')))firstDowns++;
if(n(p.down)===3){thirdAttempts++;if(converted(p,3))thirdMade++}
if(n(p.down)===4){fourthAttempts++;if(converted(p,4))fourthMade++}
if(text.includes('intercept')||text.includes('fumble lost'))turnovers++;
}
const totalYards=rushingYards+passingYards,totalPlays=rushAttempts+passAttempts;
return{
totalYards,rushingYards,passingYards,rushAttempts,passAttempts,firstDowns,turnovers,plays:totalPlays,
yardsPerPlay:totalPlays?round(totalYards/totalPlays,1):0,
thirdDownRaw:`${thirdMade}/${thirdAttempts}`,thirdDownDisplay:`${thirdMade}/${thirdAttempts} • ${thirdAttempts?(thirdMade/thirdAttempts*100).toFixed(1):'0.0'}%`,thirdDownPct:thirdAttempts?round(thirdMade/thirdAttempts*100,1):0,
fourthDownRaw:`${fourthMade}/${fourthAttempts}`,fourthDownDisplay:`${fourthMade}/${fourthAttempts} • ${fourthAttempts?(fourthMade/fourthAttempts*100).toFixed(1):'0.0'}%`,fourthDownPct:fourthAttempts?round(fourthMade/fourthAttempts*100,1):0
};
}

function merge(d,team){
const drives=n(team?.drives),points=n(team?.points),opps=n(team?.scoringOpportunities);
return{...d,score:points,drives,scoringOpportunities:opps,pointsPerOpportunity:team?.pointsPerOpportunity!==undefined?round(team.pointsPerOpportunity,2):(opps?round(points/opps,2):0),pointsPerDrive:drives?round(points/drives,2):0,plays:team?.plays!==undefined?n(team.plays):d.plays,yardsPerPlay:team?.yardsPerPlay!==undefined?round(team.yardsPerPlay,1):d.yardsPerPlay};
}

function advanced(team){
return{successRate:round(team?.successRate,4),epaPerPlay:round(team?.epaPerPlay,3),explosiveness:round(team?.explosiveness,3),lineYardsPerRush:round(team?.lineYardsPerRush,2),secondLevelYardsPerRush:round(team?.secondLevelYardsPerRush,2),openFieldYardsPerRush:round(team?.openFieldYardsPerRush,2),standardDownSuccessRate:round(team?.standardDownsSuccessRate,4),passingDownSuccessRate:round(team?.passingDownsSuccessRate,4),pointsPerOpportunity:round(team?.pointsPerOpportunity,2)};
}

function dtext(period,clock,ytg){
const a=[];if(period)a.push(`Q${period}`);if(clock)a.push(clock);if(ytg!==undefined&&ytg!==null)a.push(`${ytg} YDS TO GOAL`);return a.join(' • ');
}
function normDrive(d){
if(!d)return null;
return{offense:d.offense||'',defense:d.defense||'',playCount:n(d.playCount),yards:n(d.yards),scoringOpportunity:Boolean(d.scoringOpportunity),result:d.result||'',pointsGained:n(d.pointsGained),startText:dtext(d.startPeriod,d.startClock,d.startYardsToGoal),endText:dtext(d.endPeriod,d.endClock,d.endYardsToGoal)};
}

module.exports=async function handler(req,res){
try{
const gameId=req.query.gameId;
if(!gameId)return res.status(400).json({error:'gameId required'});
const data=await live(gameId);
if(!data?.id)return res.json({available:false});

const drives=Array.isArray(data.drives)?data.drives:[];
const plays=drives.flatMap(d=>Array.isArray(d?.plays)?d.plays:[]);
const unique=Array.from(new Map(plays.map(p=>[String(p.id??`${p.wallClock}-${p.playText}`),p])).values());

const auburnTeam=(data.teams||[]).find(t=>String(t.teamId)===AUBURN_ID);
const opponentTeam=(data.teams||[]).find(t=>String(t.teamId)!==AUBURN_ID);

const recent=[...unique].sort((a,b)=>{const ta=a.wallClock?new Date(a.wallClock).getTime():0,tb=b.wallClock?new Date(b.wallClock).getTime():0;if(tb!==ta)return tb-ta;return n(b.period)-n(a.period)}).slice(0,12);

const currentRaw=[...drives].reverse().find(d=>!d.result)||drives[drives.length-1]||null;
const completed=drives.filter(d=>d.result);
const previousRaw=completed.length?completed[completed.length-1]:null;

res.setHeader('Cache-Control','public, s-maxage=10, stale-while-revalidate=10');
res.json({
available:true,id:String(data.id),status:data.status||'',period:data.period,clock:data.clock,possession:data.possession,down:data.down,distance:data.distance,yardsToGoal:data.yardsToGoal,lastPlay:recent[0]?.playText||'',
players:playersFromPlays(unique),
teamStats:{auburn:merge(derived(unique,AUBURN_ID),auburnTeam),opponent:merge(derived(unique,opponentTeam?.teamId),opponentTeam)},
advanced:{auburn:advanced(auburnTeam),opponent:advanced(opponentTeam)},
currentDrive:normDrive(currentRaw),previousDrive:normDrive(previousRaw),drives:drives.map(normDrive),
recentPlays:recent.map(p=>({id:p.id,period:p.period,clock:p.clock,team:p.team,teamId:p.teamId,down:p.down,distance:p.distance,yardsToGoal:p.yardsToGoal,yardsGained:p.yardsGained,rushPass:p.rushPass,playType:p.playType,playText:p.playText}))
});
}catch(error){console.error(error);res.status(500).json({available:false,error:error.message})}
};

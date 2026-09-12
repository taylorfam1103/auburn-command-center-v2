const CFBD='https://api.collegefootballdata.com';
const AUBURN_ID='2';

function headers(){
  return {Authorization:`Bearer ${process.env.CFBD_API_KEY}`};
}

function n(v){
  const x=Number(v);
  return Number.isFinite(x)?x:0;
}

function clean(v){
  return String(v??'').trim();
}

function round(v,d=2){
  const x=Number(v);
  return Number.isFinite(x)?Number(x.toFixed(d)):null;
}

async function getJson(path,params={}){
  const url=new URL(`${CFBD}${path}`);
  Object.entries(params).forEach(([k,v])=>{
    if(v!==undefined&&v!==null&&v!=='')url.searchParams.set(k,v);
  });
  const response=await fetch(url,{headers:headers()});
  if(!response.ok)throw new Error(`${path} ${response.status}`);
  return response.json();
}

function clockSeconds(clock){
  const m=clean(clock).match(/(\d+):(\d+)/);
  return m?Number(m[1])*60+Number(m[2]):null;
}

function durationSeconds(duration){
  const m=clean(duration).match(/(\d+):(\d+)/);
  return m?Number(m[1])*60+Number(m[2]):0;
}

function formatPossession(seconds){
  const total=Math.max(0,Math.round(n(seconds)));
  const minutes=Math.floor(total/60);
  const sec=String(total%60).padStart(2,'0');
  return `${minutes}:${sec}`;
}

function parsePenalty(playText,teamName){
  const text=clean(playText);
  if(!/penalty/i.test(text))return null;

  let belongs=false;
  if(teamName){
    const escaped=teamName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    belongs=new RegExp(`penalty[^,;]*${escaped}|penalty,?\\s*${escaped}`,'i').test(text);
  }

  const yards=text.match(/(\d+)\s+yards?/i);
  return {belongs,yards:yards?Number(yards[1]):0};
}

function turnoverFlags(text){
  const lower=clean(text).toLowerCase();
  return {
    interception:lower.includes('intercept'),
    fumbleLost:lower.includes('fumble')&&(lower.includes('lost')||lower.includes('recovered by'))
  };
}

function converted(play,down){
  if(n(play.down)!==down)return false;
  const distance=n(play.distance);
  if(distance<=0)return false;
  const text=clean(play.playText).toLowerCase();
  return n(play.yardsGained)>=distance||text.includes('first down')||text.includes('touchdown');
}

function deriveTeam(plays,drives,teamId,teamName,opponentId){
  const offensePlays=plays.filter(p=>String(p.teamId)===String(teamId));
  const opponentPlays=plays.filter(p=>String(p.teamId)===String(opponentId));

  let rushingYards=0,passingYards=0,rushAttempts=0,passAttempts=0;
  let firstDowns=0,thirdAttempts=0,thirdMade=0,fourthAttempts=0,fourthMade=0;
  let interceptions=0,fumblesLost=0,penalties=0,penaltyYards=0;
  let sacks=0;

  for(const p of offensePlays){
    const type=clean(p.rushPass).toLowerCase();
    const text=clean(p.playText).toLowerCase();
    const yards=n(p.yardsGained);
    const distance=n(p.distance);

    if(type==='rush'){
      rushAttempts++;
      rushingYards+=yards;
    }
    if(type==='pass'){
      passAttempts++;
      passingYards+=Math.max(0,yards);
    }

    if(distance>0&&(yards>=distance||text.includes('first down')||text.includes('touchdown'))){
      firstDowns++;
    }

    if(n(p.down)===3){
      thirdAttempts++;
      if(converted(p,3))thirdMade++;
    }

    if(n(p.down)===4){
      fourthAttempts++;
      if(converted(p,4))fourthMade++;
    }

    const flags=turnoverFlags(p.playText);
    if(flags.interception)interceptions++;
    if(flags.fumbleLost)fumblesLost++;

    const penalty=parsePenalty(p.playText,teamName);
    if(penalty&&penalty.belongs){
      penalties++;
      penaltyYards+=penalty.yards;
    }
  }

  // Defensive sacks: opponent is the offense on a sack play.
  for(const p of opponentPlays){
    const text=clean(p.playText).toLowerCase();
    if(text.includes('sack'))sacks++;
  }

  const totalYards=rushingYards+passingYards;
  const playsCount=rushAttempts+passAttempts;
  const turnovers=interceptions+fumblesLost;

  const teamDrives=drives.filter(d=>String(d.offenseId)===String(teamId));
  const possessionSeconds=teamDrives.reduce((sum,d)=>sum+durationSeconds(d.duration),0);

  return {
    totalYards,
    rushingYards,
    passingYards,
    rushAttempts,
    passAttempts,
    firstDowns,
    interceptions,
    fumblesLost,
    turnovers,
    sacks,
    penalties,
    penaltyYards,
    plays:playsCount,
    yardsPerPlay:playsCount?round(totalYards/playsCount,1):0,
    yardsPerRush:rushAttempts?round(rushingYards/rushAttempts,1):0,
    yardsPerPassAttempt:passAttempts?round(passingYards/passAttempts,1):0,
    thirdDownRaw:`${thirdMade}/${thirdAttempts}`,
    thirdDownDisplay:`${thirdMade}/${thirdAttempts} • ${thirdAttempts?(thirdMade/thirdAttempts*100).toFixed(1):'0.0'}%`,
    thirdDownPct:thirdAttempts?round(thirdMade/thirdAttempts*100,1):0,
    fourthDownRaw:`${fourthMade}/${fourthAttempts}`,
    fourthDownDisplay:`${fourthMade}/${fourthAttempts} • ${fourthAttempts?(fourthMade/fourthAttempts*100).toFixed(1):'0.0'}%`,
    fourthDownPct:fourthAttempts?round(fourthMade/fourthAttempts*100,1):0,
    possessionSeconds,
    timeOfPossession:formatPossession(possessionSeconds)
  };
}

function mergeStructured(derived,team){
  const drives=n(team?.drives);
  const points=n(team?.points);
  const scoringOpportunities=n(team?.scoringOpportunities);

  return {
    ...derived,
    score:points,
    drives,
    scoringOpportunities,
    pointsPerOpportunity:
      team?.pointsPerOpportunity!==undefined
        ? round(team.pointsPerOpportunity,2)
        : scoringOpportunities?round(points/scoringOpportunities,2):0,
    pointsPerDrive:drives?round(points/drives,2):0,
    plays:team?.plays!==undefined?n(team.plays):derived.plays
  };
}

function advanced(team){
  return {
    successRate:round(team?.successRate,4),
    epaPerPlay:round(team?.epaPerPlay,3),
    explosiveness:round(team?.explosiveness,3),
    lineYardsPerRush:round(team?.lineYardsPerRush,2),
    secondLevelYardsPerRush:round(team?.secondLevelYardsPerRush,2),
    openFieldYardsPerRush:round(team?.openFieldYardsPerRush,2),
    standardDownSuccessRate:round(team?.standardDownSuccessRate??team?.standardDownsSuccessRate,4),
    passingDownSuccessRate:round(team?.passingDownSuccessRate??team?.passingDownsSuccessRate,4),
    pointsPerOpportunity:round(team?.pointsPerOpportunity,2)
  };
}

function normalizeDrive(d){
  if(!d)return null;

  function driveText(period,clock,ytg){
    const a=[];
    if(period)a.push(`Q${period}`);
    if(clock)a.push(clock);
    if(ytg!==undefined&&ytg!==null)a.push(`${ytg} YDS TO GOAL`);
    return a.join(' • ');
  }

  return {
    offenseId:String(d.offenseId??''),
    offense:d.offense||'',
    defenseId:String(d.defenseId??''),
    defense:d.defense||'',
    playCount:n(d.playCount),
    yards:n(d.yards),
    duration:d.duration||'',
    scoringOpportunity:Boolean(d.scoringOpportunity),
    result:d.result||'',
    pointsGained:n(d.pointsGained),
    startText:driveText(d.startPeriod,d.startClock,d.startYardsToGoal),
    endText:driveText(d.endPeriod,d.endClock,d.endYardsToGoal)
  };
}

function playerBase(name){
  return {
    name,
    passing:{completions:0,attempts:0,yards:0,touchdowns:0,interceptions:0,long:0},
    rushing:{attempts:0,yards:0,touchdowns:0,long:0},
    receiving:{receptions:0,targets:0,yards:0,touchdowns:0,long:0},
    kicking:{fieldGoalsMade:0,fieldGoalsAttempted:0,extraPointsMade:0,extraPointsAttempted:0,long:0,points:0},
    punting:{punts:0,yards:0,inside20:0,touchbacks:0,long:0},
    kickReturn:{returns:0,yards:0,touchdowns:0,long:0},
    puntReturn:{returns:0,yards:0,touchdowns:0,long:0},
    defense:{tackles:0,solo:0,sacks:0,tfl:0,interceptions:0,forcedFumbles:0,fumbleRecoveries:0}
  };
}

function aggregatePlayStats(rows){
  const people=new Map();

  function person(row){
    const key=String(row.athleteId||row.athleteName);
    if(!people.has(key))people.set(key,playerBase(clean(row.athleteName)||'UNKNOWN'));
    return people.get(key);
  }

  for(const row of rows||[]){
    if(clean(row.team).toLowerCase()!=='auburn')continue;

    const p=person(row);
    const type=clean(row.statType).toLowerCase();
    const stat=n(row.stat);

    if(type.includes('pass completion'))p.passing.completions+=stat||1;
    else if(type.includes('pass attempt'))p.passing.attempts+=stat||1;
    else if(type.includes('passing yard')){p.passing.yards+=stat;p.passing.long=Math.max(p.passing.long,stat)}
    else if(type.includes('passing touchdown'))p.passing.touchdowns+=stat||1;
    else if(type.includes('interception thrown'))p.passing.interceptions+=stat||1;

    else if(type.includes('rush attempt')||type.includes('rushing attempt'))p.rushing.attempts+=stat||1;
    else if(type.includes('rushing yard')){p.rushing.yards+=stat;p.rushing.long=Math.max(p.rushing.long,stat)}
    else if(type.includes('rushing touchdown'))p.rushing.touchdowns+=stat||1;

    else if(type.includes('reception')&&!type.includes('return'))p.receiving.receptions+=stat||1;
    else if(type.includes('target'))p.receiving.targets+=stat||1;
    else if(type.includes('receiving yard')){p.receiving.yards+=stat;p.receiving.long=Math.max(p.receiving.long,stat)}
    else if(type.includes('receiving touchdown'))p.receiving.touchdowns+=stat||1;

    else if(type.includes('field goal made')){p.kicking.fieldGoalsMade+=stat||1;p.kicking.fieldGoalsAttempted+=stat||1;p.kicking.points+=3}
    else if(type.includes('field goal attempt'))p.kicking.fieldGoalsAttempted+=stat||1;
    else if(type.includes('field goal yard'))p.kicking.long=Math.max(p.kicking.long,stat);
    else if(type.includes('extra point made')||type.includes('pat made')){p.kicking.extraPointsMade+=stat||1;p.kicking.extraPointsAttempted+=stat||1;p.kicking.points+=1}
    else if(type.includes('extra point attempt')||type.includes('pat attempt'))p.kicking.extraPointsAttempted+=stat||1;

    else if(type==='punt'||type.includes('punt attempt'))p.punting.punts+=stat||1;
    else if(type.includes('punt yard')){p.punting.yards+=stat;p.punting.long=Math.max(p.punting.long,stat)}
    else if(type.includes('punt inside 20'))p.punting.inside20+=stat||1;
    else if(type.includes('punt touchback'))p.punting.touchbacks+=stat||1;

    else if(type.includes('kick return')) {
      if(type.includes('yard')){p.kickReturn.yards+=stat;p.kickReturn.long=Math.max(p.kickReturn.long,stat)}
      else if(type.includes('touchdown'))p.kickReturn.touchdowns+=stat||1;
      else p.kickReturn.returns+=stat||1;
    }
    else if(type.includes('punt return')) {
      if(type.includes('yard')){p.puntReturn.yards+=stat;p.puntReturn.long=Math.max(p.puntReturn.long,stat)}
      else if(type.includes('touchdown'))p.puntReturn.touchdowns+=stat||1;
      else p.puntReturn.returns+=stat||1;
    }

    else if(type.includes('solo tackle')){p.defense.solo+=stat||1;p.defense.tackles+=stat||1}
    else if(type.includes('tackle')&&!type.includes('loss'))p.defense.tackles+=stat||1;
    else if(type.includes('sack'))p.defense.sacks+=stat||1;
    else if(type.includes('tackle for loss'))p.defense.tfl+=stat||1;
    else if(type.includes('interception')&&!type.includes('thrown'))p.defense.interceptions+=stat||1;
    else if(type.includes('forced fumble'))p.defense.forcedFumbles+=stat||1;
    else if(type.includes('fumble recovery'))p.defense.fumbleRecoveries+=stat||1;
  }

  const all=[...people.values()];

  const returns=[];
  for(const p of all){
    if(p.kickReturn.returns||p.kickReturn.yards){
      returns.push({name:p.name,returnType:'KICK',...p.kickReturn});
    }
    if(p.puntReturn.returns||p.puntReturn.yards){
      returns.push({name:p.name,returnType:'PUNT',...p.puntReturn});
    }
  }

  return {
    passing:all.filter(p=>p.passing.attempts||p.passing.yards).map(p=>({name:p.name,...p.passing})).sort((a,b)=>b.yards-a.yards),
    rushing:all.filter(p=>p.rushing.attempts||p.rushing.yards).map(p=>({name:p.name,...p.rushing})).sort((a,b)=>b.yards-a.yards),
    receiving:all.filter(p=>p.receiving.receptions||p.receiving.targets||p.receiving.yards).map(p=>({name:p.name,...p.receiving})).sort((a,b)=>b.yards-a.yards),
    kicking:all.filter(p=>p.kicking.fieldGoalsAttempted||p.kicking.extraPointsAttempted).map(p=>({name:p.name,...p.kicking})).sort((a,b)=>b.points-a.points),
    punting:all.filter(p=>p.punting.punts||p.punting.yards).map(p=>({name:p.name,...p.punting})).sort((a,b)=>b.yards-a.yards),
    returns:returns.sort((a,b)=>b.yards-a.yards),
    defense:all.filter(p=>p.defense.tackles||p.defense.sacks||p.defense.interceptions||p.defense.forcedFumbles||p.defense.fumbleRecoveries).map(p=>({name:p.name,...p.defense})).sort((a,b)=>b.tackles-a.tackles||b.sacks-a.sacks)
  };
}

module.exports=async function handler(req,res){
  try{
    const gameId=req.query.gameId;
    if(!gameId)return res.status(400).json({error:'gameId required'});

    const [liveData,playStatsResult]=await Promise.all([
      getJson('/live/plays',{gameId}),
      getJson('/plays/stats',{gameId}).catch(()=>[])
    ]);

    const data=Array.isArray(liveData)?liveData[0]:liveData;
    if(!data?.id)return res.json({available:false});

    const drives=Array.isArray(data.drives)?data.drives:[];
    const rawPlays=drives.flatMap(d=>Array.isArray(d?.plays)?d.plays:[]);
    const plays=Array.from(new Map(rawPlays.map(p=>[String(p.id??`${p.wallClock}-${p.playText}`),p])).values());

    const auburnTeam=(data.teams||[]).find(t=>String(t.teamId)===AUBURN_ID);
    const opponentTeam=(data.teams||[]).find(t=>String(t.teamId)!==AUBURN_ID);

    const auburnDerived=deriveTeam(plays,drives,AUBURN_ID,auburnTeam?.team||'Auburn',opponentTeam?.teamId);
    const opponentDerived=deriveTeam(plays,drives,opponentTeam?.teamId,opponentTeam?.team||'',AUBURN_ID);

    const normalizedDrives=drives.map(normalizeDrive);
    const currentRaw=[...drives].reverse().find(d=>!d.result)||drives[drives.length-1]||null;
    const completed=drives.filter(d=>d.result);
    const previousRaw=completed.length?completed[completed.length-1]:null;

    const recent=[...plays].sort((a,b)=>{
      const ta=a.wallClock?new Date(a.wallClock).getTime():0;
      const tb=b.wallClock?new Date(b.wallClock).getTime():0;
      if(tb!==ta)return tb-ta;
      return n(b.period)-n(a.period);
    }).slice(0,12);

    res.setHeader('Cache-Control','public, s-maxage=15, stale-while-revalidate=15');

    res.json({
      available:true,
      id:String(data.id),
      status:data.status||'',
      period:data.period,
      clock:data.clock,
      possession:data.possession,
      down:data.down,
      distance:data.distance,
      yardsToGoal:data.yardsToGoal,
      lastPlay:recent[0]?.playText||'',

      players:aggregatePlayStats(Array.isArray(playStatsResult)?playStatsResult:[]),

      teamStats:{
        auburn:mergeStructured(auburnDerived,auburnTeam),
        opponent:mergeStructured(opponentDerived,opponentTeam)
      },

      advanced:{
        auburn:advanced(auburnTeam),
        opponent:advanced(opponentTeam)
      },

      currentDrive:normalizeDrive(currentRaw),
      previousDrive:normalizeDrive(previousRaw),
      drives:normalizedDrives,

      recentPlays:recent.map(p=>({
        id:p.id,
        period:p.period,
        clock:p.clock,
        team:p.team,
        teamId:p.teamId,
        down:p.down,
        distance:p.distance,
        yardsToGoal:p.yardsToGoal,
        yardsGained:p.yardsGained,
        rushPass:p.rushPass,
        playType:p.playType,
        playText:p.playText
      }))
    });

  }catch(error){
    console.error(error);
    res.status(500).json({available:false,error:error.message});
  }
};

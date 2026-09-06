import { MatchEngine } from '../outputs/retro-football/src/engine.ts';
import { EMPTY_INPUT } from '../outputs/retro-football/src/types.ts';

const results=[];
for (const seed of [1,42,9182,2026,999]) {
  const g = new MatchEngine(0,180,seed); const phases:Record<string,number>={}; const ev:Record<string,number>={};
  let maxOwner=0,ownerTime=0,lastOwner:number|null=null,maxIdle=0,idle=0,frames=0;
  const hist:any[]=[];
  while(g.state.phase!=='fulltime' && frames<60*600) {
    const s=g.state,p=s.players[s.controlled];
    if(s.phase==='halftime'){g.continueHalf();continue}
    phases[s.phase]=(phases[s.phase]||0)+1/60;
    const owned=s.ball.owner!==null&&s.players[s.ball.owner].team===0;
    const dx=owned?s.attack[0]:s.ball.x-p.x,dz=owned?-p.z*.08:s.ball.z-p.z,n=Math.hypot(dx,dz)||1;
    const shoot=owned&&p.x*s.attack[0]>22&&Math.abs(p.z)<16;
    g.update(1/60,{...EMPTY_INPUT,x:dx/n,z:dz/n,sprint:owned,
      pass:s.phase!=='playing'||(!owned&&frames%30===0)||(owned&&frames%200===0&&!shoot),
      through:owned&&frames%450===100,
      cross:s.phase==='corner'||owned&&Math.abs(p.z)>18&&p.x*s.attack[0]>25&&frames%90===0,
      shootPressed:shoot&&frames%50===0,shootHeld:shoot&&frames%50<10,shootReleased:shoot&&frames%50===10,
      switchPlayer:!owned&&frames%90===0});
    for (const e of g.events) { ev[e.type]=(ev[e.type]||0)+1; if(e.type==='goal')ev['goal-'+s.ball.flight]=(ev['goal-'+s.ball.flight]||0)+1; }
    if(s.phase==='playing') {
      ownerTime=s.ball.owner===lastOwner&&lastOwner!==null?ownerTime+1/60:0;lastOwner=s.ball.owner;maxOwner=Math.max(maxOwner,ownerTime);
      idle=Math.hypot(s.ball.vx,s.ball.vz)<.2?idle+1/60:0; maxIdle=Math.max(maxIdle,idle);
    }
    if(frames%600===0)hist.push({clock:Math.round(s.elapsed),half:s.half,phase:s.phase,score:s.score.join('-'),ball:[Math.round(s.ball.x),Math.round(s.ball.z)],owner:s.ball.owner,shots:s.stats.shots.join('-')});
    frames++;
  }
  results.push({seed,seconds:Math.round(frames/60),score:g.state.score,stats:g.state.stats,phases,events:ev,maxOwner,maxIdle,final:g.state.phase,hist});
}
console.log(JSON.stringify(results,null,2));

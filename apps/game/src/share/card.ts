import type { Team } from '../types';

export type CardFormat = 'feed' | 'story';
export interface ShareCardData {
  mine: Team; rival: Team; myScore: number; rivalScore: number;
  myShots: number; rivalShots: number; points: number | null; friendly: boolean;
}
export function cardCopy(data: ShareCardData) {
  if (data.myScore > data.rivalScore) return { headline: ['DID IT FOR', 'MY COUNTRY.'], challenge: 'THINK YOU CAN BEAT THAT?', label: 'VICTORY' };
  if (data.myScore < data.rivalScore) return { headline: ['THE REMATCH', 'IS PERSONAL.'], challenge: 'YOUR COUNTRY. YOUR TURN.', label: 'FULL TIME' };
  return { headline: ['ALL SQUARE.', 'STILL RIVALS.'], challenge: 'SETTLE IT ON THE PITCH.', label: 'DRAW' };
}

/** Fixed export dimensions; all text is fitted before drawing, including long country names. */
export function renderShareCard(data: ShareCardData, format: CardFormat): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = format === 'story' ? 1920 : 1350;
  const x = canvas.getContext('2d')!;
  const h = canvas.height, story = format === 'story', top = story ? 190 : 64;
  const ink = '#111e30', paper = '#f7f1df', muted = '#adb9bd', gold = '#ffce45';
  const copy = cardCopy(data);
  const rect = (a:number,b:number,w:number,v:number,c:string) => { x.fillStyle=c;x.fillRect(a,b,w,v); };
  const text = (value:string,a:number,b:number,size:number,color=paper,max=952,display=false,align:CanvasTextAlign='left') => {
    x.textAlign=align; x.fillStyle=color;
    const family=display?'Impact, "Arial Narrow", sans-serif':'Arial, sans-serif';
    let fitted=size;x.font=`${display?'900':'700'} ${fitted}px ${family}`;
    while(x.measureText(value).width>max && fitted>12) { fitted--;x.font=`${display?'900':'700'} ${fitted}px ${family}`; }
    x.fillText(value,a,b);
  };
  rect(0,0,1080,h,ink);
  // Faint pitch geometry and diagonal grain give the flat artwork some depth.
  x.strokeStyle='#ffffff0b';x.lineWidth=2;
  for(let i=-h;i<1080;i+=28){x.beginPath();x.moveTo(i,0);x.lineTo(i+h,h);x.stroke();}
  x.strokeStyle='#ffffff13';x.lineWidth=3;x.strokeRect(36,36,1008,h-72);
  x.beginPath();x.arc(1060,h*.58,360,0,Math.PI*2);x.stroke();
  rect(64,top,14,34,gold);rect(84,top,14,22,gold);
  text('HNC LEAGUE',116,top+29,30,paper,430);
  text('COUNTRY CLASH / 1V1',1016,top+27,19,muted,370,false,'right');
  const headlineY=top+152;
  text(copy.headline[0],64,headlineY,105,paper,952,true);
  text(copy.headline[1],64,headlineY+111,105,gold,952,true);
  text(`I PLAY FOR ${data.mine.name.toUpperCase()}`,66,headlineY+166,26,paper,930);
  const sy=story?650:475, sh=story?535:420;
  rect(64,sy,952,sh,paper);
  const teamPanel=(team:Team,start:number,score:number,mine:boolean) => {
    x.save();x.beginPath();x.rect(start,sy,474,sh-74);x.clip();
    rect(start,sy,474,sh-74,team.color);
    rect(start,sy,474,sh-74,'#00000066');
    // Oversized diagonal sash uses the national kit's secondary color.
    x.fillStyle=team.secondary;x.globalAlpha=.38;
    x.beginPath();x.moveTo(start+300,sy);x.lineTo(start+474,sy);x.lineTo(start+174,sy+sh);x.lineTo(start,sy+sh);x.closePath();x.fill();x.globalAlpha=1;
    rect(start+25,sy+25,74,42,ink);
    text(team.short.toUpperCase(),start+62,sy+55,22,paper,65,false,'center');
    text(mine?'MY COUNTRY':'THE RIVAL',start+444,sy+54,16,paper,250,false,'right');
    text(String(score),start+237,sy+sh-114,story?330:255,'#ffffff',380,true,'center');
    x.restore();
    text(team.name.toUpperCase(),start+237,sy+sh-28,28,ink,426,false,'center');
  };
  teamPanel(data.mine,64,data.myScore,true);teamPanel(data.rival,542,data.rivalScore,false);
  rect(514,sy+sh*.43,52,48,ink);text('–',540,sy+sh*.43+33,32,paper,45,false,'center');
  const detailsY=sy+sh+54;
  const badge=data.friendly?'FRIENDLY MATCH':data.points===null?'FULL TIME · RESULT PENDING':`+${data.points} COUNTRY POINT${data.points===1?'':'S'}`;
  text(badge,64,detailsY,25,gold,660);
  text(copy.label,1016,detailsY,22,paper,270,false,'right');
  text(`SHOTS  ${data.myShots} : ${data.rivalShots}`,64,detailsY+48,20,muted,600);
  const footerY=story?1535:1120;
  text(copy.challenge,64,footerY,52,paper,952,true);
  rect(64,footerY+40,952,88,gold);
  text('PLAY FOR YOUR COUNTRY',91,footerY+97,28,ink,760);
  text('↗',979,footerY+101,42,ink,65,false,'right');
  text('HNCLEAGUE.COM',64,footerY+176,24,paper,600);
  text('FREE TO PLAY',1016,footerY+176,18,muted,300,false,'right');
  return canvas;
}

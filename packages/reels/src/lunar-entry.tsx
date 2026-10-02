import React from 'react';
import {AbsoluteFill, Audio, Composition, Img, OffthreadVideo, Sequence, interpolate, registerRoot, staticFile, useCurrentFrame} from 'remotion';

type Props={mode:'preview'|'final';sound:boolean};
const base='generated/shorts/first-touch-on-the-moon';
const cream='#f4eee0',gold='#bd9b5c',navy='#101b31';
const fontCSS=`@font-face{font-family:LunarDisplay;src:url('${staticFile('generated/diaries/fonts/BarlowCondensed-SemiBold.ttf')}')}@font-face{font-family:LunarText;src:url('${staticFile('generated/diaries/fonts/Inter.ttf')}')}`;
const fade=(f:number,a:number,b:number)=>interpolate(f,[a,b],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
const Plate=({name,mode}:{name:string;mode:string})=><OffthreadVideo src={staticFile(`${base}/${mode}/${name}.mp4`)} muted style={{width:'100%',height:'100%',objectFit:'cover'}}/>;
const Micro=({children,secondary}:{children:React.ReactNode;secondary?:string})=>{
  const f=useCurrentFrame();
  return <div style={{position:'absolute',left:72,top:180,color:cream,opacity:fade(f,0,9),fontFamily:'LunarText',fontSize:28,letterSpacing:3}}>
    <div style={{borderTop:`3px solid ${gold}`,width:58,marginBottom:22}}/>{children}
    {secondary&&<div style={{fontSize:22,letterSpacing:2,marginTop:14,color:'#c3bcae'}}>{secondary}</div>}
  </div>;
};

const LunarOutro=({mode}:{mode:Props['mode']})=>{
  const f=useCurrentFrame();
  const bloom=fade(f,6,84),paper=fade(f,65,96),identity=fade(f,92,120),cta=fade(f,135,159);
  return <AbsoluteFill>
    <Sequence durationInFrames={138}><Plate name="12-cta" mode={mode}/></Sequence>
    <AbsoluteFill style={{pointerEvents:'none',background:`radial-gradient(ellipse at 56% 73%, #fff 0%, #fffdf2 17%, rgba(255,241,197,.82) 31%, rgba(255,236,190,.18) 48%, transparent 66%)`,opacity:bloom,transform:`scale(${interpolate(bloom,[0,1],[.02,4.5])})`,transformOrigin:'56% 73%'}}/>
    <AbsoluteFill style={{background:'#fff',opacity:paper}}/>
    <AbsoluteFill style={{color:navy,fontFamily:'LunarText',opacity:identity}}>
      <div style={{position:'absolute',top:220,left:90,right:90,display:'flex',justifyContent:'space-between',fontSize:25,letterSpacing:3,borderTop:`2px solid ${gold}`,paddingTop:24}}><span>HNC LUNAR SERIES</span><span>001</span></div>
      <svg viewBox="0 0 1080 650" style={{position:'absolute',top:370,width:1080,height:650}} aria-hidden="true">
        <ellipse cx="540" cy="330" rx="310" ry="110" fill="none" stroke={gold} strokeWidth="2" transform="rotate(-24 540 330)"/>
        <circle cx="807" cy="216" r="9" fill={gold}/>
      </svg>
      <Img src={staticFile(`${base}/hnc-retro-v2.png`)} style={{position:'absolute',left:375,top:530,width:330,height:330}}/>
      <div style={{position:'absolute',top:910,left:72,right:72,textAlign:'center',fontFamily:'LunarDisplay',fontSize:122,lineHeight:1,letterSpacing:2}}>HNCLEAGUE</div>
      <div style={{position:'absolute',top:1055,left:72,right:72,textAlign:'center',fontSize:27,letterSpacing:4}}>THE FIRST TOUCH ON THE MOON</div>
      <div style={{position:'absolute',top:1180,left:72,right:72,textAlign:'center',opacity:cta}}>
        <div style={{fontFamily:'LunarDisplay',fontSize:91,lineHeight:1}}>RATE THE TOUCH.</div>
        <div style={{fontFamily:'LunarDisplay',fontSize:87,lineHeight:1.15,color:'#95763d'}}>1–10 ↓</div>
      </div>
      <div style={{position:'absolute',top:1480,left:72,right:72,textAlign:'center',fontSize:29,letterSpacing:4}}>HNCLEAGUE.COM</div>
      <div style={{position:'absolute',top:1585,left:72,right:72,textAlign:'center',fontSize:18,lineHeight:1.6,color:'#66665e'}}>SUNRISE RECORDING · KEVIN MACLEOD · CC BY 3.0<br/>CONTINUOUS EXCERPT · FULL CREDIT IN PUBLICATION COPY</div>
    </AbsoluteFill>
  </AbsoluteFill>;
};
const shots=[
  {name:'01-space',at:0,duration:5.6}, {name:'02-cabin',at:5.6,duration:2.7},
  {name:'03-prep',at:8.3,duration:2.4}, {name:'04-approach',at:10.7,duration:4},
  {name:'05-airlock',at:14.7,duration:2.4}, {name:'06-first-step',at:17.1,duration:1.9},
  {name:'07-lunar-wide',at:19,duration:8.6}, {name:'08-build',at:27.6,duration:3.5},
  {name:'09-play',at:31.1,duration:2.3}, {name:'10-first-touch',at:33.4,duration:1.7},
];
export const LunarFilm=({mode,sound}:Props)=>{
  const f=useCurrentFrame();
  return <AbsoluteFill style={{backgroundColor:'#000'}}>
    <style>{fontCSS}</style>
    {shots.map(shot=><Sequence key={shot.name} from={Math.round(shot.at*60)} durationInFrames={Math.round(shot.duration*60)}>
      <Plate name={shot.name} mode={mode}/>
      {shot.name==='01-space'&&<Micro secondary="AWAY DISTANCE 384,400 KM">HNC LUNAR AWAY DAY</Micro>}
      {shot.name==='03-prep'&&<Micro>FIRST TOUCH PROTOCOL</Micro>}
      {shot.name==='08-build'&&<Micro>FIRST TOUCH</Micro>}
    </Sequence>)}
    <Sequence from={2106} durationInFrames={498}><LunarOutro mode={mode}/></Sequence>
    {sound&&<Audio src={staticFile(`${base}/audio-mix.wav`)}/>}
    <AbsoluteFill style={{backgroundColor:'#000',pointerEvents:'none',opacity:1-fade(f,0,15)}}/>
  </AbsoluteFill>;
};
const Root=()=> <Composition id="HncLunarAwayDay" component={LunarFilm} durationInFrames={2604} fps={60} width={1080} height={1920} defaultProps={{mode:'final',sound:true}}/>;
registerRoot(Root);

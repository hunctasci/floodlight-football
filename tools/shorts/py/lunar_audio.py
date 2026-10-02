"""Waveform-led Sunrise edit + original non-tonal subjective lunar sound.

Original recording is CC BY 3.0 Kevin MacLeod (see episode provenance).
No tonal oscillator, no external lunar ambience, no paid synthesis service.
"""
import json
import subprocess
from pathlib import Path
import numpy as np
from scipy.signal import butter, sosfilt, find_peaks
from scipy.io import wavfile
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[3]
EP=ROOT/'social/shorts/first-touch-on-the-moon'
OUT=ROOT/'social/output/shorts/first-touch-on-the-moon'
PUBLIC=ROOT/'packages/reels/public/generated/shorts/first-touch-on-the-moon'
SR=48000;TOTAL=43.4;N=round(TOTAL*SR)

def read(path,channels=2):
    p=subprocess.run(['ffmpeg','-v','error','-i',str(path),'-f','f32le','-ar',str(SR),'-ac',str(channels),'pipe:1'],capture_output=True,check=True)
    return np.frombuffer(p.stdout,dtype=np.float32).reshape(-1,channels).astype(np.float64)

def write(path,a):wavfile.write(path,SR,a.astype(np.float32))

def put(dst,a,t,gain=1):
    i=round(t*SR);k=min(len(a),len(dst)-i)
    dst[i:i+k]+=a[:k]*gain

def music():
    source=read(EP/'assets/zarathustra.ogg')
    dst=np.zeros((N,2))
    # User-selected recurring phrase, trimmed 3.2 seconds from source 40.
    # One continuous excerpt at original tempo, with no artificial gain ramp.
    edits=[(43.2,len(source)/SR,0,.025,0)]
    for start,end,at,fi,fo in edits:
        a=source[round(start*SR):round(end*SR)].copy()
        if fi:a[:round(fi*SR)]*=np.linspace(0,1,round(fi*SR))[:,None]
        if fo:a[-round(fo*SR):]*=np.linspace(1,0,round(fo*SR))[:,None]
        put(dst,a,at,.95)
    e=np.sqrt(np.mean(source[:len(source)//2400*2400].reshape(-1,2400,2)**2,axis=(1,2)))
    peaks,_=find_peaks(e,prominence=.025,distance=15)
    markers={
      'analysis':'decoded stereo RMS, 50 ms windows; local peak prominence 0.025; all times seconds',
      'source_peaks':[{'source':round(float(p)*.05,3),'rms':round(float(e[p]),4)} for p in peaks],
      'edit_segments':[{'source_in':s,'source_out':en,'film_in':at,'fade_in':fi,'fade_out':fo} for s,en,at,fi,fo in edits],
      'film_markers':[
        {'label':'continuous recurring passage begins','source':43.2,'film':0},
        {'label':'recurring brass entrance / cabin','source':49.6,'film':6.4},
        {'label':'rising phrase / prep','source':51.5,'film':8.3},
        {'label':'orchestral entrance / approach','source':55.45,'film':12.25},
        {'label':'percussive accent / approach','source':57.45,'film':14.25},
        {'label':'airlock reveal','source':58.75,'film':15.55},
        {'label':'first step accent','source':61.1,'film':17.9},
        {'label':'lunar wide crescendo','source':65.45,'film':22.25},
        {'label':'ball down accent','source':71,'film':27.8},
        {'label':'pass / final buildup','source':75.5,'film':32.3},
        {'label':'highest recording crest / first touch','source':77.7,'film':34.5},
        {'label':'glow-to-white outro begins','source':78.3,'film':35.1},
        {'label':'natural recording ending','source':len(source)/SR,'film':len(source)/SR-43.2}
      ],
      'policy':'continuous original-tempo excerpt through actual EOF; no internal cut, end fade, gain ramp or voice',
      'selection':'whole-recording maximum at 77.70 s; source ending retained intact'}
    (EP/'music-markers.json').write_text(json.dumps(markers,indent=2)+'\n')
    waveform(dst,markers)
    return dst

def waveform(a,markers):
    im=Image.new('RGB',(1400,430),'#101b31');d=ImageDraw.Draw(im)
    font=ImageFont.truetype(str(ROOT/'packages/reels/public/generated/diaries/fonts/Inter.ttf'),18)
    amp=np.max(np.abs(a[:N//720*720].reshape(-1,720,2)),axis=(1,2))
    for i,v in enumerate(amp):
        x=40+i/(len(amp)-1)*1320;h=v/max(float(amp.max()),1e-8)*130
        d.line((x,240-h,x,240+h),fill='#d5c9ae')
    for j,m in enumerate(markers['film_markers']):
        x=40+m['film']/TOTAL*1320;d.line((x,190,x,390),fill='#bd9b5c')
        d.text((min(x,1150),25+(j%4)*33),f"{m['film']:.2f} {m['label'][:24]}",font=font,fill='#f4eee0')
    im.save(OUT/'music-waveform.png')

def main():
    OUT.mkdir(parents=True,exist_ok=True);PUBLIC.mkdir(parents=True,exist_ok=True)
    mus=music();voice=np.zeros((N,2));foley=np.zeros((N,2));mech=np.zeros((N,2))
    rng=np.random.default_rng(1004)
    def texture(dur,lo,hi,decay=0):
        count=round(dur*SR);a=rng.normal(0,1,count)
        a=sosfilt(butter(3,[lo,hi],btype='bandpass',fs=SR,output='sos'),a)
        a/=max(np.max(np.abs(a)),1e-9)
        env=np.exp(-np.arange(count)/SR*decay) if decay else np.ones(count)
        fade=min(round(.012*SR),count//3)
        env[:fade]*=np.linspace(0,1,fade);env[-fade:]*=np.linspace(1,0,fade)
        return (a*env)[:,None]*np.array([[1,.93]])
    # Interior broadband ventilation only, never on exterior shots.
    for at,dur in [(5.6,5.1),(14.7,2.4)]:
        vent=texture(dur,160,1300)
        vent[:int(.2*SR)]*=np.linspace(0,1,int(.2*SR))[:,None]
        vent[-int(.3*SR):]*=np.linspace(1,0,int(.3*SR))[:,None]
        put(mech,vent,at,.009)
        put(mech,texture(dur,45,140),at,.011)
    for t in (6.2,6.75,8.7):put(mech,texture(.085,650,3700,32),t,.038)
    put(mech,texture(.8,180,1100),14.95,.026)
    put(mech,texture(.14,70,500,24),15.75,.040)
    # Subjective suit/body contact. No lunar wind; no voice after user revision.
    for t in (17.7,18.62):
        put(foley,texture(.11,65,210,22),t,.052)
        put(foley,texture(.05,550,1900,55),t,.012)
    put(foley,texture(.10,100,480,24),28.35,.025)
    put(foley,texture(.08,95,320,25),31.45,.035)
    put(foley,texture(.13,70,230,24),34.5,.115)
    put(foley,texture(.06,500,2200,45),34.5,.036)
    mix=mus+voice+foley+mech
    for name,a in [('music',mus),('voice',voice),('foley',foley),('mechanical',mech)]:write(OUT/f'{name}.wav',a)
    write(OUT/'audio-premix.wav',mix)
    # Measure, then apply ONE constant gain. Adaptive loudness normalization
    # would fight the musical build the user specifically needs to retain.
    first=subprocess.run(['ffmpeg','-hide_banner','-i',str(OUT/'audio-premix.wav'),'-af',
      'loudnorm=I=-15.5:TP=-1:LRA=20:print_format=json','-f','null','-'],capture_output=True,text=True,check=True)
    report=json.JSONDecoder().raw_decode(first.stderr[first.stderr.rfind('{'):])[0]
    gain=min(-15.5-float(report['input_i']),-1.15-float(report['input_tp']))
    filt=f'volume={gain:.4f}dB'
    second=subprocess.run(['ffmpeg','-hide_banner','-y','-i',str(OUT/'audio-premix.wav'),'-af',filt,
      '-ar',str(SR),'-c:a','pcm_s24le',str(OUT/'audio-mix.wav')],capture_output=True,text=True,check=True)
    measured=subprocess.run(['ffmpeg','-hide_banner','-i',str(OUT/'audio-mix.wav'),'-af',
      'loudnorm=I=-15.5:TP=-1:LRA=20:print_format=json','-f','null','-'],capture_output=True,text=True,check=True)
    result=json.JSONDecoder().raw_decode(measured.stderr[measured.stderr.rfind('{'):])[0]
    (OUT/'audio-normalization.json').write_text(json.dumps({'premix_measurement':report,
      'mastering':'constant gain only; no compression, limiter or adaptive gain',
      'gain_db':gain,'final_integrated_lufs':result['input_i'],'final_true_peak_dbtp':result['input_tp'],
      'final_lra':result['input_lra']},indent=2)+'\n')
    (PUBLIC/'audio-mix.wav').write_bytes((OUT/'audio-mix.wav').read_bytes())
    print((OUT/'audio-normalization.json').read_text())

if __name__=='__main__':main()

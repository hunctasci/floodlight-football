"""Local lunar plate encoding and inspected review artifacts (no network)."""
import argparse
import json
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'social/output/shorts/first-touch-on-the-moon'
PUBLIC=ROOT/'packages/reels/public/generated/shorts/first-touch-on-the-moon'
SHOTS=[('01-space',5.6),('02-cabin',2.7),('03-prep',2.4),('04-approach',4.0),
         ('05-airlock',2.4),('06-first-step',1.9),('07-lunar-wide',8.6),
         ('08-build',3.5),('09-play',2.3),('10-first-touch',1.7),
         ('11-clean',1.2),('12-cta',2.3)]

def run(args):subprocess.run(args,check=True)

def sheet(folder,dest,names=None):
    imgs=[folder/f'{n}.png' for n in names] if names else sorted(folder.glob('*.png'))
    w,h=270,480;canvas=Image.new('RGB',(4*w,3*(h+40)), '#101b31')
    d=ImageDraw.Draw(canvas)
    font=ImageFont.truetype(str(ROOT/'packages/reels/public/generated/diaries/fonts/BarlowCondensed-Medium.ttf'),21)
    for i,p in enumerate(imgs):
        im=Image.open(p).convert('RGB');im.thumbnail((w,h))
        x=(i%4)*w;y=(i//4)*(h+40)
        canvas.paste(im,(x,y));d.text((x+12,y+h+7),p.stem,fill='#f4eddf',font=font)
    canvas.save(dest)

def encode(mode):
    dst=PUBLIC/mode;dst.mkdir(parents=True,exist_ok=True)
    for name,dur in SHOTS:
        folder=OUT/mode/name
        if mode=='preview':
            inp=['-framerate','15','-pattern_type','glob','-i',str(folder/'*.png')]
        else:inp=['-framerate','60','-i',str(folder/'%04d.png')]
        run(['ffmpeg','-hide_banner','-loglevel','error','-y',*inp,'-t',str(dur),'-r','60',
             '-c:v','libx264','-preset','fast','-crf','17' if mode=='final' else '23',
             '-pix_fmt','yuv420p','-movflags','+faststart',str(dst/f'{name}.mp4')])
    lines=''.join(f"file '{dst/name}.mp4'\n" for name,_ in SHOTS)
    (OUT/f'{mode}-concat.txt').write_text(lines)
    run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(OUT/f'{mode}-concat.txt'),
         '-c','copy',str(OUT/f'{mode}-picture.mp4')])

def extract(video):
    names=['01-space','02-cabin','03-prep','04-approach','05-airlock','06-first-step','07-lunar-wide','08-build','09-first-touch','10-clean','11-cta']
    times=[2.5,6.8,9.4,12.8,16.0,18.1,23.5,29.0,34.5,37.9,41.4]
    for name,t in zip(names,times):
        run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',str(t),'-i',str(video),'-frames:v','1',str(OUT/f'{name}.png')])
    sheet(OUT,OUT/'first-touch-on-the-moon-contact-sheet.png',names)

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('task',choices=['sheet','preview','final','extract']);args=ap.parse_args()
    if args.task=='sheet':sheet(OUT/'storyboard',OUT/'storyboard-contact-sheet.png')
    elif args.task=='extract':extract(OUT/'first-touch-on-the-moon.mp4')
    else:encode(args.task)

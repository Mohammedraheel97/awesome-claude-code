#!/bin/bash
# Builds a 9:16 reel from hoodie.png. Shots: x,y,w,h crop (9:16) + zoom direction.
set -e
cd "$(dirname "$0")"
FPS=30; D=60   # 2s per shot
shot() { # name x y w h zexpr
  ffmpeg -y -loglevel error -i hoodie.png -vf "crop=$4:$5:$2:$3,scale=2160:3840:flags=lanczos,zoompan=z='$6':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=$D:s=1080x1920:fps=$FPS,format=yuv420p" -frames:v $D -c:v libx264 -crf 17 s_$1.mp4
}
shot 1 255 170 380 675 "1.0+0.0030*on"        # logo hook, push in
shot 2 140 0 630 1120 "1.12-0.0020*on"          # full body, pull out
shot 3 235 450 360 640 "1.0+0.0025*on"          # pocket
shot 4 40 640 300 533 "1.0+0.0025*on"           # cuff / fabric
shot 5 190 120 560 995 "1.0+0.0030*on"          # logo again, wide-ish finale
ffmpeg -y -loglevel error $(for i in 1 2 3 4 5; do echo -i s_$i.mp4; done) -filter_complex \
"[0][1]xfade=transition=fade:duration=0.25:offset=1.75[a];[a][2]xfade=transition=slideleft:duration=0.25:offset=3.5[b];[b][3]xfade=transition=fade:duration=0.25:offset=5.25[c];[c][4]xfade=transition=fade:duration=0.25:offset=7.0,drawtext=text='SHOP NOW - LINK IN BIO':fontcolor=white:fontsize=56:borderw=4:bordercolor=black:x=(w-text_w)/2:y=h-520:enable='gte(t,7.3)'[v]" \
-map "[v]" -r $FPS -c:v libx264 -pix_fmt yuv420p -movflags +faststart reel_mustang_hoodie.mp4
rm s_*.mp4

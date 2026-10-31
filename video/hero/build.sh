#!/bin/bash
# Builds the website hero background video from the stock clips in ../clips.
set -e
cd "$(dirname "$0")/../clips"
N="scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,fps=25,setsar=1,format=yuv420p"
G="eq=saturation=0.86:contrast=1.04:brightness=-0.015,colorbalance=rs=0.035:gs=0.01:bs=-0.035"
# Story (QR ordering only, no paper menus or notepads):
# scan the table QR -> order on the phone -> food comes to the table.
ffmpeg -v error -y \
 -ss 0    -t 3.15 -i 5226464-hd_1920_1080_30fps.mp4 \
 -ss 0    -t 2.4 -i 7223986-uhd_4096_2160_25fps.mp4 \
 -ss 0    -t 3.5 -i mixkit-the-waiter-serves-the-coffee-and-sandwich-24278-hd-ready.mp4 \
 -ss 0.3  -t 2.3 -i mixkit-waiter-carries-a-cup-of-coffee-to-customer-219-hd-ready.mp4 \
 -ss 4.0  -t 4.5 -i mixkit-the-waiter-serves-the-coffee-and-sandwich-24278-hd-ready.mp4 \
 -ss 10.5 -t 3.7 -i 7223986-uhd_4096_2160_25fps.mp4 \
 -filter_complex "
 [0:v]setpts=1.15*PTS,$N,$G[a];[1:v]$N,$G[b];[2:v]$N,$G[c];[3:v]$N,$G[d];[4:v]$N,$G[e];[5:v]$N,$G[f];
 [a][b]xfade=transition=fade:duration=0.6:offset=3.02[x1];
 [x1][c]xfade=transition=fade:duration=0.6:offset=4.82[x2];
 [x2][d]xfade=transition=fade:duration=0.6:offset=7.72[x3];
 [x3][e]xfade=transition=fade:duration=0.6:offset=9.42[x4];
 [x4][f]xfade=transition=fade:duration=0.6:offset=13.32,fade=t=in:st=0:d=0.5,fade=t=out:st=16.52:d=0.5[v]" \
 -map "[v]" -an -c:v libx264 -preset veryfast -crf 25 -profile:v high -pix_fmt yuv420p -movflags +faststart ../hero/master.mp4
cd ../hero
cp master.mp4 hero.mp4
ffmpeg -v error -y -i master.mp4 -vf scale=960:540 -an -c:v libx264 -preset veryfast -crf 27 -pix_fmt yuv420p -movflags +faststart hero-mobile.mp4
ffmpeg -v error -y -i master.mp4 -an -c:v libvpx-vp9 -crf 38 -b:v 0 -deadline good -cpu-used 4 -row-mt 1 hero.webm
ffmpeg -v error -y -ss 1.8 -i master.mp4 -frames:v 1 -q:v 4 hero-poster.jpg
ls -la

# NOTE (31 Oct): public/video now holds a single uploaded clip (1103686, 1280x720),
# graded and looped with a 1s crossfade. The stock-clip build below is kept for reference.

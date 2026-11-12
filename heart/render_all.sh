#!/bin/bash
export LD_LIBRARY_PATH=/projects/sandbox/.tools/stublibs
cd /projects/sandbox/loova-promo/heart
/projects/sandbox/.tools/blender/blender -b work/scene.blend -P blender/render.py -- --range 0:239 --pct 75 --samples 20 --skip --out out/frames 2>&1 | grep --line-buffered -E "^FRAME|rror" >> out/render.log
echo DONE >> out/render.log

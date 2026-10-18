#!/usr/bin/env python3
"""Create two honest detail photos from the user-approved shared drain/cable photograph.
This only crops the original pixels; it does not redraw, replace or alter either part.
"""
from pathlib import Path
from PIL import Image
base=Path(__file__).resolve().parents[1]/'press42'/'photos'
source=base/'drain_valve_power_cable.webp'
assert source.is_file(), source
with Image.open(source) as im:
  photo=im.convert('RGB')
  w,h=photo.size
  assert w>=400 and h>=400, (w,h)
  crops={
    'drain_valve.webp':(int(w*.06),int(h*.36),int(w*.68),int(h*.81)),
    'power_cable.webp':(int(w*.65),int(h*.43),int(w*.995),int(h*.94))
  }
  for name,rect in crops.items():
    cropped=photo.crop(rect)
    cropped.save(base/name,'WEBP',quality=89,method=6)
    assert (base/name).stat().st_size>1000,name
    print('PREPARED',name,cropped.size,(base/name).stat().st_size)

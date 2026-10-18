import io,os,requests
from PIL import Image,ImageEnhance
url="https://media.canva.com/v2/image-resize/format:JPG/height:200/quality:75/uri:ifs%3A%2F%2FM%2F5fe803d7-c169-44cf-9333-9afa094b4290/watermark:F/width:161?csig=AAAAAAAAAAAAAAAAAAAAABAh3Ykm8OJYxDgPbnUBwspYu3IlYyZuYfxPnF8cps8L&exp=1792351962&osig=AAAAAAAAAAAAAAAAAAAAACI1ELIXPTmacxHj65obtqjr-iZXnjLYj4NA-UoEWYxP&signer=media-rpc&token=AAIAAU0AJDVmZTgwM2Q3LWMxNjktNDRjZi05MzMzLTlhZmEwOTRiNDI5MAAAAAABoVCAg5AuCDFpAIWCgNaPq7GhVevOEVkLh-W5alGTZdGMe1jwlQ&x-canva-quality=thumbnail"
attempts=[
 url.replace("height:200","height:1536").replace("width:161","width:1240").replace("x-canva-quality=thumbnail","x-canva-quality=full"),
 url.replace("height:200","height:1000").replace("width:161","width:807"),
 url
]
best=None
for index,u in enumerate(attempts):
 try:
  resp=requests.get(u,timeout=25);print("Candidate",index,resp.status_code,len(resp.content),resp.headers.get("content-type"))
  if not resp.ok:continue
  im=Image.open(io.BytesIO(resp.content)).convert("RGB")
  print("Image dimensions",im.size)
  if best is None or im.width*im.height>best.width*best.height:best=im
 except Exception as ex: print(str(ex)[:140])
if best is None: raise SystemExit("No approved Canva reference photograph available")
if best.width<600:
 best=best.resize((min(850,best.width*4),min(1000,best.height*4)),Image.Resampling.LANCZOS)
 dest="press42/photos/press42-overview-approved.webp"
else:
 best.thumbnail((1024,1400),Image.Resampling.LANCZOS)
 dest="press42/photos/press42-overview-approved.webp"
best.save(dest,"WEBP",quality=84,method=6)
print("Saved approved photo",best.size,os.stat(dest).st_size,dest)

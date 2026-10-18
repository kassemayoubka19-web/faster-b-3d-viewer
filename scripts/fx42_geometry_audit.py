#!/usr/bin/env python3
"""Read-only geometry coordinate audit of the installed FX42 optimized GLB.
Uses exactly the geometry shipped on GitHub Pages, without modifying GLB files.
"""
import gzip, json, pathlib, re, struct, math

root=pathlib.Path(__file__).resolve().parents[1]
p=root/"press42"
packed=(p/"press42-mobile-1.gzpart").read_bytes()+(p/"press42-mobile-2.gzpart").read_bytes()
raw=gzip.decompress(packed)
if raw[:4]!=b"glTF": raise ValueError("GLB magic mismatch")
json_len,typ=struct.unpack_from("<II",raw,12)
if typ!=0x4E4F534A: raise ValueError("GLB JSON chunk missing")
model=json.loads(raw[20:20+json_len])
out={"source":"press42-mobile-1.gzpart + press42-mobile-2.gzpart","modelLength":len(raw),"bounds":{}}
for node in model["nodes"]:
    if "mesh" not in node: continue
    mesh=model["meshes"][node["mesh"]]
    arrays=[]
    for prim in mesh["primitives"]:
        pos=model["accessors"][prim["attributes"]["POSITION"]]
        if not all(x in pos for x in ("min","max")):
            raise ValueError("Position bounds missing for "+str(mesh.get("name")))
        arrays.append((pos["min"],pos["max"]))
    low=[min(v[0][i] for v in arrays) for i in range(3)]
    high=[max(v[1][i] for v in arrays) for i in range(3)]
    name=node.get("name",mesh.get("name","unknown"))
    out["bounds"][name]={
      "min":[round(x,5) for x in low],
      "max":[round(x,5) for x in high],
      "center":[round((a+b)/2,5) for a,b in zip(low,high)],
      "extent":[round(b-a,5) for a,b in zip(low,high)]
    }
html=(p/"index.html").read_text(encoding="utf-8")
pattern=re.compile(r'id:"([^"]+)",name:"([^"]+)",tile:\d+,position:"([^"]+)",normal:"([^"]+)"')
out["existingMarkers"]=[]
for id,name,coords,norm in pattern.findall(html):
    xyz=[float(i[:-1]) for i in coords.split()]
    nearest=[]
    for node,b in out["bounds"].items():
        low,hi=b["min"],b["max"]
        dist=math.sqrt(sum((max(a-q,0,q-c))**2 for q,a,c in zip(xyz,low,hi)))
        nearest.append([round(dist,5),node])
    nearest.sort()
    out["existingMarkers"].append({"id":id,"position":xyz,"closestGroups":nearest[:4]})
out["groupCount"]=len(out["bounds"])
out["markerCount"]=len(out["existingMarkers"])
(p/"geometry-audit.json").write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"groups":out["groupCount"],"markers":out["markerCount"],"nearest":out["existingMarkers"]},ensure_ascii=False,indent=2))

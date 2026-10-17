#!/usr/bin/env python3
"""FASTER B press42 — geometry-preserving mobile GLB batching.
Uses the repository's two existing gzip parts as the only source of truth.
"""
import collections, copy, gzip, hashlib, json, pathlib, struct
import numpy as np

ROOT=pathlib.Path(__file__).resolve().parents[1]
P=ROOT/"press42"
compressed=(P/"press42-model-1.gzpart").read_bytes()+(P/"press42-model-2.gzpart").read_bytes()
original=gzip.decompress(compressed)
assert len(original)==57083244, "Unexpected original press size"
assert hashlib.sha256(original).hexdigest()=="e005b4ae94adfd961662a946882403ac5382933ea231f0af08398b0dba50e6a3", "Original GLB changed; STOP"
assert original[:4]==b"glTF"
jl,jt=struct.unpack_from("<II",original,12)
assert jt==0x4e4f534a
source=json.loads(original[20:20+jl])
bp=20+jl
bl,bt=struct.unpack_from("<II",original,bp)
assert bt==0x004e4942
data=memoryview(original)[bp+8:bp+8+bl]
assert not source.get("skins") and not source.get("animations")
assert all(not any(x in n for x in ("translation","rotation","scale","matrix","weights")) for n in source["nodes"])
assert all("sparse" not in a for a in source["accessors"])
COMPONENT={5123:np.uint16,5125:np.uint32,5126:np.float32}
SHAPE={"SCALAR":1,"VEC2":2,"VEC3":3,"VEC4":4}
def read_accessor(index):
 a=source["accessors"][index];v=source["bufferViews"][a["bufferView"]]
 dt=COMPONENT[a["componentType"]];n=SHAPE[a["type"]];w=np.dtype(dt).itemsize
 offset=v.get("byteOffset",0)+a.get("byteOffset",0)
 stride=v.get("byteStride",n*w)
 return np.ascontiguousarray(np.ndarray((a["count"],n),dtype=dt,buffer=data,offset=offset,strides=(stride,w)))
grouped=collections.defaultdict(list)
for node in source["nodes"]:
 if "mesh" not in node: continue
 semantic=node.get("extras",{}).get("semantic_part","OTHER")
 for p in source["meshes"][node["mesh"]]["primitives"]:
  key=(semantic,p.get("material"),tuple(sorted(p["attributes"])),p.get("mode",4))
  grouped[key].append(p)
binary=bytearray();views=[];accessors=[]
def align4():
 binary.extend(b"\x00"*((-len(binary))%4))
def add_bytes(b):
 align4();start=len(binary);binary.extend(b)
 views.append({"buffer":0,"byteOffset":start,"byteLength":len(b)})
 return len(views)-1
def add_accessor(x,ct,kind,target=None,bounds=False):
 a={"bufferView":add_bytes(np.ascontiguousarray(x).tobytes()),"componentType":ct,"count":len(x),"type":kind}
 if target is not None:views[a["bufferView"]]["target"]=target
 if bounds:
  a["min"]=[float(q) for q in x.min(axis=0)]
  a["max"]=[float(q) for q in x.max(axis=0)]
 accessors.append(a)
 return len(accessors)-1
meshes=[];nodes=[]
for semantic in sorted({k[0] for k in grouped}):
 output=[]
 items=sorted(((k,v) for k,v in grouped.items() if k[0]==semantic),
             key=lambda kv:(kv[0][3],kv[0][1] if kv[0][1] is not None else -1,kv[0][2]))
 for (part,material,attrs,mode),prims in items:
  columns={k:[] for k in attrs};idx=[];offset=0
  for p in prims:
   arrays={k:read_accessor(p["attributes"][k]) for k in attrs}
   count=len(arrays["POSITION"])
   assert all(len(a)==count for a in arrays.values())
   for k in attrs:columns[k].append(arrays[k])
   if "indices" in p:ind=read_accessor(p["indices"]).reshape(-1).astype(np.uint32)
   else:ind=np.arange(count,dtype=np.uint32)
   idx.append(ind+offset);offset+=count
  attributes={}
  for k in attrs:
   x=np.concatenate(columns[k])
   assert x.dtype==np.float32
   attributes[k]=add_accessor(x,5126,"VEC"+str(x.shape[1]),34962,k=="POSITION")
  indices=np.concatenate(idx)
  if offset<=65535: indices=indices.astype(np.uint16);ct=5123
  else:ct=5125
  prim={"attributes":attributes,"indices":add_accessor(indices.reshape(-1,1),ct,"SCALAR",34963),"mode":mode}
  if material is not None:prim["material"]=material
  output.append(prim)
 meshes.append({"name":semantic,"primitives":output})
 nodes.append({"name":semantic,"mesh":len(meshes)-1,"extras":{"semantic_part":semantic}})
images=copy.deepcopy(source.get("images",[]))
for image in images:
 if "bufferView" in image:
  v=source["bufferViews"][image["bufferView"]]
  image["bufferView"]=add_bytes(data[v.get("byteOffset",0):v.get("byteOffset",0)+v["byteLength"]].tobytes())
result={"asset":copy.deepcopy(source["asset"]),"scene":0,
 "scenes":[{"name":"Scene","nodes":list(range(len(nodes)))}],
 "nodes":nodes,"meshes":meshes,"accessors":accessors,"bufferViews":views,
 "buffers":[{"byteLength":0}],"images":images,
 "materials":copy.deepcopy(source.get("materials",[])),
 "textures":copy.deepcopy(source.get("textures",[])),
 "samplers":copy.deepcopy(source.get("samplers",[]))}
for field in ("extensionsUsed","extensionsRequired"):
 if field in source:result[field]=copy.deepcopy(source[field])
align4();result["buffers"][0]["byteLength"]=len(binary)
jb=json.dumps(result,ensure_ascii=False,separators=(",",":")).encode()
jb+=b" "*((-len(jb))%4)
final=b"glTF"+struct.pack("<II",2,28+len(jb)+len(binary))+struct.pack("<II",len(jb),0x4e4f534a)+jb+struct.pack("<II",len(binary),0x004e4942)+bytes(binary)
origtri=sum(source["accessors"][p["indices"]]["count"]//3 for m in source["meshes"] for p in m["primitives"] if p.get("mode",4)==4 and "indices" in p)
newtri=sum(accessors[p["indices"]]["count"]//3 for m in meshes for p in m["primitives"] if p["mode"]==4)
origv=sum(source["accessors"][p["attributes"]["POSITION"]]["count"] for m in source["meshes"] for p in m["primitives"])
newv=sum(accessors[p["attributes"]["POSITION"]]["count"] for m in meshes for p in m["primitives"])
assert (newtri,newv)==(origtri,origv)
assert len(images)==len(source.get("images",[]))
gzipdata=gzip.compress(final,compresslevel=6,mtime=0)
split=(len(gzipdata)+1)//2
for num,part in enumerate((gzipdata[:split],gzipdata[split:]),1):
 (P/("press42-mobile-"+str(num)+".gzpart")).write_bytes(part)
metadata={"original_sha256":hashlib.sha256(original).hexdigest(),"optimized_sha256":hashlib.sha256(final).hexdigest(),
 "optimized_glb_bytes":len(final),"gzip_bytes":len(gzipdata),
 "original_primitives":sum(len(m["primitives"]) for m in source["meshes"]),
 "optimized_primitives":sum(len(m["primitives"]) for m in meshes),
 "original_vertices":origv,"optimized_vertices":newv,
 "original_triangles":origtri,"optimized_triangles":newtri,
 "semantic_groups":len(nodes),"original_materials":len(source["materials"]),
 "optimized_materials":len(result["materials"]),"original_images":len(source["images"]),
 "optimized_images":len(images),"split_sizes":[split,len(gzipdata)-split]}
(P/"mobile_build_status.json").write_text(json.dumps(metadata,indent=2)+"\n")
print(json.dumps(metadata,ensure_ascii=False,indent=2))

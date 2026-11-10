"""Compare 8-bit RGB/RGBA browser PNGs without additional dependencies."""
from pathlib import Path
import json, struct, sys, zlib

def read(path):
    data=Path(path).read_bytes(); pos=8; packed=b''
    while pos < len(data):
        size=struct.unpack('>I',data[pos:pos+4])[0]; kind=data[pos+4:pos+8]; chunk=data[pos+8:pos+8+size];pos+=size+12
        if kind==b'IHDR': w,h,depth,color,*_=struct.unpack('>IIBBBBB',chunk)
        if kind==b'IDAT': packed+=chunk
    if depth!=8 or color not in (2,6): raise ValueError('Only 8-bit RGB/RGBA PNGs supported')
    n=3 if color==2 else 4; raw=zlib.decompress(packed); prev=bytearray(w*n); rows=[]; pos=0
    for _ in range(h):
        mode=raw[pos];row=bytearray(raw[pos+1:pos+1+w*n]);pos+=1+w*n
        for i in range(len(row)):
            a=row[i-n] if i>=n else 0;b=prev[i];c=prev[i-n] if i>=n else 0
            if mode==1:predict=a
            elif mode==2:predict=b
            elif mode==3:predict=(a+b)//2
            elif mode==4:
                p=a+b-c;dist=[abs(p-a),abs(p-b),abs(p-c)];predict=[a,b,c][dist.index(min(dist))]
            elif mode==0:predict=0
            else:raise ValueError('Unsupported PNG filter')
            row[i]=(row[i]+predict)%256
        rows.append([tuple(row[i:i+3]) for i in range(0,len(row),n)]);prev=row
    return w,h,rows

a=read(sys.argv[1]);b=read(sys.argv[2])
if a[:2]!=b[:2]:out={'before':a[:2],'after':b[:2],'sameSize':False}
else:
    changed=sum(x!=y for ra,rb in zip(a[2],b[2]) for x,y in zip(ra,rb));out={'width':a[0],'height':a[1],'changedPixels':changed,'percent':round(100*changed/(a[0]*a[1]),4)}
print(json.dumps(out))

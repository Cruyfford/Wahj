from PIL import Image, ImageDraw, ImageFilter
import math
S=2048
img=Image.new('RGB',(S,S))
px=img.load()
# diagonal violet -> pink -> orange gradient
c1=(110,70,255);c2=(255,62,140);c3=(255,150,60)
for y in range(S):
    for x in range(0,S):
        t=(x*0.55+y*0.45)/S
        if t<0.55: k=t/0.55;c=tuple(int(c1[i]+(c2[i]-c1[i])*k) for i in range(3))
        else: k=(t-0.55)/0.45;c=tuple(int(c2[i]+(c3[i]-c2[i])*k) for i in range(3))
        px[x,y]=c
# soft glow
glow=Image.new('L',(S,S),0);gd=ImageDraw.Draw(glow);gd.ellipse((S*.18,S*.12,S*.82,S*.76),fill=120);glow=glow.filter(ImageFilter.GaussianBlur(220))
img=Image.composite(Image.new('RGB',(S,S),(255,255,255)),img,glow.point(lambda v:int(v*0.35)))
d=ImageDraw.Draw(img)
cx,cy=S/2,S/2
w=int(S*0.055)
d.ellipse((cx-S*0.085,cy-S*0.085,cx+S*0.085,cy+S*0.085),fill='white')
for r,a in ((S*0.2,52),(S*0.33,50)):
    for side in (0,180):
        d.arc((cx-r,cy-r,cx+r,cy+r),start=side-a,end=side+a,fill='white',width=w)
# round arc caps
for r,a in ((S*0.2,52),(S*0.33,50)):
    for side in (0,180):
        for ang in (side-a,side+a):
            rr=r-w/2; x=cx+rr*math.cos(math.radians(ang)); y=cy+rr*math.sin(math.radians(ang))
            d.ellipse((x-w/2,y-w/2,x+w/2,y+w/2),fill='white')
img=img.resize((1024,1024),Image.LANCZOS)
img.save('ios/WahjLive/Assets.xcassets/AppIcon.appiconset/icon.png')
for n,s in (('mdpi',48),('hdpi',72),('xhdpi',96),('xxhdpi',144),('xxxhdpi',192)):
    import os; os.makedirs(f'android/app/src/main/res/mipmap-{n}',exist_ok=True)
    im=img.resize((s,s),Image.LANCZOS); im.save(f'android/app/src/main/res/mipmap-{n}/ic_launcher.png')
    m=Image.new('L',(s,s),0);ImageDraw.Draw(m).ellipse((0,0,s-1,s-1),fill=255)
    r=Image.new('RGBA',(s,s));r.paste(im,(0,0),m);r.save(f'android/app/src/main/res/mipmap-{n}/ic_launcher_round.png')
img.resize((512,512)).save('art/icon512.png')

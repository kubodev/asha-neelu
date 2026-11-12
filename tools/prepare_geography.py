"""Rebuild the baseline from manually traced coordinates in the supplied overheads.

Run from Sociathon using Python with Pillow and NumPy installed.
"""
from PIL import Image,ImageDraw,ImageFilter,ImageFont
from pathlib import Path
import json, numpy as np, math
ROOT=Path(__file__).resolve().parents[1]
# Fixed source slots keep registration stable as new references are added.
TIMES={1:'7.49.13',12:'9.53.31',15:'9.55.38'}
FILES={i:next((ROOT.parent/'img').glob(f'Screenshot 2026-11-12 at {stamp}*PM.png')) for i,stamp in TIMES.items()}
DIST=ROOT/'dist'
S=2
def source(i):
    return Image.open(FILES[i]).convert('RGB')
def aligned(i,native_width,s,offset):
    im=source(i)
    step=.76*im.width/(native_width*s*S)
    ax=(310-offset[0])*im.width/(native_width*s)
    az=(75-offset[1])*im.width/(native_width*s)
    return im.transform((1000*S,763*S),Image.Transform.AFFINE,(step,0,ax,0,step,az),Image.Resampling.BICUBIC)
base=aligned(15,1300,1,(0,0))
def mosaic(i,reference_width,scale,offset,polygon):
    im=aligned(i,reference_width,scale,offset)
    mask=Image.new('L',base.size)
    ImageDraw.Draw(mask).polygon([((x*scale+offset[0]-310)*S/.76,(z*scale+offset[1]-75)*S/.76) for x,z in polygon],fill=255)
    base.paste(im,mask=mask.filter(ImageFilter.GaussianBlur(1.1)))
mosaic(12,1300,.609,(403,140),[(60,48),(1298,48),(1298,630),(1250,630),(1250,682),(119,682),(119,625),(60,625)])
mosaic(1,893,.555,(629,184),[(0,0),(547,0),(547,85),(892,85),(892,849),(0,849)])
base.save(DIST/'assets/satellite.jpg',quality=89)
def tracing_view():
    im=base.resize((1000,763)); d=ImageDraw.Draw(im,'RGBA')
    for x in range(0,1000,50):
        d.line((x,0,x,763),fill=(255,255,255,55))
        for z in range(0,763,100):d.text((x+1,z+1),str(x),fill='white',stroke_width=1,stroke_fill='#222')
    for z in range(0,763,50):
        d.line((0,z,1000,z),fill=(255,255,255,70))
        for x in [2,352,702]:d.text((x,z+17),str(z),fill='#ffee44',stroke_width=1,stroke_fill='#222')
    im.save('/tmp/atlasgrid.jpg',quality=95)
# Digitisation coordinates were read in a 1200px-wide view of the registered mosaic.
features=[]
def pairs(s):
    return [list(map(float,p.split(','))) for p in s.split()]
def coord(p):
    return [round(p[0]/1.2-500,2),round(p[1]/1.2-381.5,2)]
refs='Overhead references 02, 13 and 16'
def add(kind,name,points,**properties):
    prefix={'water':'W','road':'R','building':'B','tree':'T','land':'P','landmark':'L'}[kind]
    index=1+sum(f['kind']==kind for f in features)
    f=dict(id=f'{prefix}-{index:03}',name=name,kind=kind,points=[coord(p) for p in pairs(points)],source=refs,confidence='Visually inferred')
    f.update(properties);features.append(f);return f
boundary_px=pairs('457,129 495,138 511,139 578,165 661,199 728,216 776,234 840,258 881,262 942,289 977,302 1006,325 929,416 897,456 856,520 820,601 810,649 642,597 520,557 447,521 416,427 390,401 366,311')
boundary=[[(p[0]-690)/.76,(p[1]-365)/.76] for p in boundary_px]
area=abs(sum(a[0]*b[1]-a[1]*b[0] for a,b in zip(boundary,boundary[1:]+boundary[:1])))/2
mpu=round(math.sqrt(35317.76/area),6)
def road(name,points,width,surface):
    add('road',name,points,width=width,color={'Paved':'#66645f','Unconfirmed':'#a6947d','Earth shoulder':'#9a866c'}[surface],surface=surface)
road('Vijayawada–Amaravathi Road','9,0 84,23 220,69 342,109 481,157 612,201 774,256 901,299 1023,340 1072,363 1115,391 1154,425 1200,458',26,'Paved')
road('D Road · east carriageway','353,0 316,80 286,145 241,242 198,331 165,415 109,539 61,641 0,768',15,'Paved')
road('D Road · west carriageway','314,0 289,58 263,123 211,224 174,318 136,408 85,527 42,622 0,701',15,'Paved')
road('Reservoir bank road','1090,375 1064,414 1034,462 1001,522 963,573 937,607 917,649 891,712 864,778 837,849 807,916',16,'Unconfirmed')
road('Southern residential street','592,598 629,610 687,629 743,648 799,668 847,683 897,701 964,723 1021,742 1112,771 1200,801',10,'Unconfirmed')
road('Residential lane','651,617 635,671 618,732 594,810 563,916',9,'Unconfirmed')
road('Southern cross lane','465,778 519,795 594,817 652,837 730,864 812,890 875,915',7,'Unconfirmed')
road('Pillar access lane','584,193 568,243 556,291 548,335 542,379 538,399',6,'Unconfirmed')
road('Northern lane','465,0 446,60 416,139',6,'Unconfirmed')
road('Commercial access road','736,0 710,73 677,172 674,220',8,'Unconfirmed')
road('Opposite-bank access','1007,0 975,93 948,171 922,246 902,300',8,'Unconfirmed')
add('water','Village reservoir','688,276 711,281 736,288 758,299 785,306 812,312 839,323 864,332 884,338 911,345 932,356 958,368 980,373 999,382 1013,392 1017,406 1012,424 1002,443 989,469 979,493 965,513 949,531 928,546 902,556 881,558 855,550 832,545 813,534 802,520 789,515 777,502 767,485 763,468 759,454 747,439 747,425 732,416 721,407 717,391 710,376 711,356 703,341 704,321 700,307',color='#374d4d',confidence='Confirmed',notes='Dark slate water with an olive-green patch along the northwest margin. Shoreline and bank elevations are approximate.')
def land(name,poly,color):
    add('land',name,poly,color=color)
land('Northwest open plot','0,31 92,61 182,87 163,111 100,152 55,198 0,184','#998571')
land('Open ground west of the pillar','343,146 418,165 421,223 397,285 361,349 308,332 296,266','#a39073')
land('Western tree belt','275,320 324,354 388,355 451,403 439,472 379,491 345,561 275,562 207,517 208,427','#647052')
land('Western open land','210,549 286,565 342,583 370,653 328,733 216,704 180,666','#79805b')
land('Cultivated plot','424,539 489,563 455,674 419,751 371,737 391,644','#978b64')
land('Field margin','493,553 560,579 515,740 469,727 487,663','#5d7150')
land('Open plot south of reservoir','838,585 898,605 879,688 811,665','#566d53')
land('Western plots','174,715 243,737 310,767 282,865 247,916 100,916 130,822','#687554')
land('Northern open plot','1005,0 1136,0 1090,151 1022,138 985,126','#958775')
land('Reservoir bank','1016,393 1061,406 1028,462 995,517 951,573 920,604 890,595 912,566 949,545 970,517 989,471','#ab977d')
# Every polygon follows the visible outer edge of a distinguishable roof or joined roof volume.
roofs="""
106,65 175,83 161,137 93,117
83,116 162,141 144,197 69,177
451,0 476,0 462,34 438,28
491,30 532,42 522,86 479,72
539,0 581,0 570,28 529,21
517,114 560,124 551,161 510,152
654,65 702,76 687,123 645,112
657,125 680,131 674,169 648,159
850,57 890,67 869,146 836,138
900,100 958,115 935,205 879,186
938,260 966,165 1078,193 1046,307
761,149 797,158 778,217 745,207
884,198 914,206 907,235 876,228
1143,287 1198,300 1191,368 1124,346
540,213 578,224 571,248 533,238
535,240 569,249 562,270 527,260
527,262 563,272 555,296 519,286
520,292 557,302 550,325 513,317
432,232 461,237 458,256 429,252
474,339 503,345 497,367 469,361
504,350 545,360 539,388 497,379
620,260 657,271 651,308 615,297
570,344 597,353 587,390 562,383
599,351 630,358 626,375 596,371
580,392 601,396 596,420 575,415
608,379 628,383 620,421 602,416
637,389 678,401 673,418 633,407
647,367 678,372 676,387 644,381
662,351 691,355 690,369 659,366
673,432 703,440 693,470 664,462
552,481 576,488 571,510 549,505
614,478 695,503 676,563 595,541
605,543 664,563 652,602 591,584
698,534 733,545 724,578 691,568
669,580 710,592 702,628 661,613
724,605 738,608 734,633 719,630
568,609 644,633 630,676 554,653
562,658 592,665 581,705 550,696
594,668 626,680 616,715 586,706
658,650 695,659 685,690 649,678
694,666 719,675 713,701 685,694
641,704 684,716 680,740 633,727
687,699 716,710 706,742 680,736
698,720 752,735 743,767 688,752
776,691 856,716 839,763 765,742
777,747 836,766 826,804 765,784
681,754 752,775 741,816 670,797
747,793 823,816 812,845 738,824
522,748 596,771 584,811 509,788
611,793 645,804 637,828 602,817
688,820 736,835 727,871 679,854
741,852 762,859 756,877 735,871
827,854 887,873 878,907 819,891
853,778 917,799 906,833 843,811
913,801 999,825 978,888 892,860
905,871 976,892 969,916 892,904
904,669 978,695 969,721 898,698
935,626 966,638 958,667 926,657
979,632 1009,646 999,673 970,662
1049,461 1091,477 1080,507 1041,490
1090,470 1147,487 1135,526 1081,511
1099,445 1126,454 1120,470 1093,460
1060,435 1098,448 1091,470 1052,455
1118,523 1167,539 1156,565 1108,550
1040,515 1079,528 1071,552 1032,539
1102,644 1169,660 1162,686 1095,669
1181,634 1199,640 1199,677 1174,669
1147,687 1199,704 1199,744 1134,726
1066,699 1119,715 1111,739 1058,721
982,727 1029,740 1019,772 974,758
1028,740 1086,757 1079,777 1021,760
1016,762 1098,786 1088,817 1006,792
956,768 1015,787 1003,818 945,797
1144,749 1188,761 1176,800 1132,785
"""
palette=['#bcb4a6','#bda993','#a29c93','#d3ccbd','#afa18e','#bfb9ad','#c9c0ad']
for i,row in enumerate(roofs.strip().splitlines()):
    roof=add('building',f'Building {i+1:03}',row,color=palette[i%7],height=[12,12,14,13,12,13,12,18,14][i%9],notes='Roof outline traced from supplied imagery. Height and unseen façades are approximate.')
# Approximate canopy centres and diameters traced from visible crowns and canopy groups.
crowns="""
369,66,22 386,110,28 421,98,29 463,110,25 450,87,20 396,33,28 443,15,21
591,36,24 629,58,19 618,120,20 768,93,49 787,124,28 822,80,22 1154,151,43 1125,177,47 1100,219,29
316,210,29 341,180,30 359,165,28 396,183,25 437,188,35 470,204,29 500,221,24
376,242,29 386,292,26 455,281,25 466,307,29 396,315,26
578,272,26 602,291,33 595,312,35 614,320,26 646,319,24 680,320,27
310,354,30 334,375,44 364,394,46 389,397,33 411,383,31 303,407,40 332,421,41 366,442,37 296,448,37 273,428,28 278,388,29 384,457,24
253,436,24 239,480,28 258,498,35 226,532,30 269,526,24 291,549,31 369,511,26 391,520,24 436,491,33 461,471,28 450,507,28 478,509,29 489,539,26 441,559,26
542,444,22 539,462,25 568,445,20 536,501,22 727,468,21 758,495,27 779,513,37 750,531,32 787,544,27 807,551,20 845,576,18 925,572,16
248,584,30 262,610,35 299,618,40 330,638,33 339,669,25 373,614,27 397,567,31
503,596,24 519,627,37 492,651,27 478,700,35 457,722,26 217,691,30 260,683,28 277,741,35 311,763,32 191,777,42 171,810,29 148,847,38 186,862,42 241,875,36 272,899,37
642,768,26 666,761,22 730,698,20 774,690,22 823,799,16 851,746,15 1043,583,40 1071,602,34 1100,580,22 1108,615,30 1151,595,33 1181,619,31
1061,349,29 1112,363,45 1131,391,26 1052,319,22 688,334,18 730,423,18 722,394,15 746,451,13
"""
for i,s in enumerate(crowns.split()):
    x,z,w=map(int,s.split(','))
    add('tree','Tree canopy',f'{x},{z}',width=round(w/1.2,2),height=round(w/1.2*.82,2),color=['#737d53','#6c7952','#7d865f','#637450','#859063'][i%5],notes='Approximate canopy envelope. Individual trunks are unresolved.')
for name,pt in [('Malkapuram pillar (Shaiva matha)','494,291'),('Jai Surya Hostel','638,541'),('Emmanuel Church','885,681')]:
    add('landmark',name,pt,confidence='Confirmed',source='Supplied labelled satellite map, reference 13',notes='Map label position is approximate. Specific entrance and building identity are unverified.')
# Keep exposed-soil texture, field rows and canopy variation in their original locations.
# The working texture omits the mapped roof images and source interface graphics.
texture=base.resize((1600,1221),Image.Resampling.LANCZOS)
pixels=np.asarray(texture,dtype=float)
scale=texture.width/1200
def frame_points(points):
    return [((x+500)*1.2*scale,(z+381.5)*1.2*scale) for x,z in points]
mask=Image.new('L',texture.size)
pen=ImageDraw.Draw(mask)
for feature in features:
    if feature['kind']=='building':
        poly=frame_points(feature['points'])
        pen.polygon(poly,fill=255)
        pen.line(poly+poly[:1],fill=255,width=6,joint='curve')
# Baked labels and the measurement line are bright neutral graphics on dark imagery.
labelled=Image.new('L',texture.size)
lp=ImageDraw.Draw(labelled)
for box in [(0,0,440,160),(0,125,303,916),(165,686,511,830),(405,253,511,335)]:
    lp.rectangle([round(v*scale) for v in box],fill=255)
brights=(pixels.min(axis=2)>147)&(np.asarray(labelled)>0)
ui=Image.fromarray(brights.astype('uint8')*255).filter(ImageFilter.MaxFilter(15))
mask=Image.fromarray(np.maximum(np.asarray(mask),np.asarray(ui)))
pen=ImageDraw.Draw(mask)
pen.rectangle([round(v*scale) for v in (256,720,287,762)],fill=255)
# The lower-left corner of the source map inset and two residual tile seams.
for line in [[(503,172),(503,400)],[(503,172),(953,172)]]:
    pen.line([(round(x*scale),round(y*scale)) for x,y in line],fill=255,width=5)

def reconstruct_masked(channel,unknown):
    """Pyramid interpolation using only nearby valid texels as image evidence."""
    valid=np.float32(1-unknown/255)
    weighted=np.float32(channel)*valid
    layers=[]
    while valid.shape[0]>2:
        layers.append((weighted,valid))
        h,w=valid.shape
        wh=(max(1,w//2),max(1,h//2))
        weighted=np.asarray(Image.fromarray(weighted).resize(wh,Image.Resampling.BOX))
        valid=np.asarray(Image.fromarray(valid).resize(wh,Image.Resampling.BOX))
    fill=weighted/(valid+1e-8)
    for weighted,valid in reversed(layers):
        h,w=valid.shape
        up=np.asarray(Image.fromarray(fill.astype('float32')).resize((w,h),Image.Resampling.BILINEAR))
        fill=weighted+up*(1-valid)
    return fill
unknown=np.asarray(mask,dtype=float)
clean=np.stack([reconstruct_masked(pixels[:,:,i],unknown) for i in range(3)],axis=2)
# Local contrast restores the subdued detail of the supplied satellite screenshot.
smooth=np.asarray(Image.fromarray(clean.clip(0,255).astype('uint8')).filter(ImageFilter.GaussianBlur(2.2)),float)
detail=clean.mean(2)-smooth.mean(2)
luma=clean@np.array([.34,.5,.16])
greenness=np.clip((clean[:,:,1]-clean[:,:,0]+1.8)/23,0,1)
mix=greenness[:,:,None]
warm=np.array([162,145,122]);leaf=np.array([115,128,90])
rgb=warm*(1-mix)+leaf*mix+(luma[:,:,None]-95)*.93+detail[:,:,None]*.65
# Retain slight texture in reconstructed patches; building models cover most of them.
rng=np.random.default_rng(42)
rgb+=rng.normal(0,1.6,(*unknown.shape,1))*(.15+.85*unknown[:,:,None]/255)
ground=Image.fromarray(rgb.clip(0,255).astype('uint8'))
ground.save(DIST/'assets/ground.jpg',quality=91)
data=DIST/'geography.js'
with data.open('w') as f:
    f.write('// Generated from the supplied references by tools/prepare_geography.py.\n')
    f.write('export const extent = {width:1000,depth:763};\n')
    f.write('export const metersPerUnit = '+str(mpu)+';\n')
    f.write('export const boundary = '+json.dumps([[round(x,2),round(z,2)] for x,z in boundary])+';\n')
    f.write('export const features = [\n')
    for item in features:f.write('  '+json.dumps(item,ensure_ascii=False)+',\n')
    f.write('];\n')
print('Approximate metres per local unit:',mpu)
print('Counts:',{kind:sum(v['kind']==kind for v in features) for kind in sorted({v['kind'] for v in features})})

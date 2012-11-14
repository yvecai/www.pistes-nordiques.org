#!/usr/bin/python

import psycopg2
import pdb
import time
import re
import colorlist

def colorHex(code):
    code=code.lower().replace(' ','')

    if re.match('#[0-9a-f]{6}',code):
        return code
    elif re.match('[0-9a-f]{6}',code):
        return '#'+code
    elif re.match('#[0-9a-f]{3}',code):
        return '#'+code[1]+code[1]+code[2]+code[2]+code[3]+code[3]
    elif re.match('[0-9a-f]{3}',code):
        return '#'+code[0]+code[0]+code[1]+code[1]+code[2]+code[2]
    elif code in colorlist.colordict.keys():
        return colorlist.colordict[code]
    else: return '#000000'
#
def text2rgb(text):
    rh=text[1:3]
    gh=text[3:5]
    bh=text[5:7]
    r=int(rh,16)
    g=int(gh,16)
    b=int(bh,16)
    return (r,g,b)
#
def rgb2text(r,g,b):
    rh=str(hex(r)).replace('0x','')
    if len(rh)==1: rh='0'+rh
    gh=str(hex(g)).replace('0x','')
    if len(gh)==1: gh='0'+gh
    bh=str(hex(b)).replace('0x','')
    if len(bh)==1: bh='0'+bh
    return '#'+rh+gh+bh
#
def text2luma(text):
    r,g,b=text2rgb(text)
    luma=0.3*r/256+0.59*g/256+0.11*b/256
    return luma
#
def deluma(text,factor):
    # reduce color lumaby a given factor. color='#aa00ff'
    r,g,b=text2rgb(text)
    r=int(r*(1-0.3*factor))
    g=int(g*(1-0.59*factor))
    b=int(b*(1-0.11*factor))
    return rgb2text(r,g,b)
#
conn = psycopg2.connect("dbname=pistes-mapnik user=mapnik")
cur = conn.cursor()
    
cur.execute("select color from planet_osm_line where color is not null;")
colors=cur.fetchall()
cur.execute("select colour from planet_osm_line where colour is not null;")
colors.extend(cur.fetchall())


for i in range(len(colors)):
    colors[i]=colors[i][0]
colors=list(set(colors))


rules={}
for i in range(len(colors)):
    # ensure that the luma is not too high, ie piste have agood visibility
    colorcode=deluma(colorHex(colors[i]),0.25)
    if text2luma(colorcode) > 0.8: colorcode=deluma(colorcode,0.25)
    rules[colors[i]]=colorcode
print rules,len(rules)

f=open('styles/routes-color.xml','w')
f.write("""\

""")


f.write("""\
<Style name="marks">
""")
for rule in rules:
    f.write("""\
        <Rule>
            &maxscale_zoom9;
            &minscale_zoom11;
            <Filter>[color]='"""+rule+"""' or [colour]='"""+rule+"""'</Filter>
            <MarkersSymbolizer 
            file="tic-tac.svg"
            fill='"""+rules[rule]+"""' opacity="1" 
            stroke='"""+rules[rule]+"""' stroke-width="1" stroke-opacity="1"
            placement="point"
            allow-overlap="true"
            width="4" height="3"/>
        </Rule>
        <Rule>
            &maxscale_zoom12;
            &minscale_zoom12;
            <Filter>[color]='"""+rule+"""' or [colour]='"""+rule+"""'</Filter>
            <MarkersSymbolizer 
            file="tic-tac.svg"
            fill='"""+rules[rule]+"""' opacity="1" 
            stroke='"""+rules[rule]+"""' stroke-width="1" stroke-opacity="1"
            placement="point"
            spacing="50" max-error="1"
            width="7" height="5"/>
        </Rule>
        <Rule>
            &maxscale_zoom13;
            &minscale_zoom14;
            <Filter>[color]='"""+rule+"""' or [colour]='"""+rule+"""'</Filter>
            <MarkersSymbolizer 
            file="tic-tac.svg"
            fill='"""+rules[rule]+"""' opacity="1" 
            stroke='"""+rules[rule]+"""' stroke-width="1" stroke-opacity="1"
            placement="line"
            spacing="150" max-error="0.6"
            transform="translate(0 6)"
            width="7" height="5"/>
        </Rule> 
        <Rule>
            &maxscale_zoom15;
            &minscale_zoom18;
            <Filter>[color]='"""+rule+"""' or [colour]='"""+rule+"""'</Filter>
            <MarkersSymbolizer 
            file="tic-tac.svg"
            fill='"""+rules[rule]+"""' opacity="1" 
            stroke='"""+rules[rule]+"""' stroke-width="1" stroke-opacity="1"
            placement="line"
            spacing="300" max-error="0.6"
            transform="translate(0 8)"
            width="10" height="6"/>
        </Rule>
       <Rule>
            &maxscale_zoom15;
            &minscale_zoom18;
            <Filter>[color]='"""+rule+"""' or [colour]='"""+rule+"""'</Filter>
            <TextSymbolizer face-name="DejaVu Sans Book" 
            size="10" fill='"""+rules[rule]+"""' halo-fill= "white" halo-radius="1" 
            placement="line" allow-overlap="false" spacing="400" 
            avoid-edges="true"
            wrap-width="10" dy="10">[route_name]</TextSymbolizer>
        </Rule>
        """)
f.write("""
</Style>
""")
f.close()


#pdb.set_trace()

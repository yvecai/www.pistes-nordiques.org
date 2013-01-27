#!/usr/bin/python

import math
import urllib2
import ImageFile
import Image
import numpy
import StringIO
import random
import os
from cgi import parse_qs, escape

#
def deg2num(lat_deg, lon_deg, zoom):
    lat_rad = math.radians(lat_deg)
    n = 2.0 ** zoom
    xtile = int((lon_deg + 180.0) / 360.0 * n)
    ytile = int((1.0 - math.log(math.tan(lat_rad) + (1 / math.cos(lat_rad))) / math.pi) / 2.0 * n)
    #url = 'http://c.tile.openstreetmap.org/'+str(zoom)+'/'+str(xtile)+'/'+str(ytile)+'.png'
    return xtile, ytile
# 
def num2deg(xtile, ytile, zoom):
    n = 2.0 ** zoom
    lon_deg = xtile / n * 360.0 - 180.0
    lat_rad = math.atan(math.sinh(math.pi * (1 - 2 * ytile / n)))
    lat_deg = math.degrees(lat_rad)
    return(lat_deg, lon_deg)
#
def clamp(value, minvalue, maxvalue):
    return max(minvalue, min(value, maxvalue))
def getImage(base_url, left, right, top, bottom, zoom, numbering):
	centerlon = (right+left)/2
	centerlat = (top+bottom)/2
	# coord. off center tile:
	X, Y = deg2num(centerlat, centerlon, zoom)
	lat1, lon1=num2deg(X, Y, zoom)
	lat2, lon2=num2deg(X+1, Y+1, zoom) 
	tileDLat = lat1-lat2
	tileDLon = lon2-lon1


	# = 4,773 m/px
	# = 4.773*0.009/1000 deg/px
	minX, minY = deg2num(top, left, zoom)
	maxX, maxY = deg2num(bottom, right, zoom)
	sizeX= maxX-minX
	sizeY= maxY-minY

	ix= 0
	iy= 0
	canvasX = sizeX*256 + 256
	canvasY = sizeY*256 + 256
	print canvasX, canvasY
	stitch = Image.new('RGBA', (canvasX, canvasY))


	for x in range(minX, maxX+1):
		for y in range(minY, maxY +1):
			if numbering == 'osm': y=y
			if numbering == 'tms': y=2**zoom-y-1
			url = base_url+str(zoom)+'/'+str(x)+'/'+str(y)+'.png'
			user_agent = 'yvecai@gmail.com'
			headers = { 'User-Agent' : user_agent }
			req = urllib2.Request(url,'', headers)
			response = urllib2.urlopen(req)
			tile = response.read()
			
			imgParser=ImageFile.Parser()
			imgParser.feed(tile)
			img = imgParser.close()
			box= (ix*256, iy*256)
			stitch.paste(img,box)
			iy +=1
		iy = 0
		ix +=1


	widthPx = int((right-left)/(tileDLon/256))
	heightPx = int((top - bottom)/(tileDLat/256))

	box=((canvasX-widthPx)/2,(canvasY-heightPx)/2,\
		canvasX-(canvasX-widthPx)/2, canvasY-(canvasY-heightPx)/2)
	stitch=stitch.crop(box)
	dpi=int(heightPx/(210/25.4))
	stitch.info['ppi']=(dpi,dpi)
	
	return stitch
	
#~ left = 6.035988965051421
#~ right = 6.09887103494854
#~ top = 46.425069345975224
#~ bottom = 46.3631130695066
#~ ?6.035988965051421;6.09887103494854;46.425069345975224;46.3631130695066
#~ 
#~ zoom= 15
def handle(req):
	from mod_python import apache, util
	req.content_type = 'text/plain'
	left, right, top, bottom = req.args.split(';', 4)
	
	zoom= 15
	left=float(left)
	right=float(right)
	top=float(top)
	bottom=float(bottom)
	
	bg = getImage('http://tile.openstreetmap.org/', left, right, top, bottom, zoom,'osm')
	
	contours = getImage('http://tiles.pistes-nordiques.org/tiles-contours/', left, right, top, bottom, zoom,'osm')
	r, g, b, a = contours.split()
	mask = Image.merge("L", (a,))
	
	v=numpy.asarray(mask)*0.5
	v=numpy.uint8(v)
	value=Image.fromarray(v)
	bg.paste(contours.convert('RGB'),None,value)
	
	
	hs = getImage('http://tiles2.pistes-nordiques.org/hillshading/', left, right, top, bottom, zoom,'tms')
	r, g, b, a = hs.split()
	mask = Image.merge("L", (a,))
	
	v=numpy.asarray(mask)*0.5
	v=numpy.uint8(v)
	value=Image.fromarray(v)
	
	bg.paste(hs.convert('RGB'),None,value)
	
	pistes = getImage('http://tiles.pistes-nordiques.org/tiles-pistes2/', left, right, top, bottom, zoom,'osm')
	r, g, b, a = pistes.split()
	mask = Image.merge("L", (a,))
	
	bg.paste(pistes.convert('RGB'),None,mask)
	bg=bg.convert('RGB')
	
	cartouche= Image.open(os.path.dirname(__file__)+'/cartouche.png')
	cartouche.load()
	r, g, b, a = cartouche.split()
	mask = Image.merge("L", (a,))
	
	v=numpy.asarray(mask)
	v=numpy.uint8(v)
	value=Image.fromarray(v)
	
	bg.paste(cartouche.convert('RGB'),(0,0),value)
	
	randFilename = random.randrange(0, 100001, 2)
	PIL_images_dir = '/var/www/tmp/' 
	printout_filename = 'printout'+str(randFilename)+'.pdf'
	outname=PIL_images_dir + printout_filename
	
	#bg.save(outname,'png', ppi=pistes.info['ppi'])
	bg.save(outname,'PDF', resolution=200.0)
	req.write('/tmp/'+printout_filename)
	return apache.OK

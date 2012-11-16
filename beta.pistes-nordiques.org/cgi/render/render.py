##!/usr/bin/env python
# Tile renderer for mapnik with mod_python
# From Sylvain Letuffe work, simplified for better comprehension

import math
import os
from mapnik import *
#

def deg2num(lat_deg, lon_deg, zoom):
	# from lon lat to tile names, see http://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
	lat_rad = math.radians(lat_deg)
	n = 2.0 ** zoom
	x_tile = (lon_deg + 180.0) / 360.0 * n
	y_tile = (1.0 - math.log(math.tan(lat_rad) + (1 / math.cos(lat_rad))) / math.pi) / 2.0 * n
	#url = 'http://c.tile.openstreetmap.org/'+str(zoom)+'/'+str(xtile)+'/'+str(ytile)+'.png'
	y_tile = (2**zoom-1) -y_tile ##beware, TMS spec !
	return int(x_tile), int(y_tile) #, xtile - int(xtile), ytile - int(ytile)
# 
def num2deg(xtile, ytile, zoom):
	#from tilenames to lon lat , see http://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
	n = 2.0 ** zoom
	lon_deg = xtile / n * 360.0 - 180.0
	ytile = (2**zoom-1) -ytile ##beware, TMS spec !
	lat_rad = math.atan(math.sinh(math.pi * (1 - 2 * ytile / n)))
	lat_deg = math.degrees(lat_rad)
	return(lat_deg, lon_deg)
#
def num2bbox(xtile, ytile, zoom):
	#from tilenames to bbox , see http://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
	# to center the tiles:
	
	xtile= xtile 
	ytile= ytile
	n = 2.0 ** (zoom)
	lon1_deg = xtile / n * 360.0 - 180.0
	#ytile = (2**zoom-1) -ytile ##beware, TMS spec !
	lat1_rad = math.atan(math.sinh(math.pi * (1 - 2 * ytile / n)))
	lat1_deg = math.degrees(lat1_rad)
	
	xtile=xtile + 1
	ytile=ytile + 1
	lon2_deg = xtile / n * 360.0 - 180.0
	#ytile = (2**zoom-1) -ytile ##beware, TMS spec !
	lat2_rad = math.atan(math.sinh(math.pi * (1 - 2 * ytile / n)))
	lat2_deg = math.degrees(lat2_rad)
	# SW, NE
	return(lon1_deg, lat2_deg, lon2_deg, lat1_deg)
#
def RepresentsInt(s):
    try: 
        int(s)
        return True
    except ValueError:
        return False
def handle(req):
	# This function handle the apach request
	from mod_python import apache, util
	
	# decode the parameters given by url:
	z, x, name = req.args.split('/', 3)
	y=name.split('.')[0]
	ext='png'
	
	z = int(z)
	x = int(x)
	y = int(y)
	
	# The size of the tile in pixel:
	sx = 256
	sy = 256
	
	outname = os.tmpnam()
	
	# Declare usefull projections
	lonlat = Projection('+proj=longlat +datum=WGS84')
	
	proj = "+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +no_defs +over"

	m = Map(sx,sy,proj)
	mapfile="/home/website/mapnik-settings/offset-style/map.xml"
	load_map(m,mapfile)
	m.background = Color("transparent")
	
	# compute the bbox corresponding to the requested tile
	ll = num2bbox(x, y, z)
	#return str(ll)
	prj= Projection(proj)
	c0 = prj.forward(Coord(ll[0],ll[1]))
	c1 = prj.forward(Coord(ll[2],ll[3]))
	bbox = Envelope(c0.x,c0.y,c1.x,c1.y)
	
	bbox.width(bbox.width() )
	bbox.height(bbox.height() )
	
	# zoom the map to the bbox
	m.zoom_to_box(bbox)
	
	# render the tile
	im = Image(sx, sy)
	render(m, im)
	view = im.view(0, 0, sx, sy)
	
	# save it on disk
	view.save(outname, ext)
	
	# reopen it as an image
	fd = open(outname)
	out = fd.read()
	fd.close()
	
	#~ req.status = 200
	#~ req.content_type = 'text/plain'
	#~ req.write(req.args)
	#~ #req.write(str(bbox)+'\n')
	#~ #req.write(str(z)+'/'+str(x)+'/'+str(y)+'.png')
	#~ #req.write(save_map_to_string(m))
	#~ return apache.OK
	
	req.content_type = 'image/png'
	req.write(out)
	return apache.OK


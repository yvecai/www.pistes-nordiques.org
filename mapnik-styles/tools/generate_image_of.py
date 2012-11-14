#!/usr/bin/python
#
# Generates a single large PNG image for a UK bounding box
# Tweak the lat/lon bounding box (ll) and image dimensions
# to get an image of arbitrary size.
#
# To use this script you must first have installed mapnik
# and imported a planet file into a Postgres DB using
# osm2pgsql.
#
# Note that mapnik renders data differently depending on
# the size of image. More detail appears as the image size
# increases but note that the text is rendered at a constant
# pixel size so will appear smaller on a large image.

from mapnik import *
import sys, os

if __name__ == "__main__":
	
	mapfile='styles/pistes-styles.xml'
	map_uri = "image.png"

	#---------------------------------------------------
	#  Change this to the bounding box you want
	#
	ll = (6.05,46.38, 6.08, 46.42)
	#ll = (6.05,46.38, 6.12, 46.42)
	#ll= (-0.1,-0.1,0.1,0.1)
	#---------------------------------------------------

	z = 10
	imgx = 100 * z
	imgy = 100 * z
	proj = "+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +no_defs +over"

	offset=5
	
	pistes=[]
	p={}
	p['color']='blue'
	p['osm_id']=-1439729
	p['of']=1
	pistes.append(p)
	
	p={}
	p['color']='green'
	p['osm_id']=-1439726
	p['of']=1
	pistes.append(p)
	
	p={}
	p['color']='green'
	p['osm_id']=-1439728
	p['of']=1
	pistes.append(p)
	
	p={}
	p['color']='black'
	p['osm_id']=-1439743
	p['of']=-1
	pistes.append(p)
	
	
	m = Map(imgx,imgy,proj)
	#load_map(m,mapfile)
	m.background = Color('white')
	# Database settings
	db_params = dict(
	dbname = 'pistes-mapnik',
	user = 'mapnik',
	table = 'planet_osm_line',
	password = 'mapnik',
	host = 'localhost',
	port = 5432
	)
	i=0
	for p in pistes:
		i+=1
		s = Style()
		r=Rule()
		l=LineSymbolizer(Color(p['color']),5)
		l.offset = p['of']*offset
		r.symbols.append(l)
		s.rules.append(r)
		m.append_style('My Style'+str(i),s)
		lyr = Layer('shape', proj)
		#(select ST_Buffer(geometry, 5) as geometry from %s) polygon'
		#TABLE = 'planet_osm_line where "piste:type" is not null'
		db_params['table']='(Select way from planet_osm_line where osm_id = %s) as mysubquery' % (p['osm_id'])
		
		lyr.datasource = PostGIS(**db_params)
		lyr.styles.append('My Style'+str(i))
		m.layers.append(lyr)
	
	prj= Projection(proj)
	c0 = prj.forward(Coord(ll[0],ll[1]))
	c1 = prj.forward(Coord(ll[2],ll[3]))
	bbox = Box2d(c0.x,c0.y,c1.x,c1.y)
	#bbox=mapnik2.Box2d(-626172.1357121642,-7.081154551613622e-10,3.492459654808044e-10,626172.1357121639)
	print c0, c1
	m.zoom_to_box(bbox)
	im = Image(imgx,imgy)
	render(m, im)
	view = im.view(0,0,imgx,imgy) # x,y,width,height
	view.save(map_uri,'png')

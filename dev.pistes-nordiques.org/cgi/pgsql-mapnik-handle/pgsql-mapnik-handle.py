#!/usr/bin/python

import pdb
import psycopg2
import re

#bbox	5.9614204326416,46.349855875071,6.2106727519774,46.452608286789
from mod_python import apache
def handle(req):
	
	bbox = req.args.split('bbox=')[1]
	check=re.findall('[0-9.-]+',bbox)
	# filter for bbox only, to avoid os.popen exploit
	#bounds=bbox.split(',') => possible exploit?
	left=check[0]
	bottom=check[1]
	right=check[2]
	top=check[3]
	
	db='pistes-mapnik'
	conn = psycopg2.connect("dbname="+db+" user=mapnik")
	cur = conn.cursor()
        cur.execute(" \
                SELECT route_name, color, colour, osm_id \
                FROM planet_osm_line WHERE \
                st_intersects(\
                        planet_osm_line.way,\
                        st_transform( \
                                ST_MakeEnvelope(%s,%s,%s,%s, 900913),\
                                900913)) \
                 and osm_id <0 group by osm_id, route_name, color, colour; "\
                , (left, bottom, right, top))
        result=cur.fetchall()
        cur.close()
        conn.close()
	string=''
	for r in result:
		
                route_name=str(r[0])
		if (str(r[1]) == 'None'): color=str(r[2])
		else : color=str(r[1])
                #color=str(r[1])
                #colour=str(r[2])
                osm_id=str(r[3])
		string+=route_name+':'+color+':'+osm_id+'|'
	req.content_type = 'text/plain'
        req.write(string)
	return apache.OK
	"""
	cur.execute(" \
		SELECT st_Astext(st_collect(way)), route_name, color, colour, osm_id \
		FROM planet_osm_line WHERE \
		st_intersects(\
			planet_osm_line.way,\
			st_transform( \
				ST_MakeEnvelope(%s,%s,%s,%s, 900913),\
				900913)) \
		 and osm_id <0 group by osm_id, route_name, color, colour; "\
		, (left, bottom, right, top))
	result=cur.fetchall()
	cur.close()
	conn.close()

	geojson='{ "type": "FeatureCollection",\n'
	geojson+=' "features": [\n'

	for r in result:
		geojson+='  { "type": "Feature",\n'
		geom=r[0]
		route_name=str(r[1])
		color=str(r[2])
		colour=str(r[3])
		osm_id=str(r[4])
		geojson+='    "geometry": {\n'
		if geom.split('(')[0] == 'LINESTRING': 
			linestring=geom.split('(')[1].strip(')').split(',')
			coordinates=[]
			for p in linestring:
				coordinates.append([float(p.split(' ')[0]),float(p.split(' ')[1])])
			geojson+='      "type": "LineString",\n'
			geojson+='      "coordinates":'+str(coordinates)+' \n'
			geojson+='     }, \n'
		
		if geom.split('(')[0] == 'MULTILINESTRING': 
			linestrings = re.findall('\([-0-9., ]+\)',geom)
			geojson+='      "type": "MultiLineString",\n'
			multi=[]
			for linestring in linestrings:
				coordinates=[]
				for p in linestring.strip('()').split(','):
					coordinates.append([float(p.split(' ')[0]),float(p.split(' ')[1])])
				multi.append(coordinates)
			geojson+='      "coordinates":'+str(multi)+' \n'
			geojson+='     }, \n'
			
		geojson+='    "properties": { \n'
		geojson+='       "route_name": "'+route_name+'",\n'
		geojson+='       "color": "'+color+'",\n'
		geojson+='       "colour": "'+colour+'",\n'
		geojson+='       "osm_id": '+osm_id+'\n'
		if ( r == result[-1] ) : geojson+='    } \n  }\n'
		else : geojson+='    } \n  },\n'
	geojson+='  ]\n'
	geojson+='}'

	req.content_type = 'text/plain'
	req.write(geojson)
	
	#return apache.OK
	"""


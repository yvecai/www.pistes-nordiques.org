#!/usr/bin/env python
# Source is GPL
# fichier execute par mod_python. handle() est le point d'entree.
#http://192.168.1.3/test_ol_vec/getBbox.py/6.26/46.66/6.35/46.69

import os
import psycopg2
import json

def application(environ,start_response):
	#http://.../osmosis?bbox=6.3497669467183,46.812499839206,6.4490730532817,46.829179837372

	request = environ['QUERY_STRING']
	simplify = request.split('simplify=')[1].split('&')[0]
	if simplify == 'true' : simplify = True
	else : simplify = False
	bbox = request.split('bbox=')[1]
	check=bbox.split(',')
	left=check[0]
	bottom=check[1]
	right=check[2]
	top=check[3]
	db='pistes-mapnik'
	conn = psycopg2.connect("dbname="+db+" user=mapnik")
	cur = conn.cursor()
	if not simplify:
		cur.execute(" \
				SELECT osm_id, st_asgeojson(way), \
				\"piste:type\", \"piste:difficulty\", \"piste:grooming\", aerialway,\
				route_name, color, colour \
				FROM planet_osm_line WHERE \
				st_intersects(\
						planet_osm_line.way,\
						st_transform( \
								ST_MakeEnvelope(%s,%s,%s,%s, 900913),\
								900913)); "\
				, (left, bottom, right, top))
	else :
		cur.execute(" \
				SELECT osm_id, st_asgeojson(st_simplify(way,100)), \
				\"piste:type\", \"piste:difficulty\", \"piste:grooming\", aerialway,\
				route_name, color, colour \
				FROM planet_osm_line WHERE \
				st_intersects(\
						planet_osm_line.way,\
						st_transform( \
								ST_MakeEnvelope(%s,%s,%s,%s, 900913),\
								900913)); "\
				, (left, bottom, right, top))
		
	result=cur.fetchall()
	cur.close()
	conn.close()
	
	
	pistes={}
	pistes['type']="FeatureCollection"
	pistes['features']=[]
	for r in result:
		feature={}
		feature['type']='Feature'
		feature['geometry']=json.loads(r[1])
		feature['properties']={}
		feature['properties']['id']=long(r[0])
		feature['properties']['piste:type']=r[2]
		feature['properties']['piste:difficulty']=r[3]
		feature['properties']['piste:grooming']=r[4]
		feature['properties']['aerialway']=r[5]
		feature['properties']['route_name']=r[6]
		if r[6] : feature['properties']['colour']=r[7]
		else: feature['properties']['colour']=r[8]
		pistes['features'].append(feature)
	
	
	
	#response_body=json.dumps(pistes, sort_keys=False, indent=2, separators=(',', ': '))
	response_body=json.dumps(pistes)
	status = '200 OK'
	response_headers = [('Content-Type', 'text/plain'),('Content-Length', str(len(response_body)))]
	
	start_response(status, response_headers)
	return [response_body]
    

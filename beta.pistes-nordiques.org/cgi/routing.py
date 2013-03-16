#!/usr/bin/env python

#import cgi
import sys, os, os.path
import math, random
import StringIO
from xml.sax import make_parser, handler
import xml
import psycopg2


def application(environ,start_response):
	request = environ['QUERY_STRING']
	
	coord = request.split(',')
	#46.68595351392255;6.278869362596836,46.688059642861326;6.279795884230195
	
	# define the bbox where requesting the data
	lat1=float(coord[0].split(';')[0])
	lon1=float(coord[0].split(';')[1])
	lat2=float(coord[1].split(';')[0])
	lon2=float(coord[1].split(';')[1])
	
	db='pistes-routing'
	conn = psycopg2.connect("dbname="+db+" user=mapnik")
	cur = conn.cursor()
	
	cur.execute("select max(gid) from ways;")
	mgid=cur.fetchone()[0]+1
	cur.execute("select max(id) from vertices_tmp;")
	mid=cur.fetchone()[0]+1
	
	## find the closestway
	cur.execute("SELECT gid, target, \
				  ST_Distance(the_geom, ST_GeometryFromText('POINT(%s %s)', 4326)) AS dist  \
				 FROM ways   \
				 WHERE the_geom && st_setsrid('BOX3D(%s %s,%s %s)'::box3d, 4326)  \
				 ORDER BY dist LIMIT 1;" %(lon1, lat1, lon1-0.1, lat1-0.1, lon1+0.1, lat1+0.1))
	res=cur.fetchall()[0]
	wayid=res[0]
	target=res[1]
	#110306
	
	## first half split of the way
	try :
		cur.execute("insert into ways (gid,to_cost,reverse_cost, length,class_id, osm_id, the_geom, source, target)  \
				select  \
				%s, \
				to_cost,reverse_cost,length,class_id, osm_id, \
				st_line_substring(the_geom,0, \
					st_line_locate_point(the_geom, ST_GeometryFromText('POINT(%s %s)', 4326))), \
				source, \
				%s \
				from ways where gid = %s;" %(mgid+1,lon1, lat1,mid+1,wayid))
		conn.commit()
		## add node at the end of the new way
		cur.execute("insert into vertices_tmp (id, the_geom) \
				select \
				%s, \
				st_endpoint(the_geom) \
				from ways where gid = %s;" %(mid+1, mgid+1))
		conn.commit()
		## cut the way to the second half split
		cur.execute("update ways set the_geom = ( \
				select st_line_substring(the_geom, \
				st_line_locate_point(the_geom, ST_GeometryFromText('POINT(%s %s)', 4326)), 1) \
				from ways where gid = %s) \
				where gid = %s;" %(lon1, lat1, wayid, wayid)) 
		conn.commit()
		cur.execute("update ways set source = %s \
				where gid = %s;" %(mid+1, wayid)) 
		conn.commit()
		
		source = mid+1
	except:
		# second same request, we cannot split at the end of the way, target is ok from first query
		conn.rollback()
		source=target
		pass
	
	
	## find the closestway
	cur.execute("SELECT gid, target, \
				  ST_Distance(the_geom, ST_GeometryFromText('POINT(%s %s)', 4326)) AS dist  \
				 FROM ways   \
				 WHERE the_geom && st_setsrid('BOX3D(%s %s,%s %s)'::box3d, 4326)  \
				 ORDER BY dist LIMIT 1;" %(lon2, lat2, lon2-0.1, lat2-0.1, lon2+0.1, lat2+0.1))
	res=cur.fetchall()[0]
	wayid=res[0]
	target=res[1]
	#11
	try:
		## first half split of the way
		cur.execute("insert into ways (gid,to_cost,reverse_cost,length, class_id, osm_id, the_geom, source, target)  \
				select  \
				%s, \
				to_cost,reverse_cost,length,class_id, osm_id, \
				st_line_substring(the_geom,0, \
				st_line_locate_point(the_geom, ST_GeometryFromText('POINT(%s %s)', 4326))), \
				source, \
				%s \
				from ways where gid = %s;"%(mgid+2,lon2, lat2,mid+2,wayid))
		conn.commit()
		## add node at the end of the new way
		cur.execute("insert into vertices_tmp (id, the_geom) \
				select \
				%s, \
				st_endpoint(the_geom) \
				from ways where gid = %s;" %(mid+2, mgid+2))
		conn.commit()
		## cut the way to the second half split
		cur.execute("update ways set the_geom = ( \
				select st_line_substring(the_geom, \
				st_line_locate_point(the_geom, ST_GeometryFromText('POINT(%s %s)', 4326)), 1) \
				from ways where gid = %s) \
				where gid = %s;" %(lon2, lat2, wayid, wayid)) 
		conn.commit()
		
		cur.execute("update ways set source = %s \
				where gid = %s;" %(mid+2, wayid)) 
		conn.commit()
		target = mid+2
	except:
		# second same request, we cannot split at the end of the way, target is ok from first query
		conn.rollback()
		pass
	
	
	
	
	## route
	cur.execute(" select st_astext(st_linemerge(st_collect(the_geom))) from dijkstra_sp('ways', %s,%s);"
				, (source,target))
	wkt=cur.fetchone()[0]
	
	# create the WKT MultilineString:
	cur.execute(" SELECT array_agg(edge_id) FROM shortest_path(' \
                SELECT gid as id, \
                         source::integer, \
                         target::integer, \
                         length::double precision as cost \
                        FROM ways', \
                %s, %s, false, false);" \
				, (source,target))
	edges=cur.fetchall()[0][0]
	edges_id=[]
	for e in edges:
		edges_id.append(str(e))
	edges=','.join(edges_id)
	cur.execute("SELECT array_agg(osm_id) from ways where gid in (%s);" %(edges))
	route=str(cur.fetchall()[0][0]).strip('[]')
	# create XML:
	xml = '<?xml version="1.0" encoding="UTF-8" ?>\n  <route>\n'
	xml += '	<wkt>' + wkt + '\n	</wkt>\n'
	xml += '<route_topo>'+ route+'</route_topo>'
	xml += '  </route>\n'
	
	status = '200 OK'
	response_body=xml
	response_headers = [('Content-Type', 'application/xml'),('Content-Length', str(len(response_body)))]
	start_response(status, response_headers)
	return [response_body]


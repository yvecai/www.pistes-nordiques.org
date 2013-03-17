#!/usr/bin/env python

#import cgi
import sys, os, os.path
import re
import xml
import psycopg2

def split(lat,lon, typ):
	
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
				 ORDER BY dist LIMIT 1;" %(lon, lat, lon-0.0001, lat-0.0001, lon+0.0001, lat+0.0001))
	try: res=cur.fetchall()[0]
	# maybe there is not pistes nearby
	except: return None
	wayid=res[0]
	target=res[1]
	
	#110306
	
	## first half split of the way
	try :
		cur.execute("insert into ways (gid,to_cost,reverse_cost, class_id, osm_id, the_geom,length, source, target)  \
				select  \
				%s, \
				to_cost,reverse_cost,class_id, osm_id, \
				st_line_substring(the_geom,0, \
					st_line_locate_point(the_geom, ST_GeometryFromText('POINT(%s %s)', 4326))), \
				length*st_line_locate_point(the_geom, ST_GeometryFromText('POINT(%s %s)', 4326)), \
				source, \
				%s \
				from ways where gid = %s;" %(mgid+1,lon, lat,lon, lat,mid+1,wayid))
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
				where gid = %s;" %(lon, lat, wayid, wayid)) 
		conn.commit()
		cur.execute("update ways set length = ( \
				select length*(1-st_line_locate_point(the_geom, ST_GeometryFromText('POINT(%s %s)', 4326))) \
				from ways where gid = %s) \
				where gid = %s;" %(lon, lat, wayid, wayid)) 
		conn.commit()
		cur.execute("update ways set source = %s \
				where gid = %s;" %(mid+1, wayid)) 
		conn.commit()
		
		if typ == 'first': source = mid+1
		if typ == 'second': target = mid+1
	except:
		# second same request, we cannot split at the end of the way, target is ok from first query
		conn.rollback()
		if typ == 'first': source=target
		pass
	if typ == 'first': return source 
	if typ == 'second': return target 
	
def route(source, target):
	db='pistes-routing'
	conn = psycopg2.connect("dbname="+db+" user=mapnik")
	cur = conn.cursor()
	## create the WKT
	cur.execute(" select st_astext(st_linemerge(st_collect(the_geom))) from dijkstra_sp('ways', %s,%s);"
				, (source,target))
				
	wkt=cur.fetchone()[0]
	
	
	# create the route with osm_ids and length:
	cur.execute(" SELECT edge_id,cost FROM shortest_path(' \
				SELECT gid as id, \
						 source::integer, \
						 target::integer, \
						 length::double precision as cost \
						FROM ways', \
				%s, %s, false, false);" \
				, (source,target))
	result=cur.fetchall()
	edges_id=[]
	length=[]
	for r in result[:-1]:
		edges_id.append(str(r[0]))
		length.append(r[1])
	#edges=','.join(edges_id)
	#cur.execute("SELECT array_agg(osm_id) from ways where gid in (%s);" %(edges))
	osm_ids=[]
	for edge in edges_id:
		cur.execute("SELECT osm_id from ways where gid = %s;" %(edge))
		osm_ids.append(cur.fetchone()[0])
	
	return wkt, osm_ids, length
	
def orderWkt(wkt, lon, lat):
	
	lonlat = re.findall('[-0-9. ]+',wkt)
	flon=float(lonlat[0].split(' ')[0])
	flat=float(lonlat[0].split(' ')[1])
	llon=float(lonlat[-1].split(' ')[0])
	llat=float(lonlat[-1].split(' ')[1])
	
	if abs(flon-lon) + abs(flat-lat) > abs(llon-lon) + abs(llat-lat):
		lonlat.reverse()
	return 'LINESTRING('+','.join(lonlat)+')'
	
def multiWkt(wkts):
	out='MULTILINESTRING('
	for wkt in wkts:
		line = re.findall('\([-0-9., ]+\)',wkt)
		out+=line[0]
	out+=')'
	return out
	
def make_route(coord):
	wkts=[]
	ids=[]
	lengthes=[]
	# define the bbox where requesting the data
	for i in range(len(coord)-2):
		lon1 = float(coord[i].split(';')[1])
		lat1 = float(coord[i].split(';')[0])
		lon2 = float(coord[i+1].split(';')[1])
		lat2 = float(coord[i+1].split(';')[0])
		
		source=split(lat1, lon1, 'first')
		target=split(lat2, lon2, 'second')
		if (source == None or target == None) : return '<?xml version="1.0" encoding="UTF-8" ?>\n  <null/>'
		wkt, osm_ids, length=route(source, target)
		# reverse linestring if needed
		wkt=orderWkt(wkt, lon1, lat1)
		wkts.append(wkt)
		ids.extend(osm_ids)
		lengthes.extend(length)
		
	# simplify id and length lists to remove successive duplicates
	clean_ids=[]
	clean_lengthes=[]
	clean_ids.append(ids[1])
	clean_lengthes.append(lengthes[1])
	for i in range(len(ids)-1):
		if ids[i+1] == clean_ids[-1]: clean_lengthes[-1]=lengthes[i+1]
		else:
			clean_ids.append(ids[i+1])
			clean_lengthes.append(lengthes[i+1])
			
	# makes a multi if needed
	if len(wkts) >1:
		wkt=multiWkt(wkts)
	else:
		wkt=wkts[0]
	
	# create XML:
	xml = '<?xml version="1.0" encoding="UTF-8" ?>\n  <route>\n'
	xml += '	<wkt>' + str(wkt) + '\n	</wkt>\n'
	xml += '<ids>'+ str(clean_ids).strip('[]')+'</ids>\n'
	xml += '<length>'+ str(clean_lengthes).strip('[]')+'</length>'
	xml += '  </route>\n'
	return xml

def info(lat1, lon1):
	db='pistes-routing'
	conn = psycopg2.connect("dbname="+db+" user=mapnik")
	cur = conn.cursor()
	## find the closestway
	cur.execute("SELECT osm_id, \
				  ST_Distance(the_geom, ST_GeometryFromText('POINT(%s %s)', 4326)) AS dist  \
				 FROM ways   \
				 WHERE the_geom && st_setsrid('BOX3D(%s %s,%s %s)'::box3d, 4326)  \
				 ORDER BY dist LIMIT 1;" %(lon1, lat1, lon1-0.0001, lat1-0.0001, lon1+0.0001, lat1+0.0001))
	try: wayid=str(cur.fetchall()[0][0])
	# maybe there is not pistes nearby
	except: return None
	
	# create XML:
	xml = '<?xml version="1.0" encoding="UTF-8" ?>\n  <route>\n'
	xml += '<info>'+ wayid+'</info>'
	xml += '  </route>\n'
	return xml

def application(environ,start_response):
	request = environ['QUERY_STRING']
	
	coord = request.split(',')
	#46.68595351392255;6.278869362596836,46.688059642861326;6.279795884230195
	xml=''
	if len(coord) > 2:
		xml=make_route(coord)
	else:
		lat1=float(coord[0].split(';')[0])
		lon1=float(coord[0].split(';')[1])
		xml=info(lat1, lon1)
		
	
	status = '200 OK'
	response_body=xml
	response_headers = [('Content-Type', 'application/xml'),('Content-Length', str(len(response_body)))]
	start_response(status, response_headers)
	return [response_body]


#! /usr/bin/python

import sys, os, re
from shapely.wkt import dumps, loads
from shapely.geometry import MultiLineString

def handle(req):
	from mod_python import apache, util
	data= req.readline()
	params= req.readline().split(';')
	of = float(params[0])
	side = params[1]
	req.content_type = 'text/plain'
	
	lines = re.findall('\([-0-9., ]+\)',data)
	
	if len(lines) < 2:
		data = lines[0]
		shape = loads(data)
		o_object = shape.parallel_offset(of, side, resolution=1, join_style=2, mitre_limit=1.0)
		req.write(o_object.wkt)
		return apache.OK
	else :
		linestrings=[]
		for l in lines:
			data = 'LINESTRING '+l
			shape = loads(data)
			o_object = shape.parallel_offset(of, side, resolution=1, join_style=2, mitre_limit=1.0)
			linestrings.append(re.findall('\([-0-9., ]+\)',o_object.wkt)[0])
		multi='MULTILINESTRING ('+','.join(linestrings)+')'
		req.write(multi)
		return apache.OK


#! /usr/bin/python

import sys, os
from shapely.wkt import dumps, loads
from shapely.geometry import MultiLineString

def handle(req):
	from mod_python import apache, util
	data= req.readline()
	
	if (shape.type == 'MultiLineString'):
		o_lines = []
		for line in shape.geoms :
			o_line = line.parallel_offset(0.1, 'left', resolution=1, join_style=1, mitre_limit=1.0)
			o_lines.append(o_line)
		o_object = MultiLineString(o_lines).wkt
		
	else :
		o_object = shape.parallel_offset(0.1, 'left', resolution=1, join_style=1, mitre_limit=1.0)
	
	req.content_type = 'text/plain'
	req.write(o_object.wkt)
	return apache.OK


#! /usr/bin/python

import sys, os
from shapely.wkt import dumps, loads

def handle(req):
    from mod_python import apache, util
    data= req.readline()
    shape = loads(data)
    o_object = shape.parallel_offset(0.1, 'left', resolution=1, join_style=1, mitre_limit=1.0)
    
    req.content_type = 'text/plain'
    req.write(o_object.wkt)
    return apache.OK


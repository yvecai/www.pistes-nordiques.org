#!/usr/bin/env python
# Source is GPL
# fichier execute par mod_python. handle() est le point d'entree.
#http://192.168.1.3/test_ol_vec/getBbox.py/6.26/46.66/6.35/46.69

import os
import re

def application(environ,start_response):
	#http://.../osmosis?bbox=6.3497669467183,46.812499839206,6.4490730532817,46.829179837372

	request = environ['QUERY_STRING']
	bbox = request.split('bbox=')[1]
	check=re.findall('[0-9.-]+',bbox)
	# filter for bbox only, to avoid os.popen exploit
	#bounds=bbox.split(',') => possible exploit?
	left=check[0]
	bottom=check[1]
	right=check[2]
	top=check[3]
	L = " ".join(os.popen("/home/website/src/osmosis-0.40.1/bin/osmosis \
	--read-pgsql host=\"localhost\" database=\"pistes-xapi\" user=\"xapi\" password=\"xapi\" \
	--dataset-bounding-box left="+left+" right="+right+" top="+top+" bottom="+bottom+" completeWays=yes \
	--write-xml file=- ",'r').readlines())
	L= re.sub('version="[^"]*" timestamp="[^"]*" uid="[^"]*" user="[^"]*" changeset="[^"]*"','',L)
	"""
	version="[^"]*" timestamp="[^"]*" uid="[^"]*" user="[^"]*" changeset="[^"]*"
	"""
	"""
	/home/website/src/osmosis-0.40.1/bin/osmosis \
	--read-pgsql host="localhost" database="xapi" user="xapi" password="xapi" \
	--dataset-bounding-box bottom=46.69 top=46.78 right=7.60 left=7.21 completeWays=yes \
	--write-xml file=- 
	"""
	response_body=L
	status = '200 OK'
	response_headers = [('Content-Type', 'text/plain'),('Content-Length', str(len(response_body)))]
	
	start_response(status, response_headers)
	return [response_body]
    

#!/usr/bin/env python
# Source is GPL
# fichier execute par mod_python. handle() est le point d'entree.
#http://192.168.1.3/test_ol_vec/getBbox.py/6.26/46.66/6.35/46.69
#from mod_python import apache
#from mod_python import util

#from legen2Html import ...
import os
import re
from mod_python import apache
def handle(req):
    #http://.../osmosis_wrapper.py/req?bbox=6.3497669467183,46.812499839206,6.4490730532817,46.829179837372
    
    #req.content_type = 'text/plain'
    #for r in dir(req):
        #req.write(r+":"+str(req.__getattribute__(r))+"\n")
    #return apache.OK
    bbox = req.args.split('bbox=')[1]
    check=re.findall('[0-9.-]+',bbox)
    # filter for bbox only, to avoid os.popen exploit
    #bounds=bbox.split(',') => possible exploit?
    left=check[0]
    bottom=check[1]
    right=check[2]
    top=check[3]
    L = " ".join(os.popen("/home/website/src/osmosis-0.40.1/bin/osmosis \
--read-pgsql host=\"localhost\" database=\"pistes-xapi-lowres\" user=\"xapi\" password=\"xapi\" \
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
    req.content_type = 'text/plain'
    req.write(L)
    #req.write(str(tracks))
    return apache.OK
    

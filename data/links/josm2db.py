#!/usr/bin/env python
# Source is GPL
# fichier execute par mod_python. handle() est le point d'entree.
#http://192.168.1.3/test_ol_vec/getBbox.py/6.26/46.66/6.35/46.69
#from mod_python import apache
#from mod_python import util

#from legen2Html import ...

from lxml import etree
import datetime
from copy import deepcopy


parser = etree.XMLParser(remove_blank_text=True) #for pretty_print
dbOsm=etree.parse('/home/yves/sites/www.moi.org/alpha/pistes-nordiques-frontend/links/link_db.osm',parser)
dbFile=open('/home/yves/sites/www.moi.org/alpha/pistes-nordiques-frontend/links/link_db.osm','w')
dbRoot= dbOsm.getroot()

ways=dbOsm.findall('way')
for way in ways:
    if (way.get('action') == 'delete') :
        dbRoot.remove(way)
        
nodes=dbOsm.findall('node')
for node in nodes:
    if (node.get('action') == 'delete') :
        dbRoot.remove(node)

ways=dbOsm.findall('way')
for way in ways:
    if int(way.get('id')) < 0 :
        way.set('id', str(-int(way.get('id'))))
    way.set('version', '1')
    nds=way.findall('nd')
    for nd in nds:
        if int(nd.get('ref')) < 0 :
            nd.set('ref', str(-int(nd.get('ref'))))

nodes=dbOsm.findall('node')

for node in nodes:
    if int(node.get('id')) < 0 :
        node.set('id', str(-int(node.get('id'))))
    node.set('version', '1')

#global maxWayId
maxWayId = 0
for way in ways:
    if int(way.get('id')) > maxWayId: maxWayId=int(way.get('id'))
maxWayId += 1

for el in dbRoot.iter():
     el.tail = None #for pretty_print

dbFile.write("<?xml version=\"1.0\" encoding=\"UTF-8\"?>")
dbFile.write(etree.tostring(dbRoot, pretty_print = True))
dbFile.close()




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
    
    db='pistes-mapnik2'
    conn = psycopg2.connect("dbname="+db+" user=mapnik")
    cur = conn.cursor()
    
    cur.execute(" \
	select id, st_astext(st_transform(the_geom,4326))  \
	from vertices_tmp  \
	ORDER BY st_distance(st_transform(ST_SetSRID(ST_MakePoint(%s,%s),4326),900913),the_geom)  \
	limit 1; "\
                , (lon1, lat1))
    source=cur.fetchone()[0]
    cur.execute(" \
	select id, st_astext(st_transform(the_geom,4326))  \
	from vertices_tmp  \
	ORDER BY st_distance(st_transform(ST_SetSRID(ST_MakePoint(%s,%s),4326),900913),the_geom)  \
	limit 1; "\
                , (lon2, lat2))
    target=cur.fetchone()[0]
    
    cur.execute(" \
            SELECT edge_id FROM shortest_path(' \
                SELECT osm_id as id, \
                         source::integer, \
                         target::integer, \
                         st_length(way) as cost \
                        FROM planet_osm_line', \
                %s, %s, false, false);"
                , (source, target))
    edge_id=str(cur.fetchone()[0])
    cur.execute(" \
                select st_astext(st_transform(way,4326)) from planet_osm_line where osm_id = %s;" % (edge_id))
    wkt=cur.fetchone()[0]
    
    # create the WKT MultilineString:

    
    # create XML:
    xml = '<?xml version="1.0" encoding="UTF-8" ?>\n  <route>\n'
    xml += '    <wkt>' + wkt + '\n    </wkt>\n'
    xml += '<route_topo><way id="48469943"><tag k="length">3.17103527305</tag><tag k="piste:type">nordic</tag><tag k="piste:grooming">classic;skating</tag><tag k="piste:difficulty">easy</tag></way></route_topo>'
    xml += '  </route>\n'
    
    status = '200 OK'
    response_body=xml
    response_headers = [('Content-Type', 'application/xml'),('Content-Length', str(len(response_body)))]
    start_response(status, response_headers)
    return [response_body]


class Router:
    def __init__(self, data):
        self.data = data
    def distance(self,n1,n2):
        """Calculate distance between two nodes"""
        lat1 = self.data.nodes[n1][0]
        lon1 = self.data.nodes[n1][1]
        lat2 = self.data.nodes[n2][0]
        lon2 = self.data.nodes[n2][1]
        # TODO: projection issues
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        dist2 = dlat * dlat + dlon * dlon
        return(math.sqrt(dist2))
    def doRouteAsLL(self,start,end):
        result, nodes ,ways= self.doRoute(start,end)
        
        if(result != 'success'):
            return(result,[],[],[])
        pos = []
        for node in nodes:
            lat,lon = self.data.nodes[node]
            pos.append((lat,lon))
        return(result, pos, nodes, ways)
    def doRoute(self,start,end):
        """Do the routing"""
        self.searchEnd = end
        closed = [start]
        self.queue = []
        
        # Start by queueing all outbound links from the start node
        #blankQueueItem = {'end':-1,'distance':0,'nodes':[(str(start),0)]}
        blankQueueItem = { \
                        'end':-1,
                        'distance':0,
                        'nodes':str(start),
                        'ways':str(start)+',0'}
        try:
            for i, wayid in self.data.routing[start].items():
                self.addToQueue(start,i, blankQueueItem, wayid)
        except KeyError:
            return('no_such_node',[],[])
        
        # Limit for how long it will search
        count = 0
        while count < 10000:
            count = count + 1
            try:
                nextItem = self.queue.pop(0)
            except IndexError:
                print "Queue is empty: failed"
                return('no_route',[],[])
            x = nextItem['end']
            if x in closed:
                continue
            if x == end:
                # Found the end node - success
                #routeNodes = [int(i[0]) for i in nextItem['nodes']]
                routeNodes = [int(i) for i in nextItem['nodes'].split(",")]
                return('success', routeNodes, nextItem['ways'].split(";"))
            closed.append(x)
            try:
                for i, wayid in self.data.routing[x].items():
                    if not i in closed:
                        self.addToQueue(x,i,nextItem, wayid)
            except KeyError:
                pass
        else:
            return('gave_up',[],[])
    
    def addToQueue(self,start,end, queueSoFar, wayid):
        """Add another potential route to the queue"""
        
        # If already in queue
        for test in self.queue:
            if test['end'] == end:
                return
        distance = self.distance(start, end)
        #if(weight == 0):
            #return
        #distance = distance / weight
        
        # Create a hash for all the route's attributes
        distanceSoFar = queueSoFar['distance']
        #try: nodes = queueSoFar['nodes'].append((str(end),str(wayid)))
        #except: pdb.set_trace()
        nodes= queueSoFar['nodes'] + "," + str(end)
        ways= queueSoFar['ways']+ ";" +str(end)+ "," +str(wayid)
        queueItem = { \
            'distance': distanceSoFar + distance,
            'maxdistance': distanceSoFar + self.distance(end, self.searchEnd),
            'nodes': nodes,
            'ways': ways,
            'end': end}
        
        # Try to insert, keeping the queue ordered by decreasing worst-case distance
        count = 0
        for test in self.queue:
            if test['maxdistance'] > queueItem['maxdistance']:
                self.queue.insert(count,queueItem)
                break
            count = count + 1
        else:
            self.queue.append(queueItem)

def linearDist(lat1, lon1, lat2, lon2):

    # Convert latitude and longitude to 
    # spherical coordinates in radians.
    degrees_to_radians = math.pi/180.0
        
    # phi = 90 - latitude
    phi1 = (90.0 - lat1)*degrees_to_radians
    phi2 = (90.0 - lat2)*degrees_to_radians
        
    # theta = longitude
    theta1 = lon1*degrees_to_radians
    theta2 = lon2*degrees_to_radians
        
    # Compute spherical distance from spherical coordinates.
        
    # For two locations in spherical coordinates 
    # (1, theta, phi) and (1, theta, phi)
    # cosine( arc length ) = 
    #    sin phi sin phi' cos(theta-theta') + cos phi cos phi'
    # distance = rho * arc length
    
    cos = (math.sin(phi1)*math.sin(phi2)*math.cos(theta1 - theta2) + 
           math.cos(phi1)*math.cos(phi2))
    arc = math.acos( clamp(cos,-1,1)) # clamp will avoid rounding error that would lead cos outside of [-1,1] 'Math domain error'

    # Remember to multiply arc by the radius of the earth 
    # in your favorite set of units to get length.
    
    return arc*6371 #return km
    
    lat1 = math.radians(lat1)
    lon1 = math.radians(lon1)
    lat2 = math.radians(lat2)
    lon2 = math.radians(lon2)

    
    d = math.acos(math.sin(lat1)*math.sin(lat2) + \
                  math.cos(lat1)*math.cos(lat2) * \
                  math.cos(lon2-lon1)) * 6371 
    return d

#
def clamp(value, minvalue, maxvalue):
    return max(minvalue, min(value, maxvalue))
#
if __name__ == "__main__":
    handle("46.819861857936 6.3819670541344,46.827446755502 6.3980225909661,")#46.833474656204 6.4021853614751,")

def getWeight(transport, wayType):
  try:
    return(Weightings[wayType][transport])
  except KeyError:
    # Default: if no weighting is defined, then assume it can't be routed
    return(0)


def encodeLL(lat,lon):
  pLat = (lat + 90.0) / 180.0 
  pLon = (lon + 180.0) / 360.0 
  iLat = encodeP(pLat)
  iLon = encodeP(pLon)
  return(pack("II", iLat, iLon))
  
def encodeP(p):
  i = int(p * 4294967296.0)
  return(i)
  

def decodeLL(data):
  iLat,iLon = unpack("II", data)
  pLat = decodeP(iLat)
  pLon = decodeP(iLon)
  lat = pLat * 180.0 - 90.0
  lon = pLon * 360.0 - 180.0
  return(lat,lon)
  
def decodeP(i):
  p = float(i) / 4294967296.0
  return(p)
  

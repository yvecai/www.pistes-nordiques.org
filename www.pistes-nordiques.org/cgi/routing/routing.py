#!/usr/bin/env python

#import cgi
import sys, os, os.path, pdb
import math, random
import StringIO
from loadOsm import *

def handle(req):
    from mod_python import apache, util
    req.content_type ='application/xml'
    
    path = os.path.basename(req.filename)+req.path_info
    coord = path[:-1].split('/')[1].split(',')
    #coord = req[:-1].split(',')
    
    # define the bbox where requesting the data
    minlat=float(coord[0].split(' ')[0])
    minlon=float(coord[0].split(' ')[1])
    maxlat=float(coord[0].split(' ')[0])
    maxlon=float(coord[0].split(' ')[1])
    
    for c in coord:
        if c :
            if (float(c.split(' ')[0])<minlat):minlat=float(c.split(' ')[0])
            if (float(c.split(' ')[0])>maxlat):maxlat=float(c.split(' ')[0])
            if (float(c.split(' ')[1])<minlon):minlon=float(c.split(' ')[1])
            if (float(c.split(' ')[1])>maxlon):maxlon=float(c.split(' ')[1])
    margin = 0.1
    randFilename = random.randrange(0, 100001, 2)
    dir = '/var/tmp/'
    #PIL_images_dir = 'images/' #XX
    filename = str(randFilename)+'.osm'

    os.popen("/home/website/src/osmosis-0.40.1/bin/osmosis \
    --read-pgsql host=\"localhost\" database=\"pistes-xapi\" user=\"xapi\" password=\"xapi\" \
    --dataset-bounding-box left="+str(minlon-margin)+" right="+str(maxlon+margin)+ " top="+str(maxlat+margin)+" bottom="+str(minlat-margin)+" completeWays=yes \
    --write-xml file="+dir+filename,'r')
    
    # Load data from the bbox
    data = LoadOsm(dir+filename)
    
    # Route between successive points send to the script:
    routeNodes = []
    routeWays = []
    for i in range(len(coord)-1):
        lon1 = float(coord[i].split(' ')[1])
        lat1 = float(coord[i].split(' ')[0])
        lon2 = float(coord[i+1].split(' ')[1])
        lat2 = float(coord[i+1].split(' ')[0])
        
        node1 = data.findNode(lat1, lon1)
        node2 = data.findNode(lat2, lon2)
        
        router = Router(data)
        result, route, nodes, ways= router.doRouteAsLL(node1, node2)
        
        routeNodes.append(nodes)
        routeWays.extend(ways)
        
        if (result == 'success'): continue
        else:
            wkt = result
            xml = '<?xml version="1.0" encoding="UTF-8" ?>\n  <route>\n'
            xml += '    <wkt>' + wkt + '\n    </wkt>\n'
            xml += '  </route>\n'
            req.write(xml)
            return apache.OK
    

    #create an ordered list by way id:
    #[[way,[nodes, node2],{tags}] , [way2,...]]
    #first :
    wayid = int(routeWays[1].split(',')[1])
    nodeid = int(routeWays[0].split(',')[0])
    try: tags = data.ways[wayid]['tags']
    except: tags = {}
    wayDict = [[wayid,[nodeid],tags]]
    
    for i in range(2,len(routeWays)):
        wayid = int(routeWays[i].split(',')[1])
        nodeid = int(routeWays[i-1].split(',')[0])
        try: tags = data.ways[wayid]['tags']
        except: tags = {}
        if (wayid != wayDict[-1][0]) & (wayid != 0):
            print wayid
            wayDict.append([wayid,[nodeid],tags])
        elif (wayDict[-1][1][-1] != nodeid):
            wayDict[-1][1].append(nodeid)
    # and last:
    wayDict[-1][1].append(int(routeWays[i].split(',')[0]))
    
    #extend the list with relations route=ski:
    #[[way,[nodes, node2],{tags},[[rel1, {tags}],[rel2, {tags}], ...] , [way2,...]]
    
    for way in wayDict:
        way.append([])
        for rel in data.relations:
            for tag in data.relations[rel]['tags']:
                if (tag == 'route'):
                    if ((data.relations[rel]['tags']['route'] == 'ski') or (data.relations[rel]['tags']['route'] == 'piste')):
                        if (way[0] in data.relations[rel]['n']):
                            way[3].append([rel,data.relations[rel]['tags']])
    print wayDict
      
    # keep only interesting tags
    interestingsKeys=['route', 'type', 'name' , 'color', 'website', \
    'colour', 'ref', 'operator', 'distance', 'length', \
    'piste:type', 'piste:grooming', 'piste:difficulty', 'piste:lit', \
    'piste:name', 'piste:status', 'piste:oneway', 'piste:abandoned']
    for way in wayDict:
        for key in way[2].keys():
            if key in interestingsKeys: pass
            else: way[2].pop(key)
        for i in range(len(way[3])):
                for key in way[3][i][1].keys():
                    if key in interestingsKeys: pass
                    else: way[3][i][1].pop(key)
            
            
    # concatenate similar ways
    outWayDict=[wayDict[0]]
    for i in range(1,len(wayDict)):
        way1=wayDict[i-1]
        way2=wayDict[i]
        flag= True
        if (way1[3] != way2[3]): # members of the same relation or not
            flag= False
        for key in way2[2].keys():
            try:
                if (way2[2][key] != way1[2][key]): flag= False
            except:
                pass
        if flag:
            outWayDict[-1][1].extend(way2[1]) #concatenate the nodes
        else:
            outWayDict.append(way2)

    # calculate length:
    for way in outWayDict:
        #print "way", way[0]
        length = 0
        for i in range (1,len(way[1])):
            lon1 = data.nodes[way[1][i]][1]
            lat1 = data.nodes[way[1][i]][0]
            lon2 = data.nodes[way[1][i-1]][1]
            lat2 = data.nodes[way[1][i-1]][0]
            length += linearDist(lat1, lon1, lat2, lon2)
            #print length
        way[2]['length']=str(length)
        #print "length",way[2]['length']

    # create the WKT LinseString:
    #wkt='LINESTRING('
    #for n in routeNodes:
        #wkt=wkt+str(data.nodes[int(n)][1])+ ' '+ str(data.nodes[int(n)][0]) +','
    #wkt=wkt[:-2]+')'
    
    # create the WKT MultilineString:
    wkt='MULTILINESTRING(('
    for line in routeNodes:
        for n in line:
            wkt=wkt+str(data.nodes[int(n)][1])+ ' '+ str(data.nodes[int(n)][0]) +','
        wkt=wkt[:-2]+'),('
    wkt=wkt[:-3]+'))'
    
    # create XML:
    xml = '<?xml version="1.0" encoding="UTF-8" ?>\n  <route>\n'
    xml += '    <wkt>' + wkt + '\n    </wkt>\n'
    xml += '    <route_topo>\n'
    
    for way in outWayDict:
        xml += '      <way id="'+ str(way[0]) +'">\n'
        for key in way[2]:
            xml += '        <tag k="'+ key.encode( "utf-8" ) +'">' \
                + way[2][key].encode( "utf-8" ) + '</tag>\n'
        for rel in way[3]:
            xml += '        <member_of id="'+ str(rel[0])+'">"\n'
            for rel_key in rel[1]:
                xml += '          <rel_tag k="'+ rel_key.encode( "utf-8" ) +'">' \
                    + rel[1][rel_key].encode( "utf-8" ) + '</rel_tag>\n'
            xml += '        </member_of>\n'
        xml += '      </way>\n'
    xml += '    </route_topo>\n'
    xml += '  </route>\n'
    
    print xml
    req.write(xml)
    return apache.OK
    
    

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

#!/usr/bin/python
#----------------------------------------------------------------
# load OSM data file into memory
#
#------------------------------------------------------
# Usage: 
#     data = LoadOsm(filename)
# or:
#     loadOsm.py filename.osm
#------------------------------------------------------
# Copyright 2007, Oliver White
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.    See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.    If not, see <http://www.gnu.org/licenses/>.
#------------------------------------------------------
# Changelog:
#    2007-11-04    OJW    Modified from pyroute.py
#    2007-11-05    OJW    Multiple forms of transport
#------------------------------------------------------
import sys, pdb
import os
from xml.sax import make_parser, handler
import xml
from util_binary import *
from struct import *

execfile(os.path.join(os.path.dirname(__file__), "weights.py"))

class LoadOsm(handler.ContentHandler):
    """Parse an OSM file looking for routing information, and do routing with it"""
    def __init__(self, filename, storeMap = 1):
        """Initialise an OSM-file parser"""
        self.routing = {}
        self.routeableNodes = {}
        self.nodes = {}
        self.ways = {}
        self.relations = {}
        self.storeMap = storeMap
        
        if(filename == None):
            return
        self.loadOsm(filename)
        
    def loadOsm(self, filename):
        if(not os.path.exists(filename)):
            print "No such data file %s" % filename
            return
        try:
            parser = make_parser()
            parser.setContentHandler(self)
            parser.parse(filename)
        except xml.sax._exceptions.SAXParseException:
            print "Error loading %s" % filename
        
    def report(self):
        """Display some info about the loaded data"""
        report = "Loaded %d nodes,\n" % len(self.nodes.keys())
        report = report + "%d ways, and...\n" % len(self.ways)
        report = report + " %d routes\n" % ( \
            len(self.routing.keys()))
        return(report)
        
    def savebin(self,filename):
        self.newIDs = {}
        
        f = open(filename,"wb")
        f.write(pack('L',len(self.nodes.keys())))
        count = 0
        for id, n in self.nodes.items():
            self.newIDs[id] = count
            f.write(encodeLL(n[0],n[1]))
            count = count + 1
            
        errors = 0
        data = self.routing.items()
        f.write(pack('L', len(data)))
        for fr, destinations in data:
            try:
                f.write(pack('L', self.newIDs[fr]))
            except KeyError:
                f.write(pack('L', 0))
                errors = errors + 1
                continue
            f.write(pack('B', len(destinations.keys())))
            for to, weight in destinations.items():
                try:
                    f.write(pack('Lf', self.newIDs[to], weight))
                except KeyError:
                    f.write(pack('Lf', 0, 0))
                    errors = errors + 1
            
        print "%d key errors" % errors
        f.close()
        
    def loadbin(self,filename):
        f = open(filename,"rb")
        n = unpack('L', f.read(4))[0]
        print "%u nodes" % n
        id = 0
        for i in range(n):
            lat,lon = decodeLL(f.read(8))
            #print "%u: %f, %f" % (id,lat,lon)
            id = id + 1

        numLinks = 0
        numHubs = unpack('L', f.read(4))[0]
        print numHubs
        for hub in range(numHubs):
            fr = unpack('L', f.read(4))[0]
            numDest = unpack('B', f.read(1))[0]
            for dest in range(numDest):
                to,weight = unpack('Lf', f.read(8))
                numLinks = numLinks + 1
            #print fr, to, weight
        print "    \"\" (%u segments)" % (numLinks)

        f.close()

    def startElement(self, name, attrs):
        """Handle XML elements"""
        if name in('node','way','relation'):
            
            self.tags = {}
            self.waynodes = []
            self.relationmembers= []
            self.id = int(attrs.get('id'))
            if name == 'node':
                """Nodes need to be stored"""
                id = int(attrs.get('id'))
                lat = float(attrs.get('lat'))
                lon = float(attrs.get('lon'))
                self.nodes[id] = (lat,lon)
            #if name == 'way':
                #self.id = int(attrs.get('id'))
        elif name == 'nd':
            """Nodes within a way -- add them to a list, they can be stored later with storemap"""
            self.waynodes.append(int(attrs.get('ref')))
        elif name == 'member':
            """Ways within a relation -- add them to a list, they can be stored later with storemap"""
            self.relationmembers.append(int(attrs.get('ref')))
            print attrs.get('ref')
        elif name == 'tag':
            """Tags - store them in a hash"""
            k,v = (attrs.get('k'), attrs.get('v'))
            if not k in ('created_by'):
                self.tags[k] = v
    
    def endElement(self, name):
        """Handle ways in the OSM data"""
        if name == 'way':
            
            # Store routing information
            last = -1
            for i in self.waynodes:
                if last != -1:
                    weight = 1
                    self.addLink(last, i, self.id)
                    self.addLink(i, last, self.id)
                last = i
            
            # Store map information
            if(self.storeMap):
                wayType = self.WayType(self.tags)
                self.ways[self.id] = { \
                    't':wayType,
                    'n':self.waynodes,
                    'tags':self.tags}
        if name == 'relation':
            if(self.storeMap):
                self.relations[self.id] = { \
                    'n':self.relationmembers,
                    'tags':self.tags}
    
    def addLink(self,fr,to, wayid):
        """Add a routeable edge to the scenario"""
        self.routeablefrom(fr)
        try:
            if to in self.routing[fr].keys():
                return
            self.routing[fr][to] = wayid
        except KeyError:
            self.routing[fr] = {to: wayid}

    def WayType(self, tags):
        value = tags.get('piste:type', '')
        return value
        
    def routeablefrom(self,fr):
        self.routeableNodes[fr] = 1

    def findNode(self,lat,lon):
        """Find the nearest node to a point.
        Filters for nodes which have a route leading from them"""
        maxDist = 1000
        nodeFound = None
        for id in self.routeableNodes.keys():
            if id not in self.nodes:
                print "Ignoring undefined node %s" % id
                continue
            n = self.nodes[id]
            dlat = n[0] - lat
            dlon = n[1] - lon
            dist = dlat * dlat + dlon * dlon
            if(dist < maxDist):
                maxDist = dist
                nodeFound = id
        return(nodeFound)
        
# Parse the supplied OSM file
if __name__ == "__main__":
    print "Loading data..."
    data = LoadOsm(sys.argv[1], True)
    print data.report()
    print "Saving binary..."
    data.savebin("data/routing.bin")
    print "Loading binary..."
    data2 = LoadOsm(None, False)
    data2.loadbin("data/routing.bin")
    print "Done"

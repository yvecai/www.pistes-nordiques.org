#!/usr/bin/env python
#import cgi
import urllib2
import cgi
import sys, os

fs = cgi.FieldStorage()
place = fs.getvalue('place','')
try:
    baseUrl = 'http://open.mapquestapi.com/nominatim/v1/search?format=xml&q='
    place = str(place).replace(" ","+")
    url= baseUrl+str(place)
    y = urllib2.urlopen(url)
    print "Content-Type: application/xml"
    print
    print y.read()
    y.close()
except Exception, E:
    print "Status: 500 Unexpected Error"
    print "Content-Type: text/plain"
    print 
    print "Some unexpected error occurred. Error text was:", E
    

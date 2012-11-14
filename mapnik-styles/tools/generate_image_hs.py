#!/usr/bin/python
#
# Generates a single large PNG image for a UK bounding box
# Tweak the lat/lon bounding box (ll) and image dimensions
# to get an image of arbitrary size.
#
# To use this script you must first have installed mapnik
# and imported a planet file into a Postgres DB using
# osm2pgsql.
#
# Note that mapnik renders data differently depending on
# the size of image. More detail appears as the image size
# increases but note that the text is rendered at a constant
# pixel size so will appear smaller on a large image.

import mapnik2
import sys, os

if __name__ == "__main__":
    
    mapfile='styles/hillshade.xml'
    map_uri = "image.png"

    #---------------------------------------------------
    #  Change this to the bounding box you want
    #
    #ll = (10.95,63.85, 11.05, 63.9)
    #ll = (10,63,11,64)
    ll = (6.8,46.8, 7.2, 47.2)
    #ll= (0,10,0,10)
    #---------------------------------------------------

    z = 10
    imgx = 200 * z
    imgy = 200 * z

    m = mapnik2.Map(imgx,imgy)
    mapnik2.load_map(m,mapfile)
    prj = mapnik2.Projection("+init=epsg:3857 +over")
    #prj = mapnik2.Projection("+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +no_defs +over")
    c0 = prj.forward(mapnik2.Coord(ll[0],ll[1]))
    c1 = prj.forward(mapnik2.Coord(ll[2],ll[3]))
    bbox = mapnik2.Box2d(c0.x,c0.y,c1.x,c1.y)
    #bbox=mapnik2.Box2d(-626172.1357121642,0,0,626172.1357121639)
    print c0, c1
    print bbox    
    m.zoom_to_box(bbox)
    im = mapnik2.Image(imgx,imgy)
    mapnik2.render(m, im)
    view = im.view(0,0,imgx,imgy) # x,y,width,height
    view.save(map_uri,'png256')

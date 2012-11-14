#!/usr/bin/python
import mapnik
import sys, os

if __name__ == "__main__":
    
    mapfile='offset-style/map.xml'
    map_uri = "../downloadable/image.png"

    #---------------------------------------------------
    #  Change this to the bounding box you want
    #
    #ll = (6.4,46.8, 6.5, 46.9)
    ll = (6.05,46.38, 6.12, 46.42)
    #ll= (-0.1,-0.1,0.1,0.1)
    #---------------------------------------------------

    z = 10
    imgx = 100 * z
    imgy = 100 * z

    m = mapnik.Map(imgx,imgy)
    mapnik.load_map(m,mapfile)
    prj = mapnik.Projection("+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +no_defs +over")
    c0 = prj.forward(mapnik.Coord(ll[0],ll[1]))
    c1 = prj.forward(mapnik.Coord(ll[2],ll[3]))
    bbox = mapnik.Box2d(c0.x,c0.y,c1.x,c1.y)
    #bbox=mapnik2.Box2d(-626172.1357121642,-7.081154551613622e-10,3.492459654808044e-10,626172.1357121639)
    print c0, c1
    m.zoom_to_box(bbox)
    im = mapnik.Image(imgx,imgy)
    mapnik.render(m, im)
    view = im.view(0,0,imgx,imgy) # x,y,width,height
    view.save(map_uri,'png')

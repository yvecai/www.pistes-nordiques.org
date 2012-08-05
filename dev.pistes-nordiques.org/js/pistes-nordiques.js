/*
    pistes-nordiques.js
    Javascript code for www.pistes-nordiques.org website
    Copyright (C) 2011  Yves Cainaud

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

*/

// INIT

    document.onkeydown = checkKey;

    // register 'enter' and 'esc' keyboard hit
    function checkKey(e) {
        var keynum;
        if (e) {
            keynum = e.which;
            if (keynum == undefined)
            {
            e.preventDefault();
            keynum = e.keyCode
            }
        }
        
        if(keynum == 27) {
            close_sideBarRight();
            close_sideBarLeft();
            clearRoute();
            $('routing').style.display='none';
            }
        if(keynum == 13) {
            // fires nominatim search
            nsearch(document.search.nom_search.value);
            }
    }
    
    function get_length(){
        var oRequest = new XMLHttpRequest();
        oRequest.open("GET",'data/ways_length.txt',false);
        oRequest.setRequestHeader("User-Agent",navigator.userAgent);
        oRequest.send()
        return oRequest.responseText;
    }
    
    function get_update(){
        var oRequest = new XMLHttpRequest();
        oRequest.open("GET",'data/update.txt',false);
        oRequest.setRequestHeader("User-Agent",navigator.userAgent);
        oRequest.send();
        var date=oRequest.responseText.split('T')[0];
        var H=oRequest.responseText.split('T')[1].split('\\')[0];
        var M=oRequest.responseText.split('T')[1].split('\\')[1];
        var DHM=date +' '+ H+M+'UTC';
        return DHM;
    }
    
    function stopRKey(evt) {
        // disable the enter key action in a form.
      var evt = (evt) ? evt : ((event) ? event : null);
      var node = (evt.target) ? evt.target : ((evt.srcElement) ? evt.srcElement : null);
      if ((evt.keyCode == 13) && (node.type=="text"))  {return false;}
    }

    function getWinHeight(){
          var myWidth = 0, myHeight = 0;
          if( typeof( window.innerWidth ) == 'number' ) {
            //Non-IE
            myWidth = window.innerWidth;
            myHeight = window.innerHeight;
          } else if( document.documentElement && ( document.documentElement.clientWidth || document.documentElement.clientHeight ) ) {
            //IE 6+ in 'standards compliant mode'
            myWidth = document.documentElement.clientWidth;
            myHeight = document.documentElement.clientHeight;
          } else if( document.body && ( document.body.clientWidth || document.body.clientHeight ) ) {
            //IE 4 compatible
            myWidth = document.body.clientWidth;
            myHeight = document.body.clientHeight;
          }
        return parseInt(myHeight);
    }

    function resize_divs() {
        document.getElementById('sideBarRight').style.height= getWinHeight()-25-110;
        document.getElementById('search_result').style.height= getWinHeight()-25-110-40;
        document.getElementById('snow_info').style.height= getWinHeight()-25-110-40;
        document.getElementById('add_link').style.height= getWinHeight()-25-110-40;
        document.getElementById('topo').style.height= getWinHeight()-25-110-40;
        document.getElementById('edit').style.height= getWinHeight()-25-110-40;
        document.getElementById('about').style.height= getWinHeight()-25-110-40;
        document.getElementById('help').style.height= getWinHeight()-25-110-40;
    }

    function page_init(){
            close_sideBarRight();
            maximize();
            //show_hints('zoom_hint');
            get_length();
            document.getElementById("status").style.display='block';
             $("status").innerHTML = '<b style="color:#FFFFFF;">'+_('loading...')+'</b>'; 
             $("status").style.backgroundColor = '#FF7800';
            document.getElementById("mode_radio2").checked=true;
            document.onkeypress = stopRKey; 
            updateZoom();
            resize_divs();
            window.onresize = function(){resize_divs();}
//resize_divs();
    }


//======================================================================
// MAP

    var lat=46.82084;
    var lon=6.39942;
    var zoom=2;//2
    var map;
    var pistesLayer;
    var highlightCtrl, selectCtrl;
    var mode;
    var linksLayer;
    var editLinkLayer;
    var draw_bbox;
    var t;
    var timer_is_on=0;
    var routingPoints=new Array();
    var routingGeom=new Array();
    var routingFeatures=new Array();
    var routingPointStyle = { 
        pointRadius: 6,
        fillColor: "#FFFFFF",
        fillOpacity: 0.5,
        strokeColor: "#000000",
        strokeWidth: 1,
        strokeOpacity: 1,
        graphicZIndex: 16
    };
    var routeStyle = { strokeColor: '#FFFFFF', 
                strokeDashstyle : 'dash',
                strokeLinecap : 'round',
                strokeOpacity: 1,
                graphicZIndex: 15,
                strokeWidth: 2
    };
// Style work for 'pistesLayerLowZoom'-----------------------------
    var pointStyle = new OpenLayers.Style(
        {pointRadius: "${radius}",
        fillColor: "#FF7800",
        fillOpacity: 0.5,
        strokeColor: "#FF7800",
        strokeWidth: 1,
        strokeOpacity: 0,
graphicName: "triangle"},
        {context: 
            { radius: function(feature) {
                    return Math.min(feature.attributes.count, 10) + 2;
                }
            }
        });
    // Style work for 'pisteslayer'-----------------------------
    mode='sign_color';
    var styleContext = {
        getColor: function(feature) {
            if ( feature.attributes['colour'] ) {
                return feature.attributes['colour'];
            } else if ( feature.attributes['color'] ) {
                return feature.attributes['color'];
            } else {    lontest = map.getCenter().lon;
                        if (map.getCenter().lon > -5000000) {
                            switch( feature.attributes['piste:difficulty'] ) {
                            case "novice": return "green";
                            case "easy": return "blue";
                            case "intermediate": return "red";
                            case "expert": 
                            case "advanced":
                            case "freestyle":
                            case "extreme": return "black";
                            default: return "#555555";}
                        } else { // North American Colors
                            switch( feature.attributes['piste:difficulty'] ) {
                            case "novice": return "green";
                            case "easy": return "green";
                            case "intermediate": return "blue";
                            case "expert": 
                            case "advanced":
                            case "freestyle":
                            case "extreme": return "black";
                            default: return "#555555";}
                        };
                };
        },
        getOpacity: function(feature) {
            if (mode == 'difficulty') {
                if (feature.attributes['route']) {return 0;}
                else {return 0.9;}
            }
            if (mode == 'sign_color') {
                if (feature.attributes['route']) {return 0.9;}
                else {return 0.5;}
            }
        },
        getZ: function(feature) {
            /*if (feature.attributes['piste:start'] == 'yes') 
            {return 13;}*/
            
            if (mode == 'difficulty') {
                if (feature.attributes['route']) {return 11;}
                else {return 12;}
            }
            if (mode == 'sign_color') {
                if (feature.attributes['route']) {return 12;}
                else {return 11;}
            }
        },
        /*getGraphic: function(feature) {
            if (feature.attributes['piste:start'] == 'yes') {
                return '../pistes-nordiques-backend/pics/Nordic_sign.png';}
            else {return '';}
        },*/
        getWidth: function(feature) {
            if (mode == 'difficulty') {
                if (feature.attributes['route']) {return 2;}
                else {return 3;}
            }
            if (mode == 'sign_color') {
                if (feature.attributes['route']) {return 3;}
                else {return 2;}
            }
        }
        
    };
    var styleTemplate = {
        strokeColor: "${getColor}", // using context.getColor(feature)
        strokeOpacity: "${getOpacity}",//0.6,
        strokeWidth: "${getWidth}",
        graphicZIndex: "${getZ}",
        fillOpacity: 0,
graphicName: "triangle"
    };
    var pisteStyle = new OpenLayers.Style(styleTemplate, {context: styleContext});
    var pisteStyles = new OpenLayers.StyleMap({
            'default': pisteStyle,
            'select': pisteStyle,
            'highlight': new OpenLayers.Style({
                strokeWidth: 5,
                graphicZIndex: 15,
                strokeOpacity: 0.9
            })
    });
        
    // a dummy proxy script is located in the directory to allow use of wfs
    OpenLayers.ProxyHost = "cgi/proxy.cgi?url=";
    
    // Redirect permalink
    if (location.search != "") {
        //?zoom=13&lat=46.82272&lon=6.87183&layers=B0TT
        var x = location.search.substr(1).split("&")
        for (var i=0; i<x.length; i++)
        {
            if (x[i].split("=")[0] == 'zoom') {zoom=x[i].split("=")[1];}
            if (x[i].split("=")[0] == 'lon') {lon=x[i].split("=")[1];}
            if (x[i].split("=")[0] == 'lat') {lat=x[i].split("=")[1];}
        }
    }
    
    function updateZoom() {
        $('zoom').innerHTML= map.getZoom();
    }
    
    function zoom_to_point(features) {
        var c = features[0].geometry.getCentroid()
        var lL = new OpenLayers.LonLat(c.x, c.y)
        map.setCenter (lL, map.getZoom()+4);
    }
    
    function onFeatureHovered(selectedFeature,xy) {
              
        selectWay(selectedFeature.osm_id);
        
    }
    
    function onFeatureSelected(selectedFeature,xy) {
        
        document.getElementById('clearRouteControl').style.display='none'; // hide controls until the elements are drawn
        document.getElementById('removePointControl').style.display='none';
        // find the nearest point on the selected geometry
        var selectedPoint = new OpenLayers.Geometry.Point(xy.lon,xy.lat);
        nearestPoint = selectedFeature.geometry.distanceTo(selectedPoint, {details : true});
        routingPoint = new OpenLayers.LonLat(nearestPoint.x0, nearestPoint.y0).transform(new OpenLayers.Projection("EPSG:900913"), new OpenLayers.Projection("EPSG:4326"));
        routingPoints.push(routingPoint);
        
        routingGeom.push(new OpenLayers.Geometry.Point(nearestPoint.x0, nearestPoint.y0));
        routingFeatures.push(new OpenLayers.Feature.Vector(routingGeom[routingGeom.length -1], null, routingPointStyle));
        pistesLayer.addFeatures(routingFeatures);
        
        if (routingPoints.length >1 ) {
            $("routingstatus").innerHTML = '<b style="color:#FFFFFF;">'+_('routing...')+'</b>'; 
            $("routingstatus").style.backgroundColor = '#FF7800';
        }
        else {
            $("routingstatus").innerHTML = '<i style="color:#000000;">'+_('select_next')+'</i>'; 
            $("routingstatus").style.backgroundColor = '#FFFFFF';
        }
        document.getElementById('routing').style.display='block';
        document.getElementById('RoutingTitle').innerHTML='&nbsp;'+_('routing_title');
        
        selectWay(selectedFeature.osm_id);
        
        if (routingPoints.length >1) {
            var q = '';
            for (pt in routingPoints) {
                q = q + routingPoints[pt].lat + ' ' +routingPoints[pt].lon + ',';
            };
            
            var XMLHttp = new XMLHttpRequest();
            XMLHttp.open("GET", 'cgi/routing/routing.py/' + q);
            XMLHttp.onreadystatechange= function () {
                if (XMLHttp.readyState == 4) {
                    // image hints: 
                    document.getElementById('clear_all').title=_('clear_all');
                    document.getElementById('remove_one').title=_('clear_last'); 
                    document.getElementById('clearRouteControl').style.display='inline'; // hide controls until the elements are drawn
                    document.getElementById('removePointControl').style.display='inline';
                    
                    var responseXML = XMLHttp.responseXML;
                    var routeWKT = getNodeText(responseXML.getElementsByTagName('wkt')[0])
                    var routeDesc = responseXML.getElementsByTagName('route_topo')[0];
                    
                    if (routeWKT.length > 30) {
            $("routingstatus").innerHTML = '<i style="color:#000000;">'+_('select_next')+'</i>'; 
            $("routingstatus").style.backgroundColor = '#FFFFFF';
                        routeInfos(routeDesc);
                        trace_route(routeWKT);
                        
                    }
                    else {
                        $("routingstatus").innerHTML = '<b style="color:#FFFFFF;">'+_('no_route')+'</b>'; 
                        $("routingstatus").style.backgroundColor = '#FF7800';
                        }
                    }
                }
            XMLHttp.send();
        }
    }
    
    function getNodeText(node) {
        //workaround for browser limit to 4096 char in xml nodeValue
        var r = "";
        for (var x = 0;x < node.childNodes.length; x++) {
            r = r + node.childNodes[x].nodeValue;
        }
        return r;
    }
    
    function trace_route(wktroute) {
        // request the elevation profile
        var XMLHttp = new XMLHttpRequest();
        XMLHttp.open("POST", "cgi/profile/getProfilePic.py/handle");
        XMLHttp.onreadystatechange= function () {
            if (XMLHttp.readyState == 4) {
                document.getElementById('topo_profile').innerHTML=XMLHttp.responseText;
            }
        }
        XMLHttp.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        
        XMLHttp.send(wktroute);
        document.getElementById('topo_profile').innerHTML='Loading ...';
        
        
        var routeT = new OpenLayers.Geometry.fromWKT(wktroute);
        var route900913 = routeT.transform(new OpenLayers.Projection("EPSG:4326"), new OpenLayers.Projection("EPSG:900913"));
        routingGeom.push(route900913);
        routingFeatures.push(new OpenLayers.Feature.Vector(routingGeom[routingGeom.length -1], null, routeStyle));
        pistesLayer.addFeatures(routingFeatures);
        
        
    }
    
    function redrawRoute() {
        pistesLayer.destroyFeatures(routingFeatures);
        routingFeatures =new Array();
        for (geom in routingGeom) {
            if (routingGeom[geom].CLASS_NAME == "OpenLayers.Geometry.Point") {
            routingFeatures.push(new OpenLayers.Feature.Vector(routingGeom[geom],
                                    null, routingPointStyle));
            }
            if ((routingGeom[geom].CLASS_NAME == "OpenLayers.Geometry.LineString") 
            || (routingGeom[geom].CLASS_NAME == "OpenLayers.Geometry.MultiLineString")){
            routingFeatures.push(new OpenLayers.Feature.Vector(routingGeom[geom],
                                    null,routeStyle));
            }
        }
        pistesLayer.addFeatures(routingFeatures);
    }
            
    function clearRoute() {
        routingPoints =new Array();
        pistesLayer.destroyFeatures(routingFeatures);
        routingFeatures =new Array();
        routingGeom =new Array();
    }
    
    function removeLastRoutePoint() {
        if (routingPoints.length <= 1) {clearRoute();}
        else {
            if (routingGeom[routingGeom.length-1].CLASS_NAME == "OpenLayers.Geometry.Point") {
                routingGeom.pop(routingGeom.length-1);
            }
            else if ((routingGeom[routingGeom.length-1].CLASS_NAME == "OpenLayers.Geometry.LineString") 
            || (routingGeom[routingGeom.length-1].CLASS_NAME == "OpenLayers.Geometry.MultiLineString")) {
                routingGeom.pop(routingGeom.length-1);
                routingGeom.pop(routingGeom.length-1);
            }
            routingPoints.pop(routingPoints.length -1);
            redrawRoute();
        }
    }
    
    function changeStyle(modevalue) {
        mode=modevalue;
        pistesLayer.redraw();
        pistesLayerLowres.redraw();
    }
    
    function list_relations(features) {
        var relationList=[]
        for (f in features) {
            var rel = {}
            if (features[f].onScreen() ) {
                if (features[f].attributes['route'])  {
                    if (features[f].attributes['name'])
                    {rel['name']=features[f].attributes['name'];}
                    else {rel['name']='id:'+features[f].id;}
                    
                    if (features[f].attributes['color'])
                    {rel['color']=features[f].attributes['color'];}
                    else if (features[f].attributes['colour'])
                    {rel['color']=features[f].attributes['colour'];}
                    else {rel['color']="#777777"}
                    if (features[f].osm_id)
                    {rel['id']=features[f].osm_id;}
                }
            }
            if (rel['name']) {relationList.push(rel);};
        }
        document.tools.relations.length= 0;
        for (var t=0;t<relationList.length;t++) {
            l=document.tools.relations.length
            document.tools.relations.options[l]=
            new Option(relationList[t]['name'], relationList[t]['id'], true, false)
            document.tools.relations.options[l].style.color=relationList[t]['color']
        }
    }
    
    function selectWay(id) {
        for (f in pistesLayer.features) {
            highlightCtrl.unhighlight(pistesLayer.features[f]);
            if (pistesLayer.features[f].osm_id == id) {
                //pistesLayer.features[f].renderIntent='highlight';
                highlightCtrl.highlight(pistesLayer.features[f]);
                feature_infos(pistesLayer.features[f]);
            }
        }
    }
    
    function selectRelation(id) {
        for (f in pistesLayer.features) {
            highlightCtrl.unhighlight(pistesLayer.features[f]);
            if (pistesLayer.features[f].osm_id == id) {
                //pistesLayer.features[f].renderIntent='highlight';
                highlightCtrl.highlight(pistesLayer.features[f]);
                
                
                    var objBounds = pistesLayer.features[f].geometry.getBounds();
                    var x = (objBounds.left+objBounds.right )/2;
                    var y = (objBounds.top +objBounds.bottom)/2;
                    CENTER = [x, y];
                    map.setCenter(new OpenLayers.LonLat(CENTER[0], CENTER[1]), map.getZoom()); 
                
                
                feature_infos(pistesLayer.features[f]);
            }
        }
    }
    
    function highlightRelation(id) {
        for (f in pistesLayer.features) {
            highlightCtrl.unhighlight(pistesLayer.features[f]);
            if (pistesLayer.features[f].osm_id == id) {
                //pistesLayer.features[f].renderIntent='highlight';
                highlightCtrl.highlight(pistesLayer.features[f]);
            }
        }
    }
    
    function osm_getTileURL(bounds) {
        var res = this.map.getResolution();
        var x = Math.round((bounds.left - this.maxExtent.left) / (res * this.tileSize.w));
        var y = Math.round((this.maxExtent.top - bounds.top) / (res * this.tileSize.h));
        var z = this.map.getZoom();
        var limit = Math.pow(2, z);
    
        if (y < 0 || y >= limit) {
            return OpenLayers.Util.getImagesLocation() + "404.png";
        } else {
            x = ((x % limit) + limit) % limit;
            return this.url + z + "/" + x + "/" + y + "." + this.type;
        }
    }
    
    function GTOPO30_getTileURL(bounds) {
            var res = this.map.getResolution();
            var x = Math.round((bounds.left - this.maxExtent.left) / (res * this.tileSize.w));
            var y = Math.round((bounds.bottom - this.tileOrigin.lat) / (res * this.tileSize.h));
            var z = this.map.getZoom();
            var limit = Math.pow(2, z);
            //if (mapBounds.intersectsBounds( bounds ) && z >= mapMinZoom && z <= mapMaxZoom ) {
            if ((y >= 0 && y < limit) && (x >= 0 && x < limit)) {
               return "gtopo30/" + z + "/" + x + "/" + y + "." + this.type;
            } else {
               return "gtopo30/none.png";
            }
        }   
    
    function SRTM_getTileURL(bounds) {
            var res = this.map.getResolution();
            //8399737
            var x = Math.round((bounds.left - this.maxExtent.left) / (res * this.tileSize.w));
            var y = Math.round((bounds.bottom - this.tileOrigin.lat) / (res * this.tileSize.h));
            var z = this.map.getZoom();
            var limit = Math.pow(2, z);
            //if (mapBounds.intersectsBounds( bounds ) && z >= mapMinZoom && z <= mapMaxZoom ) {
            if ((y >= 0 && y < limit) && (x >= 0 && x < limit) && (bounds.top < 8399737 && bounds.bottom > -8399737)) {
               return this.url + "/" + z + "/" + x + "/" + y + "." + this.type;
            } else {
               return "http://www.pistes-nordiques.org/GTOPO30/none.png";
            }
        }

    function get_tms_url(bounds) {
            var res = this.map.getResolution();
            var x = Math.round((bounds.left - this.maxExtent.left) / (res * this.tileSize.w));
            var y = Math.round((bounds.bottom - this.tileOrigin.lat) / (res * this.tileSize.h));
            var z = this.map.getZoom();
            var limit = Math.pow(2, z);
            //if (mapBounds.intersectsBounds( bounds ) && z >= mapMinZoom && z <= mapMaxZoom ) {
          if (y < 0 || y >= limit)
            {
              return null;
            }
          else
            {
              return this.url + z + "/" + x + "/" + y + "." + this.type; 
            }
        }  
    function permalink2Args() {
        var args = 
            OpenLayers.Control.Permalink.prototype.createParams.apply(
                this, arguments
            );
        args['editor'] = 'potlatch2';
        return args;
    }
    function permalink1Args() {
        var args = 
            OpenLayers.Control.Permalink.prototype.createParams.apply(
                this, arguments
            );
        args['editor'] = 'potlatch';
        return args;
    }

    function toggleRelief() {
        if (window.map.layers[4].visibility) {
            window.map.layers[4].visibility=false;
            window.map.layers[4].clearGrid();
        }
        else {
            window.map.layers[4].visibility=true;
            window.map.layers[4].redraw();
        }
    }
    function toggleContours() {
        if (window.map.layers[5].visibility) {
            window.map.layers[5].visibility=false;
            window.map.layers[5].clearGrid();
        }
        else {
            window.map.layers[5].visibility=true;
            window.map.layers[5].redraw();
        }
    }
    
    function closeReliefContours() {
            window.map.layers[3].visibility=false;
            window.map.layers[4].visibility=false;
            window.map.layers[3].clearGrid();
            window.map.layers[4].clearGrid();
    }

    function map_init(){
        map = new OpenLayers.Map ("map", {
        controls:[
            new OpenLayers.Control.PanZoomBar(),
            //to avoid shift+right click annoyance:
            new OpenLayers.Control.Navigation({'zoomBoxEnabled' : false }),
            //new OpenLayers.Control.LayerSwitcher(),
            //new OpenLayers.Control.Attribution(),
            new OpenLayers.Control.Permalink("permalink.pistes-nordiques","http://www.pistes-nordiques.org"),
            new OpenLayers.Control.MousePosition()],
            maxExtent: new OpenLayers.Bounds(-20037508.34,-20037508.34,20037508.34,20037508.34),
            maxResolution: 156543.0399,
            numZoomLevels: 19,
            units: 'm',
            projection: "EPSG:4326",
            displayProjection: new OpenLayers.Projection("EPSG:4326")
        } );
        
// layer 0
        layerMapnik = new OpenLayers.Layer.OSM.Mapnik("Mapnik");
        map.addLayer(layerMapnik);
// layer 1
        layerTilesAtHome = new OpenLayers.Layer.OSM.Osmarender("Osmarender");
        map.addLayer(layerTilesAtHome);
// layer 2
        var layerMapquest = new OpenLayers.Layer.OSM( 
                "OpenMapquest", 
                ["http://otile1.mqcdn.com/tiles/1.0.0/osm/"],
                {type:'png',
                getURL: osm_getTileURL,
                transitionEffect: 'resize',
                displayOutsideMaxExtent: true, 
                opacity: 1 }, {'buffer':1} );
        map.addLayer(layerMapquest);
// layer 3
        layerGTOPO30 = new OpenLayers.Layer.TMS( "GTOPO30", "",{   
                    type: 'png', getURL: GTOPO30_getTileURL, alpha: true, 
                    isBaseLayer: false, visibility: true, maxScale: 3000000
                });
        //map.addLayer(layerGTOPO30);
// layer 4
        layerSRTM = new OpenLayers.Layer.TMS( "SRTM", "cgi/srtm/srtm_resample.py/handle",{ 
                    type: 'png', getURL: SRTM_getTileURL, alpha: true, 
                    buffer: 0,
                    isBaseLayer: false, 
                    opacity: 0.5,minScale: 3000000, visibility: true
                });
        map.addLayer(layerSRTM);
// layer 5
        layerContours = new OpenLayers.Layer.XYZ("Contour",
        "cgi/contours/contour.py/",{
                getURL: get_tms_url,
                numZoomLevels: 18, isBaseLayer: false,
                transparent: true, buffer: 0,
                minScale: 3000000, visibility: true 
            });
        map.addLayer(layerContours);
                    
        // Declaration of 'pistesLayerLowZoom'-----------------------------
// layer 6
        var pistesLayerLowZoom = new OpenLayers.Layer.Vector("Pistes_Low-zoom", {
            strategies: [
            new OpenLayers.Strategy.Fixed(),
            new OpenLayers.Strategy.Cluster()
            ],
            protocol: new OpenLayers.Protocol.HTTP({
                    url:"data/nordic_1npw.osm",
                    format: new OpenLayers.Format.OSM()
            }),
            projection: new OpenLayers.Projection("EPSG:4326"),
            maxScale: 1000000,
            styleMap: new OpenLayers.StyleMap({
                "default": pointStyle,
                "highlight": new OpenLayers.Style({fillColor: "#4477EE",strokeColor: "#4477EE"})
            })
        });
        map.addLayers([pistesLayerLowZoom])
        
        // Declaration of 'pisteslayerlowres'-----------------------------
// layer 7
        pistesLayerLowres = new OpenLayers.Layer.Vector("Pistes", {
            strategies: [new OpenLayers.Strategy.BBOX()],
            styleMap: pisteStyles,
            protocol: new OpenLayers.Protocol.HTTP({
                    url:"cgi/osmosis-lowres/osmosis_handle.py/",
                    sync: true,
                    format: new OpenLayers.Format.OSM({
                    externalProjection:new OpenLayers.Projection("EPSG:4326"),
                    relationsParsers:{
                        route: OpenLayers.Format.OSM.routeParser
                        }
                        })
            }),
            projection: new OpenLayers.Projection("EPSG:4326"),
            minScale: 1000000,
            maxScale: 100000,
            rendererOptions: {yOrdering: true, zIndexing: true} //necessary for graphicZIndex to work
        });
        map.addLayers([pistesLayerLowres]);
        // Declaration of 'pisteslayer'-----------------------------
// layer 8
        pistesLayer = new OpenLayers.Layer.Vector("Pistes", {
            strategies: [new OpenLayers.Strategy.BBOX()],
            styleMap: pisteStyles,
            protocol: new OpenLayers.Protocol.HTTP({
                    url:"cgi/osmosis/osmosis_handle.py/",
                    sync: true,
                    format: new OpenLayers.Format.OSM({
                    externalProjection:new OpenLayers.Projection("EPSG:4326"),
                    relationsParsers:{
                        route: OpenLayers.Format.OSM.routeParser
                        }
                        })
            }),
            projection: new OpenLayers.Projection("EPSG:4326"),
            minScale: 100000,
            rendererOptions: {yOrdering: true, zIndexing: true} //necessary for graphicZIndex to work
        });
        map.addLayers([pistesLayer]);
        
        // EVENTS --------------------------------------------------
        pistesLayerLowres.events.register("loadstart", null, function() {
             $("status").innerHTML = '<b style="color:#FFFFFF;">'+_('loading...')+'</b>'; 
             $("status").style.backgroundColor = '#FF7800';
             })
        pistesLayerLowres.events.register("loadend", null, function() {
             $("status").innerHTML = '<i style="color:#000000;"></i>';
             $("status").style.backgroundColor = '#FFFFFF';
             redrawRoute();
             list_relations(pistesLayer.features);
             })
        pistesLayer.events.register("loadstart", null, function() {
             $("status").innerHTML = '<b style="color:#FFFFFF;">'+_('loading...')+'</b>'; 
             $("status").style.backgroundColor = '#FF7800';
             })
        pistesLayer.events.register("loadend", null, function() {
             $("status").innerHTML = '<i style="color:#000000;"></i>';
             $("status").style.backgroundColor = '#FFFFFF';
             redrawRoute();
             list_relations(pistesLayer.features);
             })
        pistesLayerLowZoom.events.register("loadstart", null, function() {
             $("status").innerHTML = '<b style="color:#FFFFFF;">'+_('loading_low_zoom')+'</b>'; 
             $("status").style.backgroundColor = '#FF7800'; 
             })
        pistesLayerLowZoom.events.register("loadend", null, function() {
             $("status").innerHTML = '<i style="color:#000000;"></i>';
             $("status").style.backgroundColor = '#FFFFFF';
             })
        map.events.register("zoomend", null, function() {
            list_relations(pistesLayer.features);
            updateZoom();
            document.getElementById('warning').style.display='none';
            // hide zoom-dependent content:
            if (document.getElementById('snow_info').style.display == 'inline'
            || document.getElementById('edit').style.display == 'inline') {
                document.getElementById('snow_info').style.display='none';
                document.getElementById('edit').style.display='none';
                document.getElementById('sideBarRight').style.display='none';};
            //closeReliefContours();
            
         });
        
        // Add higlight and select controls to vector features -----
        highlightCtrl = new OpenLayers.Control.SelectFeature(pistesLayer, {
            hover: true,
            clickout: true,
            highlightOnly: true,
            renderIntent: 'highlight',
            overFeature: function(feature){
                    if (timer_is_on)
                      {
                      timer_is_on=0;
                      clearTimeout(t);
                      }
                    
                    highlightCtrl.unselectAll();
                    selectXY = map.getLonLatFromViewPortPx(this.handlers.feature.evt.xy);
                    onFeatureHovered(feature, selectXY);
                },
            outFeature: function(feature){
                    highlightCtrl.unhighlight(feature);
                    t = setTimeout("close_sideBarLeft();",500);
                    timer_is_on=1;
                }
        });
        selectCtrl = new OpenLayers.Control.SelectFeature(pistesLayer,{
            clickout: true,
            mutiple: false,
            onSelect: function(feature){
                    selectXY = map.getLonLatFromViewPortPx(this.handlers.feature.evt.xy);
                    onFeatureSelected(feature, selectXY);
                    selectCtrl.unselectAll();
                }
            });
        selectCtrl.handlers.feature.stopDown = false; // otherwise we have a confilct with pan
        highlightCtrl.handlers.feature.stopDown = false; 
        map.addControl(highlightCtrl);
        map.addControl(selectCtrl);
        highlightCtrl.activate();
        selectCtrl.activate();
        
        // Add higlight and select controls to vector features -----
        var highlightCtrl2 = new OpenLayers.Control.SelectFeature(pistesLayerLowZoom, {
            hover: true,
            highlightOnly: true,
            renderIntent: 'highlight'
        });
        var selectCtrl2 = new OpenLayers.Control.SelectFeature(pistesLayerLowZoom,
            {clickout: true,
            mutiple: false
            });
        map.addControl(highlightCtrl2);
        map.addControl(selectCtrl2);
        highlightCtrl2.activate();
        selectCtrl2.activate();
        
        pistesLayerLowZoom.events.on({
            'featureselected': function(e) {
                zoom_to_point(this.selectedFeatures);
    
            }
        });
        
        // Add a layer to draw vector features -----
// layer 9
        editLinkLayer = new OpenLayers.Layer.Vector("Links Layer");
        map.addLayers([editLinkLayer]);
        draw_box= new OpenLayers.Control.DrawFeature(
            editLinkLayer,
            OpenLayers.Handler.RegularPolygon,
                            {
                            handlerOptions:
                                {side: 4,
                                snapAngle: 0,
                                irregular: true},
                            featureAdded: function(feature) {link_popup(feature);}
                            }
            );
        map.addControl(draw_box);
        
        //################################
        var lonLat = new OpenLayers.LonLat(lon, lat).transform(
                new OpenLayers.Projection("EPSG:4326"),
                new OpenLayers.Projection("EPSG:900913"));
        map.setCenter (lonLat, zoom); 
        // map.setCenter moved after the strategy.bbox, otherwise it won't load the wfs layer at first load
        var permalink_potlatch = new OpenLayers.Control.Permalink("permalink.potlatch",
        "http://www.openstreetmap.org/edit",{'createParams': permalink1Args});
        map.addControl(permalink_potlatch);
        var permalink_potlatch2 = new OpenLayers.Control.Permalink("permalink.potlatch2",
        "http://www.openstreetmap.org/edit",{'createParams': permalink2Args});
        map.addControl(permalink_potlatch2);
        
        //map.addControl(new OpenLayers.Control.Permalink("permalink.pistes-nordiques",
        //"http://www.pistes-nordiques.org"));
        // moved aftermap.setCenter, otherwise permalink == map.setCenter
// layer 10
        var DiffStyle = new OpenLayers.Style({
            externalGraphic: "./pics/hot16.png",
            graphicWidth: 16,
            graphicHeight: 16
            }, {
                context: { 
                    radius2: function(feature) {
                        return Math.min(feature.attributes.count, 10) + 2;
                        }
                }
            });

    var DiffLayer=new OpenLayers.Layer.Vector("Diffs", {
                strategies: [new OpenLayers.Strategy.Fixed(),
                            new OpenLayers.Strategy.Cluster()],
                protocol: new OpenLayers.Protocol.HTTP({
                    url: "data/daily.tsv",
                    format: new OpenLayers.Format.Text()
                }),
                styleMap: new OpenLayers.StyleMap({
                "default": DiffStyle
            })
                });
    map.addLayers([DiffLayer]);
    }

//======================================================================
// INTERFACE OPERATION
//ifce () {
    var response
    function close_sideBarRight() {
        document.getElementById('edit').style.display='none';
        document.getElementById('warning').style.display='none';
        document.getElementById('snow_info').style.display='none';
        document.getElementById('search_result').style.display='none';
        document.getElementById('about').style.display='none';
        document.getElementById('help').style.display='none';
        document.getElementById('add_link').style.display='none';
        document.getElementById('topo').style.display='none';
        document.getElementById('sideBarRight').style.display='none';
        close_edit_links();
    }
    function close_sideBarLeft() {
        document.getElementById('warning').style.display='none';
        document.getElementById('feature_infos').style.display='none';
        document.getElementById('sideBarLeft').style.display='none';
    }
    function show_about() {
        
        document.getElementById('sideBarRight').style.display='inline';
        url = 'iframes/about.'+iframelocale+'.html';
        content = get_page(url).replace('**update**',get_update()).replace('**length**',get_length());
        document.getElementById('about').innerHTML = content;
        document.getElementById('about').style.display='inline';
        document.getElementById('sideBarRightTitle').innerHTML='&nbsp;'+_('about');
    }
    function get_page(url){
        var oRequest = new XMLHttpRequest();
        oRequest.open("GET",url,false);
        oRequest.setRequestHeader("User-Agent",navigator.userAgent);
        oRequest.send()
        response = oRequest.responseText;
        response = response.replace("../","")
        return response;
    }
    function show_help() {
        
        url = 'iframes/quickhelp.'+iframelocale+'.html';
        content = get_page(url);
        document.getElementById('help').innerHTML = content;
        document.getElementById('help').style.display='block';
        document.getElementById('sideBarRightTitle').innerHTML='&nbsp;'+_('help');
        document.getElementById('sideBarRight').style.display='block';
    }
    function show_profile() {
        close_sideBarRight();
        document.getElementById('sideBarRight').style.display='inline';
        document.getElementById('topo').style.display='inline';
        document.getElementById('sideBarRightTitle').innerHTML='&nbsp;'+_('TOPO');
    }
    function show_feature_info() {
        close_sideBarLeft();
        document.getElementById('sideBarLeft').style.display='inline';
        document.getElementById('feature_infos').style.display='inline';
        document.getElementById('sideBarLeftTitle').innerHTML='&nbsp;'+_('PISTE');
    }
    function show_edit() {
        
        if (map.getZoom() > 12) {
            document.getElementById('sideBarRight').style.display='inline';
            document.getElementById('edit').style.display='inline';
            document.getElementById('sideBarRightTitle').innerHTML='&nbsp;'+_('edit').replace('<br/>',' ');
        }
        else {
            //document.getElementById('sideBar').style.display='inline';
            document.getElementById('warning').style.display='block';
            document.getElementById('warning-text').innerHTML='&nbsp;'+_('zoom_in');
            
        }
    }
    function maximize (){
        document.getElementById('minimized').style.display='none';
        document.getElementById('menu').style.display='block';
    }
    function minimize (){
        document.getElementById('minimized').style.display='block';
        document.getElementById('menu').style.display='none';
    }
//}
//======================================================================
// LINKS
//links () {
    function load_links (){
        linksLayer = new OpenLayers.Layer.Vector("Links", {
            strategies: [new OpenLayers.Strategy.Fixed()],
            protocol: new OpenLayers.Protocol.HTTP({
                    url:"./cgi/links/data/link_db.osm",
                    format: new OpenLayers.Format.OSM()
            }),
            projection: new OpenLayers.Projection("EPSG:4326")
        });
        map.addLayers([linksLayer]);
        linksLayer.setVisibility(false);
        linksLayer.events.register("loadend", null, function() {
             setTimeout("show_links()",1000);
             });
        // we need to let a bit of time for features to be available ...
        
    }
    function show_links (){
        document.getElementById('sideBarRight').style.display='inline';
        document.getElementById('snow_info').style.display='inline';
        document.getElementById('sideBarRightTitle').innerHTML='&nbsp;'+_('snow_report').replace('<br/>',' ');
        html='';
        html += '<p><ul>';
        for (feat in linksLayer.features) {
            linksLayer.features[feat].geometry.getBounds();
            if (linksLayer.features[feat].onScreen()) {
                db_link = linksLayer.features[feat].attributes['link'];
                db_link_name = linksLayer.features[feat].attributes['link_name'];
                html +='<li><a href="'+db_link+'" target="blank">'+db_link_name+'</a>';
                html +='<a onclick="report_link(\''+escape(db_link)+'\')">'
                     +'<i style="font-size: 0.65em; color: #AAAAAA; ">&nbsp;- &nbsp;'
                     +_('report_link')+'</i></a></li>';
            }
        }
        html +='</ul></p>';
        html +='<a onclick="show_editlinks()" ><b>'+_('Add_your_link_here')+'</b></a>'
        document.getElementById('snow_info').innerHTML = html;
        map.removeLayer(linksLayer);
    }
    function show_editlinks() {
        close_sideBarRight();
        if (map.getZoom() > 8) {
            document.getElementById('sideBarRight').style.display='inline';
            document.getElementById('add_link').style.display='inline';
            edit_links();
        }
        else {
            document.getElementById('warning').style.display='block';
            document.getElementById('warning-text').innerHTML='&nbsp;'+_('zoom_in');
        }

    }
    function edit_links() {

        draw_box.activate();
        var html_content='<b>&nbsp;'+_('Add_link')+':</b>';
        html_content += '<p><b>'+_('rectangle_draw')+'</b></p>'
        +'<div id="bbox_selected"></div>'
        +'<form id="links" name="links" action="">'
        +'<p>'+_('link_name')
        +'<br/><input style="margin-left:15;border: 1px solid #CCCCCC;width:150;" type="text" name="link_name" value="website name"/>'+'</p>'
        +'<p>'+_('link_link')
        +'<br/><input style="margin-left:15;border: 1px solid #CCCCCC;width:250;" type="text" name="link" value="http://"/>'+'</p>'
        +'<p>'+_('link_email')
        +'<br/><input style="margin-left:15;border: 1px solid #CCCCCC;" type="text" name="link_email"/>'+'<br/>'
        +_('link_email_disclaimer')+'</p>'
        +'<p align="right"><b>'
        +'<a onclick="submit_link()">'+_('link_send')+'</a>'
        +'</b></p>'
        +'<p><i style="text-align: justify;">'+_('link_policy')+'</i></p>'
        document.getElementById('add_link').innerHTML=html_content;
    }
    function link_popup(actual_feature) {
        for (f in editLinkLayer.features) {
            if(editLinkLayer.features[f] != actual_feature) { editLinkLayer.features[f].destroy(); }
        }
        var link_bbox=actual_feature.geometry.bounds.transform(
            new OpenLayers.Projection("EPSG:900913"), new OpenLayers.Projection("EPSG:4326")).toBBOX();
        if ((Math.abs(link_bbox.split(",")[3] - link_bbox.split(",")[1]) > 0.2) ||
          (Math.abs(link_bbox.split(",")[2] - link_bbox.split(",")[0]) > 0.2)) {
            $("bbox_selected").innerHTML= link_bbox;
        }
        
        else {$("bbox_selected").innerHTML= link_bbox;}
        
        
        // XX check here for extent < 1°
        // XX check here for features in bbox

    }
    function report_link(reported) {
        url="cgi/links/submit_link.py/req";
        oRequest = new XMLHttpRequest();
        oRequest.open("GET",url+'?submit=report=='+reported+'==report@pistes-nordiques.org==report',false);
        oRequest.setRequestHeader("User-Agent",navigator.userAgent);
        oRequest.send();
        $("status").innerHTML= 'Request sent';
    }
    function submit_link() {
        url="cgi/links/submit_link.py/req";
        var bbox= $("bbox_selected").innerHTML;
        var link_sub= escape(document.links.link.value);
        var email= escape(document.links.link_email.value);
        var link_name= escape(document.links.link_name.value);
        oRequest = new XMLHttpRequest();
        oRequest.open("GET",url+'?submit='+bbox+'=='+link_sub+'=='+email+'=='+link_name,false);
        oRequest.setRequestHeader("User-Agent",navigator.userAgent);
        oRequest.send();
        $("status").innerHTML= 'Request sent';
        close_sideBarRight();
    }
    function close_edit_links() {
        draw_box.deactivate();
        
        for (f in editLinkLayer.features) {
            editLinkLayer.features[f].destroy();
        }
    }
//}
//======================================================================
// LOCALIZATION

//}

//======================================================================
// NOMINATIM
//nominatim(){
    function setCenterMap(nlon, nlat) {
        nlonLat = new OpenLayers.LonLat(nlon, nlat).transform(new OpenLayers.Projection("EPSG:4326"), new OpenLayers.Projection("EPSG:900913"));
        map.setCenter (nlonLat, 14);
        document.getElementById('search_result').style.display='none';
    }

    function nsearch(string) {
        if (string == '') {return false;};
        close_sideBarRight();
        document.search.nom_search.value='';
        document.getElementById('sideBarRight').style.display='inline';
        document.getElementById('search_result').style.display='inline';
        document.getElementById('sideBarRightTitle').innerHTML='&nbsp;'+_('search_results');
        
        var oRequest = new XMLHttpRequest();
        oRequest.open("GET",'cgi/nominatim.cgi?place='+string,false);
        oRequest.setRequestHeader("User-Agent",navigator.userAgent);
        oRequest.send();
        setTimeout('',500);
        var responseXML = oRequest.responseXML;
        var response = responseXML.getElementsByTagName('place');
        
        var htmlResponse='<p><ul>';
        
        for (var i=0;i<response.length;i++) {
            htmlResponse += '<li><a onclick="setCenterMap('
            + response[i].getAttribute('lon') +','
            + response[i].getAttribute('lat') +');">'
            + response[i].getAttribute('display_name') +'</a></li><br/>';
        }
        htmlResponse += '</p></ul> <p>Nominatim Search Courtesy of <a href="http://www.mapquest.com/" target="_blank">MapQuest</a> <img src="http://developer.mapquest.com/content/osm/mq_logo.png"></p>';
        
        document.getElementById("search_result").innerHTML = htmlResponse;
        //return oRequest.responseText;
        //http://open.mapquestapi.com/nominatim/v1/search?format=xml&q=westminster+abbey
    }
//}
//======================================================================
// TOPO
//topoRoutes(){
    
    function routeInfos(routeDesc) {
    show_profile();
    ways = routeDesc.getElementsByTagName('way');
    var topo= '<p></p>\n'
                +'<a onclick="new_window()"'
                +' onmouseover="document.images[\'printPic\'].src=\'pics/print_hover.png\'"\n'
                +' onmouseout="document.images[\'printPic\'].src=\'pics/print.png\'">\n'
                +'<img name="printPic" src="pics/print.png"></a>'
                +'<table class="topoTable">';
    
    totalLength = 0;
    for (var w=0;w<ways.length;w++) {
        var section = {}
        tags = ways[w].getElementsByTagName('tag');
        for (var t=0;t<tags.length;t++) {
            if (tags[t].getAttribute('k')=='piste:grooming')
            {section['grooming']=tags[t].childNodes[0].nodeValue;}
            if (tags[t].getAttribute('k')=='piste:difficulty')
            {section['difficulty']=tags[t].childNodes[0].nodeValue;}
            if (tags[t].getAttribute('k')=='piste:lit')
            {section['lit']=tags[t].childNodes[0].nodeValue;}
            if (tags[t].getAttribute('k')=='length')
            {
            section['length']=totalLength;
            totalLength = totalLength + parseFloat(tags[t].childNodes[0].nodeValue);
            }
        }
        relationText = '';
        
        rels = ways[w].getElementsByTagName('member_of');
        if (rels.length == 0) {section['member_of']=null;}
        else {
            // loop trough relation and create the html
            for (var r=0;r<rels.length;r++) {
                var color='black'
                var id = rels[r].getAttribute('id')
                var rel_tags = rels[r].getElementsByTagName('rel_tag');
    
                    for (var rt=0;rt<rel_tags.length;rt++) {
                        if (rel_tags[rt].getAttribute('k')=='color') 
                        {color=rel_tags[rt].childNodes[0].nodeValue;}
                        if (rel_tags[rt].getAttribute('k')=='colour') 
                        {color=rel_tags[rt].childNodes[0].nodeValue;}
                        if (rel_tags[rt].getAttribute('k')=='name')
                        {var name=rel_tags[rt].childNodes[0].nodeValue;}
                        if (rel_tags[rt].getAttribute('k')=='website')
                        {var website=rel_tags[rt].childNodes[0].nodeValue;}
                    }
                
                relationText += '<a onmouseover="highlightRelation('+id+')"'
                +'onmouseout="highlightRelation()"'
                +'onclick="selectRelation('+id+');">'
                +'<b style="color:'+color+';font-weight:900;">&#9679 </b><b> '
                + name + '</b></a>  ';
            }
            section['member_of']=relationText;
        }
        
        topo += '<tr><td>'+ section['length'].toFixed(1) +'km'+'</td><td><ul>' //.toFixed(1)
        topo +='<li><b>'+_('difficulty')+':</b> '+_(section['difficulty'])+'</li>\n'
                + '<li><b>'+_('grooming')+':</b> '+_(section['grooming'])+'</li>\n'
    if (section['lit'] =='yes') {
        topo += '<li><b>'+_('lit')+'</b></li>\n'
        }
    if (section['member_of']) {
        topo += '<li><b>'+_('member_of')+':</b>'+_(section['member_of'])+'</li>\n'
        }
        topo += '</ul></td></tr>\n';        
    }
    
    topo += '</table></br> Total: '+totalLength.toFixed(1)+'km\n';
    
    html ='<div id="topo_profile"></div>';
    $("topo").innerHTML =  html+topo;
    
    }
    
    function new_window() {
    printWindow=window.open('print.html');
    printWindow.document.write(
    '<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN"><html>\n'
    +'<head>\n'
            +'<meta name="http-equiv" content="Content-type: text/html; charset=UTF-8"/>\n'
            +'<title>Topo Ski Nordique / Nordic Ski Topo</title>\n'
            +'<link rel="stylesheet" href="main.css" media="print" />\n'
            +'<link rel="stylesheet" href="main.css" media="screen" />\n'
    +'</head>\n'
    +'<body>\n');
    
    printWindow.document.write(document.getElementById('topo').innerHTML);
    //printWindow.document.write(document.getElementById('contextual2').innerHTML);
    printWindow.document.write('<p></p><img src="pics/pistes-nordiques-238-45.png">');
    printWindow.document.write(document.getElementById('Attributions').innerHTML);
    printWindow.document.write('\n</body></html>');
    }
    
    function getRelations(relations_ids) {
    text = ' '
    ids= relations_ids.split(';');
    
    var color = 'black';
    
    for (id in ids) {
        for (feat in pistesLayer.features) {
            if (pistesLayer.features[feat].osm_id == ids[id]) {
            if (pistesLayer.features[feat].attributes['color'])
            {color = pistesLayer.features[feat].attributes['color'];}
            else if (pistesLayer.features[feat].attributes['colour'])
            {color = pistesLayer.features[feat].attributes['colour'];}
            
            text += '<a onmouseover="highlightRelation('+ids[id]+')"'
                +'onmouseout="highlightRelation()"'
                +'onclick="selectRelation('+ids[id]+');">'
                +'<b style="color:'+color+';font-weight:900;">&#9679</b><b>'
                + pistesLayer.features[feat].attributes['name'] + '</b></a>  ';
            }
        }
    }
    return text;
    }
    
    function feature_infos(feature) {
    show_feature_info();
    var feat = {};
    
    if (feature.attributes['route'])
    {
        feat['relation'] = true;
        feat['osm_id'] = feature.osm_id;
        feat['name']=feature.attributes['name'];
        
        if (feature.attributes['website'])
        {feat['website']=feature.attributes['website'];}
        else {feat['website']="unknown"}
        
        if (feature.attributes['color'])
        {feat['color']=feature.attributes['color'];}
        else if (feature.attributes['colour'])
        {feat['color']=feature.attributes['colour'];}
        else {feat['color']="unknown"}
        
        feat['leng']=feature.geometry.getGeodesicLength(new OpenLayers.Projection("EPSG:900913"))/1000;
    
        var topo= '<p></p>\n'
    
        topo +='<li><b>'+_('sign_color')+':</b> '
                +'<b style="color:'+feat['color']+';font-weight:1200;">&#9679</b></li>\n'
                +'<li><b>'+_('name')+':</b> '
                +'<a onmouseover="highlightRelation('+feat['osm_id']+')"'
                +'onmouseout="highlightRelation()"'
                +' '+ feat['name'] + '</a>  '
                +'</li>\n'
                +'<li><b>'+_('website')+':</b> <a target="_blank" href="'
                +_(feat['website'])+'">'+_(feat['website'])+'</a></li>\n'
                +'<li>'+_(feat['leng']).toFixed(1)+' km</li>\n'
            
        topo += '</ul></td></tr>\n';
    }
    else {
        if (feature.attributes['piste:grooming']) 
        {feat['grooming']=feature.attributes['piste:grooming'];}
        else {feat['grooming']="unknown"}
        
        if (feature.attributes['piste:difficulty'])
        {feat['difficulty']=feature.attributes['piste:difficulty'];}
        else {feat['difficulty']="unknown"}
        
        if (feature.attributes['piste:lit'])
        {feat['lit']=feature.attributes['piste:lit'];}
        else {feat['lit']="unknown"}
        
        if (feature.attributes['member_of'])
        {feat['member_of']=getRelations(feature.attributes['member_of']);}
        else {feat['member_of']="unknown"}
        
        var topo= '<p></p>\n'
        topo +='<li><b>'+_('difficulty')+':</b> '+_(feat['difficulty'])+'</li>\n'
             + '<li><b>'+_('grooming')+':</b> '+_(feat['grooming'])+'</li>\n'
        if (feat['lit'] =='yes') {
              topo += '<li><b>'+_('lit')+'</b></li>\n'
            }
        if (feat['member_of']) {
              topo += '<li><b>'+_('member_of')+':</b>'+_(feat['member_of'])+'</li>\n'
            }
        topo += '</ul></td></tr>\n';
    }
    topo+='<i>'+_('select_points_hint')+'</i>\n'
    $("feature_infos").innerHTML =  topo;
    }
//}

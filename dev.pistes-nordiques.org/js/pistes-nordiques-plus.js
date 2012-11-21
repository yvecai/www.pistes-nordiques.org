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
var server="http://beta.pistes-nordiques.org/";

var timer_is_on=0;
var routingPoints=new Array();
var routingGeom=new Array();
var routingFeatures=new Array();

function onFeatureHovered(selectedFeature,xy) {
    highlightWay(selectedFeature,xy);
    
}

function onFeatureSelected(selectedFeature,xy) {
    
    //document.getElementById('clearRouteControl').style.display='none'; // hide controls until the elements are drawn
    //document.getElementById('removePointControl').style.display='none';
    // find the nearest point on the selected geometry
    if (selectedFeature.attributes['userpoint'] == 'true') {removeRoutePoint(selectedFeature);return 0}
    
    var selectedPoint = new OpenLayers.Geometry.Point(xy.lon,xy.lat);
    nearestPoint = selectedFeature.geometry.distanceTo(selectedPoint, {details : true});
    routingPoint = new OpenLayers.LonLat(nearestPoint.x0, nearestPoint.y0).transform(new OpenLayers.Projection("EPSG:900913"), new OpenLayers.Projection("EPSG:4326"));
    routingPoints.push(routingPoint);
    
    routingGeom.push(new OpenLayers.Geometry.Point(nearestPoint.x0, nearestPoint.y0));
    routingFeatures.push(new OpenLayers.Feature.Vector(routingGeom[routingGeom.length -1], {userpoint:'true'},null));
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
    
    highlightWay(selectedFeature);
    requestRoute();
}

function highlightWay(selectedFeature,xy) {
    if (selectedFeature.attributes['route']) {
        // don't select if 'route'
        return false;
    }
    var osmid= selectedFeature.osm_id;
    var olid= selectedFeature.id;
    
    for (f in pistesLayer.features) {
        highlightCtrl.unhighlight(pistesLayer.features[f]);
        if (pistesLayer.features[f].osm_id == osmid && osmid) {
            feature_infos(pistesLayer.features[f]);
        }
        if (pistesLayer.features[f].id == olid){ //check if this is the feature hovered
            highlightCtrl.highlight(pistesLayer.features[f]);
        }
    }
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

function refreshOverlay(features) {
    pistesLayerOverlay.removeAllFeatures();
    if (map.getZoom() > 12) {
    for (i=0;i<features.length;i++){ 
        if (features[i].attributes['route']){}
        else {
            var feature = features[i].clone(); 
            pistesLayerOverlay.addFeatures([feature]);
            
            if (features[i].attributes['piste:difficulty']=='intermediate'){
                vertices=feature.geometry.getVertices();
                v = parseInt(vertices.length/2);
                pos = new OpenLayers.LonLat(vertices[v].x,vertices[v].y)
                if (dangerIcon){
                    markersLayer.addMarker(new OpenLayers.Marker(pos,dangerIcon.clone()));
                } else {
                    var dangerIcon = new OpenLayers.Icon(
                        'pics/danger-black.svg',
                        new OpenLayers.Size(12,12),
                        new OpenLayers.Pixel(-6, -6)
                    );
                    markersLayer.addMarker(new OpenLayers.Marker(pos,dangerIcon));
                }
            } else if (features[i].attributes['piste:difficulty']=='advanced'){
                vertices=feature.geometry.getVertices();
                v = parseInt(vertices.length/2);
                pos = new OpenLayers.LonLat(vertices[v].x,vertices[v].y)
                if (highDangerIcon){
                    markersLayer.addMarker(new OpenLayers.Marker(pos,highDangerIcon.clone()));
                } else {
                    var highDangerIcon = new OpenLayers.Icon(
                        'pics/danger-red.svg',
                        new OpenLayers.Size(12,12),
                        new OpenLayers.Pixel(-6, -6)
                    );
                    markersLayer.addMarker(new OpenLayers.Marker(pos,highDangerIcon));
                }
            } 
        }
    } 
    }
    pistesLayerOverlay.redraw();
    return true;
}


//======================================================================
// ROUTING
function requestRoute() {
    if (routingPoints.length >1) {
        var q = '';
        for (pt in routingPoints) {
            q = q + routingPoints[pt].lat + ' ' +routingPoints[pt].lon + ',';
        };
        
        var XMLHttp = new XMLHttpRequest();
        XMLHttp.open("GET", server+'cgi/routing/routing.py/' + q);
        XMLHttp.onreadystatechange= function () {
            if (XMLHttp.readyState == 4) {              
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

function trace_route(wktroute) {
    // request the elevation profile
    document.getElementById('topo_profile').innerHTML='Loading ...';
    var XMLHttp = new XMLHttpRequest();
    XMLHttp.open("POST", server+"cgi/profile/getProfilePic.py/handle");
    XMLHttp.onreadystatechange= function () {
        if (XMLHttp.readyState == 4) {
            // cut when cgi is not able to work
            document.getElementById('topo_profile').innerHTML=XMLHttp.responseText;
        }
    }
    XMLHttp.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    
    XMLHttp.send(wktroute);
    
    
    var routeT = new OpenLayers.Geometry.fromWKT(wktroute);
    var route900913 = routeT.transform(new OpenLayers.Projection("EPSG:4326"), new OpenLayers.Projection("EPSG:900913"));
    routingGeom.push(route900913);
    routingFeatures.push(new OpenLayers.Feature.Vector(routingGeom[routingGeom.length -1], {userroute:'true'}, routeStyle));
    pistesLayer.addFeatures(routingFeatures);
    
    
}

function getNodeText(node) {
    //workaround for browser limit to 4096 char in xml nodeValue
    var r = "";
    for (var x = 0;x < node.childNodes.length; x++) {
        r = r + node.childNodes[x].nodeValue;
    }
    return r;
}
    
function redrawRoute() {
    pistesLayer.destroyFeatures(routingFeatures);
    routingFeatures =new Array();
    for (geom in routingGeom) {
        if (routingGeom[geom].CLASS_NAME == "OpenLayers.Geometry.Point") {
        routingFeatures.push(new OpenLayers.Feature.Vector(routingGeom[geom],
                                {userpoint:'true'},null));
        }
        if ((routingGeom[geom].CLASS_NAME == "OpenLayers.Geometry.LineString") 
        || (routingGeom[geom].CLASS_NAME == "OpenLayers.Geometry.MultiLineString")){
        routingFeatures.push(new OpenLayers.Feature.Vector(routingGeom[geom],
                                {userroute:'true'},routeStyle));
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

function removeRoutePoint(feature) {
    if (routingPoints.length <= 1) {clearRoute();}
    var rp;
    var ll= new OpenLayers.LonLat(feature.geometry.x, feature.geometry.y).transform(new OpenLayers.Projection("EPSG:900913"), new OpenLayers.Projection("EPSG:4326"));
    for (p in routingPoints){
        rp=routingPoints[p]
        if (rp.equals(ll)) {
            routingPoints.splice(p,1);
            break;
        }
    }
    
    pistesLayer.destroyFeatures(routingFeatures);
    //routingPoints =new Array();
    routingFeatures =new Array();
    routingGeom =new Array();
    //routingPoints = tmp;
    for (p in routingPoints){
        ll= new OpenLayers.LonLat(routingPoints[p].lon,routingPoints[p].lat).transform(new OpenLayers.Projection("EPSG:4326"), new OpenLayers.Projection("EPSG:900913"));
        routingGeom.push(new OpenLayers.Geometry.Point(ll.lon,ll.lat));
    }
    redrawRoute();
    requestRoute();
}

//======================================================================
// TOPO
    
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
$("sideBarContent").innerHTML =  html+topo;

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

printWindow.document.write(document.getElementById('sideBarContent').innerHTML);
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
    
    if (feature.attributes['route']){
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
    }else {
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
    document.getElementById('featureinfosContent').innerHTML = topo;
}

function highlightRelation(id) {
    for (f in pistesLayer.features) {
        highlightCtrl.unhighlight(pistesLayer.features[f]);
        if (pistesLayer.features[f].osm_id == id && id) {
            highlightCtrl.highlight(pistesLayer.features[f]);
        }
    }
}
    
//======================================================================
// INTERFACE
function show_feature_info() {
    document.getElementById('featureinfos').style.display='inline';
}
function close_feature_info() {
    document.getElementById('featureinfos').style.display='none';
}
function zoom_to_point(features) {
    var c = features[0].geometry.getCentroid()
    var lL = new OpenLayers.LonLat(c.x, c.y)
    map.setCenter (lL, map.getZoom()+4);
}
function show_live_edits(when,display) {
    if (display) {
        var DiffStyle = new OpenLayers.Style({
                pointRadius: 1.5,
                fillColor: "#FF1200",
                strokeColor:"#FF1200"})
        if (when == "daily") {
            var DailyLayer=new OpenLayers.Layer.Vector("Daily", {
                        strategies: [new OpenLayers.Strategy.Fixed(),
                                    new OpenLayers.Strategy.Cluster()],
                        protocol: new OpenLayers.Protocol.HTTP({
                            url: "data/daily.tsv",
                            format: new OpenLayers.Format.Text()
                            }),
                        styleMap: new OpenLayers.StyleMap({
                            "default": DiffStyle
                            }),
                        projection: new OpenLayers.Projection("EPSG:4326")
                    });
            map.addLayers([DailyLayer]);
        }
        if (when == "weekly") {
            var WeeklyLayer=new OpenLayers.Layer.Vector("Weekly", {
                        strategies: [new OpenLayers.Strategy.Fixed(),
                                    new OpenLayers.Strategy.Cluster()],
                        protocol: new OpenLayers.Protocol.HTTP({
                            url: "data/weekly.tsv",
                            format: new OpenLayers.Format.Text()
                            }),
                        styleMap: new OpenLayers.StyleMap({
                            "default": DiffStyle
                            }),
                        projection: new OpenLayers.Projection("EPSG:4326")
                    });
            map.addLayers([WeeklyLayer]);
        }
        if (when == "monthly") {
            var MonthlyLayer=new OpenLayers.Layer.Vector("Monthly", {
                        strategies: [new OpenLayers.Strategy.Fixed(),
                                    new OpenLayers.Strategy.Cluster()],
                        protocol: new OpenLayers.Protocol.HTTP({
                            url: "data/monthly.tsv",
                            format: new OpenLayers.Format.Text()
                            }),
                        styleMap: new OpenLayers.StyleMap({
                            "default": DiffStyle
                            }),
                        projection: new OpenLayers.Projection("EPSG:4326")
                    });
            map.addLayers([MonthlyLayer]);
        }
    } else {
        if (when == "daily") {map.getLayersByName("Daily")[0].destroy();}
        if (when == "weekly") {map.getLayersByName("Weekly")[0].destroy();}
        if (when == "monthly") {map.getLayersByName("Monthly")[0].destroy();}
    }
}
//======================================================================
// STYLES

var routeStyle = { strokeColor: '#FFFFFF', 
            strokeDashstyle : 'dash',
            strokeLinecap : 'round',
            strokeOpacity: 1,
            graphicZIndex: 18,
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
                graphicName: "circle"},
                {context: 
                    { radius: function(feature) {
                            return Math.min(feature.attributes.count, 10) + 2;
                        }
                    }
                });
// Style work for 'pisteslayer'-----------------------------
var styleContext = {
    getColor: function(feature) {
        if ( feature.attributes['userpoint'] == 'true' ) {return '#000000'}
        else {
            if ( feature.attributes['colour'] ) {
                return feature.attributes['colour'];
            } else if ( feature.attributes['color'] ) {
                return feature.attributes['color'];
            } else {
                return '#009480';
            };
        };
   },
    getOpacity: function(feature) {
        return 0.9;
    },
    getZ: function(feature) {
        if (feature.attributes['route']) {return 12;}
        else {return 11;}
    },
    /*getGraphic: function(feature) {
        if (feature.attributes['piste:start'] == 'yes') {
            return '../pistes-nordiques-backend/pics/Nordic_sign.png';}
        else {return '';}
    },*/
    getWidth: function(feature) {
        if ( feature.attributes['userpoint'] == 'true' ) {return 1}
        else {
            if (feature.attributes['route']) {return 2;}
            else {return 3;}
        }
    },
    getFillOpacity: function(feature) {
        if ( feature.attributes['userpoint'] == 'true' ) {return 0.5}
        else {return 0} 
    }
};
var styleTemplate = {
    pointRadius: 6, //for routing points
    strokeColor: "${getColor}", // using context.getColor(feature)
    strokeOpacity: "${getOpacity}",//0.6,
    strokeWidth: "${getWidth}",
    graphicZIndex: "${getZ}",
    fillColor: '#ffffff',
    fillOpacity: "${getFillOpacity}"
};
var pisteStyle = new OpenLayers.Style(styleTemplate, {context: styleContext});
var pisteStyles = new OpenLayers.StyleMap({
        'default': pisteStyle,
        'select': pisteStyle,
        'highlight': new OpenLayers.Style({
            pointRadius: 10, //for routing points
            strokeWidth: 5,
            graphicZIndex: 15,
            strokeOpacity: 0.9,
			cursor: 'pointer'
        })
});

var styleOverlayContext = {
    getColor: function(feature) {
        switch( feature.attributes['piste:difficulty'] ) {
        case "novice": return "";
        case "easy": return "";
        case "intermediate": return "black";
        case "expert":  return "red";
        case "advanced": return "red";
        case "freestyle": return "red";
        case "extreme": return "red";
        default: return "black";};
   },
    getDash: function(feature) {
        switch( feature.attributes['piste:difficulty'] ) {
        case "novice": return "solid";
        case "easy": return "solid";
        case "intermediate": return "solid";
        case "expert": return "solid";
        case "advanced":return "solid";
        case "freestyle":return "solid";
        case "extreme": return "solid";
        default: return "dash";};
   },
    getOpacity: function(feature) {
        switch( feature.attributes['piste:difficulty'] ) {
        case "novice":  return "0";
        case "easy": return "0";
        case "intermediate":  return "0.3";
        case "expert":  return "0.3";
        case "advanced": return "0.3";
        case "freestyle": return "0.3";
        case "extreme": return "0.3";
        default: return "0.3";};
   }
};
var styleOverlayTemplate = {
    strokeColor: "${getColor}", // using context.getColor(feature)
    strokeOpacity: "${getOpacity}",
    strokeWidth: 8,
    strokeLinecap: "butt",
    strokeDashstyle : "${getDash}",
    graphicZIndex: 16,
    fillOpacity: 0
};
var pisteOverlayStyle = new OpenLayers.Style(styleOverlayTemplate, {context: styleOverlayContext});
var pisteOverlayStyles = new OpenLayers.StyleMap({
        'default': pisteOverlayStyle,
        'select': pisteOverlayStyle,
        'highlight': pisteOverlayStyle
});
// a dummy proxy script is located in the directory to allow use of wfs
OpenLayers.ProxyHost = server+"cgi/proxy.cgi?url=";

// layer 7
var pistesLayerLowZoom = new OpenLayers.Layer.Vector("Pistes Vector LZ", {
	strategies: [
	new OpenLayers.Strategy.Fixed(),
	new OpenLayers.Strategy.Cluster()
	],
	protocol: new OpenLayers.Protocol.HTTP({
			//url:"nordic_1npw.osm",
			//format: new OpenLayers.Format.OSM()
			url:"data/1npw.tsv",
			format: new OpenLayers.Format.Text()
	}),
	projection: new OpenLayers.Projection("EPSG:4326"),
	maxScale: 100000000000, //8
	visibility: true,
	styleMap: new OpenLayers.StyleMap({
		"default": pointStyle,
		"highlight": new OpenLayers.Style({fillColor: "#4477EE",strokeColor: "#4477EE"})
	})
});
map.addLayer(pistesLayerLowZoom)
// Declaration of 'pisteslayerlowres'-----------------------------
// layer 8
var pistesLayerLowres = new OpenLayers.Layer.Vector("Pistes Vector LR", {
	strategies: [new OpenLayers.Strategy.BBOX()],
	styleMap: pisteStyles,
	protocol: new OpenLayers.Protocol.HTTP({
			url:server+"cgi/osmosis-lowres/osmosis_handle.py/",
			sync: true,
			format: new OpenLayers.Format.OSM({
			externalProjection:new OpenLayers.Projection("EPSG:4326"),
			relationsParsers:{
				route: OpenLayers.Format.OSM.routeParser
				}
				})
	}),
	minScale: 100000000000, // 8
	maxScale: 20000000000, // 12
	visibility: true,
	projection: new OpenLayers.Projection("EPSG:4326"),
	rendererOptions: {yOrdering: true, zIndexing: true} //necessary for graphicZIndex to work
});
map.addLayer(pistesLayerLowres);
pistesLayerLowres.redraw();
// Declaration of 'pisteslayer'-----------------------------
// layer 9

var pistesLayer = new OpenLayers.Layer.Vector("Pistes Vector", {
	strategies: [new OpenLayers.Strategy.BBOX()],
	styleMap: pisteStyles,
	protocol: new OpenLayers.Protocol.HTTP({
			url:server+"cgi/osmosis/osmosis_handle.py/",
			sync: true,
			format: new OpenLayers.Format.OSM({
			externalProjection:new OpenLayers.Projection("EPSG:4326"),
			relationsParsers:{
				route: OpenLayers.Format.OSM.routeParser
				}
				})
	}),
	projection: new OpenLayers.Projection("EPSG:4326"),
	minScale: 20000000000, //12
	visibility: true,
	rendererOptions: {yOrdering: true, zIndexing: true} //necessary for graphicZIndex to work
});
map.addLayer(pistesLayer);
pistesLayer.redraw();
// layer 10
var pistesLayerOverlay = new OpenLayers.Layer.Vector("Pistes Vector Overlay", {
	styleMap: pisteOverlayStyles,
	projection: new OpenLayers.Projection("EPSG:4326"),
	minScale: 20000000000, //12
	visibility: true,
	rendererOptions: {yOrdering: true, zIndexing: true} //necessary for graphicZIndex to work
});
map.addLayer(pistesLayerOverlay);
// layer 11
var markersLayer = new OpenLayers.Layer.Markers( "Markers",{
	projection: new OpenLayers.Projection("EPSG:4326"),
	minScale: 20000000000, //12
	isBaseLayer: false,
	visibility: true,
	minScale: 20000000000, //12
	rendererOptions: { zIndexing: true }
});
map.addLayer(markersLayer);
    markersLayer.setZIndex( 1001 ); 
    
// Add higlight and select controls to vector features -----
var highlightCtrl = new OpenLayers.Control.SelectFeature(pistesLayer, {
    hover: true,
    clickout: true,
    mutiple: false,
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
            //highlightCtrl.unhighlight(feature);
            for (f in pistesLayer.features) {
                highlightCtrl.unhighlight(pistesLayer.features[f]);
            }
            t = setTimeout("close_feature_info();",500);
            timer_is_on=1;
        }
});
var selectCtrl = new OpenLayers.Control.SelectFeature(pistesLayer,{
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

// EVENTS --------------------------------------------------
var st= $("status");
// Events
pistesLayerLowres.events.register("loadstart", null, function() {
     st.innerHTML = '<b style="color:#FFFFFF;">'+_('loading...')+'</b>'; 
     st.style.backgroundColor = '#FF7800';
     })
pistesLayerLowres.events.register("loadend", null, function() {
     st.innerHTML = '';
     st.style.backgroundColor = '#FFFFFF';
     redrawRoute();
     //list_relations(pistesLayer.features);
     })
pistesLayer.events.register("loadstart", null, function() {
     st.innerHTML = '<b style="color:#FFFFFF;">'+_('loading...')+'</b>'; 
     st.style.backgroundColor = '#FF7800';
     })
pistesLayer.events.register("loadend", null, function() {
     //refreshOverlay(pistesLayer.features);
     st.innerHTML = '';
     st.style.backgroundColor = '#FFFFFF';
     redrawRoute();
     //list_relations(pistesLayer.features);
     })
pistesLayer.events.register("moveend", null, function() {
     refreshOverlay(pistesLayer.features);
     redrawRoute();
     //list_relations(pistesLayer.features);
     })
pistesLayerLowZoom.events.register("loadstart", null, function() {
     st.innerHTML = '<b style="color:#FFFFFF;">'+_('loading_low_zoom')+'</b>'; 
     st.style.backgroundColor = '#FF7800';
     })
pistesLayerLowZoom.events.register("loadend", null, function() {
     st.innerHTML = '';
     st.style.backgroundColor = '#FFFFFF';
     })

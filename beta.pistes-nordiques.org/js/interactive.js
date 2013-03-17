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
var server="http://"+window.location.host+"/";

var routingPoints=new Array();
var routingGeom=new Array();
var routingFeatures=new Array();

var routeStyle = new OpenLayers.Style({
			strokeColor: "${getColor}", 
			strokeDashstyle : "${getDash}",
			strokeLinecap : 'round',
			strokeOpacity: "${getOpacity}",
			graphicZIndex: 18,
			strokeWidth: "${getStroke}",
			pointRadius: 6,
			fillColor: '#ffffff'
			},{context: {
				getColor: function(feature) {
					if ( feature.attributes['userpoint'] == 'true' ) {return '#000000'}
					else {return '#000000'}
				},
				getStroke: function(feature) {
					if ( feature.attributes['userpoint'] == 'true' ) {return 1}
					else {return 2}
				},
				getDash: function(feature) {
					if ( feature.attributes['userpoint'] == 'true' ) {return 'solid'}
					else {return 'dash'}
				},
				getOpacity: function(feature) {
					if ( feature.attributes['userpoint'] == 'true' ) {return 0.5}
					else {return 1}
				}
			}
		});

function loadWait() {
	$("status").innerHTML = '<b style="color:#FFFFFF;">'+_('loading...')+'</b>'; 
	$("status").style.backgroundColor = '#FF7800';
	$("waiter").style.display = 'block';
}
function endWait() {
	 $("status").innerHTML = '';
	 $("status").style.backgroundColor = '#FFFFFF';
	 redrawRoute();
	$("waiter").style.display = 'none';
}
function getNodeText(node) {
	//workaround for browser limit to 4096 char in xml nodeValue
	var r = "";
	for (var x = 0;x < node.childNodes.length; x++) {
		r = r + node.childNodes[x].nodeValue;
	}
	return r;
}

function onClick(lonlat) {
	
	routingGeom.push(new OpenLayers.Geometry.Point(lonlat.lon, lonlat.lat));
	routingFeatures.push(new OpenLayers.Feature.Vector(routingGeom[routingGeom.length -1], {userpoint:'true'}));
	vectorLayer.addFeatures(routingFeatures);
	
	routingPoint = lonlat.transform(new OpenLayers.Projection("EPSG:900913"), new OpenLayers.Projection("EPSG:4326"));
	routingPoints.push(routingPoint);
	
	document.getElementById('routing').style.display='block';
	document.getElementById('RoutingTitle').innerHTML='&nbsp;'+_('routing_title');
	loadWait();
	requestRoute();
}

function requestRoute() {
	
	var q = '';
	for (pt in routingPoints) {
		q = q + routingPoints[pt].lat + ';' +routingPoints[pt].lon + ',';
	};
	
	var XMLHttp = new XMLHttpRequest();
	XMLHttp.open("GET", server+'routing?' + q);
	XMLHttp.onreadystatechange= function () {
		if (XMLHttp.readyState == 4) {
			endWait();
			var responseXML=XMLHttp.responseXML;
			if (responseXML==null){
				removeLastRoutePoint();
				return null
			}
			if (responseXML.getElementsByTagName('info')[0]!=null) {
				var info=getNodeText(responseXML.getElementsByTagName('info')[0]);
				routeInfos(info);
			}
			else if (responseXML.getElementsByTagName('wkt')[0]!=null) {
				var routeIds=getNodeText(responseXML.getElementsByTagName('ids')[0]);
				var routeWKT = getNodeText(responseXML.getElementsByTagName('wkt')[0]);
				routeInfos(routeIds);
				trace_route(routeWKT);
			}
			else {
				removeLastRoutePoint();
				routeInfos('no route');
				}
			}
		}
	XMLHttp.send();
}

function trace_route(wktroute) {
	// request the elevation profile
	document.getElementById('topo_profile').innerHTML='Loading ...';
	var XMLHttp = new XMLHttpRequest();
	XMLHttp.open("POST", server+"profile?");
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
	routingFeatures.push(new OpenLayers.Feature.Vector(routingGeom[routingGeom.length -1], {userroute:'true'}));
	vectorLayer.addFeatures(routingFeatures);
	
	
}

function redrawRoute() {
	vectorLayer.destroyFeatures(routingFeatures);
	routingFeatures =new Array();
	for (geom in routingGeom) {
		if (routingGeom[geom].CLASS_NAME == "OpenLayers.Geometry.Point") {
		routingFeatures.push(new OpenLayers.Feature.Vector(routingGeom[geom],
								{userpoint:'true'}));
		}
		if ((routingGeom[geom].CLASS_NAME == "OpenLayers.Geometry.LineString") 
		|| (routingGeom[geom].CLASS_NAME == "OpenLayers.Geometry.MultiLineString")){
		routingFeatures.push(new OpenLayers.Feature.Vector(routingGeom[geom],
								{userroute:'true'}));
		}
	}
	vectorLayer.addFeatures(routingFeatures);
}

function clearRoute() {
	routingPoints =new Array();
	vectorLayer.destroyFeatures(routingFeatures);
	routingFeatures =new Array();
	routingGeom =new Array();
}

function removeRoutePoint(feature) {
	if (routingPoints.length <= 1) {clearRoute(); return 0}
	var rp;
	var ll= new OpenLayers.LonLat(feature.geometry.x, feature.geometry.y).transform(new OpenLayers.Projection("EPSG:900913"), new OpenLayers.Projection("EPSG:4326"));
	for (p in routingPoints){
		rp=routingPoints[p]
		if (rp.equals(ll)) {
			routingPoints.splice(p,1);
			break;
		}
	}
	
	vectorLayer.destroyFeatures(routingFeatures);
	routingFeatures =new Array();
	routingGeom =new Array();
	for (p in routingPoints){
		ll= new OpenLayers.LonLat(routingPoints[p].lon,routingPoints[p].lat).transform(new OpenLayers.Projection("EPSG:4326"), new OpenLayers.Projection("EPSG:900913"));
		routingGeom.push(new OpenLayers.Geometry.Point(ll.lon,ll.lat));
	}
	redrawRoute();
	requestRoute();
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


function routeInfos(routeDesc) {
	show_profile();
	//topo=routeDesc.childNodes[0].nodeValue;
	
	html ='<div id="topo_profile"></div>';
	$("sideBarContent").innerHTML =  html+routeDesc;
}

var vectorLayer = new OpenLayers.Layer.Vector("Vector",{
		styleMap: new OpenLayers.StyleMap({
			"default": routeStyle,
			"highlight": new OpenLayers.Style({fillColor: "#4477EE",strokeColor: "#4477EE"})
			})
		});
map.addLayer(vectorLayer);
function onMapClick(e) {
	var lonlat = map.getLonLatFromPixel(e.xy);
	onClick(lonlat);
}
map.events.register("click", map, onMapClick);

var selectCtrl = new OpenLayers.Control.SelectFeature(vectorLayer,{
	clickout: true,
	mutiple: false,
	onSelect: function(feature){
		if (feature.attributes['userpoint'] == 'true') {removeRoutePoint(feature)}
		}
	});
selectCtrl.handlers.feature.stopDown = false; // otherwise we have a confilct with pan
map.addControl(selectCtrl);
selectCtrl.activate();

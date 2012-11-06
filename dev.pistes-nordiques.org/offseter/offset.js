
var pistesLayer;
var tilesLayer;
var relationOffsets=[];
var relationList=[];
var OFFSET_DIR=1;
var map;
var fromProjection = new OpenLayers.Projection("EPSG:4326");   // Transform from WGS 1984
var toProjection   = new OpenLayers.Projection("EPSG:900913"); // to Spherical Mercator Projection

function showList(){
	text="";
	for (r in relationOffsets) {
	text+=r+";"+relationOffsets[r]+"\n";
	}
	var newtab = window.open("text/plain");
	newtab.document.write("\n<pre>");
	newtab.document.write("\n#"+Date()+"\n");
	newtab.document.write(text);
	newtab.document.write("</pre>"+"\n");
	
}
function offset(id, of, side) {
	updateOffset(id,side);
	tilesLayer.redraw();
}

function requestRelations() {
	var XMLHttp = new XMLHttpRequest();
	XMLHttp.open("GET", "../cgi/pgsql-mapnik-handle/pgsql-mapnik-handle/handle?bbox="+map.getExtent().toBBOX(), false);
	XMLHttp.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
	XMLHttp.send();
	if (XMLHttp.status === 200) {
		var text = XMLHttp.responseText;
		var rels = text.split('|');
		rels.pop();
		list_relations(rels);
	}

}
function updateOffset(id,side) {
for ( var t=0;t < relationList.length; t++ ) {
	if(relationList[t]['id'] == id){
	if(side =='right') {
		relationOffsets[id]-=1;
	}
	if(side =='left') {
		relationOffsets[id]+=1;
	}
	}
  }
  updateRelationList();
}

function list_relations(rels) {
	relationList.length = 0;
	for(r in rels) {
		var rel=[];
		rel['name']=rels[r].split(':')[0];
		rel['color']=rels[r].split(':')[1];
		rel['id'] =rels[r].split(':')[2];
		if ( ! relationOffsets[ rel['id'] ]) {relationOffsets[ rel['id'] ] =0;}
		rel['of'] = relationOffsets[ rel['id'] ]; 
		relationList.push(rel);
	}
	updateRelationList();
}
function updateRelationList(){
	html = '';
	for (var t=0;t<relationList.length;t++) {
		html += '<p style="color:'+relationList[t]['color']+
		'">'+relationOffsets[relationList[t]['id']] +
		'&nbsp;&nbsp;<a href="#" onClick="offset('+relationList[t]['id']+',15,\'left\');">--</a>&nbsp;'+
		'<a href="#" onClick="offset('+relationList[t]['id']+',15,\'right\');">++</a>&nbsp;'+
		relationList[t]['id'] +'-'+relationList[t]['name']+'</p>';
	}
	$("content").innerHTML=html;
}
function get_osm_url(bounds) {
	
	var relList="";
	for (var t in relationList) {
		relList+=relationList[t]['id']+":"+relationOffsets[relationList[t]['id']]+":"+relationList[t]['color']+"|";
	}
	relList=relList.replace(/#/g,'');
    var res = this.map.getResolution();
    var x = Math.round((bounds.left - this.maxExtent.left) / (res * this.tileSize.w));
    var y = Math.round((this.maxExtent.top - bounds.top) / (res * this.tileSize.h));
    var z = this.map.getZoom();
    var limit = Math.pow(2, z);

    if (y < 0 || y >= limit) {
        return OpenLayers.Util.getImagesLocation() + "404.png";
    } else {
        x = ((x % limit) + limit) % limit;
        return this.url +relList+'/'+ z + "/" + x + "/" + y + ".png";
    }
}

function init() {
map_init();
}

function map_init() {
	
	var options = {
	  controls: [
		new OpenLayers.Control.Navigation(),
		new OpenLayers.Control.PanZoomBar(),
		new OpenLayers.Control.Attribution(),
		new OpenLayers.Control.LayerSwitcher()
	  ],
	maxExtent: new OpenLayers.Bounds(-20037508.34,-20037508.34,20037508.34,20037508.34),
	maxResolution: 156543.0399,
	numZoomLevels: 19,
	units: 'm',
	projection: new OpenLayers.Projection("EPSG:900913"),
	displayProjection: new OpenLayers.Projection("EPSG:4326")
	};
	
	map = new OpenLayers.Map("basicMap", options);
	
	
	var mapnik         = new OpenLayers.Layer.OSM();
	var position       = new OpenLayers.LonLat(6.1,46.4).transform( fromProjection, toProjection);
	var zoom           = 14; 
	
	map.addLayer(mapnik);
	map.setCenter(position, zoom );
	
	requestRelations();
	 
	tilesLayer = new OpenLayers.Layer.XYZ("mapnik",
	"http://dev.pistes-nordiques.org/cgi/renderer-offset/renderer.py/handle?",{
			getURL: get_osm_url, 
			isBaseLayer: false
	});
	map.addLayer(tilesLayer);
	
	map.events.register("zoomend", null, 
						function() {
						requestRelations();
						})
	map.addControl(new OpenLayers.Control.Permalink());
}


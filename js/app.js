var baseUrl = "csv/";

// var attributionMapbox = 'Map via <a href="http://openstreetmap.org">OpenStreetMap</a>, <a href="http://mapbox.com">Mapbox</a>';

// present
// var plain = L.tileLayer( 'https://{s}.tiles.mapbox.com/v3/{id}/{z}/{x}/{y}.png',{id: 'nypllabs.7f17c2d1',attribution: attributionMapbox});

// create map with default tileset
// var map;
// var mapData;
// var constituents;
// var addresses;

var globe;
var globe_data;

// var csvs = ["constituents.csv", "constituentaddresses.csv"];

// var facets = [];
// facets.push("Nationality");
// facets.push("Gender");

function showMap() {

    // var i;
    // // console.log(mapData);
    // var b = new L.LatLngBounds();
    // for (i=0;i<mapData.length;i++) {
    //     var geo = L.geoJson(mapData[i], {
    //         pointToLayer: function(f,l) {
    //             return L.marker(l,{icon:markers[mapData[i].properties.subcategory.replace(/\s/g, "_")]});
    //         },
    //         onEachFeature: showPopup});
    //     geodata.push(geo);
    //     geo.addTo(map);
    //     map.setView(geo.getBounds().getCenter(), 12);
    //     b.extend(geo.getBounds());
    // }
    // map.fitBounds(b);
    var geo = L.geoJson(mapData);//,{onEachFeature: showPopup});
    geo.addTo(map);
}

function showPopup(feature, layer) {
    var key, val;
    var html = "";
    var p = feature.properties;
    html += "<div class=\"event_name\">" + p.event_name.replace(/[’‘]*/g, "") + "</div>";
    if (p.free) html += "<div class=\"free\">FREE!</div>";
    if (p.kid_friendly) html += "<div class=\"kid_friendly\">Kid friendly</div>";
    html += "<div class=\"venue\">At: <a href=\"http://"+p.venue_website+"\">"+p.venue_name+"</a></div>";
    html += "<div class=\"category\">Categories: "+p.category + ", " + p.subcategory +"</div>";
    html += "<div class=\"directions\">";
    html += "<a href=\"https://www.google.com/maps/dir/"+( (userLat!=0 && userLon!=0) ? userLat+","+userLon+"/" : "/" )+p.geocode_latitude+","+p.geocode_longitude+"/data=!3m1!4b1!4m2!4m1!3e3\">Google Maps Directions</a>";
    html += "<br /><a href=\"http://maps.apple.com/?z=16"+( (userLat!=0 && userLon!=0) ? "&saddr="+ userLat+","+userLon : "" )+"&daddr="+p.geocode_latitude+","+p.geocode_longitude+"\">Apple Maps Directions</a>";
    html += "</div>";
    html += "<div class=\"event_page\"><a href=\""+p.event_detail_url+"\">View event page</a></div>";
    layer.bindPopup(html);
}

// https://www.google.com/maps/dir/40.7710592,-73.9808833/40.7698559,-73.9843209/

function buildFacets() {
    var i;
    var html;
    var cat;
    for (i=0; i<categories.length; i++) {
        cat = categories[i];
        html = '<option value="'+cat+'">' + cat + '</option>';
        $("#categories").append(html);
    }
}

function geoJSONify() {
    var i, j;
    mapData = {};
    mapData.type = "FeatureCollection";
    mapData.features = [];
    var l = constituents.length;
    for (i=0;i<l;i++) {
        var item = constituents[i];
        var address = findConstituentLocations(item["ConstituentID"]);
        var lon = parseFloat(address["Longitude"]);
        var lat = parseFloat(address["Latitude"]);
        if (address==-1 || isNaN(lon) || isNaN(lat)) continue;
        feature = {};
        feature.type = "Feature";
        feature.properties = item;
        feature.geometry = {
            type: "Point",
            coordinates: [lon, lat]
        }
        mapData.features.push(feature);
    }
}

function findConstituentLocations(id) {
    var i;
    var l = addresses.length;
    for (i=0;i<l;i++) {
        var addr = addresses[i];
        if (addr["ConstituentID"]==id) return addr;
    }
    return -1;
}

function filterCategory(type, name) {
    var i;
    var b = new L.LatLngBounds();
    for (i=0;i<mapData.length;i++) {
        var item = mapData[i];
        var geo = geodata[i];
        if (name == "") {
            if (!map.hasLayer(geo)) map.addLayer(geo);
            b.extend(geo.getBounds());
            continue;
        }
        if (item.properties[type] != name) {
            if (map.hasLayer(geo)) map.removeLayer(geo);
        } else {
            if (!map.hasLayer(geo)) {
                map.addLayer(geo);
            }
            b.extend(geo.getBounds());
        }
    }
    map.fitBounds(b);
}


function init() {
    // var loadCount = 0;

    // map = L.map('map', {layers:plain, maxZoom:21, minZoom:0});

    // map.setView([0,0], 2);

    // $("#categories").on( "change", function (event) {
    //     filterCategory("category", event.target.value);
    // });
    // $("#subcategories").on( "change", function (event) {
    //     filterCategory("subcategory", event.target.value);
    // });

    // $.get(baseUrl + csvs[0], function(data){
    //     data = data.replace(/"/g, "'");
    //     constituents = $.csv.toObjects(data);
    //     console.log("parsed constituents");
    //     loadCount++;
    // });

    // $.get(baseUrl + csvs[1], function(data){
    //     data = data.replace(/"/g, "'");
    //     addresses = $.csv.toObjects(data);
    //     console.log("parsed addresses");
    //     loadCount++;
    // });

    // var intervalId = setInterval(function () {
    //     if (loadCount>=csvs.length) {
    //         clearInterval(intervalId);
    //         geoJSONify();
    //         showMap();
    //     }
    // }, 500);
    globe = DAT.Globe(document.getElementById('map'));

    window.globe_data = globe_data;

    $.get(baseUrl + "latlons.txt", function(data){
        globe_data = JSON.parse(data);
        console.log("parsed latlons");
        globe.addData(globe_data[0][1], {format: 'magnitude'});
        // globe.createPoints();
        globe.animate();
    });

}

$(function () {
    init();
});







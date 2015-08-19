var r = new XMLHttpRequest();

var globe_data;

r.open("GET", "latlons.txt", true);

r.onreadystatechange = function () {
  if (r.readyState != 4 || r.status != 200) return;
  globe_data = JSON.parse(r.responseText)[0][1];
  var i, l=globe_data.length;
  for (var i=0; i<l; i=i+3) {
    points.add({
      position : new Cesium.Cartesian3.fromDegrees(globe_data[i+1], globe_data[i]),
      color : new Cesium.Color(1, 0.01, 0.01, 1),
      pixelSize : 1.5
    });
  }
};
r.send(null);

var baseUrl = "https://ad4dc8ff4b124bbeadb55e68d9df1966.us-east-1.aws.found.io:9243/pic";

var facets = [["Countries","CountryID"]];

function updatePoints(newPoints) {
  points.removeAll();
  var i, l=newPoints.length;
  for (var i=0; i<l; i++) {
    var point = points[i];
    points.add({
      position : new Cesium.Cartesian3.fromDegrees(point[0], point[1]),
      color : new Cesium.Color(1, 0.01, 0.01, 1),
      pixelSize : 1.5
    });
  }
}

function getFacets() {
  for (var i=0; i<facets.length; i++) {
    getFacet(facets[i].toLowerCase());
  }
}

function getFacet(facet) {
  var r = new XMLHttpRequest();

  var params = "size=100&q=*";

  r.open("POST", baseUrl+"/"+facet+"/_search?"+params, true);

  r.onreadystatechange = updateFacet;

  r.send();
}

function updateFacet(event) {
  var r = event.target;
  if (r.readyState != 4 || r.status != 200) return;
  var data = JSON.parse(r.responseText);
  console.log(data);
  return;
  var i, l=data.length;
  for (var i=0; i<l; i=i+3) {
    points.add({
      position : new Cesium.Cartesian3.fromDegrees(globe_data[i+1], globe_data[i]),
      color : new Cesium.Color(1, 0.01, 0.01, 1),
      pixelSize : 1.5
    });
  }
}
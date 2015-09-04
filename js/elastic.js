var r = new XMLHttpRequest();

var handler = new Cesium.ScreenSpaceEventHandler(canvas);

var pickedEntities = [];

var tooltip = document.getElementById("tooltip");

function clearPicked() {
    var entity;
    while (pickedEntities.length>0) {
        entity = pickedEntities.splice(0, 1)[0];
        entity.primitive.color = new Cesium.Color(1, 0.01, 0.01, 1);
    }
}

function initMouseHandler(handler) {
    canvas.setAttribute('tabindex', '0'); // needed to put focus on the canvas
    canvas.onclick = function() {
        canvas.focus();
    };

    // var tooltip = viewer.entities.add({
    //     label : {
    //         show : false
    //     }
    // });

    var ellipsoid = scene.globe.ellipsoid;

    handler.setInputAction(function(movement) {
        // console.log(movement);
        // flags.looking = true;
        // mousePosition = startMousePosition = Cesium.Cartesian3.clone(movement.position);
    }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

    handler.setInputAction(function(movement) {
        clearPicked();
        // pick
        var pickedObject = scene.pick(movement.endPosition);
        if (Cesium.defined(pickedObject) && (pickedObject.id.toString().indexOf("P_") === 0)) {
            pickedEntities.push(pickedObject);
            // console.log("thing:", pickedObject.primitive);
            // console.log("first:", pickedObject.color);
            pickedObject.primitive.color = new Cesium.Color(1, 1, 0.01, 1);
            // console.log("then:", pickedObject.color);
            // label tooltip
            var cartesian = viewer.camera.pickEllipsoid(movement.endPosition, ellipsoid);
            if (cartesian) {
                var cartographic = ellipsoid.cartesianToCartographic(cartesian);
                var longitudeString = Cesium.Math.toDegrees(cartographic.longitude).toFixed(4);
                var latitudeString = Cesium.Math.toDegrees(cartographic.latitude).toFixed(4);

                // tooltip.position = cartesian;
                // tooltip.label.show = true;
                // tooltip.label.text = '(' + longitudeString + ', ' + latitudeString + ')';
                // tooltip.label.text = pickedObject.id;

                tooltip.innerHTML = "<p>ID:" + pickedObject.id + "</p>";
            }
        } else {
            tooltip.innerHTML = "";
        }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    handler.setInputAction(function(position) {
        // console.log(position);
        // flags.looking = false;
    }, Cesium.ScreenSpaceEventType.LEFT_UP);
}

initMouseHandler(handler);

var globe_data;

r.open("GET", "csv/latlons.txt", true);

r.onreadystatechange = function () {
  if (r.readyState != 4 || r.status != 200) return;
  globe_data = JSON.parse(r.responseText)[1];
  var i, l=globe_data.length;
  for (var i=0; i<l; i=i+3) {
      var p = points.add({
          id: "P_"+globe_data[i+2],
          name: "ConstituentID: " + globe_data[i+2],
          position : new Cesium.Cartesian3.fromDegrees(globe_data[i+1], globe_data[i]),
          color: new Cesium.Color(1, 0.01, 0.01, 1),
          pixelSize : 2,
          scaleByDistance : new Cesium.NearFarScalar(2.0e2, 3, 8.0e5, 1)
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
      pixelSize : 1.5,
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

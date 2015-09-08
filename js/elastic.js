(function () {
    var viewer, scene, canvas, points, handler;

    var baseUrl = "https://ad4dc8ff4b124bbeadb55e68d9df1966.us-east-1.aws.found.io:9243/pic";

    var pickedEntities = [];

    var tooltipElement = document.getElementById("tooltip");

    var facetsElement = document.getElementById("facets");

    var facets = [
        ["addresstypes", "Address Types", "AddressTypeID"],
        // ["nationalities", "Nationality", "Nationality"],
        ["genders", "Gender", "Gender"],
        ["processes", "Process", "TermID"],
        ["formats", "Format", "TermID"]
    ];

    window._pic = this;

    init = function () {
        initWorld();

        var globe_data;

        var r = new XMLHttpRequest();

        r.open("GET", "csv/latlons.txt", true);

        r.onreadystatechange = function () {
          if (r.readyState != 4 || r.status != 200) return;
          globe_data = JSON.parse(r.responseText)[1];
          var i, l=globe_data.length;
          for (i=0; i<l; i=i+3) {
              var p = points.add({
                  id: "P_"+globe_data[i+2],
                  position : new Cesium.Cartesian3.fromDegrees(globe_data[i+1], globe_data[i]),
                  color: new Cesium.Color(1, 0.01, 0.01, 1),
                  pixelSize : 2,
                  scaleByDistance : new Cesium.NearFarScalar(2.0e2, 5, 8.0e5, 1)
              });
          }
        };
        r.send(null);
        initMouseHandler(handler);
        getFacets();
    }

    initWorld = function () {
        viewer = new Cesium.Viewer('cesiumContainer', {
          imageryProvider : new Cesium.OpenStreetMapImageryProvider({
            url : 'https://a.tiles.mapbox.com/v4/nypllabs.f56b1404/', // nypllabs.7f17c2d1
            fileExtension : 'png?access_token=pk.eyJ1IjoibnlwbGxhYnMiLCJhIjoiSFVmbFM0YyJ9.sl0CRaO71he1XMf_362FZQ'
          })
          ,baseLayerPicker : false
          ,homeButton : false
          ,infoBox : false
          ,timeline : false
          ,animation : false
        });

        scene = viewer.scene;
        canvas = viewer.canvas;

        points = scene.primitives.add(new Cesium.PointPrimitiveCollection());
        points._rs = Cesium.RenderState.fromCache({
          depthTest : {
            enabled : true
          },
          depthMask : false,
          blending : Cesium.BlendingState.ADDITIVE_BLEND
        });

        handler = new Cesium.ScreenSpaceEventHandler(canvas);
    }

    clearPicked = function () {
        var entity;
        while (pickedEntities.length>0) {
            entity = pickedEntities.splice(0, 1)[0];
            entity.primitive.color = new Cesium.Color(1, 0.01, 0.01, 1);
        }
    }

    initMouseHandler = function (handler) {
        canvas.setAttribute('tabindex', '0'); // needed to put focus on the canvas
        canvas.onclick = function() {
            canvas.focus();
        };

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

                    showConstituent(pickedObject.id);
                }
            } else {
                updateTooltip("");
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        handler.setInputAction(function(position) {
            // console.log(position);
            // flags.looking = false;
        }, Cesium.ScreenSpaceEventType.LEFT_UP);
    }

    showConstituent = function (id) {
        var realID = id.substr(2);
        getData("constituents", "ConstituentID", realID);
    }

    updateTooltip = function (string) {
        tooltipElement.innerHTML = string;
    }

    getData = function (facet, key, value) {
        // console.log(facet, key, value);

        var r = new XMLHttpRequest();

        var params = "size=100&q=" + key + ":" + value;

        r.open("GET", baseUrl+"/"+facet+"/_search?"+params, true);

        r.onreadystatechange = function () {
            if (r.readyState != 4 || r.status != 200) return;
            var data = JSON.parse(r.responseText);
            var string = "";
            var p = data.hits.hits[0]._source;
            string += "<p>ID:" + p.ConstituentID + "</p>";
            string += "<p>" + p.DisplayName + "</p>";
            string += "<p>" + p.DisplayDate + "</p>";
            updateTooltip(string);
        }

        r.send();
    }

    updatePoints = function (newPoints) {
        points.removeAll();
        var i, l=newPoints.length;
        for (i=0; i<l; i++) {
            var point = points[i];
            points.add({
                position : new Cesium.Cartesian3.fromDegrees(point[0], point[1]),
                color : new Cesium.Color(1, 0.01, 0.01, 1),
                pixelSize : 1.5,
            });
        }
    }

    getFacets = function () {
        for (var i=0; i<facets.length; i++) {
            getFacet(facets[i]);
        }
    }

    getFacet = function (facet) {
        // console.log(facet);
        var r = new XMLHttpRequest();

        r.open("GET", "csv/"+facet[0]+".csv", true);

        r.onreadystatechange = function (event) {
            var r = event.target;
            if (r.readyState != 4 || r.status != 200) return;
            createFacet(r, facet);
        }

        r.send();
    }

    createFacet = function (r, facet) {
        // console.log(r, facet);
        var data = r.responseText.csvToArray();
        if (data.length <=1) return;
        var string = '<label for="'+facet[0]+'">'+facet[1]+'</label>';
        string += '<select id="'+facet[0]+'">';
        string += '<option value="">Select…</option>';
        var i, l=data.length;
        for (i=1; i<l; i++) {
            string += '<option value="'+data[i][0]+'">'+data[i][1]+'</option>';
        }
        string += '</select>';
        facetsElement.innerHTML += string;
    }

    init();
}());

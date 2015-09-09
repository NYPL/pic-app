(function () {
    window._pic = this;

    this.viewer = undefined;
    this.scene = undefined;
    this.canvas = undefined;
    this.points = undefined;
    this.handler = undefined;

    var baseUrl = "https://ad4dc8ff4b124bbeadb55e68d9df1966.us-east-1.aws.found.io:9243/pic";

    // the way we knoe in elastic if a constituent has latlon-looking data
    var latlonQuery = "Remarks:(\-?\d+(\.\d+)?),\s*(\-?\d+(\.\d+)?)";
    var elasticSize = 300;

    var pickedEntity = undefined;

    var tooltipElement = $("#tooltip");

    var facetsElement = $("#facets");

    var elasticResults = {};

    var facets = [
        ["addresstypes", "Address Types", "AddressTypeID", "AddressType"],
        ["nationalities", "Nationality", "Nationality", "Nationality"],
        ["genders", "Gender", "TermID", "Term"],
        ["processes", "Process", "TermID", "Term"],
        ["formats", "Format", "TermID", "Term"]
    ];

    init = function () {
        initWorld();

        var globe_data;

        var r = new XMLHttpRequest();

        r.open("GET", "csv/latlons.txt", true);

        r.onreadystatechange = function () {
          if (r.readyState != 4 || r.status != 200) return;
          globe_data = JSON.parse(r.responseText)[1];
          updatePoints(globe_data);
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

    clearPicked = function (picked) {
        if (pickedEntity != undefined) {
            pickedEntity.primitive.color = new Cesium.Color(1, 0.01, 0.01, 1);
        }
        pickedEntity = picked;
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
            // pick
            var pickedObject = scene.pick(movement.endPosition);
            if (Cesium.defined(pickedObject) && (pickedObject.id.toString().indexOf("P_") === 0)) {
                if (pickedObject !== pickedEntity) {
                    clearPicked(pickedObject);
                    pickedObject.primitive.color = new Cesium.Color(1, 1, 0.01, 1);
                }
                // console.log("thing:", pickedObject.primitive);
                // console.log("first:", pickedObject.color);
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
                removeTooltip();
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        handler.setInputAction(function(position) {
            // console.log(position);
            // flags.looking = false;
        }, Cesium.ScreenSpaceEventType.LEFT_UP);
    }

    showConstituent = function (id) {
        var realID = id.substr(2);
        getData("constituents", "ConstituentID:" + realID, updateTooltip);
    }

    removeTooltip = function () {
        tooltipElement.html("");
    }

    updateTooltip = function (responseText) {
        var data = JSON.parse(responseText);
        var string = "";
        var p = data.hits.hits[0]._source;
        string += "<p>ID:" + p.ConstituentID + "</p>";
        string += "<p>" + p.DisplayName + "</p>";
        string += "<p>" + p.DisplayDate + "</p>";
        tooltipElement.html(string);
    }

    getData = function (facet, query, callback) {
        // console.log(facet, key, value);

        var r = new XMLHttpRequest();

        var params = query;

        r.open("POST", baseUrl+"/"+facet+"/_search?"+params, true);

        r.onreadystatechange = function () {
            if (r.readyState != 4 || r.status != 200) return;
            callback(r.responseText);
        }

        r.send();
    }

    updatePoints = function (newPoints) {
        points.removeAll();
        if (newPoints.length === 0) return;
        var i, l=newPoints.length;
        for (i=0; i<l; i=i+3) {
            points.add({
                id: "P_"+newPoints[i+2],
                position : new Cesium.Cartesian3.fromDegrees(newPoints[i+1], newPoints[i]),
                color: new Cesium.Color(1, 0.01, 0.01, 1),
                pixelSize : 2,
                scaleByDistance : new Cesium.NearFarScalar(2.0e2, 5, 9.0e5, 1)
            });
        }
        viewer.flyTo(points);
    }

    facetWithName = function (name) {
        for (var i=0;i<facets.length;++i) {
            if (facets[i][0]==name) return facets[i];
        }
        return -1;
    }

    getFacets = function () {
        for (var i=0;i<facets.length;++i) {
            getFacet(i);
        }
    }

    getFacet = function (index) {
        var facet = facets[index];

        createFacet(facet);
        addListenersToFacet(facet);

        var r = new XMLHttpRequest();

        r.open("GET", "csv/"+facet[0]+".csv", true);

        r.onreadystatechange = function (event) {
            var r = event.target;
            if (r.readyState != 4 || r.status != 200) return;
            updateFacet(r, facet);
        }

        r.send();
    }

    filterForFacet = function (facetName, value) {
        var facet = facetWithName(facetName);
        if (facet === -1) return;
        var idColumn = facet[2];
        var valueColumn = facet[3];
        var addresses = [];
        var query = "size=300&q=";
        console.log(facetName, idColumn, valueColumn, value);
        // addresstypes just need to ping constituents directly (no "join")
        if (facetName != "addresstypes") {
            // get all IDs for the given facet
            query += idColumn + ":" + value;
            getData(facet[1].toLowerCase(), query, function (r) {
                // get the latlons for the list of IDs
                // TODO: serve more than 1000 results
                var results = JSON.parse(r);
                if (results.hits.total === 0) return;
                var idList = [];
                for (var i=0; i<results.hits.hits.length;++i) {
                    idList.push(results.hits.hits[i]._source.ConstituentID);
                }
                query = "size=300&q=" + "(" + latlonQuery + " AND ConstituentID:("+idList.join(" OR ")+"))";
                console.log(query);
                getData("constituentaddresses", query, addressesToPoints);
            });
        } else {
            console.log(query);
            query = "size=300&q=" + "(" + latlonQuery + " AND (" + facet[2] + ":" + value + "))";
            getData("constituentaddresses", query, addressesToPoints);
        }
    }

    addressesToPoints = function (re) {
        var addresses = [];
        var results = JSON.parse(re);
        console.log(results);
        var hits = results.hits.hits;
        var i, l = hits.length;
        for (i=0; i<l; ++i) {
            var item = hits[i]._source;
            var remarks = item.Remarks.split(",");
            if (remarks.length !== 2) continue;
            var lat = parseFloat(remarks[0]);
            var lon = parseFloat(remarks[1]);
            var id = item.ConstituentID;
            addresses.push(lat, lon, id);
        }
        updatePoints(addresses);
    }

    createFacet = function (facet) {
        // console.log(r, facet);
        var string = '<label for="'+facet[0]+'">'+facet[1]+'</label>';
        string += '<select id="'+facet[0]+'" name="'+facet[0]+'">';
        string += '<option value="">Select…</option>';
        string += '</select>';
        facetsElement.append(string);
    }

    updateFacet = function (r, facet) {
        var data = r.responseText.csvToArray();
        if (data.length <= 1) return;
        var el = $("#"+facet[0]);
        var idColumn = data[0].indexOf(facet[2]);
        var valueColumn = data[0].indexOf(facet[3]);
        var i, l=data.length;
        var string = "";
        for (i=1; i<l; i++) {
            string += '<option value="'+data[i][idColumn]+'">'+data[i][valueColumn]+'</option>';
        }
        el.append(string);
    }

    onFacetChanged = function (e) {
        var el = e.target;
        var index = el.selectedIndex;
        var value = el.value
        filterForFacet(el.id, value);
    }

    addListenersToFacet = function (facet) {
        var el = document.getElementById(facet[0]);
        el.addEventListener("change", onFacetChanged, false);
    }

    init();
}());

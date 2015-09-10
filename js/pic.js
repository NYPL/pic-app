(function () {
    window._pic = this;

    this.viewer = undefined;
    this.scene = undefined;
    this.canvas = undefined;
    this.points = undefined;
    this.handler = undefined;

    var baseUrl = "https://ad4dc8ff4b124bbeadb55e68d9df1966.us-east-1.aws.found.io:9243/pic";

    // the way we knoe in elastic if a constituent has latlon-looking data
    var latlonQuery = "address.Remarks:(\-?\d+(\.\d+)?),\s*(\-?\d+(\.\d+)?)";
    var elasticSize = 300;

    var pickedEntity = undefined;

    var tooltipElement = $("#tooltip");

    var facetsElement = $("#facets");

    this.elasticResults = {};

    var facets = [
        ["addresstypes", "Address Types", "AddressTypeID", "AddressType", "address"],
        ["nationalities", "Nationality", "Nationality", "Nationality", ""],
        ["genders", "Gender", "TermID", "Term", "gender"],
        ["processes", "Process", "TermID", "Term", "process"],
        ["formats", "Format", "TermID", "Term", "format"]
    ];

    var filters = {};

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
        getData("constituent", "q=ConstituentID:" + realID, updateTooltip);
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
                scaleByDistance : new Cesium.NearFarScalar(2.0e2, 5, 8.0e5, 1)
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

    disableFacets = function () {
        $("#facets").hide();
    }

    enableFacets = function () {
        $("#facets").show();
    }

    applyFilters = function () {
        disableFacets();
        var facetList = [];
        for (var k in filters) {
            if (filters[k] != "*") facetList.push("("+k+":"+filters[k]+")");
        }
        var addresses = [];
        var query = facetList.length > 0 ? "q=(" + facetList.join(" AND ") + ")" : "";
        query = "size=" + elasticSize + "&" + query;
        // console.log(facetName, idColumn, valueColumn, value);
        elasticResults = {};
        elasticResults.query = query;
        elasticResults.from = 0;
        elasticResults.hits = [];
        getData("constituent", query, getNextSet);
    }

    getNextSet = function (re) {
        var results = JSON.parse(re);
        // console.log(results);
        elasticResults.hits = elasticResults.hits.concat(results.hits.hits);
        if (results.hits.total > elasticResults.from + elasticSize) {
            // keep going
            var query = elasticResults.query;
            elasticResults.from += elasticSize;
            query = "from=" + elasticResults.from + "&" + query;
            getData("constituent", query, getNextSet);
        } else {
            addressesToPoints();
            enableFacets();
        }
    }

    addressesToPoints = function (re) {
        var addresses = [];
        var hits = elasticResults.hits;
        var i, l = hits.length;
        for (i=0; i<l; ++i) {
            var item = hits[i]._source;
            if (item.address === undefined) continue;
            var remarks = item.address[0].Remarks.split(",");
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
        string += '<option value="*">Any</option>';
        string += '</select>';
        facetsElement.append(string);
        updateFilter(facet[0], "*");
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

    updateFilter = function (facetName, value) {
        var facet = facetWithName(facetName);
        if (facet[4] != "") {
            filters[facet[4]+"."+facet[2]] = value;
        } else {
            filters[facet[2]] = value;
        }
    }

    onFacetChanged = function (e) {
        var el = e.target;
        var index = el.selectedIndex;
        var value = el.value;
        updateFilter(el.id, value);
        applyFilters();
    }

    addListenersToFacet = function (facet) {
        var el = document.getElementById(facet[0]);
        el.addEventListener("change", onFacetChanged, false);
    }

    init();
}());

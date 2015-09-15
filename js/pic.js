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
    this.elasticSize = 1500;

    var pickedEntity = undefined;

    var tooltipElement = $("#tooltip");

    var facetsElement = $("#facets");

    this.elasticResults = {};
    this.pointHash = {};
    this.allIDs = [];

    var bounds = [-180, -90, 180, 90];
    var padding = 0.1; // to extend the boundary a bit

    var pixelSize = 2;

    var facets = [
        ["addresstypes", "Address Types", "AddressTypeID", "AddressType", "address"],
        ["nationalities", "Nationality", "Nationality", "Nationality", ""],
        ["genders", "Gender", "TermID", "Term", "gender"],
        ["processes", "Process", "TermID", "Term", "process"],
        ["roles", "Role", "TermID", "Term", "role"],
        ["formats", "Format", "TermID", "Term", "format"]
    ];

    var facetValues = {};

    var start;

    var addressTypePalette = {
        "2": new Cesium.Color(0.01, 1, 1, 1), // biz
        "5": new Cesium.Color(0.01, 1, 0.01, 1), // birth
        "6": new Cesium.Color(0.01, 0.01, 1, 1), // death
        "7": new Cesium.Color(1, 0.01, 0.01, 1), // active
        "1": new Cesium.Color(1, 0.01, 1, 1), // unknown
    };

    var filters = {};

    init = function () {
        initWorld();
        loadBaseData();
        initMouseHandler(handler);
        getFacets();
    }

    loadBaseData = function () {
        var r = new XMLHttpRequest();

        r.open("GET", "csv/latlons.txt", true);

        r.onreadystatechange = function () {
          if (r.readyState != 4 || r.status != 200) return;
          var baseData = JSON.parse(r.responseText)[1];
          parseBaseData(baseData);
          displayBaseData();
        };
        r.send(null);
    }

    parseBaseData = function (baseData) {
        var i, l = baseData.length;
        pointHash = {};
        for (i=0; i<l; i=i+5) {
            var cid = baseData[i+3];
            pointHash[cid] = [
                baseData[i],
                baseData[i+1],
                baseData[i+2],
                cid,
                baseData[i+4]
            ];
            allIDs.push(cid);
        }
    }

    displayBaseData = function () {
        addPoints(allIDs);
        updateTotals(allIDs.length);
        enableFacets();
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
          ,navigationHelpButton : false
          ,navigationInstructionsInitiallyVisible : false
          ,mapProjection : new Cesium.WebMercatorProjection()
          ,creditContainer : "credits"
          ,sceneMode : Cesium.SceneMode.SCENE2D
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
        if (picked !== pickedEntity) {
            if (pickedEntity != undefined) {
                // revert properties
                pickedEntity.entity.primitive.color = pickedEntity.color;
                pickedEntity.entity.primitive.pixelSize = pixelSize;
            }
            pickedEntity = {
                color: Cesium.clone(picked.primitive.color),
                entity: picked
            };
            // apply new properties
            picked.primitive.color = new Cesium.Color(1, 1, 0.01, 1);
            pickedEntity.entity.primitive.pixelSize = pixelSize*pixelSize;
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
            // pick
            var pickedObject = scene.pick(movement.endPosition);
            if (Cesium.defined(pickedObject) && (pickedObject.id.toString().indexOf("P_") === 0)) {
                clearPicked(pickedObject);
                // console.log("first:", pickedObject.color);
                // console.log("then:", pickedObject.color);
                // label tooltip
                var cartesian = viewer.camera.pickEllipsoid(movement.endPosition, ellipsoid);
                if (cartesian) {
                    var cartographic = ellipsoid.cartesianToCartographic(cartesian);
                    var longitudeString = Cesium.Math.toDegrees(cartographic.longitude).toFixed(4);
                    var latitudeString = Cesium.Math.toDegrees(cartographic.latitude).toFixed(4);

                    showConstituent(pickedObject);
                }
            } else {
                // removeTooltip();
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        handler.setInputAction(function(position) {
            // console.log(position);
            // flags.looking = false;
        }, Cesium.ScreenSpaceEventType.LEFT_UP);
    }

    showConstituent = function (point) {
        var id = point.id;
        var originalLatlon = point.primitive.originalLatlon;
        var realID = id.substr(2);
        var query = "q=(ConstituentID:" + realID + " OR address.Remarks:'" + originalLatlon + "')";
        // console.log(query);
        getData("constituent", query, updateTooltip);
    }

    removeTooltip = function () {
        tooltipElement.html("");
    }

    updateTooltip = function (responseText) {
        var data = JSON.parse(responseText);
        var string = "";
        var p = data.hits.hits[0]._source;
        string += "<p><strong>" + p.DisplayName + "</strong></p>";
        string += "<p>ID:" + p.ConstituentID + "</p>";
        string += "<p>" + p.DisplayDate + "</p>";
        if (p.gender) string += "<p>" + facetValues.genders[p.gender[0].TermID] + "</p>";
        if (p.role) {
            string += "<p><strong>Roles:</strong></p>";
            string += "<p>";
            var roles = [];
            for (var i in p.role) {
                roles.push(facetValues.roles[p.role[i].TermID]);
            }
            string += roles.join(", ");
            string += "</p>";
        }
        if (p.address) {
            string += "<p><strong>Addresses:</strong></p>";
            for (var i in p.address) {
                var add = p.address[i];
                string += "<p>";
                string += add.City;
                string += ", ";
                string += add.State;
                string += "<br />";
                string += add.DisplayName2;
                string += "</p>";
            }
        }
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

    addPoints = function (newPoints) {
        // points.removeAll();
        // if (newPoints.length === 0) return;
        // console.log(newPoints);
        var addressType = $("#"+facets[0][0]).val();
        var i, l = newPoints.length;
        for (i=0; i<l; i++) {
            var p = pointHash[newPoints[i]];
            if (!p) continue;
            // hack, because elastic returns all addresses of a given id
            var tid = p[4];
            if (addressType != "*" && tid != addressType) continue;
            // end hack
            elasticResults.total++;
            if (p[1] > bounds[0]) bounds[0] = p[1] + padding;
            if (p[0] > bounds[1]) bounds[1] = p[0] + padding;
            if (p[1] < bounds[2]) bounds[2] = p[1] - padding;
            if (p[0] < bounds[3]) bounds[3] = p[0] - padding;
            var pt = points.add({
                id: "P_"+p[2],
                position : new Cesium.Cartesian3.fromDegrees(p[1], p[0]),
                color: addressTypePalette[p[4]],//new Cesium.Color(1, 0.01, 0.01, 1),
                pixelSize : pixelSize,
                scaleByDistance : new Cesium.NearFarScalar(2.0e3, 6, 8.0e6, 1)
            });
            pt.originalLatlon = p[0] + "," + p[1];
        }
        updateTotals();
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
        $("#facets select").prop('disabled', 'disabled');
        $("#tooltip").html("").hide();
    }

    enableFacets = function () {
        $("#facets select").prop('disabled', '');
        $("#tooltip").show();
    }

    removePoints = function () {
        bounds = [-180, -90, 180, 90];
        points.removeAll();
    }

    applyFilters = function () {
        start = new Date().getTime();
        disableFacets();
        removePoints();
        var facetList = [];
        for (var k in filters) {
            if (filters[k] != "*") facetList.push("("+k+":"+filters[k]+")");
        }
        if (facetList.length === 0) {
            displayBaseData();
            return;
        }
        var addresses = [];
        var query = facetList.length > 0 ? "q=(" + facetList.join(" AND ") + ")" : "";
        query = "_source=address.ConAddressID&size=" + elasticSize + "&" + query;
        console.log(query);
        // reset elastic results to prepare for the new set
        elasticResults = {};
        elasticResults.query = query;
        elasticResults.from = 0;
        elasticResults.hits = [];
        elasticResults.total = 0;
        getData("constituent", query, getNextSet);
    }

    getNextSet = function (re) {
        var results = JSON.parse(re);
        // console.log(results);
        // elasticResults.hits = elasticResults.hits.concat(results.hits.hits);
        if (results.hits.total > elasticResults.from + elasticSize) {
            // keep going
            var query = elasticResults.query;
            elasticResults.from += elasticSize;
            query = "from=" + elasticResults.from + "&" + query;
            getData("constituent", query, getNextSet);
        } else {
            var end = new Date().getTime();
            var time = end - start;
            console.log("took:", time, "ms");
            enableFacets();
        }
        addressesToPoints(results.hits.hits);
        if (results.hits.total < elasticResults.from + elasticSize) {
            // console.log(bounds);
            var west = bounds[2];
            var south = bounds[3];
            var east = bounds[0];
            var north = bounds[1];
            viewer.camera.flyTo({
                destination : Cesium.Rectangle.fromDegrees(west, south, east, north)
            });
        }
    }

    addressesToPoints = function (hits) {
        var addresses = [];
        // var hits = elasticResults.hits;
        // console.log(elasticResults);
        var i, j, l = hits.length;
        for (i=0; i<l; ++i) {
            var item = hits[i]._source;
            if (item.address === undefined) continue;
            for (j=0; j<item.address.length; ++j) {
                // var remarks = item.address[j].Remarks.split(",");
                // if (remarks.length !== 2) continue;
                // hack, because elastic returns all addresses of a given id
                // var tid = item.address[j].AddressTypeID == "NULL" ? 1 : item.address[j].AddressTypeID;
                // if (addressType != "*" && tid != addressType) continue;
                // end hack
                // var lat = parseFloat(remarks[0]);
                // var lon = parseFloat(remarks[1]);
                // var id = item.ConstituentID;
                // var cid = item.address[j].ConAddressID;
                addresses.push(item.address[j].ConAddressID);
            }
        }
        addPoints(addresses);
    }

    updateTotals = function (total) {
        if (total === undefined) total = elasticResults.total;
        $("#totalPoints").text(total + " total locations");
    }

    createFacet = function (facet) {
        // console.log(r, facet);
        var f = facet[0];
        var string = '<label for="'+f+'">'+facet[1]+'</label>';
        string += '<select id="'+f+'" name="'+f+'">';
        string += '<option value="*">Any</option>';
        string += '</select>';
        $("#facetList").append(string);
        facetValues[f] = {};
        updateFilter(f, "*");
    }

    updateFacet = function (r, facet) {
        var data = r.responseText.csvToArray();
        if (data.length <= 1) return;
        var el = $("#"+facet[0]);
        var idColumn = data[0].indexOf(facet[2]);
        var valueColumn = data[0].indexOf(facet[3]);
        facetValues[facet[0]] = {};
        var i, l=data.length;
        var string = "";
        for (i=1; i<l; i++) {
            string += '<option value="'+data[i][idColumn]+'">'+data[i][valueColumn]+'</option>';
            facetValues[facet[0]][data[i][idColumn]] = data[i][valueColumn];
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

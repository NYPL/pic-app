(function () {
    window._pic = this;

    this.viewer;
    this.scene;
    this.canvas;
    this.points;
    this.handler;
    this.elasticResults = {};
    this.pointHash = {};
    this.allIDs = [];
    this.elasticSize = 1500;
    this.lines;

    var bounds;
    var padding = 0.1; // to extend the boundary a bit
    var pixelSize = 2;
    var tooltipLimit = 20;

    var pickedEntity;

    var baseUrl = "https://ad4dc8ff4b124bbeadb55e68d9df1966.us-east-1.aws.found.io:9243/pic";

    // the way we knoe in elastic if a constituent has latlon-looking data
    var latlonQuery = "address.Remarks:(\-?\d+(\.\d+)?),\s*(\-?\d+(\.\d+)?)";


    var tooltipElement = $("#tooltip");

    var facetsElement = $("#facets");

    var nameQueryElement = "nameQuery";

    var facets = [
        ["addresstypes", "Address Types", "AddressTypeID", "AddressType", "address"],
        ["countries", "Address Country", "CountryID", "Country", "address"],
        ["nationalities", "Nationality", "Nationality", "Nationality", ""],
        ["genders", "Gender", "TermID", "Term", "gender"],
        ["processes", "Process", "TermID", "Term", "process"],
        ["roles", "Role", "TermID", "Term", "role"],
        ["formats", "Format", "TermID", "Term", "format"],
        ["biographies", "Source", "TermID", "Term", "biography"],
        [nameQueryElement, "", "DisplayName", "", ""]
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
        resetBounds();
        initWorld();
        loadBaseData();
        initMouseHandler(handler);
        initNameQuery();
        getFacets();
    }

    loadBaseData = function () {
        var r = new XMLHttpRequest();

        r.open("GET", "csv/latlons.txt?i=" + Math.random()*100000, true);

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
        allIDs = [];
        pointHash = {};
        for (i=0; i<l; i=i+6) {
            var id = baseData[i+3];
            pointHash[id] = [
                baseData[i],
                baseData[i+1],
                baseData[i+2],
                id,
                baseData[i+4],
                baseData[i+5]
            ];
            allIDs.push(id);
        }
    }

    displayBaseData = function () {
        addPoints(allIDs);
        updateTotals(allIDs.length);
        enableFacets();
        updateBounds();
    }

    initWorld = function () {
        viewer = new Cesium.Viewer('cesiumContainer', {
          imageryProvider : new Cesium.OpenStreetMapImageryProvider({
            url : 'https://a.tiles.mapbox.com/v4/nypllabs.8e20560b/', // nypllabs.7f17c2d1
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
          ,selectionIndicator : false
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

        lines = new Cesium.PolylineCollection();

        scene.primitives.add(lines);

        handler = new Cesium.ScreenSpaceEventHandler(canvas);
    }

    debug = function () {
        viewer.extend(Cesium.viewerCesiumInspectorMixin);
    }

    refreshPicked = function (picked) {
        if (pickedEntity === undefined || picked !== pickedEntity.entity) {
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
            showConstituent(picked);
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
            if (Cesium.defined(pickedObject) && pickedObject.id &&  (pickedObject.id.toString().indexOf("P_") === 0)) {
                refreshPicked(pickedObject);
                // console.log("then:", pickedObject.color);
                // label tooltip
                // var cartesian = viewer.camera.pickEllipsoid(movement.endPosition, ellipsoid);
                // if (cartesian) {
                //     var cartographic = ellipsoid.cartesianToCartographic(cartesian);
                //     var longitudeString = Cesium.Math.toDegrees(cartographic.longitude).toFixed(4);
                //     var latitudeString = Cesium.Math.toDegrees(cartographic.latitude).toFixed(4);
                //     console.log(latitudeString, longitudeString);
                // }
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        handler.setInputAction(function(position) {
            // console.log(position);
            // flags.looking = false;
        }, Cesium.ScreenSpaceEventType.LEFT_UP);
    }

    showConstituent = function (point) {
        if (point == pickedEntity) return;
        var id = point.id;
        var originalLatlon = point.primitive.originalLatlon;
        var realID = id.substr(2);
        var query = "size="+tooltipLimit+"&q=(ConstituentID:" + realID + " OR address.Remarks:'" + originalLatlon + "')";
        console.log(query);
        getData("constituent", query, updateTooltip);
    }

    removeTooltip = function () {
        tooltipElement.html("");
    }

    updateTooltip = function (responseText) {
        tooltipElement.empty();
        var data = JSON.parse(responseText);
        var constituents = data.hits.hits;
        if (data.hits.total > tooltipLimit) {
            var string = "<p>Found " + data.hits.total + " photographers in this location. Showing first " + tooltipLimit + ".</p>";
            tooltipElement.append(string);
        }
        for (var i=0; i<constituents.length; i++) {
            buildTooltipConstituent(constituents[i]._source);
        }
    }

    buildTooltipConstituent = function (p) {
        var addressIDs = [];
        var string = '<div class="tooltip-item">';
        string += '<h3 class="tooltip-toggle-'+p.ConstituentID+'">' + p.DisplayName;
        if (p.address) string += ' (' + p.address.length + ')';
        string += '</h3>';
        string += '<div class="hidden tooltip-content-'+p.ConstituentID+'">';
        string += "<p>";
        string += '<a href="http://digitalcollections.nypl.org/search/index?utf8=%E2%9C%93&keywords=' + (p.DisplayName.replace(/\s/g, "+")) + '">View photos in Digital Collections</a><br />';
        string += "ID:" + p.ConstituentID + "<br />";
        string += p.DisplayDate + "<br />";
        if (p.gender) string += facetValues.genders[p.gender[0].TermID] + "<br />";
        string += "</p>";
        if (p.role) {
            string += "<p>";
            string += "<strong>Roles:</strong><br />";
            var roles = [];
            for (var i in p.role) {
                roles.push(facetValues.roles[p.role[i].TermID]);
            }
            string += roles.join(", ");
            string += "</p>";
        }
        if (p.address) {
            string += "<p>";
            string += "<strong>Addresses:</strong>";
            if (p.address.length > 1) string += '<br /><span class="connector tooltip-connector-'+p.ConstituentID+'">Connect</span>';
            string += "</p>";
            for (var i=0; i<p.address.length; i++) {
                var add = p.address[i];
                addressIDs.push(add.ConAddressID);
                string += "<p>";
                string += "ID:" + add.ConAddressID + "<br />";
                string += facetValues.addresstypes[add.AddressTypeID] + "<br />";
                if (add.DisplayName2 != "NULL") string += add.DisplayName2 + "<br />";
                if (add.StreetLine1 != "NULL") string += add.StreetLine1 + "<br />";
                if (add.StreetLine2 != "NULL") string += add.StreetLine2 + "<br />";
                if (add.StreetLine3 != "NULL") string += add.StreetLine3 + "<br />";
                if (add.City != "NULL") string += add.City + ", ";
                if (add.State != "NULL") string += add.State + "<br />";
                if (add.CountryID != "NULL") string += facetValues.countries[add.CountryID] + "<br />";
                if (add.Remarks != "NULL") string += add.Remarks + "<br />";
                string += "</p>";
            }
        }
        string += "</div>";
        tooltipElement.append(string);
        $(".tooltip-toggle-" + p.ConstituentID).click(function () {
            $(".tooltip-content-" + p.ConstituentID).fadeToggle(100);
        });
        $(".tooltip-connector-" + p.ConstituentID).click(function () {
            connectAddresses(addressIDs);
        });
    }

    resetBounds = function () {
        bounds = [-180, -90, 180, 90];
    }

    expandBounds = function (p) {
        if (p[1] > bounds[0]) bounds[0] = p[1] + padding;
        if (p[0] > bounds[1]) bounds[1] = p[0] + padding;
        if (p[1] < bounds[2]) bounds[2] = p[1] - padding;
        if (p[0] < bounds[3]) bounds[3] = p[0] - padding;
    }

    connectAddresses = function (ids) {
        resetBounds();
        lines.removeAll();
        if (ids.length > 1) {
            var addresses = sortAddresses(getAddressPoints(ids));
            var lastPoint = addresses[0];
            for (var i=0; i<ids.length; i++) {
                var p = addresses[i];
                // console.log(p, ids[i]);
                if (p === undefined) continue;
                expandBounds(p);
                if (lastPoint === p) {
                    continue;
                }
                lines.add({
                    color : Cesium.Color.ORANGE,
                    positions : Cesium.Cartesian3.fromDegreesArray([
                             p[1], p[0],
                             lastPoint[1], lastPoint[0]]),
                    width : 2
                });
                lastPoint = p;
            }
            updateBounds();
        }
    }

    getAddressPoints = function (ids) {
        var addresses = [];
        for (var i=0; i<ids.length; i++) {
            var p = pointHash[ids[i]];
            if (p !== undefined) addresses.push(p);
        }
        // console.log(addresses);
        return addresses;
    }

    sortAddresses = function (addresses) {
        var sorted = [];
        var i, l = addresses.length;
        var born;
        var died;
        if (l <= 1) return addresses;
        // put the active ones
        for (i=0; i<l; ++i) {
            var add = addresses[i];
            if (add[4] === 7) {
                sorted.push(add);
            }
            // find born if any
            if (add[4] === 5) {
                born = add;
            }
            // find died if any
            if (add[4] === 6) {
                died = add;
            }
        }
        // put the biz ones
        for (i=0; i<l; ++i) {
            if (addresses[i][4] === 2) {
                sorted.push(addresses[i]);
            }
        }
        // prepend born
        if (born) sorted.unshift(born);
        // append died
        if (died) sorted.push(died);
        // console.log(addresses, sorted);
        return sorted;
    }
/*
width : 5,
material : new Cesium.PolylineOutlineMaterialProperty({
    color : Cesium.Color.ORANGE,
    outlineWidth : 2,
    outlineColor : Cesium.Color.BLACK
})
*/
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
        var addressType = $("#"+facetWithName("addresstypes")[0]).val();
        var country = $("#"+facetWithName("countries")[0]).val();
        var i, l = newPoints.length;
        for (i=0; i<l; i++) {
            var p = pointHash[newPoints[i]];
            if (!p) continue;
            // hack, because elastic returns all addresses of a given id
            var tid = p[4];
            var cid = p[5];
            if (addressType != "*" && tid != addressType) continue;
            if (country != "*" && cid != country) continue;
            // end hack
            elasticResults.total++;
            expandBounds(p);
            var pt = points.add({
                id: "P_"+p[2],
                position : Cesium.Cartesian3.fromDegrees(p[1], p[0]),
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
            if (facets[i][1] != "") getFacet(i);
        }
    }

    getFacet = function (index) {
        var facet = facets[index];

        createFacet(facet);
        addListenersToFacet(facet);

        var r = new XMLHttpRequest();

        r.open("GET", "csv/"+facet[0]+".csv?i=" + Math.random()*100000, true);

        r.onreadystatechange = function (event) {
            var r = event.target;
            if (r.readyState != 4 || r.status != 200) return;
            updateFacet(r, facet);
        }

        r.send();
    }

    createFacet = function (facet) {
        // console.log(r, facet);
        var f = facet[0];
        var string = '<div class="facet">';
        string += '<label for="'+f+'">'+facet[1]+'</label>';
        string += '<select id="'+f+'" class="facet" name="'+f+'">';
        string += '<option value="*">Any</option>';
        string += '</select>';
        string += '</div>';
        $("#facetList").append(string);
        facetValues[f] = {};
        updateFilter(f, "*");
    }

    updateFacet = function (r, facet) {
        var data = r.responseText.csvToArray({trim:true, rSep: '\n'});
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

    disableFacets = function () {
        $("#facets .facet").prop('disabled', 'disabled');
        $("#tooltip").html("").hide();
    }

    enableFacets = function () {
        $("#facets .facet").prop('disabled', '');
        $("#tooltip").show();
    }

    removePoints = function () {
        resetBounds();
        points.removeAll();
        lines.removeAll();
    }

    applyFilters = function () {
        start = new Date().getTime();
        pickedEntity = undefined;
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
        if (results.hits.total <= elasticResults.from + elasticSize) {
            updateBounds();
        }
    }

    updateBounds = function () {
        // console.log(bounds);
        var west = bounds[2];
        var south = bounds[3];
        var east = bounds[0];
        var north = bounds[1];
        viewer.camera.flyTo({
            destination : Cesium.Rectangle.fromDegrees(west, south, east, north),
            duration : 1
        });
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
                addresses.push(item.address[j].ConAddressID);
            }
        }
        addPoints(addresses);
    }

    updateTotals = function (total) {
        if (total === undefined) total = elasticResults.total;
        $("#totalPoints").text(total + " total locations");
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

    onKeyUp = function (e) {
        var el = e.target;
        if (e.keyCode === 13) {
            var value = el.value.trim() != "" ? '"' + el.value.trim() + '"' : "*"
            updateFilter(el.id, value);
            applyFilters();
        }
    }

    addListenersToFacet = function (facet) {
        var el = document.getElementById(facet[0]);
        el.addEventListener("change", onFacetChanged, false);
    }

    initNameQuery = function () {
        $("#" + nameQueryElement).val("");
        updateFilter(nameQueryElement, "*");
        var el = document.getElementById(nameQueryElement);
        el.addEventListener("keyup", onKeyUp, false);
    }

}());

window.onload = function () {
    _pic.init();
}

(function () {
    window._pic = this;

    this.viewer;
    this.scene;
    this.canvas;
    this.points;
    this.handler;
    this.elasticResults = {};
    this.pointHash = {};
    this.latlonHeightHash = {};
    this.heightHash = {};
    this.allIDs = [];
    this.elasticSize = 1500;
    this.lines;

    var bounds;
    var padding = 0.1; // to extend the boundary a bit
    var tooltipLimit = 20;
    var heightDelta = 100;
    var lineWidth = 2;
    var pixelSize = 2;
    var minScale = 1;
    var maxScale = 4;

    var debug = false;

    var pickedEntity;
    var mousePosition, startMousePosition;
    var lastID, lastLatlon;

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
        ["collections", "Collections", "TermID", "Term", "collection"],
        [nameQueryElement, "", "DisplayName", "", ""]
    ];

    var facetValues = {};

    var start;

    var selectedColor = new Cesium.Color(1, 1, 0.2, 1);
    var bizColor = new Cesium.Color(1, 0.50, 0.001, 1);
    var birthColor = new Cesium.Color(0.30, 0.68, 0.29, 1);
    var diedColor = new Cesium.Color(0.21, 0.49, 0.72, 1);
    var activeColor = new Cesium.Color(0.89, 0.10, 0.10, 1);
    var unknownColor = new Cesium.Color(1, 0.01, 1, 1);

    var addressTypePalette = {
        "2": bizColor, // biz
        "5": birthColor, // birth
        "6": diedColor, // death
        "7": activeColor, // active
        "1": unknownColor, // unknown
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

    loadTextFile = function (path, callback) {
        var r = new XMLHttpRequest();

        r.open("GET", path, true);

        r.onreadystatechange = function () {
            if (r.readyState != 4 || r.status != 200) return;
            callback(r.responseText);
        };
        r.send();
    }

    loadBaseData = function () {
        loadTextFile("csv/latlons.txt?i=" + Math.random()*100000, function (responseText) {
            var baseData = JSON.parse(responseText)[1];
            parseBaseData(baseData);
        });
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

        loadTextFile("csv/heights.txt?i=" + Math.random()*100000, function (responseText) {
            var heightData = JSON.parse(responseText)[1];
            var i, l = heightData.length;
            for (i=0; i<l; i=i+2) {
                var id = heightData[i];
                if (pointHash[id] === undefined) continue;
                pointHash[id][6] = heightData[i+1];
            }
            displayBaseData();
        });
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
          ,skyBox : false
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

        lines = viewer.entities.add(new Cesium.Entity());

        handler = new Cesium.ScreenSpaceEventHandler(canvas);
    }

    debugMode = function () {
        debug = true;
        viewer.extend(Cesium.viewerCesiumInspectorMixin);
    }

    refreshPicked = function (picked) {
        var showHover = false;
        // reset
        if (pickedEntity != undefined && picked !== pickedEntity.entity) {
            // revert properties
            pickedEntity.entity.primitive.color = pickedEntity.color;
            pickedEntity.entity.primitive.pixelSize = pixelSize;
        }
        if (Cesium.defined(picked) && picked.id &&  (picked.id.toString().indexOf("P_") === 0)) {
            if (pickedEntity === undefined || picked !== pickedEntity.entity) {
                pickedEntity = {
                    color: Cesium.clone(picked.primitive.color),
                    entity: picked
                };
                // apply new properties
                picked.primitive.color = selectedColor;
                pickedEntity.entity.primitive.pixelSize = pixelSize*pixelSize;
            }
            showHover = true;
        } else {
            // reset
            pickedEntity = undefined;
        }
        positionHover(showHover);
    }

    pickEntity = function (windowPosition) {
        var picked = viewer.scene.pick(windowPosition);
        if (picked !== undefined) {
            var id = Cesium.defaultValue(picked.id, picked.primitive.id);
            if (Cesium.defined(id)) {
                return picked;
            }
        }
        return undefined;
    };


    initMouseHandler = function (handler) {
        canvas.setAttribute('tabindex', '0'); // needed to put focus on the canvas
        canvas.onclick = function(e) {
            canvas.focus();
            // console.log(mousePosition, startMousePosition, e);
            if (mousePosition != startMousePosition) return;
            var pickedObject = pickEntity({x:e.layerX, y:e.layerY});
            refreshPicked(pickedObject);
            if (Cesium.defined(pickedObject) && pickedObject.id &&  (pickedObject.id.toString().indexOf("P_") === 0)) {
                showConstituent(pickedEntity.entity);
            }
        };

        var ellipsoid = scene.globe.ellipsoid;

        handler.setInputAction(function(movement) {
            // console.log(movement);
            // flags.looking = true;
            mousePosition = startMousePosition = Cesium.Cartesian3.clone(movement.position);
        }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

        handler.setInputAction(function(movement) {
            // pick
            mousePosition = movement.endPosition;
            var pickedObject = scene.pick(movement.endPosition);
            refreshPicked(pickedObject);
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        handler.setInputAction(function(position) {
            // console.log(position);
            // flags.looking = false;
            // mousePosition = Cesium.Cartesian3.clone(position);
        }, Cesium.ScreenSpaceEventType.LEFT_UP);
    }

    positionHover = function (visible) {
        var el = $("#hover");
        var leftOffset = 250;
        var margin = 30;
        var x = mousePosition.x-(el.width()*.5);
        var y = mousePosition.y-el.height()-margin;
        if (y < 0) {
            y = mousePosition.y+margin;
        }
        if (!visible) {
            x = -10000;
            y = -10000;
        }
        x += leftOffset;
        el.offset({left:x, top:y});
        if (!pickedEntity || !pickedEntity.entity) return;
        var position = pickedEntity.entity.primitive.originalLatlon;
        var query = '(address.Remarks:"'+position+'")';
        var facetList = buildFacetList();
        if (facetList.length > 0) query = "(" + query + " AND " + buildFacetQuery(facetList) + ")";
        query = "filter_path=hits.total&q=" + query;
        getData("constituent", query, function (responseText) {
            var data = JSON.parse(responseText);
            var hits = data.hits.total;
            var string = "<div>";
            string += '<span class="hits">' + hits + '</span>';
            string += hits > 1 ? " total results" : " result";
            string += " in location " + position;
            string += "<br /> Click to view list";
            string += "</div>";
            el.html(string);
            y = mousePosition.y-el.height()-margin;
            el.offset({left:x, top:y});
        });
    }

    buildFacetQuery = function (facetList) {
        var facetQuery = facetList.length > 0 ? "(" + facetList.join(" AND ") + ")" : "";
        return facetQuery;
    }

    buildConstituentQuery = function (id, latlon, facetList, start) {
        var facetQuery = "";
        if (facetList.length > 0) facetQuery = " AND " + buildFacetQuery(facetList);
        return "filter_path=hits.total,hits.hits._source&_source_exclude=address&from="+start+"&size="+tooltipLimit+"&q=((ConstituentID:" + id + " OR (address.Remarks:\"" + latlon + "\")) " + facetQuery + ")";
    }

    showConstituent = function (point) {
        if (point == pickedEntity) return;
        var id = point.id;
        var originalLatlon = point.primitive.originalLatlon;
        var realID = id.substr(2);
        lastID = realID;
        lastLatlon = originalLatlon;
        var facetList = buildFacetList();
        var query = buildConstituentQuery(realID, originalLatlon, facetList, 0);
        // console.log(query);
        getData("constituent", query, updateTooltip);
    }

    updateTooltip = function (responseText) {
        clearTooltip();
        var data = JSON.parse(responseText);
        var constituents = data.hits.hits;
        if (data.hits.total > tooltipLimit) {
            var string = "<p>Found " + data.hits.total + " photographers in this location. Showing first " + tooltipLimit + ".</p>";
            tooltipElement.find(".results").prepend(string);
        }
        addTooltipResults(constituents, 0, data.hits.total);
    }

    addTooltipResults = function (results, start, total) {
        var l = results.length;
        for (var i=0; i<l; i++) {
            buildTooltipConstituent(results[i]._source);
        }
        tooltipElement.find(".results").append("<hr />");
        if (start + l < total) {
            var more = total - (l + start) > tooltipLimit ? tooltipLimit : total - (l + start);
            var string = '<div class="link more">Load '+more+' more</div>';
            tooltipElement.find(".more").replaceWith(string);
            tooltipElement.find(".more").click(function() {
                loadMoreResults(start + l);
            });
        }
    }

    loadMoreResults = function (start) {
        tooltipElement.find(".more").empty();
        var facetList = buildFacetList();
        var query = buildConstituentQuery(lastID, lastLatlon, facetList, start);
        // console.log(query);
        getData("constituent", query, function (responseText) {
            var data = JSON.parse(responseText);
            var constituents = data.hits.hits;
            addTooltipResults(constituents, start, data.hits.total);
        });
    }

    buildTooltipConstituent = function (p) {
        var string = '<div class="tooltip-item">';
        string += '<h3 class="tooltip-toggle-'+p.ConstituentID+'">' + p.DisplayName;
        string += "<span>" + p.DisplayDate;
        if (p.addressTotal) string += ' (' + p.addressTotal + ')';
        string += "</span>"
        string += '</h3>';
        string += '<div class="hidden tooltip-content-'+p.ConstituentID+'">';
        string += "<p>";
        // string += '<a href="http://digitalcollections.nypl.org/search/index?utf8=%E2%9C%93&keywords=' + (p.DisplayName.replace(/\s/g, "+")) + '">View photos in Digital Collections</a><br />';
        string += "ID:" + p.ConstituentID + "<br />";
        if (p.gender) string += facetValues.genders[p.gender[0].TermID] + "<br />";
        string += "</p>";
        if (p.role) {
            string += "<p>";
            string += "<strong>Roles:</strong><br />";
            var list = [];
            for (var i in p.role) {
                list.push(facetValues.roles[p.role[i].TermID]);
            }
            string += list.join(", ");
            string += "</p>";
        }
        if (p.process) {
            string += "<p>";
            string += "<strong>Processes used:</strong><br />";
            var list = [];
            for (var i in p.process) {
                // console.log(p.process[i].TermID);
                if (facetValues.processes[p.process[i].TermID] !== undefined) list.push(facetValues.processes[p.process[i].TermID]);
            }
            string += list.join(", ");
            string += "</p>";
        }
        if (p.format) {
            string += "<p>";
            string += "<strong>Formats used:</strong><br />";
            var list = [];
            for (var i in p.format) {
                list.push(facetValues.formats[p.format[i].TermID]);
            }
            string += list.join(", ");
            string += "</p>";
        }
        if (p.collection) {
            var links = [];
            for (var i in p.collection) {
                if (p.collection[i].URL == "") {
                    continue;
                }
                var link = '<a target="_blank" class="external" href="'+ p.collection[i].URL +'">';
                link += facetValues.collections[p.collection[i].TermID];
                link += '</a>';
                links.push(link);
            }
            if (links.length > 0) {
                string += "<p>";
                string += "<strong>Included in collections:</strong><br />(links open in new window)<br />";
                string += links.join(", ");
                string += "</p>";
            }
        }
        if (p.biography) {
            string += "<p>";
            string += "<strong>Data found in:</strong><br />(links open in new window)<br />";
            var links = [];
            for (var i in p.biography) {
                var link = '<a target="_blank" class="external" href="'+ p.biography[i].URL +'">';
                link += facetValues.biographies[p.biography[i].TermID];
                link += '</a>';
                links.push(link);
            }
            string += links.join(", ");
            string += "</p>";
        }
        if (p.addressTotal > 0) {
            string += '<div class="addresses">';
            if (p.addressTotal > 1) string += '<span class="link" id="tooltip-connector-'+p.ConstituentID+'"><strong>Connect addresses</strong></span>';
            string += '<div id="tooltip-addresslist-'+p.ConstituentID+'"><span class="link"><strong>List addresses</strong></span></div></div>';
        }
        string += "</div>";
        tooltipElement.find(".results").append(string);
        $(".tooltip-toggle-" + p.ConstituentID).click(function () {
            $(".tooltip-content-" + p.ConstituentID).fadeToggle(100);
        });
        $("#tooltip-addresslist-" + p.ConstituentID).click(function (e) {
            getAddressList(parseInt(p.ConstituentID));
        });
        $("#tooltip-connector-" + p.ConstituentID).click(function (e) {
            connectAddresses(parseInt(p.ConstituentID));
        });
    }

    getAddressList = function (id) {
        var query = "filter_path=hits.hits._source&q=ConstituentID:" + id;
        getData("constituent", query, function (responseText) {
            var data = JSON.parse(responseText);
            buildConstituentAddresses(id, data.hits.hits[0]._source.address);
        });
    }

    buildConstituentAddresses = function (id, addresses) {
        // console.log(id);
        if (addresses) {
            var addstring = "";
            for (var i=0; i<addresses.length; i++) {
                var add = addresses[i];
                addstring += "<p>";
                addstring += "ID:" + add.ConAddressID + "<br />";
                addstring += facetValues.addresstypes[add.AddressTypeID] + "<br />";
                if (add.DisplayName2 != "NULL") addstring += add.DisplayName2 + "<br />";
                if (add.StreetLine1 != "NULL") addstring += add.StreetLine1 + "<br />";
                if (add.StreetLine2 != "NULL") addstring += add.StreetLine2 + "<br />";
                if (add.StreetLine3 != "NULL") addstring += add.StreetLine3 + "<br />";
                if (add.City != "NULL") addstring += add.City + ", ";
                if (add.State != "NULL") addstring += add.State + "<br />";
                if (add.CountryID != "NULL") addstring += facetValues.countries[add.CountryID] + "<br />";
                if (add.Remarks != "NULL") {
                    addstring += '<span class="link tooltip-address" id="tooltip-address-'+add.ConAddressID+'" data-id="'+add.ConAddressID+'">Go</span><br />';
                    addstring += add.Remarks + "<br />";
                }
                addstring += "</p>";
            }
            var string = "<p>";
            string += "<strong>Addresses:</strong>";
            string += "</p>";
            string += addstring;
            $("#tooltip-addresslist-" + id).empty().append(string);
            $("#tooltip-addresslist-" + id + " .link.tooltip-address").click(function (e) {
                var id = $(e.target).data("id");
                flyToAddressID(id);
            });
        }
    }

    flyToAddressID = function (id) {
        var p = pointHash[id];
        var height = p[6] ? p[6] + (heightDelta * 10) : (heightDelta * 10);
        // console.log(id, height, p);
        viewer.camera.flyTo({
            destination : Cesium.Cartesian3.fromDegrees(p[1], p[0], height),
            duration : 1
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

    connectAddresses = function (id) {
        // console.log(id);
        resetBounds();
        viewer.entities.remove(lines);
        var addresses = addressesForID(id);
        if (addresses.length > 1) {
            addresses = sortAddresses(addresses);
            var lastPoint = addresses[0];
            var positions = [];
            for (var i=0; i<addresses.length; i++) {
                var p = addresses[i];
                // console.log(p, addresses[i]);
                if (p === undefined) continue;
                expandBounds(p);
                var height = p[6] !== undefined ? p[6] : heightHash[p[3]];
                positions.push(p[1], p[0], height);
                // if (lastPoint === p) {
                //     continue;
                // }
                // lastPoint = p;
            }
            var polyline = new Cesium.PolylineGraphics();
            polyline.material = new Cesium.PolylineOutlineMaterialProperty({
                color: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK
            });
            polyline.width = new Cesium.ConstantProperty(lineWidth);
            polyline.followSurface = new Cesium.ConstantProperty(true);
            polyline.positions = Cesium.Cartesian3.fromDegreesArrayHeights(positions);
            lines = new Cesium.Entity({
                show : true,
                polyline : polyline
            });
            viewer.entities.add(lines);
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

    getData = function (facet, query, callback) {
        // console.log(facet, key, value);

        var r = new XMLHttpRequest();

        if (debug) console.log(query);

        r.open("POST", baseUrl+"/"+facet+"/_search?"+query, true);

        r.onreadystatechange = function () {
            if (r.readyState != 4 || r.status != 200) return;
            callback(r.responseText);
        }

        r.send();
    }

    addPoints = function (newPoints) {
        // if (newPoints.length === 0) return;
        // console.log(newPoints);
        var addressType = $("#"+facetWithName("addresstypes")[0]).val();
        var country = $("#"+facetWithName("countries")[0]).val();
        var i, l = newPoints.length;
        for (i=0; i<l; i++) {
            var p = pointHash[newPoints[i]];
            if (!p) continue;
            var height;
            // point has no real height
            if (p[6] === undefined) {
                var latlonHash = p[0]+","+p[1];
                if (latlonHeightHash[latlonHash] === undefined) {
                    height = heightDelta;
                } else {
                    height = latlonHeightHash[latlonHash] + heightDelta;
                }
                latlonHeightHash[latlonHash] = height;
                heightHash[p[3]] = height;
            } else {
                height = p[6];
            }
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
                position : Cesium.Cartesian3.fromDegrees(p[1], p[0], height),
                color: addressTypePalette[p[4]],//new Cesium.Color(1, 0.01, 0.01, 1),
                pixelSize : pixelSize,
                scaleByDistance : new Cesium.NearFarScalar(1.0e1, maxScale, 8.0e6, minScale)
            });
            pt.originalLatlon = p[0] + "," + p[1] + (p[6] ? "," + p[6] : "");
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

    clearTooltip = function () {
        tooltipElement.find(".results").empty();
        tooltipElement.find(".more").empty();
        viewer.entities.remove(lines);
    }

    disableFacets = function () {
        $("#facets .facet").prop('disabled', 'disabled');
        clearTooltip();
    }

    enableFacets = function () {
        $("#facets .facet").prop('disabled', '');
    }

    removePoints = function () {
        resetBounds();
        points.removeAll();
        viewer.entities.remove(lines);
        latlonHeightHash = {};
        heightHash = {};
    }

    applyFilters = function () {
        start = new Date().getTime();
        pickedEntity = undefined;
        disableFacets();
        removePoints();
        var facetList = buildFacetList();
        if (facetList.length === 0) {
            displayBaseData();
            return;
        }
        var addresses = [];
        var query = buildFacetQuery(facetList);
        query = "filter_path=hits.total,hits.hits._source&_source=address.ConAddressID&size=" + elasticSize + "&q=" + query;
        // reset elastic results to prepare for the new set
        elasticResults = {};
        elasticResults.query = query;
        elasticResults.from = 0;
        elasticResults.hits = [];
        elasticResults.total = 0;
        getData("constituent", query, getNextSet);
    }

    buildFacetList = function () {
        var facetList = [];
        for (var k in filters) {
            if (filters[k] != "*") facetList.push("("+k+":"+filters[k]+")");
        }
        return facetList;
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

    addressesForID = function (id) {
        var i;
        var addresses = [];
        for (i in pointHash) {
            if (pointHash[i][2] === id) addresses.push(pointHash[i]);
        }
        return addresses;
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
            var value = el.value.trim() != "" ? '(' + el.value.trim() + '*)' : "*"
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

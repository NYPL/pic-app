///<reference path='lib/jquery.d.ts' />
///<reference path='lib/csvToArray.d.ts' />
///<reference path='lib/cesium.d.ts' />

interface ElasticResults {
    query: string;
    from: number;
    hits: Array<any>;
    total: number;
}

class PIC {
    viewer : Cesium.Viewer;
    scene : Cesium.Scene;
    canvas;
    points;
    handler;
    elasticResults : ElasticResults = {query: "", from: 0, hits:[], total:0};
    pointHash = {};
    latlonHeightHash = {};
    heightHash = {};
    allIDs = [];
    lines;

    bounds;

    elasticSize = 1500;
    padding = 0.01; // to extend the boundary a bit
    tooltipLimit = 20;
    heightDelta = 100;
    lineWidth = 2;
    pixelSize = 2;
    pixelScale = 4;
    minScale = 1;
    maxScale = 4;
    generalMargin = 10;

    minYear = 1700;
    maxYear = new Date().getFullYear();

    debug = false;

    pickedEntity;
    mousePosition;
    startMousePosition;
    lastID;
    lastLatlon;

    tileUrl = 'https://a.tiles.mapbox.com/v4/nypllabs.8e20560b/';
    mapboxKey = 'png?access_token=pk.eyJ1IjoibnlwbGxhYnMiLCJhIjoiSFVmbFM0YyJ9.sl0CRaO71he1XMf_362FZQ';
    baseUrl = "https://ad4dc8ff4b124bbeadb55e68d9df1966.us-east-1.aws.found.io:9243/pic";
    geonamesURL = "http://api.geonames.org/findNearbyPlaceNameJSON?username=mgiraldo";

    // the way we knoe in elastic if a constituent has latlon-looking data
    latlonQuery = "address.Remarks:(\-?\d+(\.\d+)?),\s*(\-?\d+(\.\d+)?)";


    tooltipElement = $("#tooltip");

    facetsElement = $("#facets");

    nameQueryElement = "nameQuery";
    fromDateElement = "fromDate";
    toDateElement = "toDate";

    facets = [
        ["addresstypes", "Address Type", "AddressTypeID", "AddressType", "address"],
        ["countries", "Address Country", "CountryID", "Country", "address"],
        ["nationalities", "Nationality", "Nationality", "Nationality", ""],
        ["genders", "Gender", "TermID", "Term", "gender"],
        ["processes", "Process", "TermID", "Term", "process"],
        ["roles", "Role", "TermID", "Term", "role"],
        ["formats", "Format", "TermID", "Term", "format"],
        ["biographies", "Source", "TermID", "Term", "biography"],
        ["collections", "Collections", "TermID", "Term", "collection"],
        [this.nameQueryElement, "", "DisplayName", "", ""],
        ["date", "", "Date", "", ""]
    ];

    facetValues = {};
    filters = {};

    start;

    selectedColor = new Cesium.Color(1, 1, 0.2, 1);
    bizColor = new Cesium.Color(1, 0.50, 0.01, 1);
    birthColor = new Cesium.Color(0.30, 0.68, 0.29, 1);
    diedColor = new Cesium.Color(0.21, 0.49, 0.72, 1);
    activeColor = new Cesium.Color(0.89, 0.10, 0.10, 1);
    unknownColor = new Cesium.Color(1, 0.01, 1, 1);

    addressTypePalette = {
        "2": this.bizColor, // biz
        "5": this.birthColor, // birth
        "6": this.diedColor, // death
        "7": this.activeColor, // active
        "1": this.unknownColor, // unknown
    };


    constructor() {
    }

    init() {
        this.resetBounds();
        this.initWorld();
        this.loadBaseData();
        this.initMouseHandler();
        this.getFacets();
        this.initListeners();
    }

    resetBounds () {
        this.bounds = [-180, -90, 180, 90];
    }

    initWorld () {
        this.viewer = new Cesium.Viewer('cesiumContainer', {
            imageryProvider : new Cesium.OpenStreetMapImageryProvider({
                url : this.tileUrl, // nypllabs.7f17c2d1
                fileExtension : this.mapboxKey
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

        this.scene = this.viewer.scene;
        this.canvas = this.viewer.canvas;

        this.points = this.scene.primitives.add(new Cesium.PointPrimitiveCollection());
        this.points._rs = Cesium.RenderState.fromCache({
          depthTest : {
            enabled : true
          },
          depthMask : false,
          blending : Cesium.BlendingState.ADDITIVE_BLEND
        });

        this.lines = new Cesium.Primitive();

        this.scene.primitives.add(this.lines);
    }

    loadBaseData () {
        this.loadTextFile("csv/latlons.txt?i=" + Math.random()*100000, function (responseText) {
            var baseData = JSON.parse(responseText)[1];
            this.parseBaseData(baseData);
        });
    }

    parseBaseData (baseData) {
        var i, l = baseData.length;
        this.allIDs = [];
        this.pointHash = {};
        for (i=0; i < l; i=i+6) {
            var id = baseData[i+3];
            this.pointHash[id] = [
                baseData[i],
                baseData[i+1],
                baseData[i+2],
                id,
                baseData[i+4],
                baseData[i+5]
            ];
            this.allIDs.push(id);
        }

        this.loadTextFile("csv/heights.txt?i=" + Math.random()*100000, function (responseText) {
            var heightData = JSON.parse(responseText)[1];
            var i, l = heightData.length;
            for (i=0; i < l; i=i+2) {
                var id = heightData[i];
                if (this.pointHash[id] === undefined) continue;
                this.pointHash[id][6] = heightData[i+1];
            }
            this.displayBaseData();
        });
    }

    displayBaseData () {
        this.addPoints(this.allIDs);
        this.updateTotals(this.allIDs.length);
        this.enableFacets();
        this.updateBounds();
    }

    loadTextFile (url, callback, parameter = undefined) {
        var pic = this;

        var r = new XMLHttpRequest();

        r.open("GET", url, true);

        r.onreadystatechange = function () {
            if (r.readyState != 4 || r.status != 200) return;
            if (parameter === undefined) {
                callback.apply(pic, [r.responseText]);
            } else {
                callback.apply(pic, [r.responseText, parameter]);
            }
        };
        r.send();
    }

    getData (facet, query, callback, parameter = undefined) {
        var url = this.baseUrl+"/"+facet+"/_search?sort=addressTotal:desc&"+query;

        // console.log(url);
        this.loadTextFile(url, callback, parameter);
    }

    updateTotals (total) {
        if (total === -1) total = this.elasticResults.total;
        $("#total-points").html("<span class=\"number\">" + total + "</span><br />total locations");
    }

    updateBounds () {
        // console.log(bounds);
        var west = this.bounds[2];
        var south = this.bounds[3];
        var east = this.bounds[0];
        var north = this.bounds[1];
        this.viewer.camera.flyTo({
            destination : Cesium.Rectangle.fromDegrees(west, south, east, north),
            duration : 1
        });
    }

    minimize () {
        $("#overlays").addClass("minimized");
        $(".legend").addClass("minimized");
        document.getElementById("acronym").addEventListener("click", this.maximize, false);
    }

    maximize () {
        $("#overlays").removeClass("minimized");
        $(".legend").removeClass("minimized");
        document.getElementById("acronym").removeEventListener("click", this.maximize);
    }

    initMouseHandler () {
        var pic = this;

        this.handler = new Cesium.ScreenSpaceEventHandler(this.canvas);

        this.canvas.setAttribute('tabindex', '0'); // needed to put focus on the canvas
        this.canvas.onclick = (e) => {
            this.canvas.focus();
            // console.log(mousePosition, startMousePosition, e);
            if (this.mousePosition != this.startMousePosition) return;
            var pickedObject = this.pickEntity({x:e.layerX, y:e.layerY});
            this.refreshPicked(pickedObject);
            if (Cesium.defined(pickedObject) && pickedObject.id &&  (pickedObject.id.toString().indexOf("P_") === 0)) {
                this.clickPoint(this.pickedEntity.entity);
            }
        };

        this.handler.setInputAction(function(movement) {
            // console.log(movement);
            // flags.looking = true;
            pic.mousePosition = pic.startMousePosition = Cesium.Cartesian3.clone(movement.position);
        }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

        this.handler.setInputAction(function(movement) {
            // pick
            pic.mousePosition = movement.endPosition;
            var pickedObject = pic.scene.pick(movement.endPosition);
            pic.refreshPicked(pickedObject);
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    }

    pickEntity (windowPosition) {
        var picked = this.scene.pick(windowPosition);
        if (picked !== undefined) {
            var id = Cesium.defaultValue(picked.id, picked.primitive.id);
            if (Cesium.defined(id)) {
                return picked;
            }
        }
        return undefined;
    };

    refreshPicked (picked) {
        var showHover = false;
        // reset
        if (this.pickedEntity != undefined && picked !== this.pickedEntity.entity) {
            // revert properties
            this.pickedEntity.entity.primitive.color = this.pickedEntity.color;
            this.pickedEntity.entity.primitive.pixelSize = this.pixelSize;
        }
        if (Cesium.defined(picked) && picked.id &&  (picked.id.toString().indexOf("P_") === 0)) {
            if (this.pickedEntity === undefined || picked !== this.pickedEntity.entity) {
                this.pickedEntity = {
                    color: Cesium.clone(picked.primitive.color),
                    entity: picked
                };
                // apply new properties
                // picked.primitive.color = selectedColor;
                this.pickedEntity.entity.primitive.pixelSize = this.pixelSize * this.pixelScale;
                this.buildHover();
            }
            showHover = true;
        } else {
            // reset
            this.pickedEntity = undefined;
        }
        this.positionHover(showHover);
    }

    buildHover () {
        var position = this.pickedEntity.entity.primitive.originalLatlon;
        var query = '(address.Remarks:"'+position+'")';
        var facetList = this.buildFacetList();
        if (facetList.length > 0) {
            query = "(" + query + " AND " + this.buildFacetQuery(facetList) + ")";
        }
        query = "filter_path=hits.total&q=" + query;
        this.getData("constituent", query, this.buildHoverContent);
    }

    buildHoverContent (responseText) {
        var el = $("#hover");
        var position = this.pickedEntity.entity.primitive.originalLatlon;
        var data = JSON.parse(responseText);
        var hits = data.hits.total;
        var str = "<div>";
        str += '<span class="hits">' + hits + '</span>';
        str += hits === 1 ? " result" : " total results";
        str += "<br /><span id='geoname'>&nbsp;</span>";
        str += "<br />click dot to view list";
        str += "</div>";
        el.html(str);
        var latlon = position.split(",");
        var place;
        if (latlon.length === 3 && latlon[2] > 10000) {
            place = latlon[2] === "3850000" ? "near the Moon!" : "in Outer Space";
            this.updateHoverLocation(place);
            return;
        }
        if (latlon.length === 2 && latlon[0] === "0" && latlon[1] === "0") {
            place = "This is a placeholder location";
            this.updateHoverLocation(place);
            return;
        }
        var reverseGeo = this.geonamesURL + "&lat=" +latlon[0]+ "&lng=" + latlon[1];
        this.loadTextFile(reverseGeo, this.parseHoverLocation);
    }

    parseHoverLocation (responseText) {
        var data = JSON.parse(responseText);
        // console.log(data);
        var geo = data.geonames[0];
        if (!geo) return;
        this.updateHoverLocation("near " + geo.name + ", " + geo.countryName);
    }

    updateHoverLocation (text) {
        $("#geoname").text(text);
        this.positionHover(true);
    }

    positionHover (visible) {
        var el = $("#hover");
        var leftOffset = 0;
        var margin = 50;
        var x = this.mousePosition.x-(el.width()*.5);
        var y = this.mousePosition.y-el.height()-margin;
        if (y < 0) {
            y = this.mousePosition.y+margin;
        }
        if (!visible) {
            x = -10000;
            y = -10000;
        }
        x += leftOffset;
        el.offset({left:x, top:y});
    }

    clickPoint (point) {
        if (point == this.pickedEntity) return;
        this.maximize();
        var id = point.id;
        var originalLatlon = point.primitive.originalLatlon;
        var realID = id.substr(2);
        this.lastID = realID;
        this.lastLatlon = originalLatlon;
        var facetList = this.buildFacetList();
        var query = this.buildConstituentQuery(realID, originalLatlon, facetList, 0);
        // console.log(query);
        this.getData("constituent", query, this.updateTooltip);
    }

    buildConstituentQuery (id, latlon, facetList, start) {
        var facetQuery = "";
        if (facetList.length > 0) facetQuery = " AND " + this.buildFacetQuery(facetList);
        return "filter_path=hits.total,hits.hits._source&_source_exclude=address&from="+start+"&size="+this.tooltipLimit+"&q=((ConstituentID:" + id + " OR (address.Remarks:\"" + latlon + "\")) " + facetQuery + ")";
    }

    updateTooltip (responseText) {
        this.clearTooltip();
        var data = JSON.parse(responseText);
        var constituents = data.hits.hits;
        if (data.hits.total > this.tooltipLimit) {
            var string = "<p>Found " + data.hits.total + " photographers in this location. Showing first " + this.tooltipLimit + ".</p>";
            this.tooltipElement.find(".results").prepend(string);
        }
        this.addTooltipResults(constituents, 0, data.hits.total);
    }

    addTooltipResults (results, start, total) {
        var l = results.length;
        for (var i=0; i < l; i++) {
            this.buildTooltipConstituent(results[i]._source);
        }
        this.tooltipElement.find(".results").append("<hr />");
        if (start + l < total) {
            var more = total - (l + start) > this.tooltipLimit ? this.tooltipLimit : total - (l + start);
            var string = '<div class="link more">Load '+more+' more</div>';
            this.tooltipElement.find(".more").replaceWith(string);
            this.tooltipElement.find(".more").click( () => this.loadMoreResults(start + l) );
        }
    }

    loadMoreResults (start) {
        this.tooltipElement.find(".more").empty();
        var facetList = this.buildFacetList();
        var query = this.buildConstituentQuery(this.lastID, this.lastLatlon, facetList, start);
        // console.log(query);
        var pic = this;
        this.getData("constituent", query, function (responseText) {
            var data = JSON.parse(responseText);
            var constituents = data.hits.hits;
            this.addTooltipResults(constituents, start, data.hits.total);
        });
    }

    buildTooltipConstituent (p) {
        var str = '<div class="tooltip-item">';
        str += '<h3 class="tooltip-toggle-'+p.ConstituentID+'">' + p.DisplayName;
        str += "<span>" + p.DisplayDate;
        if (p.addressTotal) str += ' (' + p.addressTotal + ')';
        str += "</span>"
        str += '</h3>';
        str += '<div class="hidden tooltip-content-'+p.ConstituentID+'">';
        str += "<p>";
        // str += '<a href="http://digitalcollections.nypl.org/search/index?utf8=%E2%9C%93&keywords=' + (p.DisplayName.replace(/\s/g, "+")) + '">View photos in Digital Collections</a><br />';
        str += "ID:" + p.ConstituentID + "<br />";
        if (p.gender) str += this.facetValues["genders"][p.gender[0].TermID] + "<br />";
        str += "</p>";
        if (p.role) {
            str += "<p>";
            str += "<strong>Roles:</strong><br />";
            var list = [];
            for (var i in p.role) {
                list.push(this.facetValues["roles"][p.role[i].TermID]);
            }
            str += list.join(", ");
            str += "</p>";
        }
        if (p.process) {
            str += "<p>";
            str += "<strong>Processes used:</strong><br />";
            var list = [];
            for (var i in p.process) {
                // console.log(p.process[i].TermID);
                if (this.facetValues["processes"][p.process[i].TermID] !== undefined) list.push(this.facetValues["processes"][p.process[i].TermID]);
            }
            str += list.join(", ");
            str += "</p>";
        }
        if (p.format) {
            str += "<p>";
            str += "<strong>Formats used:</strong><br />";
            var list = [];
            for (var i in p.format) {
                list.push(this.facetValues["formats"][p.format[i].TermID]);
            }
            str += list.join(", ");
            str += "</p>";
        }
        if (p.collection) {
            var links = [];
            for (var i in p.collection) {
                if (p.collection[i].URL == "") {
                    continue;
                }
                var link = '<a target="_blank" class="external" href="'+ p.collection[i].URL +'">';
                link += this.facetValues["collections"][p.collection[i].TermID];
                link += '</a>';
                links.push(link);
            }
            if (links.length > 0) {
                str += "<p>";
                str += "<strong>Included in collections:</strong><br />(links open in new window)<br />";
                str += links.join(", ");
                str += "</p>";
            }
        }
        if (p.biography) {
            str += "<p>";
            str += "<strong>Data found in:</strong><br />(links open in new window)<br />";
            var links = [];
            for (var i in p.biography) {
                var link = '<a target="_blank" class="external" href="'+ p.biography[i].URL +'">';
                link += this.facetValues["biographies"][p.biography[i].TermID];
                link += '</a>';
                links.push(link);
            }
            str += links.join(", ");
            str += "</p>";
        }
        if (p.addressTotal > 0) {
            str += '<div class="addresses">';
            // if (p.addressTotal > 1) str += '<span class="link" id="tooltip-connector-'+p.ConstituentID+'"><strong>Connect locations</strong></span>';
            str += '<div id="tooltip-addresslist-'+p.ConstituentID+'"><span class="link address-header"><strong>';
            if (p.addressTotal != 1) {
                str += 'List '+p.addressTotal+' locations';
            } else {
                str += 'Show location';
            }
            str += '</strong></span></div></div>';
        }
        str += "</div>";
        this.tooltipElement.find(".results").append(str);
        $(".tooltip-toggle-" + p.ConstituentID).click( () => $(".tooltip-content-" + p.ConstituentID).fadeToggle(100) );
        $("#tooltip-addresslist-" + p.ConstituentID + " .address-header").click( () => this.getAddressList(parseInt(p.ConstituentID)) );
    }

    getAddressList (id) {
        // console.log(id);
        var query = "filter_path=hits.hits._source&q=ConstituentID:" + id;
        this.getData("constituent", query, this.parseConstituentAddresses, id);
    }

    parseConstituentAddresses (responseText, id) {
        var data = JSON.parse(responseText);
        this.buildConstituentAddresses(id, data.hits.hits[0]._source.address);
    }

    buildConstituentAddresses (id, addresses) {
        // console.log(id);
        if (addresses) {
            var addstring = "";
            for (var i=0; i < addresses.length; i++) {
                var add = addresses[i];
                addstring += "<div class=\"address-item\">";
                // addstring += "ID:" + add.ConAddressID + "<br />";
                addstring += this.facetValues["addresstypes"][add.AddressTypeID] + "<br />";
                if (add.DisplayName2 != "NULL") addstring += add.DisplayName2 + "<br />";
                if (add.StreetLine1 != "NULL") addstring += add.StreetLine1 + "<br />";
                if (add.StreetLine2 != "NULL") addstring += add.StreetLine2 + "<br />";
                if (add.StreetLine3 != "NULL") addstring += add.StreetLine3 + "<br />";
                if (add.City != "NULL") addstring += add.City + ", ";
                if (add.State != "NULL") addstring += add.State + "<br />";
                if (add.CountryID != "NULL") addstring += this.facetValues["countries"][add.CountryID] + "<br />";
                if (add.Remarks != "NULL") {
                    addstring += '<span class="link tooltip-address" id="tooltip-address-'+add.ConAddressID+'" data-id="'+add.ConAddressID+'">Go</span><br />';
                    // addstring += add.Remarks + "<br />";
                }
                addstring += "</div>";
            }
            var str = '<span class="link address-header"><strong>';
            if (addresses.length != 1) {
                str += 'Connect locations';
            } else {
                str += 'Show location';
            }
            str += "</strong></span>";
            str += "<p>";
            str += "<strong>Addresses:</strong>";
            str += "</p>";
            str += addstring;
            $("#tooltip-addresslist-" + id + " .address-header").replaceWith(str);
            $("#tooltip-addresslist-" + id + " .address-header").click( () => this.connectAddresses(id) );
            $("#tooltip-addresslist-" + id + " .link.tooltip-address").click( (e) => {
                    var id = $(e.target).data("id");
                    this.flyToAddressID(id);
            });
            this.connectAddresses(id);
        }
    }

    flyToAddressID (id) {
        var p = this.pointHash[id];
        var height = p[6] ? p[6] + (this.heightDelta * 50) : (this.heightDelta * 50);
        // console.log(id, height, p);
        this.viewer.camera.flyTo({
            destination : Cesium.Cartesian3.fromDegrees(p[1], p[0], height),
            duration : 1.5
        });
    }

    connectAddresses (id) {
        // console.log(id);
        this.resetBounds();
        this.removeLines();
        var addresses = this.addressesForID(id);
        // addresses = this.sortAddresses(addresses);
        var lastPoint = addresses[0];
        var positions = [];
        var colors = [];
        for (var i=0; i < addresses.length; i++) {
            var p = addresses[i];
            // console.log(p, addresses[i]);
            if (p === undefined) continue;
            if (p[0] === 0 && p[1] === 0) continue;
            this.expandBounds(p);
            var height = p[6] !== undefined ? p[6] : this.heightHash[p[3]];
            positions.push(p[1], p[0], height);
            colors.push(this.addressTypePalette[p[4]]);
        }

        if (addresses.length > 1) {
            this.lines = new Cesium.Primitive({
              geometryInstances : new Cesium.GeometryInstance({
                geometry : new Cesium.PolylineGeometry({
                  positions : Cesium.Cartesian3.fromDegreesArrayHeights(positions),
                  width : this.lineWidth,
                  vertexFormat : Cesium.PolylineColorAppearance.VERTEX_FORMAT,
                  colors: colors,
                  colorsPerVertex: true
                })
              }),
              appearance : new Cesium.PolylineColorAppearance({
                translucent : false
              })
            });
            this.scene.primitives.add(this.lines);
        }

        this.updateBounds();
    }

    getFacets () {
        for (var i=0; i < this.facets.length; i++) {
            if (this.facets[i][1] != "") this.getFacet(i);
        }
    }

    getFacet (index) {
        var facet = this.facets[index];

        this.createFacet(facet);

        var url = "csv/"+facet[0]+".csv?i=" + Math.random()*100000;

        this.loadTextFile(url, this.updateFacet, facet);
    }

    createFacet (facet) {
        // console.log(r, facet);
        var f = facet[0];
        var str = '<div class="facet">';
        str += '<label for="'+f+'">'+facet[1]+'</label>';
        str += '<select id="'+f+'" class="facet" name="'+f+'">';
        str += '<option value="*">Any</option>';
        str += '</select>';
        str += '</div>';
        $("#facetList").append(str);
        this.facetValues[f] = {};
        this.updateFilter(f, "*");
        this.fixOverlayHeight();
    }

    updateFacet (responseText, facet) {
        var data = responseText.csvToArray({trim:true, rSep: '\n'});
        if (data.length <= 1) return;
        var el = $("#"+facet[0]);
        var idColumn = data[0].indexOf(facet[2]);
        var valueColumn = data[0].indexOf(facet[3]);
        this.facetValues[facet[0]] = {};
        var i, l=data.length;
        var str = "";
        for (i=1; i < l; i++) {
            str += '<option value="'+data[i][idColumn]+'">'+data[i][valueColumn]+'</option>';
            this.facetValues[facet[0]][data[i][idColumn]] = data[i][valueColumn];
        }
        el.append(str);
        this.addListenersToFacet(facet);
    }

    facetWithName (name): Array<string> | Number {
        for (var i=0; i < this.facets.length; i++) {
            if (this.facets[i][0]==name) return this.facets[i];
        }
        return -1;
    }

    disableFacets () {
        $("#facets .facet").prop('disabled', 'disabled');
        this.clearTooltip();
    }

    enableFacets () {
        $("#facets .facet").prop('disabled', '');
    }

    buildFacetList () {
        var facetList = [];
        for (var k in this.filters) {
            if (this.filters[k] != "*") {
                if (k.indexOf("Date") === -1) {
                    facetList.push("("+k+":"+this.filters[k]+")");
                } else {
                    facetList.push("(address.BeginDate:"+this.filters[k]+" OR address.EndDate:"+this.filters[k]+" OR BeginDate:"+this.filters[k]+" OR EndDate:"+this.filters[k]+")");
                }
            }
        }
        return facetList;
    }

    buildFacetQuery (facetList) {
        var facetQuery = facetList.length > 0 ? "(" + facetList.join(" AND ") + ")" : "";
        return facetQuery;
    }

    clearTooltip () {
        this.tooltipElement.find(".results").empty();
        this.tooltipElement.find(".more").empty();
        this.removeLines();
    }

    updateFilter (facetName, value) {
        var facet = this.facetWithName(facetName);
        if (facet[4] != "") {
            this.filters[facet[4]+"."+facet[2]] = value;
        } else {
            this.filters[facet[2]] = value;
        }
    }

    applyFilters () {
        this.pickedEntity = undefined;
        this.disableFacets();
        this.removePoints();
        var facetList = this.buildFacetList();
        if (facetList.length === 0) {
            this.displayBaseData();
            return;
        }
        this.resetView();
        var addresses = [];
        var query = this.buildFacetQuery(facetList);
        query = "filter_path=hits.total,hits.hits._source&_source=address.ConAddressID&size=" + this.elasticSize + "&q=" + query;
        // reset elastic results to prepare for the new set
        this.elasticResults = {
            query : query,
            from : 0,
            hits : [],
            total : 0,
        };
        this.start = new Date().getTime();
        this.getData("constituent", query, this.getNextSet);
    }

    resetView () {
        this.scene.camera.flyTo({
            destination: Cesium.Camera.DEFAULT_VIEW_RECTANGLE
        });
    }

    getNextSet (re) {
        var results = JSON.parse(re);
        // console.log(results);
        // elasticResults.hits = elasticResults.hits.concat(results.hits.hits);
        if (results.hits.total > this.elasticResults.from + this.elasticSize) {
            // keep going
            var query = this.elasticResults.query;
            this.elasticResults.from += this.elasticSize;
            query = "from=" + this.elasticResults.from + "&" + query;
            this.getData("constituent", query, this.getNextSet);
        } else {
            var end = new Date().getTime();
            var time = end - this.start;
            console.log("took:", time, "ms");
            this.enableFacets();
        }
        if (results.hits.hits) this.addressesToPoints(results.hits.hits);
        if (results.hits.total <= this.elasticResults.from + this.elasticSize) {
            this.updateBounds();
        }
        this.updateTotals(-1);
    }

    addressesForID (id) {
        var i;
        var addresses = [];
        for (i in this.pointHash) {
            if (this.pointHash[i][2] === id) addresses.push(this.pointHash[i]);
        }
        return addresses;
    }

    // sortAddresses (addresses) {
    //     var sorted = [];
    //     var i, l = addresses.length;
    //     var born;
    //     var died;
    //     if (l <= 1) return addresses;
    //     // put the active ones
    //     for (i=0; i < l; ++i) {
    //         var add = addresses[i];
    //         if (add[4] === 7) {
    //             sorted.push(add);
    //         }
    //         // find born if any
    //         if (add[4] === 5) {
    //             born = add;
    //         }
    //         // find died if any
    //         if (add[4] === 6) {
    //             died = add;
    //         }
    //     }
    //     // put the biz ones
    //     for (i=0; i < l; ++i) {
    //         if (addresses[i][4] === 2) {
    //             sorted.push(addresses[i]);
    //         }
    //     }
    //     // prepend born
    //     if (born) sorted.unshift(born);
    //     // append died
    //     if (died) sorted.push(died);
    //     // console.log(addresses, sorted);
    //     return sorted;
    // }

    addressesToPoints (hits) {
        var addresses = [];
        // var hits = elasticResults.hits;
        // console.log(elasticResults);
        var i, j, l = hits.length;
        for (i=0; i < l; ++i) {
            var item = hits[i]._source;
            if (item.address === undefined) continue;
            for (j=0; j < item.address.length; ++j) {
                addresses.push(item.address[j].ConAddressID);
            }
        }
        this.addPoints(addresses);
    }

    addPoints (newPoints) {
        // if (newPoints.length === 0) return;
        // console.log(newPoints);
        var addressType = $("#"+this.facetWithName("addresstypes")[0]).val();
        var country = $("#"+this.facetWithName("countries")[0]).val();
        var i, l = newPoints.length;
        for (i=0; i < l; i++) {
            var p = this.pointHash[newPoints[i]];
            if (!p) continue;
            var height;
            // point has no real height
            if (p[6] === undefined) {
                var latlonHash = p[0]+","+p[1];
                if (this.latlonHeightHash[latlonHash] === undefined) {
                    height = this.heightDelta;
                } else {
                    height = this.latlonHeightHash[latlonHash] + this.heightDelta;
                }
                this.latlonHeightHash[latlonHash] = height;
                this.heightHash[p[3]] = height;
            } else {
                height = p[6];
            }
            // hack, because elastic returns all addresses of a given id
            var tid = p[4];
            var cid = p[5];
            if (addressType != "*" && tid != addressType) continue;
            if (country != "*" && cid != country) continue;
            // end hack
            this.elasticResults.total++;
            this.expandBounds(p);
            var pt = this.points.add({
                id: "P_"+p[2],
                position : Cesium.Cartesian3.fromDegrees(p[1], p[0], height),
                color: this.addressTypePalette[p[4]],//new Cesium.Color(1, 0.01, 0.01, 1),
                pixelSize : this.pixelSize,
                scaleByDistance : new Cesium.NearFarScalar(1.0e1, this.maxScale, 8.0e6, this.minScale)
            });
            pt.originalLatlon = p[0] + "," + p[1] + (p[6] ? "," + p[6] : "");
        }
        this.updateTotals(-1);
    }

    expandBounds (p) {
        if (p[1] > this.bounds[0]) this.bounds[0] = p[1] + this.padding;
        if (p[0] > this.bounds[1]) this.bounds[1] = p[0] + this.padding;
        if (p[1] < this.bounds[2]) this.bounds[2] = p[1] - this.padding;
        if (p[0] < this.bounds[3]) this.bounds[3] = p[0] - this.padding;
    }

    removePoints () {
        this.resetBounds();
        this.points.removeAll();
        this.removeLines();
        this.latlonHeightHash = {};
        this.heightHash = {};
    }

    removeLines () {
        this.scene.primitives.remove(this.lines);
    }

    fixOverlayHeight () {
        var h = window.innerHeight - (this.generalMargin*2);
        h -= $("#header").outerHeight(true);
        h -= $("#facets").outerHeight(true);
        h -= this.generalMargin;
        $("#tooltip").height(h);
    }

    addListenersToFacet (facet) {
        $("#" + facet[0]).change( (e) => this.onFacetChanged(e) );
    }

    initDateQuery () {
        var from = $("#" + this.fromDateElement);
        var to = $("#" + this.toDateElement);
        from.val(this.minYear.toString());
        to.val(this.maxYear.toString());
        this.updateFilter("date", "*");
        from.keyup( (e) => this.onFromDateKeyUp(e) );
        from.blur( () => this.updateTimeFilters() );
        to.keyup( (e) => this.onToDateKeyUp(e) );
        to.blur( () => this.updateTimeFilters() );
    }

    initNameQuery () {
        var el = $("#" + this.nameQueryElement)
        el.val("");
        this.updateFilter(this.nameQueryElement, "*");
        el.keyup( (e) => this.onNameQueryKeyUp(e) );
        el.blur( () => this.updateNameFilter() );
    }

    validateYear (element, defaultValue) {
        var el = $("#" + element);
        var str = el.val().trim();
        if (str === "") {
            el.val(defaultValue);
            return defaultValue;
        }
        var year = parseInt(str);
        if (isNaN(year)) {
            el.val(defaultValue);
            return defaultValue;
        }
        return year;
    }

    updateTimeFilters () {
        var from = this.validateYear(this.fromDateElement, this.minYear);
        var to = this.validateYear(this.toDateElement, this.maxYear);
        var value = "*";
        if ((from !== this.minYear || to !== this.maxYear) && from < to) {
            value = '[' + from + ' TO ' + to + ']';
        }
        this.updateFilter("date", value);
    }

    updateNameFilter () {
        var str = $("#" + this.nameQueryElement).val().trim();
        if (str !== "") {
            str = str.replace(" ", "~ ");
            str = str + "~";
            str = '(' + str.split(" ").join(" AND ") + ')';
        } else {
            str = "*";
        }
        var value = str;
        this.updateFilter(this.nameQueryElement, value);
    }

    onFromDateKeyUp (e) {
        var el = e.target;
        if (e.keyCode === 13) {
            this.updateTimeFilters();
            this.applyFilters();
        }
    }

    onToDateKeyUp (e) {
        var el = e.target;
        if (e.keyCode === 13) {
            this.updateTimeFilters();
            this.applyFilters();
        }
    }

    onNameQueryKeyUp (e) {
        var el = e.target;
        if (e.keyCode === 13) {
            this.updateNameFilter();
            this.applyFilters();
        }
    }

    onFacetChanged (e) {
        var el = e.target;
        var index = el.selectedIndex;
        var value = el.value;
        this.updateFilter(el.id, value);
        this.applyFilters();
    }

    initListeners () {
        this.initNameQuery();
        this.initDateQuery();
        $("#overlay-minimize").click( () => this.minimize() );
        window.onresize = this.fixOverlayHeight.bind(this);
        this.fixOverlayHeight();
    }
}







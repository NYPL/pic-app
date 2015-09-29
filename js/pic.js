var PIC;
(function (PIC) {
    var Facet = (function () {
        function Facet(id, parent, description) {
            this.parentElement = parent;
            this.ID = id;
            this.IDPrefix = "#" + this.ID + " ";
            this.description = description;
            this.buildHTML();
        }
        Facet.prototype.applyData = function (data) {
            this.data = data;
            // this.applyListeners();
        };
        Facet.prototype.buildHTML = function () {
            var f = this.ID;
            var str = '<div class="facet">';
            str += '<label for="' + f + '">' + this.description + '</label>';
            str += '<select id="' + f + '" class="facet" name="' + f + '">';
            str += '<option value="*">Any</option>';
            str += '</select>';
            str += '</div>';
            this.parentElement.append(str);
        };
        Facet.prototype.addFacetItem = function (name, value) {
            var str = '<option value="' + name + '">' + value + '</option>';
            $(this.IDPrefix).append(str);
        };
        Facet.prototype.handleItemClick = function (e) {
            // var el = $(e.currentTarget)
            // this.value = el.data("value");
            // $(this.IDPrefix + ".dropdown-button").html(el.html());
        };
        Facet.prototype.applyListeners = function () {
            var _this = this;
            $(this.IDPrefix + ".dropdown-button").click(function () {
                $(_this.IDPrefix + ".dropdown-menu").toggleClass("show-menu");
            });
            $(this.IDPrefix + ".dropdown-menu > li").click(function () {
                $(_this.IDPrefix + ".dropdown-menu").removeClass("show-menu");
            });
            $(this.IDPrefix + ".dropdown-menu.dropdown-select > li").click(function (e) { return _this.handleItemClick(e); });
        };
        return Facet;
    })();
    PIC.Facet = Facet;
})(PIC || (PIC = {}));
///<reference path='lib/jquery.d.ts' />
///<reference path='lib/csvToArray.d.ts' />
///<reference path='lib/cesium.d.ts' />
///<reference path='Facet.ts' />
var PIC;
(function (PIC_1) {
    var PIC = (function () {
        function PIC() {
            this.elasticResults = { query: "", from: 0, hits: [], total: 0 };
            this.pointArray = [];
            this.pointHash = {}; // contains the index to a given id in the pointArray
            this.latlonHeightHash = {};
            this.heightHash = {};
            this.allIDs = [];
            this.elasticSize = 1500;
            this.padding = 0.01; // to extend the boundary a bit
            this.tooltipLimit = 20;
            this.heightDelta = 100;
            this.lineWidth = 2;
            this.pixelSize = 2;
            this.pixelScale = 4;
            this.minScale = 1;
            this.maxScale = 4;
            this.generalMargin = 10;
            this.minYear = 1700;
            this.maxYear = new Date().getFullYear();
            this.debug = false;
            this.tileUrl = 'https://a.tiles.mapbox.com/v4/nypllabs.8e20560b/';
            this.mapboxKey = 'png?access_token=pk.eyJ1IjoibnlwbGxhYnMiLCJhIjoiSFVmbFM0YyJ9.sl0CRaO71he1XMf_362FZQ';
            this.baseUrl = "https://ad4dc8ff4b124bbeadb55e68d9df1966.us-east-1.aws.found.io:9243/pic";
            this.geonamesURL = "http://api.geonames.org/findNearbyPlaceNameJSON?username=mgiraldo";
            // the way we knoe in elastic if a constituent has latlon-looking data
            this.latlonQuery = "address.Remarks:(\-?\d+(\.\d+)?),\s*(\-?\d+(\.\d+)?)";
            this.tooltipElement = $("#tooltip");
            this.facetsElement = $("#facets");
            this.nameQueryElement = "nameQuery";
            this.fromDateElement = "fromDate";
            this.toDateElement = "toDate";
            this.facets = [
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
            this.facetValues = {};
            this.filters = {};
            this.facetWidgets = {};
            this.selectedColor = new Cesium.Color(1, 1, 0.2, 1);
            this.bizColor = new Cesium.Color(1, 0.50, 0.01, 1);
            this.birthColor = new Cesium.Color(0.30, 0.68, 0.29, 1);
            this.diedColor = new Cesium.Color(0.21, 0.49, 0.72, 1);
            this.activeColor = new Cesium.Color(0.89, 0.10, 0.10, 1);
            this.unknownColor = new Cesium.Color(1, 0.01, 1, 1);
            this.addressTypePalette = {
                "2": this.bizColor,
                "5": this.birthColor,
                "6": this.diedColor,
                "7": this.activeColor,
                "1": this.unknownColor
            };
        }
        PIC.prototype.init = function () {
            this.getFacets();
            this.resetBounds();
            this.initWorld();
            this.loadBaseData();
            this.initMouseHandler();
            this.initListeners();
        };
        PIC.prototype.resetBounds = function () {
            this.bounds = [-180, -90, 180, 90];
        };
        PIC.prototype.initWorld = function () {
            this.viewer = new Cesium.Viewer('cesiumContainer', {
                imageryProvider: new Cesium.OpenStreetMapImageryProvider({
                    url: this.tileUrl,
                    fileExtension: this.mapboxKey
                }),
                baseLayerPicker: false,
                homeButton: false,
                infoBox: false,
                timeline: false,
                animation: false,
                navigationHelpButton: false,
                navigationInstructionsInitiallyVisible: false,
                mapProjection: new Cesium.WebMercatorProjection(),
                creditContainer: "credits",
                selectionIndicator: false,
                skyBox: false,
                sceneMode: Cesium.SceneMode.SCENE2D
            });
            this.scene = this.viewer.scene;
            this.canvas = this.viewer.canvas;
            this.points = this.scene.primitives.add(new Cesium.PointPrimitiveCollection());
            this.points._rs = Cesium.RenderState.fromCache({
                depthTest: {
                    enabled: true
                },
                depthMask: false,
                blending: Cesium.BlendingState.ADDITIVE_BLEND
            });
            this.lines = new Cesium.Primitive();
            this.scene.primitives.add(this.lines);
        };
        PIC.prototype.loadBaseData = function () {
            this.loadTextFile("csv/latlons.txt?i=" + Math.random() * 100000, function (responseText) {
                var baseData = JSON.parse(responseText)[1];
                this.parseBaseData(baseData);
            });
        };
        PIC.prototype.parseBaseData = function (baseData) {
            var i, l = baseData.length;
            this.allIDs = [];
            this.pointArray = [];
            for (i = 0; i < l; i = i + 6) {
                var id = baseData[i + 3];
                var index = this.pointArray.push([
                    baseData[i],
                    baseData[i + 1],
                    baseData[i + 2],
                    id,
                    baseData[i + 4],
                    baseData[i + 5]
                ]);
                index = index - 1;
                this.pointHash[id] = index;
                this.allIDs.push(id);
            }
            this.loadTextFile("csv/heights.txt?i=" + Math.random() * 100000, function (responseText) {
                var heightData = JSON.parse(responseText)[1];
                this.parseHeightData(heightData);
            });
        };
        PIC.prototype.parseHeightData = function (heightData) {
            var i, l = heightData.length;
            for (i = 0; i < l; i = i + 2) {
                var id = heightData[i];
                var index = this.pointHash[id];
                if (this.pointArray[index] === undefined)
                    continue;
                this.pointArray[index][6] = heightData[i + 1];
            }
            this.displayBaseData();
        };
        PIC.prototype.displayBaseData = function () {
            this.addPoints(this.allIDs);
            this.updateTotals(this.allIDs.length);
            this.enableFacets();
            this.updateBounds();
        };
        PIC.prototype.loadTextFile = function (url, callback, parameter) {
            if (parameter === void 0) { parameter = undefined; }
            var pic = this;
            var r = new XMLHttpRequest();
            r.open("GET", url, true);
            r.onreadystatechange = function () {
                if (r.readyState != 4 || r.status != 200)
                    return;
                if (parameter === undefined) {
                    callback.apply(pic, [r.responseText]);
                }
                else {
                    callback.apply(pic, [r.responseText, parameter]);
                }
            };
            r.send();
        };
        PIC.prototype.getData = function (facet, query, callback, parameter) {
            if (parameter === void 0) { parameter = undefined; }
            var url = this.baseUrl + "/" + facet + "/_search?sort=nameSort:asc&" + query;
            console.log(url);
            this.loadTextFile(url, callback, parameter);
        };
        PIC.prototype.escapeQuery = function (query) {
            query = query.replace(/([\+\-=&\|><!\(\)\{\}\[\]\^"~\*\?:\\\/])/g, '');
            query = encodeURIComponent(query);
            return query;
        };
        PIC.prototype.updateTotals = function (total) {
            if (total === -1)
                total = this.elasticResults.total;
            $("#total-points").html("<span class=\"number\">" + total + "</span><br />" + this.humanizeFilters());
        };
        PIC.prototype.updateBounds = function () {
            // console.log(bounds);
            var west = this.bounds[2];
            var south = this.bounds[3];
            var east = this.bounds[0];
            var north = this.bounds[1];
            this.viewer.camera.flyTo({
                destination: Cesium.Rectangle.fromDegrees(west, south, east, north),
                duration: 1
            });
        };
        PIC.prototype.minimize = function () {
            $("#overlays").addClass("minimized");
            $(".legend").addClass("minimized");
            document.getElementById("acronym").addEventListener("click", this.maximize, false);
        };
        PIC.prototype.maximize = function () {
            $("#overlays").removeClass("minimized");
            $(".legend").removeClass("minimized");
            document.getElementById("acronym").removeEventListener("click", this.maximize);
        };
        PIC.prototype.initMouseHandler = function () {
            var _this = this;
            var pic = this;
            this.handler = new Cesium.ScreenSpaceEventHandler(this.canvas);
            this.canvas.setAttribute('tabindex', '0'); // needed to put focus on the canvas
            $("#overlays").mousemove(function () { return _this.positionHover(false); });
            this.canvas.onclick = function (e) {
                _this.canvas.focus();
                // console.log(mousePosition, startMousePosition, e);
                if (_this.mousePosition != _this.startMousePosition)
                    return;
                var pickedObject = _this.pickEntity({ x: e.layerX, y: e.layerY });
                _this.refreshPicked(pickedObject);
                if (Cesium.defined(pickedObject) && pickedObject.id && (pickedObject.id.toString().indexOf("P_") === 0)) {
                    _this.clickPoint(_this.pickedEntity.entity);
                }
            };
            this.canvas.onmousemove = function (e) {
                var c = new Cesium.Cartesian2(e.clientX, e.clientY);
                _this.mousePosition = c;
                var pickedObject = _this.scene.pick(c);
                _this.refreshPicked(pickedObject);
            };
            this.canvas.onmousedown = function (e) {
                var c = new Cesium.Cartesian2(e.clientX, e.clientY);
                _this.mousePosition = _this.startMousePosition = c;
            };
        };
        PIC.prototype.pickEntity = function (windowPosition) {
            var picked = this.scene.pick(windowPosition);
            if (picked !== undefined) {
                var id = Cesium.defaultValue(picked.id, picked.primitive.id);
                if (Cesium.defined(id)) {
                    return picked;
                }
            }
            return undefined;
        };
        ;
        PIC.prototype.refreshPicked = function (picked) {
            var showHover = false;
            // reset
            if (this.pickedEntity != undefined && picked !== this.pickedEntity.entity) {
                // revert properties
                this.pickedEntity.entity.primitive.color = this.pickedEntity.color;
                this.pickedEntity.entity.primitive.pixelSize = this.pixelSize;
            }
            if (Cesium.defined(picked) && picked.id && (picked.id.toString().indexOf("P_") === 0)) {
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
            }
            else {
                // reset
                this.pickedEntity = undefined;
            }
            this.positionHover(showHover);
        };
        PIC.prototype.buildHover = function () {
            var position = this.pickedEntity.entity.primitive.originalLatlon;
            var query = '(address.Remarks:"' + position + '")';
            var facetList = this.buildFacetList();
            if (facetList.length > 0) {
                query = "(" + query + " AND " + this.buildFacetQuery(facetList) + ")";
            }
            query = "filter_path=hits.total&q=" + query;
            this.getData("constituent", query, this.buildHoverContent);
        };
        PIC.prototype.buildHoverContent = function (responseText) {
            var el = $("#hover");
            if (this.pickedEntity === undefined)
                return;
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
            var reverseGeo = this.geonamesURL + "&lat=" + latlon[0] + "&lng=" + latlon[1];
            this.loadTextFile(reverseGeo, this.parseHoverLocation);
        };
        PIC.prototype.parseHoverLocation = function (responseText) {
            var data = JSON.parse(responseText);
            // console.log(data);
            var geo = data.geonames[0];
            if (!geo)
                return;
            this.updateHoverLocation("near " + geo.name + ", " + geo.countryName);
        };
        PIC.prototype.updateHoverLocation = function (text) {
            $("#geoname").text(text);
            this.positionHover(true);
        };
        PIC.prototype.positionHover = function (visible) {
            var el = $("#hover");
            var leftOffset = 0;
            var margin = 50;
            if (this.mousePosition === undefined)
                return;
            var x = this.mousePosition.x - (el.width() * .5);
            var y = this.mousePosition.y - el.height() - margin;
            if (y < 0) {
                y = this.mousePosition.y + margin;
            }
            if (!visible) {
                x = -10000;
                y = -10000;
            }
            x += leftOffset;
            el.offset({ left: x, top: y });
        };
        PIC.prototype.clickPoint = function (point) {
            if (point == this.pickedEntity)
                return;
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
        };
        PIC.prototype.buildConstituentQuery = function (id, latlon, facetList, start) {
            var facetQuery = "";
            if (facetList.length > 0)
                facetQuery = " AND " + this.buildFacetQuery(facetList);
            return "filter_path=hits.total,hits.hits._source&_source_exclude=address&from=" + start + "&size=" + this.tooltipLimit + "&q=((ConstituentID:" + id + " OR (address.Remarks:\"" + latlon + "\")) " + facetQuery + ")";
        };
        PIC.prototype.updateTooltip = function (responseText) {
            this.clearTooltip();
            var data = JSON.parse(responseText);
            var constituents = data.hits.hits;
            if (data.hits.total > this.tooltipLimit) {
                var string = "<p>Found " + data.hits.total + " photographers in this location. Showing first " + this.tooltipLimit + ".</p>";
                this.tooltipElement.find(".results").prepend(string);
            }
            this.addTooltipResults(constituents, 0, data.hits.total);
        };
        PIC.prototype.addTooltipResults = function (results, start, total) {
            var _this = this;
            var l = results.length;
            for (var i = 0; i < l; i++) {
                this.buildTooltipConstituent(results[i]._source);
            }
            this.tooltipElement.find(".results").append("<hr />");
            if (start + l < total) {
                var more = total - (l + start) > this.tooltipLimit ? this.tooltipLimit : total - (l + start);
                var string = '<div class="link more">Load ' + more + ' more</div>';
                this.tooltipElement.find(".more").replaceWith(string);
                this.tooltipElement.find(".more").click(function () { return _this.loadMoreResults(start + l); });
            }
        };
        PIC.prototype.loadMoreResults = function (start) {
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
        };
        PIC.prototype.buildTooltipConstituent = function (p) {
            var _this = this;
            var str = '<div class="tooltip-item">';
            str += '<h3 class="tooltip-toggle-' + p.ConstituentID + '">' + p.DisplayName;
            str += "<span>" + p.DisplayDate;
            if (p.addressTotal)
                str += ' (' + p.addressTotal + ')';
            str += "</span>";
            str += '</h3>';
            str += '<div class="hidden tooltip-content-' + p.ConstituentID + '">';
            str += "<p>";
            // str += '<a href="http://digitalcollections.nypl.org/search/index?utf8=%E2%9C%93&keywords=' + (p.DisplayName.replace(/\s/g, "+")) + '">View photos in Digital Collections</a><br />';
            str += "ID:" + p.ConstituentID + "<br />";
            if (p.gender)
                str += this.facetValues["genders"][p.gender[0].TermID] + "<br />";
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
                    if (this.facetValues["processes"][p.process[i].TermID] !== undefined)
                        list.push(this.facetValues["processes"][p.process[i].TermID]);
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
                    var link = '<a target="_blank" class="external" href="' + p.collection[i].URL + '">';
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
                    var link = '<a target="_blank" class="external" href="' + p.biography[i].URL + '">';
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
                str += '<div id="tooltip-addresslist-' + p.ConstituentID + '"><span class="link address-header"><strong>';
                if (p.addressTotal != 1) {
                    str += 'List ' + p.addressTotal + ' locations';
                }
                else {
                    str += 'Show location';
                }
                str += '</strong></span></div></div>';
            }
            str += "</div>";
            this.tooltipElement.find(".results").append(str);
            $(".tooltip-toggle-" + p.ConstituentID).click(function () { return $(".tooltip-content-" + p.ConstituentID).fadeToggle(100); });
            $("#tooltip-addresslist-" + p.ConstituentID + " .address-header").click(function () { return _this.getAddressList(parseInt(p.ConstituentID)); });
        };
        PIC.prototype.getAddressList = function (id) {
            // console.log(id);
            var query = "filter_path=hits.hits._source&q=ConstituentID:" + id;
            this.getData("constituent", query, this.parseConstituentAddresses, id);
        };
        PIC.prototype.parseConstituentAddresses = function (responseText, id) {
            var data = JSON.parse(responseText);
            this.buildConstituentAddresses(id, data.hits.hits[0]._source.address);
        };
        PIC.prototype.buildConstituentAddresses = function (id, addresses) {
            var _this = this;
            // console.log(id);
            if (addresses) {
                var addstring = "";
                for (var i = 0; i < addresses.length; i++) {
                    var add = addresses[i];
                    addstring += "<div class=\"address-item\">";
                    // addstring += "ID:" + add.ConAddressID + "<br />";
                    addstring += this.facetValues["addresstypes"][add.AddressTypeID] + "<br />";
                    if (add.DisplayName2 != "NULL")
                        addstring += add.DisplayName2 + "<br />";
                    if (add.StreetLine1 != "NULL")
                        addstring += add.StreetLine1 + "<br />";
                    if (add.StreetLine2 != "NULL")
                        addstring += add.StreetLine2 + "<br />";
                    if (add.StreetLine3 != "NULL")
                        addstring += add.StreetLine3 + "<br />";
                    if (add.City != "NULL")
                        addstring += add.City + ", ";
                    if (add.State != "NULL")
                        addstring += add.State + "<br />";
                    if (add.CountryID != "NULL")
                        addstring += this.facetValues["countries"][add.CountryID] + "<br />";
                    if (add.Remarks != "NULL") {
                        addstring += '<span class="link tooltip-address" id="tooltip-address-' + add.ConAddressID + '" data-id="' + add.ConAddressID + '">Go</span><br />';
                    }
                    addstring += "</div>";
                }
                var str = '<span class="link address-header"><strong>';
                if (addresses.length != 1) {
                    str += 'Connect locations';
                }
                else {
                    str += 'Show location';
                }
                str += "</strong></span>";
                str += "<p>";
                str += "<strong>Addresses:</strong>";
                str += "</p>";
                str += addstring;
                $("#tooltip-addresslist-" + id + " .address-header").replaceWith(str);
                $("#tooltip-addresslist-" + id + " .address-header").click(function () { return _this.connectAddresses(id); });
                $("#tooltip-addresslist-" + id + " .link.tooltip-address").click(function (e) {
                    var id = $(e.target).data("id");
                    _this.flyToAddressID(id);
                });
                this.connectAddresses(id);
            }
        };
        PIC.prototype.flyToAddressID = function (id) {
            var index = this.pointHash[id];
            var p = this.pointArray[index];
            var height = p[6] ? p[6] + (this.heightDelta * 50) : (this.heightDelta * 50);
            // console.log(id, height, p);
            this.viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(p[1], p[0], height),
                duration: 1.5
            });
        };
        PIC.prototype.connectAddresses = function (id) {
            // console.log(id);
            this.resetBounds();
            this.removeLines();
            var addresses = this.addressesForID(id);
            var lastPoint = addresses[0];
            var positions = [];
            var colors = [];
            for (var i = 0; i < addresses.length; i++) {
                var p = addresses[i];
                // console.log(p, addresses[i]);
                if (p === undefined)
                    continue;
                if (p[0] === 0 && p[1] === 0)
                    continue;
                this.expandBounds(p);
                var height = p[6] !== undefined ? p[6] : this.heightHash[p[3]];
                positions.push(p[1], p[0], height);
                colors.push(this.addressTypePalette[p[4]]);
            }
            if (addresses.length > 1) {
                this.lines = new Cesium.Primitive({
                    geometryInstances: new Cesium.GeometryInstance({
                        geometry: new Cesium.PolylineGeometry({
                            positions: Cesium.Cartesian3.fromDegreesArrayHeights(positions),
                            width: this.lineWidth,
                            vertexFormat: Cesium.PolylineColorAppearance.VERTEX_FORMAT,
                            colors: colors,
                            colorsPerVertex: true
                        })
                    }),
                    appearance: new Cesium.PolylineColorAppearance({
                        translucent: false
                    })
                });
                this.scene.primitives.add(this.lines);
            }
            this.updateBounds();
        };
        PIC.prototype.getFacets = function () {
            for (var i = 0; i < this.facets.length; i++) {
                if (this.facets[i][1] != "")
                    this.getFacet(i);
            }
        };
        PIC.prototype.getFacet = function (index) {
            var facet = this.facets[index];
            this.createFacet(facet);
            var url = "csv/" + facet[0] + ".csv?i=" + Math.random() * 100000;
            this.loadTextFile(url, this.updateFacet, facet);
        };
        PIC.prototype.createFacet = function (facet) {
            var f = facet[0];
            this.facetValues[f] = {};
            this.facetWidgets[f] = new PIC_1.Facet(f, $("#facet-list"), facet[1]);
            this.updateFilter(f, "*");
        };
        PIC.prototype.updateFacet = function (responseText, facet) {
            var data = responseText.csvToArray({ trim: true, rSep: '\n' });
            if (data.length <= 1)
                return;
            var widget = this.facetWidgets[facet[0]];
            var idColumn = data[0].indexOf(facet[2]);
            var valueColumn = data[0].indexOf(facet[3]);
            var name;
            var value;
            var l = data.length;
            for (var i = 1; i < l; i++) {
                name = data[i][idColumn];
                value = data[i][valueColumn];
                this.facetValues[facet[0]][name] = value;
                widget.addFacetItem(name, value);
            }
            this.addListenersToFacet(facet);
            // widget.applyData(data);
        };
        PIC.prototype.facetWithName = function (name) {
            for (var i = 0; i < this.facets.length; i++) {
                if (this.facets[i][0] == name)
                    return this.facets[i];
            }
            return -1;
        };
        PIC.prototype.disableFacets = function () {
            $("#facets .facet").prop('disabled', 'disabled');
            this.clearTooltip();
        };
        PIC.prototype.enableFacets = function () {
            $("#facets .facet").prop('disabled', '');
        };
        PIC.prototype.buildFacetList = function () {
            var facetList = [];
            for (var k in this.filters) {
                if (this.filters[k] != "*") {
                    if (k.indexOf("Date") === -1) {
                        facetList.push("(" + k + ":" + this.filters[k] + ")");
                    }
                    else {
                        facetList.push("(address.BeginDate:" + this.filters[k] + " OR address.EndDate:" + this.filters[k] + " OR BeginDate:" + this.filters[k] + " OR EndDate:" + this.filters[k] + ")");
                    }
                }
            }
            return facetList;
        };
        PIC.prototype.buildFacetQuery = function (facetList) {
            var facetQuery = facetList.length > 0 ? "(" + facetList.join(" AND ") + ")" : "";
            return facetQuery;
        };
        PIC.prototype.clearTooltip = function () {
            this.tooltipElement.find(".results").empty();
            this.tooltipElement.find(".more").empty();
            this.removeLines();
        };
        PIC.prototype.updateFilter = function (facetName, value) {
            var facet = this.facetWithName(facetName);
            if (facet[4] != "") {
                this.filters[facet[4] + "." + facet[2]] = value;
            }
            else {
                this.filters[facet[2]] = value;
            }
        };
        PIC.prototype.applyFilters = function () {
            this.pickedEntity = undefined;
            this.disableFacets();
            this.removePoints();
            var facetList = this.buildFacetList();
            $("#facets-clear").hide();
            if (facetList.length === 0) {
                this.displayBaseData();
                return;
            }
            var addresses = [];
            var query = this.buildFacetQuery(facetList);
            query = "filter_path=hits.total,hits.hits._source&_source=address.ConAddressID&size=" + this.elasticSize + "&q=" + query;
            // reset elastic results to prepare for the new set
            this.elasticResults = {
                query: query,
                from: 0,
                hits: [],
                total: 0
            };
            this.start = new Date().getTime();
            this.getData("constituent", query, this.getNextSet);
        };
        PIC.prototype.clearFilters = function () {
            this.resetNameQuery();
            this.resetDateQuery();
            for (var i = 0; i < this.facets.length; i++) {
                var facet = this.facets[i];
                this.updateFilter(facet[0], "*");
            }
            this.applyFilters();
        };
        PIC.prototype.getNextSet = function (re) {
            var results = JSON.parse(re);
            // console.log(results);
            // elasticResults.hits = elasticResults.hits.concat(results.hits.hits);
            if (results.hits.total > this.elasticResults.from + this.elasticSize) {
                // keep going
                var query = this.elasticResults.query;
                this.elasticResults.from += this.elasticSize;
                query = "from=" + this.elasticResults.from + "&" + query;
                this.getData("constituent", query, this.getNextSet);
            }
            else {
                var end = new Date().getTime();
                var time = end - this.start;
                console.log("took:", time, "ms");
                this.enableFacets();
            }
            if (results.hits.hits)
                this.addressesToPoints(results.hits.hits);
            if (results.hits.total <= this.elasticResults.from + this.elasticSize) {
                this.updateBounds();
            }
            this.updateTotals(-1);
        };
        PIC.prototype.addressesForID = function (id) {
            var i;
            var addresses = [];
            for (i in this.pointArray) {
                if (this.pointArray[i][2] === id)
                    addresses.push(this.pointArray[i]);
            }
            return addresses;
        };
        PIC.prototype.addressesToPoints = function (hits) {
            var addresses = [];
            // var hits = elasticResults.hits;
            // console.log(elasticResults);
            var i, j, l = hits.length;
            for (i = 0; i < l; ++i) {
                var item = hits[i]._source;
                if (item.address === undefined)
                    continue;
                for (j = 0; j < item.address.length; ++j) {
                    addresses.push(item.address[j].ConAddressID);
                }
            }
            this.addPoints(addresses);
        };
        PIC.prototype.addPoints = function (newPoints) {
            // if (newPoints.length === 0) return;
            // console.log(newPoints);
            var addressType = $("#" + this.facetWithName("addresstypes")[0]).val();
            var country = $("#" + this.facetWithName("countries")[0]).val();
            var i, l = newPoints.length;
            for (i = 0; i < l; i++) {
                var index = this.pointHash[newPoints[i]];
                var p = this.pointArray[index];
                if (!p)
                    continue;
                var height;
                // point has no real height
                if (p[6] === undefined) {
                    var latlonHash = p[0] + "," + p[1];
                    if (this.latlonHeightHash[latlonHash] === undefined) {
                        height = this.heightDelta;
                    }
                    else {
                        height = this.latlonHeightHash[latlonHash] + this.heightDelta;
                    }
                    this.latlonHeightHash[latlonHash] = height;
                    this.heightHash[p[3]] = height;
                }
                else {
                    height = p[6];
                }
                // hack, because elastic returns all addresses of a given id
                var tid = p[4];
                var cid = p[5];
                if (addressType != "*" && tid != addressType)
                    continue;
                if (country != "*" && cid != country)
                    continue;
                // end hack
                this.elasticResults.total++;
                this.expandBounds(p);
                var pt = this.points.add({
                    id: "P_" + p[2],
                    position: Cesium.Cartesian3.fromDegrees(p[1], p[0], height),
                    color: this.addressTypePalette[p[4]],
                    pixelSize: this.pixelSize,
                    scaleByDistance: new Cesium.NearFarScalar(1.0e1, this.maxScale, 8.0e6, this.minScale)
                });
                pt.originalLatlon = p[0] + "," + p[1] + (p[6] ? "," + p[6] : "");
            }
            this.updateTotals(-1);
        };
        PIC.prototype.expandBounds = function (p) {
            if (p[1] > this.bounds[0])
                this.bounds[0] = p[1] + this.padding;
            if (p[0] > this.bounds[1])
                this.bounds[1] = p[0] + this.padding;
            if (p[1] < this.bounds[2])
                this.bounds[2] = p[1] - this.padding;
            if (p[0] < this.bounds[3])
                this.bounds[3] = p[0] - this.padding;
        };
        PIC.prototype.removePoints = function () {
            this.resetBounds();
            this.points.removeAll();
            this.removeLines();
            this.latlonHeightHash = {};
            this.heightHash = {};
        };
        PIC.prototype.removeLines = function () {
            this.scene.primitives.remove(this.lines);
        };
        PIC.prototype.fixOverlayHeight = function () {
            var h = window.innerHeight - (this.generalMargin * 2);
            h -= $("#header").outerHeight(true);
            h -= $("#facets").outerHeight(true);
            h -= this.generalMargin;
            $("#tooltip").height(h);
        };
        PIC.prototype.addListenersToFacet = function (facet) {
            var _this = this;
            $("#" + facet[0]).change(function (e) { return _this.onFacetChanged(e); });
        };
        PIC.prototype.resetDateQuery = function () {
            var from = $("#" + this.fromDateElement);
            var to = $("#" + this.toDateElement);
            from.val(this.minYear.toString());
            to.val(this.maxYear.toString());
            this.updateFilter("date", "*");
        };
        PIC.prototype.resetNameQuery = function () {
            var el = $("#" + this.nameQueryElement);
            el.val("");
            this.updateFilter(this.nameQueryElement, "*");
        };
        PIC.prototype.validateYear = function (element, defaultValue) {
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
        };
        PIC.prototype.updateTimeFilters = function () {
            var from = this.validateYear(this.fromDateElement, this.minYear);
            var to = this.validateYear(this.toDateElement, this.maxYear);
            var value = "*";
            if ((from !== this.minYear || to !== this.maxYear) && from < to) {
                value = '[' + from + ' TO ' + to + ']';
            }
            this.updateFilter("date", value);
        };
        PIC.prototype.humanizeFilters = function () {
            /*
            template:
            0  Birth
               places
            1  in Australia
               for
            2  English
            3  , Female
               photographers
            9  named george
            4  who created daguerreotype
            5  who worked as clerk
            6  producing cabinet cards
            8  whose work is collected by NYPL
            10 who were alive or active from 1890 to 1895
            7  whose data came in part from Eastman House
            */
            var subject = "";
            var predicate = "";
            var text = "";
            var facet;
            var facetKey;
            var key;
            var hasQualifier = false;
            // addresstype
            facet = this.facets[0];
            facetKey = facet[4] + "." + facet[2];
            key = this.filters[facetKey];
            if (key !== "*") {
                subject += this.facetValues[facet[0]][key] + " ";
            }
            subject += "locations ";
            // country
            facet = this.facets[1];
            facetKey = facet[4] + "." + facet[2];
            key = this.filters[facetKey];
            if (key !== "*") {
                subject += "in " + this.facetValues[facet[0]][key] + " ";
            }
            predicate = "for ";
            // nationality
            facet = this.facets[2];
            facetKey = facet[2];
            key = this.filters[facetKey];
            if (key !== "*") {
                predicate += " " + this.facetValues[facet[0]][key];
            }
            // gender
            facet = this.facets[3];
            facetKey = facet[4] + "." + facet[2];
            key = this.filters[facetKey];
            if (key !== "*") {
                predicate += (predicate !== "for " ? ", " : "") + this.facetValues[facet[0]][key] + " ";
            }
            predicate += " photographers ";
            // name
            facet = this.facets[9];
            facetKey = facet[2];
            key = this.filters[facetKey];
            if (key !== "*") {
                var name = $("#" + this.nameQueryElement).val();
                predicate += "named " + name + " ";
            }
            // process
            facet = this.facets[4];
            facetKey = facet[4] + "." + facet[2];
            key = this.filters[facetKey];
            if (key !== "*") {
                predicate += "who created " + this.facetValues[facet[0]][key] + " ";
            }
            // role
            facet = this.facets[5];
            facetKey = facet[4] + "." + facet[2];
            key = this.filters[facetKey];
            if (key !== "*") {
                predicate += "who worked as " + this.facetValues[facet[0]][key] + " ";
            }
            // format
            facet = this.facets[6];
            facetKey = facet[4] + "." + facet[2];
            key = this.filters[facetKey];
            if (key !== "*") {
                predicate += "producing " + this.facetValues[facet[0]][key] + " ";
            }
            // collections
            facet = this.facets[8];
            facetKey = facet[4] + "." + facet[2];
            key = this.filters[facetKey];
            if (key !== "*") {
                predicate += "whose work is collected by " + this.facetValues[facet[0]][key] + " ";
            }
            // dates
            facet = this.facets[10];
            facetKey = "Date";
            key = this.filters[facetKey];
            if (key !== "*") {
                var dates = $("#" + this.fromDateElement).val();
                dates += " to " + $("#" + this.toDateElement).val();
                predicate += "who were alive or active from " + dates + " ";
            }
            // biography
            facet = this.facets[7];
            facetKey = facet[4] + "." + facet[2];
            key = this.filters[facetKey];
            if (key !== "*") {
                predicate += "whose data came in part from " + this.facetValues[facet[0]][key] + " ";
            }
            text = subject + predicate;
            return text;
        };
        PIC.prototype.updateNameFilter = function () {
            var str = $("#" + this.nameQueryElement).val().trim();
            if (str !== "") {
                str = str.replace(/([\+\-=&\|><!\(\)\{\}\[\]\^"~\*\?:\\\/])/g, '');
                str = str.trim().replace(" ", "~1 ");
                str = str + "~1";
                var f = str.split(" ");
                var legit = [];
                for (var thing in f) {
                    var trimmed = f[thing].trim();
                    if (trimmed !== "")
                        legit.push(trimmed);
                }
                str = '(' + legit.join(" AND ") + ')';
            }
            else {
                str = "*";
            }
            var value = str;
            this.updateFilter(this.nameQueryElement, value);
        };
        PIC.prototype.onFromDateKeyUp = function (e) {
            var el = e.target;
            if (e.keyCode === 13) {
                this.updateTimeFilters();
                this.applyFilters();
            }
        };
        PIC.prototype.onToDateKeyUp = function (e) {
            var el = e.target;
            if (e.keyCode === 13) {
                this.updateTimeFilters();
                this.applyFilters();
            }
        };
        PIC.prototype.onNameQueryKeyUp = function (e) {
            var el = e.target;
            if (e.keyCode === 13) {
                this.updateNameFilter();
                this.applyFilters();
            }
        };
        PIC.prototype.onFacetChanged = function (e) {
            var el = e.target;
            var index = el.selectedIndex;
            var value = el.value;
            this.updateFilter(el.id, value);
            this.applyFilters();
        };
        PIC.prototype.initListeners = function () {
            var _this = this;
            this.resetNameQuery();
            this.resetDateQuery();
            var from = $("#" + this.fromDateElement);
            var to = $("#" + this.toDateElement);
            from.keyup(function (e) { return _this.onFromDateKeyUp(e); });
            from.blur(function () { return _this.updateTimeFilters(); });
            to.keyup(function (e) { return _this.onToDateKeyUp(e); });
            to.blur(function () { return _this.updateTimeFilters(); });
            var name = $("#" + this.nameQueryElement);
            name.keyup(function (e) { return _this.onNameQueryKeyUp(e); });
            name.blur(function () { return _this.updateNameFilter(); });
            $("#facets-clear").click(function () { return _this.clearFilters(); });
            $("#overlay-minimize").click(function () { return _this.minimize(); });
            window.onresize = this.fixOverlayHeight.bind(this);
            this.fixOverlayHeight();
        };
        return PIC;
    })();
    PIC_1.PIC = PIC;
})(PIC || (PIC = {}));
//# sourceMappingURL=PIC.js.map
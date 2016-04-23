/// <reference path="tsd.d.ts" />
interface JQueryEvent {
    trigger(name: string): void;
}

interface JQueryStatic {
    event: JQueryEvent;
}

module PIC {

    interface FacetValueMap {
        [ID: string]: string;
    }

    export class Facet {

        ID: string;
        IDPrefix: string;
        element;
        parentElement;
        data: FacetValueMap = {};
        description: string;
        value: string;
        enabled = false;
        defaultValue = "*";

        constructor(id, parent, description) {
            this.parentElement = parent;
            this.ID = id;
            this.IDPrefix = "#" + this.ID + " ";
            this.description = description;
            this.buildHTML();
            this.addFacetItem("Any", this.defaultValue);
            if (this.ID == "bbox") this.addFacetItem("Select area on map", "-180_-90_180_90");
        }

        init() {
            this.setValue(this.defaultValue);
            $(this.IDPrefix + " .facet-item:first-child").addClass("active");
            this.applyListeners();
            this.enable();
        }

        enable() {
            this.enabled = true;
            $(this.IDPrefix).removeClass("disabled");
        }

        disable() {
            this.enabled = false;
            $(this.IDPrefix).addClass("disabled");
        }

        buildHTML() {
            var f = this.ID;
            var str = '<div id="'+this.ID+'" class="facet" data-value="">';
            str += '<div class="facet-header">' + this.description + '</div>';
            str += '<div class="facet-group">';
            str += '</div>';
            str += '</div>';
            this.parentElement.append(str);
            this.element = $(this.IDPrefix);
        }

        reset() {
            if (this.ID == "bbox") {
                this.cleanFacets();
                this.addFacetItem("Any", this.defaultValue);
                this.addFacetItem("Select area on map", "-180_-90_180_90");
            }
            this.setValue(this.defaultValue);
            this.closeGroup();
        }

        addFacetItem(name, value) {
            var strName;
            var strValue;
            this.data[value.toLowerCase()] = name;
            if (name !== "bbox") {
                strName = name;
                strValue = value.replace(/[\.,\s\*]/g, '_');
                strValue = strValue.toLowerCase()
            } else {
                strName = name;
                strValue = value;
            }
            var str = '<div id="' + this.ID + '-' + strValue.replace(/\./g, '\\.') + '" class="link facet-item" data-value="' + value + '">' + strName + '</div>';
            $(this.IDPrefix + ".facet-group").append(str);
        }

        cleanFacets() {
            $(this.IDPrefix + ".facet-item").each(
                function(index) {
                    $(this).remove();
                }
            );
        }

        getActiveValue():string {
            var item = $(this.IDPrefix + ".facet-item.active");
            if (item === undefined) return;
            var value = item.data("value");
            if (value === undefined) return;
            return value.toString();
        }

        setIndexValue(index, value) {
            var items = $(this.IDPrefix + ".facet-item");
            var item = items[index];
            if (item === undefined) return;
            var jitem = $(item);
            jitem.attr("id", "#" + this.ID + '-' + value.replace(/\./g, '\\.'));
            jitem.data("value", value);
        }

        setValue(value, headerText:string = undefined) {
            this.value = value;
            $(this.IDPrefix).data("value", value);

            if (this.ID === "bbox" && value !== this.defaultValue) {
                this.setIndexValue(1, value);
            }

            this.selectItem(value);

            var txtValue = this.data[value.toLowerCase()];

            if (headerText === undefined) {
                this.setHeaderText(txtValue);
            } else {
                this.setHeaderText(headerText);
            }
        }

        selectItem(value) {
            value = value.replace(/[\.,\s\*]/g, '_').toLowerCase();
            $(this.IDPrefix + ".facet-item").removeClass("active");
            $(this.IDPrefix + "#" + this.ID + '-' + value.replace(/\./g, '\\.')).addClass("active");
            this.closeGroup();
        }

        selectIndex(index) {
            var items = $(this.IDPrefix + ".facet-item");
            var item = items[index];
            if (item === undefined) return;
            $(this.IDPrefix + ".facet-item").removeClass("active");
            var jitem = $(item);
            jitem.addClass("active");
            this.closeGroup();
        }

        getSelectedIndex() {
            var items = $(this.IDPrefix + ".facet-item");
            for (var i=0; i < items.length; i++) {
                var item = $(items[i]);
                if (item.hasClass("active")) return i;
            }
            return 0;
        }

        setHeaderText(text) {
            if (text !== this.data[this.defaultValue]) {
                text = '<span class="hl">' + text + '</span>';
            }
            text = this.description + ": " + text;
            $(this.IDPrefix + ".facet-header").html(text);
        }
        
        hideAll() {
            for (var item in this.data) {
                if (item === "*") continue
                item = item.replace(/[\.,\s\*]/g, '_');
                $("#" + this.ID + '-' + item).addClass("hidden");                
            }
        }

        showItem(item) {
            item = item.replace(/[\.,\s\*]/g, '_');
            $("#" + this.ID + '-' + item).removeClass("hidden");                
        }
        
        updateItemText(item, text) {
            item = item.replace(/[\.,\s\*]/g, '_');
            $("#" + this.ID + '-' + item).text(text);                
        }

        handleItemClick(e: JQueryEventObject) {
            var oldValue = this.value;
            var el = $(e.currentTarget);
            var value = el.data("value").toString();
            var id = el.attr("id");
            if (value === oldValue) return;
            var headerText;
            if (this.ID === "bbox" && value !== this.defaultValue) headerText = "Select area on map";
            this.setValue(value, headerText);
            $(this.IDPrefix).trigger("facet:change", this);
        }

        toggleGroup() {
            $(this.IDPrefix + ".facet-header").toggleClass("open");
            $(this.IDPrefix + ".facet-group").toggleClass("open");
        }

        closeGroup() {
            $(this.IDPrefix + ".facet-header").removeClass("open");
            $(this.IDPrefix + ".facet-group").removeClass("open");
        }

        applyListeners () {
            $(this.IDPrefix + ".facet-header").click(() => {
                if (!this.enabled) return;
                this.toggleGroup();
            });
            $(this.IDPrefix + ".facet-item").click((e) => {
                if (!this.enabled) return;
                this.handleItemClick(e);
                this.closeGroup();
            });
        }
    }
}
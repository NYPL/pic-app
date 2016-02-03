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
            if (this.ID == "bbox") this.addFacetItem("Select area", "Select area");
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
            this.setValue(this.defaultValue);
            $(this.IDPrefix + ".facet-item").removeClass("active");
            $(this.IDPrefix + " .facet-item:first-child").addClass("active");
            if (this.ID == "bbox") {
                this.cleanFacets();
                this.addFacetItem("Select area", "Select area");
            }
            this.closeGroup();
        }

        setValue(value) {
            this.value = value;
            $(this.IDPrefix).data("value", value);
            this.selectItem(value);

            var txtValue = this.data[value];
            this.setHeaderText(txtValue);
        }

        addFacetItem(name, value) {
            var strName;
            var strValue;
            if (name !== "bbox") {
                this.data[value] = name;
                strName = name;
                strValue = value.replace(/[\.,\s\*]/g, '_');
            } else {
                // hack for locations
                strName = value;
                value = value.replace(/[\.,\s\*]/g, '_');
                strValue = value;
            }
            var str = '<div id="' + this.ID + '-' + strValue + '" class="link facet-item" data-value="' + value + '">' + strName + '</div>';
            $(this.IDPrefix + ".facet-group").append(str);
        }

        cleanFacets() {
            $(this.IDPrefix + ".facet-item").each(
                function(index) {
                    if ($(this).data("value").toString() !== "*") {
                        $(this).remove();
                    }
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
            jitem.data("value", value);
        }

        selectItem(value) {
            value = value.replace(/[\.,\s\*]/g, '_');
            $(this.IDPrefix + ".facet-item").removeClass("active");
            $(this.IDPrefix + "#" + this.ID + '-' + value).addClass("active");
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

        setHeaderText(text) {
            if (text !== this.data[this.defaultValue]) {
                text = '<span class="hl">' + text + '</span>';
            }
            text = this.description + ": " + text;
            $(this.IDPrefix + ".facet-header").html(text);
        }

        handleItemClick(e: JQueryEventObject) {
            var oldValue = this.value;
            var el = $(e.currentTarget);
            var value = el.data("value").toString();
            var id = el.attr("id");
            if (value === oldValue) return;
            this.setValue(value);
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
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
            console.log(this.ID, this.ID === "bbox");
            if (this.ID == "bbox") this.addFacetItem("Current view", "Current view");
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
            if (this.ID === "bbox") this.cleanFacets();
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

        selectItem(value) {
            value = value.replace(/[\.,\s\*]/g, '_');
            $(this.IDPrefix + ".facet-item").removeClass("active");
            $(this.IDPrefix + "#" + this.ID + '-' + value).addClass("active");
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
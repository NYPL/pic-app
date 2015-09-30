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
            this.closeGroup();
        }

        setValue(value) {
            this.value = value;
            var txtValue = this.data[this.value];
            if (this.value !== this.defaultValue) {
                txtValue = '<span class="hl">' + txtValue + '</span>';
            }
            var txt = this.description + ": " + txtValue;
            $(this.IDPrefix).data("value",value);
            $(this.IDPrefix + ".facet-header").html(txt);
            this.closeGroup();
        }

        addFacetItem(name, value) {
            this.data[value] = name;
            var str = '<div class="link facet-item" data-value="' + value + '">' + name + '</div>';
            $(this.IDPrefix + ".facet-group").append(str);
        }

        handleItemClick (e: JQueryEventObject) {
            var el = $(e.currentTarget);
            var value = el.data("value").toString();
            $(this.IDPrefix + ".facet-item").removeClass("active");
            el.addClass("active");
            if (value === this.value) return;
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
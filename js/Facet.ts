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

        constructor(id, parent, description) {
            this.parentElement = parent;
            this.ID = id;
            this.IDPrefix = "#" + this.ID + " ";
            this.description = description;
            this.buildHTML();
            this.addFacetItem("Any", "*");
        }

        init() {
            this.setValue("*");
            this.applyListeners();
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

        setValue(value) {
            this.value = value;
            var txtValue = this.data[this.value];
            var txt = this.description + ": " + txtValue;
            $(this.IDPrefix).data("value",value);
            $(this.IDPrefix + ".facet-header").text(txt);
            this.closeGroup();
        }

        addFacetItem(name, value) {
            this.data[value] = name;
            var str = '<div class="link facet-value" data-value="' + value + '">' + name + '</div>';
            $(this.IDPrefix + ".facet-group").append(str);
        }

        handleItemClick (e: JQueryEventObject) {
            var el = $(e.currentTarget)
            this.setValue(el.data("value"));
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
                this.toggleGroup()
            });
            $(this.IDPrefix + ".facet-value").click((e) => {
                this.handleItemClick(e);
            });
        }
    }
}
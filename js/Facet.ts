module PIC {
    export class Facet {

        ID: string;
        IDPrefix: string;
        parentElement;
        data: string[][];
        description: string;
        value: string;

        constructor(id, parent, description) {
            this.parentElement = parent;
            this.ID = id;
            this.IDPrefix = "#" + this.ID + " ";
            this.description = description;
            this.buildHTML();
        }

        applyData(data) {
            this.data = data;
            // this.applyListeners();
        }

        buildHTML() {
            var f = this.ID;
            var str = '<div class="facet">';
            str += '<label for="' + f + '">' + this.description + '</label>';
            str += '<select id="' + f + '" class="facet" name="' + f + '">';
            str += '<option value="*">Any</option>';
            str += '</select>';
            str += '</div>';
            this.parentElement.append(str);
        }

        addFacetItem(name, value) {
            var str = '<option value="' + name + '">' + value + '</option>';
            $(this.IDPrefix).append(str);
        }

        handleItemClick (e: JQueryEventObject) {
            // var el = $(e.currentTarget)
            // this.value = el.data("value");
            // $(this.IDPrefix + ".dropdown-button").html(el.html());
        }

        applyListeners () {
            $(this.IDPrefix + ".dropdown-button").click(() => {
                $(this.IDPrefix + ".dropdown-menu").toggleClass("show-menu");
            });
            $(this.IDPrefix + ".dropdown-menu > li").click(() => {
                $(this.IDPrefix + ".dropdown-menu").removeClass("show-menu");
            });
            $(this.IDPrefix + ".dropdown-menu.dropdown-select > li").click((e) => this.handleItemClick(e));
        }
    }
}
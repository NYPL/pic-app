# Place all the behaviors and hooks related to the matching controller here.
# All this logic will automatically be available in application.js.
# You can use CoffeeScript in this file: http://coffeescript.org/

class Constituents

    constructor: (options) ->
        $(".map img").click((map)=>
            @clickZoom(map)
        )
        @

    clickZoom: (element) ->
        map = $(element.target)
        is_big = !map.data("isbig")
        map.data("isbig", is_big)
        img = new Image()
        src = map.data("small")
        if is_big
            src = map.data("big")
        img.onload = () ->
            map.attr("src", @src)
        img.src = src
        @

$ ->
    window._co = new Constituents()

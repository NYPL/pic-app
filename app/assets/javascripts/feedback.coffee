class Feedback

    tabletop: undefined

    constructor: (options) ->
        #element shortcuts
        @el = $("#feedback")
        @el.html feedback_form
        @toggle_el = $("#feedback #feedback-toggle")
        @form_el = $("#feedback-form")
        @txt_el = @form_el.find("textarea")
        @id_el = @form_el.find("input.textfield")
        @open_el = @toggle_el.find("a.open")
        @close_el = @toggle_el.find("a.close")
        @submit_el = @el.find("#feedback-send")
        @counter_el = @el.find("#feedback-counter")
        @wait_el = @el.find("#feedback-wait")

        @txt_el.val( @txt_el.data("placeholder") )

        @open_el.click @open

        @close_el.click @close
        @el.find("#feedback-close").click @close

        @submit_el.click @submit

        local = @

        @wait_el.append(@_spinner().el)

        @txt_el.focus( () ->
            t = $(this)
            if t.val() is t.data("placeholder") || t.val() is t.data("error")
                t.removeClass("error")
                t.val("")
        )
        @txt_el.blur( () ->
            t = $(this)
            if t.val() is ""
                local.reset()
        )
        @txt_el.keyup @checkLength

        $(document).mouseup( (e) =>
            if (@el.has(e.target).length is 0)
                @close()
        )

        #show the feedback
        window.setTimeout(
            () => @el.removeClass("preload")
        , 5000)

        $("input[type=text], textarea").focus(@zoomDisable).blur(@zoomEnable)
        @

    zoomDisable: () =>
        # item = $("#item-image-wrapper")
        # if item.length == 0
        #   return
        # newTop = item.height() + item.position().top
        # @el.css("position","absolute")
        # @el.css("bottom","auto")
        # @el.css("top",newTop)
        $('head meta[name=viewport]').remove()
        $('head').prepend('<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=0" />')

    zoomEnable: () =>
        $('head meta[name=viewport]').remove()
        $('head').prepend('<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=1" />')

    checkLength: () =>
        len = parseInt(@txt_el.attr("maxlength"), 10)
        txt = @txt_el.val()
        if len - txt.length > 0
            remaining = len - txt.length
        else
            remaining = 0

        @counter_el.text(remaining)

        if (txt > len)
            @txt_el.val( txt.substr(0, len) )
            return false

    _spinner: () ->
        opts =
            lines: 11, # The number of lines to draw
            length: 0, # The length of each line
            width: 4, # The line thickness
            radius: 8, # The radius of the inner circle
            corners: 1, # Corner roundness (0..1)
            rotate: 0, # The rotation offset
            color: '#fff', # #rgb or #rrggbb
            speed: 1, # Rounds per second
            trail: 60, # Afterglow percentage
            shadow: false, # Whether to render a shadow
            hwaccel: false, # Whether to use hardware acceleration
            className: 'spinner', # The CSS class to assign to the spinner
            zIndex: 9, # The z-index (defaults to 2000000000)
            top: '100px', # Top position relative to parent in px
            left: '50%' # Left position relative to parent in px

        new Spinner(opts).spin()

    reset: () =>
        @txt_el.val( @txt_el.data("placeholder") )
        @id_el.val( "" )
        @txt_el.removeClass("error")
        @counter_el.text(@txt_el.attr("maxlength"))
        @el.find(".step1").show()
        @el.find(".step2").hide()
        @el.find("#feedback-1").prop('checked', true)

    submit: (e) =>
        msg = @txt_el.val().trim()
        if msg is @txt_el.data("placeholder") || msg is @txt_el.data("error")
            @txt_el.addClass("error")
            @txt_el.val( @txt_el.data("error") )
        else
            @wait_el.show()
            @form_el.attr('action','/save')
            @form_el.submit((e) =>
                e.preventDefault()
                form  = $(e.target)
                $.getJSON(
                    form.attr("action") + '.json',
                        frompage:document.location.href
                        feedback_text:msg
                        feedback_id:document.forms[1]["feedback_id"].value
                        type: document.forms[1].type.value
                    , (data) =>
                        # console.log "done", data
                        @changeStep()
                ).done(()=>
                    @changeStep()
                )
            )
            @form_el.trigger('submit')

    changeStep: (e) =>
        @el.find(".step1").hide()
        @el.find(".step2").show()
        @wait_el.hide()

    open: (e) =>
        # _gaq.push(['_trackEvent', 'Feedback', 'Open']) # analytics
        # window.analytics.event 'Feedback', 'Open'
        @el.addClass("open")
        @toggle_el.find("a.open").removeClass("visible")
        @close_el.addClass("visible")

    close: () =>
        @el.removeClass("open")
        @close_el.removeClass("visible")
        @toggle_el.find("a.open").addClass("visible")
        @reset()

$ ->
    window._fb = new Feedback()

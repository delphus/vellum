define([
    'jquery',
    'underscore',
    'jquery.jstree'
], function (
    $,
    _
) {
    /**
     * Conditional events plugin
     *
     * Conditional handlers are bound to the JSTree instance and are
     * called with the same arguments as the JSTree function that they
     * are gating. The boolean result of the handler will be used to
     * determine if the gated method should be called (true -> call).
     *
     * Based on https://github.com/vakata/jstree/blob/master/src/misc.js
     * See also http://stackoverflow.com/a/24499593/10840
     */
    "use strict";
    $.jstree.defaults.conditionalevents = {
        should_activate: function () { return true; },
        should_move: function () { return true; }
    };
    $.jstree.plugins.conditionalevents = function (options, parent) {
        this.activate_node = function () {
            var args = Array.prototype.slice.call(arguments);
            if(this.settings.conditionalevents.should_activate.apply(this, args)) {
                parent.activate_node.apply(this, args);
            }
        };
        this.move_node = function () {
            var args = Array.prototype.slice.call(arguments);
            if(this.settings.conditionalevents.should_move.apply(this, args)) {
                parent.move_node.apply(this, args);
            }
        };
    };
});

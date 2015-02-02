define([
    'jquery',
    'underscore',
    'vellum/widgets',
    'tpl!vellum/templates/data_source_editor',
    'tpl!vellum/templates/select_data_source'
], function (
    $,
    _,
    widgets,
    edit_source,
    select_source
) {
    var vellum, dataSources;

    function init(instance) {
        vellum = instance;
        dataSources = vellum.opts().core.dataSources || [];
    }

    function getDataSources(type, callback) {
        var source = _.find(dataSources, function (src) {
            return src.key === type;
        });

        if (source) {
            if (_.isString(source.endpoint)) {
                $.ajax({
                    type: 'GET',
                    url: source.endpoint,
                    dataType: 'json',
                    success: function (data) { callback(data); },
                    // TODO error handling
                    data: {}
                });
            } else {
                callback(source.endpoint());
            }
        } else {
            callback([]);
        }
    }

    function selectDataSource(callback) {
        var $modal = vellum.generateNewModal("Select Data Source", [
                {
                    title: "Set Data Source",
                    cssClasses: "btn-primary",
                    action: function () {
                        var sel = $source.find(":selected"),
                            src = (sel && sel.data("source")) || {};
                        callback({
                            instance: {
                                id: src.defaultId,
                                src: src.sourceUri
                            },
                            idsQuery: $query.val(),
                        });
                        $modal.modal('hide');
                    }
                }
            ]),
            $exportForm = $(select_source({}));
        $modal.find('.modal-body').html($exportForm);

        var $type = $exportForm.find('[name=type-selector]'),
            $source = $exportForm.find('[name=source-selector]'),
            $query = $exportForm.find('[name=source-query]'),
            $text = $exportForm.find('textarea');

        $text.attr("disabled", "disabled");
        $type.empty();
        $type.append($("<option />").text("-- Select a source type --"));
        _.each(dataSources, function(source) {
            $type.append($("<option />").val(source.key).text(source.name));
        });

        function populate() {
            var key = $type.val();
            $source.empty();
            if (!key) {
                select();
                return;
            }
            getDataSources(key, function (sources) {
                $source.append($("<option />").text("-- Select a source --"));
                _.each(sources, function (source) {
                    $source.append($("<option />").data("source", source)
                                                  .text(source.name));
                });
                select();
            });
        }

        function select() {
            var selected = $source.find(":selected"),
                source = selected && selected.data("source");
            if (source) {
                $query.val("instance('{1}')/{2}"
                    .replace("{1}", source.defaultId)
                    .replace("{2}", source.rootNodeName)
                );
                $text.text([
                    source.defaultId,
                    source.sourceUri,
                ].join("\n"));
            } else {
                $query.val("");
                $text.text("");
            }
        }

        $type.change(populate);
        $source.change(select);

        // display current values
        $modal.modal('show');
    }

    /**
     * Load data source editor
     *
     * @param $div - jQuery object in which editor will be created.
     * @param options - Object containing editor options:
     *      {
     *          source: {
     *              id: "<instance id>",
     *              src: "<instance src>",
     *              query: "<query expression>"
     *          },
     *          change: callback,   // called when the editor content changes
     *          done: callback      // called with no arguments on cancel
     *      }
     */
    function loadDataSourceEditor($div, options) {
        var $ui = $(edit_source()),
            $instanceId = $ui.find("[name=instance-id]"),
            $instanceSrc = $ui.find("[name=instance-src]"),
            $query = $ui.find("[name=query]");
        $div.empty().append($ui);

        if (options.source) {
            $instanceId.val(options.source.id);
            $instanceSrc.val(options.source.src);
            $query.val(options.source.query);
        }

        function getDataSource() {
            return {
                id: $instanceId.val(),
                src: $instanceSrc.val(),
                query: $query.val()
            };
        }

        if (options.change) {
            $instanceId.on('change keyup', function (){
                options.change(getDataSource());
            });

            $instanceSrc.on('change keyup', function (){
                options.change(getDataSource());
            });

            $query.on('change keyup', function (){
                options.change(getDataSource());
            });
        }

        var done = function (val) {
            $div.find('.fd-data-source-editor').hide();
            options.done(val);
        };

        $ui.find('.fd-data-source-save-button').click(function() {
            done(getDataSource());
        });

        $ui.find('.fd-data-source-cancel-button').click(function () {
            done();
        });
    }

    function dataSourceWidget(mug, options, labelText) {
        var widget = widgets.text(mug, options),
            getUIElement = widgets.util.getUIElement,
            getUIElementWithEditButton = widgets.util.getUIElementWithEditButton,
            super_handleChange = widget.handleChange,
            currentValue = null;

        widget.getUIElement = function () {
            var query = getUIElementWithEditButton(
                    getUIElement(widget.input, labelText),
                    function () {
                        vellum.displaySecondaryEditor({
                            source: currentValue,
                            headerText: labelText,
                            loadEditor: loadDataSourceEditor,
                            done: function (source) {
                                if (!_.isUndefined(source)) {
                                    local_setValue(source);
                                    widget.handleChange();
                                }
                            }
                        });
                    }
                );
            return $("<div></div>").append(query);
        };

        widget.getValue = function () {
            return currentValue || {};
        };

        var local_setValue = widget.setValue = function (val) {
            currentValue = val;
            widget.input.val(val.query || "");
        };

        widget.handleChange = function () {
            currentValue.query = widget.input.val();
            super_handleChange();
        };

        return widget;
    }

    return {
        init: init,
        getDataSources: getDataSources,
        selectDataSource: selectDataSource,
        dataSourceWidget: dataSourceWidget
    };

});
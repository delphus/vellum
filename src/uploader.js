define([
    'require',
    'module',
    'underscore',
    'jquery',
    'tpl!vellum/templates/multimedia_modal',
    'tpl!vellum/templates/multimedia_upload_trigger',
    'text!vellum/templates/multimedia_queue.html',
    'text!vellum/templates/multimedia_errors.html',
    'text!vellum/templates/multimedia_existing_image.html',
    'text!vellum/templates/multimedia_existing_audio.html',
    'text!vellum/templates/multimedia_existing_video.html',
    'text!vellum/templates/multimedia_existing_text.html',
    'tpl!vellum/templates/multimedia_nomedia',
    'tpl!vellum/templates/multimedia_block',
    'vellum/core'
], function (
    require,
    module,
    _,
    $,
    multimedia_modal,
    multimedia_upload_trigger,
    multimedia_queue,
    multimedia_errors,
    multimedia_existing_image,
    multimedia_existing_audio,
    multimedia_existing_video,
    multimedia_existing_text,
    multimedia_nomedia,
    multimedia_block
) {
    "use strict";

    var SUPPORTED_EXTENSIONS = {
        image: [
            {
                'description': gettext('Image'),
                'extensions': '*.jpg;*.png;*.gif'
            }
        ],
        audio: [
            {
                'description': gettext('Audio'),
                'extensions': '*.mp3;*.wav'
            }
        ],
        video: [
            {
                'description': gettext('Video'),
                'extensions': '*.3gp;*.mp4'
            }
        ],
        'video-inline': [
            {
                'description': gettext('Inline Video'),
                'extensions': '*.3gp;*.mp4'
            }
        ],
        'expanded-audio': [
            {
                'description': gettext('Audio with a Seekbar'),
                'extensions': '*.mp3;*.wav'
            }
        ],
        text: [
            {
                'description': gettext('HTML'),
                'extensions': '*.html'
            }
        ],
    },
    PREVIEW_TEMPLATES = {
        image: multimedia_existing_image,
        audio: multimedia_existing_audio,
        video: multimedia_existing_video,
        'video-inline': multimedia_existing_video,
        'expanded-audio': multimedia_existing_audio,
        text:  multimedia_existing_text,
    },
    SLUG_TO_CLASS = {
        image: 'CommCareImage',
        audio: 'CommCareAudio',
        video: 'CommCareVideo',
        'video-inline': 'CommCareVideo',
        'expanded-audio': 'CommCareAudio',
        text:  'CommCareMultimedia',
    },
    SLUG_TO_UPLOADER_SLUG = {
        image: 'fd_hqimage',
        audio: 'fd_hqaudio',
        video: 'fd_hqvideo',
        'video-inline': 'fd_hqInlineVideo',
        'expanded-audio': 'fd_hqExpandedAudio',
        text:  'fd_hqtext',
    },
    EXT = /(\.[^\/.]+)?$/;

    // These functions were extracted out when separating the uploader code from
    // the JavaRosa Itext media widget code.  They could easily be made part of
    // the plugin interface in order to avoid passing around objectMap and
    // uploadControls, but it seems fine either way.
    var multimediaReference = function (mediaType, objectMap, uploadControls) {
        var ref = {};
        ref.mediaType = mediaType;

        ref.updateRef = function (path) {
            ref.path = path;
            ref.linkedObj = objectMap[path];
        };

        ref.isMediaMatched = function () {
            return _.isObject(ref.linkedObj);
        };

        // gets called by uploadController
        ref.getUrl = function () {
            return ref.linkedObj.url;
        };

        ref.updateController = function (widget, objectMap) {
            // see note about poor man's promise below
            var uploadController = uploadControls[ref.mediaType].value;
            uploadController.resetUploader();
            uploadController.currentReference = ref;
            uploadController.uploadParams = {
                path: ref.path,
                media_type : SLUG_TO_CLASS[ref.mediaType],
                old_ref: (ref.isMediaMatched()) ? ref.linkedObj.m_id : "",
                replace_attachment: true
            };
            uploadController.updateUploadFormUI();
        };

        return ref;
    };

    var addUploaderToWidget = function (widget, objectMap, uploadControls) {
        widget.mediaRef = multimediaReference(
            widget.form, objectMap, uploadControls);

        var getValue = widget.getItextValue || widget.getValue,
            $input = widget.getControl(),
            $uiElem = $('<div />'),
            _getParentUIElement = widget.getUIElement,
            $previewContainer = $('<div />')
                .addClass('fd-mm-preview-container'),
            ICONS = widget.mug.form.vellum.data.javaRosa.ICONS;

        widget.getUIElement = function () {
            $uiElem = _getParentUIElement();
            var $controlBlock = $uiElem.find('.controls'),
                $uploadContainer = $('<div />')
                    .addClass('fd-mm-upload-container');
            $controlBlock.empty()
                .addClass('control-row').data('form', widget.form);

            widget.updateReference();

            $previewContainer.html(getPreviewUI(widget, objectMap, ICONS));
            $controlBlock.append($previewContainer);

            $uploadContainer.html(multimedia_block());
            $uploadContainer.find('.fd-mm-upload-trigger')
                .append(getUploadButtonUI(widget, objectMap));
            $uploadContainer.find('.fd-mm-path-input')
                .append($input);

            $uploadContainer.find('.fd-mm-path-show').click(function (e) {
                var $showBtn = $(this);
                $showBtn.addClass('hide');
                $uploadContainer.find('.fd-mm-path').removeClass('hide');
                e.preventDefault();
            });

            $uploadContainer.find('.fd-mm-path-hide').click(function (e) {
                var $hideBtn = $(this);
                $hideBtn.parent().addClass('hide');
                $uploadContainer.find('.fd-mm-path-show').removeClass('hide');
                e.preventDefault();
            });
            $input.on("change keyup", function () {
                widget.updateMultimediaBlockUI(objectMap);
            });

            $controlBlock.append($uploadContainer);
            $uiElem.on('mediaUploadComplete', function (event, data) {
                widget.handleUploadComplete(event, data, objectMap);
            });

            // reapply bindings because we removed the input from the UI
            $input.on("change keyup", widget.updateValue);

            return $uiElem;
        };

        widget.handleUploadComplete = function (event, data, objectMap) {
            // data: { ref: { path: string } }
            if (data.ref && data.ref.path) {
                if (getValue() !== data.ref.path) {
                    widget.getControl().val(data.ref.path);
                    widget.handleChange();
                }
                objectMap[data.ref.path] = data.ref;
            }
            widget.updateMultimediaBlockUI(objectMap);
        };
        
        widget.updateMultimediaBlockUI = function (objectMap) {
            $previewContainer.html(getPreviewUI(widget, objectMap, ICONS))
                .find('.existing-media').tooltip();

            $uiElem.find('.fd-mm-upload-trigger')
                .empty()
                .append(getUploadButtonUI(widget, objectMap));

            widget.updateReference();
        };

        widget.updateReference = function (path) {
            var currentPath = path || getValue();
            $uiElem.attr('data-hqmediapath', currentPath);
            widget.mediaRef.updateRef(currentPath);
        };
    };

    var getPreviewUI = function (widget, objectMap, ICONS) {
        var javarosa = _.isFunction(widget.getItextValue),
            hasItext = _.isFunction(widget.getItextItem),
            currentPath = javarosa ? widget.getItextValue() : widget.getValue(),
            previewHtml;
        if (hasItext && !javarosa && !currentPath && !widget.isDefaultLang) {
            currentPath = widget.getItextItem().get(widget.form, widget.defaultLang);
        }
        if (currentPath in objectMap) {
            var linkedObject = objectMap[currentPath];
            previewHtml = _.template(PREVIEW_TEMPLATES[widget.form])({
                url: linkedObject.url
            });
        } else {
            previewHtml = multimedia_nomedia({
                iconClass: ICONS[widget.form]
            });
        }
        return previewHtml;
    };

    var getUploadButtonUI = function (widget, objectMap) {
        var currentPath = widget.getItextValue ? widget.getItextValue() : widget.getValue(),
            $uploadBtn;
        $uploadBtn = $(multimedia_upload_trigger({
            multimediaExists: currentPath in objectMap,
            uploaderId: SLUG_TO_UPLOADER_SLUG[widget.form],
            mediaType: SUPPORTED_EXTENSIONS[widget.form][0].description
        }));
        $uploadBtn.click(function () {
            widget.mediaRef.updateController(widget, objectMap);
        });
        return $uploadBtn;
    };

    $.vellum.plugin("uploader", {
        objectMap: false,
        sessionid: false,
        uploadUrls: {
            image: false,
            audio: false,
            video: false,
            'video-inline': false,
            'expanded-audio': false,
            text: false
        },
    }, {
        init: function () {
            var opts = this.opts().uploader,
                uploadUrls = opts.uploadUrls,
                uploadEnabled = opts.objectMap && opts.uploadUrls && 
                    opts.uploadUrls.image,
                sessionid = opts.sessionid;

            this.data.uploader.uploadEnabled = uploadEnabled;
            this.data.uploader.objectMap = opts.objectMap;
            if (!uploadEnabled) {
                return;
            }

            this.data.uploader.deferredInit = function (widget) {
                this.data.uploader.uploadControls = {
                    'image': this.initUploadController({
                        uploaderSlug: 'fd_hqimage',
                        mediaType: 'image',
                        sessionid: sessionid,
                        uploadUrl: uploadUrls.image,
                        objectMap: opts.objectMap,
                        onUpload: opts.onUpload,
                        widget: widget
                    }),
                    'audio': this.initUploadController({
                        uploaderSlug: 'fd_hqaudio',
                        mediaType: 'audio',
                        sessionid: sessionid,
                        uploadUrl: uploadUrls.audio,
                        objectMap: opts.objectMap,
                        onUpload: opts.onUpload,
                        widget: widget
                    }),
                    'video': this.initUploadController({
                        uploaderSlug: 'fd_hqvideo',
                        mediaType: 'video',
                        sessionid: sessionid,
                        uploadUrl: uploadUrls.video,
                        objectMap: opts.objectMap,
                        onUpload: opts.onUpload,
                        widget: widget
                    }),
                    'video-inline': this.initUploadController({
                        uploaderSlug: 'fd_hqInlineVideo',
                        mediaType: 'video-inline',
                        sessionid: sessionid,
                        uploadUrl: uploadUrls.video,
                        objectMap: opts.objectMap,
                        onUpload: opts.onUpload,
                        widget: widget
                    }),
                    'expanded-audio': this.initUploadController({
                        uploaderSlug: 'fd_hqExpandedAudio',
                        mediaType: 'expanded-audio',
                        sessionid: sessionid,
                        uploadUrl: uploadUrls.audio,
                        objectMap: opts.objectMap,
                        onUpload: opts.onUpload,
                        widget: widget
                    }),
                    'text': this.initUploadController({
                        uploaderSlug: 'fd_hqtext',
                        mediaType: 'text',
                        sessionid: sessionid,
                        uploadUrl: uploadUrls.text,
                        objectMap: opts.objectMap,
                        onUpload: opts.onUpload,
                        widget: widget
                    })
                };
            };
        },
        initMediaUploaderWidget: function (widget) {
            this.__callOld();
            if (!this.data.uploader.uploadEnabled) {
                return;
            }

            var deferredInit = this.data.uploader.deferredInit;
            if (deferredInit !== null) {
                this.data.uploader.deferredInit = null;
                deferredInit.apply(this, [widget]);
            }

            addUploaderToWidget(widget, 
                                this.data.uploader.objectMap, 
                                this.data.uploader.uploadControls);
        },
        initUploadController: function (options) {
            var $uploaderModal = $(multimedia_modal({
                mediaType: options.mediaType,
                modalId: options.uploaderSlug
            }));
            this.$f.find('.fd-multimedia-modal-container').append($uploaderModal);

            // Load the uploader and its dependencies in the background after
            // core dependencies are already loaded, since it's not necessary at
            // page load.
            // uploadControls is referenced in the initMediaUploaderWidget call
            // path, but never actually used until the upload button is clicked.
            // We use an object here as a poor man's promise.
            // Feel free to undo this if it's not worth it.
          
            var uploadController = {value: null};

            require(['file-uploader'], function (HQMediaFileUploadController) {
                if (uploadController.value !== null) {
                    return;
                }
                uploadController.value = new HQMediaFileUploadController(
                    options.uploaderSlug, 
                    options.mediaType, 
                    {
                        fileFilters: SUPPORTED_EXTENSIONS[options.mediaType],
                        uploadURL: options.uploadUrl,
                        isMultiFileUpload: false,
                        queueTemplate: multimedia_queue,
                        errorsTemplate: multimedia_errors,
                        existingFileTemplate: PREVIEW_TEMPLATES[options.mediaType],
                        licensingParams: [
                            'shared', 'license', 'author', 'attribution-notes'],
                        uploadParams: {},
                        sessionid: options.sessionid
                    }
                );
                uploadController.value.init();
                // Override the uploader logic to call out to Delphus's in the options.
                uploadController.value.startUpload = function (event) {
                    console.log(uploadController, event);
                    // This is how to get a file to upload out of YUI, apparently.
                    options.onUpload(uploadController.value.filesInQueueUI[0]._state.data.file.value, (data) => {
                        options.widget.handleUploadComplete(event, data, options.objectMap);
                    });
                };
            });
            return uploadController;
        },
        destroy: function () {
            _.each(this.data.uploader.uploadControls, function (control, key) {
                if (control.value) {
                    // HACK deep reach
                    // HQMediaFileUploadController should have a destroy method
                    control.value.uploader.destroy();
                }
                delete control.value;
            });
            this.__callOld();
        }
    });
});

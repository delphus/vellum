/*jshint multistr: true */
define([
    'tests/options',
    'tests/utils',
    'vellum/util',
    'chai',
    'jquery',
    'underscore',
    'vellum/databrowser',
    'text!static/databrowser/child-ref.xml',
    'text!static/databrowser/child-ref-no-hashtag.xml',
    'text!static/databrowser/mother-ref.xml',
    'text!static/databrowser/child-ref-output-value.xml',
    'text!static/databrowser/child-ref-output-value-other-lang.xml',
    'text!static/databrowser/preloaded-hashtags.xml',
    'text!static/databrowser/unknown-property-preloaded-hashtags.xml',
    'text!static/datasources/case-property.xml',
], function (
    options,
    util,
    vellumUtil,
    chai,
    $,
    _,
    databrowser,
    CHILD_REF_XML,
    CHILD_REF_NO_HASHTAG_XML,
    MOTHER_REF_XML,
    CHILD_REF_OUTPUT_VALUE_XML,
    CHILD_REF_OUTPUT_VALUE_OTHER_LANG_XML,
    PRELOADED_HASHTAGS_XML,
    UNKNOWN_PROPERTY_PRELOADED_HASHTAGS_XML,
    CASE_PROPERTY_XML
) {
    var assert = chai.assert,
        call = util.call,
        plugins = _.union(util.options.options.plugins || [], ["databrowser"]),
        CASE_DATA = [{
            id: "commcaresession",
            uri: "jr://instance/session",
            path: "/session/data",
            name: 'Session',
            structure: {
                "case_id": {
                    reference: {
                        source: "casedb",
                        subset: "case",
                        key: "@case_id",
                    },
                },
            },
        }, {
            id: "casedb",
            uri: "jr://instance/casedb",
            path: "/cases/case",
            name: 'Cases',
            structure: {
                name: {},
            },
            subsets: [{
                id: "parent",
                name: "parent (mother)",
                key: "@case_type",
                structure: {
                    edd: {},
                }
            }, {
                id: "case",
                name: "child",
                key: "@case_type",
                structure: {
                    dob: {},
                    invalid: {}
                },
                related: {
                    parent: "parent",
                },
            }],
        }];

    describe("The data browser", function () {
        var escapedDobProp = '`#case/dob`',
            dobProp = '#case/dob',
            dataTree;

        function getInstanceId(form, src) {
            var meta = _.find(form.instanceMetadata, function (meta) {
                return meta.attributes.src === src;
            });
            return meta ? meta.attributes.id : null;
        }

        describe("when loaded before the form", function () {
            before(function (done) {
                util.init({
                    plugins: plugins,
                    javaRosa: {langs: ['en']},
                    core: {
                        dataSourcesEndpoint: function (callback) { callback(CASE_DATA); },
                        invalidCaseProperties: ['invalid'],
                        onReady: function () {
                            databrowser.initDataBrowser(this);
                            dataTree = this.$f.find(".fd-external-sources-tree").jstree(true);
                            done();
                        }
                    }
                });
            });

            it("should add ref on drag/drop", function(done) {
                util.loadXML("");
                var mug = util.addQuestion("DataBindOnly", "mug"),
                    calc = $("[name=property-calculateAttr]"),
                    sessionUri = CASE_DATA[0].uri,
                    casedbUri = CASE_DATA[1].uri,
                    editor = calc.ckeditor().editor,
                    widget = util.getWidget('property-calculateAttr');
                widget.input.promise.then(function () { 
                    editor.on('change', function() {
                        assert.equal(mug.p.calculateAttr, escapedDobProp);
                        assert.equal(getInstanceId(mug.form, sessionUri), "commcaresession");
                        assert.equal(getInstanceId(mug.form, casedbUri), "casedb");
                        util.assertXmlEqual(call("createXML"), CHILD_REF_XML,
                                            {normalize_xmlns: true});
                        done();
                    });
                    assert.equal(getInstanceId(mug.form, sessionUri), null);
                    assert.equal(getInstanceId(mug.form, casedbUri), null);
                    assert.equal(calc.length, 1);
                    util.findNode(dataTree, "dob").data.handleDrop(calc);
                });
            });

            it("should add parent ref on drag/drop", function(done) {
                util.loadXML("");
                var mug = util.addQuestion("DataBindOnly", "mug"),
                    calc = $("[name=property-calculateAttr]"),
                    sessionUri = CASE_DATA[0].uri,
                    casedbUri = CASE_DATA[1].uri,
                    editor = calc.ckeditor().editor,
                    widget = util.getWidget('property-calculateAttr');
                widget.input.promise.then(function () { 
                    editor.on('change', function() {
                        assert.equal(mug.p.calculateAttr, "`#case/parent/edd`");
                        assert.equal(getInstanceId(mug.form, sessionUri), "commcaresession");
                        assert.equal(getInstanceId(mug.form, casedbUri), "casedb");
                        util.assertXmlEqual(call("createXML"), MOTHER_REF_XML,
                                            {normalize_xmlns: true});
                        done();
                    });
                    assert.equal(getInstanceId(mug.form, sessionUri), null);
                    assert.equal(getInstanceId(mug.form, casedbUri), null);
                    assert.equal(calc.length, 1);
                    util.findNode(dataTree, "edd").data.handleDrop(calc);
                });
            });

            it("should hashtagify refs when written", function() {
                // this won't write the hashtags as the logic manager won't
                // have the #case reference but it will properly hashtagify
                // once the databrowser is loaded
                util.loadXML(CHILD_REF_NO_HASHTAG_XML);
                util.assertXmlEqual(call("createXML"), CHILD_REF_XML.replace(
                    "<vellum:hashtags>{&quot;#case/dob&quot;:null}</vellum:hashtags>", ''
                ));
            });

            it("is not overwritten by the forms preloaded tags", function() {
                util.loadXML(PRELOADED_HASHTAGS_XML);
                var form = call('getData').core.form;
                assert(form.isValidHashtag(dobProp));
                assert.notStrictEqual(form.hashtagMap[dobProp], null);
            });

            it("should write externally referenced hashtags to form", function() {
                util.loadXML(PRELOADED_HASHTAGS_XML);
                util.assertXmlEqual(call("createXML"), PRELOADED_HASHTAGS_XML, {normalize_xmlns: true});
            });

            it("should not write unknown referenced hashtags to form", function() {
                util.loadXML(UNKNOWN_PROPERTY_PRELOADED_HASHTAGS_XML);
                var xml = $(call("createXML")),
                    hashtags = xml.find('h\\:head, head').children('vellum\\:hashtags, hashtags'),
                    test = JSON.parse($.trim(hashtags.text()));
                assert.deepEqual(test, {"#case/dob":null});
            });

            it("should add the casedb instance when referencing a case in a label", function(done) {
                util.loadXML("");
                var mug = util.addQuestion("Text", "mug"),
                    label = $("[name=itext-en-label]"),
                    sessionUri = CASE_DATA[0].uri,
                    casedbUri = CASE_DATA[1].uri,
                    editor = label.ckeditor().editor,
                    widget = util.getWidget('itext-en-label');
                widget.input.promise.then(function () { 
                    editor.on('change', _.debounce(function() {
                        assert.equal(mug.p.labelItext.get(), '<output value="#case/dob" /> ');
                        assert.equal(getInstanceId(mug.form, sessionUri), "commcaresession");
                        assert.equal(getInstanceId(mug.form, casedbUri), "casedb");
                        util.assertXmlEqual(call("createXML"), CHILD_REF_OUTPUT_VALUE_XML,
                                            {normalize_xmlns: true});
                        done();
                    }, 20));
                    assert.equal(getInstanceId(mug.form, sessionUri), null);
                    assert.equal(getInstanceId(mug.form, casedbUri), null);
                    assert.equal(label.length, 1);
                    util.findNode(dataTree, "dob").data.handleDrop(label);
                });
            });

            describe("with two languages", function () {
                beforeEach(function (done) {
                    util.init({
                        plugins: plugins,
                        javaRosa: {langs: ['en', 'hin']},
                        core: {
                            dataSourcesEndpoint: function (callback) { callback(CASE_DATA); },
                            onReady: function () {
                                databrowser.initDataBrowser(this);
                                dataTree = this.$f.find(".fd-external-sources-tree").jstree(true);
                                done();
                            }
                        }
                    });
                });

                it("should add the casedb instance when referencing a case in a label of non default language", function(done) {
                    util.loadXML("");
                    var mug = util.addQuestion("Text", "mug");
                    // util.addQuestion sets nodeId and labelItext in a way that doesn't affect UI
                    util.clickQuestion('mug');
                    var label = $("[name=itext-hin-label]"),
                        sessionUri = CASE_DATA[0].uri,
                        casedbUri = CASE_DATA[1].uri,
                        editor = label.ckeditor().editor,
                        widget = util.getWidget('itext-hin-label');
                    widget.input.promise.then(function () { 
                        editor.on('change', _.debounce(function() {
                            assert.equal(mug.p.labelItext.get(), '');
                            assert.equal(mug.p.labelItext.get(null, 'hin'), '<output value="#case/dob" /> ');
                            assert.equal(getInstanceId(mug.form, sessionUri), "commcaresession");
                            assert.equal(getInstanceId(mug.form, casedbUri), "casedb");
                            util.assertXmlEqual(call("createXML"), CHILD_REF_OUTPUT_VALUE_OTHER_LANG_XML,
                                                {normalize_xmlns: true});
                            done();
                        }, 20));
                        assert.equal(getInstanceId(mug.form, sessionUri), null);
                        assert.equal(getInstanceId(mug.form, casedbUri), null);
                        assert.equal(label.length, 1);
                        util.findNode(dataTree, "dob").data.handleDrop(label);
                    });
                });
            });

            describe("when rich_text is off", function () {
                before(function (done) {
                    util.init({
                        plugins: plugins,
                        javaRosa: {langs: ['en']},
                        core: {
                            dataSourcesEndpoint: function (callback) { callback(CASE_DATA); },
                            onReady: function () {
                                databrowser.initDataBrowser(this);
                                dataTree = this.$f.find(".fd-external-sources-tree").jstree(true);
                                done();
                            }
                        },
                        features: { rich_text: false },
                    });
                });

                it("should add ref on drag/drop", function() {
                    util.loadXML("");
                    var mug = util.addQuestion("DataBindOnly", "mug"),
                        calc = $("[name=property-calculateAttr]"),
                        sessionUri = CASE_DATA[0].uri,
                        casedbUri = CASE_DATA[1].uri,
                        where = "@case_id = instance('commcaresession')/session/data/case_id";
                    assert.equal(getInstanceId(mug.form, sessionUri), null);
                    assert.equal(getInstanceId(mug.form, casedbUri), null);
                    assert.equal(calc.length, 1);
                    util.findNode(dataTree, "dob").data.handleDrop(calc);
                    assert.equal(mug.p.calculateAttr,
                                 "instance('casedb')/cases/case[" + where + "]/dob");
                    assert.equal(getInstanceId(mug.form, sessionUri), "commcaresession");
                    assert.equal(getInstanceId(mug.form, casedbUri), "casedb");
                });

                it("should add parent ref on drag/drop", function() {
                    util.loadXML("");
                    var mug = util.addQuestion("DataBindOnly", "mug"),
                        calc = $("[name=property-calculateAttr]"),
                        sessionUri = CASE_DATA[0].uri,
                        casedbUri = CASE_DATA[1].uri,
                        whereSession = "@case_id = instance('commcaresession')/session/data/case_id",
                        whereParent = "@case_id = instance('casedb')/cases/case[" + whereSession + "]/index/parent";
                    assert.equal(getInstanceId(mug.form, sessionUri), null);
                    assert.equal(getInstanceId(mug.form, casedbUri), null);
                    assert.equal(calc.length, 1);
                    util.findNode(dataTree, "edd").data.handleDrop(calc);
                    assert.equal(mug.p.calculateAttr, "instance('casedb')/cases/case[" + whereParent + "]/edd");
                    assert.equal(getInstanceId(mug.form, sessionUri), "commcaresession");
                    assert.equal(getInstanceId(mug.form, casedbUri), "casedb");
                });
            });

            it("shouldn't show invalid properties", function() {
                assert.isNull(util.findNode(dataTree, "invalid"), "invalid shouldn't be in case tree");
            });

            // TODO should remove instances when expression ref is removed
        });

        describe("when loaded after the form", function () {
            var vellum, widget, blue, event = {};
            vellumUtil.eventuality(event);
            function loadDataTree(done) {
                databrowser.initDataBrowser(vellum);
                done();
            }
            before(function (done) {
                util.init({
                    plugins: plugins,
                    javaRosa: {langs: ['en']},
                    core: {
                        dataSourcesEndpoint: function (callback) {
                            event.on("loadCaseData", function() {
                                callback(CASE_DATA);
                            });
                        },
                        form: "",
                        onReady: function () {
                            vellum = this;
                            blue = util.addQuestion("DataBindOnly", "blue");
                            widget = util.getWidget('property-calculateAttr');
                            widget.input.promise.then(done);
                        }
                    }
                });
            });

            it("should error for unknown properties", function(done) {
                widget.setValue(escapedDobProp);
                widget.handleChange();
                assert(!util.isTreeNodeValid(blue), "expected validation error");
                assert.lengthOf(widget.getControl().find('.label-datanode-unknown'), 1);
                event.fire("loadCaseData");
                loadDataTree(function() {
                    assert(util.isTreeNodeValid(blue), blue.getErrors().join("\n"));
                    done();
                });
            });
        });

        describe("when loaded after the form with loaded xml", function () {
            var vellum, widget, event = {};
            vellumUtil.eventuality(event);
            function loadDataTree(done) {
                databrowser.initDataBrowser(vellum);
                done();
            }
            beforeEach(function (done) {
                util.init({
                    plugins: plugins,
                    javaRosa: {langs: ['en']},
                    core: {
                        dataSourcesEndpoint: function (callback) {
                            event.on("loadCaseData", function() {
                                callback(CASE_DATA);
                            });
                        },
                        form: PRELOADED_HASHTAGS_XML,
                        onReady: function () {
                            vellum = this;
                            widget = util.getWidget('property-calculateAttr');
                            widget.input.promise.then(done);
                        }
                    }
                });
            });

            it("should not error for known properties", function() {
                assert.strictEqual(widget.getValue(), escapedDobProp);
                assert.lengthOf(widget.getControl().find('.label-datanode-unknown'), 0);
                event.fire("loadCaseData");
                assert.strictEqual(widget.getValue(), escapedDobProp);
                assert.lengthOf(widget.getControl().find('.label-datanode-unknown'), 0);
            });

            it("overwrites the forms preloaded tags", function() {
                var form = call('getData').core.form;
                assert(form.isValidHashtag(dobProp));
                assert.strictEqual(form.hashtagMap[dobProp], null);
                event.fire("loadCaseData");
                assert(form.isValidHashtag(dobProp));
                assert.notStrictEqual(form.hashtagMap[dobProp], null);
            });

            it("should not write unknown referenced hashtags to form", function() {
                util.loadXML(UNKNOWN_PROPERTY_PRELOADED_HASHTAGS_XML);
                event.fire("loadCaseData");
                var xml = $(call("createXML")),
                    hashtags = xml.find('h\\:head, head').children('vellum\\:hashtags, hashtags'),
                    test = JSON.parse($.trim(hashtags.text()));
                assert.deepEqual(test, {"#case/dob":null});
            });

            it("the parser and form should point to same hashtag dictionary", function (done) {
                // this test probably knows a little too much about the form's inner workings...
                var form = call('getData').core.form,
                    origFormDict = form.hashtagMap,
                    parser = form.xpath;
                event.fire('loadCaseData');
                loadDataTree(function() {
                    var newForm = call('getData').core.form,
                        newFormDict = newForm.hashtagMap,
                        newParser = newForm.xpath;

                    // expect that the translation dictionary will change after loading case
                    // properties, but the parser should not
                    assert.notStrictEqual(newFormDict, origFormDict);
                    assert.strictEqual(newParser, parser);

                    util.addQuestion('Text', 'text');
                    var parsedResult = parser.parse('#form/text').toXPath();
                    assert.strictEqual(parsedResult, '/data/text');
                    done();
                });
            });

            it("should not cause null xpath", function () {
                util.loadXML(CASE_PROPERTY_XML);
                //databrowser.initDataBrowser(vellum);
                event.fire("loadCaseData");
                util.loadXML(CASE_PROPERTY_XML);
                util.assertXmlEqual(util.call("createXML"), CASE_PROPERTY_XML);
                    //CASE_PROPERTY_XML.replace(/ vellum:\w+=".*?"/g, ""));
                assert(false);
            });
        });

        describe("without rich text", function () {
            before(function (done) {
                util.init({
                    features: {rich_text: false},
                    plugins: plugins,
                    javaRosa: {langs: ['en']},
                    core: {
                        dataSourcesEndpoint: function (callback) { callback(CASE_DATA); },
                        invalidCaseProperties: ['invalid'],
                        onReady: function () {
                            databrowser.initDataBrowser(this);
                            dataTree = this.$f.find(".fd-external-sources-tree").jstree(true);
                            done();
                        }
                    }
                });
            });

            it("should add ref on drag/drop", function() {
                util.loadXML("");
                var mug = util.addQuestion("Text", "mug"),
                    text = $("[name=itext-en-label]"),
                    sessionUri = CASE_DATA[0].uri,
                    casedbUri = CASE_DATA[1].uri;
                assert.equal(getInstanceId(mug.form, sessionUri), null);
                assert.equal(getInstanceId(mug.form, casedbUri), null);
                assert.equal(text.length, 1);
                util.findNode(dataTree, "dob").data.handleDrop(text);
                assert.equal(mug.p.labelItext.get(),
                             "<output value=\"instance('casedb')/cases/case[@case_id = instance('commcaresession')/session/data/case_id]/dob\" />");
                assert.equal(getInstanceId(mug.form, sessionUri), "commcaresession");
                assert.equal(getInstanceId(mug.form, casedbUri), "casedb");
            });
        });
    });
});

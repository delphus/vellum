mocha.setup('bdd');
mocha.reporter('html');


var useBuilt = !window.mochaPhantomJS && 
        window.location.href.indexOf('localhost') === -1,
    search = window.location.search;

if (search.indexOf('built') !== -1) {
    useBuilt = true;
} else if (search.indexOf('async') !== -1) {
    useBuilt = false;
}

require.config({
    baseUrl: '../',
    packages: [
        {
            name: 'jquery.vellum',
            location: useBuilt ? '../_build/src' : '../src',
            main: 'main'
        },
        {
            name: 'vellum-matrix',
            location: 'tests',
            main: 'matrix'
        }
    ],
    config: {
        'jquery.vellum/require-config': {
            env: useBuilt ? 'production' : 'development'
        }
    }
});

require([
    'jquery.vellum/require-config',
], function () {
    // define our own paths for test dependencies that are also dependencies of
    // vellum that get excluded from the built version of vellum, to ensure that
    // the built version is tested correctly
    require.config({
        // handle potential slow free heroku dynos
        waitSeconds: 60,
        map: {
            '*': {
                'test_tpl': '../bower_components/requirejs-tpl/tpl'
            }
        },
        paths: {
            'chai': '../bower_components/chai/chai',
            'sinon': '../bower_components/sinonjs/sinon',

            'equivalent-xml': '../bower_components/equivalent-xml-js/src/equivalent-xml'
        },
        shim: {
            'equivalent-xml': {
                deps: ['underscore'],
                exports: 'EquivalentXml'
            },
            'sinon': {
                exports: 'sinon'
            }
        }
    });

    if (useBuilt) {
        require.config({
            paths: {
                'text': '../bower_components/requirejs-text',
                // for some reason this is necessary in firefox only for built
                // version test page.  It shouldn't be
                'tpl': '../bower_components/requirejs-tpl',
                // https://github.com/guybedford/require-css/issues/133 
                //'css': 'error',
                'less': 'error',
                'json': 'error'
            }
        });
    }

    require([
        'jquery',
        'tests/options',
        'jquery.vellum',

        // register tests on global mocha instance as side-effect
        'tests/formdesigner.ignoreButRetain',
        'tests/formdesigner.lock',
        'tests/itemset'
    ], function (
        $,
        options
    ) {
        var lastSavedForm = null,
            vellumOptions = $.extend(true, {}, options.options, {
                core: {
                    saveUrl: function (data) {
                        lastSavedForm = data.xform;
                    }
                }
            });

        $('#run-tests').click(function () {
            $('#mocha').empty();
            if (window.mochaPhantomJS) {
                mochaPhantomJS.run();
            } else {
                mocha.run();
            }
        });

        $('#load-saved').click(function () {
            $('#vellum').empty().vellum(vellumOptions);

            // trigger vellum resizing
            setTimeout(function () {
                $(document).scroll();
            }, 500);
        }).click();
    });
});

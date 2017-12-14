define([
    '/customize/messages.js',
    '/api/config'
], function (Messages, ApiConfig) {
    var Feedback = {};

    Feedback.init = function (state) {
        Feedback.state = state;
    };

    var randomToken = function () {
        return Math.random().toString(16).replace(/0./, '');
    };
    var ajax = function (url, cb) {
        var http = new XMLHttpRequest();
        http.open('HEAD', url);
        http.onreadystatechange = function() {
            if (this.readyState === this.DONE) {
                if (cb) { cb(); }
            }
        };
        http.send();
    };
    Feedback.send = function (action, force) {
        if (!action) { return; }
        if (force !== true) {
            if (!Feedback.state) { return; }
        }

        var href = (ApiConfig.prefix || '') + '/common/feedback.html?' + action + '=' + randomToken();
        ajax(href);
    };

    Feedback.reportAppUsage = function () {
        var pattern = window.location.pathname.split('/')
            .filter(function (x) { return x; }).join('.');
        if (/^#\/1\/view\//.test(window.location.hash)) {
            Feedback.send(pattern + '_VIEW');
        } else {
            Feedback.send(pattern);
        }
    };

    Feedback.reportScreenDimensions = function () {
        var h = window.innerHeight;
        var w = window.innerWidth;
        Feedback.send('DIMENSIONS:' + h + 'x' + w);
    };
    Feedback.reportLanguage = function () {
        Feedback.send('LANG_' + Messages._languageUsed);
    };


    return Feedback;
});

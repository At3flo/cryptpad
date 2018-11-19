// This file provides the API for the channel for talking to and from the sandbox iframe.
define([
    //'/common/sframe-protocol.js',
    '/common/common-util.js'
], function (/*SFrameProtocol,*/ Util) {

    var mkTxid = function () {
        return Math.random().toString(16).replace('0.', '') + Math.random().toString(16).replace('0.', '');
    };

    var create = function (onMsg, postMsg, cb, isWorker) {
        var chanLoaded;
        var waitingData;
        if (!isWorker) {
            chanLoaded = false;
            waitingData = [];
            onMsg.reg(function (data) {
                if (chanLoaded) { return; }
                waitingData.push(data);
            });
        }

        var evReady = Util.mkEvent(true);

        var handlers = {};
        var queries = {};

        // list of handlers which are registered from the other side...
        var insideHandlers = [];
        var callWhenRegistered = {};

        var chan = {};

        // Send a query.  channel.query('Q_SOMETHING', { args: "whatever" }, function (reply) { ... });
        chan.query = function (q, content, cb, opts) {
            var txid = mkTxid();
            opts = opts || {};
            var to = opts.timeout || 30000;
            var timeout = setTimeout(function () {
                delete queries[txid];
                //console.log("Timeout making query " + q);
            }, to);
            queries[txid] = function (data, msg) {
                clearTimeout(timeout);
                delete queries[txid];
                cb(undefined, data.content, msg);
            };
            evReady.reg(function () {
                postMsg(JSON.stringify({
                    txid: txid,
                    content: content,
                    q: q
                }));
            });
        };

        // Fire an event.  channel.event('EV_SOMETHING', { args: "whatever" });
        var event = chan.event = function (e, content) {
            evReady.reg(function () {
                postMsg(JSON.stringify({ content: content, q: e }));
            });
        };

        // Be notified on query or event.  channel.on('EV_SOMETHING', function (args, reply) { ... });
        // If the type is a query, your handler will be invoked with a reply function that takes
        // one argument (the content to reply with).
        chan.on = function (queryType, handler, quiet) {
            (handlers[queryType] = handlers[queryType] || []).push(function (data, msg) {
                handler(data.content, function (replyContent) {
                    postMsg(JSON.stringify({
                        txid: data.txid,
                        content: replyContent
                    }));
                }, msg);
            });
            if (!quiet) {
                event('EV_REGISTER_HANDLER', queryType);
            }
        };

        // If a particular handler is registered, call the callback immediately, otherwise it will be called
        // when that handler is first registered.
        // channel.whenReg('Q_SOMETHING', function () { ...query Q_SOMETHING?... });
        chan.whenReg = function (queryType, cb, always) {
            var reg = always;
            if (insideHandlers.indexOf(queryType) > -1) {
                cb();
            } else {
                reg = true;
            }
            if (reg) {
                (callWhenRegistered[queryType] = callWhenRegistered[queryType] || []).push(cb);
            }
        };

        // Same as whenReg except it will invoke every time there is another registration, not just once.
        chan.onReg = function (queryType, cb) { chan.whenReg(queryType, cb, true); };

        chan.on('EV_REGISTER_HANDLER', function (content) {
            if (callWhenRegistered[content]) {
                callWhenRegistered[content].forEach(function (f) { f(); });
                delete callWhenRegistered[content];
            }
            insideHandlers.push(content);
        });
        chan.whenReg('EV_REGISTER_HANDLER', evReady.fire);

        // Make sure both iframes are ready
        var isReady  =false;
        chan.onReady = function (h) {
            if (isReady) {
                return void h();
            }
            if (typeof(h) !== "function") { return; }
            chan.on('EV_RPC_READY', function () { isReady = true; h(); });
        };
        chan.ready = function () {
            chan.whenReg('EV_RPC_READY', function () {
                chan.event('EV_RPC_READY');
            });
        };

        onMsg.reg(function (msg) {
            var data = JSON.parse(msg.data);
            if (typeof(data.q) === 'string' && handlers[data.q]) {
                handlers[data.q].forEach(function (f) {
                    f(data || JSON.parse(msg.data), msg);
                    data = undefined;
                });
            } else if (typeof(data.q) === 'undefined' && queries[data.txid]) {
                queries[data.txid](data, msg);
            } else {
                console.log("DROP Unhandled message");
                console.log(msg.data, isWorker);
                console.log(msg);
            }
        });
        if (isWorker) {
            evReady.fire();
        } else {
            chanLoaded = true;
            waitingData.forEach(function (d) {
                onMsg.fire(d);
            });
            waitingData = [];
        }
        cb(chan);
    };

    return { create: create };
});

(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
'use strict';

(function () {

    var pkg = require('../package.json');
    window.ChatEngineCore.plugin[pkg.name] = require('../src/plugin.js');
})();

},{"../package.json":2,"../src/plugin.js":5}],2:[function(require,module,exports){
module.exports={
  "author": "Adam Bavosa",
  "name": "chat-engine-webrtc",
  "version": "0.0.1",
  "main": "src/plugin.js",
  "dependencies": {
    "chat-engine": "^0.9.18"
  },
  "browserify": {
    "transform": [
      [
        "babelify",
        {
          "presets": [
            "es2015"
          ]
        }
      ]
    ]
  },
  "devDependencies": {
    "babel-core": "^6.26.3",
    "babel-preset-es2015": "^6.24.1",
    "babelify": "^8.0.0"
  }
}

},{}],3:[function(require,module,exports){
'use strict';

/**
 * @file Fallback event handlers set in the WebRTCCall constructor. If the
 *     client does not provide any of the noted event handlers, these functions
 *     will execute and throw a ChatEngine error with ChatEngine.throwError.
 *     Although this.ChatEngine is referenced, there is no need to use the
 *     JavaScript call or apply methods thanks to the plugin architecture.
 * @author Adam Bavosa <adamb@pubnub.com>
 */

/**
 * A function that is called if the client did not pass a parent onIncomingCall
 *     event handler to the WebRTC plugin instance.
 *
 * @param {function} callback Callback for onIncomingCall. Accepts boolean for
 *     accepting a call. The call is automatically rejected because a function
 *     for UI input (accept/reject) is not defined.
 *
 * @returns {void}
 */
function onIncomingCallNotDefined(callback) {
    var functionName = 'onIncomingCallNotDefined';
    var message = 'A handler for the [onIncomingCall] event is not defined.';
    chatEngineError(this.ChatEngine, functionName, message);
    callback(false);
}

/**
 * A function that is called if the client did not pass an onCallResponse event
 *     handler to the call object instance.
 *
 * @returns {void}
 */
function onCallResponseNotDefined() {
    var functionName = 'onCallResponseNotDefined';
    var message = 'A handler for the [onCallResponse] event is not defined.';
    chatEngineError(this.ChatEngine, functionName, message);
}

/**
 * A function that is called if the client did not pass an onPeerStream event
 *     handler to the call object instance.
 *
 * @returns {void}
 */
function onPeerStreamNotDefined() {
    var functionName = 'onPeerStreamNotDefined';
    var message = 'A handler for the [onPeerStream] event is not defined.';
    chatEngineError(this.ChatEngine, functionName, message);
}

/**
 * A function that is called if the client did not pass an onDisconnect event
 *     handler to the call object instance.
 *
 * @returns {void}
 */
function onDisconnectNotDefined() {
    var functionName = 'onDisconnectNotDefined';
    var message = 'A handler for the [onDisconnect] event is not defined.';
    chatEngineError(this.ChatEngine, functionName, message);
}

/**
 * A helper function for throwing errors with ChatEngine. In production mode,
 *     ChatEngine Errors can be suppressed.
 *
 * @param {object} chatEngine ChatEngine instance.
 * @param {string} functionName ChatEngine instance.
 * @param {string} message ChatEngine instance.
 * @param {object|string} error Natural error object or a string message. This
 *     gets logged in the ChatEngine error event history.
 *
 * @throws Throws an error using the ChatEngine.throwError function.
 *
 * @returns {void}
 */
function chatEngineError(chatEngine, functionName, message, error) {
    message = 'ChatEngine WebRTC Plugin: ' + (message || 'undefined error');
    error = error ? error : message;

    chatEngine.throwError(chatEngine, functionName, 'webRTC', new Error(message), { error: error });
}

module.exports = {
    onIncomingCallNotDefined: onIncomingCallNotDefined,
    onCallResponseNotDefined: onCallResponseNotDefined,
    onPeerStreamNotDefined: onPeerStreamNotDefined,
    onDisconnectNotDefined: onDisconnectNotDefined,
    chatEngineError: chatEngineError
};

},{}],4:[function(require,module,exports){
'use strict';

/**
 * @file Utility functions for plugin.js.
 * @author Adam Bavosa <adamb@pubnub.com>
 */

var peerIceCandidateEvent = ['$' + 'webRTC', 'peerIceCandidate'].join('.');
var incomingCallEvent = ['$' + 'webRTC', 'incomingCall'].join('.');
var callResponseEvent = ['$' + 'webRTC', 'callResponse'].join('.');

/**
 * Makes a new, version 4, universally unique identifier (UUID). Written by
 *     Stack Overflow user broofa
 *     (https://stackoverflow.com/users/109538/broofa) in this post
 *     (https://stackoverflow.com/a/2117523/6193736).
 *
 * @returns {string} A version 4 compliant UUID.
 */
function uuid() {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, function (c) {
        return (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16);
    });
}

var eventNames = {
    peerIceCandidateEvent: peerIceCandidateEvent,
    incomingCallEvent: incomingCallEvent,
    callResponseEvent: callResponseEvent
};

module.exports = {
    uuid: uuid,
    eventNames: eventNames
};

},{}],5:[function(require,module,exports){
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * @file ChatEngine plugin for WebRTC video and audio calling.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * @author Adam Bavosa <adamb@pubnub.com>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */

var _errorHandlers = require('./helpers/error-handlers.js');

var _util = require('./helpers/util.js');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var incomingCallEvent = _util.eventNames.incomingCallEvent;
var callResponseEvent = _util.eventNames.callResponseEvent;
var peerIceCandidateEvent = _util.eventNames.peerIceCandidateEvent;
var config = void 0;

/*
 * WebRtcPhone has a `construct` method instead of a conventional `constructor`
 *     method. This is called from within ChatEngine during the plugin init
 *     process. The class extends a ChatEngine type based on the module export's
 *     `extends`. This plugin extends only the instance of the `Me` object in
 *     the ChatEngine instance.
 *
 * @class
 * @classdesc WebRtcPhone can extend any ChatEngine class type and it should be
 *     used as a singleton. By default, it extends the `Me` instance of a
 *     ChatEngine instance using the `plugin` method for initialization. It 
 *     exposes a `callUser` and a `disconnect` method. The instance encapsulates
 *     all the necessary logic and events for orchestrating a WebRTC connection.
 *     The class attempts a peer to peer connection at first. It can fallback to
 *     a TURN connection if server information is provided in the configuration.
 *     All of the WebRTC signaling is done using ChatEngine `direct` events. For
 *     this reason using `on` methods from the parent are not encouraged, so
 *     event handlers like `onIncomingCall`, `onCallResponse`, `onPeerStream`,
 *     and `onDisconnect` need to be passed to ` the class instance. Errors are
 *     logged using `ChatEngine.throwError`.
 */

var WebRtcPhone = function () {
    function WebRtcPhone() {
        _classCallCheck(this, WebRtcPhone);
    }

    _createClass(WebRtcPhone, [{
        key: 'construct',

        /*
         * Construct is a method called from ChatEngine during the plugin
         *     initialization process. It extends the object that `plugin` is called
         *     on.
         *
         * @param {function} [onIncomingCall] Function passed from the parent that
         *     executes when a `direct` event fires for an incoming WebRTC call. If
         *     a handler is not passed in the plugin configuration, an error will be
         *     thrown every time the event fires.
         * @param {function} [onCallResponse] Function passed from the parent that
         *     executes when a `direct` event fires for a call reply. If a handler
         *     is not passed in the plugin configuration, an error will be thrown
         *     every time the event fires.
         * @param {function} [onPeerStream] Function passed from the parent that
         *     executes when a the peer's stream object becomes available. If a
         *     handler is not passed in the plugin configuration, an error will be
         *     thrown every time the event fires.
         * @param {function} [onDisconnect] Function passed from the parent that
         *     executes when a user in the call disconnects. If a handler is not
         *     passed in the plugin configuration, an error will be thrown every
         *     time the event fires.
         * @param {object} [myStream] A browser `MediaStream` object of the local
         *     client audio and/or video.
         * @param {object} [rtcConfig] An `RTCConfiguration` dictionary that is used
         *     to initialize the `RTCPeerConnection`. This is where STUN and TURN
         *     server information should be provided.
         * @param {boolean} [ignoreNonTurn] If true, this will force the ICE
         *     candidate registration to ignore all candidates that are not TURN 
         *     servers.
         *
         * @returns {void}
         */
        value: function construct() {
            var _this = this;

            this.onIncomingCall = config.onIncomingCall || _errorHandlers.onIncomingCallNotDefined;
            this.onCallResponse = config.onCallResponse || _errorHandlers.onCallResponseNotDefined;
            this.onPeerStream = config.onPeerStream || _errorHandlers.onPeerStreamNotDefined;
            this.onDisconnect = config.onDisconnect || _errorHandlers.onDisconnectNotDefined;
            this.myStream = config.myStream;
            this.rtcConfig = config.rtcConfig;
            this.ignoreNonTurn = config.ignoreNonTurn;

            // ChatEngine Direct event handler for incoming call requests.
            this.ChatEngine.me.direct.on(incomingCallEvent, function (payload) {
                incomingCall.call(_this, payload);
            });

            // ChatEngine Direct event handler for call responses.
            this.ChatEngine.me.direct.on(callResponseEvent, function (payload) {
                callResponse.call(_this, payload);
            });

            // ChatEngine Direct event handler for receiving new peer ICE candidates
            this.ChatEngine.me.direct.on(peerIceCandidateEvent, function (payload) {
                peerIceCandidate.call(_this, payload);
            });
        }

        /*
         * Initialize a WebRTC call with another ChatEngine user that is online.
         *     This is called from parent.
         *
         * @param {object} user ChatEngine user object of the user this client
         *     intends to call.
         * @param {object} object
         * @param {function} object.onPeerStream Event handler for when a peer's
         *     stream becomes available. This will overwrite a handler that was
         *     passed on initialization.
         * @param {object} object.myStream A browser `MediaStream` object of the
         *     local client audio and/or video. This will overwrite a stream that
         *     was passed on initialization.
         * @param {object} object.offerOptions An `RTCOfferOptions` dictionary that
         *     specifies audio and/or video for the peer connection offer.
         * @param {object} object.rtcConfig An `RTCConfiguration` dictionary that is
         *     used to initialize the `RTCPeerConnection`. This will overwrite an
         *     `rtcConfig` that was passed on initialization.
         *
         * @returns {void}
         */

    }, {
        key: 'callUser',
        value: function callUser(user, _ref) {
            var _this2 = this;

            var onPeerStream = _ref.onPeerStream,
                myStream = _ref.myStream,
                offerOptions = _ref.offerOptions,
                rtcConfig = _ref.rtcConfig;

            rtcConfig = this.rtcConfig = rtcConfig || this.rtcConfig;
            myStream = this.myStream = myStream || this.myStream;
            onPeerStream = this.onPeerStream = onPeerStream || this.onPeerStream;
            offerOptions = offerOptions || {
                offerToReceiveAudio: 1,
                offerToReceiveVideo: 1
            };
            var peerConnection = this.peerConnection = new RTCPeerConnection(rtcConfig);
            var callId = this.callId = (0, _util.uuid)(); // Call ID
            var localDescription = void 0; // WebRTC local description
            peerConnection.ontrack = onPeerStream;
            myStream.getTracks().forEach(function (track) {
                peerConnection.addTrack(track, myStream);
            });
            peerConnection.iceCache = [];

            peerConnection.oniceconnectionstatechange = function () {
                if (peerConnection.iceConnectionState === 'disconnected') {
                    _this2.disconnect();
                }
            };

            // When ICE candidates become available, send them to the peer client.
            peerConnection.onicecandidate = function (iceEvent) {
                if (!iceEvent.candidate) {
                    return;
                }
                onIceCandidate(iceEvent, user, peerConnection, callId);
            };

            peerConnection.onnegotiationneeded = function () {
                peerConnection.createOffer(offerOptions).then(function (description) {
                    localDescription = description;
                    return peerConnection.setLocalDescription(localDescription);
                }).then(function () {
                    user.direct.emit(incomingCallEvent, {
                        callId: callId,
                        rtcConfig: rtcConfig,
                        description: localDescription
                    });
                }).catch(function (error) {
                    var functionName = 'callUser';
                    var message = 'WebRTC [' + functionName + '] error.';
                    (0, _errorHandlers.chatEngineError)(_this2.ChatEngine, functionName, message, error);
                });
            };
        }

        /*
         * Gracefully closes the currently open WebRTC call. This is called from
         *     parent.
         *
         * @returns {void}
         */

    }, {
        key: 'disconnect',
        value: function disconnect() {
            this.peerConnection.close();
            delete this.peerConnection;
            this.callInSession = false;
            this.onDisconnect();
        }
    }]);

    return WebRtcPhone;
}();

/*
 * This event fires when the call peer has indicated whether they will accept or
 *     reject an incoming call. The trigger is a ChatEngine `direct` event in
 *     the WebRtcPhone class.
 *
 * @param {object} payload A ChatEngine `direct` event payload.
 *
 * @returns {void}
 */


function callResponse(payload) {
    var _this3 = this;

    var _payload$data = payload.data,
        callId = _payload$data.callId,
        acceptedCall = _payload$data.acceptedCall;

    var remoteDescription = payload.data.description;
    var sender = payload.sender;

    if (acceptedCall) {
        this.peerConnection.acceptedCall = true;
        this.callInSession = true;

        this.peerConnection.setRemoteDescription(remoteDescription).then(function () {
            sendIceCandidates(sender, _this3.peerConnection, callId);
        }).catch(function (error) {
            var functionName = 'callResponse';
            var message = 'WebRTC [' + functionName + '] error.';
            (0, _errorHandlers.chatEngineError)(_this3.ChatEngine, functionName, message, error);
        });
    }

    this.onCallResponse(acceptedCall);
}

/*
 * This event fires when a call peer has attempted to initiate a call. The
 *      trigger is a ChatEngine `direct` event in the WebRtcPhone class.
 *
 * @param {object} payload A ChatEngine `direct` event payload.
 *
 * @returns {void}
 */
function incomingCall(payload) {
    var _this4 = this;

    var sender = payload.sender;
    var _payload$data2 = payload.data,
        callId = _payload$data2.callId,
        rtcConfig = _payload$data2.rtcConfig;

    var remoteDescription = payload.data.description;

    // Is executed after this client accepts or rejects an incoming call, which
    // is typically done in their UI.
    var callResponseCallback = function callResponseCallback(params) {
        var acceptedCall = params.acceptedCall,
            onPeerStream = params.onPeerStream,
            myStream = params.myStream;

        myStream = _this4.myStream = myStream || _this4.myStream;
        onPeerStream = onPeerStream || _this4.onPeerStream;

        if (acceptedCall) {
            if ((typeof myStream === 'undefined' ? 'undefined' : _typeof(myStream)) !== 'object') {
                var functionName = 'incomingCall';
                var message = 'WebRTC [' + functionName + ']:' + 'No local video stream defined.';
                (0, _errorHandlers.chatEngineError)(_this4.ChatEngine, functionName, message, error);
            }

            var localDescription = void 0;
            var peerConnection = _this4.peerConnection = new RTCPeerConnection(rtcConfig);
            peerConnection.ontrack = onPeerStream;
            peerConnection.iceCache = [];
            myStream.getTracks().forEach(function (track) {
                peerConnection.addTrack(track, myStream);
            });

            peerConnection.oniceconnectionstatechange = function () {
                if (peerConnection.iceConnectionState === 'disconnected') {
                    _this4.disconnect();
                }
            };

            // Send ICE candidates to peer as they come available locally.
            peerConnection.onicecandidate = function (iceEvent) {
                if (!iceEvent.candidate) {
                    return;
                }

                onIceCandidate(iceEvent, sender, peerConnection, callId);
            };

            peerConnection.setRemoteDescription(remoteDescription).then(function () {
                return peerConnection.createAnswer();
            }).then(function (answer) {
                localDescription = answer;
                return peerConnection.setLocalDescription(localDescription);
            }).then(function () {
                peerConnection.acceptedCall = true;
                _this4.callInSession = true;
                sendIceCandidates(sender, peerConnection, callId);
                sender.direct.emit(callResponseEvent, {
                    callId: callId,
                    acceptedCall: acceptedCall,
                    description: localDescription
                });
            }).catch(function (error) {
                var chatEngine = _this4.ChatEngine;
                var functionName = 'incomingCall';
                var message = 'WebRTC [' + functionName + '] error.';
                (0, _errorHandlers.chatEngineError)(chatEngine, functionName, message, error);
            });
        } else {
            sender.direct.emit(callResponseEvent, {
                callId: callId,
                acceptedCall: acceptedCall
            });
        }
    };

    this.onIncomingCall(sender, callResponseCallback);
}

/*
 * This event fires when the local WebRTC connection has received a new ICE
 *     candidate.
 *
 * @param {object} iceEvent A `RTCPeerConnectionIceEvent` for the local client.
 * @param {object} user A ChatEngine user object for the peer to send the ICE
 *     candidate to.
 * @param {object} peerConnection The local `RTCPeerConnection` object.
 * @param {string} callId A UUID for the unique call.
 *
 * @returns {void}
 */
function onIceCandidate(iceEvent, user, peerConnection, callId) {
    peerConnection.iceCache.push(iceEvent.candidate);
    if (peerConnection.acceptedCall) {
        sendIceCandidates(user, peerConnection, callId);
    }
}

/*
 * This sends an array of ICE candidates
 *
 * @param {object} user A ChatEngine user object for the peer to send the ICE
 *     candidate to.
 * @param {object} peerConnection The local `RTCPeerConnection` object.
 * @param {string} callId A UUID for the unique call.
 *
 * @returns {void}
 */
function sendIceCandidates(user, peerConnection, callId) {
    user.direct.emit(peerIceCandidateEvent, {
        callId: callId,
        candidates: peerConnection.iceCache
    });
}

/*
 * This event fires when the peer WebRTC client sends a new ICE candidate. This
 *     event registers the candidate with the local `RTCPeerConnection` object.
 *
 * @param {object} payload A ChatEngine `direct` event payload.
 *
 * @returns {void}
 */
function peerIceCandidate(payload) {
    var _this5 = this;

    var peerConnection = this.peerConnection,
        ignoreNonTurn = this.ignoreNonTurn;
    var _payload$data3 = payload.data,
        callId = _payload$data3.callId,
        candidates = _payload$data3.candidates;


    if ((typeof candidates === 'undefined' ? 'undefined' : _typeof(candidates)) !== 'object' || !peerConnection) {
        return;
    }

    candidates.forEach(function (candidate) {
        // Ignore all non-TURN ICE candidates if specified in config.
        if (ignoreNonTurn && candidate.candidate.indexOf('typ relay') === -1) {
            return;
        }

        peerConnection.addIceCandidate(candidate).catch(function (error) {
            // No need to log errors for invalid ICE candidates
            if (error.message === 'Error processing ICE candidate') {
                return;
            }

            var functionName = 'peerIceCandidate';
            var message = 'ChatEngine WebRTC [' + functionName + '] error.';
            (0, _errorHandlers.chatEngineError)(_this5.ChatEngine, functionName, message, error);
        });
    });
}

module.exports = function () {
    var configuration = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    config = configuration;
    return {
        namespace: 'webRTC',
        extends: {
            Me: WebRtcPhone
        }
    };
};

},{"./helpers/error-handlers.js":3,"./helpers/util.js":4}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy5udm0vdmVyc2lvbnMvbm9kZS92OC4xMS4yL2xpYi9ub2RlX21vZHVsZXMvY2hhdC1lbmdpbmUtcGx1Z2luL25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIudG1wL3dyYXAuanMiLCJwYWNrYWdlLmpzb24iLCJzcmMvaGVscGVycy9lcnJvci1oYW5kbGVycy5qcyIsInNyYy9oZWxwZXJzL3V0aWwuanMiLCJzcmMvcGx1Z2luLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNBQSxDQUFDLFlBQVc7O0FBRVIsUUFBTSxNQUFNLFFBQVEsaUJBQVIsQ0FBWjtBQUNBLFdBQU8sY0FBUCxDQUFzQixNQUF0QixDQUE2QixJQUFJLElBQWpDLElBQXlDLFFBQVEsa0JBQVIsQ0FBekM7QUFFSCxDQUxEOzs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUMxQkE7Ozs7Ozs7OztBQVNBOzs7Ozs7Ozs7O0FBVUEsU0FBUyx3QkFBVCxDQUFrQyxRQUFsQyxFQUE0QztBQUN4QyxRQUFNLGVBQWUsMEJBQXJCO0FBQ0EsUUFBTSxVQUFTLDBEQUFmO0FBQ0Esb0JBQWdCLEtBQUssVUFBckIsRUFBaUMsWUFBakMsRUFBK0MsT0FBL0M7QUFDQSxhQUFTLEtBQVQ7QUFDSDs7QUFFRDs7Ozs7O0FBTUEsU0FBUyx3QkFBVCxHQUFvQztBQUNoQyxRQUFNLGVBQWUsMEJBQXJCO0FBQ0EsUUFBTSxVQUFTLDBEQUFmO0FBQ0Esb0JBQWdCLEtBQUssVUFBckIsRUFBaUMsWUFBakMsRUFBK0MsT0FBL0M7QUFDSDs7QUFFRDs7Ozs7O0FBTUEsU0FBUyxzQkFBVCxHQUFrQztBQUM5QixRQUFNLGVBQWUsd0JBQXJCO0FBQ0EsUUFB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RUgsaUJBQVM7QUFDTCxnQkFBSTtBQURDO0FBRk4sS0FBUDtBQU1ILENBUkQiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCIoZnVuY3Rpb24oKSB7XG5cbiAgICBjb25zdCBwa2cgPSByZXF1aXJlKCcuLi9wYWNrYWdlLmpzb24nKTtcbiAgICB3aW5kb3cuQ2hhdEVuZ2luZUNvcmUucGx1Z2luW3BrZy5uYW1lXSA9IHJlcXVpcmUoJy4uL3NyYy9wbHVnaW4uanMnKTtcblxufSkoKTtcbiIsIm1vZHVsZS5leHBvcnRzPXtcbiAgXCJhdXRob3JcIjogXCJBZGFtIEJhdm9zYVwiLFxuICBcIm5hbWVcIjogXCJjaGF0LWVuZ2luZS13ZWJydGNcIixcbiAgXCJ2ZXJzaW9uXCI6IFwiMC4wLjFcIixcbiAgXCJtYWluXCI6IFwic3JjL3BsdWdpbi5qc1wiLFxuICBcImRlcGVuZGVuY2llc1wiOiB7XG4gICAgXCJjaGF0LWVuZ2luZVwiOiBcIl4wLjkuMThcIlxuICB9LFxuICBcImJyb3dzZXJpZnlcIjoge1xuICAgIFwidHJhbnNmb3JtXCI6IFtcbiAgICAgIFtcbiAgICAgICAgXCJiYWJlbGlmeVwiLFxuICAgICAgICB7XG4gICAgICAgICAgXCJwcmVzZXRzXCI6IFtcbiAgICAgICAgICAgIFwiZXMyMDE1XCJcbiAgICAgICAgICBdXG4gICAgICAgIH1cbiAgICAgIF1cbiAgICBdXG4gIH0sXG4gIFwiZGV2RGVwZW5kZW5jaWVzXCI6IHtcbiAgICBcImJhYmVsLWNvcmVcIjogXCJeNi4yNi4zXCIsXG4gICAgXCJiYWJlbC1wcmVzZXQtZXMyMDE1XCI6IFwiXjYuMjQuMVwiLFxuICAgIFwiYmFiZWxpZnlcIjogXCJeOC4wLjBcIlxuICB9XG59XG4iLCIvKipcbiAqIEBmaWxlIEZhbGxiYWNrIGV2ZW50IGhhbmRsZXJzIHNldCBpbiB0aGUgV2ViUlRDQ2FsbCBjb25zdHJ1Y3Rvci4gSWYgdGhlXG4gKiAgICAgY2xpZW50IGRvZXMgbm90IHByb3ZpZGUgYW55IG9mIHRoZSBub3RlZCBldmVudCBoYW5kbGVycywgdGhlc2UgZnVuY3Rpb25zXG4gKiAgICAgd2lsbCBleGVjdXRlIGFuZCB0aHJvdyBhIENoYXRFbmdpbmUgZXJyb3Igd2l0aCBDaGF0RW5naW5lLnRocm93RXJyb3IuXG4gKiAgICAgQWx0aG91Z2ggdGhpcy5DaGF0RW5naW5lIGlzIHJlZmVyZW5jZWQsIHRoZXJlIGlzIG5vIG5lZWQgdG8gdXNlIHRoZVxuICogICAgIEphdmFTY3JpcHQgY2FsbCBvciBhcHBseSBtZXRob2RzIHRoYW5rcyB0byB0aGUgcGx1Z2luIGFyY2hpdGVjdHVyZS5cbiAqIEBhdXRob3IgQWRhbSBCYXZvc2EgPGFkYW1iQHB1Ym51Yi5jb20+XG4gKi9cblxuLyoqXG4gKiBBIGZ1bmN0aW9uIHRoYXQgaXMgY2FsbGVkIGlmIHRoZSBjbGllbnQgZGlkIG5vdCBwYXNzIGEgcGFyZW50IG9uSW5jb21pbmdDYWxsXG4gKiAgICAgZXZlbnQgaGFuZGxlciB0byB0aGUgV2ViUlRDIHBsdWdpbiBpbnN0YW5jZS5cbiAqXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFjayBDYWxsYmFjayBmb3Igb25JbmNvbWluZ0NhbGwuIEFjY2VwdHMgYm9vbGVhbiBmb3JcbiAqICAgICBhY2NlcHRpbmcgYSBjYWxsLiBUaGUgY2FsbCBpcyBhdXRvbWF0aWNhbGx5IHJlamVjdGVkIGJlY2F1c2UgYSBmdW5jdGlvblxuICogICAgIGZvciBVSSBpbnB1dCAoYWNjZXB0L3JlamVjdCkgaXMgbm90IGRlZmluZWQuXG4gKlxuICogQHJldHVybnMge3ZvaWR9XG4gKi9cbmZ1bmN0aW9uIG9uSW5jb21pbmdDYWxsTm90RGVmaW5lZChjYWxsYmFjaykge1xuICAgIGNvbnN0IGZ1bmN0aW9uTmFtZSA9ICdvbkluY29taW5nQ2FsbE5vdERlZmluZWQnO1xuICAgIGNvbnN0IG1lc3NhZ2UgPSdBIGhhbmRsZXIgZm9yIHRoZSBbb25JbmNvbWluZ0NhbGxdIGV2ZW50IGlzIG5vdCBkZWZpbmVkLic7XG4gICAgY2hhdEVuZ2luZUVycm9yKHRoaXMuQ2hhdEVuZ2luZSwgZnVuY3Rpb25OYW1lLCBtZXNzYWdlKTtcbiAgICBjYWxsYmFjayhmYWxzZSk7XG59XG5cbi8qKlxuICogQSBmdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCBpZiB0aGUgY2xpZW50IGRpZCBub3QgcGFzcyBhbiBvbkNhbGxSZXNwb25zZSBldmVudFxuICogICAgIGhhbmRsZXIgdG8gdGhlIGNhbGwgb2JqZWN0IGluc3RhbmNlLlxuICpcbiAqIEByZXR1cm5zIHt2b2lkfVxuICovXG5mdW5jdGlvbiBvbkNhbGxSZXNwb25zZU5vdERlZmluZWQoKSB7XG4gICAgY29uc3QgZnVuY3Rpb25OYW1lID0gJ29uQ2FsbFJlc3BvbnNlTm90RGVmaW5lZCc7XG4gICAgY29uc3QgbWVzc2FnZSA9J0EgaGFuZGxlciBmb3IgdGhlIFtvbkNhbGxSZXNwb25zZV0gZXZlbnQgaXMgbm90IGRlZmluZWQuJztcbiAgICBjaGF0RW5naW5lRXJyb3IodGhpcy5DaGF0RW5naW5lLCBmdW5jdGlvbk5hbWUsIG1lc3NhZ2UpO1xufVxuXG4vKipcbiAqIEEgZnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgaWYgdGhlIGNsaWVudCBkaWQgbm90IHBhc3MgYW4gb25QZWVyU3RyZWFtIGV2ZW50XG4gKiAgICAgaGFuZGxlciB0byB0aGUgY2FsbCBvYmplY3QgaW5zdGFuY2UuXG4gKlxuICogQHJldHVybnMge3ZvaWR9XG4gKi9cbmZ1bmN0aW9uIG9uUGVlclN0cmVhbU5vdERlZmluZWQoKSB7XG4gICAgY29uc3QgZnVuY3Rpb25OYW1lID0gJ29uUGVlclN0cmVhbU5vdERlZmluZWQnO1xuICAgIGNvbnN0IG1lc3NhZ2UgPSAnQSBoYW5kbGVyIGZvciB0aGUgW29uUGVlclN0cmVhbV0gZXZlbnQgaXMgbm90IGRlZmluZWQuJztcbiAgICBjaGF0RW5naW5lRXJyb3IodGhpcy5DaGF0RW5naW5lLCBmdW5jdGlvbk5hbWUsIG1lc3NhZ2UpO1xufVxuXG4vKipcbiAqIEEgZnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgaWYgdGhlIGNsaWVudCBkaWQgbm90IHBhc3MgYW4gb25EaXNjb25uZWN0IGV2ZW50XG4gKiAgICAgaGFuZGxlciB0byB0aGUgY2FsbCBvYmplY3QgaW5zdGFuY2UuXG4gKlxuICogQHJldHVybnMge3ZvaWR9XG4gKi9cbmZ1bmN0aW9uIG9uRGlzY29ubmVjdE5vdERlZmluZWQoKSB7XG4gICAgY29uc3QgZnVuY3Rpb25OYW1lID0gJ29uRGlzY29ubmVjdE5vdERlZmluZWQnO1xuICAgIGNvbnN0IG1lc3NhZ2UgPSAnQSBoYW5kbGVyIGZvciB0aGUgW29uRGlzY29ubmVjdF0gZXZlbnQgaXMgbm90IGRlZmluZWQuJztcbiAgICBjaGF0RW5naW5lRXJyb3IodGhpcy5DaGF0RW5naW5lLCBmdW5jdGlvbk5hbWUsIG1lc3NhZ2UpO1xufVxuXG4vKipcbiAqIEEgaGVscGVyIGZ1bmN0aW9uIGZvciB0aHJvd2luZyBlcnJvcnMgd2l0aCBDaGF0RW5naW5lLiBJbiBwcm9kdWN0aW9uIG1vZGUsXG4gKiAgICAgQ2hhdEVuZ2luZSBFcnJvcnMgY2FuIGJlIHN1cHByZXNzZWQuXG4gKlxuICogQHBhcmFtIHtvYmplY3R9IGNoYXRFbmdpbmUgQ2hhdEVuZ2luZSBpbnN0YW5jZS5cbiAqIEBwYXJhbSB7c3RyaW5nfSBmdW5jdGlvbk5hbWUgQ2hhdEVuZ2luZSBpbnN0YW5jZS5cbiAqIEBwYXJhbSB7c3RyaW5nfSBtZXNzYWdlIENoYXRFbmdpbmUgaW5zdGFuY2UuXG4gKiBAcGFyYW0ge29iamVjdHxzdHJpbmd9IGVycm9yIE5hdHVyYWwgZXJyb3Igb2JqZWN0IG9yIGEgc3RyaW5nIG1lc3NhZ2UuIFRoaXNcbiAqICAgICBnZXRzIGxvZ2dlZCBpbiB0aGUgQ2hhdEVuZ2luZSBlcnJvciBldmVudCBoaXN0b3J5LlxuICpcbiAqIEB0aHJvd3MgVGhyb3dzIGFuIGVycm9yIHVzaW5nIHRoZSBDaGF0RW5naW5lLnRocm93RXJyb3IgZnVuY3Rpb24uXG4gKlxuICogQHJldHVybnMge3ZvaWR9XG4gKi9cbmZ1bmN0aW9uIGNoYXRFbmdpbmVFcnJvcihjaGF0RW5naW5lLCBmdW5jdGlvbk5hbWUsIG1lc3NhZ2UsIGVycm9yKSB7XG4gICAgbWVzc2FnZSA9ICdDaGF0RW5naW5lIFdlYlJUQyBQbHVnaW46ICcgKyAobWVzc2FnZSB8fCAndW5kZWZpbmVkIGVycm9yJyk7XG4gICAgZXJyb3IgPSBlcnJvciA/IGVycm9yIDogbWVzc2FnZTtcblxuICAgIGNoYXRFbmdpbmUudGhyb3dFcnJvcihcbiAgICAgICAgY2hhdEVuZ2luZSxcbiAgICAgICAgZnVuY3Rpb25OYW1lLFxuICAgICAgICAnd2ViUlRDJyxcbiAgICAgICAgbmV3IEVycm9yKG1lc3NhZ2UpLFxuICAgICAgICB7IGVycm9yIH1cbiAgICApO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBvbkluY29taW5nQ2FsbE5vdERlZmluZWQsXG4gICAgb25DYWxsUmVzcG9uc2VOb3REZWZpbmVkLFxuICAgIG9uUGVlclN0cmVhbU5vdERlZmluZWQsXG4gICAgb25EaXNjb25uZWN0Tm90RGVmaW5lZCxcbiAgICBjaGF0RW5naW5lRXJyb3Jcbn07IiwiLyoqXG4gKiBAZmlsZSBVdGlsaXR5IGZ1bmN0aW9ucyBmb3IgcGx1Z2luLmpzLlxuICogQGF1dGhvciBBZGFtIEJhdm9zYSA8YWRhbWJAcHVibnViLmNvbT5cbiAqL1xuXG5jb25zdCBwZWVySWNlQ2FuZGlkYXRlRXZlbnQgPSBbJyQnICsgJ3dlYlJUQycsICdwZWVySWNlQ2FuZGlkYXRlJ10uam9pbignLicpO1xuY29uc3QgaW5jb21pbmdDYWxsRXZlbnQgPSBbJyQnICsgJ3dlYlJUQycsICdpbmNvbWluZ0NhbGwnXS5qb2luKCcuJyk7XG5jb25zdCBjYWxsUmVzcG9uc2VFdmVudCA9IFsnJCcgKyAnd2ViUlRDJywgJ2NhbGxSZXNwb25zZSddLmpvaW4oJy4nKTtcblxuLyoqXG4gKiBNYWtlcyBhIG5ldywgdmVyc2lvbiA0LCB1bml2ZXJzYWxseSB1bmlxdWUgaWRlbnRpZmllciAoVVVJRCkuIFdyaXR0ZW4gYnlcbiAqICAgICBTdGFjayBPdmVyZmxvdyB1c2VyIGJyb29mYVxuICogICAgIChodHRwczovL3N0YWNrb3ZlcmZsb3cuY29tL3VzZXJzLzEwOTUzOC9icm9vZmEpIGluIHRoaXMgcG9zdFxuICogICAgIChodHRwczovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMjExNzUyMy82MTkzNzM2KS5cbiAqXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBBIHZlcnNpb24gNCBjb21wbGlhbnQgVVVJRC5cbiAqL1xuZnVuY3Rpb24gdXVpZCgpIHtcbiAgICByZXR1cm4gKFsxZTddKy0xZTMrLTRlMystOGUzKy0xZTExKS5yZXBsYWNlKFxuICAgICAgICAvWzAxOF0vZyxcbiAgICAgICAgKGMpID0+IChjIF4gY3J5cHRvLmdldFJhbmRvbVZhbHVlcyhuZXcgVWludDhBcnJheSgxKSlbMF0gJiAxNSA+PiBjIC8gNClcbiAgICAgICAgICAgIC50b1N0cmluZygxNilcbiAgICApO1xufVxuXG5jb25zdCBldmVudE5hbWVzID0ge1xuICAgIHBlZXJJY2VDYW5kaWRhdGVFdmVudCxcbiAgICBpbmNvbWluZ0NhbGxFdmVudCxcbiAgICBjYWxsUmVzcG9uc2VFdmVudFxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICB1dWlkLFxuICAgIGV2ZW50TmFtZXNcbn07IiwiLyoqXG4gKiBAZmlsZSBDaGF0RW5naW5lIHBsdWdpbiBmb3IgV2ViUlRDIHZpZGVvIGFuZCBhdWRpbyBjYWxsaW5nLlxuICogQGF1dGhvciBBZGFtIEJhdm9zYSA8YWRhbWJAcHVibnViLmNvbT5cbiAqL1xuXG5pbXBvcnQge1xuICAgIG9uSW5jb21pbmdDYWxsTm90RGVmaW5lZCxcbiAgICBvbkNhbGxSZXNwb25zZU5vdERlZmluZWQsXG4gICAgb25QZWVyU3RyZWFtTm90RGVmaW5lZCxcbiAgICBvbkRpc2Nvbm5lY3ROb3REZWZpbmVkLFxuICAgIGNoYXRFbmdpbmVFcnJvclxufSBmcm9tICcuL2hlbHBlcnMvZXJyb3ItaGFuZGxlcnMuanMnO1xuXG5pbXBvcnQge1xuICAgIHV1aWQsXG4gICAgZXZlbnROYW1lc1xufSBmcm9tICcuL2hlbHBlcnMvdXRpbC5qcyc7XG5cbmNvbnN0IGluY29taW5nQ2FsbEV2ZW50ID0gZXZlbnROYW1lcy5pbmNvbWluZ0NhbGxFdmVudDtcbmNvbnN0IGNhbGxSZXNwb25zZUV2ZW50ID0gZXZlbnROYW1lcy5jYWxsUmVzcG9uc2VFdmVudDtcbmNvbnN0IHBlZXJJY2VDYW5kaWRhdGVFdmVudCA9IGV2ZW50TmFtZXMucGVlckljZUNhbmRpZGF0ZUV2ZW50O1xubGV0IGNvbmZpZztcblxuLypcbiAqIFdlYlJ0Y1Bob25lIGhhcyBhIGBjb25zdHJ1Y3RgIG1ldGhvZCBpbnN0ZWFkIG9mIGEgY29udmVudGlvbmFsIGBjb25zdHJ1Y3RvcmBcbiAqICAgICBtZXRob2QuIFRoaXMgaXMgY2FsbGVkIGZyb20gd2l0aGluIENoYXRFbmdpbmUgZHVyaW5nIHRoZSBwbHVnaW4gaW5pdFxuICogICAgIHByb2Nlc3MuIFRoZSBjbGFzcyBleHRlbmRzIGEgQ2hhdEVuZ2luZSB0eXBlIGJhc2VkIG9uIHRoZSBtb2R1bGUgZXhwb3J0J3NcbiAqICAgICBgZXh0ZW5kc2AuIFRoaXMgcGx1Z2luIGV4dGVuZHMgb25seSB0aGUgaW5zdGFuY2Ugb2YgdGhlIGBNZWAgb2JqZWN0IGluXG4gKiAgICAgdGhlIENoYXRFbmdpbmUgaW5zdGFuY2UuXG4gKlxuICogQGNsYXNzXG4gKiBAY2xhc3NkZXNjIFdlYlJ0Y1Bob25lIGNhbiBleHRlbmQgYW55IENoYXRFbmdpbmUgY2xhc3MgdHlwZSBhbmQgaXQgc2hvdWxkIGJlXG4gKiAgICAgdXNlZCBhcyBhIHNpbmdsZXRvbi4gQnkgZGVmYXVsdCwgaXQgZXh0ZW5kcyB0aGUgYE1lYCBpbnN0YW5jZSBvZiBhXG4gKiAgICAgQ2hhdEVuZ2luZSBpbnN0YW5jZSB1c2luZyB0aGUgYHBsdWdpbmAgbWV0aG9kIGZvciBpbml0aWFsaXphdGlvbi4gSXQgXG4gKiAgICAgZXhwb3NlcyBhIGBjYWxsVXNlcmAgYW5kIGEgYGRpc2Nvbm5lY3RgIG1ldGhvZC4gVGhlIGluc3RhbmNlIGVuY2Fwc3VsYXRlc1xuICogICAgIGFsbCB0aGUgbmVjZXNzYXJ5IGxvZ2ljIGFuZCBldmVudHMgZm9yIG9yY2hlc3RyYXRpbmcgYSBXZWJSVEMgY29ubmVjdGlvbi5cbiAqICAgICBUaGUgY2xhc3MgYXR0ZW1wdHMgYSBwZWVyIHRvIHBlZXIgY29ubmVjdGlvbiBhdCBmaXJzdC4gSXQgY2FuIGZhbGxiYWNrIHRvXG4gKiAgICAgYSBUVVJOIGNvbm5lY3Rpb24gaWYgc2VydmVyIGluZm9ybWF0aW9uIGlzIHByb3ZpZGVkIGluIHRoZSBjb25maWd1cmF0aW9uLlxuICogICAgIEFsbCBvZiB0aGUgV2ViUlRDIHNpZ25hbGluZyBpcyBkb25lIHVzaW5nIENoYXRFbmdpbmUgYGRpcmVjdGAgZXZlbnRzLiBGb3JcbiAqICAgICB0aGlzIHJlYXNvbiB1c2luZyBgb25gIG1ldGhvZHMgZnJvbSB0aGUgcGFyZW50IGFyZSBub3QgZW5jb3VyYWdlZCwgc29cbiAqICAgICBldmVudCBoYW5kbGVycyBsaWtlIGBvbkluY29taW5nQ2FsbGAsIGBvbkNhbGxSZXNwb25zZWAsIGBvblBlZXJTdHJlYW1gLFxuICogICAgIGFuZCBgb25EaXNjb25uZWN0YCBuZWVkIHRvIGJlIHBhc3NlZCB0byBgIHRoZSBjbGFzcyBpbnN0YW5jZS4gRXJyb3JzIGFyZVxuICogICAgIGxvZ2dlZCB1c2luZyBgQ2hhdEVuZ2luZS50aHJvd0Vycm9yYC5cbiAqL1xuY2xhc3MgV2ViUnRjUGhvbmUge1xuICAgIC8qXG4gICAgICogQ29uc3RydWN0IGlzIGEgbWV0aG9kIGNhbGxlZCBmcm9tIENoYXRFbmdpbmUgZHVyaW5nIHRoZSBwbHVnaW5cbiAgICAgKiAgICAgaW5pdGlhbGl6YXRpb24gcHJvY2Vzcy4gSXQgZXh0ZW5kcyB0aGUgb2JqZWN0IHRoYXQgYHBsdWdpbmAgaXMgY2FsbGVkXG4gICAgICogICAgIG9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtmdW5jdGlvbn0gW29uSW5jb21pbmdDYWxsXSBGdW5jdGlvbiBwYXNzZWQgZnJvbSB0aGUgcGFyZW50IHRoYXRcbiAgICAgKiAgICAgZXhlY3V0ZXMgd2hlbiBhIGBkaXJlY3RgIGV2ZW50IGZpcmVzIGZvciBhbiBpbmNvbWluZyBXZWJSVEMgY2FsbC4gSWZcbiAgICAgKiAgICAgYSBoYW5kbGVyIGlzIG5vdCBwYXNzZWQgaW4gdGhlIHBsdWdpbiBjb25maWd1cmF0aW9uLCBhbiBlcnJvciB3aWxsIGJlXG4gICAgICogICAgIHRocm93biBldmVyeSB0aW1lIHRoZSBldmVudCBmaXJlcy5cbiAgICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBbb25DYWxsUmVzcG9uc2VdIEZ1bmN0aW9uIHBhc3NlZCBmcm9tIHRoZSBwYXJlbnQgdGhhdFxuICAgICAqICAgICBleGVjdXRlcyB3aGVuIGEgYGRpcmVjdGAgZXZlbnQgZmlyZXMgZm9yIGEgY2FsbCByZXBseS4gSWYgYSBoYW5kbGVyXG4gICAgICogICAgIGlzIG5vdCBwYXNzZWQgaW4gdGhlIHBsdWdpbiBjb25maWd1cmF0aW9uLCBhbiBlcnJvciB3aWxsIGJlIHRocm93blxuICAgICAqICAgICBldmVyeSB0aW1lIHRoZSBldmVudCBmaXJlcy5cbiAgICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBbb25QZWVyU3RyZWFtXSBGdW5jdGlvbiBwYXNzZWQgZnJvbSB0aGUgcGFyZW50IHRoYXRcbiAgICAgKiAgICAgZXhlY3V0ZXMgd2hlbiBhIHRoZSBwZWVyJ3Mgc3RyZWFtIG9iamVjdCBiZWNvbWVzIGF2YWlsYWJsZS4gSWYgYVxuICAgICAqICAgICBoYW5kbGVyIGlzIG5vdCBwYXNzZWQgaW4gdGhlIHBsdWdpbiBjb25maWd1cmF0aW9uLCBhbiBlcnJvciB3aWxsIGJlXG4gICAgICogICAgIHRocm93biBldmVyeSB0aW1lIHRoZSBldmVudCBmaXJlcy5cbiAgICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBbb25EaXNjb25uZWN0XSBGdW5jdGlvbiBwYXNzZWQgZnJvbSB0aGUgcGFyZW50IHRoYXRcbiAgICAgKiAgICAgZXhlY3V0ZXMgd2hlbiBhIHVzZXIgaW4gdGhlIGNhbGwgZGlzY29ubmVjdHMuIElmIGEgaGFuZGxlciBpcyBub3RcbiAgICAgKiAgICAgcGFzc2VkIGluIHRoZSBwbHVnaW4gY29uZmlndXJhdGlvbiwgYW4gZXJyb3Igd2lsbCBiZSB0aHJvd24gZXZlcnlcbiAgICAgKiAgICAgdGltZSB0aGUgZXZlbnQgZmlyZXMuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtteVN0cmVhbV0gQSBicm93c2VyIGBNZWRpYVN0cmVhbWAgb2JqZWN0IG9mIHRoZSBsb2NhbFxuICAgICAqICAgICBjbGllbnQgYXVkaW8gYW5kL29yIHZpZGVvLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbcnRjQ29uZmlnXSBBbiBgUlRDQ29uZmlndXJhdGlvbmAgZGljdGlvbmFyeSB0aGF0IGlzIHVzZWRcbiAgICAgKiAgICAgdG8gaW5pdGlhbGl6ZSB0aGUgYFJUQ1BlZXJDb25uZWN0aW9uYC4gVGhpcyBpcyB3aGVyZSBTVFVOIGFuZCBUVVJOXG4gICAgICogICAgIHNlcnZlciBpbmZvcm1hdGlvbiBzaG91bGQgYmUgcHJvdmlkZWQuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbaWdub3JlTm9uVHVybl0gSWYgdHJ1ZSwgdGhpcyB3aWxsIGZvcmNlIHRoZSBJQ0VcbiAgICAgKiAgICAgY2FuZGlkYXRlIHJlZ2lzdHJhdGlvbiB0byBpZ25vcmUgYWxsIGNhbmRpZGF0ZXMgdGhhdCBhcmUgbm90IFRVUk4gXG4gICAgICogICAgIHNlcnZlcnMuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7dm9pZH1cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3QoKSB7XG4gICAgICAgIHRoaXMub25JbmNvbWluZ0NhbGwgPSBjb25maWcub25JbmNvbWluZ0NhbGwgfHwgb25JbmNvbWluZ0NhbGxOb3REZWZpbmVkO1xuICAgICAgICB0aGlzLm9uQ2FsbFJlc3BvbnNlID0gY29uZmlnLm9uQ2FsbFJlc3BvbnNlIHx8IG9uQ2FsbFJlc3BvbnNlTm90RGVmaW5lZDtcbiAgICAgICAgdGhpcy5vblBlZXJTdHJlYW0gPSBjb25maWcub25QZWVyU3RyZWFtIHx8IG9uUGVlclN0cmVhbU5vdERlZmluZWQ7XG4gICAgICAgIHRoaXMub25EaXNjb25uZWN0ID0gY29uZmlnLm9uRGlzY29ubmVjdCB8fCBvbkRpc2Nvbm5lY3ROb3REZWZpbmVkO1xuICAgICAgICB0aGlzLm15U3RyZWFtID0gY29uZmlnLm15U3RyZWFtO1xuICAgICAgICB0aGlzLnJ0Y0NvbmZpZyA9IGNvbmZpZy5ydGNDb25maWc7XG4gICAgICAgIHRoaXMuaWdub3JlTm9uVHVybiA9IGNvbmZpZy5pZ25vcmVOb25UdXJuO1xuXG4gICAgICAgIC8vIENoYXRFbmdpbmUgRGlyZWN0IGV2ZW50IGhhbmRsZXIgZm9yIGluY29taW5nIGNhbGwgcmVxdWVzdHMuXG4gICAgICAgIHRoaXMuQ2hhdEVuZ2luZS5tZS5kaXJlY3Qub24oaW5jb21pbmdDYWxsRXZlbnQsIChwYXlsb2FkKSA9PiB7XG4gICAgICAgICAgICBpbmNvbWluZ0NhbGwuY2FsbCh0aGlzLCBwYXlsb2FkKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gQ2hhdEVuZ2luZSBEaXJlY3QgZXZlbnQgaGFuZGxlciBmb3IgY2FsbCByZXNwb25zZXMuXG4gICAgICAgIHRoaXMuQ2hhdEVuZ2luZS5tZS5kaXJlY3Qub24oY2FsbFJlc3BvbnNlRXZlbnQsIChwYXlsb2FkKSA9PiB7XG4gICAgICAgICAgICBjYWxsUmVzcG9uc2UuY2FsbCh0aGlzLCBwYXlsb2FkKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gQ2hhdEVuZ2luZSBEaXJlY3QgZXZlbnQgaGFuZGxlciBmb3IgcmVjZWl2aW5nIG5ldyBwZWVyIElDRSBjYW5kaWRhdGVzXG4gICAgICAgIHRoaXMuQ2hhdEVuZ2luZS5tZS5kaXJlY3Qub24ocGVlckljZUNhbmRpZGF0ZUV2ZW50LCAocGF5bG9hZCkgPT4ge1xuICAgICAgICAgICAgcGVlckljZUNhbmRpZGF0ZS5jYWxsKHRoaXMsIHBheWxvYWQpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvKlxuICAgICAqIEluaXRpYWxpemUgYSBXZWJSVEMgY2FsbCB3aXRoIGFub3RoZXIgQ2hhdEVuZ2luZSB1c2VyIHRoYXQgaXMgb25saW5lLlxuICAgICAqICAgICBUaGlzIGlzIGNhbGxlZCBmcm9tIHBhcmVudC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSB1c2VyIENoYXRFbmdpbmUgdXNlciBvYmplY3Qgb2YgdGhlIHVzZXIgdGhpcyBjbGllbnRcbiAgICAgKiAgICAgaW50ZW5kcyB0byBjYWxsLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBvYmplY3RcbiAgICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBvYmplY3Qub25QZWVyU3RyZWFtIEV2ZW50IGhhbmRsZXIgZm9yIHdoZW4gYSBwZWVyJ3NcbiAgICAgKiAgICAgc3RyZWFtIGJlY29tZXMgYXZhaWxhYmxlLiBUaGlzIHdpbGwgb3ZlcndyaXRlIGEgaGFuZGxlciB0aGF0IHdhc1xuICAgICAqICAgICBwYXNzZWQgb24gaW5pdGlhbGl6YXRpb24uXG4gICAgICogQHBhcmFtIHtvYmplY3R9IG9iamVjdC5teVN0cmVhbSBBIGJyb3dzZXIgYE1lZGlhU3RyZWFtYCBvYmplY3Qgb2YgdGhlXG4gICAgICogICAgIGxvY2FsIGNsaWVudCBhdWRpbyBhbmQvb3IgdmlkZW8uIFRoaXMgd2lsbCBvdmVyd3JpdGUgYSBzdHJlYW0gdGhhdFxuICAgICAqICAgICB3YXMgcGFzc2VkIG9uIGluaXRpYWxpemF0aW9uLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBvYmplY3Qub2ZmZXJPcHRpb25zIEFuIGBSVENPZmZlck9wdGlvbnNgIGRpY3Rpb25hcnkgdGhhdFxuICAgICAqICAgICBzcGVjaWZpZXMgYXVkaW8gYW5kL29yIHZpZGVvIGZvciB0aGUgcGVlciBjb25uZWN0aW9uIG9mZmVyLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBvYmplY3QucnRjQ29uZmlnIEFuIGBSVENDb25maWd1cmF0aW9uYCBkaWN0aW9uYXJ5IHRoYXQgaXNcbiAgICAgKiAgICAgdXNlZCB0byBpbml0aWFsaXplIHRoZSBgUlRDUGVlckNvbm5lY3Rpb25gLiBUaGlzIHdpbGwgb3ZlcndyaXRlIGFuXG4gICAgICogICAgIGBydGNDb25maWdgIHRoYXQgd2FzIHBhc3NlZCBvbiBpbml0aWFsaXphdGlvbi5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxuICAgICAqL1xuICAgIGNhbGxVc2VyKHVzZXIsIHsgb25QZWVyU3RyZWFtLCBteVN0cmVhbSwgb2ZmZXJPcHRpb25zLCBydGNDb25maWcgfSkge1xuICAgICAgICBydGNDb25maWcgPSB0aGlzLnJ0Y0NvbmZpZyA9IHJ0Y0NvbmZpZyB8fCB0aGlzLnJ0Y0NvbmZpZztcbiAgICAgICAgbXlTdHJlYW0gPSB0aGlzLm15U3RyZWFtID0gbXlTdHJlYW0gfHwgdGhpcy5teVN0cmVhbTtcbiAgICAgICAgb25QZWVyU3RyZWFtID0gdGhpcy5vblBlZXJTdHJlYW0gPSBvblBlZXJTdHJlYW0gfHwgdGhpcy5vblBlZXJTdHJlYW07XG4gICAgICAgIG9mZmVyT3B0aW9ucyA9IG9mZmVyT3B0aW9ucyB8fCB7XG4gICAgICAgICAgICBvZmZlclRvUmVjZWl2ZUF1ZGlvOiAxLFxuICAgICAgICAgICAgb2ZmZXJUb1JlY2VpdmVWaWRlbzogMVxuICAgICAgICB9O1xuICAgICAgICBjb25zdCBwZWVyQ29ubmVjdGlvbiA9IHRoaXMucGVlckNvbm5lY3Rpb25cbiAgICAgICAgICAgID0gbmV3IFJUQ1BlZXJDb25uZWN0aW9uKHJ0Y0NvbmZpZyk7XG4gICAgICAgIGNvbnN0IGNhbGxJZCA9IHRoaXMuY2FsbElkID0gdXVpZCgpOyAvLyBDYWxsIElEXG4gICAgICAgIGxldCBsb2NhbERlc2NyaXB0aW9uOyAvLyBXZWJSVEMgbG9jYWwgZGVzY3JpcHRpb25cbiAgICAgICAgcGVlckNvbm5lY3Rpb24ub250cmFjayA9IG9uUGVlclN0cmVhbTtcbiAgICAgICAgbXlTdHJlYW0uZ2V0VHJhY2tzKCkuZm9yRWFjaCgodHJhY2spID0+IHtcbiAgICAgICAgICAgIHBlZXJDb25uZWN0aW9uLmFkZFRyYWNrKHRyYWNrLCBteVN0cmVhbSk7XG4gICAgICAgIH0pO1xuICAgICAgICBwZWVyQ29ubmVjdGlvbi5pY2VDYWNoZSA9IFtdO1xuXG4gICAgICAgIHBlZXJDb25uZWN0aW9uLm9uaWNlY29ubmVjdGlvbnN0YXRlY2hhbmdlID0gKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHBlZXJDb25uZWN0aW9uLmljZUNvbm5lY3Rpb25TdGF0ZSA9PT0gJ2Rpc2Nvbm5lY3RlZCcpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICAvLyBXaGVuIElDRSBjYW5kaWRhdGVzIGJlY29tZSBhdmFpbGFibGUsIHNlbmQgdGhlbSB0byB0aGUgcGVlciBjbGllbnQuXG4gICAgICAgIHBlZXJDb25uZWN0aW9uLm9uaWNlY2FuZGlkYXRlID0gKGljZUV2ZW50KSA9PiB7XG4gICAgICAgICAgICBpZiAoIWljZUV2ZW50LmNhbmRpZGF0ZSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG9uSWNlQ2FuZGlkYXRlKGljZUV2ZW50LCB1c2VyLCBwZWVyQ29ubmVjdGlvbiwgY2FsbElkKTtcbiAgICAgICAgfTtcblxuICAgICAgICBwZWVyQ29ubmVjdGlvbi5vbm5lZ290aWF0aW9ubmVlZGVkID0gKCkgPT4ge1xuICAgICAgICAgICAgcGVlckNvbm5lY3Rpb24uY3JlYXRlT2ZmZXIob2ZmZXJPcHRpb25zKVxuICAgICAgICAgICAgLnRoZW4oKGRlc2NyaXB0aW9uKSA9PiB7XG4gICAgICAgICAgICAgICAgbG9jYWxEZXNjcmlwdGlvbiA9IGRlc2NyaXB0aW9uO1xuICAgICAgICAgICAgICAgIHJldHVybiBwZWVyQ29ubmVjdGlvbi5zZXRMb2NhbERlc2NyaXB0aW9uKGxvY2FsRGVzY3JpcHRpb24pO1xuICAgICAgICAgICAgfSkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgdXNlci5kaXJlY3QuZW1pdChpbmNvbWluZ0NhbGxFdmVudCwge1xuICAgICAgICAgICAgICAgICAgICBjYWxsSWQsXG4gICAgICAgICAgICAgICAgICAgIHJ0Y0NvbmZpZyxcbiAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGxvY2FsRGVzY3JpcHRpb25cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pLmNhdGNoKChlcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZ1bmN0aW9uTmFtZSA9ICdjYWxsVXNlcic7XG4gICAgICAgICAgICAgICAgY29uc3QgbWVzc2FnZSA9IGBXZWJSVEMgWyR7ZnVuY3Rpb25OYW1lfV0gZXJyb3IuYDtcbiAgICAgICAgICAgICAgICBjaGF0RW5naW5lRXJyb3IodGhpcy5DaGF0RW5naW5lLCBmdW5jdGlvbk5hbWUsIG1lc3NhZ2UsIGVycm9yKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8qXG4gICAgICogR3JhY2VmdWxseSBjbG9zZXMgdGhlIGN1cnJlbnRseSBvcGVuIFdlYlJUQyBjYWxsLiBUaGlzIGlzIGNhbGxlZCBmcm9tXG4gICAgICogICAgIHBhcmVudC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxuICAgICAqL1xuICAgIGRpc2Nvbm5lY3QoKSB7XG4gICAgICAgIHRoaXMucGVlckNvbm5lY3Rpb24uY2xvc2UoKTtcbiAgICAgICAgZGVsZXRlIHRoaXMucGVlckNvbm5lY3Rpb247XG4gICAgICAgIHRoaXMuY2FsbEluU2Vzc2lvbiA9IGZhbHNlO1xuICAgICAgICB0aGlzLm9uRGlzY29ubmVjdCgpO1xuICAgIH1cbn1cblxuLypcbiAqIFRoaXMgZXZlbnQgZmlyZXMgd2hlbiB0aGUgY2FsbCBwZWVyIGhhcyBpbmRpY2F0ZWQgd2hldGhlciB0aGV5IHdpbGwgYWNjZXB0IG9yXG4gKiAgICAgcmVqZWN0IGFuIGluY29taW5nIGNhbGwuIFRoZSB0cmlnZ2VyIGlzIGEgQ2hhdEVuZ2luZSBgZGlyZWN0YCBldmVudCBpblxuICogICAgIHRoZSBXZWJSdGNQaG9uZSBjbGFzcy5cbiAqXG4gKiBAcGFyYW0ge29iamVjdH0gcGF5bG9hZCBBIENoYXRFbmdpbmUgYGRpcmVjdGAgZXZlbnQgcGF5bG9hZC5cbiAqXG4gKiBAcmV0dXJucyB7dm9pZH1cbiAqL1xuZnVuY3Rpb24gY2FsbFJlc3BvbnNlKHBheWxvYWQpIHtcbiAgICBjb25zdCB7IGNhbGxJZCwgYWNjZXB0ZWRDYWxsIH0gPSBwYXlsb2FkLmRhdGE7XG4gICAgY29uc3QgcmVtb3RlRGVzY3JpcHRpb24gPSBwYXlsb2FkLmRhdGEuZGVzY3JpcHRpb247XG4gICAgbGV0IHNlbmRlciA9IHBheWxvYWQuc2VuZGVyO1xuXG4gICAgaWYgKGFjY2VwdGVkQ2FsbCkge1xuICAgICAgICB0aGlzLnBlZXJDb25uZWN0aW9uLmFjY2VwdGVkQ2FsbCA9IHRydWU7XG4gICAgICAgIHRoaXMuY2FsbEluU2Vzc2lvbiA9IHRydWU7XG5cbiAgICAgICAgdGhpcy5wZWVyQ29ubmVjdGlvbi5zZXRSZW1vdGVEZXNjcmlwdGlvbihyZW1vdGVEZXNjcmlwdGlvbilcbiAgICAgICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICBzZW5kSWNlQ2FuZGlkYXRlcyhzZW5kZXIsIHRoaXMucGVlckNvbm5lY3Rpb24sIGNhbGxJZCk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLmNhdGNoKChlcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZ1bmN0aW9uTmFtZSA9ICdjYWxsUmVzcG9uc2UnO1xuICAgICAgICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBgV2ViUlRDIFske2Z1bmN0aW9uTmFtZX1dIGVycm9yLmA7XG4gICAgICAgICAgICAgICAgY2hhdEVuZ2luZUVycm9yKHRoaXMuQ2hhdEVuZ2luZSwgZnVuY3Rpb25OYW1lLCBtZXNzYWdlLCBlcnJvcik7XG4gICAgICAgICAgICB9KTtcbiAgICB9XG5cbiAgICB0aGlzLm9uQ2FsbFJlc3BvbnNlKGFjY2VwdGVkQ2FsbCk7XG59XG5cbi8qXG4gKiBUaGlzIGV2ZW50IGZpcmVzIHdoZW4gYSBjYWxsIHBlZXIgaGFzIGF0dGVtcHRlZCB0byBpbml0aWF0ZSBhIGNhbGwuIFRoZVxuICogICAgICB0cmlnZ2VyIGlzIGEgQ2hhdEVuZ2luZSBgZGlyZWN0YCBldmVudCBpbiB0aGUgV2ViUnRjUGhvbmUgY2xhc3MuXG4gKlxuICogQHBhcmFtIHtvYmplY3R9IHBheWxvYWQgQSBDaGF0RW5naW5lIGBkaXJlY3RgIGV2ZW50IHBheWxvYWQuXG4gKlxuICogQHJldHVybnMge3ZvaWR9XG4gKi9cbmZ1bmN0aW9uIGluY29taW5nQ2FsbChwYXlsb2FkKSB7XG4gICAgY29uc3Qgc2VuZGVyID0gcGF5bG9hZC5zZW5kZXI7XG4gICAgY29uc3QgeyBjYWxsSWQsIHJ0Y0NvbmZpZyB9ID0gcGF5bG9hZC5kYXRhO1xuICAgIGNvbnN0IHJlbW90ZURlc2NyaXB0aW9uID0gcGF5bG9hZC5kYXRhLmRlc2NyaXB0aW9uO1xuXG4gICAgLy8gSXMgZXhlY3V0ZWQgYWZ0ZXIgdGhpcyBjbGllbnQgYWNjZXB0cyBvciByZWplY3RzIGFuIGluY29taW5nIGNhbGwsIHdoaWNoXG4gICAgLy8gaXMgdHlwaWNhbGx5IGRvbmUgaW4gdGhlaXIgVUkuXG4gICAgY29uc3QgY2FsbFJlc3BvbnNlQ2FsbGJhY2sgPSAocGFyYW1zKSA9PiB7XG4gICAgICAgIGxldCB7IGFjY2VwdGVkQ2FsbCwgb25QZWVyU3RyZWFtLCBteVN0cmVhbSB9ID0gcGFyYW1zO1xuICAgICAgICBteVN0cmVhbSA9IHRoaXMubXlTdHJlYW0gPSBteVN0cmVhbSB8fCB0aGlzLm15U3RyZWFtO1xuICAgICAgICBvblBlZXJTdHJlYW0gPSBvblBlZXJTdHJlYW0gfHwgdGhpcy5vblBlZXJTdHJlYW07XG5cbiAgICAgICAgaWYgKGFjY2VwdGVkQ2FsbCkge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBteVN0cmVhbSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBmdW5jdGlvbk5hbWUgPSAnaW5jb21pbmdDYWxsJztcbiAgICAgICAgICAgICAgICBjb25zdCBtZXNzYWdlID0gYFdlYlJUQyBbJHtmdW5jdGlvbk5hbWV9XTpgICtcbiAgICAgICAgICAgICAgICAgICAgYE5vIGxvY2FsIHZpZGVvIHN0cmVhbSBkZWZpbmVkLmA7XG4gICAgICAgICAgICAgICAgY2hhdEVuZ2luZUVycm9yKHRoaXMuQ2hhdEVuZ2luZSwgZnVuY3Rpb25OYW1lLCBtZXNzYWdlLCBlcnJvcik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxldCBsb2NhbERlc2NyaXB0aW9uO1xuICAgICAgICAgICAgY29uc3QgcGVlckNvbm5lY3Rpb24gPSB0aGlzLnBlZXJDb25uZWN0aW9uXG4gICAgICAgICAgICAgICAgPSBuZXcgUlRDUGVlckNvbm5lY3Rpb24ocnRjQ29uZmlnKTtcbiAgICAgICAgICAgIHBlZXJDb25uZWN0aW9uLm9udHJhY2sgPSBvblBlZXJTdHJlYW07XG4gICAgICAgICAgICBwZWVyQ29ubmVjdGlvbi5pY2VDYWNoZSA9IFtdO1xuICAgICAgICAgICAgbXlTdHJlYW0uZ2V0VHJhY2tzKCkuZm9yRWFjaCgodHJhY2spID0+IHtcbiAgICAgICAgICAgICAgICBwZWVyQ29ubmVjdGlvbi5hZGRUcmFjayh0cmFjaywgbXlTdHJlYW0pO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHBlZXJDb25uZWN0aW9uLm9uaWNlY29ubmVjdGlvbnN0YXRlY2hhbmdlID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChwZWVyQ29ubmVjdGlvbi5pY2VDb25uZWN0aW9uU3RhdGUgPT09ICdkaXNjb25uZWN0ZWQnKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIC8vIFNlbmQgSUNFIGNhbmRpZGF0ZXMgdG8gcGVlciBhcyB0aGV5IGNvbWUgYXZhaWxhYmxlIGxvY2FsbHkuXG4gICAgICAgICAgICBwZWVyQ29ubmVjdGlvbi5vbmljZWNhbmRpZGF0ZSA9IChpY2VFdmVudCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICghaWNlRXZlbnQuY2FuZGlkYXRlKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBvbkljZUNhbmRpZGF0ZShpY2VFdmVudCwgc2VuZGVyLCBwZWVyQ29ubmVjdGlvbiwgY2FsbElkKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHBlZXJDb25uZWN0aW9uLnNldFJlbW90ZURlc2NyaXB0aW9uKHJlbW90ZURlc2NyaXB0aW9uKVxuICAgICAgICAgICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHBlZXJDb25uZWN0aW9uLmNyZWF0ZUFuc3dlcigpO1xuICAgICAgICAgICAgICAgIH0pLnRoZW4oKGFuc3dlcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBsb2NhbERlc2NyaXB0aW9uID0gYW5zd2VyO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcGVlckNvbm5lY3Rpb24uc2V0TG9jYWxEZXNjcmlwdGlvbihsb2NhbERlc2NyaXB0aW9uKTtcbiAgICAgICAgICAgICAgICB9KS50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcGVlckNvbm5lY3Rpb24uYWNjZXB0ZWRDYWxsID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jYWxsSW5TZXNzaW9uID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgc2VuZEljZUNhbmRpZGF0ZXMoc2VuZGVyLCBwZWVyQ29ubmVjdGlvbiwgY2FsbElkKTtcbiAgICAgICAgICAgICAgICAgICAgc2VuZGVyLmRpcmVjdC5lbWl0KGNhbGxSZXNwb25zZUV2ZW50LCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsSWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBhY2NlcHRlZENhbGwsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogbG9jYWxEZXNjcmlwdGlvblxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KS5jYXRjaCgoZXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY2hhdEVuZ2luZSA9IHRoaXMuQ2hhdEVuZ2luZTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZnVuY3Rpb25OYW1lID0gJ2luY29taW5nQ2FsbCc7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBgV2ViUlRDIFske2Z1bmN0aW9uTmFtZX1dIGVycm9yLmA7XG4gICAgICAgICAgICAgICAgICAgIGNoYXRFbmdpbmVFcnJvcihjaGF0RW5naW5lLCBmdW5jdGlvbk5hbWUsIG1lc3NhZ2UsIGVycm9yKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNlbmRlci5kaXJlY3QuZW1pdChjYWxsUmVzcG9uc2VFdmVudCwge1xuICAgICAgICAgICAgICAgIGNhbGxJZCxcbiAgICAgICAgICAgICAgICBhY2NlcHRlZENhbGxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5vbkluY29taW5nQ2FsbChzZW5kZXIsIGNhbGxSZXNwb25zZUNhbGxiYWNrKTtcbn1cblxuLypcbiAqIFRoaXMgZXZlbnQgZmlyZXMgd2hlbiB0aGUgbG9jYWwgV2ViUlRDIGNvbm5lY3Rpb24gaGFzIHJlY2VpdmVkIGEgbmV3IElDRVxuICogICAgIGNhbmRpZGF0ZS5cbiAqXG4gKiBAcGFyYW0ge29iamVjdH0gaWNlRXZlbnQgQSBgUlRDUGVlckNvbm5lY3Rpb25JY2VFdmVudGAgZm9yIHRoZSBsb2NhbCBjbGllbnQuXG4gKiBAcGFyYW0ge29iamVjdH0gdXNlciBBIENoYXRFbmdpbmUgdXNlciBvYmplY3QgZm9yIHRoZSBwZWVyIHRvIHNlbmQgdGhlIElDRVxuICogICAgIGNhbmRpZGF0ZSB0by5cbiAqIEBwYXJhbSB7b2JqZWN0fSBwZWVyQ29ubmVjdGlvbiBUaGUgbG9jYWwgYFJUQ1BlZXJDb25uZWN0aW9uYCBvYmplY3QuXG4gKiBAcGFyYW0ge3N0cmluZ30gY2FsbElkIEEgVVVJRCBmb3IgdGhlIHVuaXF1ZSBjYWxsLlxuICpcbiAqIEByZXR1cm5zIHt2b2lkfVxuICovXG5mdW5jdGlvbiBvbkljZUNhbmRpZGF0ZShpY2VFdmVudCwgdXNlciwgcGVlckNvbm5lY3Rpb24sIGNhbGxJZCkge1xuICAgIHBlZXJDb25uZWN0aW9uLmljZUNhY2hlLnB1c2goaWNlRXZlbnQuY2FuZGlkYXRlKTtcbiAgICBpZiAocGVlckNvbm5lY3Rpb24uYWNjZXB0ZWRDYWxsKSB7XG4gICAgICAgIHNlbmRJY2VDYW5kaWRhdGVzKHVzZXIsIHBlZXJDb25uZWN0aW9uLCBjYWxsSWQpO1xuICAgIH1cbn1cblxuLypcbiAqIFRoaXMgc2VuZHMgYW4gYXJyYXkgb2YgSUNFIGNhbmRpZGF0ZXNcbiAqXG4gKiBAcGFyYW0ge29iamVjdH0gdXNlciBBIENoYXRFbmdpbmUgdXNlciBvYmplY3QgZm9yIHRoZSBwZWVyIHRvIHNlbmQgdGhlIElDRVxuICogICAgIGNhbmRpZGF0ZSB0by5cbiAqIEBwYXJhbSB7b2JqZWN0fSBwZWVyQ29ubmVjdGlvbiBUaGUgbG9jYWwgYFJUQ1BlZXJDb25uZWN0aW9uYCBvYmplY3QuXG4gKiBAcGFyYW0ge3N0cmluZ30gY2FsbElkIEEgVVVJRCBmb3IgdGhlIHVuaXF1ZSBjYWxsLlxuICpcbiAqIEByZXR1cm5zIHt2b2lkfVxuICovXG5mdW5jdGlvbiBzZW5kSWNlQ2FuZGlkYXRlcyh1c2VyLCBwZWVyQ29ubmVjdGlvbiwgY2FsbElkKSB7XG4gICAgdXNlci5kaXJlY3QuZW1pdChwZWVySWNlQ2FuZGlkYXRlRXZlbnQsIHtcbiAgICAgICAgY2FsbElkLFxuICAgICAgICBjYW5kaWRhdGVzOiBwZWVyQ29ubmVjdGlvbi5pY2VDYWNoZVxuICAgIH0pO1xufVxuXG4vKlxuICogVGhpcyBldmVudCBmaXJlcyB3aGVuIHRoZSBwZWVyIFdlYlJUQyBjbGllbnQgc2VuZHMgYSBuZXcgSUNFIGNhbmRpZGF0ZS4gVGhpc1xuICogICAgIGV2ZW50IHJlZ2lzdGVycyB0aGUgY2FuZGlkYXRlIHdpdGggdGhlIGxvY2FsIGBSVENQZWVyQ29ubmVjdGlvbmAgb2JqZWN0LlxuICpcbiAqIEBwYXJhbSB7b2JqZWN0fSBwYXlsb2FkIEEgQ2hhdEVuZ2luZSBgZGlyZWN0YCBldmVudCBwYXlsb2FkLlxuICpcbiAqIEByZXR1cm5zIHt2b2lkfVxuICovXG5mdW5jdGlvbiBwZWVySWNlQ2FuZGlkYXRlKHBheWxvYWQpIHtcbiAgICBjb25zdCB7IHBlZXJDb25uZWN0aW9uLCBpZ25vcmVOb25UdXJuIH0gPSB0aGlzO1xuICAgIGNvbnN0IHsgY2FsbElkLCBjYW5kaWRhdGVzIH0gPSBwYXlsb2FkLmRhdGE7XG5cbiAgICBpZiAodHlwZW9mIGNhbmRpZGF0ZXMgIT09ICdvYmplY3QnIHx8ICFwZWVyQ29ubmVjdGlvbikge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY2FuZGlkYXRlcy5mb3JFYWNoKChjYW5kaWRhdGUpID0+IHtcbiAgICAgICAgLy8gSWdub3JlIGFsbCBub24tVFVSTiBJQ0UgY2FuZGlkYXRlcyBpZiBzcGVjaWZpZWQgaW4gY29uZmlnLlxuICAgICAgICBpZiAoaWdub3JlTm9uVHVybiAmJiBjYW5kaWRhdGUuY2FuZGlkYXRlLmluZGV4T2YoJ3R5cCByZWxheScpID09PSAtMSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgcGVlckNvbm5lY3Rpb24uYWRkSWNlQ2FuZGlkYXRlKGNhbmRpZGF0ZSlcbiAgICAgICAgICAgIC5jYXRjaCgoZXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICAvLyBObyBuZWVkIHRvIGxvZyBlcnJvcnMgZm9yIGludmFsaWQgSUNFIGNhbmRpZGF0ZXNcbiAgICAgICAgICAgICAgICBpZiAoZXJyb3IubWVzc2FnZSA9PT0gJ0Vycm9yIHByb2Nlc3NpbmcgSUNFIGNhbmRpZGF0ZScpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IGZ1bmN0aW9uTmFtZSA9ICdwZWVySWNlQ2FuZGlkYXRlJztcbiAgICAgICAgICAgICAgICBjb25zdCBtZXNzYWdlID0gYENoYXRFbmdpbmUgV2ViUlRDIFske2Z1bmN0aW9uTmFtZX1dIGVycm9yLmA7XG4gICAgICAgICAgICAgICAgY2hhdEVuZ2luZUVycm9yKHRoaXMuQ2hhdEVuZ2luZSwgZnVuY3Rpb25OYW1lLCBtZXNzYWdlLCBlcnJvcik7XG4gICAgICAgICAgICB9KTtcbiAgICB9KTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSAoY29uZmlndXJhdGlvbiA9IHt9KSA9PiB7XG4gICAgY29uZmlnID0gY29uZmlndXJhdGlvbjtcbiAgICByZXR1cm4ge1xuICAgICAgICBuYW1lc3BhY2U6ICd3ZWJSVEMnLFxuICAgICAgICBleHRlbmRzOiB7XG4gICAgICAgICAgICBNZTogV2ViUnRjUGhvbmVcbiAgICAgICAgfVxuICAgIH1cbn07XG4iXX0=

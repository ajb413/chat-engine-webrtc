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
 *     These functions must be called using the JavaScript call or apply methods
 *     so ChatEngine can be referenced.
 * @author Adam Bavosa <adamb@pubnub.com>
 */

/**
 * A function that is called if the client did not pass a parent onIncomingCall
 *     event handler to the WebRTC plugin instance.
 *
 * @param {Function} callback Callback for onIncomingCall. Accepts boolean for
 *     accepting a call. The call is automatically rejected because a function
 *     for UI input (accept/reject) is not defined.
 *
 * @throws Throws an error using the ChatEngine.throwError function.
 *
 * @returns {void}
 */
function onIncomingCallNotDefined(callback) {
  var functionName = 'onIncomingCallNotDefined';
  var message = 'A handler for the [onIncomingCall] event is not defined.';
  this.ChatEngine.throwError(this, functionName, 'webRTC', new Error(message), {});
  callback(false);
}

/**
 * A function that is called if the client did not pass an onCallResponse event
 *     handler to the call object instance.
 *
 * @throws Throws an error using the ChatEngine.throwError function.
 *
 * @returns {void}
 */
function onCallResponseNotDefined() {
  var functionName = 'onCallResponseNotDefined';
  var message = 'A handler for the [onCallResponse] event is not defined.';
  this.ChatEngine.throwError(this, functionName, 'webRTC', new Error(message));
}

/**
 * A function that is called if the client did not pass an onPeerStream event
 *     handler to the call object instance.
 *
 * @throws Throws an error using the ChatEngine.throwError function.
 *
 * @returns {void}
 */
function onPeerStreamNotDefined() {
  var functionName = 'onPeerStreamNotDefined';
  var message = 'A handler for the [onPeerStream] event is not defined.';
  this.ChatEngine.throwError(this, functionName, 'webRTC', new Error(message));
}

/**
 * A function that is called if the client did not pass an onDisconnect event
 *     handler to the call object instance.
 *
 * @throws Throws an error using the ChatEngine.throwError function.
 *
 * @returns {void}
 */
function onDisconnectNotDefined() {
  var functionName = 'onDisconnectNotDefined';
  var message = 'A handler for the [onDisconnect] event is not defined.';
  this.ChatEngine.throwError(this, functionName, 'webRTC', new Error(message));
}

module.exports = {
  onIncomingCallNotDefined: onIncomingCallNotDefined,
  onCallResponseNotDefined: onCallResponseNotDefined,
  onPeerStreamNotDefined: onPeerStreamNotDefined,
  onDisconnectNotDefined: onDisconnectNotDefined
};

},{}],4:[function(require,module,exports){
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

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

function onIceCandidate(iceEvent, user, peerConnection, callId) {
    peerConnection.iceCache.push(iceEvent.candidate);
    if (peerConnection.acceptedCall) {
        sendIceCandidates(user, peerConnection, callId);
    }
}

function sendIceCandidates(user, peerConnection, callId) {
    user.direct.emit(peerIceCandidateEvent, {
        callId: callId,
        candidates: peerConnection.iceCache
    });
}

function peerIceCandidate(payload, peerConnection, ignoreNonTurn) {
    var _payload$data = payload.data,
        callId = _payload$data.callId,
        candidates = _payload$data.candidates;


    if ((typeof candidates === 'undefined' ? 'undefined' : _typeof(candidates)) !== 'object' || !peerConnection) {
        return;
    }

    candidates.forEach(function (candidate) {
        // Ignore all non-TURN ICE candidates if specified in config.
        if (ignoreNonTurn && candidate.candidate.indexOf('typ relay') === -1) {
            return;
        }

        peerConnection.addIceCandidate(candidate).catch(function (error) {
            var functionName = 'peerIceCandidate';
            var message = 'ChatEngine WebRTC [' + functionName + '] error.';
            console.error(message, error);
        });
    });
}

var eventNames = {
    peerIceCandidateEvent: peerIceCandidateEvent,
    incomingCallEvent: incomingCallEvent,
    callResponseEvent: callResponseEvent
};

module.exports = {
    uuid: uuid,
    onIceCandidate: onIceCandidate,
    sendIceCandidates: sendIceCandidates,
    peerIceCandidate: peerIceCandidate,
    eventNames: eventNames
};

},{}],5:[function(require,module,exports){
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * @file ChatEngine plugin for WebRTC video and audio calling.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * @author Adam Bavosa <adamb@pubnub.com>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */

var _util = require('./helpers/util.js');

var _errorHandlers = require('./helpers/error-handlers.js');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var incomingCallEvent = _util.eventNames.incomingCallEvent;
var callResponseEvent = _util.eventNames.callResponseEvent;
var peerIceCandidateEvent = _util.eventNames.peerIceCandidateEvent;
var config = void 0;

var WebRtcPhone = function () {
    function WebRtcPhone() {
        _classCallCheck(this, WebRtcPhone);
    }

    _createClass(WebRtcPhone, [{
        key: 'construct',
        value: function construct() {
            var _this = this;

            this.onIncomingCall = config.onIncomingCall || _errorHandlers.onIncomingCallNotDefined;
            this.onCallResponse = config.onCallResponse || _errorHandlers.onCallResponseNotDefined;
            this.onPeerStream = config.onPeerStream || _errorHandlers.onPeerStreamNotDefined;
            this.onDisconnect = config.onDisconnect || _errorHandlers.onDisconnectNotDefined;
            this.myStream = config.myStream;
            this.ignoreNonTurn = config.ignoreNonTurn;

            // ChatEngine Direct event handler for incoming call requests.
            this.ChatEngine.me.direct.on(incomingCallEvent, function (payload) {
                _this.incomingCall(payload);
            });

            // ChatEngine Direct event handler for call responses.
            this.ChatEngine.me.direct.on(callResponseEvent, function (payload) {
                _this.callResponse(payload);
            });

            // ChatEngine Direct event handler for new ICE candidates for RTCPeerConnection object.
            // WebRTC client tells the remote client their ICE candidates through this signal.
            this.ChatEngine.me.direct.on(peerIceCandidateEvent, function (payload) {
                (0, _util.peerIceCandidate)(payload, _this.peerConnection, _this.ignoreNonTurn);
            });
        }
    }, {
        key: 'callUser',
        value: function callUser(user, _ref) {
            var _this2 = this;

            var onPeerStream = _ref.onPeerStream,
                myStream = _ref.myStream,
                offerOptions = _ref.offerOptions,
                rtcConfig = _ref.rtcConfig;

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
                return peerConnection.addTrack(track, myStream);
            });
            peerConnection.iceCache = [];

            peerConnection.oniceconnectionstatechange = function () {
                if (peerConnection.iceConnectionState === 'disconnected') {
                    _this2.disconnect();
                }
            };

            // When ICE candidates become available, send them to the remote client.
            peerConnection.onicecandidate = function (iceEvent) {
                if (!iceEvent.candidate) {
                    return;
                }
                (0, _util.onIceCandidate)(iceEvent, user, peerConnection, callId);
            };

            peerConnection.onnegotiationneeded = function () {
                peerConnection.createOffer(offerOptions).then(function (description) {
                    localDescription = description;
                    return peerConnection.setLocalDescription(localDescription);
                }).then(function () {
                    user.direct.emit(['$' + 'webRTC', 'incomingCall'].join('.'), {
                        callId: callId,
                        description: localDescription
                    });
                }).catch(function (error) {
                    var functionName = 'callUser';
                    var message = 'WebRTC [' + functionName + '] error.';
                    _this2.ChatEngine.throwError(_this2, functionName, 'webRTC', new Error(message), { error: error });
                });
            };
        }
    }, {
        key: 'callResponse',
        value: function callResponse(payload) {
            var _this3 = this;

            var _payload$data = payload.data,
                callId = _payload$data.callId,
                acceptedCall = _payload$data.acceptedCall,
                description = _payload$data.description;

            var sender = payload.sender;

            if (acceptedCall) {
                this.peerConnection.acceptedCall = true;
                this.callInSession = true;

                // When a user accepts a call, they send their WebRTC peer connection description.
                // Set it locally as the remote client's peer connection description.
                this.peerConnection.setRemoteDescription(description).then(function () {
                    (0, _util.sendIceCandidates)(sender, _this3.peerConnection, callId);
                }).catch(function (error) {
                    var functionName = 'callResponse';
                    var message = 'WebRTC [' + functionName + '] error.';
                    _this3.ChatEngine.throwError(_this3, functionName, 'webRTC', new Error(message), { error: error });
                });
            }

            this.onCallResponse(acceptedCall);
        }
    }, {
        key: 'incomingCall',
        value: function incomingCall(payload) {
            var _this4 = this;

            var sender = payload.sender;
            var callId = payload.data.callId;

            var remoteDescription = payload.data.description;

            // Should be executed after this client accepts or rejects an incoming call.
            var callResponseCallback = function callResponseCallback(_ref2) {
                var acceptedCall = _ref2.acceptedCall,
                    onPeerStream = _ref2.onPeerStream,
                    myStream = _ref2.myStream,
                    rtcConfig = _ref2.rtcConfig;

                myStream = _this4.myStream = myStream || _this4.myStream;
                onPeerStream = onPeerStream || _this4.onPeerStream;

                if (acceptedCall) {
                    if ((typeof myStream === 'undefined' ? 'undefined' : _typeof(myStream)) !== 'object') {
                        var functionName = 'incomingCall';
                        var message = 'WebRTC [' + functionName + ']: No local video stream defined.';
                        _this4.ChatEngine.throwError(_this4, functionName, 'webRTC', new Error(message));
                    }

                    var answerDescription = void 0;
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

                    // When ICE candidates become available, send them to the remote client
                    peerConnection.onicecandidate = function (iceEvent) {
                        if (!iceEvent.candidate) {
                            return;
                        }

                        (0, _util.onIceCandidate)(iceEvent, sender, peerConnection, callId);
                    };

                    peerConnection.setRemoteDescription(remoteDescription).then(function () {
                        return peerConnection.createAnswer();
                    }).then(function (answer) {
                        answerDescription = answer;
                        return peerConnection.setLocalDescription(answerDescription);
                    }).then(function () {
                        peerConnection.acceptedCall = true;
                        _this4.callInSession = true;
                        (0, _util.sendIceCandidates)(sender, peerConnection, callId);
                        sender.direct.emit(['$' + 'webRTC', 'callResponse'].join('.'), {
                            callId: callId,
                            acceptedCall: acceptedCall,
                            description: answerDescription
                        });
                    }).catch(function (error) {
                        var functionName = 'incomingCall';
                        var message = 'WebRTC [' + functionName + '] error.';
                        _this4.ChatEngine.throwError(_this4, functionName, 'webRTC', new Error(message), { error: error });
                    });
                } else {
                    sender.direct.emit(['$' + 'webRTC', 'callResponse'].join('.'), {
                        callId: callId,
                        acceptedCall: acceptedCall
                    });
                }
            };

            this.onIncomingCall(sender, callResponseCallback);
        }
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

module.exports = function () {
    var cfg = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    config = cfg;
    return {
        namespace: 'webRTC',
        extends: {
            Me: WebRtcPhone
        }
    };
};

},{"./helpers/error-handlers.js":3,"./helpers/util.js":4}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy5udm0vdmVyc2lvbnMvbm9kZS92OC4xMS4yL2xpYi9ub2RlX21vZHVsZXMvY2hhdC1lbmdpbmUtcGx1Z2luL25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIudG1wL3dyYXAuanMiLCJwYWNrYWdlLmpzb24iLCJzcmMvaGVscGVycy9lcnJvci1oYW5kbGVycy5qcyIsInNyYy9oZWxwZXJzL3V0aWwuanMiLCJzcmMvcGx1Z2luLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNBQSxDQUFDLFlBQVc7O0FBRVIsUUFBTSxNQUFNLFFBQVEsaUJBQVIsQ0FBWjtBQUNBLFdBQU8sY0FBUCxDQUFzQixNQUF0QixDQUE2QixJQUFJLElBQWpDLElBQXlDLFFBQVEsa0JBQVIsQ0FBekM7QUFFSCxDQUxEOzs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUMxQkE7Ozs7Ozs7OztBQVNBOzs7Ozs7Ozs7Ozs7QUFZQSxTQUFTLHdCQUFULENBQWtDLFFBQWxDLEVBQTRDO0FBQ3hDLE1BQU0sZUFBZSwwQkFBckI7QUFDQSxNQUFNLFVBQVMsMERBQWY7QUFDQSxPQUFLLFVBQUwsQ0FBZ0IsVUFBaEIsQ0FBMkIsSUFBM0IsRUFBaUMsWUFBakMsRUFBK0MsUUFBL0MsRUFBeUQsSUFBSSxLQUFKLENBQVUsT0FBVixDQUF6RCxFQUE2RSxFQUE3RTtBQUNBLFdBQVMsS0FBVDtBQUNIOztBQUVEOzs7Ozs7OztBQVFBLFNBQVMsd0JBQVQsR0FBb0M7QUFDaEMsTUFBTSxlQUFlLDBCQUFyQjtBQUNBLE1BQU0sVUFBUywwREFBZjtBQUNBLE9BQUssVUFBTCxDQUFnQixVQUFoQixDQUEyQixJQUEzQixFQUFpQyxZQUFqQyxF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QUMsTUFBTSxRQUFQLEVBQWlCLGNBQWpCLEVBQWlDLElBQWpDLENBQXNDLEdBQXRDLENBQW5CLEVBQStEO0FBQzNELDBDQUQyRDtBQUUzRCxzREFGMkQ7QUFHM0QseUNBQWE7QUFIOEMseUJBQS9EO0FBS0gscUJBZkwsRUFlTyxLQWZQLENBZWEsVUFBQyxLQUFELEVBQVc7QUFDaEIsNEJBQU0sZUFBZSxjQUFyQjtBQUNBLDRCQUFNLHVCQUFxQixZQUFyQixhQUFOO0FBQ0EsK0JBQUssVUFBTCxDQUFnQixVQUFoQixDQUEyQixNQUEzQixFQUFpQyxZQUFqQyxFQUErQyxRQUEvQyxFQUF5RCxJQUFJLEtBQUosQ0FBVSxPQUFWLENBQXpELEVBQTZFLEVBQUUsWUFBRixFQUE3RTtBQUNILHFCQW5CTDtBQW9CSCxpQkFuREQsTUFtRE87QUFDSCwyQkFBTyxNQUFQLENBQWMsSUFBZCxDQUFtQixDQUFDLE1BQU0sUUFBUCxFQUFpQixjQUFqQixFQUFpQyxJQUFqQyxDQUFzQyxHQUF0QyxDQUFuQixFQUErRDtBQUMzRCxzQ0FEMkQ7QUFFM0Q7QUFGMkQscUJBQS9EO0FBSUg7QUFDSixhQTdERDs7QUErREEsaUJBQUssY0FBTCxDQUFvQixNQUFwQixFQUE0QixvQkFBNUI7QUFDSDs7O3FDQUVZO0FBQ1QsaUJBQUssY0FBTCxDQUFvQixLQUFwQjtBQUNBLG1CQUFPLEtBQUssY0FBWjtBQUNBLGlCQUFLLGFBQUwsR0FBcUIsS0FBckI7QUFDQSxpQkFBSyxZQUFMO0FBQ0g7Ozs7OztBQUdMLE9BQU8sT0FBUCxHQUFpQixZQUFjO0FBQUEsUUFBYixHQUFhLHVFQUFQLEVBQU87O0FBQzNCLGFBQVMsR0FBVDtBQUNBLFdBQU87QUFDSCxtQkFBVyxRQURSO0FBRUgsaUJBQVM7QUFDTCxnQkFBSTtBQURDO0FBRk4sS0FBUDtBQU1ILENBUkQiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCIoZnVuY3Rpb24oKSB7XG5cbiAgICBjb25zdCBwa2cgPSByZXF1aXJlKCcuLi9wYWNrYWdlLmpzb24nKTtcbiAgICB3aW5kb3cuQ2hhdEVuZ2luZUNvcmUucGx1Z2luW3BrZy5uYW1lXSA9IHJlcXVpcmUoJy4uL3NyYy9wbHVnaW4uanMnKTtcblxufSkoKTtcbiIsIm1vZHVsZS5leHBvcnRzPXtcbiAgXCJhdXRob3JcIjogXCJBZGFtIEJhdm9zYVwiLFxuICBcIm5hbWVcIjogXCJjaGF0LWVuZ2luZS13ZWJydGNcIixcbiAgXCJ2ZXJzaW9uXCI6IFwiMC4wLjFcIixcbiAgXCJtYWluXCI6IFwic3JjL3BsdWdpbi5qc1wiLFxuICBcImRlcGVuZGVuY2llc1wiOiB7XG4gICAgXCJjaGF0LWVuZ2luZVwiOiBcIl4wLjkuMThcIlxuICB9LFxuICBcImJyb3dzZXJpZnlcIjoge1xuICAgIFwidHJhbnNmb3JtXCI6IFtcbiAgICAgIFtcbiAgICAgICAgXCJiYWJlbGlmeVwiLFxuICAgICAgICB7XG4gICAgICAgICAgXCJwcmVzZXRzXCI6IFtcbiAgICAgICAgICAgIFwiZXMyMDE1XCJcbiAgICAgICAgICBdXG4gICAgICAgIH1cbiAgICAgIF1cbiAgICBdXG4gIH0sXG4gIFwiZGV2RGVwZW5kZW5jaWVzXCI6IHtcbiAgICBcImJhYmVsLWNvcmVcIjogXCJeNi4yNi4zXCIsXG4gICAgXCJiYWJlbC1wcmVzZXQtZXMyMDE1XCI6IFwiXjYuMjQuMVwiLFxuICAgIFwiYmFiZWxpZnlcIjogXCJeOC4wLjBcIlxuICB9XG59XG4iLCIvKipcbiAqIEBmaWxlIEZhbGxiYWNrIGV2ZW50IGhhbmRsZXJzIHNldCBpbiB0aGUgV2ViUlRDQ2FsbCBjb25zdHJ1Y3Rvci4gSWYgdGhlXG4gKiAgICAgY2xpZW50IGRvZXMgbm90IHByb3ZpZGUgYW55IG9mIHRoZSBub3RlZCBldmVudCBoYW5kbGVycywgdGhlc2UgZnVuY3Rpb25zXG4gKiAgICAgd2lsbCBleGVjdXRlIGFuZCB0aHJvdyBhIENoYXRFbmdpbmUgZXJyb3Igd2l0aCBDaGF0RW5naW5lLnRocm93RXJyb3IuXG4gKiAgICAgVGhlc2UgZnVuY3Rpb25zIG11c3QgYmUgY2FsbGVkIHVzaW5nIHRoZSBKYXZhU2NyaXB0IGNhbGwgb3IgYXBwbHkgbWV0aG9kc1xuICogICAgIHNvIENoYXRFbmdpbmUgY2FuIGJlIHJlZmVyZW5jZWQuXG4gKiBAYXV0aG9yIEFkYW0gQmF2b3NhIDxhZGFtYkBwdWJudWIuY29tPlxuICovXG5cbi8qKlxuICogQSBmdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCBpZiB0aGUgY2xpZW50IGRpZCBub3QgcGFzcyBhIHBhcmVudCBvbkluY29taW5nQ2FsbFxuICogICAgIGV2ZW50IGhhbmRsZXIgdG8gdGhlIFdlYlJUQyBwbHVnaW4gaW5zdGFuY2UuXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgQ2FsbGJhY2sgZm9yIG9uSW5jb21pbmdDYWxsLiBBY2NlcHRzIGJvb2xlYW4gZm9yXG4gKiAgICAgYWNjZXB0aW5nIGEgY2FsbC4gVGhlIGNhbGwgaXMgYXV0b21hdGljYWxseSByZWplY3RlZCBiZWNhdXNlIGEgZnVuY3Rpb25cbiAqICAgICBmb3IgVUkgaW5wdXQgKGFjY2VwdC9yZWplY3QpIGlzIG5vdCBkZWZpbmVkLlxuICpcbiAqIEB0aHJvd3MgVGhyb3dzIGFuIGVycm9yIHVzaW5nIHRoZSBDaGF0RW5naW5lLnRocm93RXJyb3IgZnVuY3Rpb24uXG4gKlxuICogQHJldHVybnMge3ZvaWR9XG4gKi9cbmZ1bmN0aW9uIG9uSW5jb21pbmdDYWxsTm90RGVmaW5lZChjYWxsYmFjaykge1xuICAgIGNvbnN0IGZ1bmN0aW9uTmFtZSA9ICdvbkluY29taW5nQ2FsbE5vdERlZmluZWQnO1xuICAgIGNvbnN0IG1lc3NhZ2UgPSdBIGhhbmRsZXIgZm9yIHRoZSBbb25JbmNvbWluZ0NhbGxdIGV2ZW50IGlzIG5vdCBkZWZpbmVkLic7XG4gICAgdGhpcy5DaGF0RW5naW5lLnRocm93RXJyb3IodGhpcywgZnVuY3Rpb25OYW1lLCAnd2ViUlRDJywgbmV3IEVycm9yKG1lc3NhZ2UpLCB7fSk7XG4gICAgY2FsbGJhY2soZmFsc2UpO1xufVxuXG4vKipcbiAqIEEgZnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgaWYgdGhlIGNsaWVudCBkaWQgbm90IHBhc3MgYW4gb25DYWxsUmVzcG9uc2UgZXZlbnRcbiAqICAgICBoYW5kbGVyIHRvIHRoZSBjYWxsIG9iamVjdCBpbnN0YW5jZS5cbiAqXG4gKiBAdGhyb3dzIFRocm93cyBhbiBlcnJvciB1c2luZyB0aGUgQ2hhdEVuZ2luZS50aHJvd0Vycm9yIGZ1bmN0aW9uLlxuICpcbiAqIEByZXR1cm5zIHt2b2lkfVxuICovXG5mdW5jdGlvbiBvbkNhbGxSZXNwb25zZU5vdERlZmluZWQoKSB7XG4gICAgY29uc3QgZnVuY3Rpb25OYW1lID0gJ29uQ2FsbFJlc3BvbnNlTm90RGVmaW5lZCc7XG4gICAgY29uc3QgbWVzc2FnZSA9J0EgaGFuZGxlciBmb3IgdGhlIFtvbkNhbGxSZXNwb25zZV0gZXZlbnQgaXMgbm90IGRlZmluZWQuJztcbiAgICB0aGlzLkNoYXRFbmdpbmUudGhyb3dFcnJvcih0aGlzLCBmdW5jdGlvbk5hbWUsICd3ZWJSVEMnLCBuZXcgRXJyb3IobWVzc2FnZSkpO1xufVxuXG4vKipcbiAqIEEgZnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgaWYgdGhlIGNsaWVudCBkaWQgbm90IHBhc3MgYW4gb25QZWVyU3RyZWFtIGV2ZW50XG4gKiAgICAgaGFuZGxlciB0byB0aGUgY2FsbCBvYmplY3QgaW5zdGFuY2UuXG4gKlxuICogQHRocm93cyBUaHJvd3MgYW4gZXJyb3IgdXNpbmcgdGhlIENoYXRFbmdpbmUudGhyb3dFcnJvciBmdW5jdGlvbi5cbiAqXG4gKiBAcmV0dXJucyB7dm9pZH1cbiAqL1xuZnVuY3Rpb24gb25QZWVyU3RyZWFtTm90RGVmaW5lZCgpIHtcbiAgICBjb25zdCBmdW5jdGlvbk5hbWUgPSAnb25QZWVyU3RyZWFtTm90RGVmaW5lZCc7XG4gICAgY29uc3QgbWVzc2FnZSA9ICdBIGhhbmRsZXIgZm9yIHRoZSBbb25QZWVyU3RyZWFtXSBldmVudCBpcyBub3QgZGVmaW5lZC4nO1xuICAgIHRoaXMuQ2hhdEVuZ2luZS50aHJvd0Vycm9yKHRoaXMsIGZ1bmN0aW9uTmFtZSwgJ3dlYlJUQycsIG5ldyBFcnJvcihtZXNzYWdlKSk7XG59XG5cbi8qKlxuICogQSBmdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCBpZiB0aGUgY2xpZW50IGRpZCBub3QgcGFzcyBhbiBvbkRpc2Nvbm5lY3QgZXZlbnRcbiAqICAgICBoYW5kbGVyIHRvIHRoZSBjYWxsIG9iamVjdCBpbnN0YW5jZS5cbiAqXG4gKiBAdGhyb3dzIFRocm93cyBhbiBlcnJvciB1c2luZyB0aGUgQ2hhdEVuZ2luZS50aHJvd0Vycm9yIGZ1bmN0aW9uLlxuICpcbiAqIEByZXR1cm5zIHt2b2lkfVxuICovXG5mdW5jdGlvbiBvbkRpc2Nvbm5lY3ROb3REZWZpbmVkKCkge1xuICAgIGNvbnN0IGZ1bmN0aW9uTmFtZSA9ICdvbkRpc2Nvbm5lY3ROb3REZWZpbmVkJztcbiAgICBjb25zdCBtZXNzYWdlID0gJ0EgaGFuZGxlciBmb3IgdGhlIFtvbkRpc2Nvbm5lY3RdIGV2ZW50IGlzIG5vdCBkZWZpbmVkLic7XG4gICAgdGhpcy5DaGF0RW5naW5lLnRocm93RXJyb3IodGhpcywgZnVuY3Rpb25OYW1lLCAnd2ViUlRDJywgbmV3IEVycm9yKG1lc3NhZ2UpKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgb25JbmNvbWluZ0NhbGxOb3REZWZpbmVkLFxuICAgIG9uQ2FsbFJlc3BvbnNlTm90RGVmaW5lZCxcbiAgICBvblBlZXJTdHJlYW1Ob3REZWZpbmVkLFxuICAgIG9uRGlzY29ubmVjdE5vdERlZmluZWRcbn07IiwiLyoqXG4gKiBAZmlsZSBVdGlsaXR5IGZ1bmN0aW9ucyBmb3IgcGx1Z2luLmpzLlxuICogQGF1dGhvciBBZGFtIEJhdm9zYSA8YWRhbWJAcHVibnViLmNvbT5cbiAqL1xuXG5jb25zdCBwZWVySWNlQ2FuZGlkYXRlRXZlbnQgPSBbJyQnICsgJ3dlYlJUQycsICdwZWVySWNlQ2FuZGlkYXRlJ10uam9pbignLicpO1xuY29uc3QgaW5jb21pbmdDYWxsRXZlbnQgPSBbJyQnICsgJ3dlYlJUQycsICdpbmNvbWluZ0NhbGwnXS5qb2luKCcuJyk7XG5jb25zdCBjYWxsUmVzcG9uc2VFdmVudCA9IFsnJCcgKyAnd2ViUlRDJywgJ2NhbGxSZXNwb25zZSddLmpvaW4oJy4nKTtcblxuLyoqXG4gKiBNYWtlcyBhIG5ldywgdmVyc2lvbiA0LCB1bml2ZXJzYWxseSB1bmlxdWUgaWRlbnRpZmllciAoVVVJRCkuIFdyaXR0ZW4gYnlcbiAqICAgICBTdGFjayBPdmVyZmxvdyB1c2VyIGJyb29mYVxuICogICAgIChodHRwczovL3N0YWNrb3ZlcmZsb3cuY29tL3VzZXJzLzEwOTUzOC9icm9vZmEpIGluIHRoaXMgcG9zdFxuICogICAgIChodHRwczovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMjExNzUyMy82MTkzNzM2KS5cbiAqXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBBIHZlcnNpb24gNCBjb21wbGlhbnQgVVVJRC5cbiAqL1xuZnVuY3Rpb24gdXVpZCgpIHtcbiAgICByZXR1cm4gKFsxZTddKy0xZTMrLTRlMystOGUzKy0xZTExKS5yZXBsYWNlKFxuICAgICAgICAvWzAxOF0vZyxcbiAgICAgICAgKGMpID0+IChjIF4gY3J5cHRvLmdldFJhbmRvbVZhbHVlcyhuZXcgVWludDhBcnJheSgxKSlbMF0gJiAxNSA+PiBjIC8gNClcbiAgICAgICAgICAgIC50b1N0cmluZygxNilcbiAgICApO1xufVxuXG5mdW5jdGlvbiBvbkljZUNhbmRpZGF0ZShpY2VFdmVudCwgdXNlciwgcGVlckNvbm5lY3Rpb24sIGNhbGxJZCkge1xuICAgIHBlZXJDb25uZWN0aW9uLmljZUNhY2hlLnB1c2goaWNlRXZlbnQuY2FuZGlkYXRlKTtcbiAgICBpZiAocGVlckNvbm5lY3Rpb24uYWNjZXB0ZWRDYWxsKSB7XG4gICAgICAgIHNlbmRJY2VDYW5kaWRhdGVzKHVzZXIsIHBlZXJDb25uZWN0aW9uLCBjYWxsSWQpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gc2VuZEljZUNhbmRpZGF0ZXModXNlciwgcGVlckNvbm5lY3Rpb24sIGNhbGxJZCkge1xuICAgIHVzZXIuZGlyZWN0LmVtaXQocGVlckljZUNhbmRpZGF0ZUV2ZW50LCB7XG4gICAgICAgIGNhbGxJZCxcbiAgICAgICAgY2FuZGlkYXRlczogcGVlckNvbm5lY3Rpb24uaWNlQ2FjaGVcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gcGVlckljZUNhbmRpZGF0ZShwYXlsb2FkLCBwZWVyQ29ubmVjdGlvbiwgaWdub3JlTm9uVHVybikge1xuICAgIGNvbnN0IHsgY2FsbElkLCBjYW5kaWRhdGVzIH0gPSBwYXlsb2FkLmRhdGE7XG5cbiAgICBpZiAodHlwZW9mIGNhbmRpZGF0ZXMgIT09ICdvYmplY3QnIHx8ICFwZWVyQ29ubmVjdGlvbikge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY2FuZGlkYXRlcy5mb3JFYWNoKChjYW5kaWRhdGUpID0+IHtcbiAgICAgICAgLy8gSWdub3JlIGFsbCBub24tVFVSTiBJQ0UgY2FuZGlkYXRlcyBpZiBzcGVjaWZpZWQgaW4gY29uZmlnLlxuICAgICAgICBpZiAoaWdub3JlTm9uVHVybiAmJiBjYW5kaWRhdGUuY2FuZGlkYXRlLmluZGV4T2YoJ3R5cCByZWxheScpID09PSAtMSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgcGVlckNvbm5lY3Rpb24uYWRkSWNlQ2FuZGlkYXRlKGNhbmRpZGF0ZSlcbiAgICAgICAgICAgIC5jYXRjaCgoZXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBmdW5jdGlvbk5hbWUgPSAncGVlckljZUNhbmRpZGF0ZSc7XG4gICAgICAgICAgICAgICAgY29uc3QgbWVzc2FnZSA9IGBDaGF0RW5naW5lIFdlYlJUQyBbJHtmdW5jdGlvbk5hbWV9XSBlcnJvci5gO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IobWVzc2FnZSwgZXJyb3IpO1xuICAgICAgICAgICAgfSk7XG4gICAgfSk7XG59XG5cbmNvbnN0IGV2ZW50TmFtZXMgPSB7XG4gICAgcGVlckljZUNhbmRpZGF0ZUV2ZW50LFxuICAgIGluY29taW5nQ2FsbEV2ZW50LFxuICAgIGNhbGxSZXNwb25zZUV2ZW50XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIHV1aWQsXG4gICAgb25JY2VDYW5kaWRhdGUsXG4gICAgc2VuZEljZUNhbmRpZGF0ZXMsXG4gICAgcGVlckljZUNhbmRpZGF0ZSxcbiAgICBldmVudE5hbWVzXG59OyIsIi8qKlxuICogQGZpbGUgQ2hhdEVuZ2luZSBwbHVnaW4gZm9yIFdlYlJUQyB2aWRlbyBhbmQgYXVkaW8gY2FsbGluZy5cbiAqIEBhdXRob3IgQWRhbSBCYXZvc2EgPGFkYW1iQHB1Ym51Yi5jb20+XG4gKi9cblxuaW1wb3J0IHtcbiAgICB1dWlkLFxuICAgIG9uSWNlQ2FuZGlkYXRlLFxuICAgIHNlbmRJY2VDYW5kaWRhdGVzLFxuICAgIHBlZXJJY2VDYW5kaWRhdGUsXG4gICAgZXZlbnROYW1lc1xufSBmcm9tICcuL2hlbHBlcnMvdXRpbC5qcyc7XG5cbmltcG9ydCB7XG4gICAgb25JbmNvbWluZ0NhbGxOb3REZWZpbmVkLFxuICAgIG9uQ2FsbFJlc3BvbnNlTm90RGVmaW5lZCxcbiAgICBvblBlZXJTdHJlYW1Ob3REZWZpbmVkLFxuICAgIG9uRGlzY29ubmVjdE5vdERlZmluZWRcbn0gZnJvbSAnLi9oZWxwZXJzL2Vycm9yLWhhbmRsZXJzLmpzJztcblxuY29uc3QgaW5jb21pbmdDYWxsRXZlbnQgPSBldmVudE5hbWVzLmluY29taW5nQ2FsbEV2ZW50O1xuY29uc3QgY2FsbFJlc3BvbnNlRXZlbnQgPSBldmVudE5hbWVzLmNhbGxSZXNwb25zZUV2ZW50O1xuY29uc3QgcGVlckljZUNhbmRpZGF0ZUV2ZW50ID0gZXZlbnROYW1lcy5wZWVySWNlQ2FuZGlkYXRlRXZlbnQ7XG5sZXQgY29uZmlnO1xuXG5jbGFzcyBXZWJSdGNQaG9uZSB7XG4gICAgY29uc3RydWN0KCkge1xuICAgICAgICB0aGlzLm9uSW5jb21pbmdDYWxsID0gY29uZmlnLm9uSW5jb21pbmdDYWxsIHx8IG9uSW5jb21pbmdDYWxsTm90RGVmaW5lZDtcbiAgICAgICAgdGhpcy5vbkNhbGxSZXNwb25zZSA9IGNvbmZpZy5vbkNhbGxSZXNwb25zZSB8fCBvbkNhbGxSZXNwb25zZU5vdERlZmluZWQ7XG4gICAgICAgIHRoaXMub25QZWVyU3RyZWFtID0gY29uZmlnLm9uUGVlclN0cmVhbSB8fCBvblBlZXJTdHJlYW1Ob3REZWZpbmVkO1xuICAgICAgICB0aGlzLm9uRGlzY29ubmVjdCA9IGNvbmZpZy5vbkRpc2Nvbm5lY3QgfHwgb25EaXNjb25uZWN0Tm90RGVmaW5lZDtcbiAgICAgICAgdGhpcy5teVN0cmVhbSA9IGNvbmZpZy5teVN0cmVhbTtcbiAgICAgICAgdGhpcy5pZ25vcmVOb25UdXJuID0gY29uZmlnLmlnbm9yZU5vblR1cm47XG5cbiAgICAgICAgLy8gQ2hhdEVuZ2luZSBEaXJlY3QgZXZlbnQgaGFuZGxlciBmb3IgaW5jb21pbmcgY2FsbCByZXF1ZXN0cy5cbiAgICAgICAgdGhpcy5DaGF0RW5naW5lLm1lLmRpcmVjdC5vbihpbmNvbWluZ0NhbGxFdmVudCwgKHBheWxvYWQpID0+IHtcbiAgICAgICAgICAgIHRoaXMuaW5jb21pbmdDYWxsKHBheWxvYWQpO1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyBDaGF0RW5naW5lIERpcmVjdCBldmVudCBoYW5kbGVyIGZvciBjYWxsIHJlc3BvbnNlcy5cbiAgICAgICAgdGhpcy5DaGF0RW5naW5lLm1lLmRpcmVjdC5vbihjYWxsUmVzcG9uc2VFdmVudCwgKHBheWxvYWQpID0+IHtcbiAgICAgICAgICAgIHRoaXMuY2FsbFJlc3BvbnNlKHBheWxvYWQpO1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyBDaGF0RW5naW5lIERpcmVjdCBldmVudCBoYW5kbGVyIGZvciBuZXcgSUNFIGNhbmRpZGF0ZXMgZm9yIFJUQ1BlZXJDb25uZWN0aW9uIG9iamVjdC5cbiAgICAgICAgLy8gV2ViUlRDIGNsaWVudCB0ZWxscyB0aGUgcmVtb3RlIGNsaWVudCB0aGVpciBJQ0UgY2FuZGlkYXRlcyB0aHJvdWdoIHRoaXMgc2lnbmFsLlxuICAgICAgICB0aGlzLkNoYXRFbmdpbmUubWUuZGlyZWN0Lm9uKHBlZXJJY2VDYW5kaWRhdGVFdmVudCwgKHBheWxvYWQpID0+IHtcbiAgICAgICAgICAgIHBlZXJJY2VDYW5kaWRhdGUocGF5bG9hZCwgdGhpcy5wZWVyQ29ubmVjdGlvbiwgdGhpcy5pZ25vcmVOb25UdXJuKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgY2FsbFVzZXIodXNlciwge29uUGVlclN0cmVhbSwgbXlTdHJlYW0sIG9mZmVyT3B0aW9ucywgcnRjQ29uZmlnfSkge1xuICAgICAgICBteVN0cmVhbSA9IHRoaXMubXlTdHJlYW0gPSBteVN0cmVhbSB8fCB0aGlzLm15U3RyZWFtO1xuICAgICAgICBvblBlZXJTdHJlYW0gPSB0aGlzLm9uUGVlclN0cmVhbSA9IG9uUGVlclN0cmVhbSB8fCB0aGlzLm9uUGVlclN0cmVhbTtcbiAgICAgICAgb2ZmZXJPcHRpb25zID0gb2ZmZXJPcHRpb25zIHx8IHtcbiAgICAgICAgICAgIG9mZmVyVG9SZWNlaXZlQXVkaW86IDEsXG4gICAgICAgICAgICBvZmZlclRvUmVjZWl2ZVZpZGVvOiAxXG4gICAgICAgIH07XG4gICAgICAgIGNvbnN0IHBlZXJDb25uZWN0aW9uID0gdGhpcy5wZWVyQ29ubmVjdGlvblxuICAgICAgICAgICAgPSBuZXcgUlRDUGVlckNvbm5lY3Rpb24ocnRjQ29uZmlnKTtcbiAgICAgICAgY29uc3QgY2FsbElkID0gdGhpcy5jYWxsSWQgPSB1dWlkKCk7IC8vIENhbGwgSURcbiAgICAgICAgbGV0IGxvY2FsRGVzY3JpcHRpb247IC8vIFdlYlJUQyBsb2NhbCBkZXNjcmlwdGlvblxuICAgICAgICBwZWVyQ29ubmVjdGlvbi5vbnRyYWNrID0gb25QZWVyU3RyZWFtO1xuICAgICAgICBteVN0cmVhbS5nZXRUcmFja3MoKS5mb3JFYWNoKCh0cmFjaykgPT4gcGVlckNvbm5lY3Rpb24uYWRkVHJhY2sodHJhY2ssIG15U3RyZWFtKSk7XG4gICAgICAgIHBlZXJDb25uZWN0aW9uLmljZUNhY2hlID0gW107XG5cbiAgICAgICAgcGVlckNvbm5lY3Rpb24ub25pY2Vjb25uZWN0aW9uc3RhdGVjaGFuZ2UgPSAoKSA9PiB7XG4gICAgICAgICAgICBpZiAocGVlckNvbm5lY3Rpb24uaWNlQ29ubmVjdGlvblN0YXRlID09PSAnZGlzY29ubmVjdGVkJykge1xuICAgICAgICAgICAgICAgIHRoaXMuZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIFdoZW4gSUNFIGNhbmRpZGF0ZXMgYmVjb21lIGF2YWlsYWJsZSwgc2VuZCB0aGVtIHRvIHRoZSByZW1vdGUgY2xpZW50LlxuICAgICAgICBwZWVyQ29ubmVjdGlvbi5vbmljZWNhbmRpZGF0ZSA9IChpY2VFdmVudCkgPT4ge1xuICAgICAgICAgICAgaWYgKCFpY2VFdmVudC5jYW5kaWRhdGUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBvbkljZUNhbmRpZGF0ZShpY2VFdmVudCwgdXNlciwgcGVlckNvbm5lY3Rpb24sIGNhbGxJZCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgcGVlckNvbm5lY3Rpb24ub25uZWdvdGlhdGlvbm5lZWRlZCA9ICgpID0+IHtcbiAgICAgICAgICAgIHBlZXJDb25uZWN0aW9uLmNyZWF0ZU9mZmVyKG9mZmVyT3B0aW9ucylcbiAgICAgICAgICAgIC50aGVuKChkZXNjcmlwdGlvbikgPT4ge1xuICAgICAgICAgICAgICAgIGxvY2FsRGVzY3JpcHRpb24gPSBkZXNjcmlwdGlvbjtcbiAgICAgICAgICAgICAgICByZXR1cm4gcGVlckNvbm5lY3Rpb24uc2V0TG9jYWxEZXNjcmlwdGlvbihsb2NhbERlc2NyaXB0aW9uKTtcbiAgICAgICAgICAgIH0pLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgIHVzZXIuZGlyZWN0LmVtaXQoWyckJyArICd3ZWJSVEMnLCAnaW5jb21pbmdDYWxsJ10uam9pbignLicpLCB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxJZCxcbiAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGxvY2FsRGVzY3JpcHRpb25cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pLmNhdGNoKChlcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZ1bmN0aW9uTmFtZSA9ICdjYWxsVXNlcic7XG4gICAgICAgICAgICAgICAgY29uc3QgbWVzc2FnZSA9IGBXZWJSVEMgWyR7ZnVuY3Rpb25OYW1lfV0gZXJyb3IuYDtcbiAgICAgICAgICAgICAgICB0aGlzLkNoYXRFbmdpbmUudGhyb3dFcnJvcih0aGlzLCBmdW5jdGlvbk5hbWUsICd3ZWJSVEMnLCBuZXcgRXJyb3IobWVzc2FnZSksIHsgZXJyb3IgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBjYWxsUmVzcG9uc2UocGF5bG9hZCkge1xuICAgICAgICBjb25zdCB7IGNhbGxJZCwgYWNjZXB0ZWRDYWxsLCBkZXNjcmlwdGlvbiB9ID0gcGF5bG9hZC5kYXRhO1xuICAgICAgICBsZXQgc2VuZGVyID0gcGF5bG9hZC5zZW5kZXI7XG5cbiAgICAgICAgaWYgKGFjY2VwdGVkQ2FsbCkge1xuICAgICAgICAgICAgdGhpcy5wZWVyQ29ubmVjdGlvbi5hY2NlcHRlZENhbGwgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5jYWxsSW5TZXNzaW9uID0gdHJ1ZTtcblxuICAgICAgICAgICAgLy8gV2hlbiBhIHVzZXIgYWNjZXB0cyBhIGNhbGwsIHRoZXkgc2VuZCB0aGVpciBXZWJSVEMgcGVlciBjb25uZWN0aW9uIGRlc2NyaXB0aW9uLlxuICAgICAgICAgICAgLy8gU2V0IGl0IGxvY2FsbHkgYXMgdGhlIHJlbW90ZSBjbGllbnQncyBwZWVyIGNvbm5lY3Rpb24gZGVzY3JpcHRpb24uXG4gICAgICAgICAgICB0aGlzLnBlZXJDb25uZWN0aW9uLnNldFJlbW90ZURlc2NyaXB0aW9uKGRlc2NyaXB0aW9uKVxuICAgICAgICAgICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgc2VuZEljZUNhbmRpZGF0ZXMoc2VuZGVyLCB0aGlzLnBlZXJDb25uZWN0aW9uLCBjYWxsSWQpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLmNhdGNoKChlcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmdW5jdGlvbk5hbWUgPSAnY2FsbFJlc3BvbnNlJztcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbWVzc2FnZSA9IGBXZWJSVEMgWyR7ZnVuY3Rpb25OYW1lfV0gZXJyb3IuYDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5DaGF0RW5naW5lLnRocm93RXJyb3IodGhpcywgZnVuY3Rpb25OYW1lLCAnd2ViUlRDJywgbmV3IEVycm9yKG1lc3NhZ2UpLCB7IGVycm9yIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5vbkNhbGxSZXNwb25zZShhY2NlcHRlZENhbGwpO1xuICAgIH1cblxuICAgIGluY29taW5nQ2FsbChwYXlsb2FkKSB7XG4gICAgICAgIGNvbnN0IHNlbmRlciA9IHBheWxvYWQuc2VuZGVyO1xuICAgICAgICBjb25zdCB7IGNhbGxJZCB9ID0gcGF5bG9hZC5kYXRhO1xuICAgICAgICBjb25zdCByZW1vdGVEZXNjcmlwdGlvbiA9IHBheWxvYWQuZGF0YS5kZXNjcmlwdGlvbjtcblxuICAgICAgICAvLyBTaG91bGQgYmUgZXhlY3V0ZWQgYWZ0ZXIgdGhpcyBjbGllbnQgYWNjZXB0cyBvciByZWplY3RzIGFuIGluY29taW5nIGNhbGwuXG4gICAgICAgIGNvbnN0IGNhbGxSZXNwb25zZUNhbGxiYWNrID0gKHthY2NlcHRlZENhbGwsIG9uUGVlclN0cmVhbSwgbXlTdHJlYW0sIHJ0Y0NvbmZpZ30pID0+IHtcbiAgICAgICAgICAgIG15U3RyZWFtID0gdGhpcy5teVN0cmVhbSA9IG15U3RyZWFtIHx8IHRoaXMubXlTdHJlYW07XG4gICAgICAgICAgICBvblBlZXJTdHJlYW0gPSBvblBlZXJTdHJlYW0gfHwgdGhpcy5vblBlZXJTdHJlYW07XG5cbiAgICAgICAgICAgIGlmIChhY2NlcHRlZENhbGwpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIG15U3RyZWFtICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmdW5jdGlvbk5hbWUgPSAnaW5jb21pbmdDYWxsJztcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbWVzc2FnZSA9IGBXZWJSVEMgWyR7ZnVuY3Rpb25OYW1lfV06IE5vIGxvY2FsIHZpZGVvIHN0cmVhbSBkZWZpbmVkLmA7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuQ2hhdEVuZ2luZS50aHJvd0Vycm9yKHRoaXMsIGZ1bmN0aW9uTmFtZSwgJ3dlYlJUQycsIG5ldyBFcnJvcihtZXNzYWdlKSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgbGV0IGFuc3dlckRlc2NyaXB0aW9uO1xuICAgICAgICAgICAgICAgIGNvbnN0IHBlZXJDb25uZWN0aW9uID0gdGhpcy5wZWVyQ29ubmVjdGlvblxuICAgICAgICAgICAgICAgICAgICA9IG5ldyBSVENQZWVyQ29ubmVjdGlvbihydGNDb25maWcpO1xuICAgICAgICAgICAgICAgIHBlZXJDb25uZWN0aW9uLm9udHJhY2sgPSBvblBlZXJTdHJlYW07XG4gICAgICAgICAgICAgICAgcGVlckNvbm5lY3Rpb24uaWNlQ2FjaGUgPSBbXTtcbiAgICAgICAgICAgICAgICBteVN0cmVhbS5nZXRUcmFja3MoKS5mb3JFYWNoKCh0cmFjaykgPT4ge1xuICAgICAgICAgICAgICAgICAgICBwZWVyQ29ubmVjdGlvbi5hZGRUcmFjayh0cmFjaywgbXlTdHJlYW0pO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgcGVlckNvbm5lY3Rpb24ub25pY2Vjb25uZWN0aW9uc3RhdGVjaGFuZ2UgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwZWVyQ29ubmVjdGlvbi5pY2VDb25uZWN0aW9uU3RhdGUgPT09ICdkaXNjb25uZWN0ZWQnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICAvLyBXaGVuIElDRSBjYW5kaWRhdGVzIGJlY29tZSBhdmFpbGFibGUsIHNlbmQgdGhlbSB0byB0aGUgcmVtb3RlIGNsaWVudFxuICAgICAgICAgICAgICAgIHBlZXJDb25uZWN0aW9uLm9uaWNlY2FuZGlkYXRlID0gKGljZUV2ZW50KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghaWNlRXZlbnQuY2FuZGlkYXRlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBvbkljZUNhbmRpZGF0ZShpY2VFdmVudCwgc2VuZGVyLCBwZWVyQ29ubmVjdGlvbiwgY2FsbElkKTtcbiAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgcGVlckNvbm5lY3Rpb24uc2V0UmVtb3RlRGVzY3JpcHRpb24ocmVtb3RlRGVzY3JpcHRpb24pXG4gICAgICAgICAgICAgICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwZWVyQ29ubmVjdGlvbi5jcmVhdGVBbnN3ZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgfSkudGhlbigoYW5zd2VyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhbnN3ZXJEZXNjcmlwdGlvbiA9IGFuc3dlcjtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwZWVyQ29ubmVjdGlvbi5zZXRMb2NhbERlc2NyaXB0aW9uKGFuc3dlckRlc2NyaXB0aW9uKTtcbiAgICAgICAgICAgICAgICAgICAgfSkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwZWVyQ29ubmVjdGlvbi5hY2NlcHRlZENhbGwgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jYWxsSW5TZXNzaW9uID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbmRJY2VDYW5kaWRhdGVzKHNlbmRlciwgcGVlckNvbm5lY3Rpb24sIGNhbGxJZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZW5kZXIuZGlyZWN0LmVtaXQoWyckJyArICd3ZWJSVEMnLCAnY2FsbFJlc3BvbnNlJ10uam9pbignLicpLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbElkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFjY2VwdGVkQ2FsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogYW5zd2VyRGVzY3JpcHRpb25cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9KS5jYXRjaCgoZXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGZ1bmN0aW9uTmFtZSA9ICdpbmNvbWluZ0NhbGwnO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbWVzc2FnZSA9IGBXZWJSVEMgWyR7ZnVuY3Rpb25OYW1lfV0gZXJyb3IuYDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuQ2hhdEVuZ2luZS50aHJvd0Vycm9yKHRoaXMsIGZ1bmN0aW9uTmFtZSwgJ3dlYlJUQycsIG5ldyBFcnJvcihtZXNzYWdlKSwgeyBlcnJvciB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHNlbmRlci5kaXJlY3QuZW1pdChbJyQnICsgJ3dlYlJUQycsICdjYWxsUmVzcG9uc2UnXS5qb2luKCcuJyksIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbElkLFxuICAgICAgICAgICAgICAgICAgICBhY2NlcHRlZENhbGxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMub25JbmNvbWluZ0NhbGwoc2VuZGVyLCBjYWxsUmVzcG9uc2VDYWxsYmFjayk7XG4gICAgfVxuXG4gICAgZGlzY29ubmVjdCgpIHtcbiAgICAgICAgdGhpcy5wZWVyQ29ubmVjdGlvbi5jbG9zZSgpO1xuICAgICAgICBkZWxldGUgdGhpcy5wZWVyQ29ubmVjdGlvbjtcbiAgICAgICAgdGhpcy5jYWxsSW5TZXNzaW9uID0gZmFsc2U7XG4gICAgICAgIHRoaXMub25EaXNjb25uZWN0KCk7XG4gICAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IChjZmcgPSB7fSkgPT4ge1xuICAgIGNvbmZpZyA9IGNmZztcbiAgICByZXR1cm4ge1xuICAgICAgICBuYW1lc3BhY2U6ICd3ZWJSVEMnLFxuICAgICAgICBleHRlbmRzOiB7XG4gICAgICAgICAgICBNZTogV2ViUnRjUGhvbmVcbiAgICAgICAgfVxuICAgIH1cbn07XG4iXX0=

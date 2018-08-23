(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
(function() {

    const package = require('../package.json');
    window.ChatEngineCore.plugin[package.name] = require('../src/plugin.js');

})();

},{"../package.json":2,"../src/plugin.js":3}],2:[function(require,module,exports){
module.exports={
  "author": "Adam Bavosa",
  "name": "chat-engine-webrtc",
  "version": "0.0.1",
  "main": "src/plugin.js",
  "dependencies": {
    "chat-engine": "^0.9.18"
  }
}

},{}],3:[function(require,module,exports){
/*
 *
 */

const rtcconfig = {
    iceServers: [{
            "urls": navigator.mozGetUserMedia ? "stun:stun.services.mozilla.com"
                  : navigator.webkitGetUserMedia ? "stun:stun.l.google.com:19302" :
                  "stun:23.21.150.121"
        },
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:19302" },
        { urls: "stun:23.21.150.121" },
        { urls: "stun:stun01.sipphone.com" },
        { urls: "stun:stun.ekiga.net" },
        { urls: "stun:stun.fwdnet.net" },
        { urls: "stun:stun.ideasip.com" },
        { urls: "stun:stun.iptel.org" },
        { urls: "stun:stun.rixtelecom.se" },
        { urls: "stun:stun.schlund.de" },
        { urls: "stun:stunserver.org" },
        { urls: "stun:stun.softjoys.com" },
        { urls: "stun:stun.voiparound.com" },
        { urls: "stun:stun.voipbuster.com" },
        { urls: "stun:stun.voipstunt.com" },
        { urls: "stun:stun.voxgratia.org" },
        { urls: "stun:stun.xten.com" }
    ]
};

function uuid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

function onIncomingCallNotDefined(callback) {
    console.error('ChatEngine WebRTC Plugin: [onIncomingCall] Incoming call event handler is not defined.');
    callback(false);
}

function onCallResponseNotDefined() {
    console.error('ChatEngine WebRTC Plugin: [onCallResponse] Call response event handler is not defined.');
}

function onCallDisconnectNotDefined() {
    console.error('ChatEngine WebRTC Plugin: [onCallDisconnect] Call disconnect event handler is not defined.');
}

function onIceCandidate(iceEvent, user, peerConnection, callId) {
    peerConnection.iceCache.push(iceEvent.candidate);

    if (peerConnection.acceptedCall) {
        sendIceCandidates(user, peerConnection, callId);
    }
}

function sendIceCandidates(user, peerConnection, callId) {
    user.direct.emit(['$' + 'webRTC', 'incomingIceCandidate'].join('.'), {
        callId,
        candidates: peerConnection.iceCache
    });
}

module.exports = (config) => {
    class extension {
        construct() {
            // Holds RTCPeerConnection objects for each call. Key is the call ID (a UUID).
            this.callCache = {};

            // [config.onIncomingCall] must be defined on init, otherwise incoming call event will log an error.
            // The event is meant to trigger UI for the user to accept or reject an incoming call.
            this.parentOnIncomingCall = config.onIncomingCall || onIncomingCallNotDefined;

            // [config.onCallResponse] must be defined on init, otherwise call response event will log an error.
            // The event is meant to give the user an opportunity to handle a call response.
            this.parentOnCallResponse = config.onCallResponse || onCallResponseNotDefined;

            // [config.onCallDisconnect] must be defined on init, otherwise disconnect call event will log an error.
            // The event is meant to notify the user that the call has ended in the UI.
            this.parentOnCallDisconnect = config.onCallDisconnect || onCallDisconnectNotDefined;

            // Video and audio stream from local client camera and microphone.
            // Optional to pass now, can be passed later when a call is accepted.
            this.localStream = config.localStream;

            // ChatEngine Direct event handler for incoming call requests.
            this.ChatEngine.me.direct.on(['$' + 'webRTC', 'incomingCall'].join('.'), (payload) => {
                this.incomingCall(payload);
            });

            // ChatEngine Direct event handler for call responses.
            this.ChatEngine.me.direct.on(['$' + 'webRTC', 'callResponse'].join('.'), (payload) => {
                this.callResponse(payload);
            });

            // ChatEngine Direct event handler for new ICE candidates for RTCPeerConnection object.
            // WebRTC client tells the remote client their ICE candidates through this signal.
            this.ChatEngine.me.direct.on(['$' + 'webRTC', 'incomingIceCandidate'].join('.'), (payload) => {
                this.incomingIceCandidate(payload);
            });
        }

        callUser(user, onRemoteVideoStreamAvailable, localStream) {
            if (user.name === 'Me') {
                console.error('ChatEngine WebRTC Plugin: [callUser] Calling self is not allowed.');
                return;
            }

            // If the local stream is not passed on plugin init, it can be passed here.
            localStream = localStream || this.localStream;
            let callId = uuid();
            let peerConnection = new RTCPeerConnection(rtcconfig);
            this.callCache[callId] = peerConnection;
            peerConnection.ontrack = onRemoteVideoStreamAvailable;
            peerConnection.addStream(localStream);
            peerConnection.iceCache = [];

            peerConnection.oniceconnectionstatechange = () => {
                if (peerConnection.iceConnectionState === 'disconnected') {
                    this.onDisconnect(callId, user.uuid);
                }
            };

            // When ICE candidates become available, send them to the remote client.
            peerConnection.onicecandidate = (iceEvent) => {
                if (!iceEvent.candidate) return;
                onIceCandidate(iceEvent, user, peerConnection, callId);
            };

            let localDescription; // WebRTC local description
            peerConnection.onnegotiationneeded = () => {
                peerConnection.createOffer()
                .then((description) => {
                    localDescription = description;
                    return peerConnection.setLocalDescription(localDescription);
                }).then(() => {
                    user.direct.emit(['$' + 'webRTC', 'incomingCall'].join('.'), {
                        callId,
                        description: localDescription
                    });
                }).catch((error) => {
                    console.error('ChatEngine WebRTC Plugin: [callUser]', error);
                });
            };
        }

        callResponse(payload) {
            const {callId, acceptCall, description} = payload.data;
            let sender = payload.sender;

            if (acceptCall) {
                this.callCache[callId].acceptedCall = true;

                // When a user accepts a call, they send their WebRTC peer connection description.
                // Set it locally as the remote client's peer connection description.
                this.callCache[callId].setRemoteDescription(description)
                .then(() => {
                    sendIceCandidates(sender, this.callCache[callId], callId);
                })
                .catch((error) => {
                    console.error('ChatEngine WebRTC Plugin: [callResponse]', error);
                });

            } else {
                delete this.callCache[callId];
            }

            this.parentOnCallResponse(sender.uuid, acceptCall);
        }

        incomingCall(payload) {
            const sender = payload.sender;
            const { callId } = payload.data;
            const remoteDescription = payload.data.description;

            // Should be executed after this client accepts or rejects an incoming call.
            const callResponseCallback = (acceptCall, onRemoteVideoStreamAvailable, localStream) => {
                localStream = localStream || this.localStream;

                if (acceptCall) {
                    if (typeof onRemoteVideoStreamAvailable !== 'function') {
                        console.error('ChatEngine WebRTC Plugin: [incomingCall] onRemoteVideoStreamAvailable handler is not defined.');
                    }

                    if (typeof localStream !== 'object') {
                        console.error('ChatEngine WebRTC Plugin: Local video stream object is not defined.');
                    }

                    let answerDescription;
                    let peerConnection = new RTCPeerConnection(rtcconfig);
                    this.callCache[callId] = peerConnection;
                    peerConnection.ontrack = onRemoteVideoStreamAvailable;
                    peerConnection.iceCache = [];

                    peerConnection.oniceconnectionstatechange = () => {
                        if (peerConnection.iceConnectionState === 'disconnected') {
                            this.onDisconnect(callId, sender.uuid);
                        }
                    };

                    // When ICE candidates become available, send them to the remote client
                    peerConnection.onicecandidate = (iceEvent) => {
                        if (!iceEvent.candidate) return;
                        onIceCandidate(iceEvent, sender, peerConnection, callId);
                    };

                    peerConnection.setRemoteDescription(remoteDescription)
                    .then(() => {
                        return peerConnection.addStream(localStream);
                    }).then(() => {
                        return peerConnection.createAnswer();
                    }).then((answer) => {
                        answerDescription = answer;
                        return peerConnection.setLocalDescription(answerDescription);
                    }).then(() => {
                        peerConnection.acceptedCall = true;
                        sendIceCandidates(sender, peerConnection, callId);
                        sender.direct.emit(['$' + 'webRTC', 'callResponse'].join('.'), {
                            callId,
                            acceptCall,
                            description: answerDescription
                        });
                    }).catch((error) => {
                        console.error('ChatEngine WebRTC Plugin: [incomingCall]', error);
                    });
                } else {
                    sender.direct.emit(['$' + 'webRTC', 'callResponse'].join('.'), {
                        callId,
                        acceptCall
                    });
                }
            }

            this.parentOnIncomingCall(sender.uuid, callResponseCallback);
        }

        incomingIceCandidate(payload) {
            const { callId, candidates } = payload.data;

            if (!this.callCache[callId] || typeof candidates !== 'object') {
                return;
            }

            candidates.forEach((candidate) => {
                this.callCache[callId].addIceCandidate(candidate)
                .catch((error) => {
                    console.error('ChatEngine WebRTC Plugin: [incomingIceCandidate]', error);
                });
            });
        }

        onDisconnect(callId, userUuid) {
            this.callCache[callId].close();
            delete this.callCache[callId];
            this.parentOnCallDisconnect(userUuid);
        }
    }

    let emit = {};

    return {
        namespace: 'webRTC',
        extends: {
            Chat: extension
        },
        middleware: {}
    }
};

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy5udm0vdmVyc2lvbnMvbm9kZS92OC4xMS4yL2xpYi9ub2RlX21vZHVsZXMvY2hhdC1lbmdpbmUtcGx1Z2luL25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIudG1wL3dyYXAuanMiLCJwYWNrYWdlLmpzb24iLCJzcmMvcGx1Z2luLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwiKGZ1bmN0aW9uKCkge1xuXG4gICAgY29uc3QgcGFja2FnZSA9IHJlcXVpcmUoJy4uL3BhY2thZ2UuanNvbicpO1xuICAgIHdpbmRvdy5DaGF0RW5naW5lQ29yZS5wbHVnaW5bcGFja2FnZS5uYW1lXSA9IHJlcXVpcmUoJy4uL3NyYy9wbHVnaW4uanMnKTtcblxufSkoKTtcbiIsIm1vZHVsZS5leHBvcnRzPXtcbiAgXCJhdXRob3JcIjogXCJBZGFtIEJhdm9zYVwiLFxuICBcIm5hbWVcIjogXCJjaGF0LWVuZ2luZS13ZWJydGNcIixcbiAgXCJ2ZXJzaW9uXCI6IFwiMC4wLjFcIixcbiAgXCJtYWluXCI6IFwic3JjL3BsdWdpbi5qc1wiLFxuICBcImRlcGVuZGVuY2llc1wiOiB7XG4gICAgXCJjaGF0LWVuZ2luZVwiOiBcIl4wLjkuMThcIlxuICB9XG59XG4iLCIvKlxuICpcbiAqL1xuXG5jb25zdCBydGNjb25maWcgPSB7XG4gICAgaWNlU2VydmVyczogW3tcbiAgICAgICAgICAgIFwidXJsc1wiOiBuYXZpZ2F0b3IubW96R2V0VXNlck1lZGlhID8gXCJzdHVuOnN0dW4uc2VydmljZXMubW96aWxsYS5jb21cIlxuICAgICAgICAgICAgICAgICAgOiBuYXZpZ2F0b3Iud2Via2l0R2V0VXNlck1lZGlhID8gXCJzdHVuOnN0dW4ubC5nb29nbGUuY29tOjE5MzAyXCIgOlxuICAgICAgICAgICAgICAgICAgXCJzdHVuOjIzLjIxLjE1MC4xMjFcIlxuICAgICAgICB9LFxuICAgICAgICB7IHVybHM6IFwic3R1bjpzdHVuLmwuZ29vZ2xlLmNvbToxOTMwMlwiIH0sXG4gICAgICAgIHsgdXJsczogXCJzdHVuOnN0dW4xLmwuZ29vZ2xlLmNvbToxOTMwMlwiIH0sXG4gICAgICAgIHsgdXJsczogXCJzdHVuOnN0dW4yLmwuZ29vZ2xlLmNvbToxOTMwMlwiIH0sXG4gICAgICAgIHsgdXJsczogXCJzdHVuOnN0dW4zLmwuZ29vZ2xlLmNvbToxOTMwMlwiIH0sXG4gICAgICAgIHsgdXJsczogXCJzdHVuOnN0dW40LmwuZ29vZ2xlLmNvbToxOTMwMlwiIH0sXG4gICAgICAgIHsgdXJsczogXCJzdHVuOjIzLjIxLjE1MC4xMjFcIiB9LFxuICAgICAgICB7IHVybHM6IFwic3R1bjpzdHVuMDEuc2lwcGhvbmUuY29tXCIgfSxcbiAgICAgICAgeyB1cmxzOiBcInN0dW46c3R1bi5la2lnYS5uZXRcIiB9LFxuICAgICAgICB7IHVybHM6IFwic3R1bjpzdHVuLmZ3ZG5ldC5uZXRcIiB9LFxuICAgICAgICB7IHVybHM6IFwic3R1bjpzdHVuLmlkZWFzaXAuY29tXCIgfSxcbiAgICAgICAgeyB1cmxzOiBcInN0dW46c3R1bi5pcHRlbC5vcmdcIiB9LFxuICAgICAgICB7IHVybHM6IFwic3R1bjpzdHVuLnJpeHRlbGVjb20uc2VcIiB9LFxuICAgICAgICB7IHVybHM6IFwic3R1bjpzdHVuLnNjaGx1bmQuZGVcIiB9LFxuICAgICAgICB7IHVybHM6IFwic3R1bjpzdHVuc2VydmVyLm9yZ1wiIH0sXG4gICAgICAgIHsgdXJsczogXCJzdHVuOnN0dW4uc29mdGpveXMuY29tXCIgfSxcbiAgICAgICAgeyB1cmxzOiBcInN0dW46c3R1bi52b2lwYXJvdW5kLmNvbVwiIH0sXG4gICAgICAgIHsgdXJsczogXCJzdHVuOnN0dW4udm9pcGJ1c3Rlci5jb21cIiB9LFxuICAgICAgICB7IHVybHM6IFwic3R1bjpzdHVuLnZvaXBzdHVudC5jb21cIiB9LFxuICAgICAgICB7IHVybHM6IFwic3R1bjpzdHVuLnZveGdyYXRpYS5vcmdcIiB9LFxuICAgICAgICB7IHVybHM6IFwic3R1bjpzdHVuLnh0ZW4uY29tXCIgfVxuICAgIF1cbn07XG5cbmZ1bmN0aW9uIHV1aWQoKSB7XG4gICAgZnVuY3Rpb24gczQoKSB7XG4gICAgICAgIHJldHVybiBNYXRoLmZsb29yKCgxICsgTWF0aC5yYW5kb20oKSkgKiAweDEwMDAwKVxuICAgICAgICAgICAgLnRvU3RyaW5nKDE2KVxuICAgICAgICAgICAgLnN1YnN0cmluZygxKTtcbiAgICB9XG4gICAgcmV0dXJuIHM0KCkgKyBzNCgpICsgJy0nICsgczQoKSArICctJyArIHM0KCkgKyAnLScgKyBzNCgpICsgJy0nICsgczQoKSArIHM0KCkgKyBzNCgpO1xufVxuXG5mdW5jdGlvbiBvbkluY29taW5nQ2FsbE5vdERlZmluZWQoY2FsbGJhY2spIHtcbiAgICBjb25zb2xlLmVycm9yKCdDaGF0RW5naW5lIFdlYlJUQyBQbHVnaW46IFtvbkluY29taW5nQ2FsbF0gSW5jb21pbmcgY2FsbCBldmVudCBoYW5kbGVyIGlzIG5vdCBkZWZpbmVkLicpO1xuICAgIGNhbGxiYWNrKGZhbHNlKTtcbn1cblxuZnVuY3Rpb24gb25DYWxsUmVzcG9uc2VOb3REZWZpbmVkKCkge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0NoYXRFbmdpbmUgV2ViUlRDIFBsdWdpbjogW29uQ2FsbFJlc3BvbnNlXSBDYWxsIHJlc3BvbnNlIGV2ZW50IGhhbmRsZXIgaXMgbm90IGRlZmluZWQuJyk7XG59XG5cbmZ1bmN0aW9uIG9uQ2FsbERpc2Nvbm5lY3ROb3REZWZpbmVkKCkge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0NoYXRFbmdpbmUgV2ViUlRDIFBsdWdpbjogW29uQ2FsbERpc2Nvbm5lY3RdIENhbGwgZGlzY29ubmVjdCBldmVudCBoYW5kbGVyIGlzIG5vdCBkZWZpbmVkLicpO1xufVxuXG5mdW5jdGlvbiBvbkljZUNhbmRpZGF0ZShpY2VFdmVudCwgdXNlciwgcGVlckNvbm5lY3Rpb24sIGNhbGxJZCkge1xuICAgIHBlZXJDb25uZWN0aW9uLmljZUNhY2hlLnB1c2goaWNlRXZlbnQuY2FuZGlkYXRlKTtcblxuICAgIGlmIChwZWVyQ29ubmVjdGlvbi5hY2NlcHRlZENhbGwpIHtcbiAgICAgICAgc2VuZEljZUNhbmRpZGF0ZXModXNlciwgcGVlckNvbm5lY3Rpb24sIGNhbGxJZCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBzZW5kSWNlQ2FuZGlkYXRlcyh1c2VyLCBwZWVyQ29ubmVjdGlvbiwgY2FsbElkKSB7XG4gICAgdXNlci5kaXJlY3QuZW1pdChbJyQnICsgJ3dlYlJUQycsICdpbmNvbWluZ0ljZUNhbmRpZGF0ZSddLmpvaW4oJy4nKSwge1xuICAgICAgICBjYWxsSWQsXG4gICAgICAgIGNhbmRpZGF0ZXM6IHBlZXJDb25uZWN0aW9uLmljZUNhY2hlXG4gICAgfSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gKGNvbmZpZykgPT4ge1xuICAgIGNsYXNzIGV4dGVuc2lvbiB7XG4gICAgICAgIGNvbnN0cnVjdCgpIHtcbiAgICAgICAgICAgIC8vIEhvbGRzIFJUQ1BlZXJDb25uZWN0aW9uIG9iamVjdHMgZm9yIGVhY2ggY2FsbC4gS2V5IGlzIHRoZSBjYWxsIElEIChhIFVVSUQpLlxuICAgICAgICAgICAgdGhpcy5jYWxsQ2FjaGUgPSB7fTtcblxuICAgICAgICAgICAgLy8gW2NvbmZpZy5vbkluY29taW5nQ2FsbF0gbXVzdCBiZSBkZWZpbmVkIG9uIGluaXQsIG90aGVyd2lzZSBpbmNvbWluZyBjYWxsIGV2ZW50IHdpbGwgbG9nIGFuIGVycm9yLlxuICAgICAgICAgICAgLy8gVGhlIGV2ZW50IGlzIG1lYW50IHRvIHRyaWdnZXIgVUkgZm9yIHRoZSB1c2VyIHRvIGFjY2VwdCBvciByZWplY3QgYW4gaW5jb21pbmcgY2FsbC5cbiAgICAgICAgICAgIHRoaXMucGFyZW50T25JbmNvbWluZ0NhbGwgPSBjb25maWcub25JbmNvbWluZ0NhbGwgfHwgb25JbmNvbWluZ0NhbGxOb3REZWZpbmVkO1xuXG4gICAgICAgICAgICAvLyBbY29uZmlnLm9uQ2FsbFJlc3BvbnNlXSBtdXN0IGJlIGRlZmluZWQgb24gaW5pdCwgb3RoZXJ3aXNlIGNhbGwgcmVzcG9uc2UgZXZlbnQgd2lsbCBsb2cgYW4gZXJyb3IuXG4gICAgICAgICAgICAvLyBUaGUgZXZlbnQgaXMgbWVhbnQgdG8gZ2l2ZSB0aGUgdXNlciBhbiBvcHBvcnR1bml0eSB0byBoYW5kbGUgYSBjYWxsIHJlc3BvbnNlLlxuICAgICAgICAgICAgdGhpcy5wYXJlbnRPbkNhbGxSZXNwb25zZSA9IGNvbmZpZy5vbkNhbGxSZXNwb25zZSB8fCBvbkNhbGxSZXNwb25zZU5vdERlZmluZWQ7XG5cbiAgICAgICAgICAgIC8vIFtjb25maWcub25DYWxsRGlzY29ubmVjdF0gbXVzdCBiZSBkZWZpbmVkIG9uIGluaXQsIG90aGVyd2lzZSBkaXNjb25uZWN0IGNhbGwgZXZlbnQgd2lsbCBsb2cgYW4gZXJyb3IuXG4gICAgICAgICAgICAvLyBUaGUgZXZlbnQgaXMgbWVhbnQgdG8gbm90aWZ5IHRoZSB1c2VyIHRoYXQgdGhlIGNhbGwgaGFzIGVuZGVkIGluIHRoZSBVSS5cbiAgICAgICAgICAgIHRoaXMucGFyZW50T25DYWxsRGlzY29ubmVjdCA9IGNvbmZpZy5vbkNhbGxEaXNjb25uZWN0IHx8IG9uQ2FsbERpc2Nvbm5lY3ROb3REZWZpbmVkO1xuXG4gICAgICAgICAgICAvLyBWaWRlbyBhbmQgYXVkaW8gc3RyZWFtIGZyb20gbG9jYWwgY2xpZW50IGNhbWVyYSBhbmQgbWljcm9waG9uZS5cbiAgICAgICAgICAgIC8vIE9wdGlvbmFsIHRvIHBhc3Mgbm93LCBjYW4gYmUgcGFzc2VkIGxhdGVyIHdoZW4gYSBjYWxsIGlzIGFjY2VwdGVkLlxuICAgICAgICAgICAgdGhpcy5sb2NhbFN0cmVhbSA9IGNvbmZpZy5sb2NhbFN0cmVhbTtcblxuICAgICAgICAgICAgLy8gQ2hhdEVuZ2luZSBEaXJlY3QgZXZlbnQgaGFuZGxlciBmb3IgaW5jb21pbmcgY2FsbCByZXF1ZXN0cy5cbiAgICAgICAgICAgIHRoaXMuQ2hhdEVuZ2luZS5tZS5kaXJlY3Qub24oWyckJyArICd3ZWJSVEMnLCAnaW5jb21pbmdDYWxsJ10uam9pbignLicpLCAocGF5bG9hZCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuaW5jb21pbmdDYWxsKHBheWxvYWQpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIENoYXRFbmdpbmUgRGlyZWN0IGV2ZW50IGhhbmRsZXIgZm9yIGNhbGwgcmVzcG9uc2VzLlxuICAgICAgICAgICAgdGhpcy5DaGF0RW5naW5lLm1lLmRpcmVjdC5vbihbJyQnICsgJ3dlYlJUQycsICdjYWxsUmVzcG9uc2UnXS5qb2luKCcuJyksIChwYXlsb2FkKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsUmVzcG9uc2UocGF5bG9hZCk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy8gQ2hhdEVuZ2luZSBEaXJlY3QgZXZlbnQgaGFuZGxlciBmb3IgbmV3IElDRSBjYW5kaWRhdGVzIGZvciBSVENQZWVyQ29ubmVjdGlvbiBvYmplY3QuXG4gICAgICAgICAgICAvLyBXZWJSVEMgY2xpZW50IHRlbGxzIHRoZSByZW1vdGUgY2xpZW50IHRoZWlyIElDRSBjYW5kaWRhdGVzIHRocm91Z2ggdGhpcyBzaWduYWwuXG4gICAgICAgICAgICB0aGlzLkNoYXRFbmdpbmUubWUuZGlyZWN0Lm9uKFsnJCcgKyAnd2ViUlRDJywgJ2luY29taW5nSWNlQ2FuZGlkYXRlJ10uam9pbignLicpLCAocGF5bG9hZCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuaW5jb21pbmdJY2VDYW5kaWRhdGUocGF5bG9hZCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNhbGxVc2VyKHVzZXIsIG9uUmVtb3RlVmlkZW9TdHJlYW1BdmFpbGFibGUsIGxvY2FsU3RyZWFtKSB7XG4gICAgICAgICAgICBpZiAodXNlci5uYW1lID09PSAnTWUnKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignQ2hhdEVuZ2luZSBXZWJSVEMgUGx1Z2luOiBbY2FsbFVzZXJdIENhbGxpbmcgc2VsZiBpcyBub3QgYWxsb3dlZC4nKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIElmIHRoZSBsb2NhbCBzdHJlYW0gaXMgbm90IHBhc3NlZCBvbiBwbHVnaW4gaW5pdCwgaXQgY2FuIGJlIHBhc3NlZCBoZXJlLlxuICAgICAgICAgICAgbG9jYWxTdHJlYW0gPSBsb2NhbFN0cmVhbSB8fCB0aGlzLmxvY2FsU3RyZWFtO1xuICAgICAgICAgICAgbGV0IGNhbGxJZCA9IHV1aWQoKTtcbiAgICAgICAgICAgIGxldCBwZWVyQ29ubmVjdGlvbiA9IG5ldyBSVENQZWVyQ29ubmVjdGlvbihydGNjb25maWcpO1xuICAgICAgICAgICAgdGhpcy5jYWxsQ2FjaGVbY2FsbElkXSA9IHBlZXJDb25uZWN0aW9uO1xuICAgICAgICAgICAgcGVlckNvbm5lY3Rpb24ub250cmFjayA9IG9uUmVtb3RlVmlkZW9TdHJlYW1BdmFpbGFibGU7XG4gICAgICAgICAgICBwZWVyQ29ubmVjdGlvbi5hZGRTdHJlYW0obG9jYWxTdHJlYW0pO1xuICAgICAgICAgICAgcGVlckNvbm5lY3Rpb24uaWNlQ2FjaGUgPSBbXTtcblxuICAgICAgICAgICAgcGVlckNvbm5lY3Rpb24ub25pY2Vjb25uZWN0aW9uc3RhdGVjaGFuZ2UgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHBlZXJDb25uZWN0aW9uLmljZUNvbm5lY3Rpb25TdGF0ZSA9PT0gJ2Rpc2Nvbm5lY3RlZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5vbkRpc2Nvbm5lY3QoY2FsbElkLCB1c2VyLnV1aWQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIC8vIFdoZW4gSUNFIGNhbmRpZGF0ZXMgYmVjb21lIGF2YWlsYWJsZSwgc2VuZCB0aGVtIHRvIHRoZSByZW1vdGUgY2xpZW50LlxuICAgICAgICAgICAgcGVlckNvbm5lY3Rpb24ub25pY2VjYW5kaWRhdGUgPSAoaWNlRXZlbnQpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIWljZUV2ZW50LmNhbmRpZGF0ZSkgcmV0dXJuO1xuICAgICAgICAgICAgICAgIG9uSWNlQ2FuZGlkYXRlKGljZUV2ZW50LCB1c2VyLCBwZWVyQ29ubmVjdGlvbiwgY2FsbElkKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGxldCBsb2NhbERlc2NyaXB0aW9uOyAvLyBXZWJSVEMgbG9jYWwgZGVzY3JpcHRpb25cbiAgICAgICAgICAgIHBlZXJDb25uZWN0aW9uLm9ubmVnb3RpYXRpb25uZWVkZWQgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgcGVlckNvbm5lY3Rpb24uY3JlYXRlT2ZmZXIoKVxuICAgICAgICAgICAgICAgIC50aGVuKChkZXNjcmlwdGlvbikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBsb2NhbERlc2NyaXB0aW9uID0gZGVzY3JpcHRpb247XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBwZWVyQ29ubmVjdGlvbi5zZXRMb2NhbERlc2NyaXB0aW9uKGxvY2FsRGVzY3JpcHRpb24pO1xuICAgICAgICAgICAgICAgIH0pLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB1c2VyLmRpcmVjdC5lbWl0KFsnJCcgKyAnd2ViUlRDJywgJ2luY29taW5nQ2FsbCddLmpvaW4oJy4nKSwge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbElkLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGxvY2FsRGVzY3JpcHRpb25cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSkuY2F0Y2goKGVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0NoYXRFbmdpbmUgV2ViUlRDIFBsdWdpbjogW2NhbGxVc2VyXScsIGVycm9yKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBjYWxsUmVzcG9uc2UocGF5bG9hZCkge1xuICAgICAgICAgICAgY29uc3Qge2NhbGxJZCwgYWNjZXB0Q2FsbCwgZGVzY3JpcHRpb259ID0gcGF5bG9hZC5kYXRhO1xuICAgICAgICAgICAgbGV0IHNlbmRlciA9IHBheWxvYWQuc2VuZGVyO1xuXG4gICAgICAgICAgICBpZiAoYWNjZXB0Q2FsbCkge1xuICAgICAgICAgICAgICAgIHRoaXMuY2FsbENhY2hlW2NhbGxJZF0uYWNjZXB0ZWRDYWxsID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgIC8vIFdoZW4gYSB1c2VyIGFjY2VwdHMgYSBjYWxsLCB0aGV5IHNlbmQgdGhlaXIgV2ViUlRDIHBlZXIgY29ubmVjdGlvbiBkZXNjcmlwdGlvbi5cbiAgICAgICAgICAgICAgICAvLyBTZXQgaXQgbG9jYWxseSBhcyB0aGUgcmVtb3RlIGNsaWVudCdzIHBlZXIgY29ubmVjdGlvbiBkZXNjcmlwdGlvbi5cbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxDYWNoZVtjYWxsSWRdLnNldFJlbW90ZURlc2NyaXB0aW9uKGRlc2NyaXB0aW9uKVxuICAgICAgICAgICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgc2VuZEljZUNhbmRpZGF0ZXMoc2VuZGVyLCB0aGlzLmNhbGxDYWNoZVtjYWxsSWRdLCBjYWxsSWQpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLmNhdGNoKChlcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdDaGF0RW5naW5lIFdlYlJUQyBQbHVnaW46IFtjYWxsUmVzcG9uc2VdJywgZXJyb3IpO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLmNhbGxDYWNoZVtjYWxsSWRdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnBhcmVudE9uQ2FsbFJlc3BvbnNlKHNlbmRlci51dWlkLCBhY2NlcHRDYWxsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGluY29taW5nQ2FsbChwYXlsb2FkKSB7XG4gICAgICAgICAgICBjb25zdCBzZW5kZXIgPSBwYXlsb2FkLnNlbmRlcjtcbiAgICAgICAgICAgIGNvbnN0IHsgY2FsbElkIH0gPSBwYXlsb2FkLmRhdGE7XG4gICAgICAgICAgICBjb25zdCByZW1vdGVEZXNjcmlwdGlvbiA9IHBheWxvYWQuZGF0YS5kZXNjcmlwdGlvbjtcblxuICAgICAgICAgICAgLy8gU2hvdWxkIGJlIGV4ZWN1dGVkIGFmdGVyIHRoaXMgY2xpZW50IGFjY2VwdHMgb3IgcmVqZWN0cyBhbiBpbmNvbWluZyBjYWxsLlxuICAgICAgICAgICAgY29uc3QgY2FsbFJlc3BvbnNlQ2FsbGJhY2sgPSAoYWNjZXB0Q2FsbCwgb25SZW1vdGVWaWRlb1N0cmVhbUF2YWlsYWJsZSwgbG9jYWxTdHJlYW0pID0+IHtcbiAgICAgICAgICAgICAgICBsb2NhbFN0cmVhbSA9IGxvY2FsU3RyZWFtIHx8IHRoaXMubG9jYWxTdHJlYW07XG5cbiAgICAgICAgICAgICAgICBpZiAoYWNjZXB0Q2FsbCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIG9uUmVtb3RlVmlkZW9TdHJlYW1BdmFpbGFibGUgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0NoYXRFbmdpbmUgV2ViUlRDIFBsdWdpbjogW2luY29taW5nQ2FsbF0gb25SZW1vdGVWaWRlb1N0cmVhbUF2YWlsYWJsZSBoYW5kbGVyIGlzIG5vdCBkZWZpbmVkLicpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBsb2NhbFN0cmVhbSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0NoYXRFbmdpbmUgV2ViUlRDIFBsdWdpbjogTG9jYWwgdmlkZW8gc3RyZWFtIG9iamVjdCBpcyBub3QgZGVmaW5lZC4nKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGxldCBhbnN3ZXJEZXNjcmlwdGlvbjtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHBlZXJDb25uZWN0aW9uID0gbmV3IFJUQ1BlZXJDb25uZWN0aW9uKHJ0Y2NvbmZpZyk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2FsbENhY2hlW2NhbGxJZF0gPSBwZWVyQ29ubmVjdGlvbjtcbiAgICAgICAgICAgICAgICAgICAgcGVlckNvbm5lY3Rpb24ub250cmFjayA9IG9uUmVtb3RlVmlkZW9TdHJlYW1BdmFpbGFibGU7XG4gICAgICAgICAgICAgICAgICAgIHBlZXJDb25uZWN0aW9uLmljZUNhY2hlID0gW107XG5cbiAgICAgICAgICAgICAgICAgICAgcGVlckNvbm5lY3Rpb24ub25pY2Vjb25uZWN0aW9uc3RhdGVjaGFuZ2UgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocGVlckNvbm5lY3Rpb24uaWNlQ29ubmVjdGlvblN0YXRlID09PSAnZGlzY29ubmVjdGVkJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMub25EaXNjb25uZWN0KGNhbGxJZCwgc2VuZGVyLnV1aWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIFdoZW4gSUNFIGNhbmRpZGF0ZXMgYmVjb21lIGF2YWlsYWJsZSwgc2VuZCB0aGVtIHRvIHRoZSByZW1vdGUgY2xpZW50XG4gICAgICAgICAgICAgICAgICAgIHBlZXJDb25uZWN0aW9uLm9uaWNlY2FuZGlkYXRlID0gKGljZUV2ZW50KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWljZUV2ZW50LmNhbmRpZGF0ZSkgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICAgICAgb25JY2VDYW5kaWRhdGUoaWNlRXZlbnQsIHNlbmRlciwgcGVlckNvbm5lY3Rpb24sIGNhbGxJZCk7XG4gICAgICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICAgICAgcGVlckNvbm5lY3Rpb24uc2V0UmVtb3RlRGVzY3JpcHRpb24ocmVtb3RlRGVzY3JpcHRpb24pXG4gICAgICAgICAgICAgICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwZWVyQ29ubmVjdGlvbi5hZGRTdHJlYW0obG9jYWxTdHJlYW0pO1xuICAgICAgICAgICAgICAgICAgICB9KS50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwZWVyQ29ubmVjdGlvbi5jcmVhdGVBbnN3ZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgfSkudGhlbigoYW5zd2VyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhbnN3ZXJEZXNjcmlwdGlvbiA9IGFuc3dlcjtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwZWVyQ29ubmVjdGlvbi5zZXRMb2NhbERlc2NyaXB0aW9uKGFuc3dlckRlc2NyaXB0aW9uKTtcbiAgICAgICAgICAgICAgICAgICAgfSkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwZWVyQ29ubmVjdGlvbi5hY2NlcHRlZENhbGwgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VuZEljZUNhbmRpZGF0ZXMoc2VuZGVyLCBwZWVyQ29ubmVjdGlvbiwgY2FsbElkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbmRlci5kaXJlY3QuZW1pdChbJyQnICsgJ3dlYlJUQycsICdjYWxsUmVzcG9uc2UnXS5qb2luKCcuJyksIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsSWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYWNjZXB0Q2FsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogYW5zd2VyRGVzY3JpcHRpb25cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9KS5jYXRjaCgoZXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0NoYXRFbmdpbmUgV2ViUlRDIFBsdWdpbjogW2luY29taW5nQ2FsbF0nLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbmRlci5kaXJlY3QuZW1pdChbJyQnICsgJ3dlYlJUQycsICdjYWxsUmVzcG9uc2UnXS5qb2luKCcuJyksIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGFjY2VwdENhbGxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnBhcmVudE9uSW5jb21pbmdDYWxsKHNlbmRlci51dWlkLCBjYWxsUmVzcG9uc2VDYWxsYmFjayk7XG4gICAgICAgIH1cblxuICAgICAgICBpbmNvbWluZ0ljZUNhbmRpZGF0ZShwYXlsb2FkKSB7XG4gICAgICAgICAgICBjb25zdCB7IGNhbGxJZCwgY2FuZGlkYXRlcyB9ID0gcGF5bG9hZC5kYXRhO1xuXG4gICAgICAgICAgICBpZiAoIXRoaXMuY2FsbENhY2hlW2NhbGxJZF0gfHwgdHlwZW9mIGNhbmRpZGF0ZXMgIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjYW5kaWRhdGVzLmZvckVhY2goKGNhbmRpZGF0ZSkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuY2FsbENhY2hlW2NhbGxJZF0uYWRkSWNlQ2FuZGlkYXRlKGNhbmRpZGF0ZSlcbiAgICAgICAgICAgICAgICAuY2F0Y2goKGVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0NoYXRFbmdpbmUgV2ViUlRDIFBsdWdpbjogW2luY29taW5nSWNlQ2FuZGlkYXRlXScsIGVycm9yKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgb25EaXNjb25uZWN0KGNhbGxJZCwgdXNlclV1aWQpIHtcbiAgICAgICAgICAgIHRoaXMuY2FsbENhY2hlW2NhbGxJZF0uY2xvc2UoKTtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLmNhbGxDYWNoZVtjYWxsSWRdO1xuICAgICAgICAgICAgdGhpcy5wYXJlbnRPbkNhbGxEaXNjb25uZWN0KHVzZXJVdWlkKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGxldCBlbWl0ID0ge307XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBuYW1lc3BhY2U6ICd3ZWJSVEMnLFxuICAgICAgICBleHRlbmRzOiB7XG4gICAgICAgICAgICBDaGF0OiBleHRlbnNpb25cbiAgICAgICAgfSxcbiAgICAgICAgbWlkZGxld2FyZToge31cbiAgICB9XG59O1xuIl19

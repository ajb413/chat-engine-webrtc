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

const rtcconfig = { iceServers : [{ "url" :
    navigator.mozGetUserMedia    ? "stun:stun.services.mozilla.com" :
    navigator.webkitGetUserMedia ? "stun:stun.l.google.com:19302"   :
                                   "stun:23.21.150.121"
}
,   {url: "stun:stun.l.google.com:19302"}
,   {url: "stun:stun1.l.google.com:19302"}
,   {url: "stun:stun2.l.google.com:19302"}
,   {url: "stun:stun3.l.google.com:19302"}
,   {url: "stun:stun4.l.google.com:19302"}
,   {url: "stun:23.21.150.121"}
,   {url: "stun:stun01.sipphone.com"}
,   {url: "stun:stun.ekiga.net"}
,   {url: "stun:stun.fwdnet.net"}
,   {url: "stun:stun.ideasip.com"}
,   {url: "stun:stun.iptel.org"}
,   {url: "stun:stun.rixtelecom.se"}
,   {url: "stun:stun.schlund.de"}
,   {url: "stun:stunserver.org"}
,   {url: "stun:stun.softjoys.com"}
,   {url: "stun:stun.voiparound.com"}
,   {url: "stun:stun.voipbuster.com"}
,   {url: "stun:stun.voipstunt.com"}
,   {url: "stun:stun.voxgratia.org"}
,   {url: "stun:stun.xten.com"}
] };

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
            let localDescription; // WebRTC local description
            let peerConnection = new RTCPeerConnection(rtcconfig);
            this.callCache[callId] = peerConnection;
            peerConnection.oniceconnectionstatechange = () => {
                if (peerConnection.iceConnectionState === 'disconnected') {
                    this.onDisconnect(callId, user.uuid);
                }
            };

            // Set local and remote video and audio streams to peer connection object.
            peerConnection.ontrack = onRemoteVideoStreamAvailable;

            if (localStream) {
                localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));
            }

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
        }

        callResponse(payload) {
            const {callId, acceptCall, description} = payload.data;
            let sender = payload.sender;

            if (acceptCall) {
                // When ICE candidates become available, send them to the remote client.
                this.callCache[callId].onicecandidate = (iceEvent) => {
                    if (iceEvent.candidate) {
                        sender.direct.emit(['$' + 'webRTC', 'incomingIceCandidate'].join('.'), {
                            callId,
                            candidate: iceEvent.candidate
                        });
                    }
                };

                // When a user accepts a call, they send their WebRTC peer connection description.
                // Set it locally as the remote client's peer connection description.
                this.callCache[callId].setRemoteDescription(description)
                .catch((error) => {
                    console.error('ChatEngine WebRTC Plugin: [callResponse]', error);
                });
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

                    // When ICE candidates become available, send them to the remote client
                    peerConnection.onicecandidate = (iceEvent) => {
                        if (iceEvent.candidate) {
                            sender.direct.emit(['$' + 'webRTC', 'incomingIceCandidate'].join('.'), {
                                callId,
                                candidate: iceEvent.candidate
                            });
                        }
                    };

                    peerConnection.oniceconnectionstatechange = () => {
                        if (peerConnection.iceConnectionState === 'disconnected') {
                            this.onDisconnect(callId, sender.uuid);
                        }
                    };

                    localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

                    peerConnection.ontrack = onRemoteVideoStreamAvailable;
                    peerConnection.setRemoteDescription(remoteDescription)
                    .then(() => {
                        return peerConnection.createAnswer();
                    }).then((answer) => {
                        answerDescription = answer;
                        return peerConnection.setLocalDescription(answerDescription);
                    }).then(() => {
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
            const { callId, candidate } = payload.data;

            if (!this.callCache[callId]) {
                return;
            }

            this.callCache[callId].addIceCandidate(candidate)
            .catch((error) => {
                console.error('ChatEngine WebRTC Plugin: [incomingIceCandidate]', error);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy5udm0vdmVyc2lvbnMvbm9kZS92OC4xMS4yL2xpYi9ub2RlX21vZHVsZXMvY2hhdC1lbmdpbmUtcGx1Z2luL25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIudG1wL3dyYXAuanMiLCJwYWNrYWdlLmpzb24iLCJzcmMvcGx1Z2luLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwiKGZ1bmN0aW9uKCkge1xuXG4gICAgY29uc3QgcGFja2FnZSA9IHJlcXVpcmUoJy4uL3BhY2thZ2UuanNvbicpO1xuICAgIHdpbmRvdy5DaGF0RW5naW5lQ29yZS5wbHVnaW5bcGFja2FnZS5uYW1lXSA9IHJlcXVpcmUoJy4uL3NyYy9wbHVnaW4uanMnKTtcblxufSkoKTtcbiIsIm1vZHVsZS5leHBvcnRzPXtcbiAgXCJhdXRob3JcIjogXCJBZGFtIEJhdm9zYVwiLFxuICBcIm5hbWVcIjogXCJjaGF0LWVuZ2luZS13ZWJydGNcIixcbiAgXCJ2ZXJzaW9uXCI6IFwiMC4wLjFcIixcbiAgXCJtYWluXCI6IFwic3JjL3BsdWdpbi5qc1wiLFxuICBcImRlcGVuZGVuY2llc1wiOiB7XG4gICAgXCJjaGF0LWVuZ2luZVwiOiBcIl4wLjkuMThcIlxuICB9XG59XG4iLCIvKlxuICpcbiAqL1xuXG5jb25zdCBydGNjb25maWcgPSB7IGljZVNlcnZlcnMgOiBbeyBcInVybFwiIDpcbiAgICBuYXZpZ2F0b3IubW96R2V0VXNlck1lZGlhICAgID8gXCJzdHVuOnN0dW4uc2VydmljZXMubW96aWxsYS5jb21cIiA6XG4gICAgbmF2aWdhdG9yLndlYmtpdEdldFVzZXJNZWRpYSA/IFwic3R1bjpzdHVuLmwuZ29vZ2xlLmNvbToxOTMwMlwiICAgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcInN0dW46MjMuMjEuMTUwLjEyMVwiXG59XG4sICAge3VybDogXCJzdHVuOnN0dW4ubC5nb29nbGUuY29tOjE5MzAyXCJ9XG4sICAge3VybDogXCJzdHVuOnN0dW4xLmwuZ29vZ2xlLmNvbToxOTMwMlwifVxuLCAgIHt1cmw6IFwic3R1bjpzdHVuMi5sLmdvb2dsZS5jb206MTkzMDJcIn1cbiwgICB7dXJsOiBcInN0dW46c3R1bjMubC5nb29nbGUuY29tOjE5MzAyXCJ9XG4sICAge3VybDogXCJzdHVuOnN0dW40LmwuZ29vZ2xlLmNvbToxOTMwMlwifVxuLCAgIHt1cmw6IFwic3R1bjoyMy4yMS4xNTAuMTIxXCJ9XG4sICAge3VybDogXCJzdHVuOnN0dW4wMS5zaXBwaG9uZS5jb21cIn1cbiwgICB7dXJsOiBcInN0dW46c3R1bi5la2lnYS5uZXRcIn1cbiwgICB7dXJsOiBcInN0dW46c3R1bi5md2RuZXQubmV0XCJ9XG4sICAge3VybDogXCJzdHVuOnN0dW4uaWRlYXNpcC5jb21cIn1cbiwgICB7dXJsOiBcInN0dW46c3R1bi5pcHRlbC5vcmdcIn1cbiwgICB7dXJsOiBcInN0dW46c3R1bi5yaXh0ZWxlY29tLnNlXCJ9XG4sICAge3VybDogXCJzdHVuOnN0dW4uc2NobHVuZC5kZVwifVxuLCAgIHt1cmw6IFwic3R1bjpzdHVuc2VydmVyLm9yZ1wifVxuLCAgIHt1cmw6IFwic3R1bjpzdHVuLnNvZnRqb3lzLmNvbVwifVxuLCAgIHt1cmw6IFwic3R1bjpzdHVuLnZvaXBhcm91bmQuY29tXCJ9XG4sICAge3VybDogXCJzdHVuOnN0dW4udm9pcGJ1c3Rlci5jb21cIn1cbiwgICB7dXJsOiBcInN0dW46c3R1bi52b2lwc3R1bnQuY29tXCJ9XG4sICAge3VybDogXCJzdHVuOnN0dW4udm94Z3JhdGlhLm9yZ1wifVxuLCAgIHt1cmw6IFwic3R1bjpzdHVuLnh0ZW4uY29tXCJ9XG5dIH07XG5cbmZ1bmN0aW9uIHV1aWQoKSB7XG4gICAgZnVuY3Rpb24gczQoKSB7XG4gICAgICAgIHJldHVybiBNYXRoLmZsb29yKCgxICsgTWF0aC5yYW5kb20oKSkgKiAweDEwMDAwKVxuICAgICAgICAgICAgLnRvU3RyaW5nKDE2KVxuICAgICAgICAgICAgLnN1YnN0cmluZygxKTtcbiAgICB9XG4gICAgcmV0dXJuIHM0KCkgKyBzNCgpICsgJy0nICsgczQoKSArICctJyArIHM0KCkgKyAnLScgKyBzNCgpICsgJy0nICsgczQoKSArIHM0KCkgKyBzNCgpO1xufVxuXG5mdW5jdGlvbiBvbkluY29taW5nQ2FsbE5vdERlZmluZWQoY2FsbGJhY2spIHtcbiAgICBjb25zb2xlLmVycm9yKCdDaGF0RW5naW5lIFdlYlJUQyBQbHVnaW46IFtvbkluY29taW5nQ2FsbF0gSW5jb21pbmcgY2FsbCBldmVudCBoYW5kbGVyIGlzIG5vdCBkZWZpbmVkLicpO1xuICAgIGNhbGxiYWNrKGZhbHNlKTtcbn1cblxuZnVuY3Rpb24gb25DYWxsUmVzcG9uc2VOb3REZWZpbmVkKCkge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0NoYXRFbmdpbmUgV2ViUlRDIFBsdWdpbjogW29uQ2FsbFJlc3BvbnNlXSBDYWxsIHJlc3BvbnNlIGV2ZW50IGhhbmRsZXIgaXMgbm90IGRlZmluZWQuJyk7XG59XG5cbmZ1bmN0aW9uIG9uQ2FsbERpc2Nvbm5lY3ROb3REZWZpbmVkKCkge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0NoYXRFbmdpbmUgV2ViUlRDIFBsdWdpbjogW29uQ2FsbERpc2Nvbm5lY3RdIENhbGwgZGlzY29ubmVjdCBldmVudCBoYW5kbGVyIGlzIG5vdCBkZWZpbmVkLicpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IChjb25maWcpID0+IHtcbiAgICBjbGFzcyBleHRlbnNpb24ge1xuICAgICAgICBjb25zdHJ1Y3QoKSB7XG4gICAgICAgICAgICAvLyBIb2xkcyBSVENQZWVyQ29ubmVjdGlvbiBvYmplY3RzIGZvciBlYWNoIGNhbGwuIEtleSBpcyB0aGUgY2FsbCBJRCAoYSBVVUlEKS5cbiAgICAgICAgICAgIHRoaXMuY2FsbENhY2hlID0ge307XG5cbiAgICAgICAgICAgIC8vIFtjb25maWcub25JbmNvbWluZ0NhbGxdIG11c3QgYmUgZGVmaW5lZCBvbiBpbml0LCBvdGhlcndpc2UgaW5jb21pbmcgY2FsbCBldmVudCB3aWxsIGxvZyBhbiBlcnJvci5cbiAgICAgICAgICAgIC8vIFRoZSBldmVudCBpcyBtZWFudCB0byB0cmlnZ2VyIFVJIGZvciB0aGUgdXNlciB0byBhY2NlcHQgb3IgcmVqZWN0IGFuIGluY29taW5nIGNhbGwuXG4gICAgICAgICAgICB0aGlzLnBhcmVudE9uSW5jb21pbmdDYWxsID0gY29uZmlnLm9uSW5jb21pbmdDYWxsIHx8IG9uSW5jb21pbmdDYWxsTm90RGVmaW5lZDtcblxuICAgICAgICAgICAgLy8gW2NvbmZpZy5vbkNhbGxSZXNwb25zZV0gbXVzdCBiZSBkZWZpbmVkIG9uIGluaXQsIG90aGVyd2lzZSBjYWxsIHJlc3BvbnNlIGV2ZW50IHdpbGwgbG9nIGFuIGVycm9yLlxuICAgICAgICAgICAgLy8gVGhlIGV2ZW50IGlzIG1lYW50IHRvIGdpdmUgdGhlIHVzZXIgYW4gb3Bwb3J0dW5pdHkgdG8gaGFuZGxlIGEgY2FsbCByZXNwb25zZS5cbiAgICAgICAgICAgIHRoaXMucGFyZW50T25DYWxsUmVzcG9uc2UgPSBjb25maWcub25DYWxsUmVzcG9uc2UgfHwgb25DYWxsUmVzcG9uc2VOb3REZWZpbmVkO1xuXG4gICAgICAgICAgICAvLyBbY29uZmlnLm9uQ2FsbERpc2Nvbm5lY3RdIG11c3QgYmUgZGVmaW5lZCBvbiBpbml0LCBvdGhlcndpc2UgZGlzY29ubmVjdCBjYWxsIGV2ZW50IHdpbGwgbG9nIGFuIGVycm9yLlxuICAgICAgICAgICAgLy8gVGhlIGV2ZW50IGlzIG1lYW50IHRvIG5vdGlmeSB0aGUgdXNlciB0aGF0IHRoZSBjYWxsIGhhcyBlbmRlZCBpbiB0aGUgVUkuXG4gICAgICAgICAgICB0aGlzLnBhcmVudE9uQ2FsbERpc2Nvbm5lY3QgPSBjb25maWcub25DYWxsRGlzY29ubmVjdCB8fCBvbkNhbGxEaXNjb25uZWN0Tm90RGVmaW5lZDtcblxuICAgICAgICAgICAgLy8gVmlkZW8gYW5kIGF1ZGlvIHN0cmVhbSBmcm9tIGxvY2FsIGNsaWVudCBjYW1lcmEgYW5kIG1pY3JvcGhvbmUuXG4gICAgICAgICAgICAvLyBPcHRpb25hbCB0byBwYXNzIG5vdywgY2FuIGJlIHBhc3NlZCBsYXRlciB3aGVuIGEgY2FsbCBpcyBhY2NlcHRlZC5cbiAgICAgICAgICAgIHRoaXMubG9jYWxTdHJlYW0gPSBjb25maWcubG9jYWxTdHJlYW07XG5cbiAgICAgICAgICAgIC8vIENoYXRFbmdpbmUgRGlyZWN0IGV2ZW50IGhhbmRsZXIgZm9yIGluY29taW5nIGNhbGwgcmVxdWVzdHMuXG4gICAgICAgICAgICB0aGlzLkNoYXRFbmdpbmUubWUuZGlyZWN0Lm9uKFsnJCcgKyAnd2ViUlRDJywgJ2luY29taW5nQ2FsbCddLmpvaW4oJy4nKSwgKHBheWxvYWQpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLmluY29taW5nQ2FsbChwYXlsb2FkKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBDaGF0RW5naW5lIERpcmVjdCBldmVudCBoYW5kbGVyIGZvciBjYWxsIHJlc3BvbnNlcy5cbiAgICAgICAgICAgIHRoaXMuQ2hhdEVuZ2luZS5tZS5kaXJlY3Qub24oWyckJyArICd3ZWJSVEMnLCAnY2FsbFJlc3BvbnNlJ10uam9pbignLicpLCAocGF5bG9hZCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuY2FsbFJlc3BvbnNlKHBheWxvYWQpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIENoYXRFbmdpbmUgRGlyZWN0IGV2ZW50IGhhbmRsZXIgZm9yIG5ldyBJQ0UgY2FuZGlkYXRlcyBmb3IgUlRDUGVlckNvbm5lY3Rpb24gb2JqZWN0LlxuICAgICAgICAgICAgLy8gV2ViUlRDIGNsaWVudCB0ZWxscyB0aGUgcmVtb3RlIGNsaWVudCB0aGVpciBJQ0UgY2FuZGlkYXRlcyB0aHJvdWdoIHRoaXMgc2lnbmFsLlxuICAgICAgICAgICAgdGhpcy5DaGF0RW5naW5lLm1lLmRpcmVjdC5vbihbJyQnICsgJ3dlYlJUQycsICdpbmNvbWluZ0ljZUNhbmRpZGF0ZSddLmpvaW4oJy4nKSwgKHBheWxvYWQpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLmluY29taW5nSWNlQ2FuZGlkYXRlKHBheWxvYWQpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBjYWxsVXNlcih1c2VyLCBvblJlbW90ZVZpZGVvU3RyZWFtQXZhaWxhYmxlLCBsb2NhbFN0cmVhbSkge1xuICAgICAgICAgICAgaWYgKHVzZXIubmFtZSA9PT0gJ01lJykge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0NoYXRFbmdpbmUgV2ViUlRDIFBsdWdpbjogW2NhbGxVc2VyXSBDYWxsaW5nIHNlbGYgaXMgbm90IGFsbG93ZWQuJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBJZiB0aGUgbG9jYWwgc3RyZWFtIGlzIG5vdCBwYXNzZWQgb24gcGx1Z2luIGluaXQsIGl0IGNhbiBiZSBwYXNzZWQgaGVyZS5cbiAgICAgICAgICAgIGxvY2FsU3RyZWFtID0gbG9jYWxTdHJlYW0gfHwgdGhpcy5sb2NhbFN0cmVhbTtcbiAgICAgICAgICAgIGxldCBjYWxsSWQgPSB1dWlkKCk7XG4gICAgICAgICAgICBsZXQgbG9jYWxEZXNjcmlwdGlvbjsgLy8gV2ViUlRDIGxvY2FsIGRlc2NyaXB0aW9uXG4gICAgICAgICAgICBsZXQgcGVlckNvbm5lY3Rpb24gPSBuZXcgUlRDUGVlckNvbm5lY3Rpb24ocnRjY29uZmlnKTtcbiAgICAgICAgICAgIHRoaXMuY2FsbENhY2hlW2NhbGxJZF0gPSBwZWVyQ29ubmVjdGlvbjtcbiAgICAgICAgICAgIHBlZXJDb25uZWN0aW9uLm9uaWNlY29ubmVjdGlvbnN0YXRlY2hhbmdlID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChwZWVyQ29ubmVjdGlvbi5pY2VDb25uZWN0aW9uU3RhdGUgPT09ICdkaXNjb25uZWN0ZWQnKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMub25EaXNjb25uZWN0KGNhbGxJZCwgdXNlci51dWlkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvLyBTZXQgbG9jYWwgYW5kIHJlbW90ZSB2aWRlbyBhbmQgYXVkaW8gc3RyZWFtcyB0byBwZWVyIGNvbm5lY3Rpb24gb2JqZWN0LlxuICAgICAgICAgICAgcGVlckNvbm5lY3Rpb24ub250cmFjayA9IG9uUmVtb3RlVmlkZW9TdHJlYW1BdmFpbGFibGU7XG5cbiAgICAgICAgICAgIGlmIChsb2NhbFN0cmVhbSkge1xuICAgICAgICAgICAgICAgIGxvY2FsU3RyZWFtLmdldFRyYWNrcygpLmZvckVhY2goKHRyYWNrKSA9PiBwZWVyQ29ubmVjdGlvbi5hZGRUcmFjayh0cmFjaywgbG9jYWxTdHJlYW0pKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcGVlckNvbm5lY3Rpb24uY3JlYXRlT2ZmZXIoKVxuICAgICAgICAgICAgLnRoZW4oKGRlc2NyaXB0aW9uKSA9PiB7XG4gICAgICAgICAgICAgICAgbG9jYWxEZXNjcmlwdGlvbiA9IGRlc2NyaXB0aW9uO1xuICAgICAgICAgICAgICAgIHJldHVybiBwZWVyQ29ubmVjdGlvbi5zZXRMb2NhbERlc2NyaXB0aW9uKGxvY2FsRGVzY3JpcHRpb24pO1xuICAgICAgICAgICAgfSkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgdXNlci5kaXJlY3QuZW1pdChbJyQnICsgJ3dlYlJUQycsICdpbmNvbWluZ0NhbGwnXS5qb2luKCcuJyksIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbElkLFxuICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogbG9jYWxEZXNjcmlwdGlvblxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSkuY2F0Y2goKGVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignQ2hhdEVuZ2luZSBXZWJSVEMgUGx1Z2luOiBbY2FsbFVzZXJdJywgZXJyb3IpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBjYWxsUmVzcG9uc2UocGF5bG9hZCkge1xuICAgICAgICAgICAgY29uc3Qge2NhbGxJZCwgYWNjZXB0Q2FsbCwgZGVzY3JpcHRpb259ID0gcGF5bG9hZC5kYXRhO1xuICAgICAgICAgICAgbGV0IHNlbmRlciA9IHBheWxvYWQuc2VuZGVyO1xuXG4gICAgICAgICAgICBpZiAoYWNjZXB0Q2FsbCkge1xuICAgICAgICAgICAgICAgIC8vIFdoZW4gSUNFIGNhbmRpZGF0ZXMgYmVjb21lIGF2YWlsYWJsZSwgc2VuZCB0aGVtIHRvIHRoZSByZW1vdGUgY2xpZW50LlxuICAgICAgICAgICAgICAgIHRoaXMuY2FsbENhY2hlW2NhbGxJZF0ub25pY2VjYW5kaWRhdGUgPSAoaWNlRXZlbnQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGljZUV2ZW50LmNhbmRpZGF0ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VuZGVyLmRpcmVjdC5lbWl0KFsnJCcgKyAnd2ViUlRDJywgJ2luY29taW5nSWNlQ2FuZGlkYXRlJ10uam9pbignLicpLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbElkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbmRpZGF0ZTogaWNlRXZlbnQuY2FuZGlkYXRlXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICAvLyBXaGVuIGEgdXNlciBhY2NlcHRzIGEgY2FsbCwgdGhleSBzZW5kIHRoZWlyIFdlYlJUQyBwZWVyIGNvbm5lY3Rpb24gZGVzY3JpcHRpb24uXG4gICAgICAgICAgICAgICAgLy8gU2V0IGl0IGxvY2FsbHkgYXMgdGhlIHJlbW90ZSBjbGllbnQncyBwZWVyIGNvbm5lY3Rpb24gZGVzY3JpcHRpb24uXG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsQ2FjaGVbY2FsbElkXS5zZXRSZW1vdGVEZXNjcmlwdGlvbihkZXNjcmlwdGlvbilcbiAgICAgICAgICAgICAgICAuY2F0Y2goKGVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0NoYXRFbmdpbmUgV2ViUlRDIFBsdWdpbjogW2NhbGxSZXNwb25zZV0nLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMucGFyZW50T25DYWxsUmVzcG9uc2Uoc2VuZGVyLnV1aWQsIGFjY2VwdENhbGwpO1xuICAgICAgICB9XG5cbiAgICAgICAgaW5jb21pbmdDYWxsKHBheWxvYWQpIHtcbiAgICAgICAgICAgIGNvbnN0IHNlbmRlciA9IHBheWxvYWQuc2VuZGVyO1xuICAgICAgICAgICAgY29uc3QgeyBjYWxsSWQgfSA9IHBheWxvYWQuZGF0YTtcbiAgICAgICAgICAgIGNvbnN0IHJlbW90ZURlc2NyaXB0aW9uID0gcGF5bG9hZC5kYXRhLmRlc2NyaXB0aW9uO1xuXG4gICAgICAgICAgICAvLyBTaG91bGQgYmUgZXhlY3V0ZWQgYWZ0ZXIgdGhpcyBjbGllbnQgYWNjZXB0cyBvciByZWplY3RzIGFuIGluY29taW5nIGNhbGwuXG4gICAgICAgICAgICBjb25zdCBjYWxsUmVzcG9uc2VDYWxsYmFjayA9IChhY2NlcHRDYWxsLCBvblJlbW90ZVZpZGVvU3RyZWFtQXZhaWxhYmxlLCBsb2NhbFN0cmVhbSkgPT4ge1xuICAgICAgICAgICAgICAgIGxvY2FsU3RyZWFtID0gbG9jYWxTdHJlYW0gfHwgdGhpcy5sb2NhbFN0cmVhbTtcblxuICAgICAgICAgICAgICAgIGlmIChhY2NlcHRDYWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2Ygb25SZW1vdGVWaWRlb1N0cmVhbUF2YWlsYWJsZSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignQ2hhdEVuZ2luZSBXZWJSVEMgUGx1Z2luOiBbaW5jb21pbmdDYWxsXSBvblJlbW90ZVZpZGVvU3RyZWFtQXZhaWxhYmxlIGhhbmRsZXIgaXMgbm90IGRlZmluZWQuJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGxvY2FsU3RyZWFtICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignQ2hhdEVuZ2luZSBXZWJSVEMgUGx1Z2luOiBMb2NhbCB2aWRlbyBzdHJlYW0gb2JqZWN0IGlzIG5vdCBkZWZpbmVkLicpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgbGV0IGFuc3dlckRlc2NyaXB0aW9uO1xuICAgICAgICAgICAgICAgICAgICBsZXQgcGVlckNvbm5lY3Rpb24gPSBuZXcgUlRDUGVlckNvbm5lY3Rpb24ocnRjY29uZmlnKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jYWxsQ2FjaGVbY2FsbElkXSA9IHBlZXJDb25uZWN0aW9uO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIFdoZW4gSUNFIGNhbmRpZGF0ZXMgYmVjb21lIGF2YWlsYWJsZSwgc2VuZCB0aGVtIHRvIHRoZSByZW1vdGUgY2xpZW50XG4gICAgICAgICAgICAgICAgICAgIHBlZXJDb25uZWN0aW9uLm9uaWNlY2FuZGlkYXRlID0gKGljZUV2ZW50KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaWNlRXZlbnQuY2FuZGlkYXRlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VuZGVyLmRpcmVjdC5lbWl0KFsnJCcgKyAnd2ViUlRDJywgJ2luY29taW5nSWNlQ2FuZGlkYXRlJ10uam9pbignLicpLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FuZGlkYXRlOiBpY2VFdmVudC5jYW5kaWRhdGVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgICAgICBwZWVyQ29ubmVjdGlvbi5vbmljZWNvbm5lY3Rpb25zdGF0ZWNoYW5nZSA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwZWVyQ29ubmVjdGlvbi5pY2VDb25uZWN0aW9uU3RhdGUgPT09ICdkaXNjb25uZWN0ZWQnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5vbkRpc2Nvbm5lY3QoY2FsbElkLCBzZW5kZXIudXVpZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICAgICAgbG9jYWxTdHJlYW0uZ2V0VHJhY2tzKCkuZm9yRWFjaCgodHJhY2spID0+IHBlZXJDb25uZWN0aW9uLmFkZFRyYWNrKHRyYWNrLCBsb2NhbFN0cmVhbSkpO1xuXG4gICAgICAgICAgICAgICAgICAgIHBlZXJDb25uZWN0aW9uLm9udHJhY2sgPSBvblJlbW90ZVZpZGVvU3RyZWFtQXZhaWxhYmxlO1xuICAgICAgICAgICAgICAgICAgICBwZWVyQ29ubmVjdGlvbi5zZXRSZW1vdGVEZXNjcmlwdGlvbihyZW1vdGVEZXNjcmlwdGlvbilcbiAgICAgICAgICAgICAgICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHBlZXJDb25uZWN0aW9uLmNyZWF0ZUFuc3dlcigpO1xuICAgICAgICAgICAgICAgICAgICB9KS50aGVuKChhbnN3ZXIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFuc3dlckRlc2NyaXB0aW9uID0gYW5zd2VyO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHBlZXJDb25uZWN0aW9uLnNldExvY2FsRGVzY3JpcHRpb24oYW5zd2VyRGVzY3JpcHRpb24pO1xuICAgICAgICAgICAgICAgICAgICB9KS50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbmRlci5kaXJlY3QuZW1pdChbJyQnICsgJ3dlYlJUQycsICdjYWxsUmVzcG9uc2UnXS5qb2luKCcuJyksIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsSWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYWNjZXB0Q2FsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogYW5zd2VyRGVzY3JpcHRpb25cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9KS5jYXRjaCgoZXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0NoYXRFbmdpbmUgV2ViUlRDIFBsdWdpbjogW2luY29taW5nQ2FsbF0nLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbmRlci5kaXJlY3QuZW1pdChbJyQnICsgJ3dlYlJUQycsICdjYWxsUmVzcG9uc2UnXS5qb2luKCcuJyksIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGFjY2VwdENhbGxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnBhcmVudE9uSW5jb21pbmdDYWxsKHNlbmRlci51dWlkLCBjYWxsUmVzcG9uc2VDYWxsYmFjayk7XG4gICAgICAgIH1cblxuICAgICAgICBpbmNvbWluZ0ljZUNhbmRpZGF0ZShwYXlsb2FkKSB7XG4gICAgICAgICAgICBjb25zdCB7IGNhbGxJZCwgY2FuZGlkYXRlIH0gPSBwYXlsb2FkLmRhdGE7XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5jYWxsQ2FjaGVbY2FsbElkXSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5jYWxsQ2FjaGVbY2FsbElkXS5hZGRJY2VDYW5kaWRhdGUoY2FuZGlkYXRlKVxuICAgICAgICAgICAgLmNhdGNoKChlcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0NoYXRFbmdpbmUgV2ViUlRDIFBsdWdpbjogW2luY29taW5nSWNlQ2FuZGlkYXRlXScsIGVycm9yKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgb25EaXNjb25uZWN0KGNhbGxJZCwgdXNlclV1aWQpIHtcbiAgICAgICAgICAgIHRoaXMuY2FsbENhY2hlW2NhbGxJZF0uY2xvc2UoKTtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLmNhbGxDYWNoZVtjYWxsSWRdO1xuICAgICAgICAgICAgdGhpcy5wYXJlbnRPbkNhbGxEaXNjb25uZWN0KHVzZXJVdWlkKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGxldCBlbWl0ID0ge307XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBuYW1lc3BhY2U6ICd3ZWJSVEMnLFxuICAgICAgICBleHRlbmRzOiB7XG4gICAgICAgICAgICBDaGF0OiBleHRlbnNpb25cbiAgICAgICAgfSxcbiAgICAgICAgbWlkZGxld2FyZToge31cbiAgICB9XG59O1xuIl19

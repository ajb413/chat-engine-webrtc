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

const rtcconfig = { iceServers : [{ "urls" :
    navigator.mozGetUserMedia    ? "stun:stun.services.mozilla.com" :
    navigator.webkitGetUserMedia ? "stun:stun.l.google.com:19302"   :
                                   "stun:23.21.150.121"
},
    {urls: "stun:stun.l.google.com:19302"},
    {urls: "stun:stun1.l.google.com:19302"},
    {urls: "stun:stun2.l.google.com:19302"},
    {urls: "stun:stun3.l.google.com:19302"},
    {urls: "stun:stun4.l.google.com:19302"},
    {urls: "stun:23.21.150.121"},
    {urls: "stun:stun01.sipphone.com"},
    {urls: "stun:stun.ekiga.net"},
    {urls: "stun:stun.fwdnet.net"},
    {urls: "stun:stun.ideasip.com"},
    {urls: "stun:stun.iptel.org"},
    {urls: "stun:stun.rixtelecom.se"},
    {urls: "stun:stun.schlund.de"},
    {urls: "stun:stunserver.org"},
    {urls: "stun:stun.softjoys.com"},
    {urls: "stun:stun.voiparound.com"},
    {urls: "stun:stun.voipbuster.com"},
    {urls: "stun:stun.voipstunt.com"},
    {urls: "stun:stun.voxgratia.org"},
    {urls: "stun:stun.xten.com"}
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
            let peerConnection = new RTCPeerConnection(rtcconfig);
            this.callCache[callId] = peerConnection;

            peerConnection.oniceconnectionstatechange = () => {
                if (peerConnection.iceConnectionState === 'disconnected') {
                    this.onDisconnect(callId, user.uuid);
                }
            };

            // Set local and remote video and audio streams to peer connection object.
            peerConnection.ontrack = onRemoteVideoStreamAvailable;
            peerConnection.addStream(localStream);

            // When ICE candidates become available, send them to the remote client.
            peerConnection.onicecandidate = (iceEvent) => {
                if (iceEvent.candidate) {
                    user.direct.emit(['$' + 'webRTC', 'incomingIceCandidate'].join('.'), {
                        callId,
                        candidate: iceEvent.candidate
                    });
                }
            };

            let localDescription; // WebRTC local description
            peerConnection.onnegotiationneeded = (one, two, three) => {
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

                    peerConnection.ontrack = onRemoteVideoStreamAvailable;
                    peerConnection.setRemoteDescription(remoteDescription)
                    .then(() => {
                        return peerConnection.addStream(localStream);
                    }).then(() => {
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

            console.log('incomingIceCandidate', candidate.sdpMid, candidate.candidate, );

            if (!this.callCache[callId] || typeof candidate !== 'object') {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy5udm0vdmVyc2lvbnMvbm9kZS92OC4xMS4yL2xpYi9ub2RlX21vZHVsZXMvY2hhdC1lbmdpbmUtcGx1Z2luL25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIudG1wL3dyYXAuanMiLCJwYWNrYWdlLmpzb24iLCJzcmMvcGx1Z2luLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsIihmdW5jdGlvbigpIHtcblxuICAgIGNvbnN0IHBhY2thZ2UgPSByZXF1aXJlKCcuLi9wYWNrYWdlLmpzb24nKTtcbiAgICB3aW5kb3cuQ2hhdEVuZ2luZUNvcmUucGx1Z2luW3BhY2thZ2UubmFtZV0gPSByZXF1aXJlKCcuLi9zcmMvcGx1Z2luLmpzJyk7XG5cbn0pKCk7XG4iLCJtb2R1bGUuZXhwb3J0cz17XG4gIFwiYXV0aG9yXCI6IFwiQWRhbSBCYXZvc2FcIixcbiAgXCJuYW1lXCI6IFwiY2hhdC1lbmdpbmUtd2VicnRjXCIsXG4gIFwidmVyc2lvblwiOiBcIjAuMC4xXCIsXG4gIFwibWFpblwiOiBcInNyYy9wbHVnaW4uanNcIixcbiAgXCJkZXBlbmRlbmNpZXNcIjoge1xuICAgIFwiY2hhdC1lbmdpbmVcIjogXCJeMC45LjE4XCJcbiAgfVxufVxuIiwiLypcbiAqXG4gKi9cblxuY29uc3QgcnRjY29uZmlnID0geyBpY2VTZXJ2ZXJzIDogW3sgXCJ1cmxzXCIgOlxuICAgIG5hdmlnYXRvci5tb3pHZXRVc2VyTWVkaWEgICAgPyBcInN0dW46c3R1bi5zZXJ2aWNlcy5tb3ppbGxhLmNvbVwiIDpcbiAgICBuYXZpZ2F0b3Iud2Via2l0R2V0VXNlck1lZGlhID8gXCJzdHVuOnN0dW4ubC5nb29nbGUuY29tOjE5MzAyXCIgICA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwic3R1bjoyMy4yMS4xNTAuMTIxXCJcbn0sXG4gICAge3VybHM6IFwic3R1bjpzdHVuLmwuZ29vZ2xlLmNvbToxOTMwMlwifSxcbiAgICB7dXJsczogXCJzdHVuOnN0dW4xLmwuZ29vZ2xlLmNvbToxOTMwMlwifSxcbiAgICB7dXJsczogXCJzdHVuOnN0dW4yLmwuZ29vZ2xlLmNvbToxOTMwMlwifSxcbiAgICB7dXJsczogXCJzdHVuOnN0dW4zLmwuZ29vZ2xlLmNvbToxOTMwMlwifSxcbiAgICB7dXJsczogXCJzdHVuOnN0dW40LmwuZ29vZ2xlLmNvbToxOTMwMlwifSxcbiAgICB7dXJsczogXCJzdHVuOjIzLjIxLjE1MC4xMjFcIn0sXG4gICAge3VybHM6IFwic3R1bjpzdHVuMDEuc2lwcGhvbmUuY29tXCJ9LFxuICAgIHt1cmxzOiBcInN0dW46c3R1bi5la2lnYS5uZXRcIn0sXG4gICAge3VybHM6IFwic3R1bjpzdHVuLmZ3ZG5ldC5uZXRcIn0sXG4gICAge3VybHM6IFwic3R1bjpzdHVuLmlkZWFzaXAuY29tXCJ9LFxuICAgIHt1cmxzOiBcInN0dW46c3R1bi5pcHRlbC5vcmdcIn0sXG4gICAge3VybHM6IFwic3R1bjpzdHVuLnJpeHRlbGVjb20uc2VcIn0sXG4gICAge3VybHM6IFwic3R1bjpzdHVuLnNjaGx1bmQuZGVcIn0sXG4gICAge3VybHM6IFwic3R1bjpzdHVuc2VydmVyLm9yZ1wifSxcbiAgICB7dXJsczogXCJzdHVuOnN0dW4uc29mdGpveXMuY29tXCJ9LFxuICAgIHt1cmxzOiBcInN0dW46c3R1bi52b2lwYXJvdW5kLmNvbVwifSxcbiAgICB7dXJsczogXCJzdHVuOnN0dW4udm9pcGJ1c3Rlci5jb21cIn0sXG4gICAge3VybHM6IFwic3R1bjpzdHVuLnZvaXBzdHVudC5jb21cIn0sXG4gICAge3VybHM6IFwic3R1bjpzdHVuLnZveGdyYXRpYS5vcmdcIn0sXG4gICAge3VybHM6IFwic3R1bjpzdHVuLnh0ZW4uY29tXCJ9XG5dIH07XG5cbmZ1bmN0aW9uIHV1aWQoKSB7XG4gICAgZnVuY3Rpb24gczQoKSB7XG4gICAgICAgIHJldHVybiBNYXRoLmZsb29yKCgxICsgTWF0aC5yYW5kb20oKSkgKiAweDEwMDAwKVxuICAgICAgICAgICAgLnRvU3RyaW5nKDE2KVxuICAgICAgICAgICAgLnN1YnN0cmluZygxKTtcbiAgICB9XG4gICAgcmV0dXJuIHM0KCkgKyBzNCgpICsgJy0nICsgczQoKSArICctJyArIHM0KCkgKyAnLScgKyBzNCgpICsgJy0nICsgczQoKSArIHM0KCkgKyBzNCgpO1xufVxuXG5mdW5jdGlvbiBvbkluY29taW5nQ2FsbE5vdERlZmluZWQoY2FsbGJhY2spIHtcbiAgICBjb25zb2xlLmVycm9yKCdDaGF0RW5naW5lIFdlYlJUQyBQbHVnaW46IFtvbkluY29taW5nQ2FsbF0gSW5jb21pbmcgY2FsbCBldmVudCBoYW5kbGVyIGlzIG5vdCBkZWZpbmVkLicpO1xuICAgIGNhbGxiYWNrKGZhbHNlKTtcbn1cblxuZnVuY3Rpb24gb25DYWxsUmVzcG9uc2VOb3REZWZpbmVkKCkge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0NoYXRFbmdpbmUgV2ViUlRDIFBsdWdpbjogW29uQ2FsbFJlc3BvbnNlXSBDYWxsIHJlc3BvbnNlIGV2ZW50IGhhbmRsZXIgaXMgbm90IGRlZmluZWQuJyk7XG59XG5cbmZ1bmN0aW9uIG9uQ2FsbERpc2Nvbm5lY3ROb3REZWZpbmVkKCkge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0NoYXRFbmdpbmUgV2ViUlRDIFBsdWdpbjogW29uQ2FsbERpc2Nvbm5lY3RdIENhbGwgZGlzY29ubmVjdCBldmVudCBoYW5kbGVyIGlzIG5vdCBkZWZpbmVkLicpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IChjb25maWcpID0+IHtcbiAgICBjbGFzcyBleHRlbnNpb24ge1xuICAgICAgICBjb25zdHJ1Y3QoKSB7XG4gICAgICAgICAgICAvLyBIb2xkcyBSVENQZWVyQ29ubmVjdGlvbiBvYmplY3RzIGZvciBlYWNoIGNhbGwuIEtleSBpcyB0aGUgY2FsbCBJRCAoYSBVVUlEKS5cbiAgICAgICAgICAgIHRoaXMuY2FsbENhY2hlID0ge307XG5cbiAgICAgICAgICAgIC8vIFtjb25maWcub25JbmNvbWluZ0NhbGxdIG11c3QgYmUgZGVmaW5lZCBvbiBpbml0LCBvdGhlcndpc2UgaW5jb21pbmcgY2FsbCBldmVudCB3aWxsIGxvZyBhbiBlcnJvci5cbiAgICAgICAgICAgIC8vIFRoZSBldmVudCBpcyBtZWFudCB0byB0cmlnZ2VyIFVJIGZvciB0aGUgdXNlciB0byBhY2NlcHQgb3IgcmVqZWN0IGFuIGluY29taW5nIGNhbGwuXG4gICAgICAgICAgICB0aGlzLnBhcmVudE9uSW5jb21pbmdDYWxsID0gY29uZmlnLm9uSW5jb21pbmdDYWxsIHx8IG9uSW5jb21pbmdDYWxsTm90RGVmaW5lZDtcblxuICAgICAgICAgICAgLy8gW2NvbmZpZy5vbkNhbGxSZXNwb25zZV0gbXVzdCBiZSBkZWZpbmVkIG9uIGluaXQsIG90aGVyd2lzZSBjYWxsIHJlc3BvbnNlIGV2ZW50IHdpbGwgbG9nIGFuIGVycm9yLlxuICAgICAgICAgICAgLy8gVGhlIGV2ZW50IGlzIG1lYW50IHRvIGdpdmUgdGhlIHVzZXIgYW4gb3Bwb3J0dW5pdHkgdG8gaGFuZGxlIGEgY2FsbCByZXNwb25zZS5cbiAgICAgICAgICAgIHRoaXMucGFyZW50T25DYWxsUmVzcG9uc2UgPSBjb25maWcub25DYWxsUmVzcG9uc2UgfHwgb25DYWxsUmVzcG9uc2VOb3REZWZpbmVkO1xuXG4gICAgICAgICAgICAvLyBbY29uZmlnLm9uQ2FsbERpc2Nvbm5lY3RdIG11c3QgYmUgZGVmaW5lZCBvbiBpbml0LCBvdGhlcndpc2UgZGlzY29ubmVjdCBjYWxsIGV2ZW50IHdpbGwgbG9nIGFuIGVycm9yLlxuICAgICAgICAgICAgLy8gVGhlIGV2ZW50IGlzIG1lYW50IHRvIG5vdGlmeSB0aGUgdXNlciB0aGF0IHRoZSBjYWxsIGhhcyBlbmRlZCBpbiB0aGUgVUkuXG4gICAgICAgICAgICB0aGlzLnBhcmVudE9uQ2FsbERpc2Nvbm5lY3QgPSBjb25maWcub25DYWxsRGlzY29ubmVjdCB8fCBvbkNhbGxEaXNjb25uZWN0Tm90RGVmaW5lZDtcblxuICAgICAgICAgICAgLy8gVmlkZW8gYW5kIGF1ZGlvIHN0cmVhbSBmcm9tIGxvY2FsIGNsaWVudCBjYW1lcmEgYW5kIG1pY3JvcGhvbmUuXG4gICAgICAgICAgICAvLyBPcHRpb25hbCB0byBwYXNzIG5vdywgY2FuIGJlIHBhc3NlZCBsYXRlciB3aGVuIGEgY2FsbCBpcyBhY2NlcHRlZC5cbiAgICAgICAgICAgIHRoaXMubG9jYWxTdHJlYW0gPSBjb25maWcubG9jYWxTdHJlYW07XG5cbiAgICAgICAgICAgIC8vIENoYXRFbmdpbmUgRGlyZWN0IGV2ZW50IGhhbmRsZXIgZm9yIGluY29taW5nIGNhbGwgcmVxdWVzdHMuXG4gICAgICAgICAgICB0aGlzLkNoYXRFbmdpbmUubWUuZGlyZWN0Lm9uKFsnJCcgKyAnd2ViUlRDJywgJ2luY29taW5nQ2FsbCddLmpvaW4oJy4nKSwgKHBheWxvYWQpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLmluY29taW5nQ2FsbChwYXlsb2FkKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBDaGF0RW5naW5lIERpcmVjdCBldmVudCBoYW5kbGVyIGZvciBjYWxsIHJlc3BvbnNlcy5cbiAgICAgICAgICAgIHRoaXMuQ2hhdEVuZ2luZS5tZS5kaXJlY3Qub24oWyckJyArICd3ZWJSVEMnLCAnY2FsbFJlc3BvbnNlJ10uam9pbignLicpLCAocGF5bG9hZCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuY2FsbFJlc3BvbnNlKHBheWxvYWQpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIENoYXRFbmdpbmUgRGlyZWN0IGV2ZW50IGhhbmRsZXIgZm9yIG5ldyBJQ0UgY2FuZGlkYXRlcyBmb3IgUlRDUGVlckNvbm5lY3Rpb24gb2JqZWN0LlxuICAgICAgICAgICAgLy8gV2ViUlRDIGNsaWVudCB0ZWxscyB0aGUgcmVtb3RlIGNsaWVudCB0aGVpciBJQ0UgY2FuZGlkYXRlcyB0aHJvdWdoIHRoaXMgc2lnbmFsLlxuICAgICAgICAgICAgdGhpcy5DaGF0RW5naW5lLm1lLmRpcmVjdC5vbihbJyQnICsgJ3dlYlJUQycsICdpbmNvbWluZ0ljZUNhbmRpZGF0ZSddLmpvaW4oJy4nKSwgKHBheWxvYWQpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLmluY29taW5nSWNlQ2FuZGlkYXRlKHBheWxvYWQpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBjYWxsVXNlcih1c2VyLCBvblJlbW90ZVZpZGVvU3RyZWFtQXZhaWxhYmxlLCBsb2NhbFN0cmVhbSkge1xuICAgICAgICAgICAgaWYgKHVzZXIubmFtZSA9PT0gJ01lJykge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0NoYXRFbmdpbmUgV2ViUlRDIFBsdWdpbjogW2NhbGxVc2VyXSBDYWxsaW5nIHNlbGYgaXMgbm90IGFsbG93ZWQuJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBJZiB0aGUgbG9jYWwgc3RyZWFtIGlzIG5vdCBwYXNzZWQgb24gcGx1Z2luIGluaXQsIGl0IGNhbiBiZSBwYXNzZWQgaGVyZS5cbiAgICAgICAgICAgIGxvY2FsU3RyZWFtID0gbG9jYWxTdHJlYW0gfHwgdGhpcy5sb2NhbFN0cmVhbTtcbiAgICAgICAgICAgIGxldCBjYWxsSWQgPSB1dWlkKCk7XG4gICAgICAgICAgICBsZXQgcGVlckNvbm5lY3Rpb24gPSBuZXcgUlRDUGVlckNvbm5lY3Rpb24ocnRjY29uZmlnKTtcbiAgICAgICAgICAgIHRoaXMuY2FsbENhY2hlW2NhbGxJZF0gPSBwZWVyQ29ubmVjdGlvbjtcblxuICAgICAgICAgICAgcGVlckNvbm5lY3Rpb24ub25pY2Vjb25uZWN0aW9uc3RhdGVjaGFuZ2UgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHBlZXJDb25uZWN0aW9uLmljZUNvbm5lY3Rpb25TdGF0ZSA9PT0gJ2Rpc2Nvbm5lY3RlZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5vbkRpc2Nvbm5lY3QoY2FsbElkLCB1c2VyLnV1aWQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIC8vIFNldCBsb2NhbCBhbmQgcmVtb3RlIHZpZGVvIGFuZCBhdWRpbyBzdHJlYW1zIHRvIHBlZXIgY29ubmVjdGlvbiBvYmplY3QuXG4gICAgICAgICAgICBwZWVyQ29ubmVjdGlvbi5vbnRyYWNrID0gb25SZW1vdGVWaWRlb1N0cmVhbUF2YWlsYWJsZTtcbiAgICAgICAgICAgIHBlZXJDb25uZWN0aW9uLmFkZFN0cmVhbShsb2NhbFN0cmVhbSk7XG5cbiAgICAgICAgICAgIC8vIFdoZW4gSUNFIGNhbmRpZGF0ZXMgYmVjb21lIGF2YWlsYWJsZSwgc2VuZCB0aGVtIHRvIHRoZSByZW1vdGUgY2xpZW50LlxuICAgICAgICAgICAgcGVlckNvbm5lY3Rpb24ub25pY2VjYW5kaWRhdGUgPSAoaWNlRXZlbnQpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoaWNlRXZlbnQuY2FuZGlkYXRlKSB7XG4gICAgICAgICAgICAgICAgICAgIHVzZXIuZGlyZWN0LmVtaXQoWyckJyArICd3ZWJSVEMnLCAnaW5jb21pbmdJY2VDYW5kaWRhdGUnXS5qb2luKCcuJyksIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbmRpZGF0ZTogaWNlRXZlbnQuY2FuZGlkYXRlXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGxldCBsb2NhbERlc2NyaXB0aW9uOyAvLyBXZWJSVEMgbG9jYWwgZGVzY3JpcHRpb25cbiAgICAgICAgICAgIHBlZXJDb25uZWN0aW9uLm9ubmVnb3RpYXRpb25uZWVkZWQgPSAob25lLCB0d28sIHRocmVlKSA9PiB7XG4gICAgICAgICAgICAgICAgcGVlckNvbm5lY3Rpb24uY3JlYXRlT2ZmZXIoKVxuICAgICAgICAgICAgICAgIC50aGVuKChkZXNjcmlwdGlvbikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBsb2NhbERlc2NyaXB0aW9uID0gZGVzY3JpcHRpb247XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBwZWVyQ29ubmVjdGlvbi5zZXRMb2NhbERlc2NyaXB0aW9uKGxvY2FsRGVzY3JpcHRpb24pO1xuICAgICAgICAgICAgICAgIH0pLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB1c2VyLmRpcmVjdC5lbWl0KFsnJCcgKyAnd2ViUlRDJywgJ2luY29taW5nQ2FsbCddLmpvaW4oJy4nKSwge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbElkLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGxvY2FsRGVzY3JpcHRpb25cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSkuY2F0Y2goKGVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0NoYXRFbmdpbmUgV2ViUlRDIFBsdWdpbjogW2NhbGxVc2VyXScsIGVycm9yKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBjYWxsUmVzcG9uc2UocGF5bG9hZCkge1xuICAgICAgICAgICAgY29uc3Qge2NhbGxJZCwgYWNjZXB0Q2FsbCwgZGVzY3JpcHRpb259ID0gcGF5bG9hZC5kYXRhO1xuICAgICAgICAgICAgbGV0IHNlbmRlciA9IHBheWxvYWQuc2VuZGVyO1xuXG4gICAgICAgICAgICBpZiAoYWNjZXB0Q2FsbCkge1xuICAgICAgICAgICAgICAgIC8vIFdoZW4gYSB1c2VyIGFjY2VwdHMgYSBjYWxsLCB0aGV5IHNlbmQgdGhlaXIgV2ViUlRDIHBlZXIgY29ubmVjdGlvbiBkZXNjcmlwdGlvbi5cbiAgICAgICAgICAgICAgICAvLyBTZXQgaXQgbG9jYWxseSBhcyB0aGUgcmVtb3RlIGNsaWVudCdzIHBlZXIgY29ubmVjdGlvbiBkZXNjcmlwdGlvbi5cbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxDYWNoZVtjYWxsSWRdLnNldFJlbW90ZURlc2NyaXB0aW9uKGRlc2NyaXB0aW9uKVxuICAgICAgICAgICAgICAgIC5jYXRjaCgoZXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignQ2hhdEVuZ2luZSBXZWJSVEMgUGx1Z2luOiBbY2FsbFJlc3BvbnNlXScsIGVycm9yKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5wYXJlbnRPbkNhbGxSZXNwb25zZShzZW5kZXIudXVpZCwgYWNjZXB0Q2FsbCk7XG4gICAgICAgIH1cblxuICAgICAgICBpbmNvbWluZ0NhbGwocGF5bG9hZCkge1xuICAgICAgICAgICAgY29uc3Qgc2VuZGVyID0gcGF5bG9hZC5zZW5kZXI7XG4gICAgICAgICAgICBjb25zdCB7IGNhbGxJZCB9ID0gcGF5bG9hZC5kYXRhO1xuICAgICAgICAgICAgY29uc3QgcmVtb3RlRGVzY3JpcHRpb24gPSBwYXlsb2FkLmRhdGEuZGVzY3JpcHRpb247XG5cbiAgICAgICAgICAgIC8vIFNob3VsZCBiZSBleGVjdXRlZCBhZnRlciB0aGlzIGNsaWVudCBhY2NlcHRzIG9yIHJlamVjdHMgYW4gaW5jb21pbmcgY2FsbC5cbiAgICAgICAgICAgIGNvbnN0IGNhbGxSZXNwb25zZUNhbGxiYWNrID0gKGFjY2VwdENhbGwsIG9uUmVtb3RlVmlkZW9TdHJlYW1BdmFpbGFibGUsIGxvY2FsU3RyZWFtKSA9PiB7XG4gICAgICAgICAgICAgICAgbG9jYWxTdHJlYW0gPSBsb2NhbFN0cmVhbSB8fCB0aGlzLmxvY2FsU3RyZWFtO1xuXG4gICAgICAgICAgICAgICAgaWYgKGFjY2VwdENhbGwpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBvblJlbW90ZVZpZGVvU3RyZWFtQXZhaWxhYmxlICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdDaGF0RW5naW5lIFdlYlJUQyBQbHVnaW46IFtpbmNvbWluZ0NhbGxdIG9uUmVtb3RlVmlkZW9TdHJlYW1BdmFpbGFibGUgaGFuZGxlciBpcyBub3QgZGVmaW5lZC4nKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgbG9jYWxTdHJlYW0gIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdDaGF0RW5naW5lIFdlYlJUQyBQbHVnaW46IExvY2FsIHZpZGVvIHN0cmVhbSBvYmplY3QgaXMgbm90IGRlZmluZWQuJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBsZXQgYW5zd2VyRGVzY3JpcHRpb247XG4gICAgICAgICAgICAgICAgICAgIGxldCBwZWVyQ29ubmVjdGlvbiA9IG5ldyBSVENQZWVyQ29ubmVjdGlvbihydGNjb25maWcpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNhbGxDYWNoZVtjYWxsSWRdID0gcGVlckNvbm5lY3Rpb247XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gV2hlbiBJQ0UgY2FuZGlkYXRlcyBiZWNvbWUgYXZhaWxhYmxlLCBzZW5kIHRoZW0gdG8gdGhlIHJlbW90ZSBjbGllbnRcbiAgICAgICAgICAgICAgICAgICAgcGVlckNvbm5lY3Rpb24ub25pY2VjYW5kaWRhdGUgPSAoaWNlRXZlbnQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpY2VFdmVudC5jYW5kaWRhdGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZW5kZXIuZGlyZWN0LmVtaXQoWyckJyArICd3ZWJSVEMnLCAnaW5jb21pbmdJY2VDYW5kaWRhdGUnXS5qb2luKCcuJyksIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbElkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYW5kaWRhdGU6IGljZUV2ZW50LmNhbmRpZGF0ZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgICAgIHBlZXJDb25uZWN0aW9uLm9uaWNlY29ubmVjdGlvbnN0YXRlY2hhbmdlID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHBlZXJDb25uZWN0aW9uLmljZUNvbm5lY3Rpb25TdGF0ZSA9PT0gJ2Rpc2Nvbm5lY3RlZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm9uRGlzY29ubmVjdChjYWxsSWQsIHNlbmRlci51dWlkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgICAgICBwZWVyQ29ubmVjdGlvbi5vbnRyYWNrID0gb25SZW1vdGVWaWRlb1N0cmVhbUF2YWlsYWJsZTtcbiAgICAgICAgICAgICAgICAgICAgcGVlckNvbm5lY3Rpb24uc2V0UmVtb3RlRGVzY3JpcHRpb24ocmVtb3RlRGVzY3JpcHRpb24pXG4gICAgICAgICAgICAgICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwZWVyQ29ubmVjdGlvbi5hZGRTdHJlYW0obG9jYWxTdHJlYW0pO1xuICAgICAgICAgICAgICAgICAgICB9KS50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwZWVyQ29ubmVjdGlvbi5jcmVhdGVBbnN3ZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgfSkudGhlbigoYW5zd2VyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhbnN3ZXJEZXNjcmlwdGlvbiA9IGFuc3dlcjtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwZWVyQ29ubmVjdGlvbi5zZXRMb2NhbERlc2NyaXB0aW9uKGFuc3dlckRlc2NyaXB0aW9uKTtcbiAgICAgICAgICAgICAgICAgICAgfSkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZW5kZXIuZGlyZWN0LmVtaXQoWyckJyArICd3ZWJSVEMnLCAnY2FsbFJlc3BvbnNlJ10uam9pbignLicpLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbElkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFjY2VwdENhbGwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGFuc3dlckRlc2NyaXB0aW9uXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goKGVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdDaGF0RW5naW5lIFdlYlJUQyBQbHVnaW46IFtpbmNvbWluZ0NhbGxdJywgZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBzZW5kZXIuZGlyZWN0LmVtaXQoWyckJyArICd3ZWJSVEMnLCAnY2FsbFJlc3BvbnNlJ10uam9pbignLicpLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsSWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBhY2NlcHRDYWxsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5wYXJlbnRPbkluY29taW5nQ2FsbChzZW5kZXIudXVpZCwgY2FsbFJlc3BvbnNlQ2FsbGJhY2spO1xuICAgICAgICB9XG5cbiAgICAgICAgaW5jb21pbmdJY2VDYW5kaWRhdGUocGF5bG9hZCkge1xuICAgICAgICAgICAgY29uc3QgeyBjYWxsSWQsIGNhbmRpZGF0ZSB9ID0gcGF5bG9hZC5kYXRhO1xuXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnaW5jb21pbmdJY2VDYW5kaWRhdGUnLCBjYW5kaWRhdGUuc2RwTWlkLCBjYW5kaWRhdGUuY2FuZGlkYXRlLCApO1xuXG4gICAgICAgICAgICBpZiAoIXRoaXMuY2FsbENhY2hlW2NhbGxJZF0gfHwgdHlwZW9mIGNhbmRpZGF0ZSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuY2FsbENhY2hlW2NhbGxJZF0uYWRkSWNlQ2FuZGlkYXRlKGNhbmRpZGF0ZSlcbiAgICAgICAgICAgIC5jYXRjaCgoZXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdDaGF0RW5naW5lIFdlYlJUQyBQbHVnaW46IFtpbmNvbWluZ0ljZUNhbmRpZGF0ZV0nLCBlcnJvcik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIG9uRGlzY29ubmVjdChjYWxsSWQsIHVzZXJVdWlkKSB7XG4gICAgICAgICAgICB0aGlzLmNhbGxDYWNoZVtjYWxsSWRdLmNsb3NlKCk7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5jYWxsQ2FjaGVbY2FsbElkXTtcbiAgICAgICAgICAgIHRoaXMucGFyZW50T25DYWxsRGlzY29ubmVjdCh1c2VyVXVpZCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBsZXQgZW1pdCA9IHt9O1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgbmFtZXNwYWNlOiAnd2ViUlRDJyxcbiAgICAgICAgZXh0ZW5kczoge1xuICAgICAgICAgICAgQ2hhdDogZXh0ZW5zaW9uXG4gICAgICAgIH0sXG4gICAgICAgIG1pZGRsZXdhcmU6IHt9XG4gICAgfVxufTtcbiJdfQ==

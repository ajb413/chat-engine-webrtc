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
                        if (
                            !iceEvent.candidate ||
                            !iceEvent.candidate.candidate ||
                            !iceEvent.candidate.sdpMid ||
                            !iceEvent.candidate.sdpMLineIndex
                        ) {
                            return;
                        }

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy5udm0vdmVyc2lvbnMvbm9kZS92OC4xMS4yL2xpYi9ub2RlX21vZHVsZXMvY2hhdC1lbmdpbmUtcGx1Z2luL25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIudG1wL3dyYXAuanMiLCJwYWNrYWdlLmpzb24iLCJzcmMvcGx1Z2luLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsIihmdW5jdGlvbigpIHtcblxuICAgIGNvbnN0IHBhY2thZ2UgPSByZXF1aXJlKCcuLi9wYWNrYWdlLmpzb24nKTtcbiAgICB3aW5kb3cuQ2hhdEVuZ2luZUNvcmUucGx1Z2luW3BhY2thZ2UubmFtZV0gPSByZXF1aXJlKCcuLi9zcmMvcGx1Z2luLmpzJyk7XG5cbn0pKCk7XG4iLCJtb2R1bGUuZXhwb3J0cz17XG4gIFwiYXV0aG9yXCI6IFwiQWRhbSBCYXZvc2FcIixcbiAgXCJuYW1lXCI6IFwiY2hhdC1lbmdpbmUtd2VicnRjXCIsXG4gIFwidmVyc2lvblwiOiBcIjAuMC4xXCIsXG4gIFwibWFpblwiOiBcInNyYy9wbHVnaW4uanNcIixcbiAgXCJkZXBlbmRlbmNpZXNcIjoge1xuICAgIFwiY2hhdC1lbmdpbmVcIjogXCJeMC45LjE4XCJcbiAgfVxufVxuIiwiLypcbiAqXG4gKi9cblxuY29uc3QgcnRjY29uZmlnID0ge1xuICAgIGljZVNlcnZlcnM6IFt7XG4gICAgICAgICAgICBcInVybHNcIjogbmF2aWdhdG9yLm1vekdldFVzZXJNZWRpYSA/IFwic3R1bjpzdHVuLnNlcnZpY2VzLm1vemlsbGEuY29tXCJcbiAgICAgICAgICAgICAgICAgIDogbmF2aWdhdG9yLndlYmtpdEdldFVzZXJNZWRpYSA/IFwic3R1bjpzdHVuLmwuZ29vZ2xlLmNvbToxOTMwMlwiIDpcbiAgICAgICAgICAgICAgICAgIFwic3R1bjoyMy4yMS4xNTAuMTIxXCJcbiAgICAgICAgfSxcbiAgICAgICAgeyB1cmxzOiBcInN0dW46c3R1bi5sLmdvb2dsZS5jb206MTkzMDJcIiB9LFxuICAgICAgICB7IHVybHM6IFwic3R1bjpzdHVuMS5sLmdvb2dsZS5jb206MTkzMDJcIiB9LFxuICAgICAgICB7IHVybHM6IFwic3R1bjpzdHVuMi5sLmdvb2dsZS5jb206MTkzMDJcIiB9LFxuICAgICAgICB7IHVybHM6IFwic3R1bjpzdHVuMy5sLmdvb2dsZS5jb206MTkzMDJcIiB9LFxuICAgICAgICB7IHVybHM6IFwic3R1bjpzdHVuNC5sLmdvb2dsZS5jb206MTkzMDJcIiB9LFxuICAgICAgICB7IHVybHM6IFwic3R1bjoyMy4yMS4xNTAuMTIxXCIgfSxcbiAgICAgICAgeyB1cmxzOiBcInN0dW46c3R1bjAxLnNpcHBob25lLmNvbVwiIH0sXG4gICAgICAgIHsgdXJsczogXCJzdHVuOnN0dW4uZWtpZ2EubmV0XCIgfSxcbiAgICAgICAgeyB1cmxzOiBcInN0dW46c3R1bi5md2RuZXQubmV0XCIgfSxcbiAgICAgICAgeyB1cmxzOiBcInN0dW46c3R1bi5pZGVhc2lwLmNvbVwiIH0sXG4gICAgICAgIHsgdXJsczogXCJzdHVuOnN0dW4uaXB0ZWwub3JnXCIgfSxcbiAgICAgICAgeyB1cmxzOiBcInN0dW46c3R1bi5yaXh0ZWxlY29tLnNlXCIgfSxcbiAgICAgICAgeyB1cmxzOiBcInN0dW46c3R1bi5zY2hsdW5kLmRlXCIgfSxcbiAgICAgICAgeyB1cmxzOiBcInN0dW46c3R1bnNlcnZlci5vcmdcIiB9LFxuICAgICAgICB7IHVybHM6IFwic3R1bjpzdHVuLnNvZnRqb3lzLmNvbVwiIH0sXG4gICAgICAgIHsgdXJsczogXCJzdHVuOnN0dW4udm9pcGFyb3VuZC5jb21cIiB9LFxuICAgICAgICB7IHVybHM6IFwic3R1bjpzdHVuLnZvaXBidXN0ZXIuY29tXCIgfSxcbiAgICAgICAgeyB1cmxzOiBcInN0dW46c3R1bi52b2lwc3R1bnQuY29tXCIgfSxcbiAgICAgICAgeyB1cmxzOiBcInN0dW46c3R1bi52b3hncmF0aWEub3JnXCIgfSxcbiAgICAgICAgeyB1cmxzOiBcInN0dW46c3R1bi54dGVuLmNvbVwiIH1cbiAgICBdXG59O1xuXG5mdW5jdGlvbiB1dWlkKCkge1xuICAgIGZ1bmN0aW9uIHM0KCkge1xuICAgICAgICByZXR1cm4gTWF0aC5mbG9vcigoMSArIE1hdGgucmFuZG9tKCkpICogMHgxMDAwMClcbiAgICAgICAgICAgIC50b1N0cmluZygxNilcbiAgICAgICAgICAgIC5zdWJzdHJpbmcoMSk7XG4gICAgfVxuICAgIHJldHVybiBzNCgpICsgczQoKSArICctJyArIHM0KCkgKyAnLScgKyBzNCgpICsgJy0nICsgczQoKSArICctJyArIHM0KCkgKyBzNCgpICsgczQoKTtcbn1cblxuZnVuY3Rpb24gb25JbmNvbWluZ0NhbGxOb3REZWZpbmVkKGNhbGxiYWNrKSB7XG4gICAgY29uc29sZS5lcnJvcignQ2hhdEVuZ2luZSBXZWJSVEMgUGx1Z2luOiBbb25JbmNvbWluZ0NhbGxdIEluY29taW5nIGNhbGwgZXZlbnQgaGFuZGxlciBpcyBub3QgZGVmaW5lZC4nKTtcbiAgICBjYWxsYmFjayhmYWxzZSk7XG59XG5cbmZ1bmN0aW9uIG9uQ2FsbFJlc3BvbnNlTm90RGVmaW5lZCgpIHtcbiAgICBjb25zb2xlLmVycm9yKCdDaGF0RW5naW5lIFdlYlJUQyBQbHVnaW46IFtvbkNhbGxSZXNwb25zZV0gQ2FsbCByZXNwb25zZSBldmVudCBoYW5kbGVyIGlzIG5vdCBkZWZpbmVkLicpO1xufVxuXG5mdW5jdGlvbiBvbkNhbGxEaXNjb25uZWN0Tm90RGVmaW5lZCgpIHtcbiAgICBjb25zb2xlLmVycm9yKCdDaGF0RW5naW5lIFdlYlJUQyBQbHVnaW46IFtvbkNhbGxEaXNjb25uZWN0XSBDYWxsIGRpc2Nvbm5lY3QgZXZlbnQgaGFuZGxlciBpcyBub3QgZGVmaW5lZC4nKTtcbn1cblxuZnVuY3Rpb24gb25JY2VDYW5kaWRhdGUoaWNlRXZlbnQsIHVzZXIsIHBlZXJDb25uZWN0aW9uLCBjYWxsSWQpIHtcbiAgICBwZWVyQ29ubmVjdGlvbi5pY2VDYWNoZS5wdXNoKGljZUV2ZW50LmNhbmRpZGF0ZSk7XG5cbiAgICBpZiAocGVlckNvbm5lY3Rpb24uYWNjZXB0ZWRDYWxsKSB7XG4gICAgICAgIHNlbmRJY2VDYW5kaWRhdGVzKHVzZXIsIHBlZXJDb25uZWN0aW9uLCBjYWxsSWQpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gc2VuZEljZUNhbmRpZGF0ZXModXNlciwgcGVlckNvbm5lY3Rpb24sIGNhbGxJZCkge1xuICAgIHVzZXIuZGlyZWN0LmVtaXQoWyckJyArICd3ZWJSVEMnLCAnaW5jb21pbmdJY2VDYW5kaWRhdGUnXS5qb2luKCcuJyksIHtcbiAgICAgICAgY2FsbElkLFxuICAgICAgICBjYW5kaWRhdGVzOiBwZWVyQ29ubmVjdGlvbi5pY2VDYWNoZVxuICAgIH0pO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IChjb25maWcpID0+IHtcbiAgICBjbGFzcyBleHRlbnNpb24ge1xuICAgICAgICBjb25zdHJ1Y3QoKSB7XG4gICAgICAgICAgICAvLyBIb2xkcyBSVENQZWVyQ29ubmVjdGlvbiBvYmplY3RzIGZvciBlYWNoIGNhbGwuIEtleSBpcyB0aGUgY2FsbCBJRCAoYSBVVUlEKS5cbiAgICAgICAgICAgIHRoaXMuY2FsbENhY2hlID0ge307XG5cbiAgICAgICAgICAgIC8vIFtjb25maWcub25JbmNvbWluZ0NhbGxdIG11c3QgYmUgZGVmaW5lZCBvbiBpbml0LCBvdGhlcndpc2UgaW5jb21pbmcgY2FsbCBldmVudCB3aWxsIGxvZyBhbiBlcnJvci5cbiAgICAgICAgICAgIC8vIFRoZSBldmVudCBpcyBtZWFudCB0byB0cmlnZ2VyIFVJIGZvciB0aGUgdXNlciB0byBhY2NlcHQgb3IgcmVqZWN0IGFuIGluY29taW5nIGNhbGwuXG4gICAgICAgICAgICB0aGlzLnBhcmVudE9uSW5jb21pbmdDYWxsID0gY29uZmlnLm9uSW5jb21pbmdDYWxsIHx8IG9uSW5jb21pbmdDYWxsTm90RGVmaW5lZDtcblxuICAgICAgICAgICAgLy8gW2NvbmZpZy5vbkNhbGxSZXNwb25zZV0gbXVzdCBiZSBkZWZpbmVkIG9uIGluaXQsIG90aGVyd2lzZSBjYWxsIHJlc3BvbnNlIGV2ZW50IHdpbGwgbG9nIGFuIGVycm9yLlxuICAgICAgICAgICAgLy8gVGhlIGV2ZW50IGlzIG1lYW50IHRvIGdpdmUgdGhlIHVzZXIgYW4gb3Bwb3J0dW5pdHkgdG8gaGFuZGxlIGEgY2FsbCByZXNwb25zZS5cbiAgICAgICAgICAgIHRoaXMucGFyZW50T25DYWxsUmVzcG9uc2UgPSBjb25maWcub25DYWxsUmVzcG9uc2UgfHwgb25DYWxsUmVzcG9uc2VOb3REZWZpbmVkO1xuXG4gICAgICAgICAgICAvLyBbY29uZmlnLm9uQ2FsbERpc2Nvbm5lY3RdIG11c3QgYmUgZGVmaW5lZCBvbiBpbml0LCBvdGhlcndpc2UgZGlzY29ubmVjdCBjYWxsIGV2ZW50IHdpbGwgbG9nIGFuIGVycm9yLlxuICAgICAgICAgICAgLy8gVGhlIGV2ZW50IGlzIG1lYW50IHRvIG5vdGlmeSB0aGUgdXNlciB0aGF0IHRoZSBjYWxsIGhhcyBlbmRlZCBpbiB0aGUgVUkuXG4gICAgICAgICAgICB0aGlzLnBhcmVudE9uQ2FsbERpc2Nvbm5lY3QgPSBjb25maWcub25DYWxsRGlzY29ubmVjdCB8fCBvbkNhbGxEaXNjb25uZWN0Tm90RGVmaW5lZDtcblxuICAgICAgICAgICAgLy8gVmlkZW8gYW5kIGF1ZGlvIHN0cmVhbSBmcm9tIGxvY2FsIGNsaWVudCBjYW1lcmEgYW5kIG1pY3JvcGhvbmUuXG4gICAgICAgICAgICAvLyBPcHRpb25hbCB0byBwYXNzIG5vdywgY2FuIGJlIHBhc3NlZCBsYXRlciB3aGVuIGEgY2FsbCBpcyBhY2NlcHRlZC5cbiAgICAgICAgICAgIHRoaXMubG9jYWxTdHJlYW0gPSBjb25maWcubG9jYWxTdHJlYW07XG5cbiAgICAgICAgICAgIC8vIENoYXRFbmdpbmUgRGlyZWN0IGV2ZW50IGhhbmRsZXIgZm9yIGluY29taW5nIGNhbGwgcmVxdWVzdHMuXG4gICAgICAgICAgICB0aGlzLkNoYXRFbmdpbmUubWUuZGlyZWN0Lm9uKFsnJCcgKyAnd2ViUlRDJywgJ2luY29taW5nQ2FsbCddLmpvaW4oJy4nKSwgKHBheWxvYWQpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLmluY29taW5nQ2FsbChwYXlsb2FkKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBDaGF0RW5naW5lIERpcmVjdCBldmVudCBoYW5kbGVyIGZvciBjYWxsIHJlc3BvbnNlcy5cbiAgICAgICAgICAgIHRoaXMuQ2hhdEVuZ2luZS5tZS5kaXJlY3Qub24oWyckJyArICd3ZWJSVEMnLCAnY2FsbFJlc3BvbnNlJ10uam9pbignLicpLCAocGF5bG9hZCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuY2FsbFJlc3BvbnNlKHBheWxvYWQpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIENoYXRFbmdpbmUgRGlyZWN0IGV2ZW50IGhhbmRsZXIgZm9yIG5ldyBJQ0UgY2FuZGlkYXRlcyBmb3IgUlRDUGVlckNvbm5lY3Rpb24gb2JqZWN0LlxuICAgICAgICAgICAgLy8gV2ViUlRDIGNsaWVudCB0ZWxscyB0aGUgcmVtb3RlIGNsaWVudCB0aGVpciBJQ0UgY2FuZGlkYXRlcyB0aHJvdWdoIHRoaXMgc2lnbmFsLlxuICAgICAgICAgICAgdGhpcy5DaGF0RW5naW5lLm1lLmRpcmVjdC5vbihbJyQnICsgJ3dlYlJUQycsICdpbmNvbWluZ0ljZUNhbmRpZGF0ZSddLmpvaW4oJy4nKSwgKHBheWxvYWQpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLmluY29taW5nSWNlQ2FuZGlkYXRlKHBheWxvYWQpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBjYWxsVXNlcih1c2VyLCBvblJlbW90ZVZpZGVvU3RyZWFtQXZhaWxhYmxlLCBsb2NhbFN0cmVhbSkge1xuICAgICAgICAgICAgaWYgKHVzZXIubmFtZSA9PT0gJ01lJykge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0NoYXRFbmdpbmUgV2ViUlRDIFBsdWdpbjogW2NhbGxVc2VyXSBDYWxsaW5nIHNlbGYgaXMgbm90IGFsbG93ZWQuJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBJZiB0aGUgbG9jYWwgc3RyZWFtIGlzIG5vdCBwYXNzZWQgb24gcGx1Z2luIGluaXQsIGl0IGNhbiBiZSBwYXNzZWQgaGVyZS5cbiAgICAgICAgICAgIGxvY2FsU3RyZWFtID0gbG9jYWxTdHJlYW0gfHwgdGhpcy5sb2NhbFN0cmVhbTtcbiAgICAgICAgICAgIGxldCBjYWxsSWQgPSB1dWlkKCk7XG4gICAgICAgICAgICBsZXQgcGVlckNvbm5lY3Rpb24gPSBuZXcgUlRDUGVlckNvbm5lY3Rpb24ocnRjY29uZmlnKTtcbiAgICAgICAgICAgIHRoaXMuY2FsbENhY2hlW2NhbGxJZF0gPSBwZWVyQ29ubmVjdGlvbjtcbiAgICAgICAgICAgIHBlZXJDb25uZWN0aW9uLm9udHJhY2sgPSBvblJlbW90ZVZpZGVvU3RyZWFtQXZhaWxhYmxlO1xuICAgICAgICAgICAgcGVlckNvbm5lY3Rpb24uYWRkU3RyZWFtKGxvY2FsU3RyZWFtKTtcbiAgICAgICAgICAgIHBlZXJDb25uZWN0aW9uLmljZUNhY2hlID0gW107XG5cbiAgICAgICAgICAgIHBlZXJDb25uZWN0aW9uLm9uaWNlY29ubmVjdGlvbnN0YXRlY2hhbmdlID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChwZWVyQ29ubmVjdGlvbi5pY2VDb25uZWN0aW9uU3RhdGUgPT09ICdkaXNjb25uZWN0ZWQnKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMub25EaXNjb25uZWN0KGNhbGxJZCwgdXNlci51dWlkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvLyBXaGVuIElDRSBjYW5kaWRhdGVzIGJlY29tZSBhdmFpbGFibGUsIHNlbmQgdGhlbSB0byB0aGUgcmVtb3RlIGNsaWVudC5cbiAgICAgICAgICAgIHBlZXJDb25uZWN0aW9uLm9uaWNlY2FuZGlkYXRlID0gKGljZUV2ZW50KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCFpY2VFdmVudC5jYW5kaWRhdGUpIHJldHVybjtcbiAgICAgICAgICAgICAgICBvbkljZUNhbmRpZGF0ZShpY2VFdmVudCwgdXNlciwgcGVlckNvbm5lY3Rpb24sIGNhbGxJZCk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBsZXQgbG9jYWxEZXNjcmlwdGlvbjsgLy8gV2ViUlRDIGxvY2FsIGRlc2NyaXB0aW9uXG4gICAgICAgICAgICBwZWVyQ29ubmVjdGlvbi5vbm5lZ290aWF0aW9ubmVlZGVkID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIHBlZXJDb25uZWN0aW9uLmNyZWF0ZU9mZmVyKClcbiAgICAgICAgICAgICAgICAudGhlbigoZGVzY3JpcHRpb24pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgbG9jYWxEZXNjcmlwdGlvbiA9IGRlc2NyaXB0aW9uO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcGVlckNvbm5lY3Rpb24uc2V0TG9jYWxEZXNjcmlwdGlvbihsb2NhbERlc2NyaXB0aW9uKTtcbiAgICAgICAgICAgICAgICB9KS50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdXNlci5kaXJlY3QuZW1pdChbJyQnICsgJ3dlYlJUQycsICdpbmNvbWluZ0NhbGwnXS5qb2luKCcuJyksIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBsb2NhbERlc2NyaXB0aW9uXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pLmNhdGNoKChlcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdDaGF0RW5naW5lIFdlYlJUQyBQbHVnaW46IFtjYWxsVXNlcl0nLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgY2FsbFJlc3BvbnNlKHBheWxvYWQpIHtcbiAgICAgICAgICAgIGNvbnN0IHtjYWxsSWQsIGFjY2VwdENhbGwsIGRlc2NyaXB0aW9ufSA9IHBheWxvYWQuZGF0YTtcbiAgICAgICAgICAgIGxldCBzZW5kZXIgPSBwYXlsb2FkLnNlbmRlcjtcblxuICAgICAgICAgICAgaWYgKGFjY2VwdENhbGwpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxDYWNoZVtjYWxsSWRdLmFjY2VwdGVkQ2FsbCA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICAvLyBXaGVuIGEgdXNlciBhY2NlcHRzIGEgY2FsbCwgdGhleSBzZW5kIHRoZWlyIFdlYlJUQyBwZWVyIGNvbm5lY3Rpb24gZGVzY3JpcHRpb24uXG4gICAgICAgICAgICAgICAgLy8gU2V0IGl0IGxvY2FsbHkgYXMgdGhlIHJlbW90ZSBjbGllbnQncyBwZWVyIGNvbm5lY3Rpb24gZGVzY3JpcHRpb24uXG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsQ2FjaGVbY2FsbElkXS5zZXRSZW1vdGVEZXNjcmlwdGlvbihkZXNjcmlwdGlvbilcbiAgICAgICAgICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHNlbmRJY2VDYW5kaWRhdGVzKHNlbmRlciwgdGhpcy5jYWxsQ2FjaGVbY2FsbElkXSwgY2FsbElkKTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5jYXRjaCgoZXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignQ2hhdEVuZ2luZSBXZWJSVEMgUGx1Z2luOiBbY2FsbFJlc3BvbnNlXScsIGVycm9yKTtcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5jYWxsQ2FjaGVbY2FsbElkXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5wYXJlbnRPbkNhbGxSZXNwb25zZShzZW5kZXIudXVpZCwgYWNjZXB0Q2FsbCk7XG4gICAgICAgIH1cblxuICAgICAgICBpbmNvbWluZ0NhbGwocGF5bG9hZCkge1xuICAgICAgICAgICAgY29uc3Qgc2VuZGVyID0gcGF5bG9hZC5zZW5kZXI7XG4gICAgICAgICAgICBjb25zdCB7IGNhbGxJZCB9ID0gcGF5bG9hZC5kYXRhO1xuICAgICAgICAgICAgY29uc3QgcmVtb3RlRGVzY3JpcHRpb24gPSBwYXlsb2FkLmRhdGEuZGVzY3JpcHRpb247XG5cbiAgICAgICAgICAgIC8vIFNob3VsZCBiZSBleGVjdXRlZCBhZnRlciB0aGlzIGNsaWVudCBhY2NlcHRzIG9yIHJlamVjdHMgYW4gaW5jb21pbmcgY2FsbC5cbiAgICAgICAgICAgIGNvbnN0IGNhbGxSZXNwb25zZUNhbGxiYWNrID0gKGFjY2VwdENhbGwsIG9uUmVtb3RlVmlkZW9TdHJlYW1BdmFpbGFibGUsIGxvY2FsU3RyZWFtKSA9PiB7XG4gICAgICAgICAgICAgICAgbG9jYWxTdHJlYW0gPSBsb2NhbFN0cmVhbSB8fCB0aGlzLmxvY2FsU3RyZWFtO1xuXG4gICAgICAgICAgICAgICAgaWYgKGFjY2VwdENhbGwpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBvblJlbW90ZVZpZGVvU3RyZWFtQXZhaWxhYmxlICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdDaGF0RW5naW5lIFdlYlJUQyBQbHVnaW46IFtpbmNvbWluZ0NhbGxdIG9uUmVtb3RlVmlkZW9TdHJlYW1BdmFpbGFibGUgaGFuZGxlciBpcyBub3QgZGVmaW5lZC4nKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgbG9jYWxTdHJlYW0gIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdDaGF0RW5naW5lIFdlYlJUQyBQbHVnaW46IExvY2FsIHZpZGVvIHN0cmVhbSBvYmplY3QgaXMgbm90IGRlZmluZWQuJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBsZXQgYW5zd2VyRGVzY3JpcHRpb247XG4gICAgICAgICAgICAgICAgICAgIGxldCBwZWVyQ29ubmVjdGlvbiA9IG5ldyBSVENQZWVyQ29ubmVjdGlvbihydGNjb25maWcpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNhbGxDYWNoZVtjYWxsSWRdID0gcGVlckNvbm5lY3Rpb247XG4gICAgICAgICAgICAgICAgICAgIHBlZXJDb25uZWN0aW9uLm9udHJhY2sgPSBvblJlbW90ZVZpZGVvU3RyZWFtQXZhaWxhYmxlO1xuICAgICAgICAgICAgICAgICAgICBwZWVyQ29ubmVjdGlvbi5pY2VDYWNoZSA9IFtdO1xuXG4gICAgICAgICAgICAgICAgICAgIHBlZXJDb25uZWN0aW9uLm9uaWNlY29ubmVjdGlvbnN0YXRlY2hhbmdlID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHBlZXJDb25uZWN0aW9uLmljZUNvbm5lY3Rpb25TdGF0ZSA9PT0gJ2Rpc2Nvbm5lY3RlZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm9uRGlzY29ubmVjdChjYWxsSWQsIHNlbmRlci51dWlkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBXaGVuIElDRSBjYW5kaWRhdGVzIGJlY29tZSBhdmFpbGFibGUsIHNlbmQgdGhlbSB0byB0aGUgcmVtb3RlIGNsaWVudFxuICAgICAgICAgICAgICAgICAgICBwZWVyQ29ubmVjdGlvbi5vbmljZWNhbmRpZGF0ZSA9IChpY2VFdmVudCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICFpY2VFdmVudC5jYW5kaWRhdGUgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAhaWNlRXZlbnQuY2FuZGlkYXRlLmNhbmRpZGF0ZSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICFpY2VFdmVudC5jYW5kaWRhdGUuc2RwTWlkIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIWljZUV2ZW50LmNhbmRpZGF0ZS5zZHBNTGluZUluZGV4XG4gICAgICAgICAgICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uSWNlQ2FuZGlkYXRlKGljZUV2ZW50LCBzZW5kZXIsIHBlZXJDb25uZWN0aW9uLCBjYWxsSWQpO1xuICAgICAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgICAgIHBlZXJDb25uZWN0aW9uLnNldFJlbW90ZURlc2NyaXB0aW9uKHJlbW90ZURlc2NyaXB0aW9uKVxuICAgICAgICAgICAgICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcGVlckNvbm5lY3Rpb24uYWRkU3RyZWFtKGxvY2FsU3RyZWFtKTtcbiAgICAgICAgICAgICAgICAgICAgfSkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcGVlckNvbm5lY3Rpb24uY3JlYXRlQW5zd2VyKCk7XG4gICAgICAgICAgICAgICAgICAgIH0pLnRoZW4oKGFuc3dlcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgYW5zd2VyRGVzY3JpcHRpb24gPSBhbnN3ZXI7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcGVlckNvbm5lY3Rpb24uc2V0TG9jYWxEZXNjcmlwdGlvbihhbnN3ZXJEZXNjcmlwdGlvbik7XG4gICAgICAgICAgICAgICAgICAgIH0pLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgcGVlckNvbm5lY3Rpb24uYWNjZXB0ZWRDYWxsID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbmRJY2VDYW5kaWRhdGVzKHNlbmRlciwgcGVlckNvbm5lY3Rpb24sIGNhbGxJZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZW5kZXIuZGlyZWN0LmVtaXQoWyckJyArICd3ZWJSVEMnLCAnY2FsbFJlc3BvbnNlJ10uam9pbignLicpLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbElkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFjY2VwdENhbGwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGFuc3dlckRlc2NyaXB0aW9uXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goKGVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdDaGF0RW5naW5lIFdlYlJUQyBQbHVnaW46IFtpbmNvbWluZ0NhbGxdJywgZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBzZW5kZXIuZGlyZWN0LmVtaXQoWyckJyArICd3ZWJSVEMnLCAnY2FsbFJlc3BvbnNlJ10uam9pbignLicpLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsSWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBhY2NlcHRDYWxsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5wYXJlbnRPbkluY29taW5nQ2FsbChzZW5kZXIudXVpZCwgY2FsbFJlc3BvbnNlQ2FsbGJhY2spO1xuICAgICAgICB9XG5cbiAgICAgICAgaW5jb21pbmdJY2VDYW5kaWRhdGUocGF5bG9hZCkge1xuICAgICAgICAgICAgY29uc3QgeyBjYWxsSWQsIGNhbmRpZGF0ZXMgfSA9IHBheWxvYWQuZGF0YTtcblxuICAgICAgICAgICAgaWYgKCF0aGlzLmNhbGxDYWNoZVtjYWxsSWRdIHx8IHR5cGVvZiBjYW5kaWRhdGVzICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY2FuZGlkYXRlcy5mb3JFYWNoKChjYW5kaWRhdGUpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxDYWNoZVtjYWxsSWRdLmFkZEljZUNhbmRpZGF0ZShjYW5kaWRhdGUpXG4gICAgICAgICAgICAgICAgLmNhdGNoKChlcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdDaGF0RW5naW5lIFdlYlJUQyBQbHVnaW46IFtpbmNvbWluZ0ljZUNhbmRpZGF0ZV0nLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIG9uRGlzY29ubmVjdChjYWxsSWQsIHVzZXJVdWlkKSB7XG4gICAgICAgICAgICB0aGlzLmNhbGxDYWNoZVtjYWxsSWRdLmNsb3NlKCk7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5jYWxsQ2FjaGVbY2FsbElkXTtcbiAgICAgICAgICAgIHRoaXMucGFyZW50T25DYWxsRGlzY29ubmVjdCh1c2VyVXVpZCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBsZXQgZW1pdCA9IHt9O1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgbmFtZXNwYWNlOiAnd2ViUlRDJyxcbiAgICAgICAgZXh0ZW5kczoge1xuICAgICAgICAgICAgQ2hhdDogZXh0ZW5zaW9uXG4gICAgICAgIH0sXG4gICAgICAgIG1pZGRsZXdhcmU6IHt9XG4gICAgfVxufTtcbiJdfQ==

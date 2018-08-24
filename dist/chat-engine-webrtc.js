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
const bounceNonTurn = false;
let rtcconfig;
rtcconfig = {
    iceServers: [{
        'urls': [
            'stun:w2.xirsys.com',
            'turn:w2.xirsys.com:80?transport=udp',
            'turn:w2.xirsys.com:3478?transport=udp',
            'turn:w2.xirsys.com:80?transport=tcp',
            'turn:w2.xirsys.com:3478?transport=tcp',
            'turns:w2.xirsys.com:443?transport=tcp',
            'turns:w2.xirsys.com:5349?transport=tcp'
        ],
        'credential': '35426d02-a7c3-11e8-98a1-f9e0e877debe',
        'username': '35426bfe-a7c3-11e8-a8bd-e7d0be3af999'
    }]
};

// const rtcconfig = {
//     iceServers: [{
//         'urls': [
//             'stun:w2.xirsys.com',
//             'turn:w2.xirsys.com:80?transport=udp',
//             'turn:w2.xirsys.com:3478?transport=udp',
//             'turn:w2.xirsys.com:80?transport=tcp',
//             'turn:w2.xirsys.com:3478?transport=tcp',
//             'turns:w2.xirsys.com:443?transport=tcp',
//             'turns:w2.xirsys.com:5349?transport=tcp'
//         ],
//         'credential': 'xxxxxx',
//         'username': 'xxxxxx'
//     }]
// };

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
            // localStream = localStream || this.localStream;
            let callId = uuid();
            let peerConnection = new RTCPeerConnection(rtcconfig);
            this.callCache[callId] = peerConnection;
            peerConnection.ontrack = onRemoteVideoStreamAvailable;
            localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));
            peerConnection.iceCache = [];

            peerConnection.oniceconnectionstatechange = () => {
                if (peerConnection.iceConnectionState === 'disconnected') {
                    this.onDisconnect(callId, user.uuid);
                }
            };

            // When ICE candidates become available, send them to the remote client.
            peerConnection.onicecandidate = (iceEvent) => {
                console.log('ice candidate', iceEvent.candidate);
                if (!iceEvent.candidate) return;
                onIceCandidate(iceEvent, user, peerConnection, callId);
            };

            let localDescription; // WebRTC local description
            peerConnection.onnegotiationneeded = () => {
                peerConnection.createOffer({
                    offerToReceiveAudio: 1,
                    offerToReceiveVideo: 1
                }).then((description) => {
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
            const { callId, acceptCall, description } = payload.data;
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
                // localStream = localStream || this.localStream;

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
                        console.log('ice candidate', iceEvent.candidate);
                        if (!iceEvent.candidate) {
                            return;
                        }

                        onIceCandidate(iceEvent, sender, peerConnection, callId);
                    };

                    peerConnection.setRemoteDescription(remoteDescription)
                        .then(() => {
                            localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));
                            return Promise.resolve();
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

            console.log(typeof candidates, candidates);

            if (!this.callCache[callId] || typeof candidates !== 'object') {
                return;
            }

            candidates.forEach((candidate) => {
                //bounce all non TURN
                if (bounceNonTurn && candidate.candidate.indexOf('typ relay') === -1) {
                    console.log('bouncing', candidate.candidate);
                    return;
                }

                console.log(true);

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy5udm0vdmVyc2lvbnMvbm9kZS92OC4xMS4yL2xpYi9ub2RlX21vZHVsZXMvY2hhdC1lbmdpbmUtcGx1Z2luL25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIudG1wL3dyYXAuanMiLCJwYWNrYWdlLmpzb24iLCJzcmMvcGx1Z2luLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwiKGZ1bmN0aW9uKCkge1xuXG4gICAgY29uc3QgcGFja2FnZSA9IHJlcXVpcmUoJy4uL3BhY2thZ2UuanNvbicpO1xuICAgIHdpbmRvdy5DaGF0RW5naW5lQ29yZS5wbHVnaW5bcGFja2FnZS5uYW1lXSA9IHJlcXVpcmUoJy4uL3NyYy9wbHVnaW4uanMnKTtcblxufSkoKTtcbiIsIm1vZHVsZS5leHBvcnRzPXtcbiAgXCJhdXRob3JcIjogXCJBZGFtIEJhdm9zYVwiLFxuICBcIm5hbWVcIjogXCJjaGF0LWVuZ2luZS13ZWJydGNcIixcbiAgXCJ2ZXJzaW9uXCI6IFwiMC4wLjFcIixcbiAgXCJtYWluXCI6IFwic3JjL3BsdWdpbi5qc1wiLFxuICBcImRlcGVuZGVuY2llc1wiOiB7XG4gICAgXCJjaGF0LWVuZ2luZVwiOiBcIl4wLjkuMThcIlxuICB9XG59XG4iLCIvKlxuICpcbiAqL1xuY29uc3QgYm91bmNlTm9uVHVybiA9IGZhbHNlO1xubGV0IHJ0Y2NvbmZpZztcbnJ0Y2NvbmZpZyA9IHtcbiAgICBpY2VTZXJ2ZXJzOiBbe1xuICAgICAgICAndXJscyc6IFtcbiAgICAgICAgICAgICdzdHVuOncyLnhpcnN5cy5jb20nLFxuICAgICAgICAgICAgJ3R1cm46dzIueGlyc3lzLmNvbTo4MD90cmFuc3BvcnQ9dWRwJyxcbiAgICAgICAgICAgICd0dXJuOncyLnhpcnN5cy5jb206MzQ3OD90cmFuc3BvcnQ9dWRwJyxcbiAgICAgICAgICAgICd0dXJuOncyLnhpcnN5cy5jb206ODA/dHJhbnNwb3J0PXRjcCcsXG4gICAgICAgICAgICAndHVybjp3Mi54aXJzeXMuY29tOjM0Nzg/dHJhbnNwb3J0PXRjcCcsXG4gICAgICAgICAgICAndHVybnM6dzIueGlyc3lzLmNvbTo0NDM/dHJhbnNwb3J0PXRjcCcsXG4gICAgICAgICAgICAndHVybnM6dzIueGlyc3lzLmNvbTo1MzQ5P3RyYW5zcG9ydD10Y3AnXG4gICAgICAgIF0sXG4gICAgICAgICdjcmVkZW50aWFsJzogJzM1NDI2ZDAyLWE3YzMtMTFlOC05OGExLWY5ZTBlODc3ZGViZScsXG4gICAgICAgICd1c2VybmFtZSc6ICczNTQyNmJmZS1hN2MzLTExZTgtYThiZC1lN2QwYmUzYWY5OTknXG4gICAgfV1cbn07XG5cbi8vIGNvbnN0IHJ0Y2NvbmZpZyA9IHtcbi8vICAgICBpY2VTZXJ2ZXJzOiBbe1xuLy8gICAgICAgICAndXJscyc6IFtcbi8vICAgICAgICAgICAgICdzdHVuOncyLnhpcnN5cy5jb20nLFxuLy8gICAgICAgICAgICAgJ3R1cm46dzIueGlyc3lzLmNvbTo4MD90cmFuc3BvcnQ9dWRwJyxcbi8vICAgICAgICAgICAgICd0dXJuOncyLnhpcnN5cy5jb206MzQ3OD90cmFuc3BvcnQ9dWRwJyxcbi8vICAgICAgICAgICAgICd0dXJuOncyLnhpcnN5cy5jb206ODA/dHJhbnNwb3J0PXRjcCcsXG4vLyAgICAgICAgICAgICAndHVybjp3Mi54aXJzeXMuY29tOjM0Nzg/dHJhbnNwb3J0PXRjcCcsXG4vLyAgICAgICAgICAgICAndHVybnM6dzIueGlyc3lzLmNvbTo0NDM/dHJhbnNwb3J0PXRjcCcsXG4vLyAgICAgICAgICAgICAndHVybnM6dzIueGlyc3lzLmNvbTo1MzQ5P3RyYW5zcG9ydD10Y3AnXG4vLyAgICAgICAgIF0sXG4vLyAgICAgICAgICdjcmVkZW50aWFsJzogJ3h4eHh4eCcsXG4vLyAgICAgICAgICd1c2VybmFtZSc6ICd4eHh4eHgnXG4vLyAgICAgfV1cbi8vIH07XG5cbmZ1bmN0aW9uIHV1aWQoKSB7XG4gICAgZnVuY3Rpb24gczQoKSB7XG4gICAgICAgIHJldHVybiBNYXRoLmZsb29yKCgxICsgTWF0aC5yYW5kb20oKSkgKiAweDEwMDAwKVxuICAgICAgICAgICAgLnRvU3RyaW5nKDE2KVxuICAgICAgICAgICAgLnN1YnN0cmluZygxKTtcbiAgICB9XG4gICAgcmV0dXJuIHM0KCkgKyBzNCgpICsgJy0nICsgczQoKSArICctJyArIHM0KCkgKyAnLScgKyBzNCgpICsgJy0nICsgczQoKSArIHM0KCkgKyBzNCgpO1xufVxuXG5mdW5jdGlvbiBvbkluY29taW5nQ2FsbE5vdERlZmluZWQoY2FsbGJhY2spIHtcbiAgICBjb25zb2xlLmVycm9yKCdDaGF0RW5naW5lIFdlYlJUQyBQbHVnaW46IFtvbkluY29taW5nQ2FsbF0gSW5jb21pbmcgY2FsbCBldmVudCBoYW5kbGVyIGlzIG5vdCBkZWZpbmVkLicpO1xuICAgIGNhbGxiYWNrKGZhbHNlKTtcbn1cblxuZnVuY3Rpb24gb25DYWxsUmVzcG9uc2VOb3REZWZpbmVkKCkge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0NoYXRFbmdpbmUgV2ViUlRDIFBsdWdpbjogW29uQ2FsbFJlc3BvbnNlXSBDYWxsIHJlc3BvbnNlIGV2ZW50IGhhbmRsZXIgaXMgbm90IGRlZmluZWQuJyk7XG59XG5cbmZ1bmN0aW9uIG9uQ2FsbERpc2Nvbm5lY3ROb3REZWZpbmVkKCkge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0NoYXRFbmdpbmUgV2ViUlRDIFBsdWdpbjogW29uQ2FsbERpc2Nvbm5lY3RdIENhbGwgZGlzY29ubmVjdCBldmVudCBoYW5kbGVyIGlzIG5vdCBkZWZpbmVkLicpO1xufVxuXG5mdW5jdGlvbiBvbkljZUNhbmRpZGF0ZShpY2VFdmVudCwgdXNlciwgcGVlckNvbm5lY3Rpb24sIGNhbGxJZCkge1xuICAgIHBlZXJDb25uZWN0aW9uLmljZUNhY2hlLnB1c2goaWNlRXZlbnQuY2FuZGlkYXRlKTtcblxuICAgIGlmIChwZWVyQ29ubmVjdGlvbi5hY2NlcHRlZENhbGwpIHtcbiAgICAgICAgc2VuZEljZUNhbmRpZGF0ZXModXNlciwgcGVlckNvbm5lY3Rpb24sIGNhbGxJZCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBzZW5kSWNlQ2FuZGlkYXRlcyh1c2VyLCBwZWVyQ29ubmVjdGlvbiwgY2FsbElkKSB7XG4gICAgdXNlci5kaXJlY3QuZW1pdChbJyQnICsgJ3dlYlJUQycsICdpbmNvbWluZ0ljZUNhbmRpZGF0ZSddLmpvaW4oJy4nKSwge1xuICAgICAgICBjYWxsSWQsXG4gICAgICAgIGNhbmRpZGF0ZXM6IHBlZXJDb25uZWN0aW9uLmljZUNhY2hlXG4gICAgfSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gKGNvbmZpZykgPT4ge1xuICAgIGNsYXNzIGV4dGVuc2lvbiB7XG4gICAgICAgIGNvbnN0cnVjdCgpIHtcbiAgICAgICAgICAgIC8vIEhvbGRzIFJUQ1BlZXJDb25uZWN0aW9uIG9iamVjdHMgZm9yIGVhY2ggY2FsbC4gS2V5IGlzIHRoZSBjYWxsIElEIChhIFVVSUQpLlxuICAgICAgICAgICAgdGhpcy5jYWxsQ2FjaGUgPSB7fTtcblxuICAgICAgICAgICAgLy8gW2NvbmZpZy5vbkluY29taW5nQ2FsbF0gbXVzdCBiZSBkZWZpbmVkIG9uIGluaXQsIG90aGVyd2lzZSBpbmNvbWluZyBjYWxsIGV2ZW50IHdpbGwgbG9nIGFuIGVycm9yLlxuICAgICAgICAgICAgLy8gVGhlIGV2ZW50IGlzIG1lYW50IHRvIHRyaWdnZXIgVUkgZm9yIHRoZSB1c2VyIHRvIGFjY2VwdCBvciByZWplY3QgYW4gaW5jb21pbmcgY2FsbC5cbiAgICAgICAgICAgIHRoaXMucGFyZW50T25JbmNvbWluZ0NhbGwgPSBjb25maWcub25JbmNvbWluZ0NhbGwgfHwgb25JbmNvbWluZ0NhbGxOb3REZWZpbmVkO1xuXG4gICAgICAgICAgICAvLyBbY29uZmlnLm9uQ2FsbFJlc3BvbnNlXSBtdXN0IGJlIGRlZmluZWQgb24gaW5pdCwgb3RoZXJ3aXNlIGNhbGwgcmVzcG9uc2UgZXZlbnQgd2lsbCBsb2cgYW4gZXJyb3IuXG4gICAgICAgICAgICAvLyBUaGUgZXZlbnQgaXMgbWVhbnQgdG8gZ2l2ZSB0aGUgdXNlciBhbiBvcHBvcnR1bml0eSB0byBoYW5kbGUgYSBjYWxsIHJlc3BvbnNlLlxuICAgICAgICAgICAgdGhpcy5wYXJlbnRPbkNhbGxSZXNwb25zZSA9IGNvbmZpZy5vbkNhbGxSZXNwb25zZSB8fCBvbkNhbGxSZXNwb25zZU5vdERlZmluZWQ7XG5cbiAgICAgICAgICAgIC8vIFtjb25maWcub25DYWxsRGlzY29ubmVjdF0gbXVzdCBiZSBkZWZpbmVkIG9uIGluaXQsIG90aGVyd2lzZSBkaXNjb25uZWN0IGNhbGwgZXZlbnQgd2lsbCBsb2cgYW4gZXJyb3IuXG4gICAgICAgICAgICAvLyBUaGUgZXZlbnQgaXMgbWVhbnQgdG8gbm90aWZ5IHRoZSB1c2VyIHRoYXQgdGhlIGNhbGwgaGFzIGVuZGVkIGluIHRoZSBVSS5cbiAgICAgICAgICAgIHRoaXMucGFyZW50T25DYWxsRGlzY29ubmVjdCA9IGNvbmZpZy5vbkNhbGxEaXNjb25uZWN0IHx8IG9uQ2FsbERpc2Nvbm5lY3ROb3REZWZpbmVkO1xuXG4gICAgICAgICAgICAvLyBWaWRlbyBhbmQgYXVkaW8gc3RyZWFtIGZyb20gbG9jYWwgY2xpZW50IGNhbWVyYSBhbmQgbWljcm9waG9uZS5cbiAgICAgICAgICAgIC8vIE9wdGlvbmFsIHRvIHBhc3Mgbm93LCBjYW4gYmUgcGFzc2VkIGxhdGVyIHdoZW4gYSBjYWxsIGlzIGFjY2VwdGVkLlxuICAgICAgICAgICAgdGhpcy5sb2NhbFN0cmVhbSA9IGNvbmZpZy5sb2NhbFN0cmVhbTtcblxuICAgICAgICAgICAgLy8gQ2hhdEVuZ2luZSBEaXJlY3QgZXZlbnQgaGFuZGxlciBmb3IgaW5jb21pbmcgY2FsbCByZXF1ZXN0cy5cbiAgICAgICAgICAgIHRoaXMuQ2hhdEVuZ2luZS5tZS5kaXJlY3Qub24oWyckJyArICd3ZWJSVEMnLCAnaW5jb21pbmdDYWxsJ10uam9pbignLicpLCAocGF5bG9hZCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuaW5jb21pbmdDYWxsKHBheWxvYWQpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIENoYXRFbmdpbmUgRGlyZWN0IGV2ZW50IGhhbmRsZXIgZm9yIGNhbGwgcmVzcG9uc2VzLlxuICAgICAgICAgICAgdGhpcy5DaGF0RW5naW5lLm1lLmRpcmVjdC5vbihbJyQnICsgJ3dlYlJUQycsICdjYWxsUmVzcG9uc2UnXS5qb2luKCcuJyksIChwYXlsb2FkKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsUmVzcG9uc2UocGF5bG9hZCk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy8gQ2hhdEVuZ2luZSBEaXJlY3QgZXZlbnQgaGFuZGxlciBmb3IgbmV3IElDRSBjYW5kaWRhdGVzIGZvciBSVENQZWVyQ29ubmVjdGlvbiBvYmplY3QuXG4gICAgICAgICAgICAvLyBXZWJSVEMgY2xpZW50IHRlbGxzIHRoZSByZW1vdGUgY2xpZW50IHRoZWlyIElDRSBjYW5kaWRhdGVzIHRocm91Z2ggdGhpcyBzaWduYWwuXG4gICAgICAgICAgICB0aGlzLkNoYXRFbmdpbmUubWUuZGlyZWN0Lm9uKFsnJCcgKyAnd2ViUlRDJywgJ2luY29taW5nSWNlQ2FuZGlkYXRlJ10uam9pbignLicpLCAocGF5bG9hZCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuaW5jb21pbmdJY2VDYW5kaWRhdGUocGF5bG9hZCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNhbGxVc2VyKHVzZXIsIG9uUmVtb3RlVmlkZW9TdHJlYW1BdmFpbGFibGUsIGxvY2FsU3RyZWFtKSB7XG4gICAgICAgICAgICBpZiAodXNlci5uYW1lID09PSAnTWUnKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignQ2hhdEVuZ2luZSBXZWJSVEMgUGx1Z2luOiBbY2FsbFVzZXJdIENhbGxpbmcgc2VsZiBpcyBub3QgYWxsb3dlZC4nKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIElmIHRoZSBsb2NhbCBzdHJlYW0gaXMgbm90IHBhc3NlZCBvbiBwbHVnaW4gaW5pdCwgaXQgY2FuIGJlIHBhc3NlZCBoZXJlLlxuICAgICAgICAgICAgLy8gbG9jYWxTdHJlYW0gPSBsb2NhbFN0cmVhbSB8fCB0aGlzLmxvY2FsU3RyZWFtO1xuICAgICAgICAgICAgbGV0IGNhbGxJZCA9IHV1aWQoKTtcbiAgICAgICAgICAgIGxldCBwZWVyQ29ubmVjdGlvbiA9IG5ldyBSVENQZWVyQ29ubmVjdGlvbihydGNjb25maWcpO1xuICAgICAgICAgICAgdGhpcy5jYWxsQ2FjaGVbY2FsbElkXSA9IHBlZXJDb25uZWN0aW9uO1xuICAgICAgICAgICAgcGVlckNvbm5lY3Rpb24ub250cmFjayA9IG9uUmVtb3RlVmlkZW9TdHJlYW1BdmFpbGFibGU7XG4gICAgICAgICAgICBsb2NhbFN0cmVhbS5nZXRUcmFja3MoKS5mb3JFYWNoKCh0cmFjaykgPT4gcGVlckNvbm5lY3Rpb24uYWRkVHJhY2sodHJhY2ssIGxvY2FsU3RyZWFtKSk7XG4gICAgICAgICAgICBwZWVyQ29ubmVjdGlvbi5pY2VDYWNoZSA9IFtdO1xuXG4gICAgICAgICAgICBwZWVyQ29ubmVjdGlvbi5vbmljZWNvbm5lY3Rpb25zdGF0ZWNoYW5nZSA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAocGVlckNvbm5lY3Rpb24uaWNlQ29ubmVjdGlvblN0YXRlID09PSAnZGlzY29ubmVjdGVkJykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm9uRGlzY29ubmVjdChjYWxsSWQsIHVzZXIudXVpZCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgLy8gV2hlbiBJQ0UgY2FuZGlkYXRlcyBiZWNvbWUgYXZhaWxhYmxlLCBzZW5kIHRoZW0gdG8gdGhlIHJlbW90ZSBjbGllbnQuXG4gICAgICAgICAgICBwZWVyQ29ubmVjdGlvbi5vbmljZWNhbmRpZGF0ZSA9IChpY2VFdmVudCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdpY2UgY2FuZGlkYXRlJywgaWNlRXZlbnQuY2FuZGlkYXRlKTtcbiAgICAgICAgICAgICAgICBpZiAoIWljZUV2ZW50LmNhbmRpZGF0ZSkgcmV0dXJuO1xuICAgICAgICAgICAgICAgIG9uSWNlQ2FuZGlkYXRlKGljZUV2ZW50LCB1c2VyLCBwZWVyQ29ubmVjdGlvbiwgY2FsbElkKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGxldCBsb2NhbERlc2NyaXB0aW9uOyAvLyBXZWJSVEMgbG9jYWwgZGVzY3JpcHRpb25cbiAgICAgICAgICAgIHBlZXJDb25uZWN0aW9uLm9ubmVnb3RpYXRpb25uZWVkZWQgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgcGVlckNvbm5lY3Rpb24uY3JlYXRlT2ZmZXIoe1xuICAgICAgICAgICAgICAgICAgICBvZmZlclRvUmVjZWl2ZUF1ZGlvOiAxLFxuICAgICAgICAgICAgICAgICAgICBvZmZlclRvUmVjZWl2ZVZpZGVvOiAxXG4gICAgICAgICAgICAgICAgfSkudGhlbigoZGVzY3JpcHRpb24pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgbG9jYWxEZXNjcmlwdGlvbiA9IGRlc2NyaXB0aW9uO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcGVlckNvbm5lY3Rpb24uc2V0TG9jYWxEZXNjcmlwdGlvbihsb2NhbERlc2NyaXB0aW9uKTtcbiAgICAgICAgICAgICAgICB9KS50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdXNlci5kaXJlY3QuZW1pdChbJyQnICsgJ3dlYlJUQycsICdpbmNvbWluZ0NhbGwnXS5qb2luKCcuJyksIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBsb2NhbERlc2NyaXB0aW9uXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pLmNhdGNoKChlcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdDaGF0RW5naW5lIFdlYlJUQyBQbHVnaW46IFtjYWxsVXNlcl0nLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgY2FsbFJlc3BvbnNlKHBheWxvYWQpIHtcbiAgICAgICAgICAgIGNvbnN0IHsgY2FsbElkLCBhY2NlcHRDYWxsLCBkZXNjcmlwdGlvbiB9ID0gcGF5bG9hZC5kYXRhO1xuICAgICAgICAgICAgbGV0IHNlbmRlciA9IHBheWxvYWQuc2VuZGVyO1xuXG4gICAgICAgICAgICBpZiAoYWNjZXB0Q2FsbCkge1xuICAgICAgICAgICAgICAgIHRoaXMuY2FsbENhY2hlW2NhbGxJZF0uYWNjZXB0ZWRDYWxsID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgIC8vIFdoZW4gYSB1c2VyIGFjY2VwdHMgYSBjYWxsLCB0aGV5IHNlbmQgdGhlaXIgV2ViUlRDIHBlZXIgY29ubmVjdGlvbiBkZXNjcmlwdGlvbi5cbiAgICAgICAgICAgICAgICAvLyBTZXQgaXQgbG9jYWxseSBhcyB0aGUgcmVtb3RlIGNsaWVudCdzIHBlZXIgY29ubmVjdGlvbiBkZXNjcmlwdGlvbi5cbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxDYWNoZVtjYWxsSWRdLnNldFJlbW90ZURlc2NyaXB0aW9uKGRlc2NyaXB0aW9uKVxuICAgICAgICAgICAgICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZW5kSWNlQ2FuZGlkYXRlcyhzZW5kZXIsIHRoaXMuY2FsbENhY2hlW2NhbGxJZF0sIGNhbGxJZCk7XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIC5jYXRjaCgoZXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0NoYXRFbmdpbmUgV2ViUlRDIFBsdWdpbjogW2NhbGxSZXNwb25zZV0nLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLmNhbGxDYWNoZVtjYWxsSWRdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnBhcmVudE9uQ2FsbFJlc3BvbnNlKHNlbmRlci51dWlkLCBhY2NlcHRDYWxsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGluY29taW5nQ2FsbChwYXlsb2FkKSB7XG4gICAgICAgICAgICBjb25zdCBzZW5kZXIgPSBwYXlsb2FkLnNlbmRlcjtcbiAgICAgICAgICAgIGNvbnN0IHsgY2FsbElkIH0gPSBwYXlsb2FkLmRhdGE7XG4gICAgICAgICAgICBjb25zdCByZW1vdGVEZXNjcmlwdGlvbiA9IHBheWxvYWQuZGF0YS5kZXNjcmlwdGlvbjtcblxuICAgICAgICAgICAgLy8gU2hvdWxkIGJlIGV4ZWN1dGVkIGFmdGVyIHRoaXMgY2xpZW50IGFjY2VwdHMgb3IgcmVqZWN0cyBhbiBpbmNvbWluZyBjYWxsLlxuICAgICAgICAgICAgY29uc3QgY2FsbFJlc3BvbnNlQ2FsbGJhY2sgPSAoYWNjZXB0Q2FsbCwgb25SZW1vdGVWaWRlb1N0cmVhbUF2YWlsYWJsZSwgbG9jYWxTdHJlYW0pID0+IHtcbiAgICAgICAgICAgICAgICAvLyBsb2NhbFN0cmVhbSA9IGxvY2FsU3RyZWFtIHx8IHRoaXMubG9jYWxTdHJlYW07XG5cbiAgICAgICAgICAgICAgICBpZiAoYWNjZXB0Q2FsbCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIG9uUmVtb3RlVmlkZW9TdHJlYW1BdmFpbGFibGUgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0NoYXRFbmdpbmUgV2ViUlRDIFBsdWdpbjogW2luY29taW5nQ2FsbF0gb25SZW1vdGVWaWRlb1N0cmVhbUF2YWlsYWJsZSBoYW5kbGVyIGlzIG5vdCBkZWZpbmVkLicpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBsb2NhbFN0cmVhbSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0NoYXRFbmdpbmUgV2ViUlRDIFBsdWdpbjogTG9jYWwgdmlkZW8gc3RyZWFtIG9iamVjdCBpcyBub3QgZGVmaW5lZC4nKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGxldCBhbnN3ZXJEZXNjcmlwdGlvbjtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHBlZXJDb25uZWN0aW9uID0gbmV3IFJUQ1BlZXJDb25uZWN0aW9uKHJ0Y2NvbmZpZyk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2FsbENhY2hlW2NhbGxJZF0gPSBwZWVyQ29ubmVjdGlvbjtcbiAgICAgICAgICAgICAgICAgICAgcGVlckNvbm5lY3Rpb24ub250cmFjayA9IG9uUmVtb3RlVmlkZW9TdHJlYW1BdmFpbGFibGU7XG4gICAgICAgICAgICAgICAgICAgIHBlZXJDb25uZWN0aW9uLmljZUNhY2hlID0gW107XG5cbiAgICAgICAgICAgICAgICAgICAgcGVlckNvbm5lY3Rpb24ub25pY2Vjb25uZWN0aW9uc3RhdGVjaGFuZ2UgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocGVlckNvbm5lY3Rpb24uaWNlQ29ubmVjdGlvblN0YXRlID09PSAnZGlzY29ubmVjdGVkJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMub25EaXNjb25uZWN0KGNhbGxJZCwgc2VuZGVyLnV1aWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIFdoZW4gSUNFIGNhbmRpZGF0ZXMgYmVjb21lIGF2YWlsYWJsZSwgc2VuZCB0aGVtIHRvIHRoZSByZW1vdGUgY2xpZW50XG4gICAgICAgICAgICAgICAgICAgIHBlZXJDb25uZWN0aW9uLm9uaWNlY2FuZGlkYXRlID0gKGljZUV2ZW50KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnaWNlIGNhbmRpZGF0ZScsIGljZUV2ZW50LmNhbmRpZGF0ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWljZUV2ZW50LmNhbmRpZGF0ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgb25JY2VDYW5kaWRhdGUoaWNlRXZlbnQsIHNlbmRlciwgcGVlckNvbm5lY3Rpb24sIGNhbGxJZCk7XG4gICAgICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICAgICAgcGVlckNvbm5lY3Rpb24uc2V0UmVtb3RlRGVzY3JpcHRpb24ocmVtb3RlRGVzY3JpcHRpb24pXG4gICAgICAgICAgICAgICAgICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9jYWxTdHJlYW0uZ2V0VHJhY2tzKCkuZm9yRWFjaCgodHJhY2spID0+IHBlZXJDb25uZWN0aW9uLmFkZFRyYWNrKHRyYWNrLCBsb2NhbFN0cmVhbSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwZWVyQ29ubmVjdGlvbi5jcmVhdGVBbnN3ZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pLnRoZW4oKGFuc3dlcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFuc3dlckRlc2NyaXB0aW9uID0gYW5zd2VyO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwZWVyQ29ubmVjdGlvbi5zZXRMb2NhbERlc2NyaXB0aW9uKGFuc3dlckRlc2NyaXB0aW9uKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBlZXJDb25uZWN0aW9uLmFjY2VwdGVkQ2FsbCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VuZEljZUNhbmRpZGF0ZXMoc2VuZGVyLCBwZWVyQ29ubmVjdGlvbiwgY2FsbElkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZW5kZXIuZGlyZWN0LmVtaXQoWyckJyArICd3ZWJSVEMnLCAnY2FsbFJlc3BvbnNlJ10uam9pbignLicpLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYWNjZXB0Q2FsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGFuc3dlckRlc2NyaXB0aW9uXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KS5jYXRjaCgoZXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdDaGF0RW5naW5lIFdlYlJUQyBQbHVnaW46IFtpbmNvbWluZ0NhbGxdJywgZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgc2VuZGVyLmRpcmVjdC5lbWl0KFsnJCcgKyAnd2ViUlRDJywgJ2NhbGxSZXNwb25zZSddLmpvaW4oJy4nKSwge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbElkLFxuICAgICAgICAgICAgICAgICAgICAgICAgYWNjZXB0Q2FsbFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMucGFyZW50T25JbmNvbWluZ0NhbGwoc2VuZGVyLnV1aWQsIGNhbGxSZXNwb25zZUNhbGxiYWNrKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGluY29taW5nSWNlQ2FuZGlkYXRlKHBheWxvYWQpIHtcbiAgICAgICAgICAgIGNvbnN0IHsgY2FsbElkLCBjYW5kaWRhdGVzIH0gPSBwYXlsb2FkLmRhdGE7XG5cbiAgICAgICAgICAgIGNvbnNvbGUubG9nKHR5cGVvZiBjYW5kaWRhdGVzLCBjYW5kaWRhdGVzKTtcblxuICAgICAgICAgICAgaWYgKCF0aGlzLmNhbGxDYWNoZVtjYWxsSWRdIHx8IHR5cGVvZiBjYW5kaWRhdGVzICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY2FuZGlkYXRlcy5mb3JFYWNoKChjYW5kaWRhdGUpID0+IHtcbiAgICAgICAgICAgICAgICAvL2JvdW5jZSBhbGwgbm9uIFRVUk5cbiAgICAgICAgICAgICAgICBpZiAoYm91bmNlTm9uVHVybiAmJiBjYW5kaWRhdGUuY2FuZGlkYXRlLmluZGV4T2YoJ3R5cCByZWxheScpID09PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnYm91bmNpbmcnLCBjYW5kaWRhdGUuY2FuZGlkYXRlKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKHRydWUpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsQ2FjaGVbY2FsbElkXS5hZGRJY2VDYW5kaWRhdGUoY2FuZGlkYXRlKVxuICAgICAgICAgICAgICAgICAgICAuY2F0Y2goKGVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdDaGF0RW5naW5lIFdlYlJUQyBQbHVnaW46IFtpbmNvbWluZ0ljZUNhbmRpZGF0ZV0nLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBvbkRpc2Nvbm5lY3QoY2FsbElkLCB1c2VyVXVpZCkge1xuICAgICAgICAgICAgdGhpcy5jYWxsQ2FjaGVbY2FsbElkXS5jbG9zZSgpO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuY2FsbENhY2hlW2NhbGxJZF07XG4gICAgICAgICAgICB0aGlzLnBhcmVudE9uQ2FsbERpc2Nvbm5lY3QodXNlclV1aWQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgbGV0IGVtaXQgPSB7fTtcblxuICAgIHJldHVybiB7XG4gICAgICAgIG5hbWVzcGFjZTogJ3dlYlJUQycsXG4gICAgICAgIGV4dGVuZHM6IHtcbiAgICAgICAgICAgIENoYXQ6IGV4dGVuc2lvblxuICAgICAgICB9LFxuICAgICAgICBtaWRkbGV3YXJlOiB7fVxuICAgIH1cbn07Il19

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
            let peerConnection = new RTCPeerConnection();
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
                    let peerConnection = new RTCPeerConnection();
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

                    // localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy5udm0vdmVyc2lvbnMvbm9kZS92OC4xMS4yL2xpYi9ub2RlX21vZHVsZXMvY2hhdC1lbmdpbmUtcGx1Z2luL25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIudG1wL3dyYXAuanMiLCJwYWNrYWdlLmpzb24iLCJzcmMvcGx1Z2luLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCIoZnVuY3Rpb24oKSB7XG5cbiAgICBjb25zdCBwYWNrYWdlID0gcmVxdWlyZSgnLi4vcGFja2FnZS5qc29uJyk7XG4gICAgd2luZG93LkNoYXRFbmdpbmVDb3JlLnBsdWdpbltwYWNrYWdlLm5hbWVdID0gcmVxdWlyZSgnLi4vc3JjL3BsdWdpbi5qcycpO1xuXG59KSgpO1xuIiwibW9kdWxlLmV4cG9ydHM9e1xuICBcImF1dGhvclwiOiBcIkFkYW0gQmF2b3NhXCIsXG4gIFwibmFtZVwiOiBcImNoYXQtZW5naW5lLXdlYnJ0Y1wiLFxuICBcInZlcnNpb25cIjogXCIwLjAuMVwiLFxuICBcIm1haW5cIjogXCJzcmMvcGx1Z2luLmpzXCIsXG4gIFwiZGVwZW5kZW5jaWVzXCI6IHtcbiAgICBcImNoYXQtZW5naW5lXCI6IFwiXjAuOS4xOFwiXG4gIH1cbn1cbiIsIi8qXG4gKlxuICovXG5cbmZ1bmN0aW9uIHV1aWQoKSB7XG4gICAgZnVuY3Rpb24gczQoKSB7XG4gICAgICAgIHJldHVybiBNYXRoLmZsb29yKCgxICsgTWF0aC5yYW5kb20oKSkgKiAweDEwMDAwKVxuICAgICAgICAgICAgLnRvU3RyaW5nKDE2KVxuICAgICAgICAgICAgLnN1YnN0cmluZygxKTtcbiAgICB9XG4gICAgcmV0dXJuIHM0KCkgKyBzNCgpICsgJy0nICsgczQoKSArICctJyArIHM0KCkgKyAnLScgKyBzNCgpICsgJy0nICsgczQoKSArIHM0KCkgKyBzNCgpO1xufVxuXG5mdW5jdGlvbiBvbkluY29taW5nQ2FsbE5vdERlZmluZWQoY2FsbGJhY2spIHtcbiAgICBjb25zb2xlLmVycm9yKCdDaGF0RW5naW5lIFdlYlJUQyBQbHVnaW46IFtvbkluY29taW5nQ2FsbF0gSW5jb21pbmcgY2FsbCBldmVudCBoYW5kbGVyIGlzIG5vdCBkZWZpbmVkLicpO1xuICAgIGNhbGxiYWNrKGZhbHNlKTtcbn1cblxuZnVuY3Rpb24gb25DYWxsUmVzcG9uc2VOb3REZWZpbmVkKCkge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0NoYXRFbmdpbmUgV2ViUlRDIFBsdWdpbjogW29uQ2FsbFJlc3BvbnNlXSBDYWxsIHJlc3BvbnNlIGV2ZW50IGhhbmRsZXIgaXMgbm90IGRlZmluZWQuJyk7XG59XG5cbmZ1bmN0aW9uIG9uQ2FsbERpc2Nvbm5lY3ROb3REZWZpbmVkKCkge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0NoYXRFbmdpbmUgV2ViUlRDIFBsdWdpbjogW29uQ2FsbERpc2Nvbm5lY3RdIENhbGwgZGlzY29ubmVjdCBldmVudCBoYW5kbGVyIGlzIG5vdCBkZWZpbmVkLicpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IChjb25maWcpID0+IHtcbiAgICBjbGFzcyBleHRlbnNpb24ge1xuICAgICAgICBjb25zdHJ1Y3QoKSB7XG4gICAgICAgICAgICAvLyBIb2xkcyBSVENQZWVyQ29ubmVjdGlvbiBvYmplY3RzIGZvciBlYWNoIGNhbGwuIEtleSBpcyB0aGUgY2FsbCBJRCAoYSBVVUlEKS5cbiAgICAgICAgICAgIHRoaXMuY2FsbENhY2hlID0ge307XG5cbiAgICAgICAgICAgIC8vIFtjb25maWcub25JbmNvbWluZ0NhbGxdIG11c3QgYmUgZGVmaW5lZCBvbiBpbml0LCBvdGhlcndpc2UgaW5jb21pbmcgY2FsbCBldmVudCB3aWxsIGxvZyBhbiBlcnJvci5cbiAgICAgICAgICAgIC8vIFRoZSBldmVudCBpcyBtZWFudCB0byB0cmlnZ2VyIFVJIGZvciB0aGUgdXNlciB0byBhY2NlcHQgb3IgcmVqZWN0IGFuIGluY29taW5nIGNhbGwuXG4gICAgICAgICAgICB0aGlzLnBhcmVudE9uSW5jb21pbmdDYWxsID0gY29uZmlnLm9uSW5jb21pbmdDYWxsIHx8IG9uSW5jb21pbmdDYWxsTm90RGVmaW5lZDtcblxuICAgICAgICAgICAgLy8gW2NvbmZpZy5vbkNhbGxSZXNwb25zZV0gbXVzdCBiZSBkZWZpbmVkIG9uIGluaXQsIG90aGVyd2lzZSBjYWxsIHJlc3BvbnNlIGV2ZW50IHdpbGwgbG9nIGFuIGVycm9yLlxuICAgICAgICAgICAgLy8gVGhlIGV2ZW50IGlzIG1lYW50IHRvIGdpdmUgdGhlIHVzZXIgYW4gb3Bwb3J0dW5pdHkgdG8gaGFuZGxlIGEgY2FsbCByZXNwb25zZS5cbiAgICAgICAgICAgIHRoaXMucGFyZW50T25DYWxsUmVzcG9uc2UgPSBjb25maWcub25DYWxsUmVzcG9uc2UgfHwgb25DYWxsUmVzcG9uc2VOb3REZWZpbmVkO1xuXG4gICAgICAgICAgICAvLyBbY29uZmlnLm9uQ2FsbERpc2Nvbm5lY3RdIG11c3QgYmUgZGVmaW5lZCBvbiBpbml0LCBvdGhlcndpc2UgZGlzY29ubmVjdCBjYWxsIGV2ZW50IHdpbGwgbG9nIGFuIGVycm9yLlxuICAgICAgICAgICAgLy8gVGhlIGV2ZW50IGlzIG1lYW50IHRvIG5vdGlmeSB0aGUgdXNlciB0aGF0IHRoZSBjYWxsIGhhcyBlbmRlZCBpbiB0aGUgVUkuXG4gICAgICAgICAgICB0aGlzLnBhcmVudE9uQ2FsbERpc2Nvbm5lY3QgPSBjb25maWcub25DYWxsRGlzY29ubmVjdCB8fCBvbkNhbGxEaXNjb25uZWN0Tm90RGVmaW5lZDtcblxuICAgICAgICAgICAgLy8gVmlkZW8gYW5kIGF1ZGlvIHN0cmVhbSBmcm9tIGxvY2FsIGNsaWVudCBjYW1lcmEgYW5kIG1pY3JvcGhvbmUuXG4gICAgICAgICAgICAvLyBPcHRpb25hbCB0byBwYXNzIG5vdywgY2FuIGJlIHBhc3NlZCBsYXRlciB3aGVuIGEgY2FsbCBpcyBhY2NlcHRlZC5cbiAgICAgICAgICAgIHRoaXMubG9jYWxTdHJlYW0gPSBjb25maWcubG9jYWxTdHJlYW07XG5cbiAgICAgICAgICAgIC8vIENoYXRFbmdpbmUgRGlyZWN0IGV2ZW50IGhhbmRsZXIgZm9yIGluY29taW5nIGNhbGwgcmVxdWVzdHMuXG4gICAgICAgICAgICB0aGlzLkNoYXRFbmdpbmUubWUuZGlyZWN0Lm9uKFsnJCcgKyAnd2ViUlRDJywgJ2luY29taW5nQ2FsbCddLmpvaW4oJy4nKSwgKHBheWxvYWQpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLmluY29taW5nQ2FsbChwYXlsb2FkKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBDaGF0RW5naW5lIERpcmVjdCBldmVudCBoYW5kbGVyIGZvciBjYWxsIHJlc3BvbnNlcy5cbiAgICAgICAgICAgIHRoaXMuQ2hhdEVuZ2luZS5tZS5kaXJlY3Qub24oWyckJyArICd3ZWJSVEMnLCAnY2FsbFJlc3BvbnNlJ10uam9pbignLicpLCAocGF5bG9hZCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuY2FsbFJlc3BvbnNlKHBheWxvYWQpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIENoYXRFbmdpbmUgRGlyZWN0IGV2ZW50IGhhbmRsZXIgZm9yIG5ldyBJQ0UgY2FuZGlkYXRlcyBmb3IgUlRDUGVlckNvbm5lY3Rpb24gb2JqZWN0LlxuICAgICAgICAgICAgLy8gV2ViUlRDIGNsaWVudCB0ZWxscyB0aGUgcmVtb3RlIGNsaWVudCB0aGVpciBJQ0UgY2FuZGlkYXRlcyB0aHJvdWdoIHRoaXMgc2lnbmFsLlxuICAgICAgICAgICAgdGhpcy5DaGF0RW5naW5lLm1lLmRpcmVjdC5vbihbJyQnICsgJ3dlYlJUQycsICdpbmNvbWluZ0ljZUNhbmRpZGF0ZSddLmpvaW4oJy4nKSwgKHBheWxvYWQpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLmluY29taW5nSWNlQ2FuZGlkYXRlKHBheWxvYWQpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBjYWxsVXNlcih1c2VyLCBvblJlbW90ZVZpZGVvU3RyZWFtQXZhaWxhYmxlLCBsb2NhbFN0cmVhbSkge1xuICAgICAgICAgICAgaWYgKHVzZXIubmFtZSA9PT0gJ01lJykge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0NoYXRFbmdpbmUgV2ViUlRDIFBsdWdpbjogW2NhbGxVc2VyXSBDYWxsaW5nIHNlbGYgaXMgbm90IGFsbG93ZWQuJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBJZiB0aGUgbG9jYWwgc3RyZWFtIGlzIG5vdCBwYXNzZWQgb24gcGx1Z2luIGluaXQsIGl0IGNhbiBiZSBwYXNzZWQgaGVyZS5cbiAgICAgICAgICAgIGxvY2FsU3RyZWFtID0gbG9jYWxTdHJlYW0gfHwgdGhpcy5sb2NhbFN0cmVhbTtcbiAgICAgICAgICAgIGxldCBjYWxsSWQgPSB1dWlkKCk7XG4gICAgICAgICAgICBsZXQgcGVlckNvbm5lY3Rpb24gPSBuZXcgUlRDUGVlckNvbm5lY3Rpb24oKTtcbiAgICAgICAgICAgIHRoaXMuY2FsbENhY2hlW2NhbGxJZF0gPSBwZWVyQ29ubmVjdGlvbjtcblxuICAgICAgICAgICAgcGVlckNvbm5lY3Rpb24ub25pY2Vjb25uZWN0aW9uc3RhdGVjaGFuZ2UgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHBlZXJDb25uZWN0aW9uLmljZUNvbm5lY3Rpb25TdGF0ZSA9PT0gJ2Rpc2Nvbm5lY3RlZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5vbkRpc2Nvbm5lY3QoY2FsbElkLCB1c2VyLnV1aWQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIC8vIFNldCBsb2NhbCBhbmQgcmVtb3RlIHZpZGVvIGFuZCBhdWRpbyBzdHJlYW1zIHRvIHBlZXIgY29ubmVjdGlvbiBvYmplY3QuXG4gICAgICAgICAgICBwZWVyQ29ubmVjdGlvbi5vbnRyYWNrID0gb25SZW1vdGVWaWRlb1N0cmVhbUF2YWlsYWJsZTtcbiAgICAgICAgICAgIHBlZXJDb25uZWN0aW9uLmFkZFN0cmVhbShsb2NhbFN0cmVhbSk7XG5cbiAgICAgICAgICAgIC8vIFdoZW4gSUNFIGNhbmRpZGF0ZXMgYmVjb21lIGF2YWlsYWJsZSwgc2VuZCB0aGVtIHRvIHRoZSByZW1vdGUgY2xpZW50LlxuICAgICAgICAgICAgcGVlckNvbm5lY3Rpb24ub25pY2VjYW5kaWRhdGUgPSAoaWNlRXZlbnQpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoaWNlRXZlbnQuY2FuZGlkYXRlKSB7XG4gICAgICAgICAgICAgICAgICAgIHVzZXIuZGlyZWN0LmVtaXQoWyckJyArICd3ZWJSVEMnLCAnaW5jb21pbmdJY2VDYW5kaWRhdGUnXS5qb2luKCcuJyksIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbmRpZGF0ZTogaWNlRXZlbnQuY2FuZGlkYXRlXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGxldCBsb2NhbERlc2NyaXB0aW9uOyAvLyBXZWJSVEMgbG9jYWwgZGVzY3JpcHRpb25cbiAgICAgICAgICAgIHBlZXJDb25uZWN0aW9uLm9ubmVnb3RpYXRpb25uZWVkZWQgPSAob25lLCB0d28sIHRocmVlKSA9PiB7XG4gICAgICAgICAgICAgICAgcGVlckNvbm5lY3Rpb24uY3JlYXRlT2ZmZXIoKVxuICAgICAgICAgICAgICAgIC50aGVuKChkZXNjcmlwdGlvbikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBsb2NhbERlc2NyaXB0aW9uID0gZGVzY3JpcHRpb247XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBwZWVyQ29ubmVjdGlvbi5zZXRMb2NhbERlc2NyaXB0aW9uKGxvY2FsRGVzY3JpcHRpb24pO1xuICAgICAgICAgICAgICAgIH0pLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB1c2VyLmRpcmVjdC5lbWl0KFsnJCcgKyAnd2ViUlRDJywgJ2luY29taW5nQ2FsbCddLmpvaW4oJy4nKSwge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbElkLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGxvY2FsRGVzY3JpcHRpb25cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSkuY2F0Y2goKGVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0NoYXRFbmdpbmUgV2ViUlRDIFBsdWdpbjogW2NhbGxVc2VyXScsIGVycm9yKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBjYWxsUmVzcG9uc2UocGF5bG9hZCkge1xuICAgICAgICAgICAgY29uc3Qge2NhbGxJZCwgYWNjZXB0Q2FsbCwgZGVzY3JpcHRpb259ID0gcGF5bG9hZC5kYXRhO1xuICAgICAgICAgICAgbGV0IHNlbmRlciA9IHBheWxvYWQuc2VuZGVyO1xuXG4gICAgICAgICAgICBpZiAoYWNjZXB0Q2FsbCkge1xuICAgICAgICAgICAgICAgIC8vIFdoZW4gYSB1c2VyIGFjY2VwdHMgYSBjYWxsLCB0aGV5IHNlbmQgdGhlaXIgV2ViUlRDIHBlZXIgY29ubmVjdGlvbiBkZXNjcmlwdGlvbi5cbiAgICAgICAgICAgICAgICAvLyBTZXQgaXQgbG9jYWxseSBhcyB0aGUgcmVtb3RlIGNsaWVudCdzIHBlZXIgY29ubmVjdGlvbiBkZXNjcmlwdGlvbi5cbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxDYWNoZVtjYWxsSWRdLnNldFJlbW90ZURlc2NyaXB0aW9uKGRlc2NyaXB0aW9uKVxuICAgICAgICAgICAgICAgIC5jYXRjaCgoZXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignQ2hhdEVuZ2luZSBXZWJSVEMgUGx1Z2luOiBbY2FsbFJlc3BvbnNlXScsIGVycm9yKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5wYXJlbnRPbkNhbGxSZXNwb25zZShzZW5kZXIudXVpZCwgYWNjZXB0Q2FsbCk7XG4gICAgICAgIH1cblxuICAgICAgICBpbmNvbWluZ0NhbGwocGF5bG9hZCkge1xuICAgICAgICAgICAgY29uc3Qgc2VuZGVyID0gcGF5bG9hZC5zZW5kZXI7XG4gICAgICAgICAgICBjb25zdCB7IGNhbGxJZCB9ID0gcGF5bG9hZC5kYXRhO1xuICAgICAgICAgICAgY29uc3QgcmVtb3RlRGVzY3JpcHRpb24gPSBwYXlsb2FkLmRhdGEuZGVzY3JpcHRpb247XG5cbiAgICAgICAgICAgIC8vIFNob3VsZCBiZSBleGVjdXRlZCBhZnRlciB0aGlzIGNsaWVudCBhY2NlcHRzIG9yIHJlamVjdHMgYW4gaW5jb21pbmcgY2FsbC5cbiAgICAgICAgICAgIGNvbnN0IGNhbGxSZXNwb25zZUNhbGxiYWNrID0gKGFjY2VwdENhbGwsIG9uUmVtb3RlVmlkZW9TdHJlYW1BdmFpbGFibGUsIGxvY2FsU3RyZWFtKSA9PiB7XG4gICAgICAgICAgICAgICAgbG9jYWxTdHJlYW0gPSBsb2NhbFN0cmVhbSB8fCB0aGlzLmxvY2FsU3RyZWFtO1xuXG4gICAgICAgICAgICAgICAgaWYgKGFjY2VwdENhbGwpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBvblJlbW90ZVZpZGVvU3RyZWFtQXZhaWxhYmxlICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdDaGF0RW5naW5lIFdlYlJUQyBQbHVnaW46IFtpbmNvbWluZ0NhbGxdIG9uUmVtb3RlVmlkZW9TdHJlYW1BdmFpbGFibGUgaGFuZGxlciBpcyBub3QgZGVmaW5lZC4nKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgbG9jYWxTdHJlYW0gIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdDaGF0RW5naW5lIFdlYlJUQyBQbHVnaW46IExvY2FsIHZpZGVvIHN0cmVhbSBvYmplY3QgaXMgbm90IGRlZmluZWQuJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBsZXQgYW5zd2VyRGVzY3JpcHRpb247XG4gICAgICAgICAgICAgICAgICAgIGxldCBwZWVyQ29ubmVjdGlvbiA9IG5ldyBSVENQZWVyQ29ubmVjdGlvbigpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNhbGxDYWNoZVtjYWxsSWRdID0gcGVlckNvbm5lY3Rpb247XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gV2hlbiBJQ0UgY2FuZGlkYXRlcyBiZWNvbWUgYXZhaWxhYmxlLCBzZW5kIHRoZW0gdG8gdGhlIHJlbW90ZSBjbGllbnRcbiAgICAgICAgICAgICAgICAgICAgcGVlckNvbm5lY3Rpb24ub25pY2VjYW5kaWRhdGUgPSAoaWNlRXZlbnQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpY2VFdmVudC5jYW5kaWRhdGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZW5kZXIuZGlyZWN0LmVtaXQoWyckJyArICd3ZWJSVEMnLCAnaW5jb21pbmdJY2VDYW5kaWRhdGUnXS5qb2luKCcuJyksIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbElkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYW5kaWRhdGU6IGljZUV2ZW50LmNhbmRpZGF0ZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgICAgIHBlZXJDb25uZWN0aW9uLm9uaWNlY29ubmVjdGlvbnN0YXRlY2hhbmdlID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHBlZXJDb25uZWN0aW9uLmljZUNvbm5lY3Rpb25TdGF0ZSA9PT0gJ2Rpc2Nvbm5lY3RlZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm9uRGlzY29ubmVjdChjYWxsSWQsIHNlbmRlci51dWlkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBsb2NhbFN0cmVhbS5nZXRUcmFja3MoKS5mb3JFYWNoKCh0cmFjaykgPT4gcGVlckNvbm5lY3Rpb24uYWRkVHJhY2sodHJhY2ssIGxvY2FsU3RyZWFtKSk7XG5cbiAgICAgICAgICAgICAgICAgICAgcGVlckNvbm5lY3Rpb24ub250cmFjayA9IG9uUmVtb3RlVmlkZW9TdHJlYW1BdmFpbGFibGU7XG4gICAgICAgICAgICAgICAgICAgIHBlZXJDb25uZWN0aW9uLnNldFJlbW90ZURlc2NyaXB0aW9uKHJlbW90ZURlc2NyaXB0aW9uKVxuICAgICAgICAgICAgICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcGVlckNvbm5lY3Rpb24uYWRkU3RyZWFtKGxvY2FsU3RyZWFtKTtcbiAgICAgICAgICAgICAgICAgICAgfSkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcGVlckNvbm5lY3Rpb24uY3JlYXRlQW5zd2VyKCk7XG4gICAgICAgICAgICAgICAgICAgIH0pLnRoZW4oKGFuc3dlcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgYW5zd2VyRGVzY3JpcHRpb24gPSBhbnN3ZXI7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcGVlckNvbm5lY3Rpb24uc2V0TG9jYWxEZXNjcmlwdGlvbihhbnN3ZXJEZXNjcmlwdGlvbik7XG4gICAgICAgICAgICAgICAgICAgIH0pLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VuZGVyLmRpcmVjdC5lbWl0KFsnJCcgKyAnd2ViUlRDJywgJ2NhbGxSZXNwb25zZSddLmpvaW4oJy4nKSwge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhY2NlcHRDYWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBhbnN3ZXJEZXNjcmlwdGlvblxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0pLmNhdGNoKChlcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignQ2hhdEVuZ2luZSBXZWJSVEMgUGx1Z2luOiBbaW5jb21pbmdDYWxsXScsIGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgc2VuZGVyLmRpcmVjdC5lbWl0KFsnJCcgKyAnd2ViUlRDJywgJ2NhbGxSZXNwb25zZSddLmpvaW4oJy4nKSwge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbElkLFxuICAgICAgICAgICAgICAgICAgICAgICAgYWNjZXB0Q2FsbFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMucGFyZW50T25JbmNvbWluZ0NhbGwoc2VuZGVyLnV1aWQsIGNhbGxSZXNwb25zZUNhbGxiYWNrKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGluY29taW5nSWNlQ2FuZGlkYXRlKHBheWxvYWQpIHtcbiAgICAgICAgICAgIGNvbnN0IHsgY2FsbElkLCBjYW5kaWRhdGUgfSA9IHBheWxvYWQuZGF0YTtcblxuICAgICAgICAgICAgY29uc29sZS5sb2coJ2luY29taW5nSWNlQ2FuZGlkYXRlJywgY2FuZGlkYXRlLnNkcE1pZCwgY2FuZGlkYXRlLmNhbmRpZGF0ZSwgKTtcblxuICAgICAgICAgICAgaWYgKCF0aGlzLmNhbGxDYWNoZVtjYWxsSWRdIHx8IHR5cGVvZiBjYW5kaWRhdGUgIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLmNhbGxDYWNoZVtjYWxsSWRdLmFkZEljZUNhbmRpZGF0ZShjYW5kaWRhdGUpXG4gICAgICAgICAgICAuY2F0Y2goKGVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignQ2hhdEVuZ2luZSBXZWJSVEMgUGx1Z2luOiBbaW5jb21pbmdJY2VDYW5kaWRhdGVdJywgZXJyb3IpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBvbkRpc2Nvbm5lY3QoY2FsbElkLCB1c2VyVXVpZCkge1xuICAgICAgICAgICAgdGhpcy5jYWxsQ2FjaGVbY2FsbElkXS5jbG9zZSgpO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuY2FsbENhY2hlW2NhbGxJZF07XG4gICAgICAgICAgICB0aGlzLnBhcmVudE9uQ2FsbERpc2Nvbm5lY3QodXNlclV1aWQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgbGV0IGVtaXQgPSB7fTtcblxuICAgIHJldHVybiB7XG4gICAgICAgIG5hbWVzcGFjZTogJ3dlYlJUQycsXG4gICAgICAgIGV4dGVuZHM6IHtcbiAgICAgICAgICAgIENoYXQ6IGV4dGVuc2lvblxuICAgICAgICB9LFxuICAgICAgICBtaWRkbGV3YXJlOiB7fVxuICAgIH1cbn07XG4iXX0=

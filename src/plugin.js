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
        'credential': 'x',
        'username': 'x'
    }]
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
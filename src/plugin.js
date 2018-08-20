
function uuid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

function onIncomingCallNotDefined(callback) {
    console.error('ChatEngine.webRTC: Incoming call handler is not defined in config.');
    callback(false);
}

function onCallResponseNotDefined() {
    console.error('ChatEngine.webRTC: Incoming call response handler is not defined in config.');
}

module.exports = (config) => {
    class extension {
        construct() {
            // Holds call response on client, checks this before accepting a peer stream
            this.callResponseCache = {};

            this.callCache = {};

            // [config.onIncomingCall] must be defined on init, otherwise incoming call will log an error.
            // The event is meant to give the user an opportunity to respond to a call in the UI.
            this.parentOnIncomingCall = config.onIncomingCall || onIncomingCallNotDefined;

            // Video stream from local client camera
            // Optional to pass now, can be passed when a call is accepted
            this.localStream = config.localStream;

            // [config.onCallResponse] must be defined on init, otherwise incoming call response will log an error.
            // The event is meant to give the user an opportunity to handle a call response.
            this.parentOnCallResponse = config.onCallResponse || onCallResponseNotDefined;

            this.ChatEngine.me.direct.on(['$' + 'webRTC', 'incomingCall'].join('.'), (payload) => {
                this.incomingCall(payload);
            });

            this.ChatEngine.me.direct.on(['$' + 'webRTC', 'callResponse'].join('.'), (payload) => {
                this.callResponse(payload);
            });

            this.ChatEngine.me.direct.on(['$' + 'webRTC', 'incomingIceCandidate'].join('.'), (payload) => {
                this.incomingIceCandidate(payload);
            });
        }

        // connected() {
        //     this.parent.emit(['$' + 'webRTC', 'connected'].join('.'));
        // }

        callUser(user, localStream, onRemoteVideoStreamAvailable) {
            if (user.name !== 'Me') {
                localStream = localStream || this.localStream;
                console.log('localstream', localStream);
                let callId = uuid();

                let peerConnection = new RTCPeerConnection();
                this.callCache[callId] = peerConnection;
                peerConnection.ontrack = onRemoteVideoStreamAvailable;

                localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

                let localDescription;

                peerConnection.createOffer()
                .then((description) => {
                    localDescription = description;
                    return peerConnection.setLocalDescription(localDescription);
                }).then(() => {
                    user.direct.emit(['$' + 'webRTC', 'incomingCall'].join('.'), {
                        callId,
                        stream: localStream,
                        description: localDescription
                    });
                }).catch((error) => { console.error('createOffer error:', error) });
            }
        }

        callResponse(payload) {
            const {callId, acceptCall, description} = payload.data;
            const remoteStream = payload.data.stream;
            let sender = payload.sender;

            if (acceptCall) {
                // when ice candidates are available for PC, send them to the remote client
                this.callCache[callId].onicecandidate = (iceEvent) => {
                    if (iceEvent.candidate) {
                        sender.direct.emit(['$' + 'webRTC', 'incomingIceCandidate'].join('.'), {
                            callId,
                            candidate: iceEvent.candidate
                        });
                    }
                };

                this.callCache[callId].setRemoteDescription(description)
                .catch((error) => {console.error(error);});
            }

            this.parentOnCallResponse(sender.uuid, acceptCall, remoteStream);
        }

        incomingCall(payload) {
            console.log('incomingCall', payload);
            const sender = payload.sender;
            const { callId } = payload.data;
            const remoteDescription = payload.data.description;
            // const remoteStream = payload.data.stream;

            // Callback is only called to open the call 2 ways.
            // Otherwise, don't call this from parent.
            const callResponseCallback = (acceptCall, localStream, onRemoteVideoStreamAvailable) => {
                localStream = localStream || this.localStream;
                if (acceptCall) {
                    // add error throws for the latter 2 function params
                    let answerDescription;
                    let peerConnection = new RTCPeerConnection();
                    this.callCache[callId] = peerConnection;
                    
                    // when ice candidates are available for PC, send them to the remote client
                    this.callCache[callId].onicecandidate = (iceEvent) => {
                        if (iceEvent.candidate) {
                            sender.direct.emit(['$' + 'webRTC', 'incomingIceCandidate'].join('.'), {
                                callId,
                                candidate: iceEvent.candidate
                            });
                        }
                    };

                    peerConnection.addStream(localStream);
                    peerConnection.ontrack = onRemoteVideoStreamAvailable;
                    peerConnection.setRemoteDescription(remoteDescription).then(() => {
                        return peerConnection.createAnswer();
                    }).then((answer) => {
                        answerDescription = answer;
                        console.log('answerDescription', answerDescription)
                        return peerConnection.setLocalDescription(answerDescription);
                    }).then(() => {
                        sender.direct.emit(['$' + 'webRTC', 'callResponse'].join('.'), {
                            callId,
                            acceptCall,
                            stream: localStream,
                            description: answerDescription
                        });
                    }).catch(error => {console.error('setRemoteDescription error:', error);});
                } else {
                    sender.direct.emit(['$' + 'webRTC', 'callResponse'].join('.'), {
                        callId,
                        acceptCall,
                        stream: localStream
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
            .catch(error => {
                console.error('incomingIceCandidate Error: ', error);
            });
        }
    }

    let emit = {
        // connected: (payload, next) => {
        //     payload.chat.webRTC.connected();
        //     next(null, payload);
        // },
    };

    return {
        namespace: 'webRTC',
        extends: {
            Chat: extension
        },
        middleware: {
            emit
        }
    }
};

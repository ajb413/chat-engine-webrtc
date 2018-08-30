/**
 * @file ChatEngine plugin for WebRTC video and audio calling.
 * @author Adam Bavosa <adamb@pubnub.com>
 */

import {
    uuid,
    onIceCandidate,
    sendIceCandidates,
    peerIceCandidate,
    eventNames
} from './helpers/util.js';

import {
    onIncomingCallNotDefined,
    onCallResponseNotDefined,
    onPeerStreamNotDefined,
    onDisconnectNotDefined
} from './helpers/error-handlers.js';

const incomingCallEvent = eventNames.incomingCallEvent;
const callResponseEvent = eventNames.callResponseEvent;
const peerIceCandidateEvent = eventNames.peerIceCandidateEvent;
let config;

class WebRtcPhone {
    construct() {
        this.onIncomingCall = config.onIncomingCall || onIncomingCallNotDefined;
        this.onCallResponse = config.onCallResponse || onCallResponseNotDefined;
        this.onPeerStream = config.onPeerStream || onPeerStreamNotDefined;
        this.onDisconnect = config.onDisconnect || onDisconnectNotDefined;
        this.myStream = config.myStream;
        this.ignoreNonTurn = config.ignoreNonTurn;

        // ChatEngine Direct event handler for incoming call requests.
        this.ChatEngine.me.direct.on(incomingCallEvent, (payload) => {
            this.incomingCall(payload);
        });

        // ChatEngine Direct event handler for call responses.
        this.ChatEngine.me.direct.on(callResponseEvent, (payload) => {
            this.callResponse(payload);
        });

        // ChatEngine Direct event handler for new ICE candidates for RTCPeerConnection object.
        // WebRTC client tells the remote client their ICE candidates through this signal.
        this.ChatEngine.me.direct.on(peerIceCandidateEvent, (payload) => {
            peerIceCandidate(payload, this.peerConnection, this.ignoreNonTurn);
        });
    }

    callUser(user, {onPeerStream, myStream, offerOptions, rtcConfig}) {
        myStream = this.myStream = myStream || this.myStream;
        onPeerStream = this.onPeerStream = onPeerStream || this.onPeerStream;
        offerOptions = offerOptions || {
            offerToReceiveAudio: 1,
            offerToReceiveVideo: 1
        };
        const peerConnection = this.peerConnection
            = new RTCPeerConnection(rtcConfig);
        const callId = this.callId = uuid(); // Call ID
        let localDescription; // WebRTC local description
        peerConnection.ontrack = onPeerStream;
        myStream.getTracks().forEach((track) => peerConnection.addTrack(track, myStream));
        peerConnection.iceCache = [];

        peerConnection.oniceconnectionstatechange = () => {
            if (peerConnection.iceConnectionState === 'disconnected') {
                this.disconnect();
            }
        };

        // When ICE candidates become available, send them to the remote client.
        peerConnection.onicecandidate = (iceEvent) => {
            if (!iceEvent.candidate) {
                return;
            }
            onIceCandidate(iceEvent, user, peerConnection, callId);
        };

        peerConnection.onnegotiationneeded = () => {
            peerConnection.createOffer(offerOptions)
            .then((description) => {
                localDescription = description;
                return peerConnection.setLocalDescription(localDescription);
            }).then(() => {
                user.direct.emit(['$' + 'webRTC', 'incomingCall'].join('.'), {
                    callId,
                    description: localDescription
                });
            }).catch((error) => {
                const functionName = 'callUser';
                const message = `WebRTC [${functionName}] error.`;
                this.ChatEngine.throwError(this, functionName, 'webRTC', new Error(message), { error });
            });
        };
    }

    callResponse(payload) {
        const { callId, acceptedCall, description } = payload.data;
        let sender = payload.sender;

        if (acceptedCall) {
            this.peerConnection.acceptedCall = true;
            this.callInSession = true;

            // When a user accepts a call, they send their WebRTC peer connection description.
            // Set it locally as the remote client's peer connection description.
            this.peerConnection.setRemoteDescription(description)
                .then(() => {
                    sendIceCandidates(sender, this.peerConnection, callId);
                })
                .catch((error) => {
                    const functionName = 'callResponse';
                    const message = `WebRTC [${functionName}] error.`;
                    this.ChatEngine.throwError(this, functionName, 'webRTC', new Error(message), { error });
                });
        }

        this.onCallResponse(acceptedCall);
    }

    incomingCall(payload) {
        const sender = payload.sender;
        const { callId } = payload.data;
        const remoteDescription = payload.data.description;

        // Should be executed after this client accepts or rejects an incoming call.
        const callResponseCallback = ({acceptedCall, onPeerStream, myStream, rtcConfig}) => {
            myStream = this.myStream = myStream || this.myStream;
            onPeerStream = onPeerStream || this.onPeerStream;

            if (acceptedCall) {
                if (typeof myStream !== 'object') {
                    const functionName = 'incomingCall';
                    const message = `WebRTC [${functionName}]: No local video stream defined.`;
                    this.ChatEngine.throwError(this, functionName, 'webRTC', new Error(message));
                }

                let answerDescription;
                const peerConnection = this.peerConnection
                    = new RTCPeerConnection(rtcConfig);
                peerConnection.ontrack = onPeerStream;
                peerConnection.iceCache = [];
                myStream.getTracks().forEach((track) => {
                    peerConnection.addTrack(track, myStream);
                });

                peerConnection.oniceconnectionstatechange = () => {
                    if (peerConnection.iceConnectionState === 'disconnected') {
                        this.disconnect();
                    }
                };

                // When ICE candidates become available, send them to the remote client
                peerConnection.onicecandidate = (iceEvent) => {
                    if (!iceEvent.candidate) {
                        return;
                    }

                    onIceCandidate(iceEvent, sender, peerConnection, callId);
                };

                peerConnection.setRemoteDescription(remoteDescription)
                    .then(() => {
                        return peerConnection.createAnswer();
                    }).then((answer) => {
                        answerDescription = answer;
                        return peerConnection.setLocalDescription(answerDescription);
                    }).then(() => {
                        peerConnection.acceptedCall = true;
                        this.callInSession = true;
                        sendIceCandidates(sender, peerConnection, callId);
                        sender.direct.emit(['$' + 'webRTC', 'callResponse'].join('.'), {
                            callId,
                            acceptedCall,
                            description: answerDescription
                        });
                    }).catch((error) => {
                        const functionName = 'incomingCall';
                        const message = `WebRTC [${functionName}] error.`;
                        this.ChatEngine.throwError(this, functionName, 'webRTC', new Error(message), { error });
                    });
            } else {
                sender.direct.emit(['$' + 'webRTC', 'callResponse'].join('.'), {
                    callId,
                    acceptedCall
                });
            }
        }

        this.onIncomingCall(sender, callResponseCallback);
    }

    disconnect() {
        this.peerConnection.close();
        delete this.peerConnection;
        this.callInSession = false;
        this.onDisconnect();
    }
}

module.exports = (cfg = {}) => {
    config = cfg;
    return {
        namespace: 'webRTC',
        extends: {
            Me: WebRtcPhone
        }
    }
};

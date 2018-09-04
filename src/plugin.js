/**
 * @file ChatEngine plugin for WebRTC video and audio calling.
 * @author Adam Bavosa <adamb@pubnub.com>
 */

import {
    onIncomingCallNotDefined,
    onCallResponseNotDefined,
    onPeerStreamNotDefined,
    onDisconnectNotDefined,
    chatEngineError
} from './helpers/error-handlers.js';

import {
    newUuid,
    eventNames
} from './helpers/util.js';

const incomingCallEvent = eventNames.incomingCallEvent;
const callResponseEvent = eventNames.callResponseEvent;
const peerIceCandidateEvent = eventNames.peerIceCandidateEvent;
let config;

/*
 * WebRtcPhone has a `construct` method instead of a conventional `constructor`
 *     method. This is called from within ChatEngine during the plugin init
 *     process. The class extends a ChatEngine type based on the module export's
 *     `extends`. This plugin extends only the instance of the `Me` object in
 *     the ChatEngine instance.
 *
 * @class
 * @classdesc WebRtcPhone can extend any ChatEngine class type and it should be
 *     used as a singleton. By default, it extends the `Me` instance of a
 *     ChatEngine instance using the `plugin` method for initialization. It 
 *     exposes a `callUser` and a `disconnect` method. The instance encapsulates
 *     all the necessary logic and events for orchestrating a WebRTC connection.
 *     The class attempts a peer to peer connection at first. It can fallback to
 *     a TURN connection if server information is provided in the configuration.
 *     All of the WebRTC signaling is done using ChatEngine `direct` events. For
 *     this reason using `on` methods from the parent are not encouraged, so
 *     event handlers like `onIncomingCall`, `onCallResponse`, `onPeerStream`,
 *     and `onDisconnect` need to be passed to ` the class instance. Errors are
 *     logged using `ChatEngine.throwError`.
 */
class WebRtcPhone {
    /*
     * Construct is a method called from ChatEngine during the plugin
     *     initialization process. It extends the object that `plugin` is called
     *     on.
     *
     * @param {function} [onIncomingCall] Function passed from the parent that
     *     executes when a `direct` event fires for an incoming WebRTC call. If
     *     a handler is not passed in the plugin configuration, an error will be
     *     thrown every time the event fires.
     * @param {function} [onCallResponse] Function passed from the parent that
     *     executes when a `direct` event fires for a call reply. If a handler
     *     is not passed in the plugin configuration, an error will be thrown
     *     every time the event fires.
     * @param {function} [onPeerStream] Function passed from the parent that
     *     executes when a the peer's stream object becomes available. If a
     *     handler is not passed in the plugin configuration, an error will be
     *     thrown every time the event fires.
     * @param {function} [onDisconnect] Function passed from the parent that
     *     executes when a user in the call disconnects. If a handler is not
     *     passed in the plugin configuration, an error will be thrown every
     *     time the event fires.
     * @param {object} [myStream] A browser `MediaStream` object of the local
     *     client audio and/or video.
     * @param {object} [rtcConfig] An `RTCConfiguration` dictionary that is used
     *     to initialize the `RTCPeerConnection`. This is where STUN and TURN
     *     server information should be provided.
     * @param {boolean} [ignoreNonTurn] If true, this will force the ICE
     *     candidate registration to ignore all candidates that are not TURN 
     *     servers.
     *
     * @returns {void}
     */
    construct() {
        this.onIncomingCall = config.onIncomingCall || onIncomingCallNotDefined;
        this.onCallResponse = config.onCallResponse || onCallResponseNotDefined;
        this.onPeerStream = config.onPeerStream || onPeerStreamNotDefined;
        this.onDisconnect = config.onDisconnect || onDisconnectNotDefined;
        this.myStream = config.myStream;
        this.rtcConfig = config.rtcConfig;
        this.ignoreNonTurn = config.ignoreNonTurn;

        // ChatEngine Direct event handler for incoming call requests.
        this.ChatEngine.me.direct.on(incomingCallEvent, (payload) => {
            incomingCall.call(this, payload);
        });

        // ChatEngine Direct event handler for call responses.
        this.ChatEngine.me.direct.on(callResponseEvent, (payload) => {
            callResponse.call(this, payload);
        });

        // ChatEngine Direct event handler for receiving new peer ICE candidates
        this.ChatEngine.me.direct.on(peerIceCandidateEvent, (payload) => {
            peerIceCandidate.call(this, payload);
        });
    }

    /*
     * Initialize a WebRTC call with another ChatEngine user that is online.
     *     This is called from parent.
     *
     * @param {object} user ChatEngine user object of the user this client
     *     intends to call.
     * @param {object} object
     * @param {function} object.onPeerStream Event handler for when a peer's
     *     stream becomes available. This will overwrite a handler that was
     *     passed on initialization.
     * @param {object} object.myStream A browser `MediaStream` object of the
     *     local client audio and/or video. This will overwrite a stream that
     *     was passed on initialization.
     * @param {object} object.offerOptions An `RTCOfferOptions` dictionary that
     *     specifies audio and/or video for the peer connection offer.
     * @param {object} object.rtcConfig An `RTCConfiguration` dictionary that is
     *     used to initialize the `RTCPeerConnection`. This will overwrite an
     *     `rtcConfig` that was passed on initialization.
     *
     * @returns {void}
     */
    callUser(user, { onPeerStream, myStream, offerOptions, rtcConfig }) {
        rtcConfig = this.rtcConfig = rtcConfig || this.rtcConfig;
        myStream = this.myStream = myStream || this.myStream;
        onPeerStream = this.onPeerStream = onPeerStream || this.onPeerStream;
        offerOptions = offerOptions || {
            offerToReceiveAudio: 1,
            offerToReceiveVideo: 1
        };
        const peerConnection = this.peerConnection
            = new RTCPeerConnection(rtcConfig);
        const callId = this.callId = newUuid(); // Call ID
        let localDescription; // WebRTC local description
        peerConnection.ontrack = onPeerStream;
        myStream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, myStream);
        });
        peerConnection.iceCache = [];

        peerConnection.oniceconnectionstatechange = () => {
            if (peerConnection.iceConnectionState === 'disconnected') {
                this.disconnect();
            }
        };

        // When ICE candidates become available, send them to the peer client.
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
                user.direct.emit(incomingCallEvent, {
                    callId,
                    rtcConfig,
                    description: localDescription
                });
            }).catch((error) => {
                const functionName = 'callUser';
                const message = `WebRTC [${functionName}] error.`;
                chatEngineError(this.ChatEngine, functionName, message, error);
            });
        };
    }

    /*
     * Gracefully closes the currently open WebRTC call. This is called from
     *     parent.
     *
     * @returns {void}
     */
    disconnect() {
        if (this.peerConnection) {
            this.peerConnection.close();
            delete this.peerConnection;
        }

        this.callInSession = false;
        this.onDisconnect();
    }
}

/*
 * This event fires when the call peer has indicated whether they will accept or
 *     reject an incoming call. The trigger is a ChatEngine `direct` event in
 *     the WebRtcPhone class.
 *
 * @param {object} payload A ChatEngine `direct` event payload.
 *
 * @returns {void}
 */
function callResponse(payload) {
    const { callId, acceptedCall } = payload.data;
    const remoteDescription = payload.data.description;
    let sender = payload.sender;

    if (acceptedCall) {
        this.peerConnection.acceptedCall = true;
        this.callInSession = true;

        this.peerConnection.setRemoteDescription(remoteDescription)
            .then(() => {
                sendIceCandidates(sender, this.peerConnection, callId);
            })
            .catch((error) => {
                const functionName = 'callResponse';
                const message = `WebRTC [${functionName}] error.`;
                chatEngineError(this.ChatEngine, functionName, message, error);
            });
    }

    this.onCallResponse(acceptedCall);
}

/*
 * This event fires when a call peer has attempted to initiate a call. The
 *      trigger is a ChatEngine `direct` event in the WebRtcPhone class.
 *
 * @param {object} payload A ChatEngine `direct` event payload.
 *
 * @returns {void}
 */
function incomingCall(payload) {
    const sender = payload.sender;
    const { callId, rtcConfig } = payload.data;
    const remoteDescription = payload.data.description;

    // Is executed after this client accepts or rejects an incoming call, which
    // is typically done in their UI.
    const callResponseCallback = (params) => {
        let { acceptedCall, onPeerStream, myStream } = params;
        myStream = this.myStream = myStream || this.myStream;
        onPeerStream = onPeerStream || this.onPeerStream;

        if (acceptedCall) {
            if (typeof myStream !== 'object') {
                const functionName = 'incomingCall';
                const message = `WebRTC [${functionName}]:` +
                    `No local video stream defined.`;
                chatEngineError(this.ChatEngine, functionName, message, error);
            }

            let localDescription;
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

            // Send ICE candidates to peer as they come available locally.
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
                    localDescription = answer;
                    return peerConnection.setLocalDescription(localDescription);
                }).then(() => {
                    peerConnection.acceptedCall = true;
                    this.callInSession = true;
                    sendIceCandidates(sender, peerConnection, callId);
                    sender.direct.emit(callResponseEvent, {
                        callId,
                        acceptedCall,
                        description: localDescription
                    });
                }).catch((error) => {
                    const chatEngine = this.ChatEngine;
                    const functionName = 'incomingCall';
                    const message = `WebRTC [${functionName}] error.`;
                    chatEngineError(chatEngine, functionName, message, error);
                });
        } else {
            sender.direct.emit(callResponseEvent, {
                callId,
                acceptedCall
            });
        }
    }

    this.onIncomingCall(sender, callResponseCallback);
}

/*
 * This event fires when the local WebRTC connection has received a new ICE
 *     candidate.
 *
 * @param {object} iceEvent A `RTCPeerConnectionIceEvent` for the local client.
 * @param {object} user A ChatEngine user object for the peer to send the ICE
 *     candidate to.
 * @param {object} peerConnection The local `RTCPeerConnection` object.
 * @param {string} callId A UUID for the unique call.
 *
 * @returns {void}
 */
function onIceCandidate(iceEvent, user, peerConnection, callId) {
    peerConnection.iceCache.push(iceEvent.candidate);
    if (peerConnection.acceptedCall) {
        sendIceCandidates(user, peerConnection, callId);
    }
}

/*
 * This sends an array of ICE candidates
 *
 * @param {object} user A ChatEngine user object for the peer to send the ICE
 *     candidate to.
 * @param {object} peerConnection The local `RTCPeerConnection` object.
 * @param {string} callId A UUID for the unique call.
 *
 * @returns {void}
 */
function sendIceCandidates(user, peerConnection, callId) {
    user.direct.emit(peerIceCandidateEvent, {
        callId,
        candidates: peerConnection.iceCache
    });

    // Purge ICE candidate cache after it gets sent to peer.
    peerConnection.iceCache = [];
}

/*
 * This event fires when the peer WebRTC client sends a new ICE candidate. This
 *     event registers the candidate with the local `RTCPeerConnection` object.
 *
 * @param {object} payload A ChatEngine `direct` event payload.
 *
 * @returns {void}
 */
function peerIceCandidate(payload) {
    const { peerConnection, ignoreNonTurn } = this;
    const { callId, candidates } = payload.data;

    if (typeof candidates !== 'object' || !peerConnection) {
        return;
    }

    candidates.forEach((candidate) => {
        // Ignore all non-TURN ICE candidates if specified in config.
        if (ignoreNonTurn && candidate.candidate.indexOf('typ relay') === -1) {
            return;
        }

        peerConnection.addIceCandidate(candidate)
            .catch((error) => {
                // No need to log errors for invalid ICE candidates
                if (error.message === 'Error processing ICE candidate') {
                    return;
                }

                const functionName = 'peerIceCandidate';
                const message = `ChatEngine WebRTC [${functionName}] error.`;
                chatEngineError(this.ChatEngine, functionName, message, error);
            });
    });
}

module.exports = (configuration = {}) => {
    config = configuration;
    return {
        namespace: 'webRTC',
        extends: {
            Me: WebRtcPhone
        }
    }
};

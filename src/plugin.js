
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
        }

        // connected() {
        //     this.parent.emit(['$' + 'webRTC', 'connected'].join('.'));
        // }

        callUser(user, localStream) {
            localStream = localStream || this.localStream;

            if (user.name !== 'Me') {
                user.direct.emit(['$' + 'webRTC', 'incomingCall'].join('.'), {
                    callId: uuid(),
                    stream: localStream
                });
            }
        }

        callResponse(payload) {
            const {callId, acceptCall} = payload.data;
            const remoteStream = payload.data.stream;
            let uuid = payload.sender.uuid;
            this.parentOnCallResponse(uuid, acceptCall, remoteStream);

            // const {callId, acceptCall} = payload.data;
            // const sender = payload.sender;
            // const uuid = sender.uuid;
            // const remoteStream = payload.data.stream;
            
            // Callback is only called to open the call 2 ways.
            // Otherwise, don't call this from parent.
            // const callback = (localStream) => {
            //     localStream = localStream || this.localStream;

            //     sender.direct.emit(['$' + 'webRTC', 'partnerStream'].join('.'), {
            //         callId,
            //         stream: localStream
            //     });
            // };

            // if acceptCall is true, give them your stream
            // this.parentOnCallResponse(callback, uuid, acceptCall, remoteStream);
        }

        incomingCall(payload) {
            console.log('incomingCall', payload);
            const sender = payload.sender;
            const callId = payload.data.callId;
            const remoteStream = payload.data.stream;

            // Callback is only called to open the call 2 ways.
            // Otherwise, don't call this from parent.
            const callResponseCallback = (acceptCall, localStream) => {
                this.callResponseCache[callId] = acceptCall;
                sender.direct.emit(['$' + 'webRTC', 'callResponse'].join('.'), {
                    callId,
                    acceptCall,
                    stream: localStream
                });
            }

            this.parentOnIncomingCall(sender.uuid, remoteStream, callResponseCallback);
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

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
            let localDescription; // WebRTC local description
            let peerConnection = new RTCPeerConnection();
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy5udm0vdmVyc2lvbnMvbm9kZS92OC4xMS4yL2xpYi9ub2RlX21vZHVsZXMvY2hhdC1lbmdpbmUtcGx1Z2luL25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIudG1wL3dyYXAuanMiLCJwYWNrYWdlLmpzb24iLCJzcmMvcGx1Z2luLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwiKGZ1bmN0aW9uKCkge1xuXG4gICAgY29uc3QgcGFja2FnZSA9IHJlcXVpcmUoJy4uL3BhY2thZ2UuanNvbicpO1xuICAgIHdpbmRvdy5DaGF0RW5naW5lQ29yZS5wbHVnaW5bcGFja2FnZS5uYW1lXSA9IHJlcXVpcmUoJy4uL3NyYy9wbHVnaW4uanMnKTtcblxufSkoKTtcbiIsIm1vZHVsZS5leHBvcnRzPXtcbiAgXCJhdXRob3JcIjogXCJBZGFtIEJhdm9zYVwiLFxuICBcIm5hbWVcIjogXCJjaGF0LWVuZ2luZS13ZWJydGNcIixcbiAgXCJ2ZXJzaW9uXCI6IFwiMC4wLjFcIixcbiAgXCJtYWluXCI6IFwic3JjL3BsdWdpbi5qc1wiLFxuICBcImRlcGVuZGVuY2llc1wiOiB7XG4gICAgXCJjaGF0LWVuZ2luZVwiOiBcIl4wLjkuMThcIlxuICB9XG59XG4iLCIvKlxuICpcbiAqL1xuXG5mdW5jdGlvbiB1dWlkKCkge1xuICAgIGZ1bmN0aW9uIHM0KCkge1xuICAgICAgICByZXR1cm4gTWF0aC5mbG9vcigoMSArIE1hdGgucmFuZG9tKCkpICogMHgxMDAwMClcbiAgICAgICAgICAgIC50b1N0cmluZygxNilcbiAgICAgICAgICAgIC5zdWJzdHJpbmcoMSk7XG4gICAgfVxuICAgIHJldHVybiBzNCgpICsgczQoKSArICctJyArIHM0KCkgKyAnLScgKyBzNCgpICsgJy0nICsgczQoKSArICctJyArIHM0KCkgKyBzNCgpICsgczQoKTtcbn1cblxuZnVuY3Rpb24gb25JbmNvbWluZ0NhbGxOb3REZWZpbmVkKGNhbGxiYWNrKSB7XG4gICAgY29uc29sZS5lcnJvcignQ2hhdEVuZ2luZSBXZWJSVEMgUGx1Z2luOiBbb25JbmNvbWluZ0NhbGxdIEluY29taW5nIGNhbGwgZXZlbnQgaGFuZGxlciBpcyBub3QgZGVmaW5lZC4nKTtcbiAgICBjYWxsYmFjayhmYWxzZSk7XG59XG5cbmZ1bmN0aW9uIG9uQ2FsbFJlc3BvbnNlTm90RGVmaW5lZCgpIHtcbiAgICBjb25zb2xlLmVycm9yKCdDaGF0RW5naW5lIFdlYlJUQyBQbHVnaW46IFtvbkNhbGxSZXNwb25zZV0gQ2FsbCByZXNwb25zZSBldmVudCBoYW5kbGVyIGlzIG5vdCBkZWZpbmVkLicpO1xufVxuXG5mdW5jdGlvbiBvbkNhbGxEaXNjb25uZWN0Tm90RGVmaW5lZCgpIHtcbiAgICBjb25zb2xlLmVycm9yKCdDaGF0RW5naW5lIFdlYlJUQyBQbHVnaW46IFtvbkNhbGxEaXNjb25uZWN0XSBDYWxsIGRpc2Nvbm5lY3QgZXZlbnQgaGFuZGxlciBpcyBub3QgZGVmaW5lZC4nKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSAoY29uZmlnKSA9PiB7XG4gICAgY2xhc3MgZXh0ZW5zaW9uIHtcbiAgICAgICAgY29uc3RydWN0KCkge1xuICAgICAgICAgICAgLy8gSG9sZHMgUlRDUGVlckNvbm5lY3Rpb24gb2JqZWN0cyBmb3IgZWFjaCBjYWxsLiBLZXkgaXMgdGhlIGNhbGwgSUQgKGEgVVVJRCkuXG4gICAgICAgICAgICB0aGlzLmNhbGxDYWNoZSA9IHt9O1xuXG4gICAgICAgICAgICAvLyBbY29uZmlnLm9uSW5jb21pbmdDYWxsXSBtdXN0IGJlIGRlZmluZWQgb24gaW5pdCwgb3RoZXJ3aXNlIGluY29taW5nIGNhbGwgZXZlbnQgd2lsbCBsb2cgYW4gZXJyb3IuXG4gICAgICAgICAgICAvLyBUaGUgZXZlbnQgaXMgbWVhbnQgdG8gdHJpZ2dlciBVSSBmb3IgdGhlIHVzZXIgdG8gYWNjZXB0IG9yIHJlamVjdCBhbiBpbmNvbWluZyBjYWxsLlxuICAgICAgICAgICAgdGhpcy5wYXJlbnRPbkluY29taW5nQ2FsbCA9IGNvbmZpZy5vbkluY29taW5nQ2FsbCB8fCBvbkluY29taW5nQ2FsbE5vdERlZmluZWQ7XG5cbiAgICAgICAgICAgIC8vIFtjb25maWcub25DYWxsUmVzcG9uc2VdIG11c3QgYmUgZGVmaW5lZCBvbiBpbml0LCBvdGhlcndpc2UgY2FsbCByZXNwb25zZSBldmVudCB3aWxsIGxvZyBhbiBlcnJvci5cbiAgICAgICAgICAgIC8vIFRoZSBldmVudCBpcyBtZWFudCB0byBnaXZlIHRoZSB1c2VyIGFuIG9wcG9ydHVuaXR5IHRvIGhhbmRsZSBhIGNhbGwgcmVzcG9uc2UuXG4gICAgICAgICAgICB0aGlzLnBhcmVudE9uQ2FsbFJlc3BvbnNlID0gY29uZmlnLm9uQ2FsbFJlc3BvbnNlIHx8IG9uQ2FsbFJlc3BvbnNlTm90RGVmaW5lZDtcblxuICAgICAgICAgICAgLy8gW2NvbmZpZy5vbkNhbGxEaXNjb25uZWN0XSBtdXN0IGJlIGRlZmluZWQgb24gaW5pdCwgb3RoZXJ3aXNlIGRpc2Nvbm5lY3QgY2FsbCBldmVudCB3aWxsIGxvZyBhbiBlcnJvci5cbiAgICAgICAgICAgIC8vIFRoZSBldmVudCBpcyBtZWFudCB0byBub3RpZnkgdGhlIHVzZXIgdGhhdCB0aGUgY2FsbCBoYXMgZW5kZWQgaW4gdGhlIFVJLlxuICAgICAgICAgICAgdGhpcy5wYXJlbnRPbkNhbGxEaXNjb25uZWN0ID0gY29uZmlnLm9uQ2FsbERpc2Nvbm5lY3QgfHwgb25DYWxsRGlzY29ubmVjdE5vdERlZmluZWQ7XG5cbiAgICAgICAgICAgIC8vIFZpZGVvIGFuZCBhdWRpbyBzdHJlYW0gZnJvbSBsb2NhbCBjbGllbnQgY2FtZXJhIGFuZCBtaWNyb3Bob25lLlxuICAgICAgICAgICAgLy8gT3B0aW9uYWwgdG8gcGFzcyBub3csIGNhbiBiZSBwYXNzZWQgbGF0ZXIgd2hlbiBhIGNhbGwgaXMgYWNjZXB0ZWQuXG4gICAgICAgICAgICB0aGlzLmxvY2FsU3RyZWFtID0gY29uZmlnLmxvY2FsU3RyZWFtO1xuXG4gICAgICAgICAgICAvLyBDaGF0RW5naW5lIERpcmVjdCBldmVudCBoYW5kbGVyIGZvciBpbmNvbWluZyBjYWxsIHJlcXVlc3RzLlxuICAgICAgICAgICAgdGhpcy5DaGF0RW5naW5lLm1lLmRpcmVjdC5vbihbJyQnICsgJ3dlYlJUQycsICdpbmNvbWluZ0NhbGwnXS5qb2luKCcuJyksIChwYXlsb2FkKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5pbmNvbWluZ0NhbGwocGF5bG9hZCk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy8gQ2hhdEVuZ2luZSBEaXJlY3QgZXZlbnQgaGFuZGxlciBmb3IgY2FsbCByZXNwb25zZXMuXG4gICAgICAgICAgICB0aGlzLkNoYXRFbmdpbmUubWUuZGlyZWN0Lm9uKFsnJCcgKyAnd2ViUlRDJywgJ2NhbGxSZXNwb25zZSddLmpvaW4oJy4nKSwgKHBheWxvYWQpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxSZXNwb25zZShwYXlsb2FkKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBDaGF0RW5naW5lIERpcmVjdCBldmVudCBoYW5kbGVyIGZvciBuZXcgSUNFIGNhbmRpZGF0ZXMgZm9yIFJUQ1BlZXJDb25uZWN0aW9uIG9iamVjdC5cbiAgICAgICAgICAgIC8vIFdlYlJUQyBjbGllbnQgdGVsbHMgdGhlIHJlbW90ZSBjbGllbnQgdGhlaXIgSUNFIGNhbmRpZGF0ZXMgdGhyb3VnaCB0aGlzIHNpZ25hbC5cbiAgICAgICAgICAgIHRoaXMuQ2hhdEVuZ2luZS5tZS5kaXJlY3Qub24oWyckJyArICd3ZWJSVEMnLCAnaW5jb21pbmdJY2VDYW5kaWRhdGUnXS5qb2luKCcuJyksIChwYXlsb2FkKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5pbmNvbWluZ0ljZUNhbmRpZGF0ZShwYXlsb2FkKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgY2FsbFVzZXIodXNlciwgb25SZW1vdGVWaWRlb1N0cmVhbUF2YWlsYWJsZSwgbG9jYWxTdHJlYW0pIHtcbiAgICAgICAgICAgIGlmICh1c2VyLm5hbWUgPT09ICdNZScpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdDaGF0RW5naW5lIFdlYlJUQyBQbHVnaW46IFtjYWxsVXNlcl0gQ2FsbGluZyBzZWxmIGlzIG5vdCBhbGxvd2VkLicpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gSWYgdGhlIGxvY2FsIHN0cmVhbSBpcyBub3QgcGFzc2VkIG9uIHBsdWdpbiBpbml0LCBpdCBjYW4gYmUgcGFzc2VkIGhlcmUuXG4gICAgICAgICAgICBsb2NhbFN0cmVhbSA9IGxvY2FsU3RyZWFtIHx8IHRoaXMubG9jYWxTdHJlYW07XG4gICAgICAgICAgICBsZXQgY2FsbElkID0gdXVpZCgpO1xuICAgICAgICAgICAgbGV0IGxvY2FsRGVzY3JpcHRpb247IC8vIFdlYlJUQyBsb2NhbCBkZXNjcmlwdGlvblxuICAgICAgICAgICAgbGV0IHBlZXJDb25uZWN0aW9uID0gbmV3IFJUQ1BlZXJDb25uZWN0aW9uKCk7XG4gICAgICAgICAgICB0aGlzLmNhbGxDYWNoZVtjYWxsSWRdID0gcGVlckNvbm5lY3Rpb247XG4gICAgICAgICAgICBwZWVyQ29ubmVjdGlvbi5vbmljZWNvbm5lY3Rpb25zdGF0ZWNoYW5nZSA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAocGVlckNvbm5lY3Rpb24uaWNlQ29ubmVjdGlvblN0YXRlID09PSAnZGlzY29ubmVjdGVkJykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm9uRGlzY29ubmVjdChjYWxsSWQsIHVzZXIudXVpZCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgLy8gU2V0IGxvY2FsIGFuZCByZW1vdGUgdmlkZW8gYW5kIGF1ZGlvIHN0cmVhbXMgdG8gcGVlciBjb25uZWN0aW9uIG9iamVjdC5cbiAgICAgICAgICAgIHBlZXJDb25uZWN0aW9uLm9udHJhY2sgPSBvblJlbW90ZVZpZGVvU3RyZWFtQXZhaWxhYmxlO1xuXG4gICAgICAgICAgICBpZiAobG9jYWxTdHJlYW0pIHtcbiAgICAgICAgICAgICAgICBsb2NhbFN0cmVhbS5nZXRUcmFja3MoKS5mb3JFYWNoKCh0cmFjaykgPT4gcGVlckNvbm5lY3Rpb24uYWRkVHJhY2sodHJhY2ssIGxvY2FsU3RyZWFtKSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHBlZXJDb25uZWN0aW9uLmNyZWF0ZU9mZmVyKClcbiAgICAgICAgICAgIC50aGVuKChkZXNjcmlwdGlvbikgPT4ge1xuICAgICAgICAgICAgICAgIGxvY2FsRGVzY3JpcHRpb24gPSBkZXNjcmlwdGlvbjtcbiAgICAgICAgICAgICAgICByZXR1cm4gcGVlckNvbm5lY3Rpb24uc2V0TG9jYWxEZXNjcmlwdGlvbihsb2NhbERlc2NyaXB0aW9uKTtcbiAgICAgICAgICAgIH0pLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgIHVzZXIuZGlyZWN0LmVtaXQoWyckJyArICd3ZWJSVEMnLCAnaW5jb21pbmdDYWxsJ10uam9pbignLicpLCB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxJZCxcbiAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGxvY2FsRGVzY3JpcHRpb25cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pLmNhdGNoKChlcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0NoYXRFbmdpbmUgV2ViUlRDIFBsdWdpbjogW2NhbGxVc2VyXScsIGVycm9yKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgY2FsbFJlc3BvbnNlKHBheWxvYWQpIHtcbiAgICAgICAgICAgIGNvbnN0IHtjYWxsSWQsIGFjY2VwdENhbGwsIGRlc2NyaXB0aW9ufSA9IHBheWxvYWQuZGF0YTtcbiAgICAgICAgICAgIGxldCBzZW5kZXIgPSBwYXlsb2FkLnNlbmRlcjtcblxuICAgICAgICAgICAgaWYgKGFjY2VwdENhbGwpIHtcbiAgICAgICAgICAgICAgICAvLyBXaGVuIElDRSBjYW5kaWRhdGVzIGJlY29tZSBhdmFpbGFibGUsIHNlbmQgdGhlbSB0byB0aGUgcmVtb3RlIGNsaWVudC5cbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxDYWNoZVtjYWxsSWRdLm9uaWNlY2FuZGlkYXRlID0gKGljZUV2ZW50KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpY2VFdmVudC5jYW5kaWRhdGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbmRlci5kaXJlY3QuZW1pdChbJyQnICsgJ3dlYlJUQycsICdpbmNvbWluZ0ljZUNhbmRpZGF0ZSddLmpvaW4oJy4nKSwge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYW5kaWRhdGU6IGljZUV2ZW50LmNhbmRpZGF0ZVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgLy8gV2hlbiBhIHVzZXIgYWNjZXB0cyBhIGNhbGwsIHRoZXkgc2VuZCB0aGVpciBXZWJSVEMgcGVlciBjb25uZWN0aW9uIGRlc2NyaXB0aW9uLlxuICAgICAgICAgICAgICAgIC8vIFNldCBpdCBsb2NhbGx5IGFzIHRoZSByZW1vdGUgY2xpZW50J3MgcGVlciBjb25uZWN0aW9uIGRlc2NyaXB0aW9uLlxuICAgICAgICAgICAgICAgIHRoaXMuY2FsbENhY2hlW2NhbGxJZF0uc2V0UmVtb3RlRGVzY3JpcHRpb24oZGVzY3JpcHRpb24pXG4gICAgICAgICAgICAgICAgLmNhdGNoKChlcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdDaGF0RW5naW5lIFdlYlJUQyBQbHVnaW46IFtjYWxsUmVzcG9uc2VdJywgZXJyb3IpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnBhcmVudE9uQ2FsbFJlc3BvbnNlKHNlbmRlci51dWlkLCBhY2NlcHRDYWxsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGluY29taW5nQ2FsbChwYXlsb2FkKSB7XG4gICAgICAgICAgICBjb25zdCBzZW5kZXIgPSBwYXlsb2FkLnNlbmRlcjtcbiAgICAgICAgICAgIGNvbnN0IHsgY2FsbElkIH0gPSBwYXlsb2FkLmRhdGE7XG4gICAgICAgICAgICBjb25zdCByZW1vdGVEZXNjcmlwdGlvbiA9IHBheWxvYWQuZGF0YS5kZXNjcmlwdGlvbjtcblxuICAgICAgICAgICAgLy8gU2hvdWxkIGJlIGV4ZWN1dGVkIGFmdGVyIHRoaXMgY2xpZW50IGFjY2VwdHMgb3IgcmVqZWN0cyBhbiBpbmNvbWluZyBjYWxsLlxuICAgICAgICAgICAgY29uc3QgY2FsbFJlc3BvbnNlQ2FsbGJhY2sgPSAoYWNjZXB0Q2FsbCwgb25SZW1vdGVWaWRlb1N0cmVhbUF2YWlsYWJsZSwgbG9jYWxTdHJlYW0pID0+IHtcbiAgICAgICAgICAgICAgICBsb2NhbFN0cmVhbSA9IGxvY2FsU3RyZWFtIHx8IHRoaXMubG9jYWxTdHJlYW07XG5cbiAgICAgICAgICAgICAgICBpZiAoYWNjZXB0Q2FsbCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIG9uUmVtb3RlVmlkZW9TdHJlYW1BdmFpbGFibGUgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0NoYXRFbmdpbmUgV2ViUlRDIFBsdWdpbjogW2luY29taW5nQ2FsbF0gb25SZW1vdGVWaWRlb1N0cmVhbUF2YWlsYWJsZSBoYW5kbGVyIGlzIG5vdCBkZWZpbmVkLicpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBsb2NhbFN0cmVhbSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0NoYXRFbmdpbmUgV2ViUlRDIFBsdWdpbjogTG9jYWwgdmlkZW8gc3RyZWFtIG9iamVjdCBpcyBub3QgZGVmaW5lZC4nKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGxldCBhbnN3ZXJEZXNjcmlwdGlvbjtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHBlZXJDb25uZWN0aW9uID0gbmV3IFJUQ1BlZXJDb25uZWN0aW9uKCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2FsbENhY2hlW2NhbGxJZF0gPSBwZWVyQ29ubmVjdGlvbjtcblxuICAgICAgICAgICAgICAgICAgICAvLyBXaGVuIElDRSBjYW5kaWRhdGVzIGJlY29tZSBhdmFpbGFibGUsIHNlbmQgdGhlbSB0byB0aGUgcmVtb3RlIGNsaWVudFxuICAgICAgICAgICAgICAgICAgICBwZWVyQ29ubmVjdGlvbi5vbmljZWNhbmRpZGF0ZSA9IChpY2VFdmVudCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGljZUV2ZW50LmNhbmRpZGF0ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbmRlci5kaXJlY3QuZW1pdChbJyQnICsgJ3dlYlJUQycsICdpbmNvbWluZ0ljZUNhbmRpZGF0ZSddLmpvaW4oJy4nKSwge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsSWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbmRpZGF0ZTogaWNlRXZlbnQuY2FuZGlkYXRlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICAgICAgcGVlckNvbm5lY3Rpb24ub25pY2Vjb25uZWN0aW9uc3RhdGVjaGFuZ2UgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocGVlckNvbm5lY3Rpb24uaWNlQ29ubmVjdGlvblN0YXRlID09PSAnZGlzY29ubmVjdGVkJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMub25EaXNjb25uZWN0KGNhbGxJZCwgc2VuZGVyLnV1aWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgICAgIGxvY2FsU3RyZWFtLmdldFRyYWNrcygpLmZvckVhY2goKHRyYWNrKSA9PiBwZWVyQ29ubmVjdGlvbi5hZGRUcmFjayh0cmFjaywgbG9jYWxTdHJlYW0pKTtcblxuICAgICAgICAgICAgICAgICAgICBwZWVyQ29ubmVjdGlvbi5vbnRyYWNrID0gb25SZW1vdGVWaWRlb1N0cmVhbUF2YWlsYWJsZTtcbiAgICAgICAgICAgICAgICAgICAgcGVlckNvbm5lY3Rpb24uc2V0UmVtb3RlRGVzY3JpcHRpb24ocmVtb3RlRGVzY3JpcHRpb24pXG4gICAgICAgICAgICAgICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwZWVyQ29ubmVjdGlvbi5jcmVhdGVBbnN3ZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgfSkudGhlbigoYW5zd2VyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhbnN3ZXJEZXNjcmlwdGlvbiA9IGFuc3dlcjtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwZWVyQ29ubmVjdGlvbi5zZXRMb2NhbERlc2NyaXB0aW9uKGFuc3dlckRlc2NyaXB0aW9uKTtcbiAgICAgICAgICAgICAgICAgICAgfSkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZW5kZXIuZGlyZWN0LmVtaXQoWyckJyArICd3ZWJSVEMnLCAnY2FsbFJlc3BvbnNlJ10uam9pbignLicpLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbElkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFjY2VwdENhbGwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGFuc3dlckRlc2NyaXB0aW9uXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goKGVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdDaGF0RW5naW5lIFdlYlJUQyBQbHVnaW46IFtpbmNvbWluZ0NhbGxdJywgZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBzZW5kZXIuZGlyZWN0LmVtaXQoWyckJyArICd3ZWJSVEMnLCAnY2FsbFJlc3BvbnNlJ10uam9pbignLicpLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsSWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBhY2NlcHRDYWxsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5wYXJlbnRPbkluY29taW5nQ2FsbChzZW5kZXIudXVpZCwgY2FsbFJlc3BvbnNlQ2FsbGJhY2spO1xuICAgICAgICB9XG5cbiAgICAgICAgaW5jb21pbmdJY2VDYW5kaWRhdGUocGF5bG9hZCkge1xuICAgICAgICAgICAgY29uc3QgeyBjYWxsSWQsIGNhbmRpZGF0ZSB9ID0gcGF5bG9hZC5kYXRhO1xuXG4gICAgICAgICAgICBpZiAoIXRoaXMuY2FsbENhY2hlW2NhbGxJZF0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuY2FsbENhY2hlW2NhbGxJZF0uYWRkSWNlQ2FuZGlkYXRlKGNhbmRpZGF0ZSlcbiAgICAgICAgICAgIC5jYXRjaCgoZXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdDaGF0RW5naW5lIFdlYlJUQyBQbHVnaW46IFtpbmNvbWluZ0ljZUNhbmRpZGF0ZV0nLCBlcnJvcik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIG9uRGlzY29ubmVjdChjYWxsSWQsIHVzZXJVdWlkKSB7XG4gICAgICAgICAgICB0aGlzLmNhbGxDYWNoZVtjYWxsSWRdLmNsb3NlKCk7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5jYWxsQ2FjaGVbY2FsbElkXTtcbiAgICAgICAgICAgIHRoaXMucGFyZW50T25DYWxsRGlzY29ubmVjdCh1c2VyVXVpZCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBsZXQgZW1pdCA9IHt9O1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgbmFtZXNwYWNlOiAnd2ViUlRDJyxcbiAgICAgICAgZXh0ZW5kczoge1xuICAgICAgICAgICAgQ2hhdDogZXh0ZW5zaW9uXG4gICAgICAgIH0sXG4gICAgICAgIG1pZGRsZXdhcmU6IHt9XG4gICAgfVxufTtcbiJdfQ==

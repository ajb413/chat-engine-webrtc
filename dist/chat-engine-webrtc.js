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

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy5udm0vdmVyc2lvbnMvbm9kZS92OC4xMS4yL2xpYi9ub2RlX21vZHVsZXMvY2hhdC1lbmdpbmUtcGx1Z2luL25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIudG1wL3dyYXAuanMiLCJwYWNrYWdlLmpzb24iLCJzcmMvcGx1Z2luLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsIihmdW5jdGlvbigpIHtcblxuICAgIGNvbnN0IHBhY2thZ2UgPSByZXF1aXJlKCcuLi9wYWNrYWdlLmpzb24nKTtcbiAgICB3aW5kb3cuQ2hhdEVuZ2luZUNvcmUucGx1Z2luW3BhY2thZ2UubmFtZV0gPSByZXF1aXJlKCcuLi9zcmMvcGx1Z2luLmpzJyk7XG5cbn0pKCk7XG4iLCJtb2R1bGUuZXhwb3J0cz17XG4gIFwiYXV0aG9yXCI6IFwiQWRhbSBCYXZvc2FcIixcbiAgXCJuYW1lXCI6IFwiY2hhdC1lbmdpbmUtd2VicnRjXCIsXG4gIFwidmVyc2lvblwiOiBcIjAuMC4xXCIsXG4gIFwibWFpblwiOiBcInNyYy9wbHVnaW4uanNcIixcbiAgXCJkZXBlbmRlbmNpZXNcIjoge1xuICAgIFwiY2hhdC1lbmdpbmVcIjogXCJeMC45LjE4XCJcbiAgfVxufVxuIiwiXG5mdW5jdGlvbiB1dWlkKCkge1xuICAgIGZ1bmN0aW9uIHM0KCkge1xuICAgICAgICByZXR1cm4gTWF0aC5mbG9vcigoMSArIE1hdGgucmFuZG9tKCkpICogMHgxMDAwMClcbiAgICAgICAgICAgIC50b1N0cmluZygxNilcbiAgICAgICAgICAgIC5zdWJzdHJpbmcoMSk7XG4gICAgfVxuICAgIHJldHVybiBzNCgpICsgczQoKSArICctJyArIHM0KCkgKyAnLScgKyBzNCgpICsgJy0nICsgczQoKSArICctJyArIHM0KCkgKyBzNCgpICsgczQoKTtcbn1cblxuZnVuY3Rpb24gb25JbmNvbWluZ0NhbGxOb3REZWZpbmVkKGNhbGxiYWNrKSB7XG4gICAgY29uc29sZS5lcnJvcignQ2hhdEVuZ2luZS53ZWJSVEM6IEluY29taW5nIGNhbGwgaGFuZGxlciBpcyBub3QgZGVmaW5lZCBpbiBjb25maWcuJyk7XG4gICAgY2FsbGJhY2soZmFsc2UpO1xufVxuXG5mdW5jdGlvbiBvbkNhbGxSZXNwb25zZU5vdERlZmluZWQoKSB7XG4gICAgY29uc29sZS5lcnJvcignQ2hhdEVuZ2luZS53ZWJSVEM6IEluY29taW5nIGNhbGwgcmVzcG9uc2UgaGFuZGxlciBpcyBub3QgZGVmaW5lZCBpbiBjb25maWcuJyk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gKGNvbmZpZykgPT4ge1xuICAgIGNsYXNzIGV4dGVuc2lvbiB7XG4gICAgICAgIGNvbnN0cnVjdCgpIHtcbiAgICAgICAgICAgIC8vIEhvbGRzIGNhbGwgcmVzcG9uc2Ugb24gY2xpZW50LCBjaGVja3MgdGhpcyBiZWZvcmUgYWNjZXB0aW5nIGEgcGVlciBzdHJlYW1cbiAgICAgICAgICAgIHRoaXMuY2FsbFJlc3BvbnNlQ2FjaGUgPSB7fTtcblxuICAgICAgICAgICAgdGhpcy5jYWxsQ2FjaGUgPSB7fTtcblxuICAgICAgICAgICAgLy8gW2NvbmZpZy5vbkluY29taW5nQ2FsbF0gbXVzdCBiZSBkZWZpbmVkIG9uIGluaXQsIG90aGVyd2lzZSBpbmNvbWluZyBjYWxsIHdpbGwgbG9nIGFuIGVycm9yLlxuICAgICAgICAgICAgLy8gVGhlIGV2ZW50IGlzIG1lYW50IHRvIGdpdmUgdGhlIHVzZXIgYW4gb3Bwb3J0dW5pdHkgdG8gcmVzcG9uZCB0byBhIGNhbGwgaW4gdGhlIFVJLlxuICAgICAgICAgICAgdGhpcy5wYXJlbnRPbkluY29taW5nQ2FsbCA9IGNvbmZpZy5vbkluY29taW5nQ2FsbCB8fCBvbkluY29taW5nQ2FsbE5vdERlZmluZWQ7XG5cbiAgICAgICAgICAgIC8vIFZpZGVvIHN0cmVhbSBmcm9tIGxvY2FsIGNsaWVudCBjYW1lcmFcbiAgICAgICAgICAgIC8vIE9wdGlvbmFsIHRvIHBhc3Mgbm93LCBjYW4gYmUgcGFzc2VkIHdoZW4gYSBjYWxsIGlzIGFjY2VwdGVkXG4gICAgICAgICAgICB0aGlzLmxvY2FsU3RyZWFtID0gY29uZmlnLmxvY2FsU3RyZWFtO1xuXG4gICAgICAgICAgICAvLyBbY29uZmlnLm9uQ2FsbFJlc3BvbnNlXSBtdXN0IGJlIGRlZmluZWQgb24gaW5pdCwgb3RoZXJ3aXNlIGluY29taW5nIGNhbGwgcmVzcG9uc2Ugd2lsbCBsb2cgYW4gZXJyb3IuXG4gICAgICAgICAgICAvLyBUaGUgZXZlbnQgaXMgbWVhbnQgdG8gZ2l2ZSB0aGUgdXNlciBhbiBvcHBvcnR1bml0eSB0byBoYW5kbGUgYSBjYWxsIHJlc3BvbnNlLlxuICAgICAgICAgICAgdGhpcy5wYXJlbnRPbkNhbGxSZXNwb25zZSA9IGNvbmZpZy5vbkNhbGxSZXNwb25zZSB8fCBvbkNhbGxSZXNwb25zZU5vdERlZmluZWQ7XG5cbiAgICAgICAgICAgIHRoaXMuQ2hhdEVuZ2luZS5tZS5kaXJlY3Qub24oWyckJyArICd3ZWJSVEMnLCAnaW5jb21pbmdDYWxsJ10uam9pbignLicpLCAocGF5bG9hZCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuaW5jb21pbmdDYWxsKHBheWxvYWQpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHRoaXMuQ2hhdEVuZ2luZS5tZS5kaXJlY3Qub24oWyckJyArICd3ZWJSVEMnLCAnY2FsbFJlc3BvbnNlJ10uam9pbignLicpLCAocGF5bG9hZCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuY2FsbFJlc3BvbnNlKHBheWxvYWQpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHRoaXMuQ2hhdEVuZ2luZS5tZS5kaXJlY3Qub24oWyckJyArICd3ZWJSVEMnLCAnaW5jb21pbmdJY2VDYW5kaWRhdGUnXS5qb2luKCcuJyksIChwYXlsb2FkKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5pbmNvbWluZ0ljZUNhbmRpZGF0ZShwYXlsb2FkKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY29ubmVjdGVkKCkge1xuICAgICAgICAvLyAgICAgdGhpcy5wYXJlbnQuZW1pdChbJyQnICsgJ3dlYlJUQycsICdjb25uZWN0ZWQnXS5qb2luKCcuJykpO1xuICAgICAgICAvLyB9XG5cbiAgICAgICAgY2FsbFVzZXIodXNlciwgbG9jYWxTdHJlYW0sIG9uUmVtb3RlVmlkZW9TdHJlYW1BdmFpbGFibGUpIHtcbiAgICAgICAgICAgIGlmICh1c2VyLm5hbWUgIT09ICdNZScpIHtcbiAgICAgICAgICAgICAgICBsb2NhbFN0cmVhbSA9IGxvY2FsU3RyZWFtIHx8IHRoaXMubG9jYWxTdHJlYW07XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ2xvY2Fsc3RyZWFtJywgbG9jYWxTdHJlYW0pO1xuICAgICAgICAgICAgICAgIGxldCBjYWxsSWQgPSB1dWlkKCk7XG5cbiAgICAgICAgICAgICAgICBsZXQgcGVlckNvbm5lY3Rpb24gPSBuZXcgUlRDUGVlckNvbm5lY3Rpb24oKTtcbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxDYWNoZVtjYWxsSWRdID0gcGVlckNvbm5lY3Rpb247XG4gICAgICAgICAgICAgICAgcGVlckNvbm5lY3Rpb24ub250cmFjayA9IG9uUmVtb3RlVmlkZW9TdHJlYW1BdmFpbGFibGU7XG5cbiAgICAgICAgICAgICAgICBsb2NhbFN0cmVhbS5nZXRUcmFja3MoKS5mb3JFYWNoKHRyYWNrID0+IHBlZXJDb25uZWN0aW9uLmFkZFRyYWNrKHRyYWNrLCBsb2NhbFN0cmVhbSkpO1xuXG4gICAgICAgICAgICAgICAgbGV0IGxvY2FsRGVzY3JpcHRpb247XG5cbiAgICAgICAgICAgICAgICBwZWVyQ29ubmVjdGlvbi5jcmVhdGVPZmZlcigpXG4gICAgICAgICAgICAgICAgLnRoZW4oKGRlc2NyaXB0aW9uKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGxvY2FsRGVzY3JpcHRpb24gPSBkZXNjcmlwdGlvbjtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHBlZXJDb25uZWN0aW9uLnNldExvY2FsRGVzY3JpcHRpb24obG9jYWxEZXNjcmlwdGlvbik7XG4gICAgICAgICAgICAgICAgfSkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHVzZXIuZGlyZWN0LmVtaXQoWyckJyArICd3ZWJSVEMnLCAnaW5jb21pbmdDYWxsJ10uam9pbignLicpLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsSWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBzdHJlYW06IGxvY2FsU3RyZWFtLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGxvY2FsRGVzY3JpcHRpb25cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSkuY2F0Y2goKGVycm9yKSA9PiB7IGNvbnNvbGUuZXJyb3IoJ2NyZWF0ZU9mZmVyIGVycm9yOicsIGVycm9yKSB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNhbGxSZXNwb25zZShwYXlsb2FkKSB7XG4gICAgICAgICAgICBjb25zdCB7Y2FsbElkLCBhY2NlcHRDYWxsLCBkZXNjcmlwdGlvbn0gPSBwYXlsb2FkLmRhdGE7XG4gICAgICAgICAgICBjb25zdCByZW1vdGVTdHJlYW0gPSBwYXlsb2FkLmRhdGEuc3RyZWFtO1xuICAgICAgICAgICAgbGV0IHNlbmRlciA9IHBheWxvYWQuc2VuZGVyO1xuXG4gICAgICAgICAgICBpZiAoYWNjZXB0Q2FsbCkge1xuICAgICAgICAgICAgICAgIC8vIHdoZW4gaWNlIGNhbmRpZGF0ZXMgYXJlIGF2YWlsYWJsZSBmb3IgUEMsIHNlbmQgdGhlbSB0byB0aGUgcmVtb3RlIGNsaWVudFxuICAgICAgICAgICAgICAgIHRoaXMuY2FsbENhY2hlW2NhbGxJZF0ub25pY2VjYW5kaWRhdGUgPSAoaWNlRXZlbnQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGljZUV2ZW50LmNhbmRpZGF0ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VuZGVyLmRpcmVjdC5lbWl0KFsnJCcgKyAnd2ViUlRDJywgJ2luY29taW5nSWNlQ2FuZGlkYXRlJ10uam9pbignLicpLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbElkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbmRpZGF0ZTogaWNlRXZlbnQuY2FuZGlkYXRlXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICB0aGlzLmNhbGxDYWNoZVtjYWxsSWRdLnNldFJlbW90ZURlc2NyaXB0aW9uKGRlc2NyaXB0aW9uKVxuICAgICAgICAgICAgICAgIC5jYXRjaCgoZXJyb3IpID0+IHtjb25zb2xlLmVycm9yKGVycm9yKTt9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5wYXJlbnRPbkNhbGxSZXNwb25zZShzZW5kZXIudXVpZCwgYWNjZXB0Q2FsbCwgcmVtb3RlU3RyZWFtKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGluY29taW5nQ2FsbChwYXlsb2FkKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnaW5jb21pbmdDYWxsJywgcGF5bG9hZCk7XG4gICAgICAgICAgICBjb25zdCBzZW5kZXIgPSBwYXlsb2FkLnNlbmRlcjtcbiAgICAgICAgICAgIGNvbnN0IHsgY2FsbElkIH0gPSBwYXlsb2FkLmRhdGE7XG4gICAgICAgICAgICBjb25zdCByZW1vdGVEZXNjcmlwdGlvbiA9IHBheWxvYWQuZGF0YS5kZXNjcmlwdGlvbjtcbiAgICAgICAgICAgIC8vIGNvbnN0IHJlbW90ZVN0cmVhbSA9IHBheWxvYWQuZGF0YS5zdHJlYW07XG5cbiAgICAgICAgICAgIC8vIENhbGxiYWNrIGlzIG9ubHkgY2FsbGVkIHRvIG9wZW4gdGhlIGNhbGwgMiB3YXlzLlxuICAgICAgICAgICAgLy8gT3RoZXJ3aXNlLCBkb24ndCBjYWxsIHRoaXMgZnJvbSBwYXJlbnQuXG4gICAgICAgICAgICBjb25zdCBjYWxsUmVzcG9uc2VDYWxsYmFjayA9IChhY2NlcHRDYWxsLCBsb2NhbFN0cmVhbSwgb25SZW1vdGVWaWRlb1N0cmVhbUF2YWlsYWJsZSkgPT4ge1xuICAgICAgICAgICAgICAgIGxvY2FsU3RyZWFtID0gbG9jYWxTdHJlYW0gfHwgdGhpcy5sb2NhbFN0cmVhbTtcbiAgICAgICAgICAgICAgICBpZiAoYWNjZXB0Q2FsbCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBhZGQgZXJyb3IgdGhyb3dzIGZvciB0aGUgbGF0dGVyIDIgZnVuY3Rpb24gcGFyYW1zXG4gICAgICAgICAgICAgICAgICAgIGxldCBhbnN3ZXJEZXNjcmlwdGlvbjtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHBlZXJDb25uZWN0aW9uID0gbmV3IFJUQ1BlZXJDb25uZWN0aW9uKCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2FsbENhY2hlW2NhbGxJZF0gPSBwZWVyQ29ubmVjdGlvbjtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIC8vIHdoZW4gaWNlIGNhbmRpZGF0ZXMgYXJlIGF2YWlsYWJsZSBmb3IgUEMsIHNlbmQgdGhlbSB0byB0aGUgcmVtb3RlIGNsaWVudFxuICAgICAgICAgICAgICAgICAgICB0aGlzLmNhbGxDYWNoZVtjYWxsSWRdLm9uaWNlY2FuZGlkYXRlID0gKGljZUV2ZW50KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaWNlRXZlbnQuY2FuZGlkYXRlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VuZGVyLmRpcmVjdC5lbWl0KFsnJCcgKyAnd2ViUlRDJywgJ2luY29taW5nSWNlQ2FuZGlkYXRlJ10uam9pbignLicpLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FuZGlkYXRlOiBpY2VFdmVudC5jYW5kaWRhdGVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgICAgICBwZWVyQ29ubmVjdGlvbi5hZGRTdHJlYW0obG9jYWxTdHJlYW0pO1xuICAgICAgICAgICAgICAgICAgICBwZWVyQ29ubmVjdGlvbi5vbnRyYWNrID0gb25SZW1vdGVWaWRlb1N0cmVhbUF2YWlsYWJsZTtcbiAgICAgICAgICAgICAgICAgICAgcGVlckNvbm5lY3Rpb24uc2V0UmVtb3RlRGVzY3JpcHRpb24ocmVtb3RlRGVzY3JpcHRpb24pLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHBlZXJDb25uZWN0aW9uLmNyZWF0ZUFuc3dlcigpO1xuICAgICAgICAgICAgICAgICAgICB9KS50aGVuKChhbnN3ZXIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFuc3dlckRlc2NyaXB0aW9uID0gYW5zd2VyO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ2Fuc3dlckRlc2NyaXB0aW9uJywgYW5zd2VyRGVzY3JpcHRpb24pXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcGVlckNvbm5lY3Rpb24uc2V0TG9jYWxEZXNjcmlwdGlvbihhbnN3ZXJEZXNjcmlwdGlvbik7XG4gICAgICAgICAgICAgICAgICAgIH0pLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VuZGVyLmRpcmVjdC5lbWl0KFsnJCcgKyAnd2ViUlRDJywgJ2NhbGxSZXNwb25zZSddLmpvaW4oJy4nKSwge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhY2NlcHRDYWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0cmVhbTogbG9jYWxTdHJlYW0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGFuc3dlckRlc2NyaXB0aW9uXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goZXJyb3IgPT4ge2NvbnNvbGUuZXJyb3IoJ3NldFJlbW90ZURlc2NyaXB0aW9uIGVycm9yOicsIGVycm9yKTt9KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBzZW5kZXIuZGlyZWN0LmVtaXQoWyckJyArICd3ZWJSVEMnLCAnY2FsbFJlc3BvbnNlJ10uam9pbignLicpLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsSWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBhY2NlcHRDYWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3RyZWFtOiBsb2NhbFN0cmVhbVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMucGFyZW50T25JbmNvbWluZ0NhbGwoc2VuZGVyLnV1aWQsIGNhbGxSZXNwb25zZUNhbGxiYWNrKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGluY29taW5nSWNlQ2FuZGlkYXRlKHBheWxvYWQpIHtcbiAgICAgICAgICAgIGNvbnN0IHsgY2FsbElkLCBjYW5kaWRhdGUgfSA9IHBheWxvYWQuZGF0YTtcblxuICAgICAgICAgICAgaWYgKCF0aGlzLmNhbGxDYWNoZVtjYWxsSWRdKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLmNhbGxDYWNoZVtjYWxsSWRdLmFkZEljZUNhbmRpZGF0ZShjYW5kaWRhdGUpXG4gICAgICAgICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ2luY29taW5nSWNlQ2FuZGlkYXRlIEVycm9yOiAnLCBlcnJvcik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGxldCBlbWl0ID0ge1xuICAgICAgICAvLyBjb25uZWN0ZWQ6IChwYXlsb2FkLCBuZXh0KSA9PiB7XG4gICAgICAgIC8vICAgICBwYXlsb2FkLmNoYXQud2ViUlRDLmNvbm5lY3RlZCgpO1xuICAgICAgICAvLyAgICAgbmV4dChudWxsLCBwYXlsb2FkKTtcbiAgICAgICAgLy8gfSxcbiAgICB9O1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgbmFtZXNwYWNlOiAnd2ViUlRDJyxcbiAgICAgICAgZXh0ZW5kczoge1xuICAgICAgICAgICAgQ2hhdDogZXh0ZW5zaW9uXG4gICAgICAgIH0sXG4gICAgICAgIG1pZGRsZXdhcmU6IHtcbiAgICAgICAgICAgIGVtaXRcbiAgICAgICAgfVxuICAgIH1cbn07XG4iXX0=

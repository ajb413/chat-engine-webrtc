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

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy5udm0vdmVyc2lvbnMvbm9kZS92OC4xMS4yL2xpYi9ub2RlX21vZHVsZXMvY2hhdC1lbmdpbmUtcGx1Z2luL25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIudG1wL3dyYXAuanMiLCJwYWNrYWdlLmpzb24iLCJzcmMvcGx1Z2luLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwiKGZ1bmN0aW9uKCkge1xuXG4gICAgY29uc3QgcGFja2FnZSA9IHJlcXVpcmUoJy4uL3BhY2thZ2UuanNvbicpO1xuICAgIHdpbmRvdy5DaGF0RW5naW5lQ29yZS5wbHVnaW5bcGFja2FnZS5uYW1lXSA9IHJlcXVpcmUoJy4uL3NyYy9wbHVnaW4uanMnKTtcblxufSkoKTtcbiIsIm1vZHVsZS5leHBvcnRzPXtcbiAgXCJhdXRob3JcIjogXCJBZGFtIEJhdm9zYVwiLFxuICBcIm5hbWVcIjogXCJjaGF0LWVuZ2luZS13ZWJydGNcIixcbiAgXCJ2ZXJzaW9uXCI6IFwiMC4wLjFcIixcbiAgXCJtYWluXCI6IFwic3JjL3BsdWdpbi5qc1wiLFxuICBcImRlcGVuZGVuY2llc1wiOiB7XG4gICAgXCJjaGF0LWVuZ2luZVwiOiBcIl4wLjkuMThcIlxuICB9XG59XG4iLCJcbmZ1bmN0aW9uIHV1aWQoKSB7XG4gICAgZnVuY3Rpb24gczQoKSB7XG4gICAgICAgIHJldHVybiBNYXRoLmZsb29yKCgxICsgTWF0aC5yYW5kb20oKSkgKiAweDEwMDAwKVxuICAgICAgICAgICAgLnRvU3RyaW5nKDE2KVxuICAgICAgICAgICAgLnN1YnN0cmluZygxKTtcbiAgICB9XG4gICAgcmV0dXJuIHM0KCkgKyBzNCgpICsgJy0nICsgczQoKSArICctJyArIHM0KCkgKyAnLScgKyBzNCgpICsgJy0nICsgczQoKSArIHM0KCkgKyBzNCgpO1xufVxuXG5mdW5jdGlvbiBvbkluY29taW5nQ2FsbE5vdERlZmluZWQoY2FsbGJhY2spIHtcbiAgICBjb25zb2xlLmVycm9yKCdDaGF0RW5naW5lLndlYlJUQzogSW5jb21pbmcgY2FsbCBoYW5kbGVyIGlzIG5vdCBkZWZpbmVkIGluIGNvbmZpZy4nKTtcbiAgICBjYWxsYmFjayhmYWxzZSk7XG59XG5cbmZ1bmN0aW9uIG9uQ2FsbFJlc3BvbnNlTm90RGVmaW5lZCgpIHtcbiAgICBjb25zb2xlLmVycm9yKCdDaGF0RW5naW5lLndlYlJUQzogSW5jb21pbmcgY2FsbCByZXNwb25zZSBoYW5kbGVyIGlzIG5vdCBkZWZpbmVkIGluIGNvbmZpZy4nKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSAoY29uZmlnKSA9PiB7XG4gICAgY2xhc3MgZXh0ZW5zaW9uIHtcbiAgICAgICAgY29uc3RydWN0KCkge1xuICAgICAgICAgICAgLy8gSG9sZHMgY2FsbCByZXNwb25zZSBvbiBjbGllbnQsIGNoZWNrcyB0aGlzIGJlZm9yZSBhY2NlcHRpbmcgYSBwZWVyIHN0cmVhbVxuICAgICAgICAgICAgdGhpcy5jYWxsUmVzcG9uc2VDYWNoZSA9IHt9O1xuXG4gICAgICAgICAgICAvLyBbY29uZmlnLm9uSW5jb21pbmdDYWxsXSBtdXN0IGJlIGRlZmluZWQgb24gaW5pdCwgb3RoZXJ3aXNlIGluY29taW5nIGNhbGwgd2lsbCBsb2cgYW4gZXJyb3IuXG4gICAgICAgICAgICAvLyBUaGUgZXZlbnQgaXMgbWVhbnQgdG8gZ2l2ZSB0aGUgdXNlciBhbiBvcHBvcnR1bml0eSB0byByZXNwb25kIHRvIGEgY2FsbCBpbiB0aGUgVUkuXG4gICAgICAgICAgICB0aGlzLnBhcmVudE9uSW5jb21pbmdDYWxsID0gY29uZmlnLm9uSW5jb21pbmdDYWxsIHx8IG9uSW5jb21pbmdDYWxsTm90RGVmaW5lZDtcblxuICAgICAgICAgICAgLy8gVmlkZW8gc3RyZWFtIGZyb20gbG9jYWwgY2xpZW50IGNhbWVyYVxuICAgICAgICAgICAgLy8gT3B0aW9uYWwgdG8gcGFzcyBub3csIGNhbiBiZSBwYXNzZWQgd2hlbiBhIGNhbGwgaXMgYWNjZXB0ZWRcbiAgICAgICAgICAgIHRoaXMubG9jYWxTdHJlYW0gPSBjb25maWcubG9jYWxTdHJlYW07XG5cbiAgICAgICAgICAgIC8vIFtjb25maWcub25DYWxsUmVzcG9uc2VdIG11c3QgYmUgZGVmaW5lZCBvbiBpbml0LCBvdGhlcndpc2UgaW5jb21pbmcgY2FsbCByZXNwb25zZSB3aWxsIGxvZyBhbiBlcnJvci5cbiAgICAgICAgICAgIC8vIFRoZSBldmVudCBpcyBtZWFudCB0byBnaXZlIHRoZSB1c2VyIGFuIG9wcG9ydHVuaXR5IHRvIGhhbmRsZSBhIGNhbGwgcmVzcG9uc2UuXG4gICAgICAgICAgICB0aGlzLnBhcmVudE9uQ2FsbFJlc3BvbnNlID0gY29uZmlnLm9uQ2FsbFJlc3BvbnNlIHx8IG9uQ2FsbFJlc3BvbnNlTm90RGVmaW5lZDtcblxuICAgICAgICAgICAgdGhpcy5DaGF0RW5naW5lLm1lLmRpcmVjdC5vbihbJyQnICsgJ3dlYlJUQycsICdpbmNvbWluZ0NhbGwnXS5qb2luKCcuJyksIChwYXlsb2FkKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5pbmNvbWluZ0NhbGwocGF5bG9hZCk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdGhpcy5DaGF0RW5naW5lLm1lLmRpcmVjdC5vbihbJyQnICsgJ3dlYlJUQycsICdjYWxsUmVzcG9uc2UnXS5qb2luKCcuJyksIChwYXlsb2FkKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsUmVzcG9uc2UocGF5bG9hZCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNvbm5lY3RlZCgpIHtcbiAgICAgICAgLy8gICAgIHRoaXMucGFyZW50LmVtaXQoWyckJyArICd3ZWJSVEMnLCAnY29ubmVjdGVkJ10uam9pbignLicpKTtcbiAgICAgICAgLy8gfVxuXG4gICAgICAgIGNhbGxVc2VyKHVzZXIsIGxvY2FsU3RyZWFtKSB7XG4gICAgICAgICAgICBsb2NhbFN0cmVhbSA9IGxvY2FsU3RyZWFtIHx8IHRoaXMubG9jYWxTdHJlYW07XG5cbiAgICAgICAgICAgIGlmICh1c2VyLm5hbWUgIT09ICdNZScpIHtcbiAgICAgICAgICAgICAgICB1c2VyLmRpcmVjdC5lbWl0KFsnJCcgKyAnd2ViUlRDJywgJ2luY29taW5nQ2FsbCddLmpvaW4oJy4nKSwge1xuICAgICAgICAgICAgICAgICAgICBjYWxsSWQ6IHV1aWQoKSxcbiAgICAgICAgICAgICAgICAgICAgc3RyZWFtOiBsb2NhbFN0cmVhbVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY2FsbFJlc3BvbnNlKHBheWxvYWQpIHtcbiAgICAgICAgICAgIGNvbnN0IHtjYWxsSWQsIGFjY2VwdENhbGx9ID0gcGF5bG9hZC5kYXRhO1xuICAgICAgICAgICAgY29uc3QgcmVtb3RlU3RyZWFtID0gcGF5bG9hZC5kYXRhLnN0cmVhbTtcbiAgICAgICAgICAgIGxldCB1dWlkID0gcGF5bG9hZC5zZW5kZXIudXVpZDtcbiAgICAgICAgICAgIHRoaXMucGFyZW50T25DYWxsUmVzcG9uc2UodXVpZCwgYWNjZXB0Q2FsbCwgcmVtb3RlU3RyZWFtKTtcblxuICAgICAgICAgICAgLy8gY29uc3Qge2NhbGxJZCwgYWNjZXB0Q2FsbH0gPSBwYXlsb2FkLmRhdGE7XG4gICAgICAgICAgICAvLyBjb25zdCBzZW5kZXIgPSBwYXlsb2FkLnNlbmRlcjtcbiAgICAgICAgICAgIC8vIGNvbnN0IHV1aWQgPSBzZW5kZXIudXVpZDtcbiAgICAgICAgICAgIC8vIGNvbnN0IHJlbW90ZVN0cmVhbSA9IHBheWxvYWQuZGF0YS5zdHJlYW07XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIENhbGxiYWNrIGlzIG9ubHkgY2FsbGVkIHRvIG9wZW4gdGhlIGNhbGwgMiB3YXlzLlxuICAgICAgICAgICAgLy8gT3RoZXJ3aXNlLCBkb24ndCBjYWxsIHRoaXMgZnJvbSBwYXJlbnQuXG4gICAgICAgICAgICAvLyBjb25zdCBjYWxsYmFjayA9IChsb2NhbFN0cmVhbSkgPT4ge1xuICAgICAgICAgICAgLy8gICAgIGxvY2FsU3RyZWFtID0gbG9jYWxTdHJlYW0gfHwgdGhpcy5sb2NhbFN0cmVhbTtcblxuICAgICAgICAgICAgLy8gICAgIHNlbmRlci5kaXJlY3QuZW1pdChbJyQnICsgJ3dlYlJUQycsICdwYXJ0bmVyU3RyZWFtJ10uam9pbignLicpLCB7XG4gICAgICAgICAgICAvLyAgICAgICAgIGNhbGxJZCxcbiAgICAgICAgICAgIC8vICAgICAgICAgc3RyZWFtOiBsb2NhbFN0cmVhbVxuICAgICAgICAgICAgLy8gICAgIH0pO1xuICAgICAgICAgICAgLy8gfTtcblxuICAgICAgICAgICAgLy8gaWYgYWNjZXB0Q2FsbCBpcyB0cnVlLCBnaXZlIHRoZW0geW91ciBzdHJlYW1cbiAgICAgICAgICAgIC8vIHRoaXMucGFyZW50T25DYWxsUmVzcG9uc2UoY2FsbGJhY2ssIHV1aWQsIGFjY2VwdENhbGwsIHJlbW90ZVN0cmVhbSk7XG4gICAgICAgIH1cblxuICAgICAgICBpbmNvbWluZ0NhbGwocGF5bG9hZCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ2luY29taW5nQ2FsbCcsIHBheWxvYWQpO1xuICAgICAgICAgICAgY29uc3Qgc2VuZGVyID0gcGF5bG9hZC5zZW5kZXI7XG4gICAgICAgICAgICBjb25zdCBjYWxsSWQgPSBwYXlsb2FkLmRhdGEuY2FsbElkO1xuICAgICAgICAgICAgY29uc3QgcmVtb3RlU3RyZWFtID0gcGF5bG9hZC5kYXRhLnN0cmVhbTtcblxuICAgICAgICAgICAgLy8gQ2FsbGJhY2sgaXMgb25seSBjYWxsZWQgdG8gb3BlbiB0aGUgY2FsbCAyIHdheXMuXG4gICAgICAgICAgICAvLyBPdGhlcndpc2UsIGRvbid0IGNhbGwgdGhpcyBmcm9tIHBhcmVudC5cbiAgICAgICAgICAgIGNvbnN0IGNhbGxSZXNwb25zZUNhbGxiYWNrID0gKGFjY2VwdENhbGwsIGxvY2FsU3RyZWFtKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5jYWxsUmVzcG9uc2VDYWNoZVtjYWxsSWRdID0gYWNjZXB0Q2FsbDtcbiAgICAgICAgICAgICAgICBzZW5kZXIuZGlyZWN0LmVtaXQoWyckJyArICd3ZWJSVEMnLCAnY2FsbFJlc3BvbnNlJ10uam9pbignLicpLCB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxJZCxcbiAgICAgICAgICAgICAgICAgICAgYWNjZXB0Q2FsbCxcbiAgICAgICAgICAgICAgICAgICAgc3RyZWFtOiBsb2NhbFN0cmVhbVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnBhcmVudE9uSW5jb21pbmdDYWxsKHNlbmRlci51dWlkLCByZW1vdGVTdHJlYW0sIGNhbGxSZXNwb25zZUNhbGxiYWNrKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGxldCBlbWl0ID0ge1xuICAgICAgICAvLyBjb25uZWN0ZWQ6IChwYXlsb2FkLCBuZXh0KSA9PiB7XG4gICAgICAgIC8vICAgICBwYXlsb2FkLmNoYXQud2ViUlRDLmNvbm5lY3RlZCgpO1xuICAgICAgICAvLyAgICAgbmV4dChudWxsLCBwYXlsb2FkKTtcbiAgICAgICAgLy8gfSxcbiAgICB9O1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgbmFtZXNwYWNlOiAnd2ViUlRDJyxcbiAgICAgICAgZXh0ZW5kczoge1xuICAgICAgICAgICAgQ2hhdDogZXh0ZW5zaW9uXG4gICAgICAgIH0sXG4gICAgICAgIG1pZGRsZXdhcmU6IHtcbiAgICAgICAgICAgIGVtaXRcbiAgICAgICAgfVxuICAgIH1cbn07XG4iXX0=

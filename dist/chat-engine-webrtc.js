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
// // me
// me.direct.on('private-message', (payload) => {
//     console.log(payload.sender.uuid, 'sent your a direct message');
// });

// // another instance
// them.direct.connect();
// them.direct.emit('private-message', {
//     secret: 42
// });

function uuid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

module.exports = (config) => {
    class extension {
        construct() {
            this.init();
        }

        init() {
            this.ChatEngine.me.direct.onAny((u) => {
                console.log(u);
                debugger;
            });
            console.log('register');
        }

        // connected() {
        //     this.parent.emit(['$' + 'webRTC', 'connected'].join('.'));
        // }

        callUser(user) {
            console.log('callUser', user);
            console.log('this', this);

            if (user.name !== 'Me') {
                user.direct.emit('$webRTC.incomingCall', {
                    callId: uuid()
                });
                console.log('fire');
            }
        }

        incomingCall(payload) {
            // payload.sender.uuid
            console.log('incomingCall', payload);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy5udm0vdmVyc2lvbnMvbm9kZS92OC4xMS4yL2xpYi9ub2RlX21vZHVsZXMvY2hhdC1lbmdpbmUtcGx1Z2luL25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIudG1wL3dyYXAuanMiLCJwYWNrYWdlLmpzb24iLCJzcmMvcGx1Z2luLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCIoZnVuY3Rpb24oKSB7XG5cbiAgICBjb25zdCBwYWNrYWdlID0gcmVxdWlyZSgnLi4vcGFja2FnZS5qc29uJyk7XG4gICAgd2luZG93LkNoYXRFbmdpbmVDb3JlLnBsdWdpbltwYWNrYWdlLm5hbWVdID0gcmVxdWlyZSgnLi4vc3JjL3BsdWdpbi5qcycpO1xuXG59KSgpO1xuIiwibW9kdWxlLmV4cG9ydHM9e1xuICBcImF1dGhvclwiOiBcIkFkYW0gQmF2b3NhXCIsXG4gIFwibmFtZVwiOiBcImNoYXQtZW5naW5lLXdlYnJ0Y1wiLFxuICBcInZlcnNpb25cIjogXCIwLjAuMVwiLFxuICBcIm1haW5cIjogXCJzcmMvcGx1Z2luLmpzXCIsXG4gIFwiZGVwZW5kZW5jaWVzXCI6IHtcbiAgICBcImNoYXQtZW5naW5lXCI6IFwiXjAuOS4xOFwiXG4gIH1cbn1cbiIsIi8vIC8vIG1lXG4vLyBtZS5kaXJlY3Qub24oJ3ByaXZhdGUtbWVzc2FnZScsIChwYXlsb2FkKSA9PiB7XG4vLyAgICAgY29uc29sZS5sb2cocGF5bG9hZC5zZW5kZXIudXVpZCwgJ3NlbnQgeW91ciBhIGRpcmVjdCBtZXNzYWdlJyk7XG4vLyB9KTtcblxuLy8gLy8gYW5vdGhlciBpbnN0YW5jZVxuLy8gdGhlbS5kaXJlY3QuY29ubmVjdCgpO1xuLy8gdGhlbS5kaXJlY3QuZW1pdCgncHJpdmF0ZS1tZXNzYWdlJywge1xuLy8gICAgIHNlY3JldDogNDJcbi8vIH0pO1xuXG5mdW5jdGlvbiB1dWlkKCkge1xuICAgIGZ1bmN0aW9uIHM0KCkge1xuICAgICAgICByZXR1cm4gTWF0aC5mbG9vcigoMSArIE1hdGgucmFuZG9tKCkpICogMHgxMDAwMClcbiAgICAgICAgICAgIC50b1N0cmluZygxNilcbiAgICAgICAgICAgIC5zdWJzdHJpbmcoMSk7XG4gICAgfVxuICAgIHJldHVybiBzNCgpICsgczQoKSArICctJyArIHM0KCkgKyAnLScgKyBzNCgpICsgJy0nICsgczQoKSArICctJyArIHM0KCkgKyBzNCgpICsgczQoKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSAoY29uZmlnKSA9PiB7XG4gICAgY2xhc3MgZXh0ZW5zaW9uIHtcbiAgICAgICAgY29uc3RydWN0KCkge1xuICAgICAgICAgICAgdGhpcy5pbml0KCk7XG4gICAgICAgIH1cblxuICAgICAgICBpbml0KCkge1xuICAgICAgICAgICAgdGhpcy5DaGF0RW5naW5lLm1lLmRpcmVjdC5vbkFueSgodSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKHUpO1xuICAgICAgICAgICAgICAgIGRlYnVnZ2VyO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygncmVnaXN0ZXInKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNvbm5lY3RlZCgpIHtcbiAgICAgICAgLy8gICAgIHRoaXMucGFyZW50LmVtaXQoWyckJyArICd3ZWJSVEMnLCAnY29ubmVjdGVkJ10uam9pbignLicpKTtcbiAgICAgICAgLy8gfVxuXG4gICAgICAgIGNhbGxVc2VyKHVzZXIpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdjYWxsVXNlcicsIHVzZXIpO1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ3RoaXMnLCB0aGlzKTtcblxuICAgICAgICAgICAgaWYgKHVzZXIubmFtZSAhPT0gJ01lJykge1xuICAgICAgICAgICAgICAgIHVzZXIuZGlyZWN0LmVtaXQoJyR3ZWJSVEMuaW5jb21pbmdDYWxsJywge1xuICAgICAgICAgICAgICAgICAgICBjYWxsSWQ6IHV1aWQoKVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdmaXJlJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpbmNvbWluZ0NhbGwocGF5bG9hZCkge1xuICAgICAgICAgICAgLy8gcGF5bG9hZC5zZW5kZXIudXVpZFxuICAgICAgICAgICAgY29uc29sZS5sb2coJ2luY29taW5nQ2FsbCcsIHBheWxvYWQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgbGV0IGVtaXQgPSB7XG4gICAgICAgIC8vIGNvbm5lY3RlZDogKHBheWxvYWQsIG5leHQpID0+IHtcbiAgICAgICAgLy8gICAgIHBheWxvYWQuY2hhdC53ZWJSVEMuY29ubmVjdGVkKCk7XG4gICAgICAgIC8vICAgICBuZXh0KG51bGwsIHBheWxvYWQpO1xuICAgICAgICAvLyB9LFxuICAgIH07XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBuYW1lc3BhY2U6ICd3ZWJSVEMnLFxuICAgICAgICBleHRlbmRzOiB7XG4gICAgICAgICAgICBDaGF0OiBleHRlbnNpb25cbiAgICAgICAgfSxcbiAgICAgICAgbWlkZGxld2FyZToge1xuICAgICAgICAgICAgZW1pdFxuICAgICAgICB9XG4gICAgfVxufTsiXX0=

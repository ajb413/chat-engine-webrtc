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
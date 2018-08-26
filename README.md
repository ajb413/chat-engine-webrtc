# WebRTC Video Chat Plugin for ChatEngine

Adds the ability to do WebRTC video in ChatEngine Chat

### Quick Start

## Example
```javascript
import { webRtcPlugin } from 'chat-engine-webrtc';

ChatEngine.on('$.ready', (data) => {
    const webRTC = ChatEngineCore.plugin['chat-engine-webrtc']();
    ChatEngine.proto('User', webRtcPlugin({
        onIncomingCall: (user, callback) => {
            incomingCallModal(user.uuid).then((accept) => {
                if (accept) {
                    getLocalStream().then((myVideoStream) => {
                        callback(accept, onPeerStream, myVideoStream);
                    });
                } else {
                    callback(accept);
                }
            });
        },
        rtcConfig: {
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
}
    }));

//needs a way to pass a public onIncomingCall!!!

let callConfig = {
    onCallResponse: (hasAcceptedCall) => {},
    onPeerStream: (stream) => {},
    onDisconnect: () => {}
};

callObject = user.webRTC(callConfig) //everything in config is required but not needed on init, can be passed later
callObject.dial(onPeerStream); // onPeerStream is optional
callObject.hangup();

// edit call event handlers using these methods, or pass them on init in an {}
callObject.onCallResponse((hasAcceptedCall) => {})
callObject.onPeerStream((stream) => {})
callObject.onDisconnect(() => {})

ChatEngine.on('$.ready', (data) => {
    const webRTC = ChatEngineCore.plugin['chat-engine-webrtc'](config);
    ChatEngine.proto('User', webRTC);
});
```
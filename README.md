# WebRTC Video Chat Plugin for ChatEngine

Adds the ability to do WebRTC video in ChatEngine Chat

### Quick Start

0. Have a ChatEngine server running already, instantiate a client and connect it
```js
const ChatEngine = ChatEngineCore.create({
    publishKey: 'pub-key-here',
    subscribeKey: 'sub-key-here'
});

ChatEngine.connect('Username');
ChatEngine.on('$ready', () = { ... });
```

1. Set WebRTC configuration and event handlers for WebRTC related events
```js
const rtcConfig = {
    iceServers: [] // See https://developer.mozilla.org/en-US/docs/Web/API/RTCConfiguration#Example
};

let localStream;
getLocalStream().then((myStream) => { localStream = myStream; }

const onPeerStream = (webRTCTrackEvent) => {
    // Set media stream to HTML video node
};

const onIncomingCall = (user, callResponseCallback) => {
    // Give user a chance to accept/reject
    const acceptedCall = true; // true to accept a call
    callResponseCallback({ acceptedCall });
};

const onCallResponse = (acceptedCall) => {
    if (acceptedCall) {
        // Show video UI, ect.
    }
};

const onDisconnect = () => {
    // Hide your video UI, ect.
};
```

2. Set configuration and attach this plugin to the `Me` object.
```js
// add the WebRTC plugin
let config = {
    rtcConfig,             // An RTCConfiguration dictionary from the browser WebRTC API
    ignoreNonTurn: false   // Only accept TURN candidates when this is true
    myStream: localStream, // Local MediaStream object from the browser Media Streams API
    onPeerStream,          // Event Handler
    onIncomingCall,        // Event Handler
    onCallResponse,        // Event Handler
    onDisconnect,          // Event Handler
};

const webRTC = ChatEngineCore.plugin['chat-engine-webrtc'];
ChatEngine.me.plugin(webRTC(config));
```

3. Send a call request to another user
```js
const userToCall = aChatEngineUserObject;
ChatEngine.me.webRTC.callUser(userToCall, {
    // 2nd chance to set configuration options
});
```

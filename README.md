# WebRTC Video Chat Plugin for ChatEngine

Adds the ability to do WebRTC audio/video with ChatEngine using `direct` events for [signaling](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Signaling_and_video_calling)

### Quick Start

0. Have a ChatEngine server running already, instantiate a client and connect it
```js
const ChatEngine = ChatEngineCore.create({
    publishKey: 'pub-key-here',
    subscribeKey: 'sub-key-here'
});

ChatEngine.connect('Username');
ChatEngine.on('$.ready', (data) => {
    // Set up ChatEngine and WebRTC config options
    // ...
    const webRTC = ChatEngineCore.plugin['chat-engine-webrtc'];
    ChatEngine.me.plugin(webRTC(config));
});

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
const config = {
    rtcConfig,             // An RTCConfiguration dictionary from the browser WebRTC API
    ignoreNonTurn: false,  // Only accept TURN candidates when this is true
    myStream: localStream, // Local MediaStream object from the browser Media Streams API
    onPeerStream,          // Event Handler
    onIncomingCall,        // Event Handler
    onCallResponse,        // Event Handler
    onDisconnect           // Event Handler
};

const webRTC = ChatEngineCore.plugin['chat-engine-webrtc'];
ChatEngine.me.plugin(webRTC(config));
```

3. Send a call request to another user
```js
const userToCall = aChatEngineUserObject;
ChatEngine.me.webRTC.callUser(userToCall, {
    // 2nd chance to set configuration options (see object in step 2)
});
```


# Frequently Asked Questions (FAQ) about the WebRTC Plugin

### Is the plugin officially a part of ChatEngine?
No. It is an open source project that is community supported. If you want to report a bug, do so on the [GitHub Issues page](https://github.com/ajb413/chat-engine-webrtc/issues).

### Does ChatEngine stream audio or video data?
No. ChatEngine pairs very well with WebRTC as a signaling service. This means that PubNub signals events from client to client using the ChatEngine #direct events. These events include:
- I, User A, would like to call you, User B
- User A is currently trying to call you, User B
- I, User B, accept your call User A
- I, User B, reject your call User A
- I, User B, would like to end our call User A
- I, User A, would like to end our call User B
- Text instant messaging like in Slack, Google Hangouts, Skype, Facebook Messenger, etc.

### Can I make a group call with more than 2 participants?
Group calling is possible to develop with WebRTC and ChatEngine, however, the current ChatEngine WebRTC plugin can connect only 2 users in a private call. The community may develop this feature in the future but there are no plans for development to date.

### I found a bug in the plugin. Where do I report it?
The ChatEngine WebRTC plugin is an [open source](https://github.com/ajb413/chat-engine-webrtc/blob/master/LICENSE), community supported project. This means that the best place to report bugs is on the [GitHub Issues page](https://github.com/ajb413/chat-engine-webrtc/issues) in for the code repository. The community will tackle the bug fix at will, so there is no guarantee that a fix will be made. If you wish to provide a code fix, fork the GitHub repository to your GitHub account, push fixes, and make a pull request ([process documented on GitHub](https://help.github.com/articles/creating-a-pull-request-from-a-fork/)).

const chatInterface = document.getElementById('chat-interface');
const myVideoSample = document.getElementById('my-video-sample');
const myVideo = document.getElementById('my-video');
const remoteVideo = document.getElementById('remote-video');
const videoModal = document.getElementById('video-modal');
const closeVideoButton = document.getElementById('close-video');

const brokenMyVideo = document.getElementById('broken-my-video');
const brokenSampleVideo = document.getElementById('broken-sample-video');

const usernameModal = document.getElementById('username-input-modal');
const usernameInput = document.getElementById('username-input');
const joinButton = document.getElementById('join-button');

const callConfirmModal = document.getElementById('call-confirm-modal');
const callConfirmUsername = document.getElementById('call-confirm-username');
const yesCallButton = document.getElementById('yes-call');
const noCallButton = document.getElementById('no-call');

const incomingCallModal = document.getElementById('incoming-call-modal');
const callFromSpan = document.getElementById('call-from');
const acceptCallButton = document.getElementById('accept-call');
const rejectCallButton = document.getElementById('reject-call');

const onlineList = document.getElementById('online-list');
const chat = document.getElementById('chat');
const log = document.getElementById('log');
const messageInput = document.getElementById('message-input');
const submit = document.getElementById('submit');

const hide = 'hide';
const uuid = newUuid();

// An RTCConfiguration dictionary from the browser WebRTC API
// Add STUN and TURN server information here for WebRTC calling
const rtcConfig = {};

let username; // local user name
let localStream; // Local audio and video stream
let noVideoTimeout; // Used for checking if video connection succeeded

// Xirsys API Info, not required for WebRTC, but it helps
const turnApiUrl = 'https://pubsub.pubnub.com/v1/blocks/sub-key/sub-c-7c977f32-a1b3-11e8-bc5d-ae80c5ea0c92/turn-credentials';
let turnToken;
request(turnApiUrl, 'GET').then((response) => { turnToken = response });


// Init the audio and video stream on this client
getLocalStream().then((myStream) => {
    localStream = myStream;
    myVideoSample.srcObject = localStream;
    myVideo.srcObject = localStream;
}).catch(() => {
    myVideo.classList.add(hide);
    myVideoSample.classList.add(hide);
    brokenMyVideo.classList.remove(hide);
    brokenSampleVideo.classList.remove(hide);
});

// Prompt user for a username input
getLocalUserName().then((myUsername) => {
    username = myUsername;
    usernameModal.classList.add(hide);

    // Connect ChatEngine after a username and UUID have been made
    ChatEngine.connect(uuid, {
        username
    }, 'auth-key');
});

// Send a message when Enter key is pressed
messageInput.addEventListener('keydown', (event) => {
    if (event.keyCode === 13 && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
        return;
    }
});

// Send a message when the submit button is clicked
submit.addEventListener('click', sendMessage);

// Register a disconnect event handler when the close video button is clicked
closeVideoButton.addEventListener('click', (event) => {
    videoModal.classList.add(hide);
    chatInterface.classList.remove(hide);
    clearTimeout(noVideoTimeout);
    ChatEngine.me.webRTC.disconnect();
});

// Disconnect ChatEngine before a user navigates away from the page
window.onbeforeunload = (event) => {
    ChatEngine.disconnect();
};

// Init ChatEngine
const ChatEngine = ChatEngineCore.create({
    publishKey: 'pub-c-60a065cb-fe91-432c-b50e-bd4974cb1f01',
    subscribeKey: 'sub-c-7c977f32-a1b3-11e8-bc5d-ae80c5ea0c92'
}, {
    globalChannel: 'chat-engine-webrtc-example'
});

// Init the WebRTC plugin and chat interface here
ChatEngine.on('$.ready', (data) => {
    let onlineUuids = [];

    const onPeerStream = (webRTCTrackEvent) => {
        console.log('Peer a/v stream now available');
        const peerStream = webRTCTrackEvent.streams[0];
        window.peerStream = peerStream;
        remoteVideo.srcObject = peerStream;
    };

    const onIncomingCall = (user, callResponseCallback) => {
        console.log('Incoming Call from ', user.state.username);
        incomingCall(user.state.username).then((acceptedCall) => {
            if (acceptedCall) {
                // End an already open call before opening a new one
                ChatEngine.me.webRTC.disconnect();
                videoModal.classList.remove(hide);
                chatInterface.classList.add(hide);
                noVideoTimeout = setTimeout(noVideo, 5000);
            }

            callResponseCallback({ acceptedCall });
        });
    };

    const onCallResponse = (acceptedCall) => {
        console.log('Call response: ', acceptedCall ? 'accepted' : 'rejected');
        if (acceptedCall) {
            videoModal.classList.remove(hide);
            chatInterface.classList.add(hide);
            noVideoTimeout = setTimeout(noVideo, 5000);
        }
    };

    const onDisconnect = () => {
        console.log('Call disconnected');
        videoModal.classList.add(hide);
        chatInterface.classList.remove(hide);
        clearTimeout(noVideoTimeout);
    };

    // add the WebRTC plugin
    let config = {
        rtcConfig,
        ignoreNonTurn: false,
        myStream: localStream,
        onPeerStream,
        onIncomingCall,
        onCallResponse,
        onDisconnect
    };

    const webRTC = ChatEngineCore.plugin['chat-engine-webrtc'];
    ChatEngine.me.plugin(webRTC(config));

    // Add a user to the online list when they connect
    ChatEngine.global.on('$.online.*', (payload) => {
        if (payload.user.name === 'Me') {
            return;
        }

        const userId = payload.user.uuid;
        const name = payload.user.state.username;

        const userListDomNode = createUserListItem(userId, name);

        const index = onlineUuids.findIndex(id => id === payload.user.uuid);
        const alreadyInList = index > -1 ? true : false;

        if (!alreadyInList) {
            onlineUuids.push(payload.user.uuid);
        } else {
            return;
        }

        onlineList.appendChild(userListDomNode);

        userListDomNode.addEventListener('click', (event) => {
            const userId = userListDomNode.id;
            const userToCall = payload.user;

            confirmCall(name).then((yesDoCall) => {
                if (yesDoCall) {
                    // Get new TURN server credentials from Xirsys
                    // Not Required but it is more reliable than peer-to-peer
                    request(turnApiUrl, 'PUT', {
                        'headers': { 'tok': turnToken }
                    }).then((response) => {
                        rtcConfig.iceServers = [response];
                        ChatEngine.me.webRTC.callUser(userToCall, {
                            myStream: localStream
                        });
                    });
                }
            });
        });
    });

    // Remove a user from the online list when they disconnect
    ChatEngine.global.on('$.offline.*', (payload) => {
        const index = onlineUuids.findIndex((id) => id === payload.user.uuid);
        onlineUuids.splice(index, 1);

        const div = document.getElementById(payload.user.uuid);
        if (div) div.remove();
    });

    // Render up to 20 old messages in the global chat
    ChatEngine.global.search({
        reverse: true,
        event: 'message',
        limit: 20
    }).on('message', renderMessage);

    // Render new messages in realtime
    ChatEngine.global.on('message', renderMessage);
});


// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// UI Render Functions
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
function renderMessage(message) {
    const messageDomNode = createMessageHTML(message);

    log.append(messageDomNode);

    // Sort messages in chat log based on their timetoken
    sortNodeChildren(log, 'id');

    chat.scrollTop = chat.scrollHeight;
}

function incomingCall(name) {
    return new Promise((resolve) => {
        acceptCallButton.onclick = function() {
            incomingCallModal.classList.add(hide);
            resolve(true);
        }

        rejectCallButton.onclick = function() {
            incomingCallModal.classList.add(hide);
            resolve(false);
        }

        callFromSpan.innerHTML = name;
        incomingCallModal.classList.remove(hide);
    });
}

function confirmCall(name) {
    return new Promise((resolve) => {
        yesCallButton.onclick = function() {
            callConfirmModal.classList.add(hide);
            resolve(true);
        }

        noCallButton.onclick = function() {
            callConfirmModal.classList.add(hide);
            resolve(false);
        }

        callConfirmUsername.innerHTML = name;
        callConfirmModal.classList.remove(hide);
    });
}

function getLocalUserName() {
    return new Promise((resolve) => {
        usernameInput.focus();
        usernameInput.value = '';

        usernameInput.addEventListener('keyup', (event) => {
            const nameLength = usernameInput.value.length;

            if (nameLength > 0) {
                joinButton.classList.remove('disabled');
            } else {
                joinButton.classList.add('disabled');
            }

            if (event.keyCode === 13 && nameLength > 0) {
                resolve(usernameInput.value);
            }
        });

        joinButton.addEventListener('click', (event) => {
            const nameLength = usernameInput.value.length;
            if (nameLength > 0) {
                resolve(usernameInput.value);
            }
        });
    });
}

function getLocalStream() {
    return new Promise((resolve, reject) => {
        navigator.mediaDevices
        .getUserMedia({
            audio: true,
            video: true
        })
        .then((avStream) => {
            resolve(avStream);
        })
        .catch((err) => {
            alert('Cannot access local camera or microphone.');
            console.error(err);
            reject();
        });
    });
}

function createUserListItem(userId, name) {
    const div = document.createElement('div');
    div.id = userId;

    const img = document.createElement('img');
    img.src = './phone.png';

    const span = document.createElement('span');
    span.innerHTML = name;

    div.appendChild(img);
    div.appendChild(span);

    return div;
}

function createMessageHTML(message) {
    const text = message.data.text;
    const user = message.sender.state.username;
    const jsTime = parseInt(message.timetoken.substring(0,13));
    const dateString = new Date(jsTime).toLocaleString();

    const div = document.createElement('div');
    const b = document.createElement('b');

    div.id = message.timetoken;
    b.innerHTML = `${user} (${dateString}): `;

    div.appendChild(b);
    div.innerHTML += text;

    return div;
}


// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// Utility Functions
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
function sendMessage() {
    const messageToSend = messageInput.value.replace(/\r?\n|\r/g, '');
    const trimmed = messageToSend.replace(/(\s)/g, '');

    if (trimmed.length > 0) {
        ChatEngine.global.emit('message', {
            text: messageToSend
        });
    }

    messageInput.value = '';
}

// Makes a new, version 4, universally unique identifier (UUID). Written by
//     Stack Overflow user broofa
//     (https://stackoverflow.com/users/109538/broofa) in this post
//     (https://stackoverflow.com/a/2117523/6193736).
function newUuid() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(
        /[018]/g,
        (c) => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4)
            .toString(16)
    );
}

// Sorts sibling HTML elements based on an attribute value
function sortNodeChildren(parent, attribute) {
    const length = parent.children.length;
    for (let i = 0; i < length-1; i++) {
        if (parent.children[i+1][attribute] < parent.children[i][attribute]) {
            parent.children[i+1].parentNode
                .insertBefore(parent.children[i+1], parent.children[i]);
            i = -1;
        }
    }
}

function noVideo() {
    const message = 'No peer connection made.\n' +
        'Try adding a TURN server to the WebRTC configuration.';

    if (remoteVideo.paused) {
        alert(message);
    }
}

/**
 * Helper function to make an HTTP request wrapped in an ES6 Promise.
 *
 * @param {String} url URL of the resource that is being requested.
 * @param {String} method POST, GET, PUT, etc.
 * @param {Object} options JSON Object with HTTP request options, "header"
 *     Object of possible headers to set, and a body Object of a request body.
 *
 * @return {Promise} Resolves a parsed JSON Object or String response text if
 *     the response code is in the 200 range. Rejects with response status text
 *     when the response code is outside of the 200 range.
 */
function request(url, method, options) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        let contentTypeIsSet = false;
        options = options || {};
        xhr.open(method, url);

        for (let header in options.headers) {
            if ({}.hasOwnProperty.call(options.headers, header)) {
                header = header.toLowerCase();
                contentTypeIsSet = header === 'content-type' ? true : contentTypeIsSet;
                xhr.setRequestHeader(header, options.headers[header]);
            }
        }

        if (!contentTypeIsSet) {
            xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
        }

        xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) {
                let response;
                try {
                    response = JSON.parse(xhr.response);
                } catch (e) {
                    response = xhr.response;
                }
                resolve(response);
            } else {
                reject({
                    status: xhr.status,
                    statusText: xhr.statusText,
                });
            }
        };

        xhr.send(JSON.stringify(options.body));
    });
}

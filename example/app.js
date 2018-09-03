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

const rtcConfig = {
    iceServers: [{
        'urls': [
            'turn:w2.xirsys.com:80?transport=udp',
            'turn:w2.xirsys.com:3478?transport=udp',
            'turn:w2.xirsys.com:80?transport=tcp',
            'turn:w2.xirsys.com:3478?transport=tcp',
            'turns:w2.xirsys.com:443?transport=tcp',
            'turns:w2.xirsys.com:5349?transport=tcp'
        ],
        'credential': '35426d02-a7c3-11e8-98a1-f9e0e877debe',
        'username': '35426bfe-a7c3-11e8-a8bd-e7d0be3af999'
    }]
};

let username;
let localStream;

getLocalStream()
.then((myStream) => {
    localStream = myStream;
    myVideoSample.srcObject = localStream;
    myVideo.srcObject = localStream;
}).catch(() => {
    myVideo.classList.add(hide);
    myVideoSample.classList.add(hide);
    brokenMyVideo.classList.remove(hide);
    brokenSampleVideo.classList.remove(hide);
});

getLocalUserName().then((myUsername) => {
    username = myUsername;
    usernameModal.classList.add(hide);

    ChatEngine.connect(uuid, {
        username
    }, 'auth-key');
});

messageInput.addEventListener('keyup', (event) => {
    if (event.keyCode === 13 && !event.shiftKey) {
        sendMessage();
    }
});

submit.addEventListener('click', sendMessage);

closeVideoButton.addEventListener('click', (event) => {
    videoModal.classList.add(hide);
    chatInterface.classList.remove(hide);
    ChatEngine.me.webRTC.disconnect();
});

const ChatEngine = ChatEngineCore.create({
    publishKey: 'pub-c-60a065cb-fe91-432c-b50e-bd4974cb1f01',
    subscribeKey: 'sub-c-7c977f32-a1b3-11e8-bc5d-ae80c5ea0c92'
}, {
    globalChannel: 'chat-engine-webrtc-example'
});

function incomingCall(name) {
    return new Promise((resolve) => {
        acceptCallButton.onclick = function() {
            ChatEngine.me.webRTC.disconnect();
            incomingCallModal.classList.add(hide);
            videoModal.classList.remove(hide);
            chatInterface.classList.add(hide);
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
            ChatEngine.me.webRTC.disconnect();
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

function createMessage(message) {
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

/**
 * Makes a new, version 4, universally unique identifier (UUID). Written by
 *     Stack Overflow user broofa
 *     (https://stackoverflow.com/users/109538/broofa) in this post
 *     (https://stackoverflow.com/a/2117523/6193736).
 *
 * @returns {string} A version 4 compliant UUID.
 */
function newUuid() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(
        /[018]/g,
        (c) => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4)
            .toString(16)
    );
}

ChatEngine.on('$.ready', (data) => {
    let onlineUuids = [];

    const onPeerStream = (webRTCTrackEvent) => {
        let peerStream = webRTCTrackEvent.streams[0];
        remoteVideo.srcObject = peerStream;
    };

    const onIncomingCall = (user, callResponseCallback) => {
        incomingCall(user.state.username).then((acceptedCall) => {
            callResponseCallback({ acceptedCall });
        });
    };

    const onCallResponse = (acceptedCall) => {
        console.log('onCallResponse');
        if (acceptedCall) {

            videoModal.classList.remove(hide);
            chatInterface.classList.add(hide);
        }
    };

    const onDisconnect = () => {
        console.log('call disconnected');
        videoModal.classList.add(hide);
        chatInterface.classList.remove(hide);
    };

    // add the WebRTC plugin
    let config = {
        onIncomingCall,
        onCallResponse,
        onDisconnect,
        onPeerStream,
        myStream: localStream,
        // rtcConfig,
        // ignoreNonTurn: true
    };

    const webRTC = ChatEngineCore.plugin['chat-engine-webrtc'];
    ChatEngine.me.plugin(webRTC(config));

    // Add a user from the online list when they connect
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

        userListDomNode.addEventListener('click', (event) => {
            const userId = userListDomNode.id;
            const userToCall = payload.user;

            confirmCall(name).then((doCall) => {
                if (doCall) {
                    ChatEngine.me.webRTC.callUser(userToCall, {
                        myStream: localStream
                    });
                }
            });
        });

        onlineList.appendChild(userListDomNode);
    });

    // Remove a user from the online list if they disconnect
    ChatEngine.global.on('$.offline.*', (payload) => {
        const index = onlineUuids.findIndex(id => id === payload.user.uuid);
        onlineUuids.splice(index, 1);

        const div = document.getElementById(payload.user.uuid);
        if (div) div.remove();
    });

    // search for 20 old `message` events
    ChatEngine.global.search({
        reverse: true,
        event: 'message',
        limit: 20
    }).on('message', (data) => {
      renderMessage(data);
    });

    ChatEngine.global.on('message', (data) => {
        renderMessage(data);
    });
});

window.onbeforeunload = function(event) {
    ChatEngine.disconnect();
};

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

function renderMessage(message) {
    const messageDomNode = createMessage(message);

    log.append(messageDomNode);

    // Sort messages in chat log based on their timetoken
    sortNodeChildren(log, 'id');

    chat.scrollTop = chat.scrollHeight;
}

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

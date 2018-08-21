const now = new Date().getTime();
const username = ['user', now].join('-');

const onlineOutput = document.getElementById('online-list');
const myVideoContainer = document.getElementById('my-video');
const theirVideoContainer = document.getElementById('their-video');
const header = document.getElementById('header');
const modal = document.getElementById('incoming-call-modal');
const incommingSpan = document.getElementById('incomming');
const accept = document.getElementById('accept');
const reject = document.getElementById('reject');

let localStream;

const ChatEngine = ChatEngineCore.create({
    publishKey: 'pub-c-60a065cb-fe91-432c-b50e-bd4974cb1f01',
    subscribeKey: 'sub-c-7c977f32-a1b3-11e8-bc5d-ae80c5ea0c92'
}, {
    // debug: true,
    globalChannel: 'chat-engine-online-example'
});

function incomingCallModal(uuid) {
    return new Promise((resolve) => {
        accept.onclick = function() {
            modal.classList.remove('visible');
            resolve(true);
        }

        reject.onclick = function() {
            modal.classList.remove('visible');
            resolve(false);
        }

        modal.classList.add('visible');
        incommingSpan.innerHTML = `Incomming all from ${uuid}`;
    });
}

function getLocalStream() {
    return new Promise((resolve, reject) => {
        navigator.mediaDevices
        .getUserMedia({
            audio: true,
            video: true
        })
        .then((stream) => {
            myVideoContainer.srcObject = stream;
            resolve(stream);
        })
        .catch(e => {
            alert(`getUserMedia() error: ${e.name}`);
            reject();
        });
    });
}

ChatEngine.on('$.ready', (data) => {
    let onlineEvents = 0;

    header.innerHTML = '<b>Online Now</b><br>You are <b>' + username + '</b>';

    // function to fire when the partner's video stream becomes available
    const onRemoteVideoStreamAvailable = (webRTCTrackEvent) => {
        let theirVideoStream = webRTCTrackEvent.streams[0];
        theirVideoContainer.srcObject = theirVideoStream;
    };

    const onIncomingCall = (senderUuid, callResponseCallback) => {
        incomingCallModal(senderUuid).then((accept) => {
            if (accept) {
                getLocalStream().then((myVideoStream) => {
                    callResponseCallback(accept, onRemoteVideoStreamAvailable, myVideoStream);
                });
            } else {
                callResponseCallback(accept);
            }
        });
    };

    const onCallResponse = (uuid, acceptCall, theirVideoStream) => {
        console.log('onCallResponse', uuid, acceptCall, theirVideoStream);
    };

    const onCallDisconnect = (uuid) => {
        console.log('call disconnected', uuid);
    };

    // add the WebRTC plugin
    let config = {
        onIncomingCall,
        onCallResponse,
        onCallDisconnect
    };

    const webRTC = ChatEngineCore.plugin['chat-engine-webrtc'](config);

    ChatEngine.global.plugin(webRTC);

    ChatEngine.global.on('$.online.*', (payload) => {
        let div = document.createElement("li");
        div.innerHTML = payload.user.uuid;
        div.className += " list-group-item";

        div.onclick = (e) => {
            let userToCall = e.target.textContent;
            getLocalStream().then((stream) => {
                localStream = stream;
                if (ChatEngine.users[userToCall]) {
                    window.callMe = ChatEngine.global.webRTC.callUser(ChatEngine.users[userToCall], onRemoteVideoStreamAvailable, localStream);
                } else {
                    throw Error('User you are trying to call does not exist');
                }
            });
        }

        onlineOutput.appendChild(div);
        onlineEvents++;
    });

});

ChatEngine.connect(username, {
    signedOnTime: now
}, 'auth-key');

document.addEventListener('beforeunload', function() {
    ChatEngine.disconnect();
});

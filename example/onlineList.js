const now = new Date().getTime();
const username = ['user', now].join('-');

const onlineOutput = document.getElementById('online-list');
const myVideoContainer = document.getElementById('my-video');
const theirVideoContainer = document.getElementById('their-video');
const header = document.getElementById('header');
const modal = document.getElementById('incoming-call-modal-background');
const incommingSpan = document.getElementById('incomming');
const accept = document.getElementById('accept');
const reject = document.getElementById('reject');
const hangup = document.getElementById('hangup');

let localStream;

let rtcConfig = {
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

const ChatEngine = ChatEngineCore.create({
    publishKey: 'pub-c-60a065cb-fe91-432c-b50e-bd4974cb1f01',
    subscribeKey: 'sub-c-7c977f32-a1b3-11e8-bc5d-ae80c5ea0c92'
}, {
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

function disconnect(user) {
    user.webRTC.disconnect();
}

hangup.disabled = true;

ChatEngine.on('$.ready', (data) => {
    let onlineUuids = [];

    header.innerHTML = '<b>Online Now</b><br>You are <b>' + username + '</b>';

    // function to fire when the partner's video stream becomes available
    const onPeerStream = (webRTCTrackEvent) => {
        let peerStream = webRTCTrackEvent.streams[0];
        theirVideoContainer.srcObject = peerStream;
    };

    const onIncomingCall = (user, callResponseCallback) => {
        incomingCallModal(user.uuid).then((acceptedCall) => {
            if (acceptedCall) {
                getLocalStream().then((myStream) => {
                    callResponseCallback({
                        acceptedCall,
                        myStream
                    });
                });
            } else {
                callResponseCallback(acceptedCall);
            }
        });
    };

    const onCallResponse = (one, two, three) => {
        console.log('onCallResponse', one, two, three);
        hangup.disabled = false;
    };

    const onDisconnect = (one) => {
        console.log('call disconnected', one);
    };

    // add the WebRTC plugin
    let config = {
        onIncomingCall,
        onCallResponse,
        onDisconnect,
        onPeerStream,
        // rtcConfig,
        // ignoreNonTurn: true
    };

    const webRTC = ChatEngineCore.plugin['chat-engine-webrtc'];
    ChatEngine.me.plugin(webRTC(config));

    // Add a user from the online list when they connect
    ChatEngine.global.on('$.online.*', (payload) => {
        let div = document.createElement("li");

        div.innerHTML = div.id = payload.user.uuid;
        div.className += " list-group-item";

        let alreadyInList = onlineUuids.findIndex(id => id === payload.user.uuid) > -1 ? true : false;
        if (!alreadyInList) {
            onlineUuids.push(payload.user.uuid);
        } else {
            return;
        }

        div.onclick = (e) => {
            let userToCall = ChatEngine.users[e.target.textContent];
            getLocalStream().then((stream) => {
                if (userToCall) {
                    ChatEngine.me.webRTC.callUser(userToCall, {
                        myStream: stream
                    })
                } else {
                    throw Error('User you are trying to call does not exist');
                }
            });
        }

        onlineOutput.appendChild(div);
    });

    // Remove a user from the online list if they disconnect
    ChatEngine.global.on('$.offline.*', (payload) => {
        let index = onlineUuids.findIndex(id => id === payload.user.uuid);
        onlineUuids.splice(index, 1);

        let div = document.getElementById(payload.user.uuid);
        div.remove();
    })

});

ChatEngine.connect(username, {
    signedOnTime: now
}, 'auth-key');

window.onbeforeunload = function(event) {
    ChatEngine.disconnect();
};

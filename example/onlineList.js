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

const ChatEngine = ChatEngineCore.create({
    publishKey: 'pub-c-60a065cb-fe91-432c-b50e-bd4974cb1f01',
    subscribeKey: 'sub-c-7c977f32-a1b3-11e8-bc5d-ae80c5ea0c92'
}, {
    // debug: true,
    globalChannel: 'chat-engine-online-example'
});

function incomingCallModal(uuid) {
    console.log('incomingCallModal', uuid);
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
    return 'stream1';
}

ChatEngine.on('$.ready', (data) => {
    let onlineEvents = 0;

    header.innerHTML = '<b>Online Now</b><br>You are <b>' + username + '</b>';

    const onIncomingCall = (senderUuid, remoteStream, callResponseCallback) => {
        incomingCallModal(senderUuid).then((accept) => {
            let localStream = accept ? 'stream' : null; //move this later
            callResponseCallback(accept, localStream);
            console.log('onIncomingCall', senderUuid, remoteStream, localStream, accept);
        });
    };

    const onCallResponse = (uuid, acceptCall, remoteStream) => {
        console.log('onCallResponse', uuid, acceptCall, remoteStream);
    };

    // add the WebRTC plugin
    let config = {
        onIncomingCall,
        onCallResponse
    };

    const webRTC = ChatEngineCore.plugin['chat-engine-webrtc'](config);

    ChatEngine.global.plugin(webRTC);

    ChatEngine.global.on('$.online.*', (payload) => {
        let div = document.createElement("li");
        div.innerHTML = payload.user.uuid;
        div.className += " list-group-item";

        div.onclick = (e) => {
            let userToCall = e.target.textContent;
            let localStream = getLocalStream();

            if (ChatEngine.users[userToCall]) {
                ChatEngine.global.webRTC.callUser(ChatEngine.users[userToCall], localStream);
            } else {
                throw Error('User you are trying to call does not exist');
            }
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
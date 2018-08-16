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
    publishKey: 'pub-c-d8599c43-cecf-42ba-a72f-aa3b24653c2b',
    subscribeKey: 'sub-c-6c6c021c-c4e2-11e7-9628-f616d8b03518'
}, {
    // debug: true,
    globalChannel: 'chat-engine-online-example'
});

function incomingCallModal(uuid) {
    console.log('incomingCallModal', uuid);
    return new Promise((resolve, reject) => {
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

ChatEngine.on('$.ready', () => {
    let onlineEvents = 0;

    header.innerHTML = '<b>Online Now</b><br>You are <b>' + username + '</b>';

    // add the WebRTC plugin
    let config = {};
    const webRTC = ChatEngineCore.plugin['chat-engine-webrtc'](config);

    ChatEngine.global.plugin(webRTC);

    ChatEngine.global.on('$.online.*', (payload) => {
        let div = document.createElement("li");
        div.innerHTML = payload.user.uuid;
        div.className += " list-group-item";

        div.onclick = (e) => {
            let userToCall = e.target.textContent;

            if (ChatEngine.users[userToCall]) {
                ChatEngine.global.webRTC.callUser(ChatEngine.users[userToCall]);
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
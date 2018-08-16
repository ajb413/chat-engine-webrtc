let pc1;
let pc2;

function getName(pc) {
  return (pc === pc1) ? 'pc1' : 'pc2';
}

function getOtherPc(pc) {
  return (pc === pc1) ? pc2 : pc1;
}

function onAddIceCandidateSuccess(pc) {
    // For development only
    console.log(`${getName(pc)} addIceCandidate success`);
}

function onAddIceCandidateError(pc, error) {
    // For development only
    console.log(`${getName(pc)} failed to add ICE Candidate: ${error.toString()}`);
}

function onCreateSessionDescriptionError(error) {
    // For development only
    console.log(`Failed to create session description: ${error.toString()}`);
}

function onCreateOfferSuccess(desc) {
    pc1.setLocalDescription(desc).then(() => onSetLocalSuccess(pc1), onSetSessionDescriptionError);
    pc2.setRemoteDescription(desc).then(() => onSetRemoteSuccess(pc2), onSetSessionDescriptionError);
    // Since the 'remote' side has no media stream we need
    // to pass in the right constraints in order for it to
    // accept the incoming offer of audio and video.
    pc2.createAnswer().then(onCreateAnswerSuccess, onCreateSessionDescriptionError);
}

function onIceCandidate(pc, event) {
    getOtherPc(pc).addIceCandidate(event.candidate)
        .then(() => onAddIceCandidateSuccess(pc), err => onAddIceCandidateError(pc, err));
}


module.exports = (config) => {
    class extension {
        construct() {
            this.init();
        }

        init() {
            this.localVideoElement;
            this.remoteVideoElement;
        }

        connected() {
            this.parent.emit(['$' + 'webRTC', 'connected'].join('.'));
        }

        disconnected() {
            this.parent.emit(['$' + 'webRTC', 'disconnected'].join('.'));
        }

        unable() {
            this.parent.emit(['$' + 'webRTC', 'unable'].join('.'));
        }

        refused() {
            this.parent.emit(['$' + 'webRTC', 'refused'].join('.'));
        }

        incomingCall() {
            this.parent.emit(['$' + 'webRTC', 'incomingCall'].join('.'));
        }

        hangup() {
            pc1.close();
            pc2.close();
            pc1 = null;
            pc2 = null;
            this.disconnected();
        }

        callUser(uuid) {
            const offerOptions = {
                offerToReceiveAudio: 1,
                offerToReceiveVideo: 1
            };

            let videoTracks = this.localStream.getVideoTracks();
            let audioTracks = this.localStream.getAudioTracks();
            let servers = null;
            
            pc1 = new RTCPeerConnection(servers);
            pc1.onicecandidate = e => onIceCandidate(pc1, e);

            pc2 = new RTCPeerConnection(servers);
            pc2.onicecandidate = e => onIceCandidate(pc2, e);
            
            pc1.oniceconnectionstatechange = e => onIceStateChange(pc1, e);
            pc2.oniceconnectionstatechange = e => onIceStateChange(pc2, e);
            pc2.ontrack = onRemoteStream;

            this.localStream.getTracks().forEach(track => pc1.addTrack(track, this.localStream));
            pc1.createOffer(offerOptions).then(onCreateOfferSuccess, onCreateSessionDescriptionError);
        }

        acceptCall() {
            const offerOptions = {
                offerToReceiveAudio: 1,
                offerToReceiveVideo: 1
            };

            let videoTracks = this.localStream.getVideoTracks();
            let audioTracks = this.localStream.getAudioTracks();
            let servers = null;
            
            pc1 = new RTCPeerConnection(servers);
            pc1.onicecandidate = e => onIceCandidate(pc1, e);

            pc2 = new RTCPeerConnection(servers);
            pc2.onicecandidate = e => onIceCandidate(pc2, e);
            
            pc1.oniceconnectionstatechange = e => onIceStateChange(pc1, e);
            pc2.oniceconnectionstatechange = e => onIceStateChange(pc2, e);
            pc2.ontrack = onRemoteStream;

            this.localStream.getTracks().forEach(track => pc1.addTrack(track, this.localStream));
            pc1.createOffer(offerOptions).then(onCreateOfferSuccess, onCreateSessionDescriptionError);
        }

        setLocalVideo(videoElement, stream) {
            videoElement.srcObject = stream;
            this.localVideoElement = videoElement;
        }

        setRemoteVideo(videoElement) {
            this.remoteVideoElement = videoElement;
        }

        onRemoteStream(e) {
            if (this.remoteVideoElement && this.remoteVideoElement.srcObject !== e.streams[0]) {
                this.remoteVideoElement.srcObject = e.streams[0];
            }
        }
    }

    let emit = {
        // connected: (payload, next) => {
        //     payload.chat.webRTC.connected();
        //     next(null, payload);
        // },
        // disconnected: (payload, next) => {
        //     payload.chat.webRTC.disconnected();
        //     next(null, payload);
        // },
        // unable: (payload, next) => {
        //     payload.chat.webRTC.unable();
        //     next(null, payload);
        // }
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
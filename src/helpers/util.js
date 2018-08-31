/**
 * @file Utility functions for plugin.js.
 * @author Adam Bavosa <adamb@pubnub.com>
 */

const peerIceCandidateEvent = ['$' + 'webRTC', 'peerIceCandidate'].join('.');
const incomingCallEvent = ['$' + 'webRTC', 'incomingCall'].join('.');
const callResponseEvent = ['$' + 'webRTC', 'callResponse'].join('.');

/**
 * Makes a new, version 4, universally unique identifier (UUID). Written by
 *     Stack Overflow user broofa
 *     (https://stackoverflow.com/users/109538/broofa) in this post
 *     (https://stackoverflow.com/a/2117523/6193736).
 *
 * @returns {string} A version 4 compliant UUID.
 */
function uuid() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(
        /[018]/g,
        (c) => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4)
            .toString(16)
    );
}

const eventNames = {
    peerIceCandidateEvent,
    incomingCallEvent,
    callResponseEvent
}

module.exports = {
    uuid,
    eventNames
};

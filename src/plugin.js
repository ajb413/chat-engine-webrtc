/**
 * 
 */

/**
 * @function
 * @param {Object} [config={}] The plugin config object
 * @example
 */
module.exports = (config = {}) => {
    class extension {
        construct() {

        }
    }

    return {
        namespace: 'webRTC',
        extends: {
            User: extension,
        }
    }
}

/**
 * Makes a new, version 4, universally unique identifier (UUID).
 *
 * @returns {String} A version 4 compliant UUID.
 */
function uuid() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(
        /[018]/g,
        (c) => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4)
            .toString(16)
    );
}

/**
 * A function that is called if the client did not pass a parent onIncomingCall
 *    event handler to the WebRTC plugin instance.
 *
 * @param {Function} callback Callback for onIncomingCall. Accepts boolean for
 *    accepting a call. The call is automatically rejected because a function
 *    for UI input (accept/reject) is not defined.
 *
 * @throws Throws an error using the ChatEngine throwError function.
 *
 * @returns {void}
 */
function onIncomingCallNotDefined(callback) {
    const functionName = 'onIncomingCallNotDefined';
    const message ='A handler for the [onIncomingCall] event is not defined.';
    this.ChatEngine.throwError(this, functionName, 'webRTC', new Error(message), {});
    callback(false);
}

/**
 * A function that is called if the client did not pass an onCallResponse event
 *    handler to the call object instance.
 *
 * @throws Throws an error using the ChatEngine throwError function.
 *
 * @returns {void}
 */
function onCallResponseNotDefined() {
    const functionName = 'onCallResponseNotDefined';
    const message ='A handler for the [onCallResponse] event is not defined.';
    this.ChatEngine.throwError(this, functionName, 'webRTC', new Error(message));
}

/**
 * A function that is called if the client did not pass an onPeerStream event
 *    handler to the call object instance.
 *
 * @throws Throws an error using the ChatEngine throwError function.
 *
 * @returns {void}
 */
function onPeerStreamNotDefined() {
    const functionName = 'onPeerStreamNotDefined';
    const message = 'A handler for the [onPeerStream] event is not defined.';
    this.ChatEngine.throwError(this, functionName, 'webRTC', new Error(message));
}

/**
 * A function that is called if the client did not pass an onDisconnect event
 *    handler to the call object instance.
 *
 * @throws Throws an error using the ChatEngine throwError function.
 *
 * @returns {void}
 */
function onDisconnectNotDefined() {
    const functionName = 'onDisconnectNotDefined';
    const message = 'A handler for the [onDisconnect] event is not defined.';
    this.ChatEngine.throwError(this, functionName, 'webRTC', new Error(message));
}

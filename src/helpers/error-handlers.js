/**
 * @file Fallback event handlers set in the WebRTCCall constructor. If the
 *     client does not provide any of the noted event handlers, these functions
 *     will execute and throw a ChatEngine error with ChatEngine.throwError.
 *     These functions must be called using the JavaScript call or apply methods
 *     so ChatEngine can be referenced.
 * @author Adam Bavosa <adamb@pubnub.com>
 */

/**
 * A function that is called if the client did not pass a parent onIncomingCall
 *     event handler to the WebRTC plugin instance.
 *
 * @param {Function} callback Callback for onIncomingCall. Accepts boolean for
 *     accepting a call. The call is automatically rejected because a function
 *     for UI input (accept/reject) is not defined.
 *
 * @throws Throws an error using the ChatEngine.throwError function.
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
 *     handler to the call object instance.
 *
 * @throws Throws an error using the ChatEngine.throwError function.
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
 *     handler to the call object instance.
 *
 * @throws Throws an error using the ChatEngine.throwError function.
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
 *     handler to the call object instance.
 *
 * @throws Throws an error using the ChatEngine.throwError function.
 *
 * @returns {void}
 */
function onDisconnectNotDefined() {
    const functionName = 'onDisconnectNotDefined';
    const message = 'A handler for the [onDisconnect] event is not defined.';
    this.ChatEngine.throwError(this, functionName, 'webRTC', new Error(message));
}

module.exports = {
    onIncomingCallNotDefined,
    onCallResponseNotDefined,
    onPeerStreamNotDefined,
    onDisconnectNotDefined
};
(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
'use strict';(function(){var a=require('../package.json');window.ChatEngineCore.plugin[a.name]=require('../src/plugin.js')})();

},{"../package.json":2,"../src/plugin.js":5}],2:[function(require,module,exports){
module.exports={
  "author": "Adam Bavosa",
  "name": "chat-engine-webrtc",
  "version": "0.0.1",
  "main": "src/plugin.js",
  "dependencies": {
    "chat-engine": "^0.9.18"
  },
  "browserify": {
    "transform": [
      [
        "babelify",
        {
          "presets": [
            "es2015",
            "minify"
          ]
        }
      ]
    ]
  },
  "devDependencies": {
    "babel-core": "^6.26.3",
    "babel-minify": "^0.4.3",
    "babel-preset-es2015": "^6.24.1",
    "babelify": "^8.0.0"
  }
}
},{}],3:[function(require,module,exports){
'use strict';function onIncomingCallNotDefined(a){chatEngineError(this.ChatEngine,'onIncomingCallNotDefined','A handler for the [onIncomingCall] event is not defined.'),a(!1)}function onCallResponseNotDefined(){chatEngineError(this.ChatEngine,'onCallResponseNotDefined','A handler for the [onCallResponse] event is not defined.')}function onPeerStreamNotDefined(){chatEngineError(this.ChatEngine,'onPeerStreamNotDefined','A handler for the [onPeerStream] event is not defined.')}function onDisconnectNotDefined(){chatEngineError(this.ChatEngine,'onDisconnectNotDefined','A handler for the [onDisconnect] event is not defined.')}function chatEngineError(a,b,c,d){c='ChatEngine WebRTC Plugin: '+(c||'undefined error'),d=d?d:c,a.throwError(a,b,'webRTC',new Error(c),{error:d})}module.exports={onIncomingCallNotDefined:onIncomingCallNotDefined,onCallResponseNotDefined:onCallResponseNotDefined,onPeerStreamNotDefined:onPeerStreamNotDefined,onDisconnectNotDefined:onDisconnectNotDefined,chatEngineError:chatEngineError};

},{}],4:[function(require,module,exports){
'use strict';var peerIceCandidateEvent='$webRTC.peerIceCandidate',incomingCallEvent='$webRTC.incomingCall',callResponseEvent='$webRTC.callResponse';function uuid(){return'10000000-1000-4000-8000-100000000000'.replace(/[018]/g,function(a){return(a^crypto.getRandomValues(new Uint8Array(1))[0]&15>>a/4).toString(16)})}var eventNames={peerIceCandidateEvent:'$webRTC.peerIceCandidate',incomingCallEvent:'$webRTC.incomingCall',callResponseEvent:'$webRTC.callResponse'};module.exports={uuid:uuid,eventNames:eventNames};

},{}],5:[function(require,module,exports){
'use strict';var _typeof='function'==typeof Symbol&&'symbol'==typeof Symbol.iterator?function(a){return typeof a}:function(a){return a&&'function'==typeof Symbol&&a.constructor===Symbol&&a!==Symbol.prototype?'symbol':typeof a},_createClass=function(){function a(a,b){for(var c,d=0;d<b.length;d++)c=b[d],c.enumerable=c.enumerable||!1,c.configurable=!0,'value'in c&&(c.writable=!0),Object.defineProperty(a,c.key,c)}return function(b,c,d){return c&&a(b.prototype,c),d&&a(b,d),b}}(),_errorHandlers=require('./helpers/error-handlers.js'),_util=require('./helpers/util.js');function _classCallCheck(a,b){if(!(a instanceof b))throw new TypeError('Cannot call a class as a function')}var incomingCallEvent=_util.eventNames.incomingCallEvent,callResponseEvent=_util.eventNames.callResponseEvent,peerIceCandidateEvent=_util.eventNames.peerIceCandidateEvent,config=void 0,WebRtcPhone=function(){function a(){_classCallCheck(this,a)}return _createClass(a,[{key:'construct',value:function b(){var a=this;this.onIncomingCall=config.onIncomingCall||_errorHandlers.onIncomingCallNotDefined,this.onCallResponse=config.onCallResponse||_errorHandlers.onCallResponseNotDefined,this.onPeerStream=config.onPeerStream||_errorHandlers.onPeerStreamNotDefined,this.onDisconnect=config.onDisconnect||_errorHandlers.onDisconnectNotDefined,this.myStream=config.myStream,this.rtcConfig=config.rtcConfig,this.ignoreNonTurn=config.ignoreNonTurn,this.ChatEngine.me.direct.on(incomingCallEvent,function(b){incomingCall.call(a,b)}),this.ChatEngine.me.direct.on(callResponseEvent,function(b){callResponse.call(a,b)}),this.ChatEngine.me.direct.on(peerIceCandidateEvent,function(b){peerIceCandidate.call(a,b)})}},{key:'callUser',value:function k(a,b){var c=this,d=b.onPeerStream,e=b.myStream,f=b.offerOptions,g=b.rtcConfig;g=this.rtcConfig=g||this.rtcConfig,e=this.myStream=e||this.myStream,d=this.onPeerStream=d||this.onPeerStream,f=f||{offerToReceiveAudio:1,offerToReceiveVideo:1};var h=this.peerConnection=new RTCPeerConnection(g),i=this.callId=(0,_util.uuid)(),j=void 0;h.ontrack=d,e.getTracks().forEach(function(a){h.addTrack(a,e)}),h.iceCache=[],h.oniceconnectionstatechange=function(){'disconnected'===h.iceConnectionState&&c.disconnect()},h.onicecandidate=function(b){b.candidate&&onIceCandidate(b,a,h,i)},h.onnegotiationneeded=function(){h.createOffer(f).then(function(a){return j=a,h.setLocalDescription(j)}).then(function(){a.direct.emit(incomingCallEvent,{callId:i,rtcConfig:g,description:j})}).catch(function(a){(0,_errorHandlers.chatEngineError)(c.ChatEngine,'callUser','WebRTC [callUser] error.',a)})}}},{key:'disconnect',value:function a(){this.peerConnection.close(),delete this.peerConnection,this.callInSession=!1,this.onDisconnect()}}]),a}();function callResponse(a){var b=this,c=a.data,d=c.callId,e=c.acceptedCall,f=a.data.description,g=a.sender;e&&(this.peerConnection.acceptedCall=!0,this.callInSession=!0,this.peerConnection.setRemoteDescription(f).then(function(){sendIceCandidates(g,b.peerConnection,d)}).catch(function(a){(0,_errorHandlers.chatEngineError)(b.ChatEngine,'callResponse','WebRTC [callResponse] error.',a)})),this.onCallResponse(e)}function incomingCall(a){var b=this,c=a.sender,d=a.data,e=d.callId,f=d.rtcConfig,g=a.data.description;this.onIncomingCall(c,function l(a){var d=a.acceptedCall,h=a.onPeerStream,i=a.myStream;if(i=b.myStream=i||b.myStream,h=h||b.onPeerStream,d){if('object'!==('undefined'==typeof i?'undefined':_typeof(i))){(0,_errorHandlers.chatEngineError)(b.ChatEngine,'incomingCall','WebRTC [incomingCall]:No local video stream defined.',error)}var j=void 0,k=b.peerConnection=new RTCPeerConnection(f);k.ontrack=h,k.iceCache=[],i.getTracks().forEach(function(a){k.addTrack(a,i)}),k.oniceconnectionstatechange=function(){'disconnected'===k.iceConnectionState&&b.disconnect()},k.onicecandidate=function(a){a.candidate&&onIceCandidate(a,c,k,e)},k.setRemoteDescription(g).then(function(){return k.createAnswer()}).then(function(a){return j=a,k.setLocalDescription(j)}).then(function(){k.acceptedCall=!0,b.callInSession=!0,sendIceCandidates(c,k,e),c.direct.emit(callResponseEvent,{callId:e,acceptedCall:d,description:j})}).catch(function(a){var c=b.ChatEngine;(0,_errorHandlers.chatEngineError)(c,'incomingCall','WebRTC [incomingCall] error.',a)})}else c.direct.emit(callResponseEvent,{callId:e,acceptedCall:d})})}function onIceCandidate(a,b,c,d){c.iceCache.push(a.candidate),c.acceptedCall&&sendIceCandidates(b,c,d)}function sendIceCandidates(a,b,c){a.direct.emit(peerIceCandidateEvent,{callId:c,candidates:b.iceCache})}function peerIceCandidate(a){var b=this,c=this.peerConnection,d=this.ignoreNonTurn,e=a.data,f=e.callId,g=e.candidates;'object'===('undefined'==typeof g?'undefined':_typeof(g))&&c&&g.forEach(function(a){d&&-1===a.candidate.indexOf('typ relay')||c.addIceCandidate(a).catch(function(a){if('Error processing ICE candidate'!==a.message){(0,_errorHandlers.chatEngineError)(b.ChatEngine,'peerIceCandidate','ChatEngine WebRTC [peerIceCandidate] error.',a)}})})}module.exports=function(){var a=0<arguments.length&&void 0!==arguments[0]?arguments[0]:{};return config=a,{namespace:'webRTC',extends:{Me:WebRtcPhone}}};

},{"./helpers/error-handlers.js":3,"./helpers/util.js":4}]},{},[1])

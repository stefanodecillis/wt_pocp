import { EventEmitter } from 'events'
import inherits from 'inherits'
import bencode from 'bencode'
//const console.log = require('debug')('wt_pocp')

/**
 * Returns a bittorrent extension
 * @param {String} opts.account Address of five-bells-wallet
 * @param {String} opts.publicKey Ed25519 public key
 * @param {String} [opts.license] payment-license
 * @return {BitTorrent Extension}
 **/
export default function (opts) {
  if (!opts) {
    opts = {}
  }

  inherits(wt_pocp, EventEmitter)
  
  function wt_pocp (wire) {
    EventEmitter.call(this)

    console.log('wt_pocp instantiated')

    this._wire = wire
    this.auth = undefined;
    //forcing the node to not provide the content if the other is not eligible | allowing later
    this.amForceChoking = true;
    this.waitingChecks = true;
    this._wire.choke()

    console.log('Extended handshake to send:', this._wire.extendedHandshake)

    this._interceptRequests()
  }

  wt_pocp.prototype.name = 'wt_pocp'

  wt_pocp.prototype.onHandshake = function (infoHash, peerId, extensions) {
    // noop
  }

  wt_pocp.prototype.onExtendedHandshake = function (handshake) {
    if (!handshake.m || !handshake.m.wt_pocp) {
      return this.emit('warning', new Error('Peer does not support wt_pocp'))
    }

    this.emit('pocp_handshake', {
    })
  }

  wt_pocp.prototype.onMessage = function (buf) {
    let dict
    try {
      const str = buf.toString()
      const trailerIndex = str.indexOf('ee') + 2
      dict = bencode.decode(str.substring(0, trailerIndex))
    } catch (err) {
      // drop invalid messages
      return
    }
    console.log('something here : ' + dict.msg_type);
    if(dict.hash !== undefined)
    console.log('something content eventually: ' + dict.hash);
    if(dict.signedReceipt !== undefined)
    console.log('something content eventually: ' + dict.signedReceipt);

    switch (dict.msg_type) {
      // response on the buffer
      // { msg_type: 0 }
      case 0:
        this.emit('authorized', {})
        break
      case 1:
        this.emit('no-autohorized', {})
        break
      case 2:
        //console.log('req content: ' + name);
        this.emit('signature-request',{hash: dict.hash})
        break
      case 3:
        this.emit('signature-response', dict.signedReceipt);
        break
      case 4:
        this.emit('check-in', {})
        break;
      default:
        console.log('Got unknown message: ', dict)
        break
    }
  }

  wt_pocp.prototype.forceChoke = function () {
    console.log('force choke peer');
    this.amForceChoking = true;
    this.emit('dropping');
    this._wire.choke()
  }

  wt_pocp.prototype.unchoke = function () {
    this.amForceChoking = false
    this._wire.unchoke();
  }

  wt_pocp.prototype._interceptRequests = function (status) {
    const _this = this
    const _status = status;
    const _onRequest = this._wire._onRequest
    this._wire._onRequest = function (index, offset, length) {
      _this.emit('request', index, offset, length)

      // Call onRequest after the handlers triggered by this event have been called
      const _arguments = arguments

      setTimeout(function () {
        if (_this.waitingChecks) {
          console.log('waiting..');
          setTimeout(()=>_this._wire._onRequest(index, offset, length), 100);
        } else if(!_this.amForceChoking){
          console.log('responding to request')
          _onRequest.apply(_this._wire, _arguments)
        } else {
          console.log('force choking peer')
        }
      }, 0)
    }
  }

  wt_pocp.prototype._send = function (dict) {
    this._wire.extended('wt_pocp', bencode.encode(dict))
  }

  wt_pocp.prototype.allow = function () {
    console.log('Send positive response')
    this.unchoke();
    this.waitingChecks = false;
    this.auth = true;
    this._send({
      msg_type: 0
    })
    const _this = this;
    const _onRequest = _this._wire._onRequest;
    // const peerRequest = _this._wire.peerRequests[0];
    // _onRequest.apply(_this._wire, peerRequest[0].piece, peerRequest[0].offset, peerRequest[0].length);
  }

  wt_pocp.prototype.deny = function () {
    console.log('Send negative response - peer has no right on torrent')
    this.auth = false;
    this.waitingChecks = false;
    this.forceChoke();
    this._send({
      msg_type: 1
    })
  }

  wt_pocp.prototype.sendReceipt = function (name) {
    console.log('sending ' +name);
    this._send({
      msg_type: 2,
      hash: name
    })
  }

  wt_pocp.prototype.sendSignedReceipt = function (response) {
    console.log('sending..');
    this._send({
      msg_type: 3,
      signedReceipt: response
    })
  }

  wt_pocp.prototype.sendCheckin = function () {
    console.log('checking..');
    this._send({
      msg_type: 4
    })
  }

  return wt_pocp
}
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

    //forcing the node to not provide the content if the other is not eligible | allowing later
    this._wire.choke();
    this.amForceChoking = false

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

    // here I will read the contract and I will send data through the signal 'pocp_handshake'

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
        this.emit('positive', {})
        break
      case 1:
        this.emit('negative', {})
        break
      case 2:
        //console.log('req content: ' + name);
        this.emit('signature-request',{hash: dict.hash})
        break
      case 3:
        //console.log('res content: ' + name);
        this.emit('signature-response', dict.signedReceipt);
        break
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
  }

  wt_pocp.prototype._interceptRequests = function () {
    const _this = this
    const _onRequest = this._wire._onRequest
    this._wire._onRequest = function (index, offset, length) {
      _this.emit('request', length)

      // Call onRequest after the handlers triggered by this event have been called
      const _arguments = arguments
      setTimeout(function () {
        if (!_this.amForceChoking) {
          console.log('responding to request')
          _onRequest.apply(_this._wire, _arguments)
        } else {
          console.log('force choking peer, dropping request')
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
    this._send({
      msg_type: 0
    })
  }

  wt_pocp.prototype.deny = function () {
    console.log('Send negative response - peer has no right on torrent')
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
    this._send({
      msg_type: 3,
      signedReceipt: response
    })
  }

  return wt_pocp
}
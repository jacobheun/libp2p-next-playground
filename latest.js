const Libp2p = require('libp2p.latest')
const Muxer = require('libp2p-mplex.latest')
const Crypto = require('libp2p-secio.latest')
const Transport = require('libp2p-tcp.latest')
const pipe = require('pull-stream')
const ECHO = '/echo/1.0.0'

;(async () => {
  // Create a new, remote libp2p node
  const remoteLibp2p = await Libp2p.createLibp2p({
    modules: {
      transport: [Transport],
      streamMuxer: [Muxer],
      connEncryption: [Crypto]
    }
  })
  // Register a handler to echo back all data
  remoteLibp2p.handle(ECHO, (_, stream) => pipe(stream, stream))

  // Create our libp2p node
  const libp2p = await Libp2p.createLibp2p({
    modules: {
      transport: [Transport],
      streamMuxer: [Muxer],
      connEncryption: [Crypto]
    }
  })
  // Give both nodes addresses to listen on
  remoteLibp2p.peerInfo.multiaddrs.add('/ip4/0.0.0.0/tcp/8001')
  libp2p.peerInfo.multiaddrs.add('/ip4/0.0.0.0/tcp/8000')
  const dialAddr = remoteLibp2p.peerInfo.multiaddrs.toArray()[0]

  // Start 'em up!
  await Promise.all([
    remoteLibp2p.start(),
    libp2p.start()
  ])
  console.log('Libp2p latest started')

  // Dial the remote libp2p node and negotiation the echo protocol
  const stream = await libp2p.dialProtocol(remoteLibp2p.peerInfo, ECHO)

  // Send a message and get the response
  pipe(
    pipe.values([Buffer.from('oh hi')]),
    stream,
    collect(async (_, [result]) => {
      // Print out the echoed response
      console.log('Latest got data %s', result.toString())

      // Shut it down!
      await Promise.all([
        remoteLibp2p.stop(),
        libp2p.stop()
      ])
      console.log('Libp2p latest stopped')
    })
  )
})()

function collect (cb) {
  return reduce(function (arr, item) {
    arr.push(item)
    return arr
  }, [], cb)
}

function reduce (reducer, acc, cb ) {
  if(!cb) cb = acc, acc = null
  var sink = drain(function (data) {
    acc = reducer(acc, data)
  }, function (err) {
    cb(err, acc)
  })
  if (arguments.length === 2)
    return function (source) {
      source(null, function (end, data) {
        //if ended immediately, and no initial...
        if(end) return cb(end === true ? null : end)
        acc = data; sink(source)
      })
    }
  else
    return sink
}

function drain (op, done) {
  var read, abort

  function sink (_read) {
    read = _read
    if(abort) return sink.abort()
    //this function is much simpler to write if you
    //just use recursion, but by using a while loop
    //we do not blow the stack if the stream happens to be sync.
    ;(function next() {
        var loop = true, cbed = false
        while(loop) {
          cbed = false
          read(null, function (end, data) {
            cbed = true
            if(end = end || abort) {
              loop = false
              if(done) done(end === true ? null : end)
              else if(end && end !== true)
                throw end
            }
            else if(op && false === op(data) || abort) {
              loop = false
              read(abort || true, done || function () {})
            }
            else if(!loop){
              next()
            }
          })
          if(!cbed) {
            loop = false
            return
          }
        }
      })()
  }

  sink.abort = function (err, cb) {
    if('function' == typeof err)
      cb = err, err = true
    abort = err || true
    if(read) return read(abort, cb || function () {})
  }

  return sink
}


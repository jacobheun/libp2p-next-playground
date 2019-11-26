const Libp2pLatest = require('libp2p.latest')
const MuxerLatest = require('libp2p-mplex.latest')
const CryptoLatest = require('libp2p-secio.latest')
const TransportLatest = require('libp2p-tcp.latest')
const pull = require('pull-stream')
const Libp2p = require('libp2p')
const Muxer = require('libp2p-mplex')
const Crypto = require('libp2p-secio')
const Transport = require('libp2p-tcp')
const pipe = require('it-pipe')
const multiaddr = require('multiaddr')
const ECHO = '/echo/1.0.0'

;(async () => {
  const latestLibp2p = await Libp2pLatest.createLibp2p({
    modules: {
      transport: [TransportLatest],
      streamMuxer: [MuxerLatest],
      connEncryption: [CryptoLatest]
    }
  })
  latestLibp2p.handle(ECHO, (_, stream) => pull(stream, stream))

  const nextLibp2p = await Libp2p.create({
    modules: {
      transport: [Transport],
      streamMuxer: [Muxer],
      connEncryption: [Crypto]
    }
  })
  nextLibp2p.handle(ECHO, ({ stream }) => pipe(stream, stream))

  latestLibp2p.peerInfo.multiaddrs.add('/ip4/0.0.0.0/tcp/9001')
  nextLibp2p.peerInfo.multiaddrs.add('/ip4/0.0.0.0/tcp/9000')

  // Start 'em up!
  await Promise.all([
    latestLibp2p.start(),
    nextLibp2p.start()
  ])
  console.log('Libp2p started')

  // Dial the remote libp2p node and negotiation the echo protocol
  const dialAddr = multiaddr(`/ip4/0.0.0.0/tcp/9000/p2p/${nextLibp2p.peerInfo.id.toB58String()}`)
  const conn = await latestLibp2p.dialProtocol(dialAddr, ECHO)

  // Send a message and get the response
  pull(
    pull.values([Buffer.from('oh hi')]),
    conn,
    pull.collect(async (err, result) => {
    // Print out the echoed response
    console.log('Latest got data: "%s"', result.toString())

    // Shut it down!
    await Promise.all([
      latestLibp2p.stop(),
      nextLibp2p.stop()
    ])
      console.log('Libp2p next stopped')
    })
  )


})()

async function collect (source) {
  const data = []
  for await (const chunk of source) {
    data.push(chunk)
  }
  return data
}

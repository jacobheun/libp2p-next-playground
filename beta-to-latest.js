const Libp2pLatest = require('libp2p.latest')
const MuxerLatest = require('libp2p-mplex.latest')
const CryptoLatest = require('libp2p-secio.latest')
const TransportLatest = require('libp2p-tcp.latest')
const Libp2p = require('libp2p')
const Muxer = require('libp2p-mplex')
const Crypto = require('libp2p-secio')
const Transport = require('libp2p-tcp')
const multiaddr = require('multiaddr')
const pipe = require('it-pipe')
const pull = require('pull-stream')
const { collect } = require('streaming-iterables')
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
  const dialAddr = multiaddr(`/ip4/0.0.0.0/tcp/9001/p2p/${latestLibp2p.peerInfo.id.toB58String()}`)
  const { stream } = await nextLibp2p.dialProtocol(dialAddr, ECHO)

  // Send a message and get the response
  const [result] = await pipe(
    [Buffer.from('oh hi')],
    stream,
    collect
  )

  // Print out the echoed response
  console.log('Next got data: "%s"', result.toString())

  // Shut it down!
  await Promise.all([
    latestLibp2p.stop(),
    nextLibp2p.stop()
  ])
  console.log('Libp2p next stopped')
})()

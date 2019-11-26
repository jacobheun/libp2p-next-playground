const Libp2p = require('libp2p')
const Muxer = require('libp2p-mplex')
const Crypto = require('libp2p-secio')
const Transport = require('libp2p-tcp')
const pipe = require('it-pipe')
const ECHO = '/echo/1.0.0'

;(async () => {
  // Create a new, remote libp2p node
  const remoteLibp2p = await Libp2p.create({
    modules: {
      transport: [Transport],
      streamMuxer: [Muxer],
      connEncryption: [Crypto]
    }
  })
  // Register a handler to echo back all data
  remoteLibp2p.handle(ECHO, ({ stream }) => pipe(stream, stream))

  // Create our libp2p node
  const libp2p = await Libp2p.create({
    modules: {
      transport: [Transport],
      streamMuxer: [Muxer],
      connEncryption: [Crypto]
    }
  })
  // Give both nodes addresses to listen on
  remoteLibp2p.peerInfo.multiaddrs.add('/ip4/0.0.0.0/tcp/9001')
  libp2p.peerInfo.multiaddrs.add('/ip4/0.0.0.0/tcp/9000')
  const dialAddr = remoteLibp2p.peerInfo.multiaddrs.toArray()[0]

  // Start 'em up!
  await Promise.all([
    remoteLibp2p.start(),
    libp2p.start()
  ])
  console.log('Libp2p next started')

  // Dial the remote libp2p node and negotiation the echo protocol
  const { stream } = await libp2p.dialProtocol(dialAddr, ECHO)

  // Send a message and get the response
  const [result] = await pipe(
    [Buffer.from('oh hi')],
    stream,
    collect
  )

  // Print out the echoed response
  console.log('Next got data %s', result.toString())

  // Shut it down!
  await Promise.all([
    remoteLibp2p.stop(),
    libp2p.stop()
  ])
  console.log('Libp2p next stopped')
})()

async function collect (source) {
  const data = []
  for await (const chunk of source) {
    data.push(chunk)
  }
  return data
}

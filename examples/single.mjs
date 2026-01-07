import { header, summary, command, flag, arg } from '../index.js'
const cmd = command(
  'run',
  header('A simple example app'),
  summary('Example app that uses a roomLink to join a room and do work.'),
  arg('<roomLink>', 'the room link key'),
  flag('--uuid|-i [uuid]', 'The specific schema uuid to use'),
  flag('--user|-u [user]', 'The user name associated with the entry'),
  flag('--storage|-s [storage]', 'Path to storage directory'),
  flag('--blind|-b [blind]', 'Blind peer keys (can be specified multiple times)').multiple()
)
const program = cmd.parse() // default args: process.argv.slice(2)
if (program === null) throw new Error('missing arg')
console.log('user', program.flags.user)
console.log('storagePath', program.flags.storage || '/tmp')
console.log('blindPeers', program.flags.blind || [])
console.log('roomLink', program.roomLink)
cmd.add(flag('--another', 'lazy added'))
cmd.add({
  '--more': 'via description object',
  '--adjusters': ['are defined with array [desc, opts]', { multiple: true }]
})
cmd.parse(['-h'])

import { command } from '../index.js'
const cmd = command({
  name: 'pear',
  summary: 'summary text',
  description: 'description text',
  header: 'header text',
  footer: 'footer text',
  'flag --define flag': 'describe flag',
  'flag --define multiflag': ['describe flag', { multiple: true }],
  'flag --define hidden-flag': ['describe flag', { hide: true }],
  'flag --define choices': ['describe flag', { choices: ['a', 'b', 'c'] }],
  'arg <required>': 'required arg',
  'hidden [arg]': ['hidden optional arg', { hide: true }],
  rest: '[...args]',
  command: {
    name: 'run',
    summary: 'a subcommand'
  }
})
cmd.parse(['-h'])

const { header, footer, command, flag, arg, summary, description, rest } = require('./')
const run = command(
  'run',
  summary('Run an app from a link'),
  description(
    'Run an app from a file link (or path) or from a pear link.\nOptionally supply store for custom store path'
  ),
  flag('--store|-s [path]', 'store path'),
  arg('<link|channel>', 'link to run'),
  rest('[...app-args]'),
  () => console.log('ACTION ->', 'run', run.args.link, 'flags:', run.flags)
)
const cmd = command(
  'pear',
  summary('pear cli'),
  {
    // definition objects can also be used with form {[modifier <arg1>]: '<arg2>' | ['<arg2>', adjusters {...}]}:
    'flag --log': 'log',
    header: 'Welcome to the IoP'
  },
  header('Welcome to the IoP'),
  footer('holepunch.to | pears.com | keet.io'),
  run
)
cmd.parse(['--help']) // print pear help
cmd.parse(['run', '-h']) // print run help
cmd.parse(['run', '-s', '/path/to/store', 'pear://link']) // exec run command

run.add(flag('--pre-io', 'Show stdout & stderr of pre scripts')) // update command

cmd.parse(['run', '-s', '/path/to/store', '--pre-io', 'pear://link']) // exec run command

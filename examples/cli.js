const Paparam = require('../')

const papa = Paparam.parseSoon()

papa.command('run')
  .flag('dev')
  .arg('link')
  .eatRest()
  .run(function ({ args, flags, rest }) {
    console.log('i ran', args, flags, rest)
  })

papa.command('stage')
  .flag('dryRun', { alias: 'dry-run', bool: true })
  .run(function ({ flags }) {
    console.log('i stage', flags)
  })

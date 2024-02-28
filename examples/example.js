const Paparam = require('../')

const p = new Paparam()

p.command('run')
  .flag('dev', { bool: true })
  .arg('link')
  .eatRest()
  .run(function ({ args, flags, rest }) {
    console.log('run flags:', flags)
    console.log('i should run:', args.link, 'with', rest)
  })

const dev = p.command('dev')

dev.command('configure')
  .flag('debug')
  .run(function ({ flags }) {
    console.log('dev configure', flags)
  })

dev.command('build')
  .flag('debug')
  .run(function ({ flags }) {
    console.log('dev build', flags)
  })

p.command('stage')
  .arg('link')
  .run(function () {
    console.log('i should stage')
  })

p.command('help')
  .run(function () {
    console.log('this is help')
  })

function test (argv) {
  console.log(argv)
  p.parse(argv)
}

test(['run', '--dev', 'pear://link', '--keet'])
test(['stage', 'pear://link'])
test(['help'])
test(['dev', 'build'])

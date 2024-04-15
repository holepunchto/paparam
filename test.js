'use strict'
const test = require('brittle')
const { header, command, flag, arg, argv, rest, footer, summary, description } = require('./')

test('command creation', async (t) => {
  const cmd = command('test')
  t.plan(2)
  t.is(cmd.name, 'test')
  t.execution(() => cmd.parse([]))
})

test('command with description', async (t) => {
  const desc = 'Test command description'
  const cmd = command('test', description(desc))
  t.plan(2)
  t.is(cmd.description, desc)
  t.execution(() => cmd.parse([]))
})

test('command with boolean flag', async (t) => {
  const cmd = command('test', flag('--flag', 'Test flag'))
  t.plan(1)
  cmd.parse(['--flag'])
  t.ok(cmd.flags.flag)
})

test('command with aliased flag', async (t) => {
  const cmd = command('test', flag('--flag|-f', 'Test flag'))
  t.plan(1)
  cmd.parse(['-f'])
  t.ok(cmd.flags.flag)
})

test('command with string flag', async (t) => {
  const cmd = command('test', flag('--flag [val] ', 'Test flag'))
  t.plan(1)
  cmd.parse(['--flag', 'val'])
  t.is(cmd.flags.flag, 'val')
})

test('command with arguments', async (t) => {
  const cmd = command('test', arg('<arg>', 'Test argument'))
  t.plan(1)
  cmd.parse(['val'])
  t.is(cmd.args.arg, 'val')
})

test('command with rest arguments', async (t) => {
  const cmd = command('test', arg('<arg>', 'Test argument'), rest('...rest', 'rest arguments'))
  cmd.parse(['val', 'some', 'more'])
  t.plan(3)
  t.is(cmd.args.arg, 'val')
  t.alike(cmd.positionals, ['val'])
  t.alike(cmd.rest, ['some', 'more'])
})

test('command with header', async (t) => {
  const hd = 'Test command header'
  const cmd = command('test', header(hd))
  t.plan(1)
  t.is(cmd.header, hd)
})

test('command with footer', async (t) => {
  const ft = 'Test command footer'
  const cmd = command('test', footer(ft))
  t.plan(1)
  t.is(cmd.footer, ft)
})

test('command parsing', async (t) => {
  const cmd = command('test', flag('--flag|-f', 'Test flag'), arg('<arg>', 'Test argument'))
  const input = ['argumentValue', '-f']
  cmd.parse(input)
  t.plan(2)
  t.ok(cmd.flags.flag, 'Flag should be recognized and set')
  t.is(cmd.args.arg, 'argumentValue')
})

test('default error on unknown flag', (t) => {
  const cmd = command(
    'stage',
    flag('--dry-run', 'Performs a dry run'),
    arg('<link>', 'App link key')
  )
  const input = ['--fake-flag', 'http://example.com']
  t.plan(1)
  t.exception(() => cmd.parse(input), /UNKNOWN_FLAG: fake-flag/)
})

test('default error on unknown argument', (t) => {
  const cmd = command(
    'upload',
    arg('<file>', 'File')
  )
  const input = ['file.txt', 'extra.txt']
  t.plan(1)
  t.exception(() => cmd.parse(input), /UNKNOWN_ARG: extra.txt/)
})

test('command opts - flags sloppy mode, no bail on unknown string flag', (t) => {
  const cmd = command(
    'stage',
    flag('--dry-run', 'Performs a dry run'),
    arg('<link>', 'App link key'),
    { sloppy: { flags: true } }
  )
  const input = ['--unknown-flag', 'val']
  t.plan(1)
  t.execution(() => { cmd.parse(input) })
})

test('command opts - flags sloppy mode, WILL bail on invalid unknown boolean flag', (t) => {
  const cmd = command(
    'stage',
    flag('--dry-run', 'Performs a dry run'),
    arg('<link>', 'App link key'),
    { sloppy: { flags: true } }
  )
  const input = ['--unknown-flag']
  t.plan(1)
  t.exception(() => { cmd.parse(input) })
})

test('command opts - args sloppy mode, no bail on unknown', (t) => {
  const cmd = command(
    'stage',
    flag('--dry-run', 'Performs a dry run'),
    arg('<link>', 'App link key'),
    { sloppy: { args: true } }
  )
  const input = ['linkarg', 'extraarg']
  t.plan(2)
  t.execution(() => { cmd.parse(input) })
  t.is(cmd.positionals[1], 'extraarg')
})

test('command opts - signature (custom function)', (t) => {
  const cmd = command(
    'test',
    { signature: (s) => `CUSTOM: ${s} WRAP` }
  )

  const expected = 'CUSTOM: test WRAP'
  const output = cmd.usage()
  t.plan(1)
  t.is(output, expected)
})

test('command opts - bail (custom function, non-throwing)', (t) => {
  const cmd = command(
    'test',
    flag('--required', 'A required flag'),
    { bail }
  )
  function bail (bail) {
    return `error happened: ${bail.reason}\n${cmd.usage()}`
  }

  const input = ['--unknown-flag']
  const expected = `error happened: UNKNOWN_FLAG
test [flags]

Flags:
  --required   A required flag
`
  t.plan(2)
  t.is(cmd.parse(input), null)
  t.is(cmd.bailed.output, expected)
})

test('command opts - bail (custom function, throwing)', (t) => {
  const cmd = command(
    'test',
    flag('--required', 'A required flag'),
    { bail () { throw new Error('bAiL') } }
  )
  const input = ['--unknown-flag']
  t.plan(2)
  t.exception(() => cmd.parse(input))
  t.is(cmd.bailed.error.message, 'bAiL')
})

test('command opts - delim (custom overview delimiter)', (t) => {
  const cmd = command(
    'test',
    command('sub', summary('A subcommand')),
    { delim: ' -> ' }
  )
  const expected = `  test sub  ->  A subcommand
`
  t.plan(1)
  t.is(cmd.overview(), expected)
})

test('command composition w/ runner ', (t) => {
  t.plan(5)
  const cmd = command(
    'stage',
    summary('stage pear app'),
    description('more info about staging pear app'),
    header('Header text'),
    flag('--dry-run|-d', 'View the changes without applying them'),
    flag('--bare', 'Do not apply any warmup'),
    arg('<link>', 'App link key'),
    rest('[app-args...]', 'Any args passed after the link are passed to the app'),
    footer('Footer text'),
    function (cmd) {
      t.ok(cmd, 'Runner function should be executed with args')
      t.ok(cmd.flags.dryRun, 'Dry run flag should be true')
      t.ok(cmd.flags.bare, 'Bare flag should be true')
      t.is(cmd.args.link, 'pear://example', 'Link argument should be correctly parsed')
      t.is(cmd.rest.length, 2, 'Rest arguments correctly parsed')
    }
  )

  const input = ['--dry-run', '--bare', 'pear://example', 'app', 'args']
  cmd.parse(input)
})

test('nested command composition w/ subrunner', (t) => {
  t.plan(5)
  const head = header('Header text')
  const foot = footer('Footer text')
  const cmd = command(
    'stage',
    summary('stage pear app'),
    description('more info about staging pear app'),
    head,
    flag('--dry-run|-d', 'View the changes without applying them'),
    flag('--bare', 'Do not apply any warmup'),
    arg('<link>', 'App link key'),
    rest('[app-args...]', 'Any args passed after the link are passed to the app'),
    foot,
    function (cmd) {
      t.ok(cmd, 'Runner function should be executed with args')
      t.ok(cmd.flags.dryRun, 'Dry run flag should be true')
      t.ok(cmd.flags.bare, 'Bare flag should be true')
      t.is(cmd.args.link, 'pear://example', 'Link argument should be correctly parsed')
      t.is(cmd.rest.length, 2, 'Rest arguments correctly parsed')
    }
  )

  const app = command(
    'pear',
    head,
    cmd,
    foot
  )

  const input = ['stage', '--dry-run', '--bare', 'pear://example', 'app', 'args']
  app.parse(input)
})

test('argv() returns program argv', (t) => {
  const program = typeof Bare === 'undefined' ? process : Bare
  const original = program.argv
  t.teardown(() => { program.argv = original })
  const injected = ['program', 'entry', '--dry-run', '--bare', 'pear://example', 'app', 'args']
  program.argv = injected
  t.plan(1)
  t.alike(argv(), injected.slice(2))
})

test('command parse argv defaults to program argv', (t) => {
  t.plan(5)
  const cmd = command(
    'stage',
    summary('stage pear app'),
    description('more info about staging pear app'),
    header('Header text'),
    flag('--dry-run|-d', 'View the changes without applying them'),
    flag('--bare', 'Do not apply any warmup'),
    arg('<link>', 'App link key'),
    rest('[app-args...]', 'Any args passed after the link are passed to the app'),
    footer('Footer text'),
    function (cmd) {
      t.ok(cmd, 'Runner function should be executed with args')
      t.ok(cmd.flags.dryRun, 'Dry run flag should be true')
      t.ok(cmd.flags.bare, 'Bare flag should be true')
      t.is(cmd.args.link, 'pear://example', 'Link argument should be correctly parsed')
      t.is(cmd.rest.length, 2, 'Rest arguments correctly parsed')
    }
  )
  const program = typeof Bare === 'undefined' ? process : Bare
  const original = program.argv
  t.teardown(() => { program.argv = original })
  const injected = ['program', 'entry', '--dry-run', '--bare', 'pear://example', 'app', 'args']
  program.argv = injected
  cmd.parse()
})

test('command option - commands (custom function)', (t) => {
  const cmd = command(
    'sub',
    summary('A subcommand'),
    description('Description of subcommand')
  )

  const app = command(
    'main',
    cmd,
    { commands: (s) => `Available Commands:\n${s}` }
  )

  const expected = `main [command]

Available Commands:
  sub   Description of subcommand
`

  t.is(app.usage(), expected)
})

test('Command overview', (t) => {
  const head = header('Header text')
  const foot = footer('Footer text')
  const cmd = command(
    'stage',
    summary('stage pear app'),
    description('more info about staging pear app'),
    head,
    flag('--dry-run|-d', 'View the changes without applying them'),
    flag('--bare', 'Do not apply any warmup'),
    arg('<link>', 'App link key'),
    rest('[app-args...]', 'Any args passed after the link are passed to the app'),
    foot
  )

  const app = command(
    'pear',
    head,
    cmd,
    foot
  )
  const expected = `
Header text

  pear stage - stage pear app

Footer text
`
  t.plan(1)
  t.is(app.overview(), expected)
})

test('Command overview full', (t) => {
  const head = header('Header text')
  const foot = footer('Footer text')
  const cmd = command(
    'stage',
    summary('stage pear app'),
    description('more info about staging pear app'),
    head,
    flag('--dry-run|-d', 'View the changes without applying them'),
    flag('--bare', 'Do not apply any warmup'),
    arg('<link>', 'App link key'),
    rest('[app-args...]', 'Any args passed after the link are passed to the app'),
    foot
  )

  const app = command(
    'pear',
    head,
    cmd,
    foot
  )
  const expected = `
Header text


stage [flags] <link> [app-args...]

stage pear app

more info about staging pear app

Arguments:
  <link>          App link key
  [app-args...]   Any args passed after the link are passed to the app

Flags:
  --dry-run|-d    View the changes without applying them
  --bare          Do not apply any warmup

Footer text
`
  t.plan(1)
  t.is(app.overview({ full: true }), expected)
})

test('Command usage', (t) => {
  const head = header('Header text')
  const foot = footer('Footer text')
  const cmd = command(
    'stage',
    summary('stage pear app'),
    description('more info about staging pear app'),
    head,
    flag('--dry-run|-d', 'View the changes without applying them'),
    flag('--bare', 'Do not apply any warmup'),
    arg('<link>', 'App link key'),
    rest('[app-args...]', 'Any args passed after the link are passed to the app'),
    foot
  )

  const expected = `stage [flags] <link> [app-args...]

stage pear app

more info about staging pear app

Arguments:
  <link>          App link key
  [app-args...]   Any args passed after the link are passed to the app

Flags:
  --dry-run|-d    View the changes without applying them
  --bare          Do not apply any warmup
`
  t.plan(1)
  t.is(cmd.usage(), expected)
})

test('Command help', (t) => {
  const head = header('Header text')
  const foot = footer('Footer text')
  const cmd = command(
    'stage',
    summary('stage pear app'),
    description('more info about staging pear app'),
    head,
    flag('--dry-run|-d', 'View the changes without applying them'),
    flag('--bare', 'Do not apply any warmup'),
    arg('<link>', 'App link key'),
    rest('[app-args...]', 'Any args passed after the link are passed to the app'),
    foot
  )

  const expected = `Header text

${cmd.usage()}
Footer text
`
  t.plan(1)
  t.is(cmd.help(), expected)
})

test('Command usage subcommand', (t) => {
  const head = header('Header text')
  const foot = footer('Footer text')
  const cmd = command(
    'stage',
    summary('stage pear app'),
    description('more info about staging pear app'),
    head,
    flag('--dry-run|-d', 'View the changes without applying them'),
    flag('--bare', 'Do not apply any warmup'),
    arg('<link>', 'App link key'),
    rest('[app-args...]', 'Any args passed after the link are passed to the app'),
    foot
  )

  const app = command(
    'pear',
    head,
    cmd,
    foot
  )

  const expected = `stage [flags] <link> [app-args...]

stage pear app

more info about staging pear app

Arguments:
  <link>          App link key
  [app-args...]   Any args passed after the link are passed to the app

Flags:
  --dry-run|-d    View the changes without applying them
  --bare          Do not apply any warmup
`
  t.plan(1)
  t.is(app.usage('stage'), expected)
})

test('Command help subcommand', (t) => {
  const head = header('Header text')
  const foot = footer('Footer text')
  const cmd = command(
    'stage',
    summary('stage pear app'),
    description('more info about staging pear app'),
    head,
    flag('--dry-run|-d', 'View the changes without applying them'),
    flag('--bare', 'Do not apply any warmup'),
    arg('<link>', 'App link key'),
    rest('[app-args...]', 'Any args passed after the link are passed to the app'),
    foot
  )

  const app = command(
    'pear',
    head,
    cmd,
    foot
  )

  const expected = `stage [flags] <link> [app-args...]

stage pear app

more info about staging pear app

Arguments:
  <link>          App link key
  [app-args...]   Any args passed after the link are passed to the app

Flags:
  --dry-run|-d    View the changes without applying them
  --bare          Do not apply any warmup
`
  t.plan(1)
  t.is(app.usage('stage'), expected)
})

test('Command help unknown subcommand', (t) => {
  const head = header('Header text')
  const foot = footer('Footer text')
  const cmd = command(
    'stage',
    summary('stage pear app'),
    description('more info about staging pear app'),
    head,
    flag('--dry-run|-d', 'View the changes without applying them'),
    flag('--bare', 'Do not apply any warmup'),
    arg('<link>', 'App link key'),
    rest('[app-args...]', 'Any args passed after the link are passed to the app'),
    foot
  )

  const app = command(
    'pear',
    head,
    cmd,
    foot
  )

  t.plan(1)
  t.exception(() => app.usage('unknown'), /UNKNOWN_ARG: unknown/)
})

test('subcommand subcommand', (t) => {
  t.plan(6)
  const head = header('Header text')
  const foot = footer('Footer text')
  const sub = command(
    'sub',
    summary('subcmd'),
    flag('--some [args]', 'some flag'),
    function () {
      t.ok(cmd, 'Runner function should be executed with args')
      t.ok(cmd.flags.dryRun, 'Dry run flag should be true')
      t.ok(cmd.flags.bare, 'Bare flag should be true')
      t.is(sub.flags.some, 'args')
    }
  )
  const cmd = command(
    'stage',
    sub,
    summary('stage pear app'),
    description('more info about staging pear app'),
    head,
    flag('--dry-run|-d', 'View the changes without applying them'),
    flag('--bare', 'Do not apply any warmup'),
    foot
  )

  const app = command(
    'pear',
    head,
    command('another', arg('<reqd> [optl]')),
    cmd,
    foot
  )

  const input = ['stage', '--dry-run', '--bare', 'sub', '--some', 'args']
  app.parse(input)
  const expectedUsage = `stage [flags] [command]

stage pear app

more info about staging pear app

Flags:
  --dry-run|-d   View the changes without applying them
  --bare         Do not apply any warmup

Commands:
  sub
`
  const expectedOverview = `
Header text


another <reqd> [optl]

Arguments:
  <reqd> [optl]

stage [flags] [command]

stage pear app

more info about staging pear app

Flags:
  --dry-run|-d   View the changes without applying them
  --bare         Do not apply any warmup

Commands:
  sub

Footer text
`
  t.is(app.usage('stage'), expectedUsage)
  t.is(app.overview({ full: true }), expectedOverview)
})

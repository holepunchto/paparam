'use strict'
const test = require('brittle')
const { header, command, hiddenCommand, flag, hiddenFlag, arg, argv, rest, footer, summary, description, sloppy, bail } = require('./')

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
  t.plan(2)
  cmd.parse(['val'])
  t.is(cmd.args.arg, 'val')
  t.is(cmd.indices.args.arg, 0)
})

test('command with rest arguments', async (t) => {
  const cmd = command('test', arg('<arg>', 'Test argument'), rest('...rest', 'rest arguments'))
  cmd.parse(['val', 'some', 'more'])
  t.plan(6)
  t.is(cmd.args.arg, 'val')
  t.alike(cmd.positionals, ['val'])
  t.alike(cmd.rest, ['some', 'more'])
  t.is(cmd.indices.args.arg, 0)
  t.alike(cmd.indices.positionals, [0])
  t.is(cmd.indices.rest, 1)
})

test('command with flags, rest arguments but no args', async (t) => {
  const cmd = command('test', flag('-l', 'test flag'), rest('...rest', 'rest arguments'))
  cmd.parse(['-l', 'val', 'some', 'more'])
  t.plan(3)
  t.ok(cmd.flags.l)
  t.alike(cmd.rest, ['val', 'some', 'more'])
  t.is(cmd.indices.rest, 1)
})

test('command with flags & rest arguments swallows flags after first rest arg', async (t) => {
  const cmd = command(
    'test',
    flag('--flag', 'Test argument'),
    flag('--other', 'Other Test argument'),
    rest('...rest', 'rest arguments')
  )
  cmd.parse(['--flag', 'val', 'some', 'more', '--other'])
  t.plan(6)
  t.ok(cmd.flags.flag)
  t.ok(!cmd.flags.other)
  t.alike(cmd.rest, ['val', 'some', 'more', '--other'])
  t.is(cmd.indices.flags.flag, 0)
  t.is(cmd.indices.flags.other, undefined)
  t.is(cmd.indices.rest, 1)
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
    sloppy({ flags: true })
  )
  const input = ['--unknown-flag', 'val']
  t.plan(1)
  t.execution(() => { cmd.parse(input) })
})

test('command opts - flags sloppy mode, will parse valueless unknown flag into value undefined', (t) => {
  t.plan(2)
  const cmd = command(
    'stage',
    flag('--dry-run', 'Performs a dry run'),
    arg('<link>', 'App link key'),
    sloppy({ flags: true }),
    function (cmd) {
      t.ok(Object.hasOwn(cmd.flags, 'unknown-flag'))
      t.is(cmd.flags['unknown-flag'], undefined)
    }
  )
  const input = ['--unknown-flag']

  cmd.parse(input)
})

test('command opts - args sloppy mode, no bail on unknown', (t) => {
  const cmd = command(
    'stage',
    flag('--dry-run', 'Performs a dry run'),
    arg('<link>', 'App link key'),
    sloppy({ args: true })
  )
  const input = ['linkarg', 'extraarg']
  t.plan(2)
  t.execution(() => { cmd.parse(input) })
  t.is(cmd.positionals[1], 'extraarg')
})

test('command opts - bail (custom function, non-throwing)', (t) => {
  const cmd = command(
    'test',
    flag('--required', 'A required flag'),
    bail((bail) => `error happened: ${bail.reason}\n${cmd.usage()}`)
  )

  const input = ['--unknown-flag']
  const expected = `error happened: UNKNOWN_FLAG
test [flags]

Flags:
  --required   A required flag
  --help|-h    Show help
`
  t.plan(2)
  t.is(cmd.parse(input), null)
  t.is(cmd.bailed.output, expected)
})

test('command opts - bail (custom function, throwing)', (t) => {
  const cmd = command(
    'test',
    flag('--required', 'A required flag'),
    bail(() => { throw new Error('bAiL') })
  )
  const input = ['--unknown-flag']
  t.plan(2)
  t.exception(() => cmd.parse(input))
  t.is(cmd.bailed.error.message, 'bAiL')
})

test('command composition w/ runner ', (t) => {
  t.plan(9)
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
      t.is(cmd.indices.flags.dryRun, 0)
      t.is(cmd.indices.flags.bare, 1)
      t.is(cmd.indices.args.link, 2)
      t.is(cmd.indices.rest, 3)
    }
  )

  const input = ['--dry-run', '--bare', 'pear://example', 'app', 'args']
  cmd.parse(input)
})

test('boolean flags contain default false value', (t) => {
  t.plan(4)
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
      t.ok(cmd.flags.dryRun, 'Dry run flag should be true')
      t.not(cmd.flags.bare, 'Bare flag should be false')
      t.is(cmd.indices.flags.dryRun, 0)
      t.is(cmd.indices.flags.bare, undefined)
    }
  )

  const input = ['--dry-run', 'pear://example', 'app', 'args']
  cmd.parse(input)
})

test('--no- prefixed boolean flags contain default true value', (t) => {
  t.plan(4)
  const cmd = command(
    'stage',
    summary('stage pear app'),
    description('more info about staging pear app'),
    header('Header text'),
    flag('--dry-run|-d', 'View the changes without applying them'),
    flag('--no-bare', 'Do not not apply any warmup'),
    arg('<link>', 'App link key'),
    rest('[app-args...]', 'Any args passed after the link are passed to the app'),
    footer('Footer text'),
    function (cmd) {
      t.ok(cmd.flags.dryRun, 'Dry run flag should be true')
      t.ok(cmd.flags.bare, 'Bare flag should be true')
      t.is(cmd.indices.flags.dryRun, 0)
      t.is(cmd.indices.flags.bare, undefined)
    }
  )

  const input = ['--dry-run', 'pear://example', 'app', 'args']
  cmd.parse(input)
})

test('--no- prefixed boolean flag definition', (t) => {
  t.plan(1)
  const cmd = command(
    'stage',
    summary('stage pear app'),
    description('more info about staging pear app'),
    header('Header text'),
    flag('--dry-run|-d', 'View the changes without applying them'),
    flag('--no-bare', 'Do not not apply any warmup'),
    arg('<link>', 'App link key'),
    rest('[app-args...]', 'Any args passed after the link are passed to the app'),
    footer('Footer text'),
    function (cmd) {
      t.is(cmd.flags.bare, false, 'bare flag should be false')
    }
  )

  const input = ['--no-bare', 'pear://example', 'app', 'args']
  cmd.parse(input)
})

test('--no- prefixed boolean flag, not --no- prefixed definition', (t) => {
  t.plan(1)
  const cmd = command(
    'stage',
    summary('stage pear app'),
    description('more info about staging pear app'),
    header('Header text'),
    flag('--dry-run|-d', 'View the changes without applying them'),
    flag('--bare', 'apply warmup'),
    arg('<link>', 'App link key'),
    rest('[app-args...]', 'Any args passed after the link are passed to the app'),
    footer('Footer text'),
    function (cmd) {
      t.is(cmd.flags.bare, false, 'bare flag should be false')
    }
  )

  const input = ['--no-bare', 'pear://example', 'app', 'args']
  cmd.parse(input)
})

test('string flag [optional] and provided', (t) => {
  t.plan(1)
  const cmd = command(
    'stage',
    flag('--some [flag]', 'some flag'),
    function (cmd) {
      t.is(cmd.flags.some, 'value')
    }
  )

  const input = ['--some', 'value']
  cmd.parse(input)
})

test('string flag <required> and provided', (t) => {
  t.plan(1)
  const cmd = command(
    'stage',
    flag('--some <flag>', 'some flag'),
    function (cmd) {
      t.is(cmd.flags.some, 'value')
    }
  )
  cmd.parse(['--some', 'value'])
})

test('string flag <required> but omitted', (t) => {
  t.plan(1)
  const cmd = command(
    'stage',
    flag('--some <flag>', 'some flag'),
    function (cmd) { /* empty */ }
  )

  t.exception(() => cmd.parse(['--some']), 'INVALID_FLAG')
})

test('string flag [optional] and omitted', (t) => {
  t.plan(1)
  const cmd = command(
    'stage',
    flag('--some [flag]', 'some flag'),
    function (cmd) {
      t.is(cmd.flags.some, undefined)
    }
  )

  const input = ['--some']
  cmd.parse(input)
})

test('string flag w/ alias [optional] and provided', (t) => {
  t.plan(1)
  const cmd = command(
    'stage',
    flag('--some, -s [flag]', 'some flag'),
    function (cmd) {
      t.is(cmd.flags.some, 'value')
    }
  )

  const input = ['--some', 'value']
  cmd.parse(input)
})

test('string flag w/ alias <required> and provided', (t) => {
  t.plan(1)
  const cmd = command(
    'stage',
    flag('--some, -s <flag>', 'some flag'),
    function (cmd) {
      t.is(cmd.flags.some, 'value')
    }
  )
  cmd.parse(['--some', 'value'])
})

test('string flag w/ alias <required> but omitted', (t) => {
  t.plan(1)
  const cmd = command(
    'stage',
    flag('--some, -s <flag>', 'some flag'),
    function (cmd) { /* empty */ }
  )

  t.exception(() => cmd.parse(['--some']), 'INVALID_FLAG')
})

test('string flag w/ alias [optional] and omitted', (t) => {
  t.plan(1)
  const cmd = command(
    'stage',
    flag('--some, -s [flag]', 'some flag'),
    function (cmd) {
      t.is(cmd.flags.some, undefined)
    }
  )

  const input = ['--some']
  cmd.parse(input)
})

test('nested command composition w/ subrunner', (t) => {
  t.plan(9)
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
      t.is(cmd.indices.flags.dryRun, 1)
      t.is(cmd.indices.flags.bare, 2)
      t.is(cmd.indices.args.link, 3)
      t.is(cmd.indices.rest, 4)
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
  const expected = `Header text

  pear stage ~ stage pear app

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
  const expected = `Header text

  pear stage [flags] <link> [app-args...]

  stage pear app

  more info about staging pear app

  Arguments:
    <link>          App link key
    [app-args...]   Any args passed after the link are passed to the app

  Flags:
    --dry-run|-d    View the changes without applying them
    --bare          Do not apply any warmup
    --help|-h       Show help


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
  --help|-h       Show help
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

  stage [flags] <link> [app-args...]

  stage pear app

  more info about staging pear app

  Arguments:
    <link>          App link key
    [app-args...]   Any args passed after the link are passed to the app

  Flags:
    --dry-run|-d    View the changes without applying them
    --bare          Do not apply any warmup
    --help|-h       Show help

Footer text
`
  t.plan(1)
  t.is(cmd.help(), expected)
})

test('hiddenFlag', (t) => {
  const head = header('Header text')
  const foot = footer('Footer text')
  const cmd = command(
    'stage',
    summary('stage pear app'),
    description('more info about staging pear app'),
    head,
    flag('--dry-run|-d', 'View the changes without applying them'),
    hiddenFlag('--bare'),
    arg('<link>', 'App link key'),
    rest('[app-args...]', 'Any args passed after the link are passed to the app'),
    foot
  )

  const expected = `Header text

  stage [flags] <link> [app-args...]

  stage pear app

  more info about staging pear app

  Arguments:
    <link>          App link key
    [app-args...]   Any args passed after the link are passed to the app

  Flags:
    --dry-run|-d    View the changes without applying them
    --help|-h       Show help

Footer text
`
  t.plan(2)
  t.is(cmd.help(), expected)
  t.is(cmd.parse(['--bare']).flags.bare, true)
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

  const expected = `pear stage [flags] <link> [app-args...]

stage pear app

more info about staging pear app

Arguments:
  <link>          App link key
  [app-args...]   Any args passed after the link are passed to the app

Flags:
  --dry-run|-d    View the changes without applying them
  --bare          Do not apply any warmup
  --help|-h       Show help
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

  const expected = `pear stage [flags] <link> [app-args...]

stage pear app

more info about staging pear app

Arguments:
  <link>          App link key
  [app-args...]   Any args passed after the link are passed to the app

Flags:
  --dry-run|-d    View the changes without applying them
  --bare          Do not apply any warmup
  --help|-h       Show help
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
  const expectedUsage = `pear stage [flags] [command]

stage pear app

more info about staging pear app

Flags:
  --dry-run|-d   View the changes without applying them
  --bare         Do not apply any warmup
  --help|-h      Show help

Commands:
  sub            subcmd
`
  const expectedOverview = `Header text

  pear another [flags] <reqd> [optl]

  Arguments:
    <reqd> [optl]

  Flags:
    --help|-h   Show help

  pear stage [flags] [command]

  stage pear app

  more info about staging pear app

  Flags:
    --dry-run|-d   View the changes without applying them
    --bare         Do not apply any warmup
    --help|-h      Show help

  Commands:
    sub            subcmd


Footer text
`
  t.is(app.usage('stage'), expectedUsage)
  t.is(app.overview({ full: true }), expectedOverview)
})

test('hiddenCommand', (t) => {
  t.plan(2)
  const head = header('Header text')
  const foot = footer('Footer text')
  const cmd = hiddenCommand(
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
    command('another', summary('one')),
    foot
  )
  const expectedOverview = `Header text

  pear another ~ one

Footer text
`

  t.is(app.overview(), expectedOverview)

  const expectedUsage = `pear [flags] [command]

Flags:
  --help|-h   Show help

Commands:
  another     one
`

  t.is(app.usage(), expectedUsage)
})

test('subcommand parent', (t) => {
  const sub = command('release')
  const cmd = command('gc', sub)
  command('pear', cmd)
  t.plan(2)
  t.is(sub.parent.name, 'gc', 'Subcommand parent')
  t.is(cmd.parent.name, 'pear', 'Command parent')
})

test('subcommand parent flag', (t) => {
  const sub = command('release')
  const cmd = command('gc', sub, flag('--flag', 'Test flag'))
  command('pear', cmd)
  t.plan(1)
  cmd.parse(['--flag'])
  t.ok(sub.parent.flags.flag, 'Parent flags from subcommand')
})

test('command with rest flags and args', async (t) => {
  const cmd = command('test', arg('<arg>', 'Test argument'), rest('...rest', 'rest arguments'), sloppy({ flags: true }))
  t.plan(3)
  cmd.parse(['val', '--flag-a', '--flag-b', 'rest-arg'])
  t.alike(cmd.rest, ['--flag-a', '--flag-b', 'rest-arg'])
  t.is(cmd.indices.args.arg, 0)
  t.is(cmd.indices.rest, 1)
})

test('command with empty rest', async (t) => {
  const cmd = command('test', arg('<arg>', 'Test argument'), rest('...rest', 'rest arguments'), sloppy({ flags: true }))
  t.plan(3)
  cmd.parse(['val'])
  t.alike(cmd.rest, [])
  t.is(cmd.indices.args.arg, 0)
  t.is(cmd.indices.rest, 1)
})

test('command with own flags, rest flags, and args', async (t) => {
  const cmd = command('test', flag('--flag-a'), arg('<arg>', 'Test argument'), rest('...rest', 'rest arguments'))
  t.plan(2)
  cmd.parse(['--flag-a', 'val', '--flag-b', 'rest-arg'])
  t.alike(cmd.rest, ['--flag-b', 'rest-arg'])
  t.is(cmd.indices.rest, 2)
})

test('command with invalid flags, rest flags, and args', async (t) => {
  const cmd = command('test', arg('<arg>', 'Test argument'), rest('...rest', 'rest arguments'))
  t.plan(1)
  t.exception(() => cmd.parse(['--flag-a', 'val', '--flag-b', 'rest-arg']), /UNKNOWN_FLAG: flag-a/)
})

test('hyphenated-flag is parsed camelCase, with "true" value, no kebab-case', async (t) => {
  t.plan(2)
  const cmd = command(
    'test',
    flag('--hyphenated-flag', 'Hyphenated flag'),
    function (cmd) {
      t.ok(cmd.flags.hyphenatedFlag, 'hyphenatedFlag should be true')
      t.is(cmd.flags['hyphenated-flag'], undefined, 'hyphenated-flag should not be kebab-case')
    }
  )

  const input = ['--hyphenated-flag']
  cmd.parse(input)
})

test('hyphenated-flag is parsed camelCase, with default "false" value, no kebab-case', async (t) => {
  t.plan(2)
  const cmd = command(
    'test',
    flag('--flag', 'Simple flag'),
    flag('--hyphenated-flag', 'Hyphenated flag'),
    function (cmd) {
      t.absent(cmd.flags.hyphenatedFlag, 'hyphenatedFlag should be false')
      t.is(cmd.flags['hyphenated-flag'], undefined, 'hyphenated-flag should not be kebab-case')
    }
  )

  const input = ['--flag']
  cmd.parse(input)
})

test('correct boolean value of flag aliases', async (t) => {
  t.plan(8)
  const cmd = command(
    'test',
    flag('--flag|-f', 'Test flag'),
    flag('--another-flag|-a', 'Test flag'),
    function (cmd) {
      t.ok(cmd.flags.f, 'Flag alias has correct boolean value')
      t.ok(cmd.flags.flag, 'Flag has correct boolean value')
      t.ok(!cmd.flags.a, 'Unused flag has correct boolean value')
      t.ok(!cmd.flags['another-flag'], 'Unused flag has correct boolean value')
    }
  )

  const input = ['--flag']
  cmd.parse(input)

  const aliasInput = ['-f']
  cmd.parse(aliasInput)
})

test('correct non-boolean value of flag aliases', async (t) => {
  t.plan(4)
  const cmd = command(
    'test',
    flag('--flag|-f [val] ', 'Test flag'),
    function (cmd) {
      t.is(cmd.flags.f, 'val', 'Flag alias has correct value')
      t.is(cmd.flags.flag, 'val', 'Flag has correct value')
    }
  )

  const input = ['--flag', 'val']
  cmd.parse(input)

  const aliasInput = ['-f', 'val']
  cmd.parse(aliasInput)
})

test('async parse error handling', async (t) => {
  t.plan(2)
  const cmd = command(
    'stage',
    flag('--dry-run', 'Performs a dry run'),
    arg('<link>', 'App link key'),
    sloppy({ flags: true }),
    async function () {
      throw new Error('test')
    }
  )
  const input = ['--dry-run']

  t.execution(() => cmd.parse(input))
  t.exception(() => cmd.running, new Error('test'))
})

test('sync parse error handling', async (t) => {
  t.plan(1)
  const cmd = command(
    'stage',
    flag('--dry-run', 'Performs a dry run'),
    arg('<link>', 'App link key'),
    sloppy({ flags: true }),
    function () {
      throw new Error('test')
    }
  )
  const input = ['--dry-run']

  t.exception(() => cmd.parse(input, { sync: true }), new Error('test'))
})

test('command with aliased flag and double dash', async (t) => {
  const cmd = command('test', flag('--flag|-f', 'Test flag'))
  t.plan(1)
  t.exception(() => cmd.parse(['--f']), /UNKNOWN_FLAG: f/)
})

test('args sloppy mode, no bail', (t) => {
  t.plan(5)
  const cmd = command(
    'test',
    sloppy({ args: true, flags: true }),
    () => t.pass('Parse does not bail')
  )
  const singleArgInput = ['unknown-arg']
  cmd.parse(singleArgInput)

  const multiArgInput = ['unknown-arg', 'unknown-arg']
  cmd.parse(multiArgInput)

  const noArgInput = []
  cmd.parse(noArgInput)

  const flagInput = ['--flag']
  cmd.parse(flagInput)

  const combinedInput = ['arg', '--flag', 'arg']
  cmd.parse(combinedInput)
})

test('auto --help|-h support', async (t) => {
  const cmd = command('test')
  t.plan(2)
  const { log } = console
  console.log = (content) => {
    t.alike(content.split(/\r?\n/), [ 'test [flags]', '', 'Flags:', '  --help|-h   Show help', '' ])
    console.log = log
  }
  t.is(cmd.parse(['--help']), null)
})

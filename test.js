'use strict'
const test = require('brittle')
const { header, command, flag, arg, rest, footer, description } = require('./')

test('command creation', async (t) => {
  const cmd = command('test')
  t.is(cmd.name, 'test', 'Command name should be set correctly')
})

test('command with description', async (t) => {
  const desc = 'Test command description'
  const cmd = command('test', description(desc))
  t.is(cmd.description, desc, 'Command description should be set correctly')
})

test('command with flags', async (t) => {
  const cmd = command('test', flag('-f --flag', 'Test flag'))
  t.ok(cmd.definedFlags.has('flag'), 'Flag should be added to command')
})

test('command with arguments', async (t) => {
  const cmd = command('test', arg('<arg>', 'Test argument'))
  t.ok(cmd.definedArgs.length === 1, 'Argument should be added to command')
})

test('command with rest arguments', async (t) => {
  const cmd = command('test', rest('...rest', 'Test rest arguments'))
  t.ok(cmd.definedRest, 'Rest argument should be set for command')
})

test('command with header', async (t) => {
  const hd = 'Test command header'
  const cmd = command('test', header(hd))
  t.is(cmd.header, hd, 'Command header should be set correctly')
})

test('command with footer', async (t) => {
  const ft = 'Test command footer'
  const cmd = command('test', footer(ft))
  t.is(cmd.footer, ft, 'Command footer should be set correctly')
})

test('command parsing', async (t) => {
  const cmd = command('test', flag('-f, --flag', 'Test flag'), arg('<arg>', 'Test argument'))
  const input = ['argumentValue', '-f']
  const parsed = cmd.parse(input)

  t.ok(parsed.flags.flag, 'Flag should be recognized and set')
  t.is(parsed.args.arg, 'argumentValue', 'Argument should be recognized and its value set')
})

test('command composition', (t) => {
  const cmd = command(
    'stage',
    description('stage pear app'),
    header('Header text'),
    flag('-d, --dry-run', 'View the changes without applying them'),
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

test.solo('nested command composition', (t) => {
  const head = header('Header text')
  const foot = footer('Footer text')
  const cmd = command(
    'stage',
    description('stage pear app'),
    head,
    flag('-d, --dry-run', 'View the changes without applying them'),
    flag('--bare', 'Do not apply any warmup'),
    arg('<link>', 'App link key'),
    rest('[app-args...]', 'Any args passed after the link are passed to the app'),
    foot,
    function (cmd) {
      console.log('cmd', cmd)
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
    flag('--json', 'JSON output'),
    cmd,
    foot
  )

  const input = ['--json', 'stage', '--dry-run', '--bare', 'pear://example', 'app', 'args']
  app.parse(input)
})

// TODO string val flag
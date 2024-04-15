const { header, command, flag, arg, rest, footer, description } = require('./')

const head = header(`
  Welcome to the Internet of Pears.

  v0.2967.kpzdysqu3uqu3nz7xakidqb1ju71jbzaszxu58r3owodbujyghuy
`)

const foot = footer(`
  Always share feedback with us on keet, enjoy!
`)

const run = command(
  'run',
  description('run any pear app'),
  head,
  flag('-d, --dry-run', 'View the changes without applying them'),
  flag('--bare', 'Do not apply any warmup'),
  arg('<link>', 'Link to the app'),
  rest('[app-args...]', 'Any args passed after the link are passed to the app'),
  foot,
  async function (args) {
    console.log('run the run app', args)
  }
)

const stage = command(
  'stage',
  description('stage your local files into a pear app'),
  head,
  flag('-d, --dry-run', 'View the changes without applying them'),
  flag('--bare', 'Do not apply any warmup'),
  arg('<channel|key>', 'Which channel or key are we staging into?'),
  rest('[dir]', 'Specify dir'),
  footer(`
    Always share feedback with us on keet, enjoy!
  `),
  async function () {
    console.log('run the app')
  }
)

const app = command(
  'pear',
  head,
  flag('-d, --dry-run', 'View the changes without applying them'),
  flag('--bare', 'Do not apply any warmup'),
  run,
  stage,
  foot,
  async function () {
    console.log('run the app')
  }
)

app.parse(['-d', 'run', '--bare', 'pear://link', 'b'])
console.log(app.help())

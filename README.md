# paparam

Strict and fair parameter papa

```
npm install paparam
```

## Usage

``` js
const Paparam = require('paparam')

const papa = new Paparam()

// simple app
papa
  .flag('dev')
  .flag('force', { alias: 'f' })
  .run(async function ({ flags }) {
    // ...
  })

// or multi command
papa.command('run')
  .flag('dev')
  .arg('link')
  .eatRest()
  .run(async function ({ args, flags, rest }) {
    // ...
  })

papa.command('stage')
  .flag('dryRun', { alias: ['dry-run', 'd'] })
  .run(async function ({ flags }) {
    // ...
  })

// nested commands!
const dev = papa.command('dev')

dev.command('build')
  .flag('debug')
  .run(function () {
    // ...
  })

dev.command('configure')
  .flag('debug')
  .run(function () {
    // ...
  })

papa.parse() // defaults to argv
```

## License

Apache-2.0

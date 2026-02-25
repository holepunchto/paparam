# paparam

Strict and fair parameter papa

```
npm install paparam
```

## Usage

### Simple Command

Use `paparam` to build a simple cli parser. Here is an example app invocation from the command line:

```bash
> app -i uuid-284h43j -b peer1 -b peer2 --storage /tmp/file/place link-32832uifsdjsfda
```

To handle this invocation, here is the `paparam` code

```js
import { header, summary, command, flag, arg } from 'paparam'
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
console.log('roomLink', program.args.roomLink)
cmd.add(flag('--another', 'lazy added'))
cmd.add({
  '--more': 'via description object',
  '--modifiers': ['are defined with array [desc, opts]', { multiple: true }]
})
cmd.parse(['-h'])
```

### Composed Commands

Use `paparam` exports to compose commands together:

```js
const { header, footer, command, flag, arg, summary, description, rest } = require('paparam')
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
```

This should output:

```
Welcome to the IoP

  pear [flags] [command]

  pear cli

  Flags:
    --log       log
    --help|-h   Show help

  Commands:
    run         Run an app from a link

holepunch.to | pears.com | keet.io

Welcome to the IoP

  pear run [flags] <link|channel> [...app-args]

  Run an app from a link

  Run an app from a file link (or path) or from a pear link.
  Optionally supply store for custom store path

  Arguments:
    <link|channel>      link to run
    [...app-args]

  Flags:
    --store|-s [path]   store path
    --help|-h           Show help

holepunch.to | pears.com | keet.io

ACTION -> run pear://link flags: { store: '/path/to/store', s: '/path/to/store', help: false, h: false }
ACTION -> run pear://link flags: {
  store: '/path/to/store',
  s: '/path/to/store',
  help: false,
  h: false,
  preIo: true
}
```

## API

### `command(name, ...args)`

Defines a command with a specific behavior based on the supplied modifiers such as flags, arguments, and descriptions. This function is used to create the command object.

- **Arguments**:
  - `name` `<String>`: The name of the command.
  - `...args` `<Modifier> | <Command> | <Object> | <Function>`: Supply modifiers and subcommands as arguments. Supply a [definition object](#definition-object) to declaratively define modifiers. Supply a single function argument as the command runner.

- **Returns**:
  - `cmd` `<Command>`: The command object capable of parsing CLI arguments and executing associated actions.

#### `cmd.add(...args)`

Update command with additional modifiers & subcommands. A runner function may also be added, but only one runner is supported so will in that case replace the prior command runner function.

- **Arguments**:
  - `...args` `<Modifier> | <Command> | <Function>`: Supply modifiers and subcommands as arguments. Supply a single function argument as the command runner.

- **Returns**:
  - `cmd` `<Command>`: The command object capable of parsing CLI arguments and executing associated actions.

#### `cmd.parse(argv = process.argv.slice(2), opts)`

Parses an array of command line arguments and executes the command based on the provided definition. Automatically handles '--help' or '-h' flags to display help information.

- **Arguments**:
  - `argv` `<String[]>`: An array of strings representing the command line arguments. Defaults to program arguments `process.argv.slice(2)` if unspecified. If the `-h` or `--help` flag is supplied help for the related command will be shown.
  - `opts` `<Object>`: Parse options
    - `sync` `<Boolean>`: Synchronous parse, only use this with synchronous function runners. Default `false`.
    - `silent` `<Boolean>`: Suppress the help display, even if `-h` or `--help` is provided.
    - `run` `<Boolean>`: If false, prevents the command runner from being executed.
- **Returns**:
  - `null` if the parsing leads to an error (with an error output) or the command object if the command executes without errors.

#### `cmd.help(...subcommands)`

Generates and returns help text for the command. Can take subcommand names as arguments to generate help for a specific subcommand path. When calling `cmd.parse(argv)`, if the `-h` or `--help` flag is supplied, this method is automatically called and output.

#### `cmd.usage(...subcommands)`

Returns help text without header or footer. Can take subcommand names as arguments to generate help for a specific subcommand path.

#### `cmd.overview({ full = false })`

Returns a string with a command overview. Set `full` to `true` to include detailed usage for each command.

- **Arguments**:
  - `full` `<Boolean>`: Whether to display a full overview that includes details of all defined sub-commands and flags.

#### `cmd.running` `<Promise> | null`

Either `null` if the command is not running or a promise that resolves when the command has completed running.

#### `cmd.bailed` `<Object> | null`

Either `null` if the command did not bail or an object descibing the bail. The object can be `{ bail <Object>, error <Error>?, output <String>? }`. If the object has an `error` property it failed to create the bail output (which could happen with a user defined bail function),
otherwise the object has an `output` property which explains the reason for the bail. The `bail` property of the `bailed` object has the following shape: `{ reason <String>, flag <Flag>, arg <Arg>, err <Error>}`. When present, `err` property on the `bail` objects would have been thrown from the runner, whereas the `bailed.error` property holds errors that occur during bailing.

#### `cmd.flags` `<Object>`

After `cmd.parse` has been called, contains parsed flag values.

#### `cmd.args` `<Object>`

After `cmd.parse` has been called, contains parsed arguments.

#### `cmd.positionals` `<Array>`

After `cmd.parse` has been called, contains original arguments in isolation.

#### `cmd.rest` `<Object>`

After `cmd.parse` has been called, contains rest arguments, if any, on `cmd.rest.restName` where `restName` is defined
by `rest(spec)` where `spec` is `[..rest-name]`.

#### `cmd.parent` `<Command>`

Command parent

#### `cmd.name` `<String>`

Command name

#### `cmd.description` `<String>`

Command description

#### `cmd.summary` `<String>`

Command summary

#### `cmd.header` `<String>`

Command header

#### `cmd.footer` `<String> | <Object>`

Command footer

#### `cmd.indices.flags` `<Object>`

After `cmd.parse` has been called, contains the index of each flag in the original array.

#### `cmd.indices.args` `<Object>`

After `cmd.parse` has been called, contains the index of each parsed argument in the original array.

#### `cmd.indices.positionals` `<Array>`

After `cmd.parse` has been called, contains the indexes of each positional argument in the original array.

#### `cmd.indices.rest` `<Number>`

After `cmd.parse` has been called, contains the index of the first rest argument in the positional array.

### `flag(spec, description)`

Defines a flag for a command. Flags can be simple boolean switches or can expect a value.

- **Arguments**:
  - `spec` `<String>`: `--long|-l (<value> | [value])?` , e.g., `--boolean-flag|-b`, `--string-flag [optional-value]`, `--string-flag <required-value>`
  - `description` `<String>`: A description of what the flag does.

- **Returns**:
  - `flag` `<Flag>`: A modifier that configures the command to recognize and handle the specified flag.
  - `flag.hide()` to hide the flag from help.
  - `flag.multiple()` to make this flag into an array of all passed values instead of the latest one only.

### `arg(spec, description)`

Defines a positional argument for a command.

- **Arguments**:
  - `spec` `<String>`: `[arg] | <arg>` where arg is the placeholder name for the argument, e.g. `<name>`, (required) `[dir]` (optional)
  - `description` `<String>`: A description of what the argument is for.

- **Returns**:
  - `<Arg>`: A modifier that configures the command to accept and process the specified argument.

### `rest(spec, description)`

Defines rest arguments that are captured after all flags and named arguments.

- **Arguments**:
  - `spec` `<String>`: `[...rest-name]`. The name to collect rest arguments under, e.g. `[...app-args]` array will be stored at `cmd.rest.appArgs`.
  - `description` `<String>`: Description of what these rest arguments represent.

- **Returns**:
  - `<Rest>`: A modifier that configures the command to capture additional arguments not explicitly defined.

### `validate(validator, description)`

Defines a validation function for the command. This function is used to enforce custom validation logic on the command after parsing, such as checking the relationship of flags, arguments, rest arguments, etc.

- **Arguments**:
  - `validator` `<Function>`: A function that takes the parsed command object and returns a boolean indicating whether the validation passed. If the validation fails, the function should throw an error or return a string describing the validation error.
    - **Parameters**:
      - `args` `<Object>`: An object containing the parsed arguments.
      - `flags` `<Object>`: An object containing the parsed flags.
      - `positionals` `<Array>`: An array containing the positional arguments.
      - `rest` `<Object>`: An object containing the rest arguments.
      - `indices` `<Object>`: An object containing the indices of flags, arguments, positionals, and rest.
        - `flags` `<Object>`: An object containing the indices of the flags.
        - `args` `<Object>`: An object containing the indices of the arguments.
        - `positionals` `<Array>`: An array containing the indices of the positional arguments.
        - `rest` `<Number>`: The index of the rest arguments.
      - `command` `<Command>`: The command object being validated.
    - **Returns**:
      - `<Boolean>`: The validator function should return true if the validation passes, indicating that the command is valid. If the validation fails, it should return false or throw an error. Returning false indicates that the command is invalid.

- **Returns**:
  - `<Validation>`: A modifier that configures the command to use the specified validation function.

### `summary(text)`

Defines a brief summary of the command's functionality.

- **Arguments**:
  - `text` `<String>`: Summary of the command's purpose.

- **Returns**:
  - `<Data>`: A modifier containing the summary information.

### `` description(text) | description`text` ``

Defines a detailed description of the command's functionality.
When used as a tagged template function, `description` automatically dedents the text.

- **Arguments**:
  - `text` `<String>`: Detailed information about the command.

- **Returns**:
  - `<Data>`: A modifier containing the description information.

### `header(text)`

Define a header for the command's help output.

- **Arguments**:
  - `text` `<String>`: Text to display at the top of the output.

- **Returns**:
  - `<Data>`: A modifier that configures the header text.

### `footer(text | { overview: text, help: text })`

Define a footer for the command's help & overview output.

- **Arguments**:
  - `text` `<String> | { overview: text <String>, help: text <String> }`| : Text to display at the bottom of the help and/or overview output.

- **Returns**:
  - `<Data>`: A modifier that configures the footer text.

### `bail(fn)`

Set the bail handler to `fn`.

### `sloppy(opts)`

Configures the command to be non-strict when parsing unknown flags or arguments.

### Definition Object

The `command` function can also accept plain objects with the following form:

```
  {[modifier <arg1>]: '<arg2>' | ['<arg2>', adjusters {...}]}
```

`modifier`: names of exported functions designed to passed to `command` function such as `flag(...)`, `arg(...)`, `summary(...)` and so on.
`<arg1>`: first arg passed, e.g. `flag('--some value') -> 'flag --some value'`, `rest('[...args]') -> 'rest [...args]'`
`<arg2>`: second arg passed to modifier `flag('--some value', 'some flag') -> {'flag --some value': 'some flag'}`
`['<arg2>', adjusters {...}]`: adjusters are methods on modifiers, such as `flag.multiple()`, `flag.choices(...)`, `flag.hide()` and `arg.hide()`. For adjusters with args the value should be the arg eg `{choices: ['a', 'b', 'c']}`, otherwise set to `true` to enable `{ multiple: true }`

Example:

```js
import { command } from 'paparam'
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
```

This is a useful format for supporting JSON-based definitions of commands.

## License

Apache-2.0

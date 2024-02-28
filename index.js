class Parser {
  constructor (argv) {
    this.argv = argv
    this.i = 0
    this.multi = null
  }

  rest () {
    const rest = this.argv.slice(this.i)
    this.i = this.argv.length
    return rest
  }

  next () {
    while (true) {
      const r = {
        flag: null,
        rest: null,
        arg: null
      }

      if (this.multi && this.multi.length) {
        const name = this.multi.pop()
        r.flag = { long: false, name, value: '' }
        return r
      }

      this.multi = null

      if (this.i >= this.argv.length) return null
      const a = this.argv[this.i++]

      if (a === '--') {
        r.rest = this.rest()
        return r
      }

      if (a.length > 2 && a[0] === '-' && a[1] === '-') {
        let j = a.indexOf('=')
        if (j === -1) j = a.length
        const name = a.slice(2, j)
        const value = a.slice(j + 1)

        r.flag = { long: true, name, value }
        return r
      }

      if (a.length > 1 && a[0] === '-') {
        this.multi = []
        for (let i = 1; i < a.length; i++) this.multi.push(a[i])
        this.multi.reverse()
        continue
      }

      r.arg = a
      return r
    }
  }
}

class Paparam {
  constructor (parent) {
    this.definedCommands = new Map()
    this.definedFlags = new Map()
    this.definedArgs = []
    this.runner = null

    this.strictFlags = true
    this.strictArgs = true
    this.isEatingRest = false
    this.main = parent ? parent.main : this
    this.parent = parent || null

    this.flags = {}
    this.args = {}
    this.positionals = []
    this.rest = null
    this.running = null
  }

  static parseSoon (argv = []) {
    const papa = new Paparam()
    queueMicrotask(() => papa.parse())
    return papa
  }

  static argv () {
    if (typeof Bare !== 'undefined') {
      return Bare.argv.slice(2)
    }

    if (typeof process !== 'undefined') {
      return process.argv.slice(2)
    }

    return []
  }

  reset () {
    this.flags = {}
    this.args = {}
    this.positionals = []
    this.rest = null
    this.running = null

    return this
  }

  flag (name, opts = {}) {
    const bool = !opts.value

    const flag = {
      name,
      bool
    }

    for (const f of toArray(opts.alias, name)) {
      if (this.definedFlags.has(f)) throw new Error('Flag already in use:', f)
      this.definedFlags.set(f, flag)
    }

    return this
  }

  arg (name) {
    this.definedArgs.push({
      name
    })

    return this
  }

  sloppy ({ flags = false, args = false } = {}) {
    this.strictFlags = flags
    this.strictArgs = args

    return this
  }

  eatRest () {
    this.isEatingRest = true
    return this
  }

  command (name, opts = {}) {
    const command = new Paparam(this)

    for (const c of toArray(opts.alias, name)) {
      if (this.definedCommands.has(c)) throw new Error('Command already in use:', c)
      this.definedCommands.set(c, command)
    }

    return command
  }

  run (fn) {
    this.runner = fn
  }

  _getFlag (name) {
    let f = this.definedFlags.get(name)
    if (f === undefined && this.strictFlags === false) f = defaultFlag(name)
    return f || null
  }

  _getCommand (name) {
    return this.definedCommands.get(name) || null
  }

  _onflag (parser, flag) {
    const def = this._getFlag(flag.name)

    if (def === null) return createBail('UNKNOWN_FLAG', flag, null)

    if (def.bool === true) {
      if (flag.value) return createBail('INVALID_FLAG', flag, null)
      this.flags[def.name] = true
      return null
    }

    if (def.bool === false) {
      if (flag.value) {
        this.flags[def.name] = flag.value
        return null
      }

      const next = parser.next()
      if (next === null || !next.arg) return createBail('INVALID_FLAG', flag, null)
      this.flags[def.name] = next.arg
    }

    return null
  }

  _onarg (parser, arg) {
    const info = { index: this.positionals.length, value: arg }

    if (this.definedArgs.length <= this.positionals.length) {
      if (this.strictArgs === false) {
        this.positionals.push(arg)
        return null
      }

      return createBail('UNKNOWN_ARG', null, info)
    }

    const def = this.definedArgs[this.positionals.length]
    this.positionals.push(arg)
    this.args[def.name] = arg

    return null
  }

  _onrest (parser, rest) {
    if (this.isEatingRest === false) {
      return createBail('UNKNOWN_ARG', null, { index: this.positionals.length, value: '--' })
    }

    this.rest = rest
    return null
  }

  _onbail (bail) {
    // TODO: should autogen help etc based on options or whatever is setup

    if (bail.flag) throw new Error(bail.reason + ': ' + bail.flag.name)
    if (bail.arg) throw new Error(bail.reason + ': ' + bail.arg.value)

    throw new Error(bail.reason)
  }

  parse (argv = Paparam.argv()) {
    const p = new Parser(argv)

    let c = this.reset()
    let bail = null

    const visited = [c]

    while (bail === null) {
      if (c.isEatingRest === true && c.positionals.length === c.definedArgs.length) {
        bail = c._onrest(p, p.rest())
        break
      }

      const n = p.next()
      if (n === null) break

      if (n.flag) {
        bail = c._onflag(p, n.flag)
        continue
      }

      if (n.rest) {
        bail = c._onrest(p, n.rest)
        continue
      }

      if (c.definedCommands.size > 0) {
        const cmd = c._getCommand(n.arg)

        if (cmd !== null) {
          c = cmd.reset()
          visited.push(c)
          continue
        }
      }

      bail = c._onarg(p, n.arg)
    }

    if (!bail) {
      if (c.runner !== null) c.running = runAsync(c)
      return c
    }

    c._onbail(bail)
    return null
  }
}

module.exports = Paparam

async function runAsync (c) {
  await c.runner({ args: c.args, flags: c.flags, positionals: c.positionals, rest: c.rest, command: c })
}

function createBail (reason, flag, arg) {
  return {
    reason,
    flag,
    arg
  }
}

function defaultFlag (name) {
  return {
    name,
    bool: false
  }
}

function toArray (list, extra) {
  list = Array.isArray(list) ? list : (list ? [list] : [])
  if (extra) list.push(extra)
  return list
}

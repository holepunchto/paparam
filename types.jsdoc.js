'use strict'
module.exports = {}
/**
 * @typedef {{
 *   flags: Record<string, string>
 *   args: Record<string, string>
 *   positionals: Array<string>
 *   rest: Array<string>
 *   indices: {
 *     flags: Record<string, number>
 *     args: Record<string, number>
 *     positionals: Array<number>
 *     rest: number
 *   }
 *   command: string
 * }} ValidatorParams
 */
/**
 * @typedef {(
 *   validator: (params: ValidatorParams) => boolean
 *   description: string
 * ) => void} ValidatorCreator
 */

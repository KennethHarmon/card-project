// --------------------------------------------------------------------------------------------------------------------
// The Dumper.
//
// @module lib/dumper
// --------------------------------------------------------------------------------------------------------------------

var util = require('util');

// --------------------------------------------------------------------------------------------------------------------

/**
 * Dumps the structure of arbitrary objects in a readable fashion.
 *
 * @param {object} target - the object to dump
 * @param {?number} depth - the maximum depth to display; specify `-1` or `null` for unlimited depth
 * @constructor
 */
function Dumper(target, depth)
{
    this.target = target;
    this.depth = depth;
    this.inspectOpts = this.getDefaultInspectOpts();
} // end Dumper

Dumper.prototype.setLoggingContext = function setLoggingContext(context)
{
    this.inspectOpts = this.getDefaultInspectOpts();

    var args = (context.handler || {}).dumperArgs;
    if(args)
    {
        for(var key in args)
        {
            this.inspectOpts[key] = args[key];
        } // end for
    } // end if

    if(this.depth == -1 || this.depth === null)
    {
        this.inspectOpts.depth = null;
    }
    else if(this.depth !== undefined)
    {
        this.inspectOpts.depth = this.depth;
    } // end if
}; // end setLoggingContext

Dumper.prototype.toString = function toString()
{
    return util.inspect(this.target, this.inspectOpts);
}; // end toString

Dumper.prototype.inspect = Dumper.prototype.toString;

Dumper.prototype.getDefaultInspectOpts = function getDefaultInspectOpts()
{
    return {};
}; // end getDefaultInspectOpts

// --------------------------------------------------------------------------------------------------------------------

module.exports = {
    Dumper: Dumper
};

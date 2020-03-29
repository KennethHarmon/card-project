// --------------------------------------------------------------------------------------------------------------------
// A logging context.
//
// @module lib/context
// --------------------------------------------------------------------------------------------------------------------

var path = require('path');
var util = require('util');

var logging = require('../logging');
var stack = require('../util/stack');

// --------------------------------------------------------------------------------------------------------------------

var datetimeSplitRE = /T/;

// --------------------------------------------------------------------------------------------------------------------

/**
 * A context representing an individual log event.
 *
 * @param {string} logger - the name of the logger that generated the event
 * @param {string} level - the name of the severity level at which this message was logged
 * @param {string} message - the message string, contaianing zero or more `printf`-style placeholders (`%s`, `%d`,
 *          `%j`, or `%%`; see `util.format`)
 * @param {Array.<string>} args - arguments to render in place of placeholders in `message`; if more arguments than
 *          placeholders are present, they are converted to strings and concatenated to the message (see `util.format`)
 * @constructor
 */
function Context(logger, level, message, args)
{
    this.logger = logger;
    this.level = level;
    this.message = message;
    this.args = args || [];
    this.stack = stack.getStack();
} // end Context

/**
 * Create a proxy context attached to the given handler.
 *
 * This allows the dumper (and possibly other code) to tailor its behavior to the handler currently being used.
 *
 * @param {BaseHandler} handler - the handler to attach to
 */
Context.prototype.attachToHandler = function(handler)
{
    function AttachedContext(handler)
    {
        this.handler = handler;
        this._dumperArgs = handler.dumperArgs;
    } // end AttachedContext

    AttachedContext.prototype = this;

    return new AttachedContext(handler);
}; // end Context#attachToHandler

/**
 * Creates a clone of this Context.
 */
Context.prototype.clone = function()
{
    var obj = new Context(this.logger, this.level, this.message, this.args);
    for(var key in this)
    {
        obj[key] = this[key];
    } // end for

    return obj;
}; // end Context#clone

// --------------------------------------------------------------------------------------------------------------------

function ctxProp(getter, setter)
{
    var name = getter.name;
    Object.defineProperty(Context.prototype, name, {'get': getter, 'set': setter});
} // end ctxProp

ctxProp(function datetime()
    {
        return this._date.toISOString().replace(datetimeSplitRE, ' ');
    }); // end datetime

ctxProp(function shortDatetime()
    {
        var date = this.date;
        if(date != this.handler._lastDate)
        {
            this.handler._lastDate = date;
            return date + ' ' + this.time;
        } // end if
        return this.time;
    }); // end shortDatetime

ctxProp(function date()
    {
        return this._date.toISOString().split(datetimeSplitRE)[0];
    }); // end date

ctxProp(function time()
    {
        return this._date.toISOString().split(datetimeSplitRE)[1];
    }); // end time

ctxProp(function message()
    {
        this.args.forEach(function(arg)
        {
            if(arg && arg.setLoggingContext)
            {
                arg.setLoggingContext(this);
            } // end if
        }.bind(this));

        return util.format.apply(util, [this._message].concat(this.args));
    },
    function set_message(message)
    {
        this._message = message;
        this._date = new Date();
    }); // end message

ctxProp(function type()
    {
        return this.stack[0].getTypeName();
    }); // end type

ctxProp(function func()
    {
        return this.stack[0].getMethodName() || '<anonymous>';
    }); // end func

ctxProp(function filename()
    {
        var fileName = this.stack[0].getFileName();
        if(fileName[0] == '/')
        {
            return path.relative(logging._mainDir, fileName);
        }
        else
        {
            return '<builtin> ' + fileName;
        } // end if
    }); // end filename

ctxProp(function line()
    {
        return this.stack[0].getLineNumber();
    }); // end line

ctxProp(function column()
    {
        return this.stack[0].getColumnNumber();
    }); // end column

// --------------------------------------------------------------------------------------------------------------------

module.exports = {
    Context: Context
};
